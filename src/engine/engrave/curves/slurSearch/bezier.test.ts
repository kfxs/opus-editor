/** LilyPond's Bézier arithmetic, transcribed (`./bezier`) — checked on curves whose answers are known by hand. */
import { describe, it, expect } from 'vitest'
import { type Bezier, curvePoint, otherCoordinate, solveDerivative, solvePolynomial, solvePoint, roundHalfwayUp, linearCombination, distance } from './bezier'

/** A symmetric arch from (0,0) to (4,0), controls 2 up. */
const ARCH: Bezier = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 0 }]

describe('solvePolynomial', () => {
  it('a line, a quadratic and a cubic with three real roots', () => {
    expect(solvePolynomial([-6, 3])).toEqual([2])
    expect(solvePolynomial([6, -5, 1]).sort()).toEqual([2, 3])
    // (t − 1)(t − 2)(t − 3) = t³ − 6t² + 11t − 6
    expect(solvePolynomial([-6, 11, -6, 1]).map(r => +r.toFixed(9)).sort()).toEqual([1, 2, 3])
  })

  it('⭐ drops a negligible leading coefficient, as `Polynomial::clean` does', () => {
    expect(solvePolynomial([-6, 3, 1e-12])).toEqual([2])
  })

  it('a quadratic with no real root has none', () => {
    expect(solvePolynomial([1, 0, 1])).toEqual([])
  })
})

describe('the curve', () => {
  it('its middle is ¾ of the control height, and its x there is the middle', () => {
    expect(curvePoint(ARCH, 0.5)).toEqual({ x: 2, y: 1.5 })
    expect(otherCoordinate(ARCH, 'x', 2)).toBeCloseTo(1.5, 12)
  })

  it('finds t for a coordinate, only on the curve', () => {
    expect(solvePoint(ARCH, 'x', 2).map(t => +t.toFixed(9))).toEqual([0.5])
    expect(solvePoint(ARCH, 'x', 9)).toEqual([])
  })

  it('answers 0 where there is no curve — LilyPond\'s own fallback', () => {
    expect(otherCoordinate(ARCH, 'x', 9)).toBe(0)
  })

  it('a symmetric arch is horizontal at its middle', () => {
    expect(solveDerivative(ARCH, { x: 1, y: 0 }).map(t => +t.toFixed(9))).toEqual([0.5])
  })
})

describe('the interval and rounding helpers', () => {
  it('round_halfway_up rounds .5 up, also below zero', () => {
    expect([2.5, -2.5, -7.5, 1.49].map(roundHalfwayUp)).toEqual([3, -2, -7, 1])
  })

  it('linear_combination runs −1 … 1 across an interval; distance is 0 inside', () => {
    expect(linearCombination([2, 4], -1)).toBe(2)
    expect(linearCombination([2, 4], 0.5)).toBe(3.5)
    expect([distance([0, 1], 0.5), distance([0, 1], 3), distance([0, 1], -2)]).toEqual([0, 2, 2])
  })
})
