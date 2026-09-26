import { describe, it, expect, vi } from 'vitest'
import { createEditorState } from '../state/EditorState'
import { stampStaffAtClick } from './staffClickStamps'

/**
 * Subject: `./staffClickStamps` — the table of stamps whose click names a staff in a bar: each row
 * answers only for its own armed tool.
 */
describe('stampStaffAtClick', () => {
  const setup = () => {
    const applyGroupSymbol = vi.fn(() => true)
    const stamp = vi.fn(() => 'r')
    const engine = {
      applyGroupSymbol, silentBar: { stamp, at: () => null },
      getElementRegistry: () => ({ staffIndexAtY: () => 0 }),
    } as never
    return { state: createEditorState(), engine, applyGroupSymbol, stamp }
  }

  it('nothing of theirs armed: not consumed', () => {
    const { state, engine } = setup()
    expect(stampStaffAtClick(state, engine, 10, 1, () => {})).toBe(false)
  })

  it('the grouping sign armed → its row', () => {
    const { state, engine, applyGroupSymbol, stamp } = setup()
    state.selectedMarkingTool = { kind: 'group', symbol: 'bracket' }
    expect(stampStaffAtClick(state, engine, 10, 1, () => {})).toBe(true)
    expect(applyGroupSymbol).toHaveBeenCalled()
    expect(stamp).not.toHaveBeenCalled()
  })

  it('the full-bar rest armed → its row', () => {
    const { state, engine, applyGroupSymbol, stamp } = setup()
    state.selectedMarkingTool = { kind: 'barRest' }
    expect(stampStaffAtClick(state, engine, 10, 1, () => {})).toBe(true)
    expect(stamp).toHaveBeenCalled()
    expect(applyGroupSymbol).not.toHaveBeenCalled()
  })
})
