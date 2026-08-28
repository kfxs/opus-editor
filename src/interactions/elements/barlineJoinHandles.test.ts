/**
 * ⭐⭐ **A SQUARE EXISTS EXACTLY WHERE A GAP EXISTS** — the arithmetic behind his table
 * (docs/barline-join-plan.md §1): bottom only on the first staff, top only on the last, both on the
 * ones in between, and **none at all when there is one staff**.
 *
 * Subject: {@link barlineJoinHandles}. That the squares are PAINTED and registered is
 * `HighlightController.barlineJoin.test.ts`'s; where the drawn line lands is the browser suite's
 * (jsdom measures every glyph 0×0 — these boxes are all fixtures, so nothing here reads a font).
 */
import { describe, it, expect } from 'vitest'
import { barlineJoinHandles, BARLINE_JOIN_HANDLE_GAP_PX, type BarlineBoxRegistry } from './barlineJoinHandles'

const MEASURE = 5
/** A staff's five lines: 40 px tall, at the default 150 px stride, so the gap below one is 110 px. */
const STAFF_SPAN = 40
const STRIDE = 150

/** One registered barline box. `boundary` is where the LINE stands; `signLeft` is how far the box
 *  grows leftward with the sign's ink (0 for a plain line, more for a final bar or a repeat). */
function box(staff: number, top: number, boundary = 300, signLeft = 0) {
  return {
    measure: MEASURE,
    staff,
    bbox: { x: boundary - 2 - signLeft, y: top, width: 4 + signLeft, height: STAFF_SPAN },
  }
}

function registryOf(
  boxes: ReturnType<typeof box>[],
  unpainted: number[] = [],
): BarlineBoxRegistry {
  return {
    getByType: () => boxes,
    isPainted: (_measure, staff) => !unpainted.includes(staff),
  }
}

/** N staves at the default stride, each with a plain barline at x 300. */
const staves = (n: number) => Array.from({ length: n }, (_, i) => box(i, 100 + i * STRIDE))

