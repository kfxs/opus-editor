// @vitest-environment jsdom
/**
 * 🚨 **A TUPLET's OFFSET IN THE SHAPE KEY.** It is keyed by the tuplet's uuid — not a slot id, not a position
 * key — so without its own row a nudge changes nothing in the key, the bar replays its drawn `<g>`, and the
 * bracket sits still while the model moves. His report, 2026-09-25, within the hour of the feature: *"i dont
 * see any change in the drawing"* — the model at −7, the picture at 0. The grace's spec, one kind over.
 */
import { describe, it, expect } from 'vitest'
import type { Clef, Measure } from '@/types/music'
import { ScoreModel } from '../models/ScoreModel'
import { nudgeTupletOffset } from '../models/overrideOps'
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

describe('measureShapeKey — a tuplet\'s offset', () => {
  it('🚨 nudging a tuplet changes its bar\'s SHAPE key — and taking the nudge back changes it again', () => {
    const model = new ScoreModel()
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)!
    const before = shapeKeyOf(model)
    nudgeTupletOffset(model.getScore(), tuplet.id, -1)
    const nudged = shapeKeyOf(model)
    expect(nudged).not.toBe(before)
    nudgeTupletOffset(model.getScore(), tuplet.id, 1)
    expect(shapeKeyOf(model), 'back to absent = the key it had').toBe(before)
  })
})
