/**
 * ⭐⭐ **THE SEAM WHERE THE OPENING BARLINE'S INK COMES BACK TO US — P5b**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/staff/openingBarline`).
 *
 * `Barline.draw()` is a group around a switch on the sign's type, and only ONE arm of it can be
 * reached from a score stave in this repo:
 *
 * ```js
 * draw() {
 *   ctx.openGroup('stavebarline', id)
 *   switch (this.type) {
 *     case SINGLE: this.drawVerticalBar(stave, this.x, false); break   // ← ours, below
 *     case DOUBLE / END / REPEAT_*: …                                  // ⛔ never set here
 *     default: break                                                   // NONE — draws nothing
 *   }
 *   ctx.closeGroup()
 * }
 * drawVerticalBar(stave, x) {
 *   staveCtx.fillRect(x, stave.getTopLineTopY(), 1, stave.getBottomLineBottomY() - topY)
 * }
 * ```
 *
 * ⚠️ **Both of those numbers have since moved**, and neither is transcribed here any more: the WIDTH
 * is ours (below), and the vertical EXTENT is `staveBarlineExtent` — a barline stops at the MIDDLE of
 * each outer staff line rather than at its edge (`engrave/staff/barlineExtent`, three engines and
 * LilyPond's stated reason).
 *
 * ⭐ Same shape as P5a, `EngravedClef` and `EngravedTimeSignature`: the ink moves to a module of ours
 * and enters the SCENE, and the object keeps answering every question it answered before. ⚠️ **The
 * MOVE moved no pixel; the EXTENT RULE that followed it did** — a separate commit, as a rule change
 * must be. What is bought is that *"a system opens with a line spanning its staff"* is arithmetic in
 * jsdom, where before it was a `<rect>` only a browser could see.
 *
 * ⭐⭐ **And this one ALSO DELETES A PASS, which the other three did not.** A plain opening barline
 * used to be drawn three times over: VexFlow's 1 px `fillRect`, then `barlineInk.inkBarlines`
 * rewriting that rect's `width` in the DOM to the 0.16 sp we actually want, then
 * `barlineInk.hintBarlines` rewriting its `x`. ⇒ the WIDTH is now drawn right the first time and
 * `inkBarlines` is gone — ⭐ **the same "draw it right rather than repair it" that
 * `BarlineRenderer`'s header claims for every other line on the page**, finally applied to the one
 * line that pass deliberately left out. ⚠️ The hinting stays: it is a page-wide pass over marks four
 * modules drew, ⛔ not this line's business.
 *
 * 🚨 **A DOM repair is invisible to the SCENE, and that is why folding it in is not tidying.** Had
 * the ink moved here at VexFlow's literal `1`, `recordScene` would have recorded a 1 px barline while
 * the page carried a 1.6 px one — a scene that DISAGREES with the picture is worse than no scene, and
 * every assertion written against it afterwards would have been asserting the wrong number.
 *
 * ## ⛔ What this does NOT take
 *
 * ⛔ **The x** — still `Stave.format()`'s BEGIN-modifier walk. The rest of P5b.
 *
 * ⛔ **Every other TYPE.** `super.draw()` keeps them, and the ink module's header says why at length:
 * this repo replaced VexFlow's rules for the final bar, the repeats and the double bar
 * (`BarlineRenderer`), so transcribing them into `engrave/` would import rules we have already
 * overruled. ⭐ Nothing in this repo can reach them — a score stave's BEGIN bar is `SINGLE` or
 * `NONE` and its END bar is always `NONE` (`VexFlowRenderer.drawMeasureContent`) — so the fall-through
 * is a guard against a future caller, ⛔ not a case that runs. ⚠️ `NONE` goes through it too, which
 * keeps VexFlow's own empty `<g>` exactly where it has always been in the SVG.
 *
 * ⚠️ **A subclass, for the reason `EngravedStave`, `EngravedClef` and `EngravedTimeSignature` are
 * ones.** Everything read below is public API (`getX`, `getType`, `getAttribute`, and the stave's own
 * `getYForLine` / `getNumLines` through `staveBarlineExtent`).
 */
import { Barline, BarlineType } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawOpeningBarline, openingBarlineInk } from '@/engine/engrave/staff/openingBarline'
import { THIN_BARLINE_PX, staveBarlineExtent } from './barlineInk'
import type { InkSurfaceAware } from './inkSurface'

export class EngravedBarline extends Barline implements InkSurfaceAware {
  /**
   * The surface this line draws on — the stave's own, handed over by `EngravedStave` a line before it
   * draws its modifiers. Null until then, and then the line falls back to the stave's
   * `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   * (`EngravedClef` and `EngravedTimeSignature` carry the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedBarline.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P5b** — the line that opens a stave, through our own primitives, inside the group
   * it has always been drawn in.
   *
   * ⚠️ **The thickness is in the STAVE's own space by inheritance, ⛔ not by conversion**, and that is
   * unchanged rather than chosen: the rect lands inside the bar's `<g>`, which carries the staff's
   * scale, so a cue-size staff gets a proportionally thinner opening line exactly as it did when
   * `inkBarlines` wrote the same number into the same group. ⭐ `BarlineRenderer.drawSign`'s note is
   * the argument for keeping it that way — and the day `docs/small-staff-spacing` revisits it, this is
   * the second line to change.
   */
  override draw(): void {
    if (this.getType() !== BarlineType.SINGLE) {
      super.draw()
      return
    }
    const stave = this.checkStave()
    this.setRendered()
    const extent = staveBarlineExtent(stave)
    drawOpeningBarline(
      this.inkSurface ?? stave.checkContext(),
      openingBarlineInk(this.getX(), extent.topY, extent.bottomY, THIN_BARLINE_PX),
      this.getAttribute('id'),
    )
  }
}
