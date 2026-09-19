/** The staff-line helpers the articulation's stacking and placement share (`articulation.js`, transcribed). */
import { describe, it, expect } from 'vitest'
import { isWithinLines, roundToNearestHalf, roundingFor } from './articulationLines'

describe('articulationLines', () => {
  it('inside the staff is at or below line 5 above it, at or above line 1 below it', () => {
    expect([isWithinLines(5, 'above'), isWithinLines(5.5, 'above')]).toEqual([true, false])
    expect([isWithinLines(1, 'below'), isWithinLines(0.5, 'below')]).toEqual([true, false])
  })

  it('rounds OUTWARD while inside the staff, and to the nearest half outside it', () => {
    expect(roundToNearestHalf(roundingFor(3.2, 'above'), 3.2)).toBe(3.5)
    expect(roundToNearestHalf(roundingFor(3.2, 'below'), 3.2)).toBe(3)
    expect(roundToNearestHalf(roundingFor(6.2, 'above'), 6.2)).toBe(6)
  })
})
