/**
 * ⭐ **THE CLEF AND METER GHOSTS — S11a** (`docs/history/vexflow-removal-map.md` S11).
 *
 * The armed clef or time signature, shown loose at the pointer. ⭐ Drawn by the SAME sign objects the
 * score's own header draws (`EngravedClef`, `EngravedTimeSignature`) on OUR surface, where a line-less
 * VexFlow `Stave` used to be built just to paint one sign — so the preview is the page's glyph at the
 * page's size, from one source.
 *
 * ⚠️ Only the glyph's SHAPE matters: the group is parked with its ink box's centre on the pointer
 * (`centreGhostOnCursor`), so where the sign is first drawn is irrelevant. It is drawn against a
 * stand-in frame where that throwaway stave's lines would have been (4 spaces of headroom below the
 * cursor's y, VexFlow's default), which is only ever visible in jsdom, where nothing is measured.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Clef, TimeSignature } from '@/types/music'
import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { STAVE_LINE_DISTANCE_PX } from '@/engine/engrave/inheritedDefaults'
import { EngravedClef } from './EngravedClef'
import { EngravedTimeSignature } from './EngravedTimeSignature'
import type { StaveSign } from './staveSign'
import { centreGhostOnCursor, sweepIntoGhostGroup } from './ghostCursor'

/** The throwaway stave's headroom, in spaces — VexFlow's `spaceAboveStaffLn` default. */
const STAND_IN_HEADROOM_SPACES = 4

function drawSignGhostAt(
  ctx: DrawContext, svg: SVGElement, cls: string, cursorX: number, cursorY: number, sign: StaveSign,
): boolean {
  try {
    const frame: StaffFrame = {
      topLineY: cursorY + STAND_IN_HEADROOM_SPACES * STAVE_LINE_DISTANCE_PX,
      spacePx: STAVE_LINE_DISTANCE_PX,
      lineCount: 0,
    }
    const group = sweepIntoGhostGroup(svg, cls, () => sign.drawSign(ctx, frame, ctx))
    if (!group) return false
    centreGhostOnCursor(group, cursorX, cursorY)
    return true
  } catch (_e) {
    return false
  }
}

/** The armed clef, at the pointer. */
export function drawClefGhost(ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, clef: Clef): boolean {
  return drawSignGhostAt(ctx, svg, 'ghost-clef-group', cursorX, cursorY, new EngravedClef(clef, 'default'))
}

/** The armed time signature, at the pointer. */
export function drawTimeSignatureGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, ts: TimeSignature,
): boolean {
  return drawSignGhostAt(ctx, svg, 'ghost-timesig-group', cursorX, cursorY, new EngravedTimeSignature(ts))
}
