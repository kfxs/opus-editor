// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEY MOVES A SUSTAIN PEDAL'S TWO ENDS, AND WHEN (his call, 2026-08-18).
 *
 * Subject: `./shortcutWiring` — the pedal's chapter beside `.hairpinResize.test.ts` and
 * `.ottavaResize.test.ts`, repeating their claim for the third span: **ONE CHORD,
 * `Ctrl+Shift+←/→`, and the ARMED SQUARE decides which end it moves.** The right square moves the
 * LIFT, the left one moves the press and holds the lift.
 *
 * 🚨 **And one claim the other two chapters do not have to make: `Ctrl+←/→` never moves the LIFT.**
 * The lift move shipped on that chord in P3 and was ungated, which put an AUDIBLE model write on the
 * key this editor reserves for nudging ink. That key now carries the pedal's own ink offset instead
 * (`.pedalOffset.test.ts`); the regression case below is the one that would go red if the model
 * write were ever chained back onto it.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
describe('moving a sustain pedal\'s ends from the keyboard', () => {
  let state: EditorState
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let moveStart: Mock<(id: string, direction: 1 | -1) => boolean>
  let noteOffset: Mock<(id: string, dx: number) => boolean>
  let nudgeWhole: Mock<(id: string, dx: number, dy: number) => boolean>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    resize = vi.fn(() => true)
    moveStart = vi.fn(() => true)
    noteOffset = vi.fn(() => true)
    nudgeWhole = vi.fn(() => true)
    const engine = {
      resizePedalBySlot: resize,
      movePedalStartBySlot: moveStart,
      nudgeNoteOffset: noteOffset,
      nudgePedal: nudgeWhole,
      nudgePedalEndpoint: vi.fn(() => true),
      // ⭐ An armed square's horizontal asks the WALK first (`./pedalWalk`); nothing is drawn here,
      // so "nowhere to go" leaves the press the plain ink nudge these cases are about.
      nextPedalStartSlot: vi.fn(() => null),
      nextPedalLift: vi.fn(() => null),
      pedalLiftSlot: vi.fn(() => null),
      getPedalById: () => ({ id: 'P1' }),
      getScore: () => ({ measures: [] }),
      resizeHairpinBySlot: vi.fn(() => false),
      moveHairpinStartBySlot: vi.fn(() => false),
      resizeOttavaBySlot: vi.fn(() => false),
      moveOttavaStartBySlot: vi.fn(() => false),
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
    state.selectedElement = { kind: 'pedal', id: 'P1', endpoint }
  }

  it('⭐ the RIGHT square moves the LIFT — → lengthens, ← shortens', () => {
    armed('end')
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize.mock.calls).toEqual([['P1', 1], ['P1', -1]])
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('⭐⭐ the LEFT square moves the PRESS instead — one chord, and the armed end decides', () => {
    armed('start')
    run('ctrlShiftArrowLeft')
    run('ctrlShiftArrowRight')
    expect(moveStart.mock.calls).toEqual([['P1', -1], ['P1', 1]])
    // ⚠️ …and never the other write: the lift must not move while the left square is armed.
    expect(resize).not.toHaveBeenCalled()
  })

  it('⛔ does NOTHING to the pedal with no square armed — the key edits the end you are pointing at', () => {
    armed()
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })

  it('⭐ DECLINES rather than swallowing the chord, so what sits behind it still runs', () => {
    // A selected pedal with no square armed must leave `Ctrl+Shift+←/→` to the note offset — the
    // branch it shares the chord with. A gate that consumed the key would silently disable that.
    armed()
    state.selectedItems = new Map([['N1', { kind: 'note', id: 'N1' }]]) as never
    run('ctrlShiftArrowRight')
    expect(noteOffset).toHaveBeenCalled()
  })

  it('🚨 `Ctrl+←/→` NEVER REACHES THE WHOLE-SLOT JUMP — that chord nudges INK', () => {
    // The regression guard for the 2026-08-18 move, and it has now outlived TWO of its own
    // sentences. That day the pedal had no ink offsets, so "no longer touches the pedal" and "no
    // longer moves the lift" were the same assertion; hours later `Ctrl+arrow` came back as an
    // OFFSET (`.pedalOffset.test.ts`). On 2026-08-21 the ink chord learned to WALK
    // (`./pedalWalk`), so a press that arrives at the next stop does move the foot — by the walk's
    // own write, and never by the whole-slot jump this pair of mocks stands for. ⭐ The assertion
    // below is the one that was always the point and it is unchanged.
    //
    // It fires with the END square armed, AND with no square armed, which is the state the old
    // ungated branch answered in.
    armed('end')
    run('ctrlArrowRight')
    armed()
    run('ctrlArrowLeft')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()

    // ⚠️ …and the chord is LIVE, which this case has to prove itself: an unregistered action name
    // only warns, so "nothing happened" is exactly what a typo here would also look like. The ink
    // branch answering is that proof — and it is the very branch that must not be the model write.
    expect(nudgeWhole).toHaveBeenCalled()
  })

  it('⛔ answers for a PEDAL only — a selected ottava does not reach these branches', () => {
    state.selectedElement = { kind: 'ottava', id: 'O1', endpoint: 'end' }
    run('ctrlShiftArrowRight')
    expect(resize).not.toHaveBeenCalled()
    expect(moveStart).not.toHaveBeenCalled()
  })
})
