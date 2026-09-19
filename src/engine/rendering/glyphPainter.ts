/**
 * ⭐⭐ **THE ONE PLACE A GLYPH IS RESOLVED, MEASURED AND STAMPED** — `docs/own-engraving-engine.md` P1,
 * first step; ⭐ **no VexFlow since S13a** (`docs/vexflow-removal-map.md`): the `Element` it used is
 * `GlyphRun` below, the face tree `fonts/fontCategories`, the CSS `fonts/fontFace`. The history that
 * follows explains why a TAG selects a face and a size is POINTS — both still true, now of our rows.
 *
 * ## What this is, and why it is a module rather than a habit
 *
 * That document's §9 rule is *"we decide the geometry; we increasingly own the INK; VexFlow's job
 * shrinks to glyph shapes we do not want to invent"*, and its rule 1 is *"a new drawn element draws
 * through OUR context and OUR primitives — never by instantiating a VexFlow class."* Measured on
 * 2026-09-01, the rule held for every drawn family of the last six months **except this one thing**:
 * stamping a character in the music font. Nine files did it, identically, by hand:
 *
 * ```ts
 * const el = new Element('SomeRenderer.sign')
 * el.setText(glyph); el.setFontSize(size); el.renderText(ctx, x, y)
 * ```
 *
 * ⭐ That is not a violation of the rule — a glyph shape is exactly what we do not want to invent —
 * but it was the last **value** import of `vexflow` in those nine files, so it was the reason none
 * of them could be handed a context of ours. Collecting it here is what makes the next step (our own
 * `DrawContext`) a type change rather than a rewrite.
 *
 * ## ⭐ What `renderText` actually does — measured, not assumed
 *
 * `Element.renderText` (vexflow 5.0.0, `element.js:331`) is two calls and nothing else:
 *
 * ```js
 * renderText(ctx, xPos, yPos) { ctx.setFont(this._fontInfo); ctx.fillText(this._text, xPos + …, yPos + …) }
 * ```
 *
 * So `Element` is a **font resolver** here, not a painter: it turns a tag and a size into a
 * `FontInfo`, then calls two primitives we already own. ⏭️ That is why the `vexflow` import above is
 * expected to be deletable once `fonts/` can answer *"which face, at what size"* — the drawing half
 * is already ours. ⛔ Not today, and not as a guess: the face is resolved from VexFlow's `Metrics`
 * table (below), and changing which face a glyph lands in moves engraving.
 *
 * ## 🚨 The TAG is not a comment — it selects the font
 *
 * `new Element(tag)` does `this._fontInfo = Metrics.getFontInfo(tag)` (`element.js:61`). Every tag
 * this module is handed — `'TrillRenderer.sign'`, `'BarlineRenderer.wing'` — is a name of OURS with
 * no row in VexFlow's metrics table, so they all resolve to the same default (a stack LEADING with
 * the music font, per `reference: vexflow music font first in stack`). ⚠️ A tag that IS a VexFlow
 * category resolves differently — `TempoLayout` once ran on exactly that (`'StaveTempo.glyph'` vs
 * `'StaveTempo.name'`), until S1c of `docs/vexflow-removal-map.md` made its two faces rows of ours.
 * ⛔ So never name a tag after a VexFlow category: it would pick up that category's font.
 *
 * ⭐ So the tag stays a parameter: it is load-bearing, and it doubles as the debug label it has
 * always been.
 *
 * ## ⚠️ The ONE stamping site that is deliberately not here — and the line that keeps "one place" true
 *
 * `engrave/notes/flag.ts` (P3b) calls `ctx.setFont` + `ctx.fillText` itself. That is not a second
 * copy of this module: what this one owns is **font RESOLUTION** (a tag → a `FontInfo`, via
 * `Element`), and the flag's face is **already resolved** — a row of `engrave/inheritedFonts`, which
 * the adapter hands over as a value. With nothing left to resolve, `Element.renderText` is exactly
 * those two primitives.
 *
 * ⭐ And it has to be that way round: `engrave/` may not import `vexflow` (§8.2 rule 11), so a layer
 * that needed an `Element` to put a glyph down could never be painted to PDF or recorded as a
 * scene. ⛔ The rule this preserves is *"never `new Element(...)` in your own file"* — which that
 * module does not do.
 *
 * ## ⚠️ The size is in POINTS
 *
 * Every `sizePt` here is the number handed to `setFontSize`, and VexFlow reads a bare font size as
 * **points** at 4/3 px each — see `./drawnFontSize`, which exists because five ink tables read it as
 * pixels and under-modelled their own marks by a quarter. ⛔ Do not convert on the way in.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { categoryFont } from '@/engine/fonts/fontCategories'
import { fontToCss, validateFont, type FontInfo } from '@/engine/fonts/fontFace'

/**
 * ⭐⭐ **WHAT `new Element(tag)` WAS HERE — S13a** (`docs/vexflow-removal-map.md`): a face resolved from
 * the tag (`fonts/fontCategories`), a size or a face laid over it (`fonts/fontFace.validateFont`), a
 * measurement on one shared canvas, and a stamp of two primitives. ⛔ Nothing else of `Element` was
 * ever asked here, so nothing else is kept. It is private: callers speak tags, glyphs and points.
 */
