import { describe, it, expect } from 'vitest'
import { planSpanSegments, cutSpanAtSystems, type SpanSegment } from './spanSegments'
import type { MeasureWidthInfo } from '@/engine/layout/layoutConfig'
import type { MeasureBounds } from '../renderTypes'
import { type SystemEdgeLookup } from '../systemEdges'

/**
 * Fabricate the narrow {@link SystemEdgeLookup} slice the segment planner reads. We only set the fields they touch (`lineNumber`,
 * `noteStartX`, `noteEndX`), so the rest of MeasureWidthInfo/MeasureBounds is filled
 * with throwaway values. `lines` maps measureNumber → lineNumber; `bounds` maps
 * measureNumber → { noteStartX, noteEndX }.
 */
function makeLookup(
  lines: Record<number, number>,
  bounds: Record<number, { noteStartX: number; noteEndX: number; measureX?: number }>,
): SystemEdgeLookup {
  const measureLayoutInfo = new Map<number, MeasureWidthInfo>()
  for (const [num, lineNumber] of Object.entries(lines)) {
    measureLayoutInfo.set(Number(num), {
      measureNumber: Number(num), minWidth: 0, finalWidth: 0, lineNumber,
    })
  }
  const measureBounds = new Map<number, MeasureBounds>()
  for (const [num, b] of Object.entries(bounds)) {
    measureBounds.set(Number(num), {
      // ⭐ A system's left BARLINE, which is where an open-ended continuation begins — 20px left of
      // where the notes start unless a fixture says otherwise (`./systemEdges`).
      measureX: b.measureX ?? b.noteStartX - 20,
      measureY: 0, measureWidth: 0,
      noteStartX: b.noteStartX, noteEndX: b.noteEndX,
    })
  }
  return { measureLayoutInfo, measureBounds }
}

// Layout used across the planner tests: 4 lines, a few measures each, with
// distinctive edge Xs so we can assert WHICH measure's edge a segment picked.
//   line 0: measures 1,2,3   line 1: 4,5   line 2: 6,7,8   line 3: 9,10
const LINES = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3 }
const BOUNDS = {
  1: { noteStartX: 100, noteEndX: 190 }, 2: { noteStartX: 200, noteEndX: 290 }, 3: { noteStartX: 300, noteEndX: 390 },
  4: { noteStartX: 100, noteEndX: 240 }, 5: { noteStartX: 250, noteEndX: 480 },
  6: { noteStartX: 100, noteEndX: 230 }, 7: { noteStartX: 240, noteEndX: 360 }, 8: { noteStartX: 370, noteEndX: 470 },
  9: { noteStartX: 100, noteEndX: 280 }, 10: { noteStartX: 290, noteEndX: 460 },
}

/**
 * ⭐⭐ **An open-ended segment starts AFTER the clef, key and meter** — Gould p. 112 states it
 * verbatim, and all three engines land there. ⛔ Not the bar's own left edge: a version that took
 * `measureX` drew the arc through the clef. ⚠️ WHICH x that boundary is belongs to `./systemEdges`
 * (and is tested there): the planner takes it as `leftEdgeX`, because a CURVE resumes after the
 * header's INK while the bracket families resume at the music's own margin.
 */
