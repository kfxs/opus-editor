/**
 * ⭐⭐ **ONE FACTOR OVER THE WHOLE ARCH** — LilyPond's `fit_factor`, adopted 2026-09-14 in place of
 * Verovio's two-control solve (`docs/research/slur-tie-research.md` §8; the module header has the why).
 *
 * 🚨 **The property these specs exist for is the RATIO.** His report was not that the slur was too
 * tall — it was that it was BENT: *"they should not change the slur angle but move it up a little"*.
 * A scale applied to both control heights cannot change their ratio, and that is asserted directly.
 */
import { describe, it, expect } from 'vitest'
import { maxArchScale, slurArchFit, slurObstacleMarginPx, type SlurObstacle } from './slurObstacles'
import { CURVE_PX, SLUR_EDGE_DISCOUNT_SPACES } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
const ABOVE = -1
const BELOW = 1
/** A notehead-sized box centred on (x, y). */
const head = (x: number, y: number): SlurObstacle =>
  ({ x: x - 0.6 * SP, y: y - 0.5 * SP, width: 1.2 * SP, height: SP })

// A flat slur spanning 20 spaces at y = 0 — long enough that the 2.5 sp edge band leaves a middle.
const p0 = { x: 0, y: 0 }
const p1 = { x: 20 * SP, y: 0 }
const H0 = 1.8 * SP
const H1 = 1.0 * SP

/** The drawn curve's y at the parameter t, for the arch `(h0, h1)` scaled by `fit`. */
const curveY = (t: number, fit: number, direction = ABOVE) => {
  const span = p1.x - p0.x, mt = 1 - t
  const c0y = p0.y + H0 * fit * direction
  const c1y = p1.y + H1 * fit * direction
  return mt ** 3 * p0.y + 3 * mt * mt * t * c0y + 3 * mt * t * t * c1y + t ** 3 * p1.y + 0 * span
}

describe('the fit factor', () => {
  it('⭐ asks for nothing when the music is on the other side', () => {
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(10 * SP, 2 * SP)])).toBe(1)
  })

  it('⭐ …and nothing when the curve already clears it', () => {
    // ⚠️ Measured, not guessed: the apex sits 1.05 sp above the chord and the margin at this length
    //    is the full 0.75 sp (0.5 until 2026-09-21), so a box CLEARS only if its top edge is under
    //    0.30 sp. Centred at +0.5 sp its top is ON the chord, comfortably below.
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(10 * SP, 0.5 * SP)])).toBe(1)
  })

  it('⭐⭐ grows the arch when something stands in the way', () => {
    const fit = slurArchFit(p0, p1, H0, H1, ABOVE, [head(10 * SP, -3 * SP)])
    expect(fit).toBeGreaterThan(1)
  })

  it('⭐⭐ …and the grown arch actually CLEARS it, by the margin', () => {
    const box = head(10 * SP, -3 * SP)
    const fit = slurArchFit(p0, p1, H0, H1, ABOVE, [box])
    // t ≈ 0.5 is over the box's centre on a symmetric span.
    const clearedBy = box.y - curveY(0.5, fit)
    expect(clearedBy).toBeGreaterThan(slurObstacleMarginPx(p1.x - p0.x) * 0.9)
  })

  it('🚨🚨 THE PROPERTY — it is a SCALE, so the arch keeps its ratio', () => {
    const fit = slurArchFit(p0, p1, H0, H1, ABOVE, [head(10 * SP, -3 * SP)])
    expect(fit).toBeGreaterThan(1)
    // The caller multiplies BOTH control heights by this one number ⇒ the ratio is untouched.
    expect((H0 * fit) / (H1 * fit)).toBeCloseTo(H0 / H1, 12)
  })

  it('⭐ one factor for many obstacles — the WORST one, ⛔ not their sum', () => {
    const mild = head(8 * SP, -2 * SP)
    const worst = head(12 * SP, -3 * SP)
    const both = slurArchFit(p0, p1, H0, H1, ABOVE, [mild, worst])
    expect(both).toBe(Math.max(
      slurArchFit(p0, p1, H0, H1, ABOVE, [mild]),
      slurArchFit(p0, p1, H0, H1, ABOVE, [worst]),
    ))
  })

  it('⭐ BELOW is the mirror and answers the same number', () => {
    const above = slurArchFit(p0, p1, H0, H1, ABOVE, [head(10 * SP, -3 * SP)])
    const below = slurArchFit(p0, p1, H0, H1, BELOW, [head(10 * SP, 3 * SP)])
    expect(below).toBeCloseTo(above, 10)
  })

  it('⛔ ignores what lies outside the span', () => {
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(-2 * SP, -5 * SP)])).toBe(1)
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(22 * SP, -5 * SP)])).toBe(1)
  })
})

describe('🚨🚨 the EDGE DISCOUNT — what makes a uniform scale possible at all', () => {
  it('⛔ an obstacle inside the edge band is LEFT UNCLEARED, ⛔ not answered with a spike', () => {
    const justInside = head(1 * SP, -3 * SP)
    expect(SLUR_EDGE_DISCOUNT_SPACES).toBe(2.5)
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [justInside])).toBe(1)
  })

  it('⭐ …and the same box one band further in DOES count', () => {
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(4 * SP, -3 * SP)])).toBeGreaterThan(1)
  })

  it('🚨 the mirror at the far end', () => {
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(19 * SP, -3 * SP)])).toBe(1)
  })

  it('🚨🚨 his 2026-09-14 case: the driver sat 1.0 sp from the end and is now discounted', () => {
    // Five staccato sixteenths; the obstacle that bent the slur was the SECOND note's box, whose
    // left edge stood one staff space from the endpoint (measured, §8.1).
    expect(slurArchFit(p0, p1, H0, H1, ABOVE, [head(1.6 * SP, -3 * SP)])).toBe(1)
  })
})

describe('the cap — a spike is not a clearance', () => {
  it('⭐⭐ an impossible obstacle is refused rather than answered', () => {
    const wall: SlurObstacle = { x: 9 * SP, y: -40 * SP, width: 2 * SP, height: 39 * SP }
    const fit = slurArchFit(p0, p1, H0, H1, ABOVE, [wall])
    expect(fit).toBe(maxArchScale(p0, p1, H0, H1))
  })

  it('⭐ the cap is LilyPond’s `max_h` with our quarter-span inset — 0.2795 × the chord', () => {
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    expect(maxArchScale(p0, p1, H0, H1)).toBeCloseTo((0.2795 * len) / ((H0 + H1) / 2), 3)
  })

  it('⛔ never below 1 — a cap may not SHRINK an arch the laws chose', () => {
    expect(maxArchScale(p0, p1, 40 * SP, 40 * SP)).toBe(1)
    expect(maxArchScale(p0, p1, 0, 0)).toBe(1)
  })
})

describe('the margin it clears by', () => {
  it('⭐ grows with the slur’s length, between MuseScore’s two bounds', () => {
    expect(slurObstacleMarginPx(2 * SP)).toBe(CURVE_PX.slurObstacleMarginMin)
    expect(slurObstacleMarginPx(40 * SP)).toBe(CURVE_PX.slurObstacleMarginMax)
  })
})
