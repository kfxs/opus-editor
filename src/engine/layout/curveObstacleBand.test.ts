import { describe, it, expect } from 'vitest'
import { curveObstacleBand, type CurveWindow, type DrawnCurve, type StaffFrame } from './curveObstacleBand'
import { clearanceBaseline } from './inkBand'

/** A stave whose top line is at y=100 with 10px spaces — so "one space above the staff" is y=90,
 *  and the answers come out in whole numbers that can be read at a glance. */
const frame: StaffFrame = { topLineY: 100, spacePx: 10 }

const at = (...ys: number[]): { x: number; y: number }[] =>
  ys.map((y, i) => ({ x: i * 10, y }))

const curve = (over: Partial<DrawnCurve> = {}): DrawnCurve => ({
  staff: 0,
  line: 0,
  points: at(100, 90, 80, 90, 100), // an arch peaking one and a half spaces above the top line
  ...over,
})

const window = (over: Partial<CurveWindow> = {}): CurveWindow => ({
  staff: 0, line: 0, fromX: 0, toX: 40, ...over,
})

describe('curveObstacleBand — the drawn arc as an obstacle', () => {
  it('answers in STAFF SPACES on the ink axis: above the top line is negative', () => {
    // The apex sits at y=80, two spaces above a top line at 100.
    expect(curveObstacleBand([curve()], window(), frame)).toEqual({ top: -2, bottom: 0 })
  })

  it('is null when no curve reaches into the window — the ordinary case, and it must not be a zero',
    () => {
      // A band of {top: 0, bottom: 0} would be a claim that there IS ink at the top line.
      expect(curveObstacleBand([curve()], window({ fromX: 200, toX: 300 }), frame)).toBeNull()
      expect(curveObstacleBand([], window(), frame)).toBeNull()
    })

  it('⭐⭐ reads the SAMPLED ARC, not the bbox: a window near an endpoint is not pushed by the apex',
    () => {
      // The whole point of the module. Over the first ten pixels the arc has only descended half a
      // space; the bbox of the same curve would report the full two.
      const nearEnd = curveObstacleBand([curve()], window({ fromX: 0, toX: 10 }), frame)
      expect(nearEnd).toEqual({ top: -1, bottom: 0 })
      const wholeArc = curveObstacleBand([curve()], window(), frame)
      expect(nearEnd!.top).toBeGreaterThan(wholeArc!.top) // less far above the staff
    })

  it('🚨 ignores a curve on ANOTHER SYSTEM sharing the x-window', () => {
    // Every system starts at the same left margin, so x alone identifies nothing. This is the test
    // that fails if the `line` discriminator is dropped — and the drawing would still look right on
    // any one-system score.
    const elsewhere = curve({ line: 3, points: at(100, 40, 40, 40, 100) })
    expect(curveObstacleBand([elsewhere], window(), frame)).toBeNull()
    expect(curveObstacleBand([elsewhere, curve()], window(), frame)).toEqual({ top: -2, bottom: 0 })
  })

  it('🚨 ignores a curve on ANOTHER STAFF of the same system', () => {
    // Two staves are stacked in y, and a lower staff's ink is not an upper staff's obstacle — its
    // coordinates are not even in the same space.
    const below = curve({ staff: 1, points: at(100, 40, 40, 40, 100) })
    expect(curveObstacleBand([below], window(), frame)).toBeNull()
  })

  it('merges every curve that DOES overlap — the deepest arc wins', () => {
    const higher = curve({ points: at(100, 70, 60, 70, 100) })
    expect(curveObstacleBand([curve(), higher], window(), frame)).toEqual({ top: -4, bottom: 0 })
  })

  it('counts a point exactly ON the window edge — closed, like the ladder’s own overlap test', () => {
    // Erring by counting an abutting point pushes the mark further out, which is the safe direction.
    expect(curveObstacleBand([curve()], window({ fromX: 20, toX: 20 }), frame))
      .toEqual({ top: -2, bottom: -2 })
  })

  it('⚠️ takes the window either way round — a cross-system fragment’s x’s are not one ruler', () => {
    // `TrillRenderer.spanX` records why: across a break `endX` can be far LEFT of `startX`, and a
    // caller handing them over in that order must not silently get `null`.
    expect(curveObstacleBand([curve()], window({ fromX: 40, toX: 0 }), frame))
      .toEqual(curveObstacleBand([curve()], window(), frame))
  })

  it('answers null rather than Infinity for a stave that has not been laid out', () => {
    expect(curveObstacleBand([curve()], window(), { topLineY: 100, spacePx: 0 })).toBeNull()
  })

  it('scales with the staff: the same drawing on a smaller stave is the same many SPACES', () => {
    // A small staff closes up for free — the answer is in its own spaces, never multiplied by a
    // ratio (the `inkBand` rule; multiply here and a small staff lands twice-scaled).
    const small = { topLineY: 50, spacePx: 5 }
    const halved = curve({ points: at(50, 45, 40, 45, 50) })
    expect(curveObstacleBand([halved], window(), small))
      .toEqual(curveObstacleBand([curve()], window(), frame))
  })

  it('⭐ a BELOW-staff arc cannot move an ABOVE-staff mark, which is why no side filter is needed',
    () => {
      // Its band reaches downward only, and `clearanceBaseline` floors an above mark at the staff.
      const below = curve({ points: at(140, 150, 160, 150, 140) })
      const band = curveObstacleBand([below], window(), frame)
      expect(band).toEqual({ top: 4, bottom: 6 })
      const ink = { above: 0.5, below: 0.5 }
      const rule = { padding: 0.5, minFromStaff: 1 }
      expect(clearanceBaseline(band, 'above', ink, rule))
        .toBe(clearanceBaseline(null, 'above', ink, rule))
    })

  it('⭐ and the mirror: an above-staff arc cannot move a BELOW-staff mark', () => {
    const ink = { above: 0.5, below: 0.5 }
    const rule = { padding: 0.5, minFromStaff: 1 }
    expect(clearanceBaseline(curveObstacleBand([curve()], window(), frame), 'below', ink, rule))
      .toBe(clearanceBaseline(null, 'below', ink, rule))
  })
})
