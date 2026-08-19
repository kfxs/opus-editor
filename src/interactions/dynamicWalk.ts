/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A DYNAMIC** — ←/→ and Ctrl+←/→ move a selected dynamic's INK,
 * and once that ink reaches the next note of its lane the ANCHOR goes with it. His ask, 2026-08-19:
 * *"we recently use in the slur a walk with arrow / ctrl arrow that allows interpolate between
 * offset and reanchor… i want to do something similar with the expression (dynamic)"*.
 *
 * `./slurEndpointWalk` sentence for sentence — the identity, the invisible crossing, the
 * no-guessing rule and the system-break refusal are all that module's, arriving here because they
 * are claims about *moving a mark that hangs off a note*, not about slurs. What differs is only
 * what an anchor IS:
 *
 * ⭐⭐ **a dynamic is anchored POSITIONALLY** (`{measure, beat, voice, staffId}`), so the stop it
 * walks onto is a SLOT of its own lane (`engine/models/dynamicOps.nextDynamicSlot`) — the pedal's
 * walk, ⛔ not the slur's note re-point. That is already the rule `Ctrl+Shift+←/→` follows, and both
 * roads read the one candidate function so they can never land the mark on different notes.
 *
 * ## The identity
 *
 * A drawn mark is `base(anchor) + offset`. A press moves the drawn mark by one step, and the model
 * is free to split that between the two terms however it likes:
 *
 * ```
 *   offset + step  <  gap   →  keep the anchor, offset += step        (ordinary ink nudge)
 *   offset + step  ≥  gap   →  anchor := next slot, offset += step − gap
 * ```
 *
 * where `gap` is the horizontal distance between the two slots' drawn noteheads. Both branches move
 * the drawn mark by exactly one step, so **the crossing is invisible** — which is the point, and why
 * it needs a model write of its own (`setDynamicAtSlotKeepingOffset`): the ordinary re-anchor CLEARS
 * the mark's nudge, which is right for *"not that note"* and wrong for a ¼-space press that happens
 * to step over a notehead.
 *
 * ⭐ **ARRIVAL, not midpoint** — his call on the slur, and the same reading here: the mark can be
 * parked anywhere in the gap without changing the beat it applies from, which playback reads.
 *
 * ⚠️ **`gap` is a NOTEHEAD-to-NOTEHEAD distance.** A dynamic is drawn centred on its notehead
 * (`rendering/dynamicMarkAnchor.ts`), so the two agree exactly — where the slur has to tolerate an
 * endpoint that attaches to a head or a stem tip depending on the stems, this one does not.
 *
 * 🚨 **It will not walk across a system break.** Two x's from different systems are not on one
 * ruler, so a `gap` whose sign disagrees with the direction of travel is refused and the press stays
 * a plain nudge. `Ctrl+Shift+←/→` is the gesture that crosses a break.
 *
 * ⛔ **The vertical is not in here at all.** ↑/↓ stay a pure offset: a dynamic's lane runs sideways,
 * so there is no anchor above or below to arrive at.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { DynamicSlotTarget } from '../engine/models/dynamicOps'
import { dynamicAddress, dynamicLaneHeads } from './elements/dynamicDrag'
import { dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCompare } from '../utils/fraction'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type DynamicWalkEngine = Pick<MusicEngine,
  'getDynamicById' | 'getScore' | 'getElementRegistry' | 'getNote'
  | 'nextDynamicSlot' | 'moveDynamicToSlotKeepingOffset' | 'nudgeDynamicOffset' | 'runBatch'>

/**
 * The staff-space size to convert the measured gap with, read off the DRAWN mark.
 *
 * ⛔ No fallback constant, `./slurEndpointWalk`'s rule and for its reason: the offset is stored in
 * staff-spaces, so a guessed scale would write a re-base of the wrong size — quietly, and only on a
 * staff that is not the default size. With no drawn mark there is no crossing, and the press stays
 * the plain nudge it has always been.
 */
function staffSpacePxOf(engine: DynamicWalkEngine, id: string): number | null {
  return engine.getElementRegistry().getByType('dynamic').find(el => el.id === id)?.staffSpacePx ?? null
}

