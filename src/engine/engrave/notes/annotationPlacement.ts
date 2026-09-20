/**
 * ⭐⭐ **WHERE A TEXT ANNOTATION STANDS ON ITS NOTE** — S12g of `docs/history/vexflow-removal-map.md`
 * (`Annotation.draw`'s placement, MIT, transcribed). In this editor the annotations are the DYNAMICS.
 *
 * ## ⭐ What the rule IS
 *
 * > **Along the staff, the text hangs off the note's modifier point by its justification** — its left
 * > edge there, its right edge, its middle, or its middle on the stem. **Across it, BELOW: a line's
 * > worth past the lowest head per text line, plus the text's own height — and clear of a stem that
 * > points down. ABOVE: a line's worth past the highest head per text line — and clear of a stem that
 * > points up, by a space (a full line when the tip is above the staff). CENTRED: halfway between the
 * > note's top-text row and the staff's bottom-text row.** Anything else sits halfway along the stem.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact: the text's height is its FONT SIZE in px, ⛔ not its ink;
 * the step per text line is the fixed `Tables.STAVE_LINE_DISTANCE` (10), not the staff's own space; and
 * "a line's worth" below mixes both (`spacing` is the stave's, the step the fixed 10).
 */
import { STAVE_LINE_DISTANCE_PX } from '@/engine/engrave/inheritedDefaults'

/** Along the staff — VexFlow's `AnnotationHorizontalJustify`, the same numbers. */
export const ANNOTATION_ALIGN = { LEFT: 1, CENTER: 2, RIGHT: 3, CENTER_STEM: 4 } as const
/** Across it — VexFlow's `AnnotationVerticalJustify`, the same numbers. */
export const ANNOTATION_SIDE = { TOP: 1, CENTER: 2, BOTTOM: 3, CENTER_STEM: 4 } as const

/** What a formatted note and its stave offer the rule. */
export interface AnnotationPlacementInput {
  align: number
  side: number
  textLine: number
  /** The text's reported width (a dynamic's is 0) and its height (its font size, px). */
  textWidth: number
  textHeight: number
  /** The note's modifier point (ABOVE — every annotation asks for that one). */
  startX: number
  stemX: number
  hasStem: boolean
  /** `1` up, `-1` down — a stemless note counts as up. */
  stemDirection: number
  /** The stem's extents — a stemless note still has them (VexFlow builds the stem object). */
  stemTopY: number
  stemBaseY: number
  /** The stave's own space, and the y of its top line. */
  staffSpace: number
  topLineY: number
  headYs: readonly number[]
  /** For CENTRED only: the note's top-text row and the stave's bottom-text row, at this text line. */
  noteTopTextY: () => number
  staveBottomTextY: () => number
}

export function placeAnnotation(i: AnnotationPlacementInput): { x: number; y: number } {
  const x = i.align === ANNOTATION_ALIGN.LEFT ? i.startX
    : i.align === ANNOTATION_ALIGN.RIGHT ? i.startX - i.textWidth
      : i.align === ANNOTATION_ALIGN.CENTER ? i.startX - i.textWidth / 2
        : i.stemX - i.textWidth / 2

  const spacing = i.hasStem ? i.staffSpace : 0
  let y: number
  if (i.side === ANNOTATION_SIDE.BOTTOM) {
    y = Math.max(...i.headYs)
    // ⚠️ ONE addition of the sum, as VexFlow wrote it (`y += a + b`) — `(y + a) + b` differs in the last bit.
    y += (i.textLine + 1) * STAVE_LINE_DISTANCE_PX + i.textHeight
    if (i.hasStem && i.stemDirection === -1) y = Math.max(y, i.stemTopY + i.textHeight + spacing * i.textLine)
  } else if (i.side === ANNOTATION_SIDE.CENTER) {
    const top = i.noteTopTextY() - 1
    const bottom = i.staveBottomTextY()
    y = top + (bottom - top) / 2 + i.textHeight / 2
  } else if (i.side === ANNOTATION_SIDE.TOP) {
    y = Math.min(...i.headYs) - (i.textLine + 1) * STAVE_LINE_DISTANCE_PX
    if (i.hasStem && i.stemDirection === 1) {
      const clearance = i.stemTopY < i.topLineY ? STAVE_LINE_DISTANCE_PX : spacing
      y = Math.min(y, i.stemTopY - clearance * (i.textLine + 1))
    }
  } else {
    y = i.stemTopY + (i.stemBaseY - i.stemTopY) / 2 + i.textHeight / 2
  }
  return { x, y }
}
