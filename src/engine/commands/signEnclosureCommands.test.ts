import { describe, it, expect } from 'vitest'
import { signEnclosureCommands } from './signEnclosureCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { fracCreate } from '@/utils/fraction'

/**
 * Subject: `./signEnclosureCommands` — what the commands add over `models/accidentalEnclosureOps`: ONE undo
 * entry per edit, labelled for what it did, and ⛔ none when nothing changed.
 */
describe('signEnclosureCommands', () => {
  const setup = () => {
    const ctx = fakeCommandContext()
    const a = ctx.score.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })
    const b = ctx.score.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: fracCreate(1, 1) })
    return { ctx, cmds: signEnclosureCommands(ctx), a, b }
  }

  it('toggle: several pitches, ONE entry; again takes them off, ONE entry', () => {
    const { ctx, cmds, a, b } = setup()
    expect(cmds.toggle([a.id, b.id])).toBe('round')
    expect(ctx.log).toEqual(['mutate:Bracket accidentals'])
    expect(cmds.toggle([a.id, b.id])).toBeNull()
    expect(ctx.log).toEqual(['mutate:Bracket accidentals', 'mutate:Remove accidental brackets'])
    expect(cmds.of(a.id)).toBeUndefined()
  })

  it('⛔ a refusal, or the same value, leaves no undo entry', () => {
    const { ctx, cmds, a } = setup()
    expect(cmds.toggle(['nobody'])).toBeUndefined()
    expect(cmds.set([a.id], null)).toBe(0)
    expect(ctx.undoEntries()).toBe(0)
  })
})
