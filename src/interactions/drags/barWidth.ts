/**
 * The drag that sets a BAR'S WIDTH — the grabbed barline follows the cursor, and the bar to its
 * LEFT takes or gives up the room, its music re-spaced proportionally rather than pushed to one end
 * (docs/bar-width-plan.md §4–§6).
 *
 * ⭐ **The room is captured ONCE, off the picture the user grabbed** — the slope, the measured
 * floor, the ceiling. A stretch changes no bar's *intrinsic* width, so none of those terms move
 * while the drag runs; that is what makes one capture correct rather than merely cheap. The
 * px→stretch conversion is the room's own (`stretchForBarlineDelta`), which is why the barline lands
 * under the pointer instead of short of it: widening a bar also shrinks its own justified share and
 * every bar's before it on the line. Continuous by contract — ⛔ never the keyboard's
 * `stretchForStep`, which is allowed to jump the casting-off.
 *
 * ⭐ **It arms on a PINNED barline too** — the one ending a system, held at the right margin by
 * justification, which cannot follow the pointer by any amount. Declining there made a bar
 * stretched until it filled its system UNSHRINKABLE: a gesture you can get into and not out of is
 * worse than one that lags. So the room answers continuously (by the bar's own music), and the
 * moment a shrink re-wraps the system the tracking is picked back up.
 *
 * ⭐ **A RE-WRAP re-takes the room and re-anchors to the pointer.** The captured room describes one
 * casting-off: its sums hold only while the grabbed bar's line holds the same bars. Push one onto
 * the next system and the formula stops describing the picture — the barline tracks to the pixel,
 * then runs ahead and gains on every further re-wrap. ⛔ Refusing to re-wrap was the wrong trade (a
 * gesture that seizes up at a boundary reads as broken), so: one jump at the boundary, which is
 * honest — the layout really did change discontinuously — then exact tracking again.
 *
 * ⭐ **The pointer is HIDDEN for the gesture.** At a re-wrap no arithmetic can keep the line under a
 * cursor that is still visible beside it; with the pointer gone the barline IS the cursor, and the
 * jump reads as the music re-flowing rather than as a slip.
 *
 * ⚠️ Told from a click by DISTANCE, not time, and horizontal only — the target is a barline, so
 * there is no axis contest. The gesture is held from the PRESS, before the dead zone, so a press
 * that never moves still ends cleanly; until it leaves the dead zone its moves are not its own.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import { dbg } from '../../utils/debug'
import { DRAG_DISTANCE_THRESHOLD_PX, type DragHost, type Gesture } from './gesture'

/** ⛔ null = declines, leaving a plain barline selection: the room cannot be measured at all. */
export function beginBarWidthDrag(host: DragHost, engine: MusicEngine, measure: number, x: number): Gesture | null {
  let room = engine.barWidthRoom(measure)
  if (!room) {
    // ⚠️ Say WHICH reason it was. `barWidthRoom` answers a bare null — "I don't know", by design —
    // for a dirty model, a bar with nothing DRAWN (a culled bar still has a hit-box) and a bar with
    // no note space; from the outside all three look identical to a working drag with no room: the
    // barline lights up and will not move.
    const registry = engine.getElementRegistry()
    const columns = registry.getByMeasure(measure)
      .filter(el => (el.type === 'note' || el.type === 'rest') && el.beat !== undefined).length
    dbg(`Bar width | bar ${measure} REFUSES the drag — no room. `
      + `painted:${registry.isPainted(measure, 0)} · drawn columns:${columns} · `
      + `geometry:${!!registry.getStaffGeometry(measure, 0)} · render stale:${engine.isRenderStale()} `
      + '— Try __barlines.boxes()')
    return null
  }
  if (room.barlineSlope <= 0) {
    dbg(`Bar width | bar ${measure} ends its system — its barline is pinned, so the drag moves the bar's own music`)
  }
  let startX = x
  /** The casting-off the captured room describes (`MusicEngine.barWidthLineKey`). */
  let lineKey = engine.barWidthLineKey(measure)
  let dragging = false
  let changed = false
  /** Tracking, but the bar is refusing the value — logged on the transition in, not per frame. */
  let blocked = false
  dbg(`Bar width | armed on bar ${measure} · now ×${engine.getBarWidth(measure).toFixed(3)} · `
    + `room ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
    + `barline slope ${room.barlineSlope.toFixed(3)} · line ${lineKey}`)

  return {
    kind: 'barWidth',

    move(eng, mx) {
      if (!room) return false
      const dx = mx - startX
      if (!dragging) {
        if (Math.abs(dx) < DRAG_DISTANCE_THRESHOLD_PX) return false // still a click
        dragging = true
        host.setCursor('none')
      }
      const target = room.stretchForBarlineDelta(dx)
      if (eng.previewBarWidth(measure, target, room.minStretch, room.maxStretch)) {
        blocked = false
        changed = true
        host.render.renderScore()
        // Only on the frames where the system actually re-wrapped does this re-read anything.
        const key = eng.barWidthLineKey(measure)
        const fresh = key !== null && key !== lineKey ? eng.barWidthRoom(measure) : null
        if (fresh) {
          room = fresh
          startX = mx
          lineKey = key
          dbg(`Bar width | system re-wrapped mid-drag — re-anchored on bar ${measure} (slope ${fresh.barlineSlope.toFixed(3)})`)
        }
      } else if (!blocked) {
        blocked = true
        dbg(`Bar width | bar ${measure} not moving · asked ×${target.toFixed(3)} · `
          + `clamp ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
          + `now ×${eng.getBarWidth(measure).toFixed(3)} · dx ${dx.toFixed(1)}px`)
      }
      return true
    },

    end() {
      const eng = host.getEngine()
      if (changed && eng) {
        eng.commitBarWidth()
        dbg(`Bar width set | bar ${measure} → ×${eng.getBarWidth(measure).toFixed(3)}`)
      }
      host.setCursor('')
      host.release()
    },
  }
}
