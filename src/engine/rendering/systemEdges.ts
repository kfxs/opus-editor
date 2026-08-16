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

/**
 * ⭐⭐ **X of a system's LEFT BARLINE** — where an OPEN-ENDED span begins on a system it continues
 * into, as opposed to {@link lineLeftEdgeX}, which is where the NOTES begin.
 *
 * 🚨 **The difference is the clef, the key and the meter, and it is the whole fragment.** A slur
 * whose end note is the FIRST note of a system had `leftX` and the note's own x almost coincide, so
 * the continuation drew **0.6 staff spaces wide with a full space of drop** — a comma, not a slur
 * (his report, 2026-08-16). Verovio starts it at `measure->GetDrawingX() +
 * measure->GetLeftBarLineXRel()` (`view_control.cpp:259`), i.e. here.
 *
 * ⭐ The same lesson the TRILL and the OTTAVA learned about their continuation labels: a mark that
 * RESUMES belongs at the margin, where a reader looks before the first note, not where the notes
 * start (`trillStyle.TRILL_CONTINUATION_INSET`). This is that rule for a curve.
 *
 * ⚠️⚠️ **NO BOOK SAYS THIS, and the engines disagree — his question, 2026-08-16.** Gould p. 112 is
 * about the ANGLE of an open-ended slur (*"angled in the direction of the final pitch … so as to
 * look clearly open-ended"*) and p. 65 about the open-ended TIE's shape; neither says where a
 * continuation begins. §2.2 of docs/slur-plan.md says *"the second begins at the left of the next
 * system"*, but that is our own 2026-06 paraphrase of "the convention", and *the left* is exactly
 * the ambiguity. ⛔ So this is **Verovio's choice, adopted** — not an engraving rule:
 *
 * - **Verovio**: the system's left BARLINE (what this does).
 * - **MuseScore**: the first note/rest SEGMENT — i.e. what we did before — but it then flattens the
 *   open end (`constrainLeftAnchor`, 0.25 sp) and finally forces a **1.0 sp** minimum height
 *   difference (`adjustSlurFloatingEndPointAngles`). Short, but not a comma.
 * - **LilyPond**: switches its melodic slope rules off for a broken half entirely.
 *
 * ⭐ Two of the three DO agree on the height floor: MuseScore's 1.0 sp is the same number as
 * `CURVE.brokenSlurMinRise`, which came from Verovio. The x is where they part.
 */
export function lineLeftMarginX(pass: SystemEdgeLookup, line: number): number | undefined {
  let firstMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (firstMeasure === undefined || num < firstMeasure) firstMeasure = num
  }
  return firstMeasure === undefined ? undefined : pass.measureBounds.get(firstMeasure)?.measureX
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
