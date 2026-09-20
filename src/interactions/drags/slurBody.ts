/**
 * The drag that moves a whole SLUR's ink — a press on the ARC itself, where a press on a HANDLE
 * moves one point. {@link beginBodyDrag} is the frame; `../slurBodyDrag` owns the arithmetic and
 * the refusal rule.
 *
 * Free pixels: no walk, no hold and no latch, unlike the slur's ENDPOINT drag — those exist because
 * an endpoint has a next note to arrive at, and a whole-curve move has nothing to arrive at. So a
 * frame never jumps.
 *
 * ⭐ Safe to preview: a frame is a pure cursor delta, and `renderSlurs` reads `score.slurs` and
 * `staffIndexOfId` — neither of them the last render's lane views.
 */
import { slurBodyDragStep, slurBodyStaffSpacePx } from '../walks/slurBodyDrag'
import { beginBodyDrag } from './bodyDrag'
import type { DragHost, Gesture } from './gesture'

/** ⛔ null = declines to arm: the drawn curve offers no measured staff-space scale, and a guessed
 *  one would move a small staff's slur by the wrong amount. The press stays a selection. */
export function beginSlurBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  const staffSpacePx = engine && slurBodyStaffSpacePx(engine.getElementRegistry(), id)
  if (!staffSpacePx) return null
  // The scale is measured ONCE, at the press — the staff the grabbed curve was drawn on.
  const origin = { x: 0, y: 0, staffSpacePx }
  return beginBodyDrag(host, {
    kind: 'slurBody',
    family: 'slur',
    label: 'Slur',
    // The frame hands over the delta since the last accepted cursor; measured from `origin`, that
    // delta IS the position `slurBodyDragStep` converts. It answers null for "nothing moved" and
    // for a refusal alike, and either way the anchor stays put.
    step: (eng, slurId, _cursorX, dxPx, dyPx) =>
      ({ moved: slurBodyDragStep(eng, slurId, origin, dxPx, dyPx) !== null, jumped: false }),
    commit: eng => eng.slur.commitSlurOffsetDrag(),
  }, id, { x, y })
}
