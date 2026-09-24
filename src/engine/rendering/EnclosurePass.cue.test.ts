// @vitest-environment jsdom
/**
 * Subject: `./EnclosurePass` — a CUE head's brackets are STAMPED at the armed C11 row's size (cue-size-plan P4b):
 * `gould` (default) full size, `shrink` the head's — read off the SCENE as the glyphs' font size.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { sceneGroups, scenePrimitives } from '@/engine/scene/Scene'
import { setCue } from '../models/cueOps'
import { setEnclosure } from '../models/enclosureOps'
import { resetCueSize, setCueBrackets } from '@/engine/layout/cueSize'
import { ENCLOSURE_GROUP } from './EnclosurePass'
import { fracCreate as frac } from '@/utils/fraction'

describe('EnclosurePass — a cue head’s brackets', () => {
  afterEach(() => resetCueSize())

  /** Bar 1: a bracketed B4, bar 2: the same, cue. The brackets' font sizes, per bar. */
  function bracketSizes(): number[][] {
    const model = new ScoreModel()
    model.addMeasure()
    const notes = [1, 2].map(bar => model.addNote({ step: 'B', octave: 4, duration: 'q', measure: bar, beat: frac(0, 1) }))
    setEnclosure(model.getScore(), notes.map(n => n.id), 'round')
    setCue(model.getScore(), [notes[1].id], true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    return sceneGroups(scene, ENCLOSURE_GROUP).map(g => scenePrimitives(g).flatMap(c => (c.kind === 'text' ? [Number(c.font.size)] : [])))
  }

  it('⭐ `gould`: the cue head’s brackets are full size', () => {
    expect(bracketSizes()).toEqual([[30, 30], [30, 30]])
  })

  it('⭐ `shrink`: they are the head’s ¾', () => {
    setCueBrackets('shrink')
    expect(bracketSizes()).toEqual([[30, 30], [22.5, 22.5]])
  })
})
