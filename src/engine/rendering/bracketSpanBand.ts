/**
 * ⭐ **A BRACKET SPAN'S RUNG ON THE OUTSIDE-STAFF LADDER** — what `OttavaRenderer` and `PedalRenderer`
 * each spelled, identically but for the side and the family's two style rows
 * (docs/code-shape-plan-2026-09-19.md, Phase 5): which beats of a bar the span covers, the baseline
 * that clears the music AND everything already claimed there, and the claim the fragment files.
 *
 * ⭐ {@link barSlice} is shared by the baseline (what ink is in there) and the claim (what beats the
 * fragment took), so what a line CLEARED and what it CLAIMS cannot drift apart.
 *
 * ⛔ **NOT the trill's**, which looks like it and is a different rule twice over: its last bar runs to
 * the onset AFTER the last trilled slot, and its baseline reads the drawn CURVES and nothing of the
 * ladder (it is the innermost rung). A name is not a body — `TrillRenderer` keeps its own.
 */
import type { Fraction, Measure } from '@/types/music'
import { fracAdd } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import type { Column } from '@/engine/layout/spacing'
import {
  clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand,
  type Clearance, type InkBand, type MarkInk,
} from '@/engine/layout/inkBand'
import { bandOver, markBand, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'

const ZERO: Fraction = { num: 0, den: 1 }

/** Where a bracket span starts and ends, as its family's `<family>Span` answers it. */
export interface BracketSpan {
  startMeasure: number
  startBeat: Fraction
  endMeasure: number
  endBeat: Fraction
}

/** One drawn bar the span covers. */
interface CoveredBar {
  view: Measure
  measureNumber: number
}

/** Which fragment, of which staff, on which side. */
export interface BracketRung {
  line: number
  staffId: string | undefined
  side: 'above' | 'below'
}

/**
 * The slice of ONE bar the span covers, in that bar's own beats — the first bar from the start beat,
 * the last bar to the end beat, everything between it whole.
 */
export function barSlice(p: CoveredBar, span: BracketSpan): { from: Fraction; to: Fraction } {
  return {
    from: p.measureNumber === span.startMeasure ? span.startBeat : ZERO,
    to: p.measureNumber === span.endMeasure ? span.endBeat : measureCapacityFrac(p.view),
  }
}

/**
 * ⭐⭐ **THE BRACKET'S OWN Y — the consumer half of the ladder.** Two bands merged: the MUSIC's ink
 * over the bars of THIS FRAGMENT (`layout/inkBand`), and everything the families placed before it
 * have already claimed there (`layout/outsideStaffBand`). ⭐ That merge IS the ladder; there is no
 * priority table, and the order is the order the passes run in.
 *
 * ⚠️ **Per FRAGMENT, not per span**: a low note on the second system must not push the first
 * system's sign away for no visible reason.
 */
export function bracketBaseline(
  occupiedBands: readonly OccupiedSpan[],
  here: readonly (CoveredBar & { system: { columns: Column[] } })[],
  span: BracketSpan,
  { line, staffId, side }: BracketRung,
  firstStaffId: string | undefined,
  starts: Map<number, Fraction>,
  style: { ink: MarkInk; clearance: Clearance },
): number {
  let music: InkBand | null = null
  let taken: InkBand | null = null
  for (const p of here) {
    const { from, to } = barSlice(p, span)
    music = mergeInkBands(music, staffInkBand(columnsBetween(p.system.columns, from, to), staffId, firstStaffId))
    const base = starts.get(p.measureNumber)
    if (base === undefined) continue
    taken = mergeInkBands(taken, bandOver(
      occupiedBands, line, staffId, side, fracAdd(base, from), fracAdd(base, to), firstStaffId))
  }
  return clearanceBaseline(mergeInkBands(music, taken), side, style.ink, style.clearance)
}

/**
 * ⭐ **What one fragment took**, on the ladder's absolute-beat axis — `null` when the fragment covers
 * no bar this render drew. Pure: the beats are the part of this that can be wrong, and they are
 * arithmetic rather than geometry.
 */
export function bracketFragmentClaim(
  here: readonly CoveredBar[],
  span: BracketSpan,
  { line, staffId, side }: BracketRung,
  baseline: number,
  starts: Map<number, Fraction>,
  ink: MarkInk,
): OccupiedSpan | null {
  const bars = [...here].sort((a, b) => a.measureNumber - b.measureNumber)
  const first = bars[0]
  const last = bars[bars.length - 1]
  if (!first || !last) return null
  const firstStart = starts.get(first.measureNumber)
  const lastStart = starts.get(last.measureNumber)
  if (firstStart === undefined || lastStart === undefined) return null
  return {
    line,
    staffId,
    side,
    from: fracAdd(firstStart, barSlice(first, span).from),
    to: fracAdd(lastStart, barSlice(last, span).to),
    band: markBand(baseline, ink),
  }
}
