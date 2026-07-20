import { describe, it, expect } from 'vitest'
import { createEditorState } from './EditorState'
import { selectedElements } from './selectionSnapshot'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * The snapshot turns EditorState's dozen `selected*` locators into the objects behind them — the
 * question the Properties window asks, and the one the editable panel will ask later.
 *
 * The engine is a stub: what is under test is the READING of state, not the engine's lookups.
 */
const engineStub = (notes: Record<string, unknown> = {}): MusicEngine =>
  ({
    getNote: (id: string) => notes[id],
    getDynamicById: () => null,
    getTempoMarkById: () => null,
    getSlurById: () => null,
    getScore: () => ({ measures: [] }),
  }) as unknown as MusicEngine

describe('selectedElements', () => {
  it('reports nothing when nothing is selected', () => {
    expect(selectedElements(createEditorState(), engineStub())).toEqual([])
  })

  it('reports nothing when there is no engine — a selection with nothing to resolve it against', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    expect(selectedElements(state, null)).toEqual([])
  })

  it('tells a rest from a note, which the dump alone does not', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    const [element] = selectedElements(state, engineStub({ n1: { id: 'n1', isRest: true } }))
    expect(element.kind).toBe('rest')
  })

  // A stale selection is exactly what this window exists to make visible, so an id that no longer
  // resolves must SHOW as missing rather than vanish into an empty panel.
  it('reports an unresolvable id instead of dropping it', () => {
    const state = createEditorState()
    state.selectedNoteId = 'gone'
    const [element] = selectedElements(state, engineStub())
    expect(element.data).toEqual({ id: 'gone', missing: true })
  })

  it('carries the note an articulation hangs on, since an articulation has no object of its own', () => {
    const state = createEditorState()
    state.selectedArticulationNoteId = 'n1'
    state.selectedArticulationType = 'accent'
    const [element] = selectedElements(state, engineStub({ n1: { id: 'n1' } }))
    expect(element).toEqual({
      kind: 'articulation',
      data: { noteId: 'n1', type: 'accent', note: { id: 'n1' } },
    })
  })

  it('reports every selected thing, not just the first — the editor sets these independently', () => {
    const state = createEditorState()
    state.selectedNoteId = 'n1'
    state.selectedTimeSignatureMeasure = 3
    const kinds = selectedElements(state, engineStub({ n1: { id: 'n1' } })).map((e) => e.kind)
    expect(kinds).toEqual(['note', 'timeSignature'])
  })
})
