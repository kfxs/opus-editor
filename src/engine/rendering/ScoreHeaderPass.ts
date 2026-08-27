import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SCORE_TEXT_FIELDS, scoreText, type ScoreTextField } from '@/engine/models/scoreTextOps'
import type { SurfaceMetrics } from '@/engine/layout/surface'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import type { ViewMode } from './layoutConfig'
import { pageOriginPx } from './PagePass'

/**
 * 🚧 **A SKETCH — the score's TITLE and COMPOSER, drawn once at the head of the FIRST page.** 🚧
 *
 * ⛔ **This is not the score-text feature and must not be built on.** It exists so a wrapped page
 * stops looking headless, and every decision in it is deliberately the cheapest one that draws
 * something recognisable. What the real thing owes, and this owes nothing towards:
 *
 *  - **A title is not a `string` on `Score`.** The finished thing is a FRAME of *text items* —
 *    title, subtitle, composer, lyricist, arranger, copyright, a per-page header/footer — each with
 *    a placement, a style and an offset, of the same species as every other engraved mark (its own
 *    selection kind, its own row in `ELEMENT_SPECS`, its own overrides). MuseScore models it exactly
 *    that way: a `VBox` holding `Text` elements.
 *  - **It is not laid out here.** This measures nothing before drawing: it anchors one line per
 *    field and trusts it to fit. Real text has to WRAP, and wrapping needs the font measured — which
 *    is browser-only work (`reference_jsdom_cannot_measure_glyphs`), so the real one is a measured
 *    pass, not arithmetic. A title longer than the page runs off it.
 *  - **Its room is not a frame.** {@link sketchHeaderRoomPx} is two constants of blank paper taken
 *    off the top of page 1's content — the frame, plus the air a composer line needs under it. The
 *    real frame's height follows the text it holds, line by line.
 *
 * ⭐ What it does keep honest, because getting these wrong would cost more than the sketch is worth:
 *
 *  - **It TAKES ITS ROOM before the cast-off**, rather than drawing over the first system. The room
 *    goes into `pageCastOff` so page 1 genuinely holds fewer systems — a header that overlapped the
 *    music would be worse than no header.
 *  - **It prints.** Unlike `./PagePass`'s desk and sheets, this is ENGRAVING, not an editing
 *    affordance, so there is no `RenderAudience` gate — the PDF gets it too.
 *  - **The sizes and alignments are sourced, not guessed.** See {@link SCORE_TEXT_SPECS}.
 *  - **The two fields are a TABLE, never two copies.** One row each, and everything downstream —
 *    the selection kind, the delete, the dialog, the menu — carries a {@link ScoreTextField} for the
 *    same reason (`engine/models/scoreTextOps`).
 *
 * ⚠️ **WRAPPED VIEW, AND ONLY ON PAPER** — his ask, and also the only place it means anything: this
 * heads a PAGE. Linear view is one endless system, and the sketching CANVAS is an endless strip with
 * no page to head either (`SurfaceMetrics.heightPx === null` IS "not paper" — see `layout/surface`).
 * ⭐ The canvas half is what keeps this scaffolding out of every fixture's geometry: the renderer's
 * own default surface is the canvas, so a header there would push the music down 10 staff spaces in
 * code that has nothing to do with pages. The rule lives in {@link sketchHeaderRoomPx} so every
 * caller here asks it once.
 */

/**
 * ⭐⭐ **THE TABLE** — one row per field, and the whole of what the two drawn lines differ by.
 *
 * Sizes are stated in STAFF SPACES (⛔ never px — `reference_engraving_text_sizes`), where
 * MuseScore's 10 pt against its 1.75 mm spatium is **2.02 spaces**, so its figures scale by ×0.202.
 *
 * **The TITLE is MuseScore's**: `titleFontSize` 22 pt, `titleAlign` HCENTER/TOP (`styledef.cpp`)
 * → 4.44 sp, centred, at the top of the frame.
 *
 * 🚨 **The COMPOSER is NOT, and his eye is why** (2026-08-27: *"the composer font size is not big
 * enough"*). MuseScore states it at `composerFontSize` 10 pt = 2.02 sp, and that is what this drew
 * first. ⭐ The two references disagree, and the disagreement is in the RATIO rather than in either
 * number: LilyPond's `bookTitleMarkup` (`ly/titling-init.ly`) sets the title `\huge \larger
 * \larger \bold` — font-size **+4**, and `magstep s = 2^(s/6)`, so ×1.587 — while the composer
 * takes the **default text size** with no override at all. So LilyPond's title is 1.587× its
 * composer, where MuseScore's is 2.2×.
 *
 * ⭐ **Ours takes MuseScore's TITLE and LilyPond's RATIO**, which is the only combination that is
 * not a guess: the title is the larger of the two references, so pairing it with the smaller of the
 * two composers exaggerated a gap neither book states. 4.44 ÷ 1.587 = **2.80 sp**.
 *
 * ⭐ The composer is right-aligned at the FOOT of the block (MuseScore's `composerAlign`
 * RIGHT/BOTTOM) and the title centred at its head — that is not decoration, it is the convention
 * every engraver's page follows, and the two alignments are why the pair reads as a header rather
 * than as two stacked captions.
 */
