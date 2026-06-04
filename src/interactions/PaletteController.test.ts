import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PaletteController } from './PaletteController'
import { createEditorState, type EditorState } from './EditorState'

// PaletteController is framework-agnostic; stub its callbacks.
function makeController(state: EditorState): PaletteController {
  return new PaletteController(
    () => null,           // getEngine — no engine needed for arm/disarm
    state,
    vi.fn(),              // renderScore
    vi.fn(),              // renderPreview
    () => null,           // getLastMousePosition
    vi.fn(),              // selectNote
  )
}

describe('PaletteController — time signature tool', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('arms a time signature and switches to the entry tool', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    expect(state.selectedTimeSignature).toEqual({ numerator: 6, denominator: 8 })
    expect(state.selectedTool).toBe('entry')
    expect(state.selectedNoteId).toBeNull()
  })

  it('clicking the armed signature again disarms it', () => {
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    expect(state.selectedTimeSignature).toBeNull()
  })

  it('arming a different signature replaces the armed one', () => {
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    palette.setTimeSignature({ numerator: 7, denominator: 8 })
    expect(state.selectedTimeSignature).toEqual({ numerator: 7, denominator: 8 })
  })

  it('is mutually exclusive with the clef tool', () => {
    palette.setClef('bass')
    palette.setTimeSignature({ numerator: 5, denominator: 8 })
    expect(state.selectedClef).toBeNull()
    expect(state.selectedTimeSignature).toEqual({ numerator: 5, denominator: 8 })

    palette.setClef('treble')
    expect(state.selectedTimeSignature).toBeNull()
    expect(state.selectedClef).toBe('treble')
  })

  it('selecting a duration disarms the time-signature tool', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    palette.setDuration('8')
    expect(state.selectedTimeSignature).toBeNull()
  })

  it('resetToDefaults clears the armed signature', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    palette.resetToDefaults()
    expect(state.selectedTimeSignature).toBeNull()
  })
})
