import { describe, it, expect } from 'vitest'
import { fracCreate } from '@/utils/fraction'
import {
  followingSpace,
  naturalWidth,
  spaceColumns,
  plainColumn,
  GOULD_SPACING,
  NO_EXTENT,
  type Column,
  type SpacingRule,
} from './spacing'

/**
 * The spacing rule (docs/spacing-model-plan.md P1). **Gould's own table is the spec.**
 *
 * This is the one half of the model that needs no browser: it is a function of a `Fraction`, so it
 * can be held to *Behind Bars* p. 39 in node. The other half — the ink — measures 0×0 headless
 * (docs/spacing-model-research.md §5.4), so everything below hands extents in as FIXTURES and the
 * real numbers get pinned in `e2e/`.
 */

/** One quarter, and the fractions Gould's table is written over. */
const q = (num: number, den: number) => fracCreate(num, den)

describe('followingSpace — Gould\'s table is the contract', () => {
  /**
   * *Behind Bars* p. 39, the whole table, in staff spaces — and beside each, what `3.5 × √t` gives.
   *
   * ⚠️ **Three of the eight are pinned at their measured ERROR, not asserted within a tolerance.**
   * Calling them "the ink floor showing through" would be a fiction: a floor only pushes a value UP,
   * so it cannot explain the 8th (where the curve is 10% WIDER than she is), and at ~1.43 spaces it
   * does not even reach the curve's 16th at 1.75 — it binds at the 32nd and shorter. The cause is in
   * her own numbers: her 16th→8th step is ×1.125 against her 8th→♩ step of ×1.556, so **no single
   * ratio fits both** and √2 splits the difference. A tolerance loose enough to swallow 12.5% is not
   * a test; a pinned number that says *this is where our curve leaves Gould* is.
   */
  const GOULD: { name: string; quarters: [number, number]; gould: number; ours: number }[] = [
    { name: '16th',           quarters: [1, 4],  gould: 2,    ours: 1.75 },
    { name: '8th',            quarters: [1, 2],  gould: 2.25, ours: 2.475 },
    { name: 'dotted 8th',     quarters: [3, 4],  gould: 3,    ours: 3.031 },
    { name: 'quarter',        quarters: [1, 1],  gould: 3.5,  ours: 3.5 },
    { name: 'dotted quarter', quarters: [3, 2],  gould: 4,    ours: 4.287 },
    { name: 'half',           quarters: [2, 1],  gould: 5,    ours: 4.95 },
    { name: 'dotted half',    quarters: [3, 1],  gould: 6,    ours: 6.062 },
    { name: 'whole',          quarters: [4, 1],  gould: 7,    ours: 7 },
  ]

  for (const { name, quarters, ours } of GOULD) {
    it(`a ${name} earns ${ours} staff spaces`, () => {
      expect(followingSpace(q(quarters[0], quarters[1]))).toBeCloseTo(ours, 2)
    })
  }

  it('agrees with Gould on FIVE of the eight', () => {
    // ⚠️ "Within 1%" as both docs put it is the ROUNDED reading: the worst of the five is 1.04%
    // (the dotted half at +1.036%, the dotted 8th at +1.037%, the half at −1.005%). Two are exact.
    // Pinned at the real number, because a spec that rounds is a spec that can drift.
    const agrees = GOULD.filter(row => Math.abs(followingSpace(q(...row.quarters)) / row.gould - 1) <= 0.0105)
    expect(agrees.map(row => row.name)).toEqual([
      'dotted 8th', 'quarter', 'half', 'dotted half', 'whole',
    ])
  })

  it('and misses the other three by exactly this much — the fit, stated', () => {
    const error = (name: string) => {
      const row = GOULD.find(entry => entry.name === name)!
      return Math.round((followingSpace(q(row.quarters[0], row.quarters[1])) / row.gould - 1) * 1000) / 10
    }
    expect(error('16th'), 'tight at the short end, where the INK will lift it').toBe(-12.5)
    expect(error('8th'), 'generous — and no floor can push a value DOWN, so this is the curve').toBe(10)
    expect(error('dotted quarter'), 'generous').toBe(7.2)
  })

  it('is anchored on the QUARTER: 3.5 spaces, and the argument is already in quarters', () => {
    // ⚠️ The trap this pins: an earlier draft read `(quarters / ¼) ** …`, which is 4t — a quarter
    //    would have earned 3.5 × √4 = 7 spaces and every number above would be doubled.
    expect(followingSpace(q(1, 1))).toBe(GOULD_SPACING.quarterSpace)
    expect(followingSpace(q(4, 1))).toBeCloseTo(2 * GOULD_SPACING.quarterSpace, 9)
  })
})

