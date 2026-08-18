/**
 * DYNAMICS — **moving a mark through the music**, as a SCORE operation. Free functions on a
 * `Score`, in the `hairpinOps` / `pedalOps` / `ottavaOps` idiom, with {@link ScoreModel} keeping a
 * thin delegator (DESIGN-PRINCIPLES principle 5 — the score is independent of the editor, so none
 * of this may live on `MusicEngine`).
 *
 * ⚠️ The dynamics that already existed — add / update / remove / look up — stay on `ScoreModel`;
 * this module is the STEP, the one piece of dynamics logic that has to know what a lane is.
 *
 * ## ⭐⭐ A dynamic is a POINT, so its walk is an ORDER — not a timeline
 *
 * Its three sibling families store a start plus an AMOUNT, so every one of them has to lay the
 * score out on one absolute quarter-beat axis before it can step an end (each keeps its own
 * `measureStartOffsets` for exactly that). A `Dynamic` has no extent: nothing is being held still
 * at the other side, nothing has to stay positive. All the step needs is *which slot comes next*,
 * and that is already the score's own reading order — measure number, then beat. ⛔ So there is no
 * fourth copy of the capacity arithmetic here, and adding one would be inventing a question this
 * family does not ask.
 *
 * ## ⭐ The lane is the VOICE, on the mark's staff — the hairpin's rule, not the pedal's
 *
 * A dynamic governs a voice/stream ({@link Dynamic.voice}), the way the wedge it shares the
 * dynamics line with does; a pedal walks its whole staff because there is one damper. Stepping
 * through slots of a voice the mark does not govern would land it on music it does not speak for.
 *
 * ⚠️ Rests are lane stops like any other slot: `p` at the top of a bar that begins with a rest is
 * ordinary, so there is nothing to filter out.
 */
import type { Score, Dynamic, Measure, Fraction } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride } from './overrideOps'

/** An address in the score's reading order — a lane stop, or where the mark is now. */
interface Stop {
  measure: number
  beat: Fraction
}

/** Reading order: measure number first, then beat within the bar. Negative when `a` is earlier. */
function compare(a: Stop, b: Stop): number {
  return a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat)
}

/** The measure a dynamic is stored in, with the live mark itself; null if no such dynamic. */
function locate(score: Score, id: string): { dynamic: Dynamic; measure: Measure } | null {
  for (const measure of score.measures) {
    const dynamic = measure.dynamics?.find(d => d.id === id)
    if (dynamic) return { dynamic, measure }
  }
  return null
}

/** Every slot of the mark's own lane (its voice on its staff), in reading order. */
function laneStops(score: Score, dynamic: Dynamic): Stop[] {
  const stops: Stop[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if ((slot.voice ?? 0) !== (dynamic.voice ?? 0)) continue
      if (!matchesStaff(slot.staffId, dynamic.staffId, score)) continue
      stops.push({ measure: measure.number, beat: slot.beat })
    }
  }
  return stops.sort(compare)
}

/** Re-file a dynamic under a different measure, keeping the SAME object (and so the same id, which
 *  is what the selection holds — a re-created mark would deselect itself mid-gesture). `hairpinOps`'
 *  twin, including the ⭐ `delete` of an emptied array: an absent `dynamics` and an empty one must
 *  not both be reachable, or the JSON round trip has two spellings of "none".
 *  @returns false if the target measure does not exist. */
function moveDynamicToMeasure(score: Score, dynamic: Dynamic, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.dynamics?.findIndex(d => d.id === dynamic.id) ?? -1
    if (idx === -1) continue
    measure.dynamics!.splice(idx, 1)
    if (measure.dynamics!.length === 0) delete measure.dynamics
    break
  }
  if (!target.dynamics) target.dynamics = []
  target.dynamics.push(dynamic)
  return true
}

/**
 * ⭐⭐ **RE-ANCHOR A DYNAMIC — move it to the previous (−1) or next (+1) slot of its own lane**, the
 * model write behind `Ctrl+Shift+←/→` with a dynamic selected (his ask, 2026-08-18).
 *
 * ⭐ **The chord says MUSIC, and this is the musical half a dynamic did not have.** Plain arrows and
 * `Ctrl`+arrows already nudge the mark's INK (`overrideOps.nudgeDynamicOffset`); every other family
 * on the dynamics line reads the harder chord as *move this through the music*, and a dynamic's
 * "where in the music" is the beat it applies from — which playback reads, so this is audible where
 * the nudge beside it is not.
 *
 * ⭐ **A mark stepped across a barline MOVES to the bar it now sits in** — the list it is stored in
 * *is* "the dynamics that happen here" — keeping the same object and the same id, so the selection
 * the user is pressing arrows on survives the step ({@link moveDynamicToMeasure}).
 *
 * ⭐⭐ **And the step CLEARS the mark's own nudge** (his call, 2026-08-18) — `setSlurEndpoint`'s
 * rule, arriving here for its reason verbatim: anchor-relative storage makes an offset
 * *transferable*, not *wanted*. It was tuned to clear the stem, the ledgers and whatever else stood
 * around the note it used to sit under, and a re-anchor is the user saying "not that note", so
 * carrying it along re-applies an answer to a question nobody asked again.
 *
 * ⚠️ Declines (false) — touching nothing — when there is no such dynamic, or when the walk runs off
 * the end of the lane. Declining is what leaves `Ctrl+Shift+←/→` free for the note offset, so the
 * caller must chain rather than repaint on a false.
 */
export function moveDynamicBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const found = locate(score, id)
  if (!found) return false
  const { dynamic, measure } = found

  const here: Stop = { measure: measure.number, beat: dynamic.beat }
  const stops = laneStops(score, dynamic)
  const dest = direction === -1
    // Reach BACK: the last stop before the mark.
    ? [...stops].reverse().find(s => compare(s, here) < 0)
    // Step ON: the first stop after it.
    : stops.find(s => compare(s, here) > 0)
  if (!dest) return false

  if (dest.measure !== measure.number && !moveDynamicToMeasure(score, dynamic, dest.measure)) return false
  dynamic.beat = dest.beat
  locate(score, id)?.measure.dynamics?.sort((a, b) => fracCompare(a.beat, b.beat))
  clearEngravingOverride(score, id, 'dynamicOffset')
  return true
}
