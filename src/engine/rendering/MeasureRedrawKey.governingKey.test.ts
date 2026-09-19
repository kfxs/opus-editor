// @vitest-environment jsdom
/**
 * ⚠️⚠️ **THE GOVERNING KEY SIGNATURE IN THE SHAPE KEY** — the row that stops a key change at bar 1
 * leaving bar 40 drawn as it was (docs/key-signature-plan.md §1.3).
 *
 * `MEASURE_RENDER_ROLE` is **own-fields-only**: it asks what bar *N*'s field does to bar *N*'s keys.
 * A key signature is **INHERITED**, so bar 40's own fields never move when bar 1's signature does —
 * `laneFingerprint` is unchanged, `measureShapeKey` is unchanged, and P5 replays bar 40's cached
 * `<g>`: the new signature standing on the stave with the old accidentals underneath it, forever.
 *
 * ⭐ That is the **governing-CLEF bug verbatim**, which `ShapeKeyInputs.clef` already exists to
 * prevent — and which `measureRenderRoles.test.ts` cannot catch, because it perturbs a bar's OWN
 * fields and this one is a fact about a bar somewhere else.
 */
import { describe, it, expect } from 'vitest'
import type { Clef, Measure } from '@/types/music'
import { ScoreModel } from '../models/ScoreModel'
import { laneFingerprint } from '@/engine/layout/MeasureWidthCache'
import { measureShapeKey } from './MeasureRedrawKey'
import { C_MAJOR, keyAt, keyFromFifths } from '@/utils/keySignature'
import { fracCreate as frac } from '@/utils/fraction'

const G_MAJOR = keyFromFifths(1)

/** A score whose LAST bar holds an F — the note whose sign the signature decides. */
function scoreWithFarBar(bars: number): ScoreModel {
  const model = new ScoreModel()
  while (model.getScore().measures.length < bars) model.addMeasure()
  model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: bars, beat: frac(0, 1) })
  return model
}

/** The shape key of one bar, with the governing key resolved the way the renderer resolves it. */
const shapeKeyOf = (model: ScoreModel, n: number): string => {
  const view: Measure = model.getScore().measures.find(m => m.number === n)!
  return measureShapeKey(
    model.getScore(),
    {
      view, clef: 'treble' as Clef, staffIndex: 0, width: 300, isFirstInLine: false, scale: 1,
      key: keyAt(model.getScore(), n),
      hasClefChange: false,
    },
    null, null,
  )
}

describe('measureShapeKey — the governing key signature', () => {
  it('🚨 setting the key at bar 1 changes bar 40’s SHAPE key', () => {
    const model = scoreWithFarBar(40)
    const before = shapeKeyOf(model, 40)
    model.setKeyAt(1, G_MAJOR)
    expect(shapeKeyOf(model, 40)).not.toBe(before)
  })

  it('…and bar 40’s own fields did NOT move, which is exactly why the row is needed', () => {
    // The proof that no amount of staring at bar 40 could have answered this: its lane is byte-for
    // byte what it was. Only the inherited key changed, and only this row can see it.
    const model = scoreWithFarBar(40)
    const lane = () => model.getScore().measures.find(m => m.number === 40)!
    const widthKeyBefore = laneFingerprint(lane())
    model.setKeyAt(1, G_MAJOR)
    expect(laneFingerprint(lane()), 'bar 40’s own content is untouched').toBe(widthKeyBefore)
  })

  it('two DIFFERENT signatures give two different keys', () => {
    const model = scoreWithFarBar(4)
    const view: Measure = model.getScore().measures[3]
    const key = (k: typeof C_MAJOR) => measureShapeKey(
      model.getScore(),
      { view, clef: 'treble' as Clef, staffIndex: 0, width: 300, isFirstInLine: false, scale: 1, key: k, hasClefChange: false },
      null, null,
    )
    expect(key(keyFromFifths(1))).not.toBe(key(keyFromFifths(-1)))
    expect(key(C_MAJOR)).not.toBe(key({ alterations: [], mode: 'open' }))
  })

  it('the same signature twice is the same key — it is not a nonce', () => {
    const model = scoreWithFarBar(4)
    expect(shapeKeyOf(model, 4)).toBe(shapeKeyOf(model, 4))
  })
})
