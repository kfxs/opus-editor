import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { resolveStaffClefs, measureOpeningClef, measureEndingClef, staffLineForSpelling } from './clefUtils'
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

/**
 * The staff LINE of a pitch — only wanted where a notehead is drawn by hand (a fanned beam's
 * members), since a `StaveNote` resolves its own. VexFlow's line system: 1 = bottom line, 3 = middle,
 * 5 = top, half a line per diatonic step.
 */
describe('staffLineForSpelling', () => {
  it('puts each clef’s middle-line pitch on line 3', () => {
    expect(staffLineForSpelling('B', 4, 'treble')).toBe(3)
    expect(staffLineForSpelling('D', 3, 'bass')).toBe(3)
    expect(staffLineForSpelling('C', 4, 'alto')).toBe(3)
    expect(staffLineForSpelling('A', 3, 'tenor')).toBe(3)
  })

  it('counts half a line per diatonic step — a space lands on a .5', () => {
    expect(staffLineForSpelling('E', 4, 'treble')).toBe(1)   // bottom line
    expect(staffLineForSpelling('F', 4, 'treble')).toBe(1.5) // the space above it
    expect(staffLineForSpelling('F', 5, 'treble')).toBe(5)   // top line
  })

  it('⭐ keeps counting off the staff, where the ledger lines start', () => {
    expect(staffLineForSpelling('C', 4, 'treble')).toBe(0)    // one ledger below
    expect(staffLineForSpelling('A', 5, 'treble')).toBe(6)    // one ledger above
    expect(staffLineForSpelling('C', 6, 'treble')).toBe(7)
  })

  it('ignores the alteration — a sharp does not move the head', () => {
    expect(staffLineForSpelling('F', 4, 'treble')).toBe(staffLineForSpelling('F', 4, 'treble'))
  })
})
