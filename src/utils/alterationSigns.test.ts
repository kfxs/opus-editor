import { describe, it, expect } from 'vitest'
import { ALTERATION_SIGNS, alterationRank, alterationSign, signsOfAlter } from './alterationSigns'

describe('the sign table', () => {
  it('ranks the four stored signs in the decided order (decision B)', () => {
    expect(ALTERATION_SIGNS.map(s => [s.id, s.rank])).toEqual([
      ['doubleFlat', -4], ['flat', -2], ['sharp', 2], ['doubleSharp', 4],
    ])
  })

  it('an id is the SMuFL glyph name without its `accidental` prefix', () => {
    for (const sign of ALTERATION_SIGNS) {
      expect(sign.glyph).toBe(`accidental${sign.id[0].toUpperCase()}${sign.id.slice(1)}`)
    }
  })

  it('looks a sign up by id', () => {
    expect(alterationSign('flat').glyph).toBe('accidentalFlat')
  })
})

describe('alterationRank', () => {
  it('absent or empty is unaltered: 0', () => {
    expect(alterationRank(undefined)).toBe(0)
    expect(alterationRank([])).toBe(0)
  })

  it('one sign is its own rank', () => {
    expect(alterationRank(['doubleSharp'])).toBe(4)
    expect(alterationRank(['flat'])).toBe(-2)
  })
})

describe('signsOfAlter — the M0 bridge from the stored number', () => {
  it('maps every stored alter to the signs it means', () => {
    expect(signsOfAlter(-2)).toEqual(['doubleFlat'])
    expect(signsOfAlter(-1)).toEqual(['flat'])
    expect(signsOfAlter(0)).toEqual([])
    expect(signsOfAlter(undefined)).toEqual([])
    expect(signsOfAlter(1)).toEqual(['sharp'])
    expect(signsOfAlter(2)).toEqual(['doubleSharp'])
  })
})
