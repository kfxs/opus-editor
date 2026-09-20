import { describe, it, expect } from 'vitest'
import { endpointGuide } from './SlurRenderer'

/**
 * The dotted line a DISPLACED slur endpoint draws back to where the engraver put it.
 *
 * Subject: {@link SlurRenderer}, a chapter beside `SlurRenderer.test.ts`. Pure arithmetic on two
 * points the render has already measured, so it is testable here rather than in the browser suite —
 * ⚠️ the numbers are handed in, and nothing below asks jsdom where any ink landed
 * (`reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐ The claim under test is the CHOICE of the far end: `drawn − offset`, the endpoint's own
 * un-nudged position, rather than the notehead centre the other kinds point at. It is exact (the
 * base sits where the head/stem rule put it) and it makes the line the offset vector itself.
 */
describe('a slur endpoint’s attachment guide', () => {
  it('draws from the ink back to the un-nudged point', () => {
    expect(endpointGuide({ x: 340, y: 100 }, { x: 40, y: -6 }))
      .toEqual({ from: { x: 340, y: 100 }, to: { x: 300, y: 106 } })
  })

  it('draws for a purely VERTICAL nudge too — a lifted end has left its anchor as surely', () => {
    expect(endpointGuide({ x: 300, y: 90 }, { x: 0, y: -10 }))
      .toEqual({ from: { x: 300, y: 90 }, to: { x: 300, y: 100 } })
  })

  it('⛔ draws NOTHING for an end that was never moved — a guide is never a guess', () => {
    // The registry's own rule, and it also keeps the ordinary case free of a zero-length line
    // drawn on top of the notehead.
    expect(endpointGuide({ x: 300, y: 100 }, { x: 0, y: 0 })).toBeNull()
  })
})
