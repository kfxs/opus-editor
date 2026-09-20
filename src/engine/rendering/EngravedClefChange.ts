/**
 * ⭐⭐ **AN INLINE CLEF CHANGE, OURS — S12j-e** (`docs/history/vexflow-removal-map.md` S12): the tickable a clef
 * change at `beat > 0` stands in a bar's voice as. It was VexFlow's `ClefNote` (`clefnote.js`) with a
 * VexFlow `Clef` inside it; this is both, transcribed as far as anything asks, and the sign itself is
 * the header clef's rows (`engrave/header/clefSign`, at `'small'`).
 *
 * | VexFlow | here |
 * |---|---|
 * | `new ClefNote(type, 'small')` — `Clef.setType` + `setWidth(clef.getWidth())` | the constructor: {@link clefSign}, the glyph MEASURED in its face (`./glyphPainter`, as `Element.measureText` did) |
 * | `ignoreTicks = true`, `duration: 'b'` | {@link shouldIgnoreTicks} true, {@link getTicks} a 256th |
 * | `ClefNote.preFormat` — marks itself formatted, ⛔ never runs its column | {@link preFormat} |
 * | `ClefNote.draw` — `clef.setX(getAbsoluteX())`, `clef.setY(getYForLine(line))`, `renderText` | {@link draw} → `engrave/glyph.stampGlyph` |
 * | `ClefNote.getBoundingBox` → `Element.getBoundingBox` of the clef | {@link getBoundingBox} |
 * | the `Clef`'s own `xShift` — where the hand offset went (`./clefOffsetPass`) | {@link glyphShift} |
 *
 * ⚠️ **Transcribed, quirks included:**
 * - ⭐ **its ticks are IGNORED by the voice and COUNTED by the columns.** `Voice.addTickable` skips a
 *   tick-ignoring tickable, but `createTickContexts` / `createModifierContexts` add every tickable's
 *   `getTicks()` to the running key — and a `ClefNote`'s duration is `'b'`, a 256th (64 ticks). So the
 *   note after a clef change files 64 ticks later than the same beat in another voice. Kept exactly;
 *   ⛔ not fixed during the removal (logged in `vexflow-removal-map.md` §9.4).
 * - ⛔ **No group.** `ClefNote.draw` stamps the glyph bare (a header clef opens `g.clef`; this does
 *   not). The highlight finds it by the registry's box (`HighlightController.highlightGlyphsInBBox`).
 * - The draw is wrapped in `save`/`restore`, as `Element.drawWithStyle` did — a `Clef` carries no style.
 *
 * ⭐ **In the SCENE** when drawn through the pass's surface ({@link setInkSurface}), like the note's ink.
 *
 * ⛔ No `vexflow` import.
 */
import type { Clef as ScoreClef } from '@/types/music'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { clefSign, type ClefSign } from '@/engine/engrave/header/clefSign'
import { clefPlacement } from '@/engine/engrave/header/clef'
import { stampGlyph } from '@/engine/engrave/glyph'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import { NOTE_AREA_PADDING_PX } from '@/engine/engrave/inheritedDefaults'
import { TICK_RESOLUTION, type TickCount } from '@/engine/layout/tickCount'
import { measureGlyphMetrics, type GlyphMetrics } from './glyphPainter'
import { barFrame, staveFrame } from './staveFrame'
import type { EngravedStave } from './EngravedStave'
import type { TickColumn } from './columnFormat'
import type { ColumnModifiers } from './modifierColumns'

/** A clef change's box — `Element.getBoundingBox`'s x, y, w, h. */
export interface ClefChangeBox {
  x: number
  y: number
  w: number
  h: number
}

/** `ClefNote`'s duration `'b'` — `Tables.durationAliases.b = '256'`: a 256th, in ticks. */
const CLEF_CHANGE_TICKS = TICK_RESOLUTION / 256

export class EngravedClefChange {
  /** ⭐ The hand offset (`./clefOffsetPass`) — the inner `Clef`'s `xShift`, drawn AND boxed. */
  glyphShift = 0
  preFormatted = false
  postFormatted = false

  /** What this change draws — the header clef's rows, at the reduced size. */
  readonly sign: ClefSign
  /** The glyph measured in its face — `Clef`'s `textMetrics`. ⚠️ All 0 in jsdom. */
  private readonly metrics: GlyphMetrics
  private readonly width: number
  private stave?: EngravedStave
  private context?: DrawContext
  private inkSurface?: DrawContext
  private tickContext?: TickColumn
  private modifierContext?: ColumnModifiers
  private rendered = false
  /** Where the glyph was last stamped — `Clef.x` / `Clef.y`, 0 until drawn, as they were. */
  private glyphX = 0
  private glyphY = 0

  constructor(readonly clef: ScoreClef) {
    this.sign = clefSign(clef, 'small')
    this.metrics = measureGlyphMetrics('EngravedClefChange.glyph', this.sign.glyph, this.sign.font.size)
    this.width = this.metrics.width
  }

  // ── Element ──

  /** Filed in its modifier column under this — `ClefNote.CATEGORY`. */
  getCategory(): string {
    return 'ClefNote'
  }

