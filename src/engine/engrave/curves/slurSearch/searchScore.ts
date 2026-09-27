/**
 * ⭐ **WHAT A CANDIDATE COSTS** — LilyPond's four demerit scorers, `Slur_configuration::score_slopes`,
 * `score_edges`, `score_extra_encompass` and `score_encompass` (`lily/slur-configuration.cc`), and
 * `peak_around` (`lily/misc.cc`). LilyPond 2.27.3, GPL-3.0-or-later — see `NOTICE`. LilyPond's space: staff
 * spaces, y up (`./searchState`).
 *
 * ⭐ Each scorer ADDS to the candidate's score and names what it added on the card (LilyPond's
 * `debug-slur-scoring` annotation), so a picture can be explained number by number.
 */
import {
  type Bezier, type Offset,
  at, contains, distance, isEmpty, linearCombination, linearInterpolate, norm, otherCoordinate, sub,
} from './bezier'
import { type SlurSearchState, intersect, LEFT, RIGHT, side } from './searchState'

/** A candidate: its ends, its curve, and what it has cost so far. */
export interface SlurCandidate {
  index: number
  ends: readonly [Offset, Offset]
  curve: Bezier
  height: number
  score: number
  /** `name=value` for every non-zero demerit, in the order they were added. */
  card: string[]
  /** How many of {@link SCORERS} have run. */
  scored: number
}

/** `peak_around` — 1 at or below 0, falling to 0 at `threshold`, 0 beyond. */
export function peakAround(epsilon: number, threshold: number, x: number): number {
  if (x < 0) return 1
  return Math.max((-epsilon * (x - threshold)) / ((x + epsilon) * threshold), 0)
}

/** `add_score` — ⛔ a negative demerit is ignored, as LilyPond does (with a programming error). */
function addScore(c: SlurCandidate, s: number, name: string): void {
  if (s < 0) s = 0
  if (s === 0) return
  c.card.push(`${name}=${s.toFixed(2)}`)
  c.score += s
}

const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0)

/** `Stem::get_beaming (stem, -d)` — does a beam leave the end's stem toward the slur's inside. */
function beamsInward(state: SlurSearchState, i: number): boolean {
  const stem = state.bounds[i].stem!
  return i === LEFT ? stem.beamsRight : stem.beamsLeft
}

/** `score_slopes` — steeper than the music, sloped over level music, or sloped against it. */
export function scoreSlopes(state: SlurSearchState, c: SlurCandidate): void {
  const { details } = state
  const dy = state.musicalDy
  const slurDz = sub(c.ends[RIGHT], c.ends[LEFT])
  const slurDy = slurDz.y
  const overMax = Math.max(Math.abs(slurDy / slurDz.x) - details.maxSlope, 0) * details.maxSlopeFactor
  let demerit = overMax
  // 0.2: account for the staff line offset.
  let maxDy = Math.abs(dy) + 0.2
  if (state.edgeHasBeams) maxDy += 1
  if (!state.isBroken) demerit += details.steeperSlopeFactor * Math.max(Math.abs(slurDy) - maxDy, 0)
  // ⚠️ LilyPond adds the max-slope term TWICE (`slur-configuration.cc`); transcribed as written.
  demerit += overMax
  if (Math.abs(dy) < 0.01 && Math.abs(slurDy) > 0.01 && !state.isBroken) demerit += details.nonHorizontalPenalty
  if (sign(dy) && !state.isBroken && sign(slurDy) && sign(slurDy) !== sign(dy)) {
    demerit += state.edgeHasBeams ? details.sameSlopePenalty / 10 : details.sameSlopePenalty
  }
  addScore(c, demerit, 'slope')
}

/** `score_edges` — every staff space an end moved from its base attachment. */
export function scoreEdges(state: SlurSearchState, c: SlurCandidate): void {
  const dz = sub(c.ends[RIGHT], c.ends[LEFT])
  const slope = dz.y / dz.x
  for (const i of [LEFT, RIGHT]) {
    const d = side(i)
    const dy = Math.abs(c.ends[i].y - state.baseAttachments[i].y)
    let demerit = state.details.edgeAttractionFactor * dy
    const stem = state.bounds[i].stem
    if (stem && stem.dir === state.dir && !beamsInward(state, i)) demerit /= 5
    demerit *= Math.exp(state.dir * d * slope * state.details.edgeSlopeExponent)
    addScore(c, demerit, i === LEFT ? 'L edge' : 'R edge')
  }
}

