import { describe, it, expect } from 'vitest'
import { tieEndpointX, tieEndpointY, type TieHead } from './tieEndpoints'
import { CURVE, CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
/** A Bravura notehead is ~1.18 sp wide; this one is centred on x = 100. */
const head = (centreX: number, headY: number): TieHead =>
  ({ leftX: centreX - 0.59 * SP, rightX: centreX + 0.59 * SP, headY })

describe('tieEndpointX — Verovio\'s inset, his call 2026-08-16', () => {
  it('⭐ starts a quarter space IN from the head\'s centre, and ends the same', () => {
    expect(tieEndpointX(head(100, 0), 'from')).toBeCloseTo(100 + 0.25 * SP, 6)
    expect(tieEndpointX(head(200, 0), 'to')).toBeCloseTo(200 - 0.25 * SP, 6)
  })

  it('⭐ puts the tips OVER the noteheads, where they used to sit in the gap between them', () => {
    // What we drew before: `getTieRightX()` / `getTieLeftX()`, the heads' outer EDGES.
    const from = head(100, 0), to = head(200, 0)
    expect(tieEndpointX(from, 'from')).toBeLessThan(from.rightX)
    expect(tieEndpointX(to, 'to')).toBeGreaterThan(to.leftX)
    // …and the tie is therefore shorter than it was, by 0.34 sp at each end.
    expect(from.rightX - tieEndpointX(from, 'from')).toBeCloseTo(0.34 * SP, 1)
  })

  it('is symmetric — the same number at both ends, which is what makes it a decision', () => {
    const from = head(100, 0), to = head(200, 0)
    expect(tieEndpointX(from, 'from') - 100).toBeCloseTo(200 - tieEndpointX(to, 'to'), 6)
  })
})

describe('tieEndpointY — settled, and here so both coordinates live together', () => {
  it('lifts 0.70 sp off the head CENTRE, which is 0.20 clear of its edge', () => {
    expect(tieEndpointY(50, -1)).toBeCloseTo(50 - CURVE_PX.tieLift, 6)
    expect(tieEndpointY(50, 1)).toBeCloseTo(50 + CURVE_PX.tieLift, 6)
    expect(CURVE.tieLift).toBe(0.70)
  })
})
