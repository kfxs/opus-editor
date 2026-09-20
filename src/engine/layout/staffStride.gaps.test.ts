/**
 * ⭐⭐ **THE TWO VERTICAL GAPS, AND THAT THEY ARE NOW DIFFERENT NUMBERS** — his ask, 2026-08-28:
 * *"lets make the default space between staves (**no between systems**) a piano space or a string
 * quartet space based on the research"*.
 *
 * Subject: {@link staffStridePx} / {@link systemStaffTops}, a chapter beside `staffStride.test.ts`.
 * Everything here is stated as the distance a reader can SEE and a book can quote: **bottom stave-line
 * of one staff → top stave-line of the next** (docs/research/vertical-spacing-research.md §1). ⛔ Never
 * top-to-top, which no source measures and which hides the staff's own 4 spaces inside the number.
 */
import { describe, it, expect } from 'vitest'
import { staffStridePx, staffLinesPx, systemStaffTops, minStaffStridePx, STAFF_GAP_SPACES, SYSTEM_GAP_SPACES } from './staffStride'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const sp = (px: number) => px / STAFF_SPACE_PX
/** The clear air below staff `i` of a system, in staff-spaces. */
function gapBelow(sizes: number[], i: number): number {
  const { topPx, heightPx } = systemStaffTops(sizes, sizes.map(() => 0))
  const bottomOfI = topPx[i] + staffLinesPx(sizes[i])
  const nextTop = i + 1 < sizes.length ? topPx[i + 1] : heightPx
  return sp(nextTop - bottomOfI)
}

describe('the default vertical gaps', () => {
  it('⭐ between two staves of one system: 6.5 — the measured top, met with his eye', () => {
    // Gould's braced piano pair measures 4.79 sp and her string quartet 6.01–6.16 — the same
    // distance, which is the finding that let one constant answer both halves of his ask. 6.5 sits
    // between that measured top (6.16) and the 6.86 his own hand dragged to.
    expect(STAFF_GAP_SPACES).toBe(6.5)
    expect(gapBelow([1, 1], 0)).toBe(6.5)
    expect(gapBelow([1, 1, 1], 1), 'and the same at every inner gap').toBe(6.5)
  })

  it('⭐⭐ between two SYSTEMS: 11 spaces — UNCHANGED, because he did not ask for it', () => {
    // The trailing gap of the bottom staff IS the system gap. Before this change one constant was
    // both, which is why a grand staff was spaced like two unrelated systems.
    expect(SYSTEM_GAP_SPACES).toBe(11)
    expect(gapBelow([1, 1], 1)).toBe(11)
    expect(gapBelow([1, 1, 1], 2)).toBe(11)
  })

  it('⭐ a ONE-STAFF score is untouched — same system height as before, to the pixel', () => {
    // 4 lines + 11 = the old 15 staff-spaces of stride, so casting-off, page breaks and the SVG
    // height of a single-staff score are byte for byte what they were.
    expect(systemStaffTops([1], [0]).heightPx).toBe(150)
    expect(gapBelow([1], 0)).toBe(11)
  })

  it('⭐ …and every source’s ordering now holds: systems wider than staves', () => {
    // Gould p. 488 and Gerou & Lusk p. 133, in the same words. It did NOT hold before: 11 = 11.
    expect(SYSTEM_GAP_SPACES).toBeGreaterThan(STAFF_GAP_SPACES)
  })

  it('the drag floor is the literature’s 4 spaces — below the default, so the drag can move', () => {
    // Gould p. 488 "at least a stave height apart" = Ross p. 68 "at least four spaces", the one hard
    // number either book gives. ⚠️ The old floor (90 px of stride) would now sit ABOVE the default.
    expect(sp(minStaffStridePx(1) - staffLinesPx(1))).toBe(4)
    expect(minStaffStridePx(1)).toBeLessThan(staffStridePx(1))
  })

  it('⛔ the gap is not made of ink: a SMALL staff gets the same air', () => {
    expect(gapBelow([0.7, 0.7], 0)).toBe(6.5)
    expect(staffStridePx(0.7)).toBe(staffLinesPx(0.7) + STAFF_GAP_SPACES * STAFF_SPACE_PX)
  })
})
