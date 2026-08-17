/**
 * THE SUSTAIN PEDAL STAMP'S GHOST — `Ped.` following the cursor.
 *
 * Its own module rather than a fifteenth function in {@link GhostRenderer}, per CLAUDE.md's rule:
 * the table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside
 * {@link OttavaGhost} and {@link TrillGhost}.
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
import { ghostCursorOffset } from './ghostCursor'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const PEDAL_GHOST_GROUP_CLASS = 'vf-ghost-pedal'

/**
 * Draw `Ped.` at the cursor. Returns false when nothing measurable was drawn — which is what jsdom
 * always answers, since a glyph there has no size (`reference_jsdom_cannot_measure_glyphs`); the
 * caller treats that as "no ghost", never as an error.
 */
export function drawPedalGhost(ctx: SVGContext, cursorX: number, cursorY: number): boolean {
  try {
    // Drawn at x = 0 and translated into place below, once its real size is known — the tempo,
    // trill and ottava ghosts' arrangement, and why the group is opened before anything is painted.
    const group = ctx.openGroup('ghost-pedal') as SVGGElement
    try {
      drawPedalSign(ctx, 0, cursorY, false)
    } finally {
      ctx.closeGroup()
    }

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (!gbox || gbox.width === 0) {
      group.remove()
      return false
    }

    // Ghost blue at 0.7 opacity — a preview, not yet content (mirrors every other cursor ghost).
    group.setAttribute('opacity', '0.7')
    group.querySelectorAll('text, path').forEach(el => {
      if (el.getAttribute('fill') !== 'none') el.setAttribute('fill', '#3B82F6')
    })

    const { dx, dy } = ghostCursorOffset(gbox, cursorX, cursorY)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}
