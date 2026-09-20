/**
 * ⭐⭐ **A NOTEHEAD OF OURS — S12j-a** (`docs/history/vexflow-removal-map.md` S12).
 *
 * VexFlow's `NoteHead` is a whole `Note` — built through the tickable's constructor, ticks and all — to
 * answer a dozen questions about ONE glyph on ONE line. Its INK was ours since P3 (`engrave/notes/
 * noteheads`, drawn by `EngravedNote.drawNoteHeads` and the fan's `drawFanHead`); this is the object.
 *
 * What it keeps is what its readers ask — the VexFlow note's inherited code (`StaveNote.setStave`,
 * `getBoundingBox`, `getNoteHeadBounds`, `draw`'s `setX`, `reset`'s style carry-over) and ours:
 *
 *  - its LINE, its GLYPH, whether it is DISPLACED across the stem, and its stem's direction;
 *  - its `x` (written back by the draw — ⚠️ `NoteHead.draw` did, and the registry reads it after) and y
 *    (`setStave`: the stave's `getYForNote(line)`), their shifts;
 *  - `getAbsoluteX`: `x`, plus a displaced head's width less half a stem, on the stem's side. ⚠️ VexFlow
 *    took the TICK context's x instead once the head was pre-formatted — and nothing pre-formats a head;
 *  - its WIDTH and metrics: the glyph measured in its face (the note's: `NOTE_FONT`);
 *  - `getBoundingBox` as `Element`'s: `x + xShift`, `y + yShift − ascent`, width, height;
 *  - its STYLE (`setKeyStyle`, and `reset` carrying it over), applied around its draw;
 *  - its own `noteheadN` ids.
 *
 * ⛔ Not kept: `addChild` / `parent` — only VexFlow's `NoteHead.draw` read the parent (to draw the
 * note's modifiers), and that draw is ours; nothing reads a note's `children`.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { NOTE_FONT, type FontRow } from '@/engine/engrave/inheritedFonts'
import { STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'
import { measureTextMetrics, type GlyphMetrics } from './glyphPainter'

/** What a head stands on — the one question it asks of a stave. */
interface HeadStave {
  getYForNote(line: number): number
  getContext(): DrawContext | undefined
}

/** A head's style — `Element`'s `ElementStyle`, the fields its draw applies. */
export interface HeadStyle {
  fillStyle?: string
  strokeStyle?: string
  lineWidth?: number
  lineDash?: string
  shadowColor?: string
  shadowBlur?: number
}

/** The box `BoundingBox.mergeWith` and the registry's `addGlyph` read. */
export interface HeadBox {
  x: number
  y: number
  w: number
  h: number
}

let nextHeadId = 0

export class EngravedHead {
  private x: number
  private y = 0
  private xShift = 0
  private yShift = 0
  private line: number
  private readonly displaced: boolean
  private readonly stemDirection: number
  private readonly glyph: string
  readonly fontInfo: FontRow
  private style: HeadStyle = {}
  private context?: DrawContext
  private rendered = false
  private readonly id = `notehead${++nextHeadId}`

  constructor(options: { line: number; glyph: string; displaced?: boolean; stemDirection?: number; x?: number; font?: FontRow }) {
    this.line = options.line
    this.glyph = options.glyph
    this.displaced = options.displaced === true
    this.stemDirection = options.stemDirection || 1
    this.x = options.x || 0
    this.fontInfo = options.font ?? NOTE_FONT
  }

  getAttribute(name: string): string | undefined {
    return name === 'id' ? this.id : undefined
  }

  getCategory(): string {
    return 'NoteHead'
  }

  getText(): string {
    return this.glyph
  }

  getLine(): number {
    return this.line
  }

  isDisplaced(): boolean {
    return this.displaced
  }

  setX(x: number): this {
    this.x = x
    return this
  }

  getY(): number {
    return this.y
  }

  setY(y: number): this {
    this.y = y
    return this
  }

  getXShift(): number {
    return this.xShift
  }

  setXShift(x: number): this {
    this.xShift = x
    return this
  }

  getYShift(): number {
    return this.yShift
  }

  /** Where it is drawn from — `x`, or a displaced head's crossing of the stem (`NoteHead.getAbsoluteX`). */
  getAbsoluteX(): number {
    return this.x + (this.displaced ? (this.getWidth() - STEM_THICKNESS_PX / 2) * this.stemDirection : 0)
  }

  /** `NoteHead.setStave`: its y from its line, and the stave's context. */
  setStave(stave: HeadStave): this {
    this.setY(stave.getYForNote(this.getLine()))
    this.context = stave.getContext()
    return this
  }

  private measured(): GlyphMetrics {
    return measureTextMetrics('NoteHead', this.glyph, this.fontInfo)
  }

  getWidth(): number {
    return this.measured().width
  }

  /** The glyph's measured ink — `Element.getTextMetrics`, the two fields the voice rule reads. */
  getTextMetrics(): { actualBoundingBoxAscent: number; actualBoundingBoxDescent: number } {
    const { ascent, descent } = this.measured()
    return { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent }
  }

  /** `Element.getBoundingBox`, transcribed. */
  getBoundingBox(): HeadBox {
    const { width, ascent, descent } = this.measured()
    return { x: this.x + this.xShift, y: this.y + this.yShift - ascent, w: width, h: ascent + descent }
  }

  getStyle(): HeadStyle {
    return this.style
  }

  setStyle(style: HeadStyle): this {
    this.style = style
    return this
  }

  /** `Element.applyStyle` — ⚠️ a shadow is refused: our surface has no shadow primitive. */
  applyStyle(ctx: DrawContext | undefined = this.context, style: HeadStyle = this.style): this {
    if (!ctx) return this
    if (style.shadowColor || style.shadowBlur) throw new Error('EngravedHead: a shadow has no primitive on DrawContext')
    if (style.fillStyle) ctx.setFillStyle(style.fillStyle)
    if (style.strokeStyle) ctx.setStrokeStyle(style.strokeStyle)
    if (style.lineWidth) ctx.setLineWidth(style.lineWidth)
    if (style.lineDash) ctx.setLineDash(style.lineDash.split(' ').map(Number))
    return this
  }

  setContext(context: DrawContext): this {
    this.context = context
    return this
  }

  getContext(): DrawContext | undefined {
    return this.context
  }

  setRendered(rendered = true): this {
    this.rendered = rendered
    return this
  }

  isRendered(): boolean {
    return this.rendered
  }
}
