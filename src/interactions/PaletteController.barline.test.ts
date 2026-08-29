/**
 * {@link PaletteController} — the BARLINE row (final / open repeat / end repeat), P4 of
 * docs/barline-types-plan.md.
 *
 * The chapter for ONE press meaning three things: *"if nothing selected stamp, if a barline is
 * selected apply to the barline, if a whole measure is selected apply in relationship with the
 * semantic"*. WHICH bar a selection names is `barlineStamp.test.ts`'s question (the module beside it
 * owns the rule); what is asked here is the DISPATCH — that a press with something selected writes
 * and does not arm, and that a press with nothing selected arms and writes nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { PaletteController } from './PaletteController'
import { createEditorState, armedTool, type EditorState } from './EditorState'

const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('PaletteController — the barline row', () => {
  let state: EditorState
  let engine: MusicEngine
  let palette: PaletteController
  let renderScore: () => void

  const bar = (n: number) => engine.getScore().measures.find(m => m.number === n)

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 5; i++) engine.addMeasure()
    state = createEditorState()
    renderScore = vi.fn()
    palette = new PaletteController(
      () => engine,
      state,
      renderScore,
      vi.fn(),              // renderPreview
      () => null,           // getLastMousePosition
      vi.fn(),              // selectNote
    )
  })

  it('with nothing selected, ARMS the stamp — the next click places it', () => {
    palette.pressBarline('final')
    expect(armedTool(state, 'barline')?.sign).toBe('final')
    expect(state.selectedTool).toBe('entry')
    expect(bar(1)?.barline, 'arming writes nothing').toBeUndefined()
  })

  it('pressed again while armed, DISARMS — the button is the tool\'s only on-screen switch', () => {
    palette.pressBarline('final')
    palette.pressBarline('final')
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('another sign REPLACES the armed one — three buttons, one armed at a time', () => {
    palette.pressBarline('final')
    palette.pressBarline('repeatEnd')
    expect(armedTool(state, 'barline')?.sign).toBe('repeatEnd')
  })

  it('⭐ arming IS clearing — whatever else was armed is gone', () => {
    state.selectedMarkingTool = { kind: 'pedal' }
    palette.pressBarline('repeatStart')
    expect(state.selectedMarkingTool).toEqual({ kind: 'barline', sign: 'repeatStart' })
  })

  it('⭐ with a BARLINE selected, APPLIES and does not arm', () => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'barline', measure: 3 }

    palette.pressBarline('final')

    expect(bar(3)?.barline).toEqual({ style: 'final' })
    expect(state.selectedMarkingTool, 'a press that applies is not a press that arms').toBeNull()
    // The selection STAYS: you are looking at the line you just changed.
    expect(state.selectedElement).toEqual({ kind: 'barline', measure: 3 })
    expect(renderScore).toHaveBeenCalled()
  })

  it('⭐ with a MEASURE RANGE selected, applies on the sign\'s own side of it', () => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'measureRange', anchor: 2, focus: 4, staff: 0, focusStaff: 0, boxStyle: 'double' }

    palette.pressBarline('repeatStart')
    palette.pressBarline('repeatEnd')

    expect(bar(2)?.repeatStart, 'the open repeat opens the passage').toEqual({})
    expect(bar(4)?.repeatEnd, 'the end repeat closes it').toEqual({})
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('a press that changes nothing does not repaint', () => {
    state.selectedTool = 'selection'
    state.selectedElement = { kind: 'barline', measure: 3 }
    palette.pressBarline('final')
    ;(renderScore as ReturnType<typeof vi.fn>).mockClear()

    palette.pressBarline('final') // already final — the model refuses, so there is nothing to draw

    expect(renderScore).not.toHaveBeenCalled()
    expect(state.selectedMarkingTool, 'and it still must not arm — a selection means apply').toBeNull()
  })
})
