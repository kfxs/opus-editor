import { describe, it, expect } from 'vitest'
import { STAFF_BAND_PAD_PX, inStaffBand } from './staffBand'

/**
 * The padded staff band — the tolerance two gestures share.
 *
 * ⭐ Arithmetic, which is all this is: whether a y is within the pad of a box. ⛔ Nothing here draws
 * or measures anything; where a staff's five lines actually landed is the browser suite's.
 */
describe('inStaffBand', () => {
  /** A five-line staff drawn from y 100 to y 140. */
  const staff = { y: 100, height: 40 }

  it('a press between the lines is on the staff', () => {
    expect(inStaffBand(staff, 100)).toBe(true)
    expect(inStaffBand(staff, 120)).toBe(true)
    expect(inStaffBand(staff, 140)).toBe(true)
  })

  it('🚨 …and so is one just OUTSIDE them — the whole point of the pad', () => {
    // His report, 2026-08-26: six presses in a row declined a few pixels under the bottom line,
    // because the barline stamp was testing the box's own height. A user aiming at a barline does
    // not aim between two particular staff lines.
    expect(inStaffBand(staff, 140 + STAFF_BAND_PAD_PX)).toBe(true)
    expect(inStaffBand(staff, 100 - STAFF_BAND_PAD_PX)).toBe(true)
  })

  it('⛔ past the pad it is not', () => {
    expect(inStaffBand(staff, 140 + STAFF_BAND_PAD_PX + 1)).toBe(false)
    expect(inStaffBand(staff, 100 - STAFF_BAND_PAD_PX - 1)).toBe(false)
  })

  it('⭐ the pad matches the drawn measure box, which is what makes the rule sayable', () => {
    // "Click where the box would be → select", and now → stamp. If this number ever diverges from
    // `elements/measureRange.paintMeasureBox`'s ±12, the promise the highlight makes stops being true.
    expect(STAFF_BAND_PAD_PX).toBe(12)
  })
})
