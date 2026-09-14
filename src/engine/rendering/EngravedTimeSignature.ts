/**
 * ⭐⭐ **THE SEAM WHERE THE TIME SIGNATURE'S INK COMES BACK TO US — P5b**
 * (`docs/own-engraving-engine.md` P5; the ink itself is `engrave/header/meter`).
 *
 * `TimeSignature.draw()` is a group around `drawAt()`, and `drawAt()` is a fork:
 *
 * ```js
 * draw()  { ctx.openGroup('timesignature', id); this.drawAt(ctx, stave, this.x); ctx.closeGroup() }
 * drawAt(ctx, stave, x) {
 *   if (this.isNumeric) {
 *     let y = this.botText.getText().length > 0
 *       ? stave.getYForLine(this.topLine - this.lineShift)          // ← the RULE, as a side effect
 *       : (stave.getYForLine(this.topLine) + stave.getYForLine(this.bottomLine)) / 2
 *     this.topText.renderText(ctx, x + this.topStartX, y)           // ← the INK
 *     this.botText.renderText(ctx, x + this.botStartX, stave.getYForLine(this.bottomLine + this.lineShift))
 *   } else {
 *     this.renderText(ctx, x - this.x, stave.getYForLine(this.line))
 *   }
 * }
 * ```
 *
 * ⭐ **So this is the same shape P5a, P3b and `EngravedClef` were**: the ink moves to a module of
 * ours, the object keeps answering every question it answered before, and **no pixel moves**. What is
 * bought is that a meter is now IN THE SCENE — *"a 3 is stamped at this x on the second line down, a
 * 4 on the fourth"* is arithmetic in jsdom, where before it needed a browser and a font.
 *
 * ⭐⭐ **And it closes a real second-owner risk rather than only a stylistic one.** `drawAt` is
 * reachable by two paths — the stave modifier (`draw`) and a `TimeSigNote`'s mid-bar meter change —
 * so overriding `draw` alone would have left the SAME placement arithmetic in two bodies, one of them
 * ours. ⛔ *"The second owner is the tell"* (`own-engraving-engine.md` §3.1), which this migration has
 * now met in the ledger line, the stem and the staff line. Both overrides below build their rows from
 * {@link EngravedTimeSignature.meterRows}, so there is exactly one.
 *
 * ⚠️ `TimeSigNote` is **not used in this repo today** (an inline meter change is drawn by
 * `VexFlowRenderer`'s own pass), so that path is transcribed and unexercised — ⭐ which is precisely
 * why it must not be allowed to drift from the one that runs.
 *
 * ## ⛔ What this does NOT take
 *
 * ⛔ **The PLACEMENT.** The sign's `x` is still `Stave.format()`'s BEGIN-modifier walk, and its width
 * is still `Element.getWidth()`, a runtime `measureText` — as are the `topStartX`/`botStartX` that
 * centre the shorter row over the wider. ⭐ That is the *"`headerInk` MEASURES, `Stave` PLACES"* pair
 * P5 is named after, and it is the next step of P5b, not this one.
 *
 * ⛔ **WHICH lines the rows sit on, and the ROW GAP between them.** `topLine`/`bottomLine`/`lineShift`
 * stay VexFlow's and arrive at the ink as resolved ys. 🚨 The gap is ⛔ **UNKNOWN in every treatise**
 * (`docs/header-spacing-research.md` row **H**) and the engines split 2.0 sp against 0.0 — so a
 * migration is the last place it may be chosen. See the ink module's header.
 *
 * ⚠️ **A subclass, for the reason `EngravedStave`, `EngravedClef`, `EngravedBeam` and `EngravedNote`
 * are ones.** Everything read below is public API (`getX`, `getXShift`, `getY`, `getYShift`,
 * `getText`, `fontInfo`, `getLine`, `topLine`, `bottomLine`) or `protected` and therefore ours by
 * inheritance (`topText`, `botText`, `topStartX`, `botStartX`, `lineShift`, `isNumeric`) — the body is
 * VexFlow's own arithmetic MOVED, ⛔ not rewritten.
 */
