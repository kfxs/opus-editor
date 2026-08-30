/**
 * ⭐⭐ **THE ROOM A MARK MAY USE BEFORE IT IS IN SOMEBODY ELSE'S** — the vertical limit on an
 * engraving offset, and the twin of `./pageBounds`' page limit.
 *
 * His report, 2026-08-18: a dragged slur endpoint reached `y: 66` staff-spaces, the arc running as a
 * near-vertical hairline across five systems, and nothing refused it. `nudgeFitsOnPage` had done its
 * job correctly — it forbids a step that pushes ink FURTHER off its sheet, and 660 px down from
 * mid-page is still on the page. What was missing is a rule about the ink's NEIGHBOURS.
 *
 * ## ⚠️ Why we need one when MuseScore does not
 *
 * Read from its source (2026-08-18): MuseScore places **no clamp at all** on a slur endpoint's
 * vertical offset — `SlurSegment::dragGrip` is `ups(g).off += ed.delta` (`slur.cpp:286`) and the
 * property setter is a bare assignment (`slurtie.cpp:273-284`). It does not need one, because a
 * user-moved slur still contributes to the SKYLINE: `fillShape` samples the cubic through
 * `ups(…).pos()`, which is `p + off` (`slurtielayout.cpp:3257-3267`), and every spanner segment whose
 * `addToSkyline()` passes is added to its staff's skyline (`systemlayout.cpp:1967-1973`) with no
 * "user-modified ⇒ excluded" condition. So the systems open up and the arc always has room.
 *
 * ⛔ We do not reflow — a slur has no vote in vertical spacing here (`RenderPass.drawnCurves` feeds
 * only the trill clearance) — so for us a limit is the honest substitute. ⚠️ It is a UI safety rule,
 * NOT an engraving one: no treatise discusses a slur 66 spaces from its notes, because no engraver
 * draws one.
 *
 * ## The rule
 *
 * **UP TO THE NEAREST STAFF, and no further.** A mark may leave its own staff freely and use the
 * whole gap to whatever is painted above or below it, stopping at that staff's near EDGE. Where
 * nothing is painted on that side the room is unbounded and the PAGE limit stops you instead; the
 * two guards compose.
 *
 * 🚨🚨 **IT USED TO STOP HALFWAY, AND THAT WAS WRONG TWICE IN ONE DAY** (2026-08-21, his reports):
 *
 * 1. *"the band rule have a problem… look how the pedal is limit before the pedal lane, rethink the
 *    band limit in general cause this should not happen"* — a pedal belongs BELOW its staff, and in a
 *    grand staff that lane lies between the two staves, already past halfway to the one below. The
 *    rule refused the mark its own ENGRAVED HOME: it could not be nudged at all.
 * 2. *"why the pedal is limit so early if there is enough space between this and the next system…
 *    there is a problem with the bands"* — the same halving one lane over. The pedal is the OUTERMOST
 *    below-staff family, so its home is already most of the way to the midpoint and the travel left
 *    over is a space or two, with the paper visibly empty underneath.
 *
 * ⭐ **The fault both times was the MIDPOINT, not which staves counted.** Halfway is only generous to
 * a mark that lives near its own staff; every family that lives far out — the pedal, and any mark
 * under a full ladder — is squeezed by it, and the squeeze is invisible in the rule and obvious on
 * the page. A staff's edge is a boundary the user can SEE, which is the whole reason it convinces.
 *
 * ⭐ **And his own words have always been about SYSTEMS, not midpoints** — *"so the ottava is on the
 * system it belongs to"*, *"if it is the first system the limit is the top of the page; if not, the
 * limit is calculated in relation with the system above"*. Stopping at the neighbouring staff keeps
 * every mark on its own system, which is what was asked for; ⛔ the midpoint was my arithmetic, not
 * his rule.
 *
 * ⚠️ **So a mark may now use the space between two systems, right up to the next staff.** That is
 * deliberate: the gap is empty paper, the user is pointing at it, and nothing else claims it. What
 * the rule still refuses is ENTERING somebody else's staff.
 */
import { stepLeavesPage } from './pageBounds'
import type { InkBox } from './pageBounds'

