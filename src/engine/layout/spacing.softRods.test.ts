/**
 * `Column.softRods` in the spring solve — room ASKED for by a line between two noteheads
 * (`layout/noteLineRoom`, docs/plans/glissando-plan.md P1b). ⭐ Soft: it raises the natural length and
 * ⛔ never the floor, so a squeeze may still go below it.
 */
import { describe, it, expect } from 'vitest'
import { fracCreate } from '@/utils/fraction'
import { GOULD_SPACING, minimumWidth, naturalWidth, plainColumn, spaceColumns, type Column } from './spacing'

const q = fracCreate
const bar = (rod?: { span: number; length: number }): Column[] => [
  { ...plainColumn(q(0, 1), q(1, 1)), ...(rod && { softRods: [rod] }) },
  plainColumn(q(1, 1), q(1, 1)),
  plainColumn(q(2, 1), q(0, 1)),
]

describe('soft rods', () => {
  it('a rod longer than the springs WIDENS the natural bar, by the difference', () => {
    const plain = naturalWidth(bar(), GOULD_SPACING)
    const spring = naturalWidth([plainColumn(q(0, 1), q(1, 1)), plainColumn(q(1, 1), q(0, 1))], GOULD_SPACING)
    expect(naturalWidth(bar({ span: 1, length: spring + 2 }), GOULD_SPACING)).toBeCloseTo(plain + 2)
  })

  it('a rod the springs already satisfy changes nothing', () => {
    expect(naturalWidth(bar({ span: 1, length: 0.5 }), GOULD_SPACING)).toBeCloseTo(naturalWidth(bar(), GOULD_SPACING))
  })

  it('⭐ ⛔ never the FLOOR — a squeeze can still go below it', () => {
    expect(minimumWidth(bar({ span: 1, length: 50 }), GOULD_SPACING)).toBe(minimumWidth(bar(), GOULD_SPACING))
    const xs = spaceColumns(bar({ span: 1, length: 50 }), 4, GOULD_SPACING)
    expect(xs[2]).toBeCloseTo(4)
  })

  it('over a SPAN, the gaps it covers share it in proportion', () => {
    const cols = bar({ span: 2, length: 40 })
    const xs = spaceColumns(cols, naturalWidth(cols, GOULD_SPACING), GOULD_SPACING)
    expect(xs[2]).toBeCloseTo(40)
    expect(xs[1]).toBeCloseTo(20) // two equal springs → equal shares
  })
})
