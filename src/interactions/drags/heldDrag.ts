/**
 * **A HELD drag: the ink follows the hand and LATCHES on the notes it reaches** — the frame of a
 * span mark's SQUARE (`./markEnd`) and of the trill's body (`./trillBody`), whose walks all report
 * a latch. `./bodyDrag` is the same frame without the hold, for the marks whose body walks freely.
 *
 * ## THE HOLD, before anything is asked of the walk (`../dragHold`)
 *
 * While an anchor has the ink, horizontal travel is ABSORBED — the cursor moves, the mark does not
 * — and once the hold is spent the catch-up hands every absorbed pixel back at the derived gain.
 *
 * - **A fresh ledger per gesture.** A hold left over from the last drag would swallow this one's
 *   first pixels, on a mark it was never taken for. It is the gesture's own, in its closure.
 * - ⛔ **The vertical is never held**, so the hand can still lift the mark while an anchor has it —
 *   which is why `y` keeps its own anchor.
 * - **A frame the ledger swallows whole still advances the x anchor**, or the absorbed travel is
 *   paid out twice — and it is still logged, or the deviation the instrument reports is its own
 *   arithmetic.
 * - **What a latch DROPPED goes on the debt, ⛔ not on the cursor anchor**: the catch-up hands it
 *   back, and holding the anchor back as well would pay it out twice.
 *
 * ## The rest is the family's
 *
 * The delta is measured from the last ACCEPTED frame; a frame draws its own family and nothing
 * else, ⛔ never a full render inside `mousemove` (a square re-deriving the whole score trailed the
 * hand, and a slow frame read as a stall); the drop renders for real and records one undo entry —
 * `./bodyDrag` states why.
 *
 * ⭐⭐ **A WRAP ENDS THE GESTURE.** That end is now on another system and the hand is still on this
 * one, so every further pixel would move it by a distance measured against a system it has left.
 * The mark stays selected (a square stays ARMED), so the arrows carry on. ⚠️ A vertical RUNG is
 * the opposite case and ends only the FRAME: the hand travels WITH the mark, so the walk reports it
 * as `jumped`, never `wrapped`. `end` is safe to call again — the release that follows a wrap
 * finds the gesture over.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { MarkPreviewKind } from '../../engine/rendering/markPreviewPass'
import { dbg } from '../../utils/debug'
import { logHold, releaseHold, spendHold, takeHold } from '../dragHold'
import type { DragFrame } from '../markDrive'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type DragKind, type Gesture } from './gesture'

/** What a latching walk answers for one frame — `../markDrive`'s frame, plus the `jumped` a body
 *  walk adds for a ladder rung. ⛔ null = the mark is not drawn, so there is no px→staff-space scale
 *  to convert with: the frame is dropped and the anchor left alone. */
export type HeldFrame = (DragFrame & { jumped?: boolean }) | null

/** One gesture's row. */
export interface HeldDragSpec {
  kind: DragKind
  /** What a frame draws: one family against the last render (and then the drop renders for real),
   *  or `'score'` — a full render every frame, for a gesture whose frames change more than one
   *  family's ink (a slur's end re-anchoring re-tints its anchor note and redraws its guide line).
   *  The last frame is then already the real picture, so the drop draws nothing more. */
  family: MarkPreviewKind | 'score'
  /** For the hold's log and the drop's. */
  label: string
  /** The mark. */
  id: string
  /** One frame of the walk: the cursor's x, the HELD horizontal delta, and the vertical delta. */
  step(engine: MusicEngine, cursorX: number, heldDxPx: number, dyPx: number): HeldFrame
  /** After an accepted frame has been DRAWN; true = it wrote again, and the frame draws twice. */
  afterFrame?(engine: MusicEngine, frame: NonNullable<HeldFrame>): boolean
  /** After every frame the walk answered, moved or not — an instrument's seat. */
  trace?(engine: MusicEngine, cursorX: number): void
  /** Record the gesture's ONE undo entry. */
  commit(engine: MusicEngine): void
  /** The gesture is over, whether or not it wrote anything. */
  done?(): void
}

export function beginHeldDrag(host: DragHost, spec: HeldDragSpec, x: number, y: number): Gesture {
  const hold = releaseHold()
  let lastX = x
  let lastY = y
  let changed = false
  let ended = false
  const pressedAt = Date.now()

  const draw = (): void => {
    if (spec.family === 'score') host.render.renderScore()
    else host.render.previewMarks(spec.family, spec.id)
  }

  const end = (): void => {
    if (ended) return
    ended = true
    const engine = host.getEngine()
    if (engine && changed) {
      spec.commit(engine)
      if (spec.family !== 'score') host.render.renderScore()
      dbg(`${spec.label} dragged | id:${spec.id}`)
    }
    spec.done?.()
    host.release()
  }

  return {
    kind: spec.kind,
    end,

    move(engine, mx, my) {
      if (ended || Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const rawDx = mx - lastX
      const heldDx = spendHold(hold, rawDx)
      const dy = my - lastY
      if (heldDx === 0 && dy === 0) {
        logHold(spec.label, hold, rawDx, 0, false)
        lastX = mx
        return
      }
      const frame = spec.step(engine, mx, heldDx, dy)
      if (frame === null) return
      if (frame.moved) {
        if (frame.latched) {
          takeHold(hold, { gapAheadPx: frame.gapAheadPx, discardedPx: frame.droppedPx, dirSign: Math.sign(heldDx) })
        }
        logHold(spec.label, hold, rawDx, heldDx, frame.latched)
        lastX = mx
        lastY = my
        changed = true
        draw()
        if (spec.afterFrame?.(engine, frame)) draw()
      }
      spec.trace?.(engine, mx)
      if (frame.wrapped) end()
    },
  }
}
