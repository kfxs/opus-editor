/**
 * ⭐⭐ **THE PLAY ORDER** — what a repeat means to PLAYBACK, as against what it draws. §7 of
 * docs/barline-types-plan.md, and the feature that model deliberately waited for.
 *
 * 🚨 **HIS ASK, 2026-08-26:** *"what about the playback? …by default playback should repeat, and I
 * guess we can have a checkmark on the dev shell near dev sound to not repeat if the user wants."*
 *
 * ⛔ **Until now `playbackSchedule` walked `score.measures` straight through**, and `barlineOps`'
 * header said it must keep doing so *"until a repeat play order exists as its own feature"*. This is
 * that feature, and the boundary it drew still holds: **nothing here writes to the score, and nothing
 * in the score model knows this exists.** Drawing `:|` and playing bars twice remain two questions.
 *
 * ## ⭐⭐ THE PERFORMANCE IS A LIST OF LEGS, not a re-ordered score
 *
 * A repeat cannot be expressed as "the notes, in a different order": the same bar sounds more than
 * once, so bar↔time stops being one-to-one and every consumer of that mapping breaks (the schedule,
 * the auto-stop, the progress bar, the playhead). ⭐ So the performance is modelled as a list of
 * **legs** — each a contiguous run of bars, with WHERE IN SCORE BEATS it comes from and WHEN IN THE
 * PERFORMANCE it happens. A score with no repeats is exactly one leg, and every arithmetic downstream
 * collapses to what it was.
 *
 * ⚠️ **Two clocks, and keeping them apart is the whole of the care here.** `fromBeats`/`toBeats` are
 * SCORE beats — where the music is written, what the tempo map is keyed by, what a note's onset is
 * measured in. `atSeconds`/`seconds` are PERFORMANCE seconds — when you hear it. ⛔ A leg's duration
 * is the DIFFERENCE of two `beatsToSeconds` lookups, never its beat-length times one rate: a repeated
 * passage may straddle a tempo change (`playbackSchedule.playableFrom` states the same rule).
 *
 * ## ⛔ WHAT THIS DOES NOT DO
 *
 * **Voltas (1st/2nd-time endings), D.C./D.S., codas and jumps** — none of them exist in the model
 * (plan §8's ⏭️ list; every format holds a volta as a *container of measures*, never a barline
 * attribute). When they arrive they are inputs to THIS walk, which is why it is a module and not a
 * loop inside `PlaybackEngine` — MuseScore's `RepeatList` is the same shape and, notably, never reads
 * a barline at all.
 *
 * **Nested repeats are played, not resolved.** An inner repeat's counter is reset once it has been
 * taken in full, so an enclosing repeat replays it — which is what a player does. ⛔ Two repeats that
 * *interleave* (an open inside another's span, closing after it) have no agreed reading in any engine
 * and get whatever this walk gives them; {@link MAX_LEGS} is what stops a pathological score from
 * hanging the tab rather than a claim to have understood it.
 */
import type { Measure, Score } from '@/types/music'
import { measureStartQuarters, measureCapacityQuarters } from '@/utils/measureCapacity'
import { beatsToSeconds, secondsToBeats, type TempoSegment } from '@/utils/tempoMap'
import { dbg } from '@/utils/debug'

/**
 * A contiguous run of bars, played once. ⭐ The unit of the performance — see the header for why the
 * two clocks are both here and must not be confused.
 */
export interface PlayLeg {
  /** First bar of the run, 1-based and inclusive. */
  fromMeasure: number
  /** Last bar of the run, inclusive. */
  toMeasure: number
  /** Where this run starts in SCORE beats — what a note's onset is measured against. */
  fromBeats: number
  /** Where it ends in score beats (exclusive: the next bar's start, or the end of the score). */
  toBeats: number
  /** When this run begins in PERFORMANCE seconds, measured from the top of the play order. */
  atSeconds: number
  /** How long it lasts, in seconds — the difference of two tempo-map lookups. */
  seconds: number
}

/**
 * The runaway guard. A score cannot legitimately need this many legs — 4 bars of repeats is 2 —
 * so reaching it means the walk found a cycle it cannot resolve, and stopping with what it has beats
 * hanging the tab. ⚠️ It LOGS: a silent truncation would read as "this is the piece".
 */
const MAX_LEGS = 4096

/**
 * ⭐ **THE WALK** — bar runs in playing order, ⛔ with no clock in it at all.
 *
 * Kept separate from {@link buildPlayPlan} because this half is the *musical* question (which bars,
 * in what order) and needs no tempo map, which makes it testable on a bare score. The other half is
 * arithmetic.
 *
 * The reading of each field, and each is the standard one:
 *  - **`repeatStart` marks where a jump goes back TO.** Absent everywhere before an `:|`, the jump
 *    goes to bar 1 — Gould, and every engine: an end repeat with no open repeat repeats the piece.
 *  - **`repeatEnd.times` is the number of PLAYINGS in total**, absent = 2 (`barlineOps` refuses
 *    anything below 2, so this may trust it).
 *
 * ⚠️ A repeat's counter is CLEARED once it has been taken in full, so an enclosing repeat replays it.
 */
