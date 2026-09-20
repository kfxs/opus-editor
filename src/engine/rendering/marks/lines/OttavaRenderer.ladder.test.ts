import { describe, it, expect } from 'vitest'
import type { Measure } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { OttavaSpan } from '@/engine/models/ottavaOps'
import { measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { OTTAVA_MARK_INK } from './ottavaStyle'
import { ottavaFragmentClaim } from './OttavaRenderer'

/**
 * THE OTTAVA'S LADDER CLAIM — what it tells the family placed OUTSIDE it (the tempo mark).
 *
 * ⭐ The ottava is the first MIDDLE rung: it reads what the dynamics line and the trill took, and it
 * is read in turn by tempo. This file tests only the second half — the claim it files — because that
 * is the half nothing it draws would reveal. A wrong claim changes no octave line; it changes where
 * a tempo mark lands, two passes later, on some other bar.
 *
 * ⚠️ Beats only, `TrillRenderer.ladder.test.ts`'s rule: the band's numbers come from a baseline
 * measured in a browser, so what is asserted here is the arithmetic — which bars, which beats, which
 * system.
 */

const bar = (number: number, capacity = 4): Measure =>
  ({
    id: `m${number}`, number, slots: [],
    timeSignature: { numerator: capacity, denominator: 4 }, tuplets: [],
  } as unknown as Measure)

const placement = (view: Measure) => ({ view, measureNumber: view.number })

const span = (over: Partial<OttavaSpan> = {}): OttavaSpan => ({
  startMeasure: 1, startBeat: frac(0, 1),
  endMeasure: 1, endBeat: frac(4, 1),
  ...over,
})

const starts = (...measures: Measure[]) => measureStartOffsets({ measures } as never)

describe('ottavaFragmentClaim', () => {
  it('claims from the line’s START BEAT, not from the bar’s opening', () => {
    const m1 = bar(1)
    const claim = ottavaFragmentClaim(
      [placement(m1)], span({ startBeat: frac(2, 1) }), 0, undefined, 'above', -4, starts(m1))
    expect(fracToNumber(claim!.from)).toBe(2)
    expect(fracToNumber(claim!.to)).toBe(4)
  })

  it('claims to the line’s END BEAT, not to the bar’s end', () => {
    // The span is half-open and stops mid-bar; a claim running to the barline would push a tempo
    // mark up over music the bracket does not reach.
    const m1 = bar(1)
    const claim = ottavaFragmentClaim(
      [placement(m1)], span({ endBeat: frac(2, 1) }), 0, undefined, 'above', -4, starts(m1))
    expect(fracToNumber(claim!.to)).toBe(2)
  })

  it('spans several bars on the ABSOLUTE beat axis', () => {
    const m1 = bar(1), m2 = bar(2), m3 = bar(3)
    const claim = ottavaFragmentClaim(
      [placement(m1), placement(m2), placement(m3)],
      span({ startBeat: frac(1, 1), endMeasure: 3, endBeat: frac(2, 1) }),
      0, undefined, 'above', -4, starts(m1, m2, m3))
    expect(fracToNumber(claim!.from)).toBe(1)   // bar 1 starts at 0
    expect(fracToNumber(claim!.to)).toBe(10)    // bar 3 starts at 8, + 2
  })

  it('takes WHOLE bars in the middle of a span', () => {
    const m1 = bar(1), m2 = bar(2)
    const claim = ottavaFragmentClaim(
      [placement(m1)],
      span({ startBeat: frac(3, 1), endMeasure: 2, endBeat: frac(1, 1) }),
      0, undefined, 'above', -4, starts(m1, m2))
    // This FRAGMENT holds bar 1 only, so it claims from beat 3 to that bar's end — the span
    // continues, but not on this system.
    expect(fracToNumber(claim!.from)).toBe(3)
    expect(fracToNumber(claim!.to)).toBe(4)
  })

  it('⭐ a fragment claims only ITS OWN bars — the second system is a separate claim', () => {
    // The bug this guards: one claim for the whole span would put system 2's bracket on system 1's
    // beats, and a tempo mark on the first system would clear a bracket that is not above it.
    const m1 = bar(1), m2 = bar(2)
    const first = ottavaFragmentClaim(
      [placement(m1)], span({ endMeasure: 2, endBeat: frac(4, 1) }), 0, undefined, 'above', -4, starts(m1, m2))
    const second = ottavaFragmentClaim(
      [placement(m2)], span({ endMeasure: 2, endBeat: frac(4, 1) }), 1, undefined, 'above', -4, starts(m1, m2))

    expect(first!.line).toBe(0)
    expect(second!.line).toBe(1)
    expect(fracToNumber(first!.to)).toBe(4)
    expect(fracToNumber(second!.from)).toBe(4)
  })

  it('bands the mark around its baseline, both ways from it', () => {
    const m1 = bar(1)
    const claim = ottavaFragmentClaim([placement(m1)], span(), 0, undefined, 'above', -4, starts(m1))
    expect(claim!.band.top).toBeCloseTo(-4 - OTTAVA_MARK_INK.above, 6)
    expect(claim!.band.bottom).toBeCloseTo(-4 + OTTAVA_MARK_INK.below, 6)
  })

  it('carries the staff and the side it was placed on', () => {
    const m1 = bar(1)
    const claim = ottavaFragmentClaim([placement(m1)], span(), 2, 'staff-2', 'below', 9, starts(m1))
    expect(claim!.staffId).toBe('staff-2')
    expect(claim!.side).toBe('below')
    expect(claim!.line).toBe(2)
  })

  it('returns null when the fragment covers no bar this render drew', () => {
    expect(ottavaFragmentClaim([], span(), 0, undefined, 'above', -4, new Map())).toBeNull()
  })

  it('returns null for a bar the offsets do not know', () => {
    const m1 = bar(1)
    expect(ottavaFragmentClaim([placement(bar(9))], span(), 0, undefined, 'above', -4, starts(m1))).toBeNull()
  })

  it('respects a PICKUP bar’s real capacity on the shared axis', () => {
    // The axis is `measureStartOffsets`', so a short bar must shorten what follows it — a claim
    // computed from a nominal 4/4 would sit a beat late for the rest of the score.
    const m1 = bar(1, 1), m2 = bar(2)
    const claim = ottavaFragmentClaim(
      [placement(m2)], span({ startMeasure: 2, endMeasure: 2 }), 0, undefined, 'above', -4, starts(m1, m2))
    expect(fracToNumber(claim!.from)).toBe(1) // the pickup is one beat long, not four
  })
})
