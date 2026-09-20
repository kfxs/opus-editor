/**
 * THE TEMPO MARK'S GHOST — S11c (`docs/history/vexflow-removal-map.md` S11): the armed mark's text at the
 * pointer, drawn by the score's own `drawTempoText` on our surface.
 *
 * ⭐ Measuring, recolouring and parking are {@link drawSignGhost}'s — this module is the SIGN and its
 * one parking rule: the mark STARTS at the pointer (that is where it anchors) and is centred on it
 * vertically, so the preview reads as "this lands here".
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { TempoMark } from '@/types/music'
import { drawTempoText } from '../TempoLayout'
import { drawSignGhost } from './ghostCursor'

/** The class `clearGhosts` sweeps this ghost by — the bare name `openGroup` writes. */
export const TEMPO_GHOST_GROUP_CLASS = 'ghost-tempo'

/** Draw the armed tempo mark at the cursor. False for a mark with no text (one that only sounds). */
export function drawTempoGhost(ctx: DrawContext, cursorX: number, cursorY: number, mark: TempoMark): boolean {
  if (!mark.text) return false
  const text = mark.text
  return drawSignGhost(ctx, 'ghost-tempo', cursorX, cursorY, () => drawTempoText(ctx, text, 0, cursorY),
    (box, x, y) => ({ dx: x - box.x, dy: y - (box.y + box.height / 2) }))
}
