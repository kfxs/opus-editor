import { describe, it, expect, beforeEach } from 'vitest'
import { beamCommands, type BeamCommands } from './beamCommands'
import { fakeCommandContext, type FakeCommandContext } from './fakeCommandContext'
import { beamOffsetOf } from '../models/beamOffsetOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo } from '../ElementRegistry'

/** Subject: `./beamCommands` — the arrows on a selected beam (his ask, 2026-09-28). */
describe('beamCommands', () => {
  let ctx: FakeCommandContext
  let beam: BeamCommands
  let anchor: string

  const line = (y: number): ElementInfo => ({ type: 'beamGroup', noteId: anchor, measure: 1, staff: 0, bbox: { x: 100, y, width: 40, height: 5 } })
  const stem = (x: number): ElementInfo => ({ type: 'stem', noteId: 'x', measure: 1, staff: 0, bbox: { x, y: 60, width: 1.5, height: 35 } })

  beforeEach(() => {
    ctx = fakeCommandContext()
    anchor = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) }).id
    beam = beamCommands(ctx)
  })

  it('⭐ a SCREEN step becomes a step AWAY from the heads — up is away for a beam above its stems', () => {
    ctx.drawn = [line(55), stem(101), stem(138)] // the beam above the stems' middle: stems up
    expect(beam.nudgeBeam(anchor, -1)).toBe(true)
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toBe(1)
    expect(ctx.log).toEqual(['mutate:Nudge beam'])
  })

  it('⭐ …and DOWN is away for a beam below them (his report: a flip must keep the meaning)', () => {
    ctx.drawn = [line(100), stem(101), stem(138)] // the beam below the stems' middle: stems down
    beam.nudgeBeam(anchor, 1)
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toBe(1)
  })

  it('the band limit refuses with nothing written; reset puts it back and says false when never moved', () => {
    ctx.drawn = [line(55)]
    ctx.allow.band = false
    expect(beam.nudgeBeam(anchor, -1)).toBe(false)
    expect(ctx.log).toEqual([])
    ctx.allow.band = true
    expect(beam.resetBeamOffset(anchor)).toBe(false)
    beam.nudgeBeam(anchor, -1)
    expect(beam.resetBeamOffset(anchor)).toBe(true)
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toBe(0)
    expect(ctx.log[ctx.log.length - 1]).toBe('mutate:Reset beam position')
  })
})
