import { describe, it, expect } from 'vitest'
import type { Stave } from 'vexflow'
import { pixelsToStaffSpaces, staffSpacesToPixels } from './staffSpace'

/**
 * Phase 0 staff-space helper. A real VexFlow stave isn't needed — the helpers only
 * call `getSpacingBetweenLines()`, so a minimal stub pins the conversion and the
 * round-trip identity at an arbitrary line spacing.
 */
describe('staffSpace conversion (Phase 0)', () => {
  const staveWithSpacing = (spacing: number) =>
    ({ getSpacingBetweenLines: () => spacing } as unknown as Stave)

  it('converts pixels to staff-spaces using the stave line spacing', () => {
    const stave = staveWithSpacing(10)
    expect(pixelsToStaffSpaces(25, stave)).toBe(2.5)
  })

  it('converts staff-spaces to pixels using the stave line spacing', () => {
    const stave = staveWithSpacing(10)
    expect(staffSpacesToPixels(2.5, stave)).toBe(25)
  })

  it('round-trips px → staff-spaces → px at any spacing', () => {
    const stave = staveWithSpacing(13) // non-round spacing
    expect(staffSpacesToPixels(pixelsToStaffSpaces(40, stave), stave)).toBeCloseTo(40)
  })
})
