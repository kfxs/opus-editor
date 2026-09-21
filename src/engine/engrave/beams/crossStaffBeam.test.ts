import { describe, it, expect } from 'vitest'
import { CROSS_STAFF_BEAM, crossStaffBeamPlan, type CrossStaffBeamChord } from './crossStaffBeam'

/** A one-head chord on `line` of its own staff, that staff `lift` lines above home. */
const at = (line: number, lift = 0): CrossStaffBeamChord => ({ topLine: line + lift, bottomLine: line + lift, lift })

/** The default gap: staves 10.5 lines apart (4 of staff + 6.5 of air). */
const UP = 10.5

describe('crossStaffBeamPlan — Gould pp. 314–315', () => {
  it('a group on ONE staff is not a cross-staff beam', () => {
    expect(crossStaffBeamPlan([at(2), at(3)])).toBeNull()
    expect(crossStaffBeamPlan([at(2, UP), at(3, UP)])).toBeNull()
  })

  it('⭐ stems point INTO the system: the upper staff’s chords down, the lower staff’s up', () => {
    const plan = crossStaffBeamPlan([at(4), at(2, UP), at(4), at(2, UP)])!
    expect(plan.stemDirections).toEqual([1, -1, 1, -1])
  })

  it('⭐ "the shortest stems in both directions are of equal length"', () => {
    // Lower chord on its top line (5), upper chord on its bottom line (1 + 10.5): the gap is 6.5.
    const plan = crossStaffBeamPlan([at(5), at(1, UP)])!
    expect(plan.beamLine).toBe(5 + 6.5 / 2)
    expect(plan.beamLine - 5).toBe(1 + UP - plan.beamLine)
  })

  it('the NEAREST heads decide — a chord’s far head, and a far chord, do not', () => {
    const chords: CrossStaffBeamChord[] = [
      { topLine: 5, bottomLine: 2, lift: 0 }, // a chord: its TOP head faces the gap
      at(1), // a low note on the same staff — further from the gap, irrelevant
      { topLine: 4 + UP, bottomLine: 1 + UP, lift: UP }, // its BOTTOM head faces the gap
    ]
    expect(crossStaffBeamPlan(chords)!.beamLine).toBe(5 + 6.5 / 2)
  })

  it('⭐ kept in the space BETWEEN the staves, "even if this results in unequal stem lengths"', () => {
    // Both chords low: the midpoint (line 3 + …) would run the beam through the lower staff.
    const plan = crossStaffBeamPlan([at(-2), at(1, UP)], 0.5)!
    const clear = CROSS_STAFF_BEAM.staffClearanceSpaces + 0.5
    expect(plan.beamLine).toBe(5 + clear)
    // …and the mirror: both high, clamped under the upper staff.
    const high = crossStaffBeamPlan([at(5), at(8, UP)], 0.5)!
    expect(high.beamLine).toBe(1 + UP - clear)
  })

  it('⛔ below the 2½-space floor it declines — the group keeps one direction', () => {
    // Staves only 7 lines apart: a 3-space gap cannot give two stems 2½ spaces each.
    expect(crossStaffBeamPlan([at(5), at(1, 7)])).toBeNull()
    // …and the floor is exactly the row.
    const gap = 2 * CROSS_STAFF_BEAM.minStemSpaces
    expect(crossStaffBeamPlan([at(5), at(1, 4 + gap)], 0)).not.toBeNull()
    expect(crossStaffBeamPlan([at(5), at(1, 4 + gap - 0.5)], 0)).toBeNull()
  })

  it('works the other way up — the group’s home is the UPPER staff', () => {
    const plan = crossStaffBeamPlan([at(1), at(5, -UP)])!
    expect(plan.stemDirections).toEqual([-1, 1])
    expect(plan.beamLine).toBe((1 + (5 - UP)) / 2)
  })
})
