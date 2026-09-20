/**
 * ⭐⭐ **WHICH SLOPE A BEAM TAKES, INSIDE ITS BUDGET** — S7a of `docs/history/vexflow-removal-map.md`
 * (`Beam.calculateSlope`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **Lean half as far as the stems would, unless that makes the stems longer than it is worth.**
 *
 * A search, ⛔ not a formula: every slope from `-range` to `+range` in {@link BEAM_SLOPE_SEARCH}`.steps`
 * steps is tried, and each is charged for (a) its distance from HALF the slope the two outer stem tips
 * already make, and (b) how much stem the inner notes would need to reach it. The cheapest wins.
 * ⭐ Part (b) is what keeps a beam from cutting through an inner note's stem: a note whose tip the line
 * would cross pushes the WHOLE line out (the returned {@link BeamSlopeFit.lift}) and is charged for
 * it once per note to its left.
 *
 * ## ⛔ What is NOT here
 *
 * - **How steep it may be** — the budget is `./beamSlope`'s question (its rows are HIS open
 *   comparison), and it arrives here as `range`.
 * - **Lengthening the stems to the chosen line** — `./beamedStems` (S7b).
 * - **A flat beam** (`Beam.calculateFlatSlope`) — only runs under `renderOptions.flatBeams`, which
 *   nothing in this editor sets.
 *
 * ⚠️ Transcribed with its arithmetic in VexFlow's order — the slope is ACCUMULATED (`slope += step`)
 * rather than multiplied, so the number of candidates is whatever the floating sum gives (20 or 21),
 * and a slope with no stem cost ties to the FIRST candidate that reached it. Tidying either moves a
 * beam by a hair, which is a picture change and not a port.
 */

/**
 * ⭐ The search's two numbers — `Beam.renderOptions.slopeIterations` / `slopeCost` (`beam.js:319`).
 * Nothing in this editor ever changed them.
 */
export const BEAM_SLOPE_SEARCH = {
  /** How many equal steps the budget is cut into. */
  steps: 20,
  /** What one unit of slope away from the ideal costs, against one pixel of total stem extension. */
  slopeWeight: 100,
} as const

/**
 * 🚨🚨 **A FLAT BUDGET IS A RANGE NARROWER THAN A PIXEL — ⛔ NEVER A RANGE OF ZERO.** With equal bounds
 * the step is 0 and the search never ends — a frozen tab, no error. A unison's budget is legitimately
 * zero (`./beamSlope`'s interval table), so ordinary music reaches this.
 */
export const FLAT_SLOPE_RANGE = 1e-6

/** What one note of the beam brings to the search. */
export interface BeamSlopeNote {
  /** The stem's x. */
  stemX: number
  /** The stem's free end as it stands before the beam lengthens it. @see `engrave/notes/stemLength` */
  tipY: number
  /** Whether its stem is charged — VexFlow's `hasStem() || isRest()`. ⚠️ Not read for the FIRST note. */
  counts: boolean
}

export interface BeamSlopeInput {
  /** The beam's stem direction: `1` up, `-1` down. */
  stemDirection: number
  /** In order; at least two. */
  notes: readonly BeamSlopeNote[]
  /** ⭐ The steepest slope allowed either way (rise over run) — `./beamSlope`'s budget ÷ the width. */
  range: number
}

export interface BeamSlopeFit {
  /** Rise over run, in pixels. */
  slope: number
  /** How far the whole line moves off the first stem's tip to clear an inner note — VexFlow's `yShift`. */
  lift: number
}

/** The beam line's y at `x`, for a line through (`firstX`, `firstY`) — VexFlow's `Beam.getSlopeY`. */
export function beamLineYAt(firstX: number, firstY: number, slope: number, x: number): number {
  return firstY + (x - firstX) * slope
}

/** ⭐ The cheapest slope within ±`range` — see the module header. */
export function fitBeamSlope({ stemDirection, notes, range: budget }: BeamSlopeInput): BeamSlopeFit {
  const range = Math.max(budget, FLAT_SLOPE_RANGE)
  const minSlope = -range
  const maxSlope = range
  const first = notes[0]
  const last = notes[notes.length - 1]
  const initialSlope = (last.tipY - first.tipY) / (last.stemX - first.stemX)
  const increment = (maxSlope - minSlope) / BEAM_SLOPE_SEARCH.steps

  let minCost = Number.MAX_VALUE
  let bestSlope = 0
  let lift = 0
  for (let slope = minSlope; slope <= maxSlope; slope += increment) {
    let totalStemExtension = 0
    let liftHere = 0
    for (let i = 1; i < notes.length; ++i) {
      const note = notes[i]
      if (!note.counts) continue
      const lineY = beamLineYAt(first.stemX, first.tipY, slope, note.stemX) + liftHere
      if (note.tipY * stemDirection < lineY * stemDirection) {
        // The line would cross this stem: move all of it out, and charge every note so far.
        const diff = Math.abs(note.tipY - lineY)
        liftHere += diff * -stemDirection
        totalStemExtension += diff * i
      } else {
        totalStemExtension += (note.tipY - lineY) * stemDirection
      }
    }
    const idealSlope = initialSlope / 2
    const cost = BEAM_SLOPE_SEARCH.slopeWeight * Math.abs(idealSlope - slope) + Math.abs(totalStemExtension)
    if (cost < minCost) {
      minCost = cost
      bestSlope = slope
      lift = liftHere
    }
  }
  return { slope: bestSlope, lift }
}
