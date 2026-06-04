import { describe, it, expect } from 'vitest'
import {
  DURATION_INFO,
  DURATIONS_DESC,
  durationToBeats,
  durationToFraction,
  durationToVexflow,
  tupletNoteDurationFraction,
  beatsToDuration,
  splitBeatsIntoDurations,
  getDotMultiplier,
} from './durations'
import { getMeasureDurationFrac } from './musicUtils'
import { fracCreate, fracAdd, fracEq, fracToNumber } from './fraction'
import type { NoteDuration } from '@/types/music'

function frac(num: number, den: number) {
  return fracCreate(num, den)
}

const ALL_DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32']

// ---------------------------------------------------------------------------
// Table integrity — the whole point of centralization
// ---------------------------------------------------------------------------

describe('DURATION_INFO table', () => {
  it('covers exactly the NoteDuration union', () => {
    expect(Object.keys(DURATION_INFO).sort()).toEqual([...ALL_DURATIONS].sort())
  })

  it('float beats agree with the exact fraction for every duration', () => {
    for (const d of ALL_DURATIONS) {
      expect(fracToNumber(DURATION_INFO[d].fraction)).toBe(DURATION_INFO[d].beats)
    }
  })

  it('each entry is exactly half the next-larger entry (1:2 binary system)', () => {
    for (let i = 1; i < DURATIONS_DESC.length; i++) {
      const bigger = DURATION_INFO[DURATIONS_DESC[i - 1]].beats
      const smaller = DURATION_INFO[DURATIONS_DESC[i]].beats
      expect(smaller).toBe(bigger / 2)
    }
  })
})

describe('DURATIONS_DESC', () => {
  it('is ordered largest → smallest', () => {
    expect(DURATIONS_DESC).toEqual(['w', 'h', 'q', '8', '16', '32'])
  })
})

// ---------------------------------------------------------------------------
// Forward conversions
// ---------------------------------------------------------------------------

describe('durationToBeats', () => {
  it('maps base durations to quarter-note beats', () => {
    expect(durationToBeats('w')).toBe(4)
    expect(durationToBeats('h')).toBe(2)
    expect(durationToBeats('q')).toBe(1)
    expect(durationToBeats('8')).toBe(0.5)
    expect(durationToBeats('16')).toBe(0.25)
    expect(durationToBeats('32')).toBe(0.125)
  })

  it('applies dots', () => {
    expect(durationToBeats('q', 1)).toBe(1.5)
    expect(durationToBeats('q', 2)).toBe(1.75)
    expect(durationToBeats('h', 1)).toBe(3)
  })
})

describe('getDotMultiplier', () => {
  it('matches the standard dot ratios', () => {
    expect(getDotMultiplier(0)).toBe(1)
    expect(getDotMultiplier(1)).toBe(1.5)
    expect(getDotMultiplier(2)).toBe(1.75)
    expect(getDotMultiplier(3)).toBe(1.875)
  })
})

describe('durationToVexflow', () => {
  it('returns the base token', () => {
    expect(durationToVexflow('q')).toBe('q')
    expect(durationToVexflow('16')).toBe('16')
  })

  it('appends one "d" per dot', () => {
    expect(durationToVexflow('q', 1)).toBe('qd')
    expect(durationToVexflow('q', 2)).toBe('qdd')
    expect(durationToVexflow('8', 1)).toBe('8d')
  })
})

// ---------------------------------------------------------------------------
// durationToFraction (relocated from fraction.test.ts)
// ---------------------------------------------------------------------------

describe('durationToFraction', () => {
  it('whole note = 4 beats', () => {
    expect(durationToFraction('w')).toEqual(frac(4, 1))
  })

  it('half note = 2 beats', () => {
    expect(durationToFraction('h')).toEqual(frac(2, 1))
  })

  it('quarter note = 1 beat', () => {
    expect(durationToFraction('q')).toEqual(frac(1, 1))
  })

  it('eighth note = 1/2 beat', () => {
    expect(durationToFraction('8')).toEqual(frac(1, 2))
  })

  it('sixteenth note = 1/4 beat', () => {
    expect(durationToFraction('16')).toEqual(frac(1, 4))
  })

  it('thirty-second note = 1/8 beat', () => {
    expect(durationToFraction('32')).toEqual(frac(1, 8))
  })

  it('dotted quarter = 3/2 beats', () => {
    expect(durationToFraction('q', 1)).toEqual(frac(3, 2))
  })

  it('dotted half = 3 beats', () => {
    expect(durationToFraction('h', 1)).toEqual(frac(3, 1))
  })

  it('dotted eighth = 3/4 beats', () => {
    expect(durationToFraction('8', 1)).toEqual(frac(3, 4))
  })

  it('double-dotted quarter = 7/4 beats', () => {
    expect(durationToFraction('q', 2)).toEqual(frac(7, 4))
  })

  it('double-dotted half = 7/2 beats', () => {
    expect(durationToFraction('h', 2)).toEqual(frac(7, 2))
  })
})

