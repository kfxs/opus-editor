import { describe, it, expect } from 'vitest'
import { lineLeftCurveX, lineLeftEdgeX, lineRightEdgeX, type SystemEdgeLookup } from './systemEdges'
import { HEADER_TO_NOTE } from '@/engine/layout/headerInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { CURVE } from './curveStyle'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'

/**
 * Fabricate the narrow {@link SystemEdgeLookup} slice these helpers read. Only `lineNumber`,
 * `noteStartX` and `noteEndX` are touched, so the rest of MeasureWidthInfo/MeasureBounds is filled
 * with throwaway values. `lines` maps measureNumber → lineNumber.
 */
function makeLookup(
  lines: Record<number, number>,
  bounds: Record<number, { noteStartX: number; noteEndX: number }>,
): SystemEdgeLookup {
  const measureLayoutInfo = new Map<number, MeasureWidthInfo>()
  for (const [num, lineNumber] of Object.entries(lines)) {
    measureLayoutInfo.set(Number(num), { measureNumber: Number(num), minWidth: 0, finalWidth: 0, lineNumber })
  }
  const measureBounds = new Map<number, MeasureBounds>()
  for (const [num, b] of Object.entries(bounds)) {
    measureBounds.set(Number(num), {
      measureX: b.noteStartX - 20, measureY: 0, measureWidth: 0,
      noteStartX: b.noteStartX, noteEndX: b.noteEndX,
    })
  }
  return { measureLayoutInfo, measureBounds }
}

// line 0: measures 1,2,3   line 1: 4,5   line 2: 6,7,8
const LINES = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2 }
const BOUNDS = {
  1: { noteStartX: 100, noteEndX: 190 }, 2: { noteStartX: 200, noteEndX: 290 }, 3: { noteStartX: 300, noteEndX: 390 },
  4: { noteStartX: 100, noteEndX: 240 }, 5: { noteStartX: 250, noteEndX: 480 },
  6: { noteStartX: 100, noteEndX: 230 }, 7: { noteStartX: 240, noteEndX: 360 }, 8: { noteStartX: 370, noteEndX: 470 },
}

describe('system margins — where the MUSIC begins and ends on a line', () => {
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
    expect(lineLeftCurveX(pass, 99)).toBeUndefined()
  })

  it('returns undefined when the boundary measure has no bounds', () => {
    // measure 2 is on line 0 but we omit its bounds → first measure (1) still has bounds, so the
    // left edge resolves; drop measure 1's bounds to break it.
    const broken = makeLookup({ 1: 0, 2: 0 }, { 2: { noteStartX: 200, noteEndX: 290 } })
    expect(lineLeftEdgeX(broken, 0)).toBeUndefined() // first measure (1) lacks bounds
    expect(lineRightEdgeX(broken, 0)).toBe(290)      // last measure (2) has bounds
  })
})

/**
 * ⭐⭐ **The CURVE's own left boundary** — Gould p. 112 / p. 65: a slur or tie resumes *after the
 * clef, key signature and time signature*, meaning after their INK. `noteStartX` is the padded
 * boundary and measured **equal to the first notehead's x** in his figure, which is why the two
 * questions have two answers (docs/slur-plan.md §12 Phase 5).
 */
describe('lineLeftCurveX — where a continuation begins', () => {
  const pass = makeLookup(LINES, BOUNDS)
  // The table is `as const` for its readers; a spec that pins a CLAMP has to move the value it
  // clamps, and restores it in a `finally`.
  const tuneable = CURVE as { curveFromHeader: number }

  it('sits LEFT of the music, in the air the header already leaves', () => {
    // The header's ink ends HEADER_TO_NOTE before the music; the curve starts curveFromHeader past it.
    const shift = (HEADER_TO_NOTE - CURVE.curveFromHeader) * STAFF_SPACE_PX
    expect(lineLeftCurveX(pass, 1)).toBe(100 - shift)
    expect(lineLeftCurveX(pass, 1)!).toBeLessThan(lineLeftEdgeX(pass, 1)!)
  })

  it('⭐ never past the note it runs to, however the margin is tuned (MuseScore’s own clamp)', () => {
    const settled = CURVE.curveFromHeader
    try {
      // A margin wider than the header's whole gap would otherwise carry the open end past the
      // notehead — the failure the clamp exists for, not a value we ship.
      tuneable.curveFromHeader =HEADER_TO_NOTE + 3
      expect(lineLeftCurveX(pass, 0)).toBe(lineLeftEdgeX(pass, 0))
    } finally {
      tuneable.curveFromHeader =settled
    }
  })

  it('⭐ LilyPond’s flush-at-the-header end of the range is reachable: margin 0 → the ink edge', () => {
    const settled = CURVE.curveFromHeader
    try {
      tuneable.curveFromHeader =0
      expect(lineLeftCurveX(pass, 0)).toBe(100 - HEADER_TO_NOTE * STAFF_SPACE_PX)
    } finally {
      tuneable.curveFromHeader =settled
    }
  })
})
