import { describe, it, expect } from 'vitest'
import { slurArchClearance, type SlurObstacle } from './slurObstacles'
import { CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
const ABOVE = -1
const BELOW = 1
/** A notehead-sized box centred on (x, y). */
const head = (x: number, y: number): SlurObstacle =>
  ({ x: x - 0.6 * SP, y: y - 0.5 * SP, width: 1.2 * SP, height: SP })

// A flat slur above, spanning 10 spaces at y = 0, with a 1.4 sp arch (its apex sits 1.05 above).
const p0 = { x: 0, y: 0 }
const p1 = { x: 10 * SP, y: 0 }
const ARCH = 1.4 * SP

describe('slurArchClearance — Verovio\'s single pass (§12 Phase 8)', () => {
  it('asks for nothing when the music is below the curve', () => {
    expect(slurArchClearance(p0, p1, ARCH, ABOVE, [head(5 * SP, 2 * SP)])).toEqual({ c0: 0, c1: 0 })
  })

  it('⭐ raises the arch over a note poking through it, by Verovio\'s constraint', () => {
    // A head 3 spaces above the endpoint line, at the midpoint where the curve reaches only 1.05.
    const { c0, c1 } = slurArchClearance(p0, p1, ARCH, ABOVE, [head(5 * SP, -3 * SP)])
    // At the MIDDLE the two controls have equal say, so the pair collapses to the old symmetric
    // answer. ⚠️ Slightly MORE than the centre-only arithmetic ((3.5 + 0.25 − 1.05)/0.75 = 3.6),
    // because the whole box has to clear and the curve is lowest at its EDGE, not its centre.
    expect(c1).toBeCloseTo(c0, 6)
    expect(c0 / SP).toBeGreaterThan((3.5 + 0.25 - 1.05) / 0.75)
    expect(c0 / SP).toBeLessThan(4.3)
  })

  it('⭐⭐ puts the lift where the obstacle is — his figure, at four fifths of the span', () => {
    // At t ≈ 0.64 the second control has 1.8× the say of the first, so it takes 1.8× the lift. That
    // ratio is what he arrived at by dragging the curve himself (§12 Phase 8).
    const { c0, c1 } = slurArchClearance(p0, p1, ARCH, ABOVE, [head(6.4 * SP, -3 * SP)])
    expect(c1).toBeGreaterThan(c0)
    // 1.78 at the box's centre; the worst sample inside the box shifts it a little.
    expect(c1 / c0).toBeGreaterThan(1.4)
    expect(c1 / c0).toBeLessThan(2.1)
  })

  it('⭐ …and the raised arch then clears it — one pass is enough', () => {
    const box = head(6.4 * SP, -3 * SP)
    const lift = slurArchClearance(p0, p1, ARCH, ABOVE, [box])
    // Feed the answer back in: with those two lifts applied, nothing is left to do. ⭐ This is the
    // property that makes ONE pass enough — an iterating solver would stop here too.
    const again = slurArchClearance(p0, p1, ARCH, ABOVE, [box], lift)
    expect(again.c0).toBeCloseTo(0, 6)
    expect(again.c1).toBeCloseTo(0, 6)
  })

  it('takes the componentwise MAX across obstacles, which is what makes one pass safe', () => {
    const early = head(2.5 * SP, -2.5 * SP)   // asks more of the FIRST control
    const late = head(7.5 * SP, -2.5 * SP)    // …and more of the second
    const both = slurArchClearance(p0, p1, ARCH, ABOVE, [early, late])
    const a = slurArchClearance(p0, p1, ARCH, ABOVE, [early])
    const b = slurArchClearance(p0, p1, ARCH, ABOVE, [late])
    expect(both.c0).toBeCloseTo(Math.max(a.c0, b.c0), 6)
    expect(both.c1).toBeCloseTo(Math.max(a.c1, b.c1), 6)
    expect(a.c0).toBeGreaterThan(a.c1)
    expect(b.c1).toBeGreaterThan(b.c0)
  })

  it('⛔ ignores anything outside the span — a slur owes nothing to notes it does not cover', () => {
    expect(slurArchClearance(p0, p1, ARCH, ABOVE, [head(-2 * SP, -5 * SP)])).toEqual({ c0: 0, c1: 0 })
    expect(slurArchClearance(p0, p1, ARCH, ABOVE, [head(12 * SP, -5 * SP)])).toEqual({ c0: 0, c1: 0 })
  })

  it('mirrors below the staff', () => {
    const above = slurArchClearance(p0, p1, ARCH, ABOVE, [head(5 * SP, -3 * SP)])
    const below = slurArchClearance(p0, p1, ARCH, BELOW, [head(5 * SP, 3 * SP)])
    expect(below.c0).toBeCloseTo(above.c0, 6)
    expect(below.c1).toBeCloseTo(above.c1, 6)
  })

  it('leaves the margin where a reader can find it', () => {
    expect(CURVE_PX.slurObstacleMargin).toBeCloseTo(0.25 * SP, 10)
  })
})
