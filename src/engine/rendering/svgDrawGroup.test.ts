// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { compose, scaling, translation } from '@/engine/paint/Affine'
import { drawGroupOf, svgNode } from './svgDrawGroup'

/**
 * ⭐⭐ **THE SHORTHAND IS THE CONTRACT HERE**, not a formatting preference.
 *
 * Two things in this repo read a group's `transform` as TEXT — `VexFlowRenderer.moveMeasureGroup`,
 * which re-composes it by string when a bar moves without being re-engraved, and four specs that
 * assert it exactly. So `setPlacement(scaling(k))` must come out as `scale(k)` and nothing else, or
 * one bar's transform ends up in a different dialect from its neighbour's.
 *
 * ⚠️ These assertions are the reason `transformAttr` may not be "simplified" to always-matrix. The
 * P1c commit that introduced this file learned it the hard way: three brace specs parse the
 * attribute, and they failed the moment a composite placement started emitting a matrix.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A real `<g>` — `svgDrawGroup` is handed exactly what VexFlow's `openGroup` returns. */
function group() {
  const g = document.createElementNS(SVG_NS, 'g') as SVGGElement
  const handle = drawGroupOf(g)!
  return { g, handle }
}

describe('setPlacement', () => {
  it('⭐ writes the SHORTHAND for a pure uniform scale — `scale(0.7)`, exactly', () => {
    const { g, handle } = group()
    handle.setPlacement(scaling(0.7))
    expect(g.getAttribute('transform')).toBe('scale(0.7)')
  })

  it('⭐ a NON-uniform scale keeps both terms', () => {
    const { g, handle } = group()
    handle.setPlacement(scaling(2, 3))
    expect(g.getAttribute('transform')).toBe('scale(2, 3)')
  })

  it('⭐ a pure translation is `translate(dx, dy)` — what every cursor ghost writes', () => {
    const { g, handle } = group()
    handle.setPlacement(translation(12, -4))
    expect(g.getAttribute('transform')).toBe('translate(12, -4)')
  })

  it('🚨 a COMPOSITE falls through to a matrix — the brace, and it must not lose its translation', () => {
    const { g, handle } = group()
    handle.setPlacement(compose(scaling(3, 5), translation(100, 200)))
    expect(g.getAttribute('transform')).toBe('matrix(3, 0, 0, 5, 100, 200)')
  })

  // ⭐ `moveMeasureGroup`'s own rule: "drop any stale transform rather than leaving an identity one
  // behind" — a bar back at its drawn position carries no attribute at all.
  it('⭐⭐ an IDENTITY placement REMOVES the attribute, it does not write one', () => {
    const { g, handle } = group()
    handle.setPlacement(scaling(0.7))
    handle.setPlacement(scaling(1))
    expect(g.getAttribute('transform')).toBeNull()
  })
})

describe('inkBox', () => {
  // ⚠️ jsdom has no layout, so `getBBox` is absent: null is the ordinary answer, and the cursor
  // ghosts are written for it (`reference: jsdom cannot measure glyphs`).
  it('is null when nothing measurable was drawn — ⛔ not an error', () => {
    expect(group().handle.inkBox()).toBeNull()
  })

  it('⭐ reports the box a real getBBox gives, as plain numbers and ⛔ not a DOMRect', () => {
    const { g, handle } = group()
    ;(g as unknown as { getBBox: () => DOMRect }).getBBox =
      () => ({ x: 1, y: 2, width: 30, height: 40 }) as DOMRect
    expect(handle.inkBox()).toEqual({ x: 1, y: 2, width: 30, height: 40 })
  })

  it('…and a zero-width box is “nothing drew”, which is what the ghosts test for', () => {
    const { g, handle } = group()
    ;(g as unknown as { getBBox: () => DOMRect }).getBBox =
      () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
    expect(handle.inkBox()).toBeNull()
  })

  it('⛔ swallows a getBBox that THROWS — an un-laid-out SVG is not an error either', () => {
    const { g, handle } = group()
    ;(g as unknown as { getBBox: () => DOMRect }).getBBox = () => { throw new Error('not rendered') }
    expect(handle.inkBox()).toBeNull()
  })
})

describe('tag and tagLast', () => {
  it('⭐ `tag` marks the GROUP — the composite barline opting out of hinting', () => {
    const { g, handle } = group()
    handle.tag('data-no-hint', '1')
    expect(g.getAttribute('data-no-hint')).toBe('1')
    // 🚨 The readers use `dataset.noHint`, so the attribute NAME is the contract.
    expect((g as unknown as HTMLElement).dataset.noHint).toBe('1')
  })

  it('⭐⭐ `tagLast` marks the primitive that landed last, ⛔ not the group', () => {
    const { g, handle } = group()
    g.appendChild(document.createElementNS(SVG_NS, 'rect'))
    g.appendChild(document.createElementNS(SVG_NS, 'rect'))
    handle.tagLast('data-half', 'end')
    expect(g.children[0].getAttribute('data-half')).toBeNull()
    expect(g.children[1].getAttribute('data-half')).toBe('end')
    expect(g.getAttribute('data-half')).toBeNull()
  })

  it('⛔ tagging an EMPTY group is a no-op, not a throw — a stroke list can be empty', () => {
    const { handle } = group()
    expect(() => handle.tagLast('data-half', 'end')).not.toThrow()
  })
})

describe('discard and node', () => {
  it('discard takes the group off the page', () => {
    const parent = document.createElementNS(SVG_NS, 'svg')
    const { g, handle } = group()
    parent.appendChild(g)
    handle.discard()
    expect(parent.children.length).toBe(0)
  })

  it('⛔ node is the escape — the same element, for the maps the EDITOR reads back', () => {
    const { g, handle } = group()
    expect(handle.node()).toBe(g)
    expect(svgNode(handle)).toBe(g)
  })
})

describe('svgDrawGroup', () => {
  // ⚠️ Several passes call `openGroup?.()`, and `inStaffSpace` has always accepted an absent group:
  // a staff at full scale needs none.
  it('answers null for a group that was never opened', () => {
    expect(drawGroupOf(undefined)).toBeNull()
    expect(drawGroupOf(null)).toBeNull()
    expect(svgNode(null)).toBeUndefined()
  })
})
