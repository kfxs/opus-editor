import { describe, it, expect } from 'vitest'
import {
  lineLeftEdgeX,
  lineRightEdgeX,
  planSlurSegments,
  type SlurLayoutLookup,
  type SlurSegment,
} from './SlurRenderer'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'

/**
 * Fabricate the narrow {@link SlurLayoutLookup} slice the system-edge helpers + the
 * segment planner read. We only set the fields they touch (`lineNumber`,
 * `noteStartX`, `noteEndX`), so the rest of MeasureWidthInfo/MeasureBounds is filled
 * with throwaway values. `lines` maps measureNumber → lineNumber; `bounds` maps
 * measureNumber → { noteStartX, noteEndX }.
 */
function makeLookup(
  lines: Record<number, number>,
  bounds: Record<number, { noteStartX: number; noteEndX: number }>,
): SlurLayoutLookup {
  const measureLayoutInfo = new Map<number, MeasureWidthInfo>()
  for (const [num, lineNumber] of Object.entries(lines)) {
    measureLayoutInfo.set(Number(num), {
      measureNumber: Number(num), minWidth: 0, finalWidth: 0, lineNumber,
    })
  }
  const measureBounds = new Map<number, MeasureBounds>()
  for (const [num, b] of Object.entries(bounds)) {
    measureBounds.set(Number(num), {
      measureX: 0, measureY: 0, measureWidth: 0,
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

describe('SlurRenderer system-edge helpers', () => {
  const pass = makeLookup(LINES, BOUNDS)

  it('lineLeftEdgeX = noteStartX of the FIRST measure on the line', () => {
    expect(lineLeftEdgeX(pass, 0)).toBe(100) // measure 1
    expect(lineLeftEdgeX(pass, 1)).toBe(100) // measure 4
    expect(lineLeftEdgeX(pass, 2)).toBe(100) // measure 6
  })

  it('lineRightEdgeX = noteEndX of the LAST measure on the line', () => {
    expect(lineRightEdgeX(pass, 0)).toBe(390) // measure 3
    expect(lineRightEdgeX(pass, 1)).toBe(480) // measure 5
    expect(lineRightEdgeX(pass, 2)).toBe(470) // measure 8
  })

  it('returns undefined for a line with no measures', () => {
    expect(lineLeftEdgeX(pass, 99)).toBeUndefined()
    expect(lineRightEdgeX(pass, 99)).toBeUndefined()
  })

  it('returns undefined when the boundary measure has no bounds', () => {
    // measure 2 is on line 0 but we omit its bounds → first measure (1) still has
    // bounds, so left edge resolves; drop measure 1's bounds to break it.
    const broken = makeLookup({ 1: 0, 2: 0 }, { 2: { noteStartX: 200, noteEndX: 290 } })
    expect(lineLeftEdgeX(broken, 0)).toBeUndefined() // first measure (1) lacks bounds
    expect(lineRightEdgeX(broken, 0)).toBe(290)      // last measure (2) has bounds
  })
})

describe('planSlurSegments', () => {
  const pass = makeLookup(LINES, BOUNDS)
  const FIRST_X = 250 // start note tie-right X
  const LAST_X = 150  // end note tie-left X

  it('same line → a single non-partial segment', () => {
    expect(planSlurSegments(pass, 0, 0, FIRST_X, LAST_X)).toEqual<SlurSegment[]>([
      { type: 'single' },
    ])
  })

  it('two lines → begin + end (the reported 2-line bug)', () => {
    const segs = planSlurSegments(pass, 0, 1, FIRST_X, LAST_X)
    expect(segs.map(s => s.type)).toEqual(['begin', 'end'])
    // BEGIN trails off the START line's right margin (measure 3), from the note X.
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 })
    // END regression guard: leftX is the END line's SYSTEM left margin (first measure
    // 4 = 100), NOT the end note's own measure edge. This is the original bug.
    expect(segs[1]).toEqual({ type: 'end', leftX: 100, lastX: LAST_X })
  })

  it('three lines → begin + middle + end, middle spans the full crossed system', () => {
    const segs = planSlurSegments(pass, 0, 2, FIRST_X, LAST_X)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'end'])
    // MIDDLE is line 1's full width: left margin (measure 4 = 100) → right (measure 5 = 480).
    expect(segs[1]).toEqual({ type: 'middle', leftX: 100, rightX: 480, line: 1 })
  })

  it('four lines → begin + 2×middle + end (N-system generality)', () => {
    const segs = planSlurSegments(pass, 0, 3, FIRST_X, LAST_X)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'middle', 'end'])
    expect(segs[1]).toMatchObject({ type: 'middle', line: 1, leftX: 100, rightX: 480 })
    expect(segs[2]).toMatchObject({ type: 'middle', line: 2, leftX: 100, rightX: 470 })
  })
})
