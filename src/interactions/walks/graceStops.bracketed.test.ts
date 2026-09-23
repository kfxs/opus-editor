import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace } from '@/engine/models/graceOps'
import { addBracketed } from '@/engine/models/bracketedGraceOps'
import { buildBeatMap } from '@/utils/beatMap'
import { fracCreate as frac } from '@/utils/fraction'
import { locateStop, withGraceStops } from './graceStops'

/**
 * Subject: `./graceStops` — the BRACKETED graces as stops (his report, 2026-09-23: *"i'm navigating but
 * the bracket is ignored"*), where they are drawn, and ⚠️ only for a caller that asks.
 */
describe('withGraceStops — bracketed graces', () => {
  const setup = () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const a = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g = addGrace(score, b.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
    const onGrace = addBracketed(score, g.pitches[0].id, 'before', { step: 'F', alter: 0, octave: 4 })!
    const before = addBracketed(score, b.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const after = addBracketed(score, b.id, 'after', { step: 'F', alter: 0, octave: 5 })!
    return { model, score, a, b, g, onGrace, before, after }
  }

  it('⭐ each one is a stop where it is DRAWN: (●) grace (●) note (●)', () => {
    const { score, a, b, g, onGrace, before, after } = setup()
    const lane = withGraceStops(score, buildBeatMap(score, 0, 0).beats, { bracketed: true })
    const ids = lane.stops.map(s => s.id)
    const from = ids.indexOf(a.id)
    expect(ids.slice(from, from + 6)).toEqual([a.id, onGrace.pitches[0].id, g.pitches[0].id, before.pitches[0].id, b.id, after.pitches[0].id])
  })

  it('⚠️ OPT-IN — a caller that does not ask (the slur walk) never lands on one', () => {
    const { score, onGrace, before, after } = setup()
    const ids = withGraceStops(score, buildBeatMap(score, 0, 0).beats).stops.map(s => s.id)
    for (const made of [onGrace, before, after]) expect(ids).not.toContain(made.pitches[0].id)
  })

  it('locateStop finds one by its ID — ⛔ never by position, which is its host\'s', () => {
    const { score, b, before } = setup()
    const lane = withGraceStops(score, buildBeatMap(score, 0, 0).beats, { bracketed: true })
    const at = locateStop(score, lane, before.pitches[0].id, { measure: 1, beat: frac(1, 1) })
    expect(lane.stops[at].id).toBe(before.pitches[0].id)
    expect(lane.stops[locateStop(score, lane, b.id, { measure: 1, beat: frac(1, 1) })].id).toBe(b.id)
  })
})
