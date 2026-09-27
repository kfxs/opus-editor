/**
 * The arithmetic LilyPond's slur search stands on — its `Interval`, `Offset` and cubic `Bezier`, with the
 * polynomial root-finder the Bézier asks — transcribed from LilyPond 2.27.3 (`flower/include/interval.hh`,
 * `flower/offset.cc`, `flower/polynomial.cc`, `lily/bezier.cc`). GPL-3.0-or-later; see `NOTICE`.
 *
 * ⚠️ **The root ORDER is part of the port.** `Bezier::get_other_coordinate` answers with the FIRST root
 * the solver found, so {@link solvePolynomial} returns them in exactly Cardano's order — a "tidier"
 * sort would pick a different root on a curve that folds back.
 */

/** A closed interval `[lo, hi]`; EMPTY when `lo > hi` (LilyPond's `set_empty` is `[+∞, −∞]`). */
export type Interval = readonly [number, number]

export const EMPTY: Interval = [Infinity, -Infinity]

export const isEmpty = (i: Interval): boolean => i[0] > i[1]
export const center = (i: Interval): number => (i[0] + i[1]) / 2
export const length = (i: Interval): number => (isEmpty(i) ? 0 : i[1] - i[0])
/** The end on side `d` (−1 = low, +1 = high) — LilyPond's `interval[d]`. */
export const at = (i: Interval, d: number): number => (d < 0 ? i[0] : i[1])
export const widen = (i: Interval, by: number): Interval => [i[0] - by, i[1] + by]
export const intersect = (a: Interval, b: Interval): Interval => [Math.max(a[0], b[0]), Math.min(a[1], b[1])]
export const unite = (a: Interval, b: Interval): Interval => [Math.min(a[0], b[0]), Math.max(a[1], b[1])]
export const contains = (i: Interval, x: number): boolean => x >= i[0] && x <= i[1]
/** `Interval::linear_combination` — `idx` −1 is the low end, +1 the high one. */
export const linearCombination = (i: Interval, idx: number): number => ((1 - idx) * i[0] + (1 + idx) * i[1]) / 2
/** `Interval::distance` — 0 inside, else how far outside. */
export const distance = (i: Interval, x: number): number => (x > i[1] ? x - i[1] : x < i[0] ? i[0] - x : 0)

export interface Offset { x: number; y: number }

export const add = (a: Offset, b: Offset): Offset => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Offset, b: Offset): Offset => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Offset, k: number): Offset => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Offset, b: Offset): number => a.x * b.x + a.y * b.y
export const norm = (a: Offset): number => Math.hypot(a.x, a.y)
/** `complex_multiply` — `z * (0, 1)` turns a vector a quarter-turn counter-clockwise. */
export const complexMultiply = (a: Offset, b: Offset): Offset => ({ x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x })
/** `Offset::direction` — the unit vector, or zero for zero. */
export const direction = (a: Offset): Offset => {
  const n = norm(a)
  return n === 0 ? { x: 0, y: 0 } : scale(a, 1 / n)
}

/** A cubic Bézier's four control points. */
export type Bezier = readonly [Offset, Offset, Offset, Offset]

/** `Bezier::curve_point`. */
export function curvePoint(b: Bezier, t: number): Offset {
  const mt = 1 - t
  const w = [mt * mt * mt, 3 * mt * mt * t, 3 * mt * t * t, t * t * t]
  return {
    x: w[0] * b[0].x + w[1] * b[1].x + w[2] * b[2].x + w[3] * b[3].x,
    y: w[0] * b[0].y + w[1] * b[1].y + w[2] * b[2].y + w[3] * b[3].y,
  }
}

type Axis = 'x' | 'y'

/** `Bezier::polynomial` — the coordinate on `axis` as a cubic in t, coefficients low → high. */
function polynomial(b: Bezier, axis: Axis): number[] {
  // Σ C(3,j) z_j t^j (1−t)^(3−j), expanded.
  const [p0, p1, p2, p3] = b.map(p => p[axis])
  return [p0, 3 * (p1 - p0), 3 * (p0 - 2 * p1 + p2), p3 - p0 + 3 * (p1 - p2)]
}

/** `Polynomial::clean`'s relative tolerance. */
const FUDGE = 1e-8

