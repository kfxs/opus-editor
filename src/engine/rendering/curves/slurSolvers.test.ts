/**
 * The slur PRESETS table (docs/plans/slur-search-plan.md §3, P1): one row armed at a time, `house` by default,
 * and a switch that reaches the render's view key.
 */
import { afterEach, describe, it, expect } from 'vitest'
import {
  DEFAULT_SLUR_SOLVER, SLUR_SOLVERS, setSlurSolver, slurSolverName, slurViewGeneration, solveSlur,
} from './slurSolvers'
import { solveHouseSlur } from './slurHouseSolver'
import { resetSlurShape, setSlurHeightLaw } from './slurShapeExperiment'

afterEach(() => { setSlurSolver(DEFAULT_SLUR_SOLVER); resetSlurShape() })

describe('slurSolvers', () => {
  it('⭐ `house` is the default — today\'s picture until his word at P5', () => {
    expect(DEFAULT_SLUR_SOLVER).toBe('house')
    expect(slurSolverName()).toBe('house')
    expect(SLUR_SOLVERS.house).toBe(solveHouseSlur)
  })

  it('solves with the armed row', () => {
    const input = { p0: { x: 0, y: 0 }, p1: { x: 200, y: 0 }, direction: -1, nestLift: 0, obstacles: () => [] }
    expect(solveSlur(input)).toEqual(solveHouseSlur(input))
  })

  it('⛔ refuses a name with no row — `lilypond` is not built yet, and a typo must not look armed', () => {
    for (const name of ['lilypond', 'toString', 'hosue']) {
      expect(setSlurSolver(name)).toBe(false)
      expect(slurSolverName()).toBe('house')
    }
  })

  it('⭐ arming a preset moves the view key, so the switch redraws', () => {
    const before = slurViewGeneration()
    expect(setSlurSolver('house')).toBe(true)
    expect(slurViewGeneration()).toBeGreaterThan(before)
  })

  it('…and so does the shape experiment, which shares the one number', () => {
    const before = slurViewGeneration()
    setSlurHeightLaw('verovio')
    expect(slurViewGeneration()).toBeGreaterThan(before)
  })
})