describe('the join squares of a selected barline', () => {
  it('a single staff has no gap, so it offers no square', () => {
    // ⛔ Not because anything asks `if (staffCount === 1)` — the loop over gaps has nothing to run.
    expect(barlineJoinHandles(registryOf(staves(1)), MEASURE, 'plain')).toEqual([])
  })

  it('two staves: one gap, two squares, both naming the UPPER staff', () => {
    const handles = barlineJoinHandles(registryOf(staves(2)), MEASURE, 'plain')
    expect(handles.map(h => [h.staffAbove, h.side])).toEqual([[0, 'below'], [0, 'above']])
  })

  it('⭐ three staves give his table: bottom only on the first, both on the middle, top only on the last', () => {
    const handles = barlineJoinHandles(registryOf(staves(3)), MEASURE, 'plain')
    // Read back per STAFF — the square hangs off the staff whose edge it sits at, which for an
    // `above` square is the staff BELOW the gap it names.
    const nearStaff = (h: { staffAbove: number; side: string }) =>
      h.side === 'below' ? h.staffAbove : h.staffAbove + 1
    const sidesOf = (staff: number) => handles.filter(h => nearStaff(h) === staff).map(h => h.side)
    expect(sidesOf(0)).toEqual(['below'])
    expect(sidesOf(1)).toEqual(['above', 'below'])
    expect(sidesOf(2)).toEqual(['above'])
    // Two gaps × two squares, and every square names the gap by the staff above it.
    expect(handles).toHaveLength(4)
    expect(handles.map(h => h.staffAbove)).toEqual([0, 0, 1, 1])
  })

  it('sits the two squares in the gap, one under each staff line it hangs off', () => {
    const [below, above] = barlineJoinHandles(registryOf(staves(2)), MEASURE, 'plain')
    // The upper staff's bottom line is 100 + 40; the lower staff's top line is 250.
    expect(below.y).toBe(100 + STAFF_SPAN + BARLINE_JOIN_HANDLE_GAP_PX)
    expect(above.y).toBe(250 - BARLINE_JOIN_HANDLE_GAP_PX)
    // …and well clear of each other in a default gap.
    expect(above.y - below.y).toBeGreaterThan(4 * BARLINE_JOIN_HANDLE_GAP_PX)
  })

  it('🚨 centres on the INK the join will draw, ⛔ not on the boundary coordinate', () => {
    // His report, 2026-08-28: *"the blue square is not centered regarding the barline"*. A plain
    // stroke sits at `[boundary, boundary + 0.16sp]` — its ink centre is 0.8 px RIGHT of the line's
    // own x, which is what a square centred on the boundary was missing by.
    const [below] = barlineJoinHandles(registryOf(staves(2)), MEASURE, 'plain')
    expect(below.x).toBeCloseTo(300.8, 6)
  })

  it('🚨 …which for a final bar or a repeat is a whole sign to the LEFT of the boundary', () => {
    // Every stroke of an end sign is left of the line (thin · gap · THICK, the thick's right edge on
    // the boundary), so the ink spans `[-0.98sp, 0]` and its centre is 4.9 px left. ⛔ And the DOTS
    // are not in it — they never cross the gap (`rendering/barlineGap`), so they cannot move the
    // handle that marks where the join runs.
    const wide = [box(0, 100, 300, 15), box(1, 250, 300, 15)]
    const handles = barlineJoinHandles(registryOf(wide), MEASURE, 'repeatEnd')
    expect(handles.map(h => h.x)).toEqual([295.1, 295.1])
    // ⛔ Nor is it the registered box's own centre, which the sign's leftward growth drags off the
    // line by half its ink (`barlineStamp.nearestBoundary` may use that; this may not).
    expect(wide[0].bbox.x + wide[0].bbox.width / 2).toBeCloseTo(292.5, 6)
  })

  it('takes each square\'s x from ITS OWN staff, so a displaced sign is not split down the middle', () => {
    // One staff's `|:` pushed past a header it alone carries: two lines, two x's, and no average.
    const handles = barlineJoinHandles(registryOf([box(0, 100, 300), box(1, 250, 318)]), MEASURE, 'plain')
    expect(handles.map(h => h.x)).toEqual([300.8, 318.8])
  })

  it('offers nothing for a bar that was not painted — an off-screen box hands out no handle', () => {
    expect(barlineJoinHandles(registryOf(staves(2), [0, 1]), MEASURE, 'plain')).toEqual([])
  })

  it('⚠️ needs ADJACENT staves: a gap spanning an undrawn staff is not one the model can name', () => {
    // Staff 1 was not drawn, so what is left is staves 0 and 2 — and `barlineJoinBelow` on staff 0
    // means the gap down to staff 1, which is not this space.
    expect(barlineJoinHandles(registryOf(staves(3), [1]), MEASURE, 'plain')).toEqual([])
  })

  it('⭐ offers only the CLICKED staff\'s squares when a press named one', () => {
    // His call, 2026-08-28: *"we should show the blue square just in the stave we clicked and not in
    // all staves"* — so the middle staff of three offers the square ABOVE it (the gap it shares with
    // staff 0) and the one BELOW it (the gap it shares with staff 2), and nothing on their far sides.
    const handles = barlineJoinHandles(registryOf(staves(3)), MEASURE, 'plain', { staff: 1 })
    expect(handles.map(h => [h.staffAbove, h.side])).toEqual([[0, 'above'], [1, 'below']])
    // The first staff has only the gap below it, the last only the gap above.
    const sides = (staff: number) =>
      barlineJoinHandles(registryOf(staves(3)), MEASURE, 'plain', { staff }).map(h => h.side)
    expect(sides(0)).toEqual(['below'])
    expect(sides(2)).toEqual(['above'])
  })

  it('⭐⭐ ONE square, at the END that was pressed — the spot IS the choice', () => {
    // His call, 2026-08-28: *"the spot to click is critical… if the user click in that area we show
    // the blue square related with that"*, which is Sibelius's own gesture (§4.5 p. 343) and
    // MuseScore's single grip.
    const at = (staff: number, end: 'top' | 'bottom') =>
      barlineJoinHandles(registryOf(staves(3)), MEASURE, 'plain', { staff, end })
    expect(at(1, 'top').map(h => [h.staffAbove, h.side])).toEqual([[0, 'above']])
    expect(at(1, 'bottom').map(h => [h.staffAbove, h.side])).toEqual([[1, 'below']])
  })

  it('⚠️ …and an end with no gap behind it offers nothing — there is no space there to fill', () => {
    // The top of the FIRST staff and the bottom of the LAST: no gap, so no join to make. The gap on
    // the other side of that staff is its neighbour's to offer.
    const at = (staff: number, end: 'top' | 'bottom') =>
      barlineJoinHandles(registryOf(staves(3)), MEASURE, 'plain', { staff, end })
    expect(at(0, 'top')).toEqual([])
    expect(at(2, 'bottom')).toEqual([])
  })

  it('reads only the selected boundary\'s boxes', () => {
    const other = { ...box(0, 100), measure: MEASURE + 1 }
    const handles = barlineJoinHandles(registryOf([...staves(2), other]), MEASURE, 'plain')
    expect(handles).toHaveLength(2)
  })
})
