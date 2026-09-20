/**
 * A BARLINE — the line that ENDS a measure, and the handle the bar-width drag hangs off.
 *
 * ⚠️ LAST in the priority chain. Its registered box is a few px around 1.6 px of ink, so it has to be
 * padded to be clickable at all ({@link BARLINE_PRESS_PAD_PX}), and that pad reaches into the last
 * column of the bar — every glyph that could own the press gets asked first.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import { beginBarWidthDrag } from '../drags/barWidth'
import { paintBarlineJoinSquares } from './barlineJoinSquares'

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

/** One box a press could be answering: the line's ink ON a staff, or the piece of the same line
 *  crossing the GAP below one (`engine/rendering/barlineGap`). The two resolve to the SAME
 *  selection; `inGap` only changes which join square the press is handed. */
interface Candidate {
  el: { measure?: number; staff?: number; bbox: { x: number; y: number; width: number; height: number } }
  inGap: boolean
}

export const BARLINE_ELEMENT: ClickableElementSpec = {
  kind: 'barline',
  /**
   * Select the barline that ENDS a measure.
   *
   * Registered per (measure, staff) — the ink is drawn once per staff — but selected as ONE
   * system-wide thing (the `barline` element kind), so whichever staff the click lands on, the
   * whole line is what gets picked. See {@link SelectedElement} for why that is the identity.
   */
  hit({ engine, registry, x, y, closestElement }, deps) {
    // The registered box straddles the drawn line by 2px each way — not a clickable target on its
    // own, so it is padded to be one at all ({@link BARLINE_PRESS_PAD_PX}, both axes).
    const pad = BARLINE_PRESS_PAD_PX
    const covers = (el: { bbox: { x: number; y: number; width: number; height: number } }) => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y - pad && y <= b.y + b.height + pad
    }
    const inRange = registry.getByType('barline').filter(covers)

    // ⭐ **A PRESS MAY ONLY REACH INK.** Tier 1 registers a barline box for every bar in the SCORE,
    // painted or not (`ElementRegistry.painted`), so an off-screen bar's box can answer a press that
    // a visible barline's box also covers. Reported from use: *"the selection is in a hidden barline
    // and is not possible to move it"* — it selected, and then the width drag found no drawn columns
    // to measure and declined in silence. Dropping the unpainted candidates is the whole fix: the
    // press either finds a real barline or falls through to whatever is genuinely under it.
    const drawn: Candidate[] = inRange
      .filter(el => el.measure !== undefined && registry.isPainted(el.measure, el.staff ?? 0))
      .map(el => ({ el, inGap: false }))

    // ⭐⭐ **AND THE SAME LINE WHERE IT CROSSES THE GAP** — his ask, 2026-08-28: *"if the barline is
    // join and i click on in the empty space of the two staves i want to be able to select it too and
    // move and do the normal barline operations"*. A joined barline is ONE line to the eye and must be
    // one line to the hand, so the ink between two staves answers for the same boundary the ink on
    // them does, with the same width drag armed.
    //
    // ⚠️ ⛔ NO `isPainted` filter, unlike above: these are registered by the DRAWING pass
    // (`rendering/barlineGap`), so their existence already IS the proof they were drawn — and the
    // filter would be wrong as well as redundant, since the bar a gap's line ENDS is not always the
    // bar that drew it.
    for (const el of registry.getByType('barline-gap')) {
      if (el.measure !== undefined && covers(el)) drawn.push({ el, inGap: true })
    }

    // ⚠️ NEAREST, not first-registered. Registration order is by bar, so `find` used to hand an
    // ambiguous press — the boxes are a few px wide and padded wider still — to whichever bar
    // happened to be numbered lower. Between two real barlines the honest answer is the one you
    // aimed at. ⚠️ By X only: two staves are ~110 px apart, so the vertical pad cannot put two of
    // them in range of one press.
    const centre = (c: Candidate) => c.el.bbox.x + c.el.bbox.width / 2
    const hit = drawn.reduce<Candidate | null>(
      (best, c) => (best === null || Math.abs(centre(c) - x) < Math.abs(centre(best) - x) ? c : best),
      null,
    )
    const barlineAt = hit?.el
    if (!hit || barlineAt?.measure === undefined) {
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
    if (drawn.length > 1) {
      dbg(`Barline press at x=${x.toFixed(1)} matched ${drawn.length} drawn boxes: `
        + drawn.map(c => `bar ${c.el.measure}/staff ${c.el.staff ?? 0}${c.inGap ? ' (gap)' : ''} @${c.el.bbox.x.toFixed(1)}`).join(' · ')
        + ` — nearest wins (bar ${measure})`)
    }
    dbg(`✓ Barline selected | ends measure:${measure} · ${hit.inGap ? 'gap below ' : ''}staff ${barlineAt.staff ?? 0} · `
      + `box @${barlineAt.bbox.x.toFixed(1)} · press @${x.toFixed(1)}`)
    // ⚠️ `staff` and `pressedAt` ride along for the JOIN SQUARES alone (`SelectedElement`'s own
    // notes) — the selection is still the one system-wide boundary, and nothing downstream reads
    // either as identity.
    //
    // ⭐ **THE HALF OF THE LINE YOU PRESSED IN NAMES THE END** — Sibelius's *"click carefully at the
    // top or bottom of a normal barline"* (§4.5 p. 343), made forgiving: its END is our HALF, so
    // there is no precision to learn and every press still answers one of the two ends. The box is
    // exactly the five staff lines, so its middle is the middle line.
    //
    // ⭐⭐ **…and a press in the GAP is at no end at all, so it offers NO square** — his call:
    // *"when i select the barline in the midle, in the white space i dont need to see the square, the
    // square is related just to the stave"*. It still selects the same barline and arms the same
    // width drag; what it does not do is hand you a handle for a join that is already made.
    const above = y < barlineAt.bbox.y + barlineAt.bbox.height / 2
    const pressedAt = hit.inGap ? 'gap' : above ? 'top' : 'bottom'
    return deps.pick(
      { kind: 'barline', measure, staff: barlineAt.staff ?? 0, pressedAt },
      () => deps.arm(door => beginBarWidthDrag(door.host, engine, measure, x)),
    )
  },

  highlight: ctx => { ctx.controller.applyBarlineSelectionHighlight(); paintBarlineJoinSquares(ctx) },
}
