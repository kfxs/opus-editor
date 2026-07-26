import { describe, it, expect } from 'vitest'
import { fanMembers, fanSpeedRatio, rampWeights, normalizeFan, cloneFanFresh, DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from './fannedBeam'
import { fracCreate as frac, fracFromInt, fracAdd, fracEq, fracToNumber } from './fraction'
import type { FanMark, NotePitch } from '@/types/music'

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

/**
 * ⚠️ `normalizeFan` is PURE — and it has to be, because the mark it is handed is very often the
 * LIVE `chord.fan` spread into a new object (`toFlatNote` hands out the reference,
 * `FanEditController` spreads it). An in-place edit here would reach straight through that spread
 * and write into the model behind the mutator's back, with undo none the wiser.
 */
describe('normalizeFan — the one owner of members.length === count - 1', () => {
  const pitch = (step: string, id: string): NotePitch =>
    ({ id, step: step as NotePitch['step'], alter: 0, octave: 4 })
  const own = [pitch('C', 'own-1')]

  it('never touches the mark — or the members array — it was handed', () => {
    const before: FanMark = { direction: 'accel', count: 2, beams: 3, members: [[pitch('E', 'm1')]] }
    const snapshot = JSON.stringify(before)
    const after = normalizeFan({ ...before, count: 5 }, own)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(after.members).not.toBe(before.members)
    expect(after.members).toHaveLength(4)
  })

  it('stores the clamped count, so the invariant holds for what was actually written', () => {
    const out = normalizeFan({ direction: 'rit', count: 1e9, beams: 2 }, own)
    expect(out.members).toHaveLength(out.count - 1)
  })

  it('drops what a member is not allowed to carry — a tie belongs to the slot', () => {
    const tied: NotePitch = { ...pitch('C', 'own-1'), tiedTo: 'somewhere', tieDirection: 1 }
    const out = normalizeFan({ direction: 'accel', count: 3, beams: 3 }, [tied])
    expect(out.members!.every(m => m[0].tiedTo === undefined && m[0].tieDirection === undefined)).toBe(true)
  })
})

describe('cloneFanFresh — the copy that mints its own ids', () => {
  it('same pitches, no shared id, and the arrays are its own', () => {
    const src: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [[{ id: 'a', step: 'C', alter: 0, octave: 4 }], [{ id: 'b', step: 'E', alter: 1, octave: 4 }]],
    }
    const copy = cloneFanFresh(src)
    expect(copy.members!.map(m => `${m[0].step}${m[0].alter}${m[0].octave}`)).toEqual(['C04', 'E14'])
    expect(copy.members!.flat().map(p => p.id)).not.toContain('a')
    expect(copy.members![0]).not.toBe(src.members![0])
  })

  it('a mark with no members is copied, not repaired', () => {
    expect(cloneFanFresh({ direction: 'rit', count: 4, beams: 2 })).toEqual({ direction: 'rit', count: 4, beams: 2 })
  })
})
