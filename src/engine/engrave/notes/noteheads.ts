/**
 * ⭐⭐ **A NOTEHEAD'S INK — the shape P3d drew, given its SECOND OWNER** (`docs/note-engraving-plan.md`
 * §1d; `docs/own-engraving-engine.md` P3).
 *
 * ## ⭐ Why this module exists: the note's ink lives HERE, and the heads were the odd one out
 *
 * Three of `StaveNote.draw()`'s five drawing calls already have a module in this folder —
 * `ledgerLines` (P3a), `flag` (P3b), `stem` (P3c). ⭐ **P3d took the heads' ink too, but left it
 * INLINE in `rendering/EngravedNote`**, so the one piece of the note that is pure glyph-stamping was
 * also the one piece with no home beside its siblings. This is that home; the override now reads as
 * the adapter it is.
 *
 * ## ⭐ The SECOND OWNER: the fan's members (S10, 2026-09-18)
 *
 * `rendering/FanPass` paints each fanned member's head through here (`drawFanHead`, which is
 * `NoteHead.draw` transcribed), on `pass.context`, inside the member's own group. ⚠️ It waited on
 * that GROUP, ⛔ not on the notehead: the highlight reads the member group back as a DOM node, so the
 * group had to open on our surface too (the counted `svgNode` escape), and the member's sign, ledgers
 * and stems had to move in the same step, or one member's ink would have split across two contexts.
 * The 2026-09-01 attempt that was reverted is recorded in `docs/own-engraving-engine.md` U2.
 *
 * ## ⭐ What a notehead IS, as ink
 *
 * > **One glyph, stamped at the head's own x and its line's y, inside a group named for it.**
 *
 * ⛔ **And that is all.** Which glyph a duration gets is `fonts/noteheadGlyph()` (P2, from Bravura);
 * where the head sits is the caller's — a `StaveNote`'s formatter, or the fan's own solve. ⛔ Nothing
 * here is an engraving rule, which is why P3d needed no research and this needs none either.
 *
 * ## 🚨 What the CALLER must still do, and it is load-bearing
 *
 * ⛔ **The `x` write-back is NOT here.** `NoteHead.draw` does `this.x = this.getAbsoluteX()` — a
 * mutation of a VexFlow object, so it cannot live in `engrave/` (⛔ no vexflow: `lint:boundary`), and
 * it must happen **exactly once**: *"a displaced head asked twice displaces twice"* is a warning
 * `FanPass` was already carrying before P3d was written. Each caller does it, once, and hands the
 * resulting x here.
 *
 * ⚠️ **`drawModifiers` is the caller's too**, passed as {@link drawNoteHead}'s last argument, because
 * only a head with a `parent` has any — a bare fan member has none. It runs INSIDE the group on
 * purpose: a chord's accidentals and dots land there, and the selection highlight recolours by
 * walking it.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

/** One notehead, as the ink it makes — ⛔ no `NoteHead`, no stave, no duration. */
export interface NoteHeadInk {
  /**
   * 🚨 **The group's id, and it is a seam**: `g.vf-notehead` is read by the selection highlight and
   * by a dozen browser specs (`glyphs('g.vf-notehead text')`), and the registry resolves a head's
   * ink through `getElementById`. ⛔ Never invent one — pass the head's own.
   */
  id?: string
  /** The glyph's codepoint(s), already chosen — `head.getText()`. */
  glyph: string
  /** Where the glyph is stamped, shifts already applied. */
  x: number
  y: number
  font: GlyphFont
}

/**
 * ⭐ Stamp one notehead.
 *
 * @param drawModifiers what the head's parent draws inside its group — omitted for a head that has
 *   no parent, which is every fan member. See the module header for why it is a callback.
 */
export function drawNoteHead(
  ctx: DrawContext,
  ink: NoteHeadInk,
  drawModifiers?: () => void,
): void {
  ctx.openGroup('notehead', ink.id)
  try {
    stampGlyph(ctx, ink.glyph, ink.x, ink.y, ink.font)
    drawModifiers?.()
  } finally {
    ctx.closeGroup()
  }
}