const SCORE_TEXT_SPECS: Record<ScoreTextField, {
  /** Font size, in staff spaces. */
  sizeSpaces: number
  /** Horizontal anchor within the page's CONTENT width. */
  anchor: 'middle' | 'end'
  /** Text baseline, in staff spaces from the TOP of the block. */
  baselineSpaces: number
}> = {
  // Baseline = the ascent below the block's top: 4.44 × 0.78 ≈ 3.46, where 0.78 is a serif face's
  // ascent as a fraction of its size. ⚠️ A GUESS, and allowed to be one because nothing is measured
  // before drawing here (see the module note) — a pixel or two out only moves blank paper. It is
  // baked into the number rather than applied at draw time, so each row reads as "where this line
  // sits in the block" with no arithmetic.
  title: { sizeSpaces: 4.44, anchor: 'middle', baselineSpaces: 3.46 },
  // At the FOOT of the frame, less a descender's worth so the letters sit ON its bottom rather than
  // through it — `FRAME_SPACES` − 2.80 × 0.25.
  composer: { sizeSpaces: 2.8, anchor: 'end', baselineSpaces: 9.3 },
}

/**
 * The FRAME the two lines are placed in, in staff spaces — what {@link SCORE_TEXT_SPECS}' baselines
 * are measured down from the top of.
 *
 * MuseScore's default title frame is a `VBox` of **10 sp** (`box.cpp`: `absoluteFromSpatium(10_sp)`),
 * and its contents are aligned to that frame's top and bottom. Taking the same 10 puts the title and
 * the composer where their alignments mean what they mean.
 *
 * ⚠️ ONE constant, not a sum over the fields present — the real frame's height follows its text;
 * this one does not, so a score with only a composer still opens the whole 10.
 */
const FRAME_SPACES = 10

/**
 * 🚨 **THE AIR A COMPOSER LINE NEEDS UNDER IT**, in staff spaces — added to the frame ONLY when a
 * composer is drawn (his report, 2026-08-27: *"if we add a composer field we need to add more air
 * between the composer and the beginning of the score"*).
 *
 * ⭐ **Sourced: LilyPond's `markup-system-spacing.basic-distance` = 5** (`ly/paper-defaults-init.ly`)
 * — the distance it holds between the last line of the title markup and the first system.
 *
 * ⭐ **And it is the composer's alone, which is why this is not simply a taller frame.** A title-only
 * header already clears that: the title's baseline sits 3.46 sp down a 10 sp frame, so more than 6
 * spaces of paper follow it. The COMPOSER is aligned to the frame's bottom edge — that is the whole
 * point of `composerAlign` BOTTOM — so it ends where the frame does, with nothing under it at all.
 * The air is what the alignment costs, and it is owed by the line that chose the alignment.
 */
const COMPOSER_AIR_SPACES = 5

/** A serif stack, because this is a title page. ⛔ Not `dynamicStyle.DYNAMIC_TEXT_FONT` — an
 *  expression word and a title have no reason to share a constant, and a sketch may not create the
 *  coupling the real text-item styles would then have to unpick. */
const TEXT_FONT_STACK = 'Georgia, "Times New Roman", Times, serif'

/** The group the block is drawn into — swept and redrawn every render, like the sheets under it.
 *  Exported because the highlight has to find the ink again (`interactions/HighlightController`). */
export const SCORE_HEADER_GROUP_CLASS = 'score-header'

/** The class on ONE drawn line, so the highlight can find the field that was selected. */
export function scoreTextClass(field: ScoreTextField): string {
  return `score-header-${field}`
}

/** ⭐ The one gate: may anything be drawn at all? Both exports ask it, so "wrapped view, on paper"
 *  is stated once. ⚠️ It says nothing about whether the FIELDS have anything in them. */
function headerIsDrawn(surface: SurfaceMetrics, viewMode: ViewMode): boolean {
  return viewMode === 'wrapped' && surface.heightPx !== null
}

/**
 * **The room page 1 owes the header**, in px — 0 whenever nothing will be drawn.
 *
 * Handed to `pageCastOff` as the first page's head start, so the systems below it are cast off into
 * what is left rather than being drawn over.
 */
export function sketchHeaderRoomPx(score: Score, surface: SurfaceMetrics, viewMode: ViewMode): number {
  if (!headerIsDrawn(surface, viewMode)) return 0
  const anything = SCORE_TEXT_FIELDS.some(field => scoreText(score, field) !== undefined)
  if (!anything) return 0
  const air = scoreText(score, 'composer') === undefined ? 0 : COMPOSER_AIR_SPACES
  return (FRAME_SPACES + air) * STAFF_SPACE_PX
}

