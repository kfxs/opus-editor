/** The `lilypond` preset's row (`./slurLilypondSolver`) — docs/plans/slur-search-plan.md P3. */
import { describe, it, expect } from 'vitest'
import { cachedSlurSearch, solveLilypondSlur, solveLilypondSlurPiece } from './slurLilypondSolver'
import { solveHouseSlur, solveHouseSlurPiece } from './slurHouseSolver'
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

describe('cachedSlurSearch', () => {
  it('⭐ the very same problem is answered from the cache — the same object, not a re-search', () => {
    const a = cachedSlurSearch(hisSlur(true))
    expect(cachedSlurSearch(hisSlur(true))).toBe(a)
    expect(a).toEqual(searchSlur(hisSlur(true)))
  })

  it('⛔ a problem that differs in anything is searched again', () => {
    const a = cachedSlurSearch(hisSlur(true))
    const b = cachedSlurSearch(hisSlur(true, 5.1))
    expect(b).not.toBe(a)
    expect(b).toEqual(searchSlur(hisSlur(true, 5.1)))
  })
})

describe('solveLilypondSlurPiece — one system\'s piece of a broken slur (P6)', () => {
  const piece = (): SlurSearchProblem => ({
    input: { ...hisSlur(false), columns: hisSlur(false).columns.slice(0, 2), brokenX: [undefined, 6] }, frame,
  })
  const hands = [{ x: 3, y: -4 }, { x: -2, y: 5 }] as const

  it('⭐ the search\'s ends, with the HAND\'s moves added back — its arch rides with them', () => {
    const whole = solveLilypondSlur({ ...base, searchProblem: piece })
    const solved = solveLilypondSlurPiece({ ...base, hands, searchProblem: piece })
    expect(solved.p0).toEqual({ x: whole.p0.x + 3, y: whole.p0.y - 4 })
    expect(solved.p1).toEqual({ x: whole.p1.x - 2, y: whole.p1.y + 5 })
    expect(solved.cps).toEqual(whole.cps)
  })

  it('⛔ a piece that cannot be stated is `house`\'s', () => {
    const input = { ...base, hands, searchProblem: () => null }
    expect(solveLilypondSlurPiece(input)).toEqual(solveHouseSlurPiece(input))
  })
})
