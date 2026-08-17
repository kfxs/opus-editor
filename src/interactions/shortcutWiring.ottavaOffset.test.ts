// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEY MOVES AN OCTAVE BRACKET'S INK (his ask, 2026-08-17: *"the square points offset"*).
 *
 * Subject: `./shortcutWiring` — the ottava's second chapter, beside `.ottavaResize.test.ts`, and the
 * pair of them is the claim: **one pair of squares, two CATEGORIES of edit on two chords.**
 * `Ctrl+Shift+←/→` says which notes are displaced (the model, audible); a plain or `Ctrl` arrow says
 * where the ink goes (an override). Neither may reach the other's write.
 *
 * ⭐⭐ And the vertical is where this differs from the wedge: `↑`/`↓` from EITHER square move the
 * whole bracket, because an octave line is a straight rule. That claim lives in the model's shape
 * (`OttavaOffsetOverride` has one `y`); what is pinned here is that both squares route to it.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
describe('nudging an octave bracket\'s ink from the keyboard', () => {
  let state: EditorState
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let reset: Mock<(id: string, which: 'start' | 'end') => boolean>
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let adjustPitch: Mock<(delta: number) => void>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    nudge = vi.fn(() => true)
    reset = vi.fn(() => true)
    resize = vi.fn(() => true)
    adjustPitch = vi.fn()
    const engine = {
      nudgeOttavaEndpoint: nudge,
      resetOttavaEndpointOffset: reset,
      resizeOttavaBySlot: resize,
      moveOttavaStartBySlot: vi.fn(() => true),
      // The hairpin's own branches sit ahead of the ottava's in every chain — stubbed so the last
      // case can prove they answer FIRST for a wedge rather than crashing past it.
      nudgeHairpinEndpoint: vi.fn(() => true),
      resetHairpinEndpointOffset: vi.fn(() => true),
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
      { selectNote: vi.fn(), deselectAll: vi.fn(), adjustPitch, navigateNext: vi.fn(), navigateSelection: vi.fn(), navigateBarline: () => false, adjustOctave: vi.fn() } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore: vi.fn() } as never,
      { disarmPositionalTools: vi.fn() } as never,
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
  /** The (which, dx, dy) of every nudge call, dropping the id. */
  const calls = () => nudge.mock.calls.map(([, which, dx, dy]) => [which, dx, dy])

  it('⭐ the armed square moves horizontally — plain arrow FINE, Ctrl+arrow COARSE', () => {
    armed('end')
    run('selectNextNote')
    run('ctrlArrowRight')
    const [fine, coarse] = calls()
    expect(fine[0]).toBe('end')
    expect(fine[1] as number).toBeGreaterThan(0)
    expect(coarse[1] as number).toBeGreaterThan(fine[1] as number) // Ctrl is the bigger step
    expect(fine[2], 'a horizontal key sends no dy').toBe(0)
  })

  it('⭐⭐ ↑/↓ route the SAME dy from EITHER square — the bracket is one straight line', () => {
    armed('start')
    run('pitchUp')
    armed('end')
    run('pitchUp')
    const [fromStart, fromEnd] = calls()
    expect(fromStart[0]).toBe('start')
    expect(fromEnd[0]).toBe('end')
    // ⭐ Same delta, and screen-down is +y, so "up" is negative. The two squares are two doors to one
    // quantity; the model has nowhere to put a second, so nothing here has to keep them equal.
    expect(fromStart[2]).toBe(fromEnd[2])
    expect(fromStart[2] as number).toBeLessThan(0)
    expect(fromStart[1], 'a vertical key sends no dx').toBe(0)
  })

  it('⭐ ↑/↓ CONSUME the key when a square is armed — the selection is not a note to re-pitch', () => {
    armed('end')
    run('pitchUp')
    expect(adjustPitch).not.toHaveBeenCalled()
  })

  it('⛔ does NOTHING with no square armed — the arrows are not the bracket\'s until you pick an end', () => {
    armed()
    run('pitchUp')
    run('selectNextNote')
    run('ctrlArrowLeft')
    expect(nudge).not.toHaveBeenCalled()
    // …and the key goes on to its other tenants rather than being swallowed.
    expect(adjustPitch).toHaveBeenCalled()
  })

  it('⭐⭐ the INK chord and the MUSIC chord never cross', () => {
    armed('end')
    run('ctrlArrowRight')            // ink
    expect(resize).not.toHaveBeenCalled()
    nudge.mockClear()
    run('ctrlShiftArrowRight')       // music
    expect(resize).toHaveBeenCalled()
    expect(nudge, 'the extent edit wrote no offset').not.toHaveBeenCalled()
  })

  it('Ctrl+Backspace resets the armed square, and declines when it carries nothing', () => {
    armed('start')
    run('resetMove')
    expect(reset).toHaveBeenCalledWith('O1', 'start')

    reset.mockReturnValue(false)
    reset.mockClear()
    run('resetMove')
    expect(reset, 'asked, and declined — the key falls through').toHaveBeenCalled()
  })

  it('⛔ answers for an OTTAVA only — a selected hairpin does not reach these branches', () => {
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
    run('pitchUp')
    run('ctrlArrowRight')
    expect(nudge).not.toHaveBeenCalled()
  })
})
