import { describe, it, expect } from 'vitest'
import {
  planSlurSegments,
  slurTrueEndpoints,
  resolveCps,
  slurEndpointOffsetPx,
  segmentEndpointOffsetPx,
  type SlurSegment,
} from './SlurRenderer'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'
import { type SystemEdgeLookup } from './systemEdges'
import type { Stave } from 'vexflow'
import { slurArchHeight } from './slurArchHeight'
import type { SlurEndpointOffsetOverride } from '@/types/music'

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
describe('planSlurSegments', () => {
  const pass = makeLookup(LINES, BOUNDS)
  const FIRST_X = 250 // start note tie-right X
  const LAST_X = 150  // end note tie-left X

  it('same line → a single non-partial segment', () => {
    expect(planSlurSegments(pass, 0, 0, FIRST_X, LAST_X, 1)).toEqual<SlurSegment[]>([
      { type: 'single' },
    ])
  })

  it('two lines → begin + end (the reported 2-line bug)', () => {
    const segs = planSlurSegments(pass, 0, 1, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'end'])
    // BEGIN trails off the START line's right margin (measure 3), from the note X.
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 })
    // END regression guard: leftX is the END line's SYSTEM left margin (first measure
    // 4 = 100), NOT the end note's own measure edge. This is the original bug.
    expect(segs[1]).toEqual({ type: 'end', leftX: 100, lastX: LAST_X })
  })

  it('three lines → begin + middle + end, middle spans the full crossed system', () => {
    const segs = planSlurSegments(pass, 0, 2, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'end'])
    // MIDDLE is line 1's full width: left margin (measure 4 = 100) → right (measure 5 = 480).
    expect(segs[1]).toEqual({ type: 'middle', leftX: 100, rightX: 480, line: 1 })
  })

  it('a SMALL staff: the system edges come back in the staff’s own space', () => {
    // The note Xs are already in it (they come off the notes); the system edges are where the bar
    // landed in the SVG, so they are the ones that convert. Left unconverted, a slur crossing a
    // system break on a 0.7 staff stopped 30% short of the margin. See the `scale` parameter.
    const segs = planSlurSegments(pass, 0, 1, FIRST_X, LAST_X, 0.5)
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 * 2 })
    expect(segs[1]).toEqual({ type: 'end', leftX: 100 * 2, lastX: LAST_X })
  })

  it('⭐ the LEFT boundary is the caller’s: a curve resumes after the header’s ink', () => {
    // The slur passes `lineLeftCurveX`; the bracket families keep the default. Any line-start edge
    // the planner produces — the END half and every MIDDLE — comes from it, and nothing else does.
    const curveEdge = (_p: SystemEdgeLookup, line: number) => 40 + line
    const segs = planSlurSegments(pass, 0, 2, FIRST_X, LAST_X, 1, curveEdge)
    expect(segs[1]).toEqual({ type: 'middle', leftX: 41, rightX: 480, line: 1 })
    expect(segs[2]).toEqual({ type: 'end', leftX: 42, lastX: LAST_X })
    // ⛔ and not the RIGHT one: a BEGIN half still trails off the music's own margin.
    expect(segs[0]).toEqual({ type: 'begin', firstX: FIRST_X, rightX: 390 })
  })

  it('four lines → begin + 2×middle + end (N-system generality)', () => {
    const segs = planSlurSegments(pass, 0, 3, FIRST_X, LAST_X, 1)
    expect(segs.map(s => s.type)).toEqual(['begin', 'middle', 'middle', 'end'])
    expect(segs[1]).toMatchObject({ type: 'middle', line: 1, leftX: 100, rightX: 480 })
    expect(segs[2]).toMatchObject({ type: 'middle', line: 2, leftX: 100, rightX: 470 })
  })
})

describe('slurTrueEndpoints (re-anchor handle geometry)', () => {
  it('places p0/p1 at the note tie-edge Xs lifted by LIFT·direction (above)', () => {
    // direction -1 = arc above → endpoints lifted UP (smaller Y).
    const { p0, p1, direction } = slurTrueEndpoints(120, 360, 200, 180, 10, -1)
    expect(p0).toEqual({ x: 120, y: 190 }) // 200 + 10·(-1)
    expect(p1).toEqual({ x: 360, y: 170 }) // 180 + 10·(-1)
    expect(direction).toBe(-1)
  })

  it('lifts DOWN when the slur sits below (direction +1)', () => {
    const { p0, p1 } = slurTrueEndpoints(120, 360, 200, 180, 10, 1)
    expect(p0).toEqual({ x: 120, y: 210 }) // 200 + 10·1
    expect(p1).toEqual({ x: 360, y: 190 }) // 180 + 10·1
  })

  it('matches the same-line p0/p1 formula used for the square handles', () => {
    // The render path computes startY = fromY + LIFT·dir at firstX; this helper must
    // reproduce exactly that so cross-system squares land on the same spot as same-line.
    const firstX = 50, lastX = 400, fromY = 300, toY = 305, LIFT = 10, dir = 1
    const { p0, p1 } = slurTrueEndpoints(firstX, lastX, fromY, toY, LIFT, dir)
    expect(p0).toEqual({ x: firstX, y: fromY + LIFT * dir })
    expect(p1).toEqual({ x: lastX, y: toY + LIFT * dir })
  })
})

