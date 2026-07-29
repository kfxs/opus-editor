import type { SurfaceMetrics } from '@/engine/layout/surface'

/**
 * THE SHEETS — the page rectangles the music is engraved onto, drawn behind everything.
 *
 * A draw pass like {@link FanPass} / {@link GhostRenderer}: free functions over the SVG, owning one
 * family of ink and nothing else. What it owns is the **stacking** — how N pages become one tall
 * SVG — which is deliberately not in `pageCastOff`: that decides which page a system lands on and
 * where it sits *on that page*, and could as well be drawn side by side. Here is where "one above
 * the next, with a gutter between" is decided, so here is the only place `heightPx` is read.
 *
 * ⭐ **Draws nothing at all on a canvas.** `heightPx === null` IS "no page" (see `SurfaceMetrics`),
 * and the sketching surface has always been a bare white SVG — `app.css` paints it, and a pass that
 * drew "one page" over it would change the picture P0 proved unchanged.
 */

/** The gutter between two drawn sheets. Big enough to read as a gap, small enough not to waste
 *  scrolling: this is the same order as Sibelius/MuseScore's page separation. */
export const PAGE_GAP_PX = 24

/**
 * Paper white, the desk it lies on, and the sheet's edge.
 *
 * Literals here rather than in `utils/chromeColors.ts`, by that module's own scope rule: these are
 * used in exactly one place, and they are not chrome — the desk is *behind the music*, so it must
 * be free to be retuned against the engraving without dragging every window and menu with it. The
 * desk matches the app's existing "empty space" gray (`app.css`'s scrollbar track).
 */
const PAPER = '#ffffff'
const DESK = '#e2e8f0'
const SHEET_EDGE = '#cbd5e1'

/** The class on the underlay group — swept and redrawn every render, like the ties above it. */
export const PAGE_GROUP_CLASS = 'score-pages'
/** One drawn SHEET. Its own class so "how many pages are drawn, and where" is one query — the desk
 *  behind them is not a page, and counting rects would count it. */
export const PAGE_SHEET_CLASS = 'score-page-sheet'

/** How far down the SVG each page's own top edge sits. Pages stack with {@link PAGE_GAP_PX}. */
export function pageTopPx(surface: SurfaceMetrics, page: number): number {
  return surface.heightPx === null ? 0 : page * (surface.heightPx + PAGE_GAP_PX)
}

/**
 * The SVG's total height: stacked sheets when there is paper, otherwise the canvas's own strip
 * grown to the music (`contentHeightPx` = Σ system heights, which is what the canvas has always
 * been sized to).
 */
export function surfaceHeightPx(surface: SurfaceMetrics, pageCount: number, contentHeightPx: number): number {
  if (surface.heightPx === null) return contentHeightPx + surface.marginTopPx + surface.marginBottomPx
  return pageCount * surface.heightPx + (pageCount - 1) * PAGE_GAP_PX
}

/**
 * Draw the sheets, **first in the SVG** so every note lands on top of them.
 *
 * `insertBefore(svg.firstChild)` rather than `appendChild`, and that is not a detail: measure groups
 * are REUSED across renders (a bar whose shape is unchanged is never redrawn), so an appended
 * underlay would paint over every bar that survived the last render and leave the newly drawn ones
 * visible — a picture that changes with which bars happened to be dirty.
 */
export function drawPages(svg: SVGElement, surface: SurfaceMetrics, pageCount: number, svgWidthPx: number): void {
  for (const old of Array.from(svg.querySelectorAll(`.${PAGE_GROUP_CLASS}`))) old.remove()
  if (surface.heightPx === null) return

  const ns = 'http://www.w3.org/2000/svg'
  const group = document.createElementNS(ns, 'g')
  group.setAttribute('class', PAGE_GROUP_CLASS)
  // Chrome, not engraving: it must never answer a hit-test, and it is not part of the music that
  // an export outlines.
  group.setAttribute('pointer-events', 'none')

  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, cls?: string) => {
    const r = document.createElementNS(ns, 'rect')
    r.setAttribute('x', String(x))
    r.setAttribute('y', String(y))
    r.setAttribute('width', String(w))
    r.setAttribute('height', String(h))
    r.setAttribute('fill', fill)
    if (cls) r.setAttribute('class', cls)
    if (stroke) {
      r.setAttribute('stroke', stroke)
      r.setAttribute('stroke-width', '1')
    }
    group.appendChild(r)
  }

  // The desk first — the SVG's own background is white (`app.css`), so without this the gutters
  // between sheets would be the same white as the sheets and the pages would not read as pages.
  rect(0, 0, svgWidthPx, pageTopPx(surface, pageCount - 1) + surface.heightPx, DESK)
  for (let page = 0; page < pageCount; page++) {
    rect(0, pageTopPx(surface, page), surface.widthPx, surface.heightPx, PAPER, SHEET_EDGE, PAGE_SHEET_CLASS)
  }

  svg.insertBefore(group, svg.firstChild)
}
