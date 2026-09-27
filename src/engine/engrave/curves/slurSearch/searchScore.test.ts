/** What a candidate costs (`./searchScore`) — LilyPond's four scorers. */
import { describe, it, expect } from 'vitest'
import { peakAround, scoreEdges, scoreEncompass, scoreExtraEncompass, scoreSlopes, type SlurCandidate } from './searchScore'
import { buildSearchState } from './searchState'
import { generateCurve } from './searchCurve'
import { LILYPOND_SLUR_DETAILS as D } from './searchDetails'
import { column, hisSlur } from './searchFixture'
import type { Offset } from './bezier'

const candidate = (state: ReturnType<typeof buildSearchState>, ends: readonly [Offset, Offset]): SlurCandidate => {
  const { curve, height } = generateCurve(state, ends)
  return { index: 0, ends, curve, height, score: 0, card: [], scored: 0 }
}

describe('peakAround', () => {
  it('⭐ 1 at a collision, falling to 0 at the free distance', () => {
    expect(peakAround(0.03, 0.3, -1)).toBe(1)
    expect(peakAround(0.03, 0.3, 0)).toBe(1)
    expect(peakAround(0.03, 0.3, 0.3)).toBe(0)
    expect(peakAround(0.03, 0.3, 1)).toBe(0)
    const mid = peakAround(0.03, 0.3, 0.1)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
})

describe('scoreEdges', () => {
  it('⭐ at the base attachments an end costs nothing; each space outward costs `edge-attraction-factor`', () => {
    const s = buildSearchState(hisSlur(false), D)
    const base = candidate(s, s.baseAttachments)
    scoreEdges(s, base)
    expect(base.score).toBe(0)
    const raised = candidate(s, [{ ...s.baseAttachments[0], y: s.baseAttachments[0].y + 1 }, s.baseAttachments[1]])
    scoreEdges(s, raised)
    const slope = (raised.ends[1].y - raised.ends[0].y) / (raised.ends[1].x - raised.ends[0].x)
    // LEFT end, slur above: × exp(dir · d · slope · 1.7) with d = −1.
    expect(raised.score).toBeCloseTo(D.edgeAttractionFactor * 1 * Math.exp(-slope * D.edgeSlopeExponent), 12)
  })
})

describe('scoreSlopes', () => {
  it('⭐ a slur sloped over music that does not move pays `non-horizontal-penalty`', () => {
    const level = { ...hisSlur(false), endHeadY: [0, 0] as const }
    const s = buildSearchState(level, D)
    const flatC = candidate(s, [{ x: 0.5, y: 1 }, { x: 11.5, y: 1 }])
    scoreSlopes(s, flatC)
    expect(flatC.score).toBe(0)
    const tilted = candidate(s, [{ x: 0.5, y: 1 }, { x: 11.5, y: 1.1 }])
    scoreSlopes(s, tilted)
    expect(tilted.score).toBe(D.nonHorizontalPenalty)
  })

  it('…and one sloped AGAINST the music pays `same-slope-penalty` on top', () => {
    const s = buildSearchState(hisSlur(false), D) // the music rises 2.5
    const against = candidate(s, [{ x: 0.5, y: 2 }, { x: 11.5, y: 1.5 }])
    scoreSlopes(s, against)
    expect(against.card).toEqual([`slope=${D.sameSlopePenalty.toFixed(2)}`])
  })
})

describe('scoreEncompass', () => {
  it('⭐ a head the curve passes THROUGH costs `head-encompass-penalty`', () => {
    const input = hisSlur(false)
    // A high note in the middle — G5 at x 5.5 — under a low, flat slur.
    const s = buildSearchState({ ...input, columns: [input.columns[0], column(5.5, 5, -1), input.columns[4]] }, D)
    // A hand-made flat curve at y 1 — `generateCurve` would raise the arch over the head, which is the
    // point of it, so the scorer is handed a curve that did not.
    const ends = [{ x: 0.5, y: 1 }, { x: 11.5, y: 1 }] as const
    const low: SlurCandidate = {
      index: 0, ends, height: 0.2, score: 0, card: [], scored: 0,
      curve: [ends[0], { x: 3, y: 1.2 }, { x: 9, y: 1.2 }, ends[1]],
    }
    scoreEncompass(s, low)
    expect(low.score).toBeGreaterThanOrEqual(D.headEncompassPenalty)
  })
})

describe('scoreExtraEncompass', () => {
  it('⭐ a curve through the flat pays the whole `accidental-collision`, a curve clear of it nothing', () => {
    const s = buildSearchState(hisSlur(true), D)
    const through = candidate(s, s.baseAttachments)
    scoreExtraEncompass(s, through)
    expect(through.score).toBe(D.accidentalCollision)
    const high = candidate(s, [{ x: 0.5, y: 5 }, { x: 11.5, y: 5 }])
    scoreExtraEncompass(s, high)
    expect(high.score).toBe(0)
  })

  it('an end on a tie\'s end pays `slur-tie-extrema-min-distance-penalty`', () => {
    const s = buildSearchState({ ...hisSlur(false), tieEnds: [{ x: 0.59, y: 1.15 }] }, D)
    const c = candidate(s, s.baseAttachments)
    scoreExtraEncompass(s, c)
    expect(c.score).toBe(D.slurTieExtremaMinDistancePenalty)
  })
})
