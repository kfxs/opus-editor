// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import { SHORTCUTS } from '../shortcuts/ShortcutConfig'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./shortcutWiring` — the `p` key, and the one thing that can go wrong with a shortcut
 * that duplicates a button: **that it is a second WAY to press it, never a second implementation.**
 * The wiring calls the same `togglePlayback` the ▶ button runs, so the two cannot drift.
 *
 * `p` is Sibelius's own key for playback (it plays from the selected note there; Space is its
 * play/stop). Space is not available here — it is note entry's typewriter key.
 */
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn()
    setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('the p key plays', () => {
  let state: EditorState
  let togglePlayback: Mock<() => void>
  let teardown: () => void

  beforeEach(() => {
    const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    state = createEditorState()
    state.selectedTool = 'selection'
    togglePlayback = vi.fn(() => {})

    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote: vi.fn(), deselectAll: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false,
      togglePlayback,
    )
    wiring.enable()
    teardown = wiring.disable
  })

  afterEach(() => { teardown() })

  const press = (key: string, target?: EventTarget) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true })
    ;(target ?? document).dispatchEvent(event)
  }

  it('is bound to the playback toggle', () => {
    expect(SHORTCUTS['p'].action).toBe('togglePlayback')
    press('p')
    expect(togglePlayback).toHaveBeenCalledTimes(1)
  })

  it('presses the same toggle again to stop — one key, both jobs', () => {
    press('p')
    press('p')
    expect(togglePlayback).toHaveBeenCalledTimes(2)
  })

  it('⚠️ does not fire while typing into a field — `p` is a letter', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('p', input)
    expect(togglePlayback).not.toHaveBeenCalled()
    input.remove()
  })

  it('leaves the SPACE bar to note entry — the two are different gestures', () => {
    expect(SHORTCUTS[' '].action).toBe('pressSpace')
  })
})
