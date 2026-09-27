import { describe, it, expect } from 'vitest'
import { circleSpine, straightSpine } from '@/engine/engrave/staff/staffSpine'
import { addHairpin } from '@/engine/models/hairpinOps'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { levelToGlyphString } from '@/utils/dynamics'
import type { Hairpin } from '@/types/music'
import { SPINE_HAIRPIN_CLASS } from './spineHairpins'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineHairpins` — a wedge on the spine (port map #15), its arms following the path. ⚠️ jsdom glyphs
 * are 0 wide: asserted are the arms' LANE and shape — the page's own dynamics line and aperture.
 */
const R = 250
const CX = 400
const CY = 400

/** ⚠️ FOUR bars, as a score is: with one bar stretched round the circle a single beat spans 90° of arc. */
function fourBarsOfQuarters(): ScoreModel {
  const m = new ScoreModel('spine')
  for (let i = 1; i < 4; i++) m.addMeasure()
  for (let bar = 1; bar <= 4; bar++) {
    for (let beat = 0; beat < 4; beat++) m.addNote({ step: 'B', octave: 4, duration: 'q', measure: bar, beat: { num: beat, den: 1 } })
  }
  return m
}

const wedge = (m: ScoreModel, type: Hairpin['type'], measure = 1, beat = 0, length = 4) =>
  addHairpin(m.getScore(), measure, { type, beat: { num: beat, den: 1 }, length: { num: length, den: 1 } })!

/** Each wedge's arms, as the lists of points they were stroked through. */
const armsOf = (m: ScoreModel, spine = circleSpine(CX, CY, R)) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), spine)
  return sceneGroups(recorder.scene, SPINE_HAIRPIN_CLASS).map(group =>
    scenePrimitives(group).flatMap(p => (p.kind === 'path' ? [p.ops.flatMap(op => ('x' in op ? [{ x: op.x, y: op.y }] : []))] : [])))
}

const radius = (p: { x: number; y: number }) => Math.hypot(p.x - CX, p.y - CY)

describe('drawScoreOnSpine — HAIRPINS (docs/plans/bent-staff-plan.md #15)', () => {
  it('draws one wedge per hairpin, two arms each', () => {
    const m = fourBarsOfQuarters()
    wedge(m, 'cresc')
    wedge(m, 'dim', 3)
    const wedges = armsOf(m)
    expect(wedges).toHaveLength(2)
    for (const arms of wedges) expect(arms).toHaveLength(2)
  })

  it('⭐ a cresc starts at a POINT and opens; a dim closes to one', () => {
    const m = fourBarsOfQuarters()
    wedge(m, 'cresc')
    const [[up, down]] = armsOf(m, straightSpine(0, 100, 1200))
    expect(up[0].y).toBeCloseTo(down[0].y, 6)
    expect(Math.abs(up[up.length - 1].y - down[down.length - 1].y)).toBeGreaterThan(STAFF_SPACE_PX / 2)

    const d = fourBarsOfQuarters()
    wedge(d, 'dim')
    const [[a, b]] = armsOf(d, straightSpine(0, 100, 1200))
    expect(a[a.length - 1].y).toBeCloseTo(b[b.length - 1].y, 6)
  })

  it('⭐⭐ the arms FOLLOW the path: round the circle, the tip of a cresc keeps ONE radius as it runs', () => {
    const m = fourBarsOfQuarters()
    wedge(m, 'cresc', 1, 0, 8)
    const [[up, down]] = armsOf(m)
    // Below the staff = INSIDE the loop; the two arms meet at the tip and part symmetrically about one arc.
    expect(radius(up[0])).toBeLessThan(R - 4 * STAFF_SPACE_PX)
    const mid = (i: number) => (radius(up[i]) + radius(down[i])) / 2
    expect(mid(up.length - 1)).toBeCloseTo(mid(0), 6)
    // …and it is an ARC, not a chord: the points turn through a real angle.
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y - CY, p.x - CX)
    expect(Math.abs(angle(up[up.length - 1]) - angle(up[0]))).toBeGreaterThan(0.5)
  })

  it('⭐ broken for an INTERIM dynamic — Gould p. 107: the dynamic cuts the wedge into two pieces', () => {
    const m = fourBarsOfQuarters()
    wedge(m, 'cresc', 1, 0, 8)
    expect(armsOf(m)[0]).toHaveLength(2)
    m.getScore().measures[1].dynamics = [{ id: 'mf', beat: { num: 0, den: 1 }, text: levelToGlyphString('mf') }]
    expect(armsOf(m)[0], 'two segments, two arms each').toHaveLength(4)
  })

  it('a wedge on the second staff stands on the INNER ring, below it', () => {
    const m = fourBarsOfQuarters()
    m.addStaffBelow(0)
    const lower = m.getScore().staves![1].id
    addHairpin(m.getScore(), 1, { type: 'cresc', beat: { num: 0, den: 1 }, length: { num: 4, den: 1 }, staffId: lower })
    wedge(m, 'cresc')
    const tips = armsOf(m).map(([up]) => radius(up[0])).sort((a, b) => a - b)
    expect(tips).toHaveLength(2)
    expect(tips[1] - tips[0]).toBeGreaterThan(8 * STAFF_SPACE_PX)
  })
})
