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
 * ⛔ The ottava, pedal, slur and hairpin keep their `null` — not because the reasoning above still
 * holds for them, but because nobody has asked. A slur and a hairpin genuinely have nothing to draw
 * (both ends unpicked); the two BRACKETS are the ones to revisit if he wants the same treatment.
 *
 * The sign comes from {@link drawTrillSign}, the pass's own — so the preview cannot drift from the
 * mark. Plain, never parenthesised: the brackets mean "this trill CARRIES OVER from the last
 * system", which is a fact about a trill that does not exist yet.
 */
import type { SVGContext } from 'vexflow'
import { drawTrillSign } from './TrillRenderer'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const TRILL_GHOST_GROUP_CLASS = 'vf-ghost-trill'

/**
 * Px the sign is lifted ABOVE the pointer, on top of being centred on it.
 *
 * A trill is engraved over its note, and the click lands ON the note — so the ghost sits where the
 * mark goes rather than under the arrow, which would cover the very glyph it is previewing. The same
 * reasoning as the articulation ghost's `CURSOR_GAP_PX`, at the trill's larger distance: this is one
 * mark that is always read above the staff.
 */
const CURSOR_LIFT_PX = 14

/**
 * Draw the `tr` at the cursor. Returns false when nothing measurable was drawn — which is what jsdom
 * always answers, since a glyph there has no size (`reference_jsdom_cannot_measure_glyphs`); the
 * caller treats that as "no ghost", never as an error.
 */
export function drawTrillGhost(ctx: SVGContext, cursorX: number, cursorY: number): boolean {
  try {
    // Drawn at x = 0 and translated into place below, once its real size is known — the tempo
    // ghost's arrangement, and the reason the group is opened before anything is painted into it.
    const group = ctx.openGroup('ghost-trill') as SVGGElement
    try {
      drawTrillSign(ctx, 0, cursorY, false)
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

    const dx = cursorX - (gbox.x + gbox.width / 2)
    const dy = cursorY - (gbox.y + gbox.height / 2) - CURSOR_LIFT_PX
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}
