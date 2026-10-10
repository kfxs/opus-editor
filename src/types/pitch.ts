/**
 * PITCH as SPELLING — step + alteration + octave, never a MIDI integer (a key number is a TUNING's,
 * `engine/audio/equalTemperament`).
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */


/**
 * Diatonic step name (letter name of the note, independent of accidental)
 */
export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * ⭐ A SIGN a pitch may carry — the SMuFL glyph name without its `accidental` / `acc` prefix. One row
 * each in `utils/alterationSigns` (its glyph, its rank); a new sign is a row there and a name here.
 */
export type AlterationSignId =
  | 'doubleFlat' | 'flat' | 'sharp' | 'doubleSharp'
  // ⭐ The four quarter-tones (alteration-signs K4) — Gould p. 96's "fixed symbols", Sibelius's `5 6 2 3`.
  | 'threeQuarterTonesFlatZimmermann' | 'quarterToneFlatStein' | 'quarterToneSharpStein' | 'threeQuarterTonesSharpStein'

/**
 * ⭐⭐ **WHAT ALTERS A LETTER — an ordered LIST of signs, left to right as drawn** (decision A,
 * docs/plans/alteration-signs-plan.md §1). ⛔ Never empty and ⛔ never a lone natural: an
 * unaltered pitch has NO `alteration` field. It is the SYMBOL; what it sounds like is a tuning's.
 */
export type Alteration = readonly AlterationSignId[]

/**
 * ⭐ **A sign as the DRAWING speaks it** — any stored sign, or the NATURAL, which a pitch never stores
 * (the bar's rule draws it to cancel) but the page draws all the same. ⛔ Never a field of a pitch: the
 * type keeps the natural out of {@link Alteration} at compile time (alteration-signs-plan M3).
 */
export type DrawnSignId = AlterationSignId | 'natural'

/**
 * ⭐ **The accidental the EDITOR arms, toggles and lights** — a {@link DrawnSignId}: any sign of the
 * table, or the natural (alteration-signs-plan K1 widened it from the three Keypad keys `'#' 'b' 'n'`).
 * A Keypad key is a SLOT holding one (`windows/keypad/keypadSignSlots`); ⛔ no logic names a sign.
 */
export type Accidental = DrawnSignId

/**
 * Pitch spelling: step + alteration + scientific octave — what is WRITTEN.
 *   C#4 = { step: 'C', alteration: ['sharp'], octave: 4 }
 *   Db4 = { step: 'D', alteration: ['flat'],  octave: 4 }
 *   C4  = { step: 'C', octave: 4 }                          — absent = unaltered
 *
 * Which of two is higher, or the same: `utils/pitchOrder`. A key number is playback's alone.
 */
export interface PitchSpelling {
  step: PitchStep
  /** The signs that alter the letter — absent when unaltered ({@link Alteration}). */
  alteration?: Alteration
  /** Scientific octave number — C4 is middle C (MIDI 60) */
  octave: number
}
