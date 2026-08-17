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
 * The LEFT square then takes the same chord to move the wedge's START (holding its end), so the pair
 * is really one claim: ONE CHORD, and the armed square decides which end of the span it moves.
 *
 * The engine is a stub: what is under test is the ROUTING, not the resize (`resizeHairpinBySlot` has
 * its own spec). Actions are run through the wiring's own `run`, which is the same map the key
 * dispatch reads — so this pins the branch without depending on a real KeyboardEvent chord.
 */
describe('resizing a hairpin from the keyboard', () => {
  let state: EditorState
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let moveStart: Mock<(id: string, direction: 1 | -1) => boolean>
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let mouth: Mock<(id: string, aperture: number | null) => boolean>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    resize = vi.fn(() => true)
    moveStart = vi.fn(() => true)
    nudge = vi.fn(() => true)
    mouth = vi.fn(() => true)
    const engine = {
      nudgeHairpinEndpoint: nudge,
      resetHairpinEndpointOffset: vi.fn(() => false),
      setHairpinAperture: mouth,
      getHairpinById: () => ({ id: 'H1', type: 'cresc' }),
      resizeHairpinBySlot: resize,
      moveHairpinStartBySlot: moveStart,
      resizePedalBySlot: vi.fn(() => false),
      // One drawn fragment, so the mouth keys have something to measure (aperture 1.5, length 40 →
      // the authorable range is 1…2).
      getElementRegistry: () => ({
        getByType: (t: string) => t === 'hairpin'
          ? [{ type: 'hairpin', id: 'H1', apertureSpaces: 1.5, hairpinLengthSpaces: 40 }]
          : [],
      }),
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
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('⭐⭐ the LEFT square moves the START instead — one chord, and the armed end decides', () => {
    armed('start')
    run('ctrlShiftArrowLeft')
    run('ctrlShiftArrowRight')
    expect(moveStart.mock.calls).toEqual([['H1', -1], ['H1', 1]])
    // ⚠️ and never the resize: the two are different model writes, and the wedge's right-hand end
    // must not move while the left square is the one armed.
    expect(resize).not.toHaveBeenCalled()
  })

  it('⭐⭐ Ctrl+←/→ is the OTHER category — it reshapes the ink, and never the extent', () => {
    // The two chords on one pair of squares: Ctrl+Shift says which notes get louder (the model),
    // Ctrl says where the ink goes (an override). A key that did both would make them one thing.
    armed('end')
    run('ctrlArrowRight')
    run('ctrlArrowLeft')
    expect(nudge.mock.calls).toEqual([['H1', 'end', 1, 0], ['H1', 'end', -1, 0]])
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('the plain arrows are the FINE step of that same reshape, on either square', () => {
    armed('start')
    run('selectNextNote')      // →
    run('pitchUp')             // ↑
    expect(nudge.mock.calls).toEqual([['H1', 'start', 0.25, 0], ['H1', 'start', 0, -0.25]])
  })

  it('⛔ …and neither arrow reshapes anything while NO square is armed', () => {
    armed()
    run('ctrlArrowRight')
    run('pitchUp')
    expect(nudge).not.toHaveBeenCalled()
  })

  it('⭐⭐ Shift+↑/↓ is a THIRD category on the same square — the MOUTH, not the ink and not the music', () => {
    armed('end')                 // a crescendo's mouth is its right-hand end
    run('staffSpacingFineUp')    // Shift+↑ — ↑ opens
    run('staffSpacingFineDown')  // Shift+↓
    expect(mouth.mock.calls).toEqual([['H1', 1.55], ['H1', 1.45]])
    expect(resize).not.toHaveBeenCalled()
    expect(nudge).not.toHaveBeenCalled()
  })

  it('⛔ …and it declines on the CLOSED end, leaving Shift+↑/↓ to the staff spacing', () => {
    armed('start')               // the tip of a crescendo
    run('staffSpacingFineUp')
    expect(mouth).not.toHaveBeenCalled()
  })

  it('⛔ nor does it answer the HORIZONTAL Shift pair, which it rode for an hour and lost', () => {
    // Shift+←/→ was tried and rejected in the hand; it is the barline gap's again.
    armed('end')
    run('barlineGapWiden')
    run('barlineGapTighten')
    expect(mouth).not.toHaveBeenCalled()
  })

  it('Shift+Backspace hands the mouth back to automatic from that same square', () => {
    armed('end')
    run('resetBarlineGap')
    expect(mouth).toHaveBeenCalledWith('H1', null)
  })

  it('declines for a selection that is not a hairpin at all', () => {
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    run('ctrlShiftArrowRight')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })
})