describe('followingSpace — the invariants that make it a spacing rule at all', () => {
  it('is monotonic: a longer note never earns less room', () => {
    const ladder = [q(1, 8), q(1, 4), q(1, 2), q(3, 4), q(1, 1), q(3, 2), q(2, 1), q(4, 1)]
    const spaces = ladder.map(f => followingSpace(f))
    for (const [i, space] of spaces.slice(1).entries()) expect(space).toBeGreaterThan(spaces[i])
  })

  it('is COMPRESSED: doubling the duration does not double the space', () => {
    for (const [num, den] of [[1, 4], [1, 2], [1, 1], [2, 1]]) {
      const single = followingSpace(q(num, den))
      const double = followingSpace(q(num * 2, den))
      expect(double).toBeLessThan(2 * single)
      expect(double / single, 'by exactly the rule\'s ratio').toBeCloseTo(Math.SQRT2, 6)
    }
  })

  it('⭐ is METER-INDEPENDENT — the defect that started this', () => {
    // VexFlow's softmax exponent is the event's FRACTION OF THE BAR, so it spaces a quarter at 1.33×
    // an eighth in 4/4 and 1.78× in 2/4 (research §5.2). No engraver's rule has that shape. Ours
    // cannot: nothing about a bar is an argument.
    const ratio = followingSpace(q(1, 1)) / followingSpace(q(1, 2))
    expect(ratio).toBeCloseTo(Math.SQRT2, 6)

    // Said end to end: the same rhythm gets the same gaps whatever bar it sits in.
    const twoFour = spaceColumns([plainColumn(q(0, 1), q(1, 1)), plainColumn(q(1, 1), q(1, 1)), plainColumn(q(2, 1), q(0, 1))], 7)
    const fourFour = spaceColumns(
      [plainColumn(q(0, 1), q(1, 1)), plainColumn(q(1, 1), q(1, 1)), plainColumn(q(2, 1), q(1, 1)), plainColumn(q(3, 1), q(1, 1)), plainColumn(q(4, 1), q(0, 1))],
      14,
    )
    expect(fourFour.slice(0, 3)).toEqual(twoFour)
  })

  it('a zero or negative span earns nothing rather than NaN or Infinity', () => {
    expect(followingSpace(q(0, 1))).toBe(0)
    expect(followingSpace(q(-1, 4))).toBe(0)
  })

  it('takes the RATIO as a field, so the whole score\'s curve is one number', () => {
    const linear: SpacingRule = { quarterSpace: 3.5, ratio: 2 }
    expect(followingSpace(q(1, 1), linear)).toBe(3.5)
    expect(followingSpace(q(1, 2), linear), 'half the duration, half the space').toBeCloseTo(1.75, 6)
    expect(followingSpace(q(1, 2)), '…against √2 for the default').toBeCloseTo(2.475, 3)
  })
})

