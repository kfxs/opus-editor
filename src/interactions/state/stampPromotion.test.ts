import { describe, it, expect } from 'vitest'
import { createEditorState } from './EditorState'
import { promoteStampToNoteEntry } from './stampPromotion'

describe('promoteStampToNoteEntry — a duration press ends the armed tool', () => {
  it('disarms whatever was armed', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
    expect(promoteStampToNoteEntry(state)).toBe(0)
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ the DOT stamp promotes to one dot; the ACCIDENTAL stamp to the entry accidental', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'dot' }
    expect(promoteStampToNoteEntry(state)).toBe(1)
    state.selectedMarkingTool = { kind: 'accidental', sign: '#' }
    expect(promoteStampToNoteEntry(state)).toBe(0)
    expect(state.selectedAccidental).toBe('#')
  })

  it('the armed-length tools (rest, grace) keep the armed dots', () => {
    const state = createEditorState()
    state.selectedDots = 1
    state.selectedMarkingTool = { kind: 'grace', form: 'acciaccatura', side: 'before' }
    expect(promoteStampToNoteEntry(state)).toBe(1)
  })
})
