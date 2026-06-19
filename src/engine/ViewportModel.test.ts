import { describe, it, expect, beforeEach } from 'vitest'
import {
  ViewportModel,
  ENSURE_VISIBLE_PADDING,
  ZOOM_MIN,
  ZOOM_MAX,
  nextLadderStop,
} from './ViewportModel'

/**
 * Pure-model coverage for the score viewport: scroll is always clamped to [0, maxScroll], and
 * `ensureVisible` reproduces the both-axis, leading-edge scroll-into-view that
 * SelectionController.scrollSelectedNoteIntoView inlines against the DOM today (Phase 4 migrates
 * that call site onto this model). No DOM is involved.
 */
describe('ViewportModel', () => {
  let m: ViewportModel

  beforeEach(() => {
    m = new ViewportModel()
    m.setViewportSize(1000, 340)
    m.setContentSize(1000, 1500)
  })

  it('starts at origin with reserved zoom/viewMode defaults', () => {
    const fresh = new ViewportModel()
    expect(fresh.getScroll()).toEqual({ x: 0, y: 0 })
    expect(fresh.getViewportSize()).toEqual({ w: 0, h: 0 })
    expect(fresh.getContentSize()).toEqual({ w: 0, h: 0 })
    expect(fresh.zoom).toBe(1)
    expect(fresh.viewMode).toBe('galley')
  })

  it('reports max scroll as the content overhang, never negative', () => {
    expect(m.getMaxScroll()).toEqual({ x: 0, y: 1160 }) // 1500 - 340 vertically; width fits
    m.setContentSize(800, 200) // both axes smaller than the viewport
    expect(m.getMaxScroll()).toEqual({ x: 0, y: 0 })
  })

  it('clamps scrollTo into [0, maxScroll] on both axes', () => {
    m.scrollTo(-50, -50)
    expect(m.getScroll()).toEqual({ x: 0, y: 0 })

    m.scrollTo(9999, 9999)
    expect(m.getScroll()).toEqual({ x: 0, y: 1160 }) // x has no overhang, y pinned to max
  })

  it('scrollBy accumulates and stays clamped', () => {
    m.scrollTo(0, 100)
    m.scrollBy(0, 100)
    expect(m.getScroll()).toEqual({ x: 0, y: 200 })
    m.scrollBy(0, 5000)
    expect(m.getScroll().y).toBe(1160)
  })

  it('re-clamps scroll when the content shrinks under the current offset', () => {
    m.scrollTo(0, 1160)
    m.setContentSize(1000, 500) // max y now 160
    expect(m.getScroll().y).toBe(160)
  })

  it('re-clamps scroll when the viewport grows past the content overhang', () => {
    m.scrollTo(0, 1160)
    m.setViewportSize(1000, 1500) // viewport now as tall as content → max 0
    expect(m.getScroll().y).toBe(0)
  })

  describe('ensureVisible', () => {
    it('leaves an element already comfortably in view untouched', () => {
      m.scrollTo(0, 500)
      m.ensureVisible({ x: 100, y: 700, width: 20, height: 40 })
      expect(m.getScroll()).toEqual({ x: 0, y: 500 })
    })

    it('scrolls up to reveal an element above the window, keeping padding', () => {
      m.scrollTo(0, 800)
      m.ensureVisible({ x: 0, y: 810, width: 20, height: 40 })
      expect(m.getScroll().y).toBe(810 - ENSURE_VISIBLE_PADDING)
    })

    it('scrolls down to reveal an element below the window, keeping padding', () => {
      m.scrollTo(0, 0)
      // element bottom = 540; visible end = 340 → must scroll so bottom + padding shows
      m.ensureVisible({ x: 0, y: 500, width: 20, height: 40 })
      expect(m.getScroll().y).toBe(540 - 340 + ENSURE_VISIBLE_PADDING)
    })

    it('handles the horizontal axis independently', () => {
      m.setContentSize(3000, 1500)
      m.scrollTo(0, 0)
      m.ensureVisible({ x: 2000, y: 0, width: 20, height: 40 })
      // right edge 2020 must clear the viewport end with padding; y target (0) needs no move
      expect(m.getScroll()).toEqual({ x: 2020 - 1000 + ENSURE_VISIBLE_PADDING, y: 0 })
    })

    it('clamps to 0 rather than scrolling past the top edge', () => {
      m.scrollTo(0, 30)
      m.ensureVisible({ x: 0, y: 10, width: 20, height: 40 }) // wants -40, clamps to 0
      expect(m.getScroll().y).toBe(0)
    })

    it('respects a custom padding override', () => {
      m.scrollTo(0, 800)
      m.ensureVisible({ x: 0, y: 805, width: 20, height: 40 }, 10)
      expect(m.getScroll().y).toBe(805 - 10)
    })

    it('scales the layout rect by zoom before the visibility math', () => {
      m.setContentSize(2000, 3000) // screen space; room to scroll on both axes
      m.setZoom(2) // 1× layout coords now map to 2× screen px
      m.scrollTo(0, 0)
      // layout y 500 → screen 1000; bottom 1080 vs visible end 340 → scroll to show it + padding
      m.ensureVisible({ x: 0, y: 500, width: 0, height: 40 })
      expect(m.getScroll().y).toBe(1080 - 340 + ENSURE_VISIBLE_PADDING)
    })
  })

  describe('zoom', () => {
    it('clamps setZoom into [ZOOM_MIN, ZOOM_MAX]', () => {
      m.setZoom(100)
      expect(m.getZoom()).toBe(ZOOM_MAX)
      m.setZoom(0.0001)
      expect(m.getZoom()).toBe(ZOOM_MIN)
    })

    it('rescales contentSize by the zoom ratio so screen space stays consistent', () => {
      m.setZoom(2)
      expect(m.getContentSize()).toEqual({ w: 2000, h: 3000 }) // 1000×2, 1500×2
      m.setZoom(1)
      expect(m.getContentSize()).toEqual({ w: 1000, h: 1500 })
    })

    it('setZoom keeps the top-left content corner fixed (scroll scales with zoom)', () => {
      m.setContentSize(4000, 6000)
      m.scrollTo(200, 300)
      m.setZoom(2)
      expect(m.getScroll()).toEqual({ x: 400, y: 600 })
    })

    it('zoomAt keeps the content point under the focal point stationary', () => {
      m.setViewportSize(1000, 1000)
      m.setContentSize(5000, 5000)
      m.scrollTo(100, 100)
      const focal = { x: 300, y: 200 }
      // content position under the focal point, in screen space, before the zoom
      const before = { x: m.getScroll().x + focal.x, y: m.getScroll().y + focal.y }
      m.zoomAt(2, focal)
      // same underlying content fraction, now at 2× screen scale
      const afterContent = { x: before.x * 2, y: before.y * 2 }
      // its viewport-relative position must be unchanged
      expect(afterContent.x - m.getScroll().x).toBeCloseTo(focal.x)
      expect(afterContent.y - m.getScroll().y).toBeCloseTo(focal.y)
    })

    it('zoomAt multiplies the current zoom and clamps', () => {
      m.setZoom(2)
      m.zoomAt(4, { x: 0, y: 0 }) // 2 × 4 = 8 → clamps to ZOOM_MAX
      expect(m.getZoom()).toBe(ZOOM_MAX)
    })

    it('zoomToStop snaps along the ladder, re-clamping scroll', () => {
      m.zoomToStop(1, { x: 0, y: 0 })
      expect(m.getZoom()).toBe(1.5) // next stop above 1
      m.zoomToStop(-1, { x: 0, y: 0 })
      expect(m.getZoom()).toBe(1) // back down
    })

    it('a no-op zoom (already clamped at the max) leaves scroll and content untouched', () => {
      m.setContentSize(4000, 6000)
      m.setZoom(ZOOM_MAX)
      const content = m.getContentSize()
      const scroll = m.getScroll()
      m.zoomAt(2, { x: 100, y: 100 }) // would exceed ZOOM_MAX → ratio 1, no change
      expect(m.getContentSize()).toEqual(content)
      expect(m.getScroll()).toEqual(scroll)
    })
  })

  describe('nextLadderStop', () => {
    it('steps up to the next round stop', () => {
      expect(nextLadderStop(1, 1)).toBe(1.5)
      expect(nextLadderStop(0.25, 1)).toBe(0.5)
      expect(nextLadderStop(1.2, 1)).toBe(1.5)
    })

    it('steps down to the previous round stop', () => {
      expect(nextLadderStop(1, -1)).toBe(0.75)
      expect(nextLadderStop(4, -1)).toBe(3)
      expect(nextLadderStop(1.6, -1)).toBe(1.5)
    })

    it('clamps at the ladder ends', () => {
      expect(nextLadderStop(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
      expect(nextLadderStop(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
    })
  })
})
