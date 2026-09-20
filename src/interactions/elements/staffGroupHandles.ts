/**
 * ⭐⭐ **THE TWO SQUARES OF A SELECTED GROUPING SIGN** — grab one and grow or shrink the group.
 *
 * **His ask, 2026-08-29**: *"when a brace or bracket is selected we should be able to see the two
 * squares up and down so we can enlarge or shrink the groups… the only case we don't show the
 * squares is in a single staff system."*
 *
 * ⚠️ The gesture's *plumbing* is `MouseController`'s — arming, previewing, the one undo entry on the
 * drop — and everything here is a pure function of the registry and a coordinate, which is what lets
 * the whole rule be tested without a mouse. The shape is `./barlineJoinHandles`', deliberately.
 *
 * ## ⭐ WHY A ONE-STAFF SYSTEM SHOWS NONE, without an `if`
 *
 * A handle offers a staff to move the span's end TO. On a score with one staff there is no other
 * staff, so the set of reachable ends is empty and the loop produces nothing — the same shape
 * `barlineJoinHandles` uses for gaps (*"⛔ never an `if (staffCount === 1) return`"*). ⭐ It comes out
 * as his rule without being written as his rule, which is what stops it drifting from the reason.
 *
 * ## ⭐⭐ A HANDLE CENTRES ON INK
 *
 * [[project_hairpin_handles]]'s rule, and the join square's: the square sits on the sign's own drawn
 * end, ⛔ not on a nominal staff coordinate. The sign's box is registered by the pen in SVG space
 * (`rendering/staff/systemStart.registerSignBox`), so that box IS the ink and the squares hang off it.
 */

/**
 * ⭐ How far outside the sign's own end each square's CENTRE sits, in px — **the same 10 the
 * hairpin's, the pedal's and the barline join's handles use**, one family, one distance.
 *
 * ⚠️ This is the gap for a sign whose ink stops AT the staff line — the brace, which is flush.
 */
export const STAFF_GROUP_HANDLE_GAP_PX = 10

/**
 * ⭐⭐ **…and a SMALLER gap for a sign whose ink already projects.**
 *
 * 🚨 **His two reports, one round apart.** First: *"in the brace the squares are good in position but
 * in the brackets the squares vertically are too close"* — the box was the SPAN, so the square sat
 * inside the serif. Then, once the box became the INK: *"the squares in the bracket look better but
 * i think now it can be tiny closer."*
 *
 * ⭐ Both are the same fact seen from two sides: the square hangs off the sign's own end, and a
 * BRACKET's end is already ~1.5 sp past the staff line while a BRACE's is on it. At a shared 10 px
 * the bracket's square lands ~25 px from the staff and the brace's at 10 — so **the projection is
 * already doing part of the separating**, and the air on top of it can be less.
 *
 * ⛔ Not a smaller shared constant: that would move the brace's squares too, and he said those are
 * right.
 */
export const STAFF_GROUP_HANDLE_GAP_PROJECTING_PX = 6

/** Which end of the span a square grabs. */
export type StaffGroupHandleEnd = 'top' | 'bottom'

export interface StaffGroupHandle {
  end: StaffGroupHandleEnd
  x: number
  y: number
}

/** The least of the registry this module needs, declared structurally so it can be tested without
 *  one — `barlineJoinHandles`' arrangement. */
export interface StaffGroupBoxRegistry {
  getByType(type: 'staffGroupSign'): { id?: string; bbox: { x: number; y: number; width: number; height: number } }[]
  getStaffGeometry(measure: number, staff: number): { lineYPositions: number[] } | null | undefined
}

/**
 * **The two squares of this sign**, or none when there is nowhere to move an end to.
 *
 * @param staffCount how many staves the score has — ⭐ the only thing that can empty the result.
 */
export function staffGroupHandles(
  registry: StaffGroupBoxRegistry,
  groupId: string,
  staffCount: number,
  /** Does this sign's own ink reach past the outer staff lines? A bracket does, a brace does not —
   *  `layout/systemStartColumn.signOutwardReachSpaces` is the score's answer. */
  projects = false,
): StaffGroupHandle[] {
  if (staffCount < 2) return [] // nowhere to grow or shrink to — see the header
  const box = registry.getByType('staffGroupSign').find(el => el.id === groupId)
  if (!box) return []

  // ⭐ Centred on the sign's own ink horizontally, and hanging off each drawn end vertically —
  //   by less when that end already projects ({@link STAFF_GROUP_HANDLE_GAP_PROJECTING_PX}).
  const x = box.bbox.x + box.bbox.width / 2
  const gap = projects ? STAFF_GROUP_HANDLE_GAP_PROJECTING_PX : STAFF_GROUP_HANDLE_GAP_PX
  return [
    { end: 'top', x, y: box.bbox.y - gap },
    { end: 'bottom', x, y: box.bbox.y + box.bbox.height + gap },
  ]
}

/**
 * ⭐⭐ **WHICH STAFF THE POINTER IS OVER** — what a drag resolves to.
 *
 * ⚠️ **The BAND, not the nearest line**: a staff owns the space from its own top line to its bottom
 * one, and a pointer in the GAP between two staves belongs to whichever it is nearer. ⛔ Never
 * `Math.round(y / stride)`: staves may be drawn at different sizes, so there is no single stride
 * ([[project_small_staff_spacing]]).
 *
 * @returns the staff index, clamped to the score, or null when no staff geometry is known.
 */
export function staffAtPointer(
  registry: StaffGroupBoxRegistry, measure: number, staffCount: number, y: number,
): number | null {
  let best: { staff: number; distance: number } | null = null
  for (let staff = 0; staff < staffCount; staff++) {
    const geo = registry.getStaffGeometry(measure, staff)
    if (!geo || geo.lineYPositions.length === 0) continue
    const top = geo.lineYPositions[0]
    const bottom = geo.lineYPositions[geo.lineYPositions.length - 1]
    // Inside the staff's own band is an exact answer; outside it, how far away.
    const distance = y < top ? top - y : y > bottom ? y - bottom : 0
    if (!best || distance < best.distance) best = { staff, distance }
    if (distance === 0) break
  }
  return best?.staff ?? null
}

/**
 * ⭐ **The span a drag makes** — the grabbed end moves to `staff`, the other end stays.
 *
 * ⚠️ **The ends may CROSS, and that is not an error**: dragging the top handle below the bottom one
 * is a legible gesture (the user is re-aiming the span), so the result is normalised rather than
 * refused. ⛔ A group of no staves is impossible by construction — both ends are staff indices.
 */
export function spanAfterDrag(
  span: { fromStaff: number; toStaff: number }, end: StaffGroupHandleEnd, staff: number,
): { fromStaff: number; toStaff: number } {
  const other = end === 'top' ? span.toStaff : span.fromStaff
  return { fromStaff: Math.min(staff, other), toStaff: Math.max(staff, other) }
}

/** The square's half-side and its hit radius — one family with the slur and join handles. */
export const STAFF_GROUP_HANDLE_R = 4
export const STAFF_GROUP_HANDLE_HIT = 9
