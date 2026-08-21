import { describe, it, expect } from 'vitest'
import { wrapReleaseOntoNextLine } from './pedalReleaseWrap'
import { type SystemEdgeLookup } from './systemEdges'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'

/**
 * ⭐⭐ **A `✻` pushed past the end of its line is drawn on the next one** — his ask, 2026-08-21, and
 * his choice of the two ways to answer it: *"lets try a"*, the DRAWING cuts and the model is
 * untouched.
 *
 * Subject: {@link pedalReleaseWrap}, sitting beside this file. Pure arithmetic over the last render's
 * system margins, so the lookup is fabricated exactly as `systemEdges.test.ts` fabricates it —
 * jsdom draws nothing (`reference_jsdom_cannot_measure_glyphs`) and nothing here needs it to.
 *
 * ⚠️ What this chapter does NOT own: that the cut then produces a `(Ped.)` resumption carrying the
 * release. That is `planSlurSegments`', already proven, and `PedalRenderer` only hands it a different
 * line number.
 */
function makeLookup(
  lines: Record<number, number>,
  bounds: Record<number, { noteStartX: number; noteEndX: number }>,
): SystemEdgeLookup {
  const measureLayoutInfo = new Map<number, MeasureWidthInfo>()
  for (const [num, lineNumber] of Object.entries(lines)) {
    measureLayoutInfo.set(Number(num), { measureNumber: Number(num), minWidth: 0, finalWidth: 0, lineNumber })
  }
  const measureBounds = new Map<number, MeasureBounds>()
  for (const [num, b] of Object.entries(bounds)) {
    measureBounds.set(Number(num), {
      measureX: b.noteStartX - 20, measureY: 0, measureWidth: 0,
      noteStartX: b.noteStartX, noteEndX: b.noteEndX,
    })
  }
  return { measureLayoutInfo, measureBounds }
}

// Line 0 runs 100…400, line 1 runs 100…500. A pedal's release is drawn on line 0.
const pass = makeLookup(
  { 1: 0, 2: 0, 3: 1, 4: 1 },
  {
    1: { noteStartX: 100, noteEndX: 250 }, 2: { noteStartX: 260, noteEndX: 400 },
    3: { noteStartX: 100, noteEndX: 300 }, 4: { noteStartX: 310, noteEndX: 500 },
  },
)
/** Both lines were painted for this pedal's staff. */
const painted = (line: number) => line === 0 || line === 1

describe('wrapReleaseOntoNextLine', () => {
  it('⛔ stays put while the DRAWN ink is still inside the line', () => {
    expect(wrapReleaseOntoNextLine(pass, 0, 395, 1, painted)).toBeNull()
    expect(wrapReleaseOntoNextLine(pass, 0, 400, 1, painted), 'exactly ON the edge stays').toBeNull()
  })

  it('⭐⭐ …and moves to the next line the moment the ink passes it', () => {
    expect(wrapReleaseOntoNextLine(pass, 0, 412, 1, painted)?.line, 'the next system').toBe(1)
  })

  it('⭐ THE OVERSHOOT TRAVELS — how far past the old line, so far into the new one', () => {
    expect(wrapReleaseOntoNextLine(pass, 0, 412, 1, painted)?.endX, '12 px past ⇒ 12 px in').toBe(112)
    expect(wrapReleaseOntoNextLine(pass, 0, 460, 1, painted)?.endX, 'push harder, land further').toBe(160)
  })

  it('🚨 …and it can NEVER land before the new line\'s first ink', () => {
    // ⭐⭐ THE BREAK-TEST FOR THE FIRST VERSION'S BUG — his *"the pedal of the down staff shrinks"*.
    // Answering in the AUTOMATIC x (here 300, well inside the old line) put the release 100 px LEFT
    // of the new line's start; `cutIntoPieces` then dropped that fragment or kept it a hair wide,
    // which the pair's floors printed as a `(Ped.)✻` smudge. The ink travels, so the answer is always
    // past the margin.
    const wrapped = wrapReleaseOntoNextLine(pass, 0, 405, 1, painted)!
    expect(wrapped.endX).toBeGreaterThanOrEqual(100)
    expect(wrapped.endX, 'the 5 px it was pushed past the edge').toBe(105)
  })

  it('⚠️ converts the margins into the STAFF\'s own space — a small staff wraps at its own edge', () => {
    // The edges come from `measureBounds` (SVG space) and everything the drawing does is inside the
    // staff's scale group. At k = 0.5 the line's end is 800 in staff space, so 412 is nowhere near it.
    expect(wrapReleaseOntoNextLine(pass, 0, 412, 0.5, painted)).toBeNull()
    expect(wrapReleaseOntoNextLine(pass, 0, 810, 0.5, painted)?.endX).toBe(210)
  })

  it('⛔ never onto a line the render did not put this staff on', () => {
    // The walk's own no-guessing rule: no picture, no wrap. ⭐ Which is also the last system's case —
    // there is nothing after it, so a release pushed off the end simply stays off it.
    expect(wrapReleaseOntoNextLine(pass, 1, 520, 1, painted), 'no line 2').toBeNull()
    expect(wrapReleaseOntoNextLine(pass, 0, 412, 1, () => false)).toBeNull()
  })

  it('⛔ declines when the last render measured no margin for either line', () => {
    const blank = makeLookup({}, {})
    expect(wrapReleaseOntoNextLine(blank, 0, 412, 1, painted)).toBeNull()
  })
})
