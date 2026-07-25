import { describe, it, expect } from 'vitest'
import { twoNoteTremoloStrokes, twoNoteTremoloStackHeight, PAIR_STROKE_CLEARANCE_SPACES } from './TwoNoteTremolo'

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

  it('P2 — starts PAST the pair\'s own beam, and the beam does not eat the count', () => {
    const bare = twoNoteTremoloStrokes({ ...base, strokes: 2 })
    const beamed = twoNoteTremoloStrokes({ ...base, strokes: 2, beamLevels: 1 })
    // Still two strokes: beams and strokes ADD (1 + 2 = 32nds), they do not replace each other.
    expect(beamed).toHaveLength(2)
    // …and the whole stack has moved one beam step toward the notehead, clear of the beam line.
    expect(beamed[0].startY - bare[0].startY).toBeCloseTo(7.5)
    expect(beamed[1].startY - bare[1].startY).toBeCloseTo(7.5)
  })

  it('draws nothing when there is nothing to draw', () => {
    expect(twoNoteTremoloStrokes({ ...base, strokes: 0 })).toEqual([])
    expect(twoNoteTremoloStrokes({ ...base, rightX: 100 })).toEqual([])
    expect(twoNoteTremoloStrokes({ ...base, rightX: 90 })).toEqual([])
  })
})
