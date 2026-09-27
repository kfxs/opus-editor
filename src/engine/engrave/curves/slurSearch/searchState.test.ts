/** One slur's problem as LilyPond states it (`./searchState`) — LilyPond's space: staff spaces, y up. */
import { describe, it, expect } from 'vitest'
import { buildSearchState, encompassInfo, moveAwayFromStaffline } from './searchState'
import { LILYPOND_SLUR_DETAILS as D, LILYPOND_SLUR_RULES } from './searchDetails'
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

describe('⭐ a PIECE of a broken slur (P6) — `get_base_attachments`\' no-column branch', () => {
  // The start of his slur on one system — B4, E5 — broken at x 6 before A4 D5 G5 on the next.
  const begin = () => ({ ...hisSlur(false), columns: hisSlur(false).columns.slice(0, 2), brokenX: [undefined, 6] as const })

  it('the open end stands at the break, half a space beyond the nearest column on this system', () => {
    const s = buildSearchState(begin(), D)
    expect(s.isBroken).toBe(true)
    // E5's column (stem down): its top is its head's, 2.0; + ½.
    expect(s.baseAttachments[1]).toEqual({ x: 6, y: 2.5 })
  })

  it('…or at the other end\'s own height, when that column IS the other end\'s note', () => {
    const s = buildSearchState({ ...begin(), columns: begin().columns.slice(0, 1) }, D)
    expect(s.baseAttachments[1].y).toBe(s.baseAttachments[0].y)
  })

  it('⭐ the column nearest the break is NOT a bound — the curve has to get over it', () => {
    const s = buildSearchState(begin(), D)
    expect(s.avoid[0].x).toBeCloseTo(3.3 + 0.59, 12)
  })

  it('⭐ a broken piece does not follow the music\'s rise', () => {
    expect(buildSearchState(begin(), D).musicalDy).toBe(0)
  })

  it('the END piece mirrors it; a MIDDLE piece has two open ends', () => {
    const end = buildSearchState({ ...hisSlur(false), columns: hisSlur(false).columns.slice(2), brokenX: [-1, undefined] }, D)
    expect(end.baseAttachments[0].x).toBe(-1)
    const middle = buildSearchState({ ...hisSlur(false), columns: hisSlur(false).columns.slice(1, 4), brokenX: [0, 12] }, D)
    expect([middle.baseAttachments[0].x, middle.baseAttachments[1].x]).toEqual([0, 12])
    expect(middle.avoid).toHaveLength(3)
  })
})

describe('⭐ row A — where an end is attracted to (`edgeTargets`)', () => {
  const input = () => ({ ...hisSlur(false), columns: [column(0, 2, 1), column(4, 5, -1)], endHeadY: [1, 2.5] as const })

  it('`head` (LilyPond): the base attachments', () => {
    const s = buildSearchState(input(), D)
    expect(s.edgeTargets).toEqual(s.baseAttachments)
  })

  it('`stem`: ½ sp past the tip of a stem pointing the slur\'s way — a stem pointing away keeps its head', () => {
    const s = buildSearchState(input(), D, { ...LILYPOND_SLUR_RULES, stemSideEnd: 'stem' })
    expect(s.edgeTargets[0].y).toBeCloseTo(1 + 3.5 + 0.5, 12)
    expect(s.edgeTargets[1]).toEqual(s.baseAttachments[1])
  })
})

describe('⭐ row B — where an end stands in x (`endX`)', () => {
  // Both stems UP, the slur above: the START's stem stands on its inner (right) side, the END's on its outer.
  const input = () => ({ ...hisSlur(false), columns: [column(0, 2, 1), column(4, 5, 1)], endHeadY: [1, 2.5] as const })
  const house = { ...LILYPOND_SLUR_RULES, endX: 'house' as const }

  it('`lilypond`: an end alongside a stem goes beside it — at the END too, over its head (the outer side)', () => {
    const [l, r] = buildSearchState(input(), D).attachments[0]
    expect(l.x).toBeCloseTo(1.18 + 0.3, 12)          // right of the start's stem
    expect(r.x).toBeCloseTo(4 + 1.18 - 0.12 - 0.3, 12) // left of the end's stem — over the head's right half
  })

  it('⭐ `house`: the head centre, past the stem only on the slur\'s INNER side', () => {
    const [l, r] = buildSearchState(input(), D, house).attachments[0]
    expect(l.x).toBeCloseTo(1.18 + D.houseStemClearance, 12) // the start steps past its (inner) stem
    expect(r.x).toBeCloseTo(4 + 0.59, 12)                    // the end stays at its head's centre
  })

  it('`house`: the same x at every candidate height alongside the stem — no jump with spacing or tilt', () => {
    const xs = new Set(buildSearchState(input(), D, house).attachments
      .filter(([, r]) => r.y <= 6).map(([, r]) => r.x.toFixed(9)))
    expect(xs.size).toBe(1)
  })
})

