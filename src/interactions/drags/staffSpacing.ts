/**
 * The vertical drag that sets the SPACE ABOVE a staff — a press inside the selected measure box,
 * dragged up or down (Sibelius's "space above staff"). Screen-down widens the space, pushing the
 * staff and everything below it down; the box follows because every frame re-renders.
 *
 * It works in both views and writes different things: in the wrapped view a per-system override,
 * in the linear view an ephemeral view knob that persists nothing — the ENGINE decides which, so
 * nothing keyed to a system can be written from a view that has no system worth naming.
 *
 * ⭐ **The scale is the grabbed staff's OWN line spacing, measured at the press.** The authored
 * distance is stored in that staff's own spaces (`layout/staffStride.spacingAbovePx`), so dividing
 * the hand's pixels by its measured spacing is what makes a pixel of hand a pixel of staff — on a
 * small staff too. ⛔ Never a scale borrowed from another gesture: this one used to read the
 * slur-handle drag's field, and ran at whatever slur had been dragged last.
 *
 * ⛔ Not a delta gesture: the space is `baseline + (y − the press's y)`, so a refused frame needs no
 * anchor to keep — the next frame is measured from the press again.
 */
import { dbg } from '../../utils/debug'
import { STAFF_SPACE_PX } from '../../engine/models/staffSize'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

/** ⛔ null = no engine to write to. `measure` is any bar on the target SYSTEM — the per-system key. */
export function beginStaffSpacingDrag(host: DragHost, staff: number, measure: number, startY: number): Gesture | null {
  const engine = host.getEngine()
  if (!engine) return null
  const baseline = engine.getStaffSpacingAbove(staff, measure)
  // Unmeasured (nothing drawn yet) falls back to a full-size staff's spacing.
  const staffSpacePx = engine.getElementRegistry().getStaffGeometry(measure, staff)?.lineSpacing ?? STAFF_SPACE_PX
  let changed = false
  const pressedAt = Date.now()
  dbg(`Staff-spacing drag ready | measure:${measure} staff:${staff} baseline:${baseline} ss`)

  return {
    kind: 'staffSpacing',

    move(eng, _x, y) {
      if (Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const above = baseline + (y - startY) / staffSpacePx
      if (eng.previewStaffSpacing(staff, measure, above)) {
        // Only a real change from the baseline arms the commit — a press that never moves
        // vertically (a tap-to-select, or a horizontal wiggle) records no undo entry.
        if (above !== baseline) changed = true
        host.render.renderScore()
      }
    },

    end() {
      const eng = host.getEngine()
      if (eng && changed) {
        eng.commitStaffSpacing()
        dbg(`Staff spacing set | staff:${staff} → ${eng.getStaffSpacingAbove(staff, measure)} ss`)
      }
      host.release()
    },
  }
}
