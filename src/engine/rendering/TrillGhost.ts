/**
 * THE TRILL STAMP'S GHOST — the `tr` itself, following the cursor.
 *
 * Its own module rather than a thirteenth function in {@link GhostRenderer}, per CLAUDE.md's rule:
 * the table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside {@link FanGhost}.
 *
 * ⭐ **HIS CALL, 2026-08-17 — and it overturns a written decision, deliberately.** The trill was one
 * of the six armed tools that showed only the blue cursor, and the reason was recorded in three
 * places (`interactions/toolGhost.ts`, {@link ToolGhost}, docs/trill-plan.md §6): a trill is drawn
 * ABOVE the music at a height that comes from the ink of notes the click has not picked, so a `tr`
 * at the pointer previews a POSITION nothing has decided. His answer: *"we really want to see a tr
 * ghost; this is much better"* — the ghost's job is to say WHAT the next click makes, not where the
 * engraver will end up putting it. That is what every stamp ghost beside it already does: the
 * accidental parks left of a notehead it has not picked, the dot parks right of one, the tie draws a
 * stub between two notes it does not know. WHERE is the renderer's answer after the click; WHAT is
 * the cursor's, and a bare blue caret answers neither.
 *
 * ⭐ The OTTAVA and the PEDAL followed within the day, on the same argument ({@link OttavaGhost},
 * {@link PedalGhost}), and the three share one position at the pointer — see
 * {@link ghostCursorOffset}, which is where his rule about that is written down.
 *
 * ⭐ **What is left here is the SIGN and nothing else** — measuring, recolouring and parking are
 * {@link drawSignGhost}'s, shared with the pedal's and the bracket's drawers. The slur and the
 * hairpin keep their `null` for the one reason left: both ends unpicked, so there is genuinely
 * nothing honest to draw.
 *
 * The sign comes from {@link drawTrillSign}, the pass's own — so the preview cannot drift from the
 * mark. Plain, never parenthesised: the brackets mean "this trill CARRIES OVER from the last
 * system", which is a fact about a trill that does not exist yet.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawTrillSign } from './TrillRenderer'
import { drawSignGhost } from './ghostCursor'

/** The class `ScoreRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const TRILL_GHOST_GROUP_CLASS = 'vf-ghost-trill'

/**
 * Draw `tr` at the cursor. Returns false when nothing measurable was drawn — see
 * {@link drawSignGhost}, which owns that answer for the family.
 */
export function drawTrillGhost(ctx: DrawContext, cursorX: number, cursorY: number): boolean {
  return drawSignGhost(ctx, 'ghost-trill', cursorX, cursorY,
    () => drawTrillSign(ctx, 0, cursorY, false))
}
