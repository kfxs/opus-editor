/**
 * The recolouring a selected element's `ink` / `highlight` row does to ENGRAVED nodes — always both
 * ways (attribute and inline `style`, which have different precedence against the stylesheet) and
 * always through the context's undo-logged writes, so the colour comes off with the layer.
 *
 * ⚠️ DOM `fill` / `stroke` on the mark's OWN group, ⛔ never a draw-context `setStyle` (it leaks into
 * the shared context and greys the rest of the score) and ⛔ never a document-wide scan (it bleeds
 * onto whatever sits inside a long mark's bounding rectangle).
 */
import type { HighlightContext } from './highlightContext'

export function paintFill(ctx: HighlightContext, els: Iterable<SVGElement>, color: string): void {
  for (const el of els) {
    ctx.setAttr(el, 'fill', color)
    ctx.setStyleProp(el, 'fill', color)
  }
}

export function paintStroke(ctx: HighlightContext, els: Iterable<SVGElement>, color: string): void {
  for (const el of els) {
    ctx.setAttr(el, 'stroke', color)
    ctx.setStyleProp(el, 'stroke', color)
  }
}

/**
 * A mark drawn as TEXT — a dynamic, a tempo mark: its group holds the glyph/text as `<text>` and/or
 * `<path>` children (level glyphs render as paths in the music font; custom text as `<text>`).
 * ⚠️ A `fill="none"` attribute is left alone — that node is an outline, and only its style is set.
 */
export function paintTextMark(ctx: HighlightContext, group: Element, color: string, cls: string): void {
  group.querySelectorAll<SVGElement>('text, path').forEach(el => {
    if (el.getAttribute('fill') !== 'none') ctx.setAttr(el, 'fill', color)
    ctx.setStyleProp(el, 'fill', color)
    ctx.addClass(el, cls)
  })
}
