/**
 * {@link trillPitch} — the auxiliary, and the two different questions it answers.
 *
 * ⭐ The pair that matters: **what SOUNDS** follows the bar's running accidental, while **what is
 * PRINTED** is only what the key does not already say. Those come apart exactly once — an
 * accidental earlier in the bar — and that case is the reason the trill needs a sign at all.
 */
import { describe, it, expect } from 'vitest'
import { trillAuxiliary } from './trillPitch'
import { C_MAJOR, type KeySignature } from './keySignature'
import { spellingDiatonicPos } from './pitchSpelling'
import type { PitchAlter, PitchStep } from '@/types/music'

const NONE = new Map<number, PitchAlter>()
/** A bar in which `step`/`octave` has already been altered to `alter`. */
const bar = (step: PitchStep, octave: number, alter: PitchAlter) =>
  new Map<number, PitchAlter>([[spellingDiatonicPos(step, octave), alter]])

describe('trillAuxiliary — which note', () => {
  it('is the next LETTER up', () => {
    expect(trillAuxiliary({ step: 'C', octave: 4 }, C_MAJOR, NONE)).toMatchObject({ step: 'D', octave: 4 })
    expect(trillAuxiliary({ step: 'E', octave: 4 }, C_MAJOR, NONE)).toMatchObject({ step: 'F', octave: 4 })
  })

  it('crosses the octave at B → C, not at A', () => {
    expect(trillAuxiliary({ step: 'A', octave: 4 }, C_MAJOR, NONE)).toMatchObject({ step: 'B', octave: 4 })
    expect(trillAuxiliary({ step: 'B', octave: 4 }, C_MAJOR, NONE)).toMatchObject({ step: 'C', octave: 5 })
  })

  it("⭐ ignores the MAIN note's own alteration — the interval is a consequence, not an input", () => {
    // E♭ and E♮ both trill to F♮ in C major: a whole tone and a semitone, both correct.
    const flat = trillAuxiliary({ step: 'E', octave: 4 }, C_MAJOR, bar('E', 4, -1))
    expect(flat).toMatchObject({ step: 'F', alter: 0, accidental: null })
  })
})

describe('trillAuxiliary — what sounds', () => {
  it('takes the KEY signature where the bar says nothing', () => {
    const dMajor: KeySignature = { fifths: 2 } // F♯ C♯
    // A trill on E in D major alternates with F♯ — and prints nothing, since the key says so.
    expect(trillAuxiliary({ step: 'E', octave: 4 }, dMajor, NONE))
      .toEqual({ step: 'F', alter: 1, octave: 4, accidental: null })
  })

  it('takes the BAR\'s running accidental over the key', () => {
    const dMajor: KeySignature = { fifths: 2 }
    // An F♮ earlier in the bar cancels the key's F♯ at that position.
    const aux = trillAuxiliary({ step: 'E', octave: 4 }, dMajor, bar('F', 4, 0))
    expect(aux.alter).toBe(0)
    expect(aux.accidental).toBe('n') // …and says so, because it departs from the key
  })

  it('is position-specific — an F♯ in another octave does not reach this trill', () => {
    const aux = trillAuxiliary({ step: 'E', octave: 4 }, C_MAJOR, bar('F', 5, 1))
    expect(aux).toEqual({ step: 'F', alter: 0, octave: 4, accidental: null })
  })
})

describe('trillAuxiliary — what is printed', () => {
  it('⭐⭐ THE CASE: in C major, an F♯ earlier in the bar makes a trill on E print a ♯', () => {
    expect(trillAuxiliary({ step: 'E', octave: 4 }, C_MAJOR, bar('F', 4, 1)))
      .toEqual({ step: 'F', alter: 1, octave: 4, accidental: '#' })
  })

  it('prints a FLAT the same way', () => {
    expect(trillAuxiliary({ step: 'C', octave: 4 }, C_MAJOR, bar('D', 4, -1)))
      .toEqual({ step: 'D', alter: -1, octave: 4, accidental: 'b' })
  })

  it('prints NOTHING when the bar merely repeats what the key already said', () => {
    const gMajor: KeySignature = { fifths: 1 } // F♯
    expect(trillAuxiliary({ step: 'E', octave: 4 }, gMajor, bar('F', 4, 1)).accidental).toBeNull()
  })
})
