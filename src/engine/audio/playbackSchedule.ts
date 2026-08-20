/**
 * Pure (Tone-free) note-scheduling for playback. Walks a {@link Score} and returns the flat
 * list of sounding notes with absolute onsets + durations in quarter-note beats — everything
 * {@link PlaybackEngine.play} needs *except* the Tone.js scheduling call itself. Extracting it
 * keeps the timing/tie/legato/dynamics/articulation logic unit-testable (no AudioContext).
 *
 * **Multi-staff:** `Measure.slots` is the FLAT (staffId-discriminated) slot array — it already
 * holds every staff's content interleaved — so a single pass over it schedules all stacked
 * staves against ONE shared per-measure clock. There is no per-staff accumulation (staff 2 bar
 * 3 and staff 1 bar 3 share the same absolute onset), which is exactly the invariant the
 * multi-staff plan (§8) calls for; the flat model gets it for free.
 *
 * ⭐ **Dynamics ARE per-staff now** (2026-08-19, docs/dynamic-voice-scope-plan.md P1): a mark
 * governs the voices its `voice` names — or every voice of its own staff when it names none, which
 * is what every stamp writes — and {@link resolveChordLevels} compares the STAFF as well as the
 * voice. ⚠️ It compared neither before: this note used to say a staff-2 chord "inherits its voice's
 * dynamic", which was the leak, not the design. What is still deferred is anything BEYOND "which
 * marks reach this slot" — a staff-level balance is not a thing the model says.
 */
import type { Score, Chord, ChordRest, DynamicLevel, FanMark, Measure, NotePitch, PitchSpelling } from '@/types/music'
import { durationToBeats } from '@/utils/musicUtils'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { doubleDuration, durationFlags, slotLength } from '@/utils/durations'
import { fracToNumber } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { DYNAMIC_VELOCITY, DEFAULT_DYNAMIC, resolveChordLevels } from '@/utils/dynamics'
import { laneOfSlot, pairRoleAt } from '@/utils/tremoloPair'
import { fanMembers, fanMemberPitches } from '@/utils/fannedBeam'
import { legatoChordIds } from '@/utils/slurs'
import { articulationEffect } from '@/utils/articulations'
import { buildTempoMap, beatsToSeconds, secondsToBeats, type TempoSegment } from '@/utils/tempoMap'
import { voiceOf } from '@/utils/lanes'
import { applySoundingShift, soundingShiftBySlot } from '@/utils/soundingShift'
import { pedalWindows, pedalWindowCovers, type PedalWindow } from '@/utils/pedalScope'
import { trillAttacks, TRILL_PERIOD_SECONDS } from './trillAttacks'
import { trillSpan } from '@/engine/models/trillOps'
import { trillAuxiliary } from '@/utils/trillPitch'
import { keyAt } from '@/utils/keySignature'
import { prevailingAlterations } from '@/utils/accidentalState'
import { measureAccidentalNotes } from '@/utils/musicUtils'

/** A single sounding note to schedule, in tempo-independent beat units. */
export interface ScheduledNote {
  /**
   * ⭐⭐ **THE SOUNDING PITCH, AS A SPELLING** — the written `step`/`alter`/`octave` with any octave
   * line folded into the octave ({@link applySoundingShift}). ⛔ **Not a MIDI number, and that is
   * the point of this field.**
   *
   * Built 2026-08-20, `docs/playback-semantics-plan.md`: score → **schedule (pitch)** → interpret
   * (MIDI, for whatever synth is listening). Until then this was `midi: number` and the integer was
   * minted at four sites in this file; it is now minted once, in `WebAudioFontInstrument.noteOn`.
   *
   * ⚠️⚠️ **The reason is not tidiness — it is that `spellingToMidi` DESTROYS the enharmonic.** G♯4
   * and A♭4 both become 61, and which of the two was written is the only thing a tuning system could
   * interpret: in meantone G♯ sounds *lower* than A♭, in Pythagorean *higher*
   * (docs/tuning-systems-and-alteration.md). A schedule carrying integers has already thrown away
   * its own input, so no later layer can be built on it.
   *
   * ⛔ **Do not widen this into MIDI-shaped fields** (bend, channel, program). Those are the
   * interpret step's vocabulary; a schedule that grows them has moved the boundary back.
   */
  pitch: PitchSpelling
  /** Absolute onset from score start, in quarter-note beats (the shared clock). */
  startBeats: number
  /** Sounding length in beats, after tie-extension, legato overlap and articulation. */
  durationBeats: number
  /** Normalized velocity 0–1 (dynamic level × articulation scale).
   *
   *  ⏭️ The range is already right; what `docs/playback-semantics-plan.md` wants of it is that it be
   *  a MUSICAL value (0 = niente, 1 = the loudest possible) rather than this synth's calibration —
   *  and, the requirement with teeth, **a function over time rather than a per-note constant**, or a
   *  hairpin can never sound. */
  velocity: number
  /**
   * The staff this event was emitted on — an INTERNAL routing field, not part of the public API
   * ({@link PlayableNote} does not carry it).
   *
   * ⭐ It exists for the sustain pedal, which is the first rule here that is about a STAFF rather
   * than about a note (docs/pedal-plan.md §9): the damper holds every note of an instrument, so
   * "which events does this pedal hold" cannot be asked without it. ⚠️ Absent = the first staff, the
   * model's convention everywhere (`utils/lanes`), so it is normalised rather than compared
   * directly — `pedalWindowCovers`.
   */
  staffId?: string
}

/** Legato (slur) binds a note slightly past its nominal end so it meets the next onset. */
const LEGATO_OVERLAP_BEATS = 0.12

