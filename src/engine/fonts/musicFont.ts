/**
 * ⭐⭐ **THE ACTIVE MUSIC FONT — one owner** (Phase A of `docs/plans/music-font-switch-plan.md`).
 *
 * Which SMuFL face the SCORE's glyphs are set in. Everything that names the music family in the
 * score's drawing asks {@link musicFontStack} — `fontCategories`' root, `engrave/inheritedFonts`'
 * rows, the dynamic and tempo marks — so a switch is one write here plus a re-engrave.
 *
 * ## 🚧 EXPERIMENTAL — what a switch does and does NOT do yet
 *
 * It swaps the FACE. ⚠️ The metrics (`fontMetrics` — ink extents, line weights) are still
 * Bravura's whatever is chosen; that is Phase B. ⛔ The choice is not in the score JSON and is not
 * persisted: it is the dev shell's, until house styles exist.
 *
 * ## ⭐ A missing glyph comes from Bravura — the stack IS the rule
 *
 * {@link musicFontStack} is `'<face>,Bravura,Academico'`: CSS font matching is per character, so a
 * glyph the chosen face lacks (Leipzig has no `bracket`, no reversed bracket tips, none of
 * Bravura's brace alternates; Sebastian no `bracket` — measured 2026-09-21 on the 73 glyphs we
 * draw) is drawn, and measured, in Bravura. For Bravura itself the stack is `'Bravura,Academico'`,
 * exactly what it was.
 *
 * ⛔ This is the MUSIC font only. Words are a separate choice (plan rule 2) — ⛔ never derive a text
 * face from the id here.
 *
 * ⛔ The UI chrome (Keypad, windows, menus) does not ask this module: it keeps Bravura on purpose.
 *
 * No DOM: `engine/fonts/` is fenced by `lint:boundary`. Loading the face before the render that
 * uses it is `rendering/painter/musicFontFaces.loadMusicFont`'s job.
 */

export type MusicFontId = 'bravura' | 'leipzig' | 'sebastian'

export interface MusicFontRow {
  id: MusicFontId
  /** The CSS family, as its `FONT_FILES` row registers it. */
  family: string
  label: string
}

export const MUSIC_FONTS: readonly MusicFontRow[] = [
  { id: 'bravura', family: 'Bravura', label: 'Bravura' },
  { id: 'leipzig', family: 'Leipzig', label: 'Leipzig' },
  { id: 'sebastian', family: 'Sebastian', label: 'Sebastian' },
]

/** The face every metrics table, spec and UI picture is pinned to, and every other face's fallback. */
export const DEFAULT_MUSIC_FONT: MusicFontId = 'bravura'

/** The text face behind the music faces — where a letter in a music-first stack lands. */
const TEXT_FALLBACK = 'Academico'

let active: MusicFontId = DEFAULT_MUSIC_FONT
let generation = 0

function rowOf(id: MusicFontId): MusicFontRow {
  return MUSIC_FONTS.find(row => row.id === id)!
}

export function activeMusicFont(): MusicFontRow {
  return rowOf(active)
}

/**
 * Choose the face. ⚠️ It only writes the choice: the caller loads the face and asks for the render
 * (`MusicEngine.setMusicFont`). Returns false when nothing changed.
 */
export function setActiveMusicFont(id: MusicFontId): boolean {
  if (id === active || !MUSIC_FONTS.some(row => row.id === id)) return false
  active = id
  generation++
  return true
}

/**
 * Bumped by every switch — what `ScoreRenderer.layoutStateKey` holds, so the memoised widths and the
 * casting-off made in the old face go stale (a glyph measured on the canvas is a WIDTH input).
 */
export function musicFontGeneration(): number {
  return generation
}

/**
 * The music faces ALONE — the chosen one with Bravura behind it, no text face: what a run that is
 * only ever glyphs asks for (a dynamic's letters), and what a text-first stack appends as its
 * per-character fallback. `'Bravura'` for the default, exactly what those sites spelt before.
 */
export function musicOnlyStack(): string {
  const chosen = activeMusicFont().family
  const fallback = rowOf(DEFAULT_MUSIC_FONT).family
  return chosen === fallback ? fallback : `${chosen}, ${fallback}`
}

/** ⭐ The CSS family stack the score's glyphs are set in: the chosen face, Bravura behind it, then words. */
export function musicFontStack(): string {
  const chosen = activeMusicFont().family
  const fallback = rowOf(DEFAULT_MUSIC_FONT).family
  return chosen === fallback ? `${fallback},${TEXT_FALLBACK}` : `${chosen},${fallback},${TEXT_FALLBACK}`
}
