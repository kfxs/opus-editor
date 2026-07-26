import { describe, it, expect } from 'vitest'
import { fannedBeamGeometry, fanStemExtension } from './FannedBeam'
import { fanColumns, fanMembers } from '@/utils/fannedBeam'
import { LAYOUT_CONFIG } from './layoutConfig'
import { fracCreate as frac } from '@/utils/fraction'
import type { FanMark } from '@/types/music'

/**
 * The fan's GEOMETRY — pure arithmetic, so it is testable where the drawing is not (jsdom cannot
 * measure glyphs, so an assertion about the drawn picture would pass vacuously —
 * reference_jsdom_cannot_measure_glyphs). What is pinned here is the shape of the fan: where the
 * members land, and that the lines converge at the SLOW end and spread at the FAST one.
 */

const BEAM_WIDTH = 5
const MIN_GAP = 12
const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

/** Stems up, heads at y=100, tips at y=60 — an ordinary stem-up note with room to fan into. */
const geometry = (fan: FanMark, spanEndX = 400) => fannedBeamGeometry({
  members: fanMembers(fan, frac(2, 1)),
  direction: fan.direction,
  beams: fan.beams,
  headX: 100,
  spanEndX,
  stemOffset: 10,
  minHeadGap: MIN_GAP,
  baseY: 100,
  tipY: 60,
  stemDirection: 1,
  beamWidth: BEAM_WIDTH,
})

describe('the members', () => {
  it('places one stem per member, the first at the real note', () => {
    const g = geometry(FAN)
    expect(g.stems).toHaveLength(6)
    expect(g.stems[0].headX).toBe(100) // member 0 IS the note VexFlow already drew
    expect(g.stems[0].stemX).toBe(110)
  })

  it('marches to the right and stays inside its span', () => {
    const g = geometry(FAN)
    for (let k = 1; k < g.stems.length; k++) {
      expect(g.stems[k].headX).toBeGreaterThan(g.stems[k - 1].headX)
    }
    // The last head still has its own glyph's room before whatever comes next.
    expect(g.stems[g.stems.length - 1].headX).toBeLessThan(400 - MIN_GAP)
  })

  it('crowds toward the FAST end — the drawing says what the playback does', () => {
    const accel = geometry(FAN).stems.map(s => s.headX)
    const gaps = accel.slice(1).map((x, i) => x - accel[i])
    for (let k = 1; k < gaps.length; k++) expect(gaps[k]).toBeLessThan(gaps[k - 1])

    const rit = geometry({ ...FAN, direction: 'rit' }).stems.map(s => s.headX)
    const ritGaps = rit.slice(1).map((x, i) => x - rit[i])
    for (let k = 1; k < ritGaps.length; k++) expect(ritGaps[k]).toBeGreaterThan(ritGaps[k - 1])
  })

  it('runs every stem from the noteheads to the beam line', () => {
    for (const stem of geometry(FAN).stems) {
      expect(stem.baseY).toBe(100)
      expect(stem.tipY).toBe(60)
    }
  })
})

describe('the beam lines', () => {
  it('draws one line per beam, spanning the outer stems', () => {
    const g = geometry(FAN)
    expect(g.beams).toHaveLength(3)
    for (const q of g.beams) {
      expect(q.startX).toBe(g.stems[0].stemX)
      expect(q.endX).toBe(g.stems[g.stems.length - 1].stemX)
    }
  })

  it('the primary is FLAT at the stem tips — every member reaches it', () => {
    const [primary] = geometry(FAN).beams
    expect(primary.startY).toBe(60)
    expect(primary.endY).toBe(60)
  })

  it('⭐ accel converges at the START and feathers at the END', () => {
    const g = geometry(FAN)
    for (const q of g.beams) expect(q.startY).toBe(60) // all lines meet at the slow end
    const ends = g.beams.map(q => q.endY)
    expect(ends[0]).toBe(60)
    expect(ends[1]).toBeGreaterThan(ends[0]) // stems up: the levels step INWARD, downward
    expect(ends[2]).toBeGreaterThan(ends[1])
    expect(ends[2] - ends[1]).toBeCloseTo(ends[1] - ends[0], 10) // one even step, VexFlow's ×1.5
  })

  it('⭐ rit is the mirror — feathered at the START, converged at the END', () => {
    const g = geometry({ ...FAN, direction: 'rit' })
    for (const q of g.beams) expect(q.endY).toBe(60)
    expect(g.beams[2].startY).toBeGreaterThan(g.beams[1].startY)
  })

  it('steps the levels the other way for stems DOWN', () => {
    const g = fannedBeamGeometry({
      members: fanMembers(FAN, frac(2, 1)),
      direction: 'accel', beams: 3,
      headX: 100, spanEndX: 400, stemOffset: 0, minHeadGap: MIN_GAP,
      baseY: 60, tipY: 100, stemDirection: -1, beamWidth: BEAM_WIDTH,
    })
    // Stems down: the tip is BELOW the heads, so the levels march up.
    expect(g.beams[2].endY).toBeLessThan(g.beams[0].endY)
    for (const q of g.beams) expect(q.thickness).toBe(-BEAM_WIDTH)
  })

  it('one beam is a single flat line — a fan with no feathering', () => {
    const g = geometry({ ...FAN, beams: 1 })
    expect(g.beams).toHaveLength(1)
    expect(g.beams[0].startY).toBe(g.beams[0].endY)
  })
})

