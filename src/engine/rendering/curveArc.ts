import type { CurveArc, CurvePoint } from '@/engine/engrave/curves/curveInk'
import { curveArcPoints, drawCurveArcInk } from '@/engine/engrave/curves/curveInk'
import type { RenderPass } from './RenderPass'
import { CURVE_PX } from './curveStyle'

/**
 * The stroke pinned around the curve so its fill taper reads as sharp tips — and, where the two
 * passes meet at each tip, it IS the ink (0.10 sp = Bravura's `slurEndpointThickness`).
 *
 * ⛔ Authored in STAFF SPACES next door (`./curveStyle`), with the belly swell every caller passes
 * as `thickness`. This file APPLIES a weight; it does not choose one.
 */
const CURVE_OUTLINE = CURVE_PX.outline

/**
 * ⭐ **Verovio's thickness coefficient** (`boundingbox.cpp:945`), and the reason the authored weight
 * finally means what it says: the arc bows its FILL out by a gap and strokes the outline around it
 * (`engrave/curves/curveInk`), so the ink at the middle measures `0.75 × gap + outline`. Deriving the gap from the
 * nominal — rather than authoring the gap and adding the outline, which is what we did — makes
 * `CURVE.thickness` the number a book can be read against.
 */
export function curveFillGap(nominalThickness: number): number {
  return (nominalThickness - CURVE_OUTLINE) / 0.75
}

/**
 * Draw a curved arc (slur **or** tie), driven by **our own** endpoint geometry — the same-line slur
 * arc, each cross-system slur half, and the same-line (flat) tie. The shared entry point for
 * {@link TieRenderer} and {@link SlurRenderer}; ⭐ **the ink itself is
 * `engrave/curves/curveInk`** (U1, 2026-09-14).
 *
 * ⚠️ **This file decides the WEIGHT, `curveInk` draws the shape.** `thickness` is the NOMINAL drawn
 * midpoint (`CURVE_PX.thickness`), turned into the fill gap the two passes need by
 * {@link curveFillGap}; the outline is pinned around the call because the fill tapers on its own
 * (it pinches to a point at each endpoint) and a thick stroke would blunt those tips and
 * over-weight the whole curve. `save`/`restore` scopes it — worth a note, because for a long time
 * it did NOT: `ScoreRenderer.initialize()` stubbed both to no-ops, so this had to capture and
 * re-set `stroke-width` by hand, and any code that "restored" a style was quietly doing nothing.
 * The stubs are gone — see the history in `initialize()` — so the idiom means what it says again.
 * It matters here because the ghost tie draws through this on every mouse move.
 *
 * ⭐ **`fromNote`/`toNote` are GONE** (U1): they existed only to satisfy `new Curve(from, to, …)`,
 * whose `renderCurve` never read them — the ghost tie built a throwaway `StaveNote` purely to have
 * one to hand over. The arc has always been drawn from its own endpoints.
 *
 * Returns the bbox plus sampled cubic points for arc-proximity hit-testing — ⭐ off the SAME control
 * points the ink is drawn from, so the hit geometry cannot drift from the drawn path.
 */
export function drawCurveArc(
  // ⭐ Our own surface (U1) — so a ghost, the recorder and the page all take the same call.
  pass: Pick<RenderPass, 'context'>,
  p0: CurvePoint,
  p1: CurvePoint,
  cps: CurveArc['cps'],
  direction: number,
  thickness: number,
): { bbox: { x: number; y: number; width: number; height: number }; points: CurvePoint[]; c0: CurvePoint; c1: CurvePoint } {
  const arc: CurveArc = { p0, p1, cps, direction }
  pass.context.save()
  pass.context.setLineWidth(CURVE_OUTLINE)
  // The nominal the caller asked for, turned into the gap the two passes want (see above).
  drawCurveArcInk(pass.context, arc, curveFillGap(thickness))
  pass.context.restore()

  const { points, c0, c1 } = curveArcPoints(arc)

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return { bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, points, c0, c1 }
}

