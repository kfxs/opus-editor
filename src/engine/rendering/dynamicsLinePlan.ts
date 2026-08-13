/**
 * ⭐⭐ **WHERE EVERY DYNAMICS-FAMILY MARK GOES, decided ONCE for the whole render.**
 *
 * Letters, expression words and hairpins share one line, so they cannot each work it out for
 * themselves: the moment a wedge and the `f` it runs into compute their own answers, the two are
 * free to disagree and the eye sees it immediately. This module is the single answer — every mark's
 * own baseline from the local rule (`layout/dynamicsLine.ts`), then levelled within its CHAIN
 * (`layout/dynamicsChain.ts`) — handed to both drawing passes as a lookup.
 *
 * ⭐ **Why a plan and not a shared helper.** Chaining is not a per-mark question: what a wedge's
 * baseline is depends on a letter three bars away that it happens to touch. Nothing can answer it
 * while walking one measure, which is exactly what both passes do. So the walk happens here, once,
 * before either of them draws.
 *
 * ⚠️ **A hairpin contributes ONE MEMBER PER SYSTEM it crosses**, keyed `id@line`. A split wedge is
 * two fragments in two places, each levelling with what is around it *there* — the alternative,
 * one answer for the whole wedge, would drag the second system's line up to the first's for no
 * reason the reader can see.
 *
 * **Pure over the last render's inputs, stored nowhere** — the family of `measureColumns` and
 * `pageCastOff` (DESIGN-PRINCIPLES §3).
 */
import type { Score, Measure, Fraction } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import {
  dynamicsLineBaseline, type DynamicsPlacement,
} from '@/engine/layout/dynamicsLine'
import {
  columnsBetween, columnsUnder, mergeInkBands, staffInkBand,
  type MarkInk, type InkBand,
} from '@/engine/layout/inkBand'
import { levelDynamicsChains, type ChainItem } from '@/engine/layout/dynamicsChain'
import { hairpinSpan } from '@/engine/models/hairpinOps'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracAdd, fracCreate } from '@/utils/fraction'

/** What the plan needs of a `MeasurePlacement` — the shape both passes already declare. */
export interface DynamicsPlanPlacement {
  /** This staff's own lane of the measure, so `dynamics`/`hairpins` are already the staff's. */
  view: Measure
  measureNumber: number
  staffIndex: number
  line: number
  system: { columns: Column[] }
}

/** The answer, in staff spaces below the top stave line. Key: a mark's id, or `id@line` for a
 *  hairpin fragment. */
export type DynamicsLinePlan = Map<string, number>

/** The key a hairpin fragment's baseline is filed under — its id and the system it landed on. */
export function hairpinLineKey(id: string, line: number): string {
  return `${id}@${line}`
}

/** Cumulative quarter-beat offset of each measure's start. The shared axis chaining needs: two
 *  marks either side of a barline can only be compared on one. */
function measureStartOffsets(score: Score): Map<number, Fraction> {
  const out = new Map<number, Fraction>()
  let base = fracCreate(0, 1)
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    out.set(m.number, base)
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return out
}

/** The band a wedge's fragment must clear: the ink of every bar it covers ON THIS SYSTEM, sliced to
 *  the part of each bar the wedge actually spans. */
function hairpinBand(
  onThisLine: readonly DynamicsPlanPlacement[],
  startMeasure: number,
  startBeat: Fraction,
  endMeasure: number,
  endBeat: Fraction,
  staffId: string | undefined,
  firstStaffId: string | undefined,
): InkBand | null {
  let band: InkBand | null = null
  for (const p of onThisLine) {
    const from = p.measureNumber === startMeasure ? startBeat : fracCreate(0, 1)
    const to = p.measureNumber === endMeasure ? endBeat : measureCapacityFrac(p.view)
    band = mergeInkBands(band, staffInkBand(columnsBetween(p.system.columns, from, to), staffId, firstStaffId))
  }
  return band
}

/**
 * Build the render's dynamics-line plan: every letter, word and wedge fragment, levelled by chain.
 *
 * `markInk` is how far a mark's ink reaches either side of its baseline — a FONT measurement the
 * caller supplies, because a glyph measures 0×0 in jsdom and a number computed here would agree
 * with itself.
 */
export function planDynamicsLines(
  score: Score,
  placements: readonly DynamicsPlanPlacement[],
  staffIds: readonly (string | undefined)[],
  markInk: MarkInk,
): DynamicsLinePlan {
  const starts = measureStartOffsets(score)
  const items: ChainItem[] = []

  for (const placement of placements) {
    const staffId = staffIds[placement.staffIndex]
    const measureStart = starts.get(placement.measureNumber)
    if (measureStart === undefined) continue

    // ── The letters and words. A point on the axis: it touches whatever reaches it.
    for (const dyn of placement.view.dynamics ?? []) {
      const at = fracAdd(measureStart, dyn.beat)
      const placementSide: DynamicsPlacement = dyn.placement === 'above' ? 'above' : 'below'
      items.push({
        key: dyn.id,
        line: placement.line,
        staffId,
        placement: placementSide,
        start: at,
        end: at,
        baseline: dynamicsLineBaseline(
          staffInkBand(columnsUnder(placement.system.columns, dyn.beat), staffId, staffIds[0]),
          placementSide,
          markInk,
        ),
      })
    }

    // ── The wedges, one member per system crossed. Only the bar a hairpin STARTS in lists it, so
    //    each is visited once however many bars it covers.
    for (const hairpin of placement.view.hairpins ?? []) {
      const span = hairpinSpan(score, hairpin.id)
      if (!span || span.startMeasure !== placement.measureNumber) continue
      const placementSide: DynamicsPlacement = hairpin.placement === 'above' ? 'above' : 'below'

      const covered = placements.filter(p =>
        p.staffIndex === placement.staffIndex
        && p.measureNumber >= span.startMeasure
        && p.measureNumber <= span.endMeasure)
      const startAbs = fracAdd(measureStart, span.startBeat)
      const endAbs = fracAdd(starts.get(span.endMeasure) ?? measureStart, span.endBeat)

      for (const line of new Set(covered.map(p => p.line))) {
        const here = covered.filter(p => p.line === line)
        items.push({
          key: hairpinLineKey(hairpin.id, line),
          line,
          staffId,
          placement: placementSide,
          // ⚠️ The FRAGMENT chains on its own system, but it is addressed by the WHOLE wedge's
          // span: what it touches at a system edge is whatever the wedge itself reaches, and
          // clipping the range to the system would stop it chaining with the mark it runs into.
          start: startAbs,
          end: endAbs,
          baseline: dynamicsLineBaseline(
            hairpinBand(here, span.startMeasure, span.startBeat, span.endMeasure, span.endBeat, staffId, staffIds[0]),
            placementSide,
            markInk,
          ),
        })
      }
    }
  }

  return levelDynamicsChains(items)
}
