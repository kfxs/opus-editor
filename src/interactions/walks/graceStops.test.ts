import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace } from '@/engine/models/graceOps'
import { buildBeatMap } from '@/utils/beatMap'
import { fracCreate as frac } from '@/utils/fraction'
import { locateStop, withGraceStops } from './graceStops'

describe('graceStops', () => {
  const setup = () => {
    const model = new ScoreModel()
    const c = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const score = model.getScore()
    const g = addGrace(score, e.id, 'before', { step: 'D', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    g.pitches.push({ id: 'g-upper', step: 'F', alter: 0, octave: 4 })
    const lane = withGraceStops(score, buildBeatMap(score, 0, 0).beats)
    return { score, c, e, g, lane }
  }

  it('⭐ a grace is ONE stop (its first pitch), before its main note', () => {
    const { c, e, g, lane } = setup()
    const ids = lane.stops.map(s => s.id)
    expect(ids.slice(0, 3)).toEqual([c.id, g.pitches[0].id, e.id])
    expect([...lane.graceIds]).toEqual([g.pitches[0].id])
  })

  it('⭐ locates a grace by ID (any of its pitches), its main note by POSITION — never the grace', () => {
    const { score, e, g, lane } = setup()
    expect(locateStop(score, lane, g.pitches[0].id, e)).toBe(1)
    expect(locateStop(score, lane, 'g-upper', e)).toBe(1)
    expect(locateStop(score, lane, e.id, e)).toBe(2)
  })
})
