// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { RenderPass } from '../../RenderPass'
import { placeTempoMark, setTempoMarkBase, setTempoMarkOffset } from './tempoMarkTransform'

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
  const repointGuidesById = vi.fn()
  const pass = { elementRegistry: { shiftById, repointGuidesById } } as unknown as RenderPass
  const el = document.createElementNS(SVG_NS, 'g') as SVGGraphicsElement
  return { pass, el, shiftById, repointGuidesById, transform: () => el.getAttribute('transform') }
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

  it('⛔ …and it does NOT move the guide’s far end — a nudge slides the ink AWAY from the anchor', () => {
    const { pass, el, repointGuidesById } = fixture()
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    expect(repointGuidesById).not.toHaveBeenCalled()
  })
})

/**
 * ⭐⭐ **THE THIRD COMPONENT — how far the mark's ANCHOR has moved since the glyph was drawn**, which
 * only a preview writes (`./tempoNudgePass` ← `./tempoAnchorInk`).
 *
 * 🚨 His report, 2026-08-31, on the snap drag: *"the anchor line is not updating during the drag"*.
 * The travel used to be folded into the nudge's `x`, so the two were one number and the attachment
 * guide could not tell them apart — it stayed pinned to the onset the mark had been drawn at while
 * the mark itself walked to the next one.
 */
describe('setTempoMarkBase — the anchor’s own travel', () => {
  it('lands in the same translate as the nudge', () => {
    const { pass, el, transform } = fixture()
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    setTempoMarkBase(pass, 't1', el, 100)
    expect(transform()).toBe('translate(104, -3)')
  })

  it('⭐⭐ …but it CARRIES THE GUIDE’S FAR END, by the travel alone', () => {
    const { pass, el, repointGuidesById } = fixture()
    setTempoMarkOffset(pass, 't1', el, 4, -3)
    setTempoMarkBase(pass, 't1', el, 100)
    // ⛔ 104 would drag the anchor along with the ink and make the guide a stick of fixed length.
    expect(repointGuidesById).toHaveBeenCalledWith('t1', 100)
  })

  it('⭐ SETS rather than adds — a drag frame runs over the last frame’s answer', () => {
    const { pass, el, shiftById, repointGuidesById, transform } = fixture()
    setTempoMarkBase(pass, 't1', el, 100)
    shiftById.mockClear()
    repointGuidesById.mockClear()
    setTempoMarkBase(pass, 't1', el, 100)
    expect(transform()).toBe('translate(100, 0)')
    expect(shiftById).toHaveBeenCalledWith('t1', 0, 0)
    expect(repointGuidesById, 'nothing moved, so nothing is repointed').not.toHaveBeenCalled()
  })

  it('⭐ a frame that snaps ON corrects both by exactly the change', () => {
    const { pass, el, shiftById, repointGuidesById } = fixture()
    setTempoMarkBase(pass, 't1', el, 100)
    shiftById.mockClear()
    repointGuidesById.mockClear()
    setTempoMarkBase(pass, 't1', el, 200)
    expect(shiftById).toHaveBeenCalledWith('t1', 100, 0)
    expect(repointGuidesById).toHaveBeenCalledWith('t1', 100)
  })

  it('⭐ and the drop takes it back to zero, guide and all', () => {
    // A full render draws the mark at its own anchor, so the travel is 0 and the guide is a stub.
    const { pass, el, repointGuidesById } = fixture()
    setTempoMarkBase(pass, 't1', el, 100)
    repointGuidesById.mockClear()
    setTempoMarkBase(pass, 't1', el, 0)
    expect(repointGuidesById).toHaveBeenCalledWith('t1', -100)
  })
})