  setContext(context: DrawContext | undefined): this {
    this.context = context
    return this
  }

  checkContext(): DrawContext {
    if (!this.context) throw new Error('EngravedClefChange: no rendering context attached.')
    return this.context
  }

  /** ⭐ The surface the glyph is stamped on, when it is not the voice's — the pass's, for the scene. */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  isRendered(): boolean {
    return this.rendered
  }

  /** `Note.xShift` — 0, and ⚠️ never drawn (`Note.getAbsoluteX` does not add it): see {@link glyphShift}. */
  getXShift(): number {
    return 0
  }

  // ── Tickable ──

  getTicks(): TickCount {
    return { numerator: CLEF_CHANGE_TICKS, denominator: 1 }
  }

  shouldIgnoreTicks(): boolean {
    return true
  }

  /** `Tickable.getWidth`: its own width and its column's. ⚠️ Refused before a pre-format, as VexFlow did. */
  getWidth(): number {
    if (!this.preFormatted) throw new Error("EngravedClefChange: can't call getWidth on an unformatted note.")
    return this.width + (this.modifierContext ? this.modifierContext.getWidth() : 0)
  }

  getX(): number {
    return this.checkTickContext().getX()
  }

  isCenterAligned(): boolean {
    return false
  }

  getCenterXShift(): number {
    return 0
  }

  /** ⚠️ Stored and never read by VexFlow — a clef change is never centre-aligned — so not kept. */
  setCenterXShift(_centerXShift: number): this {
    return this
  }

  getTuplet(): undefined {
    return undefined
  }

  /** `Tickable.addToModifierContext`: it carries no modifiers, so only itself is filed. */
  addToModifierContext(column: ColumnModifiers): this {
    this.modifierContext = column
    column.addMember(this)
    this.preFormatted = false
    return this
  }

  setModifierContext(column: ColumnModifiers): this {
    this.modifierContext = column
    return this
  }

  setTickContext(column: TickColumn): void {
    this.tickContext = column
    this.preFormatted = false
  }

  checkTickContext(): TickColumn {
    if (!this.tickContext) throw new Error('EngravedClefChange: no tick context.')
    return this.tickContext
  }

  /** `ClefNote.preFormat` — formatted, and ⛔ its column is NOT run (a `ClefNote` never did). */
  preFormat(): void {
    this.preFormatted = true
  }

  // ── Note ──

  isRest(): boolean {
    return false
  }

  getBeam(): undefined {
    return undefined
  }

  getLineForRest(): number {
    return 0
  }

  getStave(): EngravedStave | undefined {
    return this.stave
  }

  /** `Note.setStave`: stand on it and take its context (the ys it also stored, nothing reads). */
  setStave(stave: EngravedStave): this {
    this.stave = stave
    this.setContext(stave.getContext())
    return this
  }

  /** `Note.getMetrics` — a clef has no displaced heads and no glyph width of its own there. */
  getMetrics() {
    if (!this.preFormatted) throw new Error("EngravedClefChange: can't call getMetrics on an unformatted note.")
    const modLeftPx = this.modifierContext ? this.modifierContext.getState().leftShift : 0
    const modRightPx = this.modifierContext ? this.modifierContext.getState().rightShift : 0
    const width = this.getWidth()
    return {
      width, glyphWidth: 0, notePx: width - modLeftPx - modRightPx, modLeftPx, modRightPx,
      leftDisplacedHeadPx: 0, rightDisplacedHeadPx: 0, glyphPx: 0,
    }
  }

  /** `Note.getAbsoluteX`: its column's x, the stave's note start and padding. */
  getAbsoluteX(): number {
    let x = this.checkTickContext().getX()
    if (this.stave) x += barFrame(this.stave).noteStartX + NOTE_AREA_PADDING_PX
    return x
  }

  // ── ClefNote ──

  /** `Element.drawWithStyle`: save, draw, restore. */
  drawWithStyle(): this {
    const ctx = this.checkContext()
    ctx.save()
    this.draw()
    ctx.restore()
    return this
  }

  /**
   * `ClefNote.draw`: the glyph at the note's x, on the line its clef names — that line's y the
   * BASELINE (`engrave/header/clef`'s rule) — plus the hand offset.
   */
  draw(): void {
    if (!this.stave) throw new Error('EngravedClefChange: no stave attached.')
    this.checkContext()
    this.rendered = true
    this.glyphX = this.getAbsoluteX()
    this.glyphY = staffLineY(staveFrame(this.stave), this.sign.line)
    const at = clefPlacement({ x: this.glyphX + this.glyphShift, lineY: this.glyphY })
    stampGlyph(this.inkSurface ?? this.checkContext(), this.sign.glyph, at.x, at.baselineY, this.sign.font)
  }

  /** `Element.getBoundingBox` of the clef: origin + shift, the ink's top, the advance, the ink's height. */
  getBoundingBox(): ClefChangeBox {
    const { width, ascent, descent } = this.metrics
    return { x: this.glyphX + this.glyphShift, y: this.glyphY - ascent, w: width, h: ascent + descent }
  }
}
