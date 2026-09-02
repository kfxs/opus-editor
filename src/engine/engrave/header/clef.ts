/**
 * ⭐⭐ **THE CLEF'S INK — P5b, and the first symbol of the HEADER that is ours**
 * (`docs/own-engraving-engine.md` P5; the adapter is `rendering/EngravedClef`).
 *
 * ## What P5 said this step was
 *
 * > *"`engine/layout/headerInk.ts` already **measures** what a clef and a meter cost; `Stave` still
 * > **places** them — the two-sets-of-numbers problem in its last hiding place."*
 *
 * P5a took the staff's five lines and left the modifiers explicitly: *"the clef, the time signature
 * and the opening barline are stave MODIFIERS and still paint themselves — that is P5b, and it is
 * the half with the engraving questions in it."* This is the clef half of that, and it is the same
 * shape P3b (the flag) had: ⭐ **the ink moves to a module of ours and enters the SCENE; the numbers
 * that decide WHERE stay exactly where they were, as NAMED INPUTS.** ⛔ No pixel moves.
 *
 * ## ⭐ The rule, in one sentence
 *
 * > **A clef stands ON A STAFF LINE — the one its name names — and that line's y is the glyph's
 * > BASELINE, ⛔ not its top and ⛔ not its centre.**
 *
 * That is the whole of a clef's vertical placement, and it is worth stating because it is the fact
 * a reader is most likely to get wrong: a G clef's ink runs from well above the staff to well below
 * it, and none of that reach is arithmetic anyone here does. ⭐ The SMuFL glyphs are cut so that the
 * **origin sits on the anchor line** — `gClef`'s curl encircles it, `fClef`'s two dots straddle it,
 * `cClef` is centred on it — so the whole rule reduces to *put the origin on the line*, and the font
 * does the rest. ⛔ Which is exactly why nothing here nudges: a clef that looks too high is a FONT
 * question or an anchor-line question, never a fudge factor.
 *
 * ## ⏳ What this module deliberately does NOT own yet
 *
 * ⛔ **WHICH line each clef names** (treble → the second line up, bass → the fourth, C clefs → the
 * line they are centred on) is still VexFlow's `Clef.types` table, arriving here as
 * {@link ClefAnchor.lineY} already resolved. ⛔ **How big a clef is drawn** — and in particular the
 * **⅔** a mid-score clef change is reduced by (`Clef.getPoint`) — is still VexFlow's, arriving as
 * the resolved `font`.
 *
 * ⭐ **Both are open research questions as of 2026-09-02**, being asked of the books and the three
 * engine clones (`docs/clef-research.md`): the vertical anchor per clef, and the small-clef ratio.
 * ⛔ Taking a table or a ratio into this module *before* that lands would be inventing a rule that
 * predates the research — so they are parameters, and the day the research answers them this is
 * where they come to live. (P3b did exactly this with the flag's font reach, and said so: *"the
 * reach is a parameter rather than a `getTextMetrics()` call buried in a draw method… P3b did not
 * change where it comes from"*.)
 *
 * ⛔ **No DOM, no vexflow** (`lint:boundary`).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { stampGlyph, type GlyphFont } from '../glyph'

export type { GlyphFont }

/**
 * What a clef is anchored to, as the ink cares about it.
 *
 * ⚠️ `x` is the glyph's ORIGIN — the left edge of where it is stamped, which is where the header's
 * layout put the modifier plus whatever the two nudge passes added (`clefIndentPass` for the
 * engraved indentation, `clefOffsetPass` for a hand offset). ⛔ Not a centre.
 */
export interface ClefAnchor {
  x: number
  /** The y of the staff line this clef names — see the module header. ⭐ A BASELINE. */
  lineY: number
}

/** Where a clef glyph is stamped: an origin x and a BASELINE y (⛔ not a top, ⛔ not a centre). */
export interface ClefPlacement {
  x: number
  baselineY: number
}

/**
 * ⭐ **THE RULE** — the anchor line's y *is* the baseline.
 *
 * ⚠️ It is an identity today, and it is a function anyway for the reason `staffLineStrokeY` is one:
 * ⭐ **the statement is the point.** VexFlow expresses the same rule as a side effect in the middle
 * of a draw method — `this.y = stave.getYForLine(this.line)` immediately before a `renderText(ctx,
 * 0, 0)` whose zeros are load-bearing — where it can neither be read nor tested. Here it is one
 * named thing, and it is the seam the anchor-line table lands on when the research (see the header)
 * says whose table it should be.
 */
export function clefPlacement(anchor: ClefAnchor): ClefPlacement {
  return { x: anchor.x, baselineY: anchor.lineY }
}

/**
 * ⭐ **THE INK** — one glyph, in the face it was handed, inside its own group.
 *
 * 🚨 **The group is load-bearing and must keep its id.** `g.vf-clef` is what
 * `clefIndentPass.test.ts` reads to find a drawn clef (`g.vf-clef text` — a looser selector falls
 * through to the first notehead) and what `e2e/slur.e2e.ts` measures clefs with, and the ID is how
 * `ElementRegistry`'s box resolves back to ink. ⇒ this reproduces `Clef.draw`'s
 * `openGroup('clef', id)` exactly.
 *
 * ⛔ **No style is applied**, exactly as `engrave/notes/flag.ts` applies none: `Metrics` has no
 * `Clef` row, so VexFlow's own `drawWithStyle` had nothing to apply either, and every recolour in
 * this editor happens on the DOM after the fact (`reference: vexflow setStyle context leak`).
 *
 * ⚠️ `Element.renderText` also stamps its `children`; a `Clef` has none — an `8va`/`8vb` annotation
 * is folded into the CODEPOINT by `Clef.setType`, not attached as a child element — so there is
 * nothing here to lose. ⭐ If an octave clef ever grows a separate numeral, this is the line that
 * has to hear about it.
 */
export function drawClef(
  ctx: DrawContext, glyph: string, at: ClefPlacement, font: GlyphFont, groupId?: string,
): void {
  if (!glyph) return
  ctx.openGroup('clef', groupId)
  try {
    stampGlyph(ctx, glyph, at.x, at.baselineY, font)
  } finally {
    // ⚠️ In a `finally`, like every other `openGroup` in this engine: an unbalanced pair swallows
    // the rest of the render.
    ctx.closeGroup()
  }
}
