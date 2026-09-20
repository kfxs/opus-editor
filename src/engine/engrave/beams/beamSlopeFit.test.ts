/**
 * Which slope a beam takes inside its budget — the search, in jsdom.
 *
 * ⚠️ Exactness against `Beam.calculateSlope` was proved once, by a throwaway probe running both on the
 * same beams (S7a, `docs/history/vexflow-removal-map.md` §9). What is pinned here is what the search DOES:
 * halve the stems' own lean, never cross an inner stem, stay inside the budget, and always end.
 */
import { describe, it, expect } from 'vitest'
import { type BeamSlopeNote, fitBeamSlope } from './beamSlopeFit'

const UP = 1
const DOWN = -1
const note = (stemX: number, tipY: number, counts = true): BeamSlopeNote => ({ stemX, tipY, counts })

describe('fitBeamSlope', () => {
  it('level tips take a level beam', () => {
    const { slope, lift } = fitBeamSlope({ stemDirection: UP, notes: [note(0, 100), note(40, 100)], range: 0.25 })
    expect(slope).toBeCloseTo(0, 9)
    expect(lift).toBeCloseTo(0, 9)
  })

  it('⭐ a lean steeper than the budget is capped at the budget, and the line lifts to the higher tip', () => {
    // The tips lean −0.5, so the ideal is −0.25 — exactly the budget's edge.
    const { slope, lift } = fitBeamSlope({ stemDirection: UP, notes: [note(0, 100), note(40, 80)], range: 0.25 })
    expect(slope).toBe(-0.25)
    expect(lift, 'the line from the first tip would cross the second stem by 10 px').toBe(-10)
  })

  it('⭐ an inner note reaching past the line pushes the WHOLE line out — stems up', () => {
    const { lift } = fitBeamSlope({
      stemDirection: UP, notes: [note(0, 100), note(20, 70), note(40, 100)], range: 0,
    })
    expect(lift).toBeCloseTo(-30, 3)
  })

  it('…and the same, mirrored, for stems down', () => {
    const { lift } = fitBeamSlope({
      stemDirection: DOWN, notes: [note(0, 100), note(20, 130), note(40, 100)], range: 0,
    })
    expect(lift).toBeCloseTo(30, 3)
  })

  it('a note whose stem is not charged pushes nothing', () => {
    const { lift } = fitBeamSlope({
      stemDirection: UP, notes: [note(0, 100), note(20, 70, false), note(40, 100)], range: 0,
    })
    expect(lift).toBeCloseTo(0, 3)
  })

  it('🚨 a ZERO budget still ends — a unison is ordinary music, and a zero step never would', () => {
    const { slope } = fitBeamSlope({ stemDirection: UP, notes: [note(0, 100), note(40, 90)], range: 0 })
    expect(Math.abs(slope)).toBeLessThanOrEqual(1e-6)
  })

  it('never leaves the budget', () => {
    for (const range of [0.05, 0.1, 0.25]) {
      const { slope } = fitBeamSlope({ stemDirection: DOWN, notes: [note(0, 100), note(30, 160)], range })
      expect(Math.abs(slope)).toBeLessThanOrEqual(range + 1e-12)
    }
  })
})
