import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorState, type EditorState, type MarkingTool } from '../state/EditorState'
import { graceToolLit, pressGraceTool } from './graceTool'
import type { SpanToolHost } from './spanToolPress'

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
