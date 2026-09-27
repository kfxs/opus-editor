/**
 * ⭐⭐ **GLISSANDI ON A SPINE** — port map #26 of `docs/plans/bent-staff-plan.md`: the line from a head to the
 * head its glissando derives, drawn ALONG the path, and its word a rigid piece tilted to the line.
 *
 * ⛔ Nothing re-decided — every rule is the page's (`marks/lines/GlissandoRenderer` + `engrave/marks/
 * glissandoLine`), asked in the path's PLANE `(s, depth)`:
 *
 * - **The two ends** are the page's own descriptions of a leaving and an arriving note (`leaving` / `arriving` —
 *   the head's outline, its ledgers, dots, stem, the arriving accidental's real outline), built on each note's own
 *   stave and then moved into the plane by where the note stands (`SpineNotePlace` — the curves' mapping,
 *   `./spineCurves`).
 * - **The line** is `glissandoStroke` (the armed end rule: gaps, lean, the accidental re-angle), or
 *   `glissandoFreeStroke` for a line with no target, stopped `beforeBarline` short of the bar's end.
 * - **Its path**: a LINE follows the path on BOTH sides of a loop — port map #15's lesson, it has no bow to
 *   invert — its depth running straight from one end to the other along `s`.
 * - **The word** (`glissandoTextPlacement`, the page's face through `glissandoWord`): one rigid piece at the
 *   line's middle, turned with the path there AND tilted to the line's slope in the plane.
 *
 * ⚠️ Not here: a glissando between two STAVES (each staff draws its own); across the closed seam; hit boxes.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { compose, rotation, rotationAbout, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { pointAt } from '@/engine/engrave/staff/staffSpine'
import { strokeSpineRun } from '@/engine/engrave/staff/spineLines'
import {
  armedGlissandoBreakRule, glissandoFreeStroke, glissandoStroke, glissandoTextPlacement, glissandoThicknessSpaces,
  type GlissandoFrom, type GlissandoStroke, type GlissandoTo, type Outline,
} from '@/engine/engrave/marks/glissandoLine'
import { getGlissandi, glissandoDirection, glissandoTarget } from '@/engine/models/glissandoOps'
import { findSlot } from '@/engine/models/slotLookup'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { Score } from '@/types/music'
import { arriving, direction, glissandoWord, leaving } from '../marks/lines/GlissandoRenderer'
import { drawTextRun } from '../painter/glyphPainter'
import { drawGroupOf } from '../painter/svgDrawGroup'
import { noteFrame } from '../staff/staveFrame'
import type { SpinePitchPlace } from './spineCurves'

/** The class every glissando's group carries — what a spec finds them by. */
export const SPINE_GLISSANDO_CLASS = 'spine-glissando'

/**
 * Draw every glissando whose note was drawn on this staff (`pitches` — what its blocks placed). `barEndS` answers
 * where a bar's own barline stands along the path, for a line with no target.
 */
export function drawSpineGlissandi(
  ctx: DrawContext, spine: Spine, score: Score, pitches: Map<string, SpinePitchPlace>,
  barEndS: (measureNumber: number) => number | undefined,
): void {
  for (const glissando of getGlissandi(score)) {
    const from = pitches.get(glissando.noteId)
    const fromSlot = findSlot(score, glissando.noteId)
    if (!from || fromSlot?.type !== 'chord') continue
    const leave = inPlane(from, 'leaving')
    if (!leave) continue
    let stroke: GlissandoStroke | null = null
    const targetId = glissandoTarget(score, glissando)
    if (targetId) {
      const to = pitches.get(targetId)
      const toSlot = findSlot(score, targetId)
      const arrive = to && inPlane(to, 'arriving')
      if (!arrive || toSlot?.type !== 'chord') continue
      stroke = glissandoStroke(leave, arrive, STAFF_SPACE_PX, direction(fromSlot.pitch, toSlot.pitch))
    } else {
      // A line with no target: the page's free end, stopped short of the bar's own barline.
      const arrive = inPlane(from, 'arriving')
      const end = barEndS(from.measureNumber)
      if (!arrive) continue
      const limit = end === undefined ? Infinity : end - armedGlissandoBreakRule().beforeBarline * STAFF_SPACE_PX
      stroke = glissandoFreeStroke(glissando.side === 'before' ? 'before' : 'after', { ...leave, ...arrive },
        glissandoDirection(glissando), STAFF_SPACE_PX, undefined, limit)
    }
    if (!stroke) continue
    const line = stroke

    ctx.openGroup(SPINE_GLISSANDO_CLASS, `glissando-${glissando.id}`)
    try {
      ctx.setLineWidth(glissandoThicknessSpaces() * STAFF_SPACE_PX)
      // ⭐ The line along the path — its depth straight from one end's to the other's, along `s`.
      strokeSpineRun(ctx, spine, line.x1, line.x2, s => line.y1 + ((s - line.x1) / (line.x2 - line.x1)) * (line.y2 - line.y1))
      if (glissando.text) drawWordOnSpine(ctx, spine, glissando.text, line)
    } finally {
      ctx.closeGroup()
    }
  }
}

