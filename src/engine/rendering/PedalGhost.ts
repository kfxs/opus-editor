/**
 * THE SUSTAIN PEDAL STAMP'S GHOST — `Ped.` following the cursor.
 *
 * Its own module rather than a fifteenth function in {@link GhostRenderer}, per CLAUDE.md's rule:
 * the table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside
 * {@link OttavaGhost} and {@link TrillGhost}.
 *
 * ⭐ **What is left here is the SIGN and nothing else** — measuring, recolouring and parking are
 * {@link drawSignGhost}'s, which is what the three sign ghosts had each written out (`PedalGhost`
 * ported first, Phase 3 of the span-mark plan; the other two are a line each when they join).
 *
 * ⭐ **HIS CALL, 2026-08-17 — the third of three, and this one had the strongest written argument
 * against it.** `toolGhost` used to call the pedal *"the clearest case"* for having no ghost: it is
 * not merely drawn at a height the click has not decided, it is not drawn where the pointer is AT
 * ALL — `Ped.` goes on a rung BELOW the staff, outside every other family down there. His answer,
 * after the trill's and the ottava's: *"now the pedal, we should see the ghost ped for stamping."*
 *
 * ⭐⭐ **And the argument was answering the wrong question.** WHERE the mark ends up is the
 * renderer's business after the click; what the cursor has to say is WHAT the click makes — and a
 * blue caret says that no better under this tool than under any other.
 *
 * ⭐⭐ **And this ghost is where he stated the rule for the whole family.** The first build parked it
 * BELOW the pointer, reasoning that the mark goes below the staff — which put the glyph under the
 * arrow: *"the position of the ghost ped is wrong, the pointer covers [it]… this is a sign for the
 * user, of course a ghost [does] not take into account the position of the real sign in the score."*
 * It parks where `tr` and `8va` do, at {@link ghostCursorOffset}, and that is now one number for
 * all three.
 *
 * ⛔ **Only the `Ped.` is drawn — never the lift (`✻`) and never the span between them.** A pedalling
 * has a LENGTH the click has not picked (one press holds the note it lands on, and a longer one
 * takes its extent from the notes it is placed over), so a preview showing both signs would be
 * promising a release the click is not going to make. The ottava's bracket is left out for the same
 * reason.
 *
 * The sign comes from {@link drawPedalSign}, the pass's own — so the preview cannot drift from the
 * mark. Plain, never parenthesised: the brackets mean "this pedalling CARRIES OVER from the last
 * system", which is a fact about a pedal that does not exist yet.
 */
import type { SVGContext } from 'vexflow'
import { drawPedalSign } from './PedalRenderer'
import { drawSignGhost } from './ghostCursor'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const PEDAL_GHOST_GROUP_CLASS = 'vf-ghost-pedal'

/**
 * Draw `Ped.` at the cursor. Returns false when nothing measurable was drawn — see
 * {@link drawSignGhost}, which owns that answer for the family.
 */
export function drawPedalGhost(ctx: SVGContext, cursorX: number, cursorY: number): boolean {
  return drawSignGhost(ctx, 'ghost-pedal', cursorX, cursorY, () => drawPedalSign(ctx, 0, cursorY, false))
}
