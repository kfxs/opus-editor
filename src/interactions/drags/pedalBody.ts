/**
 * The drag that moves a whole PEDAL — a press on either SIGN. One pedal, two gestures, told apart
 * by WHERE it was grabbed: a SQUARE moves that sign through the music, the BODY moves the pair —
 * sideways, and onto another system vertically. {@link beginBodyDrag} is the frame;
 * `../pedalWalk` is the walk.
 *
 * ⚠️ `drawPedal` files its ladder claim during the DRAW, unlike its siblings, so the frame's
 * preview rewinds `occupiedBands` — see `engine/rendering/marks/markPreviewPass`.
 */
import { pedalStaffSpacePx } from '../lanes/pedalLane'
import { dragPedalBody, settlePedalLanding } from '../walks/pedalWalk'
import { beginBodyDrag, type BodyDragSpec } from './bodyDrag'
import type { DragHost, Gesture } from './gesture'

const PEDAL_BODY: BodyDragSpec = {
  kind: 'pedalBody',
  family: 'pedal',
  label: 'Pedal',
  step: dragPedalBody,
  // ⚠️ EXPLORATORY: a landing on the very last frame is still owed its settlement. ⛔ It also stops
  // a stale debt reaching the NEXT drag, which would yank the pedal on its first frame.
  beforeCommit: settlePedalLanding,
  commit: engine => engine.pedal.commitPedalOffsetDrag(),
}

/** ⛔ null = declines to arm: the pedal's staff has no measured geometry, so there is no
 *  px→staff-space scale, and a guessed one would move a small staff's pedal by the wrong amount. */
export function beginPedalBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine || !pedalStaffSpacePx(engine.getElementRegistry(), id)) return null
  return beginBodyDrag(host, PEDAL_BODY, id, { x, y })
}
