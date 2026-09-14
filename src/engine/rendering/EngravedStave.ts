/**
 * ⭐⭐ **THE SEAM WHERE THE STAFF'S LINES COME BACK TO US — P5a**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/staff/staffLines`).
 *
 * `Stave.draw()` is three things in a fixed order, and only the FIRST is the staff:
 *
 * ```js
 * ctx.openGroup('stave', id)
 * …the five lines…        // ← P5a: now `engrave/staff/staffLines`
 * ctx.closeGroup()
 * for (modifier of this.modifiers) modifier.drawWithStyle()   // ← P5b took the CLEF + METER; below
 * if (this.measure > 0) …the measure number…                  // ⛔ unreachable here, see below
 * ```
 *
 * ⭐ **So P5a is the same shape P4a was**: the ink that had two owners moves to one module, the
 * objects that paint themselves keep the VexFlow context, and no pixel moves.
 *
 * ## ⛔ What this does NOT take
 *
 * ⭐⭐ **Nothing this stave draws is VexFlow's ink any more.** P5b took the CLEF (`EngravedClef` +
 * `engrave/header/clef`, 2026-09-02), the METER (`EngravedTimeSignature` + `engrave/header/meter`,
 * 2026-09-12) and the opening BARLINE (`EngravedBarline` + `engrave/staff/openingBarline`,
 * 2026-09-13); {@link EngravedStave.addClef}, {@link EngravedStave.addMeter} and the
 * constructor below are what put ours on every stave of the page.
 * ⚠️ The key signature was never among the modifiers at all — `stave.addKeySignature` is never called
 * in this repo; `KeySignaturePass` draws it, and already through our own context.
 *
 * ⭐ **And the parent plan's other half has followed it** — *"`headerInk.ts` already MEASURES what a
 * clef and a meter cost; `Stave` still PLACES them"*. `rendering/headerPlacementPass` now places the
 * line-opening clef and the meter from INK, and ⭐ since S4b1 the walk under them is ours too
 * ({@link EngravedStave.format}); a MID-BAR clef change still sits at the walk's 0.5 sp because nobody
 * has chosen otherwise.
 *
 * ⚠️ **A subclass, for the reason `EngravedBeam` and `EngravedStem` are ones.** Every number read
 * below is public API (`getX`, `getWidth`, `getYForLine`, `getNumLines`, `options`) or `protected`
 * and therefore ours by inheritance (`formatted`, `measure`, `modifiers`) — the body is VexFlow's own
 * arithmetic MOVED, ⛔ not rewritten.
 *
 * 🚨🚨 **The group is load-bearing and its class is the seam.** `g.vf-stave path` is what the browser
 * harness (`e2e/harness.ts`) and the spacing census read to find staff lines, and both filter for a
 * `<path>` with exactly two points at equal y. ⛔ So the lines must stay STROKED PATHS inside a group
 * opened as `openGroup('stave', …)` — which is why {@link drawStaffLines} strokes rather than filling,
 * even though a filled bar is the honester description of the ink.
 */
import { Barline, Stave, StaveModifierPosition, type StaveOptions } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { TimeSignature as Meter } from '@/types/music'
import { STAVE_LINE_WIDTH_PX, drawStaffLines, staffLinesInk } from '@/engine/engrave/staff/staffLines'
import { EngravedBarline } from './EngravedBarline'
import { EngravedClef } from './EngravedClef'
import { EngravedTimeSignature } from './EngravedTimeSignature'
import { acceptsInkSurface } from './inkSurface'
import { isStaveSign, type StaveSign } from './staveSign'
import { walkSigns } from '@/engine/engrave/staff/signWalk'
import { drawGlyph, measureGlyph } from './glyphPainter'
import { MEASURE_NUMBER_SIZE_PT } from '@/engine/engrave/inheritedFonts'
import { barFrame, staveFrame } from './staveFrame'
import { staffLineY, textRowAboveY } from '@/engine/engrave/staff/staffFrame'

