/**
 * A MEASURE RANGE — the Sibelius-style blue box over one bar (plain click) or a span of them
 * (Ctrl+Shift, extendable).
 *
 * ⚠️ NO chain entry, for the tuplet's reason and one of its own: the box is what a press on EMPTY
 * space means, so it is resolved by the pre-step that also decides between a box, a staff-spacing
 * drag and a pan — a gesture, not a glyph anyone can hit.
 */
import type { ElementKindSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { voiceFillColor } from '@/utils/voiceColors'
import { passageOf } from '../state/measurePassage'
import { selectedOf } from '../state/EditorState'

export const MEASURE_RANGE_ELEMENT: ElementKindSpec = {
  kind: 'measureRange',
  highlight: paintMeasureBox,
}

/**
 * Draw the Sibelius-style blue box around the selected `measureRange`.
 * In first-voice blue with no fill; the box's own `boxStyle` picks the look:
 *   - `'single'` — ONE rectangle: the plain-click passage selection, whose contents
 *     (notes/rests + enclosed dynamics/slurs) ARE selected and highlighted separately.
 *   - `'double'` — two nested rectangles: the Ctrl+Shift+click marker (visual only, NO
 *     objects selected).
 * Redrawn every render and wiped with the SVG on the next one.
 */
export function paintMeasureBox(ctx: HighlightContext): void {
  const engine = ctx.engine
  const range = selectedOf(ctx.state, 'measureRange')
  if (range == null) return

  const svg = ctx.svg

  const lo = Math.min(range.anchor, range.focus)
  const hi = Math.max(range.anchor, range.focus)
  const registry = engine.getElementRegistry()

  // Group the span's measures by system line (shared measureY) so a passage that wraps
  // across a line break draws one box per line — the box ends at the line edge and
  // resumes on the next, exactly like Sibelius. Each line's box hugs min→max x and a
  // little above/below the staff so it clears ledger-heavy notes.
  //
  // Vertical extent depends on the box style (they are different operations):
  //   - 'single' (plain-click passage select) → ONE staff's band, the staff the click
  //     landed on (the box's own `staff`); a content selection on that staff.
  //   - 'double' (Ctrl+Shift measure select) → the whole measure COLUMN across EVERY
  //     staff (staff 0's top → the last staff's bottom), because add/remove-measure is a
  //     system-wide edit that hits all staves. At N=1 both collapse to the single staff.
  const isSingle = range.boxStyle === 'single'
  const staffCount = engine.getScore().staves?.length ?? 1
  // ⭐⭐ **A `single` passage spans a RANGE of staves, not one** — his report of 2026-08-29, where a
  //   shift-click onto the staff below had to select *"the measure but in both staves"*. The two
  //   ends are normalised by `interactions/state/measurePassage`, the same call the selection itself
  //   makes, so ⭐ **the box and the selected ids cannot disagree** — the highlight promises the copy.
  const passage = passageOf(range)
  const lines = new Map<number, { left: number; right: number; top: number; bottom: number }>()
  for (let m = lo; m <= hi; m++) {
    const rect = engine.getMeasureRect(m)
    if (!rect) continue
    const topGeo = isSingle
      ? (registry.getStaffGeometry(m, passage.fromStaff) ?? registry.getStaffGeometry(m, 0))
      : registry.getStaffGeometry(m, 0)
    const bottomGeo = isSingle
      ? (registry.getStaffGeometry(m, passage.toStaff) ?? topGeo)
      : (registry.getStaffGeometry(m, staffCount - 1) ?? registry.getStaffGeometry(m, 0))
    if (!topGeo || !bottomGeo) continue
    const top = topGeo.lineYPositions[0] - 12
    const bottom = bottomGeo.lineYPositions[4] + 12
    const key = Math.round(rect.y)
    const seg = lines.get(key)
    if (seg) {
      seg.left = Math.min(seg.left, rect.x)
      seg.right = Math.max(seg.right, rect.x + rect.width)
      seg.top = Math.min(seg.top, top)
      seg.bottom = Math.max(seg.bottom, bottom)
    } else {
      lines.set(key, { left: rect.x, right: rect.x + rect.width, top, bottom })
    }
  }

  const color = voiceFillColor(0) // first-voice blue (#3B82F6)
  const GAP = 3 // inset between the two nested rectangles = the "double box"
  // A plain-click passage selection draws ONE rectangle (Sibelius's single light-blue
  // box); the Ctrl+Shift+click visual marker draws two nested ones (the "double box").
  const insets = isSingle ? [0] : [0, GAP]
  for (const seg of lines.values()) {
    for (const inset of insets) {
      const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      box.setAttribute('x', String(seg.left + inset))
      box.setAttribute('y', String(seg.top + inset))
      box.setAttribute('width', String(Math.max(0, seg.right - seg.left - inset * 2)))
      box.setAttribute('height', String(Math.max(0, seg.bottom - seg.top - inset * 2)))
      box.setAttribute('fill', 'none')
      box.setAttribute('stroke', color)
      box.setAttribute('stroke-width', '1.5')
      box.setAttribute('class', 'measure-box')
      ctx.addNode(svg, box)
    }
  }
}
