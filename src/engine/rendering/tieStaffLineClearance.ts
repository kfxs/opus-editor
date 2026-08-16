/**
 * ⭐⭐ **A TIE MUST NOT SIT ON A STAFF LINE** (docs/slur-plan.md §12 Phase 3, §13.4).
 *
 * > Gould p. 61: *"The curve of the tie should be sufficiently round to be **conspicuous through a
 * > stave-line**."*
 *
 * ⭐ **The fault is not a tie CROSSING a line — it is a line running ALONGSIDE its arc**, a tenth of
 * a space away for the tie's whole flat middle, where the reader cannot tell curve from stave. Our
 * tie's shape is a constant (0.70 sp of lift, a 0.40 sp apex), so the case is decided entirely by
 * whether the notehead sits on a line: **on a line** puts the next line 0.10 sp from the arc, every
 * time; **in a space** leaves it 0.65 sp clear.
 *
 * ⭐⭐ **THE REPAIR IS TO MAKE THE ARC ROUNDER, AND HIS EYE IS WHY.** This phase first TRANSLATED
 * the whole tie outward — LilyPond's repair for a shallow tie, `tip-staff-line-clearance` 0.225 sp
 * (`tie-formatting-problem.cc:535`). He looked at a tied G4 and asked *"isn't the edge of the tie
 * too low?"* It was: moving the tie moves its TIPS off the noteheads, from 0.20 sp clear of the head
 * edge to 0.42, and that 0.20 is Gould's *"should almost touch each notehead"* (§13.3, confirmed
 * against MuseScore). Two settled things collided and the translation spent the one Gould states
 * outright.
 *
 * **So it is MuseScore's repair** (`SlurTieLayout::adjustY`, `slurtielayout.cpp:2392–2490`): the
 * ends stay where they are and the ARC grows until the line is clear of it. Read back, that is
 * precisely what Gould's sentence asks for — *sufficiently round to be conspicuous through a
 * stave-line*. A line-note tie's apex goes 0.40 → 0.60 sp; a space-note tie is untouched.
 *
 * **Three sources, three roles:** MuseScore's `badArcIntersectionLimit` **0.15 sp** says WHEN,
 * LilyPond's `center-staff-line-clearance` **0.3 sp** says HOW FAR, MuseScore's `maxArcCorrection`
 * **0.75 × height** caps it, and Gould says WHAT TO CHANGE.
 *
 * ⛔ **This does not re-open the tie's default HEIGHT** (§13.1, his call): 0.40 sp stays the number
 * everywhere. This is a local repair at one collision, which is what all three engines do —
 * LilyPond by scoring `staff-line-collision-penalty` 5 over candidate positions, MuseScore by this,
 * Verovio not at all.
 *
 * ⚠️ **The armed tool's GHOST is exempt**: it floats at the cursor with no stave under it, so there
 * are no lines to clear and nothing to call this with (docs/slur-plan.md §12.0 #2).
 */
import { CURVE, CURVE_PX } from './curveStyle'

/** The drawn tie, as the numbers this rule needs. All px, y growing DOWN. */
export interface TieInk {
  /** y of both endpoints — a tie is flat, so they share one. */
  endpointY: number
  /** The drawn apex's rise from the endpoint line (0.75 × the control bow), unsigned. */
  apexRise: number
  /** Ink thickness at the apex: the fill's swell plus the outline. */
  inkThickness: number
  /** −1 above / +1 below. */
  direction: number
  /** Every staff line's y, in the same space as `endpointY`. */
  lineYs: readonly number[]
}

/** The staff line nearest `y`, or undefined if the staff has none (defensive). */
function nearestLine(y: number, lineYs: readonly number[]): number | undefined {
  let best: number | undefined
  for (const line of lineYs) {
    if (best === undefined || Math.abs(line - y) < Math.abs(best - y)) best = line
  }
  return best
}

/**
 * How much ROUNDER the arc must be so no staff line runs alongside it — `0` when it is already
 * clear, which is what a notehead in a space gives.
 *
 * ⭐ **The test is the arc's INNER edge**, the one facing the notehead: a line just inside it runs
 * parallel to the tie's flat middle for the tie's whole length. A line on the arc's FAR side is left
 * alone — growing the arc would drive it into that line, and shrinking is MuseScore's other branch
 * (⏭️ unbuilt: on our geometry the far-side gap measures 0.15 sp, exactly at the threshold and never
 * under it).
 */
export function tieArcGrowth(ink: TieInk): number {
  if (ink.lineYs.length === 0) return 0

  // ⚠️ The fill swells AWAY from the notehead — the return pass of `renderCurve`'s closed lens is
  // the FAR edge — so the arc itself is the near edge and the ink extends beyond it. Measured off a
  // real path, not assumed: getting this backwards is what let an earlier version of this rule pass
  // its own break-test.
  const near = ink.endpointY + ink.direction * ink.apexRise
  const far = near + ink.direction * ink.inkThickness
  const line = nearestLine((near + far) / 2, ink.lineYs)
  if (line === undefined) return 0

  // Positive when the line lies on the notehead's side of the arc — the parallel case.
  const gapInside = (line - near) * -ink.direction
  if (gapInside < 0 || gapInside >= CURVE_PX.tieLineClearance) return 0

  // Grow the apex until the line has LilyPond's daylight, and no further than MuseScore's cap.
  const wanted = CURVE_PX.tieLineApexClearance - gapInside
  return Math.min(wanted, CURVE.tieLineMaxGrowth * ink.apexRise)
}