/** This mark's stored horizontal offset, in staff-spaces. 0 = the ink is where the engraver put it. */
function offsetXOf(engine: DynamicWalkEngine, id: string): number {
  return dynamicOffsetOverrideOf(engine.getScore(), id)?.x ?? 0
}

/**
 * The lane stop one step away in the direction of travel, and how far away it is DRAWN in
 * staff-spaces — or null when there is nothing to walk onto (the end of the lane, no drawn
 * geometry, or a system break).
 */
function neighbourGap(
  engine: DynamicWalkEngine,
  id: string,
  direction: 1 | -1,
): { target: DynamicSlotTarget; gap: number } | null {
  const dynamic = engine.getDynamicById(id)
  if (!dynamic) return null
  // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
  // would mean the same key landing on a different slot depending on how far you had nudged.
  const target = engine.nextDynamicSlot(id, direction)
  if (!target) return null

  const ss = staffSpacePxOf(engine, id)
  if (!ss) return null

  const heads = dynamicLaneHeads(engine, dynamic)
  const at = (a: DynamicSlotTarget) =>
    heads.find(h => h.target.measure === a.measure && fracCompare(h.target.beat, a.beat) === 0)?.x ?? null
  const here = dynamicAddress(engine.getScore(), id)
  const fromX = here ? at(here) : null
  const toX = at(target)
  if (fromX === null || toX === null) return null

  const gap = (toX - fromX) / ss
  // 🚨 The next slot in TIME is not always the next one in X: across a system break it is far to the
  // LEFT while the travel is rightward. Subtracting those two x's is meaningless, so refuse.
  if (Math.sign(gap) !== direction) return null
  return { target, gap }
}

/** The step this press takes, when it takes the anchor with it. Null = the ink has not arrived (or
 *  there is nowhere to arrive), so the move is an ordinary nudge. */
function arrivedAt(
  engine: DynamicWalkEngine,
  id: string,
  dx: number,
): { target: DynamicSlotTarget; gap: number } | null {
  const next = neighbourGap(engine, id, dx > 0 ? 1 : -1)
  if (!next) return null
  const target = offsetXOf(engine, id) + dx
  const arrived = dx > 0 ? target >= next.gap : target <= next.gap
  return arrived ? next : null
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON A SELECTED DYNAMIC** — nudge the ink by `dx` staff-spaces
 * (¼ space plain, 1 space with Ctrl), and hand the anchor along if the ink has arrived at the next
 * slot of the mark's lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the mark somewhere the user never put it.
 *
 * ⚠️ **A LOOP is not needed here** the way the slur's drag needs one — a key press moves a quarter-
 * or whole space and can cross at most one slot. The guard is a single `if`; when the mouse gets
 * this gesture it will need the loop, and this is the function it should grow it in.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written —
 *   no such mark, or the page limit refused the ink. ⚠️ The caller decides what a false means for
 *   the KEY; today it falls through, exactly as the plain nudge this replaces did.
 */
export function walkDynamic(engine: DynamicWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const arrival = arrivedAt(engine, id, dx)
  if (!arrival) return engine.nudgeDynamicOffset(id, dx, 0)

  let moved = false
  engine.runBatch('Move dynamic', () => {
    // ⭐ …KeepingOffset, not the general re-anchor: the crossing is meant to be invisible, and the
    // ordinary one wipes the mark's own nudge (`dynamicOps.setDynamicAtSlot`).
    if (!engine.moveDynamicToSlotKeepingOffset(id, arrival.target)) return
    // The anchor has absorbed one gap, so the offset gives it up. The drawn mark is unchanged by the
    // pair, which is the whole design; `dx` is untouched and still has its journey to make.
    engine.nudgeDynamicOffset(id, dx - arrival.gap, 0)
    moved = true
    dbg(`[Dynamic] walked onto its next slot | id:${id} → m${arrival.target.measure} (gap ${arrival.gap.toFixed(2)}ss)`)
  })
  return moved
}
