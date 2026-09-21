// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { thinBarlinePx, hintBarlines } from './barlineInk'

/**
 * Attributes, not geometry: jsdom has no layout and no fonts, so nothing here asks where the ink
 * LANDED (that is `e2e/barlineInk.e2e.ts`). What it can answer is what this pass writes on the
 * rects it finds, which is the whole of the module.
 *
 * ⭐ **`inkBarlines`' own tests left with it on 2026-09-13** (P5b). Every barline is now DRAWN at
 * this width, so the three statements worth keeping — the ink grows rightward from the boundary, it
 * is measured in staff spaces, and it lands in a `stavebarline` group — moved to
 * `engine/engrave/staff/openingBarline.test.ts`, beside the code that now makes them true.
 */
const NS = 'http://www.w3.org/2000/svg'

/** A measure group as VexFlow leaves it: barline rects inside a `stavebarline` group. */
function measureGroup(rects: { x: number; width: number }[]): SVGGElement {
  const group = document.createElementNS(NS, 'g')
  const barline = document.createElementNS(NS, 'g')
  barline.setAttribute('class', 'stavebarline')
  for (const r of rects) {
    const rect = document.createElementNS(NS, 'rect')
    rect.setAttribute('x', String(r.x))
    rect.setAttribute('y', '0')
    rect.setAttribute('width', String(r.width))
    rect.setAttribute('height', '40')
    barline.appendChild(rect)
  }
  group.appendChild(barline)
  return group
}

describe('barlineInk', () => {
  it('is 0.16 staff spaces — heavier than a stem (1.5) and a staff line (1)', () => {
    expect(thinBarlinePx()).toBeCloseTo(1.6)
  })
})

/**
 * Hinting — the arithmetic only. jsdom implements no layout and no `getScreenCTM`, so the matrix is
 * stubbed: what is under test is what the pass DOES with a scale, not what the scale really is.
 * That it reads the true scale from a real drawing is `e2e/barlineInk.e2e.ts`'s job.
 */
describe('hintBarlines', () => {
  /** An `<svg>` holding one barline group, with every CTM stubbed to `scale`. */
  function scoreAt(scale: number, xs: number[]): SVGSVGElement {
    const svg = document.createElementNS(NS, 'svg')
    // ⭐ At the width they are DRAWN at since P5b — this used to build 1 px rects and call
    // `inkBarlines` on them, which is the pass that no longer exists.
    const group = measureGroup(xs.map(x => ({ x, width: thinBarlinePx() })))
    svg.appendChild(group)
    const ctm = { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 } as DOMMatrix
    for (const el of [svg, ...svg.querySelectorAll('rect')]) {
      (el as unknown as { getScreenCTM: () => DOMMatrix }).getScreenCTM = () => ctm
    }
    return svg
  }

  const ink = (svg: Element, scale: number, dpr = 1) =>
    [...svg.querySelectorAll('rect')].map(r => ({
      left: +((parseFloat(r.getAttribute('x')!) * scale * dpr).toFixed(6)),
      width: +((parseFloat(r.getAttribute('width')!) * scale * dpr).toFixed(6)),
    }))

  it('puts every barline on a whole device pixel, at a whole number of pixels wide', () => {
    // Positions chosen to land at every awkward phase of a 0.7 grid.
    const svg = scoreAt(0.7, [20, 167.1, 268.71, 370.32, 573.55])
    hintBarlines(svg, { dpr: 1 })
    for (const bar of ink(svg, 0.7)) {
      expect(bar.left, 'left edge on a whole pixel').toBe(Math.round(bar.left))
      expect(bar.width, 'a whole number of pixels wide').toBe(Math.round(bar.width))
    }
  })

  it('gives them all the SAME width — the unevenness was never about the amount of ink', () => {
    const svg = scoreAt(0.7, [20, 167.1, 268.71, 370.32, 573.55])
    hintBarlines(svg, { dpr: 1 })
    expect(new Set(ink(svg, 0.7).map(b => b.width)).size).toBe(1)
  })

  it('never rounds a barline away: one device pixel is the floor', () => {
    // 0.16 spaces at 25% is 0.4 device px. Rounding it honestly gives nothing — which is exactly
    // how `shape-rendering: crispEdges` erased 9 of 12 barlines when it was tried.
    const svg = scoreAt(0.25, [20, 167.1, 268.71])
    hintBarlines(svg, { dpr: 1 })
    for (const bar of ink(svg, 0.25)) expect(bar.width).toBe(1)
  })

  it('moves the INK by less than half a pixel, and never the barline', () => {
    const svg = scoreAt(0.7, [167.1, 268.71, 370.32])
    hintBarlines(svg, { dpr: 1 })
    for (const rect of svg.querySelectorAll('rect')) {
      const asked = parseFloat(rect.dataset.baselineX!)
      const drawn = parseFloat(rect.getAttribute('x')!)
      expect(Math.abs(drawn - asked) * 0.7, 'within half a device pixel').toBeLessThanOrEqual(0.5)
      expect(asked, 'and the asked-for boundary is remembered, not overwritten').toBe(
        [167.1, 268.71, 370.32].find(x => Math.abs(x - asked) < 1e-9),
      )
    }
  })

  it('re-hinting at a new scale computes from the ASKED position, never from the last hint', () => {
    const svg = scoreAt(0.7, [167.1, 268.71, 370.32])
    hintBarlines(svg, { dpr: 1 })
    const once = [...svg.querySelectorAll('rect')].map(r => r.getAttribute('x'))
    // Zoom out and back: the same scale must reproduce the same answer, with no accumulated drift.
    hintBarlines(svg, { dpr: 2 })
    hintBarlines(svg, { dpr: 1 })
    expect([...svg.querySelectorAll('rect')].map(r => r.getAttribute('x'))).toEqual(once)
  })

  it('does nothing at an unchanged scale, and everything when forced', () => {
    const svg = scoreAt(0.7, [167.1])
    hintBarlines(svg, { dpr: 1 })
    const rect = svg.querySelector('rect')!
    // A hand-edit standing in for "a re-render replaced this rect with an unhinted one".
    rect.setAttribute('x', '999')
    hintBarlines(svg, { dpr: 1 })
    expect(rect.getAttribute('x'), 'the gate held: same scale, no work').toBe('999')
    hintBarlines(svg, { dpr: 1, force: true })
    expect(rect.getAttribute('x'), 'forced, it re-hints from the asked position').not.toBe('999')
  })
})
