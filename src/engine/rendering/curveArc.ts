import { Curve, StaveNote } from 'vexflow'
import type { RenderPass } from './RenderPass'
import { CURVE_PX } from './curveStyle'

/**
 * The stroke pinned around the curve so its fill taper reads as sharp tips — and, where the two
 * passes meet at each tip, it IS the ink (0.10 sp = Bravura's `slurEndpointThickness`).
 *
 * ⛔ Authored in STAFF SPACES next door (`./curveStyle`), with the belly swell every caller passes
 * as `thickness`. This file DRAWS; it does not decide how heavy a curve is.
 */
const CURVE_OUTLINE = CURVE_PX.outline

/**
 * ⭐ **Verovio's thickness coefficient** (`boundingbox.cpp:945`), and the reason the authored weight
 * finally means what it says: `renderCurve` bows the FILL out by a gap and then strokes the outline
 * around it, so the ink at the middle measures `0.75 × gap + outline`. Deriving the gap from the
 * nominal — rather than authoring the gap and adding the outline, which is what we did — makes
 * `CURVE.thickness` the number a book can be read against.
 */
export function curveFillGap(nominalThickness: number): number {
  return (nominalThickness - CURVE_OUTLINE) / 0.75
}

/**
 * Draw a curved arc (slur **or** tie) as a cubic Bézier via VexFlow's
 * `Curve.renderCurve`, driven by **our own** endpoint geometry (we never call
 * `Curve.draw()`, which would re-derive endpoints from stems and discard our
 * per-chord-head Ys / system-break geometry). Used for the same-line slur arc,
 * each cross-system slur half, and the same-line (flat) tie — the shared primitive
 * for both {@link TieRenderer} and {@link SlurRenderer}.
 *
 * `cps` are the two control-point deltas (the editable handle data); `direction`
 * is -1 (above) / +1 (below). ⚠️ `thickness` is the NOMINAL drawn midpoint (`CURVE.thickness`); the
 * fill gap it needs is derived here. `renderCurve`
 * strokes a forward pass at `cp.y` and a return pass at `cp.y + gap`, so the fill
 * bows out at center and pinches to a point at each endpoint (both slurs and ties
 * pass `CURVE_PX.thickness` — one weight). We pass
 * `xShift:0`/`yShift:0` so `p0`/`p1` (which already fold in the LIFT) are exact.
 * `renderCurve` strokes **and** fills, so each emitted `<path>` carries both — the
 * selection highlight must override both (see HighlightController).
 *
 * Returns the bbox plus sampled cubic points for arc-proximity hit-testing. The
 * sampling mirrors `renderCurve`'s internal control-point math (`curve.js`) so the
 * hit geometry matches the drawn path exactly.
 */
export function drawCurveArc(
  pass: Pick<RenderPass, 'context'>, // only the context is used — so a ghost can call this too
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  cps: [{ x: number; y: number }, { x: number; y: number }],
  direction: number,
  thickness: number,
  fromNote: StaveNote,
  toNote: StaveNote,
): { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[]; c0: { x: number; y: number }; c1: { x: number; y: number } } {
  const curve = new Curve(fromNote, toNote, {
    cps,
    // The nominal the caller asked for, turned into the gap `renderCurve` wants (see above).
    thickness: curveFillGap(thickness),
    xShift: 0,
    yShift: 0,
  })
  curve.setContext(pass.context)
  // renderCurve strokes the body with the context's *current* line width, so pin a thin slur
  // outline: the fill tapers on its own (it pinches to a point at each endpoint), and a thick
  // stroke blunts those tips and over-weights the whole curve.
  //
  // save/restore scopes it. That is worth a note, because for a long time it did NOT:
  // `VexFlowRenderer.initialize()` stubbed both to no-ops, so this had to capture and re-set
  // `stroke-width` by hand, and any code that "restored" a style was quietly doing nothing. The
  // stubs are gone — see the history in `initialize()` — so the idiom means what it says again.
  // It matters here because the ghost tie draws through this on every mouse move.
  pass.context.save()
  pass.context.setLineWidth(CURVE_OUTLINE)
  curve.renderCurve({ firstX: p0.x, firstY: p0.y, lastX: p1.x, lastY: p1.y, direction })
  pass.context.restore()

  const { points, c0, c1 } = curveArcPoints(p0, p1, cps, direction)

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return { bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, points, c0, c1 }
}

/**
 * ⭐ **THE ARC AS NUMBERS, WITHOUT DRAWING IT** — `renderCurve`'s own control-point math
 * (xShift/yShift = 0 → the endpoints are exact), sampled into the 17 points every reader downstream
 * works from. `controlPointSpacing = (lastX − firstX)/(n+2)`.
 *
 * ⭐ Extracted from {@link drawCurveArc} on 2026-08-22 so a caller can ask *"where would this curve be
 * if the hand had not moved it?"* without a second sampler that could drift from this one
 * (`SlurRenderer` files THAT arc as the ladder's obstacle — his rule: an offset is the user
 * overruling the engraver, so it must not push anyone else's lane).
 */
export function curveArcPoints(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  cps: [{ x: number; y: number }, { x: number; y: number }],
  direction: number,
): { points: { x: number; y: number }[]; c0: { x: number; y: number }; c1: { x: number; y: number } } {
  const spacing = (p1.x - p0.x) / (cps.length + 2)
  const c0 = { x: p0.x + spacing + cps[0].x, y: p0.y + cps[0].y * direction }
  const c1 = { x: p1.x - spacing + cps[1].x, y: p1.y + cps[1].y * direction }

  const points: { x: number; y: number }[] = []
  const STEPS = 16
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const mt = 1 - t
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t
    points.push({
      x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
      y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
    })
  }
  return { points, c0, c1 }
}

