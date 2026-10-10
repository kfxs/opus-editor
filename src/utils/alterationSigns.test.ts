import { describe, it, expect } from 'vitest'
import { ALTERATION_SIGNS, accidentalOfAlteration, armsNatural, alterationCode, alterationField, armedAlteration, alterationOfCode, alterationRank, alterationSide, alterationSign, sameAlteration, setAlteration, armedDisplay, drawnSignOfPitch, showsArmedSign } from './alterationSigns'

describe('the sign table', () => {
  it('ranks the stored signs in the decided order (decision B) — the quarter-tones on the ODD ranks (K4)', () => {
    expect(ALTERATION_SIGNS.map(s => [s.id, s.rank])).toEqual([
      ['doubleFlat', -4], ['threeQuarterTonesFlatZimmermann', -3], ['flat', -2], ['quarterToneFlatStein', -1],
      ['quarterToneSharpStein', 1], ['sharp', 2], ['threeQuarterTonesSharpStein', 3], ['doubleSharp', 4],
      // ⭐ K7 — Gould's arrows, on the ranks of the Stein signs they stand for (ties allowed: a rank is an order).
      ['threeQuarterTonesFlatArrowDown', -3], ['quarterToneFlatArrowUp', -1], ['quarterToneSharpNaturalArrowUp', 1],
      ['quarterToneSharpArrowDown', 1], ['threeQuarterTonesSharpArrowUp', 3],
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

describe('sameAlteration', () => {
  it('absent and absent are the same; the same signs are the same', () => {
    expect(sameAlteration(undefined, undefined)).toBe(true)
    expect(sameAlteration(['sharp'], ['sharp'])).toBe(true)
  })

  it('anything else differs — and a sharp is not a double sharp', () => {
    expect(sameAlteration(undefined, ['sharp'])).toBe(false)
    expect(sameAlteration(['sharp'], ['doubleSharp'])).toBe(false)
    expect(sameAlteration(['sharp'], ['flat'])).toBe(false)
  })
})

describe('alterationSide — sharp-like or flat-like, read off the rank', () => {
  it('is the sign of the rank', () => {
    expect(alterationSide(['doubleSharp'])).toBe(1)
    expect(alterationSide(['flat'])).toBe(-1)
    expect(alterationSide(undefined)).toBe(0)
  })
})

describe('⛔ never an empty list stored', () => {
  it('alterationField spreads nothing for an unaltered pitch', () => {
    expect(alterationField(undefined)).toEqual({})
    expect(alterationField([])).toEqual({})
    expect(alterationField(['flat'])).toEqual({ alteration: ['flat'] })
  })

  it('setAlteration DELETES the field for an unaltered one', () => {
    const pitch: { alteration?: readonly ('sharp' | 'flat')[] } = { alteration: ['sharp'] }
    setAlteration(pitch, undefined)
    expect('alteration' in pitch).toBe(false)
    setAlteration(pitch, ['flat'])
    expect(pitch.alteration).toEqual(['flat'])
  })
})

describe('the armed sign (K1 — any sign of the table, or the natural)', () => {
  it('a sign arms itself; ♮ and nothing arm no alteration (the natural is DRAWN, never stored)', () => {
    expect(armedAlteration('sharp')).toEqual(['sharp'])
    expect(armedAlteration('doubleFlat')).toEqual(['doubleFlat'])
    expect(armedAlteration('natural')).toBeUndefined()
    expect(armedAlteration(null)).toBeUndefined()
    expect(armsNatural('natural')).toBe(true)
    expect(armsNatural('sharp')).toBe(false)
  })

  it('⭐ an alteration lights its OWN sign — a double lights the double, no longer the single key', () => {
    expect(accidentalOfAlteration(['sharp'])).toBe('sharp')
    expect(accidentalOfAlteration(['doubleSharp'])).toBe('doubleSharp')
    expect(accidentalOfAlteration(['doubleFlat'])).toBe('doubleFlat')
    expect(accidentalOfAlteration(undefined)).toBeUndefined()
  })
})

describe('the drawing\'s inherited strings (M3 retires them)', () => {
  it('alterationCode: the string the drawing names a sign by', () => {
    expect(alterationCode(['doubleSharp'])).toBe('##')
    expect(alterationCode(['sharp'])).toBe('#')
    expect(alterationCode(undefined)).toBe('')
    expect(alterationCode(['flat'])).toBe('b')
    expect(alterationCode(['doubleFlat'])).toBe('bb')
  })

  it('alterationOfCode is the way back; `n` and `` are unaltered', () => {
    expect(alterationOfCode('##')).toEqual(['doubleSharp'])
    expect(alterationOfCode('b')).toEqual(['flat'])
    expect(alterationOfCode('n')).toBeUndefined()
    expect(alterationOfCode('')).toBeUndefined()
  })
})

describe('♮♯ / ♮♭ — drawn signs the editor arms, never stored (K5)', () => {
  it('⭐ arm the plain sign plus the natural; any other sign takes the natural off', () => {
    expect([armedAlteration('naturalSharp'), armedDisplay('naturalSharp')]).toEqual([['sharp'], { naturalBefore: true }])
    expect([armedAlteration('naturalFlat'), armedDisplay('naturalFlat')]).toEqual([['flat'], { naturalBefore: true }])
    expect(armedDisplay('natural')).toEqual({ forceAccidental: true })
    expect(armedDisplay('sharp')).toEqual({})
  })

  it('⭐ a pitch carrying `naturalBefore` DRAWS ♮♯ / ♮♭, and lights that key', () => {
    expect(drawnSignOfPitch({ alteration: ['sharp'], naturalBefore: true })).toBe('naturalSharp')
    expect(drawnSignOfPitch({ alteration: ['flat'], naturalBefore: true })).toBe('naturalFlat')
    expect(drawnSignOfPitch({ alteration: ['sharp'] })).toBe('sharp')
    expect(accidentalOfAlteration(['sharp'], true)).toBe('naturalSharp')
  })

  it('⭐ ♯ and ♮♯ are told apart by the natural alone', () => {
    const note = { alteration: ['sharp'] as const, naturalBefore: true as const }
    expect(showsArmedSign(note, 'naturalSharp', undefined)).toBe(true)
    expect(showsArmedSign(note, 'sharp', undefined)).toBe(false)
  })
})
