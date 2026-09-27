/**
 * ⭐⭐ **HAIRPINS ON A SPINE** — port map #15 of `docs/plans/bent-staff-plan.md`, the first LINE span: a wedge
 * whose two arms FOLLOW the path, as the *Bike Ride* plate's hairpin follows the rim (§1).
 *
 * ⛔ Nothing re-decided — every rule is the page's `marks/dynamics/HairpinRenderer`, asked in the path's plane
 * `(s, depth)` instead of `(x, y)`:
 *
 * - **Where it runs** — Gould p. 104: from the left edge of the slot at its start beat to the left edge of the
 *   slot at its end beat (the bar's end when the music stops first), each end inset by `HAIRPIN.END_INSET`,
 *   then the hand's reshape (`hairpinEndpointOffset`, + along / + down).
 * - **How high** — the page's dynamics-line plan (`dynamicsLinePlan`, already run by `./spineMarks` over the
 *   spine's columns), keyed `hairpinLineKey(id, 0)`: the spine is one system.
 * - **Its shape** — `resolveHairpinShape` (the hand's mouth, else the length-aware one, the steepness cap),
 *   sized from the length DRAWN, measured along the wedge's own lane.
 * - **Broken for an interim dynamic** — Gould p. 107, the page's own `breakWedgeAtGaps` over the dynamics the
 *   spine placed ({@link SpineMarkInk}), and only where the two inks CLASH (`inksClash`).
 *
 * ⭐ **The arms follow the path on BOTH sides** — inside a loop too. ⚠️ Unlike a slur (`./spineCurves`, his
 * rule: rigid inside), a wedge's arm has no bow to invert: at a fixed depth it is simply a smaller parallel
 * arc, like a staff line. Each arm is sampled along `s` and stroked through the path's own points.
 *
 * ⚠️ Not here: a wedge across a closed spine's seam is skipped; hit boxes (plan §9).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio } from '@/engine/engrave/staff/staffSpine'
import { strokeSpineRun } from '@/engine/engrave/staff/spineLines'
import { hairpinLineSpaces } from '@/engine/layout/thinLineWeight'
import { hairpinApertureOverrideOf, hairpinEndpointOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { hairpinSpan } from '@/engine/models/hairpinOps'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { ChordRest, Fraction, Measure, Score } from '@/types/music'
import { fracCompare, fracGte } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { INK } from '@/engine/layout/spacingPadding'
import { hairpinLineKey, type DynamicsLinePlan } from '../marks/dynamics/dynamicsLinePlan'
import { hairpinAxisOffsetSpaces } from '../marks/dynamics/HairpinRenderer'
import { HAIRPIN, fragmentOpening, resolveHairpinShape } from '../marks/dynamics/hairpinShape'
import { breakWedgeAtGaps, inksClash, rampAt, type InkBand, type WedgeGap } from '../marks/dynamics/hairpinBreaks'
import type { SpineBar } from './spineSpacing'

/** The class every wedge's group carries — what a spec finds them by. */
export const SPINE_HAIRPIN_CLASS = 'spine-hairpin'

/** A dynamic as the spine drew it: where its ink runs along the path, and across it (px below the top line). */
export interface SpineMarkInk {
  sLeft: number
  sRight: number
  band: InkBand
}

/** One bar of the staff, as `./spineMarks` has it: the staff's lane of the bar, and where the bar stands. */
export interface SpineHairpinBar {
  view: Measure
  bar: SpineBar
}

/**
 * Draw every hairpin of staff `staffIndex` along `spine`. `plan` is the dynamics line `./spineMarks` planned
 * over the same bars; `marks` the dynamics it drew there — what a wedge is broken for.
 */