export function measureOrder(score: Score): Array<{ fromMeasure: number; toMeasure: number }> {
  const measures = score.measures ?? []
  const last = measures.length
  if (last === 0) return []
  const byNumber = new Map<number, Measure>(measures.map(m => [m.number, m]))

  const legs: Array<{ fromMeasure: number; toMeasure: number }> = []
  /** How many times each end repeat has been taken on the pass we are in. */
  const taken = new Map<number, number>()
  /** The bar the next jump goes back to — bar 1 until an open repeat says otherwise. */
  let jumpTo = 1
  let legStart = 1
  let i = 1

  while (i <= last) {
    if (legs.length >= MAX_LEGS) {
      dbg(`[Repeats] play order hit the ${MAX_LEGS}-leg guard at bar ${i} — stopping. `
        + 'Two repeats probably interleave; the rest of the score is not in this performance.')
      break
    }
    const measure = byNumber.get(i)
    if (measure?.repeatStart !== undefined) jumpTo = i

    if (measure?.repeatEnd !== undefined) {
      const total = measure.repeatEnd.times ?? 2
      const done = (taken.get(i) ?? 0) + 1
      if (done < total) {
        taken.set(i, done)
        legs.push({ fromMeasure: legStart, toMeasure: i })
        // ⛔ `legStart = jumpTo`, never `i + 1`: the next leg IS the repeated passage.
        i = jumpTo
        legStart = jumpTo
        continue
      }
      // Taken in full. ⭐ Forget it, so an enclosing repeat that comes back through plays it again —
      // which is what a player does, and what makes nesting work without a stack.
      taken.delete(i)
    }
    i++
  }

  legs.push({ fromMeasure: legStart, toMeasure: last })
  return legs
}

/**
 * ⭐ **The performance**, legs with both clocks filled in. `repeats: false` collapses it to the one
 * leg the score used to be — his checkbox, and the reason it is a parameter rather than a caller-side
 * `if`: "no repeats" is a legitimate performance of the same score, not an absence of a plan.
 *
 * ⚠️ `toBeats` is the END of `toMeasure`, i.e. the next bar's start — so a leg covers its last bar
 * rather than stopping at its downbeat.
 */
export function buildPlayPlan(score: Score, tempoMap: TempoSegment[], repeats = true): PlayLeg[] {
  const measures = score.measures ?? []
  if (measures.length === 0) return []

  const runs = repeats
    ? measureOrder(score)
    : [{ fromMeasure: 1, toMeasure: measures.length }]

  const endBeatsOf = (measureNumber: number): number => {
    const measure = measures.find(m => m.number === measureNumber)
    return measureStartQuarters(measures, measureNumber)
      + (measure ? measureCapacityQuarters(measure) : 0)
  }

  const plan: PlayLeg[] = []
  let atSeconds = 0
  for (const run of runs) {
    const fromBeats = measureStartQuarters(measures, run.fromMeasure)
    const toBeats = endBeatsOf(run.toMeasure)
    // ⛔ The DIFFERENCE of two lookups, never a beat-length times one rate — a repeated passage may
    // straddle a tempo change (`playbackSchedule.playableFrom`'s rule, and the same trap).
    const seconds = beatsToSeconds(tempoMap, toBeats) - beatsToSeconds(tempoMap, fromBeats)
    plan.push({ ...run, fromBeats, toBeats, atSeconds, seconds })
    atSeconds += seconds
  }
  return plan
}

/** How long the whole performance lasts, in seconds. */
export function planDuration(plan: PlayLeg[]): number {
  const last = plan[plan.length - 1]
  return last === undefined ? 0 : last.atSeconds + last.seconds
}

/** Whether this plan repeats anything — one leg means it does not. Used only for the log. */
export function planRepeats(plan: PlayLeg[]): boolean {
  return plan.length > 1
}

/**
 * ⭐ **WHERE IN THE PERFORMANCE A BAR FIRST SOUNDS**, in seconds — what `seekToMeasure` means once a
 * bar can sound more than once.
 *
 * ⚠️ **FIRST, deliberately.** "Play from bar 12" in a repeated passage is ambiguous — Sibelius, Dorico
 * and MuseScore all answer with the first time it comes round, and so does this: it is the reading
 * the user can predict, and the second pass follows from it anyway.
 *
 * Returns 0 when no leg contains the bar (a plan built from a different score), which plays from the
 * top rather than refusing — the same fallback `playbackStart` takes.
 */
export function planSecondsAtMeasure(plan: PlayLeg[], tempoMap: TempoSegment[], measureStartBeats: number): number {
  for (const leg of plan) {
    if (measureStartBeats < leg.fromBeats || measureStartBeats >= leg.toBeats) continue
    return leg.atSeconds + (beatsToSeconds(tempoMap, measureStartBeats) - beatsToSeconds(tempoMap, leg.fromBeats))
  }
  return 0
}

/**
 * ⭐ **THE INVERSE** — performance seconds back to SCORE beats, for the playhead.
 *
 * `updatePosition` walks the bars from an elapsed beat count to light the current one. That walk is
 * unchanged; this is the step in front of it that was implicit while the performance was the score.
 *
 * Past the end, answers the last leg's end — the auto-stop is what ends a play, and a playhead that
 * ran off the score would light nothing on the last frame before it fires.
 */
export function planScoreBeatsAt(plan: PlayLeg[], tempoMap: TempoSegment[], elapsedSeconds: number): number {
  if (plan.length === 0) return 0
  for (const leg of plan) {
    if (elapsedSeconds >= leg.atSeconds + leg.seconds) continue
    const intoLeg = Math.max(0, elapsedSeconds - leg.atSeconds)
    return secondsToBeats(tempoMap, beatsToSeconds(tempoMap, leg.fromBeats) + intoLeg)
  }
  return plan[plan.length - 1].toBeats
}
