import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { glissandoLit, pressGlissando } from './glissandoTool'
import type { SpanToolHost } from './spanToolPress'
import { makeEngine } from '@/testing/makeEngine'
import { itemKey, type SelectionItem } from '../state/selection'
import { fracCreate as frac } from '@/utils/fraction'
import type { MusicEngine } from '@/engine/MusicEngine'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

/**
 * Subject: `./glissandoTool` — what a press of `gliss` does (docs/plans/glissando-plan.md P1): each selected
 * head starts one, in one undo entry; nothing selected arms the STAMP (the blue cursor).
 */
describe('pressGlissando', () => {
  let state: EditorState
  let engine: MusicEngine
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    engine = makeEngine()
    host = {
      state, getEngine: () => engine, render: vi.fn(), disarmToEntry: vi.fn(),
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null }),
    }
  })
  const select = (...ids: string[]) => {
    state.selectedItems = new Map(ids.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
  }
  const note = (beat: number) => engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(beat, 1) })!

  it('⭐ a selected note starts one; the button is then lit', () => {
    const a = note(0)
    note(1)
    select(a.id)
    expect(glissandoLit(state, engine)).toBe(false)
    pressGlissando(host)
    expect(engine.glissando.on(a.id)).toBeDefined()
    expect(glissandoLit(state, engine)).toBe(true)
    expect(host.render).toHaveBeenCalledTimes(1)
  })

  it('⭐ a second press TOGGLES it off — one undo step brings it back', () => {
    const a = note(0)
    select(a.id)
    pressGlissando(host)
    pressGlissando(host)
    expect(engine.getScore().glissandi).toBeUndefined()
    expect(glissandoLit(state, engine)).toBe(false)
    expect(host.render).toHaveBeenCalledTimes(2)
    expect(engine.undo()).toBe(true)
    expect(engine.getScore().glissandi).toHaveLength(1)
  })

  it('a mixed selection (one with, one without) gives the missing one — ⛔ it removes nothing', () => {
    const a = note(0)
    const b = note(1)
    select(a.id)
    pressGlissando(host)
    select(a.id, b.id)
    pressGlissando(host)
    expect(engine.getScore().glissandi).toHaveLength(2)
  })

  it('⭐ nothing selected ARMS the stamp (the blue cursor) — lit; pressed again, it disarms', () => {
    note(0)
    pressGlissando(host)
    expect(host.arm).toHaveBeenCalledWith({ kind: 'glissandoLine' })
    expect(glissandoLit(state, engine)).toBe(true)
    pressGlissando(host)
    expect(host.disarm).toHaveBeenCalled()
    expect(engine.getScore().glissandi).toBeUndefined()
  })
})