// ---------------------------------------------------------------------------
// tupletNoteDurationFraction (relocated from fraction.test.ts)
// ---------------------------------------------------------------------------

describe('tupletNoteDurationFraction', () => {
  it('triplet quarter: 1 × 2/3 = 2/3', () => {
    expect(tupletNoteDurationFraction('q', 0, 3, 2)).toEqual(frac(2, 3))
  })

  it('triplet eighth: 1/2 × 2/3 = 1/3', () => {
    expect(tupletNoteDurationFraction('8', 0, 3, 2)).toEqual(frac(1, 3))
  })

  it('quintuplet eighth: 1/2 × 4/5 = 2/5', () => {
    expect(tupletNoteDurationFraction('8', 0, 5, 4)).toEqual(frac(2, 5))
  })

  it('septuplet eighth: 1/2 × 4/7 = 2/7', () => {
    expect(tupletNoteDurationFraction('8', 0, 7, 4)).toEqual(frac(2, 7))
  })

  it('11-tuplet eighth (11:8): 1/2 × 8/11 = 4/11', () => {
    expect(tupletNoteDurationFraction('8', 0, 11, 8)).toEqual(frac(4, 11))
  })

  it('13-tuplet eighth (13:8): 1/2 × 8/13 = 4/13', () => {
    expect(tupletNoteDurationFraction('8', 0, 13, 8)).toEqual(frac(4, 13))
  })

  it('three triplet quarters sum exactly to 2 beats', () => {
    const d = tupletNoteDurationFraction('q', 0, 3, 2)
    const sum = fracAdd(fracAdd(d, d), d)
    expect(sum).toEqual(frac(2, 1))
  })

  it('five quintuplet quarters sum exactly to 4 beats', () => {
    const d = tupletNoteDurationFraction('q', 0, 5, 4)
    let acc = frac(0, 1)
    for (let i = 0; i < 5; i++) acc = fracAdd(acc, d)
    expect(acc).toEqual(frac(4, 1))
  })

  it('eleven 11-tuplet eighths sum exactly to 4 beats', () => {
    const d = tupletNoteDurationFraction('8', 0, 11, 8)
    let acc = frac(0, 1)
    for (let i = 0; i < 11; i++) acc = fracAdd(acc, d)
    expect(acc).toEqual(frac(4, 1))
  })
})

// ---------------------------------------------------------------------------
// Inverse helpers
// ---------------------------------------------------------------------------

describe('beatsToDuration', () => {
  it('recovers base durations', () => {
    expect(beatsToDuration(4)).toBe('w')
    expect(beatsToDuration(1)).toBe('q')
    expect(beatsToDuration(0.125)).toBe('32')
  })

  it('returns null for values that are not a single base duration', () => {
    expect(beatsToDuration(1.5)).toBeNull()
    expect(beatsToDuration(3)).toBeNull()
    expect(beatsToDuration(0)).toBeNull()
  })
})

describe('splitBeatsIntoDurations', () => {
  it('greedily decomposes largest-first', () => {
    expect(splitBeatsIntoDurations(4)).toEqual(['w'])
    expect(splitBeatsIntoDurations(3)).toEqual(['h', 'q'])
    expect(splitBeatsIntoDurations(1.5)).toEqual(['q', '8'])
    expect(splitBeatsIntoDurations(0.75)).toEqual(['8', '16'])
  })

  it('returns nothing for zero', () => {
    expect(splitBeatsIntoDurations(0)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getMeasureDurationFrac — exact bar length across the generality matrix
// (lives in musicUtils, validated here alongside the duration table)
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
