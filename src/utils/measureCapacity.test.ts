import { describe, it, expect } from 'vitest'
import { getMeasureDuration, getMeasureDurationFrac, measureCapacityFrac, measureCapacityQuarters, measureStartQuarters } from './measureCapacity'
import { fracCreate, fracEq } from './fraction'
import type { Measure, TimeSignature } from '@/types/music'

const frac = fracCreate

/**
 * The four capacity functions, gathered here when they left `musicUtils` (docs/refactor-plan-2026-07-27.md
 * 3d). They were tested in two places before — the float pair in `musicUtils.test.ts`, the exact
 * generality matrix in `durations.test.ts` under a note reading *"lives in musicUtils, validated here
 * alongside the duration table"*, which had already stopped being true of anything.
 */

describe('getMeasureDuration', () => {
  it('should calculate 4/4 time signature as 4 beats', () => {
    const ts: TimeSignature = { numerator: 4, denominator: 4 }
    expect(getMeasureDuration(ts)).toBe(4)
  })

  it('should calculate 3/4 time signature as 3 beats', () => {
    const ts: TimeSignature = { numerator: 3, denominator: 4 }
    expect(getMeasureDuration(ts)).toBe(3)
  })

  it('should calculate 6/8 time signature as 3 beats', () => {
    const ts: TimeSignature = { numerator: 6, denominator: 8 }
    expect(getMeasureDuration(ts)).toBe(3)
  })

  it('should calculate 2/2 time signature as 4 beats', () => {
    const ts: TimeSignature = { numerator: 2, denominator: 2 }
    expect(getMeasureDuration(ts)).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// getMeasureDurationFrac — exact bar length across the generality matrix
// ---------------------------------------------------------------------------

describe('getMeasureDurationFrac', () => {
  const cases: Array<[number, number, number, number]> = [
    // numerator, denominator, expected num, expected den
    [4, 4, 4, 1],
    [3, 4, 3, 1],
    [2, 4, 2, 1],
    [2, 2, 4, 1],
    [6, 8, 3, 1],
    [9, 8, 9, 2],
    [12, 8, 6, 1],
    [5, 8, 5, 2],
    [7, 8, 7, 2],
    [16, 4, 16, 1],
    [7, 4, 7, 1],
    [13, 16, 13, 4],
    [32, 16, 8, 1],
    [15, 8, 15, 2],
  ]

  it.each(cases)('%d/%d → %d/%d quarter beats', (num, den, en, ed) => {
    expect(fracEq(getMeasureDurationFrac({ numerator: num, denominator: den }), frac(en, ed))).toBe(true)
  })

  it('agrees with the float getMeasureDuration for /4 meters', () => {
    // 4/4 = 4/1, reduced fraction equals the float
    expect(getMeasureDurationFrac({ numerator: 4, denominator: 4 })).toEqual(frac(4, 1))
  })
})

describe('measureCapacity (pickup-aware bar length)', () => {
  const bar = (ts: TimeSignature, override?: { num: number; den: number }): Measure => ({
    id: 'm', number: 1, slots: [], tuplets: [], timeSignature: ts,
    ...(override ? { actualDurationOverride: fracCreate(override.num, override.den) } : {}),
  })

  it('uses the nominal time-signature length when there is no override', () => {
    expect(measureCapacityQuarters(bar({ numerator: 4, denominator: 4 }))).toBe(4)
    expect(measureCapacityQuarters(bar({ numerator: 6, denominator: 8 }))).toBe(3)
    expect(measureCapacityFrac(bar({ numerator: 7, denominator: 8 }))).toEqual(fracCreate(7, 2))
  })

  it('uses the override when present (a 1-beat pickup in 4/4)', () => {
    const pickup = bar({ numerator: 4, denominator: 4 }, { num: 1, den: 1 })
    expect(measureCapacityQuarters(pickup)).toBe(1)
    expect(measureCapacityFrac(pickup)).toEqual(fracCreate(1, 1))
  })
})

/**
 * WHERE A BAR STARTS — the address playback seeks with. "Start at bar 12" is only actionable as a
 * number of beats from the top, because that is the space the tempo map turns into seconds.
 */
describe('measureStartQuarters', () => {
  const numbered = (specs: { ts: TimeSignature; pickup?: { num: number; den: number } }[]): Measure[] =>
    specs.map((spec, i) => ({
      id: `m${i + 1}`, number: i + 1, slots: [], tuplets: [], timeSignature: spec.ts,
      ...(spec.pickup ? { actualDurationOverride: fracCreate(spec.pickup.num, spec.pickup.den) } : {}),
    }))

  const fourFour = { numerator: 4, denominator: 4 }

  it('bar 1 starts at the top', () => {
    expect(measureStartQuarters(numbered([{ ts: fourFour }, { ts: fourFour }]), 1)).toBe(0)
  })

  it('sums the bars before it', () => {
    const bars = numbered([{ ts: fourFour }, { ts: fourFour }, { ts: fourFour }])
    expect(measureStartQuarters(bars, 3), 'two bars of 4/4 come first').toBe(8)
  })

  it('⭐ counts CAPACITY, so a pickup bar does not lie about where bar 2 begins', () => {
    const bars = numbered([{ ts: fourFour, pickup: { num: 1, den: 1 } }, { ts: fourFour }])
    expect(measureStartQuarters(bars, 2), 'the pickup is one beat long, not four').toBe(1)
  })

  it('…and follows a meter change', () => {
    const bars = numbered([{ ts: fourFour }, { ts: { numerator: 3, denominator: 4 } }, { ts: fourFour }])
    expect(measureStartQuarters(bars, 3)).toBe(7)
  })

  it('answers where a bar begins, and does not police whether it exists', () => {
    const bars = numbered([{ ts: fourFour }, { ts: fourFour }])
    expect(measureStartQuarters(bars, 99), 'past the end = the whole length').toBe(8)
    expect(measureStartQuarters(bars, 0), 'before the start = the top').toBe(0)
  })
})
