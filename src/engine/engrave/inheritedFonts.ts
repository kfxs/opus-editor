/**
 * ⭐⭐ **THE FACES WE INHERITED — which font each kind of ink is set in, one table.**
 * S1c of `docs/history/vexflow-removal-map.md`, the sibling of `./inheritedDefaults` (S1b's numbers).
 *
 * The drawing library resolved a font per CATEGORY at run time: `new Element('Clef')` asked its
 * `Metrics` table for `Clef.fontFamily`, `Clef.fontSize`… walking up to the root row when the
 * category had none, and a few classes then resized what came back (`Clef.getPoint`, the cautionary
 * accidental). Every ink module was handed that answer as `this.fontInfo` — a value nobody in this
 * repo had written down. These rows are those answers, copied EXACTLY — no pixel moves — and
 * attributed, because the library is MIT and its notice travels with what we took.
 *
 * ⚠️ **A size here is POINTS** — the number the drawing context writes as `Npt`, 4/3 px each
 * (`rendering/painter/drawnFontSize`). ⛔ Do not convert on the way in.
 *
 * ## ⭐ Only the INHERITED faces live here
 *
 * A mark whose size this repo chose (the tempo mark's `tempoStyle`, the tuplet's `ScoreTuplet`, the
 * dynamics' `dynamicStyle`) keeps that knob beside its own ink tables, and builds its face from
 * {@link MUSIC_FONT_STACK} here. ⛔ Gathering all of them into one house-style object is agreed and
 * deferred (`docs/plans/own-engraving-engine.md` §0.2).
 *
 * ⚠️ While the drawing library still MEASURES its own objects (a clef's width, an accidental's, a
 * note's head), it does so from its own copy of these values — so a row that changes before S5–S6
 * would move our ink off its own geometry, the same caution `./inheritedDefaults` states.
 */
import { NOTE_GLYPH_SCALE } from './inheritedDefaults'
import { musicFontStack } from '@/engine/fonts/musicFont'

/** One resolved face, in the shape `DrawContext.setFont` takes. */
export interface FontRow {
  /** A CSS family STACK — the first family decides everything but the glyphs it lacks. */
  family: string
  /** POINTS. */
  size: number
  weight: string
  style: string
}

/**
 * The music font, with the text face behind it for per-character fallback — the root
 * `fontFamily` = `'Bravura,Academico'` (`metrics.js:62`). ⚠️ Music FIRST: a stack for TEXT wants
 * `utils/fontStack.textFirstFamily` of this, or Bravura sets its spaces.
 *
 * ⭐ A FUNCTION since the music face became a choice (`fonts/musicFont`,
 * docs/plans/music-font-switch-plan.md): the rows below are asked per draw, ⛔ never frozen at import.
 */
export { musicFontStack }

/** A text annotation's size until a face is set on it — `Annotation.fontSize` = 10 (`metrics.js:79`); its family, weight and style are the root's. */
export const ANNOTATION_FONT_SIZE_PT = 10

/** Every music glyph's size unless a category says otherwise — the root `fontSize` = 30 (`metrics.js:63`). */
export const MUSIC_FONT_SIZE_PT = 30

/** A face from the music stack at `sizePt`, upright and regular — the root `fontWeight`/`fontStyle` (`metrics.js:65–66`). */
export function musicFont(sizePt: number): FontRow {
  return { family: musicFontStack(), size: sizePt, weight: 'normal', style: 'normal' }
}

/**
 * A notehead's and its flag's face — the NOTE's, which both copy (`stavenote.js:351`,
 * `stemmablenote.js:42`): the root size times the note's glyph scale.
 */
export function noteFont(): FontRow {
  return musicFont(MUSIC_FONT_SIZE_PT * NOTE_GLYPH_SCALE)
}

/**
 * The face of every glyph whose category names no size of its own — an accidental, an augmentation
 * dot, an articulation, the meter's digits (`Accidental.fontSize` walks up to the root,
 * `accidental.js:295`; `Dot`, `Articulation` and `TimeSignature`'s two text rows never set one).
 */
export function musicGlyphFont(): FontRow {
  return musicFont(MUSIC_FONT_SIZE_PT)
}

/** A cautionary accidental's size — `Accidental.cautionary.fontSize` = 20 (`metrics.js:69`). */
export const CAUTIONARY_ACCIDENTAL_SIZE_PT = 20

/** SMuFL `accidentalParensLeft` — what a cautionary accidental's string opens with (`tables.js:137`). */
const ACCIDENTAL_PARENS_LEFT = '\uE26A'

/**
 * An accidental's face, from the string it stamps — `Accidental.reset()` (`accidental.js:291–305`):
 * a CAUTIONARY one is its sign between SMuFL parentheses, set at
 * {@link CAUTIONARY_ACCIDENTAL_SIZE_PT}; any other at the root size. ⭐ Read off the glyphs rather
 * than off the object, so the answer is the one the ink will show. ⚠️ A grace note's accidental is
 * 20 too (`accidental.js:304`); this editor has no grace notes, so that would be a second row.
 */
export function accidentalFont(glyph: string): FontRow {
  return glyph.startsWith(ACCIDENTAL_PARENS_LEFT) ? musicFont(CAUTIONARY_ACCIDENTAL_SIZE_PT) : musicGlyphFont()
}

/** How much smaller a `'small'` clef (a change of clef mid-line) is — the `* 2 / 3` in `Clef.getPoint` (`clef.js:102`). */
export const SMALL_CLEF_RATIO = 2 / 3

/**
 * A clef's face — `Math.floor(Clef.getPoint(size))` (`clef.js:98`): the root size for `'default'`,
 * {@link SMALL_CLEF_RATIO} of it for anything else. ⚠️ Floored, so a small clef is 20, not 20.0…
 */
export function clefFont(size: string): FontRow {
  return musicFont(Math.floor(size === 'default' ? MUSIC_FONT_SIZE_PT : MUSIC_FONT_SIZE_PT * SMALL_CLEF_RATIO))
}

/** A stave's measure number — `Stave.fontSize` = 8 (`metrics.js:131`), in the music stack. */
export const MEASURE_NUMBER_SIZE_PT = 8
