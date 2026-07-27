import { describe, it, expect } from 'vitest'
import { barWidthRoom } from './barWidthRoom'
import { LAYOUT_CONFIG, type MeasureWidthInfo } from '@/engine/rendering/layoutConfig'
import { BAR_STRETCH_MIN } from '@/engine/models/engravingOverrides'

/**
 * The bar-width gesture's arithmetic, stated on its own — which is the whole reason Phase 6b pulled
 * it off `MusicEngine` (docs/refactor-plan-2026-07-27.md). Every claim below is one of
 * `docs/bar-width-plan.md` §4–§5, and none of them needs a renderer, a score or a DOM to say.
 *
 * ⚠️ These are statements about the MAPPING, not about drawn pixels. Where a bar's barline actually
 * lands is browser geometry and belongs in `e2e/barWidth.e2e.ts`, which measures it for real.
 */

/** A full line: the available width, exactly — so the "does this line fill the page?" test passes. */
const AVAILABLE = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2

/** One bar of a line, with only the fields the room arithmetic reads. */
function bar(measureNumber: number, width: number, extra: Partial<MeasureWidthInfo> = {}): MeasureWidthInfo {
  return {
    measureNumber,
    minWidth: width,
    finalWidth: width,
    noteSpace: 100,
    lineNumber: 0,
    ...extra,
  }
}

const lineOf = (bars: MeasureWidthInfo[]) => new Map(bars.map(b => [b.measureNumber, b]))

describe('barWidthRoom — what it declines to answer', () => {
  it('a bar nobody has drawn has no room', () => {
    expect(barWidthRoom({
      measureNumber: 7, layout: lineOf([bar(1, 200)]), stretch: 1, viewMode: 'wrapped', slackPx: 50,
    })).toBeNull()
  })

  it('a bar with no note space cannot be multiplied', () => {
    const layout = lineOf([bar(1, 200, { noteSpace: 0 })])
    expect(barWidthRoom({ measureNumber: 1, layout, stretch: 1, viewMode: 'wrapped', slackPx: 50 })).toBeNull()
  })
})

describe('barWidthRoom — linear view justifies nothing', () => {
  it('a px of stretch space is a px of barline movement, both slopes 1', () => {
    const layout = lineOf([bar(1, 200), bar(2, 200)])
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 1, viewMode: 'linear', slackPx: 50 })!

    expect(room.barlineSlope).toBe(1)
    expect(room.widthSlope).toBe(1)
    // +100px of barline = +1 whole note space = stretch 2 on a bar whose note space is 100.
    expect(room.stretchForBarlineDelta(100)).toBeCloseTo(2, 6)
    // Nothing to fill, so the only ceiling is the absolute one.
    expect(room.maxStretch).toBeGreaterThan(1)
  })
})

describe('barWidthRoom — on a justified line, growth is a TRANSFER', () => {
  // Two equal bars filling the line. Bar 2 has slack to give, so it pays for bar 1's growth.
  const layout = () => lineOf([bar(1, AVAILABLE / 2), bar(2, AVAILABLE / 2)])

  it('the grown bar takes its growth whole — widthSlope 1', () => {
    const room = barWidthRoom({ measureNumber: 1, layout: layout(), stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    expect(room.widthSlope).toBe(1)
    expect(room.alone).toBe(false)
  })

  it('the barline after it moves by what the payers SITTING BEFORE IT give up', () => {
    // Bar 1's only payer is bar 2, which sits after it — so nothing before the barline gives
    // anything up and the barline tracks the growth 1:1.
    const first = barWidthRoom({ measureNumber: 1, layout: layout(), stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    expect(first.barlineSlope).toBeCloseTo(1, 6)

    // Bar 2's payer is bar 1, which sits before it: bar 1 shrinks by exactly what bar 2 gains, so
    // bar 2's own ending barline — the line's right margin — cannot move at all.
    const last = barWidthRoom({ measureNumber: 2, layout: layout(), stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    expect(last.barlineSlope, 'the system-ending barline is PINNED').toBe(0)
    expect(last.widthSlope, 'but the BAR can still be resized').toBe(1)
  })

  it('a pinned barline still steps — the press is spent on the bar’s own music', () => {
    const last = barWidthRoom({ measureNumber: 2, layout: layout(), stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    // Slope 0 means `stretchForBarlineDelta` cannot help; `nudgeBarWidth` falls back to the note
    // space, which is what keeps the last bar of every system resizable.
    expect(last.stretchForBarlineDelta(100)).toBeCloseTo(2, 6)
  })
})

describe('barWidthRoom — the floors and the ceiling', () => {
  it('the shrink floor is the room the DRAWN music is not using', () => {
    const layout = lineOf([bar(1, AVAILABLE / 2), bar(2, AVAILABLE / 2)])
    // 50px of slack over a 100px note space = half a stretch unit of shrink, and no more.
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 2, viewMode: 'wrapped', slackPx: 50 })!
    expect(room.minStretch).toBeCloseTo(1.5, 6)
  })

  it('and never goes under the absolute minimum, however much slack is measured', () => {
    const layout = lineOf([bar(1, AVAILABLE / 2), bar(2, AVAILABLE / 2)])
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 1, viewMode: 'wrapped', slackPx: 10_000 })!
    expect(room.minStretch).toBe(BAR_STRETCH_MIN)
  })

  it('the ceiling is the stretch at which the bar becomes the WHOLE LINE', () => {
    const layout = lineOf([bar(1, AVAILABLE / 2), bar(2, AVAILABLE / 2)])
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    // minWidth is half the line; a note space of 100 buys the other half in (AVAILABLE/2)/100 units.
    expect(room.maxStretch).toBeCloseTo(1 + (AVAILABLE - AVAILABLE / 2) / 100, 6)
  })

  it('⭐ a bar ALONE on a full system is already as wide as anything can make it', () => {
    const layout = lineOf([bar(1, AVAILABLE)])
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 4, viewMode: 'wrapped', slackPx: 50 })!

    expect(room.alone).toBe(true)
    // The ceiling is where it stands — growth is refused against a limit the picture explains,
    // rather than buying a dead range that draws the identical bar.
    expect(room.maxStretch).toBe(4)
    // …and a KEY PRESS shrinks by jumping to the casting-off threshold, not by pixels: with no
    // line below to pull a bar up from, there is nowhere to jump to and the step stands still.
    expect(room.stretchForStep(-30)).toBe(4)
    // The MOUSE never jumps — it stays continuous even here, or a drag would be dead in the hand.
    expect(room.stretchForBarlineDelta(-30)).toBeCloseTo(4 - 30 / 100, 6)
  })

  it('a RAGGED last line has no fixed total, so nobody has to pay and the bar simply grows', () => {
    // The same lone bar, but the line does not fill the page: the ceiling is the derived one again.
    const layout = lineOf([bar(1, AVAILABLE / 3)])
    const room = barWidthRoom({ measureNumber: 1, layout, stretch: 1, viewMode: 'wrapped', slackPx: 50 })!
    expect(room.maxStretch).toBeGreaterThan(1)
  })
})
