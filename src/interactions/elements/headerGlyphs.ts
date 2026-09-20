import { ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_STROKE } from '@/utils/selectionColors'
import type { HighlightContext } from './highlightContext'

/**
 * Recolor every glyph (`<path>`/`<text>`) whose center sits inside `bbox`, skipping
 * wide elements (the staff lines that also intersect the region). Shared by the clef
 * and time-signature selection highlights, which scan for the narrow glyph column near
 * a measure's left edge.
 *
 * `root` scopes the scan: the callers pass the selected measure's own `<g>` so the
 * recolor cannot reach a neighbouring system's clef/TS (which lives in a different
 * group), falling back to the whole SVG only if the group can't be resolved.
 */
export function paintGlyphsInBBox(
  ctx: HighlightContext,
  root: ParentNode,
  bbox: { x: number; y: number; width: number; height: number },
  className: string,
): void {
  const SELECTION_COLOR = ELEMENT_SELECTION_FILL
  const SELECTION_STROKE = ELEMENT_SELECTION_STROKE
  const elements = root.querySelectorAll('path, text')
  for (const el of elements) {
    const elBBox = (el as SVGGraphicsElement).getBBox?.()
    if (!elBBox) continue
    if (elBBox.width > 40) continue // skip staff lines / wide elements

    // 🚨🚨 **THROUGH THE CTM, because a SMALL staff draws inside `scale(k)`** — his report,
    //    2026-08-28: *"on small staff the time signature is not highlited."* `getBBox()` answers in
    //    the element's OWN user space, which for a 0.7 staff is 1/0.7 of the page, while the
    //    registry's box is SVG space (the registry scales its records out — `ElementRegistry.
    //    withScale`). Comparing the two directly is `docs/staff-size-plan.md`'s named bug class:
    //    "visual coords in a scaled scope".
    //
    // ⚠️ It went unseen because it was HIDDEN BY A LOOSE BOX: the meter's hit box used to be a
    //    30 px region and overlapped the mis-mapped centre anyway. The moment that box became the
    //    digits' own ink (17 px, 2026-08-28) the mismatch had nowhere to hide — a tighter box makes
    //    a wrong coordinate visible, which is worth remembering as a pair.
    //
    // ⭐ `getCTM()` is the element→viewport matrix, so this is the e2e suite's own rule (⛔ never
    //    compare an untransformed `getBBox()` across a scaled group) applied in app code. jsdom
    //    answers null and cannot measure glyphs at all, so the fallback is the raw box.
    const ctm = (el as SVGGraphicsElement).getCTM?.()
    const rawX = elBBox.x + elBBox.width / 2
    const rawY = elBBox.y + elBBox.height / 2
    const cx = ctm ? ctm.a * rawX + ctm.c * rawY + ctm.e : rawX
    const cy = ctm ? ctm.b * rawX + ctm.d * rawY + ctm.f : rawY
    if (cx >= bbox.x && cx <= bbox.x + bbox.width && cy >= bbox.y && cy <= bbox.y + bbox.height) {
      const svgEl = el as SVGElement
      const currentFill = svgEl.getAttribute('fill')
      if (currentFill && currentFill !== 'none') ctx.setAttr(svgEl, 'fill', SELECTION_COLOR)
      ctx.setStyleProp(svgEl, 'fill', SELECTION_COLOR)
      // Only recolor the stroke if the glyph already had one. TS digits and clef
      // glyphs are fill-only paths; adding a stroke draws a darker outline that
      // makes them look bold/doubled (the fill and outline don't coincide).
      const currentStroke = svgEl.getAttribute('stroke')
      if (currentStroke && currentStroke !== 'none') ctx.setAttr(svgEl, 'stroke', SELECTION_STROKE)
      ctx.addClass(svgEl, className)
    }
  }
}
