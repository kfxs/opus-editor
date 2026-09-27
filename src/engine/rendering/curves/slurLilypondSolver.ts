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
 *
 * ⏱ **A cache, keyed by the whole problem** (plan P4: over ~0.5 ms a slur ⇒ cache before going further).
 * Most renders redraw slurs whose notes did not move — a selection, a hover — and the search is a pure
 * function of its input, so the same input answers from here. ⚠️ The key is the ENTIRE stated problem
 * and the details table: anything the search reads is in it, so a stale answer cannot be served.
 */
import { searchSlur, type SlurSearchResult } from '@/engine/engrave/curves/slurSearch/slurSearch'
import { LILYPOND_SLUR_DETAILS } from '@/engine/engrave/curves/slurSearch/searchDetails'
import type { SlurSearchInput } from '@/engine/engrave/curves/slurSearch/searchState'
import { fromSearch } from './slurSearchProblem'
import { solveHouseSlur, solveHouseSlurPiece } from './slurHouseSolver'
import type { SlurPieceInput, SlurSolveInput, SlurSolution } from './slurSolvers'
import type { SlurSearchProblem } from './slurSearchProblem'

/** How many answers are kept — a page's slurs several times over; past it the cache starts again. */
const CACHE_LIMIT = 512
const answers = new Map<string, SlurSearchResult | null>()

/** {@link searchSlur}, answered from the cache when the very same problem was searched before. */
export function cachedSlurSearch(input: SlurSearchInput): SlurSearchResult | null {
  const key = JSON.stringify(input) + JSON.stringify(LILYPOND_SLUR_DETAILS)
  if (answers.has(key)) return answers.get(key)!
  const found = searchSlur(input)
  if (answers.size >= CACHE_LIMIT) answers.clear()
  answers.set(key, found)
  return found
}

export function solveLilypondSlur(input: SlurSolveInput): SlurSolution {
  const problem = input.searchProblem()
  const found = problem ? cachedSlurSearch(problem.input) : null
  if (!problem || !found) return solveHouseSlur(input)
  return asOurs(problem, found, input.direction)
}

/**
 * ⭐ The row for one system's PIECE of a broken slur (P6): the piece searched with its line-break ends, and
 * the HAND's moves of each end (`hands` — a true end's offset, an open end's nudge) added to the ends the
 * search chose. The control deltas ride with their ends, so a moved end carries its side of the arch.
 */
export function solveLilypondSlurPiece(input: SlurPieceInput): SlurSolution {
  const problem = input.searchProblem()
  const found = problem ? cachedSlurSearch(problem.input) : null
  if (!problem || !found) return solveHouseSlurPiece(input)
  const solved = asOurs(problem, found, input.direction)
  const [h0, h1] = input.hands
  return {
    p0: { x: solved.p0.x + h0.x, y: solved.p0.y + h0.y },
    p1: { x: solved.p1.x + h1.x, y: solved.p1.y + h1.y },
    cps: solved.cps,
  }
}

/** The search's winning cubic, as our ends and the control deltas `curveControlPoints` draws from. */
function asOurs(problem: SlurSearchProblem, found: SlurSearchResult, direction: number): SlurSolution {
  const [p0, c0, c1, p1] = found.curve.map(p => fromSearch(problem.frame, p))
  // The inverse of `curveControlPoints`: a control is its end, a quarter of the span in, plus the delta;
  // its y is `end + delta · direction`.
  const quarter = (p1.x - p0.x) / 4
  const d = direction
  return {
    p0, p1,
    cps: [
      { x: c0.x - p0.x - quarter, y: (c0.y - p0.y) * d },
      { x: c1.x - p1.x + quarter, y: (c1.y - p1.y) * d },
    ],
  }
}
