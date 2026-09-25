/**
 * ⭐⭐ **TIES AND SLURS ON A SPINE** — port map #13 of `docs/plans/bent-staff-plan.md`, the first SPAN: a
 * curve between two placed notes, RE-SOLVED along the path.
 *
 * ## How
 *
 * Each note on the spine says where it stands ({@link SpineNotePlace}: its head's centre at `s`, its own
 * stave's px mapping to `s` along and `d` across). A curve's two ends are found with the PAGE's own rules —
 * the tie's inset endpoints and bow (`curves/tieEndpoints`, `tieStaffLineClearance`), the slur's attachment
 * and arch (`curves/slurStemEndpoint`, `slurArchHeight`) — in the note's stave px, then carried into the
 * path's plane `(s, d)`. The arc is then a `CurveArc` in that plane, and `engrave/curves/curveOnPath` draws
 * it — ⭐ HIS RULE (2026-09-25): OUTSIDE the loop it follows the circle (the lens bent through `pointAt`);
 * INSIDE it is the page's cubic between its two anchors, the circle forgotten (a rigid unit, like the
 * tuplet's bracket) — because inside, the lines bend away from the notes and a curve riding them is inverted.
 * ⛔ Nothing re-decided: which way a tie bows is `tieDirection.tieSide`, a slur's side
 * `slurDirection.slurSideFromStems` (or its `placement`).
 *
 * ## What is NOT here — yet
 *

 * - A slur's OBSTACLES (the covered notes' ink, accidentals, articulations), its nesting lift, its melodic
 *   tilt and slant limit. ⭐ Its HAND edits ARE applied (his ask, 2026-09-25): the per-end nudges, the shape,
 *   the whole-curve nudge — the page's `resolveCps` / `slurEndpointOffsetPx` / `slurOffsetPx`, in the page's
 *   order; and the tie's vertical nudge. ⚠️ The arch's LEAN with a tilted pair is the page's too, through
 *   `resolveCps` → `slurArchCps`.
 * - A tie or slur across the CLOSED spine's seam draws forward through it (`s` past `length` wraps on a
 *   circle) — fine on a circle, ⛔ not checked on an open spine.
 * - Registration, selection, the hit box: the panel cannot be clicked into (B3).
 */
