import { describe, it, expect } from 'vitest'
import { resolveSurface, SKETCH_CANVAS, A4_NORMAL, PX_PER_MM, type Surface } from './surface'

describe('resolveSurface — the canvas is today, verbatim', () => {
  // ⭐ THE no-op pin for docs/layout-plan.md P0: these three numbers are what the editor drew
  // before a surface existed (LAYOUT_CONFIG.CONTAINER_WIDTH 1000, MARGIN 20, and the 960 the
  // casting-off has always worked in). If this test changes, the score re-flowed.
  const m = resolveSurface(SKETCH_CANVAS)

  it('is 1000 px wide with a 20 px margin', () => {
    expect(m.widthPx).toBe(1000)
    expect(m.marginLeftPx).toBe(20)
    expect(m.marginTopPx).toBe(20)
  })

  it('gives the casting-off the 960 px it has always had', () => {
    expect(m.contentWidthPx).toBe(960)
  })

  it('has NO physical size — the invariant that keeps a canvas from becoming a page', () => {
    expect(m.heightPx).toBeNull()
    expect(m.contentHeightPx).toBeNull()
    // And there is no mm anywhere to ask for: the union member holds px and nothing else.
    expect(Object.keys(SKETCH_CANVAS).some(k => /Mm$/.test(k))).toBe(false)
  })
})

describe('resolveSurface — a page is paper', () => {
  const m = resolveSurface(A4_NORMAL)

  it('is A4 at 1 staff space = 1.75 mm', () => {
    expect(m.widthPx).toBeCloseTo(210 * PX_PER_MM, 6)
    expect(m.heightPx).toBeCloseTo(297 * PX_PER_MM, 6)
    // The numbers docs/layout-plan.md §4 reasons about, to 1 px.
    expect(Math.round(m.widthPx)).toBe(1200)
    expect(Math.round(m.heightPx!)).toBe(1697)
  })

  it('lands within ~7% of the canvas it replaces — a layout does not re-engrave the score', () => {
    expect(Math.round(m.contentWidthPx)).toBe(1029)
    const canvas = resolveSurface(SKETCH_CANVAS).contentWidthPx
    expect(Math.abs(m.contentWidthPx - canvas) / canvas).toBeLessThan(0.072) // measured: 7.14%
  })

  it('answers the cast-off in the room BEFORE a break, not in page height', () => {
    // The whole reason contentHeightPx exists: page minus its own top and bottom margins.
    expect(Math.round(m.contentHeightPx!)).toBe(1526)
    expect(m.contentHeightPx).toBeLessThan(m.heightPx!)
    // ≈ 10 systems per page at the current 150 px system stride.
    expect(Math.floor(m.contentHeightPx! / 150)).toBe(10)
  })
})

describe('resolveSurface — margins are per edge', () => {
  // Not one number: A4_NORMAL is 15 mm all round, so a single margin would look right for as long
  // as nobody asked for an asymmetric page, then be silently wrong.
  const asymmetric: Surface = {
    kind: 'page',
    layout: {
      page: { widthMm: 210, heightMm: 297 },
      margins: { topMm: 10, bottomMm: 20, leftMm: 30, rightMm: 5 },
    },
  }
  const m = resolveSurface(asymmetric)

  it('resolves each edge independently', () => {
    expect(m.marginTopPx).toBeCloseTo(10 * PX_PER_MM, 6)
    expect(m.marginBottomPx).toBeCloseTo(20 * PX_PER_MM, 6)
    expect(m.marginLeftPx).toBeCloseTo(30 * PX_PER_MM, 6)
    expect(m.marginRightPx).toBeCloseTo(5 * PX_PER_MM, 6)
  })

  it('takes the width off the left and right, and the height off the top and bottom', () => {
    expect(m.contentWidthPx).toBeCloseTo((210 - 30 - 5) * PX_PER_MM, 6)
    expect(m.contentHeightPx).toBeCloseTo((297 - 10 - 20) * PX_PER_MM, 6)
  })
})

describe('PX_PER_MM', () => {
  it('is MuseScore’s 1.75 mm per staff space against VexFlow’s 10 px one', () => {
    expect(PX_PER_MM).toBeCloseTo(5.714, 3)
    expect(PX_PER_MM * 1.75).toBeCloseTo(10, 9)
  })
})
