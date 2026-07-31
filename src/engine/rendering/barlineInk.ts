import { STAFF_SPACE_PX } from '../models/staffSize'

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
export const THIN_BARLINE_SPACES = 0.16

/** The thin barline in px at staff size 1. A bar's `<g>` carries the staff's scale, so a rect
 *  written in this unit inside that group is already proportional to its staff. */
export const THIN_BARLINE_PX = THIN_BARLINE_SPACES * STAFF_SPACE_PX

/** What VexFlow drew, and so what marks a rect as one we have not re-inked yet. */
const VEXFLOW_THIN_PX = 1

/**
 * Re-ink every thin barline VexFlow drew inside `group` (one measure on one staff).
 *
 * **Width only — `x` is left exactly where it was.** The extra ink goes on the right, because in
 * this renderer `x` IS the bar boundary: the spacing model measures the lead-in from it, the
 * registry's `noteEndX` hit-box is placed at it, the selection highlight paints from it, and
 * `barWidth.e2e` asserts a drawn barline sits at the stave's own `x2`. Centring the line on the
 * boundary would be the engraver's reading of "where the line is", and it would put every one of
 * those 0.3 px out of agreement with the ink for no visible gain.
 *
 * ⚠️ The thick line of a final/repeat bar is deliberately left alone. It is 3 px where the
 * convention is 0.5 spaces (5 px), but widening it is a LAYOUT change, not an ink one: the thin and
 * thick lines are placed 2 px apart by `drawVerticalEndBar`, inside a reserved box VexFlow's own
 * `layoutMetricsMap` sizes (`xMin: -5`), so a 5 px thick line would swallow the gap and spill past
 * the room the stave set aside for it. It is also 3 px, which is not a mark that disappears.
 *
 * Idempotent: a re-inked rect is 1.6 wide and so no longer matches, which matters because a bar
 * whose shape has not changed is REUSED between renders rather than redrawn (the `MOVED` path) —
 * this pass sees the same rects again and must not shift them a second time.
 */
export function inkBarlines(group: Element): void {
  for (const rect of group.querySelectorAll('g.vf-stavebarline rect')) {
    if (parseFloat(rect.getAttribute('width') ?? '') !== VEXFLOW_THIN_PX) continue
    rect.setAttribute('width', String(THIN_BARLINE_PX))
  }
}

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
    let base = rect.dataset[BASE_X]
    if (base === undefined) {
      // First sight of this rect: only a thin barline is hinted (a thick final bar is 3px and is
      // left exactly as VexFlow drew it), and its asked-for x is remembered from here on.
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
