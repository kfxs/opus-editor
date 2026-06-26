import type { Stave } from 'vexflow'

/**
 * Staff-space ↔ pixel conversion at the render boundary.
 *
 * The engraving-overrides compartment stores *positional* data in **staff-spaces**
 * (the distance between two adjacent staff lines), never raw pixels — so a tweak
 * renders correctly at any font / zoom / spacing and rides along when the music
 * reflows (see docs/engraving-overrides-plan.md, invariant "no pixels in the model").
 * These helpers do the conversion against the live stave's line spacing, which is in
 * hand at draw time (`stave.getSpacingBetweenLines()`).
 *
 * Phase 0 infrastructure: established here with NO callers yet — Phase 1 (migrating
 * slur `cps` into the compartment) is the first client.
 */

/** Pixels → staff-spaces, against a stave's current line spacing. */
export function pixelsToStaffSpaces(px: number, stave: Stave): number {
  return px / stave.getSpacingBetweenLines()
}

/** Staff-spaces → pixels, against a stave's current line spacing. */
export function staffSpacesToPixels(staffSpaces: number, stave: Stave): number {
  return staffSpaces * stave.getSpacingBetweenLines()
}
