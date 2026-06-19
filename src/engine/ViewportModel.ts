/**
 * ViewportModel — the framework-agnostic state of the score *viewport*: the fixed-size window
 * you look through, the full content surface behind it, and the current scroll offset between
 * them. Pure data + math, zero DOM, zero Vue — a host adapter (the Vue `useViewport` composable)
 * is the only piece that touches a real scroll element. Survives a framework port verbatim and is
 * unit-testable with no DOM.
 *
 * It owns the scroll-into-view math that `SelectionController.scrollSelectedNoteIntoView` currently
 * inlines against the live DOM; Phase 4 of docs/navigation-viewport-plan.md migrates that call site
 * onto `ensureVisible` so the same logic also drives playback-follow.
 *
 * `zoom` and `viewMode` are reserved for the deferred view-modes / zoom work (§6); they are held
 * here so later features slot in without reshaping the model, but nothing reads them yet.
 */

export interface Size {
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** A rectangle in content-surface coordinates (same space as element bounding boxes). */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type ViewMode = 'galley' | 'pages' | 'continuous-scroll'

/** Default gap (px) kept between an `ensureVisible` target and the viewport edge. */
export const ENSURE_VISIBLE_PADDING = 50

/** Zoom range — the layout→screen scalar is clamped to `[ZOOM_MIN, ZOOM_MAX]` (25%–400%). */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4

/** Round-number stops the Ctrl+=/Ctrl+- keys snap along (25%–400%). */
export const ZOOM_LADDER = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const

/**
 * Next round-number zoom stop above (`dir > 0`) or below (`dir < 0`) the current zoom, clamped to
 * the ladder ends. Pure helper for the Ctrl+=/Ctrl+- snap behaviour; the epsilon makes a zoom that
 * sits exactly on a stop step to the *neighbouring* stop rather than to itself.
 */
export function nextLadderStop(zoom: number, dir: 1 | -1): number {
  const eps = 1e-3
  if (dir > 0) {
    return ZOOM_LADDER.find((stop) => stop > zoom + eps) ?? ZOOM_MAX
  }
  return [...ZOOM_LADDER].reverse().find((stop) => stop < zoom - eps) ?? ZOOM_MIN
}

export class ViewportModel {
  private viewportSize: Size = { w: 0, h: 0 }
  private contentSize: Size = { w: 0, h: 0 }
  private scroll: Point = { x: 0, y: 0 }

  /**
   * The single layout→screen scalar: `screenPx = layoutPx × zoom`. The model works entirely in
   * scaled (screen) pixels — `viewportSize`, `contentSize`, `scroll`, `maxScroll` all match the DOM
   * — and `zoom` is the one bridge to layout coords (see §2 of docs/zoom-plan.md). Public so screen-
   * space overlays (the text-edit font) can read it; mutate it only through `setZoom`/`zoomAt`.
   */
  zoom = 1
  /** Reserved for deferred view-modes (§6). Not applied to any math yet. */
  viewMode: ViewMode = 'galley'

  // --- Size setters (re-clamp scroll so it can never point past the content) ---

  setViewportSize(w: number, h: number): void {
    this.viewportSize = { w, h }
    this.clampScroll()
  }

  setContentSize(w: number, h: number): void {
    this.contentSize = { w, h }
    this.clampScroll()
  }

  // --- Reads (return copies so callers can't mutate internal state) ---

  getViewportSize(): Size {
    return { ...this.viewportSize }
  }

  getContentSize(): Size {
    return { ...this.contentSize }
  }

  getScroll(): Point {
    return { ...this.scroll }
  }

  /**
   * Largest valid scroll offset on each axis: the content overhang past the viewport, or 0 when
   * the content fits (so it never scrolls into empty space). Scroll is always kept within
   * `[0, maxScroll]`.
   */
  getMaxScroll(): Point {
    return {
      x: Math.max(0, this.contentSize.w - this.viewportSize.w),
      y: Math.max(0, this.contentSize.h - this.viewportSize.h),
    }
  }

  // --- Scroll mutators (every path funnels through scrollTo, the single clamp point) ---

  scrollTo(x: number, y: number): void {
    const max = this.getMaxScroll()
    this.scroll = {
      x: clamp(x, 0, max.x),
      y: clamp(y, 0, max.y),
    }
  }

