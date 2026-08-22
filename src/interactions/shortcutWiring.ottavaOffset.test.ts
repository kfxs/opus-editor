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
/** The wiring's own steps, so a change to either is a compile-visible change here too. */
const NUDGE_FINE = 0.25
const NUDGE_COARSE = 1.0

describe('nudging an octave bracket\'s ink from the keyboard', () => {
  let state: EditorState
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let reset: Mock<(id: string, which: 'start' | 'end') => boolean>
  let resize: Mock<(id: string, direction: 1 | -1) => boolean>
  let whole: Mock<(id: string, dx: number, outward: number) => boolean>
  let adjustPitch: Mock<(delta: number) => void>
  let run: (action: string) => void
  let teardown: () => void
  /** Which side the fixture's bracket is on — +1 an 8va (above), −1 an 8vb (below). */
  let side: 1 | -1

  beforeEach(() => {
    side = 1
    nudge = vi.fn(() => true)
    whole = vi.fn(() => true)
    reset = vi.fn(() => true)
    resize = vi.fn(() => true)
    adjustPitch = vi.fn()
    const engine = {
      nudgeOttavaEndpoint: nudge,
      nudgeOttava: whole,
      resetOttavaOffset: vi.fn(() => true),
      // ⚠️ The wiring asks which SIDE the bracket is on, to turn the key's screen direction into the
      // model's outward-from-the-staff one. An 8va here; the 8vb case has its own test below.
      getOttavaById: () => ({ id: 'O1', shift: side }),
      resetOttavaEndpointOffset: reset,
      resizeOttavaBySlot: resize,
      moveOttavaStartBySlot: vi.fn(() => true),
      // ⭐ Both squares' horizontals ask the WALK first (`./ottavaWalk`); nothing is drawn here, so
      // "nowhere to go" keeps the press the plain nudge these cases are about.
      nextOttavaStartSlot: vi.fn(() => null),
      nextOttavaEndSlot: vi.fn(() => null),
      ottavaEndSlot: vi.fn(() => null),
      // The hairpin's own branches sit ahead of the ottava's in every chain — stubbed so the last
      // case can prove they answer FIRST for a wedge rather than crashing past it.
      nudgeHairpinEndpoint: vi.fn(() => true),
      // ⭐ Both squares' horizontals ask the WALK first (`./hairpinWalk`); nothing is drawn here, so
      // "nowhere to go" keeps the press the plain nudge this case is about.
      nextHairpinStartSlot: vi.fn(() => null),
      nextHairpinEndStop: vi.fn(() => null),
      getHairpinById: () => ({ id: 'H1', type: 'cresc' }),
      getScore: () => ({ measures: [] }),
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
      { renderScore: vi.fn(), previewMarks: vi.fn() } as never,
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
  /** The (which, dx, outward) of every nudge call, dropping the id. */
  const calls = () => nudge.mock.calls.map(([, which, dx, outward]) => [which, dx, outward])

  it('⭐ the armed square moves horizontally — plain arrow FINE, Ctrl+arrow COARSE', () => {
    armed('end')
    run('selectNextNote')
    run('ctrlArrowRight')
    const [fine, coarse] = calls()
    expect(fine[0]).toBe('end')
    expect(fine[1] as number).toBeGreaterThan(0)
    expect(coarse[1] as number).toBeGreaterThan(fine[1] as number) // Ctrl is the bigger step
    // ⚠️ `toBeCloseTo`, not `toBe`: negating a 0 gives -0, and `Object.is(-0, 0)` is false.
    expect(fine[2] as number, 'a horizontal key sends no vertical').toBeCloseTo(0)
  })

  it('⭐⭐ ↑/↓ route the SAME vertical from EITHER square — the bracket is one straight line', () => {
    armed('start')
    run('pitchUp')
    armed('end')
    run('pitchUp')
    const [fromStart, fromEnd] = calls()
    expect(fromStart[0]).toBe('start')
    expect(fromEnd[0]).toBe('end')
    // ⭐ Same delta from both. The two squares are two doors to one quantity; the model has nowhere to
    // put a second, so nothing here has to keep them equal.
    expect(fromStart[2]).toBe(fromEnd[2])
    expect(fromStart[1], 'a vertical key sends no dx').toBe(0)
  })

  it('⭐⭐ ↑ means FURTHER FROM THE STAFF — so its sign FLIPS with the side', () => {
    // His correction, 2026-08-17: *"the height is not intuitive… for 8vb it works, because increasing
    // makes it higher, but with 8va alta it does not."* The stored number is a distance from the
    // staff, so this wiring — the one place that speaks SCREEN, because a key is a screen direction —
    // converts. ⭐ `↑` must lift the ink on BOTH sides, which is why the two rows below differ.
    armed('end')
    run('pitchUp')
    expect(calls()[0][2] as number, '8va: up is further out').toBeGreaterThan(0)

    nudge.mockClear()
    side = -1 // an 8vb, below the staff
    run('pitchUp')
    expect(calls()[0][2] as number, '8vb: up is further IN').toBeLessThan(0)
  })

  it('⭐ ↑/↓ CONSUME the key when a square is armed — the selection is not a note to re-pitch', () => {
    armed('end')
    run('pitchUp')
    expect(adjustPitch).not.toHaveBeenCalled()
  })

  it('⭐⭐ with NO square armed the arrows move the WHOLE bracket — the armed square is the difference', () => {
    // His ask, 2026-08-17, and the wedge's arrangement verbatim: something armed → that end moves;
    // nothing armed → the whole thing does. One chord, read by what you picked.
    armed()
    run('selectNextNote')
    run('pitchUp')
    run('ctrlArrowLeft')
    expect(nudge, '⛔ never the per-end write').not.toHaveBeenCalled()
    // ⚠️ `+ 0` normalises the -0 that negating a zero produces — `Object.is(-0, 0)` is false.
    expect(whole.mock.calls.map(([, dx, outward]) => [dx + 0, outward + 0])).toEqual([
      [NUDGE_FINE, 0],
      [0, NUDGE_FINE],       // ⭐ `↑` on an 8va is further OUT, so the sign flips on the way in
      [-NUDGE_COARSE, 0],
    ])
  })

  it('⭐ …and on an 8vb `↑` is further IN — the same conversion the armed version makes', () => {
    armed()
    side = -1
    run('pitchUp')
    expect(whole.mock.calls[0][2] as number).toBeLessThan(0)
  })

  it('⭐ the whole-bracket branch DECLINES once a square is armed, so the two never both fire', () => {
    armed('end')
    run('pitchUp')
    run('selectNextNote')
    expect(whole).not.toHaveBeenCalled()
    expect(nudge).toHaveBeenCalledTimes(2)
  })

  it('⭐⭐ an armed nudge the ENGINE REFUSES must not fall through to moving the whole bracket', () => {
    // ⚠️ THE CASE THE `!ottava.endpoint` GATE EXISTS FOR, and the only one that can see it: while the
    // armed branch answers, the chain short-circuits and the gate is never consulted. It is consulted
    // exactly when the armed branch DECLINES — which the page limit makes it do at the edge of the
    // paper. Without the gate, pressing into that edge would stop moving the end and silently start
    // moving the whole bracket instead.
    nudge.mockReturnValue(false)
    armed('end')
    run('pitchUp')
    expect(nudge, 'asked, and was refused').toHaveBeenCalled()
    expect(whole, '⛔ and nothing else picked the key up').not.toHaveBeenCalled()
  })

  it('⛔ …and neither fires for another kind, leaving the key to its other tenants', () => {
    state.selectedElement = null
    run('pitchUp')
    expect(nudge).not.toHaveBeenCalled()
    expect(whole).not.toHaveBeenCalled()
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
