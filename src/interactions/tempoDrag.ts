/**
 * ⭐⭐ **DRAGGING A TEMPO MARK — A SNAP FROM ANCHOR TO ANCHOR, ⛔ NOT A WALK** (his call,
 * 2026-08-31: *"the tempo drag is not working, lets do it from scratch… first make the drag not a
 * walk but anchor when the mouse hit the next anchor point"*).
 *
 * ## What changed, and it is the whole file
 *
 * The drag used to be the KEYS' mechanism with pixels in place of a step (`./tempoWalk` →
 * `./markDrive`): the ink followed the hand as an OFFSET and the anchor came along once the ink had
 * arrived at the next onset. That is still what ←/→ do. It is no longer what the mouse does.
 *
 * ⭐ **Here the mark has no in-between.** It sits ON an anchor; the hand carries that anchor point
 * along, and when it reaches the next one the mark is re-anchored there — offset and all
 * (`MusicEngine.previewTempoSlot`, the whole-stop write, which drops the sideways nudge and keeps
 * the lift). Between two onsets the horizontal writes nothing at all.
 *
 * ⚠️ **THE HAND CARRIES THE ANCHOR, ⛔ not the cursor's own x.** `handX` is where the mark's anchor
 * would be if it had followed the hand: the anchor's x when the gesture began, plus everything the
 * cursor has travelled since (`MouseController` measures it; {@link tempoAnchorXOf} is the half of
 * it that belongs here). The alternative reading — snap the moment the raw pointer passes an anchor —
 * fires early by however far into the mark's text the press landed, so grabbing the right-hand end of
 * `Allegro (♩ = 120)` would re-anchor almost at once. ⚠️ EXPLORATORY: if his eye wants the raw
 * pointer, that is the one line to change.
 *
 * ⛔ **What is deliberately NOT here**, because it is what he asked to remove:
 *
 * - **the interpolating offset** — a dragged mark cannot be parked between two onsets any more. The
 *   keys still park it, and `Ctrl+Backspace` still resets it.
 * - **the LATCH and its repayment** (`markDrive.DragFrame.droppedPx`) — a snap has nothing to cut
 *   short, so there is no debt for the caller to hold its baseline back by.
 *
 * ⭐ **The VERTICAL is untouched** — it stays a plain ink offset, and it stays the one offset in the
 * compartment that is OUTWARD (+up), converted here and nowhere else.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Stop } from '../engine/models/tempoOps'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { systemStopFor } from './markSystemJump'
import {
  drawnOnsets, markInkY, onsetAnchorX, onsetPoint, staffSpacePxOf, tempoAddress,
} from './tempoAnchors'
import { dbg, debugEnabled } from '../utils/debug'

/** What the drag needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type TempoDragEngine = Pick<MusicEngine,
  'getScore' | 'getElementRegistry' | 'getNote'
  | 'nextTempoSlot' | 'previewTempoSlot' | 'previewTempoOffset'>

/** Where the mark's anchor is drawn right now — what a gesture measures its hand against at the
 *  press (see {@link dragTempo}'s `handX`). Null when the last render drew neither the mark nor the
 *  onset it sits on. */
export function tempoAnchorXOf(engine: TempoDragEngine, id: string): number | null {
  const here = tempoAddress(engine, id)
  return here ? onsetAnchorX(engine, here) : null
}

/** What one frame of a tempo drag tells its caller. ⭐ `moved` repaints; `snappedPx` is how far the
 *  ANCHOR travelled, which is the only travel this gesture has — 0 on a frame between two onsets. */
export interface TempoDragFrame {
  moved: boolean
  snappedPx: number
}

/**
 * ⭐⭐ **ONE FRAME OF A TEMPO MARK DRAG.** No undo entry (the drop commits once,
 * {@link MusicEngine.commitTempoDrag}); three things in order, and the order is the content:
 *
 *  1. **the SYSTEM**, if the hand has taken the mark to another one — that ends the frame, or this
 *     frame's horizontal would be spent against stops the hand was never near;
 *  2. **the VERTICAL**, a plain ink offset (⚠️ OUTWARD, so the cursor's screen-down `dy` flips here
 *     and nowhere else);
 *  3. **the HORIZONTAL**, which is the snap and nothing else.
 *
 * @param handX where the mark's ANCHOR would be if it had followed the hand — see the header. ⛔ Not
 *   the raw cursor x.
 * @param dyPx the cursor's vertical travel since the last ACCEPTED frame, in screen pixels.
 * @returns null — ⛔ not `false` — when the mark is not drawn, so there is no staff-space size to
 *   convert the cursor's pixels with.
 */
export function dragTempo(
  engine: TempoDragEngine,
  id: string,
  handX: number,
  dyPx: number,
): TempoDragFrame | null {
  const ss = staffSpacePxOf(engine, id)
  if (!ss) {
    // ⛔ The decline is worth a line of its own: the caller cannot tell it from a refusal, and it
    //    means the LAST RENDER drew no tempo box — not that the hand did nothing.
    dbg(`[TempoDrag] declined — no drawn tempo box to measure a staff-space with | id:${id}`)
    return null
  }

  if (jumpSystems(engine, id, handX, dyPx, ss)) return { moved: true, snappedPx: 0 }

  // ⚠️ Screen-down → OUTWARD. This mark's stored `y` is the one in the compartment that is +up.
  const lifted = dyPx !== 0 && engine.previewTempoOffset(id, 0, -dyPx / ss)
  const snappedPx = snapToAnchorUnderHand(engine, id, handX)
  return { moved: lifted || snappedPx !== 0, snappedPx }
}

