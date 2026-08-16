import { describe, it, expect } from 'vitest'
import { tieArcGrowth, type TieInk } from './tieStaffLineClearance'
import { CURVE, CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ Gould p. 61 — *"sufficiently round to be conspicuous through a stave-line"* — as the two cases
 * our constant tie shape can be in. A five-line staff with lines at 0, 10, 20, 30, 40 px.
 *
 * ⚠️ Headless is right here: nothing is measured, the line positions and the arc's numbers are
 * handed in. That the DRAWN arc lands where these numbers say is `e2e/tie.e2e.ts`.
 */
const SP = STAFF_SPACE_PX
const LINES = [0, SP, 2 * SP, 3 * SP, 4 * SP]
const ABOVE = -1
const BELOW = 1

/** A tie above a notehead at `headY`, in our real geometry: 0.70 sp of lift, a 0.40 sp apex. */
const tieAbove = (headY: number): TieInk => ({
  endpointY: headY - CURVE_PX.tieLift,
  apexRise: 0.75 * CURVE_PX.tieBow,
  inkThickness: 0.75 * CURVE_PX.thickness + CURVE_PX.outline,
  direction: ABOVE,
  lineYs: LINES,
})

describe('tieStaffLineShift', () => {
  it('🚨 a notehead ON a line leaves a staff line running 0.1 sp under its arc — round the arc out', () => {
    // Head on the middle line (20). Tips at 13, the arc at 9.03 with its ink swelling AWAY to 6.0 —
    // and the line at 10 sits 0.97 px under the arc, parallel to its flat middle for the tie's whole
    // length. That is the fault, and with a constant tie shape it happens EVERY time.
    const growth = tieArcGrowth(tieAbove(2 * SP))
    // Grown to LilyPond's 0.3 sp of daylight, from the 0.0975 it had.
    expect(growth / SP).toBeCloseTo(0.3 - 0.0975, 3)
  })

  it('…and the grown arc clears the line while its TIPS never move', () => {
    const ink = tieAbove(2 * SP)
    const grown = { ...ink, apexRise: ink.apexRise + tieArcGrowth(ink) }
    expect(grown.endpointY, 'the tips stay on their noteheads — his eye, 2026-08-16').toBe(ink.endpointY)
    const near = grown.endpointY + ABOVE * grown.apexRise
    expect((SP - near) / SP).toBeCloseTo(0.3, 3)
    expect(tieArcGrowth(grown), 'and a second pass finds nothing left to do').toBe(0)
  })

  it('⭐ the grown apex is 0.60 sp where the default is 0.40 — Gould\'s "sufficiently round"', () => {
    const ink = tieAbove(2 * SP)
    expect((ink.apexRise + tieArcGrowth(ink)) / SP).toBeCloseTo(0.60, 2)
    expect(ink.apexRise / SP).toBeCloseTo(0.40, 2)
  })

  it('never grows past MuseScore\'s cap of 0.75 × the arc\'s own height', () => {
    // A staff whose lines are far apart could ask for more; the cap is what refuses.
    const ink: TieInk = { ...tieAbove(2 * SP), apexRise: 1 }
    expect(tieArcGrowth(ink)).toBeLessThanOrEqual(0.75 * 1)
  })

  it('⭐ a notehead in a SPACE is LEFT ALONE — nudging it would drive the tie into the far line', () => {
    // Head at 15 (mid-space): the ink lands at 1.0–4.03, and the nearest line (0) is on its FAR
    // side. Moving outward is exactly the wrong direction there — which is why LilyPond nudges only
    // when the head is on a line, and why this rule tests the band's INNER edge alone.
    const ink = tieAbove(1.5 * SP)
    expect(tieArcGrowth(ink)).toBe(0)
  })

  it('mirrors for a tie BELOW — which is the case his eye caught, a tied G4', () => {
    const below: TieInk = { ...tieAbove(2 * SP), direction: BELOW, endpointY: 2 * SP + CURVE_PX.tieLift }
    expect(tieArcGrowth(below) / SP).toBeCloseTo(0.3 - 0.0975, 3)
  })

  it('leaves a tie outside the staff alone — there is no line to run along it', () => {
    // Two ledger lines above the staff: the nearest stave line is far below the arc.
    expect(tieArcGrowth(tieAbove(-3 * SP))).toBe(0)
  })

  it('does nothing without a staff — the armed tool\'s ghost floats where there are no lines', () => {
    expect(tieArcGrowth({ ...tieAbove(2 * SP), lineYs: [] })).toBe(0)
  })

  it('states each number in the unit its engine publishes it in', () => {
    expect(CURVE.tieLineClearance, 'MuseScore badArcIntersectionLimit — WHEN').toBe(0.15)
    expect(CURVE.tieLineApexClearance, 'LilyPond center-staff-line-clearance — HOW FAR').toBe(0.3)
    expect(CURVE.tieLineMaxGrowth, 'MuseScore maxArcCorrection — the cap').toBe(0.75)
  })
})
