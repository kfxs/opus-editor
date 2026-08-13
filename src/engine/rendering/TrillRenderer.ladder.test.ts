import { describe, it, expect } from 'vitest'
import type { Measure } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import type { TrillSpan } from '@/engine/models/trillOps'
import { measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { TRILL_MARK_INK } from './trillStyle'
import { trillFragmentClaim } from './TrillRenderer'

/**
 * THE TRILL'S LADDER CLAIM — what it tells the families placed OUTSIDE it (docs/ottava-plan.md P0a).
 *
 * ⭐ The trill is the innermost outside-staff family, so it never READS the collection — which is
 * exactly why this needs a test of its own: nothing it draws changes when the claim is wrong, so the
 * defect would be invisible until an 8va bracket drew straight through a `tr`.
 *
 * ⚠️ Beats only. The band's numbers come from a baseline the caller measured in a browser; what is
 * asserted here is the arithmetic — which bars, which beats, and on which system.
 */

const bar = (number: number, over: Partial<Measure> = {}): Measure =>
  ({
    id: `m${number}`, number, slots: [],
    timeSignature: { numerator: 4, denominator: 4 }, tuplets: [],
    ...over,
  } as unknown as Measure)

/** A bar whose lane holds slot onsets at the given beats — what `beatAfter` walks. */
const barWithOnsets = (number: number, ...beats: number[]): Measure =>
  bar(number, {
    slots: beats.map((b, i) => ({
      id: `${number}-${i}`, type: 'rest', beat: frac(b, 1), duration: 'q',
    })),
  } as unknown as Partial<Measure>)

const placement = (view: Measure) => ({ view, measureNumber: view.number })

const span = (over: Partial<TrillSpan> = {}): TrillSpan =>
  ({
    startMeasure: 1, startBeat: frac(0, 1),
    endMeasure: 1, endBeat: frac(0, 1),
    slotIds: ['x'],
    ...over,
  } as TrillSpan)

const starts = (...measures: Measure[]) =>
  measureStartOffsets({ measures } as never)

describe('trillFragmentClaim', () => {
  it('claims from the trill’s START BEAT, not from the bar’s opening', () => {
    const m1 = barWithOnsets(1, 0, 1, 2, 3)
    const claim = trillFragmentClaim(
      [placement(m1)],
      span({ startBeat: frac(2, 1), endBeat: frac(2, 1) }),
      0, 0, undefined, 'above', -3, starts(m1))
    expect(claim!.from).toEqual(frac(2, 1))
  })

  it('⭐ ends at the onset of the slot AFTER the last trilled one — the trill runs to its edge', () => {
    const m1 = barWithOnsets(1, 0, 1, 2, 3)
    const claim = trillFragmentClaim(
      [placement(m1)],
      span({ startBeat: frac(1, 1), endBeat: frac(1, 1) }),
      0, 0, undefined, 'above', -3, starts(m1))
    expect(claim!.to).toEqual(frac(2, 1))
  })

  it('…and at the bar’s CAPACITY when the last trilled slot is the last one in the bar', () => {
    const m1 = barWithOnsets(1, 0, 1, 2, 3)
    const claim = trillFragmentClaim(
      [placement(m1)],
      span({ startBeat: frac(3, 1), endBeat: frac(3, 1) }),
      0, 0, undefined, 'above', -3, starts(m1))
    expect(claim!.to).toEqual(frac(4, 1))
  })

  it('⭐ puts a multi-bar fragment on the ABSOLUTE axis, so it can be compared with a dynamic’s', () => {
    const m1 = barWithOnsets(1, 0, 2)
    const m2 = barWithOnsets(2, 0, 2)
    const claim = trillFragmentClaim(
      [placement(m1), placement(m2)],
      span({ startMeasure: 1, startBeat: frac(2, 1), endMeasure: 2, endBeat: frac(0, 1) }),
      0, 0, undefined, 'above', -3, starts(m1, m2))
    // bar 2 opens at absolute 4; the trill's last slot is its beat 0, so the claim runs to the
    // NEXT onset there — beat 2, i.e. absolute 6.
    expect(claim!.from).toEqual(frac(2, 1))
    expect(claim!.to).toEqual(frac(6, 1))
  })

  it('⚠️ takes the bars in MEASURE order however the placements arrive', () => {
    const m1 = barWithOnsets(1, 0, 2)
    const m2 = barWithOnsets(2, 0, 2)
    const claim = trillFragmentClaim(
      [placement(m2), placement(m1)],
      span({ startMeasure: 1, startBeat: frac(0, 1), endMeasure: 2, endBeat: frac(0, 1) }),
      0, 0, undefined, 'above', -3, starts(m1, m2))
    expect(claim!.from).toEqual(frac(0, 1))
    expect(claim!.to).toEqual(frac(6, 1))
  })

  it('follows a METER CHANGE through the shared axis', () => {
    const m1 = bar(1, { timeSignature: { numerator: 3, denominator: 4 } } as Partial<Measure>)
    const m2 = barWithOnsets(2, 0, 1)
    const claim = trillFragmentClaim(
      [placement(m2)],
      span({ startMeasure: 2, startBeat: frac(0, 1), endMeasure: 2, endBeat: frac(0, 1) }),
      0, 0, undefined, 'above', -3, starts(m1, m2))
    expect(claim!.from).toEqual(frac(3, 1))
  })

  it('carries the SYSTEM, the STAFF and the SIDE it was handed', () => {
    const m1 = barWithOnsets(1, 0)
    const claim = trillFragmentClaim(
      [placement(m1)], span(), 0, 3, 'sB', 'below', -3, starts(m1))
    expect(claim).toMatchObject({ line: 3, staffId: 'sB', side: 'below' })
  })

  it('turns the baseline into a band with the trill’s OWN ink', () => {
    const m1 = barWithOnsets(1, 0)
    const claim = trillFragmentClaim(
      [placement(m1)], span(), 0, 0, undefined, 'above', -3, starts(m1))
    expect(claim!.band.top).toBeCloseTo(-3 - TRILL_MARK_INK.above, 6)
    expect(claim!.band.bottom).toBeCloseTo(-3 + TRILL_MARK_INK.below, 6)
  })

  it('is null when the fragment covers no bar', () => {
    expect(trillFragmentClaim([], span(), 0, 0, undefined, 'above', -3, new Map())).toBeNull()
  })

  it('is null when a covered bar is not on the shared axis at all', () => {
    const m9 = barWithOnsets(9, 0)
    expect(trillFragmentClaim([placement(m9)], span(), 0, 0, undefined, 'above', -3, new Map()))
      .toBeNull()
  })
})
