/**
 * ⭐ **THE `house` SLUR SOLVER — today's shape, as one row of `./slurSolvers`** (docs/plans/slur-search-plan.md
 * §3, P1). Moved here unchanged from `SlurRenderer`: the arch law (`./slurArchHeight`), its lean, and
 * `./slurObstacles.slurArchFit`'s ONE factor over the whole arch. ⛔ No pixel moved in the move —
 * `e2e/slurSearch.e2e.ts` pins it.
 *
 * ⚠️ It never moves the ends it is given: the endpoint rules (`./slurStemEndpoint`, the tilt, the slant
 * ceiling, the articulation lift) have already run in `SlurRenderer`, and are this preset's.
 */
import { archLean, slurArchHeightFor } from './slurArchHeight'
import { slurIndentFraction } from './slurShapeExperiment'
import { slurArchFit } from './slurObstacles'
import type { SlurSolveInput, SlurSolution } from './slurSolvers'

/**
 * Compute the cubic `cps` (control-point deltas for `engrave/curves/curveInk`) that bow the
 * arc by `SLUR_BOW` **vertically above the line between its endpoints** — the two control
 * points stay horizontally centered (no sideways shift) and lift straight up, *following*
 * the chord's slope. This is the engraving default (MuseScore: "slight contour asymmetry,
 * avoid forced tilt"):
 *  - flat / unison → symmetric `[{0,BOW},{0,BOW}]` (perfectly even);
 *  - small interval / close notes → full height, gentle lean, no sideways skew;
 *  - wide leap → clean arch parallel to the contour, no hook and no lopsided air-gap.
 *
 * An earlier *perpendicular* offset shifted the control points sideways by `∝ dy/len`,
 * which blew up for closely-spaced steps (seconds went flat-and-skewed) — hence the
 * vertical-above-chord-line formula here.
 *
 * `curveControlPoints` places each control point at `(endpointX ± dx/4, endpointY + cp.y·dir)`;
 * we target the chord line at 25%/75% lifted by `BOW`, then invert to recover the deltas.
 */
export function slurArchCps(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  direction: number,
  extraHeight = 0,
  /** ⭐ How much taller the obstacles under it make the whole arch — `./slurObstacles.slurArchFit`. */
  fit = 1,
): [{ x: number; y: number }, { x: number; y: number }] {
  const dy = p1.y - p0.y
  // HOW TALL is `./slurArchHeight` — a law, not a constant, and the one number in the family with no
  // published source (docs/plans/slur-plan.md §12 Phase 2). `extraHeight` lifts an outer slur clear of the
  // slur(s) nested inside it (Phase 8).
  //
  // ⏭️ A short, steeply tilted slur should be rounder than this law asks (Verovio's minimum control
  // angle) — measured, costed and NOT built: see the tail of `./slurSlantLimit` for why it is a
  // shape decision rather than an import.
  const H = slurArchHeightFor(p0, p1, extraHeight)
  // ⭐ The two obstacle lifts are per-CONTROL (`./slurObstacles`) — the whole point of solving them
  // separately is that they may differ, so they are added here rather than folded into `H`.
  // ⭐⭐ …and the LEAN is bounded by the arch it leans (`./slurArchHeight.archLean`, his report of
  // 2026-08-31: unbounded, it put one control through the chord line and drew a bent stick).
  const lean = archLean(dy, direction, H)
  // ⚠️ EXPERIMENT, HIS (2026-08-31): the INDENT — how far in from each end the controls sit — is
  //    VexFlow's own `span/4` unless the console says otherwise (`./slurShapeExperiment`; both
  //    engines vary it with length and we never have). `cps.x` is an ADDITIVE delta on top of that
  //    `span/4` in `curveControlPoints`, the one owner of both, so the difference is what goes
  //    in — and 0.25 puts a 0 there, which is what shipped.
  const indent = (slurIndentFraction() - 0.25) * (p1.x - p0.x)
  // ⭐⭐ **THE OBSTACLE FACTOR SCALES BOTH CONTROLS BY THE SAME NUMBER** — LilyPond's, and the
  //    property is the point: multiplying a pair by one scalar cannot change their RATIO, so the
  //    arch keeps its shape and only its size answers the music under it (`./slurObstacles`).
  //    ⛔ Never two separate lifts — that is what bent his slur (`docs/research/slur-tie-research.md` §8.1).
  return [
    { x: indent, y: (H + lean) * fit },
    // ⚠️ `0 - indent`, ⛔ not `-indent`: the default puts a NEGATIVE ZERO there, and `toEqual`
    //    tells the two apart — a spec failing on the sign of nothing.
    { x: 0 - indent, y: (H - lean) * fit },
  ]
}

/** The `house` row: the ends as given, the arch raised by one factor over what it covers. */
export function solveHouseSlur(input: SlurSolveInput): SlurSolution {
  const { p0, p1, direction, nestLift } = input
  // ⭐⭐ ONE FACTOR over the whole arch (`./slurObstacles`), ⛔ never two control lifts.
  const archH = slurArchHeightFor(p0, p1, nestLift)
  const archLeanPx = archLean(p1.y - p0.y, direction, archH)
  const fit = slurArchFit(p0, p1, archH + archLeanPx, archH - archLeanPx, direction, input.obstacles())
  return { p0, p1, cps: slurArchCps(p0, p1, direction, nestLift, fit) }
}