/** `Polynomial::solve` — the real roots, in LilyPond's order (see the header). */
export function solvePolynomial(coefs: readonly number[]): number[] {
  const c = [...coefs]
  // `clean`: drop a leading coefficient that is zero, or negligible beside the next.
  while (c.length > 1 && (Math.abs(c[c.length - 1]) < FUDGE * Math.abs(c[c.length - 2]) || c[c.length - 1] === 0)) c.pop()
  switch (c.length - 1) {
    case 1: return c[1] !== 0 ? [-c[0] / c[1]] : []
    case 2: {
      const p = c[1] / (2 * c[2])
      const q = c[0] / c[2]
      const D = p * p - q
      if (!(D > 0)) return []
      const r = Math.sqrt(D)
      return [r - p, -r - p]
    }
    case 3: return solveCubic(c)
    default: return []
  }
}

function cubicRoot(x: number): number {
  return x > 0 ? Math.pow(x, 1 / 3) : x < 0 ? -Math.pow(-x, 1 / 3) : 0
}

/** `Polynomial::solve_cubic` — Cardano. */
function solveCubic(c: readonly number[]): number[] {
  const A = c[2] / c[3], B = c[1] / c[3], C = c[0] / c[3]
  const sqA = A * A
  const p = (1 / 3) * ((-1 / 3) * sqA + B)
  const q = (1 / 2) * ((2 / 27) * A * sqA - (1 / 3) * A * B + C)
  const cb = p * p * p
  const D = q * q + cb
  let sol: number[]
  if (D === 0) {
    if (q === 0) sol = [0, 0, 0]
    else {
      const u = cubicRoot(-q)
      sol = [2 * u, -u]
    }
  } else if (D < 0) {
    const phi = (1 / 3) * Math.acos(-q / Math.sqrt(-cb))
    const t = 2 * Math.sqrt(-p)
    sol = [t * Math.cos(phi), -t * Math.cos(phi + Math.PI / 3), -t * Math.cos(phi - Math.PI / 3)]
  } else {
    const sqrtD = Math.sqrt(D)
    sol = [cubicRoot(sqrtD - q) - cubicRoot(sqrtD + q)]
  }
  const shift = A / 3
  return sol.map(s => s - shift)
}

/** `filter_solutions` — only the t's on the curve. */
const onCurve = (ts: number[]): number[] => ts.filter(t => !(t < 0 || t > 1))

/** `Bezier::solve_point` — every t where the curve's `axis` coordinate is `value`. */
export function solvePoint(b: Bezier, axis: Axis, value: number): number[] {
  const p = polynomial(b, axis)
  p[0] -= value
  return onCurve(solvePolynomial(p))
}

/** `Bezier::get_other_coordinate` — the curve's y at x (or x at y), from the FIRST root. ⚠️ LilyPond
 *  answers 0 when there is none (with a programming error); so does this. */
export function otherCoordinate(b: Bezier, axis: Axis, value: number): number {
  const ts = solvePoint(b, axis, value)
  if (ts.length === 0) return 0
  return curvePoint(b, ts[0])[axis === 'x' ? 'y' : 'x']
}

/** `Bezier::solve_derivative` — every t where the tangent is parallel to `deriv`. */
export function solveDerivative(b: Bezier, deriv: Offset): number[] {
  const diff = (p: number[]) => p.slice(1).map((c, i) => c * (i + 1))
  const xp = diff(polynomial(b, 'x'))
  const yp = diff(polynomial(b, 'y'))
  return onCurve(solvePolynomial(xp.map((c, i) => c * deriv.y - yp[i] * deriv.x)))
}

/** `linear_interpolate` (`lily/include/misc.hh`) — ⚠️ its argument order, kept. */
export const linearInterpolate = (x: number, x1: number, x2: number, y1: number, y2: number): number =>
  ((x2 - x) / (x2 - x1)) * y1 + ((x - x1) / (x2 - x1)) * y2

/** `normalize` (`lily/include/misc.hh`). */
export const normalize = (x: number, x1: number, x2: number): number => (x - x1) / (x2 - x1)

/** `minmax (d, a, b)` — the larger on side `d`: max for +1, min for −1. */
export const minmax = (d: number, a: number, b: number): number => (d > 0 ? Math.max(a, b) : Math.min(a, b))

/** `round_halfway_up` (`flower/libc-extension.cc`). */
export const roundHalfwayUp = (x: number): number => Math.floor(x - 0.5) + 1
