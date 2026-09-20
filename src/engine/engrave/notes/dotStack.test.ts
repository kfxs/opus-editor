/**
 * Where each augmentation dot of a column stands. ⚠️ Exactness against `Dot.format` was proved once,
 * on 655 dots of random scores (S9c, `docs/history/vexflow-removal-map.md` §5.2); pinned here is the rule.
 */
import { describe, it, expect } from 'vitest'
import { type ColumnDot, UNISON_DOT_SPACING_PX, stackDots } from './dotStack'

const dot = (line: number, over: Partial<ColumnDot> = {}): ColumnDot => ({
  line, noteKey: 'n', isRest: false, firstDotPx: 0, width: 4, shiftY: 0, ...over,
})

describe('stackDots', () => {
  it('a note in a SPACE keeps its dot there', () => {
    expect(stackDots([dot(3.5)]).placed[0].shiftY).toBeCloseTo(0)
  })

  it('a note on a LINE lifts its dot half a space', () => {
    expect(stackDots([dot(3)]).placed[0].shiftY).toBe(-0.5)
  })

  it('⭐ a second: the lower note drops its dot, because the upper one took the space between', () => {
    const { placed } = stackDots([dot(3), dot(3.5)])
    expect(placed[1].shiftY, 'the upper, in a space').toBeCloseTo(0)
    expect(placed[0].shiftY, 'the lower, on a line — down').toBe(0.5)
  })

  it('a line note whose space above was just taken drops too', () => {
    // 4 lifts into 4.5; 3.5 sits in its space; 3 would lift into 3.5 — taken — so it drops.
    const { placed } = stackDots([dot(4), dot(3.5), dot(3)])
    expect(placed.map(p => p.shiftY)).toEqual([-0.5, -0, 0.5])
  })

  it('⚠️ a rest ADDS the lift the note walked before it took', () => {
    // The line-3 note lifts (−0.5), so the rest below it moves by −0.5 on top of the 1 it had.
    expect(stackDots([dot(3, { noteKey: 'a' }), dot(2.5, { noteKey: 'r', isRest: true, shiftY: 1 })]).placed[1].shiftY)
      .toBe(0.5)
  })

  it('dots start past a right-displaced head, and a unison dot stands to the right of the first', () => {
    const { placed, width } = stackDots([dot(3, { firstDotPx: 6 }), dot(3, { firstDotPx: 6 })])
    expect(placed.map(p => p.xShift)).toEqual([6, 6 + 4 + UNISON_DOT_SPACING_PX])
    expect(width).toBe(6 + 2 * (4 + UNISON_DOT_SPACING_PX))
  })

  it('no dots, no room', () => {
    expect(stackDots([])).toEqual({ placed: [], width: 0 })
  })
})
