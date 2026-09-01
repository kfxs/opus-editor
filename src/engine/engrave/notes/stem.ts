/**
 * ⭐⭐ **THE STEM'S INK — P3c** (`docs/note-engraving-plan.md`, `docs/own-engraving-engine.md` P3).
 *
 * ## ⛔ What this module is NOT, and the line is the whole point of the commit it arrived in
 *
 * ⛔ **It does not decide how LONG a stem is.** That number is still VexFlow's, and it is the next
 * piece of work rather than an oversight: `docs/own-engraving-engine.md` §6.1 lists stem length
 * among the places *"where we currently have no opinion"*, and §6.1's own rule is that a
 * re-implementation without an opinion is strictly worse than a dependency. ⭐ The opinion exists on
 * the shelf — **Gould's printed pp. 16–19** — and `docs/stem-length-research.md` is where it is
 * being written down. ⛔ Until then, taking the length would be inventing a rule, which this project
 * catches and reverts.
 *
 * ⭐ **So P3c takes the INK and nothing else**, and that is worth doing on its own for the reason
 * P3a was: the ink had **three owners**.
 *
 * | who stroked a stem | for what |
 * |---|---|
 * | `Stem.draw` (VexFlow) | every ordinary note |
 * | `FanPass`, the member loop | a fanned member's hand-drawn stem |
 * | `FanPass`, `geometry.stemLift` | the real note's stem, topped up to reach a lifted beam line |
 *
 * The two in `FanPass` were the same four lines written twice — 🚨 §3.1's *"the second owner is the
 * tell"* again, and the third time this migration has met it inside one element.
 *
 * ## ⭐ What a stem IS, as ink
 *
 * > A **vertical line at one x**, from the end that meets the noteheads to the end that does not,
 * > of one thickness.
 *
 * That is the entire content of this module, and it is deliberately thin: everything interesting
 * about a stem is *where those two y's are*, and that is the research. ⚠️ It is a **stroked path**,
 * ⛔ not a filled rect — VexFlow strokes, and matching it exactly is what makes this commit move no
 * pixel. When the length becomes ours the shape can be revisited on its own merits.
 *
 * ## ⏳ …and the THICKNESS is a two-sources question, ⛔ not settled here
 *
 * We stroke at VexFlow's `Stem.WIDTH` = **1.5 px = 0.15 staff spaces**, while `engine/fonts/` has
 * had Bravura's `stemThickness` = **0.12** since P2 — and `fontMetrics` already spends the font's
 * number on the ink table's own arithmetic. ⭐ The same shape as the ledger overhang (§3.1 of the
 * note plan) and the flag's reach (§3.3): the room we reserve and the ink we draw come from two
 * different sources. ⛔ Not changed here — it is HIS call, and it is one argument.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/** A stem as ink: one x, and the two y's it runs between. ⛔ No direction — the y's carry it. */
export interface StemInk {
  x: number
  /** The end at the noteheads. */
  fromY: number
  /** The far end — the tip, where a flag or a beam meets it. */
  toY: number
}

/**
 * ⭐ Stroke one stem.
 *
 * ⛔ **Opens no group.** VexFlow's `Stem.draw` wraps its line in `openGroup('stem', id)` and the
 * editor's selection highlight finds a stem by exactly that id
 * (`Element.getSVGElement` → `document.getElementById`, then `querySelectorAll('path, line')`), so
 * the group is part of the STEM OBJECT's identity rather than part of the ink. The adapter that owns
 * an id opens it; ⚠️ the two `FanPass` callers have no stem object and must not gain a group, or a
 * fanned member's ink would change shape under the highlight that recolours it.
 */
export function drawStem(ctx: DrawContext, stem: StemInk, thickness: number): void {
  ctx.beginPath()
  ctx.setLineWidth(thickness)
  ctx.moveTo(stem.x, stem.fromY)
  ctx.lineTo(stem.x, stem.toY)
  ctx.stroke()
}
