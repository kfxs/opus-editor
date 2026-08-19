// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEYS MOVE A TEMPO MARK'S INK (his ask, 2026-08-19) — the letters' chapter beside
 * `.dynamicReanchor.test.ts`, making the one standing claim about the newest client of the
 * engraving-overrides compartment: **the plain and `Ctrl` arrows nudge a selected tempo mark, and
 * `Ctrl+Backspace` puts it back.**
 *
 * 🚨 The case that would go red first if the chain were mis-ordered is the last one: a DECLINE must
 * fall through, or the reset key stops working for everything that sits behind this branch.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
describe('nudging a tempo mark from the keyboard', () => {
  let state: EditorState
  let nudge: Mock<(id: string, dx: number, dy: number) => boolean>
  let reset: Mock<(id: string) => boolean>
  let reanchor: Mock<(id: string, direction: 1 | -1) => boolean>
  let renderScore: Mock<() => void>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    nudge = vi.fn(() => true)
    reset = vi.fn(() => true)
    reanchor = vi.fn(() => true)
    renderScore = vi.fn()
    const engine = {
      nudgeTempoOffset: nudge,
      resetTempoOffset: reset,
      moveTempoBySlot: reanchor,
      resetDynamicOffset: vi.fn(() => false),
      nudgeDynamicOffset: vi.fn(() => false),
      nudgeNoteOffset: vi.fn(() => false),
      resetNoteSpacing: vi.fn(() => false),
      resetBarWidth: vi.fn(() => false),
      getElementRegistry: () => ({ getByType: () => [] }),
      getSlurById: () => null,
      getNote: () => null,
      getDynamicById: () => null,
      // ⚠️ The horizontal ink chords run through the interpolating walk (`./tempoWalk`), which asks
      // what lies ahead before it decides. Null = nothing to arrive at, so the press is the plain
      // nudge these cases are about; the walk's own arithmetic is proven in `tempoWalk.test.ts`.
      nextTempoSlot: () => null,
      getScore: () => ({ measures: [] }),
    } as unknown as MusicEngine

    state = createEditorState()
    state.selectedTool = 'selection'

    const wiring = wireShortcuts(
      state,
      () => engine,
      { selectNote: vi.fn(), deselectAll: vi.fn(), adjustPitch: vi.fn(), adjustOctave: vi.fn(), navigateNext: vi.fn(), navigateSelection: vi.fn(), navigateBarline: vi.fn(() => false) } as never,
      { clearArmedArticulations: vi.fn() } as never,
      {} as never,
      { renderScore } as never,
      {} as never,
      { model: { getViewportSize: () => ({ w: 800, h: 400 }) } } as never,
      () => null, () => {}, () => {}, () => false,
      () => {},
    )
    run = wiring.run
    teardown = wiring.disable
  })
  afterEach(() => { teardown() })

  const selectTempo = () => { state.selectedElement = { kind: 'tempo', id: 'T1' } }

  it('⭐ plain arrows nudge FINE, in all four directions', () => {
    // 🚨 **↑ passes a POSITIVE dy here**, where every other family passes a negative one: this mark's
    // offset is OUTWARD (+up), his call of 2026-08-19 — *"the y is inverted, a high value makes the
    // text down"*. A tempo mark is always ABOVE the staff, so a number about it means how far FROM
    // the staff. ⛔ If this ever reads like the dynamic's again, the panel and the ink disagree.
    selectTempo()
    run('selectNextNote')     // →
    run('selectPreviousNote') // ←
    run('pitchUp')            // ↑
    run('pitchDown')          // ↓
    expect(nudge.mock.calls).toEqual([
      ['T1', 0.25, 0], ['T1', -0.25, 0], ['T1', 0, 0.25], ['T1', 0, -0.25],
    ])
  })

  it('⭐ `Ctrl`+arrows nudge COARSE — the same four, one whole space', () => {
    selectTempo()
    run('ctrlArrowRight')
    run('ctrlArrowLeft')
    run('octaveUp')
    run('octaveDown')
    expect(nudge.mock.calls).toEqual([
      ['T1', 1, 0], ['T1', -1, 0], ['T1', 0, 1], ['T1', 0, -1],
    ])
  })

  it('⭐ `Ctrl+Backspace` puts the mark back where the engraver had it', () => {
    selectTempo()
    run('resetMove')
    expect(reset).toHaveBeenCalledWith('T1')
    expect(renderScore).toHaveBeenCalled()
  })

  it('🚨 …and DECLINES when the mark was never nudged, so the key falls through', () => {
    // The chain's standing rule: the reset key has several tenants (the note's spacing, the bar's
    // width), and a branch that swallowed the press for "nothing to do" would disable them. What is
    // observable here is the half this module owns: a declining branch repaints NOTHING and returns
    // the press to the chain — the `||` does the rest.
    reset.mockReturnValue(false)
    selectTempo()
    run('resetMove')
    expect(reset, 'it did ask').toHaveBeenCalledWith('T1')
    expect(renderScore, 'and painted nothing').not.toHaveBeenCalled()
  })

  it('⭐⭐ `Ctrl+Shift+←/→` moves the mark through the MUSIC — the other chord, the other category', () => {
    // Two chords, two categories, one selection: the plain and `Ctrl` arrows above write an
    // engraving override, and this one writes the MODEL — audibly, since the tempo applies from the
    // beat it lands on.
    selectTempo()
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(reanchor.mock.calls).toEqual([['T1', 1], ['T1', -1]])
    expect(nudge, 'and it never reaches the INK').not.toHaveBeenCalled()
  })

  it('🚨 …and the INK chords never reach the re-anchor', () => {
    selectTempo()
    run('selectNextNote')
    run('ctrlArrowRight')
    run('pitchUp')
    expect(nudge).toHaveBeenCalledTimes(3)
    expect(reanchor).not.toHaveBeenCalled()
  })

  it('⛔ leaves the arrows alone when the selected element is not a tempo mark', () => {
    state.selectedElement = { kind: 'clef', measure: 1, beat: { num: 0, den: 1 }, clef: 'treble' } as never
    run('selectNextNote')
    run('ctrlArrowRight')
    run('ctrlShiftArrowRight')
    expect(nudge).not.toHaveBeenCalled()
    expect(reanchor).not.toHaveBeenCalled()
  })
})
