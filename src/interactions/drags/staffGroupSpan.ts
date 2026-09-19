/**
 * **THE GROUP-RESIZE DRAG** — a press on one of the two squares of a selected brace or bracket: the
 * grabbed end follows the pointer to whichever STAFF it is over, and the other end stays put.
 *
 * ⭐ **The staff, ⛔ never a pixel delta**: a group spans whole staves, so the only positions the
 * gesture can reach are staff indices — and `staffAtPointer` answers by BAND rather than by a
 * stride, because staves may be drawn at different sizes. So there is no threshold either: a press
 * that never moves is still over the staff it started on.
 *
 * ⭐ **The preview IS the picture** — `previewStaffGroupSpan` writes the model without undo and the
 * render draws the sign at its new span, so what shows mid-drag is what the drop keeps.
 *
 * ⭐ `baseline` and `current` keep the drop honest, the join drag's rule (`./barlineJoin`): a
 * gesture that wanders and comes back has written and changed nothing.
 */
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { selectedOf, type EditorState } from '../EditorState'
import { staffAtPointer, spanAfterDrag, type StaffGroupHandleEnd } from '../elements/staffGroupHandles'
import { dbg } from '../../utils/debug'
import type { DragHost, Gesture } from './gesture'

/**
 * ⛔ null = the press did not land on a square of the selected group, or the group cannot be found.
 *
 * ⚠️ The square's registered `staff` carries WHICH END it is (0 = top, 1 = bottom) — the registry
 * has no field of its own for that, and the press has to know which end it grabbed.
 */
export function beginStaffGroupSpanDrag(
  host: DragHost, state: EditorState, registry: ElementRegistry, x: number, y: number,
): Gesture | null {
  const selected = selectedOf(state, 'staffGroup')
  if (!selected) return null
  const hit = registry.getByType('staff-group-handle').find(el => {
    const b = el.bbox
    return el.id === selected.groupId
      && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  })
  if (!hit) return null

  const engine = host.getEngine()
  const group = engine?.getScore().staffGroups?.find(g => g.id === selected.groupId)
  if (!engine || !group) return null
  const staves = engine.getScore().staves ?? []
  const indices = group.staffIds.map(id => staves.findIndex(s => s.id === id)).filter(i => i >= 0)
  if (indices.length === 0) return null

  const groupId = selected.groupId
  const grabbed: StaffGroupHandleEnd = (hit.staff ?? 0) === 0 ? 'top' : 'bottom'
  const measure = hit.measure ?? 1
  const baseline = { fromStaff: Math.min(...indices), toStaff: Math.max(...indices) }
  let current = baseline
  dbg(`Group resize ready | ${selected.symbol} · staves ${baseline.fromStaff}–${baseline.toStaff} · `
    + `grabbed the ${grabbed} square`)

  return {
    kind: 'staffGroupSpan',

    move(eng, _x, my) {
      const staffCount = eng.getScore().staves?.length ?? 1
      const staff = staffAtPointer(eng.getElementRegistry(), measure, staffCount, my)
      if (staff === null) return
      const want = spanAfterDrag(current, grabbed, staff)
      if (want.fromStaff === current.fromStaff && want.toStaff === current.toStaff) return
      if (eng.previewStaffGroupSpan(groupId, want.fromStaff, want.toStaff)) {
        current = want
        host.render.renderScore()
      }
    },

    end() {
      const eng = host.getEngine()
      if (eng && (current.fromStaff !== baseline.fromStaff || current.toStaff !== baseline.toStaff)) {
        eng.commitStaffGroupSpan()
        dbg(`Group resized | staves ${current.fromStaff}–${current.toStaff}`)
      }
      host.release()
    },
  }
}
