/**
 * {@link drawnFontSize} — **a glyph size is in POINTS and is drawn in PIXELS**.
 *
 * ⭐ The one claim worth a test is the factor itself, and where it comes from: it is VexFlow's, not
 * ours (`Font.scaleToPxFrom.pt = 4/3`), so the day that library changes its mind this is what says
 * so. ⛔ The ink RATIOS are not tested here — they are measured in the browser, and their own files
 * carry the numbers.
 */
import { describe, it, expect } from 'vitest'
import { Font } from 'vexflow'
import { drawnFontPx, inkSpaces } from './drawnFontSize'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

describe('drawnFontPx', () => {
  it('⭐⭐ a bare size handed to `setFont` is POINTS — 26 draws at 34.67 px', () => {
    expect(drawnFontPx(26)).toBeCloseTo(34.667, 3)
  })

  it('🚨 …and the factor is VEXFLOW’s own, read from it rather than restated', () => {
    // The whole bug in one line: every ink table here multiplied a ratio by the bare size and called
    // the answer pixels, which under-modelled every outside-staff mark by a quarter (2026-08-21).
    expect(drawnFontPx(30)).toBeCloseTo(Font.convertSizeToPixelValue(30), 6)
  })

  it('0 stays 0 — nothing drawn is nothing tall', () => {
    expect(drawnFontPx(0)).toBe(0)
  })
})

describe('inkSpaces', () => {
  it('⭐ turns a size and a ratio into STAFF SPACES', () => {
    // The pedal's own numbers: 26 pt at 0.52 of the glyph = 1.803 spaces, where reading the 26 as
    // pixels said 1.352 — and the 0.45 of difference is more than the 0.6 of padding the ladder
    // leaves, which is why an `f` and a `Ped.` met on his page.
    expect(inkSpaces(26, 0.52)).toBeCloseTo(1.803, 3)
    expect((26 * 0.52) / STAFF_SPACE_PX).toBeCloseTo(1.352, 3)
  })

  it('scales with the staff-space constant, not with a hard-coded 10', () => {
    expect(inkSpaces(STAFF_SPACE_PX, 3 / 4)).toBeCloseTo(1, 6)
  })
})
