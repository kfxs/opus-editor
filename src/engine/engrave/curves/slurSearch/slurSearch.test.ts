/**
 * ⭐⭐ The search itself (`./slurSearch`) — docs/plans/slur-search-plan.md P2. The property it owes is that the
 * LAZY queue answers exactly what scoring every candidate would: demerits only grow, so a partial score is
 * a lower bound, and stopping at the first finished best cannot skip a cheaper one.
 */
import { describe, it, expect } from 'vitest'
import { scoreFully, searchCandidates, searchSlur } from './slurSearch'
import { buildSearchState, type SlurSearchInput } from './searchState'
import { LILYPOND_SLUR_DETAILS as D, LILYPOND_SLUR_RULES } from './searchDetails'
import { column, hisSlur } from './searchFixture'

/** The winner by brute force: every candidate fully scored, cheapest first, the lower index on a tie. */
function exhaustive(input: SlurSearchInput) {
  const state = buildSearchState(input, D)
  const all = searchCandidates(state).map(c => scoreFully(state, c))
  return all.reduce((a, b) => (b.score < a.score ? b : a))
}

const CASES: Array<[string, SlurSearchInput]> = [
  ['his slur, E♮', hisSlur(false)],
  ['his slur, E♭', hisSlur(true)],
  ['his slur, E♭, the bar widened', hisSlur(true, 5.1)],
  ['a high note under a low slur', { ...hisSlur(false), columns: [column(0, 0, -1), column(5.5, 7, -1), column(11, 0, -1)], endHeadY: [0, 0] }],
  ['a broken piece — the begin', { ...hisSlur(true), columns: hisSlur(true).columns.slice(0, 2), brokenX: [undefined, 6] }],
  ['a broken piece — the end', { ...hisSlur(false), columns: hisSlur(false).columns.slice(2), brokenX: [5, undefined] }],
  ['a broken piece — a middle', { ...hisSlur(false), columns: hisSlur(false).columns.slice(1, 4), brokenX: [2, 10] }],
  ['row B `house`, his D → G', { ...hisSlur(false), columns: [column(0, 2, 1), column(4, 5, 1)], endHeadY: [1, 2.5] }],
  ['below the notes', { ...hisSlur(false), dir: -1, columns: [column(0, -4, 1), column(4, -7, 1), column(8, -3, 1)], endHeadY: [-2, -1.5] }],
]

describe('searchSlur', () => {
  it.each(CASES)('⭐⭐ the lazy queue picks what scoring EVERY candidate picks — %s', (_, input) => {
    const lazy = searchSlur(input)!
    const brute = exhaustive(input)
    expect(lazy.score).toBe(brute.score)
    expect(lazy.index).toBe(brute.index)
  })

  it('⭐ with nothing in the way, the base attachments win at no cost — after only four scorer runs', () => {
    const r = searchSlur(hisSlur(false))!
    expect(r.index).toBe(0)
    expect(r.score).toBe(0)
    expect(r.scorerRuns).toBe(4)
  })

  it('⭐ a high note under the slur is cleared — by moving the ENDS or raising the arch, never through it', () => {
    const r = searchSlur(CASES[3][1])!
    expect(r.card.join()).not.toMatch(/encompass=1\d{3}/)
    expect(r.score).toBeLessThan(D.headEncompassPenalty)
  })

  it('an empty slur has nothing to search', () => {
    expect(searchSlur({ ...hisSlur(false), columns: [] })).toBeNull()
  })

  it('⚠️ his E♭ (one staff): LilyPond\'s defaults ACCEPT a graze of the flat — it costs 3, moving the near end ~1.5 sp costs more', () => {
    // Recorded, not endorsed (docs/plans/slur-search-plan.md P2 note): this is the port's answer on a
    // hand-measured fixture; P4 compares real pictures.
    const r = searchSlur(hisSlur(true))!
    expect(r.card).toEqual([`extra=${D.accidentalCollision.toFixed(2)}`])
  })
})

describe('⭐ row A — an unbeamed end on the STEM side (P8; his D → G, both stems up, slur above)', () => {
  const dToG = (): SlurSearchInput => ({
    ...hisSlur(false), columns: [column(0, 2, 1), column(4, 5, 1)], endHeadY: [1, 2.5],
  })

  it('`head` (LilyPond, the default): the ends stay at the heads — the base attachments, at no cost', () => {
    const r = searchSlur(dToG())!
    expect(r.index).toBe(0)
    expect(r.score).toBe(0)
  })

  it('⭐ `stem` (Gould p. 111): the ends go to the STEM ends — ½ sp past each tip', () => {
    const r = searchSlur(dToG(), D, { ...LILYPOND_SLUR_RULES, stemSideEnd: 'stem' })!
    // D5's stem runs 1 → 4.5, G5's 2.5 → 6: each end at the enumeration step nearest ½ sp past its tip.
    expect(r.ends[0].y).toBeGreaterThanOrEqual(4.5)
    expect(r.ends[1].y).toBeGreaterThanOrEqual(6)
  })

  it('…and the lazy queue still answers what scoring every candidate would', () => {
    const state = buildSearchState(dToG(), D, { ...LILYPOND_SLUR_RULES, stemSideEnd: 'stem' })
    const all = searchCandidates(state).map(c => scoreFully(state, c))
    const brute = all.reduce((a, b) => (b.score < a.score ? b : a))
    expect(searchSlur(dToG(), D, { ...LILYPOND_SLUR_RULES, stemSideEnd: 'stem' })!.index).toBe(brute.index)
  })
})

describe('⭐ row C — how much the slur tilts with the melody (P8)', () => {
  // A4 (stem up) → B4 (stem down): OPPOSITE stems, the slur above — Gould p. 111's own case; and C4 → E5.
  const pair = (from: [number, 1 | -1], to: [number, 1 | -1]): SlurSearchInput => ({
    ...hisSlur(false), columns: [column(0, from[0], from[1]), column(4, to[0], to[1])],
    endHeadY: [from[0] / 2, to[0] / 2],
  })
  const rise = (input: SlurSearchInput, tilt: 'lilypond' | 'house') => {
    const r = searchSlur(input, D, { ...LILYPOND_SLUR_RULES, tilt })!
    return r.curve[3].y - r.curve[0].y
  }

  it('⭐ `house`: over opposite stems the rise is held to about HALF the interval — `lilypond` lets it follow', () => {
    // C4 (−6) → E5 (3): 4.5 sp apart.
    const tenth = pair([-6, 1], [3, -1])
    expect(rise(tenth, 'house')).toBeLessThanOrEqual(4.5 / 2 + 0.2 + 1e-9)
    expect(rise(tenth, 'lilypond')).toBeGreaterThan(rise(tenth, 'house'))
  })

  it('stems that AGREE keep LilyPond\'s allowance — Gould\'s rule is for opposite stems only', () => {
    const agree = pair([-4, 1], [-1, 1])
    expect(rise(agree, 'house')).toBe(rise(agree, 'lilypond'))
  })
})
