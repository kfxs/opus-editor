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
import { LAYOUT_CONFIG } from './layoutConfig'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** The vertical room one staff's own ink occupies, at `size` (1 = full size). */
export function staveHeightPx(size: number): number {
  return LAYOUT_CONFIG.STAVE_HEIGHT * size
}

/** The five lines themselves — 4 staff-spaces, at `size`. ⭐ The measurable thing: every distance the
 *  engraving literature states is between one staff's BOTTOM LINE and the next one's TOP LINE
 *  (docs/vertical-spacing-research.md §1), so the gaps below are expressed against this and not
 *  against {@link staveHeightPx}, which also carries room for ink that hangs off. */
export function staffLinesPx(size: number): number {
  return STAFF_LINES_SPACES * STAFF_SPACE_PX * size
}

const STAFF_LINES_SPACES = 4

/**
 * ⭐⭐ **THE CLEAR AIR BETWEEN TWO STAVES OF ONE SYSTEM**, bottom line to top line, in staff-spaces —
 * his ask, 2026-08-28: *"lets make the default space between staves (no between systems) a piano
 * space or a string quartet space based on the research"*.
 *
 * **5, and here is where it comes from** (docs/vertical-spacing-research.md, all MEASURED off the
 * printed engravings, since no book states a number):
 *
 * | measured | sp |
 * |---|---|
 * | Gould Table 4, a **braced piano pair** | 4.79 |
 * | Gould Table 4, a **string quartet** | 6.01–6.16 ← the measured top |
 * | Gould p. 517, a real crowded score (piano pair included) | 5.26–5.74 |
 * | Gerou & Lusk p. 75, a bare **grand staff** | 5.05 |
 * | ⛔ the FLOOR, stated twice (Gould p. 488 · Ross p. 68) | **4** |
 *
 * ⭐⭐ **A piano pair and a quartet are the SAME distance** — that is the research's own finding, and
 * it is why one constant answers both halves of his ask. Gould gives a braced pair exactly the
 * distance of the bracketed staves around it; the pairing is carried by the BRACE, ⛔ not by space.
 *
 * ⭐⭐ **6.5 — A COMPROMISE BETWEEN THE MEASURED TOP AND HIS HAND, and it is worth saying which is
 * which.** He saw 5 (*"too short"*), then 6, then **dragged a staff himself** and sent the score
 * back: `staffSpacing above: 0.857` on top of 6, i.e. **his eye chose 6.86** — followed by *"lets try
 * to find a compromise based on the research"*. So:
 *
 * - **6.16** is the widest small-ensemble gap MEASURED in Gould's Table 4 (her string quartet's
 *   6.01–6.16, her brass quintet's 5.96–6.16);
 * - **6.86** is what his hand asked for;
 * - **6.5** is between them, and reads as *the measured top, rounded up to the nearest half space*.
 *
 * ⚠️ **Why it is honest to go above the measured examples at all**: the research's own note on
 * Table 4 is that it is SCHEMATIC — *"ratios trustworthy, absolutes not"* — and every trustworthy
 * absolute in it (the Carter score's 5.26–5.74, Gerou & Lusk's drawn 5.05 grand staff) is a page with
 * ink in the gap, which is what the books say sets the distance. There is no measured number for
 * *"two bare staves, no ink"*, so between the floor (4) and Gould's *recommended* ink-laden 13.27
 * this is taste inside a range, ⛔ not a rule being broken.
 *
 * ⭐ And a hand can always disagree with it: his 0.857 nudge is a per-system `staffSpacing` override,
 * which is exactly the escape hatch this default is supposed to have.
 *
 * ⚠️ **It was 11**, which is what he reported by eye (*"when we add a new staff to the system the
 * space is too wide"*) — roughly double the drawn practice, and it also broke the one ordering every
 * source agrees on (systems must be wider than staves), because a system's gap was the same 11.
 *
 * ⛔ **NOT scaled by staff size**: a gap is not made of ink (docs/staff-size-plan.md §5).
 *
 * ⏭️ **What this does NOT do, and the literature says it is the real rule:** the distance should be
 * decided by the INK IN THE GAP — Gould's *"recommended"* piano spacing is 13.27 sp because that gap
 * carries a hairpin, a slur and a tuplet bracket, and she prints an uncriticised 7.95 sp system gap
 * while calling 8.25 sp *"not acceptable"* where the ink is dense. A constant cannot say that. We
 * already build the skyline (`layout/outsideStaffBand`), so a measured gap is buildable —
 * docs/vertical-spacing-research.md §6, and docs/layout-plan.md §8 is where it would be planned.
 */
