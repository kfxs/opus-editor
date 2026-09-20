/**
 * The drag that moves a whole OTTAVA — a press on the numeral or its dashed line, where a press on
 * a square moves one END. {@link beginBodyDrag} is the frame; `../ottavaWalk` is the walk.
 */
import { ottavaStaffSpacePx } from '../lanes/ottavaLane'
import { dragOttavaBody, settleOttavaLanding } from '../walks/ottavaWalk'
import { beginBodyDrag, type BodyDragSpec } from './bodyDrag'
import type { DragHost, Gesture } from './gesture'

const OTTAVA_BODY: BodyDragSpec = {
  kind: 'ottavaBody',
  family: 'ottava',
  label: 'Ottava',
  step: dragOttavaBody,
  // ⚠️ EXPLORATORY: a landing on the very last frame is still owed its settlement. ⛔ It also stops
  // a stale debt reaching the NEXT drag, which would yank the bracket on its first frame.
  beforeCommit: settleOttavaLanding,
  commit: engine => engine.ottava.commitOttavaOffsetDrag(),
}

/** ⛔ null = declines to arm: the bracket is not measurably drawn, and a gesture in pixels needs a
 *  staff-space size to convert them with. */
export function beginOttavaBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine || !ottavaStaffSpacePx(engine.getElementRegistry(), id)) return null
  return beginBodyDrag(host, OTTAVA_BODY, id, { x, y })
}
