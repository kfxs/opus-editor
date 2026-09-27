import { describe, it, expect } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { apply } from '@/engine/paint/Affine'
import { addPedal } from '@/engine/models/pedalOps'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { levelToGlyphString } from '@/utils/dynamics'
import { SPINE_PEDAL_CLASS } from './spinePedals'
import { SPINE_SIGN_PIECE_CLASS } from './spinePieces'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spinePedals` — a pedal's two signs on the spine (port map #15). ⚠️ jsdom glyphs are 0 wide:
 * asserted are the signs' LANE, their order along the path and the ladder — ⛔ never a glyph's width.
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

const pedal = (m: ScoreModel, measure = 1, length = 6) =>
  addPedal(m.getScore(), measure, { beat: { num: 0, den: 1 }, length: { num: length, den: 1 } })!

/** Each sign of the (first) pedal: where it stands on the page, and the depth it was drawn at. */
const signsOf = (m: ScoreModel) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), circleSpine(CX, CY, R))
  const group = sceneGroups(recorder.scene, SPINE_PEDAL_CLASS)[0]
  return sceneGroups(group, SPINE_SIGN_PIECE_CLASS).map((piece: SceneGroup) => {
    const text = scenePrimitives(piece).find(p => p.kind === 'text')
    const depth = text && text.kind === 'text' ? text.y : NaN
    const at = apply(piece.placement, 0, 0)
    return { depth, angle: Math.atan2(at.y - CY, at.x - CX), placedRadius: Math.hypot(at.x - CX, at.y - CY) }
  })
}

describe('drawScoreOnSpine — PEDAL marks (docs/plans/bent-staff-plan.md #15)', () => {
  it('draws the Ped. and its release, each a rigid piece, BELOW the staff (inside the loop)', () => {
    const m = fourBarsOfQuarters()
    pedal(m)
    const [down, up] = signsOf(m)
    expect(down.depth).toBeGreaterThan(4 * STAFF_SPACE_PX)
    expect(up.depth).toBeCloseTo(down.depth, 9)
    // …the release further along the path (clockwise = a larger angle, modulo the seam).
    const turn = (up.angle - down.angle + 2 * Math.PI) % (2 * Math.PI)
    expect(turn).toBeGreaterThan(0.5)
  })

  it('⭐ the LADDER: the pedal is the outermost rung — a dynamic under the same notes pushes it further in', () => {
    const plain = fourBarsOfQuarters()
    pedal(plain)
    const withDynamic = fourBarsOfQuarters()
    pedal(withDynamic)
    withDynamic.getScore().measures[0].dynamics = [{ id: 'd', beat: { num: 0, den: 1 }, text: levelToGlyphString('f') }]
    expect(signsOf(withDynamic)[0].depth).toBeGreaterThan(signsOf(plain)[0].depth)
  })
})
