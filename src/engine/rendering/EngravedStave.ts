/**
 * ⭐⭐ **A SCORE STAVE — ours: its five lines, the signs it carries, and (since S12h) the object itself**
 * (`docs/own-engraving-engine.md` P5, `docs/vexflow-removal-map.md` S4; the line ink is
 * `engrave/staff/staffLines`).
 *
 * | | ours since | where |
 * |---|---|---|
 * | the five LINES | P5a | `engrave/staff/staffLines`, drawn by {@link EngravedStave.draw} |
 * | the SIGNS' ink — clef, meter, opening barline | P5b | `./EngravedClef`, `./EngravedTimeSignature`, `./EngravedBarline` |
 * | where the signs STAND, and the note area's start and end | S4b1 | {@link EngravedStave.format}, our walk (`engrave/staff/signWalk`) |
 * | the SIGNS themselves | S4c | one list of plain objects of ours ({@link EngravedStave.signs}), ⛔ not VexFlow's `modifiers` |
 *
 * ⭐ **S12h — no longer VexFlow's `Stave`.** The object is ours too: its x, y and width, VexFlow's
 * `Stave` options as its constructor made them (5 lines a space of 10 apart, 4 spaces of headroom, the
 * text rows), its context, its own `staveN` id and the default ledger style merged as
 * `getDefaultLedgerLineStyle` merged it. ⚠️ A VexFlow NOTE still stands on it (`Note.setStave`,
 * `NoteHead.setStave`, `ClefNote.draw`) and asks it `getYForLine`, `getYForNote`, `getYForTopText` /
 * `getYForBottomText`, `getSpacingBetweenLines`, `getNumLines`, `getNoteStartX`,
 * `getDefaultLedgerLineStyle` and `getContext` — every one answered here, and `./staveFrame`'s
 * `standOn` / `staveOf` are the one cast each way across the note's API until the note is ours.
 * ⭐ Since S4e nothing outside a bar's group reads its position: a score-level pass asks the PLACED
 * frame (`./staveFrame`'s header), so this object's x and y are only ever where the bar was BUILT.
 * ⚠️ The key signature was never among the signs — `KeySignaturePass` draws it, through our own context.
 *
 * 🚨🚨 **The group is load-bearing and its class is the seam.** `g.stave path` is what the browser
 * harness (`e2e/harness.ts`) and the spacing census read to find staff lines, and both filter for a
 * `<path>` with exactly two points at equal y. ⛔ So the lines must stay STROKED PATHS inside a group
 * opened as `openGroup('stave', …)` — which is why {@link drawStaffLines} strokes rather than filling.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Clef as ScoreClef, TimeSignature as Meter } from '@/types/music'
import type { ClefSize } from '@/engine/engrave/header/clefSign'
import type { BarlineKind } from '@/engine/engrave/staff/barlineMetrics'
import { STAVE_LINE_WIDTH_PX, drawStaffLines, staffLinesInk } from '@/engine/engrave/staff/staffLines'
import { EngravedBarline } from './EngravedBarline'
import { EngravedClef } from './EngravedClef'
import { EngravedTimeSignature } from './EngravedTimeSignature'
import type { StaveSign } from './staveSign'
import { walkSigns } from '@/engine/engrave/staff/signWalk'
import { barFrame, staveFrame } from './staveFrame'
import { noteLineY, staffLineY } from '@/engine/engrave/staff/staffFrame'
import { STAVE_LINE_DISTANCE_PX } from '@/engine/engrave/inheritedDefaults'

/** Which end of the bar a sign stands at. */
export type SignSide = 'opening' | 'closing'

/** VexFlow's `Stave` options, as this editor builds every stave — `stave.js`'s defaults, the fields read. */
interface StaveOptions {
  numLines: number
  spacingBetweenLinesPx: number
  spaceAboveStaffLn: number
  spaceBelowStaffLn: number
  topTextPosition: number
  bottomTextPosition: number
  lineConfig: { visible: boolean }[]
}

/** A stroke style — `Element`'s `ElementStyle`, the fields a ledger line reads. */
export interface StaveStyle {
  strokeStyle?: string
  lineWidth?: number
}

