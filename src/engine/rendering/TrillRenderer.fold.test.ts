import { describe, it, expect } from 'vitest'
import { coveredPlacements, foldPastSystemEnd } from './TrillRenderer'
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

/**
 * 🚨🚨 **WHICH BARS A FRAGMENT ANSWERS FOR** — the other half of the fold, and the half that was
 * wrong. `coveredPlacements` is what {@link baselineFor} reads its ink over and what
 * `trillFragmentClaim` turns into the ladder's claim, so widening it by one bar widens BOTH.
 *
 * ⭐ His report, 2026-08-20, with a screenshot: a below-staff `tr` in bar 6 pushing the bar-3
 * dynamics and pedal down, *"the trill is not even close horizontally… for me it looks very
 * strange"*. The fold clause matched `p.line >= first && p.line <= last` unconditionally, and
 * `from.line` is always inside that window — so every trill swallowed its whole system.
 */
describe('coveredPlacements', () => {
  /** One staff, 8 bars on system 0 and 4 more on system 1. */
  const bars = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(measureNumber => ({ measureNumber, staffIndex: 0, line: 0 })),
    ...[9, 10, 11, 12].map(measureNumber => ({ measureNumber, staffIndex: 0, line: 1 })),
    // A second staff, to prove the lane filter is not what is doing the work here.
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(measureNumber => ({ measureNumber, staffIndex: 1, line: 0 })),
  ]
  const numbers = (p: readonly { measureNumber: number }[]): number[] => p.map(x => x.measureNumber)

  it('🚨 a trill that does NOT fold covers its OWN bars, not its whole system', () => {
    const covered = coveredPlacements(
      bars, { startMeasure: 6, endMeasure: 6 }, { staffIndex: 0, line: 0 }, 0, 0)
    expect(numbers(covered), 'bar 6 alone — bars 1-5 and 7-8 are five bars away').toEqual([6])
  })

  it('a multi-bar span covers exactly the bars it spans', () => {
    const covered = coveredPlacements(
      bars, { startMeasure: 3, endMeasure: 5 }, { staffIndex: 0, line: 0 }, 0, 0)
    expect(numbers(covered)).toEqual([3, 4, 5])
  })

  it('⭐ a FOLDED fragment still picks up the line it landed on — that is what the clause is for', () => {
    // The `tr` starts in bar 6 on system 0 and its ink is nudged past the end onto system 1, which
    // its SPAN never reaches: without those bars the fragment has no stave over there.
    const covered = coveredPlacements(
      bars, { startMeasure: 6, endMeasure: 6 }, { staffIndex: 0, line: 0 }, 0, 1)
    expect(numbers(covered)).toEqual([6, 9, 10, 11, 12])
  })

  it('⭐ …and BACKWARDS, for ink folded past a line\'s start', () => {
    const covered = coveredPlacements(
      bars, { startMeasure: 9, endMeasure: 9 }, { staffIndex: 0, line: 1 }, 0, 1)
    expect(numbers(covered), 'all of system 0, which the span does not reach, plus bar 9')
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('🚨 a span crossing a break does NOT widen either line — both already have bars of their own', () => {
    // Bars 7-8 on system 0, bars 9-10 on system 1. Neither line needs the fold clause, so neither
    // gets its remaining bars: the fragment on system 0 must not answer for bars 1-6.
    const covered = coveredPlacements(
      bars, { startMeasure: 7, endMeasure: 10 }, { staffIndex: 0, line: 0 }, 0, 1)
    expect(numbers(covered)).toEqual([7, 8, 9, 10])
  })

  it('stays on its own staff', () => {
    const covered = coveredPlacements(
      bars, { startMeasure: 6, endMeasure: 6 }, { staffIndex: 1, line: 0 }, 0, 1)
    expect(covered.every(p => p.staffIndex === 1)).toBe(true)
    expect(numbers(covered), 'staff 1 has no bars on system 1 to fold onto').toEqual([6])
  })
})
