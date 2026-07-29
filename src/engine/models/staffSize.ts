/**
 * **How big a staff is drawn** — the score's base staff-space in pixels, and the per-staff ratio
 * that multiplies it. See docs/staff-size-plan.md.
 *
 * The picture this is for: a violin part above a piano part, the violin engraved small and the
 * piano full size, on the same system. The size is a **ratio**, never a `small: true` flag — `1` is
 * full size, `0.7` is a small staff, and every number between is legal because the user will want
 * them (plan §2). Absent means `1` by rule, like every other "absent" in this model.
 *
 * ⛔ **Size is representation, not layout.** It is not part of the {@link Surface}: a canvas has no
 * millimetres and still has a staff size, so a small violin staff must engrave correctly with no
 * page in sight. The two meet only at export.
 *
 * The read side is {@link resolveStaffSize}; the write side is {@link setStaffSize} (this module is
 * small enough that splitting reads from writes the way `engravingOverrides` / `overrideOps` do
 * would say less than it costs — nothing here can be written from the renderer, because the field
 * is on `Score.staves` rather than in the overrides compartment).
 */
import type { Score } from '@/types/music'
import { getStaves } from './staffContent'

/**
 * **How many pixels one staff-space is at size 1** — the divisor every staff-spaces↔pixels
 * conversion in the layout math uses when no live `Stave` is in hand (casting-off happens before
 * any stave exists).
 *
 * It is 10 because that is VexFlow's `Tables.STAVE_LINE_DISTANCE`, which we never override, and
 * because the glyph font size agrees with it by coincidence rather than by construction: VexFlow
 * sizes glyphs from a *separate* global (`Metrics.fontSize` 30 ⇒ 30pt × 4/3 = 40 px em ⇒ SMuFL's
 * 4-staff-space em ⇒ 10 px per space). Two independent globals that happen to match.
 *
 * ⭐ It used to be called `VEXFLOW_DEFAULT_STAFF_SPACE_PX` and live in `engravingOverrides.ts`, and
 * both were wrong: it is not VexFlow's default, it is **the score's staff size**, and a scale is
 * not an authored tweak. Its call sites are all `staffSpaces × this`; each becomes
 * `staffSpaces × this × that staff's size` as the phases of docs/staff-size-plan.md land.
 */
export const STAFF_SPACE_PX = 10

/** A staff drawn at full size — what an absent {@link StaffInfo.size} means. */
export const DEFAULT_STAFF_SIZE = 1

/**
 * The size a staff is drawn at, as a ratio of the score's staff size ({@link STAFF_SPACE_PX}):
 * `1` full size, `0.7` a small staff. An unknown staff, or one with no stored size, is full size.
 *
 * ⭐ **`openingMeasureId` is accepted and ignored, deliberately.** Per-system staff size — "the
 * staff can change size depending on the system" — is wanted later and is not built (plan §3, §9).
 * The day it arrives, a per-system entry is consulted *in front of* the `staff.size` fallback here
 * and **nothing else in the codebase changes**, because every caller already passes the id of the
 * measure that opens its system. That is exactly how per-system staff *spacing* was added
 * ({@link resolveStaffSpacingAbove}), and the renderer already computes `openingMeasureId` per line
 * in `staffSpacingLayout`. So: three parameters, used with two.
 */
export function resolveStaffSize(score: Score, staffId: string, openingMeasureId?: string): number {
  void openingMeasureId // reserved — see the note above; per-system size is not built yet.
  return getStaves(score).find(s => s.id === staffId)?.size ?? DEFAULT_STAFF_SIZE
}

/**
 * Set a staff's drawn size to an absolute ratio; `1` **clears** the field, so "absent = full size"
 * holds and the JSON stays clean (the `setStaffSpacing` idiom).
 *
 * Refuses a size that is not a finite positive number, and an unknown staff id — returns `false`
 * without touching the score, so a caller cannot half-write a staff that will divide by zero at
 * draw time. @returns whether the score changed.
 */
export function setStaffSize(score: Score, staffId: string, size: number): boolean {
  if (!isValidStaffSize(size)) return false
  const staff = getStaves(score).find(s => s.id === staffId)
  if (!staff) return false

  const next = size === DEFAULT_STAFF_SIZE ? undefined : size
  if (staff.size === next) return false
  if (next === undefined) delete staff.size
  else staff.size = next
  return true
}

/** A drawn size has to be a finite positive ratio — 0 is not a staff and NaN divides everything
 *  downstream. The one predicate both the mutator and the load boundary ask. */
export function isValidStaffSize(size: number): boolean {
  return Number.isFinite(size) && size > 0
}
