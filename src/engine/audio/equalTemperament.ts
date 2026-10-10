/**
 * ⭐⭐ **THE FIRST TUNING — equal temperament, the piano's** (docs/plans/alteration-signs-plan.md §2).
 *
 * The ONLY place a written pitch becomes a key number. A score stores what is WRITTEN (letter, signs,
 * octave); what that SOUNDS like is a tuning's question, and this is the first one. Since M1 nothing
 * outside `engine/audio/` asks it: which pitch is higher, and whether two are the same, are the
 * staff's questions (`utils/pitchOrder`) — ⛔ never answer them here, where C♯ and D♭ are one key.
 * The core may not import this module (lint:boundary — "audio").
 *
 * ⚠️ A sign a tuning gives no value has no key number; the day a quarter-tone is stored, this table
 * gains its row or the sign plays as its nearest key (plan §2, "Sound").
 */

import type { Alteration, AlterationSignId, PitchSpelling, PitchStep } from '@/types/music'

/** Semitone offset from C within an octave, for each diatonic step */
const STEP_SEMITONES: Record<PitchStep, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/**
 * ⭐ **WHAT EACH SIGN SOUNDS LIKE, in this tuning** — semitones from the plain letter. A row per sign of
 * `utils/alterationSigns`' table; the ONLY place a sign has a sound (decision D: the doubles must
 * play right — they are ±2 here). ⛔ A sign with no row here is a COMPILE error, not a silent 0.
 */
const SIGN_SEMITONES: Record<AlterationSignId, number> = {
  doubleFlat: -2,
  flat: -1,
  sharp: 1,
  doubleSharp: 2,
  // ⭐ K4 — a quarter-tone plays as a NORMAL key until K6 detunes it: Sibelius without its plug-in (Robert Puff,
  //    docs/research/sibelius-keypad.md: *"A natural and a quarter-sharp sound the same pitch"* — likewise sharp /
  //    three-quarter sharp, flat / quarter flat). ⚠️ Rounded TOWARD the letter: ±½ → 0, ±1½ → ±1.
  quarterToneSharpStein: 0,
  quarterToneFlatStein: 0,
  threeQuarterTonesSharpStein: 1,
  threeQuarterTonesFlatZimmermann: -1,
}

/** How many semitones an alteration moves its letter, in equal temperament. */
export function alterationSemitones(alteration: Alteration | undefined): number {
  let semitones = 0
  for (const id of alteration ?? []) semitones += SIGN_SEMITONES[id]
  return semitones
}

/**
 * Convert a pitch spelling to a MIDI note number.
 * Middle C (C4) = 60.
 *
 * Formula: (octave + 1) * 12 + stepSemitone + the alteration's semitones ({@link SIGN_SEMITONES})
 *
 * @example
 * spellingToMidi('C', undefined, 4)  // 60  — middle C
 * spellingToMidi('A', undefined, 4)  // 69  — concert A
 * spellingToMidi('C', ['sharp'], 4)  // 61  — C#4
 * spellingToMidi('D', ['flat'], 4)   // 61  — Db4  (same key, different spelling)
 * spellingToMidi('B', undefined, 3)  // 59  — B3
 */
export function spellingToMidi(step: PitchStep, alteration: Alteration | undefined, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alterationSemitones(alteration)
}

/**
 * ⭐⭐ **THE 12-EDO STEP, TAKEN ON A WHOLE PITCH — and the only place the sound path is allowed to
 * take it.** {@link spellingToMidi} with the three fields read off one object.
 *
 * It exists so that *"where does music become MIDI?"* has a one-line answer a reader can grep for.
 * `engine/audio/playbackSchedule.ts` used to call `spellingToMidi` at four sites and emit integers;
 * since 2026-08-20 the schedule carries `PitchSpelling` and **`WebAudioFontInstrument.noteOn` is the
 * single caller of this on the playback path** (docs/plans/playback-semantics-plan.md — score → schedule →
 * interpret). ⛔ Do not call it from a schedule, a model or a renderer.
 *
 * ⚠️⚠️ **It collapses enharmonics, which is exactly why it must stay last.** G♯4 and A♭4 both return
 * 61, and that distinction is the ONLY thing a tuning system would have to work from: in **meantone**
 * G♯ sounds *lower* than A♭, in **Pythagorean** *higher*. Mint the integer early and no later layer
 * can recover which of the two was written (docs/how-it-works/tuning-systems-and-alteration.md).
 */
export function pitchToMidi(pitch: PitchSpelling): number {
  return spellingToMidi(pitch.step, pitch.alteration, pitch.octave)
}

// ---------------------------------------------------------------------------
// The way back: a piano key → a spelling
//
// ⚠️ Nothing on the editor's path asks this any more (a pixel becomes a pitch through
// staff positions, `ElementRegistry.pixelYToPitch` / `CoordinateMapper`): it is the audio
// specs' way to write a fixture as a key number.
// ---------------------------------------------------------------------------

const PITCH_CLASS_STEP: readonly PitchStep[] = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B']
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]

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
 * midiToSpelling(60)           // { step:'C', octave:4 }                       — middle C
 * midiToSpelling(61)           // { step:'C', alteration:['sharp'], octave:4 } — C#4 (default)
 * midiToSpelling(61, 'b')      // { step:'D', alteration:['flat'], octave:4 }  — Db4
 * midiToSpelling(69)           // { step:'A', octave:4 }                       — A4
 */
export function midiToSpelling(midi: number, hint?: '#' | 'b' | 'n'): PitchSpelling {
  const pc = ((midi % 12) + 12) % 12  // pitch class 0–11, safe for negative input
  const octave = Math.floor(midi / 12) - 1

  if (!IS_BLACK[pc]) return { step: PITCH_CLASS_STEP[pc], octave }
  // A black key is the white key below, sharpened — or, with a ♭ hint, the white key above, flattened.
  return hint === 'b'
    ? { step: PITCH_CLASS_STEP[pc + 1], alteration: ['flat'], octave }
    : { step: PITCH_CLASS_STEP[pc], alteration: ['sharp'], octave }
}
