/**
 * A BARLINE — the line that ENDS a measure, and the handle the bar-width drag hangs off.
 *
 * ⚠️ LAST in the priority chain. Its registered box is a few px around 1.6 px of ink, so it has to be
 * padded to be clickable at all ({@link BARLINE_PRESS_PAD_PX}), and that pad reaches into the last
 * column of the bar — every glyph that could own the press gets asked first.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'

/**
 * ⭐⭐ **HOW FAR OUTSIDE ITS INK A BARLINE ANSWERS A PRESS**, in px, on BOTH axes.
 *
 * 🚨 **His report, 2026-08-28, from the running app:** *"the point is dificult to reach, it is very
 * co[mm]on that is confused by a whole meassure selection, the area should be le[s]s tight… not too
 * much but a tyni"* — and, asked whether he meant only the join squares' end of the line, *"i mean
 * in general"*. A barline is 1.6 px of ink; missing it by two pixels used to land on the bar behind
 * it and select the whole measure, which is a very loud answer to a small miss.
 *
 * ⚠️ **The VERTICAL half of this replaces a rule that was deliberate**, and it is worth saying why it
 * changed rather than quietly widening it. It read: *"NOT vertically: the box is exactly the five
 * staff lines, and a click in the gap between two staves is on no barline at all"* — true while the
 * gap held nothing. It now holds the join squares (docs/barline-join-plan.md), so *the top and bottom
 * ENDS of a line are where the hand aims*, and Sibelius's own instruction for the same gesture is
 * *"click carefully at the top or bottom of a normal barline"*. A press a few px past the last staff
 * line is aiming at the line, not at the bar.
 *
 * ⛔ **Small on purpose.** It is not the staff band's 12 (`./staffBand`, the *"which staff did they
 * mean"* tolerance): two staves are ~110 px apart, so 6 px cannot make two barlines ambiguous, and a
 * press that is nowhere near the line still reaches the music behind it. ⚠️ A join SQUARE beats this
 * either way — it is armed in a `MouseController` pre-step, before the hit chain runs at all.
 */
export const BARLINE_PRESS_PAD_PX = 6

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
    // The registered box straddles the drawn line by 2px each way — not a clickable target on its
    // own, so it is padded to be one at all ({@link BARLINE_PRESS_PAD_PX}, both axes).
    const pad = BARLINE_PRESS_PAD_PX
    const inRange = registry.getByType('barline').filter(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad
    })

    // ⭐ **A PRESS MAY ONLY REACH INK.** Tier 1 registers a barline box for every bar in the SCORE,
    // painted or not (`ElementRegistry.painted`), so an off-screen bar's box can answer a press that
    // a visible barline's box also covers. Reported from use: *"the selection is in a hidden barline
    // and is not possible to move it"* — it selected, and then the width drag found no drawn columns
    // to measure and declined in silence. Dropping the unpainted candidates is the whole fix: the
    // press either finds a real barline or falls through to whatever is genuinely under it.
    const drawn = inRange.filter(el => el.measure !== undefined && registry.isPainted(el.measure, el.staff ?? 0))

    // ⚠️ NEAREST, not first-registered. Registration order is by bar, so `find` used to hand an
    // ambiguous press — the boxes are a few px wide and padded wider still — to whichever bar
    // happened to be numbered lower. Between two real barlines the honest answer is the one you
    // aimed at. ⚠️ By X only: two staves are ~110 px apart, so the vertical pad cannot put two of
    // them in range of one press.
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
    // ⚠️ `staff` and `staffEnd` ride along for the JOIN SQUARES alone (`SelectedElement`'s own
    // notes) — the selection is still the one system-wide boundary, and nothing downstream reads
    // either as identity.
    //
    // ⭐ **THE HALF OF THE LINE YOU PRESSED IN NAMES THE END** — Sibelius's *"click carefully at the
    // top or bottom of a normal barline"* (§4.5 p. 343), made forgiving: its END is our HALF, so
    // there is no precision to learn and every press still answers one of the two ends. The box is
    // exactly the five staff lines, so its middle is the middle line.
    const staffEnd = y < barlineAt.bbox.y + barlineAt.bbox.height / 2 ? 'top' : 'bottom'
    return deps.pick(
      { kind: 'barline', measure, staff: barlineAt.staff ?? 0, staffEnd },
      () => deps.armBarWidthDrag(measure, x),
    )
  },

  highlight: h => { h.applyBarlineSelectionHighlight(); h.applyBarlineJoinHandles() },
}