/**
 * A stave's own style — `Metrics.getStyle('Stave')`, which the default LEDGER style is merged over
 * (`Stave.getDefaultLedgerLineStyle`). ⚠️ Nothing strokes with it: every ledger style set here names
 * both fields, so it only ever supplies the merge's key ORDER.
 */
const STAVE_STYLE: StaveStyle = { strokeStyle: '#999999' }

/** VexFlow's default ledger style, until one is set (`stave.js:56`). */
const DEFAULT_LEDGER_STYLE: StaveStyle = { strokeStyle: '#444', lineWidth: 2 }

/** A stave's box — the `x/y/w/h` shape VexFlow's `BoundingBox` had. */
export interface StaveBox {
  x: number
  y: number
  w: number
  h: number
}

/** Our staves' ids — their own counter, as `beamN`, `signN` and `tupletN` are. */
let nextStaveId = 0

export class EngravedStave {
  /**
   * The surface this stave's lines and signs draw on — `RenderPass.context`, which is the recorder during
   * a `recordScene` render and the real painter otherwise. Null until {@link drawStaveInkThrough} sets it,
   * and then the stave falls back to `checkContext()`, so an unset surface is a lost SCENE entry and
   * ⛔ never a lost pixel. (`EngravedBeam.inkSurface` carries the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /**
   * ⭐ **Every sign this stave carries, in the order it was added** — drawn in that order, so the SVG
   * keeps the element order VexFlow's `modifiers` gave it (the opening barline, the closing one, then
   * the header signs, then the closing ones).
   */
  private readonly signList: { sign: StaveSign; side: SignSide }[] = []
  /** The barline every stave OPENS with — plain, as VexFlow's constructor made it. */
  private readonly openingBarline = new EngravedBarline('single')
  /** The barline every stave CLOSES with — plain, until the renderer says otherwise. */
  private readonly closingBarline = new EngravedBarline('single')

  /** Whether the walk has run since the last sign was added — VexFlow's `formatted`, as ours. */
  private walked = false
  /** ⭐ Where the note area starts and ends (S4b1): the walk writes them, `applyLeadIn` moves the start. */
  private noteStart = 0
  private noteEnd = 0

  private readonly x: number
  private readonly y: number
  private readonly width: number
  /** VexFlow's `Stave` options, as its constructor made them — `resetLines` included. */
  readonly options: StaveOptions
  private readonly id = `stave${++nextStaveId}`
  private context?: DrawContext
  private rendered = false
  private ledgerStyle: StaveStyle = { ...DEFAULT_LEDGER_STYLE }

  constructor(x: number, y: number, width: number) {
    this.x = x
    this.y = y
    this.width = width
    const numLines = 5
    this.options = {
      numLines,
      spacingBetweenLinesPx: STAVE_LINE_DISTANCE_PX,
      spaceAboveStaffLn: 4,
      spaceBelowStaffLn: 4,
      topTextPosition: 1,
      // `resetLines` sets it to the line count.
      bottomTextPosition: numLines,
      lineConfig: Array.from({ length: numLines }, () => ({ visible: true })),
    }
    this.signList.push({ sign: this.openingBarline, side: 'opening' }, { sign: this.closingBarline, side: 'closing' })
  }

  // ── what the stave IS: where it stands, its lines, its context ─────────────────────────────────

  getX(): number {
    return this.x
  }

  getY(): number {
    return this.y
  }

  getWidth(): number {
    return this.width
  }

  getAttribute(name: string): string | undefined {
    return name === 'id' ? this.id : undefined
  }

  setContext(context: DrawContext): this {
    this.context = context
    return this
  }

  /** The page's context — a note standing on this stave takes it (`Note.setStave`). */
  getContext(): DrawContext | undefined {
    return this.context
  }

  checkContext(): DrawContext {
    if (!this.context) throw new Error('EngravedStave: no rendering context attached.')
    return this.context
  }

  setRendered(rendered = true): this {
    this.rendered = rendered
    return this
  }

  isRendered(): boolean {
    return this.rendered
  }

  getNumLines(): number {
    return this.options.numLines
  }

  getSpacingBetweenLines(): number {
    return this.options.spacingBetweenLinesPx
  }

