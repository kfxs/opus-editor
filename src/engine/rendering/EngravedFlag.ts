/**
 * ⭐ **A NOTE'S FLAG, AS OURS — S12j-d3** (`docs/history/vexflow-removal-map.md` S12). Its INK has been ours since
 * P3b (`engrave/notes/flag`, drawn by `EngravedNote.drawFlag`); this is the object VexFlow's `Flag` was:
 * the glyph, the note's face, and the point the draw WRITES BACK (⚠️ the note's hit box merges this
 * flag's box whenever it has a flag — `EngravedNote.drawFlag` says what happened when that was lost).
 *
 * ⚠️ A note builds its flag EMPTY and gives it a glyph only when it has one (`buildFlag`); an empty flag
 * is still measured — its height feeds the stem extension, as VexFlow's empty `Flag` did.
 */
import { NOTE_FONT, type FontRow } from '@/engine/engrave/inheritedFonts'
import { measureTextMetrics, type GlyphMetrics } from './glyphPainter'
import { ModifierBox } from './EngravedModifier'

export class EngravedFlag {
  private text = ''
  private x = 0
  private y = 0
  readonly fontInfo: FontRow = NOTE_FONT

  getText(): string {
    return this.text
  }

  setText(text: string): this {
    this.text = text
    return this
  }

  setX(x: number): this {
    this.x = x
    return this
  }

  setY(y: number): this {
    this.y = y
    return this
  }

  private measured(): GlyphMetrics {
    return measureTextMetrics('Flag', this.text, this.fontInfo)
  }

  /** The glyph's measured ink — `Element.getTextMetrics`, the two fields the note reads. */
  getTextMetrics(): { actualBoundingBoxAscent: number; actualBoundingBoxDescent: number } {
    const { ascent, descent } = this.measured()
    return { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent }
  }

  getWidth(): number {
    return this.measured().width
  }

  getHeight(): number {
    const { ascent, descent } = this.measured()
    return ascent + descent
  }

  /** `Element.getBoundingBox` — from the point the draw wrote back. */
  getBoundingBox(): ModifierBox {
    const { width, ascent, descent } = this.measured()
    return new ModifierBox(this.x, this.y - ascent, width, ascent + descent)
  }
}
