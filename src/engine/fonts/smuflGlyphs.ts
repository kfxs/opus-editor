/**
 * ⭐ **ANY SMuFL GLYPH, BY NAME** — the one reader of `./smuflGlyphTable`, for what the USER places
 * (docs/plans/symbol-plan.md: a symbol may be any glyph of the 2,932). The editor's own drawing reads
 * `./fontMetrics`, whose closed `GlyphName` union is the list of what it draws; this module is for an
 * open name the model stores (`GlyphMark.glyph`), so it answers `null` for a name it does not know —
 * ⛔ never a plausible box.
 *
 * ⚠️ **Bravura's numbers, whatever the active face.** The table is generated from the OTF we ship as
 * the default; a Leipzig or Sebastian drawing of the same glyph may sit a little differently. A first
 * cut, written down — the per-face tables (`./leipzigMetrics`) cover only the editor's own glyphs.
 *
 * Everything in staff spaces, y UP, from the glyph's own origin (as `GlyphBox`).
 */
import type { GlyphBox } from './fontMetrics'
import { SMUFL_GLYPH_TABLE } from './smuflGlyphTable'

/** What the engine knows about one SMuFL glyph. */
export interface SmuflGlyph {
  /** The character to draw in the music font. */
  char: string
  /** Its ink, and the font's advance. */
  box: GlyphBox
  /**
   * ⭐ **Where the glyph's visual centre is, horizontally** — the x to put over the middle of what it
   * marks. Bravura's `opticalCenter` where the metadata declares one; otherwise HALF THE ADVANCE WIDTH,
   * which SMuFL names as *"an acceptable default"* (it calls the bounding box's centre *"least
   * satisfactory"* — docs/research/symbol-anchoring-industry-research.md §5).
   */
  centerX: number
}

/** The glyph named `name`, or null if the table has no row for it (unknown, or drawn with no ink). */
export function smuflGlyph(name: string): SmuflGlyph | null {
  // ⚠️ An own-property test, not a bare index: `'constructor'` or `'toString'` must not find a row.
  if (!Object.prototype.hasOwnProperty.call(SMUFL_GLYPH_TABLE, name)) return null
  const row = SMUFL_GLYPH_TABLE[name]
  const [codepoint, left, right, up, down, advance] = row
  return {
    char: String.fromCodePoint(codepoint),
    box: { left, right, up, down, advance },
    centerX: row.length === 8 ? row[6] : advance / 2,
  }
}
