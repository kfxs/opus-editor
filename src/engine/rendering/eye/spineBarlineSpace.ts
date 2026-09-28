/**
 * ⭐ **A BARLINE'S SPACE ON THE SPINE** — room reserved between a bar's LAST note and its barline, along the
 * path (`docs/plans/bent-staff-plan.md` §9.3g; his ask 2026-09-28: *"when i mark a barline i want also be able
 * to change the space between the last note of the measure and the barline"*). ⛔ Only the spine; the page keeps
 * its own (`engravingOverrides.barlineSpaceKey`, the twin).
 *
 * The barline is the bar's LAST column (`layout/measureColumns` — *"the barline is a column"*), so this is a
 * note's space (`./spineColumnSpace`) asked of that column: + into its reserved gap, − out of the last note's
 * spring, ⛔ never into the ink (the solve's floor holds). It MOVES the barline, and the bars after it. In staff
 * spaces, signed; keyed by the bar's id — the bar the barline ENDS, as its stretch is.
 *
 * ⚠️ **Kept for the SESSION only**, held by the panel (plan §9.3 C — undecided). ⛔ No DOM.
 */
import type { Column } from '@/engine/layout/spacing'
import type { Measure } from '@/types/music'
import { withSpaceBefore } from './spineColumnSpace'

/** Measure id → staff spaces before that bar's barline. A bar with no row has none. */
export type SpineBarlineSpaces = ReadonlyMap<string, number>

/** The bar's columns with its barline's space reserved before the barline column. */
export function withBarlineSpace(measure: Measure, columns: Column[], spaces: SpineBarlineSpaces | undefined): Column[] {
  const space = spaces?.get(measure.id) ?? 0
  return withSpaceBefore(columns, columns.length - 1, space)
}
