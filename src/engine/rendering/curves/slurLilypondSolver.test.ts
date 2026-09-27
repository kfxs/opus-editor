/** The `lilypond` preset's row (`./slurLilypondSolver`) — docs/plans/slur-search-plan.md P3. */
import { describe, it, expect } from 'vitest'
import { solveLilypondSlur } from './slurLilypondSolver'
import { solveHouseSlur } from './slurHouseSolver'
import { fromSearch, type SlurSearchProblem } from './slurSearchProblem'
import { searchSlur } from '@/engine/engrave/curves/slurSearch/slurSearch'
import { hisSlur } from '@/engine/engrave/curves/slurSearch/searchFixture'
import { curveControlPoints } from '@/engine/engrave/curves/curveInk'

const base = { p0: { x: 100, y: 50 }, p1: { x: 300, y: 40 }, direction: -1, nestLift: 0, obstacles: () => [] }
const frame = { originX: 100, middleY: 80, spacePx: 10 }

describe('solveLilypondSlur', () => {
  it('⛔ a slur that cannot be stated is `house`\'s — never nothing', () => {
    const input = { ...base, searchProblem: () => null }
    expect(solveLilypondSlur(input)).toEqual(solveHouseSlur(input))
  })

  it('⭐ draws EXACTLY the curve the search chose, in px — its ends and both controls', () => {
    const problem: SlurSearchProblem = { input: hisSlur(true), frame }
    const found = searchSlur(problem.input)!
    const solved = solveLilypondSlur({ ...base, searchProblem: () => problem })
    const [p0, c0, c1, p1] = found.curve.map(p => fromSearch(frame, p))
    expect(solved.p0).toEqual(p0)
    expect(solved.p1).toEqual(p1)
    const drawn = curveControlPoints({ p0: solved.p0, p1: solved.p1, cps: solved.cps, direction: base.direction })
    expect(drawn.c0.x).toBeCloseTo(c0.x, 9)
    expect(drawn.c0.y).toBeCloseTo(c0.y, 9)
    expect(drawn.c1.x).toBeCloseTo(c1.x, 9)
    expect(drawn.c1.y).toBeCloseTo(c1.y, 9)
  })

  it('ignores the ends it is given — the search picks its own', () => {
    const problem: SlurSearchProblem = { input: hisSlur(false), frame }
    const a = solveLilypondSlur({ ...base, searchProblem: () => problem })
    const b = solveLilypondSlur({ ...base, p0: { x: 0, y: 0 }, searchProblem: () => problem })
    expect(b).toEqual(a)
  })
})
