/**
 * {@link PaletteController} — the OCTAVE LINE's two palette rows (`8va` / `8vb`).
 *
 * ⭐ `PaletteController.hairpin.test.ts`'s chapter, for the second pair of rows that behaves this
 * way, and it needs no engine for that file's reason: what a press MEANS depends only on what is
 * armed and what is selected. Whether the resulting line covers the right music is
 * `MusicEngine.createOttava.test.ts`'s question; whether it is drawn right is the browser suite's.
 *
 * ⚠️ **The switch-not-disarm rule is here because break-testing found nothing else pinned it.** A
 * shared `kind === 'ottava'` disarm test compiles, passes every other spec, and quietly makes
 * pressing `8vb` with `8va` armed take TWO presses — the exact defect the hairpin rows already
 * carry a comment about.
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

/** The armed ottava tool's shift, or null when something else (or nothing) is armed. */
const armedShift = (state: EditorState) =>
  state.selectedMarkingTool?.kind === 'ottava' ? state.selectedMarkingTool.shift : null

describe('PaletteController — the octave line rows', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('with nothing selected, arms the stamp of the row that was pressed', () => {
    palette.createOttava(1)
    expect(armedShift(state)).toBe(1)
  })

  it('the 8vb row arms the other direction, not the same tool', () => {
    palette.createOttava(-1)
    expect(armedShift(state)).toBe(-1)
  })

  it('a re-press of the SAME row disarms it', () => {
    palette.createOttava(1)
    palette.createOttava(1)
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ the OTHER row SWITCHES the tool rather than disarming it', () => {
    // One press must always reach the tool you pressed. A disarm test that only asked
    // `kind === 'ottava'` would turn the tool off here, so 8vb would need two presses.
    palette.createOttava(1)
    palette.createOttava(-1)
    expect(armedShift(state)).toBe(-1)
  })

  it('…and back again, still in one press each way', () => {
    palette.createOttava(-1)
    palette.createOttava(1)
    expect(armedShift(state)).toBe(1)
  })

  it('arming an octave line CLEARS whatever else was armed', () => {
    // `armMarkingTool` reassigns the field — the union's own rule (arming IS clearing).
    palette.createCrescendo()
    expect(state.selectedMarkingTool?.kind).toBe('hairpin')
    palette.createOttava(1)
    expect(state.selectedMarkingTool?.kind).toBe('ottava')
  })

  it('a 15ma row would arm as its own tool, not a second field', () => {
    // `shift` is signed and ranged, so more sizes are more ROWS — the model's "one signed number IS
    // the statement" surviving all the way out to the palette.
    palette.createOttava(2)
    expect(armedShift(state)).toBe(2)
    palette.createOttava(1)
    expect(armedShift(state), 'a different size is a different tool, so it switches').toBe(1)
  })
})
