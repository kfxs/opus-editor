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
  fitRestDuration,
  splitBeatsIntoLengths,
  durationFlags,
  writtenLength,
  slotLength,
} from './durations'
import { fracCreate, fracAdd, fracToNumber } from './fraction'
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

describe('durationFlags', () => {
  it('counts flags/beams: nothing at a quarter or longer, then one per halving', () => {
    expect(DURATIONS_DESC.map(durationFlags)).toEqual([0, 0, 0, 1, 2, 3])
  })

  it('is exact — derived from the table, so no rounding to guard', () => {
    for (const d of DURATIONS_DESC) expect(Number.isInteger(durationFlags(d))).toBe(true)
  })

  it('ignores dots by construction: it takes a duration, not a slot', () => {
    // A dotted eighth is still ONE flag. There is no dots parameter to get wrong.
    expect(durationFlags('8')).toBe(1)
  })

  it('is the sum a tremolo adds to: 3 strokes on a quarter = 2 on an eighth = 1 on a 16th', () => {
    // The standard reading — all three are 32nds (docs/tremolo-plan.md §5).
    expect(durationFlags('q') + 3).toBe(3)
    expect(durationFlags('8') + 2).toBe(3)
    expect(durationFlags('16') + 1).toBe(3)
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
// writtenLength / slotLength — the object-taking rules the model reads everywhere
// ---------------------------------------------------------------------------

describe('writtenLength', () => {
  it('is durationToFraction over an object', () => {
    expect(writtenLength({ duration: 'q', dots: 1 })).toEqual(frac(3, 2))
  })

  it('treats absent dots as none', () => {
    expect(writtenLength({ duration: 'h' })).toEqual(frac(2, 1))
    expect(writtenLength({ duration: 'h' })).toEqual(writtenLength({ duration: 'h', dots: 0 }))
  })

  it('answers what is WRITTEN — a triplet quarter is still one beat', () => {
    // Its actualDuration (2/3) is slotLength's business; writtenLength does not take one.
    expect(writtenLength({ duration: 'q', dots: 0 })).toEqual(frac(1, 1))
  })
})

describe('slotLength', () => {
  it('prefers actualDuration when the slot carries one', () => {
    // A triplet quarter: written 1 beat, sounding 2/3.
    expect(slotLength({ duration: 'q', dots: 0, actualDuration: frac(2, 3) })).toEqual(frac(2, 3))
  })

  it('falls back to the written length when it does not', () => {
    expect(slotLength({ duration: '8', dots: 1 })).toEqual(frac(3, 4))
  })

  it('a measure rest sounds its bar, not its nominal whole', () => {
    // 3/4: stored duration 'w', actualDuration 3 beats.
    expect(slotLength({ duration: 'w', actualDuration: frac(3, 1) })).toEqual(frac(3, 1))
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

/**
 * The barline cap for a placed rest: a rest cannot split and tie across a barline the way an
 * overflowing note does, so when the armed length does not fit, the longest one that DOES is placed.
 */
describe('fitRestDuration', () => {
  const q = (num: number, den = 1) => fracCreate(num, den)

  it('keeps the armed length when it fits', () => {
    expect(fitRestDuration('h', 0, q(4))).toEqual({ duration: 'h', dots: 0 })
  })

  it('keeps the DOTS when it fits — a dotted rest is ordinary, not exotic', () => {
    expect(fitRestDuration('q', 1, q(4))).toEqual({ duration: 'q', dots: 1 })
  })

  it('keeps a length that fits EXACTLY', () => {
    expect(fitRestDuration('h', 0, q(2))).toEqual({ duration: 'h', dots: 0 })
    expect(fitRestDuration('q', 1, q(3, 2))).toEqual({ duration: 'q', dots: 1 })
  })

  it('caps to the longest rest that fits — SINGLE DOT INCLUDED', () => {
    // Three beats left is a DOTTED HALF, not a half + a quarter: the rule is "the longest value
    // available, including one dot". (Whatever a single value cannot cover closes up via the
    // meter-aware fill; this only answers "what one rest goes here".)
    expect(fitRestDuration('w', 0, q(3))).toEqual({ duration: 'h', dots: 1 })
    expect(fitRestDuration('w', 0, q(2))).toEqual({ duration: 'h', dots: 0 })
    expect(fitRestDuration('w', 0, q(1))).toEqual({ duration: 'q', dots: 0 })
    expect(fitRestDuration('w', 0, q(3, 2))).toEqual({ duration: 'q', dots: 1 })
  })

  it('caps to a dotted value even when the armed one was dotted', () => {
    // A dotted whole (6 beats) with 3 left → a dotted half. The dot is not "a second guess" to be
    // dropped: it is part of the longest value that fits.
    expect(fitRestDuration('w', 1, q(3))).toEqual({ duration: 'h', dots: 1 })
  })

  it('caps to a fraction of a beat', () => {
    expect(fitRestDuration('w', 0, q(1, 2))).toEqual({ duration: '8', dots: 0 })
    expect(fitRestDuration('w', 0, q(1, 4))).toEqual({ duration: '16', dots: 0 })
    expect(fitRestDuration('w', 0, q(3, 4))).toEqual({ duration: '8', dots: 1 })
  })

  it('is general over meter — it knows only lengths, so odd bars need no cases', () => {
    // 7/8 with 5 eighths left = 2.5 quarters → a half is the longest that fits (a dotted half is 3).
    expect(fitRestDuration('w', 0, q(5, 2))).toEqual({ duration: 'h', dots: 0 })
    // 3/2: six beats left → a dotted whole fits exactly.
    expect(fitRestDuration('w', 1, q(6))).toEqual({ duration: 'w', dots: 1 })
  })

  it('returns null when nothing fits at all', () => {
    expect(fitRestDuration('q', 0, q(0))).toBeNull()
    expect(fitRestDuration('q', 0, q(1, 64))).toBeNull() // shorter than the shortest rest
  })
})

/**
 * The NOTE split: the fewest values that span it, dots included. Its sibling
 * `splitBeatsIntoDurations` stays undotted — that one fills RESTS, where the meter decides whether a
 * dot is allowed at all.
 */
describe('splitBeatsIntoLengths', () => {
  const show = (beats: number) =>
    splitBeatsIntoLengths(beats).map(l => `${l.duration}${'.'.repeat(l.dots)}`)

  it('spans 3 beats with ONE dotted half (reported: it gave h + q)', () => {
    expect(show(3)).toEqual(['h.'])
  })

  it('uses a single value wherever one exists', () => {
    expect(show(4)).toEqual(['w'])
    expect(show(2)).toEqual(['h'])
    expect(show(1.5)).toEqual(['q.'])
    expect(show(0.75)).toEqual(['8.'])
    expect(show(6)).toEqual(['w.'])
  })

  it('falls to the next value down when no single one spans it', () => {
    expect(show(5)).toEqual(['w', 'q'])       // 4 + 1
    expect(show(7)).toEqual(['w.', 'q'])      // 6 + 1
    expect(show(2.5)).toEqual(['h', '8'])     // 2 + 0.5
  })

  it('sums to the span it was given', () => {
    for (const beats of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7]) {
      const total = splitBeatsIntoLengths(beats)
        .reduce((acc, l) => acc + durationToBeats(l.duration, l.dots), 0)
      expect(total).toBeCloseTo(beats)
    }
  })

  it('is general over meter — it knows only lengths', () => {
    // 7/8 leftovers, 3/2 spans: no time signature needs a case of its own.
    expect(show(3.5)).toEqual(['h.', '8'])
    expect(show(0.25)).toEqual(['16'])
  })
})

/** Its undotted sibling, which fills RESTS and must NOT invent a dot — the meter owns that. */
describe('splitBeatsIntoDurations stays undotted (rests)', () => {
  it('gives h + q for 3 beats, NOT a dotted half', () => {
    // 4/4 never auto-makes a dotted rest, so a length-only rule must not produce one here.
    expect(splitBeatsIntoDurations(3)).toEqual(['h', 'q'])
  })

  it('still sums to the span', () => {
    expect(splitBeatsIntoDurations(3.5)).toEqual(['h', 'q', '8'])
  })
})
