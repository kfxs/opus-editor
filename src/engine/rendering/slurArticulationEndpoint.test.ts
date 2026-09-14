/**
 * ⭐⭐ **THE ENDPOINT CLEARS ITS OWN MARK** — his rule, 2026-09-14: *"they should not change the slur
 * angle but move it up a little"* (`docs/slur-tie-research.md` §8).
 *
 * ⭐ The module is pure, so all of it is jsdom — which matters more than usual here: VexFlow's own
 * articulation box is **NaN** without a page (`Articulation.draw`'s `setOrigin` divides by a glyph
 * width a page-less test measures as 0), and the refusal to let that reach the arithmetic is one of
 * the things asserted below.
 */
import { describe, it, expect } from 'vitest'
import { articulationEdge, endpointLiftOverMark, markEdgeOf } from './slurArticulationEndpoint'

const mark = (y: number, h = 4, category = 'Articulation') => ({
  getCategory: () => category,
  getBoundingBox: () => ({ x: 0, y, w: 4, h }),
})
const note = (...mods: ReturnType<typeof mark>[]) => ({ getModifiers: () => mods })

describe('the lift over a mark', () => {
  it('⭐⭐ ABOVE: the endpoint stands `gap` beyond the highest mark', () => {
    // anchor at y=70, a mark whose top is at 51, 5 px of air ⇒ the endpoint belongs at 46,
    // which is 24 above the anchor.
    expect(endpointLiftOverMark(70, 10, 51, -1, 5)).toBe(24)
  })

  it('⭐⭐ BELOW: the mirror, and it is the SAME expression', () => {
    expect(endpointLiftOverMark(70, 10, 89, +1, 5)).toBe(24)
  })

  it('⛔ never pulls the slur IN — a mark inside the ordinary lift changes nothing', () => {
    // The mark's top is only 3 px above the anchor; the ordinary lift already clears it.
    expect(endpointLiftOverMark(70, 10, 67, -1, 5)).toBe(10)
  })

  it('⛔ a mark on the OTHER side is not this end’s business', () => {
    expect(endpointLiftOverMark(70, 10, 95, -1, 5)).toBe(10)
  })

  it('⭐ no mark ⇒ the ordinary lift, unchanged', () => {
    expect(endpointLiftOverMark(70, 10, null, -1, 5)).toBe(10)
  })

  it('🚨 a NaN edge is REFUSED — VexFlow answers one in jsdom, and it must not spread', () => {
    expect(endpointLiftOverMark(70, 10, NaN, -1, 5)).toBe(10)
    expect(endpointLiftOverMark(NaN, 10, 51, -1, 5)).toBe(10)
    expect(endpointLiftOverMark(70, 10, Infinity, -1, 5)).toBe(10)
  })
})

describe('which edge a note offers', () => {
  it('⭐ ABOVE takes the HIGHEST mark, BELOW the lowest', () => {
    const n = note(mark(51), mark(60))
    expect(articulationEdge(n, -1)).toBe(51)
    expect(articulationEdge(n, +1)).toBe(64) // the lower mark's bottom
  })

  it('⛔ only ARTICULATIONS count — an accidental or a dot is not this rule’s business', () => {
    expect(articulationEdge(note(mark(51, 4, 'Accidental')), -1)).toBeNull()
    expect(articulationEdge(note(mark(51, 4, 'Dot')), -1)).toBeNull()
  })

  it('⭐ a note with no modifiers at all answers null, ⛔ not 0', () => {
    expect(articulationEdge({}, -1)).toBeNull()
    expect(articulationEdge(note(), -1)).toBeNull()
  })

  it('🚨 a NaN box is dropped rather than returned', () => {
    expect(articulationEdge(note(mark(NaN)), -1)).toBeNull()
    // …and one good mark beside a NaN one still answers.
    expect(articulationEdge(note(mark(NaN), mark(51)), -1)).toBe(51)
  })

  it('⭐ `markEdgeOf` is the same rule for boxes already measured (the ink ruler’s)', () => {
    const boxes = [{ x: 0, y: 51, width: 4, height: 4 }, { x: 0, y: 60, width: 4, height: 4 }]
    expect(markEdgeOf(boxes, -1)).toBe(51)
    expect(markEdgeOf(boxes, +1)).toBe(64)
    expect(markEdgeOf([], -1)).toBeNull()
  })
})

describe('🚨 the property that makes it HIS rule — the shape cannot change', () => {
  it('⭐⭐ both ends take a lift, so the curve TRANSLATES: the two lifts are independent numbers', () => {
    // The rule is per-end and knows nothing about the other end — that is what lets an arch built
    // on the two results be the ordinary arch, ⛔ never a re-solved one.
    const from = endpointLiftOverMark(70, 10, 51, -1, 5)
    const to = endpointLiftOverMark(60, 10, 41, -1, 5)
    expect([from, to]).toEqual([24, 24])
  })
})
