import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { graceCommands } from './graceCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

describe('graceCommands.addGrace', () => {
  it('⭐ adds the grace and leaves ONE undo entry, named by its form', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const ctx = fakeCommandContext(model)
    const grace = graceCommands(ctx).addGrace(host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'acciaccatura', { duration: '8' })
    expect(grace).not.toBeNull()
    expect(ctx.undoEntries()).toBe(1)
    expect(ctx.log[ctx.log.length - 1]).toContain('Add acciaccatura')
  })

  it('⛔ a refusal (a grace AFTER a rest) leaves no undo entry', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    const ctx = fakeCommandContext(model)
    expect(graceCommands(ctx).addGrace(rest.id, 'after', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })).toBeNull()
    expect(ctx.undoEntries()).toBe(0)
  })

  it('⭐ on an EMPTY bar, the whole-bar rest becomes a ONE-BEAT rest at the clicked beat — one undo entry (his rule)', () => {
    const model = new ScoreModel()
    const measureRest = model.getMeasure(1)!.slots[0]
    expect(measureRest.type === 'rest' && measureRest.isMeasureRest).toBe(true)
    const ctx = fakeCommandContext(model)
    const grace = graceCommands(ctx).addGrace(measureRest.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' }, frac(1, 1))
    expect(grace).not.toBeNull()
    const shape = model.getMeasure(1)!.slots.map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}${s.type === 'rest' && s.graceBefore ? '+grace' : ''}`)
    expect(shape).toEqual(['rest@0:q', 'rest@1:q+grace', 'rest@2:h'])
    expect(ctx.undoEntries()).toBe(1)
  })
})

describe('graceCommands.previewOffset / commitOffset', () => {
  const setup = () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const ctx = fakeCommandContext(model)
    const grace = graceCommands(ctx).addGrace(host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    ctx.log.length = 0
    return { model, host, ctx, graceId: grace.pitches[0].id }
  }

  it('⭐ a drag frame writes the grace\'s OWN offset, flags dirty, records nothing; the drop records ONE entry', () => {
    const { model, host, ctx, graceId } = setup()
    const cmds = graceCommands(ctx)
    expect(cmds.previewOffset(graceId, -0.5)).toBe(true)
    expect(cmds.previewOffset(graceId, -1)).toBe(true)
    expect(model.getScore().engravingOverrides?.[graceId]).toEqual([{ kind: 'noteOffset', x: -1 }])
    // …and its main note is NOT moved.
    expect(model.getScore().engravingOverrides?.[model.offsetTargetOf(host.id)!.key]).toBeUndefined()
    expect(ctx.undoEntries()).toBe(0)
    cmds.commitOffset()
    expect(ctx.log).toEqual(['dirty', 'dirty', 'previewed:Nudge grace'])
  })

  it('⛔ refuses a NON-grace (a note\'s horizontal drag is its column\'s spacing) and an unchanged value', () => {
    const { host, ctx, graceId } = setup()
    const cmds = graceCommands(ctx)
    expect(cmds.previewOffset(host.id, 1)).toBe(false)
    expect(cmds.previewOffset(graceId, 0)).toBe(false)
    expect(ctx.log).toEqual([])
  })

  it('⛔ a frame the page limit refuses writes nothing', () => {
    const { model, ctx, graceId } = setup()
    ctx.allow.page = false
    expect(graceCommands(ctx).previewOffset(graceId, 3)).toBe(false)
    expect(model.getScore().engravingOverrides?.[graceId]).toBeUndefined()
  })
})

describe('graceCommands.addGracePitch', () => {
  it('⭐ one undo entry, and the armed marks JOIN the grace\'s own; a refusal leaves none', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const ctx = fakeCommandContext(model)
    const cmds = graceCommands(ctx)
    const grace = cmds.addGrace(host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' }, undefined, ['staccato'])!
    ctx.log.length = 0
    expect(cmds.addGracePitch(grace.pitches[0].id, { step: 'F', alter: 0, octave: 5 }, undefined, ['staccato', 'accent'])).not.toBeNull()
    expect(grace.articulations).toEqual(['staccato', 'accent'])
    expect(ctx.log).toEqual(['mutate:Add grace chord note'])
    expect(cmds.addGracePitch(grace.pitches[0].id, { step: 'F', alter: 0, octave: 5 })).toBeNull()
    expect(ctx.undoEntries()).toBe(1)
  })
})
