/**
 * **The vertical stride — how much room each staff of a system takes, and where each one sits.**
 *
 * This used to be one number: `STAVE_HEIGHT + VERTICAL_SPACING`, computed inline in four places,
 * multiplied by the staff index for a staff's Y and by the staff count for a system's height. It
 * stopped being one number the day a staff could be drawn small (docs/staff-size-plan.md §5), and
 * the failure is not merely ugly: `pageCastOff` decides page breaks from the system heights, so a
 * 0.7 staff sitting in a full-size slot paginates the score wrong.
 *
 * ⭐ **Summed, not multiplied** — that is the whole change. Each staff contributes its own stride,
 * and a staff's offset from the system top is the sum of the strides above it (plus the
 * space-above overrides, which were already a prefix sum). At a uniform size every function here
 * reduces exactly to the arithmetic it replaced.
 *
 * ⭐ **The size scales the STAFF, not the CLEARANCE.** `STAVE_HEIGHT` is the room one staff's own
 * ink occupies (five lines plus what hangs off them), so it is what shrinks; `VERTICAL_SPACING` is
 * the gap to the staff below, and a gap is not made of ink. Same rule as §1's ink/finger split, one
 * level up.
 *
 * ⛔ Not a *renderer* concern despite reading `LAYOUT_CONFIG`: this is the vertical half of the
 * casting-off, and `pageCastOff` next door is the other half of the same question.
 */
import { LAYOUT_CONFIG } from '@/engine/rendering/layoutConfig'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** The vertical room one staff's own ink occupies, at `size` (1 = full size). */
export function staveHeightPx(size: number): number {
  return LAYOUT_CONFIG.STAVE_HEIGHT * size
}

/** Top-to-top distance from a staff drawn at `size` to whatever is directly below it — its own
 *  height plus the clearance. The number that used to be `STAVE_HEIGHT + VERTICAL_SPACING`. */
export function staffStridePx(size: number): number {
  return staveHeightPx(size) + LAYOUT_CONFIG.VERTICAL_SPACING
}

/**
 * The smallest top-to-top distance (px) a staff-spacing drag may shrink a gap TO — the collision
 * floor, below a staff drawn at `size`. Tunable; start conservative and adjust against the look.
 *
 * Scaled the same way as {@link staffStridePx}: the staff's share of the floor shrinks with the
 * staff, the clearance does not. It was a bare 90 while every staff was full size, and 90 is
 * exactly what it still returns there.
 */
export function minStaffStridePx(size: number): number {
  return (MIN_FULL_SIZE_STRIDE_PX - LAYOUT_CONFIG.VERTICAL_SPACING) * size + LAYOUT_CONFIG.VERTICAL_SPACING
}

/** The collision floor at full size — enough of the default stride that a staff (or a whole system,
 *  for the top staff) can't be dragged or nudged up INTO the one above. */
const MIN_FULL_SIZE_STRIDE_PX = 90

/**
 * How far a staff-spacing "space above" may be nudged NEGATIVE, in staff-spaces — the clamp the
 * drag and the keyboard nudge both floor against.
 *
 * Two sizes, because two different staves are involved in one gap. The gap between a staff and the
 * one above it is `stride(sizeAbove) + above · ss · sizeOwn`: the slot belongs to the **upper**
 * staff (whose ink you would collide with, hence the floor is read from it), while `above` is an
 * authored distance in the **lower** staff's own spaces (see {@link spacingAbovePx}). Flooring that
 * gap at {@link minStaffStridePx} gives one lower bound on `above`, which is why a single number
 * clamps every gap. No upper bound — you can widen freely.
 *
 * At a uniform size it is exactly −6 spaces, whatever that size is: both halves scale together.
 */
export function minSpacingAboveSpaces(sizeAbove: number, sizeOwn: number): number {
  return (minStaffStridePx(sizeAbove) - staffStridePx(sizeAbove)) / (STAFF_SPACE_PX * sizeOwn)
}

/**
 * The floor for the top staff of a system that OPENS A PAGE — where {@link minSpacingAboveSpaces}
 * does not apply, because there is no staff up there to collide with.
 *
 * What is above such a system is the sheet's top margin, and `above = 0` already places it exactly
 * against that margin: every negative value from there is music drawn off the paper, where the SVG
 * clips it away. The collision floor would happily hand out −6 spaces (it is pricing a gap that
 * does not exist here), which is how a staff dragged up ends with its clef sliced off.
 *
 * ⭐ Zero, and stated as a named constant rather than folded into the clamp as a literal: it is a
 * different RULE, not a tighter number — "you may not take room the page has not got" against
 * "you may not close a gap onto the ink above it". Widening is untouched, as everywhere else here.
 */
export const MIN_SPACING_ABOVE_AT_PAGE_TOP = 0

/**
 * An authored "space above staff" (client #7, stored in staff-spaces) in pixels, on a staff drawn
 * at `size`.
 *
 * ⭐ **The staff's OWN spaces, not the score's.** The override says how much room this staff wants
 * above it, in the unit the whole engraving compartment is written in — and a staff-space on a
 * staff drawn at 0.7 is 7 pixels. Convert against the constant instead and a small staff's authored
 * gap comes out ~43% too big, which reads as "the spacing tweak stopped matching what I dragged".
 */
export function spacingAbovePx(aboveSpaces: number, size: number): number {
  return aboveSpaces * STAFF_SPACE_PX * size
}

/** Where each staff of one system sits, and how tall the system is. */
export interface SystemStaffTops {
  /** `topPx[i]` — staff `i`'s top, measured from the system's own top. */
  topPx: number[]
  /** The system's full height: every staff's stride plus every staff's space-above. */
  heightPx: number
}

/**
 * Lay one system's staves out vertically: `sizes[i]` is staff `i`'s drawn size and `abovePx[i]` is
 * its own extra space-above in pixels (NOT a prefix sum — this does the accumulating).
 *
 * A staff's space-above pushes it *and everything below it* down, which is why the two accumulators
 * are added together per staff rather than kept apart. Missing entries read as size 1 / no extra,
 * so a caller with a degenerate staff list still lays out.
 */
export function systemStaffTops(sizes: readonly number[], abovePx: readonly number[]): SystemStaffTops {
  const topPx: number[] = []
  let strideAcc = 0
  let aboveAcc = 0
  for (let i = 0; i < sizes.length; i++) {
    aboveAcc += abovePx[i] ?? 0
    topPx.push(strideAcc + aboveAcc)
    strideAcc += staffStridePx(sizes[i] ?? 1)
  }
  return { topPx, heightPx: strideAcc + aboveAcc }
}
