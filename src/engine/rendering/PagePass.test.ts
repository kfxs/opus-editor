// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { drawPages, pageTopPx, surfaceHeightPx, PAGE_GAP_PX, PAGE_SHEET_CLASS } from './PagePass'
import { resolveSurface, SKETCH_CANVAS, A4_NORMAL } from '@/engine/layout/surface'

/**
 * ⚠️ The STACKING and the DOM contract only. Where the sheets actually land against the music is
 * geometry, and jsdom has none — that is `e2e/pages.e2e.ts`, which measures the drawn rects.
 */

const CANVAS = resolveSurface(SKETCH_CANVAS)
const A4 = resolveSurface(A4_NORMAL)

const svgEl = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg')

describe('the stacking', () => {
  it('puts each sheet a page-and-a-gutter below the last', () => {
    expect(pageTopPx(A4, 0)).toBe(0)
    expect(pageTopPx(A4, 1)).toBeCloseTo(A4.heightPx! + PAGE_GAP_PX, 6)
    expect(pageTopPx(A4, 3)).toBeCloseTo(3 * (A4.heightPx! + PAGE_GAP_PX), 6)
  })

  it('has no stacking to do on a canvas — there is one strip and it starts at 0', () => {
    expect(pageTopPx(CANVAS, 0)).toBe(0)
    expect(pageTopPx(CANVAS, 5)).toBe(0)
  })

  it('sizes the SVG to the sheets, gutters included', () => {
    expect(surfaceHeightPx(A4, 1, 9999)).toBeCloseTo(A4.heightPx!, 6)
    expect(surfaceHeightPx(A4, 3, 9999)).toBeCloseTo(3 * A4.heightPx! + 2 * PAGE_GAP_PX, 6)
  })

  it('sizes a canvas to the music instead — the strip grows, the paper never does', () => {
    // Σ system heights + the top and bottom margins: what the editor has always been sized to.
    expect(surfaceHeightPx(CANVAS, 1, 600)).toBe(640)
  })
})

describe('drawPages', () => {
  it('draws nothing at all on a canvas', () => {
    const svg = svgEl()
    drawPages(svg, CANVAS, 1, 1000)
    expect(svg.children).toHaveLength(0)
  })

  it('draws one sheet per page, behind everything already in the SVG', () => {
    const svg = svgEl()
    const music = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(music)

    drawPages(svg, A4, 3, A4.widthPx)

    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(3)
    // ⭐ FIRST child, not last: measure groups are reused across renders, so an appended underlay
    // would paint over every bar that survived the last one.
    expect(svg.firstChild).not.toBe(music)
    expect(svg.lastChild).toBe(music)
  })

  it('replaces the last render’s sheets rather than piling more on', () => {
    const svg = svgEl()
    drawPages(svg, A4, 3, A4.widthPx)
    drawPages(svg, A4, 2, A4.widthPx)
    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(2)
  })

  it('takes the sheets away when the surface goes back to a canvas', () => {
    const svg = svgEl()
    drawPages(svg, A4, 2, A4.widthPx)
    drawPages(svg, CANVAS, 1, 1000)
    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(0)
  })

  it('never answers a hit-test — it is chrome behind the music, not ink in it', () => {
    const svg = svgEl()
    drawPages(svg, A4, 1, A4.widthPx)
    expect(svg.firstElementChild!.getAttribute('pointer-events')).toBe('none')
  })
})
