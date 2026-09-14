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
 * `measureText`. The clef is PLACED by `headerPlacementPass` at the engraved 0.7 sp, and a hand offset still nudges
 * indentation, `clefOffsetPass` for a hand offset — and both still work by `setX`/`setXShift` on
 * this very object, which is why every one of those numbers is READ here rather than replaced.
 * ⭐ That is the *"`headerInk` MEASURES, `Stave` PLACES"* pair P5 is named after, and it is the next
 * step, not this one.
 *
 * ✅ **The ANCHOR LINE and the SIZE are rows of ours since S4b0** — `engrave/header/clefSign`, with
 * today's `Clef.types` lines and `Clef.getPoint` ⅔ exactly. The clef research (`docs/clef-research.md`)
 * becomes their preset menu (rule 13) rather than a reason to keep reading them off VexFlow.
 *
 * ⛔ **The INLINE clef.** A clef change at `beat > 0` is a `ClefNote` tickable that builds its own
 * `Clef` internally (`VexFlowRenderer.interleaveClefNotes`), and it never passes through here.
 * ⏭️ It becomes ours when `ClefNote` does.
 *
 * ⚠️ **A subclass, for the reason `EngravedStave`, `EngravedBeam` and `EngravedNote` are ones.**
 * Everything read below is public API (`getX`, `getXShift`, `getYShift`) or `protected` and therefore ours by inheritance (`y`) — the body is VexFlow's own
 * arithmetic MOVED, ⛔ not rewritten.
 */
import { Clef } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Clef as ScoreClef } from '@/types/music'
import { clefSign, type ClefSign, type ClefSize } from '@/engine/engrave/header/clefSign'
import { clefPlacement, drawClef } from '@/engine/engrave/header/clef'
import type { InkSurfaceAware } from './inkSurface'
import { staveFrame } from './staveFrame'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'

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
   * ⭐ **What this clef draws, as ours** — S4b0 (`engrave/header/clefSign`): the glyph, the line it
   * names, its face.
   */
  private readonly sign: ClefSign

  constructor(clef: string, size?: string, annotation?: string) {
    // ⛔ An ANNOTATED clef (8va/8vb) has no row in `clefSign`, and nothing in this editor adds one — so
    //   it is refused LOUDLY, the day something does, rather than drawn from a table we do not have.
    if (annotation !== undefined) {
      throw new Error(`EngravedClef: an annotated clef ('${annotation}') has no row in engrave/header/clefSign`)
    }
    super(clef, size)
    // `Clef.getPoint` reads anything but 'default' as small, and an absent size as 'default'.
    const signSize: ClefSize = size === undefined || size === 'default' ? 'default' : 'small'
    this.sign = clefSign(clef as ScoreClef, signSize)
  }

  /**
   * ⭐ **OURS as of P5b** — the glyph, through our own primitives.
   *
   * ⚠️ **`this.y` is still assigned**, and it is not bookkeeping: `Element.getBoundingBox()` is built
   * from `this.x`/`this.y`, and `clefOffsetPass` says outright that *"everything downstream of an
   * offset clef is measured from that box"* — the registry's hit box, and the clef SEGMENT that
   * pixel↔pitch lookup reads. ⛔ Dropping it would move no ink and break both.
   *
   * ⚠️ **The glyph, the line and the face are `engrave/header/clefSign`'s** — handed to the ink as
   * values, exactly as `EngravedNote` hands over the flag's. That is what keeps `engrave/` free of
   * `vexflow` (`lint:boundary`).
   */
  override draw(): void {
    const stave = this.checkStave()
    this.setRendered()
    this.y = staffLineY(staveFrame(stave), this.sign.line)
    drawClef(
      this.inkSurface ?? this.checkContext(),
      this.sign.glyph,
      clefPlacement({ x: this.getX() + this.getXShift(), lineY: this.y + this.getYShift() }),
      this.sign.font,
      this.getAttribute('id'),
    )
  }
}
