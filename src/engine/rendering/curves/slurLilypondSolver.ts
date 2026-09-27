/**
 * ⭐ **THE `lilypond` SLUR SOLVER — LilyPond's search, as one row of `./slurSolvers`**
 * (docs/plans/slur-search-plan.md §3, P3). The slur is stated as LilyPond's problem (`./slurSearchProblem`),
 * searched (`engrave/curves/slurSearch`), and the winning curve handed back as ours: its two ends and the
 * control-point deltas `engrave/curves/curveInk.curveControlPoints` draws from.
 *
 * ⭐ **The search picks the ENDS too.** Under this preset `house`'s endpoint rules — the stem endpoint, the
 * melodic tilt, the slant ceiling, the lift over an end's own mark, the nest lift — do not run: LilyPond's
 * candidates and demerits are its answer to all of them. The ends it is GIVEN are ignored; the hand's
 * offsets still land on top, in `SlurRenderer`.
 *
 * ⚠️ When the slur cannot be stated (a fanned member at an end, a note that did not draw), it is `house`'s —
 * never nothing.
 */
import { searchSlur } from '@/engine/engrave/curves/slurSearch/slurSearch'
import { fromSearch } from './slurSearchProblem'
import { solveHouseSlur } from './slurHouseSolver'
import type { SlurSolveInput, SlurSolution } from './slurSolvers'

export function solveLilypondSlur(input: SlurSolveInput): SlurSolution {
  const problem = input.searchProblem()
  const found = problem ? searchSlur(problem.input) : null
  if (!problem || !found) return solveHouseSlur(input)
  const [p0, c0, c1, p1] = found.curve.map(p => fromSearch(problem.frame, p))
  // The inverse of `curveControlPoints`: a control is its end, a quarter of the span in, plus the delta;
  // its y is `end + delta · direction`.
  const quarter = (p1.x - p0.x) / 4
  const d = input.direction
  return {
    p0, p1,
    cps: [
      { x: c0.x - p0.x - quarter, y: (c0.y - p0.y) * d },
      { x: c1.x - p1.x + quarter, y: (c1.y - p1.y) * d },
    ],
  }
}
