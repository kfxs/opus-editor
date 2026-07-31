import { Renderer, Stave, Barline } from 'vexflow'
import { GUTTER_WIDTH, type GutterState } from './layoutConfig'
import { INDICATOR_INK } from '../../utils/selectionColors'
import { THIN_BARLINE_PX } from './barlineInk'

/**
 * The gutter's ink. Sibelius tints its Panorama gutter blue, and the tint is doing real work: it
 * says *this clef is not engraved here, it is a reminder of what is in force*. The shared non-voice
 * INDICATOR_INK (selectionColors) — deliberately a DARKER blue than voice 1's (#3B82F6) so a gutter
 * clef can never be misread as voice-coloured notation.
 */
const GUTTER_INK = INDICATOR_INK

/** Left inset of the gutter's staves (layout px) — see the system-connector note in `render`. */
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

    const staves: { stave: Stave; size: number }[] = []
    for (const staff of state.staves) {
      // ⭐ A SMALL staff is repeated small. Same mechanism as the score's, and for the same reason
      // it is a transform rather than a set of smaller numbers: the lines, the clef and the spacing
      // between them all have to shrink together (docs/staff-size-plan.md §4.1). So the stave is
      // built in the STAFF'S OWN space — every coordinate divided by `k` — inside a group carrying
      // `scale(k)`, and lands exactly where the full-size arithmetic put it when `k` is 1.
      const k = staff.size
      // Inset by GUTTER_INSET, not 0: the system connector draws at the stave's own x, so a stave
      // flush against the SVG's left edge puts the system line half outside the viewBox, where
      // it is clipped to nothing. (The score never hits this — its staves start at the margin.)
      const stave = new Stave(
        GUTTER_INSET / k,
        staff.topLineY / k - lineOffset,
        (GUTTER_WIDTH - GUTTER_INSET) / k,
      )
      stave.addClef(staff.clef)
      // No barlines: the gutter is a window onto the music, not a measure of its own.
      stave.setBegBarType(Barline.type.NONE)
      stave.setEndBarType(Barline.type.NONE)
      const group = ctx.openGroup('gutterstaff') as SVGGElement
      try {
        if (k !== 1) group.setAttribute('transform', `scale(${k})`)
        stave.setContext(ctx).draw()
      } finally {
        ctx.closeGroup()
      }
      staves.push({ stave, size: k })
    }

    // The system connector — the vertical line down the left edge joining the staves. It belongs
    // here for the same reason the clef does: once the system's opening has scrolled away, this
    // is the only thing still saying "these staves are one system".
    //
    // ⛔ Drawn by hand rather than with `StaveConnector`, exactly as the score draws its own
    // (`VexFlowRenderer.drawSystemConnector`): it runs from the top staff's first line to the
    // bottom staff's last, and those two may be drawn at DIFFERENT SIZES, so there is no single
    // scale to put it in — each end has to be composed through its own staff's. Nothing is lost:
    // VexFlow's `singleLeft` is a `fillRect`, not an engraved glyph.
    if (staves.length > 1) {
      const first = staves[0]
      const last = staves[staves.length - 1]
      const topY = first.stave.getYForLine(0) * first.size
      // `+ 1` for the bottom line's own thickness, in that staff's ink and so at its scale.
      const bottomY = (last.stave.getYForLine(last.stave.getNumLines() - 1) + 1) * last.size
      // Its width is deliberately NOT scaled: a system line belongs to the system, not to either
      // staff's ink — the same call the score makes.
      ctx.fillRect(GUTTER_INSET, topY, THIN_BARLINE_PX, bottomY - topY)
    }

    // The bar number: the clef says WHAT you are reading, this says WHERE you are — the other
    // half of the question linear view makes hard to answer. Sits above the top staff, where an
    // engraved measure number goes — and at that staff's size, since the score's own number is
    // drawn inside the bar's scaled group.
    const top = state.staves[0]
    ctx.setFont(GUTTER_NUMBER_FONT, GUTTER_NUMBER_SIZE_PX * top.size)
    ctx.fillText(
      String(state.measureNumber),
      GUTTER_INSET,
      top.topLineY - GUTTER_NUMBER_LIFT_PX * top.size,
    )
  }
}