export function drawSpineHairpins(
  ctx: DrawContext, spine: Spine, score: Score, bars: readonly SpineHairpinBar[], staffIndex: number,
  plan: DynamicsLinePlan, marks: readonly SpineMarkInk[],
): void {
  const byNumber = new Map(bars.map(b => [b.view.number, b]))
  // ⭐ A span belongs to where it BEGINS, so each wedge is listed once — by the bar it starts in.
  for (const measure of score.measures) {
    for (const hairpin of measure.hairpins ?? []) {
      if (staffIndexOfId(score, hairpin.staffId) !== staffIndex) continue
      const span = hairpinSpan(score, hairpin.id)
      const from = span && byNumber.get(span.startMeasure)
      const to = span && byNumber.get(span.endMeasure)
      const baseline = plan.get(hairpinLineKey(hairpin.id, 0))
      if (!span || !from || !to || baseline === undefined) continue

      // ── Where it runs, along the path ──
      const rawStart = slotLeftS(from, span.startBeat)
      const rawEnd = fracCompare(span.endBeat, measureCapacityFrac(to.view)) < 0 ? slotLeftS(to, span.endBeat) : to.bar.end
      if (rawStart === undefined || rawEnd === undefined || !(rawEnd > rawStart)) continue
      // The wedge's AXIS — the plan's baseline, lifted to the middle of a dynamic's ink (the page's rule).
      const axis = (baseline + hairpinAxisOffsetSpaces()) * STAFF_SPACE_PX
      // ⭐ A lane distance at that depth is `1 / ratio` of `s` (the letters' rule, `./spineMarks`).
      const ratio = innerLengthRatio(spine, axis)
      const alongS = (spaces: number) => (spaces * STAFF_SPACE_PX) / ratio
      const nudge = hairpinEndpointOffsetOverrideOf(score, hairpin.id)
      let startS = rawStart + alongS(HAIRPIN.END_INSET) + alongS(nudge?.start?.x ?? 0)
      let endS = rawEnd - alongS(HAIRPIN.END_INSET) + alongS(nudge?.end?.x ?? 0)
      // Never past each other — a sliver rather than a wedge turned inside out (the page's rescue).
      if (endS <= startS) {
        startS = rawStart
        endS = Math.max(rawEnd, startS + alongS(1))
      }

      // ── Its shape, sized from the length DRAWN — along its own lane ──
      const lengthSpaces = ((endS - startS) * ratio) / STAFF_SPACE_PX
      const shape = resolveHairpinShape(hairpinApertureOverrideOf(score, hairpin.id), lengthSpaces)
      if (!(shape.aperture > 0)) continue
      const open = fragmentOpening('single', hairpin.type)
      const startNudge = (nudge?.start?.y ?? 0) * STAFF_SPACE_PX
      const endNudge = (nudge?.end?.y ?? 0) * STAFF_SPACE_PX
      /** The wedge's centre and half-opening at `t` (0 → 1 over the whole wedge), px across the path. */
      const at = (t: number) => ({
        centre: axis + rampAt(shape.startY, shape.endY, t) * STAFF_SPACE_PX + rampAt(startNudge, endNudge, t),
        half: (shape.aperture * rampAt(open.start, open.end, t) * STAFF_SPACE_PX) / 2,
      })

      // ── Broken for an interim dynamic — only where the two inks clash (Gould p. 107) ──
      const pad = alongS(HAIRPIN.BREAK_PADDING)
      const gaps: WedgeGap[] = marks.flatMap(mark => {
        const middle = (mark.sLeft + mark.sRight) / 2
        const t = (middle - startS) / (endS - startS)
        if (t < 0 || t > 1) return []
        const { centre, half } = at(t)
        if (!inksClash({ top: centre - half, bottom: centre + half }, mark.band)) return []
        return [{ line: 0, left: mark.sLeft - pad, right: mark.sRight + pad }]
      })
      const segments = breakWedgeAtGaps([{ x0: startS, x1: endS, line: 0, role: 'single' }], gaps, alongS(HAIRPIN.MIN_FRAGMENT))

      ctx.openGroup(SPINE_HAIRPIN_CLASS, `hairpin-${hairpin.id}`)
      try {
        ctx.setLineWidth(hairpinLineSpaces() * STAFF_SPACE_PX)
        for (const segment of segments) {
          for (const sign of [-1, 1]) {
            strokeSpineRun(ctx, spine, segment.x0, segment.x1, s => {
              const { centre, half } = at((s - startS) / (endS - startS))
              return centre + sign * half
            })
          }
        }
      } finally {
        ctx.closeGroup()
      }
    }
  }
}

/**
 * ⭐ The LEFT edge of the slot a wedge's end addresses — exactly at `beat`, else the next one (the page's
 * fall-forward, every voice of the staff, ordered by beat then voice); undefined past the bar's last.
 */
function slotLeftS({ view, bar }: SpineHairpinBar, beat: Fraction): number | undefined {
  const lane = [...view.slots].sort((a, b) => fracCompare(a.beat, b.beat) || voiceOf(a) - voiceOf(b))
  const hit = lane.find(slot => fracGte(slot.beat, beat))
  return hit ? slotCentreS(bar, hit) - (INK.notehead / 2) * STAFF_SPACE_PX : undefined
}

/** `s` of a slot's head centre — a whole-bar rest stands in the MIDDLE of its bar, as on the page. */
function slotCentreS(bar: SpineBar, slot: ChordRest): number {
  return slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
}
