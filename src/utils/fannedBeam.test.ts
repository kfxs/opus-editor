import { describe, it, expect } from 'vitest'
import {
  fanMembers, fanSpeedRatio, rampWeights, fanWeights, fanRampRange, normalizeFan,
  cloneFanFresh, fanSpread, clampFanSpread, DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS, MAX_FAN_SPREAD,
} from './fannedBeam'
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
 * ⭐ The RANGE (docs/fan-ramp-range-plan.md P0). Two promises: the default is **today's numbers, to
 * the last unit** — this is the whole no-migration claim, and a drifted weight would move every fan
 * already on the page — and an inset mark holds the members outside it at ONE weight, which is what
 * makes "outside the mark is a one-beam note at base speed" true of the sound as well as the picture.
 */
describe('fanWeights — the one owner of count, ratio, direction and range', () => {
  const nums = (f: FanMark) => fanWeights(f).map(fracToNumber)

  it('with no range it IS the old expression — the whole group, reversed for a rit', () => {
    for (const count of [2, 3, 5, 6, 9]) {
      for (const beams of [1, 2, 3, 4]) {
        const plain = rampWeights(count, fanSpeedRatio(beams))
        expect(fanWeights(fan({ count, beams }))).toEqual(plain)
        expect(fanWeights(fan({ count, beams, direction: 'rit' }))).toEqual([...plain].reverse())
      }
    }
  })

  it('outside the mark every member weighs the same — the base, one beam', () => {
    const w = nums(fan({ count: 6, beams: 3, rampFrom: 2, rampTo: 4 }))
    expect(w.slice(0, 3)).toEqual([1, 1, 1]) // 0,1 outside; 2 is the ramp's own narrow end
    expect(w[5]).toBe(1)
    expect(w[3]).toBeLessThan(w[2])
    expect(w[4]).toBeCloseTo(1 / 4, 10) // 3 beams ⇒ the wide end is 4× the speed
  })

  it('the ramp is REVERSED, not the group — a rit keeps its mark where it was put', () => {
    // The trap §2 exists for: reversing the whole array would mirror `[1,3]` onto `[2,4]`.
    const w = nums(fan({ count: 6, beams: 3, direction: 'rit', rampFrom: 1, rampTo: 3 }))
    expect([w[0], w[4], w[5]]).toEqual([1, 1, 1])
    expect(w[1]).toBeCloseTo(1 / 4, 10) // a rit OPENS at the wide end
    expect(w[3]).toBe(1)
  })

  it('one member each side is a whole ramp — the shortest mark there is', () => {
    const w = nums(fan({ count: 5, beams: 2, rampFrom: 1, rampTo: 2 }))
    expect(w).toEqual([1, 1, 0.5, 1, 1])
  })
})

describe('fanRampRange — it clamps, it does not trust', () => {
  it('absent is the whole group', () => {
    expect(fanRampRange(fan({ count: 6 }))).toEqual({ from: 0, to: 5 })
  })

  it('a range past the end of the count reads as the group, and never throws', () => {
    // The reason it clamps at all: `normalizeFan` runs from `setFan` alone, so `fromJSON` and the
    // undo restore can hand a reader anything the file said.
    expect(fanRampRange(fan({ count: 3, rampFrom: 9, rampTo: 40 }))).toEqual({ from: 1, to: 2 })
    expect(() => fanWeights(fan({ count: 3, rampFrom: 9, rampTo: 40 }))).not.toThrow()
    expect(fanWeights(fan({ count: 3, rampFrom: -5, rampTo: 1.4 }))).toHaveLength(3)
  })

  it('a NaN end falls back to that end of the group rather than guessing', () => {
    expect(fanRampRange(fan({ count: 4, rampFrom: NaN, rampTo: NaN }))).toEqual({ from: 0, to: 3 })
  })

  it('a crossed pair keeps the start and pushes the end past it', () => {
    expect(fanRampRange(fan({ count: 8, rampFrom: 5, rampTo: 2 }))).toEqual({ from: 5, to: 6 })
  })

  it('a fan of one has no range to speak of', () => {
    expect(fanRampRange(fan({ count: 1, rampFrom: 0, rampTo: 3 }))).toEqual({ from: 0, to: 0 })
  })
})

