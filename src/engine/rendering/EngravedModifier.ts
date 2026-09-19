/**
 * ⭐⭐ **A NOTE'S MODIFIER, AS OURS — the contract (S12b of `docs/vexflow-removal-map.md`).**
 *
 * The marks on a note (dot, accidental, articulation, tremolo, the dynamics' annotation) extended
 * VexFlow's `Modifier` — itself an `Element`. They leave it one at a time, leaf first, BEFORE the note
 * does — and while the note is still VexFlow's `StaveNote`, it drives them. So a modifier of ours keeps
 * the duck-typed contract the note and the columns call, transcribed here once:
 *
 * | who calls | what | here |
 * |---|---|---|
 * | `Note.addModifier` | `setNote`, `setIndex` | the fields, and `attachModifier` below (the one cast) |
 * | `ModifierContext.addMember` (our `ColumnModifiers`) | `getCategory`, `setModifierContext` | `CATEGORY`, kept per class — ⚠️ strings are read (`'Dot'`, `'Tremolo'`…) |
 * | `StaveNote.drawModifiers` | `checkIndex`, `setContext`, `drawWithStyle` → `draw` | `Element.drawWithStyle` transcribed |
 * | `StaveNote.getBoundingBox` | `getBoundingBox` — merged into the NOTE's box, which is its hit box | `Element.getBoundingBox` transcribed: `x + xShift`, `y + yShift − ascent`, width, height |
 * | our readers | position, text line, shifts (`setXShift` flips for a LEFT modifier), `checkAttachedNote` | `Modifier`'s, transcribed |
 *
 * ⚠️ A box is only as exact as the METRICS a subclass reports ({@link inkMetrics}) — VexFlow measured
 * its `text` in its category's face; a subclass measures the same glyph through `glyphPainter`.
 * ⚠️ Each class draws ids from ITS OWN counter (`tremolo3`), like `beamN` / `signN` / `tupletN`: VexFlow's
 * global `autoN` sequence shifts whenever a class leaves it, so an A/B strips ids.
 */
import type { Modifier, Note } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'

/** Where a modifier stands on its note — VexFlow's `ModifierPosition`, the same numbers. */
export const MODIFIER_POSITION = { CENTER: 0, LEFT: 1, RIGHT: 2, ABOVE: 3, BELOW: 4 } as const
export type ModifierPositionValue = (typeof MODIFIER_POSITION)[keyof typeof MODIFIER_POSITION]
const POSITION_OF_STRING: Readonly<Record<string, ModifierPositionValue>> = {
  center: MODIFIER_POSITION.CENTER,
  above: MODIFIER_POSITION.ABOVE,
  below: MODIFIER_POSITION.BELOW,
  left: MODIFIER_POSITION.LEFT,
  right: MODIFIER_POSITION.RIGHT,
}

/**
 * A box in VexFlow's `BoundingBox` shape (`x`, `y`, `w`, `h`, the getters, `mergeWith`) — a modifier's,
 * and since S12j-d1 a NOTE's (which merges its heads', its flag's and its modifiers' into one).
 */
export class ModifierBox {
  constructor(public x: number, public y: number, public w: number, public h: number) {}
  getX(): number { return this.x }
  getY(): number { return this.y }
  getW(): number { return this.w }
  getH(): number { return this.h }

  /** `BoundingBox.mergeWith`, transcribed: grow to cover `that` too. */
  mergeWith(that: { x: number; y: number; w: number; h: number }): this {
    const newX = this.x < that.x ? this.x : that.x
    const newY = this.y < that.y ? this.y : that.y
    const newW = Math.max(this.x + this.w, that.x + that.w) - newX
    const newH = Math.max(this.y + this.h, that.y + that.h) - newY
    this.x = newX
    this.y = newY
    this.w = newW
    this.h = newH
    return this
  }
}

/** What a modifier's own ink measures — the fields of VexFlow's `Element` text metrics its box reads. */
export interface ModifierMetrics {
  /** The advance width — `Element.width`. */
  width: number
  /** Ink above the baseline. */
  ascent: number
  /** Ink below the baseline. */
  descent: number
}

/** The style `drawWithStyle` applies — `Element`'s `ElementStyle`, the fields a draw can take. */
export interface ModifierStyle {
  fillStyle?: string
  strokeStyle?: string
  lineWidth?: number
  lineDash?: string
  shadowColor?: string
  shadowBlur?: number
}

const nextIdOf = new Map<string, number>()

export abstract class EngravedModifier {
  /** The category the columns file this modifier under. ⚠️ Read as a STRING by several readers. */
  static get CATEGORY(): string {
    return 'Modifier'
  }

