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

/** How much desk there is on each side, per axis, in layout px. See {@link pasteboardMargins}. */
export interface Margins {
  x: number
  y: number
}

/**
 * The desk, per axis — and it is **not square**, because the two axes are not in the same
 * situation.
 *
 * Horizontally the MUSIC provides the travel: a score is wider than any window, linear view's runs
 * off to the right for as long as the piece lasts, and its leading edge is pinned by the gutter
 * anyway. `base` is all the room that side needs.
 *
 * Vertically it does not. A single system is a few hundred pixels tall in a window several times
 * that, so where it SITS on screen is decided entirely by how much desk there is above and below
 * it — and with a fixed margin the answer is "somewhere in the middle third, take it or leave it".
 * ⭐ One viewport of desk at each end is exactly the amount that lets any part of the music be put
 * anywhere in the window, from just below the top edge to just above the bottom one. Wanting the
 * system high, with room beneath to think in, is a reading decision and belongs to the reader.
 *
 * `viewportLayout` is the window in LAYOUT px (screen ÷ zoom), so the slack is one viewport at every
 * zoom rather than one viewport at 100%.
 */
export function pasteboardMargins(base: number, viewportLayout: Size): Margins {
  return { x: base, y: Math.max(base, viewportLayout.h) }
}

/** The scrollable surface: the page plus the pasteboard on both sides of both axes. */
export function paddedSize(natural: Size, margin: Margins): Size {
  return { w: natural.w + margin.x * 2, h: natural.h + margin.y * 2 }
}

/**
 * How the opening view is aligned horizontally — see {@link openingScroll}. A page has a middle to
 * sit in the middle of; an endless strip has only a beginning.
 */
export type OpeningAlign = 'center' | 'start'

/**
 * Where to sit when the score first appears: vertically at the top of the page, horizontally either
 * CENTRED on the desk (a page) or at the very START of the music (a strip).
 *
 * Not centred on both axes, deliberately. A page is much taller than it is wide, so centring y
 * would open the editor looking at the middle of bar 30-something with the first system off-screen
 * above — the one thing a fresh score must not do. `topGap` leaves a sliver of pasteboard visible
 * above the page so it reads as a sheet on a surface rather than a flush-mounted panel.
 *
 * ⭐ `'start'` is linear view's, for the same reason: the music runs off to the right for as long as
 * the score lasts, so the desk it floats on has no middle worth looking at, and the frozen gutter is
 * pinned at the leading edge already doing its job. It asks for 0 rather than for the limit — the
 * limit is the viewport's business (`ViewportModel.setPinnedGutter`), and clamping 0 against it
 * lands exactly there.
 *
 * Sizes are screen px (already multiplied by zoom); the result is clamped by `scrollTo` anyway, so
 * a viewport larger than the surface simply lands at 0.
 */
export function openingScroll(
  padded: Size,
  viewport: Size,
  marginPx: number,
  topGap: number,
  align: OpeningAlign = 'center',
): Point {
  return {
    x: align === 'start' ? 0 : Math.max(0, (padded.w - viewport.w) / 2),
    y: Math.max(0, marginPx - topGap),
  }
}
