/**
 * ⭐⭐ **WHICH SOLVER SHAPES A SLUR — a PRESET, one row per engine** (docs/plans/slur-search-plan.md §3).
 *
 * A solver is handed the ends the engraver chose and what the slur covers, and answers the ends it
 * draws from and the cubic's control points. Only the ARMED row runs, so a preset's cost is its own:
 * `house` costs what slurs always cost (P0's stopwatch, `e2e/slurSearch.e2e.ts`). ⭐ A preset is a VIEW setting,
 * never stored in the score: an existing score re-shapes under the default (plan §7 B).
 *
 * | row | what it is |
 * |---|---|
 * | `house` | the pipeline we had — `./slurHouseSolver`. Still selectable. |
 * | `lilypond` | LilyPond's search — `./slurLilypondSolver` (P3). ⭐ THE DEFAULT since P5 (2026-09-27), his
 * |  | word — *"for a while to check more examples"*; a compromise of the two is his, later. |
 *
 * ⛔ **A hand-edited shape never asks a solver** (a `curveShape` override opts out), and the hand's
 * endpoint and whole-curve offsets are applied AFTER it, in `SlurRenderer` — the shape is solved from
 * the engraver's ends, as it always was.
 * ⚠️ **Single-system slurs only**: a broken slur's fragments are still `house`'s (P6).
 *
 * ⛔ `engine/` may not import `dev/`, so the setting lives HERE and `dev/slurShapeConsole` writes it
 * (`__slur.solver(…)`) — the same shape as `./slurShapeExperiment`. ⭐ {@link slurViewGeneration} is in
 * the render's VIEW key: a preset is a picture change with no model change, and without it the switch
 * would draw nothing (`isRenderStale()` would answer "no").
 */
import { solveHouseSlur } from './slurHouseSolver'
import { solveLilypondSlur } from './slurLilypondSolver'
import { slurShapeGeneration } from './slurShapeExperiment'
import type { SlurObstacle } from './slurObstacles'
import type { SlurSearchProblem } from './slurSearchProblem'

type Point = { x: number; y: number }

/** What a solver is told — every length in the pixels the slur is drawn in. */
export interface SlurSolveInput {
  /** The ends the engraver chose (after the attachment, tilt, slant and articulation rules), ⛔ before
   *  the hand's offsets. */
  p0: Point
  p1: Point
  /** −1 = above the notes, +1 = below. */
  direction: number
  /** The extra bow an outer slur takes over the slurs nested inside it. */
  nestLift: number
  /** What the slur covers, measured only if the solver asks (`SlurRenderer.slurObstaclesOf`). */
  obstacles: () => SlurObstacle[]
  /** The whole slur as LilyPond's problem (`./slurSearchProblem`), built only if the solver asks; null
   *  when it cannot be stated. */
  searchProblem: () => SlurSearchProblem | null
}

/** What a solver answers: the ends it drew from (`p0`/`p1` may move) and the cubic's control deltas. */
export interface SlurSolution {
  p0: Point
  p1: Point
  cps: [Point, Point]
}

export type SlurSolverName = 'house' | 'lilypond'

export const SLUR_SOLVERS: Record<SlurSolverName, (input: SlurSolveInput) => SlurSolution> = {
  house: solveHouseSlur,
  lilypond: solveLilypondSlur,
}

export const DEFAULT_SLUR_SOLVER: SlurSolverName = 'lilypond'

const state = { solver: DEFAULT_SLUR_SOLVER as SlurSolverName, generation: 0 }

/** The armed solver's name. */
export function slurSolverName(): SlurSolverName {
  return state.solver
}

/** Solve one slur with the armed preset. */
export function solveSlur(input: SlurSolveInput): SlurSolution {
  return SLUR_SOLVERS[state.solver](input)
}

/** Arm a preset. ⛔ An unknown name is refused, not ignored — a typo that looked like it worked would
 *  leave him judging the wrong picture. */
export function setSlurSolver(name: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(SLUR_SOLVERS, name)) return false
  state.solver = name as SlurSolverName
  state.generation++
  return true
}

/**
 * ⚠️ In the renderer's VIEW key (see the header) — for the preset AND the shape experiment's knobs, as one
 * number: both only ever grow, so their sum changes whenever either does.
 */
export function slurViewGeneration(): number {
  return state.generation + slurShapeGeneration()
}
