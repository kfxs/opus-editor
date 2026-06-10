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

describe('PaletteController — dynamics tool', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('arms a level dynamic and switches to the entry tool', () => {
    palette.setDynamic('mf')
    expect(state.selectedDynamic).toBe('mf')
    expect(state.selectedTool).toBe('entry')
    expect(state.selectedNoteId).toBeNull()
  })

  it('arms the custom-text tool', () => {
    palette.setDynamic('text')
    expect(state.selectedDynamic).toBe('text')
  })

  it('clicking the armed dynamic again disarms it', () => {
    palette.setDynamic('p')
    palette.setDynamic('p')
    expect(state.selectedDynamic).toBeNull()
  })

  it('arming a different dynamic replaces the armed one', () => {
    palette.setDynamic('p')
    palette.setDynamic('f')
    expect(state.selectedDynamic).toBe('f')
  })

  it('is mutually exclusive with the clef and time-signature tools', () => {
    palette.setClef('bass')
    palette.setDynamic('mf')
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDynamic).toBe('mf')

    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    expect(state.selectedDynamic).toBeNull()
    expect(state.selectedTimeSignature).toEqual({ numerator: 3, denominator: 4 })

    palette.setClef('treble')
    expect(state.selectedTimeSignature).toBeNull()

    palette.setDynamic('p')
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDynamic).toBe('p')
  })

  it('selecting a duration disarms the dynamics tool', () => {
    palette.setDynamic('mf')
    palette.setDuration('8')
    expect(state.selectedDynamic).toBeNull()
  })

  it('resetToDefaults clears the armed dynamic', () => {
    palette.setDynamic('f')
    palette.resetToDefaults()
    expect(state.selectedDynamic).toBeNull()
  })
})

describe('PaletteController — disarmPositionalTools', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('clears the armed clef / time signature / dynamic', () => {
    palette.setDynamic('f')
    state.selectedClef = 'bass'
    state.selectedTimeSignature = { numerator: 3, denominator: 4 }
    palette.disarmPositionalTools()
    expect(state.selectedClef).toBeNull()
    expect(state.selectedTimeSignature).toBeNull()
    expect(state.selectedDynamic).toBeNull()
  })

  it('leaves note-entry settings (duration, accidental) untouched', () => {
    palette.setDuration('8')
    palette.setAccidental('#')
    palette.setClef('alto')
    palette.disarmPositionalTools()
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDuration).toBe('8')
    expect(state.selectedAccidental).toBe('#')
  })
})
