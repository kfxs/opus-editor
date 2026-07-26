import { describe, it, expect } from 'vitest'
import { fanMembers, fanSpeedRatio, rampWeights, DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from './fannedBeam'
import { fracCreate as frac, fracFromInt, fracAdd, fracEq, fracToNumber } from './fraction'
import type { FanMark } from '@/types/music'

/**
 * The expander (docs/fanned-beams-plan.md §2). What is pinned here is the ONE promise a fan makes —
 * **the group's total duration is unchanged** — plus the degenerate cases, because a fan applied to
 * a note somebody then edits is how those get reached.
 */

const fan = (extra: Partial<FanMark> = {}): FanMark =>
  ({ direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS, ...extra })

const total = (members: { quarters: ReturnType<typeof fracFromInt> }[]) =>
  members.reduce((sum, m) => fracAdd(sum, m.quarters), fracFromInt(0))

describe('fanMembers — Σ quarters is EXACTLY the total', () => {
  it('sums to a blanca, to the last unit', () => {
    // The whole point: a fan is free accelerando *within* the duration. A float sum would drift and
    // everything after the group would move, which is the one thing a fan must never do.
    expect(fracEq(total(fanMembers(fan(), frac(2, 1))), frac(2, 1))).toBe(true)
  })

  it('sums exactly for every count and beam setting we can reach', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8, 12]) {
      for (const beams of [1, 2, 3, 4]) {
        for (const direction of ['accel', 'rit'] as const) {
          const members = fanMembers(fan({ count, beams, direction }), frac(3, 2))
          expect(fracEq(total(members), frac(3, 2))).toBe(true)
          expect(members).toHaveLength(count)
        }
      }
    }
  })

  it('sums exactly across a dotted and a tuplet-sized span', () => {
    for (const span of [frac(7, 2), frac(1, 3), frac(4, 7)]) {
      expect(fracEq(total(fanMembers(fan(), span)), span)).toBe(true)
    }
  })
})

describe('the ramp', () => {
  it('accel gets shorter, rit gets longer', () => {
    const accel = fanMembers(fan({ direction: 'accel' }), frac(2, 1))
    for (let k = 1; k < accel.length; k++) {
      expect(fracToNumber(accel[k].quarters)).toBeLessThan(fracToNumber(accel[k - 1].quarters))
    }
    const rit = fanMembers(fan({ direction: 'rit' }), frac(2, 1))
    for (let k = 1; k < rit.length; k++) {
      expect(fracToNumber(rit[k].quarters)).toBeGreaterThan(fracToNumber(rit[k - 1].quarters))
    }
  })

  it('rit is accel read backwards — one ramp, two directions', () => {
    const accel = fanMembers(fan({ direction: 'accel' }), frac(2, 1))
    const rit = fanMembers(fan({ direction: 'rit' }), frac(2, 1))
    const lengths = (ms: typeof accel) => ms.map(m => fracToNumber(m.quarters))
    expect(lengths(rit)).toEqual([...lengths(accel)].reverse())
  })

  it('the fast end is `fanSpeedRatio(beams)` times the slow end', () => {
    // A beam IS a halving, so 1→3 beams is 4×. The number is provisional; that it is the number
    // `fanSpeedRatio` reports is not.
    const members = fanMembers(fan({ beams: 3 }), frac(2, 1))
    const slow = fracToNumber(members[0].quarters)
    const fast = fracToNumber(members[members.length - 1].quarters)
    expect(slow / fast).toBeCloseTo(fanSpeedRatio(3), 10)
    expect(fanSpeedRatio(3)).toBe(4)
    expect(fanSpeedRatio(1)).toBe(1)
  })

  it('one beam is a ratio of 1 — an EVEN group, not a fan', () => {
    const members = fanMembers(fan({ beams: 1 }), frac(2, 1))
    const lengths = members.map(m => fracToNumber(m.quarters))
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0], 10)
  })
})

describe('startFraction — the proportion the drawing and the playback share', () => {
  it('starts at 0, rises, and never reaches 1', () => {
    const members = fanMembers(fan(), frac(2, 1))
    expect(members[0].startFraction).toBe(0)
    for (let k = 1; k < members.length; k++) {
      expect(members[k].startFraction).toBeGreaterThan(members[k - 1].startFraction)
    }
    expect(members[members.length - 1].startFraction).toBeLessThan(1)
  })

  it('agrees with the running sum of the exact durations', () => {
    const span = frac(2, 1)
    const members = fanMembers(fan(), span)
    let elapsed = fracFromInt(0)
    for (const m of members) {
      expect(m.startFraction).toBeCloseTo(fracToNumber(elapsed) / fracToNumber(span), 10)
      elapsed = fracAdd(elapsed, m.quarters)
    }
  })
})

describe('degenerate — it bends, it does not throw', () => {
  it('a count of 1 is the note itself', () => {
    const members = fanMembers(fan({ count: 1 }), frac(2, 1))
    expect(members).toHaveLength(1)
    expect(fracEq(members[0].quarters, frac(2, 1))).toBe(true)
    expect(members[0].startFraction).toBe(0)
  })

  it('a count of 2 is the shortest real fan', () => {
    const members = fanMembers(fan({ count: 2, beams: 3 }), frac(2, 1))
    expect(members).toHaveLength(2)
    expect(fracEq(total(members), frac(2, 1))).toBe(true)
    expect(fracToNumber(members[0].quarters)).toBeGreaterThan(fracToNumber(members[1].quarters))
  })

  it('a count of 0 or a negative one is still one member holding the whole duration', () => {
    for (const count of [0, -3]) {
      const members = fanMembers(fan({ count }), frac(2, 1))
      expect(members).toHaveLength(1)
      expect(fracEq(members[0].quarters, frac(2, 1))).toBe(true)
    }
  })

  it('a zero-length span reports one member rather than dividing by it', () => {
    const members = fanMembers(fan(), fracFromInt(0))
    expect(members).toHaveLength(1)
    expect(members[0].startFraction).toBe(0)
  })
})

describe('rampWeights — the seam the curve will be swapped at', () => {
  it('runs from 1 down to 1/ratio', () => {
    const w = rampWeights(5, 4)
    expect(fracEq(w[0], fracFromInt(1))).toBe(true)
    expect(fracEq(w[4], frac(1, 4))).toBe(true)
  })

  it('is linear — equal steps', () => {
    const w = rampWeights(5, 4).map(fracToNumber)
    for (let k = 2; k < w.length; k++) {
      expect(w[k] - w[k - 1]).toBeCloseTo(w[1] - w[0], 10)
    }
  })

  it('n = 1 has no ramp to build', () => {
    expect(rampWeights(1, 4)).toHaveLength(1)
  })
})
