/**
 * Subject: `./staffLines` — the staff's own five lines, as ink (P5a).
 *
 * ⭐ The case that matters is the last one: the two owners of this ink used different primitives and
 * agreed only because the thickness is 1. This spec pins BOTH halves of that — the agreement today,
 * and the divergence VexFlow's own correction would produce the moment the thickness changes.
 */
import { describe, it, expect } from 'vitest'
import {
  staveLineWidthPx, staffLineStrokeY, staffLinesInk,
} from './staffLines'

/** VexFlow's own correction, transcribed here ONLY so the divergence can be asserted against it. */
const halfPixelCorrection = (lineWidth: number) => (lineWidth % 2 === 0 ? 0 : 0.5)

describe('a staff line hangs DOWNWARD from its own y', () => {
  it('one line per y, at the stave’s x and width', () => {
    const ink = staffLinesInk(10, 400, [0, 10, 20], 1)
    expect(ink).toEqual([
      { x: 10, y: 0, width: 400, thickness: 1 },
      { x: 10, y: 10, width: 400, thickness: 1 },
      { x: 10, y: 20, width: 400, thickness: 1 },
    ])
  })

  it('⛔ an invisible line is simply absent — the caller filters, this does not', () => {
    expect(staffLinesInk(0, 100, [], 1)).toEqual([])
  })
})

describe('⭐⭐ the stroke lands the ink on [y, y + thickness]', () => {
  it('strokes through the middle of the bar', () => {
    expect(staffLineStrokeY(40, 1)).toBe(40.5)
    expect(staffLineStrokeY(40, 1.3)).toBeCloseTo(40.65, 10)
    expect(staffLineStrokeY(40, 2)).toBe(41)
  })

  it('⭐ a stroke there covers exactly what a fillRect at y covers', () => {
    for (const t of [1, 1.3, 2, 0.13 * 10]) {
      const y = staffLineStrokeY(40, t)
      expect(y - t / 2, `top of the ink at t=${t}`).toBeCloseTo(40, 10)
      expect(y + t / 2, `bottom of the ink at t=${t}`).toBeCloseTo(40 + t, 10)
    }
  })
})

describe("🚨 …and VexFlow's correction only ever agreed at thickness 1", () => {
  /**
   * ⭐⭐ **THE PREDICTION CAME TRUE, and this spec is the record of it.** P5a wrote that the two
   * owners of a staff line agreed *"only because the thickness is exactly 1"* and that the day it
   * changed they would come apart. On **2026-09-01 he chose Gould's 0.11 sp** (decision A) and they
   * did — so the module's own rule is now the only thing keeping the ink where it belongs.
   */
  it('🚨 at the thickness we NOW ship, the two no longer agree', () => {
    expect(staveLineWidthPx()).toBeCloseTo(1.1, 10)
    expect(staffLineStrokeY(40, staveLineWidthPx()))
      .not.toBeCloseTo(40 + halfPixelCorrection(staveLineWidthPx()), 6)
  })

  it('⭐ …and OURS is the one that puts the ink on [y, y + thickness]', () => {
    const t = staveLineWidthPx()
    // VexFlow's correction is a flat 0.5 for any odd width, so it would hang the ink 0.05 px high.
    expect(40 + halfPixelCorrection(t) - t / 2).toBeCloseTo(39.95, 10)
    expect(staffLineStrokeY(40, t) - t / 2).toBeCloseTo(40, 10)
  })

  it('🚨 …and it would have diverged at Bravura’s 0.13 too — the value we did NOT pick', () => {
    const bravura = 0.13 * 10
    expect(staffLineStrokeY(40, bravura)).not.toBeCloseTo(40 + halfPixelCorrection(bravura), 6)
    expect(40 + halfPixelCorrection(bravura) - bravura / 2).toBeCloseTo(39.85, 10)
    expect(staffLineStrokeY(40, bravura) - bravura / 2).toBeCloseTo(40, 10)
  })
})
