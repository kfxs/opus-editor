import type { MusicEngine } from '../engine/MusicEngine'
import { GutterRenderer } from '../engine/rendering/GutterRenderer'
import { GUTTER_WIDTH, GUTTER_METER_AIR } from '../engine/rendering/layoutConfig'
import type { PinnedGutter, ViewportModel } from '../engine/ViewportModel'

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
    /** Declare the pinned strip to the viewport HOST (not the model): the limit it implies can move
     *  the scroll, and only the host can put the element where the model then says it is. */
    private setPin: (gutter: PinnedGutter | null) => void,
  ) {}

  /** Drop the renderer — the element it drew into is gone (host left linear view). */
  detach(): void {
    this.renderer = null
    this.setPin(null) // nothing pinned over the viewport any more, so nothing limits the pan
  }

  /**
   * Repaint the gutter from the current scroll/zoom and the last render's geometry. Cheap by
   * construction: a pure read plus a handful of glyphs in a separate SVG — never a score render.
   */
  refresh(): void {
    const el = this.getElement()
    if (!el) {
      this.renderer = null
      this.setPin(null)
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
    // Minus the pasteboard (src/engine/pasteboard.ts): scroll is measured from the scroll surface,
    // and the music starts one margin into it. Without this the gutter names the bar a margin's
    // worth of music ahead of the one actually under it.
    const margin = this.viewport.getPasteboard()
    const layoutX = x / zoom - margin.x - pad.x + GUTTER_WIDTH
    const state = svgHeight > 0 ? this.getEngine()?.getGutterState(layoutX) ?? null : null
    if (!state) {
      this.renderer.clear() // wrapped view, or nothing rendered yet
      this.setPin(null)
      return
    }
    this.setPin({ width: GUTTER_WIDTH, inset: pad.x, overhang: overhangFor(state.openingMeterX) })

    // Pin the element to the score SVG's OWN vertical bounds rather than the window's, so the
    // gutter's white "paper" coincides with the music's instead of running past the end of it
    // (top and bottom edges must line up — the two whites read as one sheet). This is also what
    // lets the renderer work in plain layout y: the element already carries the pad + scroll.
    // Same displacement on the vertical: the paper's top is a margin down the surface.
    el.style.top = `${(margin.y + pad.y) * zoom - y}px`
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

/**
 * ⭐ **How far left linear view may be panned, stated against the MUSIC.**
 *
 * The gutter is opaque and pinned to the viewport's leading edge, so at the far-left end of the pan
 * something is under it: either paper, or — if the pan ran on — nothing, which is the failure this
 * exists to stop (a staff floating in the pasteboard, naming a bar it is nowhere near).
 *
 * The answer is not a distance from the paper's edge but a distance from the score's own OPENING
 * METER: the gutter already shows the clef, so the engraved clef may go under it at no cost, while
 * the meter — the first thing the header draws that the gutter does not repeat — must stay in the
 * clear, with {@link GUTTER_METER_AIR} of air. Everything else follows: a wider clef, a key
 * signature one day, a different sketch margin all move the meter, and the limit moves with it.
 *
 * Clamped to `[0, GUTTER_WIDTH]`. A header so wide that the meter would still be covered gives 0 —
 * flush against the paper, which at least keeps the gutter on the music; the far end would let it
 * drift off the paper entirely, which is the bug.
 */
export function overhangFor(openingMeterX: number | null): number {
  if (openingMeterX === null) return 0 // no meter to protect: sit flush against the paper
  return Math.max(0, Math.min(GUTTER_WIDTH, GUTTER_WIDTH + GUTTER_METER_AIR - openingMeterX))
}