describe('⭐ the heads never collapse onto each other', () => {
  /**
   * The bug reported from use: with the heads placed purely proportionally, a `rit.` — which OPENS
   * with its fastest notes — piled its first noteheads on top of one another. Proportional stays;
   * the gaps have a floor, and `fanColumns` asks the bar for the width that floor implies.
   */
  const gapsOf = (fan: FanMark, spanEndX?: number) => {
    const xs = geometry(fan, spanEndX).stems.map(s => s.headX)
    return xs.slice(1).map((x, i) => x - xs[i])
  }

  it('⭐ THE WIDTH THE FAN ASKS FOR IS ENOUGH FOR THE FLOOR — the two halves agree', () => {
    // The contract between `fanColumns` (what the bar is asked for) and this layout (what spends
    // it): given that width, no gap ever has to be clamped, in any direction, at any setting. If
    // this fails, one of the two numbers moved without the other.
    for (const direction of ['accel', 'rit'] as const) {
      for (const count of [2, 6, 12]) {
        for (const beams of [1, 3, 5]) {
          const fan: FanMark = { direction, count, beams }
          const span = 100 + fanColumns(fan) * LAYOUT_CONFIG.MIN_NOTE_SPACING
          for (const gap of gapsOf(fan, span)) {
            expect(gap, `${direction} ${count}×${beams}`).toBeGreaterThanOrEqual(MIN_GAP - 1e-9)
          }
        }
      }
    }
  })

  it('a rit in a SHORT span compresses evenly instead of piling up at the start', () => {
    // Less room than even the floored layout wants: nothing may overlap, and nothing may walk out
    // the far end into the next note.
    const gaps = gapsOf({ ...FAN, direction: 'rit' }, 160)
    const total = gaps.reduce((a, b) => a + b, 0)
    expect(total).toBeLessThanOrEqual(160 - 100 - MIN_GAP + 1e-9)
    for (const gap of gaps) expect(gap).toBeGreaterThan(0)
    // Evenly short, not proportionally short — the least-bad answer, and it still reads as a group.
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 6)
  })

  it('stays proportional when the room IS there', () => {
    // The floor is a floor, not a layout: given the width `fanColumns` asks for, the gaps still
    // shrink note by note.
    const gaps = gapsOf(FAN, 600)
    for (let k = 1; k < gaps.length; k++) expect(gaps[k]).toBeLessThan(gaps[k - 1])
  })
})

describe('nothing to draw', () => {
  it('a collapsed span draws nothing rather than a narrower fan', () => {
    expect(geometry(FAN, 100).beams).toEqual([])
    expect(geometry(FAN, 60).stems).toEqual([])
  })

  it('a single member is the note itself — no fan', () => {
    expect(geometry({ ...FAN, count: 1 }).beams).toEqual([])
  })
})

describe('fanStemExtension — the room the levels need', () => {
  it('is one VexFlow beam step per extra level', () => {
    expect(fanStemExtension(1, BEAM_WIDTH)).toBe(0)
    expect(fanStemExtension(3, BEAM_WIDTH)).toBe(2 * BEAM_WIDTH * 1.5)
  })

  it('never asks for negative stem', () => {
    expect(fanStemExtension(0, BEAM_WIDTH)).toBe(0)
  })
})
