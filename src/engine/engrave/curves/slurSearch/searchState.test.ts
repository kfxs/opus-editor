/** One slur's problem as LilyPond states it (`./searchState`) — LilyPond's space: staff spaces, y up. */
import { describe, it, expect } from 'vitest'
import { buildSearchState, encompassInfo, moveAwayFromStaffline } from './searchState'
import { LILYPOND_SLUR_DETAILS as D } from './searchDetails'
import { column, flat, hisSlur, STAFF } from './searchFixture'

describe('moveAwayFromStaffline', () => {
  it('⭐ an end ON a line is nudged 0.15 sp off it, on the slur\'s side; in a space it stays', () => {
    expect(moveAwayFromStaffline(1, STAFF, 1)).toBeCloseTo(1.15, 12)
    expect(moveAwayFromStaffline(1, STAFF, -1)).toBeCloseTo(0.85, 12)
    expect(moveAwayFromStaffline(0.5, STAFF, 1)).toBe(0.5)
    // Above the staff there is no line to leave.
    expect(moveAwayFromStaffline(3, STAFF, 1)).toBe(3)
  })
})

describe('the base attachments', () => {
  it('⭐ half a space beyond the end head, on the slur\'s side, at the head\'s middle', () => {
    const s = buildSearchState(hisSlur(false), D)
    // B4 (head top 0.5) + ½ = 1.0, which is the second line → 1.15. G5 (head top 3.0) + ½ = 3.5.
    expect(s.baseAttachments[0]).toEqual({ x: 0.59, y: 1.15 })
    expect(s.baseAttachments[1].y).toBe(3.5)
  })

  it('an end whose beam leaves it inward attaches at the STEM end', () => {
    const input = hisSlur(false)
    const first = column(0, -2, 1) // stem up, slur above
    first.stem!.beamsRight = true
    first.stem!.beam = { id: 'b', thickness: 0.5, containsSlur: false }
    const s = buildSearchState({ ...input, columns: [first, ...input.columns.slice(1)] }, D)
    expect(s.baseAttachments[0].y).toBeCloseTo(-1 + 3.5 + 0.5, 12)
  })
})

describe('the candidates', () => {
  it('⭐ every pair of ends from the base outward, in half-space steps, `region-size` far', () => {
    const s = buildSearchState(hisSlur(false), D)
    // 0 … 4 sp in ½ steps is 9 places an end, so 81 pairs.
    expect(s.attachments).toHaveLength(81)
    expect(s.attachments[1][1].y - s.attachments[0][1].y).toBe(0.5)
    expect(s.attachments[9][0].y - s.attachments[0][0].y).toBe(0.5)
  })

  it('an end whose stem points the slur\'s way moves ONTO the stem while its y is along it', () => {
    const input = hisSlur(false)
    const last = column(11, -2, 1) // stem up to 2.5
    const s = buildSearchState({ ...input, columns: [...input.columns.slice(0, -1), last], endHeadY: [0, -1] }, D)
    const onStem = s.attachments.find(([, r]) => r.y > -1 && r.y < 2.5)!
    // `stem_extent[X][-d] − d · 0.3` for the RIGHT end: the stem's left edge, 0.3 further left.
    expect(onStem[1].x).toBeCloseTo(11 + 1.18 - 0.12 - 0.3, 12)
  })
})

describe('the objects', () => {
  it('⭐ a flat is checked at its tall LEFT edge, and costs `accidental-collision`', () => {
    const s = buildSearchState(hisSlur(true), D)
    expect(s.extraInfos).toHaveLength(1)
    expect(s.extraInfos[0].idx).toBe(-1)
    expect(s.extraInfos[0].penalty).toBe(D.accidentalCollision)
  })

  it('a sharp is checked right of its middle above the notes, left of it below; a natural the other way', () => {
    const sharp = { ...flat(2, 3), alteration: 'sharp' as const }
    const natural = { ...flat(2, 3), alteration: 'natural' as const }
    const up = buildSearchState({ ...hisSlur(false), objects: [sharp, natural] }, D)
    expect(up.extraInfos.map(i => i.idx)).toEqual([0.5, -1])
  })

  it('⭐ an `inside` object is also an AVOID-POINT for the arch — its middle, its far edge', () => {
    const s = buildSearchState(hisSlur(true), D)
    const f = flat(2.3, 3)
    expect(s.avoid).toContainEqual({ x: (f.x[0] + f.x[1]) / 2, y: f.y[1] })
  })

  it('the columns BETWEEN the ends are avoid-points too, `free-head-distance` beyond their far point', () => {
    const s = buildSearchState(hisSlur(false), D)
    // E5 (stem down): its head top, 2.0, + 0.3.
    expect(s.avoid[0].y).toBeCloseTo(2.3, 12)
    expect(s.avoid).toHaveLength(3)
  })
})

describe('encompassInfo', () => {
  it('a stem pointing the slur\'s way reports its end, at the stem\'s x', () => {
    const info = encompassInfo(column(7, -1, 1), 1)
    expect(info.x).toBeCloseTo(7 + 1.18 - 0.06, 12)
    expect(info.head).toBeCloseTo(0, 12)
    expect(info.stem).toBe(3)
  })

  it('a stem pointing away reports the head for both', () => {
    expect(encompassInfo(column(9, 2, -1), 1)).toEqual({ x: 9.59, head: 1.5, stem: 1.5 })
  })
})