export class EngravedStave extends Stave {
  /**
   * The surface this stave's lines draw on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Null until {@link drawStaveInkThrough} sets
   * it, and then the stave falls back to `checkContext()`, so an unset surface is a lost SCENE entry
   * and ⛔ never a lost pixel. (`EngravedBeam.inkSurface` carries the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /**
   * ⭐⭐ **P5b — the two barlines VexFlow's own constructor made are OURS.**
   *
   * ⚠️ Unlike the clef and the meter, a stave's barlines are not added by a caller we could
   * intercept: `Stave`'s constructor hard-codes `new Barline(...)` into `modifiers[0]` and
   * `modifiers[1]` (`stave.js:55`), and `setBegBarType`/`setEndBarType` write the TYPE straight into
   * those two slots by index. ⇒ the substitution must be a REPLACEMENT IN PLACE that keeps both
   * positions, ⛔ not an `addModifier` (which appends, and would leave the originals drawing).
   *
   * ⭐ Both are replaced, not just the opening one. The END barline is forced to `NONE` on every
   * score stave (`BarlineRenderer` draws every line that ends a bar), so it paints nothing either
   * way — but it is still READ as a position (`endBoundaryX`), and one owner for a pair is the whole
   * point of a family. ⚠️ The type is carried over, so this changes no picture.
   *
   * ⭐ **The barlines the walk invents are VALUES since S4b1** (`engrave/staff/signWalk`): an empty one
   * before a closing meter, a plain one before a start repeat's header. They take room and draw nothing —
   * ⛔ VexFlow's `format()`, which spliced a real `new Barline(SINGLE)` that WOULD have drawn 1 px of its
   * own ink, no longer runs on a score stave.
   */
  constructor(x: number, y: number, width: number, options?: StaveOptions) {
    super(x, y, width, options)
    this.modifiers[0] = this.engraved(this.modifiers[0] as Barline)
    this.modifiers[1] = this.engraved(this.modifiers[1] as Barline)
  }

  /**
   * ⭐⭐ **S4b1 — OUR walk places this stave's signs** (`engrave/staff/signWalk`, a port of `Stave.format()`).
   *
   * The inputs are the signs' own ({@link StaveSign.walkInput}) and the answers go back onto them
   * ({@link StaveSign.signX}), with the note area's start and end — so nothing here reads or writes
   * VexFlow's `x` on a sign. ⚠️ It runs exactly when `format()` always ran: the first time the note area
   * is asked for (`applyLeadIn`'s `setNoteStartX`), and again only after a sign is added.
   */
  override format(): void {
    const { opening, closing } = this.signs()
    const bar = barFrame(this)
    const walk = walkSigns(bar.x, bar.width, opening.map(sign => sign.walkInput()), closing.map(sign => sign.walkInput()))
    opening.forEach((sign, i) => { sign.signX = walk.opening[i] })
    closing.forEach((sign, i) => { sign.signX = walk.closing[i] })
    this.noteStart = walk.noteStartX
    this.noteEnd = walk.noteEndX
    this.formatted = true
  }

  /**
   * ⭐ **Where the note area starts and ends is ours too** (S4b1): the walk writes it here, `applyLeadIn`
   * moves the start, and VexFlow's own `startX`/`endX` are no longer read — `Stave`'s note-area getters are
   * overridden below, and nothing else in VexFlow that this editor uses reads those fields.
   */
  private noteStart = 0
  private noteEnd = 0

  /** `Stave.getNoteStartX` — walked first if a sign was added since. */
  override getNoteStartX(): number {
    if (!this.formatted) this.format()
    return this.noteStart
  }

  /** `Stave.setNoteStartX` — the walk runs first, then the lead-in's start replaces its own. */
  override setNoteStartX(x: number): this {
    if (!this.formatted) this.format()
    this.noteStart = x
    return this
  }

  /** `Stave.getNoteEndX` — walked first if a sign was added since. */
  override getNoteEndX(): number {
    if (!this.formatted) this.format()
    return this.noteEnd
  }

  /**
   * Every sign this stave carries, OPENING and CLOSING, in the order they were added.
   * ⛔ Refuses a modifier that is not one of ours — the walk has no inputs for it.
   */
  signs(): { opening: StaveSign[]; closing: StaveSign[] } {
    const opening: StaveSign[] = []
    const closing: StaveSign[] = []
    for (const modifier of this.modifiers) {
      if (!isStaveSign(modifier)) throw new Error('EngravedStave: a stave modifier that is not one of our signs')
      const position = modifier.getPosition()
      if (position === StaveModifierPosition.BEGIN) opening.push(modifier)
      else if (position === StaveModifierPosition.END) closing.push(modifier)
    }
    return { opening, closing }
  }

  /** One of VexFlow's barlines as one of ours — same type, same position, same stave. */
  private engraved(barline: Barline): EngravedBarline {
    const mine = new EngravedBarline(barline.getType())
    mine.setPosition(barline.getPosition())
    mine.setStave(this)
    return mine
  }

