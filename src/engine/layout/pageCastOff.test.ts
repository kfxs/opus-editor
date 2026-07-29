import { describe, it, expect } from 'vitest'
import { pageCastOff } from './pageCastOff'
import { resolveSurface, SKETCH_CANVAS, A4_NORMAL } from './surface'

const CANVAS = resolveSurface(SKETCH_CANVAS)
const A4 = resolveSurface(A4_NORMAL)

/** N systems at today's 150 px stride (STAVE_HEIGHT 120 + VERTICAL_SPACING 30). */
const systems = (n: number, height = 150) => Array.from({ length: n }, () => height)

describe('pageCastOff — a canvas never breaks', () => {
  const cast = pageCastOff(systems(40), CANVAS)

  it('puts every system on page 0, however many there are', () => {
    expect(new Set(cast.pageOfLine)).toEqual(new Set([0]))
    expect(cast.pageCount).toBe(1)
  })

  it('stacks them from the top margin, exactly as the editor always has', () => {
    expect(cast.lineTopInPagePx[0]).toBe(20)
    expect(cast.lineTopInPagePx[1]).toBe(170)
    expect(cast.lineTopInPagePx[39]).toBe(20 + 39 * 150)
  })
})

describe('pageCastOff — a page breaks when the music runs out of room', () => {
  it('fits ten 150 px systems on A4 and sends the eleventh over', () => {
    // The A4 text block is ~1526 px: 10 × 150 = 1500 fits, 11 × 150 = 1650 does not.
    const cast = pageCastOff(systems(11), A4)
    expect(cast.pageOfLine.slice(0, 10)).toEqual(Array(10).fill(0))
    expect(cast.pageOfLine[10]).toBe(1)
    expect(cast.pageCount).toBe(2)
  })

  it('starts each page again at its own top margin', () => {
    const cast = pageCastOff(systems(11), A4)
    expect(cast.lineTopInPagePx[0]).toBeCloseTo(A4.marginTopPx, 6)
    // The eleventh is the first on page 1 — same top as the first on page 0, not a running total.
    expect(cast.lineTopInPagePx[10]).toBeCloseTo(A4.marginTopPx, 6)
    expect(cast.lineTopInPagePx[1]).toBeCloseTo(A4.marginTopPx + 150, 6)
  })

  it('never overhangs the text block once more than one system is on the page', () => {
    const cast = pageCastOff(systems(30), A4)
    const bottomOf = (i: number) => cast.lineTopInPagePx[i] - A4.marginTopPx + 150
    for (let i = 0; i < 30; i++) expect(bottomOf(i)).toBeLessThanOrEqual(A4.contentHeightPx!)
  })
})

describe('pageCastOff — the degenerate cases', () => {
  it('gives a system TALLER than the page a page of its own, and moves on', () => {
    // A 20-staff system, or a big staff-spacing override: it fits nowhere, so it must not be
    // pushed to a fresh page forever. It takes one and overflows it.
    const cast = pageCastOff([150, 3000, 150], A4)
    expect(cast.pageOfLine).toEqual([0, 1, 2])
    expect(cast.pageCount).toBe(3)
    // And the one after it starts clean at the top of its own page rather than below the overflow.
    expect(cast.lineTopInPagePx[2]).toBeCloseTo(A4.marginTopPx, 6)
  })

  it('an empty score still has one sheet of paper', () => {
    expect(pageCastOff([], A4).pageCount).toBe(1)
    expect(pageCastOff([], CANVAS).pageCount).toBe(1)
  })

  it('a system that exactly fills the remaining room stays on the page', () => {
    // Float noise must not push it over: 1526.0000000001 > 1526 is not a page break.
    const cast = pageCastOff([A4.contentHeightPx! / 2, A4.contentHeightPx! / 2], A4)
    expect(cast.pageOfLine).toEqual([0, 0])
  })
})
