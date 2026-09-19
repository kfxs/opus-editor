// @vitest-environment jsdom
/**
 * ⭐⭐ **A bar has TWO frames — where it was BUILT and where it IS** (S4e, `./staveFrame`'s header).
 *
 * The reused-bar trap as arithmetic: a stave built at one place, a placement at another, and the placed
 * frame must answer the placement. ⭐ And a bar tier 1 has just rebuilt (placement = stave) must answer
 * the built numbers BIT-identically — that is what lets S4e move no pixel.
 *
 * ⚠️ The stave's own position is the constructor's numbers below, ⛔ never asked back through VexFlow's
 * getters — a spec may not add a VexFlow use (`lint:vexflow`).
 */
import { describe, it, expect } from 'vitest'
import { EngravedStave } from './EngravedStave'
import { barFrame, maybeStaveOf, placedBarFrame, placedStaffFrame, standOn, staveFrame, staveOf } from './staveFrame'
import { EngravedNote } from './EngravedNote'

const X = 30.1
const Y = 47.3
const WIDTH = 211.7

function built() {
  return new EngravedStave(X, Y, WIDTH).addClefSign('treble', 'default')
}

describe('staveFrame — the placed frames', () => {
  it('a rebuilt bar: the placed frame IS the built one, to the bit', () => {
    const stave = built()
    const placement = { x: X, y: Y, width: WIDTH, scale: 1, stave }
    expect(placedStaffFrame(placement)).toEqual(staveFrame(stave))
    const placed = placedBarFrame(placement)
    const own = barFrame(stave)
    expect([placed.x, placed.width, placed.noteStartX, placed.noteEndX])
      .toEqual([own.x, own.width, own.noteStartX, own.noteEndX])
  })

  it('a reused bar: the placed frame answers where the placement puts it, not where the stave was', () => {
    const stave = built()
    const own = { frame: staveFrame(stave), bar: barFrame(stave) }
    const placement = { x: X + 40, y: Y + 25, width: WIDTH, scale: 1, stave }

    const frame = placedStaffFrame(placement)
    expect(frame.topLineY).toBeCloseTo(own.frame.topLineY + 25, 9)
    expect(frame.spacePx).toBe(own.frame.spacePx)
    expect(frame.lineCount).toBe(own.frame.lineCount)

    const bar = placedBarFrame(placement)
    expect(bar.x).toBe(placement.x)
    expect(bar.width).toBe(placement.width)
    expect(bar.noteStartX).toBeCloseTo(own.bar.noteStartX + 40, 9)
    expect(bar.noteEndX).toBeCloseTo(own.bar.noteEndX + 40, 9)
  })

  it("a small staff: the placement is SVG-space, the frame the staff's own", () => {
    const stave = built()
    const k = 0.7
    const placement = { x: (X + 10) * k, y: (Y + 5) * k, width: WIDTH * k, scale: k, stave }
    expect(placedStaffFrame(placement).topLineY).toBeCloseTo(staveFrame(stave).topLineY + 5, 9)
    expect(placedBarFrame(placement).x).toBeCloseTo(X + 10, 9)
    expect(placedBarFrame(placement).width).toBeCloseTo(WIDTH, 9)
  })
})

describe('standOn / staveOf — the one cast each way across a VexFlow note\'s API (S12h)', () => {
  it('⭐ a note stood on a stave of ours hands back THAT stave, and takes its lines from it', () => {
    const stave = new EngravedStave(10, 40, 300)
    const note = standOn(new EngravedNote({ keys: ['f/5'], duration: 'q' }), stave)
    expect(staveOf(note)).toBe(stave)
    expect(maybeStaveOf(note)).toBe(stave)
    expect(staveFrame(staveOf(note)).topLineY).toBe(80)
  })

  it('a note that stands on nothing has no stave', () => {
    expect(maybeStaveOf(new EngravedNote({ keys: ['f/5'], duration: 'q' }))).toBeUndefined()
  })
})
