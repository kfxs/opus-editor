import { describe, it, expect } from 'vitest'
import { censusColumns, type CensusGlyph, type CensusStave } from './spacingCensus'

/**
 * The census ARITHMETIC — deliberately the only half of the instrument with a unit test.
 *
 * Its inputs can only be had from a browser (headless every glyph measures 0×0), but what it does
 * with them is grouping and subtraction, and that is worth pinning here rather than discovering
 * through a Playwright run: `e2e/spacing.e2e.ts` and `__spacing.dump()` both read their numbers
 * through this function, so an error in it is an error in the "before" the whole spacing model gets
 * measured against.
 *
 * The fixtures are drawn positions, written out as such — a stave four spaces tall so one staff
 * space is exactly 10 px and a gap reads off the page.
 */

/** A stave whose lines are 10 px apart, so one staff space = 10 px and the numbers are legible. */
const stave = (over: Partial<CensusStave> = {}): CensusStave =>
  ({ measure: 1, staff: 0, x1: 0, x2: 200, top: 100, bottom: 140, ...over })

/** A notehead at x, on the middle line of the stave above unless told otherwise. */
const head = (x: number, y = 120): CensusGlyph => ({ x, y, code: 'e0a4' })

describe('censusColumns', () => {
  it('reports the gap AFTER each column, in staff spaces, the last one running to the barline', () => {
    const [bar] = censusColumns([stave()], [head(50), head(90), head(130)])

    expect(bar.spacePx).toBe(10)
    expect(bar.columns.map(c => c.gap)).toEqual([4, 4, 7])
    expect(bar.width, '200 px of bar over a 10 px space').toBe(20)
    expect(bar.lead, 'the stave start to the first column — header and inset included').toBe(5)
  })

  it('measures in the STAFF\'s own spaces, so a small staff is not reported as a cramped one', () => {
    // Same geometry at 0.7 scale: every px halves-ish, and every SPACE stays where it was.
    const small = stave({ top: 100, bottom: 128, x1: 0, x2: 140 })
    const [bar] = censusColumns([small], [head(35, 114), head(63, 114), head(91, 114)])

    expect(bar.spacePx).toBe(7)
    expect(bar.columns.map(c => c.gap)).toEqual([4, 4, 7])
    expect(bar.width).toBe(20)
  })

  it('groups a chord\'s heads into ONE column and keeps every glyph\'s code', () => {
    const [bar] = censusColumns([stave()], [head(50, 115), head(50, 125), head(90)])

    expect(bar.columns).toHaveLength(2)
    expect(bar.columns[0].codes, 'both heads of the chord').toEqual(['e0a4', 'e0a4'])
    expect(bar.columns[0].gap).toBe(4)
  })

  it('sends a glyph to the staff it is VERTICALLY nearest — which is what splits a grand staff', () => {
    const upper = stave({ staff: 0, top: 100, bottom: 140 })
    const lower = stave({ staff: 1, top: 200, bottom: 240 })
    const [top, bottom] = censusColumns([upper, lower], [head(50, 120), head(90, 220), head(130, 120)])

    expect(top.columns.map(c => c.x)).toEqual([50, 130])
    expect(bottom.columns.map(c => c.x)).toEqual([90])
  })

  it('drops what is drawn outside every bar, rather than attributing it to the nearest one', () => {
    const [bar] = censusColumns([stave({ x1: 0, x2: 100 })], [head(50), head(150)])

    expect(bar.columns.map(c => c.x)).toEqual([50])
  })

  it('reports a bar nothing was drawn in, with its lead running the whole way', () => {
    const [bar] = censusColumns([stave()], [])

    expect(bar.columns).toEqual([])
    expect(bar.lead).toBe(20)
    expect(bar.width).toBe(20)
  })
})
