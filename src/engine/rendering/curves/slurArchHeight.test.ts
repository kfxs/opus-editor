import { describe, it, expect } from 'vitest'
import { archLean, slurArchHeight, slurArchHeightFor } from './slurArchHeight'
import { SLUR_ARCH_TILT, SLUR_ARCH_TILT_LIMIT } from './curveStyle'
import { CURVE, curvePx } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
/** A cubic's peak deviation is 0.75 × its control height — the conversion every engine comparison
 *  in docs/plans/slur-plan.md §11.3 and §12 Phase 2 is stated in. */
const apex = (spanSpaces: number) => (slurArchHeight(spanSpaces * SP) * 0.75) / SP

describe('slurArchHeight — LilyPond\'s law, his call of 2026-08-16', () => {
  it('⭐⭐ lands on LilyPond\'s own column of §12 Phase 2\'s table, at every span', () => {
    // ⭐ These five rows ARE that column, and they were computed by an agent reading LilyPond's C++
    // before this law was ported — so this spec is a cross-check of the port against an independent
    // reading, not a restatement of it. The five OLD numbers (0.81 / 0.88 / 1.18 / 1.51 / 1.65) are
    // what we drew until today; §12 Phase 2 keeps them.
    expect(apex(2.4)).toBeCloseTo(0.42, 2)
    expect(apex(4)).toBeCloseTo(0.64, 2)
    expect(apex(10.8)).toBeCloseTo(1.08, 2)
    expect(apex(18)).toBeCloseTo(1.24, 2)
    expect(apex(25.2)).toBeCloseTo(1.31, 2)
  })

  it('⭐ rises without ever reaching the limit — Gould p. 109 flattens a long slur, and this law is why', () => {
    expect(apex(4)).toBeGreaterThan(apex(2.4))
    expect(apex(25.2)).toBeGreaterThan(apex(10.8))
    // A 100 sp slur is still short of the ceiling: a saturation, not a cap. The old law hit its 2.2
    // wall at an 18 sp span and drew every longer slur identically.
    expect(slurArchHeight(100 * SP)).toBeLessThan(curvePx(CURVE.slurHeightLimit))
    expect(apex(100)).toBeGreaterThan(apex(25.2))
  })

  it('⛔ has NO floor — a very short slur is very flat, which is the whole point of the change', () => {
    expect(slurArchHeight(0)).toBe(0)
    expect(apex(1)).toBeLessThan(0.2)
  })

  it('adds the nesting lift on top — an outer slur must clear the one inside it', () => {
    const lift = 2 * SP
    expect(slurArchHeight(0, lift)).toBe(lift)
    expect(slurArchHeight(40, lift)).toBeCloseTo(slurArchHeight(40) + lift, 6)
  })

  it('reads a negative span as a length', () => {
    // Cross-system segments hand it edges that can arrive in either order.
    expect(slurArchHeight(-40)).toBe(slurArchHeight(40))
  })
})

describe('archLean — the lean is bounded by the arch it leans', () => {
  it('🚨🚨 cannot push a control through the chord line — his "b3 a4 slur looks odd not that curvy"', () => {
    // ⭐ HIS BAR, measured: span 24 px, `dy` −30, arch 5.607. The raw tilt is 0.25 × 30 = 7.50,
    //    which is MORE than the whole arch — so the first control landed at 5.607 − 7.50 = −1.89,
    //    on the wrong side of its own endpoint, and the slur drew as a bent stick.
    const arch = 5.607
    expect(SLUR_ARCH_TILT * -30 * 1, 'the raw tilt, for the record').toBeCloseTo(-7.5, 3)
    const lean = archLean(-30, 1, arch)
    expect(arch + lean, 'the near control keeps its side of the line').toBeGreaterThan(0)
    expect(lean).toBeCloseTo(-arch * SLUR_ARCH_TILT_LIMIT, 6)
  })

  it('⭐ leaves an ordinary lean alone — this is a bound, ⛔ not a new shape', () => {
    // A gentle 4 px rise under a 10 px arch: 0.25 × 4 = 1.0, nowhere near the 0.693 × 10 limit.
    expect(archLean(4, 1, 10)).toBeCloseTo(1, 6)
  })

  it('⭐ …and it is symmetric, because a slur may lean either way', () => {
    expect(archLean(-40, 1, 6)).toBeCloseTo(-archLean(40, 1, 6), 6)
    expect(archLean(-40, 1, 6)).toBeCloseTo(-6 * SLUR_ARCH_TILT_LIMIT, 6)
  })

  it('⭐ the DIRECTION flips it, which is what keeps a slur above and one below symmetric', () => {
    expect(archLean(30, -1, 6)).toBeCloseTo(-archLean(30, 1, 6), 6)
  })

  it('⛔ a taller arch tolerates more lean — the bound is a proportion, not a distance', () => {
    expect(archLean(-30, 1, 20)).toBeCloseTo(-7.5, 6) // 0.693 × 20 = 13.9, so the raw tilt survives
  })
})

describe('slurArchHeightFor — the law takes the CHORD, not the horizontal span', () => {
  it('🚨 a steep slur is taller than its span alone would make it — LilyPond’s own input', () => {
    // His `B3 → A4`: 24 px across, 30 px down. The chord is 38.4 px, and `slur-configuration.cc:147`
    // feeds `dz.length()`. Measured: 5.61 px from the span, 8.23 from the chord.
    const p0 = { x: 0, y: 30 }, p1 = { x: 24, y: 0 }
    expect(slurArchHeight(24)).toBeCloseTo(5.61, 2)
    expect(slurArchHeightFor(p0, p1)).toBeCloseTo(8.23, 2)
  })

  it('⭐ …and a LEVEL slur is untouched, because there the two inputs are the same number', () => {
    const p0 = { x: 0, y: 40 }, p1 = { x: 100, y: 40 }
    expect(slurArchHeightFor(p0, p1)).toBeCloseTo(slurArchHeight(100), 9)
  })

  it('⭐ the nest lift rides on top, exactly as it does on the span form', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 60, y: 0 }
    expect(slurArchHeightFor(p0, p1, 7)).toBeCloseTo(slurArchHeight(60) + 7, 9)
  })
})
