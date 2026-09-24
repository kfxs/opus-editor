// @vitest-environment jsdom
/**
 * Subject: `./BracketedGracePass` — a CUE bracketed grace is drawn at its OWN size (cue-size-plan C4, P4b): the
 * cue-grace preset applied to the bracketed size (`multiply`: 2/3 × ¾ = ½), read off the SCENE as its group's
 * `scaling(k)`; the plain one beside it keeps 2/3.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { sceneGroups } from '@/engine/scene/Scene'
import { addBracketed } from '../models/bracketedGraceOps'
import { setCue } from '../models/cueOps'
import { resetCueSize, setGraceCueSize } from '@/engine/layout/cueSize'
import { BRACKETED_NOTE_GROUP } from './BracketedGracePass'
import { fracCreate as frac } from '@/utils/fraction'

describe('BracketedGracePass — a cue bracketed grace', () => {
  afterEach(() => resetCueSize())

  function scales(): number[] {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const [plain, cue] = (['D', 'E'] as const).map(step => addBracketed(model.getScore(), host.id, 'before', { step, alter: 0, octave: 5 })!)
    expect(plain).toBeTruthy()
    setCue(model.getScore(), [cue.pitches[0].id], true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    return sceneGroups(scene, BRACKETED_NOTE_GROUP).map(g => g.placement.a)
  }

  it('⭐ `multiply`: the cue one at ½, the plain one at 2/3', () => {
    const [plain, cue] = scales()
    expect(plain).toBeCloseTo(2 / 3, 10)
    expect(cue).toBeCloseTo(0.5, 10)
  })

  it('⭐ the preset reaches it: `graceWins` draws it at the bracketed size', () => {
    setGraceCueSize('graceWins')
    const [, cue] = scales()
    expect(cue).toBeCloseTo(2 / 3, 10)
  })
})