export const STAFF_GAP_SPACES = 6.5

/**
 * ⭐ **AND THE AIR BELOW THE LAST STAFF OF A SYSTEM — deliberately UNCHANGED at 11.** His ask was
 * *"the space between staves (**no between systems**)"*, so this is exactly today's number, kept by
 * hand rather than by accident: it used to be the same quantity as the staff gap (a system's height
 * is the sum of the strides, so the last staff's trailing gap IS the system gap), and splitting them
 * is the whole of this change.
 *
 * ⭐ It also puts us on the right side of the one rule every source states: *"the distance between
 * systems should be greater than the distance between the most widely spaced staves"* (Gould p. 488,
 * and Gerou & Lusk p. 133 in the same words). 11 > 5. ⏭️ The number itself is still arbitrary — the
 * books give no figure for it either (research §5).
 */
export const SYSTEM_GAP_SPACES = 11

/** Top-to-top distance from a staff drawn at `size` to the next staff of the SAME system — its five
 *  lines plus {@link STAFF_GAP_SPACES} of air. ⚠️ ⛔ Not the distance to the next SYSTEM: that is
 *  {@link SYSTEM_GAP_SPACES}, and {@link systemStaffTops} is where the two meet. */
export function staffStridePx(size: number): number {
  return staffLinesPx(size) + STAFF_GAP_SPACES * STAFF_SPACE_PX
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
  return staffLinesPx(size) + MIN_STAFF_GAP_SPACES * STAFF_SPACE_PX
}

/**
 * ⭐⭐ **THE FLOOR IS THE LITERATURE'S** — *"Staves should be at least a stave height apart"*
 * (Gould p. 488) and *"skip at least four spaces between staves"* (Ross p. 68), which are the same
 * number said independently: **4 staff-spaces of clear air**. The one hard figure either book gives.
 *
 * ⚠️ It used to be a bare 90 px of stride, which under the old 11-space default left 3 spaces of
 * room to shrink; against the new 5-space default it would have been a floor ABOVE the default,
 * freezing the drag entirely.
 */
const MIN_STAFF_GAP_SPACES = 4

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
interface SystemStaffTops {
  /** `topPx[i]` — staff `i`'s top, measured from the system's own top. */
  topPx: number[]
  /** The system's full height: every staff's stride, every staff's space-above, and the bottom
   *  staff's trailing gap widened from the staff gap to the SYSTEM gap (see the function). */
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
  // ⭐⭐ **THE LAST STAFF'S TRAILING GAP IS THE SYSTEM GAP, and this line is where the two part
  // company.** A system's height is what separates it from the next one, so the bottom staff does
  // not contribute a staff-to-staff stride: it contributes its own lines plus
  // {@link SYSTEM_GAP_SPACES}. Before 2026-08-28 there was no difference to draw — one constant did
  // both, which is exactly why a grand staff was spaced as loosely as two unrelated systems.
  //
  // ⚠️ A ONE-STAFF system is unchanged by all of this (4 + 11 = the old 15 staff-spaces), so a
  // single-staff score's casting-off, page breaks and SVG height are byte for byte what they were.
  const last = sizes.length - 1
  const trailing = last >= 0
    ? staffLinesPx(sizes[last] ?? 1) + SYSTEM_GAP_SPACES * STAFF_SPACE_PX - staffStridePx(sizes[last] ?? 1)
    : 0
  return { topPx, heightPx: strideAcc + aboveAcc + trailing }
}
