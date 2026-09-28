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
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toEqual({ start: 1, end: 1 })
    expect(ctx.log).toEqual(['mutate:Nudge beam'])
  })

  it('⭐ …and DOWN is away for a beam below them (his report: a flip must keep the meaning)', () => {
    ctx.drawn = [line(100), stem(101), stem(138)] // the beam below the stems' middle: stems down
    beam.nudgeBeam(anchor, 1)
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toEqual({ start: 1, end: 1 })
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
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toEqual({ start: 0, end: 0 })
    expect(ctx.log[ctx.log.length - 1]).toBe('mutate:Reset beam position')
  })
})

describe('beamCommands — a square dragged (his ask, 2026-09-28: the angle)', () => {
  it('⭐ every frame writes one end and flags dirty — no undo entry; the drop records ONE', () => {
    const ctx = fakeCommandContext()
    const anchor = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) }).id
    const beam = beamCommands(ctx)
    expect(beam.previewBeamEnd(anchor, 'end', 0.5)).toBe(true)
    expect(beam.previewBeamEnd(anchor, 'end', 1.25)).toBe(true)
    expect(beam.offsetOf(anchor)).toEqual({ start: 0, end: 1.25 })
    expect(ctx.undoEntries()).toBe(0)
    beam.commitBeamEndDrag()
    expect(ctx.log).toEqual(['dirty', 'dirty', 'previewed:Angle beam'])
  })
})

describe('beamCommands.nudgeBeamEnd — the arrows on a PICKED square (his ask, 2026-09-28)', () => {
  const setUp = () => {
    const ctx = fakeCommandContext()
    const anchor = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) }).id
    return { ctx, anchor, beam: beamCommands(ctx) }
  }

  it('⭐ moves ONE end — the other stays — screen-up being AWAY for a beam above its stems; one undo entry', () => {
    const { ctx, anchor, beam } = setUp()
    ctx.drawn = [
      { type: 'beamGroup', noteId: anchor, measure: 1, staff: 0, bbox: { x: 100, y: 55, width: 40, height: 5 } },
      { type: 'stem', noteId: 'a', measure: 1, staff: 0, bbox: { x: 101, y: 60, width: 1.5, height: 35 } },
    ]
    expect(beam.nudgeBeamEnd(anchor, 'end', -1)).toBe(true)
    expect(beamOffsetOf(ctx.score.getScore(), anchor)).toEqual({ start: 0, end: 1 })
    expect(ctx.log).toEqual(['mutate:Angle beam'])
  })

  it('⭐ refuses a step past the stem FLOOR, with nothing written', () => {
    const { ctx, anchor } = setUp()
    const lines = [{ type: 'beamGroup' as const, noteId: anchor, measure: 1, staff: 0, bbox: { x: 100, y: 55, width: 40, height: 5 } }]
    // Two stems 3 spaces long (floor 2½): the end may give ½ space toward the heads, no more.
    ctx.drawn = [...lines,
      { type: 'stem', noteId: 'a', measure: 1, staff: 0, bbox: { x: 100, y: 55, width: 1.5, height: 30 } },
      { type: 'stem', noteId: 'b', measure: 1, staff: 0, bbox: { x: 139, y: 55, width: 1.5, height: 30 } }]
    const withGeometry = { ...ctx, registry: () => ({ ...ctx.registry(), getStaffGeometry: () => ({ lineSpacing: 10, lineYPositions: [] }) }) }
    const commands = beamCommands(withGeometry)
    expect(commands.nudgeBeamEnd(anchor, 'end', 1)).toBe(false)
    expect(ctx.log).toEqual([])
    expect(commands.nudgeBeamEnd(anchor, 'end', 0.5)).toBe(true)
  })
})

describe('beamCommands — the whole beam dragged (his ask, 2026-09-28)', () => {
  it('⭐ each frame sets BOTH ends and flags dirty — no undo; the drop records ONE', () => {
    const ctx = fakeCommandContext()
    const anchor = ctx.score.addNote({ step: 'C', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) }).id
    const beam = beamCommands(ctx)
    beam.previewBeamOffset(anchor, 1, 0.5)
    beam.previewBeamOffset(anchor, 2, 1.5)
    expect(beam.offsetOf(anchor)).toEqual({ start: 2, end: 1.5 })
    beam.commitBeamDrag()
    expect(ctx.log).toEqual(['dirty', 'dirty', 'previewed:Move beam'])
  })
})