describe('resolveCps (per-segment + single-arc shape resolution, P1)', () => {
  // staffSpacesToPixels only reads getSpacingBetweenLines() — stub just that.
  const stave = (spacing: number) => ({ getSpacingBetweenLines: () => spacing } as unknown as Stave)
  const p0 = { x: 0, y: 0 }
  const p1 = { x: 100, y: 0 } // flat 100px span

  // ⭐ The arch HEIGHT is `./slurArchHeight`'s and is pinned in ITS spec — these tests are about
  // resolveCps's BRANCHING (override vs auto vs nest lift), so they ask the law rather than restate
  // it. They used to hardcode 15.3, which is what the pre-2026-08-16 law drew for this span; that
  // number moving is a Phase 2 decision, not a regression here.
  const autoH = slurArchHeight(p1.x - p0.x)

  it('no override → the auto arch (slurArchCps), independent of any stave', () => {
    // Flat 100px span, above: symmetric, no sideways shift.
    expect(resolveCps(undefined, stave(10), p0, p1, -1, 0)).toEqual([
      { x: 0, y: autoH }, { x: 0, y: autoH },
    ])
  })

  it('override present → staff-spaces converted to pixels against the live stave spacing', () => {
    const override: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 2, y: 3 }, { x: -1, y: 4 }]
    expect(resolveCps(override, stave(10), p0, p1, -1, 0)).toEqual([
      { x: 20, y: 30 }, { x: -10, y: 40 },
    ])
    // A different stave spacing rescales (resolution independence).
    expect(resolveCps(override, stave(8), p0, p1, -1, 0)).toEqual([
      { x: 16, y: 24 }, { x: -8, y: 32 },
    ])
  })

  it('override present but NO stave → falls back to the auto arch (defensive)', () => {
    const override: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 9, y: 9 }, { x: 9, y: 9 }]
    expect(resolveCps(override, undefined, p0, p1, -1, 0)).toEqual([
      { x: 0, y: autoH }, { x: 0, y: autoH },
    ])
  })

  it('extraHeight (nest lift) raises ONLY the auto arch, never a manual override', () => {
    const auto = resolveCps(undefined, stave(10), p0, p1, -1, 10)
    expect(auto).toEqual([{ x: 0, y: autoH + 10 }, { x: 0, y: autoH + 10 }])
    const override: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 1, y: 1 }, { x: 1, y: 1 }]
    expect(resolveCps(override, stave(10), p0, p1, -1, 10)).toEqual([
      { x: 10, y: 10 }, { x: 10, y: 10 }, // extraHeight ignored — fully authored
    ])
  })
})

describe('slurEndpointOffsetPx (endpoint nudge → px, P0)', () => {
  // staffSpacesToPixels only reads getSpacingBetweenLines() — stub just that.
  const stave = (spacing: number) => ({ getSpacingBetweenLines: () => spacing } as unknown as Stave)
  const offset = (o: Partial<SlurEndpointOffsetOverride>): SlurEndpointOffsetOverride =>
    ({ kind: 'endpointOffset', ...o })

  it('no offset → all-zero deltas (caller adds them unconditionally)', () => {
    expect(slurEndpointOffsetPx(undefined, stave(10), stave(10)))
      .toEqual({ startX: 0, startY: 0, endX: 0, endY: 0 })
  })

  it('converts each end staff-spaces → px against its OWN stave', () => {
    // start on a 10px stave, end on an 8px stave → independent scaling (cross-system).
    const o = offset({ start: { x: 0.5, y: -1 }, end: { x: 2, y: 1 } })
    expect(slurEndpointOffsetPx(o, stave(10), stave(8)))
      .toEqual({ startX: 5, startY: -10, endX: 16, endY: 8 })
  })

  it('a missing end contributes 0 for that end only', () => {
    const o = offset({ start: { x: 1, y: 1 } }) // no end
    expect(slurEndpointOffsetPx(o, stave(10), stave(10)))
      .toEqual({ startX: 10, startY: 10, endX: 0, endY: 0 })
  })

  it('an undefined stave yields 0 for that end (guard against not-yet-laid-out staves)', () => {
    const o = offset({ start: { x: 3, y: 3 }, end: { x: 3, y: 3 } })
    // fromStave undefined → start contributes 0; toStave present → end converts.
    expect(slurEndpointOffsetPx(o, undefined, stave(10)))
      .toEqual({ startX: 0, startY: 0, endX: 30, endY: 30 })
  })
})

describe('segmentEndpointOffsetPx (open-join nudge → px, P0)', () => {
  const stave = (spacing: number) => ({ getSpacingBetweenLines: () => spacing } as unknown as Stave)

  it('no offset → zero delta (caller adds it unconditionally)', () => {
    expect(segmentEndpointOffsetPx(undefined, stave(10))).toEqual({ x: 0, y: 0 })
  })

  it('converts staff-spaces → px against the segment stave', () => {
    expect(segmentEndpointOffsetPx({ x: 0.5, y: -1 }, stave(10))).toEqual({ x: 5, y: -10 })
  })

  it('an undefined stave yields 0 (guard against a not-yet-laid-out middle system)', () => {
    expect(segmentEndpointOffsetPx({ x: 3, y: 3 }, undefined)).toEqual({ x: 0, y: 0 })
  })
})
