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

export class ViewportModel {
  private viewportSize: Size = { w: 0, h: 0 }
  private contentSize: Size = { w: 0, h: 0 }
  private scroll: Point = { x: 0, y: 0 }

  /** Reserved for deferred zoom support (§6). Not applied to any math yet. */
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

  /**
   * Scroll the minimum amount so `rect` (in content coordinates) sits at least `padding` px inside
   * the viewport on every overflowing edge. An axis already comfortably in view is left untouched;
   * a target larger than the viewport aligns its leading edge. Mirrors the both-axis, leading-edge
   * priority of the original `scrollSelectedNoteIntoView`, with clamping handled by `scrollTo`.
   */
  ensureVisible(rect: Rect, padding: number = ENSURE_VISIBLE_PADDING): void {
    const nextX = this.ensureAxis(
      this.scroll.x,
      this.viewportSize.w,
      rect.x,
      rect.width,
      padding,
    )
    const nextY = this.ensureAxis(
      this.scroll.y,
      this.viewportSize.h,
      rect.y,
      rect.height,
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