/**
 * The page's WORD, placed on the spine: drawn upright in the plane where `glissandoTextPlacement` puts it, tilted
 * to the line there, then carried as one rigid piece to the path's own point at the line's middle, turned with it.
 */
function drawWordOnSpine(ctx: DrawContext, spine: Spine, text: string, line: GlissandoStroke): void {
  const { font, width } = glissandoWord(text, STAFF_SPACE_PX)
  const at = glissandoTextPlacement(line, width, STAFF_SPACE_PX)
  if (!at) return
  const group = drawGroupOf(ctx.openGroup('spine-glissando-text'))
  try {
    drawTextRun(ctx, 'Glissando.text', text, at.x, at.y, font)
  } finally {
    ctx.closeGroup()
  }
  const where = pointAt(spine, at.cx, at.cy)
  // Tilted to the line about its middle, that middle moved to the origin, turned with the path, carried there.
  group?.setPlacement(compose(
    compose(rotationAbout(at.angle, at.cx, at.cy), translation(-at.cx, -at.cy)),
    compose(rotation(spine.at(at.cx).angle), translation(where.x, where.y)),
  ))
}

/**
 * One end of a glissando in the path's PLANE — the page's own description of the note (`leaving` / `arriving`,
 * built on the note's own stave), moved by where the note stands: a stave px `(x, y)` is `s + (x − headCentreX)`
 * along and `y − topLineY` across (`./spineCurves`' mapping).
 */
function inPlane(pitch: SpinePitchPlace, end: 'leaving'): GlissandoFrom | null
function inPlane(pitch: SpinePitchPlace, end: 'arriving'): GlissandoTo | null
function inPlane(pitch: SpinePitchPlace, end: 'leaving' | 'arriving'): GlissandoFrom | GlissandoTo | null {
  const { place, headIndex } = pitch
  const frame = noteFrame(place.note)
  if (!frame) return null
  const dx = place.s - place.headCentreX
  const dy = -place.topLineY
  const x = (v: number) => v + dx
  const y = (v: number) => v + dy
  const outline = (o: Outline | undefined) => o?.map(contour => contour.map(([px, py]) => [x(px), y(py)] as const))
  const shared = <T extends GlissandoFrom | GlissandoTo>(e: T): T => ({
    ...e,
    y: y(e.y),
    ...(e.centreX !== undefined && { centreX: x(e.centreX) }),
    ...(e.headOutline && { headOutline: outline(e.headOutline) }),
    ...(e.ledgers && { ledgers: e.ledgers.map(l => ({ y: y(l.y), left: x(l.left), right: x(l.right) })) }),
    ...(e.staffLines && { staffLines: e.staffLines.map(y) }),
  })
  if (end === 'leaving') {
    const e = leaving(place.note, headIndex, frame)
    return e && { ...shared(e), inkRightX: x(e.inkRightX) }
  }
  const e = arriving(place.note, headIndex, frame)
  return e && {
    ...shared(e),
    inkLeftX: x(e.inkLeftX),
    ...(e.stem && { stem: { x: x(e.stem.x), top: y(e.stem.top), bottom: y(e.stem.bottom) } }),
    ...(e.accidentalLeftX !== undefined && { accidentalLeftX: x(e.accidentalLeftX) }),
    ...(e.accidentalTopY !== undefined && { accidentalTopY: y(e.accidentalTopY) }),
    ...(e.accidentalBottomY !== undefined && { accidentalBottomY: y(e.accidentalBottomY) }),
    ...(e.accidentalInk && { accidentalInk: e.accidentalInk.map(r => ({ left: x(r.left), right: x(r.right), top: y(r.top), bottom: y(r.bottom) })) }),
    ...(e.accidentalOutline && { accidentalOutline: outline(e.accidentalOutline) }),
  }
}
