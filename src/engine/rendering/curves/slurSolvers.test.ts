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
  it('⭐ `lilypond` is the default since P5 — his word, 2026-09-27; `house` stays selectable', () => {
    expect(DEFAULT_SLUR_SOLVER).toBe('lilypond')
    expect(slurSolverName()).toBe('lilypond')
    expect(SLUR_SOLVERS.house).toBe(solveHouseSlur)
  })

  it('solves with the armed row', () => {
    setSlurSolver('house')
    const input = { p0: { x: 0, y: 0 }, p1: { x: 200, y: 0 }, direction: -1, nestLift: 0, obstacles: () => [], searchProblem: () => null }
    expect(solveSlur(input)).toEqual(solveHouseSlur(input))
  })

  it('⭐ arms `house`', () => {
    expect(setSlurSolver('house')).toBe(true)
    expect(slurSolverName()).toBe('house')
  })

  it('⛔ refuses a name with no row — a typo must not look armed', () => {
    for (const name of ['toString', 'hosue']) {
      expect(setSlurSolver(name)).toBe(false)
      expect(slurSolverName()).toBe('lilypond')
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
