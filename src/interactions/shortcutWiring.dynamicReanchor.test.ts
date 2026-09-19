// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { wireShortcuts } from './shortcutWiring'
import { createEditorState, type EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * ⭐⭐ WHICH KEY MOVES A DYNAMIC, AND WHICH ONE MOVES ITS INK (his ask, 2026-08-18).
 *
 * Subject: `./shortcutWiring` — the letters' chapter beside `.hairpinResize.test.ts`,
 * `.ottavaResize.test.ts` and `.pedalResize.test.ts`, making the dynamics line's one standing claim
 * about the fourth family on it: **`Ctrl+Shift+←/→` moves the mark through the MUSIC, the plain and
 * `Ctrl` arrows move its INK.** Two chords, two categories, one selection.
 *
 * 🚨 The case that would go red first if the two were ever crossed is the last one: the re-anchor
 * must not answer the chord the offset owns, or every fine nudge would silently become an audible
 * edit.
 *
 * The engine is a stub — what is under test is the ROUTING.
 */
describe('moving a dynamic from the keyboard', () => {
  let state: EditorState
  let reanchor: Mock<(id: string, direction: 1 | -1) => boolean>
  let nudgeOffset: Mock<(id: string, dx: number, dy: number) => boolean>
  let noteOffset: Mock<(id: string, dx: number) => boolean>
  let run: (action: string) => void
  let teardown: () => void

  beforeEach(() => {
    reanchor = vi.fn(() => true)
    nudgeOffset = vi.fn(() => true)
    noteOffset = vi.fn(() => true)
    const engine = {
      moveDynamicBySlot: reanchor,
      nudgeDynamicOffset: nudgeOffset,
      // ⭐ The WALK writes through the preview twins since 2026-08-30 — a run of presses is ONE
      //   undo entry (`./keyRun`). Aliased to the same mocks: what these cases claim is which
      //   key writes which ink, and that is unchanged.
      previewDynamicOffset: nudgeOffset,
      previewDynamicOffsetRebase: vi.fn(() => true),
      previewDynamicSlotKeepingOffset: vi.fn(() => true),
      commitDynamicDrag: vi.fn(),
      nudgeNoteOffset: noteOffset,
      resizeHairpinBySlot: vi.fn(() => false),
      moveHairpinStartBySlot: vi.fn(() => false),
      resizeOttavaBySlot: vi.fn(() => false),
      moveOttavaStartBySlot: vi.fn(() => false),
      resizePedalBySlot: vi.fn(() => false),
      movePedalStartBySlot: vi.fn(() => false),
      getElementRegistry: () => ({ getByType: () => [] }),
      getSlurById: () => null,
      getNote: () => null,
      // ⚠️ The horizontal ink chords run through the interpolating walk (`./dynamicWalk`), which
      // asks for the mark before it asks anything else. Null = "not in the score" → no crossing is
      // possible, so the press is the plain nudge these cases are about.
      getDynamicById: () => null,
      // ⚠️ …and what lies ahead, which the walk asks before it decides anything. Null = nothing to
      // arrive at, so the press stays the plain nudge these cases are about.
      nextDynamicSlot: () => null,
      // ⚠️ `Ctrl+Shift+←/→` also ends at the CLEF move, which reads the beat map. An empty score =
      // no slot to step to, so that branch DECLINES — which is what the clef case below asserts.
      getScore: () => ({ measures: [] }),
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

  const selectDynamic = () => { state.selectedElement = { kind: 'dynamic', id: 'D1' } }

  it('⭐⭐ `Ctrl+Shift+←/→` re-anchors the selected dynamic — one slot per press', () => {
    selectDynamic()
    run('ctrlShiftArrowRight')
    run('ctrlShiftArrowLeft')
    expect(reanchor.mock.calls).toEqual([['D1', 1], ['D1', -1]])
  })

  // 🚨 Still the standing claim after the interpolating walk arrived (2026-08-19): the horizontal
  // ink chords may now hand the anchor along when the ink ARRIVES at the next slot, but they reach
  // that through `previewDynamicSlotKeepingOffset` — never through the whole-slot jump this chord
  // owns, which wipes the mark's nudge.
  it('🚨 …and the INK chords never reach it — the plain and `Ctrl` arrows still write the offset', () => {
    selectDynamic()
    run('selectNextNote')  // plain →
    run('ctrlArrowRight')  // Ctrl+→
    run('pitchUp')         // plain ↑
    expect(nudgeOffset).toHaveBeenCalledTimes(3)
    expect(reanchor).not.toHaveBeenCalled()
  })

  it('⛔ DECLINES rather than swallowing the chord, so what sits behind it still runs', () => {
    // The engine says "no slot to step to"; the note offset — the branch that shares the chord —
    // must then still get the key. A branch that consumed it would silently disable that.
    reanchor.mockReturnValue(false)
    selectDynamic()
    state.selectedItems = new Map([['N1', { kind: 'note', id: 'N1' }]]) as never
    run('ctrlShiftArrowRight')
    expect(noteOffset).toHaveBeenCalled()
  })

  it('⛔ leaves the chord alone when the selected element is not a dynamic', () => {
    // ⚠️ A REAL clef selection: `beat` is a NUMBER here (`SelectedElement`), ⛔ not a `Fraction`, and
    // the cast that used to hide the difference hid a freeze. Once `moveSelectedClef` joined this
    // chord it became the first branch to READ `clef.beat`, and an object reached `beatToFrac` →
    // `fracCreate(NaN, 96)` → `gcd`'s `while (b !== 0)`, which NaN never leaves.
    state.selectedElement = { kind: 'clef', measure: 1, beat: 0, staff: 0 }
    run('ctrlShiftArrowRight')
    expect(reanchor).not.toHaveBeenCalled()
  })
})
