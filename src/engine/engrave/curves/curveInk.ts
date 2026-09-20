/**
 * ⭐⭐ **THE CURVE'S INK — U1** (`docs/plans/own-engraving-engine.md` §5, "the unlettered work").
 *
 * ## ⭐ What a slur or a tie IS, as ink
 *
 * > **Two cubic Béziers over the same two endpoints** — out along the near edge, back along one
 * > bowed out by a gap — stroked as an outline and then filled. The gap is the belly; the tips
 * > pinch to a point because both passes share the endpoints exactly.
 *
 * That is the whole content of this module, and like `beams/beamLines` it is deliberately thin:
 * everything interesting about a curve is *where its ends are*, *how far it arches* and *what it
 * dodges* — none of which is here. ⛔ **Taking the ink does NOT close the SHAPE question**: his call,
 * 2026-09-01, was the P4a/P4b split applied to the curve — *"for the curve we should do it too and
 * leave the experiment open and we can decide after our engine is ready"* — so `__slur`'s live
 * experiment (`CURVE_PX`, the arch solve, the clearance) keeps running untouched above this line.
 *
 * ## ⭐ Ported, attributed — ⛔ not invented
 *
 * VexFlow is MIT, and where we have no engraving opinion we PORT (the plan's §"two findings"). This
 * is `Curve.renderCurve` (`curve.js`), with two things folded out because every caller here already
 * passed them: `xShift`/`yShift` are always 0 (our endpoints are exact, and the LIFT is already in
 * them), and the `style.lineDash` branch never fired — nothing dashes a slur.
 *
 * ## ⭐⭐ Why the sampler moved here WITH the ink, and it is P3a's rule again
 *
 * {@link curveArcPoints} was extracted in `rendering/curveArc` on 2026-08-22 for exactly the right
 * reason — *"so a caller can ask where this curve would be without a second sampler that could drift
 * from this one"* — but it could only mirror VexFlow's control-point math from the outside, which
 * left the rule with **two owners**: theirs drew it and ours sampled it. {@link curveControlPoints}
 * is now the one owner, and the ink and the hit geometry cannot disagree because they call it.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/** A point in drawn (pixel) space. */
export interface CurvePoint {
  x: number
  y: number
}

/**
 * ⭐ **The two control-point deltas — the editable handle data**, in ARC space: `x` runs with the
 * curve, `y` is the bow, ⛔ always positive-outward (`direction` applies the sign).
 */
export type CurveControlDeltas = [CurvePoint, CurvePoint]

/**
 * ⭐ **The geometry of one arc**: its two endpoints, its shape and which way it bows.
 * `direction` is −1 (above) / +1 (below).
 */
export interface CurveArc {
  p0: CurvePoint
  p1: CurvePoint
  cps: CurveControlDeltas
  direction: number
}

/**
 * ⭐⭐ **THE ONE OWNER of where a curve's control points land** — `renderCurve`'s own math
 * (`curve.js`), with `xShift`/`yShift` 0 so the endpoints are exact.
 *
 * The x spacing is a fraction of the span (`(lastX − firstX) / (cps.length + 2)`), so a wider curve
 * carries its controls proportionally further in; each delta is added to that, and the bow is
 * signed by the direction.
 */
export function curveControlPoints(arc: CurveArc): { c0: CurvePoint; c1: CurvePoint } {
  const { p0, p1, cps, direction } = arc
  const spacing = (p1.x - p0.x) / (cps.length + 2)
  return {
    c0: { x: p0.x + spacing + cps[0].x, y: p0.y + cps[0].y * direction },
    c1: { x: p1.x - spacing + cps[1].x, y: p1.y + cps[1].y * direction },
  }
}

/**
 * ⭐ **DRAW ONE ARC.** Out along the near edge from `p0` to `p1`, back along an edge bowed out by
 * `fillGap`, stroked and then filled.
 *
 * ⚠️ **The order of the last three calls is the ink, not a formality**, and it is VexFlow's:
 * `stroke()` paints the OPEN outline (the two passes, tip to tip), `closePath()` then shuts the
 * figure, and `fill()` paints the body. Swap the close and the stroke and the outline gains a chord
 * across the tips; drop it and the fill's own subpath closes implicitly — the same picture, a
 * different `d`. ⭐ A context emits one `<path>` per paint, so a curve is TWO paths — a stroke-only
 * and a fill-only — which is why every recolour of one (the highlight, the blue ghost) has to
 * override fill AND stroke on each.
 *
 * ⛔ **Opens no group and sets no style.** The caller names the group (`tie-<id>`, `slur-<id>` — the
 * editor's highlight finds the ink by it) and owns the weight: the outline width is pinned around
 * this call, and `fillGap` is derived from the authored thickness by `rendering/curveArc`.
 *
 * @param fillGap how far the return pass bows out from the first — ⚠️ ⛔ NOT the drawn thickness:
 *   the ink at the belly measures `0.75 × gap + outline` (Verovio's coefficient, see
 *   `rendering/curveArc.curveFillGap`).
 */
export function drawCurveArcInk(ctx: DrawContext, arc: CurveArc, fillGap: number): void {
  const { p0, p1, direction } = arc
  const { c0, c1 } = curveControlPoints(arc)
  const bowed = fillGap * direction

  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.bezierCurveTo(c0.x, c0.y, c1.x, c1.y, p1.x, p1.y)
  ctx.bezierCurveTo(c1.x, c1.y + bowed, c0.x, c0.y + bowed, p0.x, p0.y)
  ctx.stroke()
  ctx.closePath()
  ctx.fill()
}

/** How many segments {@link curveArcPoints} samples the cubic into. */
const SAMPLE_STEPS = 16

/**
 * ⭐ **THE ARC AS NUMBERS, WITHOUT DRAWING IT** — the same cubic {@link drawCurveArcInk} paints,
 * sampled into the 17 points every reader downstream works from (arc-proximity hit-testing, the
 * ladder's obstacle, the slur's own bbox).
 *
 * ⭐ Extracted on 2026-08-22 so a caller could ask *"where would this curve be if the hand had not
 * moved it?"* — `SlurRenderer` files THAT arc as the ladder's obstacle, his rule being that an
 * offset is the user overruling the engraver and must not push anyone else's lane.
 */
export function curveArcPoints(
  arc: CurveArc,
): { points: CurvePoint[]; c0: CurvePoint; c1: CurvePoint } {
  const { p0, p1 } = arc
  const { c0, c1 } = curveControlPoints(arc)

  const points: CurvePoint[] = []
  for (let i = 0; i <= SAMPLE_STEPS; i++) {
    const t = i / SAMPLE_STEPS
    const mt = 1 - t
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t
    points.push({
      x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
      y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
    })
  }
  return { points, c0, c1 }
}
