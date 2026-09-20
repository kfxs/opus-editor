/**
 * How far a beamed stem runs — to the beam, in jsdom.
 *
 * ⚠️ Exactness against `Beam.applyStemExtensions` was proved once, by a throwaway probe running both
 * on the same beams (S7b, `docs/history/vexflow-removal-map.md` §9). Pinned here: every stem meets the line,
 * and a stem against the beam crosses the whole stack.
 */
import { describe, it, expect } from 'vitest'
import { type BeamLine, type BeamedStem, beamedStemExtension } from './beamedStems'

const line = (over: Partial<BeamLine> = {}): BeamLine => ({
  firstStemX: 0, firstY: 50, slope: 0, lift: 0, stemDirection: 1, beamWidth: 5, ...over,
})
const stem = (over: Partial<BeamedStem> = {}): BeamedStem => ({
  stemX: 0, tipY: 60, extension: 0, stemDirection: 1, beamLevels: 1, ...over,
})

describe('beamedStemExtension', () => {
  it('a short stem up is lengthened to the line', () => {
    expect(beamedStemExtension(stem({ tipY: 60 }), line())).toBe(10)
  })

  it('a stem already past the line is shortened to it', () => {
    expect(beamedStemExtension(stem({ tipY: 45, extension: 3 }), line())).toBe(-2)
  })

  it('⭐ the line is read at the stem’s own x, lifted', () => {
    // At x = 20 a slope of 0.5 puts the line at 60; the lift moves it up to 56.
    expect(beamedStemExtension(stem({ stemX: 20, tipY: 70 }), line({ slope: 0.5, lift: -4 }))).toBe(14)
  })

  it('a stem down measures the other way', () => {
    expect(beamedStemExtension(stem({ stemDirection: -1, tipY: 40 }), line({ stemDirection: -1 }))).toBe(10)
  })

  it('⭐ a stem AGAINST the beam crosses every one of its own beam lines', () => {
    // Beam over the notes (up); this stem points down, ends at the line, then crosses one line…
    expect(beamedStemExtension(stem({ stemDirection: -1, tipY: 50 }), line())).toBe(5)
    // …or a stack of three: 1 + 2 × 1.5 thicknesses.
    expect(beamedStemExtension(stem({ stemDirection: -1, tipY: 50, beamLevels: 3 }), line())).toBe(20)
  })
})
