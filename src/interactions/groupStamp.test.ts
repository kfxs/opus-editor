/**
 * WHERE a brace or bracket lands — APPLIES, else ARMS.
 *
 * Subject: {@link groupTargetFromSelection}, {@link targetStaffIds}. ⭐ His rule of 2026-08-29, and
 * the claim worth pinning is that his first two cases are **one** case: a measure selection carries
 * a staff SPAN, so "multiple staves" and "just one staff" differ only in whether the span is wide.
 */
import { describe, it, expect } from 'vitest'
import { groupTargetFromSelection, targetStaffIds } from './groupStamp'
import type { EditorState } from './state/EditorState'

const state = (selectedElement: unknown, selectedTool = 'selection'): EditorState =>
  ({ selectedElement, selectedTool } as unknown as EditorState)

const passage = (staff: number, focusStaff: number) => ({
  kind: 'measureRange', anchor: 1, focus: 1, staff, focusStaff, boxStyle: 'single',
})

describe('a measure selection NAMES the staves — it applies', () => {
  it('⭐⭐ multiple staves selected → those staves', () => {
    expect(groupTargetFromSelection(state(passage(0, 2)))).toEqual({ fromStaff: 0, toStaff: 2 })
  })

  it('⭐ just one staff selected → just that staff (⛔ the SAME rule, not a second one)', () => {
    expect(groupTargetFromSelection(state(passage(1, 1)))).toEqual({ fromStaff: 1, toStaff: 1 })
  })

  it('⭐ a passage selected UPWARD names the same staves — the span is normalised', () => {
    expect(groupTargetFromSelection(state(passage(3, 1)))).toEqual({ fromStaff: 1, toStaff: 3 })
  })

  it('the Ctrl+Shift measure box names its staves too — it carries a span like any other', () => {
    expect(groupTargetFromSelection(state({ ...passage(0, 1), boxStyle: 'double' })))
      .toEqual({ fromStaff: 0, toStaff: 1 })
  })
})

describe('everything else ARMS — ⛔ nothing else names a run of staves', () => {
  it('nothing selected', () => {
    expect(groupTargetFromSelection(state(null))).toBeNull()
  })

  it('⚠️ a NOTE selection does not name staves — the stamp bargain, learned everywhere else', () => {
    expect(groupTargetFromSelection(state({ kind: 'note', id: 'n1' }))).toBeNull()
  })

  it('⛔ nor a clef, a barline or a dynamic — they name a bar or a line', () => {
    expect(groupTargetFromSelection(state({ kind: 'clef', measure: 2, staff: 0 }))).toBeNull()
    expect(groupTargetFromSelection(state({ kind: 'barline', measure: 2 }))).toBeNull()
  })

  it('⚠️ …and nothing applies while ANOTHER TOOL is armed', () => {
    expect(groupTargetFromSelection(state(passage(0, 1), 'note'))).toBeNull()
  })
})

describe('indices → ids, because a group is keyed by IDENTITY', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('takes the run, inclusive at both ends', () => {
    expect(targetStaffIds({ fromStaff: 1, toStaff: 2 }, ids)).toEqual(['b', 'c'])
  })

  it('one staff is a run of one', () => {
    expect(targetStaffIds({ fromStaff: 3, toStaff: 3 }, ids)).toEqual(['d'])
  })

  it('⚠️ clamps to the staves the score actually has — ⛔ never invents an id', () => {
    expect(targetStaffIds({ fromStaff: 2, toStaff: 9 }, ids)).toEqual(['c', 'd'])
    expect(targetStaffIds({ fromStaff: -3, toStaff: 0 }, ids)).toEqual(['a'])
  })
})
