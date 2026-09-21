/**
 * Subject: `./barlineExtent` — how far up and down a barline reaches.
 *
 * ⭐ **The assertion that carries the rule is the last one**: the extent is exactly the distance
 * between the two outer LINES, so it does not move when the lines get thicker. That is what makes it
 * a ratio of the staff rather than a sum of a staff and a pen — and it is the property that would
 * have caught the bug this module was written for (a barline ending at `bottomLine + 1` while the
 * line it ends on is 1.1 thick).
 */
import { describe, it, expect } from 'vitest'
import { barlineExtent, barlineHeight } from './barlineExtent'
import { staveLineWidthPx, staffLineMidY } from './staffLines'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** A five-line treble stave whose top line is y = 40, at this repo's own staff size. */
const TOP = 40
const BOTTOM = TOP + 4 * STAFF_SPACE_PX
const ours = () => barlineExtent(TOP, BOTTOM, staveLineWidthPx())

describe('⭐⭐ a barline runs between the outer lines’ MIDDLES', () => {
  it('⛔ not between their outer edges — it stops half a thickness inside each', () => {
    const extent = ours()
    expect(extent.topY, 'below the top line’s own y by half its ink')
      .toBeCloseTo(TOP + staveLineWidthPx() / 2, 10)
    expect(extent.bottomY, 'and above the bottom line’s ink bottom by the same')
      .toBeCloseTo(BOTTOM + staveLineWidthPx() / 2, 10)
    // 🚨 The number this module replaced: VexFlow's `getBottomLineBottomY()` is `bottom + 1`, a hard
    // 1 that was its staff-line thickness and stopped being ours at P5c.
    expect(extent.bottomY, '⛔ NOT VexFlow’s bottom + 1').not.toBeCloseTo(BOTTOM + 1, 10)
  })

  it('⭐ it is the same point `staffLineMidY` answers — one rule, not two expressions', () => {
    const extent = ours()
    expect(extent.topY).toBe(staffLineMidY(TOP, staveLineWidthPx()))
    expect(extent.bottomY).toBe(staffLineMidY(BOTTOM, staveLineWidthPx()))
  })

  it('⭐⭐ …so it is exactly FOUR STAFF SPACES tall, whatever the lines are drawn at', () => {
    // The property, ⛔ not the number: LilyPond, MuseScore and Verovio all make this four spaces,
    // and the reason it can BE four spaces is that the two half-thicknesses cancel.
    expect(barlineHeight(ours())).toBeCloseTo(4 * STAFF_SPACE_PX, 10)
    for (const t of [0, 0.5, 1, staveLineWidthPx(), 3]) {
      expect(barlineHeight(barlineExtent(TOP, BOTTOM, t)), `thickness ${t}`)
        .toBeCloseTo(4 * STAFF_SPACE_PX, 10)
    }
  })

  it('⚠️ a staff with a different number of lines just has different anchors', () => {
    // One-line percussion: the two anchors coincide, and the extent is a point. ⛔ Making that
    // "visible somehow" is the CALLER's problem (Verovio pads a single-line staff by two units, and
    // LilyPond widens by a staff space) — ⛔ never a fudge inside the rule.
    const one = barlineExtent(TOP, TOP, staveLineWidthPx())
    expect(barlineHeight(one)).toBe(0)
    // Three lines, two spaces apart.
    expect(barlineHeight(barlineExtent(TOP, TOP + 2 * STAFF_SPACE_PX, staveLineWidthPx())))
      .toBeCloseTo(2 * STAFF_SPACE_PX, 10)
  })
})
