/**
 * **The group-resize drag, as a gesture** — which press arms it, which end it grabbed, and a drop
 * that files an undo entry only when the span really ended up different.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import type { DragHost } from './gesture'

const handles = vi.hoisted(() => ({
  staffAtPointer: vi.fn<() => number | null>(() => 3),
  spanAfterDrag: vi.fn((current: { fromStaff: number; toStaff: number }, end: string, staff: number) =>
    end === 'top' ? { ...current, fromStaff: staff } : { ...current, toStaff: staff }),
}))
vi.mock('../elements/staffGroupHandles', () => handles)

import { beginStaffGroupSpanDrag } from './staffGroupSpan'

describe('beginStaffGroupSpanDrag', () => {
  const preview = vi.fn(() => true)
  const commit = vi.fn()
  const engine = {
    getScore: () => ({
      staves: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      staffGroups: [{ id: 'G1', staffIds: ['b', 'c'] }],
    }),
    getElementRegistry: () => ({}),
    previewStaffGroupSpan: preview,
    commitStaffGroupSpan: commit,
  } as unknown as MusicEngine
  /** Two squares: `staff` 0 = the TOP end, 1 = the BOTTOM end. */
  const registry = {
    getByType: () => [
      { id: 'G1', staff: 0, measure: 4, bbox: { x: 10, y: 100, width: 8, height: 8 } },
      { id: 'G1', staff: 1, measure: 4, bbox: { x: 10, y: 200, width: 8, height: 8 } },
    ],
  } as unknown as ElementRegistry
  const state = { selectedElement: { kind: 'staffGroup', groupId: 'G1', symbol: 'brace' } } as unknown as EditorState
  let host: DragHost

  beforeEach(() => {
    vi.clearAllMocks()
    preview.mockReturnValue(true)
    handles.staffAtPointer.mockReturnValue(3)
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })

  it('⛔ arms only on a SQUARE of the SELECTED group', () => {
    expect(beginStaffGroupSpanDrag(host, state, registry, 300, 300)).toBeNull()
    const nothing = { selectedElement: null } as unknown as EditorState
    expect(beginStaffGroupSpanDrag(host, nothing, registry, 12, 202)).toBeNull()
  })

  it('⭐ the BOTTOM square moves the bottom end to the staff under the pointer; the top stays put', () => {
    const drag = beginStaffGroupSpanDrag(host, state, registry, 12, 202)!
    drag.move(engine, 12, 320)
    expect(preview).toHaveBeenCalledWith('G1', 1, 3)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
  })

  it('…and the TOP square moves the top end', () => {
    handles.staffAtPointer.mockReturnValue(0)
    beginStaffGroupSpanDrag(host, state, registry, 12, 102)!.move(engine, 12, 40)
    expect(preview).toHaveBeenCalledWith('G1', 0, 2)
  })

  it('a pointer over NO staff, or over the staff it already reaches, writes nothing', () => {
    const drag = beginStaffGroupSpanDrag(host, state, registry, 12, 202)!
    handles.staffAtPointer.mockReturnValue(null)
    drag.move(engine, 12, 500)
    handles.staffAtPointer.mockReturnValue(2) // where the bottom end already is
    drag.move(engine, 12, 210)
    expect(preview).not.toHaveBeenCalled()
  })

  it('the drop records ONE undo entry when the span ended up different', () => {
    const drag = beginStaffGroupSpanDrag(host, state, registry, 12, 202)!
    drag.move(engine, 12, 320)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(1)
  })

  it('⭐ …and NONE for a gesture that wandered and came back — it wrote twice and changed nothing', () => {
    const drag = beginStaffGroupSpanDrag(host, state, registry, 12, 202)!
    drag.move(engine, 12, 320)               // bottom end → staff 3
    handles.staffAtPointer.mockReturnValue(2)
    drag.move(engine, 12, 210)               // …and back to staff 2
    drag.end()
    expect(preview).toHaveBeenCalledTimes(2)
    expect(commit).not.toHaveBeenCalled()
  })
})
