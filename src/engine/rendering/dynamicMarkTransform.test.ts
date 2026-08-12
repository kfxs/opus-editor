// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { RenderPass } from './RenderPass'
import { placeDynamicMark, shiftDynamicMark } from './dynamicMarkTransform'

/**
 * WHO OWNS A DYNAMIC'S TRANSFORM — the composition three passes share
 * (docs/dynamics-line-and-hairpins-plan.md P1).
 *
 * ⭐ Attribute arithmetic, so jsdom is the right place for all of it: nothing here measures ink, it
 * only checks that the number written is the sum of the components and that the registry is told the
 * CHANGE. Where the numbers come from is `dynamicsLinePass`'s and `DynamicsLayout`'s; whether the
 * mark lands on the drawn line is `e2e/dynamicsLine.e2e.ts`'s.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

function fixture() {
  const shiftById = vi.fn()
  const pass = { elementRegistry: { shiftById } } as unknown as RenderPass
  const el = document.createElementNS(SVG_NS, 'g') as SVGGraphicsElement
  return { pass, el, shiftById, transform: () => el.getAttribute('transform') }
}

describe('shiftDynamicMark — the draw-time deltas ADD', () => {
  it('writes the translate and moves the registry box with it', () => {
    const { pass, el, shiftById, transform } = fixture()
    shiftDynamicMark(pass, 'd1', el, 3, 0)
    expect(transform()).toBe('translate(3, 0)')
    expect(shiftById).toHaveBeenCalledWith('d1', 3, 0)
  })

  it('a co-located mark that is ALSO hand-nudged keeps both — they compose', () => {
    const { pass, el, shiftById, transform } = fixture()
    shiftDynamicMark(pass, 'd1', el, 3, 0)   // the row
    shiftDynamicMark(pass, 'd1', el, 1, -2)  // the nudge
    expect(transform()).toBe('translate(4, -2)')
    // …and the registry is told only what the second call changed.
    expect(shiftById).toHaveBeenLastCalledWith('d1', 1, -2)
  })
})

describe('placeDynamicMark — the line and the anchor SET', () => {
  it('composes with the draw-time shift instead of replacing it', () => {
    const { pass, el, transform } = fixture()
    shiftDynamicMark(pass, 'd1', el, 3, -2)
    placeDynamicMark(pass, 'd1', el, { line: 40, anchor: 0 })
    expect(transform()).toBe('translate(3, 38)')
  })

  it('⭐⭐ is IDEMPOTENT — the trap a reused measure would otherwise walk into', () => {
    // The mark of a bar nobody re-engraved still carries last render's transform. Prepending a
    // translate there (what `applyDynamicOffsets` used to do) adds a line's worth of drop per
    // render, and drags the registry box down with it.
    const { pass, el, shiftById, transform } = fixture()
    placeDynamicMark(pass, 'd1', el, { line: 40, anchor: 0 })
    shiftById.mockClear()
    placeDynamicMark(pass, 'd1', el, { line: 40, anchor: 0 })
    expect(transform()).toBe('translate(0, 40)')
    expect(shiftById).toHaveBeenCalledWith('d1', 0, 0)
  })

  it('a line that MOVED corrects the mark by exactly the change', () => {
    const { pass, el, shiftById, transform } = fixture()
    placeDynamicMark(pass, 'd1', el, { line: 40, anchor: 0 })
    shiftById.mockClear()
    placeDynamicMark(pass, 'd1', el, { line: 52, anchor: 0 })
    expect(transform()).toBe('translate(0, 52)')
    expect(shiftById).toHaveBeenCalledWith('d1', 0, 12)
  })

  it('and the draw-time shift survives a line change — the components are kept, not the sum', () => {
    const { pass, el, transform } = fixture()
    shiftDynamicMark(pass, 'd1', el, 5, 1)
    placeDynamicMark(pass, 'd1', el, { line: 40, anchor: 0 })
    placeDynamicMark(pass, 'd1', el, { line: 30, anchor: 0 })
    expect(transform()).toBe('translate(5, 31)')
  })
})
