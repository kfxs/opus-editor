import { describe, it, expect, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { fracCreate as frac } from '../utils/fraction'
import { createEditorState } from './EditorState'
import { selectionInspection } from './selectionInspection'
import { wireSelectionInspection } from './selectionInspectionSync'

/**
 * The Properties feed has to survive the case that broke it: the SAME element edited under a
 * selection that never moved. A selection-only subscriber cannot see that — retuning a rest emits
 * one state change (`selectedDuration`) BEFORE the mutation, and nothing at all after it.
 *
 * A REAL MusicEngine, because the fix under test is the engine's own change notification; a fake
 * engine would only prove the wiring. Its two outputs are stubbed — neither drawing nor audio has
 * anything to say about whether an edit is announced. (Mock shape mirrors KeyboardController.test.)
 */
const fakeRegistry = {
  registerStaffGeometry: vi.fn(),
  getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    setLayoutReusable = vi.fn()
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    getAllMeasureBounds = vi.fn(() => new Map())
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn()
    setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

describe('wireSelectionInspection', () => {
  it('refreshes when the SELECTED element is edited but the selection does not move', async () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!

    const state = createEditorState()
    state.selectedNoteId = note.id
    // No-op subscribe: this test is about the MODEL channel, so nothing may reach the sync through
    // the state one — if the panel still updates, it updated for the right reason.
    const stop = wireSelectionInspection(state, () => engine, () => () => {})

    expect((selectionInspection.get()[0].data as { duration: string }).duration).toBe('q')

    engine.updateNote(note.id, { duration: 'h' })
    // Delivery is deferred to a microtask, so the model is settled when listeners read it.
    await Promise.resolve()

    expect((selectionInspection.get()[0].data as { duration: string }).duration).toBe('h')
    stop()
  })

  it('stops listening to the model when disposed', async () => {
    const engine = makeEngine()
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const state = createEditorState()
    state.selectedNoteId = note.id

    const stop = wireSelectionInspection(state, () => engine, () => () => {})
    stop()

    const seen = vi.fn()
    const unsubscribe = selectionInspection.onChange(seen)
    engine.updateNote(note.id, { duration: 'h' })
    await Promise.resolve()

    expect(seen).not.toHaveBeenCalled()
    unsubscribe()
  })
})
