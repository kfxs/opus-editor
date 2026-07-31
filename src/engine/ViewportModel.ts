/**
 * ViewportModel — the framework-agnostic state of the score *viewport*: the fixed-size window
 * you look through, the full content surface behind it, and the current scroll offset between
 * them. Pure data + math, zero DOM, zero framework — a host adapter (`interactions/ViewportHost`)
 * is the only piece that touches a real scroll element. Survives a framework port verbatim and is
 * unit-testable with no DOM.
 *
 * It owns the scroll-into-view math that `SelectionController.scrollSelectedNoteIntoView` currently
 * inlines against the live DOM; Phase 4 of docs/navigation-viewport-plan.md migrates that call site
 * onto `ensureVisible` so the same logic also drives playback-follow.
 *
 * It owns `zoom` (the one layout→screen scalar) but NOT the view mode: wrapped-vs-linear is a
 * layout decision, and layout is engine work — the mode lives on MusicEngine instead. Zoom is
 * only here because it never touches layout (it is a CSS transform). See
 * docs/linear-view-plan.md §5, P0.
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

/** Default gap (px) kept between an `ensureVisible` target and the viewport edge. */
export const ENSURE_VISIBLE_PADDING = 50

/**
 * P6 overscan: how far past each edge of the visible rect the renderer actually draws, as a
 * fraction of the viewport's own size (docs/render-performance-plan.md §8).
 *
 * It buys two different things at once, which is why it is not just "a bit of margin":
 *
 *  - **Scrolling stays free inside it.** A render only happens when the visible rect *escapes* the
 *    drawn window, so at 0.5 you scroll half a screen before paying anything. Without overscan every
 *    scrolled pixel would re-cull and re-render, and P6 would make scrolling worse than the CSS
 *    scroll it replaced.
 *  - **It bounds what each of those renders costs.** Crossing the boundary advances the window by
 *    half a viewport, so the newly-exposed strip — the only bars actually drawn — is half a screen
 *    of music, not a whole score.
 *
 * Raising it means rarer, fatter renders; lowering it means more frequent, thinner ones. 0.5 draws
 * 2×2 viewports' worth of music at rest.
 */
export const CULL_OVERSCAN = 0.5

/** Grow `rect` by `fraction` of its own size on all four sides. The drawn window is the visible
 *  rect expanded this way; see {@link CULL_OVERSCAN}. */
export function expandRect(rect: Rect, fraction: number): Rect {
  const padX = rect.width * fraction
  const padY = rect.height * fraction
  return {
    x: rect.x - padX,
    y: rect.y - padY,
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  }
}

/** Does `outer` fully contain `inner`? The test that decides whether a scroll needs a render. */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/** Zoom range — the layout→screen scalar is clamped to `[ZOOM_MIN, ZOOM_MAX]` (25%–400%). */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4

/** Round-number stops the Ctrl+=/Ctrl+- keys snap along (25%–400%). */
export const ZOOM_LADDER = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const

/**
 * What the editor OPENS at — further out than actual size, so the first thing you see is a page of
 * music rather than three bars of it. Two wheel notches out from 100%
 * (`exp(-100 × ZOOM_WHEEL_K)² ≈ 0.74`): far enough to see the shape of a phrase, close enough that
 * the noteheads are still notes.
 *
 * The MODEL still starts at 1, and deliberately: its identity transform has to be the identity, or
 * every calculation and every test begins scaled. Where the EDITOR opens is a decision about the
 * editor, so the app applies this once at start-up. `Ctrl+0` still goes to 100% — actual size is a fact about the
 * page, while this is only where the view begins.
 */
export const DEFAULT_ZOOM = 0.7

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

  /**
   * The pasteboard margin in LAYOUT px (see `./pasteboard`) — the empty surface the page floats in.
   *
   * Defaults to 0, so the model behaves exactly as it did until a host opts in. It is held here
   * rather than in the host because it displaces the LAYOUT ORIGIN: content coords now start one
   * margin in from the scroll surface, and the two conversions below are the only places that care.
   */
  private pasteboard = 0

  setPasteboard(marginLayoutPx: number): void {
    this.pasteboard = marginLayoutPx
    this.clampScroll()
  }

  getPasteboard(): number {
    return this.pasteboard
  }

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
   * The window onto the music, in **layout** (unscaled) coordinates — the space measure boxes and
   * element bounding boxes live in. The model itself works in screen pixels, so this is the one
   * place that divides back out by zoom: `layoutPx = screenPx / zoom`.
   *
   * This is what P6 culls against (docs/render-performance-plan.md §8). Note the coordinate origin
   * is the zoom layer's, which includes the content surface's own padding — the caller subtracts
   * that inset to reach SVG-internal coords. Overscan swamps the difference, but the subtraction is
   * still made rather than hand-waved.
   */
  getVisibleRect(): Rect {
    const z = this.zoom
    // Minus the pasteboard: scroll is measured from the scroll SURFACE's corner, and the music
    // starts one margin in from it. Without this the cull window is offset by a whole margin — the
    // kind of error overscan hides until someone tightens the overscan.
    return {
      x: this.scroll.x / z - this.pasteboard,
      y: this.scroll.y / z - this.pasteboard,
      width: this.viewportSize.w / z,
      height: this.viewportSize.h / z,
    }
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
    // Plus the pasteboard, the mirror of getVisibleRect: a layout coord is one margin further along
    // the scroll surface than it is into the music.
    const inset = this.pasteboard * z
    const nextX = this.ensureAxis(
      this.scroll.x,
      this.viewportSize.w,
      rect.x * z + inset,
      rect.width * z,
      padding,
    )
    const nextY = this.ensureAxis(
      this.scroll.y,
      this.viewportSize.h,
      rect.y * z + inset,
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
