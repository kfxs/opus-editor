import { describe, it, expect } from 'vitest'
import { enclosureCommands } from './enclosureCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { ScoreModel } from '../models/ScoreModel'
import { fracCreate } from '@/utils/fraction'

/**
 * Subject: `./enclosureCommands` — what the commands add over `models/enclosureOps`: ONE undo entry per
 * edit, labelled for what it did, and ⛔ none when nothing changed.
 */
describe('enclosureCommands', () => {
  const setup = () => {
    const ctx = fakeCommandContext()
    const a = ctx.score.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })
    const b = ctx.score.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: fracCreate(1, 1) })
    return { ctx, cmds: enclosureCommands(ctx), a, b }
  }

  it('toggle: several heads, ONE entry; again takes them off, ONE entry', () => {
    const { ctx, cmds, a, b } = setup()
    expect(cmds.toggle([a.id, b.id])).toBe('round')
    expect(ctx.log).toEqual(['mutate:Parenthesise notes'])
    expect(cmds.toggle([a.id, b.id])).toBeNull()
    expect(ctx.log).toEqual(['mutate:Parenthesise notes', 'mutate:Remove parentheses'])
    expect(cmds.of(a.id)).toBeUndefined()
  })

  it('set: the same value is no edit', () => {
    const { ctx, cmds, a } = setup()
    expect(cmds.set([a.id], 'round')).toBe(1)
    expect(cmds.set([a.id], 'round')).toBe(0)
    expect(ctx.undoEntries()).toBe(1)
  })

  it('⛔ a refusal leaves no undo entry', () => {
    const { ctx, cmds } = setup()
    expect(cmds.toggle(['nobody'])).toBeUndefined()
    expect(cmds.set(['nobody'], 'round')).toBe(0)
    expect(ctx.undoEntries()).toBe(0)
  })

  it('it survives the JSON round trip', () => {
    const { ctx, cmds, a } = setup()
    cmds.set([a.id], 'round')
    const loaded = ScoreModel.fromJSON(ctx.score.toJSON())
    expect(loaded.getNote(a.id)!.enclosure).toBe('round')
  })
})