  /** `Stave.getYForLine` — the stave's y, its headroom, and `line` spaces down. */
  getYForLine(line: number): number {
    const { spacingBetweenLinesPx: spacing, spaceAboveStaffLn: headroom } = this.options
    return this.y + line * spacing + headroom * spacing
  }

  getYForTopText(line = 0): number {
    return this.getYForLine(-line - this.options.topTextPosition)
  }

  getYForBottomText(line = 0): number {
    return this.getYForLine(this.options.bottomTextPosition + line)
  }

  getTopLineTopY(): number {
    return this.getYForLine(0)
  }

  /** `Stave.getBottomY` — the line past the last, and the space below. */
  getBottomY(): number {
    const { numLines, spaceBelowStaffLn, spacingBetweenLinesPx } = this.options
    return this.getYForLine(numLines) + spaceBelowStaffLn * spacingBetweenLinesPx
  }

  getBoundingBox(): StaveBox {
    return { x: this.x, y: this.y, w: this.width, h: this.getBottomY() - this.y }
  }

  setDefaultLedgerLineStyle(style: StaveStyle): void {
    this.ledgerStyle = style
  }

  /** `Stave.getDefaultLedgerLineStyle` — the stave's own style with the ledger style laid over it. */
  getDefaultLedgerLineStyle(): StaveStyle {
    return { ...STAVE_STYLE, ...this.ledgerStyle }
  }

  /** Which barline the stave opens with — VexFlow's `setBegBarType` allowed exactly these three. */
  setOpeningBarline(kind: 'single' | 'repeatBegin' | 'none'): this {
    this.openingBarline.setKind(kind)
    this.walked = false
    return this
  }

  /** Which barline the stave closes with — anything but a start repeat, as `setEndBarType` allowed. */
  setClosingBarline(kind: Exclude<BarlineKind, 'repeatBegin'>): this {
    this.closingBarline.setKind(kind)
    this.walked = false
    return this
  }

  /**
   * ⭐ A clef, at either end of the bar. (The gutter's staves are not staves at all since S4d —
   * `./GutterRenderer` draws the same sign objects itself.)
   */
  addClefSign(clef: ScoreClef, size: ClefSize, side: SignSide = 'opening'): this {
    return this.addSign(new EngravedClef(clef, size), side)
  }

  /** ⭐ A time signature, built from the score's own `TimeSignature` (`engrave/header/meterSign`). */
  addMeter(meter: Meter, side: SignSide = 'opening'): this {
    return this.addSign(new EngravedTimeSignature(meter), side)
  }

  private addSign(sign: StaveSign, side: SignSide): this {
    this.signList.push({ sign, side })
    this.walked = false
    return this
  }

  /** Every sign this stave carries, OPENING and CLOSING, each in the order it was added. */
  signs(): { opening: StaveSign[]; closing: StaveSign[] } {
    return {
      opening: this.signList.filter(entry => entry.side === 'opening').map(entry => entry.sign),
      closing: this.signList.filter(entry => entry.side === 'closing').map(entry => entry.sign),
    }
  }

  /**
   * ⭐⭐ **OUR walk places this stave's signs** (`engrave/staff/signWalk`, a port of `Stave.format()`).
   *
   * The inputs are the signs' own ({@link StaveSign.walkInput}) and the answers go back onto them
   * ({@link StaveSign.signX}), with the note area's start and end. ⚠️ It runs exactly when `format()`
   * always ran: the first time the note area is asked for (`applyLeadIn`'s `setNoteStartX`), and again
   * only after a sign is added or a barline changes.
   */
  format(): void {
    const { opening, closing } = this.signs()
    const bar = barFrame(this)
    const walk = walkSigns(bar.x, bar.width, opening.map(sign => sign.walkInput()), closing.map(sign => sign.walkInput()))
    opening.forEach((sign, i) => { sign.signX = walk.opening[i] })
    closing.forEach((sign, i) => { sign.signX = walk.closing[i] })
    this.noteStart = walk.noteStartX
    this.noteEnd = walk.noteEndX
    this.walked = true
  }

  /** `Stave.getNoteStartX` — walked first if a sign was added since. */
  getNoteStartX(): number {
    if (!this.walked) this.format()
    return this.noteStart
  }

