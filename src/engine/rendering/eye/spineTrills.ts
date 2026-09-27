/**
 * ⭐⭐ **TRILLS ON A SPINE** — port map #15 of `docs/plans/bent-staff-plan.md`: the `tr` a rigid piece, and the
 * wavy extension a run of the page's wiggle glyphs laid ALONG the lane, each one turned where it stands — so
 * the line follows the path as a word's letters do (`./spineMarks`).
 *
 * ⛔ Nothing re-decided — the page's `marks/lines/TrillRenderer`, asked in the path's plane:
 *
 * - **Where it runs** — from the left edge of the trilled note (its voice) to the left edge of the NEXT note of
 *   that voice after the last trilled one, else the bar's end; `TRILL_END_INSET` short of that, never shorter
 *   than the inset past its start; the hand's `trillOffset` (start / end along, `outward` from the staff).
 * - **How far out** — the INNERMOST rung of the ladder: the music of the covered beats (`trillBarSlice` — the
 *   last bar runs to the note after), its own clearance (`TRILL_LINE`), and its claim (`trillFragmentClaim`)
 *   filed before the octave lines and the dynamics are placed.
 * - **Its ink** — `drawTrillSign`, `TRILL_SIGN_GAP`, then as many wiggles as fit (`round(width / unit)`), the
 *   slack shared between them — the page's `drawWiggle`. No line when `extension` is `'none'`.
 *
 * ⚠️ LEFT, named: the page's trill also clears the SLURS drawn under it (`curveObstacleBand` over
 * `drawnCurves`) — the spine does not record its curves as obstacles yet, so a trill over a slur may touch it;
 * a trill across a closed spine's seam; hit boxes (plan §9).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio } from '@/engine/engrave/staff/staffSpine'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand, type InkBand } from '@/engine/layout/inkBand'
import { measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { INK } from '@/engine/layout/spacingPadding'
import { trillOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { trillSpan } from '@/engine/models/trillOps'
import type { Fraction, Measure, Score } from '@/types/music'
import { fracCompare, fracGt } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { drawTrillSign, trillBarSlice, trillFragmentClaim } from '../marks/lines/TrillRenderer'
import {
  TRILL_END_INSET, TRILL_GLYPH_SIZE, TRILL_LINE, TRILL_MARK_INK, TRILL_SIGN_GAP, TRILL_WIGGLE_GLYPH,
} from '../marks/lines/trillStyle'
import { drawGlyph, measureGlyph } from '../painter/glyphPainter'
import { drawSpinePiece } from './spinePieces'
import type { SpineBar } from './spineSpacing'

/** The class every trill's group carries — what a spec finds them by. */
export const SPINE_TRILL_CLASS = 'spine-trill'

/** One bar of the staff: its lane, and where the bar stands on the path. */
export interface SpineTrillBar {
  view: Measure
  bar: SpineBar
}

/** Where each trill of the staff sits (its baseline, staff spaces below the top line), by id. */
export type SpineTrillPlan = Map<string, number>

/**
 * ⭐ The trills' rung — the INNERMOST of the ladder, so planned FIRST: each one's baseline over the music it
 * covers, and its claim filed on `occupied` for the octave lines and the dynamics to clear.
 */
export function planSpineTrills(
  score: Score, bars: readonly SpineTrillBar[], staffIds: readonly (string | undefined)[], staffIndex: number,
  occupied: OccupiedSpan[],
): SpineTrillPlan {
  const plan: SpineTrillPlan = new Map()
  const starts = measureStartOffsets(score)
  const staffId = staffIds[staffIndex]
  for (const trill of score.trills ?? []) {
    const span = trillSpan(score, trill.id)
    if (!span || !onThisStaff(bars, span)) continue
    const voice = voiceOf(trill)
    const side = trill.placement ?? 'above'
    const here = coveredBars(bars, span).map(b => ({ view: b.view, measureNumber: b.view.number }))
    let music: InkBand | null = null
    for (const b of coveredBars(bars, span)) {
      const { from, to } = trillBarSlice({ view: b.view, measureNumber: b.view.number }, span, voice)
      music = mergeInkBands(music, staffInkBand(columnsBetween(b.bar.columns, from, to), staffId, staffIds[0]))
    }
    const baseline = clearanceBaseline(music, side, TRILL_MARK_INK, TRILL_LINE)
    plan.set(trill.id, baseline)
    const claim = trillFragmentClaim(here, span, voice, 0, staffId, side, baseline, starts)
    if (claim) occupied.push(claim)
  }
  return plan
}

