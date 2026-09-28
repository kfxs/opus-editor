import { describe, it, expect, vi } from 'vitest'
import { glyphMarkCommands } from './glyphMarkCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { fracCreate } from '@/utils/fraction'
import { makeEngine } from '@/testing/makeEngine'

vi.mock('../rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./glyphMarkCommands` — what the commands add over `models/glyphMarkOps`: the drawable-glyph
 * check the score layer may not make, ONE undo entry per add, and ⛔ none on a refusal.
 */
describe('glyphMarkCommands', () => {
  const setup = () => {
    const ctx = fakeCommandContext()
    const n = ctx.score.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })
    return { ctx, cmds: glyphMarkCommands(ctx), n }
  }

  it('add: one undo entry per symbol, and the same glyph twice is two symbols', () => {
    const { ctx, cmds, n } = setup()
    expect(cmds.add(n.id, 'pictGlsp')).not.toBeNull()
    expect(cmds.add(n.id, 'pictGlsp')).not.toBeNull()
    expect(ctx.log).toEqual(['mutate:Add symbol', 'mutate:Add symbol'])
    expect(ctx.score.getScore().measures[0].glyphMarks).toHaveLength(2)
  })

  it('⛔ refuses a glyph that draws nothing, or an id that names no event — and leaves no undo entry', () => {
    const { ctx, cmds, n } = setup()
    expect(cmds.canDraw('controlBeginBeam')).toBe(false)
    expect(cmds.add(n.id, 'controlBeginBeam')).toBeNull()
    expect(cmds.add(n.id, 'notAGlyph')).toBeNull()
    expect(cmds.add('nope', 'pictGlsp')).toBeNull()
    expect(ctx.undoEntries()).toBe(0)
    expect(ctx.score.getScore().measures[0].glyphMarks).toBeUndefined()
  })

  it('remove / flip: one undo entry each, and ⛔ none for an id that names no symbol', () => {
    const { ctx, cmds, n } = setup()
    const g = cmds.add(n.id, 'fermataAbove')!
    expect(cmds.flip(g.id)).toBe(true)
    expect(cmds.remove(g.id)).toBe(true)
    expect(cmds.remove(g.id)).toBe(false)
    expect(cmds.flip(g.id)).toBe(false)
    expect(ctx.log).toEqual(['mutate:Add symbol', 'mutate:Flip symbol', 'mutate:Delete symbol'])
  })

  it('through the facade (`engine.glyphMark`): undo takes it back, redo returns it', () => {
    const engine = makeEngine()
    const n = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: fracCreate(0, 1) })!
    expect(engine.glyphMark.add(n.id, 'fermataAbove')).not.toBeNull()
    const marks = () => engine.getScore().measures[0].glyphMarks
    expect(marks()).toHaveLength(1)
    expect(engine.undo()).toBe(true)
    expect(marks()).toBeUndefined()
    expect(engine.redo()).toBe(true)
    expect(marks()).toHaveLength(1)
  })
})
