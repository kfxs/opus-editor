import { describe, it, expect } from 'vitest'
import { parseGrouping, candidateTimeSignature, timeSignatureError, groupingError } from './groupingInput'

/**
 * The rule that used to live in App.vue as two computeds. Pinned here so the plain-TS windows and
 * the Vue dialog cannot drift apart on what a legal grouping is.
 */
describe('parseGrouping', () => {
  it('reads all three separators people actually type', () => {
    expect(parseGrouping('2+2+3')).toEqual([2, 2, 3])
    expect(parseGrouping('2,2,3')).toEqual([2, 2, 3])
    expect(parseGrouping('2 2 3')).toEqual([2, 2, 3])
    expect(parseGrouping(' 3 3  1 ')).toEqual([3, 3, 1])
  })

  // Empty is not an error: it means "no explicit grouping", and the meter's algorithmic default
  // takes over. A grouping field left alone must not make a valid meter unusable.
  it('reads empty as no grouping at all', () => {
    expect(parseGrouping('')).toBeUndefined()
    expect(parseGrouping('   ')).toBeUndefined()
  })
})

describe('timeSignatureError', () => {
  it('accepts a meter whose grouping sums to the numerator', () => {
    expect(groupingError('3+3+1', 7, 8)).toBeNull()
  })

  it('accepts a meter with no grouping', () => {
    expect(groupingError('', 4, 4)).toBeNull()
  })

  // The message names the thing the user can act on. A bare isValidTimeSignature would have called
  // this "not representable", which is true and useless.
  it('says what the grouping should have summed to', () => {
    expect(groupingError('3+3', 7, 8)).toBe('Grouping must sum to 7 (got 6).')
  })

  it('rejects a non-dyadic denominator', () => {
    expect(groupingError('', 4, 6)).toBe('Denominator must be a power of two (1–32).')
  })

  it('rejects a zero or negative group, which sums right but means nothing', () => {
    expect(groupingError('4+0', 4, 4)).toBe('Each group must be a positive whole number.')
  })

  it('reports unreadable numbers before judging the meter', () => {
    expect(timeSignatureError(candidateTimeSignature('x', 4, ''))).toBe('Enter whole numbers.')
    expect(groupingError('two+two', 4, 4)).toBe('Enter whole numbers.')
  })
})
