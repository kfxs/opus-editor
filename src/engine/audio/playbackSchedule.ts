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
 * multi-staff plan (§8) calls for; the flat model gets it for free. Per-staff *dynamics*
 * loudness stays a deferred refinement — {@link resolveChordLevels} is voice-scoped, not
 * staff-scoped, so a staff-2 chord currently inherits its voice's dynamic (never silence).
 */
import type { Score, Chord, ChordRest, DynamicLevel, FanMark, Measure, NotePitch } from '@/types/music'
import { durationToBeats, measureCapacityQuarters } from '@/utils/musicUtils'
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

/** A single sounding note to schedule, in tempo-independent beat units. */
export interface ScheduledNote {
  /** Sounding MIDI pitch (derived from the stored spelling). */
  midi: number
  /** Absolute onset from score start, in quarter-note beats (the shared clock). */
  startBeats: number
  /** Sounding length in beats, after tie-extension, legato overlap and articulation. */
  durationBeats: number
  /** Normalized velocity 0–1 (dynamic level × articulation scale). */
  velocity: number
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

  const events: ScheduledNote[] = []
  let currentTimeInBeats = 0
  for (const measure of score.measures) {
    const measureStartBeats = currentTimeInBeats

    // Where each slot sits in its own LANE (one voice of one staff, in beat order) — the only view
    // in which "the next note" means anything, and what the two-note tremolo is defined over.
    const lanes = laneIndexOfMeasure(measure)

    for (const slot of measure.slots) {
      if (slot.type === 'rest') continue
      const chord = slot

      // Articulation bends attack (velocity) and length (duration) on top of the dynamic.
      const artic = articulationEffect(chord.articulations)
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
          velocity,
          durationFactor: artic.durationFactor,
        })
        continue
      }

      for (const np of chord.notes) {
        // Skip a true (same-pitch) tied continuation — its head already carries the length.
        if (isContinuation(np)) continue

        const durationBeats = soundingBeatsOf(np)
        const midi = spellingToMidi(np.step, np.alter, np.octave)

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
              midi,
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

        events.push({
          midi,
          startBeats,
          durationBeats: durationBeats * artic.durationFactor, // staccato shortens, tenuto holds
          velocity,
        })
      }
    }

    currentTimeInBeats += measureCapacityQuarters(measure)
  }

  return events
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
 * chain. Members 1…count-1 are their own notes: they cannot be tied, slurred or articulated
 * individually (P3 refuses all three), so they sound once each, at their own pitches, wearing the
 * SLOT's dynamic and articulation because those belong to the whole gesture.
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
    velocity: number
    durationFactor: number
  },
): void {
  const { chord, fan, startBeats, spanBeats, suppressed, velocity, durationFactor } = opts
  const sounding = chord.notes.filter(np => !suppressed.has(np.id))
  const members = fanMembers(fan, slotLength(chord))
  const pitches = fanMemberPitches(sounding, fan)

  for (let k = 0; k < members.length; k++) {
    const from = members[k].startFraction
    const to = k + 1 < members.length ? members[k + 1].startFraction : 1
    for (const p of pitches[k] ?? sounding) {
      events.push({
        midi: spellingToMidi(p.step, p.alter, p.octave),
        startBeats: startBeats + from * spanBeats,
        // Each member lasts until the next one starts — they are a run of notes, back to back — and
        // still takes the articulation's length factor, so a staccato fan is staccato.
        durationBeats: (to - from) * spanBeats * durationFactor,
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
  },
): void {
  const { first, second, startBeats, firstSoundingBeats, chordLevels, tempoMap } = opts

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
      midis: chord.notes.map(np => spellingToMidi(np.step, np.alter, np.octave)),
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
      for (const midi of side.midis) {
        events.push({ midi, startBeats: t, durationBeats: length * side.artic.durationFactor, velocity: side.velocity })
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
    for (const midi of side.midis) {
      events.push({ midi, startBeats: startBeats + t, durationBeats: length, velocity: side.velocity })
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
    // Rule 2: a physical period. Convert seconds → beats AT THIS ONSET (the tempo there is what a
    // second is worth), by asking the map where one period later lands.
    const onsetSeconds = beatsToSeconds(tempoMap, startBeats)
    const beatsAtPeriodEnd = secondsToBeats(tempoMap, onsetSeconds + UNMEASURED_PERIOD_SECONDS)
    const period = beatsAtPeriodEnd - startBeats
    return period > 0 ? period : null
  }

  // Rule 1: subdivide the WRITTEN note, then scale into what actually sounds (the tuplet ratio).
  if (writtenBeats <= 0) return null
  return soundingBeats / (writtenBeats * 2 ** totalBeams)
}

/** Do two note-pitches sound the same MIDI? (The tie-chase only follows true same-pitch ties.) */
function sameMidi(a: NotePitch, b: NotePitch): boolean {
  return spellingToMidi(a.step, a.alter, a.octave) === spellingToMidi(b.step, b.alter, b.octave)
}
