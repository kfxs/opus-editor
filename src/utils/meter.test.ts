import { describe, it, expect } from 'vitest'
import { getMeterInfo, isDyadicMeter, STRENGTH, type MeterInfo } from './meter'
import { fracToNumber, fracCreate, fracEq } from './fraction'
import type { TimeSignature } from '@/types/music'

// --- helpers ---------------------------------------------------------------

const ts = (numerator: number, denominator: number): TimeSignature => ({ numerator, denominator })

/** Group / boundary lengths as plain numbers for readable assertions. */
const nums = (info: MeterInfo) => ({
  bar: fracToNumber(info.barQuarters),
  beat: fracToNumber(info.beatUnit),
  groups: info.groups.map(fracToNumber),
})

/** Strength of the boundary exactly at quarter-beat `q`, or undefined. */
const strengthAt = (info: MeterInfo, q: number): number | undefined =>
  info.boundaries.find((b) => fracToNumber(b.at) === q)?.strength

describe('meter — getMeterInfo', () => {
  describe('bar length, compound flag, felt beat, groups', () => {
    it('4/4 — simple quadruple, four quarter beats', () => {
      const info = getMeterInfo(ts(4, 4))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 4, beat: 1, groups: [1, 1, 1, 1] })
    })

    it('3/4 — simple triple', () => {
      const info = getMeterInfo(ts(3, 4))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 3, beat: 1, groups: [1, 1, 1] })
    })

    it('2/2 — cut time, two half-note beats', () => {
      const info = getMeterInfo(ts(2, 2))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 4, beat: 2, groups: [2, 2] })
    })

    it('6/8 — compound duple, two dotted-quarter beats', () => {
      const info = getMeterInfo(ts(6, 8))
      expect(info.isCompound).toBe(true)
      expect(nums(info)).toEqual({ bar: 3, beat: 1.5, groups: [1.5, 1.5] })
    })

    it('9/8 — compound triple', () => {
      const info = getMeterInfo(ts(9, 8))
      expect(info.isCompound).toBe(true)
      expect(nums(info)).toEqual({ bar: 4.5, beat: 1.5, groups: [1.5, 1.5, 1.5] })
    })

    it('12/8 — compound quadruple', () => {
      const info = getMeterInfo(ts(12, 8))
      expect(info.isCompound).toBe(true)
      expect(nums(info)).toEqual({ bar: 6, beat: 1.5, groups: [1.5, 1.5, 1.5, 1.5] })
    })

    it('5/8 — irregular 2+3', () => {
      const info = getMeterInfo(ts(5, 8))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 2.5, beat: 0.5, groups: [1, 1.5] })
    })

    it('7/8 — irregular 2+2+3', () => {
      const info = getMeterInfo(ts(7, 8))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 3.5, beat: 0.5, groups: [1, 1, 1.5] })
    })

    it('32/16 — eight quarter-note pulses (generality)', () => {
      const info = getMeterInfo(ts(32, 16))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 8, beat: 1, groups: [1, 1, 1, 1, 1, 1, 1, 1] })
    })

    it('16/4 — simple by design, sixteen quarter beats (generality)', () => {
      const info = getMeterInfo(ts(16, 4))
      expect(info.isCompound).toBe(false)
      expect(info.groups).toHaveLength(16)
      expect(nums(info).bar).toBe(16)
      expect(info.groups.every((g) => fracEq(g, fracCreate(1, 1)))).toBe(true)
    })

    it('15/8 — compound (divisible by 3, denom ≥ 8): five dotted-quarter beats', () => {
      const info = getMeterInfo(ts(15, 8))
      expect(info.isCompound).toBe(true)
      expect(nums(info)).toEqual({ bar: 7.5, beat: 1.5, groups: [1.5, 1.5, 1.5, 1.5, 1.5] })
    })

    it('13/16 — irregular fallback (twos with a final three)', () => {
      const info = getMeterInfo(ts(13, 16))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 3.25, beat: 0.25, groups: [0.5, 0.5, 0.5, 0.5, 0.5, 0.75] })
    })

    it('7/4 — simple by design (denom ≤ 4), seven quarter beats (generality)', () => {
      const info = getMeterInfo(ts(7, 4))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 7, beat: 1, groups: [1, 1, 1, 1, 1, 1, 1] })
    })

    it('11/8 — generated fallback meter (2+2+2+2+3)', () => {
      const info = getMeterInfo(ts(11, 8))
      expect(info.isCompound).toBe(false)
      expect(nums(info)).toEqual({ bar: 5.5, beat: 0.5, groups: [1, 1, 1, 1, 1.5] })
    })

    it('groups always sum to barQuarters', () => {
      for (const [n, d] of [[4, 4], [3, 4], [2, 2], [6, 8], [9, 8], [12, 8], [5, 8], [7, 8], [32, 16], [13, 16], [15, 8], [7, 4]] as const) {
        const info = getMeterInfo(ts(n, d))
        const sum = info.groups.reduce((a, b) => a + fracToNumber(b), 0)
        expect(sum).toBe(fracToNumber(info.barQuarters))
      }
    })
  })

  describe('additive grouping argument', () => {
    it('3+2+2 / 8 overrides the default 2+2+3', () => {
      const info = getMeterInfo(ts(7, 8), [3, 2, 2])
      expect(nums(info).groups).toEqual([1.5, 1, 1])
    })

    it('rejects a grouping that does not sum to the numerator', () => {
      expect(() => getMeterInfo(ts(7, 8), [2, 2, 2])).toThrow(/sums to 6, expected 7/)
    })

    it('rejects a grouping with non-positive parts', () => {
      expect(() => getMeterInfo(ts(7, 8), [3, 0, 4])).toThrow(/positive integers/)
    })
  })

  describe('metric-strength hierarchy (boundaries)', () => {
    it('bar start is always the strongest boundary, at beat 0', () => {
      const info = getMeterInfo(ts(4, 4))
      expect(info.boundaries[0].at).toEqual(fracCreate(0, 1))
      expect(info.boundaries[0].strength).toBe(STRENGTH.bar)
    })

    it('4/4 — mid-bar elevated above the weak beats', () => {
      const info = getMeterInfo(ts(4, 4))
      expect(strengthAt(info, 2)).toBe(STRENGTH.halfBar) // mid-bar
      expect(strengthAt(info, 1)).toBe(STRENGTH.group) // weak beat
      expect(strengthAt(info, 3)).toBe(STRENGTH.group) // weak beat
      // mid-bar strictly stronger than the beats either side of it
      expect(strengthAt(info, 2)!).toBeGreaterThan(strengthAt(info, 1)!)
      // eighth offbeats are weaker still
      expect(strengthAt(info, 0.5)!).toBeLessThan(strengthAt(info, 1)!)
    })

    it('3/4 — no mid-bar elevation (odd division)', () => {
      const info = getMeterInfo(ts(3, 4))
      expect(info.boundaries.some((b) => b.strength === STRENGTH.halfBar)).toBe(false)
      expect(strengthAt(info, 1)).toBe(STRENGTH.group)
      expect(strengthAt(info, 2)).toBe(STRENGTH.group)
    })

    it('2/2 — beat 2 (mid) stronger than beats 1 and 3', () => {
      const info = getMeterInfo(ts(2, 2))
      expect(strengthAt(info, 2)).toBe(STRENGTH.halfBar)
      expect(strengthAt(info, 1)!).toBeLessThan(strengthAt(info, 2)!)
      expect(strengthAt(info, 3)!).toBeLessThan(strengthAt(info, 2)!)
    })

    it('6/8 — compound beat boundary at 1.5, eighth subdivisions weaker', () => {
      const info = getMeterInfo(ts(6, 8))
      expect(strengthAt(info, 1.5)).toBe(STRENGTH.halfBar) // sole group boundary == mid
      expect(strengthAt(info, 0.5)!).toBeLessThan(strengthAt(info, 1.5)!)
      expect(strengthAt(info, 1)!).toBeLessThan(strengthAt(info, 1.5)!)
    })

    it('12/8 — mid-bar (beat 3) elevated above the other compound beats', () => {
      const info = getMeterInfo(ts(12, 8))
      expect(strengthAt(info, 3)).toBe(STRENGTH.halfBar)
      expect(strengthAt(info, 1.5)).toBe(STRENGTH.group)
      expect(strengthAt(info, 4.5)).toBe(STRENGTH.group)
    })

    it('boundaries are sorted ascending and within [0, barQuarters)', () => {
      const info = getMeterInfo(ts(7, 8))
      const bar = fracToNumber(info.barQuarters)
      let prev = -1
      for (const b of info.boundaries) {
        const at = fracToNumber(b.at)
        expect(at).toBeGreaterThan(prev)
        expect(at).toBeGreaterThanOrEqual(0)
        expect(at).toBeLessThan(bar)
        prev = at
      }
    })

    it('does not subdivide below a 32nd note', () => {
      // Every boundary sits on the 32nd grid (1/8 quarter); the gap between
      // adjacent boundaries is never finer than that.
      const info = getMeterInfo(ts(4, 4))
      const positions = info.boundaries.map((b) => fracToNumber(b.at))
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(1 / 8 - 1e-9)
      }
    })
  })

  describe('validation', () => {
    it('accepts every dyadic denominator', () => {
      for (const d of [1, 2, 4, 8, 16, 32]) {
        expect(isDyadicMeter(ts(3, d))).toBe(true)
      }
    })

    it('rejects a non-dyadic (irrational) meter like 4/3', () => {
      expect(isDyadicMeter(ts(4, 3))).toBe(false)
      expect(() => getMeterInfo(ts(4, 3))).toThrow(/Unsupported time signature 4\/3/)
    })

    it('rejects denominators finer than a 32nd (e.g. 64)', () => {
      expect(isDyadicMeter(ts(4, 64))).toBe(false)
      expect(() => getMeterInfo(ts(4, 64))).toThrow()
    })

    it('rejects a non-positive or non-integer numerator', () => {
      expect(isDyadicMeter(ts(0, 4))).toBe(false)
      expect(isDyadicMeter(ts(2.5, 4))).toBe(false)
    })
  })
})
