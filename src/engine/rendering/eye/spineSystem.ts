/**
 * ⭐⭐ **WHAT JOINS THE STAVES OF A SYSTEM, ON A SPINE** — port map #12 of `docs/plans/bent-staff-plan.md`:
 * the BOUNDARIES every staff shares, the barline through the gap between two joined staves, and the signs
 * at the system's start (the systemic line, the brace, the bracket).
 *
 * ⭐ Everything here is a RIGID BLOCK standing ACROSS the path — square to it, on the radius where it
 * stands — so a line joining two staves is straight, as the page's is vertical: the staves are the same
 * path at other depths (`./spineStaves`), and a boundary stands at one ANGLE on all of them.
 *
 * ⭐ The ink is the PAGE's: the gap's strokes are the sign's own (`layout/barlineSign.barlineSignParts`,
 * ⛔ never the dots — `staff/barlineGap`'s rule), WHETHER a gap is joined is the model's
 * (`models/barlineJoin`), and the start signs are `staff/systemStart`'s painters, laid out by the page's
 * `layout/systemStartColumn`.
 *
 * ⚠️ Placeholders, named: a sign on a staff of another SIZE is not handled (every staff is full size on
 * the spine); nothing registers a hit box (the panel is not clicked into yet, plan §9).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { placementAt } from '@/engine/engrave/staff/staffSpine'
import { staffBottomLineY, staffLineY } from '@/engine/engrave/staff/staffFrame'
import { staffLineInkBottomY, staffLineInkTopY, staveLineWidthPx } from '@/engine/engrave/staff/staffLines'
import { HEADER_TO_REPEAT, barlineSignExtent, barlineSignParts, type BarlineSignKind } from '@/engine/layout/barlineSign'
import { scoreSystemStartIndentPx, systemStartColumn } from '@/engine/layout/systemStartColumn'
import { barlineJoinsBelow } from '@/engine/models/barlineJoin'
import { signAtBoundary } from '@/engine/models/boundarySign'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { groupsAt } from '@/engine/models/staffGroups'
import type { Score } from '@/types/music'
import { drawGroupOf } from '../painter/svgDrawGroup'
import { boundaryWinged } from '../staff/BarlineRenderer'
import { staffBarlineExtent } from '../staff/barlineInk'
import { paintBrace, paintBracket, paintSubBracket, paintSystemConnector } from '../staff/systemStart'
import { type SpineHeader, spineHeaderColumns } from './spineHeader'
import type { SpineAdjustments } from './spineAdjustments'
import { spineSignShift } from './spineSignSpace'
import type { SpineBar } from './spineSpacing'
import { SPINE_BLOCK_CLASS, blockFrame } from './spineStaff'
import type { SpineStaff } from './spineStaves'

/** One barline SIGN of the system, along the REFERENCE path — every staff draws it at `s × ratio`. */
export interface SpineBoundary {
  s: number
  kind: BarlineSignKind
  wings: boolean
  /**
   * ⭐ The bar this line ENDS — what a click selects (the editor's `{ kind: 'barline', measure }`), or null when
   * the sign stands at no boundary (a `|:` at the system's start, or displaced past a header — the page's rule,
   * `staff/barlineGap.BarlineGap.endsMeasure`).
   */
  endsMeasure: number | null
}

/** ⭐ The attribute a barline's blocks carry: the bar the line ENDS — what a click in the panel selects (plan §9). */
export const SPINE_BARLINE_ATTR = 'data-spine-barline'

/**
 * ⭐ Every sign the system's boundaries carry, in the reference path's `s`.
 * WHICH sign is the SCORE's answer (`models/boundarySign`) — final, either repeat, the back-to-back `:||:`
 * from the two bars that meet there — as on the page. ⚠️ The spine is ONE system, so the only opening edge
 * is bar 1's: a `|:` there stands at the bar's own start (its room is in the lead-in, `./spineSpacing`).
 * ⭐ A `|:` on a bar that draws a HEADER stands AFTER it (Gould p. 234, the page's `displacedRepeatX`), and
 * the boundary behind it keeps the sign the bar before it ends with. The header is laid out on the
 * innermost staff (`innermost` = its ratio), so the `|:` after it is that far along there — the same
 * angle on every staff.
 */
export function spineBoundaries(
  score: Score, bars: readonly SpineBar[], headers: readonly (SpineHeader | undefined)[][], innermost: number,
  adjust?: SpineAdjustments,
): SpineBoundary[] {
  const out: SpineBoundary[] = []
  score.measures.forEach((measure, i) => {
    const bar = bars[i]
    const systemHeader = headers[i].some(Boolean)
    if (measure.repeatStart !== undefined && (i === 0 || systemHeader)) {
      const after = spineHeaderColumns(headers[i], spineSignShift(adjust?.signSpace, measure.id, STAFF_SPACE_PX)).width + (HEADER_TO_REPEAT + barlineSignExtent('repeatStart').left) * STAFF_SPACE_PX
      out.push({ s: systemHeader ? bar.start + after / innermost : bar.start, kind: 'repeatStart', wings: boundaryWinged(undefined, measure), endsMeasure: null })
    }
    const next = score.measures[i + 1]
    const nextDisplaced = next?.repeatStart !== undefined && (headers[i + 1]?.some(Boolean) ?? false)
    const kind = signAtBoundary(measure, nextDisplaced ? { ...next, repeatStart: undefined } : next)
    if (kind) out.push({ s: bar.end, kind, wings: boundaryWinged(measure, nextDisplaced ? undefined : next), endsMeasure: measure.number })
  })
  return out
}

