import type { MenuItem } from './MenuItem'
import type { NoteDuration } from '../types/music'
import { UNIT_GLYPH } from '../utils/tempoText'

/**
 * The tempo editor's WORD MENU — the sibling of {@link buildExpressionMenu}, right-click (or the
 * Menu key) while the tempo text cursor is blinking and pick a marking instead of hunting for a
 * character you cannot type. This is Sibelius's own tempo popup replicated whole, column for column
 * (five of them — {@link buildTempoMenu} lays them out):
 *
 *   WORDS       — the Italian tempo vocabulary (column 1) and the jazz feels (column 2), both set
 *                 BOLD because the score engraves tempo text bold, so the row is a specimen. Inserted
 *                 as ordinary text: the mark IS its text; a word states no number and inherits the
 *                 prevailing tempo (see utils/tempoText).
 *   NAVIGATION  — the segno and coda glyphs, set in the notation font and inserted verbatim.
 *   NOTE VALUES — dropped as the Unicode note char that finishes a metronome (` = 120`); each shows
 *                 the picture's keypad shortcut (see NOTE_SHORTCUT — a label, wiring is a next step).
 *   MODULATION  — the metric-modulation cues `←`/`→`, the whole `← ♩ = ♪ →` equation, the
 *                 augmentation dot and the triplet number. The GLYPHS ship now; a modulation that
 *                 actually changes playback is future work (docs/metric-modulation-plan.md). Today
 *                 the equation draws correctly and inherits the prevailing tempo — a placeholder,
 *                 not a lie, because it makes no false numeric claim.
 *   CHARACTERS  — the accented letters, the eszett, the curly quotes and the em dash (columns 3–5),
 *                 each inserted verbatim, for tempo text in any language.
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
 * Sibelius's SECOND column — the jazz-style feels, set BOLD like the Italian words because they are
 * the same kind of thing: a word the score engraves, stating no speed. `CODA` rides along here (the
 * picture lists it as a word, upright, not the round coda glyph — that is a separate row below).
 */
const JAZZ_WORDS: readonly string[] = [
  'Back-beat', 'Ballad', 'Bebop', 'Cool', 'Fusion', 'Hard Bop', 'Medium', 'Up', 'CODA',
]

/**
 * The note-value shortcuts, echoed from the picture's numeric keypad: half = Ctrl+1 down the note
 * ladder to the 32nd = Ctrl+5, with the whole note as Ctrl+6 (it sits at the top of the next column
 * in the picture, but keeps its number). Display only for now — wiring them needs numeric-keypad
 * detection (`event.code === 'Numpad1'`), because plain `Ctrl+1…6` is the browser's tab-switch and
 * cannot be suppressed, so they are labels here and not yet in the editor's key handling.
 */
const NOTE_SHORTCUT: Record<NoteDuration, string> = {
  h: 'Ctrl+1', q: 'Ctrl+2', '8': 'Ctrl+3', '16': 'Ctrl+4', '32': 'Ctrl+5', w: 'Ctrl+6',
}

/**
 * The Bravura SMuFL glyphs the palette places, by name → codepoint, taken straight from the notation
 * font (VexFlow's `Glyphs` table, node_modules/vexflow/build/esm/src/glyphs.js) rather than ASCII
 * look-alikes — so a row IS the mark the score engraves, not a picture of one. SMuFL's `text…` family
 * (U+E1F0–E203) is the set of note values, beams, ties and tuplet brackets meant to sit INLINE in
 * tempo / rehearsal text, which is this palette's whole job; the modulation arrows and the segno /
 * coda have their own dedicated glyphs.
 */
