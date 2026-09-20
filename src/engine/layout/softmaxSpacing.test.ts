/**
 * VexFlow's softmax spacing, kept for one clef (S9h-b). ⚠️ Exactness against `Formatter.preFormat` was
 * proved once — every context's x and every whole-bar rest's centre shift on 8,000 random twin bars,
 * and the rendered page of 60 scores (`docs/history/vexflow-removal-map.md` §5.2); pinned here is the shape.
 */
import { describe, it, expect } from 'vitest'
import {
  SOFTMAX_FACTOR, softmaxColumns, type SoftmaxColumn, type SoftmaxTickable, type SoftmaxVoice,
} from './softmaxSpacing'

/** One voice of `ticks`, one note per column, 12 px wide each, no modifiers. */
function bar(ticks: number[]) {
  const tickables: SoftmaxTickable[] = ticks.map((t, i) => ({
    column: i, voice: 0, ticks: t, xShift: 0, notePx: 12, modLeftPx: 0, modRightPx: 0,
    leftDisplacedHeadPx: 0, rightDisplacedHeadPx: 0, width: 12, centerAligned: false,
  }))
  const columns: SoftmaxColumn[] = ticks.map((t, i) => ({
    width: 14, notePx: 12, totalLeftPx: 0, totalRightPx: 0, maxTicks: t, maxTickable: i,
    byVoice: [[0, i]], tickables: [i],
  }))
  const used = ticks.reduce((a, b) => a + b, 0)
  const voices: SoftmaxVoice[] = [{
    ticksUsed: used, totalTicks: used,
    expTicksUsed: ticks.map(t => Math.pow(SOFTMAX_FACTOR, t / used)).reduce((a, b) => a + b, 0),
  }]
  return { tickables, columns, voices }
}

describe('softmaxColumns', () => {
  it('the first walk alone places each column one width after the last', () => {
    const { tickables, columns, voices } = bar([1, 1, 1])
    expect(softmaxColumns(columns, tickables, voices, 0).xs).toEqual([0, 14, 28])
  })

  it('⭐ a longer note is given more room than a shorter one — but less than in proportion', () => {
    const { tickables, columns, voices } = bar([2, 1, 1])
    const { xs } = softmaxColumns(columns, tickables, voices, 300)
    const afterLong = xs[1] - xs[0]
    const afterShort = xs[2] - xs[1]
    expect(afterLong).toBeGreaterThan(afterShort)
    expect(afterLong).toBeLessThan(2 * afterShort)
  })

  it('a whole-bar rest is given the centre shift to the middle of the room', () => {
    const { tickables, columns, voices } = bar([4])
    tickables[0].centerAligned = true
    const { xs, centerXShifts } = softmaxColumns(columns, tickables, voices, 200)
    // The room is the width less the column's ink right of its start: 200 − 12.
    expect(centerXShifts.get(0)).toBe((200 - 12) / 2 - xs[0])
  })
})
