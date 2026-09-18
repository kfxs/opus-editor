/** The line halfway between two lines — VexFlow's `midLine`, quirks included. */
import { describe, it, expect } from 'vitest'
import { midLine } from './midLine'

describe('midLine', () => {
  it('halfway between two lines', () => {
    expect(midLine(4, 1)).toBe(2.5)
    expect(midLine(5, 1)).toBe(3)
  })

  it('snaps a mid that lands off a half line', () => {
    // (4.4 + 1) / 2 = 2.7 → 2.5 (27 rounds down to 25 in steps of 5)
    expect(midLine(4.4, 1)).toBe(2.5)
    // (4.6 + 1) / 2 = 2.8 → 3
    expect(midLine(4.6, 1)).toBe(3)
  })

  it('⚠️ never snaps a NEGATIVE mid', () => {
    expect(midLine(-1, -1.6)).toBeCloseTo(-1.3)
  })
})
