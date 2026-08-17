/**
 * THE OTTAVA STAMP'S GHOST — `8va` or `8ba` following the cursor.
 *
 * Its own module rather than a fourteenth function in {@link GhostRenderer}, per CLAUDE.md's rule:
 * the table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside {@link TrillGhost}
 * and {@link FanGhost}.
 *
 * ⭐ **HIS CALL, 2026-08-17, the day after the trill's and for the same reason** — *"now the 8va and
 * 8vb, same thing, we should show the ghost for stamp"*. Both tools used to answer `null` on the
 * argument that the mark's height comes from the ladder (the ink of notes, plus whatever the
 * dynamics line and the trill already took over them), none of which the click has picked. What that
 * missed is what a cursor ghost is FOR: it says WHAT the next click makes, and the answer here is
 * emphatically not "the same thing as 8vb".
 *
 * ⭐⭐ **THE NUMERAL IS THE WHOLE ANSWER, and the DIRECTION is why this one matters most.** The
 * ottava is the only stamp armed from two palette rows that differ in a single signed number: with
 * only a blue caret on screen, `8va` and `8vb` armed identically, and the sole way to tell which was
 * live was to look back at which button was lit. The GLYPH at the pointer says it — and the glyph is
 * the only thing that changes with the shift: where it parks is fixed (see
 * {@link ghostCursorOffset}, which is where the first attempt got that wrong, and where his rule
 * about a ghost's position is written down).
 *
 * ⛔ **The BRACKET is not drawn, and that is deliberate.** A dashed line with a hook has a LENGTH,
 * and the click has picked neither end — a ghost bracket would preview an extent the click is not
 * going to make, which is the hairpin's reason for having no ghost at all. The numeral has no such
 * problem: it is one glyph, and the click stamps exactly it.
 *
 * The numeral comes from {@link drawOttavaNumeral}, the pass's own — so the preview cannot drift
 * from the mark. Plain, never parenthesised: the brackets mean "this line CARRIES OVER from the last
 * system", which is a fact about an ottava that does not exist yet.
 */
import type { SVGContext } from 'vexflow'
import type { Ottava } from '@/types/music'
import { drawOttavaNumeral } from './OttavaRenderer'
import { ghostCursorOffset } from './ghostCursor'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  ⚠️ `vf-`-prefixed, because `openGroup` prefixes every class it is given
 *  (`reference_vexflow_opengroup_prefix`). */
export const OTTAVA_GHOST_GROUP_CLASS = 'vf-ghost-ottava'

/**
 * Draw the octave numeral at the cursor. Returns false when nothing measurable was drawn — which is
 * what jsdom always answers, since a glyph there has no size
 * (`reference_jsdom_cannot_measure_glyphs`); the caller treats that as "no ghost", never as an error.
 */
export function drawOttavaGhost(
  ctx: SVGContext, cursorX: number, cursorY: number, shift: Ottava['shift'],
): boolean {
  try {
    // Drawn at x = 0 and translated into place below, once its real size is known — the tempo and
    // trill ghosts' arrangement, and why the group is opened before anything is painted into it.
    const group = ctx.openGroup('ghost-ottava') as SVGGElement
    try {
      drawOttavaNumeral(ctx, 0, cursorY, shift, false)
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

    // ⚠️ The SHIFT chooses the glyph and nothing else — every numeral parks the same way, whatever
    // its direction (see {@link ghostCursorOffset} for the report that settled it).
    const { dx, dy } = ghostCursorOffset(gbox, cursorX, cursorY)
    group.setAttribute('transform', `translate(${dx}, ${dy})`)
    return true
  } catch (_e) {
    return false
  }
}
