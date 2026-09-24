// @vitest-environment jsdom
/**
 * Subject: `./GracePass` — a CUE grace group is DRAWN at its size (cue-size-plan C4, P4a): its `grace` group's
 * placement is `scaling(k)` at the group's size, read off the SCENE — ½ for all-cue (`multiply`), 2/3 otherwise.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { ScoreRenderer } from './ScoreRenderer'
import { sceneGroups } from '@/engine/scene/Scene'
import { addGrace } from '../models/graceOps'
import { setCue } from '../models/cueOps'
import { GRACE_GROUP } from './GracePass'
import { fracCreate as frac } from '@/utils/fraction'

describe('GracePass — a cue grace group', () => {
  it('⭐ drawn at the cue-grace size (½) when every grace is cue; ⛔ the grace size (2/3) when mixed', () => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    const hosts = [1, 2, 3].map(bar => model.addNote({ step: 'C', octave: 5, duration: 'q', measure: bar, beat: frac(0, 1) }))
    const graces = hosts.map(h => [0, 1].map(() =>
      addGrace(model.getScore(), h.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!))
    // Bar 1 plain, bar 2 all cue, bar 3 one cue.
    setCue(model.getScore(), [...graces[1].map(g => g.pitches[0].id), graces[2][0].pitches[0].id], true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new ScoreRenderer(container)
    renderer.initialize(1200, 800)
    const { scene } = renderer.recordScene(() => renderer.renderScore(model.getScore()))
    const scales = sceneGroups(scene, GRACE_GROUP).map(g => g.placement.a)
    expect(scales).toHaveLength(3)
    expect(scales[0]).toBeCloseTo(2 / 3, 10)
    expect(scales[1]).toBeCloseTo(0.5, 10)
    expect(scales[2]).toBeCloseTo(2 / 3, 10)
  })
})