class GlyphRun {
  /** `Element._fontInfo` — the face as last set, handed to the painter as it stands. */
  font: FontInfo

  constructor(private readonly tag: string, readonly text: string) {
    this.font = categoryFont(tag)
  }

  /** `Element.setFontSize`: the size replaced, the rest of the face kept — then validated. */
  setFontSize(sizePt: number): this {
    return this.setFontFields(this.font.family, sizePt, this.font.weight, this.font.style)
  }

  /** `Element.setFont(family, size, weight, style)`: each gap filled from the TAG's face, validated. */
  setFontFields(family?: string, size?: number | string, weight?: number | string, style?: string): this {
    const tagFont = categoryFont(this.tag)
    this.font = validateFont(family ?? tagFont.family, size ?? tagFont.size, weight ?? tagFont.weight, style ?? tagFont.style)
    return this
  }

  /** `Element.setFont(object)`: the tag's face with `font` laid over it — ⚠️ NOT validated until measured. */
  setFontObject(font: FontInfo): this {
    this.font = { ...categoryFont(this.tag), ...font }
    return this
  }

  /** `Element.measureText` — see {@link measureOnCanvas}. */
  metrics(): MeasuredText {
    return measureOnCanvas(this.text, fontToCss(validateFont(this.font)))
  }

  /** `Element.renderText(ctx, x, y)` for an element at 0,0 with no shift and no children. */
  paint(ctx: DrawContext, x: number, y: number): void {
    ctx.setFont(this.font)
    ctx.fillText(this.text, x, y)
  }

  /** `Element.getWidth()`, as `widthOf` asked it: 0 for anything unmeasurable. */
  width(): number {
    try {
      return this.metrics().width || 0
    } catch {
      return 0
    }
  }
}

/** The fields of a canvas `TextMetrics` this module reads. */
type MeasuredText = Pick<TextMetrics, 'width' | 'actualBoundingBoxAscent' | 'actualBoundingBoxDescent' | 'actualBoundingBoxLeft' | 'actualBoundingBoxRight'>

const NOTHING_MEASURED: MeasuredText = {
  width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0,
}

/** `Element.txtCanvas` — ONE canvas every measurement shares, made on first use. */
let measuringCanvas: HTMLCanvasElement | OffscreenCanvas | undefined

/**
 * `Element.measureText`, transcribed: the shared canvas told the face, then asked. ⚠️ A canvas keeps
 * its previous `font` when told one it cannot parse — shared, as VexFlow's was, so that holds too.
 * ⚠️ No canvas context (jsdom) measures NOTHING — every field 0, as VexFlow's empty metrics were.
 */
function measureOnCanvas(text: string, css: string): MeasuredText {
  if (!measuringCanvas) {
    if (typeof document !== 'undefined') measuringCanvas = document.createElement('canvas')
    else if (typeof OffscreenCanvas !== 'undefined') measuringCanvas = new OffscreenCanvas(300, 150)
  }
  const context = measuringCanvas?.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined
  if (!context) return NOTHING_MEASURED
  context.font = css
  return context.measureText(text)
}

/** A text run's face, for the one shape that is TEXT rather than a music glyph — see
 *  {@link drawTextRun}. `sizePt` is points, like every size in this module. */
export interface TextRunFont {
  family: string
  sizePt: number
  weight?: string
  style?: string
}

/**
 * A glyph's drawn width, or 0 when the font cannot be measured.
 *
 * ⚠️ **0 IS THE HONEST ANSWER IN JSDOM**, not a failure: `Element.getWidth` measures through a
 * canvas (`element.js:339`), and the unit suite has none — so every glyph there is 0 wide and every
 * assertion about where this ink landed belongs in the browser suite
 * (`reference: jsdom cannot measure glyphs`). Callers that repeat a glyph to a length already treat
 * 0 as *"draw nothing"* rather than looping forever; ⛔ do not make this throw or guess.
 *
 * ⭐ Three byte-identical private copies of this lived in `TrillRenderer`, `PedalRenderer` and
 * `OttavaRenderer` — a rule with no home, copied because there was no module to import it from
 * (`docs/own-engraving-engine.md` §3.1's *"the second owner is the tell"*).
 */
/** The run behind one stamp — the two lines every call site used to write for itself. */
function glyphRun(tag: string, glyph: string, sizePt: number): GlyphRun {
  return new GlyphRun(tag, glyph).setFontSize(sizePt)
}

/**
 * ⭐ **STAMP ONE MUSIC GLYPH**, and answer how wide it was drawn.
 *
 * `x` is the glyph's origin and `y` its BASELINE — the glyph is not centred on that point, and its
 * own box decides how far it reaches above and below (`CenteredTremolo`'s header is the cautionary
 * tale). The width comes back so a caller laying glyphs end to end never has to hold the element.
 *
 * @param tag  who is drawing, and — see the header — which font row is resolved. `'File.what'`.
 * @param sizePt  POINTS, the number VexFlow reads as `Npt`. See `./drawnFontSize`.
 */
