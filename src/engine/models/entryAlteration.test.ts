import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { entryAlteration } from './entryAlteration'
import { keyFromFifths } from '@/utils/keySignature'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * ⭐⭐ The alteration a newly placed pitch is born with (docs/plans/key-signature-plan.md §3.1).
 *
 * The rule it pins is *armed accidental → the bar's running accidental → the key → 0*, and the case
 * that made it necessary is the third rung: without it, every note typed in G major comes out an F♮
 * wearing a natural nobody asked for.
 */
describe('entryAlteration', () => {
  const G_MAJOR = keyFromFifths(1) // one sharp: F♯

  /** A one-bar model, optionally in a key. */
  const model = (fifths?: number): ScoreModel => {
    const m = new ScoreModel()
    if (fifths !== undefined) m.setKeyAt(1, keyFromFifths(fifths))
    return m
  }

  it('🚨 THE BUG: a typed F in G major is an F♯, not an F♮', () => {
    const m = model(1)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'F', 4)).toBe(1)
  })

  it('…and a letter the key is silent about is still natural', () => {
    const m = model(1)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'G', 4)).toBe(0)
  })

  it('in C major nothing changes — this is the answer it always gave', () => {
    const m = model()
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'F', 4)).toBe(0)
  })

  it('⭐ the ARMED accidental overrides the key outright', () => {
    const m = model(1)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'F', 4, 'n')).toBe(0)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'F', 4, 'b')).toBe(-1)
  })

  it('⭐ the BAR beats the key: an F♮ written earlier holds for the rest of it', () => {
    const m = model(1)
    m.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(2, 1) }, 'F', 4)).toBe(0)
  })

  it('…and the bar is OCTAVE-specific while the key is not', () => {
    const m = model(1)
    m.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(2, 1) }, 'F', 5)).toBe(1)
  })

  it('the key is INHERITED — a signature at bar 1 still answers at a later bar', () => {
    const m = model(1)
    m.addMeasure()
    m.addMeasure()
    expect(entryAlteration(m.getScore(), { measure: 3, beat: frac(0, 1) }, 'F', 4)).toBe(1)
  })

  it('a measure that does not exist answers 0 rather than throwing', () => {
    const m = model(1)
    expect(entryAlteration(m.getScore(), { measure: 999, beat: frac(0, 1) }, 'F', 4)).toBe(0)
  })

  it('an accidental LATER in the bar does not reach backwards', () => {
    const m = model()
    m.addNote({ step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1) }, 'F', 4)).toBe(0)
  })

  it('⛔ a key on ANOTHER staff does not govern this one', () => {
    const m = new ScoreModel()
    m.addStaffBelow(0)
    const second = m.getScore().staves![1].id
    m.setKeyAt(1, G_MAJOR, second)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1), staff: 0 }, 'F', 4)).toBe(0)
    expect(entryAlteration(m.getScore(), { measure: 1, beat: frac(0, 1), staff: 1 }, 'F', 4)).toBe(1)
  })
})
