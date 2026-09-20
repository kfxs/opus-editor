/**
 * The drag that moves a DYNAMIC — the ink follows the hand, and the anchor comes along when the ink
 * reaches a slot of the mark's lane (`../dynamicWalk`): the arrow keys' gesture with a mouse in it,
 * same arithmetic, same model state at the end of an equal journey. {@link beginBodyDrag} is the
 * frame.
 *
 * ⚠️ **No square, and nothing to arm first**: a dynamic is a POINT, so the MARK is its own handle
 * and the gesture arms on the very press that selects it. What separates a click from a drag is the
 * time threshold, applied on MOVE — and the baseline is the first frame past it.
 *
 * ⛔ Not a snap to the nearest notehead: that teleports the mark, can never park it between two
 * notes, and drops its own nudge on the way past (`dynamicOps.setDynamicAtSlot`).
 *
 * ⛔ **No hold, no catch-up, no latch**, where the slur's endpoint has all three. Decided: an
 * endpoint is *aimed* at a note, so offset zero has to be reachable exactly; a dynamic is a label
 * placed by eye, and resistance would be a snag with nothing to arrive at.
 *
 * ⭐ Both axes: the horizontal walks the mark through the music, the vertical is a plain ink offset
 * — except when the ink crosses ANOTHER STAFF, which is a JUMP to it. The walk decides; the frame
 * hands it the cursor's x, since a jump has to land somewhere along the new staff.
 *
 * ⭐ A frame MOVES the letters rather than redrawing them: they are an annotation inside their bar's
 * group, so the preview re-applies its composed transform (`engine/rendering/marks/markPreviewPass`, the
 * `dynamic` row). A frame that walked the mark onto another slot refuses there and renders for
 * real — the annotation hangs off a note, and no transform reaches another one.
 */
import { dragDynamic, settleDynamicLanding } from '../dynamicWalk'
import { beginBodyDrag, type BodyDragSpec } from './bodyDrag'
import type { DragHost, Gesture } from './gesture'

const DYNAMIC: BodyDragSpec = {
  kind: 'dynamic',
  family: 'dynamic',
  label: 'Dynamic',
  // ⛔ null = not drawn, so no scale; false = refused. The walk does not report a jump — a landing
  // is settled below whether or not this frame was the one that made it.
  step: (engine, id, cursorX, dxPx, dyPx) => {
    const moved = dragDynamic(engine, id, cursorX, dxPx, dyPx)
    return moved === null ? null : { moved, jumped: false }
  },
  // ⚠️ EXPLORATORY — **a landing may not move the drawing.** What the other staff's ladder gives
  // the mark is only knowable once it has been drawn there, so the payment is made after the draw
  // and inside the same mouse event. It writes at most once per landing.
  afterFrame: (engine, id) => settleDynamicLanding(engine, id),
  commit: engine => engine.dynamic.commitDynamicDrag(),
}

export function beginDynamicDrag(host: DragHost, id: string): Gesture {
  return beginBodyDrag(host, DYNAMIC, id)
}