/** A vertical extent in pixels; `top` is the smaller number (screen-down is +y). */
export interface Band {
  top: number
  bottom: number
}

/**
 * How far the ink on `mine` may reach before it is in a neighbour's room: out to the near EDGE of the
 * nearest band clear of it on each side.
 *
 * ⚠️ Only bands ENTIRELY clear of `mine` count as neighbours. A band that overlaps it is the same
 * staff seen twice (a re-registered geometry) or a genuine overlap the layout already has, and either
 * way a boundary drawn from it would sit inside the staff itself.
 *
 * ⭐⭐ **A SIDE WITH NO STAFF IS BOUNDED BY THE SHEET, not by a made-up number** — his rule,
 * 2026-08-21: *"if it is the first system the limit is the top of the page; if not, the limit is
 * calculated in relation with the system above"*, and again plainly: *"if the 8va y is less than the
 * page y then refuse, else go ahead"*. It is what this module's header has always said, too.
 *
 * 🚨🚨 **It was written that way, then removed, and the removal was the bug.** On 2026-08-18 a drag
 * reached `y: −11` — above the top of the drawing — and instead of asking why the PAGE limit had not
 * refused it, a made-up allowance went in here: half the tightest gap on the page, or half the
 * staff's own height when the page holds no other staff. On the TOP system that number is the only
 * thing standing between the mark and the paper's edge, and it is far tighter than the edge — which
 * is how an `8va` on the first system ran out of room while the page above it was still empty.
 *
 * ⭐ The real fault was in `./pageBounds`: a canvas answered *"not paper"* on all four edges when it
 * has a real one at y 0. Fixed there, where it belongs, so this rule is about NEIGHBOURS again and
 * nothing else — and the two guards compose, exactly as the header describes.
 */
export function neighbourBandOf(
  mine: Band,
  others: readonly Band[],
  /**
   * ⭐ **The sheet this staff is drawn on** — what is above and below when no STAFF is. Default
   * unbounded, for a caller that cannot say (and for the pure arithmetic tests).
   */
  page: Band = { top: -Infinity, bottom: Infinity },
): Band {
  let above = -Infinity
  let below = Infinity
  for (const other of others) {
    // ⚠️ Only bands ENTIRELY clear of mine count — see the note above.
    if (other.bottom < mine.top) above = Math.max(above, other.bottom)
    else if (other.top > mine.bottom) below = Math.min(below, other.top)
  }
  // ⭐⭐ ONE QUESTION PER SIDE — *"always ask if what we have above is the beginning of the canvas or
  // a staff, and suppose the same below"* (his words, 2026-08-21). A staff ⇒ its near edge; nothing
  // ⇒ the sheet's edge. ⛔ No midpoint: see the header for the two reports that killed it.
  return {
    top: above === -Infinity ? page.top : above,
    bottom: below === Infinity ? page.bottom : below,
  }
}

/**
 * ⭐ **May this step be written?** `false` refuses it. `dy` is in PIXELS, screen-down positive.
 *
 * ⭐ The arithmetic is `./pageBounds`' own — the band is handed to {@link stepLeavesPage} as a sheet
 * with unbounded x, so "would this push the ink further out than it already is" is answered once, in
 * one place, for both limits. ⚠️ That *further* matters: a score already carrying a wild offset (a
 * saved file, an undo away) must still be draggable BACK, so a step is judged on whether it makes
 * the overhang worse, never on whether the ink is outside.
 *
 * ⚠️ Ink with no drawn boxes is ALLOWED, for the page limit's reason: there is nothing to measure,
 * and refusing on no evidence makes an object unmovable for a reason the user cannot see.
 */
export function stepStaysInBand(band: Band, drawn: readonly InkBox[], dy: number): boolean {
  const sheet = { left: -Infinity, right: Infinity, top: band.top, bottom: band.bottom }
  return !drawn.some(ink => stepLeavesPage(sheet, ink, 0, dy))
}

/** A painted (system, staff) as `ElementRegistry.staffRuns()` reports it — a y band and the x its
 *  music occupies. */
