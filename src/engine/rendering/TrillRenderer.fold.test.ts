import { describe, it, expect } from 'vitest'
import { foldPastSystemEnd } from './TrillRenderer'
import type { SystemEdgeLookup } from './systemEdges'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'

/**
 * 🚨🚨 **THE FOLD** — a trill's ink pushed past the end of its line continues at the start of the
 * next one. His rule, 2026-08-20: *"no anchor to a note but offset in the next system"*.
 *
 * Subject: {@link TrillRenderer}'s `foldPastSystemEnd` — pure arithmetic over the last render's
 * system margins, which is why it can be a unit test at all (⚠️ nothing here draws a glyph:
 * `reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐ Why it exists: a trill's anchors are NOTES, so a passage of empty bars offers nothing to
 * re-anchor onto. The OFFSET is what carries the line — and past a line's end the offset has to be
 * re-expressed in the next line's coordinates, or the wiggle runs into the margin and off the sheet.
 */
function lookup(): SystemEdgeLookup {
  // line 0: bars 1-2, music 100…400. line 1: bars 3-4, music 100…500. line 2: bar 5, 100…300.
  const measureLayoutInfo = new Map<number, MeasureWidthInfo>()
  const measureBounds = new Map<number, MeasureBounds>()
  const bar = (num: number, line: number, noteStartX: number, noteEndX: number) => {
    measureLayoutInfo.set(num, { measureNumber: num, minWidth: 0, finalWidth: 0, lineNumber: line })
    measureBounds.set(num, { measureX: noteStartX - 20, measureY: 0, measureWidth: 0, noteStartX, noteEndX })
  }
  bar(1, 0, 100, 250); bar(2, 0, 260, 400)
  bar(3, 1, 100, 300); bar(4, 1, 310, 500)
  bar(5, 2, 100, 300)
  return { measureLayoutInfo, measureBounds }
}

describe('foldPastSystemEnd', () => {
  const pass = lookup()

  it('leaves ink that fits on its own line exactly where it is', () => {
    expect(foldPastSystemEnd(pass, 0, 390, 1)).toEqual({ line: 0, endX: 390 })
    expect(foldPastSystemEnd(pass, 0, 400, 1), 'the edge itself still fits').toEqual({ line: 0, endX: 400 })
  })

  it('⭐⭐ folds the OVERFLOW onto the next line, measured from ITS margin', () => {
    // 30 px past line 0's end (400) re-appears 30 px past line 1's start (100).
    expect(foldPastSystemEnd(pass, 0, 430, 1)).toEqual({ line: 1, endX: 130 })
  })

  it('⭐ folds again and again — one press may cross more than one line', () => {
    // 430 past line 0's end: 400 of it eats line 1 whole (100…500), leaving 30 on line 2.
    expect(foldPastSystemEnd(pass, 0, 830, 1)).toEqual({ line: 2, endX: 130 })
  })

  it('⛔ STOPS at the last line the render drew — there is nothing beyond it to fold onto', () => {
    // ⚠️ The overflow is left standing in the margin rather than clamped; `interactions/trillWalk`
    // is what refuses the press there, so the ink never gets here in the first place.
    expect(foldPastSystemEnd(pass, 2, 900, 1)).toEqual({ line: 2, endX: 900 })
  })

  it('🚨 converts the margins into the STAFF\'s own space — a small staff is a RATIO', () => {
    // Both edges come from `measureBounds`, i.e. the SVG's space, while the ink is in the staff's.
    // At k = 0.5 line 0 ends at 800 in staff space and line 1 begins at 200.
    expect(foldPastSystemEnd(pass, 0, 700, 0.5), 'still on its line').toEqual({ line: 0, endX: 700 })
    expect(foldPastSystemEnd(pass, 0, 860, 0.5)).toEqual({ line: 1, endX: 260 })
  })

  it('⭐⭐ …and BACKWARDS: ink past a line\'s START continues at the END of the previous one', () => {
    // His report, 2026-08-20: *"the cross staff is not working in the opposite direction for the
    // begin endpoint"* — a `tr` nudged 51 spaces LEFT. One rule read twice; only the forward half
    // had been written. 40 px before line 1's start (100) is 40 before line 0's end (400).
    expect(foldPastSystemEnd(pass, 1, 60, 1)).toEqual({ line: 0, endX: 360 })
    // …and it keeps going: 340 before line 2's start is 340 back from line 1's end (500) — still on
    // line 1, which is 400 wide. One more line's worth would land on line 0.
    expect(foldPastSystemEnd(pass, 2, -240, 1)).toEqual({ line: 1, endX: 160 })
    // 740 back from line 2's start: 400 of it eats line 1 whole (100…500), leaving 340 back from
    // line 0's end (400).
    expect(foldPastSystemEnd(pass, 2, -640, 1), 'over line 1 entirely').toEqual({ line: 0, endX: 60 })
  })

  it('⛔ STOPS at the FIRST line too — there is nothing before it to fold onto', () => {
    expect(foldPastSystemEnd(pass, 0, -50, 1)).toEqual({ line: 0, endX: -50 })
  })
})
