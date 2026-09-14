import type { DrawContext } from '@/engine/paint/DrawContext'
import type { SignKind } from '@/engine/engrave/staff/signRun'
import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'
import type { WalkSign } from '@/engine/engrave/staff/signWalk'

/**
 * ⭐ **A sign a score stave carries** — S4b1 gave it its own position, S4c made it a plain object of ours
 * (`docs/vexflow-removal-map.md`).
 *
 * Our clef, meter and barline implement it, and `EngravedStave` holds them in one list. The stave's walk
 * sets {@link StaveSign.signX}, `./headerPlacementPass` and `spreadHeaderToSystem` move it, a hand offset
 * (`./clefOffsetPass`) adds to {@link StaveSign.signShift}, and the sign draws at their sum.
 */
export interface StaveSign {
  /** What the sign is. */
  readonly signKind: SignKind
  /** The sign's id — its SVG group is `vf-<id>` (the painter adds the prefix). */
  readonly id: string
  /** The walk's inputs — padding, width, and a barline's metrics. */
  walkInput(): WalkSign
  /** The sign's unshifted origin, in the stave's own space. */
  signX: number
  /** A hand offset, added when the sign is drawn. */
  signShift: number
  /**
   * Draw the sign on `surface` (the stave's own — the recorder during `recordScene`), against the staff
   * `frame`. `page` is the real painter, for the one sign that must leave VexFlow's empty group there.
   */
  drawSign(surface: DrawContext, frame: StaffFrame, page: DrawContext): void
}

let lastSignId = 0

/** A fresh id for a sign — ours, so a sign takes nothing from VexFlow's own id counter. */
export function newSignId(): string {
  lastSignId += 1
  return `sign${lastSignId}`
}
