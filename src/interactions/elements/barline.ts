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
    const inRange = registry.getByType('barline').filter(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y && y <= b.y + b.height
    })

    // ⭐ **A PRESS MAY ONLY REACH INK.** Tier 1 registers a barline box for every bar in the SCORE,
    // painted or not (`ElementRegistry.painted`), so an off-screen bar's box can answer a press that
    // a visible barline's box also covers. Reported from use: *"the selection is in a hidden barline
    // and is not possible to move it"* — it selected, and then the width drag found no drawn columns
    // to measure and declined in silence. Dropping the unpainted candidates is the whole fix: the
    // press either finds a real barline or falls through to whatever is genuinely under it.
    const drawn = inRange.filter(el => el.measure !== undefined && registry.isPainted(el.measure, el.staff ?? 0))

    // ⚠️ NEAREST, not first-registered. Registration order is by bar, so `find` used to hand an
    // ambiguous press — the boxes are 4px wide and padded to 12 — to whichever bar happened to be
    // numbered lower. Between two real barlines the honest answer is the one you aimed at.
    const centre = (el: { bbox: { x: number; width: number } }) => el.bbox.x + el.bbox.width / 2
    const barlineAt = drawn.reduce<typeof drawn[number] | null>(
      (best, el) => (best === null || Math.abs(centre(el) - x) < Math.abs(centre(best) - x) ? el : best),
      null,
    )
    if (barlineAt?.measure === undefined) {
      if (inRange.length > 0) {
        dbg(`Barline press at x=${x.toFixed(1)} landed only on UNPAINTED bars `
          + `(${inRange.map(el => el.measure).join(', ')}) — declined, nothing is drawn there`)
      }
      return false
    }
    const measure = barlineAt.measure

    // Never steal a click that lands on a note/rest body — the bar's last column sits close to the
    // barline, and the pad above reaches into it.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // When a press is ambiguous, say who took it and who lost — `__barlines.boxes()` is the
    // standing view of the same facts.
    if (inRange.length > 1) {
      dbg(`Barline press at x=${x.toFixed(1)} matched ${inRange.length} boxes (${drawn.length} painted): `
        + inRange.map(el => `bar ${el.measure}/staff ${el.staff ?? 0} @${el.bbox.x.toFixed(1)}`).join(' · ')
        + ` — nearest painted wins (bar ${measure})`)
    }
    dbg(`✓ Barline selected | ends measure:${measure} · staff ${barlineAt.staff ?? 0} · `
      + `box @${barlineAt.bbox.x.toFixed(1)} · press @${x.toFixed(1)}`)
    return deps.pick({ kind: 'barline', measure }, () => deps.armBarWidthDrag(measure, x))
  },

  highlight: h => h.applyBarlineSelectionHighlight(),
}