describe('planSpanSegments', () => {
  const pass = makeLookup(LINES, BOUNDS)
  const FIRST_X = 250 // start note tie-right X
  const LAST_X = 150  // end note tie-left X

  it('same line → a single non-partial segment', () => {
    expect(planSpanSegments(pass, 0, 0, FIRST_X, LAST_X, 1)).toEqual<SpanSegment[]>([
      { type: 'single' },
    ])
  })

  it('two lines → begin + end (the reported 2-line bug)', () => {
    const segs = planSpanSegments(pass, 0, 1, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'end'])
    // BEGIN trails off the START line's right margin (measure 3), from the note X.
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 })
    // END regression guard: leftX is the END line's SYSTEM left margin (first measure
    // 4 = 100), NOT the end note's own measure edge. This is the original bug.
    expect(segs[1]).toEqual({ type: 'end', leftX: 100, lastX: LAST_X })
  })

  it('three lines → begin + middle + end, middle spans the full crossed system', () => {
    const segs = planSpanSegments(pass, 0, 2, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'end'])
    // MIDDLE is line 1's full width: left margin (measure 4 = 100) → right (measure 5 = 480).
    expect(segs[1]).toEqual({ type: 'middle', leftX: 100, rightX: 480, line: 1 })
  })

  it('a SMALL staff: the system edges come back in the staff’s own space', () => {
    // The note Xs are already in it (they come off the notes); the system edges are where the bar
    // landed in the SVG, so they are the ones that convert. Left unconverted, a slur crossing a
    // system break on a 0.7 staff stopped 30% short of the margin. See the `scale` parameter.
    const segs = planSpanSegments(pass, 0, 1, FIRST_X, LAST_X, 0.5)
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 * 2 })
    expect(segs[1]).toEqual({ type: 'end', leftX: 100 * 2, lastX: LAST_X })
  })

  it('⭐ the LEFT boundary is the caller’s: a curve resumes after the header’s ink', () => {
    // The slur passes `lineLeftCurveX`; the bracket families keep the default. Any line-start edge
    // the planner produces — the END half and every MIDDLE — comes from it, and nothing else does.
    const curveEdge = (_p: SystemEdgeLookup, line: number) => 40 + line
    const segs = planSpanSegments(pass, 0, 2, FIRST_X, LAST_X, 1, curveEdge)
    expect(segs[1]).toEqual({ type: 'middle', leftX: 41, rightX: 480, line: 1 })
    expect(segs[2]).toEqual({ type: 'end', leftX: 42, lastX: LAST_X })
    // ⛔ and not the RIGHT one: a BEGIN half still trails off the music's own margin.
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 })
  })

  it('four lines → begin + 2×middle + end (N-system generality)', () => {
    const segs = planSpanSegments(pass, 0, 3, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'middle', 'end'])
    expect(segs[1]).toMatchObject({ type: 'middle', line: 1, leftX: 100, rightX: 480 })
    expect(segs[2]).toMatchObject({ type: 'middle', line: 2, leftX: 100, rightX: 470 })
  })
})

describe('cutSpanAtSystems — the LINE families\' ranges', () => {
  const pass = makeLookup(LINES, BOUNDS)

  it('same line → one range between the two x\'s, carrying both real ends', () => {
    expect(cutSpanAtSystems(pass, 0, 0, 120, 360, 1)).toEqual([{ x0: 120, x1: 360, line: 0, type: 'single' }])
  })

  it('three lines → begin to the margin, the whole middle system, the margin to the end', () => {
    expect(cutSpanAtSystems(pass, 0, 2, 250, 150, 1)).toEqual([
      { x0: 250, x1: 390, line: 0, type: 'begin' },
      { x0: 100, x1: 480, line: 1, type: 'middle' },
      { x0: 100, x1: 150, line: 2, type: 'end' },
    ])
  })

  it('drops a fragment of NO width — a span ending exactly on the new system\'s margin', () => {
    const ranges = cutSpanAtSystems(pass, 0, 1, 250, 100, 1)
    expect(ranges.map(r => r.type)).toEqual(['begin'])
  })

  it('⚠️ …unless the family keeps a hair-wide one (the pedal: its release must still be drawn)', () => {
    const ranges = cutSpanAtSystems(pass, 0, 1, 250, 100, 1, { keepHairWide: true })
    expect(ranges.map(r => r.type)).toEqual(['begin', 'end'])
    expect(ranges[1]).toMatchObject({ x0: 100, x1: 100 })
  })

  it('…but never one that runs BACKWARDS', () => {
    expect(cutSpanAtSystems(pass, 0, 0, 300, 200, 1, { keepHairWide: true })).toEqual([])
  })
})
