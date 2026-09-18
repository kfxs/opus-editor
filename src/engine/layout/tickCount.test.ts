import { describe, it, expect } from 'vitest'
import { addTicks, lcm, subtractTicks, ticksEqual, ticksGreaterThan, ticksValue } from './tickCount'

// VexFlow's `Fraction` arithmetic, transcribed (S9i). ⚠️ That it matches VexFlow's own was proved once,
// side by side on random voices (`docs/vexflow-removal-map.md` §5.2); pinned here is what it promises.
describe('tickCount', () => {
  it('adds over the LCM and ⛔ never reduces — a column key is the NUMERATOR', () => {
    expect(addTicks({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 2 }))
      .toEqual({ numerator: 2, denominator: 2 })
    expect(addTicks({ numerator: 1, denominator: 3 }, { numerator: 1, denominator: 6 }))
      .toEqual({ numerator: 3, denominator: 6 })
  })

  it('adds IN PLACE, as `Fraction.add` does', () => {
    const sum = { numerator: 0, denominator: 3 }
    addTicks(sum, { numerator: 4096, denominator: 1 })
    expect(sum).toEqual({ numerator: 12288, denominator: 3 })
  })

  it('subtracts, compares by sign, and equals REDUCED', () => {
    expect(subtractTicks({ numerator: 3, denominator: 6 }, { numerator: 1, denominator: 6 }))
      .toEqual({ numerator: 2, denominator: 6 })
    expect(ticksGreaterThan({ numerator: 2, denominator: 3 }, { numerator: 1, denominator: 2 })).toBe(true)
    expect(ticksGreaterThan({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 })).toBe(false)
    expect(ticksEqual({ numerator: 2, denominator: 4 }, { numerator: 1, denominator: 2 })).toBe(true)
    expect(ticksEqual({ numerator: 2, denominator: 4 }, { numerator: 1, denominator: 3 })).toBe(false)
  })

  it('values and LCMs', () => {
    expect(ticksValue({ numerator: 12288, denominator: 3 })).toBe(4096)
    expect(lcm(4, 6)).toBe(12)
  })
})