  /** `Stave.setNoteStartX` — the walk runs first, then the lead-in's start replaces its own. */
  setNoteStartX(x: number): this {
    if (!this.walked) this.format()
    this.noteStart = x
    return this
  }

  /** `Stave.getNoteEndX` — walked first if a sign was added since. */
  getNoteEndX(): number {
    if (!this.walked) this.format()
    return this.noteEnd
  }

  /**
   * ⭐⭐ **OURS as of S6d — the y of a NOTE LINE on this staff, and with it every notehead's own `y`.**
   *
   * ⚠️ **One override, and it reaches further than it looks.** The only callers in VexFlow are
   * `NoteHead.setStave` — which is how each head of a chord gets its `y` field — and the ledger drawing
   * this editor already replaced. ⇒ making this ours settles the last of S6c's ⏳ list in one place:
   * the heads' `y`, `getNoteHeadBounds` (which reads it), and the stem's y bounds (which `setStave`
   * derives from those bounds). ⛔ No `setStave` override of our own, and ⛔ no second walk over the
   * heads to correct a y that was just written.
   *
   * ⚠️ **Equal to `Stave.getYForNote`, but grouped as the frame groups it** — `(y + 4·space) +
   * (5 − line)·space` against VexFlow's `y + 4·space + 5·space − line·space`. S6c measured that pair as
   * bit-identical on every fixture; it is only GUARANTEED to a rounding, so a staff at some other y
   * could differ in the last bit. ⭐ Rule 5: no `top + n × space` here — the arithmetic is the frame's.
   */
  getYForNote(line: number): number {
    return noteLineY(staveFrame(this), line)
  }

  /** @see EngravedStave.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ The five lines and every sign, through our own primitives.
   *
   * ⚠️ **Each sign is drawn between the page context's `save` and `restore`**, because VexFlow's
   * `drawWithStyle` did exactly that around every modifier — and on its SVG context those two snapshot
   * and restore the FONT state, which decides whether a later `<text>` carries its own font attributes.
   */
  draw(): void {
    // ⭐ The page's context, as OUR `DrawContext` — VexFlow's SVG context satisfies it structurally (P1b).
    const page: DrawContext = this.checkContext()
    const surface = this.inkSurface ?? page
    this.setRendered()

    surface.openGroup('stave', this.id)
    try {
      if (!this.walked) this.format()
      drawStaffLines(surface, this.staffLineInk())
    } finally {
      surface.closeGroup()
    }

    const frame = staveFrame(this)
    for (const { sign } of this.signList) {
      page.save()
      sign.drawSign(surface, frame, page)
      page.restore()
    }
    // ⛔ VexFlow's measure NUMBER is not transcribed: it drew only after `setMeasure`, which this editor
    // never called — the branch was unreachable, and an object of ours has no `setMeasure` to reach it.
  }

  /**
   * Every visible line of this stave, as ink. ⚠️ `lineConfig[line].visible` is VexFlow's own per-line
   * switch and is honoured here: an invisible line is a feature of the object we are subclassing, not a
   * case we get to drop. ⭐ It is what a one-line percussion staff would use.
   */
  private staffLineInk() {
    const frame = staveFrame(this)
    const ys: number[] = []
    for (let line = 0; line < frame.lineCount; line++) {
      if (this.options.lineConfig[line].visible) ys.push(staffLineY(frame, line))
    }
    const bar = barFrame(this)
    return staffLinesInk(bar.x, bar.width, ys, STAVE_LINE_WIDTH_PX)
  }
}

/**
 * Point every stave of a render at the surface its lines draw on, before they are drawn — the twin
 * of `EngravedBeam`'s `drawBeamInkThrough`, and it exists for the same reason: `stave.setContext()`
 * gets the real `SVGContext`, and a stave that took its lines' surface from there would be invisible
 * to `recordScene`.
 */
export function drawStaveInkThrough(staves: readonly EngravedStave[], ctx: DrawContext): void {
  for (const stave of staves) stave.setInkSurface(ctx)
}

/** ⭐ **The signs a score stave carries** — S4b1. */
export function staveSigns(stave: EngravedStave): { opening: StaveSign[]; closing: StaveSign[] } {
  return stave.signs()
}
