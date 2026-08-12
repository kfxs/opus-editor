/**
 * {@link PaletteController} — the HAIRPIN keys' three-way split (`H` / `Shift+H`).
 *
 * ⭐ The whole chapter is about ROUTING, which is why it needs no engine: what a press means
 * depends only on what is armed and what is selected. Whether the resulting wedge is the right
 * shape is `hairpinOps.span.test.ts`'s question; whether it is drawn correctly is the browser
 * suite's. This is the layer in between, and the one a fourth door would break first.
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

/** The armed hairpin tool's type, or null when something else (or nothing) is armed. */
const armedType = (state: EditorState) =>
  state.selectedMarkingTool?.kind === 'hairpin' ? state.selectedMarkingTool.type : null

describe('PaletteController — hairpin keys', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('with nothing selected, arms the stamp of the wedge that was pressed', () => {
    palette.createCrescendo()
    expect(armedType(state)).toBe('cresc')
  })

  it('Shift+H arms the diminuendo, not the crescendo', () => {
    palette.createDiminuendo()
    expect(armedType(state)).toBe('dim')
  })

  it('a re-press of the SAME wedge disarms it', () => {
    palette.createCrescendo()
    palette.createCrescendo()
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('⭐ the OTHER wedge SWITCHES the tool rather than disarming it', () => {
    // The reason `createCrescendo`/`createDiminuendo` are two methods over one with a flag: a
    // shared `kind === 'hairpin'` disarm test would turn the tool off here instead of swapping it,
    // so pressing Shift+H with cresc. armed would need TWO presses to reach dim.
    palette.createCrescendo()
    palette.createDiminuendo()
    expect(armedType(state)).toBe('dim')
    palette.createCrescendo()
    expect(armedType(state)).toBe('cresc')
  })

  it('arming a hairpin clears any other marking tool (arming IS clearing)', () => {
    palette.setAccidental('#')
    palette.createCrescendo()
    expect(armedType(state)).toBe('cresc')
    expect(state.selectedMarkingTool?.kind).toBe('hairpin')
  })

  it('…and arming another tool clears the hairpin', () => {
    palette.createCrescendo()
    palette.setAccidental('#')
    expect(armedType(state)).toBeNull()
  })

  it('with notes selected it does NOT arm — the press is about the selection', () => {
    // No engine here, so nothing is created; what is asserted is that the press did not fall
    // through to the arm branch, which is the routing decision this test owns.
    state.selectedItems = new Map([['n1', { kind: 'note', id: 'n1' }]])
    palette.createCrescendo()
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('in ENTRY mode the cursor note counts as the selection', () => {
    state.selectedTool = 'entry'
    state.selectedNoteId = 'n1'
    palette.createCrescendo()
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('in SELECTION mode a bare anchor does NOT count — an empty set is an empty selection', () => {
    // The tie key's rule: outside entry mode the scalar anchor is a leftover, not a selection.
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    palette.createCrescendo()
    expect(armedType(state)).toBe('cresc')
  })
})
