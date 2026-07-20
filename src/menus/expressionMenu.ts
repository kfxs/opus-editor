import type { MenuItem } from './MenuItem'

/**
 * The expression editor's WORD MENU — right-click while the text cursor is blinking and pick a
 * standard marking instead of typing it.
 *
 * Sibelius's own feature, and worth copying for the same reason it exists there: the common
 * expressions are a small, fixed, spelling-sensitive vocabulary (`dolce`, `cantabile`, `sempre`),
 * and picking one from a list is faster and safer than typing it — no misspelling, no wondering
 * whether it is italic. Its shortcuts sibling is `DYNAMIC_INSERT_KEYS`: Ctrl+letter covers the
 * glyphs you reach for constantly, the word menu covers the words you do not.
 *
 * ⚠️ These are WORDS, not dynamics — they insert as ordinary editable text in the box's italic
 * serif, never as a glyph chip. That is the whole point of the distinction the model rests on: a
 * typed `p` is a letter, only the SMuFL glyph is piano (see utils/dynamics). So nothing in here may
 * ever be a level name — a `dolce` never changes how loud playback is.
 *
 * Currently one entry, deliberately. The vocabulary is worth growing from real use rather than
 * dumping a dictionary in; adding one is a row, and separators/submenus are already available if it
 * grows enough to want categories.
 */
export const EXPRESSION_WORDS: readonly string[] = [
  'dolce',
]

/**
 * Build the word menu's items. `insertText` is supplied by whoever owns the caret — the menu itself
 * has no idea where the text is going, which is what lets the same list serve any text editor that
 * grows one later.
 */
export function buildExpressionMenu(insertText: (text: string) => void): MenuItem[] {
  return EXPRESSION_WORDS.map(word => ({
    label: word,
    onSelect: () => insertText(word),
  }))
}
