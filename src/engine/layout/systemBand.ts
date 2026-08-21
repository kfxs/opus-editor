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
 * How far the ink on `mine` may reach before it is in a neighbour's room: `mine` grown by half the
 * gap to the nearest band clear of it on each side.
 *
 * ⚠️ Only bands ENTIRELY clear of `mine` count as neighbours. A band that overlaps it is the same
 * staff seen twice (a re-registered geometry) or a genuine overlap the layout already has, and either
 * way halving a negative gap would produce a limit tighter than the staff itself.
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
  let above = Infinity
  let below = Infinity
  for (const other of others) {
    if (other.bottom < mine.top) above = Math.min(above, mine.top - other.bottom)
    else if (other.top > mine.bottom) below = Math.min(below, other.top - mine.bottom)
  }
  // ⭐⭐ ONE QUESTION PER SIDE — *"always ask if what we have above is the beginning of the canvas or
  // a staff, and suppose the same below"* (his words, 2026-08-21). A staff ⇒ halfway to it; the
  // sheet ⇒ its edge.
  return {
    top: above === Infinity ? page.top : mine.top - above / 2,
    bottom: below === Infinity ? page.bottom : mine.bottom + below / 2,
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
