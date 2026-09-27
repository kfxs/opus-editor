/**
 * ⭐ **A RIGID PIECE ON A LANE** — a sign a line span carries (an octave numeral, a pedal's *Ped.* and its
 * release, a trill's `tr`): drawn upright at its own origin by the page's own painter, then placed on the
 * spine by its MIDDLE, turned where it stands — the letters' rule (`./spineMarks`), for a piece whose width
 * is only known once it is drawn.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { compose, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { placementAt } from '@/engine/engrave/staff/staffSpine'
import { drawGroupOf } from '../painter/svgDrawGroup'

/** The class of one rigidly placed sign of a line span. */
export const SPINE_SIGN_PIECE_CLASS = 'spine-sign-piece'

/**
 * Draw `paint` (which draws at lane x 0 and answers its width) as one piece whose LEFT edge stands at `sLeft`
 * along the spine, on a lane `ratio` as long as the spine (`staffSpine.innerLengthRatio` at its depth).
 * Answers the piece's width, in lane px.
 */
export function drawSpinePiece(
  ctx: DrawContext, spine: Spine, sLeft: number, ratio: number, paint: () => number,
): number {
  const group = drawGroupOf(ctx.openGroup(SPINE_SIGN_PIECE_CLASS))
  let width = 0
  try {
    width = paint()
  } finally {
    ctx.closeGroup()
  }
  group?.setPlacement(compose(translation(-width / 2, 0), placementAt(spine, sLeft + width / 2 / ratio)))
  return width
}
