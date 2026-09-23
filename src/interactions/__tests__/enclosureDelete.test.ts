// @vitest-environment jsdom
/**
 * Delete takes a selected head's BRACKETS off (parenthesised-note-plan N10, reversed by his ask
 * 2026-09-23: *"select just the parenthesis too so i can remove it with delete key"*). Driven through the
 * REAL key wiring, as the tremolo's is: the risk is the BRANCH ORDER of `deleteSelected`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { createEditorState, type EditorState } from '../state/EditorState'
import { wireShortcuts } from '../controllers/shortcutWiring'
import { fracCreate as frac } from '../../utils/fraction'

vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('Delete removes a selected head\'s brackets', () => {
  let engine: MusicEngine
  let state: EditorState
  let noteId: string
  let other: string
  let selectNote: ReturnType<typeof vi.fn>
  let teardown: () => void

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    noteId = engine.addNoteAtBeat({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    other = engine.addChordNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) }).id
    engine.enclosure.set([noteId, other], 'round')

    state = createEditorState()
    state.selectedTool = 'selection'
    selectNote = vi.fn()
    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote, deselectAll: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false, () => {},
    )
    wiring.enable()
    teardown = wiring.disable
  })

  afterEach(() => { teardown() })

  const pressDelete = () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))

  it('⭐ takes THIS head\'s brackets off — the note stays, and stays selected; the chord\'s other head keeps its own', () => {
    state.selectedElement = { kind: 'headEnclosure', noteId }
    pressDelete()
    expect(engine.enclosure.of(noteId)).toBeUndefined()
    expect(engine.getNote(noteId)).toBeTruthy()
    expect(selectNote).toHaveBeenCalledWith(noteId)
    expect(engine.enclosure.of(other)).toBe('round')
  })

  it('is ONE undo step — Ctrl+Z puts them back', () => {
    state.selectedElement = { kind: 'headEnclosure', noteId }
    pressDelete()
    expect(engine.undo()).toBe(true)
    expect(engine.enclosure.of(noteId)).toBe('round')
  })
})