import type { Score } from '@/types/music'
import { effectiveClefAt } from '@/utils/clefUtils'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import type { CurveArc, CurvePoint } from '@/engine/engrave/curves/curveInk'
import { drawCurveArcOnPath, drawCurveArcRigid, pathBendsTowardBow } from '@/engine/engrave/curves/curveOnPath'
import { curveFillGap } from '../curves/curveArc'
import { CURVE_PX } from '../curves/curveStyle'
import { tieSide } from '../curves/tieDirection'
import { tieEndpointX, tieEndpointY } from '../curves/tieEndpoints'
import { tieArcGrowth } from '../curves/tieStaffLineClearance'
import { slurSideFromStems } from '../curves/slurDirection'
import { slurAttachments } from '../curves/slurStemEndpoint'
import { resolveCps, slurEndpointOffsetPx, slurOffsetPx } from '../curves/SlurRenderer'
import { curveShapeOverrideOf, endpointOffsetOverrideOf, slurOffsetOverrideOf, tieOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { noteRuler } from '../engraved/noteRuler'
import { staveFrame, staveOf } from '../staff/staveFrame'
import type { SpineNotePlace } from './spineStaff'

/** A cubic's apex is 0.75 of its controls' height — `TieRenderer`'s own constant. */
const APEX_OF_BOW = 0.75

/** The class every curve's group carries — what a spec finds them by. */
export const SPINE_CURVE_CLASS = 'spine-curve'

/** One pitch as drawn: its slot's place on the path, and which head of the chord it is. */
export interface SpinePitchPlace {
  place: SpineNotePlace
  headIndex: number
  /** The bar it stands in, for the tie's direction rule. */
  measureNumber: number
}

/** A note's stave px → the path's plane. */
function toPath(place: SpineNotePlace): (x: number, y: number) => CurvePoint {
  return (x, y) => ({ x: place.s + (x - place.headCentreX), y: y - place.topLineY })
}

/** A curve running forward past a closed spine's seam keeps going — `s` beyond `length` wraps. */
function forward(spine: Spine, from: number, to: number): number {
  return spine.closed && to < from ? to + spine.length : to
}

/**
 * Draw every tie and every slur of `score`'s first staff whose two ends were drawn on the spine.
 * `pitches` is what the blocks placed, by pitch id.
 */
export function drawSpineCurves(ctx: DrawContext, spine: Spine, score: Score, pitches: Map<string, SpinePitchPlace>): void {
  const gap = curveFillGap(CURVE_PX.thickness)
  const outline = CURVE_PX.outline
  const draw = (cls: string, arc: CurveArc) => {
    // ⭐ HIS RULE (`curveOnPath`): OUTSIDE the loop the curve follows the circle; INSIDE it is drawn from
    //    its two anchors like a normal one, the circle forgotten — a rigid unit, like the tuplet's bracket.
    ctx.openGroup(SPINE_CURVE_CLASS, cls)
    try {
      if (pathBendsTowardBow(spine, arc)) drawCurveArcRigid(ctx, spine, arc, gap, outline)
      else drawCurveArcOnPath(ctx, spine, arc, gap, outline)
    } finally {
      ctx.closeGroup()
    }
  }

  // ── TIES — the page's `TieRenderer`, in the path's plane ──
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      for (const pitch of slot.notes) {
        if (!pitch.tiedTo) continue
        const from = pitches.get(pitch.id)
        const to = pitches.get(pitch.tiedTo)
        if (!from || !to) continue
        const fromRuler = noteRuler(from.place.note)
        const toRuler = noteRuler(to.place.note)
        const fromHeadY = fromRuler.headYs[from.headIndex] ?? fromRuler.headYs[0]
        const toHeadY = toRuler.headYs[to.headIndex] ?? toRuler.headYs[0]
        if (fromHeadY === undefined || toHeadY === undefined) continue
        const stems = [fromRuler.stemDirection, toRuler.stemDirection].filter((d): d is number => d !== undefined)
        const direction = tieSide(pitch, slot.beat, measure, effectiveClefAt(score, measure.number, slot.beat, slot.staffId), stems)
        const fromHead = { leftX: fromRuler.headLeftX, rightX: fromRuler.headRightX, headY: fromHeadY, headScale: fromRuler.glyphScale }
        const toHead = { leftX: toRuler.headLeftX, rightX: toRuler.headRightX, headY: toHeadY, headScale: toRuler.glyphScale }
        const y = tieEndpointY(fromHeadY, direction, fromHead.headScale)
        // A staff line alongside the arc makes it rounder (Gould p. 61) — the page's rule, on the note's stave.
        const frame = staveFrame(staveOf(from.place.note))
        const lineYs = Array.from({ length: frame.lineCount }, (_, line) => staffLineY(frame, line))
        const growth = tieArcGrowth({
          endpointY: y, apexRise: APEX_OF_BOW * CURVE_PX.tieBow,
          inkThickness: APEX_OF_BOW * CURVE_PX.thickness + CURVE_PX.outline, direction, lineYs,
        })
        const bow = CURVE_PX.tieBow + growth / APEX_OF_BOW
        // ⭐ The hand's vertical nudge (`TieOffsetOverride`, staff spaces, + down) — the page's `nudgeY`.
        const nudgeY = (tieOffsetOverrideOf(score, pitch.id)?.y ?? 0) * STAFF_SPACE_PX
        const p0 = toPath(from.place)(tieEndpointX(fromHead, 'from'), y + nudgeY)
        const p1 = toPath(to.place)(tieEndpointX(toHead, 'to'), y + nudgeY)
        p1.x = forward(spine, p0.x, p1.x)
        draw(`tie-${pitch.id}`, { p0, p1, cps: [{ x: 0, y: bow }, { x: 0, y: bow }], direction })
      }
    }
  }

  // ── SLURS — the page's `SlurRenderer`'s auto arch between its two attachments ──
  for (const slur of score.slurs ?? []) {
    const from = pitches.get(slur.startNoteId)
    const to = pitches.get(slur.endNoteId)
    if (!from || !to) continue
    const attachment = (p: SpinePitchPlace) => {
      const ruler = noteRuler(p.place.note)
      return {
        headYs: ruler.headYs,
        stemTipY: ruler.hasStem ? ruler.stemTipY : undefined,
        stemDirection: ruler.stemDirection ?? 1,
        headHalfWidth: (ruler.headRightX - ruler.headLeftX) / 2,
      }
    }
    const a = attachment(from)
    const b = attachment(to)
    const direction = slur.placement === 'above' ? -1 : slur.placement === 'below' ? 1 : slurSideFromStems([a.stemDirection, b.stemDirection])
    const lift = CURVE_PX.slurLift
    const ends = slurAttachments(a, b, direction, lift)
    // ⭐ The hand's THREE overrides, in the PAGE's order (`curves/SlurRenderer`, single arc): the per-END
    //    nudges move the anchors BEFORE the arch is solved (the arch is solved on the un-nudged ends, so a
    //    moved end keeps the engraver's shape); the SHAPE replaces the auto arch; the WHOLE-curve nudge is
    //    added LAST, translating the drawn curve rigidly (his rule: *"the arc conserve the same shape"*).
    const fromFrame = staveFrame(staveOf(from.place.note))
    const toFrame = staveFrame(staveOf(to.place.note))
    const off = slurEndpointOffsetPx(endpointOffsetOverrideOf(score, slur.id), fromFrame, toFrame)
    const whole = slurOffsetOverrideOf(score, slur.id)
    const wholeFrom = slurOffsetPx(whole, fromFrame)
    const wholeTo = slurOffsetPx(whole, toFrame)
    const p0 = toPath(from.place)(from.place.headCentreX + ends.from.dx + off.startX, ends.from.y + off.startY + lift * direction)
    const p1 = toPath(to.place)(to.place.headCentreX + ends.to.dx + off.endX, ends.to.y + off.endY + lift * direction)
    p1.x = forward(spine, p0.x, p1.x)
    const autoP0 = { x: p0.x - off.startX, y: p0.y - off.startY }
    const autoP1 = { x: p1.x - off.endX, y: p1.y - off.endY }
    const cps = resolveCps(curveShapeOverrideOf(score, slur.id)?.cps, fromFrame, autoP0, autoP1, direction, 0)
    p0.x += wholeFrom.x; p0.y += wholeFrom.y
    p1.x += wholeTo.x; p1.y += wholeTo.y
    draw(`slur-${slur.id}`, { p0, p1, cps, direction })
  }
}
