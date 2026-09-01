/**
 * Subject: `./staffLines` — the staff's own five lines, as ink (P5a).
 *
 * ⭐ The case that matters is the last one: the two owners of this ink used different primitives and
 * agreed only because the thickness is 1. This spec pins BOTH halves of that — the agreement today,
 * and the divergence VexFlow's own correction would produce the moment the thickness changes.
 */
import { describe, it, expect } from 'vitest'
import {
  STAVE_LINE_WIDTH_PX, staffLineStrokeY, staffLinesInk,
} from './staffLines'

/** VexFlow's own correction, transcribed here ONLY so the divergence can be asserted against it. */
const vexflowCorrection = (lineWidth: number) => (lineWidth % 2 === 0 ? 0 : 0.5)

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

describe("🚨 …and VexFlow's correction only agrees at thickness 1", () => {
  it('⭐ agrees at the thickness we ship, which is why P5a moves no pixel', () => {
    expect(STAVE_LINE_WIDTH_PX).toBe(1)
    expect(staffLineStrokeY(40, STAVE_LINE_WIDTH_PX))
      .toBe(40 + vexflowCorrection(STAVE_LINE_WIDTH_PX))
  })

  it('🚨 …and DIVERGES at SMuFL’s 0.13 sp — the bug that was waiting for the thickness to change', () => {
    const smufl = 0.13 * 10 // staffLineThickness × STAFF_SPACE_PX
    expect(staffLineStrokeY(40, smufl)).not.toBeCloseTo(40 + vexflowCorrection(smufl), 6)
    // VexFlow would have put the ink on [39.85, 41.15]; the rule puts it on [40, 41.3].
    expect(40 + vexflowCorrection(smufl) - smufl / 2).toBeCloseTo(39.85, 10)
    expect(staffLineStrokeY(40, smufl) - smufl / 2).toBeCloseTo(40, 10)
  })
})
