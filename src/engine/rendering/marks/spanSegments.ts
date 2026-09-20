/**
 * ⭐ **WHAT PIECES A SPAN BREAKS INTO AT THE SYSTEM BREAKS** — a fact about SYSTEMS, which is why it
 * left `SlurRenderer` (docs/plans/code-shape-plan-2026-09-19.md, Phase 5): the hairpin, the ottava, the
 * pedal and the trill all asked it, and each said in a comment that its name was the only thing
 * about it that said "slur".
 *
 * Two layers. {@link planSpanSegments} is the decision the slur draws from directly (its halves are
 * curves, anchored to notes and margins). {@link cutSpanAtSystems} is what the four LINE families
 * each spelled on top of it: the same segments as plain x-ranges on a line.
 */
import { lineLeftEdgeX, lineRightEdgeX, type SystemEdgeLookup } from '../systemEdges'

/**
 * One drawn piece of a span. A same-line span is a single `single`; one crossing
 * N systems is `begin` + (N−2)×`middle` + `end`, each anchored to the **system**
 * edges (not the endpoint notes' own measures — that measure-vs-system confusion was
 * the original bug). `firstX`/`lastX` are the note tie-edge Xs; `leftX`/`rightX` are
 * the system margins from the helpers above.
 */
export type SpanSegment =
  | { type: 'single' }
  | { type: 'begin'; firstX: number; rightX: number }
  | { type: 'middle'; leftX: number; rightX: number; line: number }
  | { type: 'end'; leftX: number; lastX: number }

/**
 * Pure decision: given the start/end lines and the two note tie-edge Xs, return the
 * ordered segments to draw. No VexFlow / ctx / StaveNote — the heart of the
 * multi-system fix, so it's unit-testable in isolation. A line whose system edge
 * can't be resolved is skipped (defensive; shouldn't happen for a rendered line).
 */
export function planSpanSegments(
  pass: SystemEdgeLookup,
  fromLine: number,
  toLine: number,
  firstX: number,
  lastX: number,
  /**
   * ⚠️ **How big the slur's staff is drawn** (1 = full size), and it is not optional in spirit.
   *
   * `firstX`/`lastX` come off the notes, so they are in the staff's OWN space — but a system edge
   * comes from `measureBounds`, which is where the bar landed in the SVG. Mixing the two was a real
   * defect for exactly one shape of music: a slur crossing a system break on a staff drawn small
   * stopped at `edge × k` instead of the edge, i.e. 30% short of the margin. Everything here is
   * handed to the drawing, which happens inside the staff's scale group, so the edges are converted
   * INTO that space here — the one place both kinds of number meet.
   */
  scale: number,
  /**
   * ⭐ **Which left boundary this family resumes at** — the one thing a CURVE and a LINE disagree
   * about at a system start, so it is the caller's to say and everything else here is shared.
   *
   * A slur or tie resumes after the header's INK ({@link lineLeftCurveX}, Gould p. 112 / p. 65). The
   * bracket families — ottava, pedal, trill, hairpin — keep the default, the MUSIC's own margin: each
   * already shifts its resumed label left of it by its own eye-tuned inset, and a boundary that moved
   * under them would move the labels onto the clef.
   */
  leftEdgeX: (pass: SystemEdgeLookup, line: number) => number | undefined = lineLeftEdgeX,
): SpanSegment[] {
  if (fromLine === toLine) return [{ type: 'single' }]
  const toLocal = (x: number | undefined): number | undefined => (x === undefined ? undefined : x / scale)
  const segments: SpanSegment[] = []
  for (let line = fromLine; line <= toLine; line++) {
    if (line === fromLine) {
      const rightX = toLocal(lineRightEdgeX(pass, line))
      if (rightX !== undefined) segments.push({ type: 'begin', firstX, rightX })
    } else if (line === toLine) {
      // ⭐⭐ **AFTER the clef, key and meter** — Gould p. 112, verbatim: *"At the beginning of the new
      // system, the slur starts after the clef, key signature and time signature, but before any
      // accidental."* Gerou & Lusk say the same independently, and all three engines land there
      // (⚠️ including Verovio, whose `GetLeftBarLineXRel` is AFTER the header — its alignment enum
      // orders the score-def clef before the left barline, which I misread as "before the clef" and
      // briefly copied). ⚠️ Which x that IS is `leftEdgeX`'s to say: `noteStartX` is the padded
      // boundary and measured equal to the first notehead, so a curve passes `lineLeftCurveX`.
      const leftX = toLocal(leftEdgeX(pass, line))
      if (leftX !== undefined) segments.push({ type: 'end', leftX, lastX })
    } else {
      const leftX = toLocal(leftEdgeX(pass, line))
      const rightX = toLocal(lineRightEdgeX(pass, line))
      if (leftX !== undefined && rightX !== undefined) segments.push({ type: 'middle', leftX, rightX, line })
    }
  }
  return segments
}

/** One piece of a LINE-shaped span: its x range, the system it is on, and which piece it is. */
export interface SpanRange {
  x0: number
  x1: number
  line: number
  /** `single` and `begin` carry the span's real START; `single` and `end` its real END. */
  type: SpanSegment['type']
}

/**
 * Cut a line-shaped span into the ranges the systems make.
 *
 * ⚠️ Only a MIDDLE segment carries its line — the other three are implied by which end they are,
 * which is why the mapping is spelled out rather than read off the segment.
 *
 * ⚠️ **`keepHairWide` is the PEDAL's, and it is a real difference, ⛔ not a slip to tidy**: every
 * other family drops a fragment of no width (`x1 <= x0`), but a pedal's FINAL fragment may
 * legitimately be a hair wide — a lift just inside a new system's first bar — and dropping it would
 * leave a pedal whose release is never drawn. So it drops only a fragment that runs BACKWARDS.
 */
export function cutSpanAtSystems(
  pass: SystemEdgeLookup,
  fromLine: number,
  toLine: number,
  startX: number,
  endX: number,
  scale: number,
  { keepHairWide = false }: { keepHairWide?: boolean } = {},
): SpanRange[] {
  const ranges: SpanRange[] = []
  for (const seg of planSpanSegments(pass, fromLine, toLine, startX, endX, scale)) {
    const range = seg.type === 'single' ? { x0: startX, x1: endX, line: fromLine }
      : seg.type === 'begin' ? { x0: seg.firstX, x1: seg.rightX, line: fromLine }
        : seg.type === 'middle' ? { x0: seg.leftX, x1: seg.rightX, line: seg.line }
          : { x0: seg.leftX, x1: seg.lastX, line: toLine }
    if (keepHairWide ? range.x1 < range.x0 : range.x1 <= range.x0) continue
    ranges.push({ ...range, type: seg.type })
  }
  return ranges
}
