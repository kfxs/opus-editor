import type { Stave } from 'vexflow'
import { STAFF_SPACE_PX } from '../models/staffSize'
import { THIN_LINE_SPACES } from './thinLineWeight'
import { STAVE_LINE_WIDTH_PX } from '@/engine/engrave/staff/staffLines'
import { barlineExtent, type BarlineExtent } from '@/engine/engrave/staff/barlineExtent'

/**
 * **How thick a barline is inked** — the one engraving rule VexFlow gives no seam for.
 *
 * `Barline.drawVerticalBar` is `fillRect(x, topY, 1, height)` with the `1` written as a literal
 * (`vexflow/src/stavebarline.js`), and the `this.thickness = Tables.STAVE_LINE_THICKNESS` its
 * constructor sets is never read by the drawing path. So a barline comes out **1 px**: the same
 * weight as a staff line and thinner than a stem (`Tables.STEM_WIDTH` 1.5).
 *
 * That inverts the order engraving puts them in. A barline is the *heaviest* of the three
 * structural lines — SMuFL's `engravingDefaults` (Bravura) gives thin barline 0.16 staff spaces,
 * staff line 0.13, stem 0.12 — because it is the mark that divides the music, and a divider that
 * reads lighter than the stems inside it stops dividing anything.
 *
 * ⭐ It also decides whether a barline SURVIVES being resampled. Every mark on the page is
 * eventually resolved onto a device-pixel grid, and the score is drawn at a fractional zoom far
 * more often than not (the editor OPENS at `DEFAULT_ZOOM` 0.7, where a 1 px barline is 0.7 device
 * pixels — it cannot be a solid line at the view the app starts in). A staff line escapes this
 * because VexFlow snaps it by half a pixel; a stem escapes it by being 1.5 wide. A barline had
 * neither, which is exactly why it is the first thing to vanish while Firefox re-rasterises a zoom
 * (docs/firefox-zoom-repaint.md).
 *
 * ⛔ Not fixed by snapping x to the pixel grid. That is `shape-rendering: crispEdges` in miniature,
 * already tried and reverted: it ruins the staff-line spacing, and it would move the barline off
 * the bar boundary the spacing model puts it on.
 */
export const THIN_BARLINE_SPACES = THIN_LINE_SPACES

/** The thin barline in px at staff size 1. A bar's `<g>` carries the staff's scale, so a rect
 *  written in this unit inside that group is already proportional to its staff. */
export const THIN_BARLINE_PX = THIN_BARLINE_SPACES * STAFF_SPACE_PX

/**
 * ⭐⭐ **HOW FAR ONE STAVE'S BARLINES REACH** — the rule of `engrave/staff/barlineExtent`, asked of a
 * `Stave`. Every vertical line drawn on this staff stops here: the bar-ending signs
 * (`BarlineRenderer`), the line that opens a system (`EngravedBarline`), the systemic connector
 * (`systemStart`) and the piece crossing the gap to the next staff (`barlineGap`).
 *
 * ⚠️ **In the STAVE's own coordinates**, thickness included — a caller working in SVG space scales
 * the result, exactly as it already scales the ys it used to read.
 *
 * 🚨 **This replaces `stave.getTopLineTopY()` / `getBottomLineBottomY()` for barlines, and the second
 * of those is why the rule needed an owner.** `getBottomLineBottomY()` is the last line's y plus
 * `getStyle().lineWidth ?? 1` — a hard **1**, VexFlow's own staff-line thickness, which stopped being
 * ours when P5c made a staff line 0.11 sp = **1.1 px**. Two files had hand-written that `1`.
 */
export function staveBarlineExtent(stave: Stave): BarlineExtent {
  return barlineExtent(
    stave.getYForLine(0),
    stave.getYForLine(stave.getNumLines() - 1),
    STAVE_LINE_WIDTH_PX,
  )
}

