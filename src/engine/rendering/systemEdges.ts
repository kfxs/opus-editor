/**
 * **Where a SYSTEM begins and ends, in pixels** — the left and right margins of the music on one
 * line, read back off the last render.
 *
 * ⭐ **A system is not a measure**, and that confusion was a real bug: a span crossing a line break
 * used to be anchored to its endpoint notes' own measures, which hid the arc on any non-boundary
 * measure and dropped middle systems entirely (docs/slur-plan.md §8). These two helpers answer for
 * the SYSTEM: the first measure that landed on the line gives its left margin, the last its right.
 *
 * Extracted from `SlurRenderer` when the TIE's cross-system halves migrated off VexFlow's
 * `StaveTie` and needed the same two numbers (§12 Phase 3b) — ⛔ `TieRenderer` must not import
 * `SlurRenderer`, and a shared answer belongs to neither of them.
 */
import type { RenderPass } from './RenderPass'

/** The post-render lookup data the system-edge helpers + segment planner need. A
 *  narrow slice of {@link RenderPass} so they stay pure & trivially unit-testable. */
export type SystemEdgeLookup = Pick<RenderPass, 'measureLayoutInfo' | 'measureBounds'>

/** X of a system's LEFT margin = the `noteStartX` of the **first** measure that
 *  landed on `line`. Undefined if no measure (or no bounds) on that line. */
export function lineLeftEdgeX(pass: SystemEdgeLookup, line: number): number | undefined {
  let firstMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (firstMeasure === undefined || num < firstMeasure) firstMeasure = num
  }
  return firstMeasure === undefined ? undefined : pass.measureBounds.get(firstMeasure)?.noteStartX
}

/** X of a system's RIGHT margin = the `noteEndX` of the **last** measure that
 *  landed on `line`. Undefined if no measure (or no bounds) on that line. */
export function lineRightEdgeX(pass: SystemEdgeLookup, line: number): number | undefined {
  let lastMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (lastMeasure === undefined || num > lastMeasure) lastMeasure = num
  }
  return lastMeasure === undefined ? undefined : pass.measureBounds.get(lastMeasure)?.noteEndX
}
