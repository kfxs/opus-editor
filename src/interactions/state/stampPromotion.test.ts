import { describe, it, expect } from 'vitest'
import { createEditorState } from './EditorState'
import { promoteStampToNoteEntry } from './stampPromotion'

describe('promoteStampToNoteEntry — a duration press ends the armed tool', () => {
  it('disarms whatever was armed', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(0)
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ the DOT stamp promotes to one dot; the ACCIDENTAL stamp to the entry accidental', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'dot', count: 1 }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(1)
    state.selectedMarkingTool = { kind: 'accidental', sign: '#' }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(0)
    expect(state.selectedAccidental).toBe('#')
  })

  it('⭐ the dot stamp promotes its COUNT — only one the pressed value can take (multiple-dots-plan D1)', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'dot', count: 3 }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(3)
    state.selectedMarkingTool = { kind: 'dot', count: 3 }
    expect(promoteStampToNoteEntry(state, '8')).toBe(0) // an eighth takes two at most
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('the armed-length tools (rest, grace) keep the armed dots', () => {
    const state = createEditorState()
    state.selectedDots = 1
    state.selectedMarkingTool = { kind: 'grace', form: 'acciaccatura', side: 'before' }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(1)
  })

  it('⭐ the BRACKETS stamp promotes to the entry brackets — the tremolo\'s way (parenthesised-note-plan P4b)', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'headEnclosure', shape: 'round' }
    expect(promoteStampToNoteEntry(state, 'q')).toBe(0)
    expect(state.selectedEnclosure).toBe('round')
    expect(state.selectedMarkingTool).toBeNull()
  })
})
