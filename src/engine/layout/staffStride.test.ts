import { describe, it, expect } from 'vitest'
import { LAYOUT_CONFIG } from '@/engine/rendering/layoutConfig'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import {
  staveHeightPx, staffStridePx, staffLinesPx, minStaffStridePx, minSpacingAboveSpaces, spacingAbovePx,
  systemStaffTops, STAFF_GAP_SPACES, SYSTEM_GAP_SPACES,
} from './staffStride'

// ⚠️ **The stride stopped being `STAVE_HEIGHT + VERTICAL_SPACING` on 2026-08-28.** A staff-to-staff
// distance is now the five LINES plus the researched gap, and the bottom staff of a system trails a
// wider one (docs/vertical-spacing-research.md; the gaps themselves are `staffStride.gaps.test.ts`).
// `STAVE_HEIGHT` still means "the room a staff's ink occupies" — the cull window and the measure
// rect read it — it is simply no longer what sets the distance.
const FULL_STRIDE = staffLinesPx(1) + STAFF_GAP_SPACES * STAFF_SPACE_PX
/** What the bottom staff adds beyond an inner stride: the system gap in place of the staff gap. */
const TRAILING_EXTRA = (SYSTEM_GAP_SPACES - STAFF_GAP_SPACES) * STAFF_SPACE_PX

/**
 * The vertical stride went from one number to one per staff (docs/staff-size-plan.md §5). The two
 * things worth pinning: at a uniform size every function still answers exactly what the old
 * arithmetic did, and a small staff shrinks the STAFF without shrinking the clearance.
 */
describe('staffStridePx', () => {
  it('is the old constant at full size', () => {
    expect(staffStridePx(1)).toBe(FULL_STRIDE)
    expect(staveHeightPx(1)).toBe(LAYOUT_CONFIG.STAVE_HEIGHT)
  })

  it('scales the staff and NOT the clearance', () => {
    expect(staveHeightPx(0.7)).toBeCloseTo(LAYOUT_CONFIG.STAVE_HEIGHT * 0.7, 6)
    // ⭐ The LINES shrink with the staff and the GAP does not — a gap is not made of ink.
    expect(staffStridePx(0.7) - staffLinesPx(0.7)).toBe(STAFF_GAP_SPACES * STAFF_SPACE_PX)
  })

  it('grows for a staff drawn LARGER than full size — the ratio is not a shrink switch', () => {
    expect(staffStridePx(1.5)).toBeGreaterThan(FULL_STRIDE)
  })
})

describe('the collision floor', () => {
  it('is the books’ four spaces of clear air, and the nudge that leaves', () => {
    expect(minStaffStridePx(1)).toBe(staffLinesPx(1) + 4 * STAFF_SPACE_PX) // the books' 4-space floor
    expect(minSpacingAboveSpaces(1, 1)).toBe((minStaffStridePx(1) - FULL_STRIDE) / STAFF_SPACE_PX)
  })

  it('tightens in PIXELS under a small staff — less ink to collide with', () => {
    expect(minStaffStridePx(0.7)).toBeLessThan(minStaffStridePx(1))
  })

  it('⭐ is the same nudge in PIXELS at any size — and so MORE of a small staff’s own spaces', () => {
    // ⚠️ **This claim changed on 2026-08-28 with the model.** It used to be size-INVARIANT in spaces,
    // because the floor's ink share and the default's ink share scaled the same way. Both are now
    // *lines + a constant of AIR*, so what a drag may close is that constant — a fixed amount of
    // SCORE pixels — while `above` is authored in the dragging staff's OWN spaces. A 0.7 staff's
    // spaces are smaller, so the same room is more of them.
    const roomPx = (size: number) => minSpacingAboveSpaces(size, size) * STAFF_SPACE_PX * size
    expect(roomPx(0.7)).toBeCloseTo(roomPx(1), 6)
    expect(minSpacingAboveSpaces(0.7, 0.7)).toBeLessThan(minSpacingAboveSpaces(1, 1)) // more, negative
  })

  it('⭐ asks the same of a SMALL staff above as of a full-size one — clear air is clear air', () => {
    // ⚠️ **This claim INVERTED on 2026-08-28, and deliberately.** It used to be `toBeGreaterThan`:
    // under the old model the floor's ink share and the default's ink share scaled differently, so
    // how much you could take away depended on the size of the staff ABOVE. Both are now stated as
    // *the staff's own lines + a constant of AIR*, so the difference between them is that constant —
    // and how much air you may remove is not a fact about how big the neighbour is.
    expect(minSpacingAboveSpaces(0.7, 1)).toBeCloseTo(minSpacingAboveSpaces(1, 1), 6)
  })
})

describe('spacingAbovePx', () => {
  it('converts an authored gap in the STAFF’S OWN spaces', () => {
    expect(spacingAbovePx(2, 1)).toBe(2 * STAFF_SPACE_PX)
    expect(spacingAbovePx(2, 0.7)).toBeCloseTo(2 * STAFF_SPACE_PX * 0.7, 6)
  })
})

describe('systemStaffTops', () => {
  it('reduces to index × stride when every staff is the same size', () => {
    const { topPx, heightPx } = systemStaffTops([1, 1, 1], [0, 0, 0])
    expect(topPx).toEqual([0, FULL_STRIDE, 2 * FULL_STRIDE])
    expect(heightPx).toBe(3 * FULL_STRIDE + TRAILING_EXTRA)
  })

  it('adds each staff’s space-above to it AND to everything below it', () => {
    const { topPx, heightPx } = systemStaffTops([1, 1], [10, 20])
    expect(topPx).toEqual([10, FULL_STRIDE + 30])
    expect(heightPx).toBe(2 * FULL_STRIDE + TRAILING_EXTRA + 30)
  })

  it('pulls the lower staves UP when the staff above them is small', () => {
    const small = systemStaffTops([0.7, 1], [0, 0])
    const full = systemStaffTops([1, 1], [0, 0])
    expect(small.topPx[0]).toBe(full.topPx[0]) // the small staff itself does not move…
    expect(small.topPx[1]).toBeCloseTo(full.topPx[1] - staffLinesPx(1) * 0.3, 6)
    expect(small.heightPx).toBeCloseTo(full.heightPx - staffLinesPx(1) * 0.3, 6)
  })

  it('a SMALL BOTTOM staff shortens the system without moving anything', () => {
    const small = systemStaffTops([1, 0.7], [0, 0])
    const full = systemStaffTops([1, 1], [0, 0])
    expect(small.topPx).toEqual(full.topPx)
    expect(small.heightPx).toBeCloseTo(full.heightPx - staffLinesPx(1) * 0.3, 6)
  })

  it('lays out a degenerate list — a missing size is full size', () => {
    expect(systemStaffTops([], []).heightPx).toBe(0)
    expect(systemStaffTops([1], []).topPx).toEqual([0])
  })
})
