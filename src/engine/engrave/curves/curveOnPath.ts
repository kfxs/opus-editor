/**
 * ⭐⭐ **A CURVE ON A BENT STAFF — TWO DRAWINGS, AND THE SIDE CHOOSES** (port map #13 of
 * `docs/plans/bent-staff-plan.md`; ⭐ HIS RULE, 2026-09-25: *"if the slur is outside the circle it should follow
 * the curve of the circle; if the curve is inside the circle, the solution is to get the two anchor points
 * and make the curve of the slur like normal (forgetting the curve of the circle) … the form I'm intuitively
 * drawing with a pencil"*).
 *
 * A slur under its notes is a bowl opening toward them. On the OUTSIDE of a loop the staff lines curve toward
 * the notes too, so a curve that RIDES the lines is bent the right way and hugs the music — the plate's
 * picture ({@link drawCurveArcOnPath}: the arc solved in the path's unrolled plane `(s, d)`, its lens
 * sampled and carried through `pointAt`). On the INSIDE the lines curve toward the centre, AWAY from the
 * notes, so a curve riding them is bent the wrong way at every point (his eye: *"almost flat"*, *"inverted"*),
 * and no bend can mend it — the sagitta-corrected bend folded into a V. There the curve is a RIGID unit,
 * like the beam and the tuplet bracket ({@link drawCurveArcRigid}: the page's cubic between the two anchors'
 * PAGE points, in the chord's own frame, bowing away from the notes) — a long one is a bowl across the
 * disc, as the pencil draws it.
 *
 * WHICH side is {@link pathBendsTowardBow}: does the path, between the ends, bend toward the side the
 * curve bows to? On a straight spine neither bends and both drawings coincide.
 *
 * ⛔ No DOM. ⛔ Nothing here chooses a weight: the caller hands in the fill gap and the outline width it would
 * hand `engrave/curves/curveInk`.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '../staff/staffSpine'
import { pointAt } from '../staff/staffSpine'
import { curveControlPoints, type CurveArc, type CurvePoint } from './curveInk'

/**
 * ⭐ Does the path bend TOWARD the side `arc` bows to, between its ends — i.e. is the curve on the INSIDE of
 * the loop? The signed distance, along the bow's direction, from the path-following midpoint to the chord's
 * midpoint: positive when the chord lies on the bow's side of the path. Zero on a straight spine.
 */
export function pathBendsTowardBow(spine: Spine, arc: CurveArc): boolean {
  const { p0, p1, direction } = arc
  const mid = pointAt(spine, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2)
  const a = pointAt(spine, p0.x, p0.y)
  const b = pointAt(spine, p1.x, p1.y)
  const chordMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const { angle } = spine.at((p0.x + p1.x) / 2)
  const down = { x: -Math.sin(angle), y: Math.cos(angle) }
  const along = (chordMid.x - mid.x) * down.x * direction + (chordMid.y - mid.y) * down.y * direction
  return along > 1e-6
}

/** Steps per edge — more than `curveInk`'s 16, because the samples ARE the ink here. */
const SAMPLES = 24

/** A cubic's point at `t`. */
function cubicAt(p0: CurvePoint, c0: CurvePoint, c1: CurvePoint, p1: CurvePoint, t: number): CurvePoint {
  const mt = 1 - t
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t
  return { x: a * p0.x + b * c0.x + c * c1.x + d * p1.x, y: a * p0.y + b * c0.y + c * c1.y + d * p1.y }
}

/**
 * Draw `arc` — stated in the path's plane, `x` = s and `y` = d — bent onto `spine`. The lens is the one
 * `curveInk.drawCurveArcInk` draws: the near cubic out, the far cubic (its controls pushed by `fillGap`
 * on the bow's side) back. Returns the mapped CENTRELINE, sampled — what a reader or a spec asks for.
 */
export function drawCurveArcOnPath(
  ctx: DrawContext, spine: Spine, arc: CurveArc, fillGap: number, outlineWidth: number,
): CurvePoint[] {
  const { p0, p1, direction } = arc
  const { c0, c1 } = curveControlPoints(arc)
  const bowed = fillGap * direction
  const far0 = { x: c0.x, y: c0.y + bowed }
  const far1 = { x: c1.x, y: c1.y + bowed }
  const map = (p: CurvePoint) => pointAt(spine, p.x, p.y)

  ctx.save()
  ctx.setLineWidth(outlineWidth)
  ctx.beginPath()
  const centre: CurvePoint[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const q = map(cubicAt(p0, c0, c1, p1, t))
    centre.push(q)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const q = map(cubicAt(p1, far1, far0, p0, t))
    ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  return centre
}

/** The page frame a rigid curve is drawn in: its chord's origin and unit axes. */
export interface CurveFrame {
  origin: CurvePoint
  /** Along the chord, unit. */
  u: CurvePoint
  /** Across it, unit — on the path's "down" side at the chord's middle. */
  v: CurveFrame['u']
  /** The chord's length, px. */
  length: number
}

/** The frame for `arc` on `spine`: its ends mapped to the page, the chord as x, the path's down at the middle as y. */
export function curveFrameOnPath(spine: Spine, arc: CurveArc): CurveFrame {
  const a = pointAt(spine, arc.p0.x, arc.p0.y)
  const b = pointAt(spine, arc.p1.x, arc.p1.y)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const u = { x: dx / length, y: dy / length }
  const { angle } = spine.at((arc.p0.x + arc.p1.x) / 2)
  const down = { x: -Math.sin(angle), y: Math.cos(angle) }
  let v = { x: -u.y, y: u.x }
  if (v.x * down.x + v.y * down.y < 0) v = { x: -v.x, y: -v.y }
  return { origin: a, u, v, length }
}

/**
 * ⭐ Draw `arc` as a RIGID page cubic — the lens `curveInk.drawCurveArcInk` paints, in the chord's frame:
 * the ends at (0, 0) and (L, 0), the page's own controls, the bow toward `v` signed by `direction`. Returns
 * the near edge's four page points, p0 · c0 · c1 · p1.
 */
export function drawCurveArcRigid(
  ctx: DrawContext, spine: Spine, arc: CurveArc, fillGap: number, outlineWidth: number,
): [CurvePoint, CurvePoint, CurvePoint, CurvePoint] {
  const frame = curveFrameOnPath(spine, arc)
  const local: CurveArc = { p0: { x: 0, y: 0 }, p1: { x: frame.length, y: 0 }, cps: arc.cps, direction: arc.direction }
  const { c0, c1 } = curveControlPoints(local)
  const bowed = fillGap * arc.direction
  const map = (p: CurvePoint): CurvePoint => ({
    x: frame.origin.x + p.x * frame.u.x + p.y * frame.v.x,
    y: frame.origin.y + p.x * frame.u.y + p.y * frame.v.y,
  })
  const P0 = map(local.p0), C0 = map(c0), C1 = map(c1), P1 = map(local.p1)
  const F1 = map({ x: c1.x, y: c1.y + bowed }), F0 = map({ x: c0.x, y: c0.y + bowed })
  ctx.save()
  ctx.setLineWidth(outlineWidth)
  ctx.beginPath()
  ctx.moveTo(P0.x, P0.y)
  ctx.bezierCurveTo(C0.x, C0.y, C1.x, C1.y, P1.x, P1.y)
  ctx.bezierCurveTo(F1.x, F1.y, F0.x, F0.y, P0.x, P0.y)
  ctx.stroke()
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  return [P0, C0, C1, P1]
}

