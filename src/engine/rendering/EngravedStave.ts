/**
 * ⭐⭐ **A SCORE STAVE — its five lines and the signs it carries, ours; the rest still VexFlow's `Stave`**
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
 * ⚠️ **What is still VexFlow's**: the object itself — its x, y, width and line spacing (read through
 * `./staveFrame`), its context and id, its ledger style. ⭐ Since S4e nothing outside a bar's group reads
 * its position: a score-level pass asks the PLACED frame (`./staveFrame`'s header), so this object's
 * x and y are only ever where the bar was BUILT. ⏭️ It stops extending `Stave` when a note no longer
 * needs one to stand on (`Note.setStave`, S6/S9).
 *
 * ⚠️ VexFlow's own constructor still puts two `Barline`s in its `modifiers`. Nothing reads them any
 * more — `format`, `draw` and the note-area getters are overridden, and `getModifiers` /
 * `getModifierXShift` are asked of no score stave — so they sit there unused rather than being fought.
 *
 * ⚠️ The key signature was never among the signs — `KeySignaturePass` draws it, through our own context.
 *
 * 🚨🚨 **The group is load-bearing and its class is the seam.** `g.vf-stave path` is what the browser
 * harness (`e2e/harness.ts`) and the spacing census read to find staff lines, and both filter for a
 * `<path>` with exactly two points at equal y. ⛔ So the lines must stay STROKED PATHS inside a group
 * opened as `openGroup('stave', …)` — which is why {@link drawStaffLines} strokes rather than filling.
 */
import { Stave } from 'vexflow'
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
import { drawGlyph, measureGlyph } from './glyphPainter'
import { MEASURE_NUMBER_SIZE_PT } from '@/engine/engrave/inheritedFonts'
import { barFrame, staveFrame } from './staveFrame'
import { noteLineY, staffLineY, textRowAboveY } from '@/engine/engrave/staff/staffFrame'

/** Which end of the bar a sign stands at. */
export type SignSide = 'opening' | 'closing'

export class EngravedStave extends Stave {
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

  constructor(x: number, y: number, width: number) {
    super(x, y, width)
    this.signList.push({ sign: this.openingBarline, side: 'opening' }, { sign: this.closingBarline, side: 'closing' })
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
   * ⭐ A clef, at either end of the bar. ⭐ **The GHOST staves are deliberately not affected**: they are
   * plain `Stave`s, so they keep VexFlow's clef exactly as they keep VexFlow's staff lines. (The gutter's
   * are not staves at all since S4d — `./GutterRenderer` draws the same sign objects itself.)
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
  override format(): void {
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
  override getNoteStartX(): number {
    if (!this.walked) this.format()
    return this.noteStart
  }

  /** `Stave.setNoteStartX` — the walk runs first, then the lead-in's start replaces its own. */
  override setNoteStartX(x: number): this {
    if (!this.walked) this.format()
    this.noteStart = x
    return this
  }

  /** `Stave.getNoteEndX` — walked first if a sign was added since. */
  override getNoteEndX(): number {
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
  override getYForNote(line: number): number {
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
  override draw(): void {
    // ⭐ The page's context, as OUR `DrawContext` — VexFlow's SVG context satisfies it structurally (P1b).
    const vex: DrawContext = this.checkContext()
    const surface = this.inkSurface ?? vex
    this.setRendered()

    surface.openGroup('stave', this.getAttribute('id'))
    try {
      if (!this.walked) this.format()
      drawStaffLines(surface, this.staffLineInk())
    } finally {
      surface.closeGroup()
    }

    const frame = staveFrame(this)
    for (const { sign } of this.signList) {
      vex.save()
      sign.drawSign(surface, frame, vex)
      vex.restore()
    }

    // ⚠️ Transcribed for completeness and ⛔ unreachable in this repo: `setMeasure` is never called,
    // so `measure` is always 0. Kept so that calling it would still draw, rather than silently not.
    if (this.measure > 0) {
      // ⚠️ Upstream measured through the SVG context; the glyph painter measures on a canvas. Both
      // are the same face at `Stave.fontSize` — and this branch never runs (above).
      const label = '' + this.measure
      const textWidth = measureGlyph('EngravedStave.measure', label, MEASURE_NUMBER_SIZE_PT)
      drawGlyph(vex, 'EngravedStave.measure', label, barFrame(this).x - textWidth / 2, textRowAboveY(staveFrame(this), 0) + 3, MEASURE_NUMBER_SIZE_PT)
    }
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
export function drawStaveInkThrough(staves: readonly Stave[], ctx: DrawContext): void {
  for (const stave of staves) {
    if (stave instanceof EngravedStave) stave.setInkSurface(ctx)
  }
}

/**
 * ⭐ **The signs a score stave carries** — S4b1. ⛔ Only a stave of ours has any: a plain VexFlow `Stave`
 * (a ghost's) is walked by VexFlow and never reaches a pass that asks.
 */
export function staveSigns(stave: Stave): { opening: StaveSign[]; closing: StaveSign[] } {
  if (!(stave instanceof EngravedStave)) throw new Error('staveSigns: not a score stave')
  return stave.signs()
}