/**
 * ⭐⭐ **HIS RULE, VERBATIM** (2026-08-31): *"till the beginning of the ink doesn't reach the next
 * anchor point, nothing; when it reaches it, re-anchor"* — with the hand carrying the anchor point,
 * since the ink no longer moves between two onsets.
 *
 * ⭐ **It LOOPS**, because one frame of a fast hand really can fly over several onsets and
 * re-anchoring once would leave the mark trailing the cursor by however many it skipped. Each turn
 * moves to a strictly later (or earlier) stop, so the loop is bounded by the score.
 *
 * ⛔ **A stop whose x runs the WRONG WAY is the end of the road** — it is on another system, and two
 * systems' x's are not one ruler (`./markSystemJump`). Leaving the system is {@link jumpSystems}'
 * job, off the hand's Y.
 *
 * @returns how far the anchor travelled, in pixels, signed; 0 when nothing was written.
 */
function snapToAnchorUnderHand(engine: TempoDragEngine, id: string, handX: number): number {
  const from = tempoAnchorXOf(engine, id)
  if (from === null) return 0

  for (;;) {
    const anchorX = tempoAnchorXOf(engine, id)
    if (anchorX === null) break
    const direction: 1 | -1 = handX >= anchorX ? 1 : -1
    const next = engine.nextTempoSlot(id, direction)
    const nextX = next ? onsetAnchorX(engine, next) : null
    if (!next || nextX === null) break
    // ⛔ Not one ruler — the next stop in TIME is on the next system, so its x means nothing here.
    if (Math.sign(nextX - anchorX) !== direction) break
    // ⭐ THE RULE: has the hand reached it? A hand short of the next anchor writes nothing at all.
    if (direction === 1 ? handX < nextX : handX > nextX) break
    // ⚠️ The model refuses a beat another tempo mark already holds (one mark per beat, `tempoOps`),
    //    and the drag stops there — the same answer it gives at the end of the score.
    if (!engine.previewTempoSlot(id, next)) break
    if (debugEnabled()) {
      dbg(`[TempoDrag] hand ${handX.toFixed(1)} reached the next anchor ${nextX.toFixed(1)}`
        + ` — re-anchored to m${next.measure} beat ${next.beat.num}/${next.beat.den}`)
    }
  }

  const to = tempoAnchorXOf(engine, id)
  return to === null ? 0 : to - from
}

/**
 * ⭐⭐ **LEAVING THE MARK'S OWN SYSTEM** — the half of a drag the snap cannot do, `dynamicLane`'s
 * twin through the shared rule (`./markSystemJump`): the mark belongs to whichever system it would
 * look at home on, so the switch falls halfway between where it sits and where it would sit.
 *
 * ⭐⭐ A jump lands the mark where the ENGRAVER would put it — the offset goes, both axes. The `x`
 * goes because every re-anchor drops it; the `y` because on this gesture it is not a lift at all but
 * the distance the hand travelled to reach the other staff.
 *
 * ⛔ And the frame stops there: the snap does not also run, or this frame's hand would be measured
 * against a system the mark has just left.
 */
function jumpSystems(
  engine: TempoDragEngine,
  id: string,
  handX: number,
  dyPx: number,
  staffSpacePx: number,
): boolean {
  const inkY = markInkY(engine, id)
  const here = tempoAddress(engine, id)
  if (inkY === null || !here) return false

  const target = systemStopFor<Stop>({
    // 🚨🚨 **A TEMPO MARK'S BANDS ARE SYSTEMS, ⛔ NOT STAVES — his report, 2026-08-31**: *"look where
    // my mouse is and the tempo have not go to the next system"*, dragging straight down a grand
    // staff over 460 px, with the mark pinned near its own row the whole way.
    //
    // Measured in his log: `home 276…316` (the treble of system 1) and the rule saying *GO to
    // 404…444* — which is the BASS of the same system. Every sibling on the ladder has a rung per
    // STAFF, so `staffRuns()` is the right list for them; a tempo mark has none. It is engraved once
    // per system above the TOP staff (`TempoLayout`, and `./tempoWalk`'s wrap port says STAFF 0 for
    // exactly this reason), so *the staff below* is not a place it can go.
    //
    // ⭐ What that cost is both halves of the gesture, and it reads as the vertical being broken:
    // the hand-over fired at 70 px of lift, `previewTempoSlot` re-anchored the mark to a bass-only
    // onset and ZEROED the lift, the snap handed it straight back to beat 0, and the next frames
    // rebuilt the same 70 px — `[Tempo] jumped … → m1` fourteen times in one drag, never leaving the
    // system. ⛔ The fix is this family's own list, ⛔ never a change to the shared rule: five other
    // families read staves because they have a rung on each.
    bands: () => engine.getElementRegistry().staffRuns().filter(run => run.staff === 0),
    candidates: () => drawnOnsets(engine),
    anchor: () => onsetPoint(engine, here),
    inkY: () => inkY,
    // ⚠️ OUTWARD → screen: this mark's stored `y` is +up, and the rule reasons in screen pixels.
    liftPx: () => -(tempoOffsetOverrideOf(engine.getScore(), id)?.y ?? 0) * staffSpacePx,
    // A tempo mark is always engraved ABOVE the staff — it has no `placement` to ask.
    above: () => true,
  }, handX, inkY + dyPx)
  if (!target || !engine.previewTempoSlot(id, target)) return false

  const lift = tempoOffsetOverrideOf(engine.getScore(), id)?.y ?? 0
  if (lift !== 0) engine.previewTempoOffset(id, 0, -lift)
  dbg(`[Tempo] jumped to the system it now belongs to | id:${id} → m${target.measure}`)
  return true
}
