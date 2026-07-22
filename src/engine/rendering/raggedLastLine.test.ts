/**
 * Justify the last system, or leave it ragged.
 *
 * Stretching a half-empty final system across the page is what Finale and Sibelius do, and what
 * this always did. LilyPond's `ragged-last` is true by default, MuseScore makes it a setting, and a
 * final system of one bar spread over the whole width reads as a mistake rather than as music.
 * Both are legitimate — hence a knob.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { barWidthKey, BAR_STRETCH_MIN } from '../models/engravingOverrides'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import type { Score } from '@/types/music'

const AVAILABLE = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2

function clefs(score: Score): Map<string | undefined, StaffClefs> {
  return new Map((score.staves ?? [{ id: undefined }]).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

function scoreWith(measureCount: number) {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  return model
}

const widths = (model: ScoreModel, justifyLastLine: boolean) =>
  calculateMeasureWidths(model.getScore(), clefs(model.getScore()), 'wrapped', undefined, justifyLastLine)

/** The measures of the highest-numbered system. */
const lastLine = (w: ReturnType<typeof widths>) => {
  const last = Math.max(...[...w.values()].map(i => i.lineNumber))
  return [...w.values()].filter(i => i.lineNumber === last)
}

describe('the last system — justified or ragged', () => {
  it('justified (the default) fills the page, however few bars it holds', () => {
    const model = scoreWith(11) // wraps, so the last line is a short remainder
    const line = lastLine(widths(model, true))
    expect(line.length).toBeLessThan(9) // a remainder, or this asserts nothing
    expect(line.reduce((sum, i) => sum + i.finalWidth, 0)).toBeCloseTo(AVAILABLE, 6)
  })

  it('⭐ ragged leaves it at its natural width — the bars keep what they ask for', () => {
    const model = scoreWith(11)
    const line = lastLine(widths(model, false))
    const total = line.reduce((sum, i) => sum + i.finalWidth, 0)
    expect(total).toBeLessThan(AVAILABLE)
    for (const info of line) expect(info.finalWidth).toBeCloseTo(info.minWidth, 6)
  })

  it('touches ONLY the last system — every full line is still justified', () => {
    const model = scoreWith(11)
    const w = widths(model, false)
    const last = Math.max(...[...w.values()].map(i => i.lineNumber))
    for (let line = 0; line < last; line++) {
      const total = [...w.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect({ line, total: Math.round(total) }).toEqual({ line, total: Math.round(AVAILABLE) })
    }
  })

  it('a score that fits on ONE line is that one line — ragged means ragged from the start', () => {
    const model = scoreWith(3)
    const total = lastLine(widths(model, false)).reduce((sum, i) => sum + i.finalWidth, 0)
    expect(total).toBeLessThan(AVAILABLE)
    expect(lastLine(widths(model, true)).reduce((sum, i) => sum + i.finalWidth, 0)).toBeCloseTo(AVAILABLE, 6)
  })

  it('⭐ ragged-RIGHT, never past the margin: an over-asking last line is still squeezed in', () => {
    // The knob only ever declines to ADD space. A last line whose bars already want more than the
    // page has (here, a stretched bar) must still be distributed, or music goes through the edge.
    // A last line can only over-ask one way: pass 1 admits a bar while the line still fits, so the
    // sole over-committed case is a single bar worth more than the whole page.
    const model = scoreWith(2)
    const last = model.getScore().measures[1]
    model.setBarWidth(barWidthKey(last.id), 40, BAR_STRETCH_MIN)
    const line = lastLine(widths(model, false))
    // The LINE's total, not each bar's — a per-bar check passes even with the guard gone, which is
    // how the first version of this test asserted nothing.
    const total = line.reduce((sum, i) => sum + i.finalWidth, 0)
    expect(total).toBeLessThanOrEqual(AVAILABLE + 1e-6)
    expect(line.reduce((sum, i) => sum + i.minWidth, 0)).toBeGreaterThan(AVAILABLE) // …and it DID over-ask
  })

  it('⭐ a bar grown on a RAGGED line takes room from nobody — the line just gets longer', () => {
    // The consequence of raggedness for the bar-width gesture, and it caught three tests when the
    // default flipped. Justification is what makes growth a TRANSFER: the page total is fixed, so
    // what one bar gains its neighbours pay. A ragged line has no fixed total, so a grown bar
    // simply extends it and nothing else moves. Both are right; they are different lines.
    const model = scoreWith(3) // one system, therefore the last one
    const raggedBefore = widths(model, false)
    const justifiedBefore = widths(model, true)
    const neighbours = [2, 3]
    const raggedWas = neighbours.map(n => raggedBefore.get(n)!.finalWidth)

    model.setBarWidth(barWidthKey(model.getScore().measures[0].id), 2, BAR_STRETCH_MIN)
    const raggedAfter = widths(model, false)
    const justifiedAfter = widths(model, true)

    // Ragged: bar 1 grew and NOBODY paid — the line simply got longer.
    expect(raggedAfter.get(1)!.finalWidth).toBeGreaterThan(raggedBefore.get(1)!.finalWidth)
    expect(neighbours.map(n => raggedAfter.get(n)!.finalWidth)).toEqual(raggedWas)

    // Justified: the same growth, and the neighbours are the ones who pay for it. (Compared
    // against the justified line WITHOUT the growth — a justified bar is wider than a ragged one
    // either way, so comparing the two modes to each other measures nothing.)
    for (const n of neighbours) {
      expect(justifiedAfter.get(n)!.finalWidth).toBeLessThan(justifiedBefore.get(n)!.finalWidth)
    }
  })
})