  /** @see EngravedStave.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P5a** — the five lines, through our own primitives.
   *
   * ⚠️ The `openGroup` really does come before `format()`, as it does upstream: the group is opened
   * on the id, not on anything the format computes, and moving it would change the SVG's element
   * order for no reason.
   */
  override draw(): void {
    const vex = this.checkContext()
    const surface = this.inkSurface ?? vex
    this.setRendered()

    surface.openGroup('stave', this.getAttribute('id'))
    try {
      if (!this.formatted) this.format()
      drawStaffLines(surface, this.staffLineInk())
    } finally {
      surface.closeGroup()
    }

    for (const modifier of this.modifiers) {
      // ⭐ Every modifier a score stave carries has been taken by P5b — the CLEF, the METER and the
      // opening BARLINE — so each draws on OUR surface and is handed it here: the modifier walk is
      // the one place that knows both the stave's surface and its modifiers. ⭐ `acceptsInkSurface`
      // is what keeps that a MEMBERSHIP rather than a growing chain of `instanceof` — see
      // `./inkSurface`. ⚠️ VexFlow's context is still passed as well, because a modifier this repo
      // never adds (or one a future VexFlow adds for us) would still be entitled to paint itself.
      // ⚠️ `setContext` still happens for every one of them, those two included — `drawWithStyle`
      // calls `checkContext()` before it calls `draw()`, so a modifier without one throws.
      modifier.setContext(vex)
      modifier.setStave(this)
      if (acceptsInkSurface(modifier)) modifier.setInkSurface(surface)
      modifier.drawWithStyle()
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
   * ⭐⭐ **P5b — every clef this stave carries is one of OURS.**
   *
   * ⚠️ `Stave.addClef` hard-codes `new Clef(...)`, so this is the only way to substitute the
   * subclass without touching the six call sites that add a clef. The body is VexFlow's own
   * (`stave.js:321`) with that one word changed — `clef`/`endClef` are `protected` and therefore
   * ours to keep writing, and `getClef()` must keep answering or the header's own layout stops
   * working.
   *
   * ⭐ **The GHOST and GUTTER staves are deliberately not affected**: they are plain `Stave`s
   * (`GhostRenderer`, `GutterRenderer`), so they keep VexFlow's clef exactly as they keep VexFlow's
   * staff lines after P5a. A preview is not the page.
   */
  override addClef(clef: string, size?: string, annotation?: string, position?: number): this {
    if (position === undefined || position === StaveModifierPosition.BEGIN) {
      this.clef = clef
    } else if (position === StaveModifierPosition.END) {
      this.endClef = clef
    }
    this.addModifier(new EngravedClef(clef, size, annotation), position)
    return this
  }

  /**
   * ⭐⭐ **Every time signature this stave carries is one of OURS, built from the MODEL** — S4b0.
   *
   * ⚠️ `Stave.addTimeSignature` hard-codes `new TimeSignature(...)` (`stave.js:335`) and takes VexFlow's
   * spec STRING. This takes the score's `TimeSignature` itself, so the meter's rows are composed from
   * what the score says (`engrave/header/meterSign`) ⛔ rather than parsed back out of a string. ⭐ It
   * has none of `addClef`'s bookkeeping because VexFlow's has none — a meter is looked up through
   * `getModifiers(position, CATEGORY)`, ⛔ not held in a field.
   *
   * ⚠️ `customPadding` is left to the constructor's own default (15): naming it here would be a second
   * copy of a number nobody chose.
   *
   * ⭐ **The GHOST and GUTTER staves are deliberately not affected**: they are plain `Stave`s
   * (`GhostRenderer`, `GutterRenderer`), so they keep VexFlow's meter exactly as they keep VexFlow's
   * clef and staff lines. A preview is not the page.
   */
  addMeter(meter: Meter, position?: number): this {
    this.addModifier(new EngravedTimeSignature(meter), position)
    return this
  }

  /*
   * ⭐ `clefToMeterPadding` used to stand here — the clef→meter gap expressed as VexFlow's
   * `customPadding`, so that `Stave.format()`'s walk would land the meter in the right place
   * (`8849d2e`). ⛔ It decides nothing now: P5b's placement step PLACES the meter from the clef's own
   * ink (`rendering/headerPlacementPass`), which is how the same gap after a KEY SIGNATURE had always
   * been done. ⚠️ And the pair disagreed by a bearing — see `engrave/header/meter.meterOriginX`.
   *
   * ⚠️ The override below therefore passes `customPadding` straight through again, `undefined`
   * included: VexFlow's own default of 15 px still sizes the walk's slot, and nothing reads the
   * meter's walked x any more.
   */

  /**
   * Every visible line of this stave, as ink. ⚠️ `lineConfig[line].visible` is VexFlow's own per-line
   * switch and is honoured here for the reason the rest of the body is transcribed rather than
   * simplified: an invisible line is a feature of the object we are subclassing, not a case we get
   * to drop. ⭐ It is what a one-line percussion staff would use.
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
 * gets the real `SVGContext`, as it must while the modifiers still paint themselves, and a stave that
 * took its lines' surface from there would be invisible to `recordScene`.
 */
export function drawStaveInkThrough(staves: readonly Stave[], ctx: DrawContext): void {
  for (const stave of staves) {
    if (stave instanceof EngravedStave) stave.setInkSurface(ctx)
  }
}

/**
 * ⭐ **The signs a score stave carries** — S4b1. ⛔ Only a stave of ours has any: a plain VexFlow `Stave`
 * (a ghost's, the gutter's) is walked by VexFlow and never reaches a pass that asks.
 */
export function staveSigns(stave: Stave): { opening: StaveSign[]; closing: StaveSign[] } {
  if (!(stave instanceof EngravedStave)) throw new Error('staveSigns: not a score stave')
  return stave.signs()
}
