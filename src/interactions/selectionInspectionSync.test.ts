import { describe, it, expect, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { fracCreate as frac } from '../utils/fraction'
import { createEditorState } from './EditorState'
import { bus } from '@/bus'
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

    expect((bus.inspection.get()[0].data as { duration: string }).duration).toBe('q')

    engine.updateNote(note.id, { duration: 'h' })
    // Delivery is deferred to a microtask, so the model is settled when listeners read it.
    await Promise.resolve()

    expect((bus.inspection.get()[0].data as { duration: string }).duration).toBe('h')
    stop()
  })

  // Nudging an override is the sharpest case: it changes NEITHER the selection NOR the element —
  // only the engraving-overrides compartment hanging off it. If the panel is to give live feedback
  // while an arrow key walks a dynamic around, this is the path that has to reach it.
  it('refreshes when an ENGRAVING OVERRIDE on the selected element is nudged', async () => {
    const engine = makeEngine()
    const dynamic = engine.addDynamic(1, { text: 'p', beat: frac(0, 1) })!

    const state = createEditorState()
    state.selectedElement = { kind: 'dynamic', id: dynamic.id }
    const stop = wireSelectionInspection(state, () => engine, () => () => {})

    expect(bus.inspection.get()[0].overrides).toBeUndefined()

    engine.nudgeDynamicOffset(dynamic.id, 0, -1)
    await Promise.resolve()

    expect(bus.inspection.get()[0].overrides).toEqual([
      expect.objectContaining({ kind: 'dynamicOffset', y: -1 }),
    ])
    stop()
  })

  // ⚠️ The REPEAT nudge, which is where this first broke in the app. The first one changes
  // `overrides` from absent to present, so even a broken de-dup notices it; the second only changes
  // a NUMBER INSIDE an object the snapshot shares with the model — and comparing the live object
  // against itself says "no change". Anything holding the model's own objects has this hazard.
  it('refreshes on every nudge, not just the first', async () => {
    const engine = makeEngine()
    const dynamic = engine.addDynamic(1, { text: 'p', beat: frac(0, 1) })!
    const state = createEditorState()
    state.selectedElement = { kind: 'dynamic', id: dynamic.id }
    const stop = wireSelectionInspection(state, () => engine, () => () => {})

    engine.nudgeDynamicOffset(dynamic.id, 0, -1)
    await Promise.resolve()

    const seen = vi.fn()
    const unsubscribe = bus.inspection.onChange(seen)
    engine.nudgeDynamicOffset(dynamic.id, 0, -1)
    await Promise.resolve()

    expect(seen).toHaveBeenCalled()
    expect(bus.inspection.get()[0].overrides).toEqual([
      expect.objectContaining({ kind: 'dynamicOffset', y: -2 }),
    ])
    unsubscribe()
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
    const unsubscribe = bus.inspection.onChange(seen)
    engine.updateNote(note.id, { duration: 'h' })
    await Promise.resolve()

    expect(seen).not.toHaveBeenCalled()
    unsubscribe()
  })
})
