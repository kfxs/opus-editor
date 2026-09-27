/**
 * ⭐⭐ The search itself (`./slurSearch`) — docs/plans/slur-search-plan.md P2. The property it owes is that the
 * LAZY queue answers exactly what scoring every candidate would: demerits only grow, so a partial score is
 * a lower bound, and stopping at the first finished best cannot skip a cheaper one.
 */
import { describe, it, expect } from 'vitest'
import { scoreFully, searchCandidates, searchSlur } from './slurSearch'
import { buildSearchState, type SlurSearchInput } from './searchState'
import { LILYPOND_SLUR_DETAILS as D } from './searchDetails'
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
