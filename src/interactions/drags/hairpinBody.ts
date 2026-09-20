/**
 * The drag that moves a whole HAIRPIN — a press on the wedge's arm, where a press on a square moves
 * one END through the music. {@link beginBodyDrag} is the frame; `../hairpinWalk` is the walk.
 */
import { hairpinStaffSpacePx } from '../elements/hairpinHandles'
import { dragHairpinBody, settleHairpinLanding } from '../hairpinWalk'
import { beginBodyDrag, type BodyDragSpec } from './bodyDrag'
import type { DragHost, Gesture } from './gesture'

const HAIRPIN_BODY: BodyDragSpec = {
  kind: 'hairpinBody',
  family: 'hairpin',
  label: 'Hairpin',
  step: dragHairpinBody,
  // ⚠️ EXPLORATORY — **a flip may not move the drawing.** What the other side of the staff gives
  // the wedge is only knowable once it has been drawn there, so the payment is made after the
  // frame's draw and inside the same mouse event: on the next frame instead, the leap would be on
  // screen for one frame. It writes at most once per gesture, so the second draw is not a cost the
  // ordinary frame pays.
  afterFrame: (engine, id, frame) => frame.jumped && settleHairpinLanding(engine, id),
  commit: engine => engine.hairpin.commitHairpinOffsetDrag(),
}

/** ⛔ null = declines to arm: the wedge is not measurably drawn, and a gesture in pixels needs a
 *  staff-space size to convert them with. */
export function beginHairpinBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine || !hairpinStaffSpacePx(engine.getElementRegistry(), id)) return null
  return beginBodyDrag(host, HAIRPIN_BODY, id, { x, y })
}