export function drawGlyph(
  ctx: DrawContext, tag: string, glyph: string, x: number, y: number, sizePt: number,
): number {
  const run = glyphRun(tag, glyph, sizePt)
  run.paint(ctx, x, y)
  return run.width()
}

/**
 * ⭐ **HOW WIDE A GLYPH WOULD BE DRAWN, without drawing it** — the same resolution as
 * {@link drawGlyph}, so a pass that measures before it places cannot drift from what it then paints.
 *
 * Two callers today, and both are the same shape: a repeated wiggle asking for its unit before it
 * knows how many fit, and a right-aligned release sign asking for its own width before it knows
 * where to start. ⚠️ 0 in jsdom — see {@link widthOf}.
 */
export function measureGlyph(tag: string, glyph: string, sizePt: number): number {
  return glyphRun(tag, glyph, sizePt).width()
}

/** What the canvas measures of one glyph run — the fields of `TextMetrics` the engraving reads. */
export interface GlyphMetrics {
  /** The advance width. */
  width: number
  /** Ink above the baseline (`actualBoundingBoxAscent`). */
  ascent: number
  /** Ink below the baseline (`actualBoundingBoxDescent`). */
  descent: number
  /** Ink left of the origin (`actualBoundingBoxLeft`). */
  left: number
  /** Ink right of the origin (`actualBoundingBoxRight`). */
  right: number
}

/**
 * ⭐ **WHAT A GLYPH RUN WOULD MEASURE, drawn** — by the same resolution as {@link drawGlyph}: `tag`'s
 * face at `sizePt`. What an `Element` kept in its `textMetrics` for the objects that are ours now
 * (S12). ⚠️ All 0 in jsdom, like {@link widthOf}.
 */
export function measureGlyphMetrics(tag: string, glyph: string, sizePt: number): GlyphMetrics {
  try {
    const m = glyphRun(tag, glyph, sizePt).metrics()
    return {
      width: m.width || 0,
      ascent: m.actualBoundingBoxAscent || 0,
      descent: m.actualBoundingBoxDescent || 0,
      left: m.actualBoundingBoxLeft || 0,
      right: m.actualBoundingBoxRight || 0,
    }
  } catch {
    return { width: 0, ascent: 0, descent: 0, left: 0, right: 0 }
  }
}

/**
 * ⭐ **WHAT A RUN OF TEXT WOULD MEASURE, in a face of its own** — `tag`'s default face with `font`
 * laid over it (`Element.setFont(object)`), then measured. For the text annotation (S12g), which sets
 * its whole face rather than a size. ⚠️ All 0 in jsdom.
 */
export function measureTextMetrics(tag: string, text: string, font: TextRunFont | { family: string; size: number | string; weight?: string; style?: string }): GlyphMetrics {
  try {
    const m = new GlyphRun(tag, text).setFontObject(font).metrics()
    return {
      width: m.width || 0,
      ascent: m.actualBoundingBoxAscent || 0,
      descent: m.actualBoundingBoxDescent || 0,
      left: m.actualBoundingBoxLeft || 0,
      right: m.actualBoundingBoxRight || 0,
    }
  } catch {
    return { width: 0, ascent: 0, descent: 0, left: 0, right: 0 }
  }
}

/**
 * ⭐ **HOW TALL A GLYPH RUN WOULD BE DRAWN** — its ink's ascent plus descent (VexFlow's `Element`
 * height). The tuplet mark's baseline is centred on it (S12a). ⚠️ 0 in jsdom.
 */
export function measureGlyphHeight(tag: string, glyph: string, sizePt: number): number {
  const { ascent, descent } = measureGlyphMetrics(tag, glyph, sizePt)
  return ascent + descent
}

/** A run's ink ABOVE its baseline — see {@link measureGlyphMetrics}. ⚠️ 0 in jsdom. */
export function measureGlyphAscent(tag: string, glyph: string, sizePt: number): number {
  return measureGlyphMetrics(tag, glyph, sizePt).ascent
}

/**
 * ⭐ **STAMP ONE RUN OF TEXT** in a named face — the shape a music glyph cannot take.
 *
 * ⚠️ The parenthesised trill and ottava are why this is separate: their brackets are TEXT and their
 * sign is a music GLYPH, so each needs its own font — and the family must own an italic face, or
 * `font-style: italic` renders upright. The caller names the family for that reason; ⛔ this module
 * does not choose one.
 */
export function drawTextRun(
  ctx: DrawContext, tag: string, text: string, x: number, y: number, font: TextRunFont,
): number {
  const run = new GlyphRun(tag, text).setFontFields(font.family, font.sizePt, font.weight ?? 'normal', font.style ?? 'normal')
  run.paint(ctx, x, y)
  return run.width()
}