import { TimeSignature, type Element, type Stave } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { MUSIC_GLYPH_FONT } from '@/engine/engrave/inheritedFonts'
import { drawMeter, stampMeter, type MeterRow } from '@/engine/engrave/header/meter'
import type { InkSurfaceAware } from './inkSurface'
import { staveFrame } from './staveFrame'
import { staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'

export class EngravedTimeSignature extends TimeSignature implements InkSurfaceAware {
  /**
   * The surface this meter's glyphs draw on — the stave's own, handed over by `EngravedStave` a line
   * before it draws its modifiers. Null until then, and then the meter falls back to the stave's
   * `checkContext()`, so an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
   * (`EngravedStave.inkSurface` and `EngravedClef.inkSurface` carry the same contract.)
   */
  private inkSurface: DrawContext | null = null

  /** @see EngravedTimeSignature.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P5b** — the glyphs, through our own primitives, inside the group they have always
   * been drawn in.
   */
  override draw(): void {
    const stave = this.checkStave()
    this.setRendered()
    drawMeter(
      this.inkSurface ?? stave.checkContext(),
      this.meterRows(staveFrame(stave), this.getX()),
      this.getAttribute('id'),
    )
  }

  /**
   * ⭐ The ungrouped entry point — a `TimeSigNote`'s mid-bar meter change, which draws inside the
   * NOTE's group and so must open none of its own.
   *
   * ⭐⭐ **It takes OUR surface, and the override still satisfies VexFlow's signature** — because
   * `DrawContext` is an interface VexFlow's own context satisfies structurally. That inversion is the
   * whole point of P1b (*"declaring our own interface and letting `SVGContext` satisfy it
   * structurally inverts the dependency while implementing nothing"*), and this is the first place it
   * pays literally rather than in principle: a VexFlow method is overridden with a signature that
   * names nothing of VexFlow's, so `npm run lint:paint` sees a file that draws only through us.
   * ⛔ Widening it to `RenderContext` to match the parent letter-for-letter would have put the
   * migration's own gauge up by one for a path nothing calls.
   *
   * ⚠️ An `inkSurface` is deliberately NOT preferred here: this path's caller owns the group the ink
   * lands in, so taking a different surface would split one sign's ink across two contexts.
   */
  override drawAt(ctx: DrawContext, stave: Stave, x: number): void {
    this.setRendered()
    stampMeter(ctx, this.meterRows(staveFrame(stave), x))
  }

  /**
   * ⭐⭐ **The one body of placement arithmetic** — VexFlow's `drawAt`, read out as values.
   *
   * ⚠️ The `C`/`C|` branch is a ONE-ROW meter and nothing more special than that: VexFlow draws it
   * with `this.renderText(ctx, x - this.x, …)`, whose subtraction exists only because `renderText`
   * adds `this.x` straight back — so {@link rowOf} is handed `x - this.getX()` and the two cancel,
   * leaving the sign's own `xShift`. ⛔ Transcribed rather than simplified to `x`, because the day
   * something sets `this.x` and the caller's `x` apart, the cancellation is the behaviour.
   */
  private meterRows(frame: StaffFrame, x: number): MeterRow[] {
    if (!this.isNumeric) {
      return [this.rowOf(this, x - this.getX(), staffLineY(frame, this.getLine()))]
    }
    // ⭐ A row is centred on the line it names — see `engrave/header/meter`'s header for why that is
    // a BASELINE. ⚠️ `lineShift` is VexFlow's own ±½-line compensation for an oversized glyph, folded
    // in here so the ink never sees it.
    const topY = this.botText.getText().length > 0
      ? staffLineY(frame, this.topLine - this.lineShift)
      // ⚠️ A lone upper row is centred between the two lines — VexFlow's own midpoint of the two
      // PLACEMENTS, ⛔ not `staffLineY(frame, 2)`: the two differ the moment a staff's lines are not evenly
      // spaced (`own-engraving-engine.md` §0.3 rule 5).
      : (staffLineY(frame, this.topLine) + staffLineY(frame, this.bottomLine)) / 2
    return [
      this.rowOf(this.topText, x + this.topStartX, topY),
      this.rowOf(this.botText, x + this.botStartX, staffLineY(frame, this.bottomLine + this.lineShift)),
    ]
  }

  /**
   * One `Element.renderText(ctx, xPos, yPos)` call, as a value — `element.js:331`, which stamps at
   * `xPos + this.x + this.xShift` / `yPos + this.y + this.yShift`.
   *
   * ⚠️ Every one of those four offsets is **0 on a `topText`/`botText` today** (they are bare
   * `new Element()`s that VexFlow never positions — the whole placement arrives in `xPos`/`yPos`).
   * They are read anyway, because this is a transcription: a row that started carrying a shift would
   * otherwise be silently ignored, which is the class of bug this migration exists to stop making.
   *
   * ⚠️ `renderText` also stamps an element's `children`; neither a `TimeSignature` nor its two rows
   * has any — the digits are folded into ONE codepoint string by `makeTimeSignatureGlyph` — so there
   * is nothing here to lose.
   */
  private rowOf(el: Element, x: number, lineY: number): MeterRow {
    return {
      glyph: el.getText(),
      x: x + el.getX() + el.getXShift(),
      lineY: lineY + el.getY() + el.getYShift(),
      font: MUSIC_GLYPH_FONT,
    }
  }
}
