/**
 * ⭐⭐ **THE ACTIVE TEXT FACE — the score's WORDS, one owner** (`docs/plans/text-font-switch-plan.md`).
 *
 * ⛔ **Not the music font, and not tied to it** (`fonts/musicFont` — his rule, 2026-09-21: *"text font
 * is different than musical font"*). ⛔ And not the face of the music SYMBOLS that sit inside words
 * (the ♩ of a tempo mark, a dynamic's letters) — those stay the music font's; a SMuFL "Text" companion
 * such as Sebastian Text is a THIRD choice, researched in `docs/research/music-text-fonts-research.md`.
 *
 * ## ⭐ A ROLE asks for a STYLE, and a style falls back when the face lacks it
 *
 * The books ask for four styles of one family (Gould p. 492: roman for instructions, **bold roman for
 * tempi**, *italic for expression*; `docs/research/score-text-fonts-research.md` §3.1), and the free
 * faces do not all have four. So nobody asks for "the text font": a role asks {@link textFamily} for
 * the style it is set in, and gets a CSS stack LED BY A FACE THAT HAS A REAL FILE FOR THAT STYLE.
 *
 * ⚠️ Why the fallback is decided HERE and not left to CSS: asked for bold in a family with no bold
 * file, a browser does not fall through to the next family — it SYNTHESISES a bold (and an oblique
 * for italic). Ross: *"a tilted roman type should not be substituted for the italic."*
 *
 * | style | Academico (default) | Edwin | Nepomuk |
 * |---|---|---|---|
 * | regular | ✅ | ✅ | ✅ |
 * | bold | ✅ | ✅ | ⛔ → Academico's bold |
 * | italic | ⛔ → the system serif stack, as always | ✅ | ✅ |
 * | boldItalic | ⛔ → the system serif stack | ✅ | ⛔ → the system serif stack |
 *
 * ⭐ For Academico every answer is the string the engine used before this module existed — tempo
 * words in `Academico`, expression words in `Georgia, "Times New Roman", Times, serif` — so the
 * default moved no pixel. ⚠️ That serif stack is a SYSTEM font: not shipped, not outlined in the PDF.
 * A face with a real italic (Edwin) is the first time those words are ours.
 *
 * 🚧 EXPERIMENTAL, the dev shell's: not in the score JSON, not persisted — a house-style row one day.
 * No DOM (`engine/fonts/` is fenced).
 */

export type TextFontId = 'academico' | 'edwin' | 'nepomuk'
export type TextStyle = 'regular' | 'bold' | 'italic' | 'boldItalic'

export interface TextFontRow {
  id: TextFontId
  /** The CSS family, as its `FONT_FILES` rows register it. */
  family: string
  label: string
  /** The styles this face has a REAL file for (`fonts/fontFiles`). */
  styles: readonly TextStyle[]
}

export const TEXT_FONTS: readonly TextFontRow[] = [
  { id: 'academico', family: 'Academico', label: 'Academico', styles: ['regular', 'bold'] },
  { id: 'edwin', family: 'Edwin', label: 'Edwin', styles: ['regular', 'bold', 'italic', 'boldItalic'] },
  { id: 'nepomuk', family: 'Nepomuk', label: 'Nepomuk', styles: ['regular', 'italic'] },
]

export const DEFAULT_TEXT_FONT: TextFontId = 'academico'

/**
 * Where an ITALIC run goes when no shipped face has the style — the stack expression words have
 * always been set in (`dynamicStyle.DYNAMIC_TEXT_FONT` until 2026-09-21), chosen because it has a
 * true italic. ⚠️ A system font: whatever the viewer has installed.
 */
export const SYSTEM_SERIF_STACK = 'Georgia, "Times New Roman", Times, serif'

let active: TextFontId = DEFAULT_TEXT_FONT
let generation = 0

function rowOf(id: TextFontId): TextFontRow {
  return TEXT_FONTS.find(row => row.id === id)!
}

export function activeTextFont(): TextFontRow {
  return rowOf(active)
}

/** Choose the face. ⚠️ Only writes the choice: the caller loads it and asks for the render. */
export function setActiveTextFont(id: TextFontId): boolean {
  if (id === active || !TEXT_FONTS.some(row => row.id === id)) return false
  active = id
  generation++
  return true
}

/** Bumped by every switch — in the width key and the layout key, like the music font's: words have widths. */
export function textFontGeneration(): number {
  return generation
}

/**
 * ⭐ The CSS family stack for words in `style`: the active face if it has a real file for the style,
 * else the default face if IT has, else the system serif stack — which also ends every stack, so a
 * character the face lacks still lands in a serif.
 */
export function textFamily(style: TextStyle): string {
  const led = [activeTextFont(), rowOf(DEFAULT_TEXT_FONT)].find(row => row.styles.includes(style))
  if (!led) return SYSTEM_SERIF_STACK
  // ⚠️ Academico's own answers carry no serif tail: they are, to the character, what was there before.
  return led.id === DEFAULT_TEXT_FONT ? led.family : `${led.family}, ${SYSTEM_SERIF_STACK}`
}

/** Whether `style` is set in a face WE ship for the active choice — false means the system stack. */
export function textStyleIsShipped(style: TextStyle): boolean {
  return [activeTextFont(), rowOf(DEFAULT_TEXT_FONT)].some(row => row.styles.includes(style))
}
