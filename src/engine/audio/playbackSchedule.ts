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
import type { Score, Chord, NotePitch } from '@/types/music'
import { durationToBeats, measureCapacityQuarters } from '@/utils/musicUtils'
import { durationFlags } from '@/utils/durations'
import { fracToNumber } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { DYNAMIC_VELOCITY, DEFAULT_DYNAMIC, resolveChordLevels } from '@/utils/dynamics'
import { legatoChordIds } from '@/utils/slurs'
import { articulationEffect } from '@/utils/articulations'
import { buildTempoMap, beatsToSeconds, secondsToBeats, type TempoSegment } from '@/utils/tempoMap'

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

      for (const np of chord.notes) {
        // Skip a true (same-pitch) tied continuation — its head already carries the length.
        if (np.tiedFrom) {
          const source = chordOf.get(np.tiedFrom)?.notes.find(n => n.id === np.tiedFrom)
          if (source && sameMidi(source, np)) continue
        }

        // Extend across a same-pitch tiedTo chain; stop at a different pitch or a dead link.
        let durationBeats = baseDurationBeats
        let cursor: NotePitch = np
        while (cursor.tiedTo) {
          const nextChord = chordOf.get(cursor.tiedTo)
          const nextNp = nextChord?.notes.find(n => n.id === cursor.tiedTo)
          if (!nextChord || !nextNp || !sameMidi(nextNp, cursor)) break
          durationBeats += nextChord.actualDuration
            ? fracToNumber(nextChord.actualDuration)
            : durationToBeats(nextChord.duration, nextChord.dots || 0)
          cursor = nextNp
        }

        // Legato: bind to the next onset with a small, capped overlap.
        if (legatoChords.has(chord.id)) {
          durationBeats += Math.min(LEGATO_OVERLAP_BEATS, baseDurationBeats * 0.5)
        }

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

  if (totalBeams >= UNMEASURED_THRESHOLD) {
    // Rule 2: a physical period. Convert seconds → beats AT THIS ONSET (the tempo there is what a
    // second is worth), by asking the map where one period later lands.
    const onsetSeconds = beatsToSeconds(tempoMap, startBeats)
    const beatsAtPeriodEnd = secondsToBeats(tempoMap, onsetSeconds + UNMEASURED_PERIOD_SECONDS)
    const period = beatsAtPeriodEnd - startBeats
    return period > 0 ? period : null
  }

  // Rule 1: subdivide the WRITTEN note, then scale into what actually sounds (the tuplet ratio).
  const written = durationToBeats(chord.duration, chord.dots || 0)
  if (written <= 0) return null
  return slotSoundingBeats / (written * 2 ** totalBeams)
}

/** Do two note-pitches sound the same MIDI? (The tie-chase only follows true same-pitch ties.) */
function sameMidi(a: NotePitch, b: NotePitch): boolean {
  return spellingToMidi(a.step, a.alter, a.octave) === spellingToMidi(b.step, b.alter, b.octave)
}
