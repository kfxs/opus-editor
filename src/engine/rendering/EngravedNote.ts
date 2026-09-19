/**
 * ⭐⭐ **THE SEAM WHERE THE NOTE'S INK COMES BACK TO US, ONE PIECE AT A TIME** —
 * `docs/own-engraving-engine.md` P3, `docs/note-engraving-plan.md`.
 *
 * `StaveNote.draw()` is five things in a fixed order: ledger lines, stem, noteheads, flag, pointer
 * rect. P3 is the work of moving those five to our own primitives, and it cannot be done in one
 * commit — `Stave`/`StaveNote` are also the RULER seven of our own renderers read
 * (`docs/own-engraving-engine.md` §2.3), so the object has to keep answering while its ink moves.
 *
 * ⭐ **This subclass WAS that seam** (P3–S12j-d2): the note stayed VexFlow's, and each override emptied
 * one of the five. ⭐ Since S12j-d3 it is a class of ours, extending nothing — the table below is the
 * history of how it got there. ⛔ It is not a monkeypatch — the audit names the live
 * `getModifierStartXY` patch as *"the shape of the whole problem"* (§2.4), and the difference is
 * that this is typed, one file, and reversible by deleting a method.
 *
 * ⭐⭐ **The override list below IS the progress bar**, the same one `npm run lint:paint` reports from
 * the other side and the same one the SCENE's coverage reports from the third:
 *
 * | part of the note | drawn by | since |
 * |---|---|---|
 * | **ledger lines** | ⭐ **us** — `engrave/notes/ledgerLines` | P3a, 2026-09-01 |
 * | **stem** (the INK; ⛔ not its LENGTH) | ⭐ **us** — `engrave/notes/stem`, via {@link EngravedStem} | P3c, 2026-09-01 |
 * | **noteheads** | ⭐ **us** — `engrave/glyph`'s stamp | P3d, 2026-09-01 |
 * | **flag** | ⭐ **us** — `engrave/notes/flag` | P3b, 2026-09-01 |
 * | the pointer rect | VexFlow | ⏭️ P3 (it is `getBoundingBox`, and that is the ruler, not the ink) |
 * | where a MODIFIER stands (`getModifierStartXY`) | ⭐ **us** — `engrave/notes/modifierStart` | S5a, 2026-09-15 |
 * | where the heads and stem stand along the staff (`getNoteHeadBeginX`/`EndX`, `getCenterGlyphX`, `getStemX`) | ⭐ **us** — `engrave/notes/noteGeometry` | S6a, 2026-09-15 |
 * | the displaced heads' room and the tie's left end (`calcNoteDisplacements`, `getTieLeftX`) | ⭐ **us** — `engrave/notes/noteGeometry` | S6b, 2026-09-15 |
 * | each head's y (`getYs`, and the stamp) | ⭐ **us** — the staff frame's `noteLineY` | S6c, 2026-09-15 |
 * | what each KEY puts on the staff — its line, its head glyph, its second-apart flag (`calculateKeyProps`) | ⭐ **us** — `engrave/notes/keyLines` | S6d, 2026-09-16 · ⭐ VexFlow's note table no longer runs for our notes |
 * | which heads CROSS the stem (`buildNoteHeads`) | ⭐ **us** — `rendering/chordHeadLayout`, the fan's own walk | S6d, 2026-09-16 · ⭐ ONE owner at last |
 * | how far the stem RUNS — its tip, its base, its stroke length (`Stem.getExtents`/`getHeight`) | ⭐ **us** — `engrave/notes/stemLength` | S6e, 2026-09-16 · ⛔ not how much EXTENSION the note asks for |
 * | the heads' own `y` field, and so `getNoteHeadBounds` and the stem's y bounds | ⭐ **us** — `EngravedStave.getYForNote` | S6d, 2026-09-16 |
 *
 * ## 🚨🚨 THE STANDING RULE THIS FAMILY LIVES OR DIES BY — **the object keeps ANSWERING**
 *
 * Emptying a `draw()` also removes whatever that draw WROTE, and VexFlow writes position as a side
 * effect of painting: `drawFlag` is `setX(...).setY(...).drawWithStyle()`, `NoteHead.draw` sets its
 * own `x`, `Accidental.draw` writes `this.x`/`this.y`. Every one of those fields is then read by
 * `getBoundingBox()` — the RULER this whole file exists to keep intact.
 *
 * ⇒ **an override that takes the ink must reproduce the write-back**, and {@link EngravedNote.drawFlag}
 * carries the cost of learning it: for thirteen days an unbeamed flagged note reported a bounding box
 * merged with the ORIGIN, and the symptom that surfaced it was a SLUR arching 361 px off the page
 * (his report, 2026-09-14). ⭐ A missing write-back is silent in the picture and loud everywhere the
 * geometry is read — which is the opposite of where you look.
 *
 * ⚠️ **Not every `StaveNote` in the app is one of these.** `GhostRenderer` builds plain ones for the
 * cursor preview, and they keep VexFlow's ledger drawing — deliberately, because §7.2 says a ghost
 * is *"a scene with a style"* and most of those 1,217 lines are deletion rather than migration. The
 * two pictures are identical today (this commit moved no pixel), so there is nothing to drift yet;
 * ⏭️ the moment a ledger number changes, the ghost has to come with it.
 */
