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
import type { Accidental, ArticulationType, NoteDuration } from '@/types/music'
import { EngravedArticulation } from '../engraved/EngravedArticulation'
import { MODIFIER_POSITION } from '../engraved/EngravedModifier'
import { ARTICULATION_CODES } from '../beams/fanArticulations'
import { ARTICULATION_RENDER_ORDER } from '../engraved/NoteBuilder'
import { ARTICULATION_OUTSIDE_ROW, placeArticulation } from '@/engine/engrave/notes/articulationPlacement'
import { textRowBelowY } from '@/engine/engrave/staff/staffFrame'
import { NOTE_DURATION_ROWS } from '@/engine/engrave/inheritedDefaults'
import { EngravedAccidental } from '../engraved/EngravedAccidental'
import { stampGlyph } from '@/engine/engrave/glyph'
import { accidentalExtent } from '@/engine/layout/spacingPadding'
import { sweepIntoGhostGroup } from './ghostCursor'
import { GRACE_LEDGER_OVERHANG, drawGraceDots, drawGraceStem } from '../GracePass'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { accidentalFont, musicGlyphFont, noteFont } from '@/engine/engrave/inheritedFonts'
import { glyphBox, glyphNameOf, noteheadInk } from '@/engine/fonts/fontMetrics'
import { graceScale, graceStemSpaces } from '@/engine/layout/graceRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { noteLineY, staffLineAtY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { drawLedgerLines, ledgerLineRuns } from '@/engine/engrave/notes/ledgerLines'
import { ledgerLineStyle } from '@/engine/layout/layoutConfig'

/** The class `clearGhosts` sweeps this ghost by — bare, as `notation.css` styles it. */
export const GRACE_GHOST_GROUP_CLASS = 'ghost-grace-group'

/** Px between the pointer and the head's right edge — the fan ghost's: the head parks LEFT of the
 *  arrow, whose body runs down-right from its tip. */
const GAP_X = 5

/** The top line's NOTE-line number (`staffFrame.noteLineY`: the bottom line is 1). */
const NOTE_LINE_TOP = 5

/**
 * @param staff the staff under the pointer, or null off every staff. ⭐ On one, the ghost SNAPS to the
 *   nearest line or space — the pitch the click will write — and draws that pitch's ledger lines and
 *   its stem as the page will (Gould p. 126's longer stem included). Off one, it floats at the pointer.
 * @returns true if the ghost was drawn.
 */
export function drawGraceGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number, duration: NoteDuration, slash: boolean,
  /** The armed note-entry accidental — drawn where the page will draw it, its own extent left of the head. */
  accidental: Accidental | null = null,
  staff: StaffFrame | null = null,
  dots = 0,
  /** The armed note-entry articulations — placed by the page's rule (`articulationPlacement`). */
  articulations: readonly ArticulationType[] = [],
): boolean {
  try {
    // The pitch under the pointer, as a NOTE line (bottom line 1) — half a space is a step.
    const line = staff ? Math.round((NOTE_LINE_TOP - staffLineAtY(staff, cursorY)) * 2) / 2 : null
    const y = staff && line !== null ? noteLineY(staff, line) : cursorY
    // The ghost's own px are a FULL-size staff's: a small staff's space scales the whole group.
    const staffScale = staff ? staff.spacePx / STAFF_SPACE_PX : 1
    const k = graceScale()
    const toLocal = (pagePx: number) => pagePx / (k * staffScale)
    const glyphWidth = noteheadInk(duration) * STAFF_SPACE_PX

    const group = sweepIntoGhostGroup(svg, GRACE_GHOST_GROUP_CLASS, () => {
      if (staff && line !== null) {
        const style = ledgerLineStyle()
        drawLedgerLines(
          ctx, ledgerLineRuns([{ line, x: 0 }], glyphWidth, GRACE_LEDGER_OVERHANG),
          ledger => toLocal(noteLineY(staff, ledger) - y),
          { ...style, lineWidth: style.lineWidth / k },
        )
      }
      drawNoteHead(ctx, { glyph: headGlyph(duration, false), x: 0, y: 0, font: noteFont() })
      if (accidental) {
        const glyph = new EngravedAccidental(accidental).getText()
        const reach = accidentalExtent([{ position: 0, sign: accidental }]) * STAFF_SPACE_PX
        stampGlyph(ctx, glyph, -reach, 0, accidentalFont(glyph))
      }
      // On a staff the dot knows its line; floating free, it stands level with the head.
      drawGraceDots(ctx, 0, [0], [line !== null && Number.isInteger(line) ? 1 : 0.5], { duration, dots }, STAFF_SPACE_PX)
      const stemSpaces = graceStemSpaces(line !== null ? [line] : [])
      drawGraceStem(ctx, {
        headLeft: 0, highY: 0, lowY: 0, duration, slash, space: STAFF_SPACE_PX, stemSpaces,
      })
      drawGhostArticulations(ctx, articulations, {
        staff, line, y, k, staffScale, stemmed: NOTE_DURATION_ROWS[duration].stem,
        stemPagePx: stemSpaces * (staff?.spacePx ?? STAFF_SPACE_PX), centreX: glyphWidth / 2,
      })
    })
    if (!group) return false
    const headWidth = glyphWidth * k * staffScale
    group.setAttribute('transform', `translate(${cursorX - GAP_X - headWidth}, ${y}) scale(${k * staffScale})`)
    return true
  } catch (_e) {
    return false
  }
}

