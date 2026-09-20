import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'

/**
 * Staff-space ↔ pixel conversion at the render boundary.
 *
 * The engraving-overrides compartment stores *positional* data in **staff-spaces**
 * (the distance between two adjacent staff lines), never raw pixels — so a tweak
 * renders correctly at any font / zoom / spacing and rides along when the music
 * reflows (see docs/plans/engraving-overrides-plan.md, invariant "no pixels in the model").
 * These helpers do the conversion against a staff's space (`engrave/staff/staffFrame`), which is in
 * hand at draw time (`rendering/staff/staveFrame`).
 *
 * Phase 0 infrastructure: established here with NO callers yet — Phase 1 (migrating
 * slur `cps` into the compartment) is the first client.
 */

/** Pixels → staff-spaces, against a staff's space. */
export function pixelsToStaffSpaces(px: number, frame: Pick<StaffFrame, 'spacePx'>): number {
  return px / frame.spacePx
}

/** Staff-spaces → pixels, against a staff's space. */
export function staffSpacesToPixels(staffSpaces: number, frame: Pick<StaffFrame, 'spacePx'>): number {
  return staffSpaces * frame.spacePx
}
