/**
 * The drag that moves a whole TRILL — a press on the `tr` or its wiggle. One ornament, two
 * gestures, told apart by WHERE it was grabbed: a SQUARE moves that end, the BODY moves the whole
 * thing — through the music sideways (extent and all) and up the LADDER vertically
 * (`../trillWalk.dragTrillBody`).
 *
 * ⛔ Not a row of {@link beginBodyDrag}: the ornament's frame is the SQUARE's frame, and it differs
 * from the wedge's, the bracket's and the pedal's in three ways.
 *
 * - **THE HOLD** (`../dragHold`). When the ink arrives at a note it LATCHES there, and the pixels
 *   the latch dropped are repaid out of the hand's next movement — so a frame's `dx` is what the
 *   ledger lets through, and a frame it swallows whole still advances the x anchor.
 * - **The ornament's MUSIC is measured once, at the press** (`beginTrillBodySpan`) — the far end
 *   rides on it. ⛔ Not on the first frame: by then the drag may already have moved the pair it is
 *   supposed to be measured from.
 * - **A WRAP ENDS THE GESTURE.** The ornament is a line away and the hand is not, so every further
 *   pixel would measure against a system it has left. It stays selected, so the arrows carry on.
 *
 * ⭐ **The preview is what makes this walk STABLE**, not only cheap. The walk decides from the
 * ornament's OWN DRAWN INK, and a `tr` dragged upward GROWS the above-staff band it is claiming —
 * which, under a full render, re-solves the system's height and the page's cast-off and moves the
 * ink the walk is about to read: the ornament teleports by a system stride from a mark shoving the
 * page it stands on. A preview redraws this family against a finished render and re-casts nothing.
 * It is preview-safe because `planTrillBands` and `renderTrills` find the staff through the START
 * NOTE's slot id, never a lane view — slot membership is what a mark drag does not touch. The DROP
 * renders for real, and that is where the page re-casts around the ornament's new claim.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import { dbg } from '../../utils/debug'
import { logHold, releaseHold, spendHold, takeHold } from '../dragHold'
import { trillStaffSpacePx } from '../trillLane'
import {
  beginTrillBodySpan, dragTrillBody, endTrillBodySpan, endTrillHandTrace, settleTrillLanding,
  traceTrillHandVsInk,
} from '../trillWalk'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

/** ⛔ null = declines to arm: the ornament's staff has no measured geometry, so there is no
 *  px→staff-space scale, and a guessed one would move a small staff's trill by the wrong amount. */
export function beginTrillBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine || !trillStaffSpacePx(engine.getElementRegistry(), id)) return null
  beginTrillBodySpan(engine, id)

  // A fresh ledger per gesture, as every mark drag arms one.
  const hold = releaseHold()
  let lastX = x
  let lastY = y
  let changed = false
  let ended = false
  const pressedAt = Date.now()

  const end = (): void => {
    if (ended) return // a wrap ends the gesture from inside a frame; the release then finds it over
    ended = true
    const eng = host.getEngine()
    if (eng && changed) {
      eng.commitTrillDrag('start')
      // ⛔ THE DROP RENDERS FOR REAL — see `./bodyDrag`.
      host.render.renderScore()
      dbg(`Trill moved | id:${id}`)
    }
    endTrillHandTrace() // ⏱ TEMPORARY — one summary line per gesture.
    endTrillBodySpan() // The next grab measures its own music.
    host.release()
  }

  return {
    kind: 'trillBody',
    end,

    move(eng: MusicEngine, mx: number, my: number) {
      if (ended || Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const rawDx = mx - lastX
      const heldDx = spendHold(hold, rawDx)
      const dy = my - lastY
      if (heldDx === 0 && dy === 0) {
        logHold('Trill', hold, rawDx, 0, false)
        lastX = mx
        return
      }
      const frame = dragTrillBody(eng, id, mx, heldDx, dy)
      // ⛔ null = the ornament is not drawn, so there is no scale to convert with; leave it alone.
      if (frame === null) return
      if (frame.moved) {
        if (frame.latched) {
          takeHold(hold, { gapAheadPx: frame.gapAheadPx, discardedPx: frame.droppedPx, dirSign: Math.sign(heldDx) })
        }
        logHold('Trill', hold, rawDx, heldDx, frame.latched)
        lastX = mx
        lastY = my
        changed = true
        host.render.previewMarks('trill', id)
        // ⚠️ EXPLORATORY — **a rung-change may not move the drawing.** What the new rung gives the
        // ornament is only knowable once it has been drawn there, so the payment is made after the
        // draw and inside the same mouse event (the wedge's line, `./hairpinBody`). At most once
        // per gesture, so the ordinary frame pays for no second draw.
        if (frame.jumped && settleTrillLanding(eng, id)) host.render.previewMarks('trill', id)
      }
      // ⏱ TEMPORARY — AFTER the draw, and OUTSIDE the `moved` branch: a refused frame is one where
      // the hand moved and the ornament did not, which is invisible to a trace taken before the write.
      traceTrillHandVsInk(eng, id, mx)
      if (frame.wrapped) end()
    },
  }
}