describe('⭐ row E — an accidental under the slur (`accidental`)', () => {
  it('`lilypond`: `accidental-collision` 3; `clear`: `extra-object-collision-penalty` 50, like any object', () => {
    expect(buildSearchState(hisSlur(true), D).extraInfos[0].penalty).toBe(D.accidentalCollision)
    const clear = buildSearchState(hisSlur(true), D, { ...LILYPOND_SLUR_RULES, accidental: 'clear' })
    expect(clear.extraInfos[0].penalty).toBe(D.extraObjectCollisionPenalty)
  })
})

describe('⭐ row G — ties under the slur (`ties`)', () => {
  const tie = { x: [1, 3] as const, y: [0.6, 1.1] as const, ends: [{ x: 1, y: 0.7 }, { x: 3, y: 0.7 }] as const }

  it('`off` (the default): a tie handed over is not read', () => {
    const s = buildSearchState({ ...hisSlur(false), ties: [tie] }, D)
    expect(s.extraInfos).toHaveLength(0)
    expect(s.tieEnds).toHaveLength(0)
  })

  it('⭐ `on` (LilyPond): an `inside` object the arch clears, and its two ends forbidden attachments', () => {
    const s = buildSearchState({ ...hisSlur(false), ties: [tie] }, D, { ...LILYPOND_SLUR_RULES, ties: 'on' })
    expect(s.extraInfos).toHaveLength(1)
    expect(s.extraInfos[0].penalty).toBe(D.extraObjectCollisionPenalty)
    expect(s.tieEnds).toEqual(tie.ends)
    expect(s.avoid).toContainEqual({ x: 2, y: 1.1 })
  })
})

describe('⭐ row G — slurs nested under this one (`nested`)', () => {
  // A small slur over E5 → A4, arching to about 2.9.
  const inner = { curve: [{ x: 3.9, y: 2.5 }, { x: 4.5, y: 3.1 }, { x: 7, y: 2.5 }, { x: 7.6, y: 1.5 }] as const, sharesLeft: false, sharesRight: false }

  it('`off` (the default): a nested slur handed over is not read', () => {
    const s = buildSearchState({ ...hisSlur(false), nested: [inner] }, D)
    expect(s.avoid).toHaveLength(3)
  })

  it('⭐ `on` (LilyPond): its middle, 0.8 sp further out, is an avoid-point; its curve is scored', () => {
    const s = buildSearchState({ ...hisSlur(false), nested: [inner] }, D, { ...LILYPOND_SLUR_RULES, nested: 'on' })
    expect(s.avoid).toHaveLength(4)
    // Only its MIDDLE is checked — it shares neither end.
    expect(s.extraInfos).toHaveLength(1)
  })
})

describe('⭐ row G — an end note\'s FLAG (`flags`)', () => {
  // A flagged START with its stem up, the slur above: the end goes beside the stem — past what?
  const input = () => {
    const first = column(0, 2, 1)
    first.stem = { ...first.stem!, flag: { x: [1.06, 2.1], y: first.stem!.y } }
    return { ...hisSlur(false), columns: [first, column(5, 5, 1)], endHeadY: [1, 2.5] as const }
  }

  it('`off` (the default): past the stem alone', () => {
    expect(buildSearchState(input(), D).attachments[0][0].x).toBeCloseTo(1.18 + 0.3, 12)
  })

  it('⭐ `on` (LilyPond): past the FLAG', () => {
    const s = buildSearchState(input(), D, { ...LILYPOND_SLUR_RULES, flags: 'on' })
    expect(s.attachments[0][0].x).toBeCloseTo(2.1 + 0.3, 12)
  })
})

describe('⭐ row G — a TUPLET NUMBER over the slur\'s notes (`tupletNumbers`)', () => {
  const three = { x: [4, 4.6] as const, y: [3, 4] as const }

  it('`off` (the default): not read', () => {
    expect(buildSearchState({ ...hisSlur(false), tupletNumbers: [three] }, D).extraInfos).toHaveLength(0)
  })

  it('⭐ `on` (LilyPond): an `inside` object — scored at 50, and its top an avoid-point', () => {
    const s = buildSearchState({ ...hisSlur(false), tupletNumbers: [three] }, D, { ...LILYPOND_SLUR_RULES, tupletNumbers: 'on' })
    expect(s.extraInfos).toHaveLength(1)
    expect(s.extraInfos[0].penalty).toBe(D.extraObjectCollisionPenalty)
    expect(s.avoid).toContainEqual({ x: 4.3, y: 4 })
  })
})

