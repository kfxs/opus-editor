import { describe, it, expect, beforeEach } from 'vitest'
import { ViewportModel, ENSURE_VISIBLE_PADDING } from './ViewportModel'

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
  })
})
