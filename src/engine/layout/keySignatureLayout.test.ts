/**
 * {@link keySignatureLayout} — the two tables: how much room a signature takes, and which row each
 * sign sits on.
 *
 * ⭐ **These CAN be unit tests, and that is the point of the font work.** `glyphBox` reads the baked
 * Bravura metrics, not the DOM, so the arithmetic is real in jsdom even though no glyph can be
 * measured there. ⛔ What still cannot be asserted here is where the ink actually LANDS — that is the
 * browser suite's, and jsdom would agree with any answer at all.
 *
 * ⚠️ The placement numbers are checked against the SOURCE's unit (steps above the bottom line) by
 * naming the pitch each line is: `F♯5` on the treble's top line is a fact anyone can verify without
 * trusting the conversion.
 */
import { describe, it, expect } from 'vitest'
import { KEY_ACCIDENTAL_GAP, keySignatureExtent, keySignatureLines } from './keySignatureLayout'
import { C_MAJOR, keyFromFifths } from '@/utils/keySignature'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import type { KeySignature } from '@/types/music'

const SHARP = glyphBox('accidentalSharp').advance   // 0.996
const FLAT = glyphBox('accidentalFlat').advance     // 0.904

describe('keySignatureExtent', () => {
  it('🚨 an EMPTY signature costs NOTHING — the row that keeps every C-major score honest', () => {
    expect(keySignatureExtent(C_MAJOR)).toBe(0)
    expect(keySignatureExtent({ alterations: [], mode: 'open' })).toBe(0)
  })

  it('one sign is its own advance and no gap', () => {
    expect(keySignatureExtent(keyFromFifths(1))).toBeCloseTo(SHARP, 5)
    expect(keySignatureExtent(keyFromFifths(-1))).toBeCloseTo(FLAT, 5)
  })

  it('n signs are n advances and n−1 gaps', () => {
    expect(keySignatureExtent(keyFromFifths(4))).toBeCloseTo(4 * SHARP + 3 * KEY_ACCIDENTAL_GAP, 5)
    expect(keySignatureExtent(keyFromFifths(-3))).toBeCloseTo(3 * FLAT + 2 * KEY_ACCIDENTAL_GAP, 5)
  })

  it('⭐⭐ reproduces Ross\'s sharp PITCH of 1.25 sp, which is the number confirmed twice', () => {
    // Origin to origin = the whole of two signs, less the second's own advance.
    const pitch = keySignatureExtent(keyFromFifths(2)) - SHARP
    expect(pitch).toBeCloseTo(1.25, 2)
  })

  it('⭐ …and a FLAT signature comes out narrower WITHOUT a second constant', () => {
    const flatPitch = keySignatureExtent(keyFromFifths(-2)) - FLAT
    expect(flatPitch).toBeCloseTo(1.15, 2)
    expect(flatPitch, 'the difference falls out of the glyph').toBeLessThan(1.25)
  })

  it('prices a CUSTOM signature by its own members', () => {
    const mixed: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    expect(keySignatureExtent(mixed)).toBeCloseTo(FLAT + SHARP + KEY_ACCIDENTAL_GAP, 5)
  })
})

describe('keySignatureLines — the measured table, checked by naming the pitch', () => {
  it('treble sharps: F♯5 on the TOP LINE, then C♯5 on the third space', () => {
    expect(keySignatureLines(keyFromFifths(2), 'treble')).toEqual([5, 3.5])
  })

  it('treble flats: B♭ on the MIDDLE LINE — and F♯ vs F♭ are an octave apart', () => {
    expect(keySignatureLines(keyFromFifths(-1), 'treble')).toEqual([3])
    // F♯5 (top line) against F♭4 (the bottom space): the reason the table is keyed by DIRECTION.
    expect(keySignatureLines({ alterations: [{ step: 'F', alter: 1 }] }, 'treble')).toEqual([5])
    expect(keySignatureLines({ alterations: [{ step: 'F', alter: -1 }] }, 'treble')).toEqual([1.5])
  })

  it('bass is treble − 2 steps: F♯3 on the fourth line, B♭2 on the second', () => {
    expect(keySignatureLines(keyFromFifths(1), 'bass')).toEqual([4])
    expect(keySignatureLines(keyFromFifths(-1), 'bass')).toEqual([2])
  })

  it('⛔ alto has NO exception — A♯ sits at A3, the plainly shifted position', () => {
    // A is the fifth sharp; asking for it alone is the same row.
    expect(keySignatureLines({ alterations: [{ step: 'A', alter: 1 }] }, 'alto')).toEqual([2])
    expect(keySignatureLines(keyFromFifths(5), 'alto')).toEqual([4.5, 3, 5, 3.5, 2])
  })

  it('🚨 TENOR SHARPS are the sole exception: F♯ and G♯ drop an octave, the other five do not', () => {
    // F♯3 (fourth line) and G♯3 (the space above it) instead of F♯4 / G♯4, which would need a ledger.
    expect(keySignatureLines(keyFromFifths(3), 'tenor')).toEqual([2, 4, 2.5])
    // …while C♯4 and D♯4 sit where treble + 1 puts them.
    expect(keySignatureLines(keyFromFifths(4), 'tenor')[3]).toBe(4.5)
  })

  it('…and TENOR FLATS follow the ordinary shape (treble + 1)', () => {
    expect(keySignatureLines(keyFromFifths(-2), 'tenor')).toEqual([3.5, 5])
  })

  it('every sign of a full seven stays clear of a ledger line, in all four clefs', () => {
    // The constraint the 56 drawn signs actually obey — never stated in prose by any treatise.
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as const) {
      for (const n of [7, -7]) {
        for (const line of keySignatureLines(keyFromFifths(n), clef)) {
          expect(line, `${clef} ${n}`).toBeGreaterThan(0)
          expect(line, `${clef} ${n}`).toBeLessThan(6)
        }
      }
    }
  })

  it('⭐ a CUSTOM signature takes each letter from its own direction\'s row', () => {
    const mixed: KeySignature = { alterations: [{ step: 'B', alter: -1 }, { step: 'F', alter: 1 }] }
    // B♭4 on the middle line, F♯5 on the top line — each where a traditional signature puts it.
    expect(keySignatureLines(mixed, 'treble')).toEqual([3, 5])
  })

  it('an OCTAVE override moves the glyph, and the clef converts it', () => {
    // Gould's own figure draws C♯ at C5 — the third space in treble.
    expect(keySignatureLines({ alterations: [{ step: 'C', alter: 1, octave: 5 }] }, 'treble')).toEqual([3.5])
    // …and the same override under a bass clef lands somewhere else entirely, as it must.
    expect(keySignatureLines({ alterations: [{ step: 'C', alter: 1, octave: 5 }] }, 'bass')).toEqual([9.5])
  })

  it('keeps the AUTHORED order — the lines come back in the list\'s order, not the cycle\'s', () => {
    const reordered: KeySignature = { alterations: [{ step: 'C', alter: 1 }, { step: 'F', alter: 1 }] }
    expect(keySignatureLines(reordered, 'treble')).toEqual([3.5, 5])
  })
})
