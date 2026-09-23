/**
 * ⭐ **The PARENTHESISED-note stamp's ghost** (`docs/plans/parenthesised-note-plan.md` P4b) — the armed
 * pair, `(  )`, loose at the pointer and centred on it: what the click makes, not where the engraver will
 * put it (every stamp ghost's licence). Drawn by the page's own layout (`layout/headEnclosure`) round a
 * stand-in bare head that is NOT drawn — so the gap between the brackets is the one a note gets.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { HeadEnclosure } from '@/types/music'
import { enclosureLayout } from '@/engine/layout/headEnclosure'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { musicGlyphFont } from '@/engine/engrave/inheritedFonts'
import { stampEnclosure } from '../EnclosurePass'
import { drawSignGhost } from './ghostCursor'

/** The class `ScoreRenderer.clearGhosts` sweeps this ghost by — it must be in `GHOST_GROUP_SELECTOR`
 *  (his report, 2026-09-23: without it every pointer move left a pair behind). */
export const ENCLOSURE_GHOST_GROUP_CLASS = 'ghost-enclosure'

type Box = { x: number; y: number; width: number; height: number }
const centred = (box: Box, cursorX: number, cursorY: number) => ({
  dx: cursorX - (box.x + box.width / 2),
  dy: cursorY - (box.y + box.height / 2),
})

export function drawEnclosureGhost(ctx: DrawContext, cursorX: number, cursorY: number, shape: HeadEnclosure): boolean {
  const layout = enclosureLayout({ notes: [{ id: 'ghost', step: 'B', alter: 0, octave: 4, enclosure: shape }] }, () => null, 'treble')
  if (!layout) return false
  return drawSignGhost(ctx, ENCLOSURE_GHOST_GROUP_CLASS, cursorX, cursorY,
    () => stampEnclosure(ctx, layout, sp => sp * STAFF_SPACE_PX, () => 0, musicGlyphFont()), centred)
}