  scrollBy(dx: number, dy: number): void {
    this.scrollTo(this.scroll.x + dx, this.scroll.y + dy)
  }

  // --- Zoom (the layout→screen scalar; all math stays in screen space) ---

  getZoom(): number {
    return this.zoom
  }

  /**
   * Set the absolute zoom, keeping the top-left content corner fixed. Equivalent to zooming about
   * the origin focal point.
   */
  setZoom(z: number): void {
    this.zoomAbout(z, { x: 0, y: 0 })
  }

  /**
   * Multiply the zoom by `factor`, keeping the content point currently under `focal` (a viewport-
   * relative screen point) stationary. Used by Ctrl+wheel (focal = cursor).
   */
  zoomAt(factor: number, focal: Point): void {
    this.zoomAbout(this.zoom * factor, focal)
  }

  /**
   * Snap to the next/prev round-number stop on the zoom ladder, keeping `focal` stationary. Used by
   * Ctrl+= / Ctrl+- (focal = viewport center).
   */
  zoomToStop(dir: 1 | -1, focal: Point): void {
    this.zoomAbout(nextLadderStop(this.zoom, dir), focal)
  }

  /**
   * Core zoom transform: clamp the requested zoom, then rescale `contentSize` and `scroll` by the
   * zoom ratio so screen space stays consistent and the content point under `focal` stays put
   * (`newScroll = (focal + scroll) × ratio − focal`). `contentSize` is held in screen pixels, so it
   * must scale with zoom — this only multiplies the model's own mirror by the ratio (it never reads
   * natural size), which equals `natural × newZoom`, so it does not fight `useViewport`'s natural-
   * size feed. The final `scrollTo` re-clamps against the freshly grown content.
   */
  private zoomAbout(z: number, focal: Point): void {
    const newZoom = clamp(z, ZOOM_MIN, ZOOM_MAX)
    const ratio = newZoom / this.zoom
    if (ratio === 1) return

    this.contentSize = {
      w: this.contentSize.w * ratio,
      h: this.contentSize.h * ratio,
    }
    const nextX = (focal.x + this.scroll.x) * ratio - focal.x
    const nextY = (focal.y + this.scroll.y) * ratio - focal.y
    this.zoom = newZoom
    this.scrollTo(nextX, nextY)
  }

  /**
   * Scroll the minimum amount so `rect` (in content coordinates) sits at least `padding` px inside
   * the viewport on every overflowing edge. An axis already comfortably in view is left untouched;
   * a target larger than the viewport aligns its leading edge. Mirrors the both-axis, leading-edge
   * priority of the original `scrollSelectedNoteIntoView`, with clamping handled by `scrollTo`.
   *
   * `rect` arrives in unscaled **layout** coords (element bounding boxes), so it is multiplied by
   * `this.zoom` to reach the screen space the rest of the model works in (§2 of the zoom plan).
   */
  ensureVisible(rect: Rect, padding: number = ENSURE_VISIBLE_PADDING): void {
    const z = this.zoom
    const nextX = this.ensureAxis(
      this.scroll.x,
      this.viewportSize.w,
      rect.x * z,
      rect.width * z,
      padding,
    )
    const nextY = this.ensureAxis(
      this.scroll.y,
      this.viewportSize.h,
      rect.y * z,
      rect.height * z,
      padding,
    )
    this.scrollTo(nextX, nextY)
  }

  /**
   * One axis of `ensureVisible`. If the target's leading edge is within `padding` of the visible
   * start, scroll back to reveal it; else if its trailing edge is within `padding` of the visible
   * end, scroll forward. Otherwise the current offset stands.
   */
  private ensureAxis(
    offset: number,
    viewportLength: number,
    rectStart: number,
    rectLength: number,
    padding: number,
  ): number {
    const rectEnd = rectStart + rectLength
    const visibleStart = offset
    const visibleEnd = offset + viewportLength

    if (rectStart < visibleStart + padding) {
      return rectStart - padding
    }
    if (rectEnd > visibleEnd - padding) {
      return rectEnd - viewportLength + padding
    }
    return offset
  }

  private clampScroll(): void {
    this.scrollTo(this.scroll.x, this.scroll.y)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
