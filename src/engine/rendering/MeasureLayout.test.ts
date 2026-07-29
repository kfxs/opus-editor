import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import type { Score } from '@/types/music'

/**
 * The linear-view break policy (docs/linear-view-plan.md §P1): one endless system, measures at
 * their intrinsic width. The whole feature is the absence of the two things wrapped view does —
 * breaking and justifying — so that is exactly what these assert.
 */
function scoreWith(measureCount: number) {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  return model.getScore()
}

/** The per-staff clef folds the layout now takes: staffId → { opening, ending }. */
function trebleEverywhere(score: Score, _count: number): Map<string | undefined, StaffClefs> {
  return new Map((score.staves ?? [{ id: undefined }]).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

describe('calculateMeasureWidths — linear mode', () => {
  const COUNT = 20

  it('never breaks: every measure lands on line 0', () => {
    const score = scoreWith(COUNT)
    const widths = calculateMeasureWidths(score, trebleEverywhere(score, COUNT), { mode: 'linear' })
    expect(widths.size).toBe(COUNT)
    for (const info of widths.values()) expect(info.lineNumber).toBe(0)
  })

  it('never justifies: final width is the intrinsic width', () => {
    const score = scoreWith(COUNT)
    const widths = calculateMeasureWidths(score, trebleEverywhere(score, COUNT), { mode: 'linear' })
    for (const info of widths.values()) expect(info.finalWidth).toBe(info.minWidth)
  })

  it('only the first measure opens a line, so only it pays for a full clef', () => {
    const score = scoreWith(COUNT)
    const widths = calculateMeasureWidths(score, trebleEverywhere(score, COUNT), { mode: 'linear' })
    const first = widths.get(1)!
    const second = widths.get(2)!
    // Same content (both empty), so the difference is exactly the clef + the meter glyph that
    // measure 1 alone draws. Bar 2 is a bare empty bar at the width it ASKS FOR — `MIN_MEASURE_WIDTH`.
    // ⚠️ That is `minWidth`, deliberately not `floorWidth`: how far the bar could be FORCED if a
    // neighbour were growing is a different number (~38 here) and belongs to a different question.
    // Briefly the two were collapsed into one, and every empty bar on every page went permanently
    // narrow — 14 bars to a system instead of 9. See `calculateMinimumMeasureWidth`.
    expect(first.minWidth).toBeGreaterThan(second.minWidth)
    expect(second.minWidth).toBe(LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
  })

  it('wrapped mode still breaks the same score into several lines', () => {
    const score = scoreWith(COUNT)
    const widths = calculateMeasureWidths(score, trebleEverywhere(score, COUNT), { mode: 'wrapped' })
    const lines = new Set([...widths.values()].map(i => i.lineNumber))
    expect(lines.size).toBeGreaterThan(1)
  })

  it('defaults to wrapped when no mode is passed', () => {
    const score = scoreWith(COUNT)
    const clefs = trebleEverywhere(score, COUNT)
    expect(calculateMeasureWidths(score, clefs)).toEqual(calculateMeasureWidths(score, clefs, { mode: 'wrapped' }))
  })
})

/**
 * P1 — a measure's width is the width of its WIDEST STAFF, not of every staff's notes poured
 * into one imaginary stream (docs/render-performance-plan.md §3).
 *
 * The old code grouped a measure's slots by *voice* and never filtered by *staff*, so a bar with
 * four notes on each of two staves was formatted as if it held eight notes in one lane. That is
 * both a width nobody asked for and the reason layout cost scaled with the staff count — the
 * formatter was being fed N× the notes.
 */
describe('calculateMeasureWidths — width is per (measure, staff)', () => {
  const STEPS = ['C', 'D', 'E', 'F'] as const

  /** One bar, `staves` staves, each carrying the same four quarter notes. */
  function bar(staves: number): Score {
    const model = new ScoreModel()
    for (let s = 1; s < staves; s++) model.addStaffBelow(s - 1)
    for (let s = 0; s < staves; s++) {
      for (let b = 0; b < 4; b++) {
        model.addNote({
          step: STEPS[b], octave: 4, duration: 'q', measure: 1, beat: { num: b, den: 1 }, staff: s,
        })
      }
    }
    return model.getScore()
  }

  const widthOf = (score: Score) => {
    const clefs = trebleEverywhere(score, score.measures.length)
    return calculateMeasureWidths(score, clefs, { mode: 'linear' }).get(1)!.minWidth
  }

  it('adding a staff with IDENTICAL content does not widen the measure', () => {
    // Every staff needs the same room, so the max over staves is unchanged. Under the old
    // interleaving this bar grew with each staff added.
    const one = widthOf(bar(1))
    expect(widthOf(bar(2))).toBeCloseTo(one, 5)
    expect(widthOf(bar(4))).toBeCloseTo(one, 5)
  })

  it('a busier second staff DOES widen the measure — the max is a real max', () => {
    const model = new ScoreModel()
    model.addStaffBelow(0)
    // Staff 0: one whole note. Staff 1: four quarters — it is the one that needs the room.
    model.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: { num: 0, den: 1 }, staff: 0 })
    for (let b = 0; b < 4; b++) {
      model.addNote({
        step: STEPS[b], octave: 4, duration: 'q', measure: 1, beat: { num: b, den: 1 }, staff: 1,
      })
    }
    const twoStaff = widthOf(model.getScore())

    const sparse = new ScoreModel()
    sparse.addNote({ step: 'C', octave: 4, duration: 'w', measure: 1, beat: { num: 0, den: 1 } })

    expect(twoStaff).toBeGreaterThan(widthOf(sparse.getScore()))
    expect(twoStaff).toBeCloseTo(widthOf(bar(1)), 5) // exactly the busy staff's own width
  })
})
