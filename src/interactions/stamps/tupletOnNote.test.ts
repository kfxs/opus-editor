import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorState, type EditorState } from '../state/EditorState'
import { pressTupletOnNote } from './tupletOnNote'
import type { MusicEngine } from '@/engine/MusicEngine'

describe('pressTupletOnNote', () => {
  let state: EditorState
  let engine: MusicEngine
  let applyTupletToNote: ReturnType<typeof vi.fn>
  let deleteTuplet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    state = createEditorState()
    applyTupletToNote = vi.fn((id: string) => ({ tuplet: { id: 't1' }, note: { id } }))
    deleteTuplet = vi.fn()
    const notes: Record<string, { id: string; tupletId?: string }> = { n1: { id: 'n1' }, n2: { id: 'n2', tupletId: 't0' } }
    engine = { getNote: (id: string) => notes[id] ?? null, applyTupletToNote, deleteTuplet } as unknown as MusicEngine
  })

  describe('ENTRY mode — type a note, then Ctrl+3 (reported)', () => {
    beforeEach(() => { state.selectedTool = 'entry' })

    it('turns the cursor note into the tuplet\'s first note and spends any armed ratio', () => {
      state.selectedNoteId = 'n1'
      state.armedTuplet = { numNotes: 3, notesOccupied: 2 }
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: true, select: 'n1' })
      expect(applyTupletToNote).toHaveBeenCalledWith('n1', 3, 2)
      expect(state.armedTuplet).toBeNull()
    })

    it('no cursor note → not handled: the caller arms the ratio', () => {
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: false })
    })

    it('a cursor note already in a tuplet is NOT removed from it — not handled, the caller arms', () => {
      state.selectedNoteId = 'n2'
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: false })
      expect(deleteTuplet).not.toHaveBeenCalled()
    })

    it('the window\'s "in the time of" / Format still arms — the note cannot carry them', () => {
      state.selectedNoteId = 'n1'
      expect(pressTupletOnNote(engine, state, 3, 2, false)).toEqual({ handled: false })
      expect(applyTupletToNote).not.toHaveBeenCalled()
    })

    it('a refused conversion (it does not fit) falls back to arming', () => {
      state.selectedNoteId = 'n1'
      applyTupletToNote.mockReturnValue(null)
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: false })
    })
  })

  describe('SELECTION mode — unchanged', () => {
    beforeEach(() => { state.selectedTool = 'selection' })

    it('converts the selected note', () => {
      state.selectedNoteId = 'n1'
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: true, select: 'n1' })
    })

    it('a second press on a note in a tuplet removes the tuplet', () => {
      state.selectedNoteId = 'n2'
      expect(pressTupletOnNote(engine, state, 3, 2, true)).toEqual({ handled: true })
      expect(deleteTuplet).toHaveBeenCalledWith('t0')
    })
  })
})
