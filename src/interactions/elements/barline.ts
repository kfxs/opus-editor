/**
 * A BARLINE — the line that ENDS a measure, and the handle the bar-width drag hangs off.
 *
 * ⚠️ LAST in the priority chain. Its registered box is 4px wide, so it has to be padded to be
 * clickable at all, and that pad reaches into the last column of the bar — every glyph that could
 * own the press gets asked first.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

export const BARLINE_ELEMENT: ClickableElementSpec = {
  kind: 'barline',
  /**
   * Select the barline that ENDS a measure.
   *
   * Registered per (measure, staff) — the ink is drawn once per staff — but selected as ONE
   * system-wide thing (the `barline` element kind), so whichever staff the click lands on, the
   * whole line is what gets picked. See {@link SelectedElement} for why that is the identity.
   */
  hit({ registry, x, y, closestElement }, deps) {
    // The registered box is 4px wide (it straddles the drawn line) — not a clickable target on its
    // own, so widen it horizontally. NOT vertically: the box is exactly the five staff lines, and a
    // click in the gap between two staves is on no barline at all.
    const pad = 4
    const barlineAt = registry.getByType('barline').find(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (barlineAt?.measure === undefined) return false
    const measure = barlineAt.measure

    // Never steal a click that lands on a note/rest body — the bar's last column sits close to the
    // barline, and the pad above reaches into it.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    dbg(`✓ Barline selected | ends measure:${measure}`)
    return deps.pick({ kind: 'barline', measure }, () => deps.armBarWidthDrag(measure, x))
  },

  highlight: h => h.applyBarlineSelectionHighlight(),
}
