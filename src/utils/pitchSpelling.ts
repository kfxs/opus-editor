/**
 * Pitch spelling utilities — enharmonic-aware pitch representation.
 *
 * Industry standard (MusicXML, MuseScore, music21) stores pitch as
 * step + alteration + octave, not as a raw MIDI integer. This lets the system
 * distinguish C# from Db, D# from Eb, etc.
 *
 * These helpers are pure functions with no side effects, and they are the
 * foundation the pitch model actually stands on: a `Note` carries step/alteration/
 * octave. ⛔ No MIDI here: which pitch is higher, or the same, is `utils/pitchOrder`'s
 * (as WRITTEN); a key number is a TUNING's, `engine/audio/equalTemperament` (M1).
 *
 * All functions in this file operate on PitchSpelling objects; none of
 * them depend on any other editor module — safe to import anywhere.
 */

import type { Alteration, PitchSpelling, PitchStep, Accidental } from '@/types/music'
import { alterationCode, alterationField, armedAlteration } from './alterationSigns'

export type { PitchSpelling, PitchStep }

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
 * lowercase step, accidental suffix, slash, then octave (VexFlow's format, kept until M3).
 *
 * @example
 * spellingToNoteKey('C', ['sharp'], 4)      // 'c#/4'
 * spellingToNoteKey('D', ['flat'], 4)       // 'db/4'
 * spellingToNoteKey('G', ['doubleSharp'], 3) // 'g##/3'
 * spellingToNoteKey('E', undefined, 4)      // 'e/4'
 */
export function spellingToNoteKey(step: PitchStep, alteration: Alteration | undefined, octave: number): string {
  return `${step.toLowerCase()}${alterationCode(alteration)}/${octave}`
}

/**
 * A compact pitch label like `C#4` / `Ab3` / `E4` — step + accidental + octave.
 * The shared formatter behind the debug logs and the undo labels (no alteration reads as natural).
 * Rests carry no pitch (`step`/`octave` undefined), so guard those at the call site
 * with a 'rest' label; the fields are typed optional only to accept `Note`/`NoteParams`
 * directly, and an undefined step/octave stringifies exactly as the old inline logs did.
 */
export function formatPitch({ step, alteration, octave }: { step?: PitchStep; alteration?: Alteration; octave?: number }): string {
  return `${step}${alterationCode(alteration)}${octave}`
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
 * A letter and octave spelled with the ARMED Keypad key — what a click enters, or previews, when ♯ or
 * ♭ is armed. ♮ or nothing leaves it unaltered (the natural is DRAWN by the bar's rule, never stored).
 */
export function withArmedAlteration<T extends { step: PitchStep; octave: number }>(
  spelling: T, armed: Accidental | null | undefined,
): T & { alteration?: Alteration } {
  return { ...spelling, ...alterationField(armedAlteration(armed)) }
}

/**
 * Map a rendered accidental glyph code (as stored on a registered `accidental` element: '#', 'b',
 * 'n', '##', 'bb') to the keypad's single-accidental key, or null when there is no matching key —
 * the double accidentals have no ♯♯/♭♭ key on the numpad palette.
 */
export function accidentalTypeToKey(type: string | null | undefined): Accidental | null {
  return type === '#' || type === 'b' || type === 'n' ? type : null
}
