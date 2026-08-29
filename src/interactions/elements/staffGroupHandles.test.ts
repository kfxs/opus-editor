/**
 * The two squares of a selected grouping sign — where they are, and what a drag makes.
 *
 * Subject: {@link staffGroupHandles}, {@link staffAtPointer}, {@link spanAfterDrag}. ⭐ Pure
 * geometry, so no mouse and no DOM: the gesture's plumbing is `MouseController`'s, and this is what
 * it asks. His ask, 2026-08-29: *"we should be able to see the two squares up and down so we can
 * enlarge or shrink the groups… the only case we don't show the squares is in a single staff
 * system."*
 */
import { describe, it, expect } from 'vitest'
import {
  staffGroupHandles, staffAtPointer, spanAfterDrag,
  STAFF_GROUP_HANDLE_GAP_PX, STAFF_GROUP_HANDLE_GAP_PROJECTING_PX,
  type StaffGroupBoxRegistry,
} from './staffGroupHandles'

/** A sign spanning y 100→300, and four staves 40px apart. */
const registry = (signId = 'g1'): StaffGroupBoxRegistry => ({
  getByType: () => [{ id: signId, bbox: { x: 20, y: 100, width: 10, height: 200 } }],
  getStaffGeometry: (_m, staff) =>
    staff < 4 ? { lineYPositions: [100 + staff * 60, 100 + staff * 60 + 40] } : null,
})

describe('where the squares are', () => {
  it('⭐ one at each END of the sign’s own ink — a handle centres on INK', () => {
    const handles = staffGroupHandles(registry(), 'g1', 4)
    expect(handles.map(h => h.end)).toEqual(['top', 'bottom'])
    expect(handles[0].y).toBe(100 - STAFF_GROUP_HANDLE_GAP_PX)
    expect(handles[1].y).toBe(300 + STAFF_GROUP_HANDLE_GAP_PX)
  })

  it('centred on the sign horizontally', () => {
    const handles = staffGroupHandles(registry(), 'g1', 4)
    expect(handles.every(h => h.x === 25)).toBe(true)
  })

  it('⭐⭐ a PROJECTING sign gets less air — his *"can be tiny closer"*, 2026-08-29', () => {
    // A bracket's ink already reaches ~1.5 sp past the staff line, so the projection is doing part
    // of the separating. ⛔ Not a smaller shared constant: that would move the brace's squares too,
    // and he said those are right.
    const flush = staffGroupHandles(registry(), 'g1', 4, false)
    const projecting = staffGroupHandles(registry(), 'g1', 4, true)
    expect(projecting[0].y).toBeGreaterThan(flush[0].y)   // nearer the sign's end
    expect(projecting[1].y).toBeLessThan(flush[1].y)
    // ⚠️ y grows DOWNWARD, so the top square being nearer its sign means a LARGER y.
    expect(projecting[0].y - flush[0].y)
      .toBe(STAFF_GROUP_HANDLE_GAP_PX - STAFF_GROUP_HANDLE_GAP_PROJECTING_PX)
  })

  it('⭐⭐ NONE on a single-staff system — his rule, and it falls out of the geometry', () => {
    // There is nowhere to move an end TO, so the set is empty. ⛔ Not an `if` written to his words —
    // `barlineJoinHandles` makes the same argument about gaps.
    expect(staffGroupHandles(registry(), 'g1', 1)).toEqual([])
  })

  it('⛔ none for a sign that is not on the page', () => {
    expect(staffGroupHandles(registry('other'), 'g1', 4)).toEqual([])
  })
})

describe('which staff the pointer is over — ⭐ the BAND, ⛔ never a stride', () => {
  const r = registry()

  it('inside a staff’s own lines is that staff', () => {
    expect(staffAtPointer(r, 1, 4, 120)).toBe(0)
    expect(staffAtPointer(r, 1, 4, 180)).toBe(1)
    expect(staffAtPointer(r, 1, 4, 300)).toBe(3)
  })

  it('⭐ in the GAP it is whichever staff is NEARER', () => {
    expect(staffAtPointer(r, 1, 4, 145), 'just below staff 0').toBe(0)
    expect(staffAtPointer(r, 1, 4, 155), 'just above staff 1').toBe(1)
  })

  it('above the first staff and below the last clamp to them', () => {
    expect(staffAtPointer(r, 1, 4, 0)).toBe(0)
    expect(staffAtPointer(r, 1, 4, 9999)).toBe(3)
  })

  it('⛔ null when no staff geometry is known', () => {
    expect(staffAtPointer({ ...r, getStaffGeometry: () => null }, 1, 4, 120)).toBeNull()
  })
})

describe('what the drag makes', () => {
  const span = { fromStaff: 1, toStaff: 2 }

  it('the grabbed end moves; the other stays', () => {
    expect(spanAfterDrag(span, 'top', 0)).toEqual({ fromStaff: 0, toStaff: 2 })
    expect(spanAfterDrag(span, 'bottom', 3)).toEqual({ fromStaff: 1, toStaff: 3 })
  })

  it('⭐ shrinking works the same way — an end may meet the other', () => {
    expect(spanAfterDrag(span, 'top', 2)).toEqual({ fromStaff: 2, toStaff: 2 })
  })

  it('⚠️ the ends may CROSS, and the span is normalised rather than refused', () => {
    // Dragging the top handle below the bottom one is a legible gesture — the user is re-aiming.
    expect(spanAfterDrag(span, 'top', 3)).toEqual({ fromStaff: 2, toStaff: 3 })
  })
})
