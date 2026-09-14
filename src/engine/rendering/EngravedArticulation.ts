/**
 * ⭐⭐ **THE SEAM WHERE AN ARTICULATION'S INK COMES BACK TO US** — the note's MODIFIERS, 2026-09-14
 * (`docs/own-engraving-engine.md` P3; the ink itself is `engrave/notes/articulation`).
 * The third member of the family {@link EngravedAccidental} and {@link EngravedDot} opened — and the
 * one the CENSUS named: *"the articulation, and nothing else, is still a VexFlow modifier"*
 * (`VexFlowRenderer.scene.test.ts`) was a passing assertion written so that the day it moved, it
 * failed and said so. This is that day.
 *
 * ## ⭐⭐ Why this one overrides `renderText` and its two siblings override `draw`
 *
 * `Accidental.draw()` and `Dot.draw()` are ten lines of which nine are a point they ASK the note for
 * — so taking them meant transcribing one call and one subtraction, and the rule came with it.
 * ⛔ **`Articulation.draw()` is not that shape.** It is forty lines that reach through `getTopY` /
 * `getBottomY` / `getInitialOffset`, a private `snapLineToStaff` and `setOrigin`, and only the last
 * line paints:
 *
 * ```js
 * draw() {
 *   …                                 // ← the PLACEMENT: side, distance, the snap to a line or a space
 *   this.x = x; this.y = y;
 *   this.renderText(ctx, 0, 0);       // ← the INK, and the whole of what this class takes
 * }
 * ```
 *
 * ⭐ Overriding `draw` would mean **transcribing that placement**, and this repo has measured what
 * that costs: `./fanArticulations` hand-rolled a *"one staff space per mark"* rule for a fan's
 * members and landed a staccato 2 px off the identical mark on the next note. ⇒ ⭐⭐ **the narrowest
 * possible cut is the one that leaves the rule with ONE owner** — `own-engraving-engine.md` §3.1's
 * *"the second owner is the tell"*, applied before rather than after. It is also the seam
 * `fanArticulations` already uses from the outside: it runs `draw()` against a context that throws
 * the ink away, and then calls `renderText` itself.
 *
 * ## ⚠️ `_ctx: unknown`, and it is a statement rather than a dodge
 *
 * `renderText`'s first parameter is VexFlow's `RenderContext`, and ⛔ **naming that type outside
 * `lint:paint`'s allowlist is the one thing that check refuses** — which is why {@link EngravedBeam}
 * overrides the public `draw()` rather than the `protected drawBeamLines(ctx: RenderContext)` it
 * would rather have. ⭐ Here the honest answer is that **this file does not use VexFlow's context at
 * all**: the ink goes to our own surface, and the fallback asks `checkContext()` for the same object
 * the caller would have handed in. Every reachable caller passes exactly that — `Articulation.draw`
 * calls `this.renderText(this.checkContext(), 0, 0)`, and `fanArticulations` calls `setContext(ctx)`
 * immediately before — so the parameter is genuinely unused, and typing it as anything narrower
 * would be claiming a coupling that is not here. ⛔ The allowlist did not grow for this.
 */
import { Articulation } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawArticulation } from '@/engine/engrave/notes/articulation'
import type { InkSurfaceAware } from './inkSurface'

export class EngravedArticulation extends Articulation implements InkSurfaceAware {
  /**
   * The surface this mark's glyph draws on — the note's own, handed over by `drawNoteInkThrough`
   * before the voices are drawn. Null until then, and then it falls back to VexFlow's context: an
   * unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedArticulation.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS** — the glyph, through our own primitives, at VexFlow's own point.
   *
   * ⚠️ `x`/`y` were written by `Articulation.draw` a line earlier and the origin shifts by
   * `setOrigin`; this reads them exactly as the base does (`element.js:331`), so ⛔ no pixel moves.
   */
  override renderText(_ctx: unknown, xPos: number, yPos: number): void {
    // ⚠️ `children` are extra glyphs the base stamps after the sign itself. Nothing in this repo
    // gives an articulation one, and this guard is what keeps that a statement about today rather
    // than a silently missing mark the day something does.
    if (!this.inkSurface || this.children.length > 0) {
      super.renderText(this.checkContext(), xPos, yPos)
      return
    }

    drawArticulation(this.inkSurface, {
      glyph: this.getText(),
      x: xPos + this.getX() + this.getXShift(),
      y: yPos + this.getY() + this.getYShift(),
      font: this.fontInfo,
      // ⭐ The sign's own id, so its GROUP can be matched back to the hit box the registry
      //   files for it — P6b's seam (`docs/own-engraving-engine.md` §5 P6).
      id: this.getAttribute('id'),
    })
  }
}
