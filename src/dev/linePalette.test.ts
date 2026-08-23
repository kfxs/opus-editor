import { describe, it, expect } from 'vitest'
import { createEditorState } from '../interactions/EditorState'
import { LINE_TOOL_KINDS } from '../bus/lineSelection'
import { LINE_TOOLS } from './linePalette'

/**
 * The Lines palette is a TABLE of BUTTON FACES over a family that is defined elsewhere: what a row
 * does and whether it is lit moved to `interactions/lineTools` when the Lines window became a second
 * door onto the same seven marks (its spec moved with it). What can still be wrong here is a row's
 * `isEnabled` — a button that looks pressable and silently does nothing is worse than one that says
 * so — and whether the table still covers the family at all.
 */
describe('LINE_TOOLS', () => {
  const slur = LINE_TOOLS.find((t) => t.kind === 'slur')!

  it('has a button for every line in the family, and no stragglers', () => {
    expect(LINE_TOOLS.map((t) => t.kind)).toEqual([...LINE_TOOL_KINDS])
  })

  it('gives every row a face and a tooltip that says what has to be selected', () => {
    for (const tool of LINE_TOOLS) {
      expect(tool.label).not.toBe('')
      expect(tool.title.length).toBeGreaterThan(20)
    }
  })

  it('is ALWAYS pressable — with no selection the press arms the stamp', () => {
    // Every row, not just the slur: the press always means something, which is the rule that let
    // these buttons stop greying out.
    for (const tool of LINE_TOOLS) expect(tool.isEnabled(createEditorState())).toBe(true)
    expect(slur.isEnabled(createEditorState())).toBe(true)
  })
})
