/**
 * ⭐ **THE GRACE STAMP'S GHOST** (`docs/plans/grace-notes-plan.md` §3): one small note of the armed
 * value following the pointer — head, stem, flag and (for an acciaccatura) the slash, at the grace
 * size. Its own module per CLAUDE.md: `GHOST_DRAWERS` has the ROW, the drawing lives here.
 *
 * ⭐ The stem, flag and slash are `GracePass.drawGraceStem` — the page's own ink — so the preview
 * cannot drift from what the click adds. Drawn in the grace's own px about the origin, then placed by
 * ONE transform: `translate` to the pointer, `scale(k)`, as the page's `scaling(k)` group does.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { NoteDuration } from '@/types/music'
import { sweepIntoGhostGroup } from './ghostCursor'
import { drawGraceStem } from '../GracePass'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { noteFont } from '@/engine/engrave/inheritedFonts'
import { noteheadInk } from '@/engine/fonts/fontMetrics'
import { graceScale, graceStemSpaces } from '@/engine/layout/graceRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** The class `clearGhosts` sweeps this ghost by — bare, as `notation.css` styles it. */
export const GRACE_GHOST_GROUP_CLASS = 'ghost-grace-group'

/** Px between the pointer and the head's right edge — the fan ghost's: the head parks LEFT of the
 *  arrow, whose body runs down-right from its tip. */
const GAP_X = 5

/** @returns true if the ghost was drawn. */
export function drawGraceGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, duration: NoteDuration, slash: boolean,
): boolean {
  try {
    const group = sweepIntoGhostGroup(svg, GRACE_GHOST_GROUP_CLASS, () => {
      drawNoteHead(ctx, { glyph: headGlyph(duration, false), x: 0, y: 0, font: noteFont() })
      drawGraceStem(ctx, { headLeft: 0, highY: 0, lowY: 0, duration, slash, space: STAFF_SPACE_PX, stemSpaces: graceStemSpaces() })
    })
    if (!group) return false
    const k = graceScale()
    const headWidth = noteheadInk(duration) * STAFF_SPACE_PX * k
    group.setAttribute('transform', `translate(${cursorX - GAP_X - headWidth}, ${cursorY}) scale(${k})`)
    return true
  } catch (_e) {
    return false
  }
}