/** Draw every trill of the staff along `spine`, where `plan` put it. */
export function drawSpineTrills(
  ctx: DrawContext, spine: Spine, score: Score, bars: readonly SpineTrillBar[], plan: SpineTrillPlan,
): void {
  const byNumber = new Map(bars.map(b => [b.view.number, b]))
  for (const trill of score.trills ?? []) {
    const span = trillSpan(score, trill.id)
    const baseline = plan.get(trill.id)
    const from = span && byNumber.get(span.startMeasure)
    const to = span && byNumber.get(span.endMeasure)
    if (!span || baseline === undefined || !from || !to) continue
    const voice = voiceOf(trill)
    const side = trill.placement ?? 'above'
    const nudge = trillOffsetOverrideOf(score, trill.id)
    const lift = (nudge?.outward ?? 0) * (side === 'above' ? -1 : 1)
    const y = (baseline + lift) * STAFF_SPACE_PX
    const ratio = innerLengthRatio(spine, y)
    const alongS = (spaces: number) => (spaces * STAFF_SPACE_PX) / ratio

    // ── Where it runs: the trilled note's left edge → the next note's (or the bar's end), inset ──
    const rawStart = slotLeftS(from, voice, span.startBeat, false)
    const rawEnd = slotLeftS(to, voice, span.endBeat, true) ?? to.bar.end
    if (rawStart === undefined) continue
    const startS = rawStart + alongS(nudge?.startX ?? 0)
    const endS = Math.max(rawEnd - alongS(TRILL_END_INSET), rawStart + alongS(TRILL_END_INSET)) + alongS(nudge?.endX ?? 0)

    ctx.openGroup(SPINE_TRILL_CLASS, `trill-${trill.id}`)
    try {
      const signWidth = drawSpinePiece(ctx, spine, startS, ratio, () => drawTrillSign(ctx, 0, y, false))
      const lineStart = startS + (signWidth + TRILL_SIGN_GAP * STAFF_SPACE_PX) / ratio
      if (trill.extension !== 'none' && endS > lineStart) drawWiggleAlong(ctx, spine, lineStart, endS, y, ratio)
    } finally {
      ctx.closeGroup()
    }
  }
}

/**
 * The page's `drawWiggle` along the lane: as many wiggle glyphs as fit between `from` and `to` (`s`), the slack
 * shared between them — each one a rigid piece, turned where it stands.
 */
function drawWiggleAlong(ctx: DrawContext, spine: Spine, from: number, to: number, y: number, ratio: number): void {
  const size = (TRILL_GLYPH_SIZE / 10) * STAFF_SPACE_PX
  const unit = measureGlyph('TrillRenderer.wiggle', TRILL_WIGGLE_GLYPH, size)
  if (!(unit > 0)) return
  const width = (to - from) * ratio
  const count = Math.max(1, Math.round(width / unit))
  const slack = count > 1 ? (width - count * unit) / (count - 1) : 0
  for (let i = 0; i < count; i++) {
    drawSpinePiece(ctx, spine, from + (i * (unit + slack)) / ratio, ratio,
      () => drawGlyph(ctx, 'TrillRenderer.wiggle', TRILL_WIGGLE_GLYPH, 0, y, size))
  }
}

/** Is the trill's first slot on THIS staff's lane? (A trill is found by its note, as on the page.) */
function onThisStaff(bars: readonly SpineTrillBar[], span: { startMeasure: number; slotIds: readonly string[] }): boolean {
  const bar = bars.find(b => b.view.number === span.startMeasure)
  return !!bar && bar.view.slots.some(slot => slot.id === span.slotIds[0])
}

function coveredBars(bars: readonly SpineTrillBar[], span: { startMeasure: number; endMeasure: number }): SpineTrillBar[] {
  return bars.filter(b => b.view.number >= span.startMeasure && b.view.number <= span.endMeasure)
}

/**
 * The LEFT edge of the voice's slot at-or-after `beat` — or, `after`, strictly after it (the note that follows
 * the last trilled one); undefined when there is none in this bar.
 */
function slotLeftS({ view, bar }: SpineTrillBar, voice: number, beat: Fraction, after: boolean): number | undefined {
  const slot = view.slots
    .filter(s => voiceOf(s) === voice && (after ? fracGt(s.beat, beat) : fracCompare(s.beat, beat) >= 0))
    .sort((a, b) => fracCompare(a.beat, b.beat))[0]
  if (!slot) return undefined
  const centre = slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
  return centre - (INK.notehead / 2) * STAFF_SPACE_PX
}