describe('naturalWidth — what a bar ASKS for', () => {
  /** `♩ ♩ ♩ ♩ |` — four quarters and a barline column, no ink anywhere. */
  const fourQuarters = (): Column[] => [
    plainColumn(q(0, 1), q(1, 1)),
    plainColumn(q(1, 1), q(1, 1)),
    plainColumn(q(2, 1), q(1, 1)),
    plainColumn(q(3, 1), q(1, 1)),
    plainColumn(q(4, 1), q(0, 1)),
  ]

  it('sums the rule over the gaps: four quarters ask for 4 × 3.5', () => {
    expect(naturalWidth(fourQuarters())).toBeCloseTo(14, 6)
  })

  it('⭐ sixteen 16ths ask for TWICE four quarters, not four times', () => {
    const sixteenths = Array.from({ length: 17 }, (_, i) =>
      plainColumn(q(i, 4), i === 16 ? q(0, 1) : q(1, 4)))
    expect(naturalWidth(sixteenths)).toBeCloseTo(28, 6)
    expect(naturalWidth(sixteenths) / naturalWidth(fourQuarters())).toBeCloseTo(2, 6)
  })

  it('takes the INK where the ink is wider — the max, not a sum', () => {
    const columns = fourQuarters()
    // A very wide accidental in front of the third note: 5 spaces of ink where the rule wants 3.5.
    columns[2].extent = { left: 5, right: 0 }
    expect(naturalWidth(columns), 'the wider of the two wins, and only in that one gap')
      .toBeCloseTo(14 - 3.5 + 5, 6)
  })

  it('…and ignores the ink where the rule is wider, rather than adding it', () => {
    const columns = fourQuarters()
    columns[2].extent = { left: 1.2, right: 0 }
    expect(naturalWidth(columns)).toBeCloseTo(14, 6)
  })

  it('adds authored space on TOP of whichever won', () => {
    const columns = fourQuarters()
    columns[2].authored = 2
    expect(naturalWidth(columns)).toBeCloseTo(16, 6)
  })

  it('counts a pair\'s padding as part of the gap\'s floor', () => {
    const columns = fourQuarters()
    columns[0].extent = { left: 0, right: 2 }
    columns[1].extent = { left: 2, right: 0 }
    columns[0].padding = 1
    expect(naturalWidth(columns), '2 + 1 + 2 beats the rule\'s 3.5').toBeCloseTo(14 - 3.5 + 5, 6)
  })
})

