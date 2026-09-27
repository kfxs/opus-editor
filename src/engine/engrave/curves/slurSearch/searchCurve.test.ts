/** One candidate's curve (`./searchCurve`) — LilyPond's `generate_curve`, in LilyPond's space (staff spaces, y up). */
import { describe, it, expect } from 'vitest'
import { avoidStaffLine, fitFactor, generateCurve, slurHeight, slurIndentHeight } from './searchCurve'
import { type Bezier, curvePoint, otherCoordinate } from './bezier'
import { LILYPOND_SLUR_DETAILS } from './searchDetails'
import type { SlurSearchState } from './searchState'

const STAFF = { middleY: 0, linePositions: [-4, -2, 0, 2, 4] }
const HEAD = { x: [0, 1.18] as const, y: [-0.5, 0.5] as const }
const state = (avoid: SlurSearchState['avoid'] = [], dir = 1): SlurSearchState => ({
  dir, details: LILYPOND_SLUR_DETAILS, baseAttachments: [] as never,
  // Both ends on a note of this staff — `avoid_staff_line` runs only then.
  bounds: [{ slurHead: HEAD }, { slurHead: HEAD }],
  encompassInfos: [], extraInfos: [], avoid, tieEnds: [], staff: STAFF, musicalDy: 0, isBroken: false, edgeHasBeams: false,
  thickness: 0.12, lineThickness: 0.1, attachments: [],
})

describe('slurHeight / slurIndentHeight — `bezier-bow.cc`', () => {
  it('⭐ rises like r₀·w for short slurs and saturates at h_inf', () => {
    expect(slurHeight(0.4, 2, 0.25)).toBeCloseTo(0.1, 2)
    expect(slurHeight(4, 2, 0.25)).toBeCloseTo(0.8477, 4)
    expect(slurHeight(1e6, 2, 0.25)).toBeCloseTo(2, 3)
  })

  it('the indent starts at w/3.1 and grows toward 2·h_inf', () => {
    expect(slurIndentHeight(0.01, 2, 0.25).indent).toBeCloseTo(0.01 / 3.1, 4)
    expect(slurIndentHeight(1e6, 2, 0.25).indent).toBeCloseTo(4, 3)
  })
})

describe('fitFactor', () => {
  // A flat chord along x from 0 to 10, arched up to 1.
  const curve: Bezier = [{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: 7, y: 1 }, { x: 10, y: 0 }]
  const args = [{ x: 1, y: 0 }, { x: 0, y: 1 }, 2.5, curve, 1] as const

  it('⭐ an avoid-point in the middle, twice the curve\'s height there, asks for ×2', () => {
    expect(fitFactor(...args, [{ x: 5, y: 1.5 }])).toBeCloseTo(2, 9)
  })

  it('⭐ …but one within `close-to-edge-length` of an end asks for nothing — the ENDS answer it', () => {
    expect(fitFactor(...args, [{ x: 2, y: 5 }])).toBe(0)
    expect(fitFactor(...args, [{ x: 8, y: 5 }])).toBe(0)
  })

  it('below the slur, the factor is read in the slur\'s own frame (dir −1)', () => {
    const down: Bezier = curve.map(p => ({ x: p.x, y: -p.y })) as unknown as Bezier
    expect(fitFactor({ x: 1, y: 0 }, { x: 0, y: 1 }, 2.5, down, -1, [{ x: 5, y: -1.5 }])).toBeCloseTo(2, 9)
  })
})

describe('avoidStaffLine', () => {
  it('⭐ a turning point ON a staff line is moved off it, outward', () => {
    // Apex at y = 1 — the second line above the middle one.
    const onLine: Bezier = [{ x: 0, y: 0 }, { x: 3, y: 4 / 3 }, { x: 7, y: 4 / 3 }, { x: 10, y: 0 }]
    expect(curvePoint(onLine, 0.5).y).toBeCloseTo(1, 12)
    const moved = avoidStaffLine(state(), onLine)
    // It goes DOWN when exactly on the line (`distance > 0 ? UP : DOWN`, distance 0) by the minimum.
    const apex = curvePoint(moved, 0.5).y
    expect(Math.abs(apex - 1)).toBeCloseTo(0.5 * 0.12 * 0.75 + 0.1 + 0.1, 9)
  })

  it('⚠️ an apex EXACTLY on a line goes DOWN — LilyPond\'s `distance > 0 ? UP : DOWN`, kept', () => {
    const onTop: Bezier = [{ x: 0, y: 0 }, { x: 3, y: 8 / 3 }, { x: 7, y: 8 / 3 }, { x: 10, y: 0 }]
    expect(curvePoint(avoidStaffLine(state(), onTop), 0.5).y).toBeLessThan(2)
  })

  it('a turning point in a space is left alone', () => {
    const inSpace: Bezier = [{ x: 0, y: 0 }, { x: 3, y: 2 / 3 }, { x: 7, y: 2 / 3 }, { x: 10, y: 0 }]
    expect(avoidStaffLine(state(), inSpace)).toBe(inSpace)
  })
})

describe('generateCurve', () => {
  it('⭐ with nothing to avoid, the arch is LilyPond\'s height, perpendicular to the chord', () => {
    // Ends at −0.25: the apex (≈ 0.71) sits in a space, so `avoid_staff_line` leaves it be.
    const { curve, height } = generateCurve(state(), [{ x: 0, y: -0.25 }, { x: 8, y: -0.25 }])
    expect(height).toBeCloseTo(slurHeight(8, 2, 0.25), 12)
    expect(curve[1].y).toBeCloseTo(-0.25 + height, 12)
    expect(curve[2].y).toBeCloseTo(-0.25 + height, 12)
  })

  it('⭐ raises the arch over a middle avoid-point, capped at max_h', () => {
    const plain = generateCurve(state(), [{ x: 0, y: 0.25 }, { x: 8, y: 0.25 }])
    // 1.6 is in the top space, so the raised apex is not then pulled off a line.
    const over = generateCurve(state([{ x: 4, y: 1.6 }]), [{ x: 0, y: 0.25 }, { x: 8, y: 0.25 }])
    expect(over.height).toBeGreaterThan(plain.height)
    expect(otherCoordinate(over.curve, 'x', 4)).toBeCloseTo(1.6, 9)
    const huge = generateCurve(state([{ x: 4, y: 100 }]), [{ x: 0, y: 0.25 }, { x: 8, y: 0.25 }])
    expect(huge.height).toBeLessThan(8)
  })
})
