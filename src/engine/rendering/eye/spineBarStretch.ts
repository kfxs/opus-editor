/**
 * ⭐ **A BAR'S STRETCH ON THE SPINE** — how much of the room it asks for a bar takes along the path
 * (`docs/plans/bent-staff-plan.md` §9, his ask 2026-09-28: select a barline in the spine panel and make
 * the bar it ENDS wider or narrower there, ⛔ never on the page).
 *
 * The spine's twin of the page's bar stretch (`types/engravingOverrides` `barWidth`): a RATIO of what the
 * bar's music asks for — ×1 is as engraved, ×1.5 half as much room again — so the same value means the same
 * thing on any radius. Only the MUSIC's room is scaled (`eye/spineSpacing`'s `natural`); the lead-in — a
 * barline's clearance, a header — is rigid, as on the page. Inside the bar the page's springs share it.
 *
 * On a justified spine (a circle) growth is a TRANSFER: the bars share a fixed length in proportion to
 * what they ask, so a stretched bar takes its extra from the others. The console's `radius: 'auto'` sizes
 * the circle from what the stretched music asks (`naturalSpineLength`), so there the circle grows instead.
 *
 * ⚠️ **Kept for the SESSION only** — keyed by measure id, held by the panel; ⛔ not in the score JSON (his
 * word: where spine adjustments are stored is not decided — plan §9.3 C).
 *
 * ⛔ No DOM.
 */
import type { Score } from '@/types/music'

/** Measure id → stretch. A bar with no row is ×1. */
export type SpineBarStretches = ReadonlyMap<string, number>

/** What one click of the box's arrows adds. A changeable default. */
export const SPINE_STRETCH_STEP = 0.1
/** The widest the Spine Properties box offers. A changeable default. */
export const SPINE_STRETCH_MAX = 10
/** The narrowest a bar may be asked to be — below it the page's springs are at the ink's floor anyway. A changeable default. */
export const SPINE_STRETCH_MIN = 0.1

/** The stretch of the bar with this id — ×1 when none was set. */
export function spineStretchOf(stretches: SpineBarStretches | undefined, measureId: string): number {
  return stretches?.get(measureId) ?? 1
}

/** ⛔ A value that is not a finite number is refused (`null`); anything else is kept at or above {@link SPINE_STRETCH_MIN}. */
export function clampSpineStretch(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.max(SPINE_STRETCH_MIN, Math.round(value * 1000) / 1000)
}

/** The id of the bar numbered `measure` — what a selected barline (the bar it ENDS) is keyed by here. */
export function measureIdOfNumber(score: Score, measure: number): string | undefined {
  return score.measures.find(m => m.number === measure)?.id
}
