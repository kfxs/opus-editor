import { describe, it, expect } from 'vitest'
import type { Measure } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { OTTAVA_MARK_INK } from './ottavaStyle'
import { barSlice, bracketFragmentClaim, type BracketSpan } from './bracketSpanBand'

/**
 * What the ottava and the pedal SHARE on the ladder. Their own chapters
 * (`OttavaRenderer.ladder.test.ts`, `PedalRenderer.ladder.test.ts`) still drive the claim through
 * each family's door; pinned here is the slice both the baseline and the claim are cut from, and
 * that the rung's SIDE is the caller's. ⚠️ Beats and side only — a band's numbers need a browser.
 */
const bar = (number: number, beats = 4): Measure =>
  ({ number, slots: [], timeSignature: { numerator: beats, denominator: 4 } } as unknown as Measure)
const placement = (view: Measure) => ({ view, measureNumber: view.number })
const span = (over: Partial<BracketSpan> = {}): BracketSpan => ({
  startMeasure: 1, startBeat: frac(1, 1), endMeasure: 3, endBeat: frac(2, 1), ...over,
})
const starts = (...measures: Measure[]) => measureStartOffsets({ measures } as never)
const nums = (s: { from: { num: number; den: number }; to: { num: number; den: number } }) =>
  [fracToNumber(s.from), fracToNumber(s.to)]

describe('bracketSpanBand.barSlice', () => {
  it('the FIRST bar runs from the start beat to its end', () => {
    expect(nums(barSlice(placement(bar(1)), span()))).toEqual([1, 4])
  })
  it('a bar BETWEEN is covered whole — by its own capacity', () => {
    expect(nums(barSlice(placement(bar(2, 3)), span()))).toEqual([0, 3])
  })
  it('the LAST bar runs from its opening to the end beat', () => {
    expect(nums(barSlice(placement(bar(3)), span()))).toEqual([0, 2])
  })
  it('a one-bar span is cut at BOTH ends', () => {
    expect(nums(barSlice(placement(bar(1)), span({ endMeasure: 1, endBeat: frac(3, 1) })))).toEqual([1, 3])
  })
})

describe('bracketSpanBand.bracketFragmentClaim', () => {
  it('files the rung it was handed — line, staff and SIDE are the caller\'s', () => {
    const m1 = bar(1), m2 = bar(2), m3 = bar(3)
    const claim = bracketFragmentClaim(
      [placement(m3), placement(m1), placement(m2)], span(),
      { line: 2, staffId: 's2', side: 'above' }, 6, starts(m1, m2, m3), OTTAVA_MARK_INK)!
    expect(claim).toMatchObject({ line: 2, staffId: 's2', side: 'above' })
    expect(nums(claim)).toEqual([1, 10]) // sorted by bar: bar 1 beat 1 → 4 + 4 + beat 2
  })
  it('answers null for a fragment that covers no drawn bar, or a bar off the axis', () => {
    const rung = { line: 0, staffId: undefined, side: 'below' as const }
    expect(bracketFragmentClaim([], span(), rung, 6, starts(bar(1)), OTTAVA_MARK_INK)).toBeNull()
    expect(bracketFragmentClaim([placement(bar(9))], span(), rung, 6, starts(bar(1)), OTTAVA_MARK_INK)).toBeNull()
  })
})
