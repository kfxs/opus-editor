// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { GutterRenderer } from './GutterRenderer'
import { GUTTER_WIDTH, type GutterState } from './layoutConfig'

/**
 * A SMALL staff must be repeated small. The gutter says "this is the clef in force on this staff",
 * and a full-size clef standing next to a staff engraved at 0.7 says it about some other staff.
 *
 * ⚠️ Node identity and attributes only — jsdom has no layout and no fonts, so where the ink landed
 * is not a question that can be asked here (docs/ARCHITECTURE.md §"the browser suite"). What CAN be
 * asked is the mechanism: one `scale(k)` transform per staff, which is how the score does it too.
 */
describe('GutterRenderer — a staff is repeated at its own size', () => {
  let host: HTMLElement
  let gutter: GutterRenderer

  const staff = (topLineY: number, size: number) => ({
    topLineY,
    lineSpacing: 10 * size,
    size,
    clef: 'treble' as const,
  })
  const draw = (state: GutterState) => gutter.render(state, 1, 400)
  /** The per-staff groups, in the order they were drawn. (`openGroup` prefixes the class `vf-`.) */
  const staffGroups = () => [...host.querySelectorAll('g.vf-gutterstaff')]

  beforeEach(() => {
    host = document.createElement('div')
    gutter = new GutterRenderer(host)
  })

  it('carries the staff size as ONE transform on the staff\'s own group', () => {
    draw({ measureNumber: 1, openingMeterX: 65, staves: [staff(100, 0.7)] })

    expect(staffGroups().map(g => g.getAttribute('transform'))).toEqual(['scale(0.7)'])
  })

  it('writes no transform at all at full size — the k = 1 path is the arithmetic it replaced', () => {
    draw({ measureNumber: 1, openingMeterX: 65, staves: [staff(100, 1)] })

    expect(staffGroups().map(g => g.getAttribute('transform'))).toEqual([null])
  })

  it('sizes each staff of a system separately — one small over one full', () => {
    draw({
      measureNumber: 1,
      openingMeterX: 65,
      staves: [staff(100, 0.7), staff(300, 1)],
    })

    expect(staffGroups().map(g => g.getAttribute('transform'))).toEqual(['scale(0.7)', null])
  })

  it('still draws every staff, and a redraw replaces rather than accumulates', () => {
    const state: GutterState = {
      measureNumber: 1,
      openingMeterX: 65,
      staves: [staff(100, 0.7), staff(300, 1)],
    }
    draw(state)
    draw(state)

    expect(staffGroups()).toHaveLength(2)
  })

  it('spans the gutter whatever the size — a small staff is not a short one', () => {
    // The stave is built in its own space (÷ k) precisely so the drawn width is unchanged: the
    // gutter's staves reach its right edge at any size, exactly as the score's bars align.
    draw({ measureNumber: 1, openingMeterX: 65, staves: [staff(100, 0.7)] })

    const svg = host.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe(String(GUTTER_WIDTH))
  })
})
