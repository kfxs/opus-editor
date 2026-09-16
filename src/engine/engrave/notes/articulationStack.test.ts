/**
 * How a column's articulations stack. ⚠️ Exactness against `Articulation.format` was proved once, on
 * ~2,000 marks of random scores (S9e, `docs/vexflow-removal-map.md` §5.2); pinned here is the rule.
 */
import { describe, it, expect } from 'vitest'
import { type ArticulationColumnState, type StackedArticulation, stackArticulations } from './articulationStack'

const empty: ArticulationColumnState = { leftShift: 0, rightShift: 0, textLine: 0, topTextLine: 0 }
const mark = (over: Partial<StackedArticulation> = {}): StackedArticulation => ({
  side: 'above', height: 10, width: 8, betweenLines: true, noteGlyphWidth: 12,
  stemDirection: -1, stemSpaces: 3.5, staffLines: 5, topLine: 3, bottomLine: 3, ...over,
})

describe('stackArticulations', () => {
  it('⭐ each mark takes the next text line on its side, a step of its height plus half a space', () => {
    const { placed, state } = stackArticulations([mark(), mark()], empty)
    expect(placed.map(p => p.textLine)).toEqual([0, 1.5])
    expect(state.topTextLine).toBe(3)
    expect(state.textLine).toBe(0)
  })

  it('the two sides stack independently, each with its own origin', () => {
    const { placed, state } = stackArticulations([mark(), mark({ side: 'below' })], empty)
    expect(placed.map(p => p.origin)).toEqual([[0.5, 1], [0.5, 0]])
    expect(state).toMatchObject({ topTextLine: 1.5, textLine: 1.5 })
  })

  it('⭐ a mark that may not sit between the lines is pushed out past the staff', () => {
    // Head on line 3, stem down: the stack above starts at 3 + 0 + 0.5, and 5 is the staff's top.
    const { state } = stackArticulations([mark({ betweenLines: false })], empty)
    expect(state.topTextLine).toBe(1.5 + (5 - 3.5))
  })

  it('…counting from the stem tip when the stem points that way', () => {
    const { state } = stackArticulations([mark({ betweenLines: false, stemDirection: 1 })], empty)
    expect(state.topTextLine, 'line 3 + a 3½-space stem is already clear').toBe(1.5)
  })

  it('a mark on neither side is left alone', () => {
    expect(stackArticulations([mark({ side: 'other' })], empty).placed[0]).toEqual({ textLine: null, origin: null })
  })

  it('the column widens by half of what the widest mark overhangs', () => {
    const { state } = stackArticulations([mark({ width: 20 })], empty)
    expect(state.leftShift).toBe(4)
    expect(state.rightShift).toBe(4)
  })

  it('no marks, no change', () => {
    expect(stackArticulations([], empty)).toEqual({ placed: [], state: empty })
  })
})
