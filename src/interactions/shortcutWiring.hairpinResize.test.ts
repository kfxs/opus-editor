// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEY RESIZES A HAIRPIN, AND WHEN (his call, 2026-08-17).
 *
 * Subject: `./shortcutWiring` — a chapter beside `.playback.test.ts`. Two claims, both of which used
 * to be false and neither of which anything else would catch:
 *
 *  1. the wedge resizes on **Ctrl+Shift+←/→**, the chord the slur's re-anchor already uses for "move
 *     THIS end of the span" — it used to ride the bare `Ctrl+←/→`;
 *  2. and only while its **right-hand square is armed** — it used to fire on any selected hairpin,
 *     so a selected wedge ate `Ctrl+←/→` outright, gate-free.
 *
 * The engine is a stub: what is under test is the ROUTING, not the resize (`resizeHairpinBySlot` has
 * its own spec). Actions are run through the wiring's own `run`, which is the same map the key
 * dispatch reads — so this pins the branch without depending on a real KeyboardEvent chord.
 */
describe('resizing a hairpin from the keyboard', () => {
  let state: EditorState
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    resize = vi.fn(() => true)
    const engine = {
      resizeHairpinBySlot: resize,
      resizePedalBySlot: vi.fn(() => false),
      getElementRegistry: () => ({ getByType: () => [] }),
      getSlurById: () => null,
      getNote: () => null,
    } as unknown as MusicEngine

    state = createEditorState()
    state.selectedTool = 'selection'

    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote: vi.fn(), deselectAll: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn() } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false,
      () => {},
    )
    run = wiring.run
    teardown = wiring.disable
  })
  afterEach(() => { teardown() })

  const armed = (endpoint?: 'start' | 'end') => {
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint }
  }

  it('⭐ lengthens on Ctrl+Shift+→ and shortens on Ctrl+Shift+← with the RIGHT square armed', () => {
    armed('end')
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize.mock.calls).toEqual([['H1', 1], ['H1', -1]])
  })

  it('⛔ does NOT resize with no square armed — the key edits the end you are pointing at', () => {
    armed()
    run('ctrlShiftArrowRight')
    expect(resize).not.toHaveBeenCalled()
  })

  it('⛔ nor with the LEFT square armed — moving the start is a different edit from the length', () => {
    armed('start')
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize).not.toHaveBeenCalled()
  })

  it('⭐ has left Ctrl+←/→ alone — a selected wedge no longer eats that chord', () => {
    armed('end')
    run('ctrlArrowRight')
    run('ctrlArrowLeft')
    expect(resize).not.toHaveBeenCalled()
  })

  it('declines for a selection that is not a hairpin at all', () => {
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    run('ctrlShiftArrowRight')
    expect(resize).not.toHaveBeenCalled()
  })
})
