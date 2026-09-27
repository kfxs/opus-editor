/**
 * ⭐⭐ **PEDAL MARKS ON A SPINE** — port map #15 of `docs/plans/bent-staff-plan.md`: the *Ped.* sign where the
 * pedal goes down and the release sign where it comes up, each a rigid piece on the pedal's lane, turned
 * where it stands (`./spinePieces`).
 *
 * ⛔ Nothing re-decided — the page's `marks/lines/PedalRenderer`, asked in the path's plane:
 *
 * - **Where** — down at the left edge of the slot at its start beat (a whole-bar rest: the bar's music start,
 *   `layout/measureRestOnset`'s rule), up at the slot at its end beat, else `PEDAL_BARLINE_AIR` short of the
 *   bar's end; the release at least `PEDAL_SIGN_GAP` past the *Ped.* and the pair at least `PEDAL_MIN_SPAN`
 *   wide; the hand's `pedalOffset` (start / end along, `y` + down).
 * - **How far out** — the OUTERMOST rung below the staff: the page's `bracketBaseline` over the music AND
 *   everything the ladder has claimed there (the octave line, the dynamics, the hairpins), then its own
 *   claim (`pedalFragmentClaim`) — so it runs AFTER the dynamics (Gould's order, the page's pass order).
 *
 * ⚠️ Not here: a release WRAPPED onto the next system (`pedalReleaseWrap` — the spine is one system); hit
 * boxes (plan §9).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio } from '@/engine/engrave/staff/staffSpine'
import { measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { INK } from '@/engine/layout/spacingPadding'
import { pedalOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { pedalSpan } from '@/engine/models/pedalOps'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { Fraction, Measure, Score } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { pedalDrawStaff } from '@/utils/pedalScope'
import { bracketBaseline } from '../marks/lines/bracketSpanBand'
import { drawPedalSign, pedalFragmentClaim } from '../marks/lines/PedalRenderer'
import {
  PEDAL_BARLINE_AIR, PEDAL_GLYPH_SIZE, PEDAL_LINE, PEDAL_MARK_INK, PEDAL_MIN_SPAN, PEDAL_SIGN_GAP, PEDAL_UP_GLYPH,
} from '../marks/lines/pedalStyle'
import { drawGlyph, measureGlyph } from '../painter/glyphPainter'
import { drawSpinePiece } from './spinePieces'
import type { SpineBar } from './spineSpacing'

/** The class every pedal's group carries — what a spec finds them by. */
export const SPINE_PEDAL_CLASS = 'spine-pedal'

/** One bar of the staff: its lane, and where the bar stands on the path. */
export interface SpinePedalBar {
  view: Measure
  bar: SpineBar
}

/**
 * Draw every pedal of staff `staffIndex` along `spine`, each on the ladder's outermost rung below the staff —
 * clearing, and then adding to, `occupied`.
 */
export function drawSpinePedals(
  ctx: DrawContext, spine: Spine, score: Score, bars: readonly SpinePedalBar[],
  staffIds: readonly (string | undefined)[], staffIndex: number, occupied: OccupiedSpan[],
): void {
  const byNumber = new Map(bars.map(b => [b.view.number, b]))
  const starts = measureStartOffsets(score)
  const staffId = staffIds[staffIndex]
  for (const measure of score.measures) {
    for (const pedal of measure.pedals ?? []) {
      if ((pedalDrawStaff(score, pedal) ?? staffIds[0]) !== (staffId ?? staffIds[0])) continue
      const span = pedalSpan(score, pedal.id)
      const from = span && byNumber.get(span.startMeasure)
      const to = span && byNumber.get(span.endMeasure)
      if (!span || !from || !to) continue
      const startS = slotLeftAtOrAfter(from, span.startBeat)
      const upAt = slotLeftAtOrAfter(to, span.endBeat)
      if (startS === undefined) continue

      // ── How far out: the music and every rung already claimed there ──
      const here = bars
        .filter(b => b.view.number >= span.startMeasure && b.view.number <= span.endMeasure)
        .map(b => ({ view: b.view, measureNumber: b.view.number, system: { columns: [...b.bar.columns] } }))
      const baseline = bracketBaseline(occupied, here, span, { line: 0, staffId, side: 'below' }, staffIds[0], starts,
        { ink: PEDAL_MARK_INK, clearance: PEDAL_LINE })
      const claim = pedalFragmentClaim(here, span, 0, staffId, baseline, starts)
      if (claim) occupied.push(claim)

      const nudge = pedalOffsetOverrideOf(score, pedal.id)
      const y = (baseline + (nudge?.y ?? 0)) * STAFF_SPACE_PX
      const ratio = innerLengthRatio(spine, y)
      const alongS = (px: number) => px / ratio
      const endS = upAt ?? to.bar.end - alongS(PEDAL_BARLINE_AIR * STAFF_SPACE_PX)

      ctx.openGroup(SPINE_PEDAL_CLASS, `pedal-${pedal.id}`)
      try {
        const signS = startS + alongS((nudge?.startX ?? 0) * STAFF_SPACE_PX)
        const downWidth = drawSpinePiece(ctx, spine, signS, ratio, () => drawPedalSign(ctx, 0, y, false))
        // The release: at the end, but never onto the *Ped.*, and the pair never narrower than its floor —
        // the page's `max`, in lane px from the sign.
        const upWidth = measureGlyph('PedalRenderer.up', PEDAL_UP_GLYPH, PEDAL_GLYPH_SIZE)
        const upLane = Math.max(
          (endS - signS) * ratio - upWidth + (nudge?.endX ?? 0) * STAFF_SPACE_PX,
          downWidth + PEDAL_SIGN_GAP * STAFF_SPACE_PX,
          PEDAL_MIN_SPAN * STAFF_SPACE_PX - upWidth,
        )
        drawSpinePiece(ctx, spine, signS + alongS(upLane), ratio,
          () => drawGlyph(ctx, 'PedalRenderer.up', PEDAL_UP_GLYPH, 0, y, PEDAL_GLYPH_SIZE))
      } finally {
        ctx.closeGroup()
      }
    }
  }
}

/**
 * The LEFT edge, along the path, of the first slot at-or-after `beat` in this bar — a whole-bar rest's onset
 * is the bar's music start (`layout/measureRestOnset`); undefined past the bar's last slot.
 */
function slotLeftAtOrAfter({ view, bar }: SpinePedalBar, beat: Fraction): number | undefined {
  const slot = [...view.slots]
    .filter(s => fracCompare(s.beat, beat) >= 0)
    .sort((a, b) => fracCompare(a.beat, b.beat))[0]
  if (!slot) return undefined
  if (slot.type === 'rest' && slot.isMeasureRest) return bar.musicStart
  return bar.columnAt(slot.beat) - (INK.notehead / 2) * STAFF_SPACE_PX
}
