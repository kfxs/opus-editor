// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐ WHICH KEY MOVES A SUSTAIN PEDAL'S INK (his ask, 2026-08-18: *"now lets do the arrow ctr arrow
 * offset similar to ottava"*).
 *
 * Subject: `./shortcutWiring` — the pedal's second chapter, beside `.pedalResize.test.ts`, and the
 * pair of them is the claim: **one pair of squares, two CATEGORIES of edit on two chords.**
 * `Ctrl+Shift+←/→` says when the damper moves (the model, audible); a plain or `Ctrl` arrow says
 * where the glyph sits (an override). ⛔ Neither may reach the other's write, and the two cases at
 * the end are the ones that would go red if a branch were chained onto the wrong chord.
 *
 * ⭐⭐ **And the vertical is where this family differs from the bracket next door**: `↑`/`↓` pass a
 * SCREEN delta straight through, where `nudgeArmedOttavaEnd` negates it above the staff. A pedal has
 * one side permanently, so there is no outward-from-the-staff conversion to make — and a negation
 * copied in from the ottava would be invisible until someone read the number.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
/** The wiring's own steps, so a change to either is a compile-visible change here too. */
const NUDGE_FINE = 0.25
const NUDGE_COARSE = 1.0

describe('nudging a sustain pedal\'s ink from the keyboard', () => {
  let state: EditorState
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let whole: Mock<(id: string, dx: number, dy: number) => boolean>
  let reset: Mock<(id: string, which: 'start' | 'end') => boolean>
  let resetWhole: Mock<(id: string) => boolean>
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let adjustPitch: Mock<(delta: number) => void>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    nudge = vi.fn(() => true)
    whole = vi.fn(() => true)
    reset = vi.fn(() => true)
    resetWhole = vi.fn(() => true)
    resize = vi.fn(() => true)
    adjustPitch = vi.fn()
    const engine = {
      nudgePedalEndpoint: nudge,
      nudgePedal: whole,
      resetPedalEndpointOffset: reset,
      resetPedalOffset: resetWhole,
      resizePedalBySlot: resize,
      movePedalStartBySlot: vi.fn(() => true),
      // ⭐ Both squares' horizontals ask the WALK first (`./pedalWalk`); nothing is drawn here, so
      // "nowhere to go" keeps the press the plain nudge these cases are about.
      nextPedalStartSlot: vi.fn(() => null),
      nextPedalLift: vi.fn(() => null),
      pedalLiftSlot: vi.fn(() => null),
      getPedalById: () => ({ id: 'P1' }),
      getScore: () => ({ measures: [] }),
      // The families ahead of the pedal in every chain — stubbed to DECLINE, so a case that reaches
      // a pedal branch proves the chain got that far rather than crashing.
      nudgeHairpinEndpoint: vi.fn(() => false),
      nudgeOttavaEndpoint: vi.fn(() => false),
      resizeHairpinBySlot: vi.fn(() => false),
      moveHairpinStartBySlot: vi.fn(() => false),
      resizeOttavaBySlot: vi.fn(() => false),
      moveOttavaStartBySlot: vi.fn(() => false),
      getOttavaById: () => null,
      getElementRegistry: () => ({ getByType: () => [] }),
      getSlurById: () => null,
      getNote: () => null,
    } as unknown as MusicEngine

    state = createEditorState()
    state.selectedTool = 'selection'

    const wiring = wireShortcuts(
      state,
      () => engine,
      {
        selectNote: vi.fn(), deselectAll: vi.fn(), adjustPitch, navigateNext: vi.fn(),
        navigateSelection: vi.fn(), navigateBarline: () => false, adjustOctave: vi.fn(),
      } as never,
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

  it('⭐ a plain arrow moves the ARMED sign by the FINE step, in x', () => {
    armed('end')
    run('selectNextNote')
    run('selectPreviousNote')
    expect(nudge.mock.calls).toEqual([
      ['P1', 'end', NUDGE_FINE, 0],
      ['P1', 'end', -NUDGE_FINE, 0],
    ])
  })

  it('⭐ `Ctrl`+arrow is the same edit at the COARSE step', () => {
    armed('start')
    run('ctrlArrowRight')
    run('ctrlArrowLeft')
    expect(nudge.mock.calls).toEqual([
      ['P1', 'start', NUDGE_COARSE, 0],
      ['P1', 'start', -NUDGE_COARSE, 0],
    ])
  })

  it('⭐⭐ `↑`/`↓` pass a SCREEN delta through — ⛔ NO outward conversion, unlike the bracket\'s', () => {
    // 🚨 THE BREAK-TEST against copying `nudgeArmedOttavaEnd`: that one negates dy above the staff,
    // and a pedal is always below, so a negation borrowed from it would send `↑` downward with
    // nothing on screen to say which of the two was wrong until you read the stored number.
    armed('end')
    run('pitchUp')
    run('pitchDown')
    run('octaveUp')
    expect(nudge.mock.calls).toEqual([
      ['P1', 'end', 0, -NUDGE_FINE],   // ↑ is negative y — up the screen
      ['P1', 'end', 0, NUDGE_FINE],
      ['P1', 'end', 0, -NUDGE_COARSE],
    ])
  })

  it('⭐⭐ with NOTHING armed the same keys move the WHOLE pedal', () => {
    // ⚠️ Since 2026-08-21 the HORIZONTAL travels through `pedalWalk.walkPedalBody`, which nudges the
    // same ink and hands the whole pedal along when it arrives. It lands on `nudgePedal` here because
    // this fixture measures NOTHING — no drawn onsets, so no stop to arrive at — which is the walk's
    // own no-guessing rule. ⭐ What the crossing does is `pedalWalk.test.ts`'s chapter; what this file
    // owns is the CHORD and the branch: nothing armed → the pair, and ⛔ never the per-sign write.
    armed()
    run('selectNextNote')
    run('pitchUp')
    expect(whole.mock.calls).toEqual([['P1', NUDGE_FINE, 0], ['P1', 0, -NUDGE_FINE]])
    expect(nudge, 'never the per-sign write').not.toHaveBeenCalled()
  })

  it('`Ctrl+Backspace` resets the armed sign, or the whole pedal when none is armed', () => {
    armed('start')
    run('resetMove')
    expect(reset.mock.calls).toEqual([['P1', 'start']])
    armed()
    run('resetMove')
    expect(resetWhole.mock.calls).toEqual([['P1']])
  })

  it('⛔ the INK keys never reach the EXTENT write — two chords, two categories', () => {
    armed('end')
    run('selectNextNote'); run('ctrlArrowRight'); run('pitchUp')
    expect(resize, 'the lift is `Ctrl+Shift`\'s alone').not.toHaveBeenCalled()
  })

  it('⛔ …and `Ctrl+Shift+←/→` never reaches the INK write', () => {
    armed('end')
    run('ctrlShiftArrowRight')
    expect(nudge).not.toHaveBeenCalled()
    expect(whole).not.toHaveBeenCalled()
    expect(resize).toHaveBeenCalled()
  })

  it('⭐ DECLINES with no pedal selected, so the arrows stay the note keys', () => {
    state.selectedElement = null
    run('pitchUp')
    expect(nudge).not.toHaveBeenCalled()
    expect(whole).not.toHaveBeenCalled()
    expect(adjustPitch).toHaveBeenCalledWith(1)
  })
})
