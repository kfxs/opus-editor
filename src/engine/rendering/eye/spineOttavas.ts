/**
 * ⭐⭐ **OCTAVE LINES ON A SPINE** — port map #15 of `docs/plans/bent-staff-plan.md`: the numeral a rigid piece,
 * the dashed line and its hook drawn ALONG the path (`engrave/staff/spineLines.strokeSpineRun`), as a
 * hairpin's arms are (`./spineHairpins`).
 *
 * ⛔ Nothing re-decided — the page's `marks/lines/OttavaRenderer`, asked in the path's plane:
 *
 * - **How far out** — the page's own planner (`planOttavaBands`), run over the spine's columns BEFORE the
 *   dynamics line, so it takes its rung on the LADDER (Gould p. 101: octave signs closer to the notes than
 *   dynamics) and files the claim the dynamics and the tempo row then clear. Up = above, down = below.
 * - **Where it runs** — from its first covered note's head LEFT to its last one's head RIGHT, plus
 *   `OTTAVA_END_AIR`; the hand's `ottavaOffset` (start / end along, `outward` away from the staff).
 * - **Its ink** — the page's numeral (`drawOttavaNumeral`), `OTTAVA_NUMERAL_GAP`, the dashes
 *   (`OTTAVA_DASH_LENGTH` / `_GAP`, the thin line weight) raised by `OTTAVA_LINE_RAISE_*`, at least
 *   `OTTAVA_MIN_LINE` long, and the closing HOOK (`OTTAVA_HOOK`) toward the staff — square to the path.
 *
 * ⚠️ Not here: an octave line across a closed spine's seam is skipped; hit boxes (plan §9).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio, pointAt } from '@/engine/engrave/staff/staffSpine'
import { strokeSpineRun } from '@/engine/engrave/staff/spineLines'
import type { OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { INK } from '@/engine/layout/spacingPadding'
import { thinLineSpaces } from '@/engine/layout/thinLineWeight'
import { ottavaOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { ottavaSpan } from '@/engine/models/ottavaOps'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { ChordRest, Measure, Score } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { barSlice } from '../marks/lines/bracketSpanBand'
import { drawOttavaNumeral, ottavaBandKey, planOttavaBands } from '../marks/lines/OttavaRenderer'
import {
  OTTAVA_DASH_GAP, OTTAVA_DASH_LENGTH, OTTAVA_END_AIR, OTTAVA_HOOK, OTTAVA_LINE_RAISE_ABOVE,
  OTTAVA_LINE_RAISE_BELOW, OTTAVA_MIN_LINE, OTTAVA_NUMERAL_GAP,
} from '../marks/lines/ottavaStyle'
import { drawSpinePiece } from './spinePieces'
import type { SpineBar } from './spineSpacing'

/** The class every octave line's group carries — what a spec finds them by. */
export const SPINE_OTTAVA_CLASS = 'spine-ottava'

/** One bar of the staff: its lane, and where the bar stands on the path. */
export interface SpineOttavaBar {
  view: Measure
  bar: SpineBar
}

/** Where each octave line of staff `staffIndex` sits, as the page's planner answers it — its claims filed on `occupied`. */
export type SpineOttavaPlan = Map<string, number>

/**
 * ⭐ The page's planner over the spine's bars — the spine is ONE system (line 0). Run BEFORE the dynamics
 * line: the claims it files on `occupied` are what that line (and the tempo row) clear.
 */
export function planSpineOttavas(
  score: Score, bars: readonly SpineOttavaBar[], staffIds: readonly (string | undefined)[], staffIndex: number,
  occupied: OccupiedSpan[],
): SpineOttavaPlan {
  return planOttavaBands(
    { occupiedBands: occupied }, score,
    bars.map(({ view, bar }) => ({ view, measureNumber: view.number, staffIndex, line: 0, system: { columns: [...bar.columns] } })),
    staffIds,
  )
}

