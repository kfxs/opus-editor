import { describe, it, expect } from 'vitest'
import { bandOver, markBand, measureStartOffsets, type OccupiedSpan } from './outsideStaffBand'
import type { Fraction, Score, Measure } from '@/types/music'

const f = (num: number, den = 1): Fraction => ({ num, den })

const bar = (number: number, beats = 4): Measure => ({
  id: `m${number}`,
  number,
  slots: [],
  timeSignature: { numerator: beats, denominator: 4 },
  tuplets: [],
})

const score = (...measures: Measure[]): Score =>
  ({ id: 's', title: 't', measures } as Score)

const claim = (over: Partial<OccupiedSpan> = {}): OccupiedSpan => ({
  line: 0,
  staffId: undefined,
  side: 'above',
  from: f(0),
  to: f(4),
  band: { top: -3, bottom: -1 },
  ...over,
})

describe('measureStartOffsets — the ladder’s shared horizontal axis', () => {
  it('accumulates each bar’s capacity, so bar n starts where bar n-1 ended', () => {
    const starts = measureStartOffsets(score(bar(1), bar(2), bar(3)))
    expect(starts.get(1)).toEqual(f(0, 1))
    expect(starts.get(2)).toEqual(f(4, 1))
    expect(starts.get(3)).toEqual(f(8, 1))
  })

  it('follows a METER CHANGE rather than assuming a constant bar length', () => {
    const starts = measureStartOffsets(score(bar(1, 3), bar(2, 4), bar(3)))
    expect(starts.get(2)).toEqual(f(3, 1))
    expect(starts.get(3)).toEqual(f(7, 1))
  })

  it('sorts by measure number, so an out-of-order array cannot skew the axis', () => {
    const starts = measureStartOffsets(score(bar(3), bar(1), bar(2)))
    expect(starts.get(1)).toEqual(f(0, 1))
    expect(starts.get(3)).toEqual(f(8, 1))
  })
})

describe('markBand — a baseline plus the mark’s own ink', () => {
  it('grows UP by `above` and DOWN by `below` on the downward-positive axis', () => {
    expect(markBand(-2, { above: 1.5, below: 0.5 })).toEqual({ top: -3.5, bottom: -1.5 })
  })

  it('grows the same way BELOW the staff — the side moved the baseline, not the glyph', () => {
    expect(markBand(6, { above: 1.5, below: 0.5 })).toEqual({ top: 4.5, bottom: 6.5 })
  })
})

describe('bandOver — what an outer family must clear', () => {
  it('is null when nothing has been placed', () => {
    expect(bandOver([], 0, undefined, 'above', f(0), f(4), undefined)).toBeNull()
  })

  it('returns a claim that overlaps the asked range', () => {
    const occupied = [claim({ from: f(2), to: f(6), band: { top: -4, bottom: -2 } })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(3), undefined))
      .toEqual({ top: -4, bottom: -2 })
  })

  it('MERGES every overlapping claim into one band — the outer family is one line', () => {
    const occupied = [
      claim({ from: f(0), to: f(2), band: { top: -3, bottom: -1 } }),
      claim({ from: f(1), to: f(3), band: { top: -6, bottom: -5 } }),
    ]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined))
      .toEqual({ top: -6, bottom: -1 })
  })

  it('ignores a claim that does not overlap at all', () => {
    const occupied = [claim({ from: f(8), to: f(12) })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined)).toBeNull()
  })

  it('⭐ counts a POINT claim (a letter, from === to) inside the range', () => {
    const occupied = [claim({ from: f(2), to: f(2) })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined)).not.toBeNull()
  })

  it('⭐ counts a claim that merely TOUCHES the range’s edge — closed intervals, the safe direction', () => {
    const occupied = [claim({ from: f(4), to: f(8) })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined)).not.toBeNull()
  })

  it('does not let a claim on ANOTHER SYSTEM reach this one, same beats and all', () => {
    const occupied = [claim({ line: 1 })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined)).toBeNull()
  })

  it('does not let a claim on the OTHER SIDE of the staff reach this one', () => {
    const occupied = [claim({ side: 'below' })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), undefined)).toBeNull()
  })

  it('does not let another STAFF’s claim reach this one', () => {
    const occupied = [claim({ staffId: 'sB' })]
    expect(bandOver(occupied, 0, 'sA', 'above', f(0), f(4), 'sA')).toBeNull()
  })

  // ⚠️⚠️ `staffInkBand`'s trap, and it is silent: the first staff's things carry no `staffId` while
  // the consumer knows that staff by its real id. Compare strictly and the outer family reads NOTHING
  // and draws straight through the inner one — on exactly the scores that have staff ids.
  it('⚠️ normalises the FIRST staff’s undefined id against the consumer’s real one', () => {
    const occupied = [claim({ staffId: undefined })]
    expect(bandOver(occupied, 0, 'sA', 'above', f(0), f(4), 'sA')).not.toBeNull()
  })

  it('⚠️ …and the reverse: a claim carrying the real id, asked for by undefined', () => {
    const occupied = [claim({ staffId: 'sA' })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), 'sA')).not.toBeNull()
  })

  it('⚠️ …but the SECOND staff is still excluded once ids are in play', () => {
    const occupied = [claim({ staffId: 'sB' })]
    expect(bandOver(occupied, 0, undefined, 'above', f(0), f(4), 'sA')).toBeNull()
  })
})
