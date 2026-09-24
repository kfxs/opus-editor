import { describe, it, expect } from 'vitest'
import { TIE_BRACKET_CLEARANCE_SP, tieEndpointX, tieEndpointY, type TieHead } from './tieEndpoints'
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

describe('tieEndpointX — a PARENTHESISED head: the tie runs outside its brackets (Gould p. 610)', () => {
  it('⭐ leaves from past `)` and lands short of `(`, by the clearance row', () => {
    const from = { ...head(100, 50), bracketX: 120 }
    const to = { ...head(200, 50), bracketX: 180 }
    expect(tieEndpointX(from, 'from')).toBeCloseTo(120 + TIE_BRACKET_CLEARANCE_SP * SP, 9)
    expect(tieEndpointX(to, 'to')).toBeCloseTo(180 - TIE_BRACKET_CLEARANCE_SP * SP, 9)
  })

  it('a bracket INSIDE the usual tip changes nothing — the tip already stands clear', () => {
    expect(tieEndpointX({ ...head(100, 50), bracketX: 90 }, 'from')).toBe(tieEndpointX(head(100, 50), 'from'))
  })
})

describe('tieEndpointY — a CUE head (cue-size-plan P5): 0.20 sp from the SMALL head’s edge', () => {
  it('⭐ a full head: exactly the settled 0.70 sp — nothing moved', () => {
    expect(tieEndpointY(50, 1, 1)).toBeCloseTo(50 + CURVE_PX.tieLift, 10)
  })

  it('⭐ a ¾ head: half ITS height + the same 0.20 — MuseScore’s `note->height()/2 + 0.20 sp`', () => {
    expect(tieEndpointY(50, 1, 0.75)).toBeCloseTo(50 + (0.5 * 0.75 + 0.2) * STAFF_SPACE_PX, 10)
    expect(tieEndpointY(50, -1, 0.75)).toBeCloseTo(50 - (0.5 * 0.75 + 0.2) * STAFF_SPACE_PX, 10)
  })
})