describe('the range, read by the three consumers', () => {
  it('Σ quarters is STILL exactly the slot total', () => {
    for (const direction of ['accel', 'rit'] as const) {
      const members = fanMembers(fan({ count: 7, beams: 3, direction, rampFrom: 2, rampTo: 5 }), frac(3, 2))
      expect(fracEq(total(members), frac(3, 2))).toBe(true)
      expect(members).toHaveLength(7)
    }
  })

  it('the steady stretch is EVEN, and it is not the same speed as the full ramp', () => {
    // §0's honesty point: the weights are normalized into one unchanged total, so shrinking the ramp
    // hands time back to the notes outside it. Even at every setting; constant at none.
    const spans = (f: FanMark) => fanMembers(f, frac(1, 1)).map(m => fracToNumber(m.quarters))
    const ranged = spans(fan({ count: 6, beams: 3, rampFrom: 3, rampTo: 5 }))
    expect(ranged[0]).toBeCloseTo(ranged[1], 10)
    expect(ranged[1]).toBeCloseTo(ranged[2], 10)
    expect(ranged[0]).toBeLessThan(spans(fan({ count: 6, beams: 3 }))[0])
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
    const before: FanMark = { direction: 'accel', count: 2, beams: 3, members: [{ pitches: [pitch('E', 'm1')] }] }
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

  it('ABSENT is the only spelling of the whole group — a redundant range is deleted', () => {
    // Not tidiness: `laneFingerprint` stringifies the slot, so the two spellings would mint two
    // width-cache keys for one piece of music.
    const out = normalizeFan({ direction: 'accel', count: 6, beams: 3, rampFrom: 0, rampTo: 5 }, own)
    expect('rampFrom' in out).toBe(false)
    expect('rampTo' in out).toBe(false)
  })

  it('stores an inset range clamped, having already clamped the count', () => {
    const out = normalizeFan({ direction: 'accel', count: 4, beams: 3, rampFrom: 1, rampTo: 9 }, own)
    expect([out.rampFrom, out.rampTo]).toEqual([1, 3])
  })

  it('a LOWERED count pulls a stranded range in — and back to absent when it spans the group', () => {
    // The same edit that truncates the member list settles the range; nobody else knows the count
    // is about to change.
    const out = normalizeFan({ direction: 'rit', count: 3, beams: 2, rampFrom: 0, rampTo: 5 }, own)
    expect(out.members).toHaveLength(2)
    expect('rampTo' in out).toBe(false)
  })

  it('a count of 1 cannot carry a range at all', () => {
    const out = normalizeFan({ direction: 'accel', count: 1, beams: 3, rampFrom: 0, rampTo: 4 }, own)
    expect('rampFrom' in out).toBe(false)
    expect(out.members).toHaveLength(0)
  })

  it('ABSENT is the only spelling of the ordinary beam gap either', () => {
    expect('spread' in normalizeFan({ direction: 'accel', count: 4, beams: 3, spread: 1 }, own)).toBe(false)
    expect(normalizeFan({ direction: 'accel', count: 4, beams: 3, spread: 2.5 }, own).spread).toBe(2.5)
  })

  it('stores the spread CLAMPED, so a typed 99 is not what a later reader sees', () => {
    expect(normalizeFan({ direction: 'accel', count: 4, beams: 3, spread: 99 }, own).spread).toBe(MAX_FAN_SPREAD)
    expect('spread' in normalizeFan({ direction: 'accel', count: 4, beams: 3, spread: 0.1 }, own)).toBe(false)
  })

  it('drops what a member is not allowed to carry — a tie belongs to the slot', () => {
    const tied: NotePitch = { ...pitch('C', 'own-1'), tiedTo: 'somewhere', tieDirection: 1 }
    const out = normalizeFan({ direction: 'accel', count: 3, beams: 3 }, [tied])
    expect(out.members!.every(m => m.pitches[0].tiedTo === undefined && m.pitches[0].tieDirection === undefined)).toBe(true)
  })
})

describe('fanSpread — the DRAWING\'s number, and only the drawing\'s', () => {
  it('absent is 1: the ordinary beam gap, and the floor', () => {
    expect(fanSpread(fan())).toBe(1)
    expect(fanSpread(fan({ spread: 2 }))).toBe(2)
  })

  it('clamps rather than trusts — `fromJSON` and the undo restore never pass normalizeFan', () => {
    expect(fanSpread(fan({ spread: 0 }))).toBe(1)      // every line stacked on the primary
    expect(fanSpread(fan({ spread: -3 }))).toBe(1)     // the wedge drawn inside out
    expect(fanSpread(fan({ spread: 1e6 }))).toBe(MAX_FAN_SPREAD)
    expect(fanSpread(fan({ spread: NaN }))).toBe(1)
  })

  it('rounds float noise away, because the width cache key is the slot STRINGIFIED', () => {
    expect(clampFanSpread(1.7000000000000002)).toBe(1.7)
  })

  it('⭐ the SOUND does not move — spread is not in the weights or the members', () => {
    // The exception this feature is: what a reader counts is LINES, and spreading them does not
    // change how many there are. Every other fan control is read by `fanWeights`; this one is not.
    // (It used to say "or the columns" too, and checked `fanColumns` — that helper was deleted with
    // the spacing model's P5, which gives every member a real column of its own instead.)
    const plain = fan({ count: 6, beams: 3 })
    const wide = fan({ count: 6, beams: 3, spread: 3 })
    expect(fanWeights(wide).map(fracToNumber)).toEqual(fanWeights(plain).map(fracToNumber))
    expect(fanMembers(wide, frac(2, 1)).map(m => fracToNumber(m.quarters)))
      .toEqual(fanMembers(plain, frac(2, 1)).map(m => fracToNumber(m.quarters)))
  })
})

describe('cloneFanFresh — the copy that mints its own ids', () => {
  it('same pitches, no shared id, and the arrays are its own', () => {
    const src: FanMark = {
      direction: 'accel', count: 3, beams: 3,
      members: [{ pitches: [{ id: 'a', step: 'C', alter: 0, octave: 4 }] }, { pitches: [{ id: 'b', step: 'E', alter: 1, octave: 4 }] }],
    }
    const copy = cloneFanFresh(src)
    expect(copy.members!.map(m => `${m.pitches[0].step}${m.pitches[0].alter}${m.pitches[0].octave}`)).toEqual(['C04', 'E14'])
    expect(copy.members!.flatMap(m => m.pitches).map(p => p.id)).not.toContain('a')
    expect(copy.members![0]).not.toBe(src.members![0])
  })

  it('a mark with no members is copied, not repaired', () => {
    expect(cloneFanFresh({ direction: 'rit', count: 4, beams: 2 })).toEqual({ direction: 'rit', count: 4, beams: 2 })
  })
})
