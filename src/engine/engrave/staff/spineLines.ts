/**
 * ⭐ **THE STAFF'S LINES, DRAWN FROM A SPINE** (`docs/plans/bent-staff-plan.md` A3) — the second kind
 * of ink a bent staff has: ⛔ not a block placed ON the path, but ink re-solved FROM it. On the *Bike
 * Ride* plate these are the only lines that truly curve.
 *
 * Each line is the spine's PARALLEL curve at that line's offset, so it works for any {@link Spine}
 * without knowing which: the curve is walked in short steps and each step is one cubic whose handles
 * lie along the spine's own tangent (a parallel curve shares its tangent). ⚠️ The handle LENGTH is a
 * third of the chord — exact for a straight run, and within a hair of the true arc handle
 * (`4/3·tan(δ/4)·r`) while a step turns through a small angle, which {@link STEP_PX} keeps it to.
 *
 * ⭐ The offsets are `./staffFrame`'s arithmetic, asked of a {@link StaffFrame} whose `topLineY` is the
 * top line's offset ACROSS the spine — and the ink hangs "down" from its line by the thickness, the
 * convention `./staffLines` owns ({@link staffLineMidY}).
 *
 * ⛔ No DOM (`lint:boundary`).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from './staffSpine'
import { pointAt } from './staffSpine'
import type { StaffFrame } from './staffFrame'
import { staffLineY } from './staffFrame'
import { staffLineMidY } from './staffLines'

/** How far along the spine one cubic runs. A changeable default — smaller is smoother, and slower. */
const STEP_PX = 12

/** The fewest cubics a line is cut into, so a tiny closed spine is still round. */
const MIN_STEPS = 16

/** Stroke the parallel curve of `spine` at `offset`, from `from` to `to` along it. */
export function strokeSpineParallel(ctx: DrawContext, spine: Spine, offset: number, from: number, to: number): void {
  const steps = Math.max(MIN_STEPS, Math.ceil(Math.abs(to - from) / STEP_PX))
  const ds = (to - from) / steps
  let p = pointAt(spine, from, offset)
  let angle = spine.at(from).angle
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
  for (let i = 1; i <= steps; i++) {
    const s = from + i * ds
    const q = pointAt(spine, s, offset)
    const nextAngle = spine.at(s).angle
    const handle = Math.hypot(q.x - p.x, q.y - p.y) / 3
    ctx.bezierCurveTo(
      p.x + handle * Math.cos(angle), p.y + handle * Math.sin(angle),
      q.x - handle * Math.cos(nextAngle), q.y - handle * Math.sin(nextAngle),
      q.x, q.y,
    )
    p = q
    angle = nextAngle
  }
  ctx.stroke()
}

/** Every line of `frame`, along the whole of `spine` (or the run `from`…`to`), `thickness` thick. */
export function drawSpineLines(
  ctx: DrawContext, spine: Spine, frame: StaffFrame, thickness: number,
  from: number = 0, to: number = spine.length,
): void {
  ctx.setLineWidth(thickness)
  for (let line = 0; line < frame.lineCount; line++) {
    strokeSpineParallel(ctx, spine, staffLineMidY(staffLineY(frame, line), thickness), from, to)
  }
}
