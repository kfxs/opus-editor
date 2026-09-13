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
 * 2026-09-13); {@link EngravedStave.addClef}, {@link EngravedStave.addTimeSignature} and the
 * constructor below are what put ours on every stave of the page.
 * ⚠️ The key signature was never among the modifiers at all — `stave.addKeySignature` is never called
 * in this repo; `KeySignaturePass` draws it, and already through our own context.
 *
 * ⛔ **What is left is the parent plan's other half**: *"`headerInk.ts` already MEASURES what a clef
 * and a meter cost; `Stave` still PLACES them"*. ⇒ P5b has taken every set of INK on this stave and
 * ⛔ not one PLACEMENT — every x below is still `Stave.format()`'s modifier walk.
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
import { STAVE_LINE_WIDTH_PX, drawStaffLines, staffLinesInk } from '@/engine/engrave/staff/staffLines'
import { EngravedBarline } from './EngravedBarline'
import { EngravedClef } from './EngravedClef'
import { EngravedTimeSignature } from './EngravedTimeSignature'
import { armedClefMeterInk } from '@/engine/layout/clefMeterGap'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { acceptsInkSurface } from './inkSurface'

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
   * ⛔ **`format()` can still splice PLAIN barlines into its own local lists**, and both arms are
   * worth knowing: a `new Barline(NONE)` before the end modifiers (`stave.js:387`), which draws
   * nothing; and a `new Barline(SINGLE)` before a REPEAT_BEGIN's other modifiers (`stave.js:384`),
   * which WOULD draw 1 px of VexFlow's own ink. ⭐ Unreachable here — nothing in this repo ever sets a
   * begin bar to `REPEAT_BEGIN` (`BarlineRenderer` draws every repeat itself, and
   * `VexFlowRenderer.drawMeasureContent` only ever sets `NONE`) — ⚠️ and the day something does, that
   * spliced line is the one that will not be ours.
   */
  constructor(x: number, y: number, width: number, options?: StaveOptions) {
    super(x, y, width, options)
    this.modifiers[0] = this.engraved(this.modifiers[0] as Barline)
    this.modifiers[1] = this.engraved(this.modifiers[1] as Barline)
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
      vex.setFont(this.fontInfo)
      const textWidth = vex.measureText('' + this.measure).width
      vex.fillText('' + this.measure, this.getX() - textWidth / 2, this.getYForTopText(0) + 3)
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
   * ⭐⭐ **P5b — every time signature this stave carries is one of OURS.**
   *
   * ⚠️ The twin of {@link EngravedStave.addClef}, and for the same reason: `Stave.addTimeSignature`
   * hard-codes `new TimeSignature(...)` (`stave.js:335`), so this is the only way to substitute the
   * subclass without touching the call sites. ⭐ It has none of `addClef`'s bookkeeping because
   * VexFlow's has none — a meter is looked up through `getModifiers(position, CATEGORY)`, ⛔ not held
   * in a field — so the body is its two lines with one word changed.
   *
   * ⚠️ `customPadding` is passed through UNTOUCHED, `undefined` included: the constructor's own
   * default is 15, and naming it here would be a second copy of a number nobody chose.
   *
   * ⭐ **The GHOST and GUTTER staves are deliberately not affected**: they are plain `Stave`s
   * (`GhostRenderer`, `GutterRenderer`), so they keep VexFlow's meter exactly as they keep VexFlow's
   * clef and staff lines. A preview is not the page.
   */
  override addTimeSignature(timeSpec: string, customPadding?: number, position?: number): this {
    this.addModifier(
      new EngravedTimeSignature(timeSpec, customPadding ?? this.clefToMeterPadding()),
      position,
    )
    return this
  }

  /**
   * ⭐⭐ **WHAT SEPARATES A CLEF FROM THE METER AFTER IT — ours as of 2026-09-12, and it is the last
   * gap of the header run that nobody had ever chosen** (`layout/clefMeterGap` carries the whole
   * finding; `docs/header-spacing-research.md` §4.4).
   *
   * `Stave.format()`'s begin walk is `x += padding; setX(x); x += width`, and
   * `StaveModifier.getPadding(i)` is **0 for `i < 2`** — so with the run `[Barline, Clef,
   * TimeSignature]` this one number IS the gap. It was VexFlow's `customPadding` default of **15 px**
   * (`timesignature.js:17`), which is why the drawn white measured **1.42 sp, identical for all four
   * clefs**: ⭐ nothing derived it from any glyph.
   *
   * **The arithmetic, and every term is named:**
   * - the armed rule is **clear white, INK to INK** (`armedClefMeterInk`);
   * - a clef has **no right side bearing** — Bravura's `gClef` ink `right` 2.684 IS its `advance`,
   *   and VexFlow's modifier box agrees with the font to 0.02 sp (`headerInkRightX`'s own
   *   measurement) — so the walk's `x += width` lands on the clef's INK edge and needs no correction;
   * - a digit's ink starts **0.08 sp BEFORE its origin** (`timeSig4.left` is −0.08), so the origin is
   *   set that much later. ⭐ Identical to `placeMeterAfterKeySignature`'s correction, and for its
   *   stated reason: *"the number in the style sheets is white space, not an origin distance."*
   *
   * ⚠️ **In the STAVE's own space** (`getSpacingBetweenLines()`), ⛔ not `STAFF_SPACE_PX`: a small
   * staff must get the same gap **in staff spaces**, which is a different number of pixels.
   *
   * ⚠️ **A caller's explicit padding still wins** — `??`, not an override. Nothing in this repo
   * passes one, and a future caller that does is saying something this default should not silently
   * contradict.
   *
   * ⛔ **It does not reach a CAUTIONARY meter**, and that is VexFlow's doing rather than a guard
   * here: in the END walk the padding is read as `getPadding(i − lastBarlineIdx)`, which is index 1
   * for a trailing meter and therefore 0.
   */
  private clefToMeterPadding(): number {
    return (armedClefMeterInk() - glyphBox('timeSig4').left) * this.getSpacingBetweenLines()
  }

  /**
   * Every visible line of this stave, as ink. ⚠️ `lineConfig[line].visible` is VexFlow's own per-line
   * switch and is honoured here for the reason the rest of the body is transcribed rather than
   * simplified: an invisible line is a feature of the object we are subclassing, not a case we get
   * to drop. ⭐ It is what a one-line percussion staff would use.
   */
  private staffLineInk() {
    const ys: number[] = []
    for (let line = 0; line < this.options.numLines; line++) {
      if (this.options.lineConfig[line].visible) ys.push(this.getYForLine(line))
    }
    return staffLinesInk(this.getX(), this.getWidth(), ys, STAVE_LINE_WIDTH_PX)
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
