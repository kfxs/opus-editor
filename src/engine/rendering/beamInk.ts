/**
 * How a beam is INKED — the quad every beam line is drawn as, and the sizes a beam that leaves its
 * bar is drawn at. Extracted from {@link VexFlowRenderer} (docs/refactor-plan-2026-07-27.md Phase
 * 6a) because three drawing passes share it and no two of them live in the same module any more:
 * the cross-barline beams (still in the renderer), the two-note tremolo's strokes, and
 * {@link FanPass}. A constant reached for from three places is not one file's private business.
 *
 * Nothing here reads renderer state — a quad is four points and a fill.
 */
import type { SVGContext } from 'vexflow'
import { engravingDefault } from '@/engine/fonts/fontMetrics'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * The half-beam a cross-*system* fragment hangs over its open end (docs/cross-barline-beaming-plan.md):
 * a short fixed stub past the edge note's stem, NOT a run to the system edge — a beam the width of a
 * system reads as a long empty beam, not one going somewhere. VexFlow's own `partialBeamLength` (10px)
 * is the honest floor; these are tuned by eye.
 *
 * The two ends are NOT the same. A fragment at the **end of a line** (open on its right) has to cross
 * the closing barline into the empty margin to read as "continued on the next system" — and how far
 * that is depends on where the last note sits, which justification moves bar to bar. So the line-end
 * end is **computed to the barline** (`measureX + measureWidth`) plus {@link CROSS_SYSTEM_BEAM_MARGIN}
 * into the margin, not a fixed length; the fixed `…LINE_END` is only a fallback when the measure's
 * bounds are unknown. A fragment at the **start of the next line** (open on its left) only projects a
 * little left of its first note, so that one stays the fixed `…LINE_START`. `CROSS_SYSTEM_BEAM_WIDTH`
 * mirrors VexFlow's default `beamWidth` for the lone-note fragment, which has no real `Beam` to read.
 */
/**
 * ⚠️ All four are INK, in the coordinates of the staff the beam belongs to — a cross-barline beam is
 * drawn inside that staff's own scale group (`inScaledStaffGroup`), so they shrink with it and ⛔
 * must not be multiplied by its size here. The one number in this family that is NOT in that space
 * is the barline a line-end stub runs to: it comes from `measureBounds`, i.e. the SVG, and is
 * converted where the two meet (`crossSystemOverhangEndX`). See docs/staff-size-plan.md §1, §4.3.
 */
export const CROSS_SYSTEM_BEAM_STUB_LINE_END = 22
export const CROSS_SYSTEM_BEAM_STUB_LINE_START = 12
export const CROSS_SYSTEM_BEAM_MARGIN = 10
/**
 * ⭐ **A BEAM'S OWN THICKNESS — Bravura's `beamThickness`, 0.5 staff spaces**, which is where the 5
 * this used to be came from: VexFlow's default `beamWidth` is that same half space, and at
 * {@link STAFF_SPACE_PX} it is 5 px exactly (F3, docs/font-metrics-plan.md).
 *
 * ⚠️ In PIXELS, not spaces, unlike the rest of the font's weights — because its three callers draw
 * beam quads in the staff's own scale-group coordinates (see the note above), not in staff spaces.
 * The conversion belongs here, once, rather than at each of them.
 */
export const CROSS_SYSTEM_BEAM_WIDTH = engravingDefault('beamThickness') * STAFF_SPACE_PX

/** The stub length for an open end, by the direction it points: right (+1) runs off the line end. */
export const crossSystemStub = (direction: number): number =>
  direction > 0 ? CROSS_SYSTEM_BEAM_STUB_LINE_END : CROSS_SYSTEM_BEAM_STUB_LINE_START

/** One beam quad, from `drawBeamLines`' vertices (beam.js:596-604): top edge start→end, thickness down. */
export function fillBeamQuad(
  ctx: SVGContext,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
): void {
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(startX, startY + thickness)
  ctx.lineTo(endX, endY + thickness)
  ctx.lineTo(endX, endY)
  ctx.closePath()
  ctx.fill()
}
