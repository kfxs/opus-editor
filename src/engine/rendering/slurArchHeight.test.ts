import { describe, it, expect } from 'vitest'
import { slurArchHeight } from './slurArchHeight'
import { CURVE, curvePx } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
/** A cubic's peak deviation is 0.75 × its control height — the conversion every engine comparison
 *  in docs/slur-plan.md §11.3 and §12 Phase 2 is stated in. */
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