/** Draw every octave line of staff `staffIndex` along `spine`, where `plan` put it. */
export function drawSpineOttavas(
  ctx: DrawContext, spine: Spine, score: Score, bars: readonly SpineOttavaBar[],
  staffIds: readonly (string | undefined)[], staffIndex: number, plan: SpineOttavaPlan,
): void {
  const headHalf = (INK.notehead / 2) * STAFF_SPACE_PX
  for (const measure of score.measures) {
    for (const ottava of measure.ottavas ?? []) {
      if ((ottava.staffId ?? staffIds[0]) !== (staffIds[staffIndex] ?? staffIds[0])) continue
      const span = ottavaSpan(score, ottava.id)
      const baseline = plan.get(ottavaBandKey(ottava.id, 0))
      if (!span || baseline === undefined) continue
      const covered = bars.filter(b => b.view.number >= span.startMeasure && b.view.number <= span.endMeasure)
        .sort((a, b) => a.view.number - b.view.number)
      // ── Where it runs: the first covered head's LEFT, the last one's RIGHT ──
      const heads = covered.flatMap(b => coveredSlots(b, span).map(slot => slotCentreS(b.bar, slot)))
      if (heads.length === 0) continue
      const side: 'above' | 'below' = ottava.shift > 0 ? 'above' : 'below'
      const nudge = ottavaOffsetOverrideOf(score, ottava.id)
      const lift = (nudge?.outward ?? 0) * (side === 'above' ? -1 : 1)
      const y = (baseline + lift) * STAFF_SPACE_PX
      const lineY = y - (side === 'above' ? OTTAVA_LINE_RAISE_ABOVE : OTTAVA_LINE_RAISE_BELOW) * STAFF_SPACE_PX
      // A lane distance at that depth is `1 / ratio` of `s` (the letters' rule, `./spineMarks`).
      const ratio = innerLengthRatio(spine, lineY)
      const alongS = (spaces: number) => (spaces * STAFF_SPACE_PX) / ratio
      const startS = heads[0] - headHalf + alongS(nudge?.startX ?? 0)
      const endS = heads[heads.length - 1] + headHalf + alongS(OTTAVA_END_AIR) + alongS(nudge?.endX ?? 0)

      ctx.openGroup(SPINE_OTTAVA_CLASS, `ottava-${ottava.id}`)
      try {
        // ── The numeral — a rigid piece, turned where it stands ──
        const width = drawSpinePiece(ctx, spine, startS, ratio, () => drawOttavaNumeral(ctx, 0, y, ottava.shift, false))
        // ── The dashes, along the path, and the hook at their end, square to it ──
        const lineStart = startS + (width + OTTAVA_NUMERAL_GAP * STAFF_SPACE_PX) / ratio
        const lineEnd = Math.max(endS, lineStart + alongS(OTTAVA_MIN_LINE))
        ctx.setLineWidth(thinLineSpaces() * STAFF_SPACE_PX)
        ctx.setLineDash([OTTAVA_DASH_LENGTH * STAFF_SPACE_PX, OTTAVA_DASH_GAP * STAFF_SPACE_PX])
        strokeSpineRun(ctx, spine, lineStart, lineEnd, () => lineY)
        ctx.setLineDash([])
        const hookTo = lineY + (side === 'above' ? 1 : -1) * OTTAVA_HOOK * STAFF_SPACE_PX
        const a = pointAt(spine, lineEnd, lineY)
        const b = pointAt(spine, lineEnd, hookTo)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      } finally {
        ctx.closeGroup()
      }
    }
  }
}

/** The slots of one bar the span covers, in beat order — the page's `coveredSlots`. */
function coveredSlots({ view }: SpineOttavaBar, span: Parameters<typeof barSlice>[1]): ChordRest[] {
  const { from, to } = barSlice({ view, measureNumber: view.number }, span)
  return view.slots
    .filter(slot => fracCompare(slot.beat, from) >= 0 && fracCompare(slot.beat, to) < 0)
    .sort((a, b) => fracCompare(a.beat, b.beat))
}

/** `s` of a slot's head centre — a whole-bar rest stands in the MIDDLE of its bar, as on the page. */
function slotCentreS(bar: SpineBar, slot: ChordRest): number {
  return slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
}
