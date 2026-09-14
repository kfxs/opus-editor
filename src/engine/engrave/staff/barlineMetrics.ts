/**
 * ⭐ **HOW MUCH ROOM EACH KIND OF BARLINE TAKES IN A BAR'S SIGN WALK** — S4b1 of
 * `docs/vexflow-removal-map.md`.
 *
 * These are the numbers VexFlow's `Barline` constructor sets (`stavebarline.js:35–90`), copied exactly
 * and attributed: a width, a padding, and the layout metrics the closing walk reads. ⛔ They are ROOM,
 * not ink — a barline's ink is `./openingBarline` and `rendering/BarlineRenderer`.
 *
 * ⚠️ **One of them is visible on the page.** Every kind is 5 px wide, and a mid-line clef change is
 * walked in straight after the opening barline — so it stands 5 px (0.5 sp) right of the boundary.
 * That is the "0.5 sp nobody chose" of `rendering/headerPlacementPass`: the CLEF REVIEW's question,
 * kept here at today's value (rule 13).
 */

/** Which barline a sign is. */
export type BarlineKind = 'single' | 'double' | 'end' | 'repeatBegin' | 'repeatEnd' | 'repeatBoth' | 'none'

/** The closing walk's view of a barline: how far its box reaches either side of its x, and the air around it. */
export interface BarlineLayoutMetrics {
  readonly xMin: number
  readonly xMax: number
  readonly paddingLeft: number
  readonly paddingRight: number
}

/** One kind of barline's room. */
export interface BarlineRow {
  /** Its walk width, in px. */
  readonly width: number
  /** What `getPadding` answers for it from the third sign on, in px. */
  readonly padding: number
  readonly layout: BarlineLayoutMetrics
}

const AIR = { paddingLeft: 5, paddingRight: 5 }

/** Every kind's room — `Barline`'s `widths`, `paddings` and `layoutMetricsMap`. */
export const BARLINE_ROWS: Record<BarlineKind, BarlineRow> = {
  single: { width: 5, padding: 0, layout: { xMin: 0, xMax: 1, ...AIR } },
  double: { width: 5, padding: 0, layout: { xMin: -3, xMax: 1, ...AIR } },
  end: { width: 5, padding: 0, layout: { xMin: -5, xMax: 1, ...AIR } },
  repeatBegin: { width: 5, padding: 15, layout: { xMin: -2, xMax: 10, ...AIR } },
  repeatEnd: { width: 5, padding: 15, layout: { xMin: -10, xMax: 1, ...AIR } },
  repeatBoth: { width: 5, padding: 15, layout: { xMin: -10, xMax: 10, ...AIR } },
  none: { width: 5, padding: 0, layout: { xMin: 0, xMax: 0, ...AIR } },
}
