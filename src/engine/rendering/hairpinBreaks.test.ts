/**
 * {@link hairpinBreaks} — a wedge broken for an interim dynamic (Gould printed p. 107).
 *
 * ⭐⭐ **The claim under test is COLLINEARITY**, which is the thing a picture hides: her drawing was
 * measured, and extrapolating the first half's two edges straight across the letter lands within
 * 0.14 sp of where the second half's edges begin. So the two halves must lie on ONE pair of straight
 * lines — the same wedge with a slice cut out — and the `t0`/`t1` fractions are how the renderer
 * gets that. A test that only checked the x's would pass for two independent wedges, which is
 * precisely her `incorrect` drawing.
 *
 * ⚠️ Pure arithmetic on purpose: the real thing needs a browser (a dynamic's ink exists only in the
 * SVG — jsdom measures every glyph 0×0), so what can be checked here is the geometry, and the
 * drawn result is checked in the browser suite.
 */
import { describe, it, expect } from 'vitest'
import { breakWedgeAtGaps, rampAt, type WedgePiece, type WedgeGap } from './hairpinBreaks'

/** One system, one uncut wedge from x = 0 to x = 100. */
const WHOLE: WedgePiece[] = [{ x0: 0, x1: 100, line: 0, role: 'single' }]

/** A mark's padded ink, on the first system. */
const gap = (left: number, right: number, line = 0): WedgeGap => ({ line, left, right })

describe('breakWedgeAtGaps', () => {
  it('⭐ leaves an untouched piece alone, spanning its whole ramp', () => {
    // The backwards-compatibility claim: t0/t1 of 0→1 interpolate to exactly the numbers the
    // renderer used before this module existed, so a wedge with nothing in its way is unchanged.
    expect(breakWedgeAtGaps(WHOLE, [], 1)).toEqual([
      { x0: 0, x1: 100, line: 0, role: 'single', t0: 0, t1: 1 },
    ])
  })

  it('⭐ cuts a slice out for a mark in the middle', () => {
    expect(breakWedgeAtGaps(WHOLE, [gap(40, 60)], 1)).toEqual([
      { x0: 0, x1: 40, line: 0, role: 'single', t0: 0, t1: 0.4 },
      { x0: 60, x1: 100, line: 0, role: 'single', t0: 0.6, t1: 1 },
    ])
  })

  it('⭐⭐ …and the two halves stay COLLINEAR — the fractions are measured against the FULL piece', () => {
    // Gould p. 107: "Maintain the same angle for the hairpin either side of the interim dynamic."
    const [a, b] = breakWedgeAtGaps(WHOLE, [gap(40, 60)], 1)
    // One straight wedge over the same span, sampled at the four drawn x's…
    const straight = (x: number) => rampAt(0, 3, x / 100)
    expect(rampAt(0, 3, a.t0)).toBeCloseTo(straight(0))
    expect(rampAt(0, 3, a.t1)).toBeCloseTo(straight(40))
    expect(rampAt(0, 3, b.t0)).toBeCloseTo(straight(60))
    expect(rampAt(0, 3, b.t1)).toBeCloseTo(straight(100))
    // ⛔ …and the second half does NOT restart: closing the ramp over the remaining ink instead
    // would make it begin at 0 again, which is her `incorrect` drawing.
    expect(rampAt(0, 3, b.t0)).not.toBeCloseTo(0)
  })

  it('⭐ the gap is NOT taken out of the ramp — the slice is still part of the span', () => {
    // Two marks: the ink either side of each keeps its own place on one continuous ramp.
    const segs = breakWedgeAtGaps(WHOLE, [gap(20, 30), gap(70, 80)], 1)
    expect(segs.map(s => [s.t0, s.t1])).toEqual([[0, 0.2], [0.3, 0.7], [0.8, 1]])
  })

  it('merges co-located marks into ONE slice — `p dolce` is one obstacle, not two', () => {
    const segs = breakWedgeAtGaps(WHOLE, [gap(40, 55), gap(50, 62)], 1)
    expect(segs.map(s => [s.x0, s.x1])).toEqual([[0, 40], [62, 100]])
  })

  it('⚠️ a mark overlapping an END trims rather than splitting', () => {
    expect(breakWedgeAtGaps(WHOLE, [gap(-10, 25)], 1).map(s => [s.x0, s.x1])).toEqual([[25, 100]])
    expect(breakWedgeAtGaps(WHOLE, [gap(75, 130)], 1).map(s => [s.x0, s.x1])).toEqual([[0, 75]])
  })

  it('⛔ DROPS a remnant under the floor — a sliver of wedge says nothing', () => {
    // ⚠️ ⛔ And it is the remnant that goes, NEVER the shortening: Verovio abandons the whole
    // adjustment at this threshold and draws the wedge through the letter's ink instead
    // (`view_control.cpp:688`), which says something false.
    const segs = breakWedgeAtGaps(WHOLE, [gap(3, 60)], 5)
    expect(segs.map(s => [s.x0, s.x1])).toEqual([[60, 100]])
  })

  it('⛔ …and drops the piece entirely when a mark covers all of it', () => {
    expect(breakWedgeAtGaps(WHOLE, [gap(-5, 105)], 1)).toEqual([])
  })

  it('🚨 a gap on ANOTHER SYSTEM cuts nothing — two systems\' x\'s are not one ruler', () => {
    expect(breakWedgeAtGaps(WHOLE, [gap(40, 60, 1)], 1)).toEqual([
      { x0: 0, x1: 100, line: 0, role: 'single', t0: 0, t1: 1 },
    ])
  })

  it('⭐ cuts each SYSTEM FRAGMENT inside its own role range, so the thirds survive', () => {
    // A wedge broken across a system break AND interrupted by a mark on the second system: the
    // fractions are per fragment, so `fragmentOpening`'s begin/end thirds still bound each piece.
    const split: WedgePiece[] = [
      { x0: 0, x1: 100, line: 0, role: 'begin' },
      { x0: 0, x1: 100, line: 1, role: 'end' },
    ]
    expect(breakWedgeAtGaps(split, [gap(40, 60, 1)], 1)).toEqual([
      { x0: 0, x1: 100, line: 0, role: 'begin', t0: 0, t1: 1 },
      { x0: 0, x1: 40, line: 1, role: 'end', t0: 0, t1: 0.4 },
      { x0: 60, x1: 100, line: 1, role: 'end', t0: 0.6, t1: 1 },
    ])
  })

  it('ignores a piece of no width rather than dividing by zero', () => {
    expect(breakWedgeAtGaps([{ x0: 50, x1: 50, line: 0, role: 'single' }], [], 0)).toEqual([])
  })
})

describe('rampAt', () => {
  it('is linear, and returns the ends exactly', () => {
    expect(rampAt(0, 3, 0)).toBe(0)
    expect(rampAt(0, 3, 1)).toBe(3)
    expect(rampAt(0, 3, 0.5)).toBeCloseTo(1.5)
  })

  it('runs backwards for a diminuendo without a special case', () => {
    expect(rampAt(1, 0, 0.25)).toBeCloseTo(0.75)
  })
})