/* ⚠️ A note about what is NOT here, ⛔ not a doc comment on the constant below.
 *
 * ⭐⭐ **THE REPAIR THAT USED TO LIVE HERE IS GONE (P5b, 2026-09-13) — every barline on the page is
 * now DRAWN at this width rather than widened afterwards.**
 *
 * `inkBarlines(group)` walked each measure's `<g>` and rewrote the `width` of any 1 px rect inside a
 * `g.vf-stavebarline` — which was VexFlow's opening barline and, by then, nothing else: this repo's
 * own signs (`BarlineRenderer`, `barlineGap`, `systemStart`, `GutterRenderer`) have all drawn at
 * {@link THIN_BARLINE_PX} from the start. ⇒ when P5b took that last line's ink
 * (`engine/engrave/staff/openingBarline`, through `rendering/EngravedBarline`), the pass had no
 * target left and was deleted rather than kept as a no-op.
 *
 * ⭐ **Its rationale did not die with it** — *"`x` IS the bar boundary, so the extra ink goes on the
 * RIGHT"* is now stated in the ink module, where the drawing is. ⚠️ **And so did its exclusion**: the
 * pass deliberately never touched the THICK line of a final or repeat bar (3 px where the convention
 * is 0.5 spaces), because widening that is a LAYOUT change inside a box VexFlow's `layoutMetricsMap`
 * sized — a question `layout/barlineSign` now owns outright.
 */

/** Where a barline was asked to be, before hinting moved its ink. Latched on the first hint, and
 *  every later hint is computed from it — so re-hinting can never drift. (`data-baseline-x`.) */
const BASE_X = 'baselineX'

/** The scale the score's barlines were last hinted at, stamped on the `<svg>` (`data-hinted-at`).
 *  The pass's own gate — see {@link hintBarlines}. */
const HINTED_AT = 'hintedAt'

/**
 * ⭐ **HINTING** — put every barline's ink on whole device pixels, so they all look the same.
 *
 * The unevenness this fixes is not about how much ink a barline has; it is about WHERE that ink
 * falls. Bar-to-bar spacing is a musical distance, so on screen it is almost never a whole number
 * of pixels: at 70% zoom our bars are ~71.1 device pixels apart, and each successive barline
 * therefore lands at a different position *within* a pixel. Measured on real screenshot pixels, one
 * row through a staff space, three barlines of identical ink:
 *
 *   [  0 100  26   0]   phase .02 — one solid column: thin and crisp
 *   [  0  52  61   0]   phase .48 — two half-covered columns: fat and pale
 *   [  0  13 100   0]   phase .87 — crisp again
 *
 * Same line, three different-looking lines. Staff lines escape it by accident — their spacing is
 * exactly 7.0 device pixels at this zoom, so all five share one phase and agree with each other.
 *
 * So we do what an engraving program does with a hairline: round the line onto the pixel grid and
 * give it a whole number of pixels of width. Every barline then renders identically — one or more
 * fully-covered columns, no partial coverage anywhere — at any zoom and in any browser.
 *
 * ⛔ **Not `shape-rendering: crispEdges`**, which asks the renderer to do this and is already
 * recorded as tried-and-reverted. Measured here: at 25% zoom it erases **9 of 12 barlines** — it
 * rounds a 0.4-pixel line down to nothing. The floor of one whole pixel below is exactly the part
 * it gets wrong.
 *
 * ⚠️ The ink moves by up to half a pixel; the barline's *position* does not. `x` stays the number
 * the spacing model, the hit-box and the selection highlight all read.
 */
