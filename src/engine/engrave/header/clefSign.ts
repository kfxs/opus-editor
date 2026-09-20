/**
 * ⭐⭐ **WHAT A CLEF IS, AS OURS — its glyph, the staff line it names, and its face.**
 * S4b0 of `docs/history/vexflow-removal-map.md`.
 *
 * `rendering/engraved/EngravedClef` used to draw the glyph text, the line and the size VexFlow's `Clef` had
 * resolved from its own `Clef.types` table and `Clef.getPoint`. They are rows here now, with today's
 * values exactly — ⛔ no pixel moves.
 *
 * ## ⚠️ These are TODAY's rows, ⛔ not the clef research's answer
 *
 * The P5 note kept *which line each clef names* and the ⅔ a mid-line clef is reduced by as VexFlow's
 * parameters while `docs/research/clef-research.md` was open. Rule 13 (`docs/plans/own-engraving-engine.md` §0.3) is
 * what changed that: a number is never a blocker, so today's value becomes a changeable ROW and the
 * research becomes its preset menu. The ⅔ already moved that way in S1c (`../inheritedFonts`).
 */
import type { Clef } from '@/types/music'
import { GLYPH_CODEPOINTS } from '@/engine/fonts/bravuraMetrics'
import { clefGlyph } from '@/engine/fonts/fontMetrics'
import { clefFont, type FontRow } from '../inheritedFonts'

/** A clef's size: the full one that opens a line, or the reduced one a mid-line change is drawn at. */
export type ClefSize = 'default' | 'small'

/**
 * ⭐ The staff line each clef NAMES — counted from the TOP line, 0, like `../staff/staffFrame` — and
 * that line's y is the glyph's baseline (`./clef`'s rule). Taken from VexFlow's `Clef.types`
 * (`clef.js:17–33`): the G clef on the second line from the bottom, the F clef on the fourth, the C
 * clef on the middle line (alto) and on the fourth (tenor).
 */
export const CLEF_LINES: Record<Clef, number> = {
  treble: 3,
  bass: 1,
  alto: 2,
  tenor: 1,
}

/** One clef, resolved: what to stamp, on which line, in which face. */
export interface ClefSign {
  readonly glyph: string
  readonly line: number
  readonly font: FontRow
}

/** The sign a clef of `clef` at `size` draws. */
export function clefSign(clef: Clef, size: ClefSize): ClefSign {
  return {
    glyph: String.fromCodePoint(GLYPH_CODEPOINTS[clefGlyph(clef)]),
    line: CLEF_LINES[clef],
    font: clefFont(size),
  }
}
