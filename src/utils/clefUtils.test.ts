import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { resolveStaffClefs, measureOpeningClef, measureEndingClef } from './clefUtils'
import { fracCreate as frac } from './fraction'
import type { Score } from '@/types/music'

/**
 * `resolveStaffClefs` exists for speed: the per-measure helpers inherit by scanning *backwards*
 * over every earlier measure (and each step re-`find`s the measure), so asking them for every
 * measure — which the layout and the render loop both do, per staff — is cubic over the score.
 * The fold carries the clef forward instead.
 *
 * Being a pure optimization, the only thing worth asserting is that it is EQUIVALENT to what it
 * replaces — including at the edges: a change at beat 0 (which IS its measure's opening clef), a
 * mid-measure change (which is not, but is still carried out), inheritance across measures, and a
 * second staff that must not see the first staff's clefs.
 */
function agreesWithPerMeasureHelpers(score: Score, staffId?: string) {
  const resolved = resolveStaffClefs(score, staffId)
  for (const m of score.measures) {
    expect(resolved.opening.get(m.number)).toBe(measureOpeningClef(score, m.number, staffId))
    expect(resolved.ending.get(m.number)).toBe(measureEndingClef(score, m.number, staffId))
  }
}

function scoreOf(measures: number): ScoreModel {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measures) model.addMeasure()
  return model
}

describe('resolveStaffClefs — one forward pass, same answers', () => {
  it('a score with no clef changes at all: treble everywhere', () => {
    agreesWithPerMeasureHelpers(scoreOf(5).getScore())
  })

  it('a clef change at beat 0 opens its own measure, and is inherited onward', () => {
    const model = scoreOf(5)
    model.setClef(3, 'bass')
    const score = model.getScore()

    const resolved = resolveStaffClefs(score)
    expect(resolved.opening.get(2)).toBe('treble')
    expect(resolved.opening.get(3)).toBe('bass') // the change AT beat 0 IS the opening clef
    expect(resolved.ending.get(3)).toBe('bass')
    expect(resolved.opening.get(4)).toBe('bass') // inherited, with no change of its own
    agreesWithPerMeasureHelpers(score)
  })

  it('a mid-measure change does not open its measure, but IS carried out of it', () => {
    const model = scoreOf(4)
    model.setClefAt(2, frac(2, 1), 'bass') // beat 2, not beat 0
    const score = model.getScore()

    const resolved = resolveStaffClefs(score)
    expect(resolved.opening.get(2)).toBe('treble') // still treble at its first beat
    expect(resolved.ending.get(2)).toBe('bass')    // but bass is carried onward
    expect(resolved.opening.get(3)).toBe('bass')
    agreesWithPerMeasureHelpers(score)
  })

  it('staves do not inherit each other\'s clefs', () => {
    const model = scoreOf(4)
    const staff1 = model.addStaffBelow(0)
    model.setClef(2, 'bass', staff1) // staff 1 only
    const score = model.getScore()
    const staff0 = score.staves![0].id

    expect(resolveStaffClefs(score, staff1).opening.get(3)).toBe('bass')
    expect(resolveStaffClefs(score, staff0).opening.get(3)).toBe('treble')
    agreesWithPerMeasureHelpers(score, staff0)
    agreesWithPerMeasureHelpers(score, staff1)
  })
})
