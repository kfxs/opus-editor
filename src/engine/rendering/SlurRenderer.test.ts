import { describe, it, expect } from 'vitest'
import {
  slurTrueEndpoints,
  resolveCps,
  slurEndpointOffsetPx,
  segmentEndpointOffsetPx,
} from './SlurRenderer'
import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { slurArchHeight } from './slurArchHeight'
import type { SlurEndpointOffsetOverride } from '@/types/music'

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
  // The helpers read only a staff frame's space.
  const frame = (spacePx: number): StaffFrame => ({ topLineY: 0, spacePx, lineCount: 5 })
  const p0 = { x: 0, y: 0 }
  const p1 = { x: 100, y: 0 } // flat 100px span

  // ⭐ The arch HEIGHT is `./slurArchHeight`'s and is pinned in ITS spec — these tests are about
  // resolveCps's BRANCHING (override vs auto vs nest lift), so they ask the law rather than restate
  // it. They used to hardcode 15.3, which is what the pre-2026-08-16 law drew for this span; that
  // number moving is a Phase 2 decision, not a regression here.
  const autoH = slurArchHeight(p1.x - p0.x)

  it('no override → the auto arch (slurArchCps), independent of any stave', () => {
    // Flat 100px span, above: symmetric, no sideways shift.
    expect(resolveCps(undefined, frame(10), p0, p1, -1, 0)).toEqual([
      { x: 0, y: autoH }, { x: 0, y: autoH },
    ])
  })

  it('override present → staff-spaces converted to pixels against the live stave spacing', () => {
    const override: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 2, y: 3 }, { x: -1, y: 4 }]
    expect(resolveCps(override, frame(10), p0, p1, -1, 0)).toEqual([
      { x: 20, y: 30 }, { x: -10, y: 40 },
    ])
    // A different stave spacing rescales (resolution independence).
    expect(resolveCps(override, frame(8), p0, p1, -1, 0)).toEqual([
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
    const auto = resolveCps(undefined, frame(10), p0, p1, -1, 10)
    expect(auto).toEqual([{ x: 0, y: autoH + 10 }, { x: 0, y: autoH + 10 }])
    const override: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 1, y: 1 }, { x: 1, y: 1 }]
    expect(resolveCps(override, frame(10), p0, p1, -1, 10)).toEqual([
      { x: 10, y: 10 }, { x: 10, y: 10 }, // extraHeight ignored — fully authored
    ])
  })
})

describe('slurEndpointOffsetPx (endpoint nudge → px, P0)', () => {
  // The helpers read only a staff frame's space.
  const frame = (spacePx: number): StaffFrame => ({ topLineY: 0, spacePx, lineCount: 5 })
  const offset = (o: Partial<SlurEndpointOffsetOverride>): SlurEndpointOffsetOverride =>
    ({ kind: 'endpointOffset', ...o })

  it('no offset → all-zero deltas (caller adds them unconditionally)', () => {
    expect(slurEndpointOffsetPx(undefined, frame(10), frame(10)))
      .toEqual({ startX: 0, startY: 0, endX: 0, endY: 0 })
  })

  it('converts each end staff-spaces → px against its OWN stave', () => {
    // start on a 10px stave, end on an 8px stave → independent scaling (cross-system).
    const o = offset({ start: { x: 0.5, y: -1 }, end: { x: 2, y: 1 } })
    expect(slurEndpointOffsetPx(o, frame(10), frame(8)))
      .toEqual({ startX: 5, startY: -10, endX: 16, endY: 8 })
  })

  it('a missing end contributes 0 for that end only', () => {
    const o = offset({ start: { x: 1, y: 1 } }) // no end
    expect(slurEndpointOffsetPx(o, frame(10), frame(10)))
      .toEqual({ startX: 10, startY: 10, endX: 0, endY: 0 })
  })

  it('an undefined stave yields 0 for that end (guard against not-yet-laid-out staves)', () => {
    const o = offset({ start: { x: 3, y: 3 }, end: { x: 3, y: 3 } })
    // fromStave undefined → start contributes 0; toStave present → end converts.
    expect(slurEndpointOffsetPx(o, undefined, frame(10)))
      .toEqual({ startX: 0, startY: 0, endX: 30, endY: 30 })
  })
})

describe('segmentEndpointOffsetPx (open-join nudge → px, P0)', () => {
  const frame = (spacePx: number): StaffFrame => ({ topLineY: 0, spacePx, lineCount: 5 })

  it('no offset → zero delta (caller adds it unconditionally)', () => {
    expect(segmentEndpointOffsetPx(undefined, frame(10))).toEqual({ x: 0, y: 0 })
  })

  it('converts staff-spaces → px against the segment stave', () => {
    expect(segmentEndpointOffsetPx({ x: 0.5, y: -1 }, frame(10))).toEqual({ x: 5, y: -10 })
  })

  it('an undefined stave yields 0 (guard against a not-yet-laid-out middle system)', () => {
    expect(segmentEndpointOffsetPx({ x: 3, y: 3 }, undefined)).toEqual({ x: 0, y: 0 })
  })
})
