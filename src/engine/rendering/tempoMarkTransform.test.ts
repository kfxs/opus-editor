// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { RenderPass } from './RenderPass'
import { placeTempoMark, setTempoMarkOffset } from './tempoMarkTransform'

/**
 * WHO OWNS A TEMPO MARK'S TRANSFORM — the composition the ladder and the hand nudge share
 * (his ask, 2026-08-19; `./dynamicMarkTransform`'s twin).
 *
 * ⭐ Attribute arithmetic, so jsdom is the right place for all of it: nothing here measures ink, it
 * only checks that the number written is the sum of the components and that the registry is told the
 * CHANGE. Where the line comes from is `tempoLinePass`'s; where the offset comes from is
 * `TempoLayout`'s; whether the mark lands on the drawn row is `e2e/ladder.e2e.ts`'s.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

function fixture() {
  const shiftById = vi.fn()
  const pass = { elementRegistry: { shiftById } } as unknown as RenderPass
  const el = document.createElementNS(SVG_NS, 'g') as SVGGraphicsElement
  return { pass, el, shiftById, transform: () => el.getAttribute('transform') }
}

describe('placeTempoMark — the ladder SETS the row', () => {
  it('writes the translate and moves the registry box with it', () => {
    const { pass, el, shiftById, transform } = fixture()
    placeTempoMark(pass, 't1', el, -12)
    expect(transform()).toBe('translate(0, -12)')
    expect(shiftById).toHaveBeenCalledWith('t1', 0, -12)
  })

  it('⭐⭐ is IDEMPOTENT — the trap a reused measure would otherwise walk into', () => {
    // The mark of a bar nobody re-engraved still carries last render's transform, and this pass runs
    // over every measure of a system. Adding there walks the mark up the page one row per render.
    const { pass, el, shiftById, transform } = fixture()
    placeTempoMark(pass, 't1', el, -12)
    shiftById.mockClear()
    placeTempoMark(pass, 't1', el, -12)
    expect(transform()).toBe('translate(0, -12)')
    expect(shiftById).toHaveBeenCalledWith('t1', 0, 0)
  })

  it('a row that MOVED corrects the mark by exactly the change', () => {
    const { pass, el, shiftById, transform } = fixture()
    placeTempoMark(pass, 't1', el, -12)
    shiftById.mockClear()
    placeTempoMark(pass, 't1', el, -30)
    expect(transform()).toBe('translate(0, -30)')
    expect(shiftById).toHaveBeenCalledWith('t1', 0, -18)
  })
})

describe('setTempoMarkOffset — the hand nudge', () => {
  it('composes with the row instead of replacing it', () => {
    const { pass, el, transform } = fixture()
    placeTempoMark(pass, 't1', el, -12)
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    expect(transform()).toBe('translate(4, -15)')
  })

  it('⭐ SETS rather than adds — the override is read whole out of the model every draw', () => {
    // ⛔ The dynamic's `shiftDynamicMark` ADDS because two draw-time contributions compose there.
    // A tempo mark has one, so adding would double the offset every time its bar re-engraves.
    const { pass, el, transform } = fixture()
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    expect(transform()).toBe('translate(4, -3)')
  })

  it('⭐ and the nudge SURVIVES a row change — the components are kept, not the sum', () => {
    // The ladder runs after every render, including ones this mark's bar took no part in.
    const { pass, el, shiftById, transform } = fixture()
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    placeTempoMark(pass, 't1', el, -12)
    shiftById.mockClear()
    placeTempoMark(pass, 't1', el, -20)
    expect(transform()).toBe('translate(4, -23)')
    expect(shiftById).toHaveBeenCalledWith('t1', 0, -8)
  })
})
