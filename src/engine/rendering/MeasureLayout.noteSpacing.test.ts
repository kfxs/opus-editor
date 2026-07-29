import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { spacingPositionKey, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from '../models/engravingOverrides'
import { calculateMeasureWidths } from './MeasureLayout'
import { LAYOUT_CONFIG } from './layoutConfig'
import { resolveSurface, SKETCH_CANVAS } from '@/engine/layout/surface'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { fracCreate } from '@/utils/fraction'
import type { Score } from '@/types/music'

/**
 * ⚠️ These suites are about the JUSTIFIER, so they ask for a justified last line EXPLICITLY.
 * The app's default is now ragged (LilyPond's `ragged-last`) — a half-empty final system stretched
 * across the page reads as a mistake rather than as music — and under that default "every line
 * lands exactly on availableWidth" is false of the last line by design, not by bug. Passing the
 * flag keeps these testing what they mean to test.
 */
/**
 * The width and justification halves of note spacing (docs/note-spacing-plan.md §2–§3).
 *
 * The one sentence these all test: **a space is not an offset — it has width.** So it survives the
 * intrinsic clamps, it reaches the break pass, and the stretcher hands it back instead of sharing
 * it out.
 */
const AVAILABLE = resolveSurface(SKETCH_CANVAS).contentWidthPx

function clefs(score: Score): Map<string | undefined, StaffClefs> {
  return new Map((score.staves ?? [{ id: undefined }]).map(s => [s.id, resolveStaffClefs(score, s.id)]))
}

function scoreWith(measureCount: number) {
  const model = new ScoreModel()
  while (model.getScore().measures.length < measureCount) model.addMeasure()
  return model
}

/** Author `spaces` staff-spaces before beat 1 of bar `n` (1-based). */
function space(model: ScoreModel, n: number, spaces: number) {
  const measure = model.getScore().measures[n - 1]
  model.setNoteSpacing(spacingPositionKey(measure.id, fracCreate(1, 1)), spaces, -100)
}

describe('note spacing — width (§2)', () => {
  it('the bar grows by exactly the authored space', () => {
    const model = scoreWith(4)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' })
    space(model, 2, 3)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' })
    expect(after.get(2)!.minWidth - before.get(2)!.minWidth)
      .toBeCloseTo(3 * VEXFLOW_DEFAULT_STAFF_SPACE_PX, 6)
  })

  it('reports the authored slice separately from the engraver’s', () => {
    const model = scoreWith(2)
    space(model, 1, 2)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' }).get(1)!
    expect(info.userSpace).toBe(2 * VEXFLOW_DEFAULT_STAFF_SPACE_PX)
    expect(info.minWidth - info.userSpace!).toBeLessThanOrEqual(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
  })

  it('a bar nobody touched carries no authored space', () => {
    const model = scoreWith(2)
    space(model, 1, 2)
    expect(calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' }).get(2)!.userSpace)
      .toBe(0)
  })

  it('survives MAX_MEASURE_WIDTH — the cap is on the intrinsic width, not on the drag', () => {
    // Push the intrinsic width hard against the 400px cap, then keep spacing. Every added
    // staff-space must still show up, or the drag dies silently at the clamp.
    const model = scoreWith(2)
    space(model, 1, 40)
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' }).get(1)!
    expect(info.minWidth).toBeGreaterThan(LAYOUT_CONFIG.MAX_MEASURE_WIDTH)
    expect(info.minWidth).toBeCloseTo(info.minWidth - info.userSpace! + 40 * VEXFLOW_DEFAULT_STAFF_SPACE_PX, 6)
  })

  it('reaches the break pass: enough space re-wraps the line', () => {
    const model = scoreWith(6)
    const linesBefore = new Set(
      [...calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true }).values()].map(i => i.lineNumber),
    ).size
    for (let n = 1; n <= 6; n++) space(model, n, 8)
    const linesAfter = new Set(
      [...calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true }).values()].map(i => i.lineNumber),
    ).size
    expect(linesAfter).toBeGreaterThan(linesBefore)
  })
})

describe('note spacing — justification (§3)', () => {
  it('the gap you drag is the gap you get: the space is NOT diluted by the stretcher', () => {
    const model = scoreWith(4)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    space(model, 2, 4)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })

    const intrinsicBefore = before.get(2)!.finalWidth
    const intrinsicAfter = after.get(2)!.finalWidth - after.get(2)!.userSpace!
    // Bar 2 keeps its full 40px on top; its intrinsic share shrinks a little, as do the others'.
    expect(after.get(2)!.finalWidth).toBeGreaterThan(intrinsicBefore)
    expect(intrinsicAfter).toBeLessThan(intrinsicBefore)
  })

  it('the line still lands exactly on the available width', () => {
    const model = scoreWith(4)
    space(model, 3, 5)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    const line0 = [...widths.values()].filter(i => i.lineNumber === 0)
    expect(line0.reduce((s, i) => s + i.finalWidth, 0)).toBeCloseTo(AVAILABLE, 6)
  })

  it('the cost is paid by the OTHER bars, proportionally', () => {
    const model = scoreWith(4)
    const before = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    space(model, 1, 4)
    const after = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    for (const n of [2, 3, 4]) {
      if (after.get(n)!.lineNumber !== after.get(1)!.lineNumber) continue
      expect(after.get(n)!.finalWidth).toBeLessThan(before.get(n)!.finalWidth)
    }
  })

  it('caps the line’s total authored space — no negative widths, nothing off the page', () => {
    const model = scoreWith(3)
    for (let n = 1; n <= 3; n++) space(model, n, 200) // 6000px of space on a 960px line
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    for (const info of widths.values()) {
      expect(info.finalWidth).toBeGreaterThan(0)
      expect(info.finalWidth).toBeLessThanOrEqual(AVAILABLE + 1e-6)
    }
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })

  it('one bar alone on its line cannot hand its space back through the right margin', () => {
    const model = scoreWith(1)
    space(model, 1, 90) // 900px on a 960px line, alone
    const info = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true }).get(1)!
    expect(info.finalWidth).toBeCloseTo(AVAILABLE, 6)
  })

  it('linear view is already exact — nothing is justified, so the space is verbatim', () => {
    const model = scoreWith(3)
    space(model, 2, 6)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'linear' })
    expect(widths.get(2)!.finalWidth).toBe(widths.get(2)!.minWidth)
    expect(widths.get(2)!.userSpace).toBe(6 * VEXFLOW_DEFAULT_STAFF_SPACE_PX)
  })

  it('an untouched score justifies exactly as before', () => {
    const model = scoreWith(5)
    const widths = calculateMeasureWidths(model.getScore(), clefs(model.getScore()), { mode: 'wrapped', justifyLastLine: true })
    for (const line of new Set([...widths.values()].map(i => i.lineNumber))) {
      const total = [...widths.values()].filter(i => i.lineNumber === line).reduce((s, i) => s + i.finalWidth, 0)
      expect(total).toBeCloseTo(AVAILABLE, 6)
    }
  })
})