describe('⭐ row G — a clef, key or meter change inside the slur (`headerSigns`)', () => {
  // A sign standing high in the middle of his slur.
  const sign = { x: [5, 6] as const, y: [0, 6] as const }

  it('`off` (the default): not read', () => {
    expect(buildSearchState({ ...hisSlur(false), headerSigns: [sign] }, D).extraInfos).toHaveLength(0)
  })

  it('⭐ `on` (LilyPond): scored and an avoid-point — ⛔ but it never widens an end\'s range', () => {
    const plain = buildSearchState(hisSlur(false), D)
    const s = buildSearchState({ ...hisSlur(false), headerSigns: [sign] }, D, { ...LILYPOND_SLUR_RULES, headerSigns: 'on' })
    expect(s.extraInfos).toHaveLength(1)
    expect(s.extraInfos[0].headerSign).toBe(true)
    expect(s.avoid).toContainEqual({ x: 5.5, y: 6 })
    // The same candidate ends as with no sign at all: `fill`'s `additional_ys` skips header signs.
    expect(s.attachments).toEqual(plain.attachments)
  })
})

describe('⭐ `midAccent` — his T1 rule for an accent on a MIDDLE note', () => {
  const accent = (onEnd: boolean) => ({ x: [4, 5] as const, y: [5, 5.7] as const, avoid: 'around' as const, accent: { onEnd } })

  it('⭐ `inside` (the default): a middle note\'s accent is an `inside` object — an avoid-point for the arch', () => {
    const s = buildSearchState({ ...hisSlur(false), objects: [accent(false)] }, D)
    expect(s.extraInfos[0].avoid).toBe('inside')
    expect(s.avoid).toContainEqual({ x: 4.5, y: 5.7 })
  })

  it('an END note\'s accent is left `around` — T1 puts it outside, which moves the mark (L2)', () => {
    expect(buildSearchState({ ...hisSlur(false), objects: [accent(true)] }, D).extraInfos[0].avoid).toBe('around')
  })

  it('`lilypond`: `around`, as LilyPond hands it over', () => {
    const s = buildSearchState({ ...hisSlur(false), objects: [accent(false)] }, D, { ...LILYPOND_SLUR_RULES, midAccent: 'lilypond' })
    expect(s.extraInfos[0].avoid).toBe('around')
  })
})

describe('⭐ `endHead` — the end head\'s own extent', () => {
  // The first column's slur-side head is DISPLACED right of the chord's span start, and taller than ±½.
  const input = () => {
    const first = column(0, 0, -1)
    return {
      ...hisSlur(false),
      columns: [{ ...first, ownSlurHead: { x: [1.1, 2.3] as const, y: [-0.55, 0.62] as const }, ownFirstHeadX: [0, 1.18] as const }, ...hisSlur(false).columns.slice(1)],
    }
  }

  it('`chord` (the default): the chord\'s span — the base x is its centre', () => {
    expect(buildSearchState(input(), D).baseAttachments[0].x).toBeCloseTo(0.59, 12)
  })

  it('⭐ `own` (LilyPond): the base sits on the slur-side head\'s OWN glyph top, x from the first head', () => {
    const s = buildSearchState(input(), D, { ...LILYPOND_SLUR_RULES, endHead: 'own' })
    expect(s.baseAttachments[0].x).toBeCloseTo(0.59, 12)
    expect(s.baseAttachments[0].y).toBeCloseTo(0.62 + 0.5, 12)
  })
})

describe('⭐ `rests` — a rest at the slur\'s end', () => {
  // The END is a quarter rest: its glyph 1.08 wide, from −1.5 to +1.49 around the middle line, at x 11.
  const input = () => {
    const rest = { ...column(11, 0, -1), restExtent: { x: [11, 12.08] as const, y: [-1.5, 1.49] as const } }
    return { ...hisSlur(false), columns: [...hisSlur(false).columns.slice(0, 4), rest], endHeadY: [0, 0] as const }
  }

  it('`asNote` (the default): a one-space "head" — the base attachment sits inside the rest', () => {
    expect(buildSearchState(input(), D).baseAttachments[1].y).toBeLessThan(1.49)
  })

  it('⭐ `lilypond`: the rest glyph is the head — the base clears its top, over its centre, with no stem', () => {
    const s = buildSearchState(input(), D, { ...LILYPOND_SLUR_RULES, rests: 'lilypond' })
    // 1.99 lands on the TOP LINE (2.0), so LilyPond moves it 0.15 off (`move_away_from_staffline`).
    expect(s.baseAttachments[1].y).toBeCloseTo(1.49 + 0.5 + 0.15, 12)
    // With no first head, LilyPond centres on the note COLUMN's extent (`bound->extent (X).center ()`) — here the
    // fixture's column, 11 … 12.18; the adapter hands the rest glyph's own box as that column.
    expect(s.baseAttachments[1].x).toBeCloseTo(11.59, 12)
    expect(s.bounds[1].stem).toBeUndefined()
  })
})