/**
 * TOTAL BEAMS (the note's own flags + the tremolo's strokes) at which the mark stops meaning a
 * subdivision and starts meaning "as fast as possible" — the one number that chooses between rule 1
 * and rule 2 below (docs/tremolo-plan.md §5).
 *
 * **4 — our answer, deliberately one higher than the references.** Gould reports that players assume
 * unmeasured from three, and Dorico's default minimum is 3 (exposed as a preference). Ours keeps THREE
 * total beams measured, so the classic readings stay literal: three strokes on a quarter, two on an
 * eighth and one on a sixteenth are all played as real 32nds, in tempo.
 *
 * ⚠️ It ties directly to {@link UNMEASURED_PERIOD_SECONDS}, and the two cannot be picked apart: with
 * the threshold at 4, the fastest MEASURED reading is a 32nd, so the physical rate must be faster than
 * a 32nd — otherwise adding a stroke (3 beams → 4) would make the note repeat more SLOWLY, which is
 * absurd. Lower the threshold and that constraint loosens; raise it and it tightens.
 */
export const UNMEASURED_THRESHOLD = 4

/**
 * The repetition period of an UNMEASURED tremolo, **in seconds** — a physical speed, the fastest the
 * technique goes, with no relation to any note value.
 *
 * **0.05 s (~20 attacks/sec).** Faster than the references — Dorico's default is 0.1 s (worded as
 * "1/5 of a quarter at 120 qpm", ~10/sec) and NotePerformer suggests 1/8 (~16/sec) — because
 * {@link UNMEASURED_THRESHOLD} is 4 here, not 3. That leaves a 32nd as the fastest measured reading,
 * which at 120 qpm is 16 attacks/sec, so anything at or below 16 would make an EXTRA stroke slow the
 * note down. The two constants are one decision.
 *
 * Held in SECONDS rather than in Dorico's wording because the wording hides the point: it is not a
 * fraction of anything in the score.
 *
 * ⚠️ Above roughly 150 qpm a written 32nd is itself faster than 0.05 s, so a measured tremolo there
 * out-runs an unmeasured one. That is a statement about the music, not a bug: taking a `min` with the
 * measured rate would put the tempo back into rule 2 and undo the whole point of it.
 *
 * ⚠️ **Seconds is what makes it tempo-independent, and that is structural, not cosmetic.** Everything
 * else in this collector is in beats and gets converted by the tempo map, so a measured tremolo
 * correctly tracks the tempo. An unmeasured one must NOT: it is as fast as the player can move,
 * whatever the conductor is doing. Sibelius's well-known failing is exactly this — it plays three
 * strokes as measured 32nds, which sounds worse the slower the music gets.
 */
export const UNMEASURED_PERIOD_SECONDS = 0.05

/**
 * How far a PENDERECKI attack's spacing wanders, as a fraction of the period — ±30%, so each gap is
 * somewhere in 0.7…1.3 of {@link UNMEASURED_PERIOD_SECONDS}.
 *
 * This is the whole difference between rule 2 and rule 3. Both are "as fast as possible"; only the
 * Penderecki sign also says the speed itself VARIES, so rule 2 must stay strictly even and this is
 * what separates them. ±30% is audibly uneven without reading as a different rhythm — small enough
 * that nobody hears a subdivision, large enough that nobody hears a machine.
 */
export const PENDERECKI_ONSET_JITTER = 0.3

/**
 * How far a Penderecki attack's velocity wanders, as a fraction of the note's dynamic — ±15%.
 *
 * The onset jitter alone is not enough: an EVEN attack at a wobbling rate still reads as a machine
 * with a broken clock. A player whose speed varies is also not striking identically each time, so the
 * loudness has to move with the timing. Smaller than the onset jitter on purpose — this is meant to
 * be felt rather than heard as an accent pattern.
 */
export const PENDERECKI_VELOCITY_JITTER = 0.15

/** Total sounding length of the score in beats (shared spine — sum of per-measure capacity). */
export function scoreTotalBeats(score: Score): number {
  let total = 0
  for (const measure of score.measures) total += measureCapacityQuarters(measure)
  return total
}

/** A note to hand the instrument: when to strike it, relative to the moment playback begins. */
export interface PlayableNote {
  /** ⭐ The sounding pitch, carried through unchanged — see {@link ScheduledNote.pitch}. This stage
   *  converts the CLOCK (beats→seconds) and nothing else, so it must not touch the pitch either. */
  pitch: PitchSpelling
  /** Seconds from the start of THIS play — 0 is the instant `play()` was called. */
  atSeconds: number
  /** Sounding length in seconds. */
  durationSeconds: number
  velocity: number
}

/**
 * The notes one play actually sounds, in seconds from the moment it starts — the beats→seconds
 * conversion and **where the play begins**, together, because they are one decision.
 *
 * ⭐ Playing from bar N is an ORIGIN SHIFT and nothing more: drop every note attacked before N, and
 * move the rest earlier by the time N sits at. Extracted from `PlaybackEngine.play()` so it can be
 * tested at all — that method needs an AudioContext, and the bug this function exists to prevent
 * was invisible without one: `seekToMeasure` set a field, `play()` never read it, and every play
 * began at bar 1 however the caller had seeked ("I select bar 3 and it starts from the beginning").
 *
 * ⚠️ A note still SOUNDING across the start point is dropped with the rest. It was attacked in a bar
 * we are not playing, and re-striking it here would put an onset where the score has none — Sibelius
 * plays from a bar the same way.
 *
 * ⚠️ A duration is the DIFFERENCE of two map lookups, never a beat-length times one rate: a note may
 * straddle a tempo change, and one rate would use the onset's tempo for the whole note.
 */
export function playableFrom(
  notes: Iterable<ScheduledNote>,
  tempoMap: TempoSegment[],
  /** Absolute beat this play starts at — `measureStartQuarters(score.measures, bar)`. 0 = the top. */
  startBeats: number,
): PlayableNote[] {
  // Half a thousandth of a beat: `startBeats` is a sum of floats, and a note landing exactly on the
  // downbeat must sound rather than be rounded out of its own bar.
  const EPSILON = 5e-4
  const startSeconds = beatsToSeconds(tempoMap, startBeats)
  const out: PlayableNote[] = []
  for (const ev of notes) {
    if (ev.startBeats < startBeats - EPSILON) continue
    const onsetSeconds = beatsToSeconds(tempoMap, ev.startBeats)
    const endSeconds = beatsToSeconds(tempoMap, ev.startBeats + ev.durationBeats)
    out.push({
      pitch: ev.pitch,
      atSeconds: onsetSeconds - startSeconds,
      durationSeconds: endSeconds - onsetSeconds,
      velocity: ev.velocity,
    })
  }
  return out
}

