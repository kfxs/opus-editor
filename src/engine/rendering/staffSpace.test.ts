import { describe, it, expect } from 'vitest'
import { pixelsToStaffSpaces, staffSpacesToPixels } from './staffSpace'

/**
 * Phase 0 staff-space helper. The helpers only read a frame's `spacePx`, so a bare object pins the
 * conversion and the round-trip identity at an arbitrary space.
 */
describe('staffSpace conversion (Phase 0)', () => {
  const frameWithSpace = (spacePx: number) => ({ spacePx })

  it('converts pixels to staff-spaces using the staff space', () => {
    expect(pixelsToStaffSpaces(25, frameWithSpace(10))).toBe(2.5)
  })

  it('converts staff-spaces to pixels using the staff space', () => {
    expect(staffSpacesToPixels(2.5, frameWithSpace(10))).toBe(25)
  })

  it('round-trips px → staff-spaces → px at any space', () => {
    const frame = frameWithSpace(13) // non-round space
    expect(staffSpacesToPixels(pixelsToStaffSpaces(40, frame), frame)).toBeCloseTo(40)
  })
})
