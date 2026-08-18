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
 * **Halfway to the nearest staff.** A mark may leave its own staff freely and use up to half the gap
 * to whatever is painted above or below it — which is a derived quantity, not a chosen number, and it
 * makes no distinction between the staff below in a piano system and the staff below in the NEXT
 * system: both are somebody else's room, and the rule that keeps ink out of one keeps it out of the
 * other. Where nothing is painted on that side the room is unbounded, and the PAGE limit is what
 * stops you there; the two guards compose.
 */
import { stepLeavesPage } from './pageBounds'
import type { InkBox } from './pageBounds'

/** A vertical extent in pixels; `top` is the smaller number (screen-down is +y). */
export interface Band {
  top: number
  bottom: number
}

/**
 * The smallest gap between any two painted staves — **the room a neighbour would have given**, for a
 * side that has none.
 *
 * 🚨 The first version of this file made a missing side UNBOUNDED, and that was wrong in the way that
 * matters: bar 3 of his score is in the TOP system, so upward had no limit at all and a drag reached
 * `y: −11` straight past the guard that had just been added ("we should never go this way either",
 * 2026-08-18). The first and last systems are not special to a reader — an arc over the top staff
 * looks exactly as wrong as one between two staves — so they get the same allowance as everybody
 * else, taken from the score's own spacing rather than from a number someone chose.
 *
 * ⚠️ The MINIMUM, not the mean: the limit has to hold in the tightest place on the page, and a
 * generous average would license ink that collides where the systems are closest.
 */
function typicalGap(bands: readonly Band[]): number {
  const sorted = [...bands].sort((a, b) => a.top - b.top)
  let smallest = Infinity
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].top - sorted[i - 1].bottom
    if (gap > 0) smallest = Math.min(smallest, gap)
  }
  return smallest
}

/**
 * How far the ink on `mine` may reach before it is in a neighbour's room: `mine` grown by half the
 * gap to the nearest band clear of it on each side.
 *
 * ⚠️ Only bands ENTIRELY clear of `mine` count as neighbours. A band that overlaps it is the same
 * staff seen twice (a re-registered geometry) or a genuine overlap the layout already has, and either
 * way halving a negative gap would produce a limit tighter than the staff itself.
 *
 * ⛔ A side with no neighbour falls back to {@link typicalGap}, and — when there is no other staff
 * on the page at all — to the staff's OWN height, which is the only length the render offers when it
 * has nothing to compare with. Never to infinity: see `typicalGap`'s note for what that cost.
 */
export function neighbourBandOf(mine: Band, others: readonly Band[]): Band {
  const fallback = (() => {
    const typical = typicalGap([mine, ...others])
    return typical === Infinity ? mine.bottom - mine.top : typical
  })()

  let above = Infinity
  let below = Infinity
  for (const other of others) {
    if (other.bottom < mine.top) above = Math.min(above, mine.top - other.bottom)
    else if (other.top > mine.bottom) below = Math.min(below, other.top - mine.bottom)
  }
  return {
    top: mine.top - (above === Infinity ? fallback : above) / 2,
    bottom: mine.bottom + (below === Infinity ? fallback : below) / 2,
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
