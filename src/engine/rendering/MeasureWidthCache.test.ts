// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { MeasureWidthCache } from './MeasureWidthCache'
import { getStaves } from '../models/staffContent'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import type { Score } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * P2 — memoize each (measure, staff) lane's note-space width, keyed by the lane's CONTENT
 * (docs/render-performance-plan.md §4).
 *
 * The whole bet is that a fingerprint cannot go stale. So these tests are not about speed; they
 * are about the one way a memo can be worse than no memo: **returning a width for content that
 * has changed.** Every operation that rewrites a measure — a note added, a pitch changed, an
 * accidental forced, a meter change, a paste, an undo — must produce a different width where the
 * width really differs, with the cache on.
 */
function clefsOf(score: Score): Map<string | undefined, StaffClefs> {
  return new Map(getStaves(score).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

/** Widths of every measure, computed with `cache` (or without, when omitted). */
function widths(score: Score, cache?: MeasureWidthCache): number[] {
  const result = calculateMeasureWidths(score, clefsOf(score), 'linear', cache)
  return score.measures.map(m => result.get(m.number)!.minWidth)
}

describe('MeasureWidthCache', () => {
  it('a cached layout equals an uncached one — the memo changes cost, never output', () => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', octave: 4, duration: '8', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'G', octave: 5, duration: 'h', measure: 2, beat: frac(0, 1) })
    const score = model.getScore()

    const cache = new MeasureWidthCache()
    expect(widths(score, cache)).toEqual(widths(score))
    // …and again, now served from the cache rather than the formatter.
    expect(widths(score, cache)).toEqual(widths(score))
  })

  it('an edit to a measure changes ITS width, with the cache warm', () => {
    const model = new ScoreModel()
    const cache = new MeasureWidthCache()

    const before = widths(model.getScore(), cache)[0]

    // Four notes need more room than the bar's single default rest.
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    const after = widths(model.getScore(), cache)[0]

    expect(after).toBeGreaterThan(before)
  })

  it('editing one measure does not change another measure\'s width', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const cache = new MeasureWidthCache()
    const before = widths(model.getScore(), cache)

    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    const after = widths(model.getScore(), cache)

    expect(after[0]).toBeGreaterThan(before[0]) // the bar we touched
    expect(after[1]).toBe(before[1])            // the one we didn't
  })

  it('a forced accidental widens the bar — the glyph set is part of the key, not just the pitches', () => {
    const model = new ScoreModel()
    const cache = new MeasureWidthCache()
    const note = model.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const plain = widths(model.getScore(), cache)[0]

    model.updateNote(note.id, { alter: 1, forceAccidental: true })
    const sharpened = widths(model.getScore(), cache)[0]

    expect(sharpened).toBeGreaterThan(plain)
  })

  it('a meter change re-widths the bar even though its notes are untouched', () => {
    const model = new ScoreModel()
    const cache = new MeasureWidthCache()
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    const common = widths(model.getScore(), cache)[0]

    // The time signature feeds the Voice (and its mode), so it must be in the key.
    model.setTimeSignature(1, { numerator: 2, denominator: 4 })
    const cut = widths(model.getScore(), cache)[0]

    expect(cut).not.toBe(common)
  })

  it('undo restores the earlier width — a fingerprint has no notion of "newer"', () => {
    const model = new ScoreModel()
    const cache = new MeasureWidthCache()
    const empty = widths(model.getScore(), cache)[0]

    const json = model.toJSON()
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'F', octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    expect(widths(model.getScore(), cache)[0]).toBeGreaterThan(empty)

    // Undo is just "some other content" to the cache — the old key is still valid.
    const restored = ScoreModel.fromJSON(json)
    expect(widths(restored.getScore(), cache)[0]).toBe(empty)
  })

  it('caps its size rather than growing forever', () => {
    const cache = new MeasureWidthCache()
    for (let i = 0; i < 60_000; i++) cache.set(`k${i}`, i)
    expect(cache.size).toBeLessThanOrEqual(50_000)
  })
})
