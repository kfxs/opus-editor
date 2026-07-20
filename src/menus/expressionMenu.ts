import type { MenuItem } from './MenuItem'
import { composeDynamicGlyphs, levelToGlyphString } from '../utils/dynamics'

/**
 * The expression editor's WORD MENU — Sibelius's expressions palette, right-click (or the Menu key)
 * while the text cursor is blinking and pick a marking instead of typing it.
 *
 * Two columns, side by side, mirroring the first two of Sibelius's own palette:
 *
 *   DYNAMICS — inserted as the SMuFL glyph, so they are real dynamics and play.
 *   WORDS    — inserted as ordinary italic text, so they never touch playback.
 *
 * That split is the model's central distinction made visible (see utils/dynamics): the FONT decides
 * what a character means, not its spelling. `niente` appears in both columns and means two different
 * things — the glyph `n` in the left, the word `niente` in the right — which is exactly right and
 * must not be collapsed into one row.
 *
 * Columns rather than one long list because stacked these run past the bottom of the viewport;
 * side by side they fit on screen at once.
 */

/** Left column. Composites first (what you actually place), then the single letters — those are
 *  already Ctrl+<letter> shortcuts, so their rows exist mostly to TEACH the keystroke. Shortcut
 *  strings are display echoes of DYNAMIC_INSERT_KEYS; keep the two in step. */
const DYNAMICS: ReadonlyArray<{ letters: string; shortcut?: string }> = [
  { letters: 'ppp' },
  { letters: 'pp' },
  { letters: 'p', shortcut: 'Ctrl+P' },
  { letters: 'mp' },
  { letters: 'mf' },
  { letters: 'f', shortcut: 'Ctrl+F' },
  { letters: 'ff' },
  { letters: 'fff' },
  { letters: 'fp' },
  { letters: 'sf' },
  { letters: 'sfz' },
  { letters: 'rfz' },
  { letters: 'm', shortcut: 'Ctrl+M' },
  { letters: 'n', shortcut: 'Ctrl+N' },
  { letters: 'r', shortcut: 'Ctrl+R' },
  { letters: 's', shortcut: 'Ctrl+S' },
  { letters: 'z', shortcut: 'Ctrl+Shift+Z' },
]

/**
 * Right column: the standard Italian expression vocabulary, Sibelius's list verbatim. A small,
 * fixed, spelling-sensitive set — picking beats typing, with no misspelling and no doubt about
 * whether it came out italic.
 *
 * ⚠️ Nothing here may ever be a level name. These are WORDS: a `dolce` is prose, and a mark that
 * reads `p` as plain text is silent by design. Growing the list is one row.
 */
const WORDS: ReadonlyArray<{ word: string; shortcut?: string }> = [
  { word: 'cresc.', shortcut: 'Ctrl+Shift+C' },
  { word: 'dim.', shortcut: 'Ctrl+Shift+D' },
  { word: 'dolce' },
  { word: 'espress.' },
  { word: 'legato' },
  { word: 'leggiero' },
  { word: 'marcato' },
  { word: 'meno' },
  { word: 'molto' },
  { word: 'niente' },
  { word: 'più' },
  { word: 'poco' },
  { word: 'sempre' },
  { word: 'staccato' },
  { word: 'subito' },
  { word: 'con' },
  { word: 'senza' },
]

/** Just the words, for anything that wants the vocabulary without the menu shape. */
export const EXPRESSION_WORDS: readonly string[] = WORDS.map(w => w.word)

/**
 * How the menu puts something into the editor. Supplied by whoever owns the caret — the menu has no
 * idea where the text is going, which is what lets the same list serve any editor that grows one.
 */
export interface ExpressionMenuInsert {
  /** A word, as ordinary editable prose. */
  text(word: string): void
  /** A dynamic, as its glyph — the caller decides how one is drawn. */
  dynamic(letters: string): void
}

/** Build the palette: dynamics column, break, words column. */
export function buildExpressionMenu(insert: ExpressionMenuInsert): MenuItem[] {
  return [
    ...DYNAMICS.map(({ letters, shortcut }): MenuItem => ({
      // The row shows the glyph, PRECOMPOSED — the very character the score will engrave (see
      // composeDynamicGlyphs). A palette that spelled `sfz` out of three separate letters while the
      // score drew one would be advertising something it does not place.
      label: composeDynamicGlyphs(levelToGlyphString(letters)),
      labelFont: 'music',
      shortcut,
      onSelect: () => insert.dynamic(letters),
    })),
    { columnBreak: true },
    ...WORDS.map(({ word, shortcut }): MenuItem => ({
      // Italic, because that is how the score engraves expression text — the row is a specimen of
      // the mark, not a description of it. Same reasoning as the glyphs beside it.
      label: word,
      labelFont: 'italic',
      shortcut,
      onSelect: () => insert.text(word),
    })),
  ]
}
