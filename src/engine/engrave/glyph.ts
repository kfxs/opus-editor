/**
 * ⭐⭐ **PUTTING ONE MUSIC GLYPH DOWN, in a face that is already resolved** —
 * `docs/plans/note-engraving-plan.md`, the shared half of P3b and P3d.
 *
 * ## ⚠️ Why this is not `rendering/glyphPainter`, and the distinction is the whole reason both exist
 *
 * `glyphPainter` is *"the one place VexFlow still paints a glyph"*, and it earns that name by owning
 * **font RESOLUTION**: `new Element(tag)` runs `Metrics.getFontInfo(tag)`, and its own header warns
 * that *"the tag is not a comment — it selects the font"*. ⭐ Everything here happens **after** that
 * question is settled: the caller was handed a face as a value (a row of `./inheritedFonts` — what
 * VexFlow used to assign a `Flag` or a `NoteHead` as its `fontInfo`), so there is nothing left
 * to resolve and `Element.renderText` reduces to the two primitives we already own — measured in
 * vexflow 5.0.0's source, `element.js:331`:
 *
 * ```js
 * renderText(ctx, xPos, yPos) { ctx.setFont(this._fontInfo); ctx.fillText(this._text, …) }
 * ```
 *
 * ⭐⭐ **And it has to be this way round**: `engrave/` may not import `vexflow` (§8.2 rule 11), and a
 * layer that needed an `Element` to put a glyph down could never be painted to PDF or recorded as a
 * scene. The font arrives as a value; ⛔ nothing here asks what it is.
 *
 * ## 🚨 Why it is a module and not two copies
 *
 * P3b wrote these two lines inside `engrave/notes/flag.ts`. P3d needed exactly the same two for the
 * notehead — *"the second owner is the tell"* (`docs/plans/own-engraving-engine.md` §3.1), which this
 * migration has now met in the ledger line, the stem, and here. ⭐ Collected on the commit that
 * produced the second owner, rather than after a third.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/** A resolved face, exactly as {@link DrawContext.setFont} takes it — ⛔ never inspected here. */
export type GlyphFont = Parameters<DrawContext['setFont']>[0]

/**
 * ⭐ Stamp one glyph.
 *
 * ⚠️ `y` is the **BASELINE**, ⛔ not a top and ⛔ not a centre: a music glyph's ink sits wherever its
 * own box says relative to that point, which is why every caller here computes the baseline from a
 * font measurement rather than from the ink it wants to see (`engrave/notes/flag.ts` states that
 * arithmetic; a notehead's is VexFlow's `y`).
 *
 * ⛔ **Opens no group.** A glyph's group belongs to whoever owns its identity — a `Flag`'s wraps just
 * the glyph, a `NoteHead`'s also contains that head's modifiers — and only the caller knows which.
 */
export function stampGlyph(
  ctx: DrawContext, glyph: string, x: number, baselineY: number, font: GlyphFont,
): void {
  if (!glyph) return
  ctx.setFont(font)
  ctx.fillText(glyph, x, baselineY)
}
