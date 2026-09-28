/**
 * {@link glyphMarkStackBaselines} — where each symbol of one note's stack stands (docs/plans/symbol-plan.md P1).
 */
import { describe, it, expect } from 'vitest'
import { glyphMarkStackBaselines } from './glyphMarkStack'
import { clearanceBaseline } from './inkBand'

const LINE = { padding: 0.3, minFromStaff: 0.5 }

describe('glyphMarkStackBaselines', () => {
  it('stands the first mark on the family rule, and nothing else', () => {
    const band = { top: -2, bottom: 5 }
    const ink = { above: 1, below: 0.2 }
    expect(glyphMarkStackBaselines(band, 'above', [ink], LINE, 0.4))
      .toEqual([clearanceBaseline(band, 'above', ink, LINE)])
  })

  it('stacks each next mark outward ABOVE the staff, a gap between their inks, in the order handed in', () => {
    const [a, b, c] = glyphMarkStackBaselines(null, 'above',
      [{ above: 1, below: 0 }, { above: 2, below: 0.5 }, { above: 1, below: 0 }], LINE, 0.4)
    // a: floor 0.5 above the top line, ink sitting on it.
    expect(a).toBeCloseTo(-0.5)
    // b: a's top (-1.5), the gap, then b's own reach below its baseline.
    expect(b).toBeCloseTo(-1.5 - 0.4 - 0.5)
    // c: b's top (-2.4 - 2), the gap.
    expect(c).toBeCloseTo(-4.4 - 0.4)
  })

  it('mirrors BELOW the staff', () => {
    const [a, b] = glyphMarkStackBaselines(null, 'below',
      [{ above: 1, below: 0.2 }, { above: 1, below: 0 }], LINE, 0.4)
    expect(a).toBeCloseTo(4 + 0.5 + 1)
    expect(b).toBeCloseTo(a + 0.2 + 0.4 + 1)
  })

  it('answers nothing for an empty stack', () => {
    expect(glyphMarkStackBaselines(null, 'above', [], LINE, 0.4)).toEqual([])
  })
})
