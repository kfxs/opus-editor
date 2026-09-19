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
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Ottava } from '@/types/music'
import { drawOttavaNumeral } from './OttavaRenderer'
import { drawSignGhost } from './ghostCursor'

/** The class `ScoreRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  The bare name `openGroup` writes (VexFlow's `vf-` prefix is gone since S15c). */
export const OTTAVA_GHOST_GROUP_CLASS = 'ghost-ottava'

/**
 * Draw the armed tool's octave numeral at the cursor. Returns false when nothing measurable was
 * drawn — see {@link drawSignGhost}, which owns that answer for the family.
 */
export function drawOttavaGhost(
  ctx: DrawContext, cursorX: number, cursorY: number, shift: Ottava['shift'],
): boolean {
  return drawSignGhost(ctx, 'ghost-ottava', cursorX, cursorY,
    () => drawOttavaNumeral(ctx, 0, cursorY, shift, false))
}
