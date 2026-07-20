import type { MenuItem } from './MenuItem'
import type { NoteDuration } from '../types/music'
import { UNIT_GLYPH } from '../utils/tempoText'

/**
 * The tempo editor's WORD MENU — the sibling of {@link buildExpressionMenu}, right-click (or the
 * Menu key) while the tempo text cursor is blinking and pick a note value instead of hunting for a
 * character you cannot type. The keyboard has no ♩ key; Sibelius makes you insert one from a
 * palette, and so do we.
 *
 * PROVISIONAL, and deliberately so: for now the menu is exactly the six note values, each of which
 * drops its glyph at the caret so you can finish the metronome by typing ` = 120`. The mark reads
 * the speed back out of the string it engraves (see utils/tempoText), so `♩` + ` = 120` becomes a
 * real, playing `♩ = 120` with nothing else to wire. The richer content — tempo WORDS (Allegro,
 * Moderato…), a metronome builder — comes next; this is the mechanism landing first.
 *
 * Note the two-character split, the same one {@link buildExpressionMenu} turns on:
 *   • the LABEL is the SMuFL metronome-note glyph the score actually engraves — a SPECIMEN of what
 *     you are placing, not a description of it (labelFont 'music');
 *   • what gets INSERTED is `UNIT_GLYPH[duration]`, the Unicode note character the tempo STRING
 *     stores and `parseTempoText` reads back. The renderer maps that Unicode char to this same
 *     SMuFL glyph at engrave time (TempoLayout.NOTE_GLYPH), so the row and the page agree.
 */

/**
 * The note values, longest → shortest, each with the SMuFL metronome-note glyph the score engraves
 * it as. Codepoints mirror `TempoLayout.NOTE_GLYPH` (metNoteWhole … metNote32ndUp) — written out
 * rather than imported, the same convention TempoLayout keeps for these very glyphs (VexFlow's
 * `Glyphs` enum is CJS-only and resolves to undefined in the browser). Keep the two lists in step.
 */
const DURATIONS: ReadonlyArray<{ duration: NoteDuration; glyph: string }> = [
  { duration: 'w', glyph: '' },  // metNoteWhole
  { duration: 'h', glyph: '' },  // metNoteHalfUp
  { duration: 'q', glyph: '' },  // metNoteQuarterUp
  { duration: '8', glyph: '' },  // metNote8thUp
  { duration: '16', glyph: '' }, // metNote16thUp
  { duration: '32', glyph: '' }, // metNote32ndUp
]

/**
 * How the menu puts a note value into the editor. Supplied by whoever owns the caret — the menu
 * has no idea where the text is going, the same split {@link ExpressionMenuInsert} draws.
 */
export interface TempoMenuInsert {
  /** Place a note-value character — the Unicode glyph the tempo string stores. */
  unit(char: string): void
}

/** Build the palette: one row per note value, its metronome glyph as the label. */
export function buildTempoMenu(insert: TempoMenuInsert): MenuItem[] {
  return DURATIONS.map(({ duration, glyph }): MenuItem => ({
    label: glyph,
    labelFont: 'music',
    onSelect: () => insert.unit(UNIT_GLYPH[duration]),
  }))
}