/** `score_extra_encompass` — the objects the slur avoids, and the ties' ends. */
export function scoreExtraEncompass(state: SlurSearchState, c: SlurCandidate): void {
  const { details, dir } = state
  const tooClose = state.tieEnds.some(t =>
    c.ends.some(end => norm(sub(t, end)) < details.slurTieExtremaMinDistance))
  if (tooClose) addScore(c, details.slurTieExtremaMinDistancePenalty, 'extra')

  for (const info of state.extraInfos) {
    let found = false
    let y = 0
    // An object over an END's head is measured at that end — the curve there can be near vertical.
    if (info.rawX) {
      for (const i of [LEFT, RIGHT]) {
        const head = state.bounds[i].slurHead
        if (head && !isEmpty(intersect(info.rawX, head.x))) {
          y = c.ends[i].y
          found = true
        }
      }
    }
    if (!found) {
      const x = linearCombination(info.x, info.idx)
      if (!contains([c.ends[LEFT].x, c.ends[RIGHT].x], x)) continue
      y = otherCoordinate(c.curve, 'x', x)
    }
    const dist = Math.max(info.avoid === 'around' ? distance(info.y, y) : dir * (y - at(info.y, dir)), 0)
    addScore(c, info.penalty * peakAround(0.1 * details.extraEncompassFreeDistance, details.extraEncompassFreeDistance, dist), 'extra')
  }
}

/** `score_encompass` — heads and stems under the curve, and how evenly it clears them. */
export function scoreEncompass(state: SlurSearchState, c: SlurCandidate): void {
  const { details, dir } = state
  const [left, right] = c.ends
  let demerit = 0
  const convex: number[] = []
  const infos = state.encompassInfos
  for (let j = 0; j < infos.length; j++) {
    const info = infos[j]
    const x = info.x
    const lEdge = j === 0
    const rEdge = j === infos.length - 1
    if (!(x < right.x && x > left.x)) continue
    const y = otherCoordinate(c.curve, 'x', x)
    if (!lEdge && !rEdge) {
      const headDy = y - info.head
      if (dir * headDy < 0) {
        demerit += details.headEncompassPenalty
        convex.push(0)
      } else {
        let hd = headDy !== 0 ? 1 / Math.abs(headDy) - 1 / details.freeHeadDistance : details.headEncompassPenalty
        hd = Math.min(Math.max(hd, 0), details.headEncompassPenalty)
        demerit += hd
      }
      const lineY = linearInterpolate(x, right.x, left.x, right.y, left.y)
      // `Encompass_info::get_point (dir)` — the far end of head ∪ stem on the slur's side.
      const point = dir > 0 ? Math.max(info.stem, info.head) : Math.min(info.stem, info.head)
      const closest = dir * Math.max(dir * point, dir * lineY)
      convex.push(Math.abs(closest - y))
    }
    if (dir * (y - info.stem) < 0) {
      let stemDem = details.stemEncompassPenalty
      if ((lEdge && dir > 0) || (rEdge && dir < 0)) stemDem /= 5
      demerit += stemDem
    }
  }
  addScore(c, demerit, 'encompass')

  let n = convex.length
  if (n) {
    let avg = 0
    let min = Infinity
    for (const d of convex) { min = Math.min(min, d); avg += d }
    // Over one or two heads the average alone is not a good normaliser.
    if (n <= 2) { avg += c.height; n++ }
    avg /= n
    let variance = details.headSlurDistanceMaxRatio
    if (min > 0) variance = Math.min(avg / (min + details.absoluteClosenessMeasure) - 1, variance)
    variance = Math.max(variance, 0) * details.headSlurDistanceFactor
    addScore(c, variance, 'variance')
  }
}

/** LilyPond's scorer order — cheapest first (`Slur_configuration::Slur_scorers`). */
export const SCORERS: ReadonlyArray<(state: SlurSearchState, c: SlurCandidate) => void> = [
  scoreSlopes, scoreEdges, scoreExtraEncompass, scoreEncompass,
]
