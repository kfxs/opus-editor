import { describe, it, expect } from 'vitest'
import { slurArchClearance, slurObstacleMarginPx, type SlurObstacle } from './slurObstacles'
import { CURVE_PX, SLUR_OBSTACLE_MAX_LIFT_RATIO } from './curveStyle'
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

  // ── The margin is MuseScore's length law now, not a flat quarter space (2026-08-17). Its two
  //    bounds are the number a reader looks for; the ratio is what puts a slur between them.
  it('leaves the bounds where a reader can find them', () => {
    expect(CURVE_PX.slurObstacleMarginMin).toBeCloseTo(0.1 * SP, 10)
    expect(CURVE_PX.slurObstacleMarginMax).toBeCloseTo(0.5 * SP, 10)
  })

  it('the margin grows with the span, floored and capped', () => {
    expect(slurObstacleMarginPx(1 * SP)).toBeCloseTo(0.1 * SP, 10)    // 0.04 sp → the floor
    expect(slurObstacleMarginPx(5 * SP)).toBeCloseTo(0.2 * SP, 10)    // 0.04 × 5 sp, in the middle
    expect(slurObstacleMarginPx(12.5 * SP)).toBeCloseTo(0.5 * SP, 10) // exactly at the cap
    expect(slurObstacleMarginPx(40 * SP)).toBeCloseTo(0.5 * SP, 10)   // …and stays there
  })

  it('a NEGATIVE span (a right-to-left pair) asks for the same margin', () => {
    // The caller passes `p1.x - p0.x`; nothing guarantees the sign, and a signed margin would be
    // subtracted from the obstacle instead of added to it.
    expect(slurObstacleMarginPx(-5 * SP)).toBeCloseTo(slurObstacleMarginPx(5 * SP), 10)
  })

  it('🚨 asks for NOTHING from an obstacle its own endpoint sits on — the curve is pinned there', () => {
    // His report, 2026-08-18: a slur whose start had been walked onto the next notehead drew a
    // near-vertical stroke instead of an arc. Cause: both Bézier weights vanish toward an endpoint,
    // so the least-movement solution diverges like 1/(3t) and the solver demanded a 354 px lift for
    // a box the same slur clears with 3 px mid-span. A cubic MUST pass through its endpoint, so
    // there is no lift that clears anything there — the honest answer is to leave it uncleared.
    const onTheEndpoint = slurArchClearance(p0, p1, ARCH, ABOVE, [head(0.1 * SP, -3 * SP)])
    expect(onTheEndpoint).toEqual({ c0: 0, c1: 0 })
    // …and the mirror at the far end, which the same bound covers without naming it.
    expect(slurArchClearance(p0, p1, ARCH, ABOVE, [head(9.9 * SP, -3 * SP)])).toEqual({ c0: 0, c1: 0 })
  })

  it('⭐ …while an obstacle the curve CAN act on is still cleared, and by no more than the bound', () => {
    // The point of the bound is that it only bites where the arithmetic was diverging. A head at a
    // quarter of the span is ordinary music under an ordinary slur and must still be lifted over.
    const { c0, c1 } = slurArchClearance(p0, p1, ARCH, ABOVE, [head(2.5 * SP, -3 * SP)])
    expect(c0).toBeGreaterThan(0)
    expect(c1).toBeGreaterThan(0)
    // ⚠️ A ceiling, not an equality: `deficit` is measured off the worst sample in the box, so the
    // claim is that the answer stays in the same order as the gap it closes, not a fixed multiple.
    expect(c0).toBeLessThan(SLUR_OBSTACLE_MAX_LIFT_RATIO * 4 * SP)
  })

  it('⭐ a LONG slur clears an interior stem by more than a short one does', () => {
    // His report, 2026-08-17: a 15.6 sp slur cleared an interior stem by 0.243 sp and read as
    // touching it. Same obstacle, same arch, two spans — the long one must ask for more.
    // ⚠️ The obstacle sits at the MIDPOINT of each span, so the two controls have equal say in both
    // and the only difference left is the margin — 0.24 sp for the short one, the 0.5 sp cap for the
    // long. Put it at a fixed x instead and the comparison measures Bézier weights, not clearance.
    const box = (x: number) => ({ x: x - 0.5 * SP, y: -3 * SP, width: SP, height: SP })
    const shortSpan = slurArchClearance({ x: 0, y: 0 }, { x: 6 * SP, y: 0 }, ARCH, ABOVE, [box(3 * SP)])
    const longSpan = slurArchClearance({ x: 0, y: 0 }, { x: 20 * SP, y: 0 }, ARCH, ABOVE, [box(10 * SP)])
    // ⛔ The ORDERING is all this can claim. The difference is not the margin difference divided by
    // 0.75: the worst sample is the one at the box's EDGE, and a 1 sp box covers a wider stretch of
    // a short span's curve than of a long one's, so the two deficits differ for a second reason too.
    expect(longSpan.c1).toBeGreaterThan(shortSpan.c1)
  })
})
