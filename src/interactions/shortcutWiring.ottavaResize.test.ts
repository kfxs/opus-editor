// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEY RE-ANCHORS AN OCTAVE LINE, AND WHEN (his asks, 2026-08-17).
 *
 * Subject: `./shortcutWiring` — the ottava's chapter beside `.hairpinResize.test.ts`, whose claim it
 * repeats for the other span: **ONE CHORD, `Ctrl+Shift+←/→`, and the ARMED SQUARE decides which end
 * of the bracket it moves.** The right square re-anchors the end, the left one moves the beginning
 * and holds the end, and with neither armed the chord belongs to whatever is behind it in the chain.
 *
 * ⚠️ Both branches DECLINE rather than swallowing the key, which is what lets a selected ottava
 * share the chord with the note offset sitting behind it. That is the assertion no other spec makes:
 * the model ops have their own, and neither knows it is reachable only through a gate.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
describe('re-anchoring an octave line from the keyboard', () => {
  let state: EditorState
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let moveStart: Mock<(id: string, direction: 1 | -1) => boolean>
  let noteOffset: Mock<(id: string, dx: number) => boolean>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    resize = vi.fn(() => true)
    moveStart = vi.fn(() => true)
    noteOffset = vi.fn(() => true)
    const engine = {
      resizeOttavaBySlot: resize,
      moveOttavaStartBySlot: moveStart,
      nudgeNoteOffset: noteOffset,
      resizeHairpinBySlot: vi.fn(() => false),
      moveHairpinStartBySlot: vi.fn(() => false),
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
      { selectNote: vi.fn(), deselectAll: vi.fn(), adjustPitch: vi.fn(), navigateNext: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
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
    state.selectedElement = { kind: 'ottava', id: 'O1', endpoint }
  }

  it('⭐ the RIGHT square re-anchors the END — → lengthens, ← shortens', () => {
    armed('end')
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize.mock.calls).toEqual([['O1', 1], ['O1', -1]])
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('⭐⭐ the LEFT square moves the BEGINNING instead — one chord, and the armed end decides', () => {
    armed('start')
    run('ctrlShiftArrowLeft')
    run('ctrlShiftArrowRight')
    expect(moveStart.mock.calls).toEqual([['O1', -1], ['O1', 1]])
    // ⚠️ …and never the other write: the far end must not move while the left square is armed.
    expect(resize).not.toHaveBeenCalled()
  })

  it('⛔ does NOTHING to the line with no square armed — the key edits the end you are pointing at', () => {
    armed()
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('⭐ DECLINES rather than swallowing the chord, so what sits behind it still runs', () => {
    // A selected ottava with no square armed must leave `Ctrl+Shift+←/→` to the note offset — the
    // branch it shares the chord with. A gate that consumed the key would silently disable that.
    armed()
    state.selectedItems = new Map([['N1', { kind: 'note', id: 'N1' }]]) as never
    run('ctrlShiftArrowRight')
    expect(noteOffset).toHaveBeenCalled()
  })

  it('⛔ answers for an OTTAVA only — a selected hairpin does not reach these branches', () => {
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
    run('ctrlShiftArrowRight')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })
})