describe('spaceColumns — the spring solve', () => {
  const barOf = (durations: [number, number][]): Column[] => {
    const columns: Column[] = []
    let beat = fracCreate(0, 1)
    for (const [num, den] of durations) {
      columns.push(plainColumn(beat, fracCreate(num, den)))
      beat = fracCreate(beat.num * den + num * beat.den, beat.den * den)
    }
    columns.push(plainColumn(beat, fracCreate(0, 1)))
    return columns
  }

  it('places the first column at 0 and the last at the target', () => {
    const xs = spaceColumns(barOf([[1, 1], [1, 1], [1, 1], [1, 1]]), 40)
    expect(xs).toHaveLength(5)
    expect(xs[0]).toBe(0)
    expect(xs[4]).toBeCloseTo(40, 6)
  })

  it('at its natural width, changes nothing', () => {
    const columns = barOf([[1, 1], [1, 2], [1, 2], [1, 1], [1, 1]])
    const xs = spaceColumns(columns, naturalWidth(columns))
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    expect(gaps[0]).toBeCloseTo(3.5, 6)
    expect(gaps[1]).toBeCloseTo(2.475, 3)
    expect(gaps[2]).toBeCloseTo(2.475, 3)
  })

  it('⭐ shares a surplus IN PROPORTION to natural length — the long note takes more of it', () => {
    // `♪ 𝅗𝅥 |` — natural 2.475 + 4.95 = 7.425. Stretch to double.
    const columns = barOf([[1, 2], [2, 1]])
    const xs = spaceColumns(columns, 14.85)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    expect(gaps[0] / gaps[1], 'the ratio between them is untouched').toBeCloseTo(2.475 / 4.95, 6)
    expect(gaps[0]).toBeCloseTo(4.95, 3)
  })

  it('⭐ a gap on its INK MINIMUM does not move, and the rest absorb the difference', () => {
    // Three quarters. The middle gap is held open by 6 spaces of ink — wider than the rule's 3.5 —
    // so squeezing the bar must come out of the other two and never out of that one.
    const columns = barOf([[1, 1], [1, 1], [1, 1]])
    columns[1].extent = { left: 0, right: 6 }
    const natural = naturalWidth(columns)
    expect(natural).toBeCloseTo(3.5 + 6 + 3.5, 6)

    const xs = spaceColumns(columns, natural - 4)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    expect(gaps[1], 'the rigid gap held').toBeCloseTo(6, 6)
    expect(gaps[0], 'the elastic ones paid, equally — they are equal springs').toBeCloseTo(1.5, 6)
    expect(gaps[2]).toBeCloseTo(1.5, 6)
  })

  it('freezes ITERATIVELY: paying for one floor can push a second gap onto its own', () => {
    // Springs 3.5 / 3.5 / 2.475, floors 0 / 3.4 / 2.4. Squeeze hard enough and the second gap hits
    // its floor first; the force that leaves for the rest then drives the third onto its floor too.
    const columns = barOf([[1, 1], [1, 1], [1, 2]])
    columns[1].extent = { left: 0, right: 3.4 }
    columns[2].extent = { left: 0, right: 2.4 }
    const xs = spaceColumns(columns, 7)
    const gaps = xs.slice(1).map((x, i) => x - xs[i])

    expect(gaps[1], 'held at its floor').toBeCloseTo(3.4, 6)
    expect(gaps[2], 'and so is this one, which a single pass would have compressed through')
      .toBeCloseTo(2.4, 6)
    expect(gaps[0], 'the only elastic gap left took the whole squeeze').toBeCloseTo(1.2, 6)
  })

  it('⚠️ never violates a floor: an impossible target comes back OVERFULL, not collided', () => {
    const columns = barOf([[1, 1], [1, 1]])
    columns[0].extent = { left: 0, right: 4 }
    columns[1].extent = { left: 0, right: 4 }
    const xs = spaceColumns(columns, 2)

    expect(xs[2], 'the ink is 8 spaces and 8 spaces is what it got').toBeCloseTo(8, 6)
    expect(xs[2]).toBeGreaterThan(2)
  })

  it('⭐ authored space is RESERVED — never squeezed, and never stretched either', () => {
    const squeezed = (target: number): number[] => {
      const columns = barOf([[1, 1], [1, 1]])
      columns[1].authored = 3
      const xs = spaceColumns(columns, target)
      return xs.slice(1).map((x, i) => x - xs[i])
    }

    // Natural is 3.5 + 3 (authored) + 3.5 = 10.
    expect(squeezed(10)[0], 'the dragged gap is the rule plus what was dragged').toBeCloseTo(6.5, 6)

    // Halve the bar: the two springs give, the 3 does not.
    const tight = squeezed(6.5)
    expect(tight[0] - 3, 'the spring under the authored space paid its share').toBeCloseTo(1.75, 6)
    expect(tight[1]).toBeCloseTo(1.75, 6)

    // Double it: the springs take the whole surplus, so the authored gap does NOT grow by its share.
    const loose = squeezed(20)
    expect(loose[0] - 3).toBeCloseTo(8.5, 6)
    expect(loose[1]).toBeCloseTo(8.5, 6)
  })

  it('handles the degenerate bars without a special case anywhere', () => {
    expect(spaceColumns([], 10)).toEqual([])
    expect(spaceColumns([plainColumn(q(0, 1), q(0, 1))], 10)).toEqual([0])
  })

  it('a BARLINE is just the last column, with its own extent and padding', () => {
    // `♩ ♩ |` where the barline wants 1.5 spaces of clearance after the last note.
    const columns = barOf([[1, 1], [1, 1]])
    columns[1].padding = 1.5
    columns[2].extent = NO_EXTENT
    const natural = naturalWidth(columns)
    expect(natural, 'the rule still wins that gap — 3.5 beats 1.5').toBeCloseTo(7, 6)

    columns[1].padding = 5
    expect(naturalWidth(columns), '…and the clearance wins when it is the wider').toBeCloseTo(8.5, 6)
  })
})
