import { describe, it, expect } from 'vitest'
import { createEditorState } from '../interactions/EditorState'
import { LINE_TOOLS } from './linePalette'

/**
 * The Lines palette is a TABLE of labels over methods that already exist, so the only things here
 * that can be WRONG are a row's two questions: `isEnabled` (can it be pressed) and `isArmed` (is its
 * stamp live). Both must agree with what the palette method does, or the button lies.
 */
describe('LINE_TOOLS', () => {
  const slur = LINE_TOOLS.find((t) => t.label === 'Slur')!

  it('has a slur row', () => {
    expect(slur).toBeDefined()
  })

  it('slur is ALWAYS pressable — with no selection the press arms the stamp', () => {
    expect(slur.isEnabled(createEditorState())).toBe(true)
  })

  it('slur is unlit with nothing armed', () => {
    expect(slur.isArmed(createEditorState())).toBe(false)
  })

  it('slur lights when its own stamp is armed', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'slur' }
    expect(slur.isArmed(state)).toBe(true)
  })

  it('slur stays unlit under ANOTHER armed tool — the light is this row, not "something armed"', () => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'tie' }
    expect(slur.isArmed(state)).toBe(false)
  })
})
