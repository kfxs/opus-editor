/**
 * ⭐⭐ **THE FLAG — P3b, and the first GLYPH of a note that is ours**
 * (`docs/note-engraving-plan.md`, `docs/own-engraving-engine.md` P3).
 *
 * ## Why the flag was the second piece
 *
 * P3a took the ledger lines because they had three owners. The flag was taken next because it has
 * **none** — and because of what it exposes:
 *
 * - ⭐ **Eight lines, one glyph, one placement.** Nothing downstream reads it: no `selectedElement`
 *   kind, no anchor map, no registry entry, no highlight map. It draws inside the note's own
 *   `stavenote` group, so the selection recolour keeps working untouched — the same free ride the
 *   ledger lines got.
 * - 🚨🚨 **And it is §3's BUG CLASS, sitting in the open.** VexFlow places the flag vertically with
 *   `this.flag.getTextMetrics().actualBoundingBoxDescent` — a **runtime `measureText`** on a canvas.
 *   That is the identical mechanism that put every whole rest ~9.7 px off-centre until
 *   `musicFontReady` gated the first render, and it answers **0 in jsdom**. `engine/fonts/` already
 *   holds Bravura's own answer to the same question (`flagGlyph`, `flagDropFromTip`).
 *
 * ⭐ **So this module's real job is to make that dependency a NAMED INPUT.** The reach is a
 * parameter — {@link flagPlacement}'s `glyphReach` — rather than a `getTextMetrics()` call buried in
 * a draw method. ⛔ **P3b did not change where it comes from**: the adapter still passes VexFlow's
 * measured number, so no pixel moved. ⏭️ Swapping it for `fonts/flagDropFromTip` is one argument,
 * and it is a **measurement** to make first, not a refactor to assume —
 * `docs/note-engraving-plan.md` §3.3.
 *
 * ## ⭐ The rule, in one sentence
 *
 * > **The flag's own outer edge meets the stem TIP** — its top for an up-stem, its bottom for a
 * > down-stem — **and it stands on the stem's own x.**
 *
 * That is what VexFlow's two branches say once the sign of `Stem.getHeight()` is folded out, and it
 * is the same statement Gould makes from the other end (printed p. 16): a stem is measured so that
 * *"the tail should avoid overshooting the notehead"* — ⭐ i.e. the flag hangs FROM the tip, and the
 * STEM is what gets longer to accommodate it, never the flag that moves. ⛔ Which is why nothing
 * here clamps or nudges: a flag that looks wrong is a stem-length question (⏭️ P3's stem piece,
 * where Gould's pp. 16–19 rules go).
 *
 * ## ⚠️ Why it stamps its own glyph instead of calling `rendering/glyphPainter`
 *
 * ⭐ Because the font is **already resolved** — see `engrave/glyph.ts`, which is where those two
 * lines moved when P3d gave them a second owner.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

export type { GlyphFont }

/** The stem a flag hangs off, as the flag cares about it. */
export interface FlagStem {
  /** The stem's own x — its CENTRE line, which is why the glyph steps back half a stem below. */
  x: number
  /** Where the stem ends, away from the noteheads. */
  tipY: number
  /** Up-stem (flag on the right, hanging down from the top) or down-stem (flag on the left). */
  up: boolean
}

/** Where a flag glyph is stamped: an origin x and a BASELINE y (⛔ not a top or a centre). */
export interface FlagPlacement {
  x: number
  baselineY: number
}

/**
 * ⭐ **THE RULE** — see the header. The glyph's outer edge meets the stem tip, so the baseline sits
 * `glyphReach` on the notehead side of it: for an up-stem the glyph hangs DOWN from the tip, so its
 * baseline is `reach` BELOW; for a down-stem it rises from the tip and its baseline is `reach` above.
 *
 * @param stemWidth the stem's drawn thickness — the glyph starts at the stem's left edge, ⛔ not its
 *   centre line, or an up-stem's flag would be drawn half a stem into the stem.
 * @param glyphReach how far the flag's ink reaches from its own baseline to the edge that meets the
 *   tip: its ASCENT for an up-stem, its DESCENT for a down-stem. ⚠️ **A FONT measurement**, and the
 *   whole reason it is a parameter — see the header. ⛔ 0 in jsdom, which is honest rather than
 *   broken: with no font there is no ink to reach.
 */
export function flagPlacement(stem: FlagStem, stemWidth: number, glyphReach: number): FlagPlacement {
  return {
    x: stem.x - stemWidth / 2,
    baselineY: stem.up ? stem.tipY + glyphReach : stem.tipY - glyphReach,
  }
}

/**
 * ⭐ **THE INK** — one glyph, in the face it was handed, inside its own group.
 *
 * ⚠️ The `flag` group is kept because VexFlow drew one (`Flag.draw` opens `flag`): the note's
 * selection highlight walks the `stavenote` group's descendants, and changing the DOM's shape
 * under it is a change nobody asked for. ⭐ It also gives the SCENE a named group to assert on.
 *
 * ⛔ No style is applied. VexFlow's `drawWithStyle` would apply the flag's own, and in this editor a
 * `Flag` never has one — `setStyle` is deliberately unused here (`reference: vexflow setStyle
 * context leak`; every recolour goes through the DOM after the fact). ⚠️ If that ever changes, this
 * is the line that has to hear about it.
 */
export function drawFlag(
  ctx: DrawContext, glyph: string, at: FlagPlacement, font: GlyphFont,
): void {
  if (!glyph) return
  ctx.openGroup('flag')
  try {
    stampGlyph(ctx, glyph, at.x, at.baselineY, font)
  } finally {
    // ⚠️ In a `finally`, like every other `openGroup` in this engine: an unbalanced pair swallows
    // the rest of the render.
    ctx.closeGroup()
  }
}
