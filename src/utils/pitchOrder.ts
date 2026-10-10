/**
 * ⭐ **WHICH PITCH IS HIGHER — as WRITTEN** (docs/plans/alteration-signs-plan.md §2, M0).
 *
 * The order is the STAFF's: the line or space first ({@link staffPosition}), then, for two pitches on
 * the same line, the RANK of their signs (`alterationSigns`). It never asks what a pitch SOUNDS like,
 * so it holds for any sign the table gains — a quarter-tone has no piano number, and the score holds
 * no tuning. ⚠️ It therefore differs from sound where spelling crosses: E♯ is written BELOW F♭ (a line
 * lower) though it sounds higher. Every reader here wants the staff's answer — a chord's heads are
 * stacked by line, a typed letter is placed by line.
 *
 * ⛔ What a pitch sounds like is `engine/audio/`'s question, and only there.
 */

import type { PitchStep } from '@/types/music'
import { alterationRank, signsOfAlter } from './alterationSigns'
import { spellingDiatonicPos } from './pitchSpelling'

/** A written pitch, as the score stores it today (M2 swaps `alter` for the list of signs). */
export interface WrittenPitch {
  readonly step: PitchStep
  readonly alter?: number
  readonly octave: number
}

/** Where a pitch stands on the staff, in steps from C0 — the line or space; signs play no part. */
export function staffPosition(pitch: WrittenPitch): number {
  return spellingDiatonicPos(pitch.step, pitch.octave)
}

/** Middle C's staff position — where a typed letter is placed nearest when nothing else says. */
export const MIDDLE_C_POSITION = 28

/** < 0 when `a` is written lower than `b`, > 0 higher, 0 the same line and the same signs. */
export function comparePitch(a: WrittenPitch, b: WrittenPitch): number {
  return staffPosition(a) - staffPosition(b)
    || alterationRank(signsOfAlter(a.alter)) - alterationRank(signsOfAlter(b.alter))
}

/**
 * ⭐ **Are these the SAME pitch?** — the same letter, the same signs, the same octave. C♯ and D♭ are
 * TWO pitches: they stand on different lines, and only a tuning (`engine/audio/`) could say they
 * sound alike — in meantone they don't (M1; docs/plans/alteration-signs-plan.md).
 */
export function samePitch(a: WrittenPitch, b: WrittenPitch): boolean {
  if (a.step !== b.step || a.octave !== b.octave) return false
  const [x, y] = [signsOfAlter(a.alter), signsOfAlter(b.alter)]
  return x.length === y.length && x.every((sign, i) => sign === y[i])
}

/** A copy, lowest written pitch first. */
export function lowToHigh<T extends WrittenPitch>(pitches: readonly T[]): T[] {
  return [...pitches].sort(comparePitch)
}

/** +1 when `b` is written higher than `a`, −1 lower, 0 the same. */
export function pitchDirection(a: WrittenPitch, b: WrittenPitch): -1 | 0 | 1 {
  return Math.sign(comparePitch(b, a)) as -1 | 0 | 1
}

const STEP_INDEX: Record<PitchStep, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/**
 * ⭐ The octave a typed LETTER lands in: the one whose line is NEAREST `reference` (a staff
 * position), counted in staff steps. An octave is 7 steps — odd — so there is never a tie: the
 * letter always lands within a fourth. MuseScore's rule (`noteinput.cpp`, accidentals stripped);
 * Sibelius's manuals do not say.
 */
export function octaveNearest(step: PitchStep, reference: number): number {
  return Math.round((reference - STEP_INDEX[step]) / 7)
}

/**
 * ⭐ The octave a letter ADDED TO A CHORD lands in: the lowest whose line is strictly ABOVE
 * `ceiling` (the chord's top staff position) — never on the top note's own line.
 */
export function octaveAbove(step: PitchStep, ceiling: number): number {
  return Math.floor((ceiling - STEP_INDEX[step]) / 7) + 1
}
