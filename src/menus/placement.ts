/**
 * Where a menu goes. Pure arithmetic — no DOM, so it is testable without a browser.
 *
 * ⚠️ A menu FLIPS; it does not clamp. This is the one place its geometry parts company with a
 * window's. A window dragged past the right edge is pushed back inside and that is fine. A menu
 * pushed back inside would land UNDER THE CURSOR that opened it — you would be reading rows through
 * your own pointer, and the first row you can see is not the row you would click. So it opens
 * down-and-right from the anchor by default, and flips to the other side of the anchor when it
 * would overflow. Clamping is only the last resort, for a menu too big to fit either way.
 */

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point, Size {}

/** The world: the score viewport's box, never the browser's. */
export interface Bounds {
  width: number
  height: number
}

/**
 * One axis. Take `preferred`; if the box would overflow, take `flipped` instead; if THAT is off the
 * near edge too (the menu is simply bigger than the world), clamp — a partly-visible menu beats one
 * placed off-screen, and the panel scrolls.
 */
function fit(preferred: number, flipped: number, extent: number, limit: number): number {
  if (preferred >= 0 && preferred + extent <= limit) return preferred
  if (flipped >= 0 && flipped + extent <= limit) return flipped
  return Math.max(0, Math.min(preferred, limit - extent))
}

/**
 * The root menu: its top-left corner at the click, flipping about the click point itself, so the
 * pointer always ends up on a CORNER of the menu and never inside it.
 */
export function placeRoot(anchor: Point, size: Size, bounds: Bounds): Point {
  return {
    x: fit(anchor.x, anchor.x - size.width, size.width, bounds.width),
    y: fit(anchor.y, anchor.y - size.height, size.height, bounds.height),
  }
}

/** Flyouts overlap their parent by a hair, so a diagonal mouse path never crosses a gap and dismisses. */
const FLYOUT_OVERLAP = 3

/**
 * A flyout: to the RIGHT of the parent panel, its top level with the row that opened it — and to the
 * left when there is no room, which is why a menu near the right edge cascades back across itself
 * rather than walking off the paper.
 *
 * Vertically it does NOT flip (a flyout hanging upwards from its row reads as a different row's
 * menu); it slides up to stay inside, which keeps it touching the row that owns it.
 */
export function placeFlyout(parent: Rect, rowY: number, size: Size, bounds: Bounds): Point {
  const right = parent.x + parent.width - FLYOUT_OVERLAP
  const left = parent.x - size.width + FLYOUT_OVERLAP
  return {
    x: fit(right, left, size.width, bounds.width),
    y: Math.max(0, Math.min(rowY, bounds.height - size.height)),
  }
}