/**
 * Flatten a score into the notes to sound, in schedule order. Absolute onsets come from a
 * shared per-measure clock (accumulated ONCE per measure, reused across staves), so parallel
 * staves line up. Same-pitch ties are chased to extend the head note's duration and suppress
 * the continuation's re-attack; a differently-pitched "tie" (a migration artifact) plays
 * normally. Rests produce nothing.
 */
export function collectScheduledNotes(
  score: Score,
  /** The tempo map, for the ONE rule that needs seconds — an unmeasured tremolo's physical rate (see
   *  {@link UNMEASURED_PERIOD_SECONDS}). Defaults to building it, which keeps this function pure and
   *  callable from a test with nothing but a score; `PlaybackEngine` passes the map it already has so
   *  both sides read the same clock. */
  tempoMap: TempoSegment[] = buildTempoMap(score),
  /**
   * Randomness source for the ONE thing here that is deliberately not deterministic: a Penderecki
   * tremolo's jitter (see {@link PENDERECKI_ONSET_JITTER}). Injected rather than calling
   * `Math.random` inline, because this collector is pure and its tests depend on that — a bare
   * `Math.random()` in here would give a green suite that proves nothing about what you hear. Tests
   * pass a seeded stub.
   *
   * Re-rolled per playback, which falls out of `PlaybackEngine.play` calling this afresh: two
   * performances of a Penderecki tremolo are not identical. That is deliberate, not incidental.
   */
  rng: () => number = Math.random,
): ScheduledNote[] {
  // Pass 1: id → owning chord, so a tiedTo/tiedFrom chain can look up its neighbour's pitch.
  // (Global note ids, so this is naturally staff-safe; the chase is also pitch-guarded below.)
  const chordOf = new Map<string, Chord>()
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'chord') {
        for (const np of slot.notes) chordOf.set(np.id, slot)
      }
    }
  }

  // Dynamics as a per-voice step function (chord.id → level); legato set of slurred chords.
  const chordLevels = resolveChordLevels(score)
  const legatoChords = legatoChordIds(score)

  // ⭐ WHICH SLOTS TRILL — resolved ONCE, not asked per slot. A trill lives in `score.trills` rather
  // than on the slot it marks (unlike a tremolo, which the branch below reads straight off the
  // chord), so without this the loop would rescan a list at every event. `trillSpan` walks the score
  // per trill; there are few trills and many slots, so the prepass is the cheap direction.
  const trilledSlots = trilledSlotIds(score)

  // ⭐⭐ HOW FAR EACH SLOT IS FROM ITS OWN NOTATION — the octave lines, resolved once per slot rather
  // than asked per pitch (docs/ottava-plan.md §6). ⚠️ **Every `applySoundingShift` below takes its
  // slot's shift** — that is the rule, and it is checkable by grep precisely because the shift is one
  // lookup rather than a resolver called from four places on three emit paths. Empty for any score
  // with no ottava in it, which is the whole of the un-shifted path.
  //
  // ⚠️ The grep used to read `spellingToMidi` and to carry an "except `sameMidi`" exemption; since
  // 2026-08-20 this file mints no MIDI at all, so the two are no longer the same word and the
  // exemption is gone. `sameMidi` still compares WITHOUT a shift, for its own reason — see there.
  const shifts = soundingShiftBySlot(score)

  const events: ScheduledNote[] = []
  /**
   * ⭐⭐ **WHICH STAFF EACH EVENT CAME FROM, recorded at ONE site.** A slot's events are contiguous
   * in `events` — every branch below appends and none reorders — so one mark per slot dates the
   * whole run that follows it, and `stampStaffIds` fills them in afterwards.
   *
   * ⚠️ **This is deliberately not a `staffId` argument threaded through the emitters.** There are
   * six push sites (the plain note, the tremolo fill, the trill attacks, the fan's, and two inside
   * the pair's), three of them in helpers with their own signatures, and any of them missed would be
   * a note the pedal silently fails to hold. A mark cannot be missed by a `continue`, and a seventh
   * emit path inherits it by construction (docs/pedal-plan.md §9).
   */
  const staffMarks: Array<{ from: number; staffId?: string }> = []
  let currentTimeInBeats = 0
  for (const measure of score.measures) {
    const measureStartBeats = currentTimeInBeats

    // Where each slot sits in its own LANE (one voice of one staff, in beat order) — the only view
    // in which "the next note" means anything, and what the two-note tremolo is defined over.
    const lanes = laneIndexOfMeasure(measure)

    for (const slot of measure.slots) {
      if (slot.type === 'rest') continue
      const chord = slot
      // Everything appended from here until the next mark belongs to this slot's staff. Before any
      // branch, so the two `continue`s below (a tremolo pair's second slot, a fan) cannot skip it.
      staffMarks.push({ from: events.length, staffId: chord.staffId })

      // Articulation bends attack (velocity) and length (duration) on top of the dynamic.
      const artic = articulationEffect(chord.articulations)
      /** This slot's octave-line shift in semitones (0 = the ordinary note). Added to every midi
       *  derived below — the slot is the grain because a tremolo, a fan and a trill all re-attack
       *  inside ONE slot's position. */
      const shift = shifts.get(chord.id) ?? 0
      const baseVelocity = DYNAMIC_VELOCITY[chordLevels.get(chord.id) ?? DEFAULT_DYNAMIC]
      const velocity = Math.min(1, baseVelocity * artic.velocityScale)
      const startBeats = measureStartBeats + fracToNumber(chord.beat)
      const baseDurationBeats = chord.actualDuration
        ? fracToNumber(chord.actualDuration)
        : durationToBeats(chord.duration, chord.dots || 0)

      // ⭐ A TWO-NOTE TREMOLO alternates whole PITCH SETS, so it branches on the SLOT — here, before
      // the per-pitch loop, and not beside the single-note expansion inside it. That one runs one
      // pitch at a time, each filling its own length; this one fills the two slots' COMBINED length
      // and hands each attack to a different chord.
      const at = lanes.get(chord.id)
      const pairRole = at ? pairRoleAt(at.lane, at.index) : null
      if (pairRole === 'second') {
        // ⚠️ The ONE place in this collector where a slot's work is consumed by another. Without it
        // the pair plays AND the second note plays again underneath it.
        continue
      }
      if (pairRole === 'first' && at) {
        collectPairAttacks(events, {
          first: chord,
          second: at.lane[at.index + 1] as Chord,
          startBeats,
          firstSoundingBeats: baseDurationBeats,
          chordLevels,
          tempoMap,
          shifts,
        })
        continue
      }

      /** A tied CONTINUATION of the same pitch — its head already carries the whole chain's length. */
      const isContinuation = (np: NotePitch): boolean => {
        if (!np.tiedFrom) return false
        const source = chordOf.get(np.tiedFrom)?.notes.find(n => n.id === np.tiedFrom)
        return !!source && sameMidi(source, np)
      }

      /** This pitch's sounding length: its slot's, extended across a same-pitch `tiedTo` chain
       *  (stopping at a different pitch or a dead link), plus the legato overlap. */
      const soundingBeatsOf = (np: NotePitch): number => {
        let beats = baseDurationBeats
        let cursor: NotePitch = np
        while (cursor.tiedTo) {
          const nextChord = chordOf.get(cursor.tiedTo)
          const nextNp = nextChord?.notes.find(n => n.id === cursor.tiedTo)
          if (!nextChord || !nextNp || !sameMidi(nextNp, cursor)) break
          beats += nextChord.actualDuration
            ? fracToNumber(nextChord.actualDuration)
            : durationToBeats(nextChord.duration, nextChord.dots || 0)
          cursor = nextNp
        }
        // Legato: bind to the next onset with a small, capped overlap.
        if (legatoChords.has(chord.id)) {
          beats += Math.min(LEGATO_OVERLAP_BEATS, baseDurationBeats * 0.5)
        }
        return beats
      }

      /**
       * ⭐ A FANNED BEAM branches on the SLOT, beside the two-note tremolo and for the same reason:
       * it is ONE gesture over the whole event, and its members have PITCHES OF THEIR OWN
       * (docs/fanned-beam-pitches-plan.md §2 P4). It sat inside the per-pitch loop while every member
       * shared the slot's pitches — where each chord tone emitted its own run of the whole ramp,
       * which was right then and wrong the moment they could differ.
       *
       * The tie machinery above is per pitch and only means anything for member 0: a member cannot
       * be tied (P3 refuses it), so members 1…count-1 are their own notes, sounding once each.
       */
      if (chord.fan) {
        collectFanAttacks(events, {
          chord,
          fan: chord.fan,
          startBeats,
          // The GROUP's span is one number — the event sounds until its longest-held pitch ends, so a
          // fan tied forward accelerates across the whole chain ("fill what sounds", the tremolo's
          // rule). Ties into and out of a fan are otherwise deferred.
          spanBeats: Math.max(baseDurationBeats, ...chord.notes.filter(np => !isContinuation(np)).map(soundingBeatsOf)),
          suppressed: new Set(chord.notes.filter(isContinuation).map(np => np.id)),
          // ⚠️ The dynamic WITHOUT the slot's articulation baked in: inside a fan the articulation is
          // per member, so folding the slot's into the velocity here would spend it on all six.
          baseVelocity,
          // ONE number for the whole group — a fan sounds inside one slot's position, so every
          // member is under the same octave line or none of them is.
          shift,
        })
        continue
      }

      for (const np of chord.notes) {
        // Skip a true (same-pitch) tied continuation — its head already carries the length.
        if (isContinuation(np)) continue

        const durationBeats = soundingBeatsOf(np)
        const pitch = applySoundingShift({ step: np.step, alter: np.alter, octave: np.octave }, shift)

        // A tremolo turns ONE sounding note into N re-attacks. It fills the note's whole SOUNDING
        // length — including any tie-extension above, because the head carries the chain's length and
        // the continuation is suppressed, so "fill what sounds" is what keeps a tremolo running across
        // the tie instead of stopping at the barline.
        const period = tremoloPeriodBeats(chord, baseDurationBeats, startBeats, tempoMap)
        if (period !== null) {
          // Rule 3: the Penderecki sign is the only mark whose speed VARIES, so its gaps and its
          // attacks wander. Every other tremolo — measured or unmeasured — stays strictly even.
          const irregular = chord.tremolo === 'penderecki'
          let t = 0
          while (t < durationBeats - PERIOD_EPSILON) {
            // A jittered STEP, so the wobble is in the spacing rather than nudging fixed onsets: the
            // gaps are what a listener hears as irregular, and stepping by them cannot drift out of
            // the note (the clamp below ends the fill exactly at its end).
            const step = irregular ? period * (1 + spread(rng) * PENDERECKI_ONSET_JITTER) : period
            events.push({
              pitch,
              startBeats: startBeats + t,
              // Each attack lasts one step — they are repeated notes, back to back — and still takes
              // the articulation's length factor, so a staccato tremolo is a staccato tremolo.
              durationBeats: Math.min(step, durationBeats - t) * artic.durationFactor,
              velocity: irregular
                ? clamp01(velocity * (1 + spread(rng) * PENDERECKI_VELOCITY_JITTER))
                : velocity,
            })
            t += step
          }
          continue
        }

        // ⭐⭐ A TRILL turns one sounding note into an alternation with the note above it.
        //
        // ⭐ **AFTER the tremolo branch, and that IS the precedence rule** (docs/trill-plan.md §7):
        // a note carrying a tremolo `continue`s above and never reaches here, and a FAN branches on
        // the slot even earlier. Two re-attack patterns over one span is not a sound, it is a mess —
        // and expressing that as reachability rather than as a condition means there is no third
        // rule to keep in step when a fourth pattern arrives.
        //
        // ⭐ It fills the SOUNDING length (`durationBeats`, already tie-extended, with the
        // continuation suppressed above) — so a trill on a note tied over the barline keeps going,
        // which is what makes the one-note trill need no end anchor.
        if (trilledSlots.has(chord.id)) {
          const aux = auxiliaryPitchFor(score, measure, chord, np, shift)
          if (aux !== null) {
            const period = physicalPeriodBeats(TRILL_PERIOD_SECONDS, startBeats, tempoMap)
            if (period !== null) {
              for (const attack of trillAttacks({
                mainPitch: pitch,
                auxPitch: aux,
                startBeats,
                durationBeats,
                periodBeats: period,
                durationFactor: artic.durationFactor,
              })) {
                events.push({ ...attack, velocity })
              }
              continue
            }
          }
        }

        events.push({
          pitch,
          startBeats,
          durationBeats: durationBeats * artic.durationFactor, // staccato shortens, tenuto holds
          velocity,
        })
      }
    }

    currentTimeInBeats += measureCapacityQuarters(measure)
  }

  stampStaffIds(events, staffMarks)
  // ⭐⭐ …and LAST, the damper. A post-pass over what was emitted, deliberately — see
  // {@link holdUnderPedals}.
  holdUnderPedals(events, score)

  return events
}

