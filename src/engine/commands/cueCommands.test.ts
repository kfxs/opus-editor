import { describe, it, expect, vi } from 'vitest'
import { cueCommands } from './cueCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { ScoreModel } from '../models/ScoreModel'
import { fracCreate } from '@/utils/fraction'
import { makeEngine } from '@/testing/makeEngine'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./cueCommands` — what the commands add over `models/cueOps`: ONE undo entry per edit,
 * labelled for what it did, and ⛔ none when nothing changed.
 */
describe('cueCommands', () => {
  const setup = () => {
    const ctx = fakeCommandContext()
    const a = ctx.score.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })
    const b = ctx.score.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: fracCreate(1, 1) })
    return { ctx, cmds: cueCommands(ctx), a, b }
  }

  it('toggle: several notes, ONE entry; again back to full, ONE entry', () => {
    const { ctx, cmds, a, b } = setup()
    expect(cmds.toggle([a.id, b.id])).toBe(true)
    expect(ctx.log).toEqual(['mutate:Cue size'])
    expect(cmds.toggle([a.id, b.id])).toBe(false)
    expect(ctx.log).toEqual(['mutate:Cue size', 'mutate:Full size'])
    expect(cmds.of(a.id)).toBe(false)
  })

  it('set: the same value is no edit', () => {
    const { ctx, cmds, a } = setup()
    expect(cmds.set([a.id], true)).toBe(1)
    expect(cmds.set([a.id], true)).toBe(0)
    expect(ctx.undoEntries()).toBe(1)
  })

  it('through the facade (`engine.cue`): undo takes it back, redo returns it', () => {
    const engine = makeEngine()
    const n = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })!
    expect(engine.cue.toggle([n.id])).toBe(true)
    expect(engine.getNote(n.id)!.cue).toBe(true)
    expect(engine.undo()).toBe(true)
    expect(engine.getNote(n.id)!.cue).toBeUndefined()
    expect(engine.redo()).toBe(true)
    expect(engine.getNote(n.id)!.cue).toBe(true)
  })

  it('⛔ a refusal leaves no undo entry', () => {
    const { ctx, cmds } = setup()
    expect(cmds.toggle(['nobody'])).toBeUndefined()
    expect(cmds.set(['nobody'], true)).toBe(0)
    expect(ctx.undoEntries()).toBe(0)
  })

  it('it survives the JSON round trip', () => {
    const { ctx, cmds, a } = setup()
    cmds.set([a.id], true)
    const loaded = ScoreModel.fromJSON(ctx.score.toJSON())
    expect(loaded.getNote(a.id)!.cue).toBe(true)
  })
})
