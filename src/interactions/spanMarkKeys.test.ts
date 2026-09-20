import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import {
  cycleSpanMarkEnd, nudgeArmedSpanMarkEnd, nudgeSelectedSpanMark, resetArmedSpanMarkEnd,
  resetSelectedSpanMark, spanMarkKeys,
} from './spanMarkKeys'
import { createEditorState, type EditorState } from './state/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { KeysCtx } from './elements/keys'
import { SPAN_MARK_TOOLS } from './spanMarkTools'

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
      pedal: {
        nudgePedalEndpoint: nudge,
        nudgePedal: whole,
        // ⭐ The WALK previews since 2026-08-30 — a run of presses is ONE undo entry (`./keyRun`).
        //   Aliased to the same mocks: the claim here is the ROUTING, which is unchanged.
        previewPedalEndpointOffset: nudge,
        previewPedalOffset: (id: string, dx: number, dy: number) => whole(id, dx, dy),
        previewPedalEndpointRebase: vi.fn(() => true),
        previewPedalOffsetRebase: vi.fn(() => true),
        previewPedalStartAtSlot: vi.fn(() => true),
        previewPedalLiftAt: vi.fn(() => true),
        previewPedalSlot: vi.fn(() => true),
        resetPedalEndpointOffset: resetEnd,
        resetPedalOffset: resetWhole,
        // Nothing drawn to walk onto, so both horizontals fall through to the ink nudge.
        nextPedalStartSlot: vi.fn(() => null),
        nextPedalLift: vi.fn(() => null),
        pedalLiftSlot: vi.fn(() => null),
      },
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

/**
 * ⭐⭐ **THE OTTAVA'S CHAPTER: THE ONE ROW THAT FLIPS.** Every other kind so far passes the keyboard's
 * screen delta through untouched; a bracket must convert it to OUTWARD-from-the-staff, because `↑`
 * is a screen direction while the stored number means "further from the staff" — so that flipping
 * 8va↔8vb cannot invert a nudge the user already made (see `OttavaOffsetOverride`).
 *
 * 🚨 This is where the family's one conversion lives now, and it is the case that would go red if a
 * future kind's row copied the pedal's `() => 1` without asking which side its mark is drawn on.
 */
describe("the span-mark key verbs, at the ottava row — screen → outward", () => {
  let state: EditorState
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, outward: number) => boolean>
  let whole: Mock<(id: string, dx: number, outward: number) => boolean>
  let shift: 1 | -1

  /** An engine whose only interesting answer is which side the bracket is drawn on. */
  const engineFor = (): MusicEngine => ({
    ottava: {
      nudgeOttavaEndpoint: nudge,
      nudgeOttava: whole,
      // ⭐ As the pedal row above: the walk previews, the run commits (`./keyRun`).
      previewOttavaEndpointOffset: nudge,
      previewOttavaOffset: (id: string, dx: number, dy: number) => whole(id, dx, dy),
      previewOttavaEndpointRebase: vi.fn(() => true),
      previewOttavaOffsetRebase: vi.fn(() => true),
      previewOttavaEnd: vi.fn(() => true),
      previewOttavaSlot: vi.fn(() => true),
      nextOttavaStartSlot: vi.fn(() => null),
      nextOttavaEndSlot: vi.fn(() => null),
      ottavaEndSlot: vi.fn(() => null),
    },
    getOttavaById: () => ({ id: 'O1', shift }),
    // Nothing drawn to walk onto, so a horizontal press stays the plain ink nudge.
    getScore: () => ({ measures: [] }),
    getElementRegistry: () => ({ getByType: () => [] }),
  } as unknown as MusicEngine)

  beforeEach(() => {
    nudge = vi.fn(() => true)
    whole = vi.fn(() => true)
    shift = 1
    state = createEditorState()
  })

  it('⭐⭐ an 8va NEGATES: screen-up (−1) becomes a POSITIVE outward', () => {
    state.selectedElement = { kind: 'ottava', id: 'O1', endpoint: 'start' }
    nudgeArmedSpanMarkEnd('ottava', state, engineFor(), 0, -1)
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 0, 1)
  })

  it('⭐⭐ …and an 8vb does NOT — below the staff, screen-up is INWARD', () => {
    shift = -1
    state.selectedElement = { kind: 'ottava', id: 'O1', endpoint: 'start' }
    nudgeArmedSpanMarkEnd('ottava', state, engineFor(), 0, -1)
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 0, -1)
  })

  it('⚠️ the WHOLE-mark verb converts by the same rule — ⛔ never one and not the other', () => {
    state.selectedElement = { kind: 'ottava', id: 'O1' }
    nudgeSelectedSpanMark('ottava', state, engineFor(), 0, -1)
    expect(whole, '8va up → +outward').toHaveBeenCalledWith('O1', 0, 1)
    shift = -1
    nudgeSelectedSpanMark('ottava', state, engineFor(), 0, -1)
    expect(whole, '8vb up → −outward').toHaveBeenCalledWith('O1', 0, -1)
  })

  it('⭐ the HORIZONTAL is not converted at all — x is x on both sides of the staff', () => {
    state.selectedElement = { kind: 'ottava', id: 'O1', endpoint: 'end' }
    nudgeArmedSpanMarkEnd('ottava', state, engineFor(), 0.25, 0)
    expect(nudge).toHaveBeenCalledWith('O1', 'end', 0.25, 0)
  })
})