/** Fill in each event's staff from the contiguous run its slot opened. See `staffMarks`. */
function stampStaffIds(events: ScheduledNote[], marks: ReadonlyArray<{ from: number; staffId?: string }>): void {
  for (let i = 0; i < marks.length; i++) {
    const staffId = marks[i].staffId
    if (staffId === undefined) continue // absent IS the first staff — nothing to write
    const to = i + 1 < marks.length ? marks[i + 1].from : events.length
    for (let k = marks[i].from; k < to; k++) events[k].staffId = staffId
  }
}

/**
 * ⭐⭐ **THE SUSTAIN PEDAL, and it is the whole of P1** — every event attacked under a depressed
 * damper rings until the foot comes up (docs/pedal-plan.md §9).
 *
 * WebAudioFont has no CC64, so "damper up" means exactly one thing here: the note's RELEASE moves to
 * the lift. `Math.max`, because a pedal never shortens anything.
 *
 * ## ⚠️⚠️ Why it is a POST-PASS and not a longer slot
 *
 * The obvious implementation — extend the slot's sounding length before it is expanded — is wrong,
 * and silently. The repeat families GENERATE their subdivisions from that length: a trill fills
 * `durationBeats` with alternations, a tremolo with re-attacks, a fan with its ramp. Lengthen it
 * upstream and a pedalled trill grows extra alternations, i.e. the pedal changes the NOTES. Extend
 * the emitted events instead and each attack simply rings on, which is what a real damper does.
 * `playbackSchedule.pedal.test.ts` break-tests exactly that.
 *
 * ## ⭐ The pedal beats the articulation
 *
 * It runs after `artic.durationFactor` has already been applied at every push site, so a staccato
 * note under the pedal rings: the damper is up, and the key having been released early changes
 * nothing about a string whose damper is off it.
 *
 * ## ⭐ ONSET-membership, and overlap resolved as the foot resolves it
 *
 * An event belongs to the window its ONSET falls in, half-open — a note struck before the press is
 * not caught (its key is up by then), which is also why legato/tie tails reaching past a press are
 * not caught. And when two stored pedals overlap (the model permits it; only the entry door
 * truncates — docs/pedal-plan.md §3.3), the LATEST press at or before the onset wins and its lift is
 * the one that counts: re-pressing the pedal is the pianist lifting first.
 */
