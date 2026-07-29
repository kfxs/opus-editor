import { describe, it, expect } from 'vitest'
import { LAYOUT_CONFIG } from '@/engine/rendering/layoutConfig'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import {
  staveHeightPx, staffStridePx, minStaffStridePx, minSpacingAboveSpaces, spacingAbovePx, systemStaffTops,
} from './staffStride'

const FULL_STRIDE = LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING

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
    expect(staffStridePx(0.7) - staveHeightPx(0.7)).toBe(LAYOUT_CONFIG.VERTICAL_SPACING)
  })

  it('grows for a staff drawn LARGER than full size — the ratio is not a shrink switch', () => {
    expect(staffStridePx(1.5)).toBeGreaterThan(FULL_STRIDE)
  })
})

describe('the collision floor', () => {
  it('is the historical 90px at full size, and the historical −6 spaces of nudge', () => {
    expect(minStaffStridePx(1)).toBe(90)
    expect(minSpacingAboveSpaces(1, 1)).toBe((90 - FULL_STRIDE) / STAFF_SPACE_PX)
  })

  it('tightens in PIXELS under a small staff — less ink to collide with', () => {
    expect(minStaffStridePx(0.7)).toBeLessThan(minStaffStridePx(1))
  })

  it('is the same −6 SPACES at any uniform size — both halves scale together', () => {
    expect(minSpacingAboveSpaces(0.7, 0.7)).toBeCloseTo(minSpacingAboveSpaces(1, 1), 6)
  })

  it('lets a full-size staff sit closer under a SMALL one, in its own spaces', () => {
    // The slot above shrank but the unit did not: fewer of the dragging staff's spaces fit in it.
    expect(minSpacingAboveSpaces(0.7, 1)).toBeGreaterThan(minSpacingAboveSpaces(1, 1))
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
    expect(heightPx).toBe(3 * FULL_STRIDE)
  })

  it('adds each staff’s space-above to it AND to everything below it', () => {
    const { topPx, heightPx } = systemStaffTops([1, 1], [10, 20])
    expect(topPx).toEqual([10, FULL_STRIDE + 30])
    expect(heightPx).toBe(2 * FULL_STRIDE + 30)
  })

  it('pulls the lower staves UP when the staff above them is small', () => {
    const small = systemStaffTops([0.7, 1], [0, 0])
    const full = systemStaffTops([1, 1], [0, 0])
    expect(small.topPx[0]).toBe(full.topPx[0]) // the small staff itself does not move…
    expect(small.topPx[1]).toBeCloseTo(full.topPx[1] - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 6)
    expect(small.heightPx).toBeCloseTo(full.heightPx - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 6)
  })

  it('a SMALL BOTTOM staff shortens the system without moving anything', () => {
    const small = systemStaffTops([1, 0.7], [0, 0])
    const full = systemStaffTops([1, 1], [0, 0])
    expect(small.topPx).toEqual(full.topPx)
    expect(small.heightPx).toBeCloseTo(full.heightPx - LAYOUT_CONFIG.STAVE_HEIGHT * 0.3, 6)
  })

  it('lays out a degenerate list — a missing size is full size', () => {
    expect(systemStaffTops([], []).heightPx).toBe(0)
    expect(systemStaffTops([1], []).topPx).toEqual([0])
  })
})