import type { TickColumn } from './columnFormat'
import type { ColumnModifiers } from './modifierColumns'
import { EngravedFlag } from './EngravedFlag'
import { parseNoteDuration } from '@/engine/engrave/notes/noteDuration'
import { flagGlyph } from '@/engine/fonts/fontMetrics'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import type { EngravedStave } from './EngravedStave'
import { midLine } from '@/engine/engrave/notes/midLine'
import { ModifierBox } from './EngravedModifier'
import { NoteTicks, type TickCount } from '@/engine/layout/tickCount'
import type { ScoreTuplet } from './ScoreTuplet'
import type { DrawGroup } from '@/engine/paint/DrawGroup'
import { drawGroupOf, svgNode } from './svgDrawGroup'
import { EngravedHead } from './EngravedHead'
import { LEDGER_OVERHANG_PX, NOTE_AREA_PADDING_PX, NOTEHEAD_MIN_PADDING_PX, NOTE_ANNOTATION_SPACING_PX, NOTE_DURATION_ROWS, NOTE_GLYPH_SCALE, STEM_LENGTH_PX, STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'
import { stemExtents, stemLineHeight, type StemSpan } from '@/engine/engrave/notes/stemLength'
import { NOTE_FONT } from '@/engine/engrave/inheritedFonts'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { ledgerLineRuns, drawLedgerLines } from '@/engine/engrave/notes/ledgerLines'
import { flagPlacement, drawFlag } from '@/engine/engrave/notes/flag'
import { drawStem } from '@/engine/engrave/notes/stem'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { acceptsInkSurface } from './inkSurface'
import { maybeStaveOf, requireNoteFrame, staveFrame, staveOf } from './staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'
import { modifierStart, type MarkAnchor, type ModifierSide } from '@/engine/engrave/notes/modifierStart'
import {
  displacedHeadRoom, headsLeftX, headsRightX, stemX, tieLeftX, type NoteXInputs,
} from '@/engine/engrave/notes/noteGeometry'
import { keyRows, noteDurationOf, type KeyRow } from '@/engine/engrave/notes/keyLines'
import type { ColumnVoiceNote } from '@/engine/engrave/notes/voiceStack'
import { chordHeadDisplacement } from './chordHeadLayout'
import { noteRuler } from './noteRuler'
import { barVoiceOf } from './barVoice'

/**
 * ⭐ S9g — what `engrave/notes/voiceStack` needs of one note of a column, read as `StaveNote.format`
 * read it: the sorted
 * keys and the rest's head (its glyph's ascent and descent — a runtime `measureText`). The VOICE is
 * the `BarVoice` the note was added to (`./barVoice`, S9i), `undefined` where it was never added
 * — as VexFlow's unset field was.
 */
export function columnVoiceNoteOf(note: EngravedNote): ColumnVoiceNote {
  const sorted = note.getSortedKeyProps()
  const heads = note.noteHeads
  const bottom = sorted[0].keyProps
  const top = sorted[sorted.length - 1].keyProps
  const isRest = note.isRest()
  const restMetrics = isRest ? heads[0].getTextMetrics() : undefined
  return {
    bottomLine: bottom.line,
    topLine: top.line,
    isRest,
    restAscentPx: restMetrics?.actualBoundingBoxAscent ?? 0,
    restDescentPx: restMetrics?.actualBoundingBoxDescent ?? 0,
    stemDirection: note.getStemDirection(),
    stemLengthPx: note.getStemLength(),
    voiceShiftPx: note.getVoiceShiftWidth(),
    drawn: note.renderOptions.draw !== false,
    hasStem: note.hasStem(),
    hasBeam: note.hasBeam(),
    duration: note.getDuration(),
    bottomHeadCode: bottom.code,
    topHeadCode: top.code,
    firstKeyDots: note.getModifiers().filter(m => m.getCategory() === 'Dot' && m.getIndex() === 0).length,
    styleKey: JSON.stringify(note.getStyle()),
    voiceKey: barVoiceOf(note),
  }
}

/** The tuplet a note is in — ours (`ScoreTuplet`). */
type NoteTuplet = ScoreTuplet

/** One entry of the sorted list: a key row and the place it has in the note's own key order. */
type SortedKeyRow = { keyProps: KeyRow & { line: number }; index: number }

/** VexFlow's `ModifierPosition` numbers in our words — CENTER 0 · LEFT 1 · RIGHT 2 · ABOVE 3 · BELOW 4. */
const SIDE_OF_POSITION: Readonly<Record<number, ModifierSide>> = {
  0: 'center', 1: 'left', 2: 'right', 3: 'above', 4: 'below',
}

/**
 * ⭐⭐ **THE STEM'S HALF OF THE SEAM — P3c.** A `Stem` that strokes its line through OUR primitives
 * (`engrave/notes/stem`) instead of VexFlow's context.
 *
 * ⭐ **A subclass, because every number `Stem.draw` reads is `protected`** — `xBegin`/`xEnd`,
 * `yTop`/`yBottom`, the two y-offsets, the two base offsets, `renderHeightAdjustment`, the stemlet
 * pair. Reaching them from outside would be a cast per field; from inside it is ordinary access,
 * and the expression below is VexFlow's own, moved rather than rewritten.
 *
 * 🚨🚨 **The group is load-bearing and its ID is the whole seam.** The editor finds a stem's ink with
 * `note.getStem().getSVGElement()`, which is `document.getElementById(prefix(attrs.id))`, and then
 * recolours `querySelectorAll('path, line')` inside it (`HighlightController.applyStemHighlight`).
 * ⛔ So this override must open `openGroup('stem', this.getAttribute('id'))` exactly as VexFlow did:
 * drop the id and stem selection silently stops painting, with nothing failing.
 *
 * ⭐ **And as of S6e the LENGTH is ours too** — `engrave/notes/stemLength`, answered by
 * {@link EngravedStem.getHeight} and {@link EngravedStem.getExtents}. P3c was the ink; this is the reach.
 *
 * ⭐ **S12i — no longer VexFlow's `Stem`.** A plain class keeping what the VexFlow NOTE still calls on
 * its stem (`setDirection`, `setExtension`, `setYBounds`, `setNoteHeadXBounds`, `getHeight`,
 * `getExtents`, `adjustHeightForFlag`, `setStyle`, `setContext` → `drawWithStyle`) and what our beam
 * and fan call (`getExtension`, `adjustHeightForBeam`, `drawWithStyleOn`). ⚠️ Its STYLE is `Stem`'s
 * `{ strokeStyle: 'black' }` (`Metrics.getStyle('Stem')`) — `drawWithStyle` sets it before every
 * stroke, so it stays. The four y-offsets and the stemlet pair are VexFlow's fields that nothing in
 * this editor sets (only VexFlow's own `Beam` made stemlets): kept at their constructor's 0/false.
 * `getSVGElement` answers the group the last draw opened (the highlight's stem).
 */

/**
 * A stem's style — `Metrics.getStyle('Stem')`, set before every stroke by `drawWithStyle`. ⚠️ Measured
 * (S12i): it changes nothing on the page — the stroke sets its own colour — kept as VexFlow's, cheap.
 */
const STEM_STYLE: StemStyle = { strokeStyle: 'black' }

/** How far a FLAGGED stem's drawn line is shortened — `Metrics.get('Stem.heightAdjustmentForFlag', -3)`'s default. */
const STEM_FLAG_HEIGHT_ADJUSTMENT_PX = -3

/** A stem pointing DOWN — VexFlow's `Stem.DOWN`. */
const STEM_DOWN = -1

/** A stroke style — `Element`'s `ElementStyle`, the fields a stem's draw can take. */
export interface StemStyle {
  fillStyle?: string
  strokeStyle?: string
  lineWidth?: number
  lineDash?: string
  shadowColor?: string
  shadowBlur?: number
}

/** Our stems' ids — their own counter. */
let nextStemId = 0

export class EngravedStem {
  private xBegin = 0
  private xEnd = 0
  private yTop = 0
  private yBottom = 0
  private stemExtension = 0
  private stemDirection = 0
  private readonly hide: boolean
  private readonly isStemlet = false
  private readonly stemletHeight = 0
  private readonly stemUpYOffset = 0
  private readonly stemDownYOffset = 0
  private readonly stemUpYBaseOffset = 0
  private readonly stemDownYBaseOffset = 0
  private renderHeightAdjustment = 0
  private style: StemStyle = { ...STEM_STYLE }
  private context?: DrawContext
  private rendered = false
  private readonly id = `stem${++nextStemId}`
  private group: DrawGroup | null = null

  constructor(options: { hide?: boolean } = {}) {
    this.hide = options.hide || false
  }

  /**
   * The surface this stem's line draws on — the note's own, handed over by {@link drawNoteInkThrough}.
   * Null until then, and then it falls back to its context: an unset surface is a lost SCENE entry
   * and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  getCategory(): string {
    return 'Stem'
  }

  getAttribute(name: string): string | undefined {
    return name === 'id' ? this.id : undefined
  }

  setNoteHeadXBounds(xBegin: number, xEnd: number): this {
    this.xBegin = xBegin
    this.xEnd = xEnd
    return this
  }

  setDirection(direction: number): void {
    this.stemDirection = direction
  }

  setExtension(ext: number): void {
    this.stemExtension = ext
  }

  getExtension(): number {
    return this.stemExtension
  }

  setYBounds(yTop: number, yBottom: number): void {
    this.yTop = yTop
    this.yBottom = yBottom
  }

  adjustHeightForFlag(): void {
    this.renderHeightAdjustment = STEM_FLAG_HEIGHT_ADJUSTMENT_PX
  }

  adjustHeightForBeam(): void {
    this.renderHeightAdjustment = -STEM_THICKNESS_PX / 2
  }

  getStyle(): StemStyle {
    return this.style
  }

  setStyle(style: StemStyle): this {
    this.style = style
    return this
  }

  setContext(context: DrawContext): this {
    this.context = context
    return this
  }

  checkContext(): DrawContext {
    if (!this.context) throw new Error('EngravedStem: no rendering context attached.')
    return this.context
  }

  setRendered(rendered = true): this {
    this.rendered = rendered
    return this
  }

  isRendered(): boolean {
    return this.rendered
  }

  /** The group the last draw opened, as a DOM node — the highlight's stem. */
  getSVGElement(): SVGGElement | undefined {
    return svgNode(this.group)
  }

  private span(): StemSpan {
    return {
      yTop: this.yTop,
      yBottom: this.yBottom,
      stemDirection: this.stemDirection,
      extension: this.stemExtension,
    }
  }

  /** ⭐ OURS since S6e — `engrave/notes/stemLength`. */
  getHeight(): number {
    const up = this.stemDirection !== STEM_DOWN
    return stemLineHeight(this.span(), up ? this.stemUpYOffset : this.stemDownYOffset)
  }

  /** ⭐ OURS since S6e — `engrave/notes/stemLength`. */
  getExtents(): { topY: number; baseY: number } {
    const { tipY, baseY } = stemExtents(this.span())
    return { topY: tipY, baseY }
  }

  /** `Element.drawWithStyle` — save, the style, the draw, restore — on the stem's own context. */
  drawWithStyle(): this {
    const ctx = this.checkContext()
    this.withStyle(ctx, () => this.draw())
    return this
  }

  /** `Element.drawWithStyle` transcribed onto OUR surface — the fan's prefix stems (S10). */
  drawWithStyleOn(surface: DrawContext): void {
    this.setInkSurface(surface)
    this.withStyle(surface, () => this.draw())
  }

  private withStyle(ctx: DrawContext, draw: () => void): void {
    ctx.save()
    const style = this.style
    if (style.shadowColor || style.shadowBlur) throw new Error('EngravedStem: a shadow has no primitive on DrawContext')
    if (style.fillStyle) ctx.setFillStyle(style.fillStyle)
    if (style.strokeStyle) ctx.setStrokeStyle(style.strokeStyle)
    if (style.lineWidth) ctx.setLineWidth(style.lineWidth)
    if (style.lineDash) ctx.setLineDash(style.lineDash.split(' ').map(Number))
    draw()
    ctx.restore()
  }

  draw(): void {
    this.setRendered()
    if (this.hide) return
    const ctx = this.inkSurface ?? this.checkContext()

    // ⚠️ VexFlow's own arithmetic for WHICH x and WHICH y the stroke starts from, transcribed with its
    // branches intact. ⭐ The LENGTH is no longer among them — `getHeight()` above is ours.
    const down = this.stemDirection === STEM_DOWN
    const x = down ? this.xBegin : this.xEnd
    const from = down ? this.yTop + this.stemDownYOffset : this.yBottom - this.stemUpYOffset
    const baseOffset = down ? this.stemDownYBaseOffset : this.stemUpYBaseOffset
    const height = this.getHeight()
    // A STEMLET is the stub a beamed rest hangs off — it starts short of the noteheads.
    const stemletOffset = this.isStemlet ? height - this.stemletHeight * this.stemDirection : 0

    this.group = drawGroupOf(ctx.openGroup('stem', this.id))
    try {
      drawStem(ctx, {
        x,
        fromY: from - stemletOffset + baseOffset,
        toY: from - height - this.renderHeightAdjustment * this.stemDirection,
      }, STEM_THICKNESS_PX)
    } finally {
      ctx.closeGroup()
    }
  }
}

/** What the note is built from — VexFlow's `StaveNoteStruct`, the fields this editor passes. */
export interface EngravedNoteStruct {
  keys: string[]
  duration: string
  clef?: string
  autoStem?: boolean
  stemDirection?: number
  alignCenter?: boolean
  octaveShift?: number
  dots?: number
}

/** A modifier as the note holds it — the contract `./EngravedModifier` keeps. */
export interface NoteModifier {
  getCategory(): string
  setNote(note: EngravedNote): unknown
  setIndex(index: number): unknown
  getIndex(): number | undefined
  checkIndex(): number
  setContext(context: DrawContext): unknown
  drawWithStyle(): unknown
  getBoundingBox(): { x: number; y: number; w: number; h: number }
  setModifierContext(context: unknown): unknown
}

/** `StaveNote.getNoteHeadBounds`' answer — the heads' y span, the first (un)displaced x, the line extremes. */
export interface NoteHeadBounds {
  yTop: number
  yBottom: number
  displacedX?: number
  nonDisplacedX?: number
  highestLine: number
  lowestLine: number
  highestDisplacedLine?: number
  lowestDisplacedLine?: number
  highestNonDisplacedLine: number
  lowestNonDisplacedLine: number
}

/** What a note asks of its beam — that there is one, and `postFormat()` (`StemmableNote.postFormat`). */
export interface NoteBeam {
  postFormat(): unknown
}

/** Our notes' ids — their own counter. */
let nextNoteId = 0

/**
 * ⭐⭐⭐ **A NOTE OF OURS — S12j-d3.** No longer VexFlow's `StaveNote`: the constructor is `Element` →
 * `Tickable` → `Note` → `StemmableNote` → `StaveNote`'s, transcribed in their order (the duration parse is
 * `engrave/notes/noteDuration`), and every method a reader reaches is here — the rules and the ink moved
 * over S3–S12j-d2, the plumbing (`Element` / `Tickable` / `Note`) with this step.
 */
export class EngravedNote {
  // ── Element ──
  private readonly attrs: Record<string, string> = { id: `note${++nextNoteId}`, type: 'StaveNote' }
  private style: Record<string, unknown> = {}
  private context?: DrawContext
  private rendered = false
  /** The note's own `stavenote` group, as the last draw opened it — the highlight's note. */
  private group: DrawGroup | null = null
  private xShift = 0
  private width = 0
  // ── Tickable ──
  preFormatted = false
  postFormatted = false
  private modifiers: NoteModifier[] = []
  private tickContext?: TickColumn
  private modifierContext?: ColumnModifiers
  private alignCenter = false
  private centerXShift = 0
  private ignoreTicks = false
  // ── Note ──
  readonly keys: string[]
  keyProps: (KeyRow & { line: number })[] = []
  readonly duration: string
  readonly noteType: string
  readonly customTypes: string[]
  stave?: EngravedStave
  beam?: NoteBeam
  private leftDisplacedHeadPx = 0
  private rightDisplacedHeadPx = 0
  /**
   * `Note.renderOptions`, as far as anything reads it: `draw: false` is a rest the voice rule merged away.
   * ⚠️ VexFlow's `annotationSpacing` (5), `strokePx` (3) and `yShift` (0) are not kept: nothing read them —
   * the text rows ask `NOTE_ANNOTATION_SPACING_PX`, the ledger overhang is ours (`ledgerOverhang`).
   */
  readonly renderOptions: { draw?: boolean } = {}
  // ── StemmableNote ──
  private stem?: EngravedStem
  stemDirection = 0
  stemExtensionOverride?: number
  readonly flag = new EngravedFlag()
  // ── StaveNote ──
  minLine = 0
  maxLine = 0
  private sortedKeyProps: SortedKeyRow[] = []
  private _noteHeads: EngravedHead[] = []
  private ledgerLineStyle: Record<string, unknown> = {}
  readonly clef: string
  readonly octaveShift: number
  displaced = false

  constructor(noteStruct: EngravedNoteStruct) {
    const parsed = parseNoteDuration(noteStruct.duration, noteStruct.keys ?? [], noteStruct.dots)
    if (!parsed) throw new Error(`EngravedNote: invalid note initialization object: ${JSON.stringify(noteStruct)}`)
    this.keys = noteStruct.keys || []
    this.duration = parsed.duration
    this.noteType = parsed.type
    this.customTypes = parsed.customTypes
    this.setIntrinsicTicks(parsed.ticks)
    if (noteStruct.alignCenter) this.setCenterAlignment(noteStruct.alignCenter)
    this.clef = noteStruct.clef ?? 'treble'
    this.octaveShift = noteStruct.octaveShift ?? 0
    this.calculateKeyProps()
    this.buildStem()
    if (noteStruct.autoStem) this.autoStem()
    else this.setStemDirection(noteStruct.stemDirection ?? 1)
    this.reset()
    this.buildFlag()
  }

  // ── Element ───────────────────────────────────────────────────────────────────────────────────

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

  getStyle(): Record<string, unknown> {
    return this.style
  }

  setContext(context: DrawContext | undefined): this {
    this.context = context
    return this
  }

  getContext(): DrawContext | undefined {
    return this.context
  }

  checkContext(): DrawContext {
    if (!this.context) throw new Error('EngravedNote: no rendering context attached.')
    return this.context
  }

  setRendered(rendered = true): this {
    this.rendered = rendered
    return this
  }

  isRendered(): boolean {
    return this.rendered
  }

  /** `Element.drawWithStyle`: save, the style (a note carries none — `{}`), draw, restore. */
  drawWithStyle(): this {
    const ctx = this.checkContext()
    ctx.save()
    this.draw()
    ctx.restore()
    return this
  }

  /** The note's `stavenote` group, as a DOM node — the highlight's note (VexFlow looked it up by id). */
  getSVGElement(): SVGGElement | undefined {
    return svgNode(this.group)
  }

  getXShift(): number {
    return this.xShift
  }

  setXShift(x: number): this {
    this.xShift = x
    return this
  }

  setWidth(width: number): this {
    this.width = width
    return this
  }

  // ── Tickable ──────────────────────────────────────────────────────────────────────────────────

  /** `Tickable.getWidth`: its own width and its column's. ⚠️ Refused before a pre-format, as VexFlow did. */
  getWidth(): number {
    if (!this.preFormatted) throw new Error("EngravedNote: can't call getWidth on an unformatted note.")
    return this.width + (this.modifierContext ? this.modifierContext.getWidth() : 0)
  }

  getX(): number {
    return this.checkTickContext().getX() + this.xShift
  }

  shouldIgnoreTicks(): boolean {
    return this.ignoreTicks
  }

  isCenterAligned(): boolean {
    return this.alignCenter
  }

  setCenterAlignment(alignCenter: boolean): this {
    this.alignCenter = alignCenter
    return this
  }

  getCenterXShift(): number {
    return this.isCenterAligned() ? this.centerXShift : 0
  }

  setCenterXShift(centerXShift: number): this {
    this.centerXShift = centerXShift
    return this
  }

  getModifiers(): NoteModifier[] {
    return this.modifiers
  }

  /** `Note.addModifier`: the modifier told its note and its key, then kept. */
  addModifier(modifier: NoteModifier, index = 0): this {
    modifier.setNote(this)
    modifier.setIndex(index)
    this.modifiers.push(modifier)
    this.preFormatted = false
    return this
  }

  /** `Tickable.addToModifierContext`: every modifier, then the note itself, filed in the column. */
  addToModifierContext(column: ColumnModifiers): this {
    this.modifierContext = column
    for (const modifier of this.modifiers) column.addMember(modifier)
    column.addMember(this)
    this.preFormatted = false
    return this
  }

  getModifierContext(): ColumnModifiers | undefined {
    return this.modifierContext
  }

  setModifierContext(column: ColumnModifiers): this {
    this.modifierContext = column
    return this
  }

  setTickContext(column: TickColumn): void {
    this.tickContext = column
    this.preFormatted = false
  }

  getTickContext(): TickColumn | undefined {
    return this.tickContext
  }

  checkTickContext(): TickColumn {
    if (!this.tickContext) throw new Error('EngravedNote: no tick context.')
    return this.tickContext
  }

  /** `Tickable.reset` (a no-op) under `StaveNote.reset`: the heads rebuilt, their styles carried, restood. */
  reset(): this {
    const styles = this._noteHeads.map(head => head.getStyle())
    this.buildNoteHeads()
    this._noteHeads.forEach((head, index) => {
      if (styles[index]) head.setStyle(styles[index])
    })
    if (this.stave) this.setStave(this.stave)
    this.calcNoteDisplacements()
    return this
  }

  // ── Note ──────────────────────────────────────────────────────────────────────────────────────

  getKeys(): string[] {
    return this.keys
  }

  getKeyProps(): (KeyRow & { line: number })[] {
    return this.keyProps
  }

  getDuration(): string {
    return this.duration
  }

  getNoteType(): string {
    return this.noteType
  }

  getStave(): EngravedStave | undefined {
    return this.stave
  }

  checkStave(): EngravedStave {
    if (!this.stave) throw new Error('EngravedNote: no stave attached.')
    return this.stave
  }

  getLeftDisplacedHeadPx(): number {
    return this.leftDisplacedHeadPx
  }

  getRightDisplacedHeadPx(): number {
    return this.rightDisplacedHeadPx
  }

  setLeftDisplacedHeadPx(px: number): this {
    this.leftDisplacedHeadPx = px
    return this
  }

  setRightDisplacedHeadPx(px: number): this {
    this.rightDisplacedHeadPx = px
    return this
  }

  getBeam(): NoteBeam | undefined {
    return this.beam
  }

  hasBeam(): boolean {
    return !!this.beam
  }

  /** `Note.getMetrics`: the note's widths — its own, its column's either side, its displaced heads'. */
  getMetrics() {
    if (!this.preFormatted) throw new Error("EngravedNote: can't call getMetrics on an unformatted note.")
    const modLeftPx = this.modifierContext ? this.modifierContext.getState().leftShift : 0
    const modRightPx = this.modifierContext ? this.modifierContext.getState().rightShift : 0
    const width = this.getWidth()
    const glyphWidth = this.getGlyphWidth()
    const notePx = width - modLeftPx - modRightPx - this.leftDisplacedHeadPx - this.rightDisplacedHeadPx
    return {
      width, glyphWidth, notePx, modLeftPx, modRightPx,
      leftDisplacedHeadPx: this.leftDisplacedHeadPx, rightDisplacedHeadPx: this.rightDisplacedHeadPx, glyphPx: 0,
    }
  }

  /** `Note.getAbsoluteX`: its column's x, the stave's note start and padding, a centred note's shift. */
  getAbsoluteX(): number {
    let x = this.checkTickContext().getX()
    if (this.stave) x += this.stave.getNoteStartX() + NOTE_AREA_PADDING_PX
    if (this.isCenterAligned()) x += this.getCenterXShift()
    return x
  }

  // ── StemmableNote / StaveNote ─────────────────────────────────────────────────────────────────

  getStem(): EngravedStem | undefined {
    return this.stem
  }

  checkStem(): EngravedStem {
    if (!this.stem) throw new Error('EngravedNote: no stem attached.')
    return this.stem
  }

  setStem(stem: EngravedStem): this {
    this.stem = stem
    return this
  }

  /** `StemmableNote.buildFlag`: a flagged note's flag glyph, by its stem's direction. */
  buildFlag(): void {
    if (!this.hasFlag()) return
    const name = flagGlyph(noteDurationOf(this.duration), this.getStemDirection() !== STEM_DOWN)
    if (name) this.flag.setText(String.fromCodePoint(GLYPH_CODEPOINTS[name]))
  }

  /** The keys, bottom line first, each with its index in `keys` — `StaveNote.sortedKeyProps`. */
  getSortedKeyProps(): readonly SortedKeyRow[] {
    return this.sortedKeyProps
  }

  get noteHeads(): EngravedHead[] {
    return this._noteHeads.slice()
  }

  getLedgerLineStyle(): Record<string, unknown> {
    return this.ledgerLineStyle
  }

  /**
   * The surface this note's OWN ink draws on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Read by every override above.
   *
   * ⭐ It is a field rather than a parameter because `draw()` is VexFlow's and takes none. Null until
   * {@link drawNoteInkThrough} sets it, and then the note falls back to `checkContext()` — the same
   * object the rest of `draw()` uses, so an unset surface is a lost SCENE entry and ⛔ never a lost
   * pixel.
   */
  private inkSurface: DrawContext | null = null

  /** The centre x of each head's stamped glyph, filled by {@link EngravedNote.drawNoteHeads} and
   *  read by {@link EngravedNote.headCentreX}. ⚠️ Indexed as `keys` are, and only valid after a draw. */
  private drawnHeadCentreX: number[] = []

  /**
   * How far this note's ledger lines run past its heads, in px — the inherited default
   * ({@link LEDGER_OVERHANG_PX}, 3), ⛔ **not** the font's `legerLineExtension` (0.4 spaces = 4 px);
   * the alternatives are `docs/ledger-line-length-research.md`'s preset rows.
   */
  private ledgerOverhang: number = LEDGER_OVERHANG_PX

  /**
   * ⭐⭐ **S12j-c — THE NOTE'S TICKS ARE OURS.** How long it counts in the bar: its intrinsic length (the
   * duration and dots, `Note.parseNoteStruct`'s), times a MULTIPLIER that tuplets and two-note tremolos
   * scale — VexFlow's `Tickable` bookkeeping, transcribed in the unreduced arithmetic of
   * `layout/tickCount` (VexFlow's `Fraction.multiply` never reduces either: a column is keyed by a
   * numerator). ⚠️ `declare`d, never initialised: VexFlow's `Note` constructor calls
   * {@link setIntrinsicTicks} BEFORE this class's fields exist, and an initialiser would wipe it.
   */
  declare private intrinsicTicksOurs: number | undefined
  declare private tickMultiplierOurs: TickCount | undefined
  declare private ticksOurs: NoteTicks | undefined
  declare private tupletStackOurs: ScoreTuplet[] | undefined
  declare private tupletOurs: ScoreTuplet | undefined

  /** `Tickable.setIntrinsicTicks`: the length before any tuplet, and the ticks it now comes to. */
  setIntrinsicTicks(intrinsicTicks: number): void {
    this.intrinsicTicksOurs = intrinsicTicks
    this.recountTicks()
  }

  getIntrinsicTicks(): number {
    return this.intrinsicTicksOurs ?? 0
  }

  /** `Tickable.applyTickMultiplier`: scale by `numerator / denominator`, ⛔ unreduced. */
  applyTickMultiplier(numerator: number, denominator: number): void {
    const multiplier = this.tickMultiplierOurs ?? { numerator: 1, denominator: 1 }
    this.tickMultiplierOurs = { numerator: multiplier.numerator * numerator, denominator: multiplier.denominator * denominator }
    this.recountTicks()
  }

  /** The note's ticks — `numerator`/`denominator` unreduced, and `value()`. */
  getTicks(): NoteTicks {
    return this.ticksOurs ?? new NoteTicks(0, 1)
  }

  private recountTicks(): void {
    const multiplier = this.tickMultiplierOurs ?? { numerator: 1, denominator: 1 }
    this.ticksOurs = new NoteTicks(multiplier.numerator * (this.intrinsicTicksOurs ?? 0), multiplier.denominator)
  }

  /** `Tickable.setTuplet`: onto the stack, and the ticks scaled by it (`notesOccupied / noteCount`). */
  setTuplet(tuplet: NoteTuplet): this {
    const ours = tuplet as unknown as ScoreTuplet | undefined
    if (ours) {
      const stack = (this.tupletStackOurs ??= [])
      stack.push(ours)
      this.applyTickMultiplier(ours.getNotesOccupied(), ours.getNoteCount())
    }
    this.tupletOurs = ours
    return this
  }

  getTuplet(): NoteTuplet | undefined {
    return this.tupletOurs as unknown as NoteTuplet | undefined
  }

  getTupletStack(): NoteTuplet[] {
    return (this.tupletStackOurs ??= []) as unknown as NoteTuplet[]
  }

  /** `Tickable.resetTuplet` — ⚠️ nothing in this editor calls it; transcribed so an inherited copy never runs. */
  resetTuplet(tuplet?: NoteTuplet): this {
    const stack = (this.tupletStackOurs ??= [])
    const unscale = (t: ScoreTuplet) => this.applyTickMultiplier(t.getNoteCount(), t.getNotesOccupied())
    if (tuplet) {
      const ours = tuplet as unknown as ScoreTuplet
      const i = stack.indexOf(ours)
      if (i !== -1) {
        stack.splice(i, 1)
        unscale(ours)
      }
      return this
    }
    while (stack.length) unscale(stack.pop()!)
    return this
  }

  // ── ⭐⭐ S12j-d2 — THE NOTE'S OWN READERS AND WRITERS, transcribed from `StaveNote` / `StemmableNote` ──
  // What a duration carries is `inheritedDefaults.NOTE_DURATION_ROWS` (VexFlow's `durationCodes`).

  /** This note's row — its duration as our word (`keyLines.noteDurationOf`, VexFlow's token checked). */
  private durationRow() {
    return NOTE_DURATION_ROWS[noteDurationOf(this.duration)]
  }

  /**
   * `StaveNote.isRest`: its head glyph is a rest's (E4E0–E4FF). ⚠️ For the six durations this editor
   * writes that is exactly "its note type is `'r'`" — checked against VexFlow's table, not assumed.
   */
  isRest(): boolean {
    return this.noteType === 'r'
  }

  isChord(): boolean {
    return !this.isRest() && this.keys.length > 1
  }

  /** ⚠️ A REST's row says yes — every reader pairs this with `isRest`, as VexFlow's did. */
  hasStem(): boolean {
    return this.durationRow().stem
  }

  /** `StaveNote.hasFlag`: a flagged duration, no beam, not a rest. */
  hasFlag(): boolean {
    return this.durationRow().flag && !this.beam && !this.isRest()
  }

  /** `StaveNote.shouldDrawFlag`: a stem, a flagged duration, no beam, not a rest. */
  shouldDrawFlag(): boolean {
    return this.getStem() !== undefined && this.durationRow().flag && this.beam === undefined && !this.isRest()
  }

  /** `StemmableNote.getBeamCount` — ⚠️ `undefined` for a quarter and longer, as VexFlow's absent field. */
  getBeamCount(): number {
    return this.durationRow().beamCount as number
  }

  getLineNumber(isTopNote?: boolean): number {
    if (!this.keyProps.length) throw new Error("EngravedNote: can't get a line — the note has no key props.")
    let resultLine = this.keyProps[0].line
    for (const { line } of this.keyProps) {
      if (isTopNote ? line > resultLine : line < resultLine) resultLine = line
    }
    return resultLine
  }

  /** `StaveNote.getLineForRest`: its only key's line, or a chord's first and last keys' midpoint. */
  getLineForRest(): number {
    let restLine = this.keyProps[0].line
    if (this.keyProps.length > 1) {
      const lastLine = this.keyProps[this.keyProps.length - 1].line
      restLine = midLine(Math.max(restLine, lastLine), Math.min(restLine, lastLine))
    }
    return restLine
  }

  getKeyLine(index: number): number {
    return this.keyProps[index].line
  }

  /** `StaveNote.setKeyLine`: the key's line, and the note rebuilt around it (`reset`). */
  setKeyLine(index: number, line: number): this {
    this.keyProps[index].line = line
    this.reset()
    return this
  }

  /** `StaveNote.getGlyphWidth`: its first head's width. */
  getGlyphWidth(): number {
    return this.heads()[0].getWidth()
  }

  /** `StaveNote.getVoiceShiftWidth`: a head's width, twice when displaced. */
  getVoiceShiftWidth(): number {
    return this.getGlyphWidth() * (this.displaced ? 2 : 1)
  }

  isDisplaced(): boolean {
    return this.displaced
  }

  /** `StaveNote.getTieRightX`: past the head, its shifts, a right-displaced head and the column's right room. */
  getTieRightX(): number {
    let tieStartX = this.getAbsoluteX()
    tieStartX += this.getGlyphWidth() + this.getXShift() + this.getRightDisplacedHeadPx()
    const column = this.getModifierContext()
    if (column) tieStartX += column.getRightShift()
    return tieStartX
  }

  /** `StaveNote.getYForTopText`: the stave's row, or clear of the stem's tip by the spacing per line. */
  getYForTopText(textLine: number): number {
    const extents = this.getStemExtents()
    return Math.min(staveOf(this).getYForTopText(textLine), extents.topY - NOTE_ANNOTATION_SPACING_PX * (textLine + 1))
  }

  /**
   * `StaveNote.getYForBottomText` — ⚠️ transcribed with VexFlow's slip intact: it asks the stave's TOP
   * text row. Nothing in this editor reaches it (the annotation asks the stave's bottom row itself).
   */
  getYForBottomText(textLine: number): number {
    const extents = this.getStemExtents()
    return Math.max(staveOf(this).getYForTopText(textLine), extents.baseY + NOTE_ANNOTATION_SPACING_PX * textLine)
  }

  /**
   * `StaveNote.setStave` (with `Note.setStave` under it): stand on the stave, take its context, stand each
   * head on it, the note's ys from the heads', the stem's y bounds from the heads' span.
   */
  setStave(stave: EngravedStave): this {
    const ours = stave
    this.stave = stave
    this.setContext(ours.getContext())
    // ⚠️ VexFlow also stored the heads' ys here (`setYs`); nothing reads that store — `getYs` is ours (S6c).
    for (const head of this.heads()) head.setStave(ours)
    const stem = stemOf(this)
    if (stem) {
      const { yTop, yBottom } = this.getNoteHeadBounds()
      stem.setYBounds(yTop, yBottom)
    }
    return this
  }

  /** `StaveNote.preFormat`: the column's rules run, and the note's own width (its head, displaced heads, a flag up). */
  preFormat(): void {
    if (this.preFormatted) return
    let noteHeadPadding = 0
    const column = this.getModifierContext()
    if (column) {
      column.preFormat()
      if (column.getWidth() === 0) noteHeadPadding = NOTEHEAD_MIN_PADDING_PX
    }
    let width = this.getGlyphWidth() + this.getLeftDisplacedHeadPx() + this.getRightDisplacedHeadPx() + noteHeadPadding
    if (this.shouldDrawFlag() && this.getStemDirection() === 1) width += this.getGlyphWidth()
    this.setWidth(width)
    this.preFormatted = true
  }

  /** `StemmableNote.postFormat`. */
  postFormat(): this {
    this.beam?.postFormat()
    this.postFormatted = true
    return this
  }

  /** `StaveNote.setBeam`: the beam, the heads' displacements again, the stem's extension for it. */
  setBeam(beam: NoteBeam | undefined): this {
    this.beam = beam
    this.calcNoteDisplacements()
    stemOf(this)?.setExtension(this.getStemExtension())
    return this
  }

  /** `StaveNote.calculateOptimalStemDirection`: up when the keys' middle is below the middle line. ⚠️ Writes `minLine`/`maxLine`. */
  calculateOptimalStemDirection(): number {
    const sorted = this.sortedKeyProps
    this.minLine = sorted[0].keyProps.line
    this.maxLine = sorted[this.keyProps.length - 1].keyProps.line
    return (this.minLine + this.maxLine) / 2 < 3 ? 1 : -1
  }

  autoStem(): void {
    this.setStemDirection(this.calculateOptimalStemDirection())
  }

  getStemDirection(): number {
    if (!this.stemDirection) throw new Error('EngravedNote: no stem direction.')
    return this.stemDirection
  }

  /**
   * `StemmableNote.setStemDirection`: the direction (up by default), the note rebuilt, its flag rebuilt,
   * its beam DROPPED, the stem told, and a pre-formatted note pre-formatted again.
   */
  setStemDirection(direction?: number): this {
    if (!direction) direction = 1
    if (direction !== 1 && direction !== -1) throw new Error(`EngravedNote: invalid stem direction ${direction}`)
    this.stemDirection = direction
    this.reset()
    if (this.hasFlag()) this.buildFlag()
    this.beam = undefined
    const stem = stemOf(this)
    if (stem) {
      stem.setDirection(direction)
      stem.setExtension(this.getStemExtension())
    }
    if (this.preFormatted) this.preFormat()
    return this
  }

  /**
   * `StaveNote.getStemExtension` over `StemmableNote`'s: an override if one was set; a beamed stem's row
   * extension; a flag taller than the stem; then — the note's OWN — a stem pointing the optimal way lengthens
   * past an octave from the middle line (the chord's extreme line, beyond 3½ lines, times the staff space).
   */
  getStemExtension(): number {
    const row = this.durationRow()
    const scale = NOTE_GLYPH_SCALE
    let base: number
    if (this.stemExtensionOverride !== undefined) {
      base = this.stemExtensionOverride
    } else if (this.beam) {
      base = (row.stemBeamExtension as number) * scale
    } else {
      const flagHeight = this.flag.getHeight()
      base = flagHeight > STEM_LENGTH_PX * scale ? flagHeight - STEM_LENGTH_PX * scale : 0
    }
    if (!row.stem) return base
    const stemDirection = this.getStemDirection()
    if (stemDirection !== this.calculateOptimalStemDirection()) return base
    const MIDDLE_LINE = 3
    const midLineDistance = stemDirection === 1 ? MIDDLE_LINE - this.maxLine : this.minLine - MIDDLE_LINE
    const linesOverOctaveFromMidLine = midLineDistance - 3.5
    if (linesOverOctaveFromMidLine <= 0) return base
    const stave = maybeStaveOf(this)
    const spacingBetweenLines = stave !== undefined ? stave.getSpacingBetweenLines() : 10
    return base + linesOverOctaveFromMidLine * spacingBetweenLines
  }

  /** `StemmableNote.getStemLength`: the stem's 3½ spaces and the extension. */
  getStemLength(): number {
    return STEM_LENGTH_PX + this.getStemExtension()
  }

  /** `StemmableNote.setStemLength`: an override of the extension, so the stem is `height` long. */
  setStemLength(height: number): this {
    this.stemExtensionOverride = height - STEM_LENGTH_PX
    return this
  }

  getStemExtents(): { topY: number; baseY: number } {
    const stem = stemOf(this)
    if (!stem) throw new Error('EngravedNote: no stem attached to this note.')
    return stem.getExtents()
  }

  /**
   * ⭐ P3c — the note's stem is one of ours, so its ink comes back with the rest.
   *
   * ⚠️ Called from `StaveNote`'s CONSTRUCTOR, before this subclass's own field initialisers have
   * run — so it may touch nothing but `this.isRest()`, which is the base's. That is also why
   * {@link EngravedStem.setInkSurface} is a later call rather than a constructor argument.
   */
  buildStem(): this {
    this.setStem(new EngravedStem({ hide: this.isRest() }))
    return this
  }

  /**
   * ⭐⭐ **OURS as of S6d** — what each of this note's keys puts on the staff: the LINE it stands on,
   * the GLYPH its head is drawn with, and whether it is a second from its neighbour. The rule is
   * `engrave/notes/keyLines`; everything here is the adapter's half.
   *
   * ⭐ **This is the root of the note's geometry, so every reader above it becomes ours at once**:
   * `buildNoteHeads` places each head on `keyProps.line`, `getYs` (S6c) turns that line into a y,
   * `Stave.getYForNote` follows it, and VexFlow's own `Beam`, `Accidental` and `getLineNumber` read
   * `keyProps` directly. ⛔ VexFlow's note table (`Tables.keyProperties`) no longer runs for our notes.
   *
   * ⚠️ **Called from `StaveNote`'s CONSTRUCTOR**, before this subclass's own fields exist (they are
   * `define`d afterwards and would wipe anything written here) — so it reads only the base's state and
   * writes the base's three: `keyProps`, `sortedKeyProps` and the note-level `displaced` flag.
   *
   * ⚠️ The sort is VexFlow's own — by line, ascending, and STABLE, so two keys on one line keep the
   * order the caller gave them. `buildNoteHeads` walks that list, and reversing a tie would move a
   * unison's head to the other side of the stem.
   */
  calculateKeyProps(): void {
    const rows: KeyRow[] = keyRows(
      this.keys,
      this.clef,
      noteDurationOf(this.duration),
      this.noteType === 'r',
      this.octaveShift ?? 0,
    )
    const props = rows.map(row => ({ ...row }))
    this.displaced = rows.some(row => row.displaced)
    this.keyProps.push(...props)
    const sorted = this.sortedKeyProps
    sorted.push(...props.map((keyProps, index) => ({ keyProps, index })))
    sorted.sort((a, b) => a.keyProps.line - b.keyProps.line)
  }

  /**
   * ⭐⭐ **OURS as of S6d — and it makes `chordHeadLayout` the ONE owner of the second-interval rule.**
   *
   * A chord's heads stand in one column on their own side of the stem, except where two are a SECOND
   * apart: then the stem runs between them and the inner head crosses. `rendering/chordHeadLayout`
   * already held that walk — it was written for the FAN, whose members are bare `NoteHead`s we place
   * by hand, and its header says why it was *"deliberately VexFlow's own … so a member chord and the
   * fan's own note can never disagree about the same three pitches"*. ⭐ They cannot disagree now
   * because there is only one walk: this override is the second caller it was waiting for.
   *
   * ⭐ **And since S12j-a the head OBJECTS are ours too** (`./EngravedHead`) — P3d's worry, *"copying
   * that loop to change one constructor would re-import the dependency under another name"*, is
   * answered by the head being a small class of ours rather than VexFlow's `NoteHead` re-created: the
   * ink is {@link EngravedNote.drawNoteHeads}'s, the rule is the module's, the object is `EngravedHead`.
   *
   * ⚠️ **Called from `StaveNote`'s CONSTRUCTOR** (through `reset()`), so it reads only the base's state.
   * It also runs again on every `reset()` — after `setKeyLine` moves a voice's rest, or `setBeam` —
   * which is why the lines are read fresh from the key rows and ⛔ never cached.
   *
   * 🚨 **The field is ASSIGNED, and it has to be**: the public `noteHeads`
   * getter hands back a COPY, so a version of this that filled it in place left the note with no heads
   * and threw inside the constructor. ⚠️ `reset()` reads `_noteHeads` before and after this call (it
   * saves each head's style and restores it), and reads it through `this` both times, so replacing the
   * field is what VexFlow itself does and is safe.
   *
   * ⛔ **`useDefaultHeadX` is NOT written, and that is deliberate**: it is write-only in VexFlow 5 — two
   * assignments, zero reads, across `build/esm`, `build/cjs` and the typings. ⚠️ Dropping a write-back
   * that IS read is this file's most expensive lesson, so this one was checked rather than assumed.
   */
  buildNoteHeads(): EngravedHead[] {
    const stemDirection = this.getStemDirection()
    const rows = this.sortedKeyProps
    // ⭐ In the sorted order the walk expects — bottom-to-top, the stem's base first.
    const crosses = chordHeadDisplacement(rows.map(row => row.keyProps.line), stemDirection)
    const heads: EngravedHead[] = new Array(rows.length)
    rows.forEach((row, i) => {
      // ⭐ S12j-a: a head of OURS (`./EngravedHead`) — its glyph the key row's, its face the note's.
      const head = new EngravedHead({
        glyph: row.keyProps.code,
        displaced: crosses[i],
        stemDirection,
        line: row.keyProps.line,
        font: NOTE_FONT,
      })
      // ⚠️ Back into the note's OWN key order — `keys[2]` is `noteHeads[2]`, whatever line it is on.
      heads[row.index] = head
    })
    this._noteHeads = heads
    return heads
  }

  /** @see EngravedNote.ledgerOverhang — the accidental clearance's one lever. */
  setLedgerOverhang(px: number): void {
    this.ledgerOverhang = px
  }

  /** @see EngravedNote.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P3a.** The rule and the ink both live in `engrave/notes/ledgerLines`; everything
   * this override does is hand that module what only a `StaveNote` can answer — where its heads
   * landed, how wide its glyph is, and which y a staff line is at.
   *
   * ⚠️ Called from inside VexFlow's `draw()`, **after** it has opened the note's own `stavenote`
   * group and set every head's x. Both matter: the group is what the selection highlight recolours,
   * so ink drawn here is highlighted with the note for free, and the head x's are only settled at
   * that moment (`reference: vexflow geometry is only real after draw`).
   */
  drawLedgerLines(): void {
    if (this.isRest()) return
    const stave = staveOf(this)
    const frame = staveFrame(stave)
    const runs = ledgerLineRuns(
      this.heads().map(head => ({ line: head.getLine(), x: head.getAbsoluteX() })),
      noteRuler(this).glyphWidth,
      this.ledgerOverhang,
    )
    drawLedgerLines(
      this.inkSurface ?? this.checkContext(),
      runs,
      line => noteLineY(frame, line),
      // The stave's ledger style with this note's own on top — VexFlow's own merge, kept because
      // `hiddenElements` recolours a note by that second half.
      { ...stave.getDefaultLedgerLineStyle(), ...this.getLedgerLineStyle() },
    )
  }

  /**
   * ⭐ **OURS as of P3b.** The rule is `engrave/notes/flag`: *the flag's outer edge meets the stem
   * tip, on the stem's own x.* Everything here is the adapter's half — the four numbers only a
   * `StaveNote` can answer.
   *
   * ⚠️ `shouldDrawFlag()` stays VexFlow's and is not second-guessed: it is `hasStem && hasFlagGlyph
   * && !beam && !isRest`, and the `!beam` half is load-bearing in this editor — a fanned slot wears
   * a PLACEHOLDER beam precisely so its flag is suppressed, and `applyTremoloStemStretch` keys off
   * the same predicate.
   *
   * 🚨 **`getTextMetrics()` is a runtime `measureText`** — §3's bug class — and P3b's whole
   * contribution is that it now leaves this file as a NAMED ARGUMENT instead of hiding inside a draw
   * method. ⛔ Not re-sourced: swapping it for `fonts/flagDropFromTip` is a measurement to make
   * first (`docs/note-engraving-plan.md` §3.3), and P3b moved no pixel.
   */
  /**
   * ⭐⭐ **S12j-d1 — THE NOTE'S DRAW IS OURS** (`StaveNote.draw`, transcribed): nothing if it is not to be
   * drawn; every head at the heads' left edge; the stem's x; then, inside the note's own `stavenote`
   * group (⚠️ the highlight's seam — the id is the note's), the ledger lines, the stem (unless a beam
   * owns it), the heads, the flag; then the pointer rect over its box. Each part was ours already.
   */
  draw(): void {
    if (this.renderOptions.draw === false) return
    if (this.getYs().length === 0) throw new Error("EngravedNote: can't draw a note without y values.")
    const ctx = this.checkContext()
    const xBegin = this.getNoteHeadBeginX()
    const shouldRenderStem = this.hasStem() && !this.beam
    for (const head of this.heads()) head.setX(xBegin)
    const stem = stemOf(this)
    if (stem) {
      const stemX = this.getStemX()
      stem.setNoteHeadXBounds(stemX, stemX)
    }
    this.group = drawGroupOf(ctx.openGroup('stavenote', this.getAttribute('id')))
    this.drawLedgerLines()
    if (shouldRenderStem) this.drawStem()
    this.drawNoteHeads()
    this.drawFlag()
    const bb = this.getBoundingBox()
    ctx.pointerRect(bb.getX(), bb.getY(), bb.getW(), bb.getH())
    ctx.closeGroup()
    this.setRendered()
  }

  /**
   * `StaveNote.drawStem`, transcribed — the flag's height fudge when there is a flag to clear, then the
   * stem. ⛔ A stem built here from options (VexFlow's first branch) is refused: the note builds its own.
   */
  drawStem(stemOptions?: unknown): void {
    if (stemOptions) throw new Error('EngravedNote.drawStem: a stem from options is not transcribed — the note builds its own.')
    const ctx = this.checkContext()
    const stem = stemOf(this)
    if (this.shouldDrawFlag() && stem) stem.adjustHeightForFlag()
    stem?.setContext(ctx as unknown as DrawContext).drawWithStyle()
  }

  /** `StaveNote.drawModifiers`, transcribed: each modifier of THIS head, on the note's context, with its style. */
  drawModifiers(noteheadParam: EngravedHead): void {
    const ctx = this.checkContext()
    const heads = this._noteHeads
    for (const modifier of this.getModifiers()) {
      const index = modifier.checkIndex()
      if (heads[index] === noteheadParam) {
        modifier.setContext(ctx)
        modifier.drawWithStyle()
      }
    }
  }

  /**
   * `StaveNote.getNoteHeadBounds`, transcribed: the heads' y span, the first displaced and undisplaced
   * head's x, and the line extremes — the staff's own lines counted in, as VexFlow seeded them.
   */
  getNoteHeadBounds(): NoteHeadBounds {
    let yTop = +Infinity
    let yBottom = -Infinity
    let nonDisplacedX: number | undefined
    let displacedX: number | undefined
    let highestLine = staveOf(this).getNumLines()
    let lowestLine = 1
    let highestDisplacedLine: number | undefined
    let lowestDisplacedLine: number | undefined
    let highestNonDisplacedLine = highestLine
    let lowestNonDisplacedLine = lowestLine
    for (const head of this._noteHeads) {
      const line = head.getLine()
      const y = head.getY()
      yTop = Math.min(y, yTop)
      yBottom = Math.max(y, yBottom)
      if (displacedX === undefined && head.isDisplaced()) displacedX = head.getAbsoluteX()
      if (nonDisplacedX === undefined && !head.isDisplaced()) nonDisplacedX = head.getAbsoluteX()
      highestLine = Math.max(line, highestLine)
      lowestLine = Math.min(line, lowestLine)
      if (head.isDisplaced()) {
        highestDisplacedLine = highestDisplacedLine === undefined ? line : Math.max(line, highestDisplacedLine)
        lowestDisplacedLine = lowestDisplacedLine === undefined ? line : Math.min(line, lowestDisplacedLine)
      } else {
        highestNonDisplacedLine = Math.max(line, highestNonDisplacedLine)
        lowestNonDisplacedLine = Math.min(line, lowestNonDisplacedLine)
      }
    }
    return {
      yTop, yBottom, displacedX, nonDisplacedX, highestLine, lowestLine,
      highestDisplacedLine, lowestDisplacedLine, highestNonDisplacedLine, lowestNonDisplacedLine,
    }
  }

  /**
   * ⭐ `StaveNote.getBoundingBox`, transcribed — the note's HIT BOX: its origin at its first y, merged with
   * each head's box, the stem's reach (past the flag's ink), the flag's box, and every modifier's.
   * ⚠️ In VexFlow's `BoundingBox` shape (`ModifierBox`).
   */
  getBoundingBox(): ModifierBox {
    const box = new ModifierBox(this.getAbsoluteX(), this.getYs()[0], 0, 0)
    for (const head of this._noteHeads) box.mergeWith(head.getBoundingBox())
    const { yTop, yBottom } = this.getNoteHeadBounds()
    const stem = stemOf(this)
    if (!this.isRest() && this.hasStem() && stem) {
      const noteStemHeight = stem.getHeight()
      const flagMetrics = this.flag.getTextMetrics()
      const stemY = this.getStemDirection() === STEM_DOWN
        ? yTop - noteStemHeight - flagMetrics.actualBoundingBoxDescent
        : yBottom - noteStemHeight + flagMetrics.actualBoundingBoxAscent
      box.mergeWith(new ModifierBox(this.getAbsoluteX(), stemY, 0, 0))
    }
    if (this.hasFlag()) box.mergeWith(this.flag.getBoundingBox())
    for (const modifier of this.getModifiers()) box.mergeWith(modifier.getBoundingBox())
    return box
  }

  /**
   * ⭐ **OURS as of P3d — and it is the last of the five drawing calls.**
   *
   * ⚠️ **An override of `drawNoteHeads`, ⛔ not a `NoteHead` subclass**, which is the shape the stem
   * got. `buildNoteHeads()` is overridable, but the `new NoteHead(…)` inside it sits at the bottom of
   * forty lines of VexFlow's own second-interval displacement walk — and *"port the ALGORITHM, not
   * the FILE"* (§6.7) cuts both ways: copying that loop to change one constructor would re-import
   * the dependency under another name. So the head objects stay VexFlow's and only their INK moves.
   *
   * ⭐ The body is `NoteHead.draw()` (`notehead.js`) wrapped in `Element.drawWithStyle()`, both
   * transcribed rather than rewritten:
   *
   * 1. 🚨 **`setX(getAbsoluteX())` is a WRITE-BACK, and it is load-bearing.** `FanPass` already
   *    carries the warning — *"`NoteHead.draw` writes its own absolute x back into `x`, so a
   *    displaced head asked twice displaces twice"*. It must happen exactly once, here.
   * 2. ⚠️ **`drawModifiers` stays INSIDE the head's group.** That is where a chord's accidentals,
   *    dots and articulations land, and the selection highlight recolours by walking that group.
   * 3. ⚠️ **The style wrapper stays on the VexFlow context.** `drawWithStyle` is `save` → `applyStyle`
   *    → `draw` → `restore`, and `applyStyle` can reach for shadow primitives that {@link DrawContext}
   *    deliberately does not declare. Nothing in this editor styles a notehead (`setStyle` is unused
   *    here — every recolour goes through the DOM afterwards), so this is fidelity rather than need.
   * 4. 🚨 **The group's id is the seam**, exactly as it was for the stem: `g.notehead` is read by
   *    the highlight and by a dozen browser specs (`glyphs('g.notehead text')`).
   *
   * ⛔ **What is NOT taken**: which glyph a duration gets. `fonts/noteheadGlyph()` has answered that
   * from Bravura since P2, so it is a fourth *"the room reserved and the ink drawn come from two
   * sources"* candidate — ⛔ and, like the other three, his call rather than a tidy-up.
   */
  drawNoteHeads(): void {
    const context = this.checkContext()
    const surface = this.inkSurface ?? context
    this.drawnHeadCentreX = []
    // ⭐ S6c — each head is stamped at OUR y for its line, the same answer every reader of `getYs()` gets.
    const ys = this.getYs()
    for (const [index, head] of this.heads().entries()) {
      head.setContext(context)
      context.save()
      head.applyStyle(context)
      head.setRendered()
      try {
        // 🚨 ONCE, and once only — see (1) above. ⚠️ And the value is KEPT rather than read back
        // with `getX()`: a `NoteHead` is a `Tickable`, whose `getX()` throws `NoTickContext` — which
        // is exactly why `NoteHead.draw` reads the raw `x` field instead. (It threw here first.)
        const x = head.getAbsoluteX()
        head.setX(x)
        const originX = x + head.getXShift()
        // ⭐ WHERE THIS HEAD ACTUALLY LANDED — see {@link EngravedNote.headCentreX}.
        this.drawnHeadCentreX[index] = originX + head.getWidth() / 2
        // ⭐ The ink itself is `engrave/notes/noteheads`, shared with `FanPass` — see that module's
        // header for why a second owner was what earned it a module.
        drawNoteHead(surface, {
          id: head.getAttribute('id'),
          glyph: this.headGlyph(index),
          x: originX,
          y: ys[index] + head.getYShift(),
          font: NOTE_FONT,
        }, () => this.drawModifiers(head))
      } finally {
        context.restore()
      }
    }
  }

  /**
   * ⭐⭐ **WHERE EACH HEAD'S INK ACTUALLY LANDED**, indexed as `keys` are — the centre of the glyph
   * this note stamped, ⛔ not a position re-derived from the note afterwards.
   *
   * 🚨 **His report, 2026-09-14**: in a chord C♯4+E4+G4+A♭4+C♯5 the **A♭4 is a SECOND above the
   * G4**, so VexFlow displaces its head to the other side of the stem — and clicking that head
   * selected the whole MEASURE instead of the note. The registry was filing ONE head centre
   * (`getNoteHeadBeginX()`…`getNoteHeadEndX()`, which is the note's undisplaced column) against
   * EVERY pitch of the chord, so the displaced head's hit box sat a notehead-width away from its
   * own ink. ⭐ Exactly *"a hit box written from a constant drifts off its glyph — ask the DRAWN
   * element, in ink"*.
   *
   * ⚠️ **⛔ And it may NOT be re-derived by asking the head again**: `NoteHead.getAbsoluteX()` folds
   * the displacement in every time it is called, so a second call displaces twice — the same trap
   * the `setX` write-back above carries. ⇒ the drawn value is recorded once, here, as it is drawn.
   *
   * @returns undefined before this note has been drawn, so a caller falls back rather than reads a
   *   position nothing painted.
   */
  headCentreX(index: number): number | undefined {
    return this.drawnHeadCentreX[index]
  }

  /**
   * ⭐ S5a — the editor's hold on this note's marks above and below: its hand offset and stem alignment
   * (`engrave/notes/modifierStart`'s {@link MarkAnchor}). Set by `ScoreRenderer.applyNoteOffsets`
   * after the format; absent on every note that needs neither.
   */
  private markAnchor: MarkAnchor | undefined

  /** @see EngravedNote.markAnchor */
  setMarkAnchor(anchor: MarkAnchor | undefined): void {
    this.markAnchor = anchor
  }

  /**
   * ⭐ S6a — what this note's x's are built from, read ONCE here: the origin, head width and stem
   * direction through the ruler, the shift and the rest-by-type off the note itself.
   * ⚠️ Read on every ask, ⛔ never cached: the formatter moves the origin and the offset moves the shift.
   */
  private xInputs(): NoteXInputs {
    const ruler = noteRuler(this)
    return {
      originX: ruler.originX,
      xShift: this.getXShift(),
      glyphWidth: ruler.glyphWidth,
      stemDirection: ruler.stemDirection,
      isRestType: this.noteType === 'r',
    }
  }

  /** ⭐ OURS as of S6a — `engrave/notes/noteGeometry`. */
  getNoteHeadBeginX(): number {
    return headsLeftX(this.xInputs())
  }

  /** ⭐ OURS as of S6a — `engrave/notes/noteGeometry`. */
  getNoteHeadEndX(): number {
    return headsRightX(this.xInputs())
  }

  /**
   * ⭐ OURS as of S6a — `engrave/notes/noteGeometry`. ⚠️ VexFlow's own `Beam`, `Tuplet` and `Annotation`
   * ask this too, and get our answer.
   */
  getStemX(): number {
    return stemX(this.xInputs())
  }

  /**
   * ⭐ OURS as of S6b — the room this note's displaced heads take on each side (`engrave/notes/noteGeometry`).
   *
   * ⚠️ **Called from `StaveNote`'s CONSTRUCTOR** (through `reset()`), before this subclass's own fields
   * exist — so it reads only the base's state and writes the base's two fields. The stem direction is the
   * base's FIELD (as VexFlow reads it), ⛔ not the ruler's getter, which throws on a note that has none yet;
   * and the width is asked only when a side takes room.
   */
  calcNoteDisplacements(): void {
    const room = this.displacedRoom()
    this.setLeftDisplacedHeadPx(room.left)
    this.setRightDisplacedHeadPx(room.right)
  }

  /**
   * ⭐ OURS as of S6b — `engrave/notes/noteGeometry`. ⚠️ The left room is asked of the RULE, the same answer
   * the field holds: nothing it is built from changes without `calcNoteDisplacements` running again.
   */
  getTieLeftX(): number {
    return tieLeftX(this.xInputs(), this.displacedRoom().left)
  }

  /** The displaced heads' room — one reading of the base's state, for the two overrides above. */
  private displacedRoom(): { left: number; right: number } {
    const ruler = noteRuler(this)
    return displacedHeadRoom({
      displaced: this.displaced,
      stemDirection: this.stemDirection ?? 0,
      hasFlag: ruler.hasFlag,
      glyphWidth: () => ruler.glyphWidth,
    })
  }

  /**
   * ⭐⭐ OURS as of S6c — each head's y, in key order: its line through the staff frame (`noteLineY`, rule 5 —
   * ⛔ never `top + line × space` here). VexFlow's own `StaveTie`, `Beam`, `Articulation` and `Annotation`
   * ask this, and so do the ruler and the modifier start.
   *
   * ⚠️ **Equal to VexFlow's, and bit-for-bit on every fixture measured** (S6c's probe against HEAD: 183
   * note numbers, 992 scene numbers, none different) — but only GUARANTEED to within a rounding: its
   * `getYForNote` sums the same terms in a different order (`y + 4·space + 5·space − line·space` against
   * the frame's `(y + 4·space) + (5 − line)·space`), and a staff at some other y could differ in the last
   * bit. ⚠️ A fresh array per call — no reader keeps or mutates it.
   * ⏳ The heads' own `y` field, which `getNoteHeadBounds` and the stem's y bounds read, is still VexFlow's
   * until S6d owns the heads.
   */
  getYs(): number[] {
    const frame = requireNoteFrame(this)
    return this.heads().map(head => noteLineY(frame, head.getLine()))
  }

  /** The glyph head `index` is drawn with — ONE read of it, for the stamp and for the modifier start. */
  private headGlyph(index: number): string {
    return this.heads()[index].getText()
  }

  /** The note's heads, in key order — ONE read of VexFlow's list, for the ledger lines, the stamps and the glyphs. */
  private heads(): EngravedHead[] {
    return this.noteHeads as unknown as EngravedHead[]
  }

  /**
   * ⭐⭐ **OURS as of S5a** — where this note offers a modifier a place to stand. The rule is
   * `engrave/notes/modifierStart`; this override hands it what only the note can answer. Every modifier
   * asks through here — VexFlow's own `Accidental`/`Dot`/`Articulation`/`Annotation` included — so the
   * rule is ours for all of them while their stacking rules are still VexFlow's (S5b–e).
   *
   * ⚠️ A note asked too early still THROWS, through the ruler rather than a guard of its own: before it
   * stands on a stave its heads have no ys (`getYs()` asks the stave's frame, `NoStave`), and before the formatter gives it
   * a tick context it has no origin (`getAbsoluteX()`'s `NoTickContext`). VexFlow's extra
   * `UnformattedNote` check is not transcribed — the formatter builds the tick contexts and pre-formats
   * in the same `format()` call, so nothing asks in between (and `fanArticulations`' probe, which orders
   * itself by that throw, is a plain `StaveNote` that keeps it).
   */
  getModifierStartXY(
    position: number, index: number, options: { forceFlagRight?: boolean } = {},
  ): { x: number; y: number } {
    const ruler = noteRuler(this)
    const headY = ruler.headYs[index]
    return modifierStart(SIDE_OF_POSITION[position] ?? 'center', index, {
      originX: ruler.originX,
      glyphWidth: ruler.glyphWidth,
      xShift: this.xInputs().xShift,
      stemDirection: ruler.stemDirection,
      hasFlag: ruler.hasFlag,
      flagWidth: () => this.flag.getWidth(),
      hasStem: ruler.hasStem,
      stemX: () => ruler.stemX,
      // One y per head — the same count VexFlow's `keyProps` has, asked of the ruler.
      headCount: ruler.headYs.length,
      headY,
      headGlyph: this.headGlyph(index),
      spacePx: requireNoteFrame(this).spacePx,
      markAnchor: this.markAnchor,
    }, !!options.forceFlagRight)
  }

  drawFlag(): void {
    if (!this.shouldDrawFlag()) return
    const { yTop, yBottom } = this.getNoteHeadBounds()
    const up = noteRuler(this).stemDirection !== STEM_DOWN
    // ⚠️ `Stem.getHeight()` is SIGNED by the stem's direction, which is what lets one subtraction
    // answer both ways up — VexFlow spells it as two branches and this is the same arithmetic.
    const tipY = (up ? yBottom : yTop) - this.checkStem().getHeight()
    const metrics = this.flag.getTextMetrics()
    const reach = up ? metrics.actualBoundingBoxAscent : metrics.actualBoundingBoxDescent
    const at = flagPlacement({ x: this.getStemX(), tipY, up }, STEM_THICKNESS_PX, reach)

    // 🚨🚨 **THE WRITE-BACK, and it is the whole reason this class keeps the object.** VexFlow's own
    // `drawFlag` is `this.flag.setContext(ctx).setX(flagX).setY(flagY).drawWithStyle()` — the
    // position is written ONTO the `Flag` as a side effect of painting it, and
    // `StaveNote.getBoundingBox()` then merges `this.flag.getBoundingBox()` whenever `hasFlag()`
    // (⭐ which is false for a BEAMED note — `codeFlagUp !== undefined && !this.beam`, so only an
    // unbeamed flagged note ever consults it).
    //
    // ⛔ Taking the INK without the write-back left the flag at the ORIGIN, and an `Element`'s box
    // is `(x + xShift, y + yShift − ascent, …)` ⇒ every eighth, sixteenth and thirty-second that is
    // not beamed reported a box merged with (0, −ascent): measured on his score at
    // `{x: 0, y: −33, w: 258, h: 122}` — the whole system. HIS REPORT, 2026-09-14, was the SLUR:
    // the obstacle solver read that box as an intrusion spanning the bar and lifted the arch 361 px.
    // ⭐ *A `Modifier` drawn at explicit coordinates without its own x/y drags a note's bbox to
    // zero* was already a written rule here (`reference: vexflow modifier bbox needs x y`), and
    // `EngravedAccidental`, `EngravedDot` and the notehead's `setX` above all obey it; this was the
    // one member of the family that stopped painting without keeping its answer.
    //
    // ⚠️ The numbers are VexFlow's own, not a re-derivation: `flagPlacement` folds its two branches
    // into one subtraction, and `STEM_THICKNESS_PX` is `Tables.STEM_WIDTH`'s 1.5. ⇒ the box is what it was.
    this.flag.setX(at.x)
    this.flag.setY(at.baselineY)

    drawFlag(
      this.inkSurface ?? this.checkContext(),
      this.flag.getText(),
      at,
      // ⭐ The note's face, which its flag shares (`engrave/inheritedFonts`) — handed over as a value,
      // which is what keeps `engrave/` free of `vexflow` (see that module's header).
      NOTE_FONT,
    )
  }
}

/**
 * Point every note of a bar at the surface its own ink draws on, before the voices are drawn.
 *
 * ⭐ **Why the renderer has to say this at all**: `voice.draw(ctx, stave)` hands VexFlow the real
 * `SVGContext` — it has to, because VexFlow's objects still paint themselves through it — and a note
 * that took its ledger surface from there would be invisible to `recordScene`. This is the one line
 * that keeps the ink we have taken back inside the scene.
 *
 * Takes `StaveNote[]` because that is what every caller holds; a plain one (a ghost's) is skipped and
 * keeps drawing its own ledgers.
 */
/**
 * The stem a note carries — ours, or none. ⭐ The ONE cast back out of the note's API (typed for
 * VexFlow's `Stem`, S12i); a stem that is not ours is refused loudly rather than half-served.
 */
export function stemOf(note: { getStem(): unknown }): EngravedStem | undefined {
  const stem = note.getStem()
  if (stem === undefined || stem === null) return undefined
  if (!(stem instanceof EngravedStem)) throw new Error('stemOf: a stem that is not an EngravedStem')
  return stem
}

export function drawNoteInkThrough(notes: readonly EngravedNote[], ctx: DrawContext): void {
  for (const note of notes) {
    note.setInkSurface(ctx)
    stemOf(note)?.setInkSurface(ctx)
    // ⭐ …and every MODIFIER that can take one — the accidental, the augmentation dot and the
    // ARTICULATION (all 2026-09-14). ⚠️ Asked as a MEMBERSHIP, ⛔ not as a third, fourth and fifth
    // `instanceof`: that is the family `./inkSurface` exists for, and joining it is what a new one
    // implements — the articulation joined it by adding a row and nothing else. A modifier that
    // does not (a `CenteredTremolo`, an `Annotation`) keeps painting itself on VexFlow's context,
    // which is the honest state of the migration.
    for (const modifier of note.getModifiers()) {
      if (acceptsInkSurface(modifier)) modifier.setInkSurface(ctx)
    }
  }
}

/**
 * Shorten a note's ledger lines — the one thing anybody adjusts about them
 * (`./ledgerAccidentalClearance`: *"an expert engraver will shorten a ledger line to allow closer
 * spacing with accidentals"*).
 *
 * ⚠️ It used to be a poke at `renderOptions.strokePx`, one of §2.4's *"renderOptions written as a
 * field, not an API"* repairs. A plain `StaveNote` (the ghost's) still needs that poke, because its
 * ledgers are still VexFlow's — ⛔ that branch is the honest state of the migration, not a fallback
 * for a value we could not compute.
 */
export function trimLedgers(note: EngravedNote, overhang: number): void {
  note.setLedgerOverhang(overhang)
}
