import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import type { Clef } from '@/types/music'

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

const trebleEverywhere = (count: number): Map<number, Clef> =>
  new Map(Array.from({ length: count }, (_, i) => [i + 1, 'treble' as Clef]))

describe('calculateMeasureWidths — linear mode', () => {
  const COUNT = 20

  it('never breaks: every measure lands on line 0', () => {
    const widths = calculateMeasureWidths(scoreWith(COUNT), trebleEverywhere(COUNT), 'linear')
    expect(widths.size).toBe(COUNT)
    for (const info of widths.values()) expect(info.lineNumber).toBe(0)
  })

  it('never justifies: final width is the intrinsic width', () => {
    const widths = calculateMeasureWidths(scoreWith(COUNT), trebleEverywhere(COUNT), 'linear')
    for (const info of widths.values()) expect(info.finalWidth).toBe(info.minWidth)
  })

  it('only the first measure opens a line, so only it pays for a full clef', () => {
    const widths = calculateMeasureWidths(scoreWith(COUNT), trebleEverywhere(COUNT), 'linear')
    const first = widths.get(1)!
    const second = widths.get(2)!
    // Same content (both empty), so the difference is exactly the clef + the meter glyph that
    // measure 1 alone draws. Bar 2 is a bare empty bar at the floor width.
    expect(first.minWidth).toBeGreaterThan(second.minWidth)
    expect(second.minWidth).toBe(LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
  })

  it('wrapped mode still breaks the same score into several lines', () => {
    const widths = calculateMeasureWidths(scoreWith(COUNT), trebleEverywhere(COUNT), 'wrapped')
    const lines = new Set([...widths.values()].map(i => i.lineNumber))
    expect(lines.size).toBeGreaterThan(1)
  })

  it('defaults to wrapped when no mode is passed', () => {
    const score = scoreWith(COUNT)
    const clefs = trebleEverywhere(COUNT)
    expect(calculateMeasureWidths(score, clefs)).toEqual(calculateMeasureWidths(score, clefs, 'wrapped'))
  })
})
