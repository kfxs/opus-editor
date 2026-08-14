/**
 * {@link PaletteController} — the SUSTAIN PEDAL's palette row, and its ⛔ only door (no shortcut:
 * Sibelius spells it `P`, and ours is PLAY).
 *
 * `PaletteController.ottava.test.ts`'s chapter for the row that behaves this way with nothing to
 * carry, and it needs no engine for that file's reason: what a press MEANS depends only on what is
 * armed and what is selected. Whether the resulting pedal holds the right music is
 * `MusicEngine.createPedal.test.ts`'s question; whether it is drawn right is the browser suite's.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PaletteController } from './PaletteController'
import { createEditorState, type EditorState } from './EditorState'

function makeController(state: EditorState): PaletteController {
  return new PaletteController(
    () => null,           // getEngine — the arm/disarm branches never reach it
    state,
    vi.fn(),              // renderScore
    vi.fn(),              // renderPreview
    () => null,           // getLastMousePosition
    vi.fn(),              // selectNote
  )
}

const armedPedal = (state: EditorState) => state.selectedMarkingTool?.kind === 'pedal'

describe('PaletteController — the pedal row', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('with nothing selected, arms the stamp', () => {
    palette.createPedal()
    expect(armedPedal(state)).toBe(true)
  })

  it('pressed again while armed, DISARMS — the button is the tool\'s on-screen switch', () => {
    palette.createPedal()
    palette.createPedal()
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ arming it CLEARS whatever else was armed — arming IS clearing', () => {
    state.selectedMarkingTool = { kind: 'ottava', shift: 1 }
    palette.createPedal()
    expect(state.selectedMarkingTool).toEqual({ kind: 'pedal' })
  })

  it('…and arming another tool clears the pedal, from the other side', () => {
    palette.createPedal()
    palette.createOttava(1)
    expect(armedPedal(state)).toBe(false)
    expect(state.selectedMarkingTool).toEqual({ kind: 'ottava', shift: 1 })
    // ⚠️ The other side is `createOttava`, not `createTrill`, and the reason is a pre-existing
    // asymmetry rather than a preference: `createTrill` fetches the engine BEFORE its arm branch, so
    // it cannot arm in a context that has none. `createOttava` and `createPedal` fetch it inside the
    // CREATE branch, which is the rule `createHairpin` set and the one this row follows.
  })

  it('⛔ does not arm when notes are selected — that press is about THEM', () => {
    // With a selection the press means "hold these": it goes to the engine (null here), so what is
    // asserted is that it did NOT quietly arm a stamp instead.
    state.selectedItems = new Map([['n1', { kind: 'note', id: 'n1' }]]) as unknown as EditorState['selectedItems']
    palette.createPedal()
    expect(armedPedal(state)).toBe(false)
  })

  it('the ENTRY-mode cursor note counts as a selection, the family\'s rule', () => {
    state.selectedTool = 'entry'
    state.selectedNoteId = 'n1'
    palette.createPedal()
    expect(armedPedal(state), 'the cursor note is what the press is about').toBe(false)
  })

  it('…but the scalar anchor does NOT count in selection mode', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    palette.createPedal()
    expect(armedPedal(state), 'nothing is really selected, so the press arms').toBe(true)
  })
})
