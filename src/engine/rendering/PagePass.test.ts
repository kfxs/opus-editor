// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { drawPages, pageOriginPx, surfaceSizePx, PAGE_GAP_PX, PAGE_SHEET_CLASS } from './PagePass'
import { resolveSurface, SKETCH_CANVAS, A4_NORMAL } from '@/engine/layout/surface'

/**
 * ⚠️ The STACKING and the DOM contract only. Where the sheets actually land against the music is
 * geometry, and jsdom has none — that is `e2e/pages.e2e.ts`, which measures the drawn rects.
 */

const CANVAS = resolveSurface(SKETCH_CANVAS)
const A4 = resolveSurface(A4_NORMAL)

const svgEl = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg')

describe('the spread', () => {
  it('puts each sheet a page-and-a-gutter to the RIGHT of the last — Sibelius, not a roll of paper', () => {
    expect(pageOriginPx(A4, 0)).toEqual({ x: 0, y: 0 })
    expect(pageOriginPx(A4, 1).x).toBeCloseTo(A4.widthPx + PAGE_GAP_PX, 6)
    expect(pageOriginPx(A4, 3).x).toBeCloseTo(3 * (A4.widthPx + PAGE_GAP_PX), 6)
    // Side by side means every sheet shares one top edge.
    for (const page of [0, 1, 2, 3]) expect(pageOriginPx(A4, page).y).toBe(0)
  })

  it('has no spread to lay out on a canvas — there is one column and it starts at the origin', () => {
    expect(pageOriginPx(CANVAS, 0)).toEqual({ x: 0, y: 0 })
    expect(pageOriginPx(CANVAS, 5)).toEqual({ x: 0, y: 0 })
  })

  it('sizes the SVG to the whole spread, gutters included, one page tall', () => {
    expect(surfaceSizePx(A4, 1, 9999)).toEqual({ width: A4.widthPx, height: A4.heightPx })
    const three = surfaceSizePx(A4, 3, 9999)
    expect(three.width).toBeCloseTo(3 * A4.widthPx + 2 * PAGE_GAP_PX, 6)
    expect(three.height).toBeCloseTo(A4.heightPx!, 6)
  })

  it('sizes a canvas to the music instead — the column grows, the paper never does', () => {
    // Σ system heights + the top and bottom margins: what the editor has always been sized to.
    expect(surfaceSizePx(CANVAS, 1, 600)).toEqual({ width: 1000, height: 640 })
  })
})

describe('drawPages', () => {
  it('draws nothing at all on a canvas', () => {
    const svg = svgEl()
    drawPages(svg, CANVAS, 1, 'editor')
    expect(svg.children).toHaveLength(0)
  })

  it('draws one sheet per page, behind everything already in the SVG', () => {
    const svg = svgEl()
    const music = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    svg.appendChild(music)

    drawPages(svg, A4, 3, 'editor')

    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(3)
    // ⭐ FIRST child, not last: measure groups are reused across renders, so an appended underlay
    // would paint over every bar that survived the last one.
    expect(svg.firstChild).not.toBe(music)
    expect(svg.lastChild).toBe(music)
  })

  it('replaces the last render’s sheets rather than piling more on', () => {
    const svg = svgEl()
    drawPages(svg, A4, 3, 'editor')
    drawPages(svg, A4, 2, 'editor')
    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(2)
  })

  it('takes the sheets away when the surface goes back to a canvas', () => {
    const svg = svgEl()
    drawPages(svg, A4, 2, 'editor')
    drawPages(svg, CANVAS, 1, 'editor')
    expect(svg.querySelectorAll(`.${PAGE_SHEET_CLASS}`)).toHaveLength(0)
  })

  it('draws nothing for PRINT — the desk is an editing affordance, and paper is already paper', () => {
    const svg = svgEl()
    drawPages(svg, A4, 3, 'print')
    expect(svg.children).toHaveLength(0)
  })

  it('never answers a hit-test — it is chrome behind the music, not ink in it', () => {
    const svg = svgEl()
    drawPages(svg, A4, 1, 'editor')
    expect(svg.firstElementChild!.getAttribute('pointer-events')).toBe('none')
  })
})