/**
 * ⭐ **THE BARLINE THROUGH A JOINED GAP** (the page's `staff/barlineGap`): below every staff whose gap the
 * model joins, at every boundary, the sign's STROKES run from that staff's bottom line to the next one's
 * top — each line's MIDDLE, as the barlines above and below stop (`engrave/staff/barlineExtent`), so the
 * three pieces are one line. A block on the upper staff's path, square to it.
 */
export function drawSpineBarlineGaps(
  ctx: DrawContext, score: Score, staves: readonly SpineStaff[], boundaries: readonly SpineBoundary[],
): void {
  const extent = staffBarlineExtent(blockFrame())
  staves.forEach((staff, k) => {
    const below = staves[k + 1]
    if (!below || !barlineJoinsBelow(score, staff.id)) return
    const top = extent.bottomY
    const bottom = below.top - staff.top + extent.topY
    if (!(bottom > top)) return
    for (const { s, kind, endsMeasure } of boundaries) {
      if (kind === 'invisible') continue
      const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
      if (endsMeasure !== null) group?.tag(SPINE_BARLINE_ATTR, String(endsMeasure))
      try {
        for (const stroke of barlineSignParts(kind).strokes) {
          ctx.fillRect(stroke.x * STAFF_SPACE_PX, top, stroke.width * STAFF_SPACE_PX, bottom - top)
        }
      } finally {
        ctx.closeGroup()
      }
      group?.setPlacement(placementAt(staff.spine, s * staff.ratio))
    }
  })
}

/**
 * ⭐ **THE SIGNS AT THE SYSTEM'S START** (the page's `staff/systemStart`): the systemic line joining the top
 * staff to the bottom one (two staves or more, and only with a brace or bracket — see below), then each group's brace or bracket to its left, placed by
 * `layout/systemStartColumn` — one block at `s = 0`, square to the path, where the header begins.
 */
export function drawSpineSystemStart(ctx: DrawContext, score: Score, staves: readonly SpineStaff[]): void {
  const first = score.measures[0]
  const top = staves[0]
  if (!first || !top) return
  const frame = blockFrame()
  const extent = staffBarlineExtent(frame)
  const lineWidth = staveLineWidthPx()
  // Where each staff's ink begins and ends ACROSS the block — its depth below the top staff, plus its lines.
  const inkTop = (k: number) => staves[k].top + staffLineInkTopY(staffLineY(frame, 0), lineWidth)
  const inkBottom = (k: number) => staves[k].top + staffLineInkBottomY(staffBottomLineY(frame), lineWidth)
  const { signs, joins } = systemStartSigns(score, staves)
  if (!joins && signs.length === 0) return
  const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
  try {
    const last = staves[staves.length - 1]
    if (joins) paintSystemConnector(ctx, 0, extent.topY, last.top + extent.bottomY)
    for (const sign of signs) {
      const leftX = -sign.leftSpaces * STAFF_SPACE_PX
      const from = inkTop(sign.group.topStaffIndex)
      const to = inkBottom(sign.group.bottomStaffIndex)
      const id = `spine-${sign.group.symbol}-${sign.group.group.id}`
      if (sign.group.symbol === 'bracket') paintBracket(ctx, sign, leftX, from, to, id)
      else if (sign.group.symbol === 'subBracket') paintSubBracket(ctx, sign, leftX, from, to, id)
      else paintBrace(ctx, sign, leftX, from, to, id)
    }
  } finally {
    ctx.closeGroup()
  }
  group?.setPlacement(placementAt(top.spine, 0))
}

/**
 * What stands at the system's start: the groups' signs, and whether the systemic line is drawn.
 * ⭐ HIS RULE for the spine (2026-09-27): the systemic line is drawn only with a BRACE or a BRACKET — ⛔ not
 * for joined barlines, which run through the gaps of a closed loop and need no start (*"conect barlines dont
 * open the circle either (that means no staff conector either), the circle is closed only if brace brackets
 * are there"*). ⚠️ The PAGE draws it for every system of two staves or more (Gould p. 516); the two differ
 * on purpose until he says otherwise.
 */
function systemStartSigns(score: Score, staves: readonly SpineStaff[]) {
  const first = score.measures[0]
  const signs = first ? systemStartColumn(groupsAt(score, first.number)).signs : []
  return { signs, joins: staves.length > 1 && signs.length > 0 }
}

/**
 * ⭐ Does anything stand at the system's start? When nothing does, a CLOSED path stays closed — its lines
 * run the whole way round (his word, 2026-09-27: *"we have no connectors, that means the circle should be
 * closed"*); a brace or a bracket OPENS it — the lines stop at the last barline, the seam left to the signs.
 */
export function spineSystemStartDraws(score: Score, staves: readonly SpineStaff[]): boolean {
  const { signs, joins } = systemStartSigns(score, staves)
  return joins || signs.length > 0
}

/**
 * How much room the start signs take BEFORE `s = 0`, px — on a CLOSED path that is the end of the loop,
 * so the music must stop that much sooner for its last barline to clear them (the page's indent).
 */
export function spineSystemStartRoomPx(score: Score): number {
  return scoreSystemStartIndentPx(score)
}
