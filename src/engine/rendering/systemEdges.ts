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
import { HEADER_TO_NOTE } from '@/engine/layout/headerInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { CURVE } from './curveStyle'
import type { RenderPass } from './RenderPass'

/** The post-render lookup data the system-edge helpers + segment planner need. A
 *  narrow slice of {@link RenderPass} so they stay pure & trivially unit-testable. */
export type SystemEdgeLookup = Pick<RenderPass, 'measureLayoutInfo' | 'measureBounds'>

/**
 * X of a system's LEFT margin = the `noteStartX` of the **first** measure that landed on `line` —
 * i.e. **after the clef, key signature and time signature**. Undefined if no measure (or no bounds)
 * on that line.
 *
 * ⭐⭐ **That boundary is where an open-ended span BEGINS, and it is published** — Gould p. 112 for
 * the slur (*"the slur starts after the clef, key signature and time signature, but before any
 * accidental"*) and p. 65 for the tie, with Gerou & Lusk agreeing independently. All three engines
 * land here too: LilyPond by uniting the extents of grobs marked `avoid-slur 'inside`
 * (`define-grobs.scm` gives Clef, KeySignature, TimeSignature and Accidental that property),
 * MuseScore via `firstNoteRestSegmentX`, and ⚠️ **Verovio too** — its `GetLeftBarLineXRel` sounds
 * like the barline but its alignment enum puts the score-def clef BEFORE the left barline, so that x
 * is already past the header. ⛔ A version of this file briefly took the bar's own `measureX`,
 * believing it was Verovio's rule; it drew the arc through the clef.
 */
export function lineLeftEdgeX(pass: SystemEdgeLookup, line: number): number | undefined {
  let firstMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (firstMeasure === undefined || num < firstMeasure) firstMeasure = num
  }
  return firstMeasure === undefined ? undefined : pass.measureBounds.get(firstMeasure)?.noteStartX
}

/**
 * ⭐⭐ **X where an open-ended CURVE begins on `line`** — a slur's or tie's continuation, which starts
 * after the header's **INK** rather than at the padded boundary the music starts at.
 *
 * ⚠️ **The two are not the same number, and believing they were is what this fixes.**
 * {@link lineLeftEdgeX} is `noteStartX`, and his figure measured it *equal to the first notehead's
 * own x* — so the fragment had no length to be drawn at (0.6 sp, *"almost over the note"*,
 * 2026-08-16). Gould's *"after the clef"* means after the GLYPH: `docs/slur-plan.md` §12 Phase 5, and
 * `CURVE.curveFromHeader` carries the three engines' agreement on how far past it to start.
 *
 * ⭐ **The header's ink edge is already published, and needs no glyph measuring**:
 * `applyLeadIn` sets `noteStartX = staveX + (HEADER_TO_NOTE + headerExtent) × STAFF_SPACE_PX`
 * (`VexFlowRenderer.ts`), and a line-opening bar always draws a clef, so its lead-in is always
 * `HEADER_TO_NOTE`. Subtracting it lands exactly on `headerInk.ts`'s measured extent — the same
 * number two ways, which is the promise that file makes about every measurement in it.
 *
 * ⚠️ **A page distance, so no `scale` here.** Both terms are already in SVG px and neither is divided
 * by the staff's ratio: the header is laid out in the SYSTEM's space so a small staff's clef sits in
 * the same header column (`spreadHeaderToSystem`). The caller converts into a staff's own space, once.
 *
 * ⛔ **The LINE families keep {@link lineLeftEdgeX}.** A resumed `(8va)` / `(Ped.)` / `(tr)` is a
 * REMINDER that already shifts 2.0 spaces left of the music to sit in the clef's own column — which
 * is this very boundary — so moving their edge too would push them onto the clef's ink.
 */
export function lineLeftCurveX(pass: SystemEdgeLookup, line: number): number | undefined {
  const musicX = lineLeftEdgeX(pass, line)
  if (musicX === undefined) return undefined
  const headerInkX = musicX - HEADER_TO_NOTE * STAFF_SPACE_PX
  // MuseScore's own clamp, verbatim in shape (`Measure::firstNoteRestSegmentX`): the margin may
  // never carry the curve past the note it is running to, however the two numbers are tuned.
  return Math.min(headerInkX + CURVE.curveFromHeader * STAFF_SPACE_PX, musicX)
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
