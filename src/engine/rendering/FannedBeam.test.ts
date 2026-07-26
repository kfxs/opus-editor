import { describe, it, expect } from 'vitest'
import { fannedBeamGeometry, fanJoinQuads, fanStemExtension, FAN_MAX_BEAM_SLOPE } from './FannedBeam'
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

const MIN_STEM = 20

/**
 * Stems up, every head at y=100, tips at y=60 — an ordinary stem-up note with room to fan into,
 * and every member at the SLOT'S OWN PITCH.
 *
 * ⭐ That last part is what makes this file a regression guard as well as a spec: a fan whose members
 * all share one pitch is what the feature drew before they could differ, and it must still come out
 * flat, unshifted and unlifted.
 */
const geometry = (fan: FanMark, spanEndX = 400) => fannedBeamGeometry({
  members: fanMembers(fan, frac(2, 1)),
  memberHeadYs: Array.from({ length: Math.max(1, fan.count) }, () => [100]),
  direction: fan.direction,
  beams: fan.beams,
  headX: 100,
  spanEndX,
  stemOffset: 10,
  minHeadGap: MIN_GAP,
  tipY: 60,
  minStemLength: MIN_STEM,
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
      memberHeadYs: Array.from({ length: 6 }, () => [60]),
      direction: 'accel', beams: 3,
      headX: 100, spanEndX: 400, stemOffset: 0, minHeadGap: MIN_GAP,
      tipY: 100, minStemLength: MIN_STEM, stemDirection: -1, beamWidth: BEAM_WIDTH,
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

/**
 * ⭐ PER-MEMBER PITCH (docs/fanned-beam-pitches-plan.md §2). The beam was flat only while every
 * member sat on one line; with pitches of their own it leans — anchored at member 0's own stem tip,
 * clamped, and never so close to a head that a stem inverts through it.
 */
describe('the beam leans when the members do', () => {
  /** Member heads climbing 4px a member (stems up), so the line has a reason to slope. */
  const rising = (fan: FanMark, step = -4, spanEndX = 400) => fannedBeamGeometry({
    members: fanMembers(fan, frac(2, 1)),
    memberHeadYs: Array.from({ length: fan.count }, (_, k) => [100 + k * step]),
    direction: fan.direction, beams: fan.beams,
    headX: 100, spanEndX, stemOffset: 10, minHeadGap: MIN_GAP,
    tipY: 60, minStemLength: MIN_STEM, stemDirection: 1, beamWidth: BEAM_WIDTH,
  })

  it('⭐ starts at member 0’s own stem tip — the one point the page cannot argue with', () => {
    const g = rising(FAN)
    expect(g.stems[0].tipY).toBe(60)
    expect(g.beams[0].startY).toBe(60)
  })

  it('rises with the pitches, and every stem lands ON the line', () => {
    const g = rising(FAN)
    expect(g.beams[0].endY).toBeLessThan(g.beams[0].startY) // higher pitches ⇒ smaller y
    const slope = (g.beams[0].endY - g.beams[0].startY) / (g.beams[0].endX - g.beams[0].startX)
    for (const s of g.stems) {
      expect(s.tipY).toBeCloseTo(g.beams[0].startY + slope * (s.stemX - g.beams[0].startX), 6)
    }
  })

  it('each stem still runs from its OWN notehead', () => {
    const g = rising(FAN)
    g.stems.forEach((s, k) => expect(s.baseY).toBe(100 - 4 * k))
  })

  it('⭐ clamps at VexFlow’s own maximum slope rather than standing the beam on end', () => {
    const g = rising(FAN, -40) // a two-octave leap across the group
    const slope = Math.abs((g.beams[0].endY - g.beams[0].startY) / (g.beams[0].endX - g.beams[0].startX))
    expect(slope).toBeCloseTo(FAN_MAX_BEAM_SLOPE, 10)
  })

  it('⭐ keeps every member’s stem at least the minimum — the whole LINE moves, not one stem', () => {
    // Clamped slope + a far-flung member ⇒ the line alone cannot reach; it must lift bodily.
    const g = rising(FAN, -40)
    for (let k = 0; k < g.stems.length; k++) {
      const nearY = 100 - 40 * k
      expect(nearY - g.stems[k].tipY).toBeGreaterThanOrEqual(MIN_STEM - 1e-9)
    }
    // And the real note is TOLD to grow by exactly what the lift cost it.
    expect(g.stemLift).toBeCloseTo(60 - g.stems[0].tipY, 6)
    expect(g.stemLift).toBeGreaterThan(0)
  })

  it('a flat group asks for no lift at all — nothing moves unless it has to', () => {
    expect(geometry(FAN).stemLift).toBe(0)
  })

  it('leans the other way for a falling line', () => {
    const g = rising(FAN, 4)
    expect(g.beams[0].endY).toBeGreaterThan(g.beams[0].startY)
  })
})

describe('an accidental buys its own room', () => {
  const withSigns = (accidentalRoom: number[]) => fannedBeamGeometry({
    members: fanMembers(FAN, frac(2, 1)),
    memberHeadYs: Array.from({ length: 6 }, () => [100]),
    direction: 'accel', beams: 3,
    headX: 100, spanEndX: 400, stemOffset: 10, minHeadGap: MIN_GAP, accidentalRoom,
    tipY: 60, minStemLength: MIN_STEM, stemDirection: 1, beamWidth: BEAM_WIDTH,
  })

  it('widens only the gap BEFORE the head that wears the sign', () => {
    // The sign hangs to the LEFT of its head, so it is the approach that has to open up.
    const plain = geometry(FAN).stems.map(s => s.headX)
    const signed = withSigns([0, 0, 0, 0, 40, 0]).stems.map(s => s.headX)
    expect(signed[4] - signed[3]).toBeGreaterThan(plain[4] - plain[3])
    expect(signed[1] - signed[0]).toBeCloseTo(plain[1] - plain[0], 6)
  })

  it('is a floor like the head gap — a wide gap that already fits is left alone', () => {
    const plain = geometry(FAN).stems.map(s => s.headX)
    const signed = withSigns([0, 1, 0, 0, 0, 0]).stems.map(s => s.headX)
    expect(signed[1] - signed[0]).toBeCloseTo(plain[1] - plain[0], 6)
  })
})

/**
 * ⭐ JOINED TO THE GROUP ON ITS LEFT (docs/fan-beam-join-plan.md P1). The whole line becomes ours —
 * one straight edge from the first prefix stem to the last member — and in v1 it is FLAT.
 */
describe('a fan joined to the group on its left', () => {
  /** Two eighths in front of the fan, stems at x=40 and x=70, heads on the same line as the fan. */
  const PREFIX = [{ stemX: 40, headYs: [100] }, { stemX: 70, headYs: [100] }]

  const joined = (opts: {
    fan?: FanMark
    prefix?: { stemX: number; headYs: number[] }[]
    prefixBeams?: number
    memberStep?: number
  } = {}) => {
    const fan = opts.fan ?? FAN
    const step = opts.memberStep ?? 0
    return fannedBeamGeometry({
      members: fanMembers(fan, frac(2, 1)),
      memberHeadYs: Array.from({ length: fan.count }, (_, k) => [100 + k * step]),
      direction: fan.direction, beams: fan.beams,
      headX: 100, spanEndX: 400, stemOffset: 10, minHeadGap: MIN_GAP,
      prefix: opts.prefix ?? PREFIX,
      prefixBeams: opts.prefixBeams ?? 1,
      tipY: 60, minStemLength: MIN_STEM, stemDirection: 1, beamWidth: BEAM_WIDTH,
    })
  }

  it('⭐ FLATTENS the line — a fan that leans on its own goes horizontal once it is joined', () => {
    // Alone, the same rising members lean (the test above pins that).
    const alone = fannedBeamGeometry({
      members: fanMembers(FAN, frac(2, 1)),
      memberHeadYs: Array.from({ length: FAN.count }, (_, k) => [100 - 4 * k]),
      direction: 'accel', beams: 3,
      headX: 100, spanEndX: 400, stemOffset: 10, minHeadGap: MIN_GAP,
      tipY: 60, minStemLength: MIN_STEM, stemDirection: 1, beamWidth: BEAM_WIDTH,
    })
    expect(alone.beams[0].endY).toBeLessThan(alone.beams[0].startY)

    const g = joined({ memberStep: -4 })
    expect(g.beams[0].endY).toBe(g.beams[0].startY)
    // …and every stem in the group, member and prefix alike, lands on that one height.
    for (const s of g.stems) expect(s.tipY).toBeCloseTo(g.beams[0].startY, 6)
    for (const p of g.prefixStems) expect(p.tipY).toBeCloseTo(g.beams[0].startY, 6)
  })

  it('runs the PRIMARY back to the first prefix stem, and nothing else', () => {
    const g = joined()
    expect(g.beams[0].startX).toBe(40)              // the first prefix stem
    expect(g.beams[0].endX).toBe(g.stems[5].stemX)  // the last member
    // The fan's own extra levels belong to the ramp: they start at the owner's stem.
    for (const line of g.beams.slice(1)) expect(line.startX).toBe(g.stems[0].stemX)
  })

  it('gives the prefix one tip per note, at its own stem x', () => {
    const g = joined()
    expect(g.prefixStems.map(p => p.stemX)).toEqual([40, 70])
  })

  it('an UNJOINED fan reports no prefix at all, and is unchanged', () => {
    const g = geometry(FAN)
    expect(g.prefixStems).toEqual([])
    expect(g.beams[0].startX).toBe(g.stems[0].stemX)
  })

  it('⭐ the prefix keeps its OWN beam levels, and they stop at the owner’s stem', () => {
    // A 16th prefix: two lines arrive, and the second is the prefix's alone.
    const g = joined({ prefixBeams: 2 })
    const prefixLevels = g.beams.filter(line => line.startX === 40 && line.endX === g.stems[0].stemX)
    expect(prefixLevels).toHaveLength(1)
    expect(prefixLevels[0].startY).toBeCloseTo(g.beams[0].startY + BEAM_WIDTH * 1.5, 6)
    // An eighth prefix asks for one line, which IS the primary — nothing extra.
    expect(joined({ prefixBeams: 1 }).beams).toHaveLength(3)
  })

  it('⭐ the PREFIX votes on the line’s height like any other note in the group', () => {
    // A prefix note three octaves up cannot keep its minimum stem where the line was, so the whole
    // line moves — and the fan's own note is told to grow by exactly what that cost it.
    const high = [{ stemX: 40, headYs: [20] }, { stemX: 70, headYs: [100] }]
    const g = joined({ prefix: high })
    expect(g.beams[0].startY).toBeLessThanOrEqual(20 - MIN_STEM)
    expect(g.stemLift).toBeCloseTo(60 - g.beams[0].startY, 6)
    expect(g.stemLift).toBeGreaterThan(0)
  })

  it('a prefix that already fits moves nothing', () => {
    expect(joined().stemLift).toBe(0)
    expect(joined().beams[0].startY).toBe(60)
  })

  it('steps the prefix’s levels the right way for stems DOWN', () => {
    const g = fannedBeamGeometry({
      members: fanMembers(FAN, frac(2, 1)),
      memberHeadYs: Array.from({ length: 6 }, () => [100]),
      direction: 'accel', beams: 3,
      headX: 100, spanEndX: 400, stemOffset: 0, minHeadGap: MIN_GAP,
      prefix: PREFIX, prefixBeams: 2,
      tipY: 140, minStemLength: MIN_STEM, stemDirection: -1, beamWidth: BEAM_WIDTH,
    })
    const extra = g.beams.find(line => line.startX === 40 && line.endX === g.stems[0].stemX)!
    expect(extra.startY).toBeCloseTo(g.beams[0].startY - BEAM_WIDTH * 1.5, 6)
  })
})

/**
 * ⭐ P2 — FAN TO FAN (docs/fan-beam-join-plan.md). Two ramps on one beam: the line is shared (a beam
 * is one straight edge) and the gap between them carries the lines they BOTH have.
 */
describe('two fans on one beam', () => {
  const ramp = (fan: FanMark, extra: Partial<Parameters<typeof fannedBeamGeometry>[0]> = {}) =>
    fannedBeamGeometry({
      members: fanMembers(fan, frac(2, 1)),
      memberHeadYs: Array.from({ length: fan.count }, () => [100]),
      direction: fan.direction, beams: fan.beams,
      headX: 100, spanEndX: 400, stemOffset: 10, minHeadGap: MIN_GAP,
      tipY: 60, minStemLength: MIN_STEM, stemDirection: 1, beamWidth: BEAM_WIDTH,
      joined: true,
      ...extra,
    })

  it('reports how many lines each END of the ramp carries — the narrow end is always 1', () => {
    const accel = ramp({ direction: 'accel', count: 6, beams: 3 })
    expect([accel.startLevels, accel.endLevels]).toEqual([1, 3])
    const rit = ramp({ direction: 'rit', count: 6, beams: 3 })
    expect([rit.startLevels, rit.endLevels]).toEqual([3, 1])
  })

  it('⭐ crosses the gap with the lines BOTH sides have, and no more', () => {
    const accel = ramp({ direction: 'accel', count: 6, beams: 3 }) // ends wide: 3
    const rit = ramp({ direction: 'rit', count: 6, beams: 4 })     // starts wide: 4
    const thickness = BEAM_WIDTH

    // accel → rit is the thick join: min(3, 4) = 3.
    expect(fanJoinQuads({ left: accel, right: rit, toX: 500, thickness })).toHaveLength(3)
    // rit → accel is the clean one: 1 line out, 1 line in.
    expect(fanJoinQuads({ left: rit, right: accel, toX: 500, thickness })).toHaveLength(1)
    // accel → accel: 3 out, 1 in ⇒ one line crosses and the other two stop at their own stem.
    expect(fanJoinQuads({ left: accel, right: accel, toX: 500, thickness })).toHaveLength(1)
  })

  it('runs them flat, from the left fan’s LAST stem to the right fan’s owner', () => {
    const left = ramp({ direction: 'accel', count: 6, beams: 3 })
    const right = ramp({ direction: 'rit', count: 6, beams: 3 })
    const quads = fanJoinQuads({ left, right, toX: 500, thickness: BEAM_WIDTH })
    for (const q of quads) {
      expect(q.startX).toBe(left.stems[left.stems.length - 1].stemX)
      expect(q.endX).toBe(500)
      expect(q.startY).toBe(q.endY) // the joined line is flat
    }
    expect(quads[0].startY).toBe(right.lineY)
    expect(quads[1].startY).toBeCloseTo(right.lineY + BEAM_WIDTH * 1.5, 6)
  })

  it('⭐ a line handed down by the group overrides anchor, slope AND floor', () => {
    // Its own answer would be its natural tip; told 30, it sits at 30 and the real note's stem is
    // told to grow by exactly the difference.
    const own = ramp({ direction: 'accel', count: 6, beams: 3 })
    expect(own.lineY).toBe(60)
    expect(own.stemLift).toBe(0)

    const shared = ramp({ direction: 'accel', count: 6, beams: 3 }, { lineY: 30 })
    expect(shared.lineY).toBe(30)
    for (const s of shared.stems) expect(s.tipY).toBe(30)
    expect(shared.stemLift).toBe(30) // 60 → 30
  })

  it('a fan with nothing drawn contributes no join quads', () => {
    const collapsed = ramp({ direction: 'accel', count: 6, beams: 3 }, { spanEndX: 100 })
    expect(collapsed.stems).toEqual([])
    expect(fanJoinQuads({ left: collapsed, right: ramp(FAN), toX: 500, thickness: BEAM_WIDTH })).toEqual([])
  })
})
