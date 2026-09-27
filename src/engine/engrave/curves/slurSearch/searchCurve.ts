/**
 * ⭐ **ONE CANDIDATE'S CURVE** — given a pair of ends, the arch LilyPond draws between them:
 * `Slur_configuration::generate_curve`, `fit_factor` and `avoid_staff_line` (`lily/slur-configuration.cc`),
 * over `get_slur_indent_height` / `slur_height` (`lily/bezier-bow.cc`). LilyPond 2.27.3,
 * GPL-3.0-or-later — see `NOTICE`. LilyPond's space: staff spaces, y up (`./searchState`).
 */
import {
  type Bezier, type Offset,
  add, complexMultiply, curvePoint, dot, norm, otherCoordinate, roundHalfwayUp, scale, solveDerivative, sub,
} from './bezier'
import type { SlurSearchState } from './searchState'

/** `slur_height` — `h_inf · F(w · r₀ / h_inf)`, F(x) = 2/π · atan(πx/2). */
export function slurHeight(width: number, hInf: number, r0: number): number {
  const x = (width * r0) / hInf
  return ((2 / Math.PI) * Math.atan((Math.PI * x) / 2)) * hInf
}

/** `get_slur_indent_height` — how tall, and how far in the controls sit. */
export function slurIndentHeight(width: number, hInf: number, r0: number): { indent: number; height: number } {
  const maxFraction = 1 / 3.1
  const q = (2 * hInf) / maxFraction
  return { height: slurHeight(width, hInf, r0), indent: 2 * hInf - (q * q * maxFraction) / (width + q) }
}

/**
 * `fit_factor` — how many times taller the arch must be to clear every avoid-point, in the frame where the
 * chord is the x axis and the slur's side is up. ⭐ An avoid-point closer than `closeToEdgeLength` to either
 * end is not counted: the ENDS are the other candidates' job, not the arch's.
 */
export function fitFactor(
  dzUnit: Offset, dzPerp: Offset, closeToEdgeLength: number, curve: Bezier, dir: number, avoid: readonly Offset[],
): number {
  let fit = 0
  const x0 = curve[0]
  // translate(−x0), rotate(−angle(dz)), scale(1, dir): rotating back by dz's angle is multiplying by its
  // conjugate.
  const conj = { x: dzUnit.x, y: -dzUnit.y }
  const local = curve.map(p => {
    const r = complexMultiply(conj, sub(p, x0))
    return { x: r.x, y: r.y * dir }
  }) as unknown as Bezier
  const lo = Math.min(local[0].x, local[3].x)
  const hi = Math.max(local[0].x, local[3].x)
  for (const a of avoid) {
    const z = sub(a, x0)
    const p = { x: dot(z, dzUnit), y: dir * dot(z, dzPerp) }
    if (p.x - lo < closeToEdgeLength || hi - p.x < closeToEdgeLength) continue
    const eps = 0.01
    const pLo = Math.max(p.x - eps, lo)
    const pHi = Math.min(p.x + eps, hi)
    if (pLo > pHi || pHi - pLo <= 1.999 * eps) continue
    const y = otherCoordinate(local, 'x', p.x)
    if (y !== 0) fit = Math.max(fit, p.y / y)
  }
  return fit
}

/** `avoid_staff_line` — a turning point that grazes a staff line is moved off it. */
export function avoidStaffLine(state: SlurSearchState, bez: Bezier): Bezier {
  const ts = solveDerivative(bez, { x: 1, y: 0 })
  if (ts.length === 0) return bez
  const t = ts[0]
  const y = curvePoint(bez, t).y
  // A Bézier at t moves 3t − 3t² as far as its middle controls.
  const factor = 3 * t * (1 - t)
  const p = 2 * (y - state.staff.middleY)
  const onLine = (pos: number) => state.staff.linePositions.includes(pos)
  let roundP = roundHalfwayUp(p)
  if (!onLine(roundP)) roundP += p > roundP ? 1 : -1
  if (!onLine(roundP)) return bez
  const distance = (p - roundP) / 2
  const minDistance = 0.5 * state.thickness * factor + state.lineThickness
    + (state.dir * distance > 0 ? state.details.gapToStafflineInside : state.details.gapToStafflineOutside)
  if (Math.abs(distance) >= minDistance) return bez
  const resolution = distance > 0 ? 1 : -1
  const dy = resolution * (minDistance - Math.abs(distance))
  // Shape the curve, moving the turning point by factor · dy, then move the whole curve by the rest.
  const rest = dy - factor * dy
  return [
    { x: bez[0].x, y: bez[0].y + rest },
    { x: bez[1].x, y: bez[1].y + dy + rest },
    { x: bez[2].x, y: bez[2].y + dy + rest },
    { x: bez[3].x, y: bez[3].y + rest },
  ]
}

/** `Slur_configuration::generate_curve` — the curve for one pair of ends, and the height it settled on. */
export function generateCurve(state: SlurSearchState, ends: readonly [Offset, Offset]): { curve: Bezier; height: number } {
  const { details, dir } = state
  const [left, right] = ends
  const dz = sub(right, left)
  const len = norm(dz)
  const dzUnit = scale(dz, 1 / len)
  const dzPerp = complexMultiply(dzUnit, { x: 0, y: 1 })
  const hInf = details.heightLimit
  let { indent, height } = slurIndentHeight(len, hInf, details.ratio)
  // |bez'(0)| < |bez'(½)| keeps the arch from bulging past its ends.
  indent = Math.min(indent, len / 3.1)
  let maxH = (len * len) / 3 - 0.75 * (indent + len / 3) ** 2
  maxH = maxH < 0 ? len / 3 : Math.sqrt(maxH)
  const x1 = details.eccentricity + indent
  const x2 = details.eccentricity - indent
  const build = (h: number): Bezier => [
    left,
    add(add(left, scale(dzPerp, h * dir)), scale(dzUnit, x1)),
    add(add(right, scale(dzPerp, h * dir)), scale(dzUnit, x2)),
    right,
  ]
  const ff = fitFactor(dzUnit, dzPerp, details.closeToEdgeLength, build(height), dir, state.avoid)
  height = Math.max(height, Math.min(height * ff, maxH))
  return { curve: avoidStaffLine(state, build(height)), height }
}
