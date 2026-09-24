// @vitest-environment jsdom
/**
 * Subject: `./EngravedArticulation` — a CUE note's articulation is drawn at its note's size
 * (docs/plans/cue-size-plan.md C5, P2), read off the SCENE: the glyph's font size.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { ScoreRenderer } from '../ScoreRenderer'
import { sceneGroups } from '@/engine/scene/Scene'
import { setCue } from '../../models/cueOps'
import { fracCreate as frac } from '@/utils/fraction'

describe('EngravedArticulation — on a cue note', () => {
  it('⭐ the mark is ¾ of the font on a cue note, full on a full one', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), articulations: ['staccato'] })
    const cue = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), articulations: ['accent'] })
    setCue(model.getScore(), [cue.id], true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const sizes = sceneGroups(scene, 'articulation')
      .flatMap(g => g.children)
      .flatMap(c => (c.kind === 'text' ? [Number(c.font.size)] : []))
    expect(sizes).toEqual([30, 22.5])
  })
})
