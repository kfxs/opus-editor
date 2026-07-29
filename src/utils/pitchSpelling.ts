/**
 * Pitch spelling utilities — enharmonic-aware pitch representation.
 *
 * Industry standard (MusicXML, MuseScore, music21) stores pitch as
 * step + alter + octave, not as a raw MIDI integer. This lets the system
 * distinguish C# from Db, D# from Eb, etc.
 *
 * These helpers are pure functions with no side effects, and they are the
 * foundation the pitch model actually stands on: a `Note` carries step/alter/
 * octave and derives MIDI through here, never the other way round.
 *
 * All functions in this file operate on PitchSpelling objects; none of
 * them depend on any other editor module — safe to import anywhere.
 */

import type { PitchSpelling, PitchStep, PitchAlter, Accidental } from '@/types/music'

export type { PitchSpelling, PitchStep, PitchAlter }

// ---------------------------------------------------------------------------
// Internal lookup tables
// ---------------------------------------------------------------------------

/** Semitone offset from C within an octave, for each diatonic step */
const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Diatonic index within octave (C=0 … B=6) */
const STEP_INDEX: Record<PitchStep, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}

// ---------------------------------------------------------------------------
// Conversion: PitchSpelling → other representations
// ---------------------------------------------------------------------------

/**
 * Convert a pitch spelling to a MIDI note number.
 * Middle C (C4) = 60.
 *
 * Formula: (octave + 1) * 12 + stepSemitone + alter
 *
 * @example
 * spellingToMidi('C',  0, 4) // 60  — middle C
 * spellingToMidi('A',  0, 4) // 69  — concert A
 * spellingToMidi('C',  1, 4) // 61  — C#4
 * spellingToMidi('D', -1, 4) // 61  — Db4  (same MIDI, different spelling)
 * spellingToMidi('B',  0, 3) // 59  — B3
 */
export function spellingToMidi(step: PitchStep, alter: PitchAlter, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alter
}

/**
 * Convert a pitch spelling to a VexFlow key string (e.g. 'c#/4', 'db/4').
 * VexFlow expects lowercase step, accidental suffix, slash, then octave.
 *
 * @example
 * spellingToVexflowKey('C',  1, 4) // 'c#/4'
 * spellingToVexflowKey('D', -1, 4) // 'db/4'
 * spellingToVexflowKey('G',  2, 3) // 'g##/3'
 * spellingToVexflowKey('A', -2, 5) // 'abb/5'
 * spellingToVexflowKey('E',  0, 4) // 'e/4'
 */
export function spellingToVexflowKey(step: PitchStep, alter: PitchAlter, octave: number): string {
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

// ---------------------------------------------------------------------------
// Conversion: MIDI → PitchSpelling
//
// ⚠️ Live, and on the hot path: this is how a pixel on the staff becomes a pitch
// (note entry, drag, the ghost). It is NOT a migration helper, whatever the header
// used to say — a MIDI number is what the geometry produces, not what a score stores.
// ---------------------------------------------------------------------------

type SpellingEntry = { step: PitchStep; alter: PitchAlter }

const WHITE_KEYS: Partial<Record<number, SpellingEntry>> = {
  0:  { step: 'C', alter: 0 },
  2:  { step: 'D', alter: 0 },
  4:  { step: 'E', alter: 0 },
  5:  { step: 'F', alter: 0 },
  7:  { step: 'G', alter: 0 },
  9:  { step: 'A', alter: 0 },
  11: { step: 'B', alter: 0 },
}

const BLACK_SHARP: Record<number, SpellingEntry> = {
  1:  { step: 'C', alter: 1 },
  3:  { step: 'D', alter: 1 },
  6:  { step: 'F', alter: 1 },
  8:  { step: 'G', alter: 1 },
  10: { step: 'A', alter: 1 },
}

const BLACK_FLAT: Record<number, SpellingEntry> = {
  1:  { step: 'D', alter: -1 },
  3:  { step: 'E', alter: -1 },
  6:  { step: 'G', alter: -1 },
  8:  { step: 'A', alter: -1 },
  10: { step: 'B', alter: -1 },
}

/**
 * Convert a MIDI note number to a PitchSpelling.
 *
 * The optional `hint` (the armed {@link Accidental}, if any) resolves the
 * enharmonic ambiguity for black keys:
 *   - '#' or undefined → sharp spelling (C#, D#, F#, G#, A#)
 *   - 'b' → flat spelling (Db, Eb, Gb, Ab, Bb)
 *   - 'n' → treat as no hint (the note is a white key with a courtesy natural)
 *
 * White keys are always unambiguous regardless of hint.
 *
 * Used to derive a spelling from a raw MIDI value — e.g. mapping a pixel
 * position on the staff to a pitch during note entry/drag.
 *
 * @example
 * midiToSpelling(60)           // { step:'C', alter:0, octave:4 }  — middle C
 * midiToSpelling(61)           // { step:'C', alter:1, octave:4 }  — C#4 (default)
 * midiToSpelling(61, 'b')      // { step:'D', alter:-1, octave:4 } — Db4
 * midiToSpelling(69)           // { step:'A', alter:0, octave:4 }  — A4
 * midiToSpelling(59)           // { step:'B', alter:0, octave:3 }  — B3
 */
export function midiToSpelling(midi: number, hint?: '#' | 'b' | 'n'): PitchSpelling {
  const pc = ((midi % 12) + 12) % 12  // pitch class 0–11, safe for negative input
  const octave = Math.floor(midi / 12) - 1

  const white = WHITE_KEYS[pc]
  if (white) return { ...white, octave }

  const useFlat = hint === 'b'
  const entry = useFlat ? BLACK_FLAT[pc] : BLACK_SHARP[pc]
  return { ...entry, octave }
}

// ---------------------------------------------------------------------------
// Utility: compare two spellings
// ---------------------------------------------------------------------------

/**
 * True if two spellings represent the same pitch spelling
 * (same step, same alter, same octave — NOT enharmonic equivalence).
 */
export function spellingEquals(a: PitchSpelling, b: PitchSpelling): boolean {
  return a.step === b.step && a.alter === b.alter && a.octave === b.octave
}

/**
 * True if two spellings sound at the same pitch (enharmonic equivalence).
 * C#4 and Db4 return true; C#4 and C#5 return false.
 */
export function spellingEnharmonic(a: PitchSpelling, b: PitchSpelling): boolean {
  return spellingToMidi(a.step, a.alter, a.octave) === spellingToMidi(b.step, b.alter, b.octave)
}
