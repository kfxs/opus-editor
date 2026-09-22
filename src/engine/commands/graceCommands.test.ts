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
