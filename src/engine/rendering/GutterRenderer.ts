import { Renderer, Stave, StaveConnector, Barline } from 'vexflow'
import { GUTTER_WIDTH, type GutterState } from './layoutConfig'

/**
 * The gutter's ink. Sibelius tints its Panorama gutter blue, and the tint is doing real work: it
 * says *this clef is not engraved here, it is a reminder of what is in force*. Deliberately a
 * DARKER blue than voice 1's (#3B82F6) so a gutter clef can never be misread as voice-coloured
 * notation.
 */
const GUTTER_INK = '#1D4ED8'

/** Left inset of the gutter's staves (layout px) — see the StaveConnector note in `render`. */
const GUTTER_INSET = 10

/**
 * Bar number: font, size, and how far its baseline sits above the top staff's first line (px).
 * A plain text stack on purpose — NOT VexFlow's, which leads with Bravura: a music font has no
 * business setting the metrics of type (see utils/fontStack for the two bugs that came of it).
 */
const GUTTER_NUMBER_FONT = 'Arial, Helvetica, sans-serif'
const GUTTER_NUMBER_SIZE_PX = 11
const GUTTER_NUMBER_LIFT_PX = 8

/**
 * The frozen left gutter of linear view (docs/linear-view-plan.md §P3): the clef *in force at the
 * current scroll-x*, pinned to the left edge of the viewport. This is the piece that makes the
 * view usable at bar 400 — without it you scroll away from the clef and never see it again.
 *
 * It draws into its **own** SVG, not into the score's. That is the whole design:
 *
 *  - **Scrolling must not re-render the score.** Drawing the gutter into the score SVG at
 *    `scrollX` would mean a full VexFlow re-layout on every scroll event. Here, a scroll redraws
 *    a handful of glyphs in a separate element and the score SVG is never touched.
 *  - **It sits OUTSIDE the zoom layer**, which is a CSS `transform: scale(zoom)` on the score
 *    surface. Nothing scales it for us, so it applies the zoom scalar itself — hence `ctx.scale`
 *    below, and hence the y values arriving in *layout* (unzoomed) coordinates.
 *
 * No time signature: the meter is drawn by the music itself wherever it changes, and repeating it
 * here is noise. The gutter answers the one question the music can no longer answer once its clef
 * has scrolled away.
 *
 * Framework-agnostic: it takes a DOM element and VexFlow, exactly like VexFlowRenderer. No Vue.
 */
export class GutterRenderer {
  private renderer: Renderer | null = null

  constructor(private container: HTMLElement) {}

  /** Tear the gutter down (wrapped view has none). */
  clear(): void {
    this.container.innerHTML = ''
    this.renderer = null
  }

  /**
   * Draw the gutter. `state` carries layout-space geometry straight from the last score render;
   * the caller has already positioned this element at the score SVG's top-left, so the only
   * mapping left here is the zoom scalar.
   *
   * @param zoom          layout→screen scalar (the CSS transform on the score, applied by hand here)
   * @param heightLayout  the score SVG's own height in layout px — the gutter spans exactly the
   *                      score's "paper", so their white backgrounds coincide instead of the
   *                      gutter running the full window height past the end of the music.
   */
  render(state: GutterState, zoom: number, heightLayout: number): void {
    // Re-create per draw: VexFlow has no partial redraw, and this is a few glyphs. The whole
    // point of the separate SVG is that this cost is nowhere near a score re-layout.
    this.container.innerHTML = ''
    this.renderer = new Renderer(this.container as HTMLDivElement, Renderer.Backends.SVG)
    this.renderer.resize(GUTTER_WIDTH * zoom, heightLayout * zoom)

    const ctx = this.renderer.getContext()
    // Neutered save/restore — DELIBERATE here, and for a different reason than the one this used to
    // give ("they choke on Vue's reactive proxies", which was never the real constraint and is now
    // moot; the score's context has working save/restore again — see VexFlowRenderer.initialize).
    //
    // The gutter tints its whole context ONCE, below, instead of styling each glyph: this SVG is
    // ours alone and holds nothing else, so there is nothing to bleed onto. But VexFlow scopes its
    // own styles with save/restore, and a working `restore()` inside a glyph draw would put the
    // default black back and undo the tint mid-render. Keeping them inert is what makes "set it
    // once" hold. If this ever needs per-element styling, drop the stubs and tint per element.
    ctx.save = () => ctx
    ctx.restore = () => ctx
    // One scalar for everything below, so the gutter's glyphs match the score's at any zoom.
    ctx.scale(zoom, zoom)
    // Tint the whole context rather than styling each element: this SVG is ours alone, so the
    // "setStyle leaks into the shared draw context" trap does not apply — there is nothing else
    // in this context to bleed onto. Stroke paints the staff lines, fill paints the clef glyph.
    ctx.setStrokeStyle(GUTTER_INK)
    ctx.setFillStyle(GUTTER_INK)

    // A Stave's `y` is the top of its BOX, not its top line; the gap between them is VexFlow's
    // own padding, which we must not guess at. Probe it once, then place each stave so its top
    // LINE lands exactly on the score's — otherwise the gutter's lines sit a few px off the music.
    const probe = new Stave(0, 0, GUTTER_WIDTH)
    const lineOffset = probe.getYForLine(0)

    const staves: Stave[] = []
    for (const staff of state.staves) {
      // Inset by GUTTER_INSET, not 0: StaveConnector draws at the stave's own x, so a stave
      // flush against the SVG's left edge puts the system line half outside the viewBox, where
      // it is clipped to nothing. (The score never hits this — its staves start at the margin.)
      const stave = new Stave(GUTTER_INSET, staff.topLineY - lineOffset, GUTTER_WIDTH - GUTTER_INSET)
      stave.addClef(staff.clef)
      // No barlines: the gutter is a window onto the music, not a measure of its own.
      stave.setBegBarType(Barline.type.NONE)
      stave.setEndBarType(Barline.type.NONE)
      stave.setContext(ctx).draw()
      staves.push(stave)
    }

    // The system connector — the vertical line down the left edge joining the staves. It belongs
    // here for the same reason the clef does: once the system's opening has scrolled away, this
    // is the only thing still saying "these staves are one system". Mirrors the score's own
    // StaveConnector (VexFlowRenderer draws the same 'singleLeft' at each system's first measure).
    if (staves.length > 1) {
      new StaveConnector(staves[0], staves[staves.length - 1])
        .setType('singleLeft')
        .setContext(ctx)
        .draw()
    }

    // The bar number: the clef says WHAT you are reading, this says WHERE you are — the other
    // half of the question linear view makes hard to answer. Sits above the top staff, where an
    // engraved measure number goes.
    const top = state.staves[0]
    ctx.setFont(GUTTER_NUMBER_FONT, GUTTER_NUMBER_SIZE_PX)
    ctx.fillText(String(state.measureNumber), GUTTER_INSET, top.topLineY - GUTTER_NUMBER_LIFT_PX)
  }
}