export interface StaffRun {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * ⭐⭐ **THE RUNS ON THE SHEET UNDER A GIVEN x** — those no further from it horizontally than the
 * nearest is.
 *
 * 🚨🚨 `PagePass` draws the sheets SIDE BY SIDE, so a staff's y says nothing about which PAGE it is
 * on. Two of his reports on 2026-08-30 came from asking a y alone: a dragged mark jumped onto the
 * next sheet (`interactions/markSystemJump`), and an `8va` on page 1's first system was fenced in by
 * staves on pages 2 and 3 that merely sat at that height — `mine 276…316 | band 270…361`, six pixels
 * of room under a ceiling that should have been the top of the paper.
 *
 * ⚠️ **Distance, ⛔ not containment.** A mark legitimately hangs past the last note of its line, or
 * over the page's margin, and it is still plainly on that sheet. Nearest-wins needs no constant and
 * no knowledge of how wide a gutter is.
 *
 * ⭐ On a one-page score every run is on the one sheet, so every caller reads exactly as it did
 * before pages could stand side by side.
 *
 * 🚨🚨 **THE DISTANCE IS TO THE *SHEET*, ⛔ NEVER TO A SINGLE RUN — and asking a run was a bug in
 * one page.** His report, 2026-08-30: a trill dragged left along system 1 pinned itself at the start
 * of its line and then landed anchored on SYSTEM 2, with the guide line running down the page. From
 * his own trace, one pixel apart and nothing else changed:
 *
 *     cursor x193 … | [jump] ink 247 | home 276…316 | the 'betweenTheMusic' rule holds it here
 *     cursor x192 … | [jump] ink 247 | home 276…316 | the 'betweenTheMusic' rule says GO to 554…594
 *
 * ⭐ **Because a run's `left` is `noteStartX` — AFTER the clef *and*, in bar 1 only, the time
 * signature.** Measured on his Prelude: system 1's music begins at 192 and every later system's at
 * 158. So a cursor in the left margin is genuinely *nearer* to systems 2…n, and a per-run
 * nearest-wins deletes SYSTEM 1 from its own page — leaving `bandOwning` to hand the mark whichever
 * staff happened to sort first, 300px away. ⛔ Nothing to do with pages; the whole gesture was on one.
 *
 * ⭐ **A SHEET IS A CLUSTER OF RUNS THAT OVERLAP HORIZONTALLY**, which needs no gutter constant and
 * no page count: every system on one sheet spans that sheet's music area and so overlaps its
 * neighbours, while two sheets standing side by side never do. The nearest CLUSTER answers, and
 * every run in it comes along — a system is never separated from the page it is printed on.
 */
export function runsOnSheetAt<T extends StaffRun>(runs: readonly T[], x: number): T[] {
  if (!runs.length) return []
  const gap = (sheet: { left: number; right: number }) =>
    (x < sheet.left ? sheet.left - x : x > sheet.right ? x - sheet.right : 0)
  const sheet = sheetsOf(runs).reduce((a, b) => (gap(b) < gap(a) ? b : a))
  // ⚠️ Filtered from the ORIGINAL array: the merge has to sort by x, and a caller reading the runs
  // in the order the registry painted them (top to bottom) must not have them handed back reordered.
  const mine = new Set(sheet.runs)
  return runs.filter(run => mine.has(run))
}

/**
 * The sheets `runs` are printed on, left to right — runs merged wherever their x's overlap.
 *
 * ⚠️ The classic interval merge, and it is the only honest reading of "the same sheet" available
 * here: `StaffRun` carries no page, so the paper has to be recovered from the ink. ⭐ Touching is
 * enough (`<=`): two systems whose music happens to abut share a page, and no gutter is ever zero.
 */
function sheetsOf<T extends StaffRun>(runs: readonly T[]): { left: number; right: number; runs: T[] }[] {
  const sheets: { left: number; right: number; runs: T[] }[] = []
  for (const run of [...runs].sort((a, b) => a.left - b.left)) {
    const open = sheets[sheets.length - 1]
    if (open && run.left <= open.right) {
      open.right = Math.max(open.right, run.right)
      open.runs.push(run)
    } else {
      sheets.push({ left: run.left, right: run.right, runs: [run] })
    }
  }
  return sheets
}
