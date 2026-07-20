import type { MenuItem } from './MenuItem'
import type { NoteDuration } from '../types/music'
import { UNIT_GLYPH } from '../utils/tempoText'

/**
 * The tempo editor's WORD MENU — the sibling of {@link buildExpressionMenu}, right-click (or the
 * Menu key) while the tempo text cursor is blinking and pick a marking instead of hunting for a
 * character you cannot type. It started as Sibelius's whole tempo popup and was trimmed hard to
 * what a tempo mark is actually made of. Two columns ({@link buildTempoMenu} lays them out):
 *
 *   COLUMN 1 — the WORDS: the Italian tempo vocabulary, set BOLD because the score engraves tempo
 *              text bold, so the row is a specimen. Inserted as ordinary text: the mark IS its text;
 *              a word states no number and inherits the prevailing tempo (see utils/tempoText).
 *   COLUMN 2 — everything a metronome/modulation is built from:
 *     · NOTE VALUES — the ladder shortest → longest (32nd … whole, then the two double-whole
 *                     variants), each with its numeric-keypad shortcut (see NOTE_SHORTCUT — a label
 *                     for now, wiring is a next step);
 *     · MODULATION  — the augmentation dot, the `←`/`→` cues, the whole `← ♩ = ♪ →` equation, the
 *                     beamed note groups and the triplet-with-bracket and tie. The GLYPHS ship now;
 *                     a modulation that changes playback is future work (docs/metric-modulation-plan.md).
 *                     Today the equation draws and, carrying no number, inherits the prevailing
 *                     tempo — a placeholder, not a lie, because it makes no false numeric claim;
 *     · the German ESZETT (ß), the one accented character kept — the OS keyboard reaches the rest,
 *       so the French/Italian accents, the jazz feels, segno/coda and curly quotes were all dropped.
 *
 * The one specimen split, same as the expression menu: a note-value LABEL is the SMuFL metronome
 * glyph the score engraves, while what it INSERTS is the Unicode note `parseTempoText` reads back
 * (the renderer maps one to the other at engrave time — TempoLayout.NOTE_GLYPH). Every other row is
 * inserted verbatim, so its label IS what it places.
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

/** The note glyphs keyed by duration, so a row can look its metronome specimen up by name. Built
 *  from {@link DURATIONS} so the two never drift; the glyph literals live there. */
const NOTE_GLYPH = Object.fromEntries(DURATIONS.map(d => [d.duration, d.glyph])) as Record<NoteDuration, string>

/**
 * The Italian tempo vocabulary, Sibelius's own list (its column 1), verbatim and in its order — the
 * relative terms first (`Meno mosso`, `Più mosso`, `A tempo`), then the absolute ones. Free text,
 * never an enum: picking one only spares you the typing (and the misspelling of `Prestissimo`); it
 * states no speed, so the mark inherits the prevailing tempo until you add a metronome. Growing the
 * list is one row.
 */
const WORDS: readonly string[] = [
  'Meno mosso', 'Più mosso', 'A tempo',
  'Adagio', 'Allegretto', 'Allegro', 'Andante', 'Con moto', 'Grave', 'Largo', 'Lento',
  'Maestoso', 'Moderato', 'Prestissimo', 'Presto', 'Tempo', 'Tempo primo', 'Vivace', 'Vivo',
]

/**
 * The keypad NUMBER each note value binds to — the single source of truth for both the menu's
 * shortcut LABEL (`Ctrl+Num N`) and the editor's actual key wiring
 * ({@link TempoTextSource.getInsertions}, matching `Numpad N`), so the two can never drift. It must
 * be the NUMERIC KEYPAD, not the top row: plain `Ctrl+1…6` is the browser's own tab-switch, which a
 * page cannot suppress. Shortest → longest: fusa (32nd) on 1 up to redonda (whole) on 6.
 */
export const NOTE_KEYPAD: Record<NoteDuration, number> = {
  '32': 1, '16': 2, '8': 3, q: 4, h: 5, w: 6,
}
const NOTE_SHORTCUT: Record<NoteDuration, string> =
  Object.fromEntries(Object.entries(NOTE_KEYPAD).map(([d, n]) => [d, `Ctrl+Num ${n}`])) as Record<NoteDuration, string>

/**
 * The Bravura SMuFL glyphs the palette places, by name → codepoint, taken straight from the notation
 * font (VexFlow's `Glyphs` table, node_modules/vexflow/build/esm/src/glyphs.js) rather than ASCII
 * look-alikes — so a row IS the mark the score engraves, not a picture of one. SMuFL's `text…` family
 * (U+E1F0–E203) is the set of note values, beams, ties and tuplet brackets meant to sit INLINE in
 * tempo / rehearsal text, which is this palette's whole job; the modulation arrows have their own
 * dedicated glyphs.
 */
export const GLYPH = {
  arrowRight: '\uEC64',        // metricModulationArrowRight
  arrowLeft: '\uEC63',         // metricModulationArrowLeft
  dot: '\uECB7',               // metAugmentationDot — matches the dot TempoLayout engraves (ECB7)
  tie: '\uE1FD',               // textTie — the low (below-the-notes) tie
  tupletBracketStart: '\uE1FE', // textTupletBracketStartShortStem
  tuplet3: '\uE1FF',            // textTuplet3ShortStem
  tupletBracketEnd: '\uE200',   // textTupletBracketEndShortStem
  double: '\uECA0',           // metNoteDoubleWhole (the round double whole)
  breve: '\uECA1',              // metNoteDoubleWholeSquare — the square "cuadrada"
  noteStem: '\uE1F0',           // textBlackNoteShortStem — a stemmed note (short stem)
  noteStemLong: '\uE1F1',       // textBlackNoteLongStem — a stemmed note (long stem)
  noteFrac8: '\uE1F2',          // textBlackNoteFrac8thShortStem — a note WITH its own 8th (fractional) beam
  beam8: '\uE1F7',              // textCont8thBeamShortStem — the 8th continuation beam
  beam16: '\uE1F9',             // textCont16thBeamShortStem
  beam32: '\uE1FB',             // textCont32ndBeamLongStem
} as const

