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
 * ## 🚨 The SECOND OWNER exists, is named, and is BLOCKED — ⛔ do not "just move it"
 *
 * `rendering/FanPass` builds bare `NoteHead`s for a fanned group's MEMBERS and paints them with
 * `head.setContext(ctx).draw()` on VexFlow's context. Its own comment calls this *"P3's own
 * territory"*, and it looks like a ten-line move. ⚠️ **It is not, and the reason was measured on
 * 2026-09-01:**
 *
 * 1. The fan opens **one group per MEMBER** (`FAN_HEAD_GROUP`) and stores it in the renderer's
 *    `fanMemberGroupMap` as a **raw `SVGGElement`** — read back by the incremental-redraw capture
 *    (`captureById`) and by the highlight, which recolours a member by walking that group.
 * 2. ⇒ that group cannot open on a `DrawContext`: getting the element back would need a `svgNode()`
 *    escape, and `npm run lint:paint` holds those at **10/10, a ceiling that may only FALL**.
 * 3. ⇒ drawing the heads on our surface while the member group stays on VexFlow's would put them
 *    under `fan` in the SCENE and under `fanhead` in the SVG — ⛔ exactly the *"splitting one
 *    member's ink across two contexts would nest the scene wrongly"* that `FanPass`'s own header
 *    warns about.
 * 4. 🚨 **And it would buy nothing anyway**: the pass keeps `vexContext` regardless, because the
 *    `Accidental`s and the topped-up `Stem`s still paint themselves there. The P1e gate would not
 *    move by one.
 *
 * ⇒ ⭐ **The real blocker for the fan is the highlight's raw SVG group, ⛔ not the notehead.** When
 * that map stops needing an `SVGGElement`, the member group and these heads move together in one
 * step — and this module is what they will move to.
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
