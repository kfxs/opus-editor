import type { MusicEngine } from '../engine/MusicEngine'
import { GutterRenderer } from '../engine/rendering/GutterRenderer'
import { GUTTER_WIDTH } from '../engine/rendering/layoutConfig'
import type { ViewportModel } from '../engine/ViewportModel'

/**
 * Owns the linear-view frozen gutter (docs/linear-view-plan.md §P3): the clef and meter *in force
 * at the current scroll-x*, pinned to the left edge of the viewport, so the music stays readable
 * at bar 400 instead of scrolling away from its own clef forever.
 *
 * Framework-agnostic: no Vue/React/Angular. It takes a DOM element (like every renderer here does)
 * and the pure {@link ViewportModel}, and it owns the one piece of real logic in the feature —
 * **the mapping between the viewport's SCREEN space and the score's LAYOUT space**:
 *
 *   layoutX = scrollX / zoom − padX + GUTTER_WIDTH   (the first music you can actually SEE)
 *   screenY = (padY + layoutY) · zoom − scrollY      (where a staff lands on screen)
 *
 * The score gets that mapping for free from CSS (a scroll box and a `transform: scale`). The
 * gutter is pinned OUTSIDE both, on purpose — drawing it into the score's SVG at `scrollX` would
 * re-render the whole score on every scroll event — so it has to reproduce the mapping by hand.
 * That reproduction is the thing a framework port must not have to rewrite, which is why it lives
 * here and not in the composable.
 *
 * The host adapter's whole job is to call {@link refresh} when the view moves (scroll/zoom/resize)
 * or the score re-renders, and to hand over the element when it exists.
 */
export class GutterController {
  private renderer: GutterRenderer | null = null

  constructor(
    private getEngine: () => MusicEngine | null,
    /** The pinned gutter element — null whenever the host isn't showing one (wrapped view). */
    private getElement: () => HTMLElement | null,
    /** The score's content surface: its padding offsets the SVG inside the zoom layer, and the
     *  gutter, living outside that layer, must subtract the same offset to line up. */
    private getContentElement: () => HTMLElement | null,
    private viewport: ViewportModel,
  ) {}

  /** Drop the renderer — the element it drew into is gone (host left linear view). */
  detach(): void {
    this.renderer = null
  }

  /**
   * Repaint the gutter from the current scroll/zoom and the last render's geometry. Cheap by
   * construction: a pure read plus a handful of glyphs in a separate SVG — never a score render.
   */
  refresh(): void {
    const el = this.getElement()
    if (!el) {
      this.renderer = null
      return
    }
    if (!this.renderer) this.renderer = new GutterRenderer(el)

    const zoom = this.viewport.getZoom()
    const { x, y } = this.viewport.getScroll()
    const pad = this.contentPadding()
    const svgHeight = this.scoreSvgHeight()

    // Query the music at the gutter's RIGHT edge, not the viewport's left edge. The gutter is
    // opaque and covers the leftmost GUTTER_WIDTH of music, so the layout-x under the viewport's
    // left edge is music you cannot see — describing it means the bar number (and the clef) lag
    // by a gutter's width of scrolling: a barline slides under the gutter and stays hidden there
    // while the gutter still names the bar before it. The first VISIBLE music is the honest
    // answer to "where am I".
    const layoutX = x / zoom - pad.x + GUTTER_WIDTH
    const state = svgHeight > 0 ? this.getEngine()?.getGutterState(layoutX) ?? null : null
    if (!state) {
      this.renderer.clear() // wrapped view, or nothing rendered yet
      return
    }

    // Pin the element to the score SVG's OWN vertical bounds rather than the window's, so the
    // gutter's white "paper" coincides with the music's instead of running past the end of it
    // (top and bottom edges must line up — the two whites read as one sheet). This is also what
    // lets the renderer work in plain layout y: the element already carries the pad + scroll.
    el.style.top = `${pad.y * zoom - y}px`
    el.style.height = `${svgHeight * zoom}px`

    this.renderer.render(state, zoom, svgHeight)
  }

  /** The score SVG's own offset inside the zoom layer, in layout px (Tailwind `p-4` today). */
  private contentPadding(): { x: number; y: number } {
    const el = this.getContentElement()
    if (!el) return { x: 0, y: 0 }
    const cs = getComputedStyle(el)
    return { x: parseFloat(cs.paddingLeft) || 0, y: parseFloat(cs.paddingTop) || 0 }
  }

  /** The rendered score SVG's natural (layout-px) height — the height of the "paper". */
  private scoreSvgHeight(): number {
    const svg = this.getContentElement()?.querySelector('svg')
    return svg ? parseFloat(svg.getAttribute('height') || '0') : 0
  }
}