/**
 * Draw it: one anchored line per field the score has, at the top of the first page's content area.
 *
 * ⭐ Positioned off `pageOriginPx(surface, 0)` + the page's own margins, in the same two steps every
 * other page-relative thing uses — where a page IS is `PagePass`'s answer, and this must not assume
 * the spread runs sideways.
 */
export function drawSketchHeader(
  svg: SVGElement,
  surface: SurfaceMetrics,
  score: Score,
  viewMode: ViewMode,
  /** Where the hit-boxes go, so the lines can be pressed (`interactions/elements/scoreText`).
   *  Optional because the drawing stands on its own — a render with no registry still shows them. */
  registry?: ElementRegistry,
): void {
  for (const old of Array.from(svg.querySelectorAll(`.${SCORE_HEADER_GROUP_CLASS}`))) old.remove()
  if (!headerIsDrawn(surface, viewMode)) return

  const ns = 'http://www.w3.org/2000/svg'
  const group = document.createElementNS(ns, 'g')
  group.setAttribute('class', SCORE_HEADER_GROUP_CLASS)
  // Chrome-free, but still not a hit-target in its own right: the press is answered from the
  // REGISTRY (measured ink), as every other element's is, so nothing here should catch pointers.
  group.setAttribute('pointer-events', 'none')

  const at = pageOriginPx(surface, 0)
  const left = at.x + surface.marginLeftPx
  const top = at.y + surface.marginTopPx

  let drewAnything = false
  for (const field of SCORE_TEXT_FIELDS) {
    const text = scoreText(score, field)
    if (text === undefined) continue
    const spec = SCORE_TEXT_SPECS[field]
    const fontPx = spec.sizeSpaces * STAFF_SPACE_PX

    const node = document.createElementNS(ns, 'text')
    // `middle` centres on the content width; `end` ends at its right edge — the two anchors the
    // table names, and the reason neither line needs its own width measured to be placed.
    node.setAttribute('x', String(spec.anchor === 'middle' ? left + surface.contentWidthPx / 2 : left + surface.contentWidthPx))
    node.setAttribute('y', String(top + spec.baselineSpaces * STAFF_SPACE_PX))
    node.setAttribute('text-anchor', spec.anchor)
    node.setAttribute('font-family', TEXT_FONT_STACK)
    node.setAttribute('font-size', `${fontPx}px`)
    node.setAttribute('fill', '#000000')
    // ⚠️⚠️ **STATE THE STROKE, `none` INCLUDED** — `./PagePass` learned this the same way and the
    // rule is the same one: something upstream sets `stroke` on this SVG's shapes, so an UNSTATED
    // stroke does not mean "no outline", it computes to a 1 px line around every letter. Black on
    // black it merely looks heavy; the moment the selection fills the text blue, the leftover
    // outline is what you see (his report, 2026-08-27). ⛔ A glyph is FILLED, never stroked — an
    // outlined letter reads as BOLD, which is the note highlight's own rule.
    node.setAttribute('stroke', 'none')
    node.setAttribute('class', scoreTextClass(field))
    node.textContent = text
    group.appendChild(node)
    drewAnything = true
  }

  if (!drewAnything) return
  svg.appendChild(group)
  if (registry) registerScoreText(registry, group)
}

/**
 * The lines' HIT-BOXES — **their own drawn ink, measured, or nothing at all.**
 *
 * ⭐ Measured with `getBBox()` AFTER the nodes are in the document, which is the only way to know how
 * wide a run of text is: the block's arithmetic knows where each line is ANCHORED and nothing about
 * its width. ⚠️ That is legitimate here and would not be on a music glyph — these are plain `<text>`
 * in a system font, untranslated, so a box is its ink in the drawing's own coordinates
 * (`reference_a_marks_getbbox_precedes_its_translate` is about ink that is moved after drawing).
 *
 * ⭐⭐ **No measurement, NO ENTRY** — ⛔ never an estimated width. jsdom has no layout, so under the
 * unit runner every text box is 0×0 (`reference_jsdom_cannot_measure_glyphs`), and a guessed box
 * would be believed by every press that landed in it. A header nobody can click is a visible,
 * explicable failure; one whose box is somewhere else is not.
 */
function registerScoreText(registry: ElementRegistry, group: SVGGElement): void {
  for (const field of SCORE_TEXT_FIELDS) {
    const node = group.querySelector(`.${scoreTextClass(field)}`) as SVGTextElement | null
    if (!node) continue
    let box: DOMRect | undefined
    try {
      box = node.getBBox()
    } catch {
      box = undefined // jsdom, or a node not yet laid out
    }
    if (!box || box.width <= 0 || box.height <= 0) {
      dbg(`· Sketched ${field} not registered — its ink could not be measured`)
      continue
    }
    registry.add({
      type: 'scoreText',
      scoreTextField: field,
      bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
    })
  }
}
