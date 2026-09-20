import { describe, it, expect } from 'vitest'
import { createEditorState } from '../state/EditorState'
import { LINE_TOOL_KINDS } from '@/bus/lineSelection'
import { armedLineTool, pressLineTool } from './lineTools'
import type { PaletteController } from '../controllers/PaletteController'

/**
 * The one translation from the family's shared names to the palette methods — so the Lines window's
 * OK and the three keyboard bindings cannot mean different things.
 *
 * The palette is a STUB here on purpose: what `createSlur` does with a selection is
 * `PaletteController`'s own contract and is tested there. What this file answers for is which method
 * a row reaches, and which row is lit.
 */
function recordingPalette(): { calls: string[]; palette: PaletteController } {
  const calls: string[] = []
  const palette = {
    createSlur: () => calls.push('createSlur'),
    createCrescendo: () => calls.push('createCrescendo'),
    createDiminuendo: () => calls.push('createDiminuendo'),
    createTrill: () => calls.push('createTrill'),
    createOttava: (shift: number) => calls.push(`createOttava(${shift})`),
    createPedal: () => calls.push('createPedal'),
  } as unknown as PaletteController
  return { calls, palette }
}

describe('pressLineTool', () => {
  it('routes every row to the palette method that already existed', () => {
    const { calls, palette } = recordingPalette()
    for (const kind of LINE_TOOL_KINDS) pressLineTool(palette, kind)
    expect(calls).toEqual([
      'createSlur',
      'createCrescendo',
      'createDiminuendo',
      'createTrill',
      'createOttava(1)',
      'createOttava(-1)',
      'createPedal',
    ])
  })
})

describe('armedLineTool', () => {
  it('is null with nothing armed', () => {
    expect(armedLineTool(createEditorState())).toBeNull()
  })

  it('is null under a tool that is not a line — the light is this family, not "something armed"', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'tie' }
    expect(armedLineTool(state)).toBeNull()
  })

  it('names the armed line', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'slur' }
    expect(armedLineTool(state)).toBe('slur')
  })

  /**
   * ⚠️ THE ASYMMETRY THIS FUNCTION EXISTS FOR. One model tool, two rows — asking `armedTool(state,
   * 'hairpin')` would light both wedges whichever one was armed, and both octave lines likewise.
   */
  it('tells the two hairpins apart by type', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'hairpin', type: 'cresc' }
    expect(armedLineTool(state)).toBe('cresc')

    state.selectedMarkingTool = { kind: 'hairpin', type: 'dim' }
    expect(armedLineTool(state)).toBe('dim')
  })

  it('tells the two octave lines apart by the SIGN of the shift', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'ottava', shift: 1 }
    expect(armedLineTool(state)).toBe('8va')

    state.selectedMarkingTool = { kind: 'ottava', shift: -1 }
    expect(armedLineTool(state)).toBe('8vb')
  })

  it('names the trill and the pedal', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'trill' }
    expect(armedLineTool(state)).toBe('trill')
    state.selectedMarkingTool = { kind: 'pedal' }
    expect(armedLineTool(state)).toBe('pedal')
  })
})
