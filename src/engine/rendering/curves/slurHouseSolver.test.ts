/**
 * The `house` preset — today's slur shape, moved behind `./slurSolvers` unchanged (docs/plans/slur-search-plan.md
 * P1). ⚠️ What it DRAWS is pinned in the browser (`e2e/slurSearch.e2e.ts`); these hold the row's contract.
 */
import { describe, it, expect, vi } from 'vitest'
import { slurArchCps, solveHouseSlur, solveHouseSlurPiece } from './slurHouseSolver'
import { slurArchFit, type SlurObstacle } from './slurObstacles'
import { archLean, slurArchHeightFor } from './slurArchHeight'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
const ABOVE = -1
const p0 = { x: 0, y: 0 }
const p1 = { x: 20 * SP, y: -2 * SP }
/** A box reaching well above the chord in the middle of the span. */
const tall: SlurObstacle = { x: 9 * SP, y: -6 * SP, width: 2 * SP, height: 6 * SP }

describe('solveHouseSlur', () => {
  it('⭐ never moves the ends it is given — the endpoint rules already ran', () => {
    const solved = solveHouseSlur({ p0, p1, direction: ABOVE, nestLift: 0, obstacles: () => [], searchProblem: () => null })
    expect(solved.p0).toBe(p0)
    expect(solved.p1).toBe(p1)
  })

  it('with nothing under it, draws the plain arch', () => {
    const solved = solveHouseSlur({ p0, p1, direction: ABOVE, nestLift: 3, obstacles: () => [], searchProblem: () => null })
    expect(solved.cps).toEqual(slurArchCps(p0, p1, ABOVE, 3, 1))
  })

  it('⭐ raises the whole arch by slurArchFit\'s ONE factor — exactly as SlurRenderer did', () => {
    const H = slurArchHeightFor(p0, p1, 0)
    const lean = archLean(p1.y - p0.y, ABOVE, H)
    const fit = slurArchFit(p0, p1, H + lean, H - lean, ABOVE, [tall])
    expect(fit).toBeGreaterThan(1)
    const solved = solveHouseSlur({ p0, p1, direction: ABOVE, nestLift: 0, obstacles: () => [tall], searchProblem: () => null })
    expect(solved.cps).toEqual(slurArchCps(p0, p1, ABOVE, 0, fit))
  })

  it('measures what the slur covers once', () => {
    const obstacles = vi.fn(() => [tall])
    solveHouseSlur({ p0, p1, direction: ABOVE, nestLift: 0, obstacles, searchProblem: () => null })
    expect(obstacles).toHaveBeenCalledTimes(1)
  })
})

describe('solveHouseSlurPiece — one system\'s piece of a broken slur', () => {
  it('⭐ keeps the ends it is given and bows the PLAIN arch — no obstacle fit, as the pieces always had', () => {
    const obstacles = vi.fn(() => [tall])
    const solved = solveHouseSlurPiece({
      p0, p1, direction: ABOVE, nestLift: 2, obstacles, searchProblem: () => null,
      hands: [{ x: 9, y: 9 }, { x: 9, y: 9 }],
    })
    expect(solved).toEqual({ p0, p1, cps: slurArchCps(p0, p1, ABOVE, 2, 1) })
    expect(obstacles).not.toHaveBeenCalled()
  })
})
