import { describe, it, expect } from 'vitest'
import { CURVE, CURVE_PX, SLUR_HEIGHT_RATIO, curvePx } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ **THE ZERO-CHANGE PROOF.** `curveStyle` moved the slur/tie geometry out of pixels and into
 * staff spaces (docs/slur-plan.md §12.0 #8). The whole claim of that move is that it changed no
 * drawn ink, so this spec pins every derived pixel against the literal it replaced — the values that
 * stood in `SlurRenderer`, `TieRenderer` and `curveArc` before the move.
 *
 * ⚠️ A failure here is not a rounding problem: it means a curve's LOOK changed under a commit that
 * said it was hygiene. Phases 2/4/6 of §12 change these deliberately — and when one of them lands,
 * the row it changes is updated here WITH the phase named, not silently relaxed.
 */
describe('curveStyle — the staff-space table', () => {
  it('derives exactly the pixel literals it replaced', () => {
    // ⚠️ Not every row has a predecessor: `slurStemOvershoot` arrived WITH §12 Phase 1 and replaced
    // nothing, so it is absent here by design rather than by omission.
    const before: Partial<Record<keyof typeof CURVE, number>> = {
      slurLift: 10,     // SlurRenderer.SLUR_LIFT
      slurArc: 14,      // SlurRenderer.SLUR_ARC
      slurNestGap: 10,  // SlurRenderer.SLUR_NEST_GAP
      tieLift: 7,       // TieRenderer.TIE_LIFT
      tieBow: 5.3,      // TieRenderer.TIE_BOW
      thickness: 2.7,   // curveArc.CURVE_THICKNESS
      outline: 1,       // curveArc.CURVE_OUTLINE
    }
    for (const [key, px] of Object.entries(before)) {
      expect(CURVE_PX[key as keyof typeof CURVE]).toBeCloseTo(px, 10)
    }
  })

  it('states the published numbers in the unit they are published in', () => {
    // Bravura engravingDefaults: slurEndpointThickness 0.10 — the tip IS the outline, where the
    // curve's two passes meet (§13.6).
    expect(CURVE.outline).toBe(0.10)
    // §13.3: 0.70 sp from the notehead CENTRE is 0.20 clear of its edge — MuseScore's number, and
    // Gould's "should almost touch each notehead". His call: settled.
    expect(CURVE.tieLift).toBe(0.70)
    // §13.1, his call: the tie's drawn apex is 0.75 × the control rise = 0.40 sp, at every width.
    expect(CURVE.tieBow * 0.75).toBeCloseTo(0.40, 2)
  })

  it('leaves the height ratio dimensionless — no conversion, no px twin', () => {
    // LilyPond's `ratio` for the Slur grob (`define-grobs.scm:3181`). ⚠️ 0.333 is the PHRASING
    // slur's and the tie's — three grobs, three pairs (`./slurArchHeight`).
    expect(SLUR_HEIGHT_RATIO).toBe(0.25)
    expect(CURVE_PX).not.toHaveProperty('slurHeightRatio')
  })

  it('⭐ carries the retired law\'s replacement, not the law itself', () => {
    // §12 Phase 2 (his call, option b) swapped a floor + slope + cap for LilyPond's saturation, so
    // `slurBow` / `slurBowMax` / `SLUR_BOW_PER_SPAN` went WITH the law that used them. What is left
    // is the pair LilyPond states, and the px twin is derived like every other row.
    expect(CURVE.slurHeightLimit).toBe(2.0)
    expect(CURVE_PX.slurHeightLimit).toBeCloseTo(20, 10)
    expect(CURVE).not.toHaveProperty('slurBow')
  })

  it('converts against the score staff space, not a stave', () => {
    expect(curvePx(1)).toBe(STAFF_SPACE_PX)
    expect(curvePx(CURVE.thickness)).toBeCloseTo(CURVE_PX.thickness, 10)
  })
})
