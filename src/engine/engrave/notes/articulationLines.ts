/**
 * The staff-line arithmetic an articulation's two rules share — `articulation.js`'s module helpers
 * (MIT, transcribed): whether a line is inside the staff on a side, and how a line rounds to a half.
 * Shared by the stacking rule (`./articulationStack`, S9e) and the placement (`./articulationPlacement`,
 * S12f), which VexFlow wrote against the same three functions.
 */

/** Which side of its note a mark stands on. */
export type ArticulationSideOf = 'above' | 'below'

/** `roundToNearestHalf`: `fn` applied in half spaces. */
export const roundToNearestHalf = (fn: (x: number) => number, value: number): number => fn(value / 0.5) * 0.5

/** Inside the staff: at or below line 5 above it, at or above line 1 below it. */
export const isWithinLines = (line: number, side: ArticulationSideOf): boolean =>
  side === 'above' ? line <= 5 : line >= 1

/** `getRoundingFunction`: toward the outside while inside the staff, to the nearest outside it. */
export const roundingFor = (line: number, side: ArticulationSideOf): ((x: number) => number) =>
  isWithinLines(line, side) ? (side === 'above' ? Math.ceil : Math.floor) : Math.round