/** The modulation arrows, from Bravura — right then left, the picture's order and shortcuts. */
const ARROWS: ReadonlyArray<{ arrow: string; shortcut: string }> = [
  { arrow: GLYPH.arrowRight, shortcut: "Ctrl+'" },
  { arrow: GLYPH.arrowLeft, shortcut: 'Ctrl+¡' },
]

/**
 * The whole metric-modulation equation as one ready-made row — `← ♩ = ♪ →`. The LABEL shows it in
 * Bravura (arrows + text-note glyphs); what it INSERTS keeps the ♩/♪ as UNIT_GLYPH so the notes
 * still engrave and parse, with the Bravura arrows either side. Playing the modulation — and drawing
 * those arrows in the engraved mark — is future work (docs/metric-modulation-plan.md).
 */
const MODULATION_LABEL = `${GLYPH.arrowLeft}\u2002${NOTE_GLYPH['q']}\u2002=\u2002${NOTE_GLYPH['8']}\u2002${GLYPH.arrowRight}`
const MODULATION_TEXT = `${GLYPH.arrowLeft} ${UNIT_GLYPH.q} = ${UNIT_GLYPH['8']} ${GLYPH.arrowRight}`

/**
 * How the menu puts something into the editor at the caret. One door: everything a tempo row places
 * is a character in the mark's own text (a note glyph, a word, an arrow) — unlike a dynamic, which
 * is an atomic glyph chip. The note-value → Unicode-char mapping is the menu's own job, below.
 */
export interface TempoMenuInsert {
  /** Put a string at the caret, verbatim. */
  text(s: string): void
}

/**
 * Build the palette — two columns (menus/MenuLayer lays a `columnBreak` out side by side):
 *   1. the Italian tempo vocabulary;
 *   2. the note-value ladder (shortest → longest, then the double-whole variants), a divider, then
 *      the augmentation dot, the modulation arrows and equation, the beamed groups, the triplet and
 *      tie, a divider, and the bold ß.
 *
 * Every row places a STRING at the caret, because the mark IS its text (a note glyph, a word, an
 * arrow are all just characters in it). The one split worth knowing: a note-value row SHOWS the
 * SMuFL metronome specimen ({@link NOTE_GLYPH}) but INSERTS the Unicode note char ({@link UNIT_GLYPH})
 * `parseTempoText` reads back — the renderer maps one to the other at engrave time. Everything else's
 * label is what it places.
 */
export function buildTempoMenu(insert: TempoMenuInsert): MenuItem[] {
  // Upright bold serif, the way the score engraves tempo text — a specimen, not a description.
  const word = (label: string): MenuItem => ({ label, labelFont: 'bold', onSelect: () => insert.text(label) })
  // A metronome note value: the specimen on the label, the Unicode note char in the string.
  const note = (d: NoteDuration): MenuItem =>
    ({ label: NOTE_GLYPH[d], labelFont: 'note', shortcut: NOTE_SHORTCUT[d], onSelect: () => insert.text(UNIT_GLYPH[d]) })
  // A SMuFL glyph (a double-whole, a beamed group, the tie, an arrow…) in the notation font, verbatim.
  const music = (glyph: string, shortcut?: string): MenuItem =>
    ({ label: glyph, labelFont: 'note', shortcut, onSelect: () => insert.text(glyph) })

  return [
    // Column 1 — the Italian tempo vocabulary.
    ...WORDS.map(word),

    { columnBreak: true },
    // Column 2 — the note values (shortest → longest), then the modulation building blocks and ß.
    note('32'), note('16'), note('8'), note('q'), note('h'), note('w'),
    music(GLYPH.double), // double whole (round)
    music(GLYPH.breve),  // cuadrada (the square breve)
    { separator: true },
    // The augmentation dot shows as a music glyph but drops a plain '.', which parseTempoText reads
    // as a dot after the preceding unit.
    { label: GLYPH.dot, labelFont: 'note', shortcut: 'Ctrl+Num .', onSelect: () => insert.text('.') },
    ...ARROWS.map(({ arrow, shortcut }) => music(arrow, shortcut)),
    // The equation shows in Bravura but inserts the parseable notes between the Bravura arrows.
    { label: MODULATION_LABEL, labelFont: 'note', onSelect: () => insert.text(MODULATION_TEXT) },
    // The beamed eighth PAIR — note, single beam, note — the label the picture shows next.
    music(`${GLYPH.noteStem}${GLYPH.beam8}${GLYPH.noteFrac8}`),
    // The modulation's building blocks: BEAMED note groups (SMuFL text-note family), not flagged singles.
    music(`${GLYPH.noteStem}${GLYPH.beam8}`),      // beamed eighths
    music(`${GLYPH.noteStem}${GLYPH.beam16}`),     // beamed sixteenths
    music(`${GLYPH.noteStemLong}${GLYPH.beam32}`), // beamed thirty-seconds
    // The triplet WITH its bracket — start-bracket, the 3, end-bracket composed.
    music(`${GLYPH.tupletBracketStart}${GLYPH.tuplet3}${GLYPH.tupletBracketEnd}`, 'Ctrl+3'),
    music(GLYPH.tie),    // the low tie
    { separator: true },
    word('ß'), // German eszett — bold, like the words
  ]
}
