import { describe, it, expect } from 'vitest'
import { twoNoteTremoloStrokes, twoNoteTremoloStackHeight, PAIR_STROKE_CLEARANCE_SPACES, PAIR_STROKE_MAX_CLEARANCE_RATIO } from './TwoNoteTremolo'

/**
 * The stroke geometry — pure arithmetic, so it IS testable here (unlike the glyph-measuring the
 * single-note mark does, which jsdom cannot answer).
 */

/** Stems UP: the tips are at y = 50, the noteheads below them. */
const base = {
  strokes: 3,
  leftX: 100, leftAnchorY: 50,
  rightX: 200, rightAnchorY: 50,
  stemDirection: 1,
  staffSpace: 10, beamWidth: 5,
}

describe('twoNoteTremoloStrokes', () => {
  it('draws one quad per stroke, stepped ×1.5 like beam levels', () => {
    const quads = twoNoteTremoloStrokes(base)
    expect(quads).toHaveLength(3)
    expect(quads.every(q => q.thickness === 5)).toBe(true)
    expect(quads[1].startY - quads[0].startY).toBeCloseTo(7.5)
    expect(quads[2].startY - quads[1].startY).toBeCloseTo(7.5)
  })

  it('hangs the first stroke FLUSH from the stem tip, marching toward the notehead', () => {
    const quads = twoNoteTremoloStrokes(base)
    expect(quads[0].startY).toBeCloseTo(50)   // top edge ON the tip
    expect(quads[2].startY).toBeGreaterThan(quads[0].startY)
    const covered = quads[2].startY + quads[2].thickness - quads[0].startY
    expect(covered).toBeCloseTo(twoNoteTremoloStackHeight(3, 5))
  })

  it('stems DOWN: the stroke nearest the tip still sits ON it, and the stack marches up', () => {
    const quads = twoNoteTremoloStrokes({ ...base, stemDirection: -1 })
    // The tip is the BOTTOM end now, so the first stroke's bottom edge is the one flush with it.
    expect(quads[0].startY + quads[0].thickness).toBeCloseTo(50)
    expect(quads[2].startY).toBeLessThan(quads[0].startY)
  })

  it('FLOATS — detached from both stems by the clearance', () => {
    const quads = twoNoteTremoloStrokes(base)
    // A 100px gap: a quarter of it is 25, capped at one staff space.
    const clearance = PAIR_STROKE_CLEARANCE_SPACES * 10
    expect(quads[0].startX).toBeCloseTo(100 + clearance)
    expect(quads[0].endX).toBeCloseTo(200 - clearance)
  })

  it('keeps a real stroke on a NARROW gap — the clearance goes proportional', () => {
    const quads = twoNoteTremoloStrokes({ ...base, rightX: 120 })
    // 20px gap: a quarter of it (5) is less than a staff space, so it wins.
    expect(quads[0].startX).toBeCloseTo(105)
    expect(quads[0].endX).toBeCloseTo(115)
  })

  it('SLOPES with the stems — a higher right tip tilts the strokes', () => {
    const quads = twoNoteTremoloStrokes({ ...base, rightAnchorY: 30 })
    for (const q of quads) expect(q.endY).toBeLessThan(q.startY)
    // The slope is the tip line's, sampled at the stroke ends — the same on every level.
    const slopes = quads.map(q => (q.endY - q.startY) / (q.endX - q.startX))
    expect(slopes[0]).toBeCloseTo(slopes[2])
    expect(slopes[0]).toBeCloseTo((30 - 50) / 100)
  })

  it('starts PAST whatever already occupies the tip (a beam, or a flag)', () => {
    const bare = twoNoteTremoloStrokes({ ...base, strokes: 2 })
    const offset = twoNoteTremoloStrokes({ ...base, strokes: 2, tipOffset: 7.5 })
    // The whole stack moves toward the notehead by the offset; the count is untouched here — how
    // many strokes a beamed pair draws is `pairStrokesDrawn`'s answer, not this function's.
    expect(offset).toHaveLength(2)
    expect(offset[0].startY - bare[0].startY).toBeCloseTo(7.5)
    expect(offset[1].startY - bare[1].startY).toBeCloseTo(7.5)
  })

  it('draws nothing when there is nothing to draw', () => {
    expect(twoNoteTremoloStrokes({ ...base, strokes: 0 })).toEqual([])
    expect(twoNoteTremoloStrokes({ ...base, rightX: 100 })).toEqual([])
    expect(twoNoteTremoloStrokes({ ...base, rightX: 90 })).toEqual([])
  })
})

describe('twoNoteTremoloStrokes — minClearance (a flag standing in the gap)', () => {
  it('raises the end clearance to the floor it is given', () => {
    const quads = twoNoteTremoloStrokes({ ...base, minClearance: 18 })
    expect(quads[0].startX).toBeCloseTo(118)
    expect(quads[0].endX).toBeCloseTo(182)
  })

  it('never lowers it — the plain rule still wins when it asks for more', () => {
    const quads = twoNoteTremoloStrokes({ ...base, minClearance: 2 })
    expect(quads[0].startX).toBeCloseTo(110)  // one staff space, as without it
  })

  it('is capped so a stroke always survives, however much room is asked for', () => {
    const quads = twoNoteTremoloStrokes({ ...base, minClearance: 999 })
    expect(quads).toHaveLength(3)
    const cap = 100 * PAIR_STROKE_MAX_CLEARANCE_RATIO
    expect(quads[0].startX).toBeCloseTo(100 + cap)
    expect(quads[0].endX).toBeCloseTo(200 - cap)
    expect(quads[0].endX).toBeGreaterThan(quads[0].startX)
  })
})