/**
 * ⭐ The armed ARTICULATIONS on the ghost — the page's rule (`engrave/notes/articulationPlacement`, the
 * same function `EngravedArticulation.place` runs) at the snapped pitch, on the staff under the pointer:
 * below (a grace's stem is always up), the step out scaled by the grace's size, snapped into a space of
 * the real staff. ⚠️ A stack of several steps one text line per mark — the page measures each glyph
 * (`articulationStack`); the ghost is a preview. Off every staff, each mark simply hangs a step lower.
 */
function drawGhostArticulations(
  ctx: DrawContext,
  types: readonly ArticulationType[],
  a: {
    staff: StaffFrame | null; line: number | null; y: number; k: number; staffScale: number
    stemmed: boolean; stemPagePx: number
    /** The head's centre, in the ghost's own px. */
    centreX: number
  },
): void {
  const sorted = [...types].sort((p, q) => ARTICULATION_RENDER_ORDER.indexOf(p) - ARTICULATION_RENDER_ORDER.indexOf(q))
  const toLocal = (pagePx: number) => pagePx / (a.k * a.staffScale)
  sorted.forEach((type, i) => {
    const art = new EngravedArticulation(ARTICULATION_CODES[type]).setPosition(MODIFIER_POSITION.BELOW)
    const glyph = art.getText()
    let markY: number // page px
    if (a.staff && a.line !== null) {
      markY = placeArticulation({
        side: 'below', textLine: i, canSitBetweenLines: art.canSitBetweenLines(),
        staffSpace: a.staff.spacePx, hasStem: a.stemmed, stemDirection: 1,
        stemTipY: a.y - a.stemPagePx, stemBaseY: a.y, headYs: [a.y], headY: a.y, headLine: a.line,
        outsideStaffY: textRowBelowY(a.staff, ARTICULATION_OUTSIDE_ROW), outwardScale: a.k,
      }).y
    } else {
      markY = a.y + (i + 1) * a.k * STAFF_SPACE_PX
    }
    // Centred on its point, as the page's mark is (`setOrigin(0.5, 0.5)`), at the grace's size.
    const name = glyphNameOf(glyph)
    const box = name ? glyphBox(name) : null
    const halfW = box ? ((box.right - box.left) / 2) * STAFF_SPACE_PX : 0
    const baselineDrop = box ? ((box.up - box.down) / 2) * STAFF_SPACE_PX : 0
    stampGlyph(ctx, glyph, a.centreX - halfW, toLocal(markY - a.y) + baselineDrop, musicGlyphFont())
  })
}
