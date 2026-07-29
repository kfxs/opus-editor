import { Curve, StaveNote } from 'vexflow'
import type { RenderPass } from './RenderPass'

/** Stroke width pinned around the curve so its fill taper reads as sharp tips. */
const CURVE_OUTLINE = 1

/**
 * The belly swell shared by slurs AND ties — ONE number, because they are one weight.
 *
 * These used to be tuned apart: `SLUR_THICKNESS = 1.5` against `TIE_THICKNESS = 2.7`, the tie 1.8×
 * fatter, on the reasoning that "ties read heavier and hug the head". Engraving does not draw that
 * distinction — in Bravura's SMuFL `engravingDefaults`, `slurMidpointThickness` and
 * `tieMidpointThickness` are the same value, as are the two endpoint thicknesses. On screen the
 * mismatch showed as thin, undernourished slurs next to well-fed ties.
 *
 * What legitimately differs between them is the ARCH, not the weight: a tie is flat and hugs the
 * noteheads (`TIE_BOW`), a slur bows and grows taller with its span (`SLUR_BOW`…`SLUR_BOW_MAX`).
 * Those stay separate. This does not.
 *
 * The value is the tie's old one, which was the one that looked right.
 */
export const CURVE_THICKNESS = 2.7 // ≈0.27 staff-spaces; INK, so a small staff's own group scales
// it — ⛔ never multiply by the staff size here (docs/staff-size-plan.md §1).

/**
 * Draw a curved arc (slur **or** tie) as a cubic Bézier via VexFlow's
 * `Curve.renderCurve`, driven by **our own** endpoint geometry (we never call
 * `Curve.draw()`, which would re-derive endpoints from stems and discard our
 * per-chord-head Ys / system-break geometry). Used for the same-line slur arc,
 * each cross-system slur half, and the same-line (flat) tie — the shared primitive
 * for both {@link TieRenderer} and {@link SlurRenderer}.
 *
 * `cps` are the two control-point deltas (the editable handle data); `direction`
 * is -1 (above) / +1 (below). `thickness` is the belly swell — `renderCurve`
 * strokes a forward pass at `cp.y` and a return pass at `cp.y + thickness`, so the
 * fill bows out by `thickness` at center and pinches to a point at each endpoint
 * (both slurs and ties pass {@link CURVE_THICKNESS} — one weight). We pass
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
    thickness,
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

  // Mirror renderCurve's control-point math (xShift/yShift = 0 → endpoints are exact)
  // to reconstruct the cubic for hit-testing. controlPointSpacing = (lastX-firstX)/(n+2).
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

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  return { bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, points, c0, c1 }
}
