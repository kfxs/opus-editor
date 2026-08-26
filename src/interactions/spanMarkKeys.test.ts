import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import {
  cycleSpanMarkEnd, nudgeArmedSpanMarkEnd, nudgeSelectedSpanMark, resetArmedSpanMarkEnd,
  resetSelectedSpanMark,
} from './spanMarkKeys'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐⭐ **THE FAMILY'S KEY VERBS** — {@link spanMarkKeys}, sitting beside this file, driven at the
 * PEDAL's row (`SPAN_MARK_TOOLS.pedal`) because Phase 3 is the kind the union starts at.
 *
 * What it pins is the sentence the five per-kind copies each stated separately: **something armed →
 * that end moves; nothing armed → the whole mark does**, with the horizontal going through the WALK
 * and the vertical staying a plain lift. ⭐ The pair of verbs must never BOTH fire, which is what
 * lets `shortcutWiring` chain several kinds onto one key.
 *
 * ⚠️ Distinct from `shortcutWiring.pedalOffset.test.ts` next door, deliberately: that one asks *which
 * CHORD runs which action* (the wiring's contract), this one asks *what the action does* (the
 * driver's). The split is the repo's rule — a spec moves with the module it answers for.
 *
 * The engine is a stub: what is under test is the ROUTING, not the arithmetic each op owns. ⭐ The
 * walk is real, and it is given nothing drawn to walk onto (`nextPedalStartSlot: null`), so a
 * horizontal press stays the plain ink nudge these cases are about.
 */
describe('the span-mark key verbs, at the pedal row', () => {
  let state: EditorState
  let engine: MusicEngine
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let whole: Mock<(id: string, dx: number, dy: number) => boolean>
  let resetEnd: Mock<(id: string, which: 'start' | 'end') => boolean>
  let resetWhole: Mock<(id: string) => boolean>
  let handles: Mock<() => unknown[]>

  beforeEach(() => {
    nudge = vi.fn(() => true)
    whole = vi.fn(() => true)
    resetEnd = vi.fn(() => true)
    resetWhole = vi.fn(() => true)
    handles = vi.fn(() => [])
    engine = {
      nudgePedalEndpoint: nudge,
      nudgePedal: whole,
      resetPedalEndpointOffset: resetEnd,
      resetPedalOffset: resetWhole,
      // Nothing drawn to walk onto, so both horizontals fall through to the ink nudge.
      nextPedalStartSlot: vi.fn(() => null),
      nextPedalLift: vi.fn(() => null),
      pedalLiftSlot: vi.fn(() => null),
      getPedalById: () => ({ id: 'P1' }),
      getScore: () => ({ measures: [] }),
      getElementRegistry: () => ({ getByType: handles }),
    } as unknown as MusicEngine
    state = createEditorState()
  })

  /** Select the pedal, with one of its squares armed or none. */
  const select = (endpoint?: 'start' | 'end') => {
    state.selectedElement = { kind: 'pedal', id: 'P1', endpoint }
  }

  it('⭐ moves the ARMED end when one is armed', () => {
    select('end')
    expect(nudgeArmedSpanMarkEnd('pedal', state, engine, 0.25, 0)).toBe(true)
    expect(nudge).toHaveBeenCalledWith('P1', 'end', 0.25, 0)
    expect(whole, 'the whole mark stayed still').not.toHaveBeenCalled()
  })

  it('⭐⭐ …and the WHOLE-mark verb declines on the same press, so the pair never both fire', () => {
    select('end')
    expect(nudgeSelectedSpanMark('pedal', state, engine, 0.25, 0)).toBe(false)
    expect(whole).not.toHaveBeenCalled()
  })

  it('⭐⭐ moves the WHOLE mark when NOTHING is armed — and the armed verb declines', () => {
    select()
    expect(nudgeArmedSpanMarkEnd('pedal', state, engine, 0.25, 0)).toBe(false)
    expect(nudgeSelectedSpanMark('pedal', state, engine, 0.25, 0)).toBe(true)
    expect(whole).toHaveBeenCalledWith('P1', 0.25, 0)
    expect(nudge, 'no single end was touched').not.toHaveBeenCalled()
  })

  it("⭐⭐ passes a SCREEN vertical straight through — the pedal's `verticalSign` is 1, ⛔ no flip", () => {
    select('start')
    nudgeArmedSpanMarkEnd('pedal', state, engine, 0, -1)
    expect(nudge, 'up stays negative').toHaveBeenCalledWith('P1', 'start', 0, -1)
    select()
    nudgeSelectedSpanMark('pedal', state, engine, 0, 1)
    expect(whole).toHaveBeenCalledWith('P1', 0, 1)
  })

  it('resets the armed end, or the whole mark when none is armed — never both', () => {
    select('start')
    expect(resetArmedSpanMarkEnd('pedal', state, engine)).toBe(true)
    expect(resetSelectedSpanMark('pedal', state, engine)).toBe(false)
    expect(resetEnd).toHaveBeenCalledWith('P1', 'start')
    expect(resetWhole).not.toHaveBeenCalled()

    select()
    expect(resetArmedSpanMarkEnd('pedal', state, engine)).toBe(false)
    expect(resetSelectedSpanMark('pedal', state, engine)).toBe(true)
    expect(resetWhole).toHaveBeenCalledWith('P1')
  })

  it('⚠️ DECLINEs when the model refuses, so the key falls through rather than repainting', () => {
    select('start')
    resetEnd.mockReturnValue(false)
    expect(resetArmedSpanMarkEnd('pedal', state, engine)).toBe(false)
  })

  it('⭐ DECLINEs with nothing of this kind selected, so the arrows stay the note keys', () => {
    expect(nudgeArmedSpanMarkEnd('pedal', state, engine, 0.25, 0)).toBe(false)
    expect(nudgeSelectedSpanMark('pedal', state, engine, 0.25, 0)).toBe(false)
    expect(resetArmedSpanMarkEnd('pedal', state, engine)).toBe(false)
    expect(resetSelectedSpanMark('pedal', state, engine)).toBe(false)
    state.selectedElement = { kind: 'ottava', id: 'O1' }
    expect(nudgeSelectedSpanMark('pedal', state, engine, 0.25, 0), 'another kind is not this one').toBe(false)
  })

  it('⛔ …and with no engine at all', () => {
    select('start')
    expect(nudgeArmedSpanMarkEnd('pedal', state, null, 0.25, 0)).toBe(false)
    expect(resetArmedSpanMarkEnd('pedal', state, null)).toBe(false)
    expect(cycleSpanMarkEnd('pedal', state, null, 1)).toBe(false)
  })

  it('⚠️ `Tab` declines where the squares are NOT DRAWN — the registry is the list', () => {
    select()
    expect(cycleSpanMarkEnd('pedal', state, engine, 1)).toBe(false)
    expect(handles, 'it asked the registry rather than the model').toHaveBeenCalled()
  })
})