export function hintBarlines(
  /** The rendered score's `<svg>`. */
  svg: SVGElement,
  {
    dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    force = false,
  }: {
    /** Device pixels per CSS pixel. The screen's, and the one input not in the document. */
    dpr?: number
    /** Hint even if the scale has not changed — what a fresh render needs, because its rebuilt
     *  bars carry brand-new, unhinted rects while the stamp from the last render still stands. */
    force?: boolean
  } = {},
): void {
  // ⭐ **The pass verifies its own premise instead of being told when to run.** Hinting depends on
  // the scale the score is DRAWN at, and that is not the same thing as the zoom the model holds: on
  // the very first render the SVG exists before the zoom transform has been written to the layer
  // above it, so a hint taken then is a hint for 1:1 and every barline lands wrong the moment the
  // transform arrives. That was visible as "it looks wrong until I zoom, then it fixes itself" —
  // zooming was the first event that happened to re-run this with the real scale.
  //
  // So the gate is the MEASURED scale, recorded on the svg: called again at the same scale this
  // costs one matrix read and returns; called at a new one it re-hints. The caller is then free to
  // fire it at every view change without knowing anything about ordering.
  const scale = (svg as SVGGraphicsElement).getScreenCTM?.()?.a
  if (!scale || !Number.isFinite(scale)) return
  const k0 = scale * dpr
  if (!force && svg.dataset[HINTED_AT] === String(k0)) return
  svg.dataset[HINTED_AT] = String(k0)

  const rects = [...svg.querySelectorAll<SVGRectElement>('g.vf-stavebarline rect')]

  // ⚠️ READ EVERYTHING FIRST. `getScreenCTM` is a layout read and the writes below invalidate
  // layout, so interleaving them would force one reflow PER BARLINE.
  const plans: { rect: SVGRectElement; x: number; width: number }[] = []
  for (const rect of rects) {
    // ⭐⭐ **A COMPOSITE SIGN OPTS OUT — hinted as a whole or not at all.** A final bar and the two
    // repeats are drawn by `./BarlineRenderer`, which marks their group `data-no-hint`. Aligning one
    // stroke of a two-stroke sign is worse than aligning neither: the thin line would move by up to
    // half a device pixel while the thick one stayed, so the 0.32-space white gap that IS the final
    // barline would come out a different width in every bar carrying one. Their strokes are 0.5
    // spaces of ink and do not vanish for want of alignment, which is the whole reason this pass
    // exists for the 0.16-space line.
    if ((rect.parentElement as HTMLElement | null)?.dataset?.noHint) continue
    let base = rect.dataset[BASE_X]
    if (base === undefined) {
      // First sight of this rect: only a thin barline is hinted — the system connector and the
      // plain single lines — and its asked-for x is remembered from here on. (The composite signs
      // are already gone, above. ⭐ Since P5b every line reaching this test is DRAWN at
      // `THIN_BARLINE_PX`, the opening one included — it used to arrive as VexFlow's 1 px rect and
      // depend on `inkBarlines` having run first.)
      if (parseFloat(rect.getAttribute('width') ?? '') !== THIN_BARLINE_PX) continue
      base = rect.getAttribute('x') ?? '0'
      rect.dataset[BASE_X] = base
    }
    const ctm = rect.getScreenCTM()
    if (!ctm) continue
    // Device pixels per unit of this rect's own space — the measure group's staff scale and the
    // editor's zoom are both already in the CTM, which is why this needs no zoom parameter.
    const k = ctm.a * dpr
    if (!(k > 0) || !Number.isFinite(k)) continue

    const asked = parseFloat(base)
    const leftDev = (ctm.a * asked + ctm.e) * dpr
    // At least one whole device pixel: a barline may be too thin to see, but it may never be too
    // thin to EXIST. Below ~62% zoom the conventional 0.16 spaces rounds to nothing.
    const widthDev = Math.max(1, Math.round(THIN_BARLINE_PX * k))
    plans.push({
      rect,
      x: asked + (Math.round(leftDev) - leftDev) / k,
      width: widthDev / k,
    })
  }

  for (const p of plans) {
    p.rect.setAttribute('x', String(p.x))
    p.rect.setAttribute('width', String(p.width))
  }
}
