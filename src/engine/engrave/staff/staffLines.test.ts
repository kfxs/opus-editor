/**
 * Subject: `./staffLines` — the staff's own five lines, as ink (P5a).
 *
 * ⭐⭐ Since 2026-09-24 (his call, cue-size-plan §3 P3) a staff line is CENTRED on its own y, at every thickness —
 * the y a notehead and a ledger line are centred on too, and what LilyPond (`Lookup::horizontal_line`, ±th/2),
 * MuseScore and Verovio (a pen stroke on the line) all draw. It used to hang DOWN from it (`[y, y + t]`,
 * VexFlow's crispness idiom), which left every note half a line's thickness above the middle of its line or
 * space — a cue or grace head showed it.
 */
import { describe, it, expect } from 'vitest'
import {
  staveLineWidthPx, staffLineInkBottomY, staffLineInkTopY, staffLineMidY, staffLineStrokeY, staffLinesInk,
} from './staffLines'

/** VexFlow's own correction, transcribed here ONLY so the change away from it can be asserted. */
const halfPixelCorrection = (lineWidth: number) => (lineWidth % 2 === 0 ? 0 : 0.5)

describe('one line per y', () => {
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

describe('⭐⭐ a staff line is CENTRED on its own y — [y − t/2, y + t/2]', () => {
  it('its stroke is ON the y, at every thickness', () => {
    for (const t of [1, 1.3, 2, staveLineWidthPx()]) expect(staffLineStrokeY(40, t), `t=${t}`).toBe(40)
  })

  it('its middle is the y; its edges are half a thickness either side', () => {
    for (const t of [1, 1.3, 2, staveLineWidthPx()]) {
      expect(staffLineMidY(40, t)).toBe(40)
      expect(staffLineInkTopY(40, t)).toBeCloseTo(40 - t / 2, 10)
      expect(staffLineInkBottomY(40, t)).toBeCloseTo(40 + t / 2, 10)
    }
  })

  it('⭐ a stroke there covers exactly the bar the edges name (what the filled tail draws)', () => {
    for (const t of [1, 1.3, 2]) {
      const y = staffLineStrokeY(40, t)
      expect(y - t / 2).toBeCloseTo(staffLineInkTopY(40, t), 10)
      expect(y + t / 2).toBeCloseTo(staffLineInkBottomY(40, t), 10)
    }
  })
})

describe('🚨 the change of 2026-09-24 — VexFlow’s half-pixel is gone', () => {
  it('⛔ not VexFlow’s `y + 0.5` (its crispness idiom), even at thickness 1 where the old rule agreed with it', () => {
    expect(staffLineStrokeY(40, 1)).not.toBeCloseTo(40 + halfPixelCorrection(1), 6)
    expect(staffLineStrokeY(40, staveLineWidthPx())).not.toBeCloseTo(40 + halfPixelCorrection(staveLineWidthPx()), 6)
  })
})
