/**
 * The PASTEBOARD — the empty space the page floats in.
 *
 * Without it the score is pinned to the top-left of the scroll box: a page narrower than the
 * viewport sits hard against the left edge, and there is nowhere to scroll except across the music
 * itself. Sibelius (and Finale, and Dorico) instead put the page on a larger surface you can roam,
 * which is what makes a page feel like an object on a desk rather than content in a box.
 *
 * ⭐ The margin is stated in **layout** pixels, not screen pixels, and that is the whole trick. The
 * viewport model holds `contentSize` and `scroll` in screen space and rescales BOTH by the zoom
 * ratio (`ViewportModel.zoomAbout`), so anything folded into the content must scale with zoom or
 * the arithmetic drifts on every wheel notch. A layout-space margin scales exactly like the music
 * does, which keeps the pasteboard a fixed amount of PAPER rather than a fixed amount of screen.
 *
 * The functions here are pure and know nothing about the DOM: the host multiplies by zoom and
 * writes pixels, the model clamps scroll. See docs/zoom-plan.md §3 for the sizer/zoomLayer pair
 * these feed.
 */

export interface Size {
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/**
 * How much empty space surrounds the page on each side, in layout px.
 *
 * Chosen so a page always has room to be dragged clear of the viewport edges at 100% zoom, without
 * the scroll bars implying a document far larger than the music. It is one number on purpose — a
 * per-side table would be four numbers to justify and none of them would mean anything different.
 */
export const PASTEBOARD_MARGIN = 400

/** The scrollable surface: the page plus the pasteboard on both sides of both axes. */
export function paddedSize(natural: Size, margin: number): Size {
  return { w: natural.w + margin * 2, h: natural.h + margin * 2 }
}

/**
 * Where to sit when the score first appears: horizontally CENTRED, vertically at the top of the
 * page.
 *
 * Not centred on both axes, deliberately. A page is much taller than it is wide, so centring y
 * would open the editor looking at the middle of bar 30-something with the first system off-screen
 * above — the one thing a fresh score must not do. `topGap` leaves a sliver of pasteboard visible
 * above the page so it reads as a sheet on a surface rather than a flush-mounted panel.
 *
 * Sizes are screen px (already multiplied by zoom); the result is clamped by `scrollTo` anyway, so
 * a viewport larger than the surface simply lands at 0.
 */
export function openingScroll(padded: Size, viewport: Size, marginPx: number, topGap: number): Point {
  return {
    x: Math.max(0, (padded.w - viewport.w) / 2),
    y: Math.max(0, marginPx - topGap),
  }
}
