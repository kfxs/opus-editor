/**
 * The drag that moves a whole TRILL — a press on the `tr` or its wiggle. One ornament, two
 * gestures, told apart by WHERE it was grabbed: a SQUARE moves that end, the BODY moves the whole
 * thing — through the music sideways (extent and all) and up the LADDER vertically
 * (`../trillWalk.dragTrillBody`).
 *
 * A row of {@link beginHeldDrag}, ⛔ not of `./bodyDrag`: the ornament's body latches on the notes
 * it reaches, as its squares do, so its frame is theirs — the hold, and a WRAP that ends the
 * gesture. Two things are this gesture's own:
 *
 * - **The ornament's MUSIC is measured once, at the press** (`beginTrillBodySpan`) — the far end
 *   rides on it. ⛔ Not on the first frame: by then the drag may already have moved the pair it is
 *   supposed to be measured from. It is forgotten when the gesture ends, so the next grab measures
 *   its own.
 * - **A rung-change may not move the drawing** — see `afterFrame` below.
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
import { trillStaffSpacePx } from '../trillLane'
import {
  beginTrillBodySpan, dragTrillBody, endTrillBodySpan, endTrillHandTrace, settleTrillLanding,
  traceTrillHandVsInk,
} from '../trillWalk'
import { beginHeldDrag } from './heldDrag'
import type { DragHost, Gesture } from './gesture'

/** ⛔ null = declines to arm: the ornament's staff has no measured geometry, so there is no
 *  px→staff-space scale, and a guessed one would move a small staff's trill by the wrong amount. */
export function beginTrillBodyDrag(host: DragHost, id: string, x: number, y: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine || !trillStaffSpacePx(engine.getElementRegistry(), id)) return null
  beginTrillBodySpan(engine, id)
  return beginHeldDrag(host, {
    kind: 'trillBody',
    family: 'trill',
    label: 'Trill',
    id,
    step: (eng, cursorX, heldDx, dy) => dragTrillBody(eng, id, cursorX, heldDx, dy),
    // ⚠️ EXPLORATORY — **a rung-change may not move the drawing.** What the new rung gives the
    // ornament is only knowable once it has been drawn there, so the payment is made after the draw
    // and inside the same mouse event (the wedge's line, `./hairpinBody`). At most once per
    // gesture, so the ordinary frame pays for no second draw.
    afterFrame: (eng, frame) => frame.jumped === true && settleTrillLanding(eng, id),
    // ⏱ TEMPORARY — AFTER the draw, and on a refused frame too: that is one where the hand moved
    // and the ornament did not, which is invisible to a trace taken before the write.
    trace: (eng, cursorX) => traceTrillHandVsInk(eng, id, cursorX),
    commit: eng => eng.trill.commitTrillDrag('start'),
    done: () => {
      endTrillHandTrace() // ⏱ TEMPORARY — one summary line per gesture.
      endTrillBodySpan()
    },
  }, x, y)
}
