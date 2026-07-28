/**
 * A MEASURE RANGE — the Sibelius-style blue box over one bar (plain click) or a span of them
 * (Ctrl+Shift, extendable).
 *
 * ⚠️ NO chain entry, for the tuplet's reason and one of its own: the box is what a press on EMPTY
 * space means, so it is resolved by the pre-step that also decides between a box, a staff-spacing
 * drag and a pan — a gesture, not a glyph anyone can hit.
 */
import type { ElementKindSpec } from './chain'

export const MEASURE_RANGE_ELEMENT: ElementKindSpec = {
  kind: 'measureRange',
  highlight: h => h.applyMeasureBox(),
}