  /** Where it stands on its note — `Modifier`'s default is LEFT. */
  protected position: ModifierPositionValue = MODIFIER_POSITION.LEFT
  /** Which text line it takes on its side. */
  protected textLine = 0
  protected xShift = 0
  protected yShift = 0
  /** Where it was drawn — written by `draw`, read by {@link getBoundingBox}. */
  protected x = 0
  protected y = 0
  protected note?: Note
  protected index?: number
  /** The column that filed it — held for the note's readers, ⛔ read by nothing of ours. */
  protected modifierContext?: object
  private context?: DrawContext
  private style: ModifierStyle = {}
  private rendered = false
  private readonly attrs: Record<string, string>

  constructor() {
    const category = (this.constructor as typeof EngravedModifier).CATEGORY
    const n = (nextIdOf.get(category) ?? 0) + 1
    nextIdOf.set(category, n)
    this.attrs = { id: `${category.toLowerCase()}${n}`, type: category, class: '' }
  }

  getCategory(): string {
    return this.attrs.type
  }

  getAttribute(name: string): string | undefined {
    return this.attrs[name]
  }

  setAttribute(name: string, value: string): this {
    this.attrs[name] = value
    return this
  }

  // ── the note ──────────────────────────────────────────────────────────────────────────────────

  setNote(note: Note): this {
    this.note = note
    return this
  }

  getNote(): Note {
    if (!this.note) throw new Error(`${this.getCategory()}: modifier has no note.`)
    return this.note
  }

  setIndex(index: number): this {
    this.index = index
    return this
  }

  getIndex(): number | undefined {
    return this.index
  }

  checkIndex(): number {
    if (this.index === undefined) throw new Error(`${this.getCategory()}: modifier has an invalid index.`)
    return this.index
  }

  /** The note, and that it has an index — what every draw asks first. */
  checkAttachedNote(): Note {
    this.checkIndex()
    return this.getNote()
  }

  setModifierContext(context: object): this {
    this.modifierContext = context
    return this
  }

  getModifierContext(): object | undefined {
    return this.modifierContext
  }

  // ── where it stands ───────────────────────────────────────────────────────────────────────────

  getPosition(): ModifierPositionValue {
    return this.position
  }

  /** A number, or `'above'`/`'below'`/`'left'`/`'right'`/`'center'`, as VexFlow accepts. */
  setPosition(position: ModifierPositionValue | string): this {
    this.position = typeof position === 'string' ? POSITION_OF_STRING[position] : position
    return this
  }

  setTextLine(line: number): this {
    this.textLine = line
    return this
  }

  /** ⚠️ VexFlow's: a LEFT modifier's shift is NEGATED — a positive shift moves it away from its note. */
  setXShift(x: number): this {
    this.xShift = this.position === MODIFIER_POSITION.LEFT ? -x : x
    return this
  }

  getXShift(): number {
    return this.xShift
  }

  setYShift(y: number): this {
    this.yShift = y
    return this
  }

  // ── drawing ───────────────────────────────────────────────────────────────────────────────────

  setContext(context: DrawContext): this {
    this.context = context
    return this
  }

  checkContext(): DrawContext {
    if (!this.context) throw new Error(`${this.getCategory()}: no rendering context attached.`)
    return this.context
  }

  setRendered(rendered = true): this {
    this.rendered = rendered
    return this
  }

  isRendered(): boolean {
    return this.rendered
  }

  getStyle(): ModifierStyle {
    return this.style
  }

  setStyle(style: ModifierStyle): this {
    this.style = style
    return this
  }

  /**
   * `Element.drawWithStyle`, transcribed: save, apply the style, draw, restore. ⚠️ A SHADOW style is
   * refused loudly — our surface has no shadow primitive, and nothing in the editor sets one.
   */
  drawWithStyle(): this {
    const ctx = this.checkContext()
    const { shadowColor, shadowBlur, fillStyle, strokeStyle, lineWidth, lineDash } = this.style
    if (shadowColor || shadowBlur) throw new Error(`${this.getCategory()}: a shadow style has no primitive on our surface.`)
    ctx.save()
    if (fillStyle) ctx.setFillStyle(fillStyle)
    if (strokeStyle) ctx.setStrokeStyle(strokeStyle)
    if (lineWidth) ctx.setLineWidth(lineWidth)
    if (lineDash) ctx.setLineDash(lineDash.split(' ').map(Number))
    this.draw()
    ctx.restore()
    return this
  }

  abstract draw(): void

  /** What this modifier's glyph measures, at the size it draws — the box's width and height. */
  protected abstract inkMetrics(): ModifierMetrics

  /** `Element.getBoundingBox`, transcribed — the box the NOTE merges into its own. */
  getBoundingBox(): ModifierBox {
    const { width, ascent, descent } = this.inkMetrics()
    return new ModifierBox(this.x + this.xShift, this.y + this.yShift - ascent, width, ascent + descent)
  }
}

/**
 * Hang a modifier of ours on a VexFlow note — `note.addModifier(modifier, index)`. ⭐ The ONE cast: the
 * note is typed for its own `Modifier`, and ours keeps that class's contract (the table above) without
 * extending it.
 */
export function attachModifier(note: Note, modifier: EngravedModifier, index = 0): void {
  note.addModifier(modifier as unknown as Modifier, index)
}
