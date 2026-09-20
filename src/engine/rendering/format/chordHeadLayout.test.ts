import { describe, it, expect } from 'vitest'
import { chordHeadDisplacement, displacedHeadShiftPx } from './chordHeadLayout'

const UP = 1
const DOWN = -1

describe('chordHeadDisplacement', () => {
  it('leaves a single head in the column', () => {
    expect(chordHeadDisplacement([3], UP)).toEqual([false])
  })

  it('leaves a third alone — both heads fit the one column', () => {
    expect(chordHeadDisplacement([1, 2], UP)).toEqual([false, false])
    expect(chordHeadDisplacement([1, 2], DOWN)).toEqual([false, false])
  })

  it('crosses the UPPER note of a second when the stem is up', () => {
    expect(chordHeadDisplacement([1, 1.5], UP)).toEqual([false, true])
  })

  it('crosses the LOWER note of a second when the stem is down', () => {
    expect(chordHeadDisplacement([1, 1.5], DOWN)).toEqual([true, false])
  })

  it('answers in the CALLER’s order, not sorted order', () => {
    // The same second, handed over highest-first: the flag has to travel with the pitch.
    expect(chordHeadDisplacement([1.5, 1], UP)).toEqual([true, false])
  })

  it('alternates across a cluster, so the outer notes stay in the column', () => {
    expect(chordHeadDisplacement([1, 1.5, 2], UP)).toEqual([false, true, false])
    expect(chordHeadDisplacement([1, 1.5, 2], DOWN)).toEqual([false, true, false])
    expect(chordHeadDisplacement([1, 1.5, 2, 2.5], UP)).toEqual([false, true, false, true])
  })

  it('restarts the alternation after a gap wider than a second', () => {
    // Two separate seconds inside one chord: the third between them ends the first cluster.
    expect(chordHeadDisplacement([1, 1.5, 3, 3.5], UP)).toEqual([false, true, false, true])
  })

  it('treats a unison like a second — two heads cannot share one place either', () => {
    expect(chordHeadDisplacement([2, 2], UP)).toEqual([false, true])
  })
})

describe('displacedHeadShiftPx', () => {
  it('is a glyph wide, less half the stem the two heads share', () => {
    // VexFlow's own formula — the heads meet ON the stem rather than leaving it outside both.
    expect(displacedHeadShiftPx(12)).toBeLessThan(12)
    expect(displacedHeadShiftPx(12)).toBeGreaterThan(10)
  })
})
