import { describe, it, expect } from 'vitest'
import { bracketedCommands } from './bracketedCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { fracCreate } from '@/utils/fraction'

/**
 * Subject: `./bracketedCommands` — what the commands add over `models/bracketedGraceOps`: ONE undo
 * entry per edit, and ⛔ none on a refusal.
 */
describe('bracketedCommands', () => {
  const Bb3 = { step: 'B' as const, alter: -1 as const, octave: 3 }
  const D5 = { step: 'D' as const, alter: 0 as const, octave: 5 }

  const setup = () => {
    const ctx = fakeCommandContext()
    const host = ctx.score.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })
    return { ctx, cmds: bracketedCommands(ctx), host }
  }

  it('add: one undo entry, labelled', () => {
    const { ctx, cmds, host } = setup()
    expect(cmds.add(host.id, 'before', Bb3)).not.toBeNull()
    expect(ctx.log).toEqual(['mutate:Add bracketed grace'])
  })

  it('⛔ a refusal leaves no undo entry', () => {
    const { ctx, cmds } = setup()
    expect(cmds.add('nobody', 'before', Bb3)).toBeNull()
    expect(cmds.remove(['nobody'])).toBe(false)
    expect(cmds.setPitch('nobody', D5)).toBe(false)
    expect(ctx.undoEntries()).toBe(0)
  })

  it('remove: several heads, ONE entry', () => {
    const { ctx, cmds, host } = setup()
    const a = cmds.add(host.id, 'before', Bb3)!
    const b = cmds.add(host.id, 'after', D5)!
    const ids = [a.pitches[0].id, b.pitches[0].id]
    ctx.log.length = 0
    expect(cmds.remove(ids)).toBe(true)
    expect(ctx.log).toEqual(['mutate:Delete bracketed grace'])
    expect(cmds.isBracketed(ids[0])).toBe(false)
  })

  it('addPitch and setPitch: one entry each; the same spelling is none', () => {
    const { ctx, cmds, host } = setup()
    const a = cmds.add(host.id, 'before', Bb3)!
    ctx.log.length = 0
    cmds.addPitch(a.pitches[0].id, D5)
    cmds.setPitch(a.pitches[0].id, { step: 'A', alter: 0, octave: 3 })
    cmds.setPitch(a.pitches[0].id, { step: 'A', alter: 0, octave: 3 })
    expect(ctx.log).toEqual(['mutate:Add bracketed pitch', 'mutate:Bracketed pitch'])
  })
})
