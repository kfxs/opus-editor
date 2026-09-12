/**
 * ⭐⭐ **THE SEAM WHERE THE CLEF'S INK COMES BACK TO US — P5b**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/header/clef`).
 *
 * `Clef.draw()` is four things, and only the third is the drawing:
 *
 * ```js
 * ctx.openGroup('clef', id)
 * this.y = stave.getYForLine(this.line)   // ← the RULE, as a side effect
 * this.renderText(ctx, 0, 0)              // ← the INK; the zeros are load-bearing
 * ctx.closeGroup()
 * ```
 *
 * ⭐ **So P5b's first step is the same shape P5a and P3b were**: the ink moves to a module of ours,
 * the object keeps answering every question it answered before, and **no pixel moves**. What is
 * bought is that a clef is now IN THE SCENE — *"a clef is stamped at this x, on this line, as this
 * codepoint"* is arithmetic in jsdom, where before it needed a browser and a font.
 *
 * ## ⛔ What this does NOT take, and it is most of P5b
 *
 * ⛔ **The PLACEMENT.** A clef's `x` is still `Stave.format()`'s BEGIN-modifier walk (`x += padding;
 * modifier.setX(x); x += width`), and its width is still `Element.getWidth()`, a runtime
 * `measureText`. The two nudge passes still nudge — `clefIndentPass` for the engraved 0.7 sp
 * indentation, `clefOffsetPass` for a hand offset — and both still work by `setX`/`setXShift` on
 * this very object, which is why every one of those numbers is READ here rather than replaced.
 * ⭐ That is the *"`headerInk` MEASURES, `Stave` PLACES"* pair P5 is named after, and it is the next
 * step, not this one.
 *
 * ⛔ **The ANCHOR LINE and the SIZE.** `Clef.types` still says which line each clef names, and
 * `Clef.getPoint` still reduces a mid-score clef to ⅔. Both are live research questions as of
 * 2026-09-02 (`docs/clef-research.md`), so both are read off VexFlow and handed to the ink as
 * values — ⛔ never re-derived here, which would be inventing a rule ahead of the research.
 *
 * ⛔ **The INLINE clef.** A clef change at `beat > 0` is a `ClefNote` tickable that builds its own
 * `Clef` internally (`VexFlowRenderer.interleaveClefNotes`), and it never passes through here.
 * ⏭️ It becomes ours when `ClefNote` does.
 *
 * ⚠️ **A subclass, for the reason `EngravedStave`, `EngravedBeam` and `EngravedNote` are ones.**
 * Everything read below is public API (`getX`, `getXShift`, `getYShift`, `getText`, `fontInfo`,
 * `line`) or `protected` and therefore ours by inheritance (`y`) — the body is VexFlow's own
 * arithmetic MOVED, ⛔ not rewritten.
 */
import { Clef } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { clefPlacement, drawClef } from '@/engine/engrave/header/clef'
import type { InkSurfaceAware } from './inkSurface'

export class EngravedClef extends Clef implements InkSurfaceAware {
  /**
   * The surface this clef's glyph draws on — the stave's own, handed over by `EngravedStave` a line
   * before it draws its modifiers. Null until then, and then the clef falls back to
   * `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   * (`EngravedStave.inkSurface` and `EngravedNote.inkSurface` carry the same contract, and
   * `./inkSurface` is how the stave's modifier walk finds the members that take one.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedClef.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P5b** — the glyph, through our own primitives.
   *
   * ⚠️ **`this.y` is still assigned**, and it is not bookkeeping: `Element.getBoundingBox()` is built
   * from `this.x`/`this.y`, and `clefOffsetPass` says outright that *"everything downstream of an
   * offset clef is measured from that box"* — the registry's hit box, and the clef SEGMENT that
   * pixel↔pitch lookup reads. ⛔ Dropping it would move no ink and break both.
   *
   * ⚠️ **The face is the one VexFlow resolved for this clef** — `Metrics.getFontInfo('Clef')` sized
   * by `Clef.getPoint(size)` — handed to the ink as a value, exactly as `EngravedNote` hands over
   * the flag's. That is what keeps `engrave/` free of `vexflow` (`lint:boundary`).
   */
  override draw(): void {
    const stave = this.checkStave()
    this.setRendered()
    this.y = stave.getYForLine(this.line)
    drawClef(
      this.inkSurface ?? this.checkContext(),
      this.getText(),
      clefPlacement({ x: this.getX() + this.getXShift(), lineY: this.y + this.getYShift() }),
      this.fontInfo,
      this.getAttribute('id'),
    )
  }
}
