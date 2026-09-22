import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { graceToolLit, pressGraceTool } from './graceTool'
import type { SpanToolHost } from './spanToolPress'
import { makeEngine } from '@/testing/makeEngine'
import { fracCreate as frac } from '@/utils/fraction'
import { itemKey } from '../state/selection'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('pressGraceTool', () => {
  let state: EditorState
  let host: SpanToolHost
  beforeEach(() => {
    state = createEditorState()
    host = {
      state,
      getEngine: () => null,
      arm: vi.fn((tool: MarkingTool) => { state.selectedMarkingTool = tool; state.selectedTool = 'entry' }),
      disarm: vi.fn(() => { state.selectedMarkingTool = null; state.selectedTool = 'selection' }),
      disarmToEntry: vi.fn(() => { state.selectedMarkingTool = null }),
      render: vi.fn(),
    }
  })

  it('⭐ ARMS the stamp (D6), and with nothing lit the written value is an 8th', () => {
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'acciaccatura', side: 'before' })
    expect(state.selectedDuration).toBe('8')
    expect(graceToolLit(state, 'acciaccatura', 'before')).toBe(true)
    expect(graceToolLit(state, 'appoggiatura', 'before')).toBe(false)
  })

  it('a lit duration is a value somebody chose — it stays', () => {
    state.selectedNoteId = 'x' // a selection lights the duration row
    state.selectedDuration = '16'
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedDuration).toBe('16')
  })

  it('the same press again DISARMS; the other form SWAPS', () => {
    pressGraceTool(host, 'acciaccatura', 'before')
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'appoggiatura', side: 'before' })
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('🚨 the disarm STAYS in note entry — ⛔ never selection mode (his report, 2026-09-22)', () => {
    pressGraceTool(host, 'appoggiatura', 'before')
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(host.disarmToEntry).toHaveBeenCalledOnce()
    expect(host.disarm).not.toHaveBeenCalled()
    expect(state.selectedTool).toBe('entry')
  })
})

describe('pressGraceTool — a SELECTED grace (his rule, 2026-09-22; plan §3 rule 2)', () => {
  const setup = (tool: 'selection' | 'entry') => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const grace = engine.grace.addGrace(note.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const state = createEditorState()
    state.selectedTool = tool
    const id = grace.pitches[0].id
    state.selectedItems = new Map([[itemKey({ kind: 'note', id }), { kind: 'note', id }]])
    const host: SpanToolHost = {
      state, getEngine: () => engine,
      arm: vi.fn((t: MarkingTool) => { state.selectedMarkingTool = t }),
      disarm: vi.fn(), disarmToEntry: vi.fn(), render: vi.fn(),
    }
    const slash = () => {
      const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
      return slot.type === 'chord' && !!slot.graceBefore?.slash
    }
    return { host, state, slash }
  }

  it('⭐ in SELECTION mode it EDITS the grace\'s form — and arms nothing', () => {
    const { host, state, slash } = setup('selection')
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(slash()).toBe(true)
    expect(state.selectedMarkingTool).toBeNull()
    expect(host.render).toHaveBeenCalled()
    pressGraceTool(host, 'appoggiatura', 'before')
    expect(slash()).toBe(false)
  })

  it('in ENTRY mode (a stamp in hand) the button still arms', () => {
    const { host, state, slash } = setup('entry')
    pressGraceTool(host, 'acciaccatura', 'before')
    expect(slash()).toBe(false)
    expect(state.selectedMarkingTool).toEqual({ kind: 'grace', form: 'acciaccatura', side: 'before' })
  })
})