const GLYPH = {
  segno: '\uE047',
  coda: '\uE048',
  arrowRight: '\uEC64',        // metricModulationArrowRight
  arrowLeft: '\uEC63',         // metricModulationArrowLeft
  dot: '\uE1FC',               // textAugmentationDot
  tie: '\uE1FD',               // textTie — the low (below-the-notes) tie
  tupletBracketStart: '\uE1FE', // textTupletBracketStartShortStem
  tuplet3: '\uE1FF',            // textTuplet3ShortStem
  tupletBracketEnd: '\uE200',   // textTupletBracketEndShortStem
  longa: '\uE951',              // mensuralBlackLonga (Bravura has no text/metronome longa)
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
 * One accented / typographic character to drop into the mark's text — the picture's columns 3–5,
 * the foreign-language letters and the curly quotes you cannot always reach from the keyboard. Each
 * inserts its own `char` verbatim; the picture's shortcut, where it shows one, is echoed muted.
 */
interface CharRow {
  char: string
  shortcut?: string
}

/** Column 3's tail — the a/e accents. Grave is `Ctrl+Shift+Alt+<vowel>`, acute is `Ctrl+Shift+<vowel>`,
 *  the pattern the picture spells out; the umlaut, circumflex and cedilla it lists without one. */
const ACCENTS_A: ReadonlyArray<CharRow> = [
  { char: 'à', shortcut: 'Ctrl+Shift+Alt+A' }, { char: 'á', shortcut: 'Ctrl+Shift+A' },
  { char: 'ä' }, { char: 'â' }, { char: 'ç' },
  { char: 'è', shortcut: 'Ctrl+Shift+Alt+E' }, { char: 'é', shortcut: 'Ctrl+Shift+E' },
]

/** Column 4 — the i/o/u accents, then the first bank of uppercase. */
const ACCENTS_IOU: ReadonlyArray<CharRow> = [
  { char: 'ë' }, { char: 'ê' },
  { char: 'ì', shortcut: 'Ctrl+Shift+Alt+I' }, { char: 'í', shortcut: 'Ctrl+Shift+I' }, { char: 'î' },
  { char: 'ò', shortcut: 'Ctrl+Shift+Alt+O' }, { char: 'ó', shortcut: 'Ctrl+Shift+O' }, { char: 'ö' }, { char: 'ô' },
  { char: 'ù', shortcut: 'Ctrl+Shift+Alt+U' }, { char: 'ú', shortcut: 'Ctrl+Shift+U' }, { char: 'ü' }, { char: 'û' },
  { char: 'À' }, { char: 'Á' }, { char: 'Ç' }, { char: 'È' }, { char: 'É' },
]

/** Column 5 — the rest of the uppercase, the eszett, the curly quotes and the em dash. */
const ACCENTS_UPPER: ReadonlyArray<CharRow> = [
  { char: 'Ì' }, { char: 'Í' }, { char: 'Ò' }, { char: 'Ó' }, { char: 'Ô' },
  { char: 'Ù' }, { char: 'Ú' }, { char: 'Ü' }, { char: 'Û' }, { char: 'ß' },
  { char: '‘', shortcut: 'Alt+ñ' }, { char: '’', shortcut: 'Shift+Alt+ñ' },
  { char: '“', shortcut: 'Alt+2' }, { char: '”', shortcut: 'Shift+Alt+2' },
  { char: '—' },
]

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
 * Build the palette — Sibelius's tempo popup, column for column (menus/MenuLayer lays a `columnBreak`
 * out side by side). Five columns:
 *   1. the Italian tempo vocabulary;
 *   2. the jazz feels, the segno/coda navigation glyphs, and the short note values with the `=`;
 *   3. the whole note, the augmentation dot, the modulation arrows and equation, the triplet and
 *      fermata, then the first bank of accented letters;
 *   4. more accented vowels;
 *   5. the uppercase accents, the eszett, the curly quotes and the em dash.
 *
 * Every row places a STRING at the caret, because the mark IS its text (a note glyph, a word, an
 * accent, an arrow are all just characters in it). The one split worth knowing: a note-value row
 * SHOWS the SMuFL metronome specimen ({@link NOTE_GLYPH}) but INSERTS the Unicode note char
 * ({@link UNIT_GLYPH}) `parseTempoText` reads back — the renderer maps one to the other at engrave
 * time. Everything else's label is what it places.
 */
export function buildTempoMenu(insert: TempoMenuInsert): MenuItem[] {
  // Upright bold serif, the way the score engraves tempo text — a specimen, not a description.
  const word = (label: string): MenuItem => ({ label, labelFont: 'bold', onSelect: () => insert.text(label) })
  // A metronome note value: the specimen on the label, the Unicode note char in the string.
  const note = (d: NoteDuration): MenuItem =>
    ({ label: NOTE_GLYPH[d], labelFont: 'music', shortcut: NOTE_SHORTCUT[d], onSelect: () => insert.text(UNIT_GLYPH[d]) })
  // A SMuFL glyph (segno, coda, fermata) set in the notation font and inserted verbatim.
  const music = (glyph: string, shortcut?: string): MenuItem =>
    ({ label: glyph, labelFont: 'music', shortcut, onSelect: () => insert.text(glyph) })
  // Plain text (arrows, the `=`, the equation, the triplet): what it shows is what it places.
  const text = (label: string, shortcut?: string): MenuItem =>
    ({ label, shortcut, onSelect: () => insert.text(label) })
  const char = ({ char: c, shortcut }: CharRow): MenuItem =>
    ({ label: c, shortcut, onSelect: () => insert.text(c) })

  return [
    // Column 1 — the Italian tempo vocabulary.
    ...WORDS.map(word),

    { columnBreak: true },
    // Column 2 — the jazz feels, the navigation glyphs, the short note values.
    ...JAZZ_WORDS.map(word),
    { separator: true },
    music(GLYPH.segno, 'Ctrl+Shift+4'),
    music(GLYPH.coda, 'Ctrl+0'),
    { separator: true },
    note('h'), note('q'), note('8'), note('16'), note('32'),
    text('='),

    { columnBreak: true },
    // Column 3 — the long note values (longa, cuadrada, whole), the dot, the modulation and its
    // beamed building blocks, the triplet and tie, then the a/e accents.
    music(GLYPH.longa),  // longa
    music(GLYPH.double), // double whole (round)
    music(GLYPH.breve),  // cuadrada (the square breve)
    note('w'),           // redonda (whole), Ctrl+6
    // The augmentation dot shows as a music glyph but drops a plain '.', which parseTempoText reads
    // as a dot after the preceding unit.
    { label: GLYPH.dot, labelFont: 'music', shortcut: 'Ctrl+.', onSelect: () => insert.text('.') },
    ...ARROWS.map(({ arrow, shortcut }) => music(arrow, shortcut)),
    // The equation shows in Bravura but inserts the parseable notes between the Bravura arrows.
    { label: MODULATION_LABEL, labelFont: 'music', onSelect: () => insert.text(MODULATION_TEXT) },
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
    ...ACCENTS_A.map(char),

    { columnBreak: true },
    // Column 4 — more accented vowels.
    ...ACCENTS_IOU.map(char),

    { columnBreak: true },
    // Column 5 — uppercase accents, the eszett, curly quotes, em dash.
    ...ACCENTS_UPPER.map(char),
  ]
}
