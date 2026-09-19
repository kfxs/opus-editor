/**
 * The drag that RESHAPES a slur — a press on one of its two control-point dots. The grabbed dot
 * follows the cursor and the other is held where the press found it.
 *
 * ⛔ Not a delta gesture: a control point is wherever the hand IS, so a frame sets rather than
 * accumulates and there is no anchor to keep. It inverts `curveControlPoints`' math from the drawn
 * endpoints — the keyboard nudge inverts the same math from the same registry fields, which is why
 * the baseline conversion lives with it (`../slurHandleNudge`).
 *
 * ⭐ The handle carries its OWN segment's context (endpoints, control points, staff spacing, segment
 * address, span count), read once at the press — no re-lookup of a `slur` partial, which on a
 * cross-system slur would resolve to the wrong segment. The override is stored in STAFF-SPACES
 * (resolution-independent), so the pixel shape is divided by the staff spacing of the staff the
 * curve was drawn on.
 */
import type { ElementInfo } from '../../engine/ElementRegistry'
import type { SlurSegmentAddress } from '../../types/music'
import { dbg } from '../../utils/debug'
import { cpsFromDrawnControlPoints } from '../slurHandleNudge'
import { DRAG_TIME_THRESHOLD_MS, type DragHost, type Gesture } from './gesture'

type Point = { x: number; y: number }

/** ⛔ null = the handle does not carry what a reshape needs, and the press stays a selection. */
export function beginSlurHandleDrag(host: DragHost, slurId: string, handle: ElementInfo): Gesture | null {
  const { cpIndex, slurEndpoints, controlPoints } = handle
  if (cpIndex === undefined || !slurEndpoints || !controlPoints) return null
  const baseline = cpsFromDrawnControlPoints(controlPoints, slurEndpoints)
  const staffSpacePx = handle.staffSpacePx ?? 10
  /** For a cross-system slur, which segment the grabbed handle reshapes. Undefined = a same-line
   *  single arc, which routes to the slur's own `curveShape`. */
  const segment: SlurSegmentAddress | undefined = handle.segmentRole === undefined ? undefined
    : handle.segmentRole === 'middle' ? { role: 'middle', ordinal: handle.segmentOrdinal ?? 0 }
    : { role: handle.segmentRole }
  /** The live system count, written as the `segmentCurveShape` reset signature. */
  const spanCount = handle.slurSpanCount
  let changed = false
  const pressedAt = Date.now()

  return {
    kind: 'slurHandle',

    move(engine, x, y) {
      if (Date.now() - pressedAt < DRAG_TIME_THRESHOLD_MS) return
      const { p0, p1, direction } = slurEndpoints
      const spacing = (p1.x - p0.x) / 4
      const dragged = cpIndex === 0
        ? { x: x - p0.x - spacing, y: (y - p0.y) * direction }
        : { x: x - p1.x + spacing, y: (y - p1.y) * direction }
      const cps: [Point, Point] = cpIndex === 0 ? [dragged, baseline[1]] : [baseline[0], dragged]
      const cpsStaffSpaces: [Point, Point] = [
        { x: cps[0].x / staffSpacePx, y: cps[0].y / staffSpacePx },
        { x: cps[1].x / staffSpacePx, y: cps[1].y / staffSpacePx },
      ]
      if (engine.previewSlurShape(slurId, cpsStaffSpaces, segment, spanCount)) {
        changed = true
        // A full render: it redraws the handles at the new spots.
        host.render.renderScore()
      }
    },

    end() {
      const engine = host.getEngine()
      if (engine && changed) {
        engine.commitSlurShape()
        dbg(`Slur reshaped | id:${slurId}`)
      }
      host.release()
    },
  }
}