/**
 * ⭐⭐ **THE TRILL FLIPS TOO, off `placement` rather than `shift`** — and this chapter exists because
 * a break-test found it UNCOVERED: on 2026-08-26, replacing the trill's `verticalSign` with `() => 1`
 * left all 1,687 interaction specs green. The conversion had lived in a `shortcutWiring` closure
 * since it was written and nothing had ever asserted it.
 *
 * ⭐ That is the refactor earning its keep in a way the line count does not show: the same rule now
 * has ONE home per kind, and a missing test for it is visible instead of buried in a closure.
 */
describe("the span-mark key verbs, at the trill row — screen → outward", () => {
  let state: EditorState
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, outward: number) => boolean>
  let whole: Mock<(id: string, dx: number, outward: number) => boolean>
  let placement: 'above' | 'below'

  const engineFor = (): MusicEngine => ({
    trill: {
      nudgeTrillEndpoint: nudge,
      nudgeTrill: whole,
    },
    getTrillById: () => ({ id: 'T1', placement, extension: 'none' }),
    getScore: () => ({ measures: [] }),
    getElementRegistry: () => ({ getByType: () => [] }),
  } as unknown as MusicEngine)

  beforeEach(() => {
    nudge = vi.fn(() => true)
    whole = vi.fn(() => true)
    placement = 'above'
    state = createEditorState()
  })

  it('⭐⭐ an ABOVE trill negates: screen-up (−1) becomes a POSITIVE outward', () => {
    state.selectedElement = { kind: 'trill', id: 'T1', endpoint: 'start' }
    nudgeArmedSpanMarkEnd('trill', state, engineFor(), 0, -1)
    expect(nudge).toHaveBeenCalledWith('T1', 'start', 0, 1)
  })

  it('⭐⭐ …and a BELOW trill does not — under the staff, screen-up is INWARD', () => {
    placement = 'below'
    state.selectedElement = { kind: 'trill', id: 'T1', endpoint: 'start' }
    nudgeArmedSpanMarkEnd('trill', state, engineFor(), 0, -1)
    expect(nudge).toHaveBeenCalledWith('T1', 'start', 0, -1)
  })

  it('⚠️ the WHOLE-ornament verb converts by the same rule', () => {
    state.selectedElement = { kind: 'trill', id: 'T1' }
    nudgeSelectedSpanMark('trill', state, engineFor(), 0, -1)
    expect(whole, 'above → +outward').toHaveBeenCalledWith('T1', 0, 1)
    placement = 'below'
    nudgeSelectedSpanMark('trill', state, engineFor(), 0, -1)
    expect(whole, 'below → −outward').toHaveBeenCalledWith('T1', 0, -1)
  })
})

/**
 * **The family's row of the `keys` column** — the verbs above reached through the selected
 * element's own spec, plus what the row adds: the key RUN's commit, read off `SPAN_MARK_TOOLS`.
 */
