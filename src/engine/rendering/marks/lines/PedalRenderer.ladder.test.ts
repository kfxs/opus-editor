import { describe, it, expect } from 'vitest'
import type { Measure } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { PedalSpan } from '@/engine/models/pedalOps'
import { measureStartOffsets } from '@/engine/layout/outsideStaffBand'
import { PEDAL_MARK_INK } from './pedalStyle'
import { pedalFragmentClaim } from './PedalRenderer'

/**
 * THE PEDAL'S LADDER CLAIM — what it tells whatever is placed outside it.
 *
 * ⭐ The pedal is the OUTERMOST below-staff family, so today **nothing reads this claim at all**, and
 * that is exactly why it is worth a spec: a claim no one consumes cannot be wrong in a way the screen
 * shows. It is filed so the next family below the staff finds the space taken without having to know
 * pedals exist (the ladder's whole argument — the order is the pass order, and there is no table).
 *
 * ⚠️ Beats and SIDE only, `OttavaRenderer.ladder.test.ts`'s rule: the band's numbers come from a
 * baseline measured in a browser, so what is asserted here is the arithmetic — which bars, which
 * beats, which system, which side of the staff.
 */

const bar = (number: number, capacity = 4): Measure =>
  ({
    id: `m${number}`, number, slots: [],
    timeSignature: { numerator: capacity, denominator: 4 }, tuplets: [],
  } as unknown as Measure)

const placement = (view: Measure) => ({ view, measureNumber: view.number })

const span = (over: Partial<PedalSpan> = {}): PedalSpan => ({
  startMeasure: 1, startBeat: frac(0, 1),
  endMeasure: 1, endBeat: frac(4, 1),
  ...over,
})

const starts = (...measures: Measure[]) => measureStartOffsets({ measures } as never)

describe('pedalFragmentClaim', () => {
  it('claims from the PRESS beat, not from the bar’s opening', () => {
    const m1 = bar(1)
    const claim = pedalFragmentClaim([placement(m1)], span({ startBeat: frac(2, 1) }), 0, undefined, 6, starts(m1))
    expect(fracToNumber(claim!.from)).toBe(2)
    expect(fracToNumber(claim!.to)).toBe(4)
  })

  it('claims to the LIFT, not to the bar’s end', () => {
    // A claim running to the barline would push a later family down over music the pedal has already
    // let go of.
    const m1 = bar(1)
    const claim = pedalFragmentClaim([placement(m1)], span({ endBeat: frac(2, 1) }), 0, undefined, 6, starts(m1))
    expect(fracToNumber(claim!.to)).toBe(2)
  })

  it('spans several bars on the ABSOLUTE beat axis', () => {
    const m1 = bar(1), m2 = bar(2), m3 = bar(3)
    const claim = pedalFragmentClaim(
      [placement(m1), placement(m2), placement(m3)],
      span({ startBeat: frac(1, 1), endMeasure: 3, endBeat: frac(2, 1) }),
      0, undefined, 6, starts(m1, m2, m3))
    expect(fracToNumber(claim!.from)).toBe(1)   // bar 1, beat 1
    expect(fracToNumber(claim!.to)).toBe(10)    // 4 + 4 + beat 2
  })

  it('reads bars of DIFFERENT capacities off the shared axis', () => {
    const m1 = bar(1, 3), m2 = bar(2, 4)
    const claim = pedalFragmentClaim(
      [placement(m1), placement(m2)],
      span({ endMeasure: 2, endBeat: frac(1, 1) }),
      0, undefined, 6, starts(m1, m2))
    expect(fracToNumber(claim!.to)).toBe(4) // a 3/4 bar, then beat 1
  })

  it('⭐ claims only the bars of ITS OWN FRAGMENT — a broken pedal files one claim per system', () => {
    // The caller hands in the bars that landed on THIS line. A claim covering the whole span would
    // take space on a system the pedal has no ink on.
    const m1 = bar(1), m2 = bar(2)
    const claim = pedalFragmentClaim(
      [placement(m2)], span({ endMeasure: 2, endBeat: frac(4, 1) }), 1, undefined, 6, starts(m1, m2))
    expect(fracToNumber(claim!.from)).toBe(4)  // bar 2's opening — this fragment starts at the system
    expect(fracToNumber(claim!.to)).toBe(8)
    expect(claim!.line).toBe(1)
  })

  it('⭐ is always BELOW — there is nothing to derive and nothing to flip', () => {
    const m1 = bar(1)
    const claim = pedalFragmentClaim([placement(m1)], span(), 0, undefined, 6, starts(m1))
    expect(claim!.side).toBe('below')
  })

  it('carries the staff it was drawn against, and the band its baseline makes', () => {
    const m1 = bar(1)
    const claim = pedalFragmentClaim([placement(m1)], span(), 0, 'staff-2', 6, starts(m1))
    expect(claim!.staffId).toBe('staff-2')
    // `markBand` grows the ink DOWNWARD-positive from the baseline on either side of the staff —
    // the side changed where the baseline landed, not which way the glyph grows from it.
    expect(claim!.band.top).toBeCloseTo(6 - PEDAL_MARK_INK.above, 10)
    expect(claim!.band.bottom).toBeCloseTo(6 + PEDAL_MARK_INK.below, 10)
  })

  it('is null when the fragment covers no bar this render drew', () => {
    expect(pedalFragmentClaim([], span(), 0, undefined, 6, starts(bar(1)))).toBeNull()
  })
})