function holdUnderPedals(events: ScheduledNote[], score: Score): void {
  const windows = pedalWindows(score)
  if (windows.length === 0) return

  for (const ev of events) {
    let held: PedalWindow | null = null
    for (const w of windows) {
      if (ev.startBeats < w.from || ev.startBeats >= w.to) continue
      if (!pedalWindowCovers(w, ev.staffId, score)) continue
      // The latest press wins — later `from`, and on a tie the one that lifts last.
      if (!held || w.from > held.from || (w.from === held.from && w.to > held.to)) held = w
    }
    if (held) ev.durationBeats = Math.max(ev.durationBeats, held.to - ev.startBeats)
  }
}

/**
 * Every slot of `measure` keyed by id, with the LANE it belongs to and its place in it — one voice
 * of one staff, sorted by beat.
 *
 * Built once per bar because `measure.slots` is the flat, voice-interleaved, insertion-ordered array,
 * and `pairRoleAt` asks "what is the NEXT slot" — a question that is only meaningful inside a lane.
 * Asked of the flat array it would pair a voice-1 note with whichever voice-2 note happened to be
 * stored after it.
 */
function laneIndexOfMeasure(measure: Measure): Map<string, { lane: ChordRest[]; index: number }> {
  const index = new Map<string, { lane: ChordRest[]; index: number }>()
  const seen = new Set<string>()
  for (const slot of measure.slots) {
    const key = `${voiceOf(slot)}:${slot.staffId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const lane = laneOfSlot(measure.slots, slot)
    lane.forEach((s, i) => index.set(s.id, { lane, index: i }))
  }
  return index
}

/**
 * ⭐ The attacks of ONE FANNED group, appended to `events` — `count` notes that speed up or slow
 * down across exactly the slot's own length.
 *
 * Free accelerando *within* the duration: the group's total time is unchanged and nothing after it
 * moves. That is not an extra rule here — the offsets are proportions of the slot's sounding length,
 * so they cannot add up to anything else.
 *
 * ⭐ THE SAME `startFraction` THE DRAWING USES. The picture and the sound come out of one expander
 * (`fanMembers`), which is the whole reason it was written as a pure function — a head at 40% along
 * the group is a note at 40% of its time, by construction rather than by two implementations
 * agreeing. And now the same is true of the PITCHES: `fanMemberPitches` is the projection the
 * renderer draws from, including its fallback (a mark with no stored members sounds, as it draws, at
 * the slot's own pitch).
 *
 * Member 0 is the slot's own chord — minus any tied continuation, whose head already carries the
 * chain. Members 1…count-1 are their own notes, sounding once each at their own pitches.
 *
 * ⭐ **AND WITH THEIR OWN ARTICULATIONS.** They used to wear the slot's, because a mark belonged to
 * the whole gesture; it does not any more (`Attack`, docs/fanned-beam-pitches-plan.md §3), and the
 * engraving followed the member while this did not — so an accent on member 3 was drawn and not
 * heard, and a staccato on the owner was heard on all six and drawn on one. Picture and playback
 * have been one function in this feature since day one, and that is only true if the mark this reads
 * is the mark that was drawn.
 *
 * The DYNAMIC is still the slot's, and that is not an oversight: a dynamic attaches to a position in
 * the bar, and every member of a fan sounds inside one position. Only the articulation is per attack.
 *
 * Called BEFORE the tremolo, and that ordering is a decision rather than an accident: the two are
 * mutually exclusive in the model (`ScoreModel.setFan` clears the tremolo and vice versa), so a slot
 * carrying both is ill-formed — imported JSON is reported, never repaired — and something has to win
 * predictably. The fan does.
 */
function collectFanAttacks(
  events: ScheduledNote[],
  opts: {
    chord: Chord
    fan: FanMark
    startBeats: number
    /** The whole group's span in beats — the slot's sounding length (tie-extended). */
    spanBeats: number
    /** Pitch ids of the slot's own notes that are tied continuations, and so must not re-attack. */
    suppressed: Set<string>
    /** The slot's dynamic as a velocity, BEFORE any articulation — each member scales it by its own. */
    baseVelocity: number
    /** The slot's octave-line shift in semitones (see {@link soundingShiftBySlot}). A scalar, not a
     *  map, because a fan is ONE slot — contrast {@link collectPairAttacks}, which spans two. */
    shift: number
  },
): void {
  const { chord, fan, startBeats, spanBeats, suppressed, baseVelocity, shift } = opts
  const sounding = chord.notes.filter(np => !suppressed.has(np.id))
  const members = fanMembers(fan, slotLength(chord))
  const pitches = fanMemberPitches(sounding, fan)

  for (let k = 0; k < members.length; k++) {
    const from = members[k].startFraction
    const to = k + 1 < members.length ? members[k + 1].startFraction : 1
    // ⭐ THIS member's own marks. Member 0 reads the chord's, because member 0 IS the slot's chord —
    // the same rule the drawing follows, and the reason neither needs a special case for it.
    const artic = articulationEffect(k === 0 ? chord.articulations : fan.members?.[k - 1]?.articulations)
    const velocity = Math.min(1, baseVelocity * artic.velocityScale)
    for (const p of pitches[k] ?? sounding) {
      events.push({
        pitch: applySoundingShift({ step: p.step, alter: p.alter, octave: p.octave }, shift),
        startBeats: startBeats + from * spanBeats,
        // Each member lasts until the next one starts — they are a run of notes, back to back — and
        // takes its OWN articulation's length factor, so one staccato member is short and the rest
        // are not.
        durationBeats: (to - from) * spanBeats * artic.durationFactor,
        velocity,
      })
    }
  }
}

/**
 * The alternating attacks of ONE two-note tremolo, appended to `events`.
 *
 * Fills the two slots' **combined** length and hands attack *i* to the first chord's pitches when *i*
 * is even, the second's when odd — a whole pitch set at a time, so a pair of chords alternates as
 * chords. Each attack carries its OWN chord's dynamic and articulation, because the two notes are
 * two notes; only the rhythm is shared.
 *
 * ⭐ The period comes from the mark's own number as the TOTAL, over the DRAWN (doubled) value across
 * the combined span — not `flags + strokes` (docs/two-note-tremolo-plan.md §3). Two quarters marked
 * 3 draw as halves and sound as 32nds; two sixteenths marked 3 draw as beamed eighths (one beam, two
 * strokes) and sound as 32nds too. Same mark, same speed, however it is spelled — which is the whole
 * point of the beam counting.
 *
 * ⏭️ TIES into or out of a pair are deferred with the rest of the tremolo plan's list: the tie-chase
 * is per pitch and a pair is not. LEGATO likewise — a slur over a pair is not modelled.
 */
function collectPairAttacks(
  events: ScheduledNote[],
  opts: {
    first: Chord
    second: Chord
    startBeats: number
    /** The FIRST slot's own sounding length; the second's is read here (they are the same value). */
    firstSoundingBeats: number
    chordLevels: Map<string, DynamicLevel>
    tempoMap: TempoSegment[]
    /** Octave-line shift per slot, in semitones (see {@link soundingShiftBySlot}). The MAP, not a
     *  scalar, because a pair is TWO slots and an octave line may start between them — each side
     *  reads its own, exactly as each side already reads its own dynamic from `chordLevels`. */
    shifts: Map<string, number>
  },
): void {
  const { first, second, startBeats, firstSoundingBeats, chordLevels, tempoMap, shifts } = opts

  const secondSounding = second.actualDuration
    ? fracToNumber(second.actualDuration)
    : durationToBeats(second.duration, second.dots || 0)
  const combined = firstSoundingBeats + secondSounding

  const sides = [first, second].map(chord => {
    const artic = articulationEffect(chord.articulations)
    return {
      artic,
      velocity: Math.min(
        1,
        DYNAMIC_VELOCITY[chordLevels.get(chord.id) ?? DEFAULT_DYNAMIC] * artic.velocityScale,
      ),
      pitches: chord.notes.map(np => applySoundingShift(
        { step: np.step, alter: np.alter, octave: np.octave }, shifts.get(chord.id) ?? 0)),
    }
  })

  // `pairIsValid` refused the Penderecki sign, so the mark is a number and IS the total.
  const mark = typeof first.tremolo === 'number' ? first.tremolo : 0
  const drawn = doubleDuration(first.duration)
  const period = drawn === null || mark === 0
    ? null
    : tremoloPeriodFrom(
        mark,
        combined,
        durationToBeats(drawn, first.dots || 0),
        startBeats,
        tempoMap,
      )

  if (period === null) {
    // Nothing to subdivide by — sound the two notes plainly rather than fall silent. Unreachable for
    // a mark the palette can write; here so a malformed one is audible instead of missing.
    let t = startBeats
    for (const [i, side] of sides.entries()) {
      const length = i === 0 ? firstSoundingBeats : secondSounding
      for (const pitch of side.pitches) {
        events.push({ pitch, startBeats: t, durationBeats: length * side.artic.durationFactor, velocity: side.velocity })
      }
      t += length
    }
    return
  }

  let t = 0
  let turn = 0
  while (t < combined - PERIOD_EPSILON) {
    const side = sides[turn % 2]
    // Each attack lasts one step — they are repeated notes, back to back — clamped so the last one
    // ends exactly at the pair's end, and still scaled by its own chord's articulation.
    const length = Math.min(period, combined - t) * side.artic.durationFactor
    for (const pitch of side.pitches) {
      events.push({ pitch, startBeats: startBeats + t, durationBeats: length, velocity: side.velocity })
    }
    t += period
    turn++
  }
}

/** One roll as a signed spread in −1…+1, so a jitter constant reads as "± that fraction". */
function spread(rng: () => number): number {
  return rng() * 2 - 1
}

/** Velocity stays a normalized 0–1; jitter must not push a loud tremolo past full scale. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * Guard against a float-fencepost extra attack: filling 1 beat at a period of 0.25 must give 4
 * attacks, not 5 because `0.75 + 0.25 < 1` came out as `0.9999999999999999`.
 */
const PERIOD_EPSILON = 1e-9

/**
 * The repetition period of `chord`'s tremolo in BEATS, or null when it carries none (the ordinary
 * case: play the note once).
 *
 * ⚠️ **A PERIOD, NOT A COUNT** — and the period comes from the note as WRITTEN while the caller fills
 * the length that SOUNDS. That is not a refinement; it is what makes the arithmetic exact in the
 * three cases a count gets wrong (docs/tremolo-plan.md §5):
 *
 *  - **Tuplets.** A triplet eighth with one stroke is 2 attacks over 1/3 of a beat. Counting from the
 *    sounding duration gives 4/3 of an attack and forces an invented rounding rule.
 *  - **Dots.** A dotted quarter with one stroke is exactly 3 eighths, and falls out for free.
 *  - **Ties.** The head's mark fills the whole extended chain at its own period, and the continuation
 *    never re-attacks — which is why both halves of a tie-split keep the mark (§6).
 *
 * Which rule applies is decided by ONE number: `totalBeams = flags(written duration) + strokes`. This
 * is the standard reading, not an invention — one total beam = eighths, two = 16ths, three = 32nds,
 * which is why "three strokes on a quarter, two on an eighth, one on a sixteenth" all give 32nds.
 *
 *  - **Rule 1, measured** (`totalBeams < UNMEASURED_THRESHOLD`): the mark says how finely to
 *    subdivide, so the period is the written note divided into `2^totalBeams` parts — scaled into the
 *    sounding length, which is what carries the tuplet.
 *  - **Rule 2, unmeasured** (`>= UNMEASURED_THRESHOLD`): even, fast, and a subdivision of nothing. A
 *    fixed PHYSICAL period, converted here from seconds into beats through the tempo map so the
 *    struct keeps one time base. Converted at the note's own onset, so a tremolo late in a piece that
 *    has slowed down still repeats at the same real-world speed.
 *  - **Rule 3, Penderecki** — rule 2's period, and then the caller jitters both the spacing and the
 *    velocity around it ({@link PENDERECKI_ONSET_JITTER}). This function returns the same number for
 *    both, because the two rules differ in EVENNESS, not in speed: that is why rule 2 has to stay
 *    strictly even, and why only one of them needs a random number generator.
 */
function tremoloPeriodBeats(
  chord: Chord,
  /** The SLOT's own sounding length (tuplet-scaled, NOT tie-extended) — the numerator of the
   *  sounding/written ratio that carries a tuplet into the period. */
  slotSoundingBeats: number,
  startBeats: number,
  tempoMap: TempoSegment[],
): number | null {
  const mark = chord.tremolo
  if (!mark) return null

  // Penderecki has no stroke count, so it can never be measured — it IS the "as fast as possible"
  // reading, and takes rule 2's physical period. The jitter that separates them is the caller's.
  const totalBeams = mark === 'penderecki'
    ? UNMEASURED_THRESHOLD
    : durationFlags(chord.duration) + mark

  return tremoloPeriodFrom(
    totalBeams,
    slotSoundingBeats,
    durationToBeats(chord.duration, chord.dots || 0),
    startBeats,
    tempoMap,
  )
}

/**
 * Rules 1–3 themselves, over plain numbers — shared by the single-note mark above and the TWO-NOTE
 * pair below, which disagree about how `totalBeams` and the written value are ARRIVED AT but not
 * about what to do with them.
 *
 * Where they disagree (docs/two-note-tremolo-plan.md §2/§3): a single note adds its own flags to the
 * stroke count, because a flag sits on the outside of the stem and is not one of the lines that say
 * the speed. A pair's count IS the total — its beam is one of the lines between the two notes and
 * spends one of them — and its written value is the DRAWN (doubled) one over the pair's COMBINED
 * span. Both then land here.
 */
function tremoloPeriodFrom(
  totalBeams: number,
  soundingBeats: number,
  writtenBeats: number,
  startBeats: number,
  tempoMap: TempoSegment[],
): number | null {
  if (totalBeams >= UNMEASURED_THRESHOLD) {
    // Rule 2: a physical period, converted at THIS onset. ⭐ Shared with the trill, which is the only
    // other mark whose speed is a speed rather than a subdivision — the three lines this used to
    // hold are `physicalPeriodBeats`, and two copies would be two answers to "what is a second worth
    // here" the first time the conversion is corrected.
    return physicalPeriodBeats(UNMEASURED_PERIOD_SECONDS, startBeats, tempoMap)
  }

  // Rule 1: subdivide the WRITTEN note, then scale into what actually sounds (the tuplet ratio).
  if (writtenBeats <= 0) return null
  return soundingBeats / (writtenBeats * 2 ** totalBeams)
}

/**
 * ⭐ Every SLOT covered by a trill, resolved once for the whole collection.
 *
 * ⚠️ A slot is in here if ANY trill covers it, and nothing records WHICH — deliberately. Two trills
 * cannot meaningfully overlap on one slot (a note alternates with one neighbour, not two), so the
 * set is the whole of the question this collector asks.
 */
function trilledSlotIds(score: Score): Set<string> {
  const out = new Set<string>()
  for (const trill of score.trills ?? []) {
    const span = trillSpan(score, trill.id)
    if (!span) continue // a dangling trill sounds as nothing, exactly as it draws as nothing
    for (const id of span.slotIds) out.add(id)
  }
  return out
}

/**
 * ⭐ **THE NOTE A TRILLED PITCH ALTERNATES WITH** — the diatonic step above, resolved against the
 * key in force and the accidentals already used in this bar (`utils/trillPitch`).
 *
 * ⚠️ **Computed PER PITCH, not once per trill.** A trill covering four different notes trills each
 * of them with ITS OWN upper neighbour — the interval is a consequence of where the note sits in the
 * scale, never a property of the trill (docs/trill-plan.md §3). `trillOps.trillAuxiliaryOf` answers
 * for the trill's START note and is what the renderer and the Properties panel want; playback needs
 * this one.
 *
 * ⭐ **Every non-continuation pitch of a covered slot trills**, which on a CHORD means the whole
 * chord alternates. Engraving convention usually means the top note alone, and `Trill` does carry
 * the pitch it was anchored to — so narrowing this later is a FILTER here, not a model change.
 * Stated rather than assumed, because "trill the chord" is what the code does today.
 *
 * ⚠️⚠️ **`shift` is why this takes a parameter it could have ignored** (docs/ottava-plan.md §6 names
 * this exact site as the trap). The auxiliary is derived from the WRITTEN neighbour — the key and
 * the bar's accidentals are notation, and an octave line changes neither — so the shift is applied
 * *after* that derivation, here, at the last step. Leave it out and a trill under an 8va alternates
 * between a note an octave up and a note that is not: the ugliest possible failure, and one that
 * nothing in the suite would have thrown on.
 */
function auxiliaryPitchFor(
  score: Score, measure: Measure, chord: Chord, np: NotePitch, shift: number,
): PitchSpelling | null {
  const key = keyAt(score, measure.number, chord.staffId)
  const inBar = prevailingAlterations(measureAccidentalNotes(measure), chord.beat)
  const aux = trillAuxiliary({ step: np.step, octave: np.octave }, key, inBar)
  return applySoundingShift({ step: aux.step, alter: aux.alter, octave: aux.octave }, shift)
}

/**
 * Convert a PHYSICAL period (seconds) into beats at a given onset — the tempo there is what a second
 * is worth. Shared by the unmeasured tremolo and the trill, which are the two marks whose speed is a
 * speed rather than a subdivision.
 */
function physicalPeriodBeats(seconds: number, startBeats: number, tempoMap: TempoSegment[]): number | null {
  const onsetSeconds = beatsToSeconds(tempoMap, startBeats)
  const period = secondsToBeats(tempoMap, onsetSeconds + seconds) - startBeats
  return period > 0 ? period : null
}

/**
 * Do two note-pitches sound the same MIDI? (The tie-chase only follows true same-pitch ties.)
 *
 * ⛔ **THE ONE `spellingToMidi` HERE THAT TAKES NO OCTAVE SHIFT, and that is deliberate** — every
 * other one in this file does (docs/ottava-plan.md §6's table). This is a COMPARISON, and it is
 * shift-invariant in the case that matters: a tie joins two slots, and asking whether they are the
 * same note is a question about the NOTATION. Shifting both sides changes nothing; shifting only
 * the side that happens to fall under a bracket would break the tie chain at an 8va's edge — where
 * the notation says one held note and the ear would get a re-attack — for no gain.
 *
 * ⏭️⚠️ **AND IT IS THE LAST 12-EDO ASSUMPTION LEFT IN THIS FILE — recorded, deliberately not fixed**
 * (2026-08-20, with the pitch move). MIDI equality means G♯ tied to A♭ is ONE held pitch. That is
 * right in 12-TET and wrong in meantone, where they are different pitches
 * (docs/tuning-systems-and-alteration.md). ⭐ It survives the pitch move untouched because it is a
 * COMPARISON and never reaches an event: nothing it returns is scheduled, so it cannot mint the
 * integer this file no longer mints. When a tuning system lands, this is the second site it has to
 * be told about — ⛔ and it is a question about what a TIE means, not about how loud or how high
 * anything sounds, so do not "fix" it by comparing spellings: a tie between two DIFFERENT spellings
 * is exactly the case the tie-chase is meant to refuse today.
 */
function sameMidi(a: NotePitch, b: NotePitch): boolean {
  return spellingToMidi(a.step, a.alter, a.octave) === spellingToMidi(b.step, b.alter, b.octave)
}
