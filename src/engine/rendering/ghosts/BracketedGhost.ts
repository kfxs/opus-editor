/**
 * ⭐ **THE BRACKETED GRACE STAMP'S GHOST** (`docs/plans/bracketed-grace-plan.md` P2): one black head in
 * its brackets, the armed accidental inside, following the pointer — snapped on a staff to the pitch
 * the click will write, with that pitch's ledger lines. Its own module per CLAUDE.md: `GHOST_DRAWERS`
 * has the ROW, the drawing lives here.
 *
 * ⭐ WHERE the sign and the brackets stand is `layout/bracketedRoom.bracketedLayout` asked for ONE head —
 * the page's own answer — so the preview cannot drift from what the click adds. Drawn in the head's own
 * px about the origin, then placed by ONE transform (`translate` to the head, `scale(k)`), as
 * `GraceGhost` is; a FULL-size bracket (the armed `gould` form) is stamped at `1 / k` inside it.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Accidental as ScoreAccidental } from '@/types/music'
import { EngravedAccidental } from '../engraved/EngravedAccidental'
import { stampGlyph } from '@/engine/engrave/glyph'
import { sweepIntoGhostGroup } from './ghostCursor'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { headGlyph } from '@/engine/engrave/notes/keyLines'
import { MUSIC_FONT_SIZE_PT, accidentalFont, musicFont, musicGlyphFont, noteFont } from '@/engine/engrave/inheritedFonts'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { noteheadInk } from '@/engine/fonts/fontMetrics'
import { BRACKET_FORMS, bracketForm, bracketedLayout, bracketedScale } from '@/engine/layout/bracketedRoom'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { noteLineY, staffLineAtY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { drawLedgerLines, ledgerLineRuns } from '@/engine/engrave/notes/ledgerLines'
import { ledgerLineStyle } from '@/engine/layout/layoutConfig'

/** The class `clearGhosts` sweeps this ghost by. */
export const BRACKETED_GHOST_GROUP_CLASS = 'ghost-bracketed-group'

/** Px between the pointer and the RIGHT BRACKET's ink — the grace ghost's gap: the ghost parks LEFT of
 *  the arrow, whose body runs down-right from its tip. */
const GAP_X = 5

/** The top line's NOTE-line number (`staffFrame.noteLineY`: the bottom line is 1). */
const NOTE_LINE_TOP = 5

/** Its ledger line's overhang, the head's own px — the grace's 3. */
const LEDGER_OVERHANG = 3

/**
 * ⭐ **Where the ghost's HEAD stands for a pointer at `cursorX`** — its left edge, page px; the one
 * placement the stamp reads a click at too (the grace ghost's rule: the reference is the ghost, ⛔ not
 * the pointer).
 */
export function bracketedGhostHead(
  cursorX: number, accidental: ScoreAccidental | null, staffSpacePx: number = STAFF_SPACE_PX,
): { left: number; right: number } {
  const place = ghostPlace(accidental)
  const rightInk = (place.right - place.headX) * staffSpacePx
  const left = cursorX - GAP_X - rightInk
  return { left, right: left + place.headWidth * staffSpacePx }
}

/** The page's layout of ONE bracketed head — the ledger and the pitch only move it vertically. */
function ghostPlace(accidental: ScoreAccidental | null) {
  return bracketedLayout([{ pitches: [{ id: 'ghost', step: 'C', alter: 0, octave: 5 }] }], () => accidental, 'treble', 0).places[0]
}

/**
 * @param staff the staff under the pointer, or null off every staff. ⭐ On one, the ghost SNAPS to the
 *   nearest line or space and draws that pitch's ledger lines; off one, it floats at the pointer.
 * @returns true if the ghost was drawn.
 */
export function drawBracketedGhost(
  ctx: DrawContext, svg: SVGElement, cursorX: number, cursorY: number,
  /** The armed note-entry accidental — drawn INSIDE the brackets, where the page will draw it (B8). */
  accidental: ScoreAccidental | null = null,
  staff: StaffFrame | null = null,
): boolean {
  try {
    const line = staff ? Math.round((NOTE_LINE_TOP - staffLineAtY(staff, cursorY)) * 2) / 2 : null
    const y = staff && line !== null ? noteLineY(staff, line) : cursorY
    const staffScale = staff ? staff.spacePx / STAFF_SPACE_PX : 1
    const k = bracketedScale()
    const form = BRACKET_FORMS[bracketForm()]
    const place = ghostPlace(accidental)
    const head = place.heads[0]
    /** Staff spaces from the head's anchor → the head's own px. */
    const local = (sp: number) => (sp * STAFF_SPACE_PX) / k
    const toLocal = (pagePx: number) => pagePx / (k * staffScale)
    const glyphWidth = noteheadInk('q') * STAFF_SPACE_PX
    // A FULL-size pair inside a `scale(k)` group is stamped at 1/k.
    const parenFont = form.fullSize ? musicFont(MUSIC_FONT_SIZE_PT / k) : musicGlyphFont()

    const group = sweepIntoGhostGroup(svg, BRACKETED_GHOST_GROUP_CLASS, () => {
      if (staff && line !== null) {
        const style = ledgerLineStyle()
        drawLedgerLines(
          ctx, ledgerLineRuns([{ line, x: 0 }], glyphWidth, LEDGER_OVERHANG),
          ledger => toLocal(noteLineY(staff, ledger) - y),
          { ...style, lineWidth: style.lineWidth / k },
        )
      }
      drawNoteHead(ctx, { glyph: headGlyph('q', false), x: 0, y: 0, font: noteFont() })
      if (accidental && head.accidentalX !== null) {
        const glyph = new EngravedAccidental(accidental).getText()
        stampGlyph(ctx, glyph, local(head.accidentalX - place.headX), 0, accidentalFont(glyph))
      }
      stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[form.left]), local(head.leftParenX - place.headX), 0, parenFont)
      stampGlyph(ctx, String.fromCodePoint(GLYPH_CODEPOINTS[form.right]), local(head.rightParenX - place.headX), 0, parenFont)
    })
    if (!group) return false
    const at = bracketedGhostHead(cursorX, accidental, staffScale * STAFF_SPACE_PX)
    group.setAttribute('transform', `translate(${at.left}, ${y}) scale(${k * staffScale})`)
    return true
  } catch (_e) {
    return false
  }
}
