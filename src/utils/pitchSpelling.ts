/**
 * Pitch spelling utilities — enharmonic-aware pitch representation.
 *
 * Industry standard (MusicXML, MuseScore, music21) stores pitch as
 * step + alter + octave, not as a raw MIDI integer. This lets the system
 * distinguish C# from Db, D# from Eb, etc.
 *
 * These helpers are pure functions with no side effects, and they are the
 * foundation the pitch model actually stands on: a `Note` carries step/alter/
 * octave. ⛔ No MIDI here: which pitch is higher, or the same, is `utils/pitchOrder`'s
 * (as WRITTEN); a key number is a TUNING's, `engine/audio/equalTemperament` (M1).
 *
 * All functions in this file operate on PitchSpelling objects; none of
 * them depend on any other editor module — safe to import anywhere.
 */

import type { PitchSpelling, PitchStep, PitchAlter, Accidental } from '@/types/music'

export type { PitchSpelling, PitchStep, PitchAlter }

// ---------------------------------------------------------------------------
// Internal lookup tables
// ---------------------------------------------------------------------------

/** Diatonic index within octave (C=0 … B=6) */
const STEP_INDEX: Record<PitchStep, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}

// ---------------------------------------------------------------------------
// Conversion: PitchSpelling → other representations
// ---------------------------------------------------------------------------

/**
 * Convert a pitch spelling to a note key string (e.g. 'c#/4', 'db/4') — what `EngravedNote` reads:
 * lowercase step, accidental suffix, slash, then octave (VexFlow's format, kept).
 *
 * @example
 * spellingToNoteKey('C',  1, 4) // 'c#/4'
 * spellingToNoteKey('D', -1, 4) // 'db/4'
 * spellingToNoteKey('G',  2, 3) // 'g##/3'
 * spellingToNoteKey('A', -2, 5) // 'abb/5'
 * spellingToNoteKey('E',  0, 4) // 'e/4'
 */
export function spellingToNoteKey(step: PitchStep, alter: PitchAlter, octave: number): string {
  return `${step.toLowerCase()}${alterToString(alter)}/${octave}`
}

/**
 * The accidental glyph string for an alter value: `''`, `'#'`, `'##'`, `'b'`, `'bb'`.
 * The one spelling of `alter` used across the debug logs and simple pitch labels —
 * a note has at most a double sharp/flat, so anything outside ±2 reads as natural.
 */
export function alterToString(alter: number): string {
  return alter === 2 ? '##' : alter === 1 ? '#' : alter === -1 ? 'b' : alter === -2 ? 'bb' : ''
}

/**
 * A compact pitch label like `C#4` / `Ab3` / `E4` — step + accidental + octave.
 * The shared formatter behind the debug logs (an absent `alter` reads as natural).
 * Rests carry no pitch (`step`/`octave` undefined), so guard those at the call site
 * with a 'rest' label; the fields are typed optional only to accept `Note`/`NoteParams`
 * directly, and an undefined step/octave stringifies exactly as the old inline logs did.
 */
export function formatPitch({ step, alter, octave }: { step?: PitchStep; alter?: number; octave?: number }): string {
  return `${step}${alterToString(alter ?? 0)}${octave}`
}

/**
 * Diatonic position of a spelling, counting diatonic steps from C0.
 * Adjacent notes on a staff differ by exactly 1, regardless of accidentals.
 *
 * This is the correct basis for staff-line/space calculations; using
 * chromatic (MIDI) arithmetic for staff positions gives wrong results
 * when accidentals are involved.
 *
 * Reference values (treble clef):
 *   E4=30 (bottom line), G4=32 (second line), B4=34 (middle line/3rd line)
 *   D5=36 (fourth line), F5=38 (top line)
 *
 * @example
 * spellingDiatonicPos('C', 4) // 28
 * spellingDiatonicPos('D', 4) // 29
 * spellingDiatonicPos('B', 4) // 34  (middle line, treble clef)
 * spellingDiatonicPos('C', 5) // 35  (one step above B4)
 */
export function spellingDiatonicPos(step: PitchStep, octave: number): number {
  return octave * 7 + STEP_INDEX[step]
}

/**
 * Derive the {@link Accidental} display character from a PitchAlter — the editor's
 * sign vocabulary ('#'/'b'), which is what the keypad arms and the palette shows.
 * Returns undefined for naturals (alter === 0) when no accidental sign is needed.
 * Double-sharps/flats fall back to single (VexFlow limitation in current use).
 */
export function alterToAccidental(alter: PitchAlter): Accidental | undefined {
  if (alter > 0) return '#'
  if (alter < 0) return 'b'
  return undefined
}

/**
 * Convert an {@link Accidental} sign to a PitchAlter integer — the direction the
 * editor actually travels most: the armed keypad accidental becoming stored spelling
 * (KeyboardController, MouseController, MusicEngine all enter notes through it).
 * '#' → 1, 'b' → -1, 'n' or null/undefined → 0
 */
export function accidentalToAlter(acc: Accidental | null | undefined): PitchAlter {
  if (acc === '#') return 1
  if (acc === 'b') return -1
  return 0
}

/**
 * Map a rendered accidental glyph code (as stored on a registered `accidental` element: '#', 'b',
 * 'n', '##', 'bb') to the keypad's single-accidental key, or null when there is no matching key —
 * the double accidentals have no ♯♯/♭♭ key on the numpad palette.
 */
export function accidentalTypeToKey(type: string | null | undefined): Accidental | null {
  return type === '#' || type === 'b' || type === 'n' ? type : null
}
