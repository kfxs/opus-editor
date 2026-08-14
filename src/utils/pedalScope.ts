/**
 * ⭐⭐ **WHAT A PEDAL REACHES** — the two questions a sustain pedal's `staffId` is NOT the answer to,
 * asked at a seam so the day the piano exists there is one file to change. See docs/pedal-plan.md
 * §3.2.
 *
 * A real damper pedal belongs to an INSTRUMENT, not to a staff: it sustains every staff of that
 * instrument, and it is drawn below the BOTTOM one. We have no instrument object — `Score.staffGroups`
 * (*"a piano = one group of two staff ids"*) is content but unrendered — so **the answer is not
 * knowable today and must not be baked in**. `soundingShiftAt`'s arrangement, and for its reason: a
 * rule that will change belongs at a seam, not spread across every site that needs it.
 *
 * ⭐⭐ **TWO functions, because the two questions diverge the day the answer changes.** Today both
 * say "the attached staff", which is exactly why they must be written apart now — fused into one
 * they would be indistinguishable, and later `pedalStavesAt` becomes *every staff of the group* while
 * `pedalDrawStaff` becomes *the last staff of the group*. One caller each: playback and the renderer.
 * ⛔ Neither of them may read `pedal.staffId` directly.
 *
 * Pure: no engine imports, no VexFlow, no instance state.
 */
import type { Score, Pedal } from '@/types/music'
import { measureCapacityQuarters } from './measureCapacity'
import { fracToNumber } from './fraction'

/**
 * ⭐ **WHICH STAVES THIS PEDAL SUSTAINS** — the staff ids playback must hold notes on
 * (docs/pedal-plan.md §9). Today: the one staff the pedal is attached to.
 *
 * ⚠️ **`undefined` is a staff id here, not a missing answer.** The first staff stores an ABSENT id
 * everywhere in this model (`utils/lanes` — "absent means the first one"), and a caller comparing
 * against a slot's `staffId` will meet the same absence, so normalising it away would break the very
 * comparison this list exists for.
 *
 * Tomorrow, when a `staffGroup` holding this staff is rendered as an instrument, this returns every
 * staff of that group — and nothing at the call site changes.
 */
export function pedalStavesAt(score: Score, pedal: Pedal): Array<string | undefined> {
  void score
  return [pedal.staffId]
}

/**
 * ⭐ **WHICH STAFF IT IS DRAWN UNDER** — §1 rule 1's other half (*all pedal lines go below the bottom
 * staff*). Today: the staff it is attached to, which on a two-staff score puts it BETWEEN the staves
 * until the piano exists. Stated as a limitation in docs/pedal-plan.md §1 rather than half-fixed
 * here, because guessing "the last staff of the score" would be wrong the moment a score holds two
 * instruments.
 */
export function pedalDrawStaff(score: Score, pedal: Pedal): string | undefined {
  void score
  return pedal.staffId
}

/**
 * ⭐⭐ **ONE PEDAL FLATTENED ONTO THE PLAYBACK CLOCK** — the damper down from `from` until `to`, in
 * ABSOLUTE quarter beats from the score's start, over the staves it sustains.
 *
 * ⚠️ **Half-open `[from, to)`**, for `soundingShift`'s reason: `Pedal.length` is *an amount of
 * music*, so a note attacking exactly where the pedal lifts is the first note NOT held — its own
 * damper is already down again.
 */
export interface PedalWindow {
  from: number
  to: number
  /** RESOLVED staff ids — an absent `staffId` is replaced by the first staff's, so a caller
   *  compares one normalised value against another ({@link pedalWindowCovers}). ⚠️ Still possibly
   *  `undefined`, for a degenerate score with no `staves` at all. */
  staves: Array<string | undefined>
}

/**
 * ⭐ **Every pedal in the score, on the playback clock** — built ONCE per collection, never per
 * event (`soundingShiftBySlot`'s arrangement and its reason: the collector walks bars accumulating a
 * clock, and turning a *count of music* into that clock means walking the capacities).
 *
 * ⚠️⚠️ **The walk is a FLOAT sum of `measureCapacityQuarters`, deliberately** — the same function in
 * the same order the collector itself accumulates `currentTimeInBeats` with. Summing exact fractions
 * and converting at the end is more accurate and therefore WRONG here: it can land an ulp away from
 * the onset it is meant to compare against, and a pedal pressed exactly on a downbeat would then
 * miss the note on it.
 *
 * Empty for any score with no pedal in it, which is the whole of the un-pedalled path.
 */
export function pedalWindows(score: Score): PedalWindow[] {
  const out: PedalWindow[] = []
  let base = 0
  for (const measure of [...score.measures].sort((a, b) => a.number - b.number)) {
    for (const pedal of measure.pedals ?? []) {
      const from = base + fracToNumber(pedal.beat)
      out.push({
        from,
        to: from + fracToNumber(pedal.length),
        staves: pedalStavesAt(score, pedal).map(id => id ?? score.staves?.[0]?.id),
      })
    }
    base += measureCapacityQuarters(measure)
  }
  return out
}

/**
 * Does this window hold notes on `staffId`? The query side of {@link PedalWindow.staves}'
 * normalisation, kept here so the resolution rule is stated once: an absent id on either side means
 * the first staff (`utils/lanes` — and `soundingShift.ottavaOnStaff`'s three lines, for its reason:
 * a `utils/` module may not reach into `engine/models/staffContent` for `matchesStaff`).
 */
export function pedalWindowCovers(window: PedalWindow, staffId: string | undefined, score: Score): boolean {
  const wanted = staffId ?? score.staves?.[0]?.id
  return window.staves.some(id => id === wanted)
}
