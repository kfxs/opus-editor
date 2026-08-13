// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { drawnTextOrigin, firstDrawnText } from './drawnText'

/**
 * ⚠️⚠️ THE RULE THIS MODULE OWNS, and the bug it was extracted for: VexFlow's SVG context OMITS an
 * `x`/`y` attribute whose value is 0, and SVG defines a missing one AS 0. Three render passes read
 * these back off drawn ink; each had written `parseFloat(attr ?? '')`, so an ordinary mark that
 * happened to land on 0 came back `NaN` and was treated as *nothing drew here* — silently, with
 * nothing logged (found 2026-08-13: a `p` above a B6 was never placed on the dynamics line).
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A `<g>` holding a `<text>` with exactly the attributes given — absent means absent. */
function group(attrs: Record<string, string>, content = 'p'): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement
  const t = document.createElementNS(SVG_NS, 'text')
  for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v)
  t.textContent = content
  g.appendChild(t)
  return g
}

describe('firstDrawnText', () => {
  it('finds the text inside a group', () => {
    expect(firstDrawnText(group({ x: '1', y: '2' }))?.textContent).toBe('p')
  })

  it('is null for a group with no text, and for nothing at all', () => {
    expect(firstDrawnText(document.createElementNS(SVG_NS, 'g'))).toBeNull()
    expect(firstDrawnText(null)).toBeNull()
    expect(firstDrawnText(undefined)).toBeNull()
  })

  it('takes the FIRST — a mark’s runs share one baseline and the leftmost owns the x', () => {
    const g = group({ x: '10', y: '70' })
    const second = document.createElementNS(SVG_NS, 'text')
    second.setAttribute('x', '30')
    second.textContent = 'dolce'
    g.appendChild(second)
    expect(drawnTextOrigin(firstDrawnText(g))).toEqual({ x: 10, y: 70 })
  })
})

describe('drawnTextOrigin', () => {
  it('reads both coordinates when both are there', () => {
    expect(drawnTextOrigin(firstDrawnText(group({ x: '117.5', y: '70' }))))
      .toEqual({ x: 117.5, y: 70 })
  })

  // ⭐⭐ THE REGRESSION. This is the exact shape VexFlow emitted for the mark that went missing:
  // an x, and no y at all.
  it('⭐⭐ treats a MISSING `y` as 0 — not as “not drawn”', () => {
    expect(drawnTextOrigin(firstDrawnText(group({ x: '117.5' }))))
      .toEqual({ x: 117.5, y: 0 })
  })

  it('⭐ …and a missing `x` the same way', () => {
    expect(drawnTextOrigin(firstDrawnText(group({ y: '70' }))))
      .toEqual({ x: 0, y: 70 })
  })

  it('…and both missing is the origin, still not null', () => {
    expect(drawnTextOrigin(firstDrawnText(group({})))).toEqual({ x: 0, y: 0 })
  })

  it('is null when there is no element — “nothing drew” stays a distinct answer', () => {
    expect(drawnTextOrigin(null)).toBeNull()
    expect(drawnTextOrigin(undefined)).toBeNull()
  })

  it('is null for an unparseable coordinate — an anomaly, not a zero', () => {
    expect(drawnTextOrigin(firstDrawnText(group({ x: 'auto', y: '70' })))).toBeNull()
    expect(drawnTextOrigin(firstDrawnText(group({ x: '10', y: 'auto' })))).toBeNull()
  })
})
