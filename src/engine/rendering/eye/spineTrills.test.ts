import { describe, it, expect } from 'vitest'
import { circleSpine } from '@/engine/engrave/staff/staffSpine'
import { apply } from '@/engine/paint/Affine'
import { addOttava } from '@/engine/models/ottavaOps'
import { addTrill } from '@/engine/models/trillOps'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { SceneRecorder } from '@/engine/scene/SceneRecorder'
import { sceneGroups, scenePrimitives, type SceneGroup } from '@/engine/scene/Scene'
import { SPINE_TRILL_CLASS } from './spineTrills'
import { SPINE_OTTAVA_CLASS } from './spineOttavas'
import { SPINE_SIGN_PIECE_CLASS } from './spinePieces'
import { drawScoreOnSpine } from './spineScore'

/**
 * Subject: `./spineTrills` — a trill on the spine (port map #15). ⚠️ jsdom glyphs are 0 wide, so the wiggle
 * (whose count is its width over a glyph's) is not drawn here — asserted are the sign's LANE and the ladder.
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

/** A trill on bar 1's first note. */
const trill = (m: ScoreModel) => {
  const slot = m.getScore().measures[0].slots[0]
  if (slot.type !== 'chord') throw new Error('no note')
  return addTrill(m.getScore(), { startNoteId: slot.notes[0].id })!
}

const draw = (m: ScoreModel) => {
  const recorder = new SceneRecorder()
  drawScoreOnSpine(recorder, m.getScore(), circleSpine(CX, CY, R))
  return recorder.scene
}
/** The depth the group's first sign piece was drawn at (inside its piece, before the placement). */
const signDepth = (group: SceneGroup) => {
  const piece = sceneGroups(group, SPINE_SIGN_PIECE_CLASS)[0]
  const text = scenePrimitives(piece).find(p => p.kind === 'text')
  return text && text.kind === 'text' ? text.y : NaN
}

describe('drawScoreOnSpine — TRILLS (docs/plans/bent-staff-plan.md #15)', () => {
  it('draws the tr sign ABOVE the staff — outside the loop', () => {
    const m = fourBarsOfQuarters()
    trill(m)
    const [group] = sceneGroups(draw(m), SPINE_TRILL_CLASS)
    expect(signDepth(group)).toBeLessThan(0)
    const piece = sceneGroups(group, SPINE_SIGN_PIECE_CLASS)[0]
    const at = apply(piece.placement, 0, signDepth(group))
    expect(Math.hypot(at.x - CX, at.y - CY)).toBeGreaterThan(R)
  })

  it('⭐⭐ the LADDER: the trill is the innermost rung — an 8va over it stands further OUT', () => {
    const alone = fourBarsOfQuarters()
    addOttava(alone.getScore(), 1, { shift: 1, beat: { num: 0, den: 1 }, length: { num: 4, den: 1 } })
    const withTrill = fourBarsOfQuarters()
    addOttava(withTrill.getScore(), 1, { shift: 1, beat: { num: 0, den: 1 }, length: { num: 4, den: 1 } })
    trill(withTrill)
    const ottavaDepth = (m: ScoreModel) => signDepth(sceneGroups(draw(m), SPINE_OTTAVA_CLASS)[0])
    expect(ottavaDepth(withTrill)).toBeLessThan(ottavaDepth(alone)) // further up = further out
    expect(signDepth(sceneGroups(draw(withTrill), SPINE_TRILL_CLASS)[0])).toBeGreaterThan(ottavaDepth(withTrill))
  })
})