describe('spanMarkKeys — a span mark\'s row of the keys column', () => {
  const engine = {
    // The family's COMMANDS hang off `engine.ottava` (`engine/commands/ottavaCommands`).
    ottava: {
      nudgeOttavaEndpoint: vi.fn(() => true),
      nudgeOttava: vi.fn(() => true),
      resetOttavaEndpointOffset: vi.fn(() => true),
      resetOttavaOffset: vi.fn(() => false),
      commitOttavaDrag: vi.fn(),
      commitOttavaOffsetDrag: vi.fn(),
      resizeOttavaBySlot: vi.fn(() => true),
      moveOttavaStartBySlot: vi.fn(() => true),
    },
    getOttavaById: () => ({ id: 'O1', shift: 1 }),
    trill: {
      commitTrillDrag: vi.fn(),
    },
  }
  let ctx: KeysCtx
  let state: EditorState

  beforeEach(() => {
    vi.clearAllMocks()
    state = createEditorState()
    ctx = { engine: engine as unknown as MusicEngine, state, render: vi.fn(), afterMarkPress: vi.fn() }
  })

  const select = (endpoint?: 'start' | 'end') => {
    const element = { kind: 'ottava', id: 'O1', endpoint } as const
    state.selectedElement = element
    return element
  }
  const commitOf = () => (ctx.afterMarkPress as Mock).mock.calls[0][4] as () => void

  it('an ARMED square nudges that end, and the run commits THAT end', () => {
    expect(spanMarkKeys('ottava').nudge!(ctx, select('end'), 0, -0.25)).toBe(true)
    expect(engine.ottava.nudgeOttavaEndpoint).toHaveBeenCalled()
    expect((ctx.afterMarkPress as Mock).mock.calls[0].slice(0, 4)).toEqual(['ottava', 'O1', 0, -0.25])
    commitOf()()
    expect(engine.ottava.commitOttavaDrag).toHaveBeenCalledWith('end')
  })

  it('NOTHING armed nudges the whole mark, and the run commits the WHOLE-mark drag', () => {
    expect(spanMarkKeys('ottava').nudge!(ctx, select(), 0, 0.25)).toBe(true)
    expect(engine.ottava.nudgeOttava).toHaveBeenCalled()
    commitOf()()
    expect(engine.ottava.commitOttavaOffsetDrag).toHaveBeenCalledTimes(1)
  })

  it('⚠️ a TRILL\'s whole-mark run commits through its START — the ornament has one drag commit', () => {
    SPAN_MARK_TOOLS.trill.commitWhole(engine as unknown as MusicEngine)
    expect(engine.trill.commitTrillDrag).toHaveBeenCalledWith('start')
  })

  it('🚨 a REFUSED press DECLINES, and hands nothing to the run', () => {
    engine.ottava.nudgeOttava.mockReturnValueOnce(false)
    expect(spanMarkKeys('ottava').nudge!(ctx, select(), 0, 0.25)).toBe(false)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()
  })

  it('⭐ reanchor: the armed SQUARE is the gate — END resizes, START moves the beginning, nothing armed DECLINES', () => {
    engine.ottava.resizeOttavaBySlot.mockReturnValue(true)
    engine.ottava.moveOttavaStartBySlot.mockReturnValue(true)
    expect(spanMarkKeys('ottava').reanchor!(ctx, select('end'), 1)).toBe(true)
    expect(engine.ottava.resizeOttavaBySlot).toHaveBeenCalledWith('O1', 1)
    expect(spanMarkKeys('ottava').reanchor!(ctx, select('start'), -1)).toBe(true)
    expect(engine.ottava.moveOttavaStartBySlot).toHaveBeenCalledWith('O1', -1)
    expect(ctx.render).toHaveBeenCalledTimes(2)
    expect(spanMarkKeys('ottava').reanchor!(ctx, select(), 1)).toBe(false)
  })

  it('reanchor DECLINES, and draws nothing, when the model refuses', () => {
    engine.ottava.resizeOttavaBySlot.mockReturnValue(false)
    expect(spanMarkKeys('ottava').reanchor!(ctx, select('end'), -1)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('reset: armed → that end, and it renders; nothing to take back → DECLINES, and does not', () => {
    expect(spanMarkKeys('ottava').reset!(ctx, select('start'))).toBe(true)
    expect(engine.ottava.resetOttavaEndpointOffset).toHaveBeenCalledWith('O1', 'start')
    expect(ctx.render).toHaveBeenCalledTimes(1)
    expect(spanMarkKeys('ottava').reset!(ctx, select())).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
