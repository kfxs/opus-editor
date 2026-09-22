// @vitest-environment jsdom
/**
 * 🚨 **A GRACE's OFFSET IN THE SHAPE KEY.** It is keyed by the grace's own first pitch id
 * (`ScoreModel.offsetTargetOf`) — not a slot id, not a position key — so without its own row a
 * nudge changes nothing in the key, the bar replays its drawn `<g>`, and the grace sits still while
 * the model moves (the fanned member's trap, one level in).
 */
import { describe, it, expect } from 'vitest'
import type { Clef, Measure } from '@/types/music'
import { ScoreModel } from '../models/ScoreModel'
import { addGrace } from '../models/graceOps'
import { measureShapeKey } from './MeasureRedrawKey'
import { C_MAJOR } from '@/utils/keySignature'
import { fracCreate as frac } from '@/utils/fraction'

const shapeKeyOf = (model: ScoreModel): string => {
  const view: Measure = model.getScore().measures[0]
  return measureShapeKey(
    model.getScore(),
    { view, clef: 'treble' as Clef, staffIndex: 0, width: 300, isFirstInLine: false, scale: 1, key: C_MAJOR, hasClefChange: false },
    null, null,
  )
}

describe('measureShapeKey — a grace\'s offset', () => {
  it('🚨 nudging a grace changes its bar\'s SHAPE key', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const grace = addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const before = shapeKeyOf(model)
    model.nudgeNoteOffset(model.offsetTargetOf(grace.pitches[0].id)!.key, -1)
    expect(shapeKeyOf(model)).not.toBe(before)
  })
})
