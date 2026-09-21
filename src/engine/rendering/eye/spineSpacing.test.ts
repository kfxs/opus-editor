import { describe, expect, it } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import type { NoteDuration } from '@/types/music'
import { deepestInkPx, naturalSpineLength, spaceBarsOnSpine } from './spineSpacing'

/**
 * WHERE the columns stand along a spine is the PAGE's spacing (`layout/measureColumns` + `layout/spacing`)
 * asked for one endless line — the law itself has its own specs. Here: the claims that are the spine's.
 */
function model(bars: number): ScoreModel {
  const m = new ScoreModel('spacing')
  for (let i = 1; i < bars; i++) m.addMeasure()
  return m
}
const add = (m: ScoreModel, measure: number, num: number, den: number, duration: NoteDuration) =>
  m.addNote({ step: 'G', octave: 4, duration, measure, beat: { num, den }, staff: 0 })
const beat = (num: number, den = 1) => ({ num, den })

describe('spaceBarsOnSpine', () => {
  it('⭐ his report, 2026-09-21: four sixteenths are NOT piled up — each clears a notehead, and a quarter still earns more', () => {
    const m = model(1)
    for (let i = 0; i < 4; i++) add(m, 1, i, 4, '16')
    add(m, 1, 1, 1, 'q'); add(m, 1, 2, 1, 'q'); add(m, 1, 3, 1, 'q')
    const [bar] = spaceBarsOnSpine(m.getScore(), 0, 0, false)
    const sixteenth = bar.columnAt(beat(1, 4)) - bar.columnAt(beat(0))
    const quarter = bar.columnAt(beat(2)) - bar.columnAt(beat(1))
    expect(sixteenth, 'wider than a notehead (≈ 11 px), where 48 px per quarter gave 12').toBeGreaterThan(14)
    expect(quarter).toBeGreaterThan(sixteenth)
    // …but NOT four times as much: the law is Gould's √, not proportional time.
    expect(quarter).toBeLessThan(4 * sixteenth)
  })

  it('an OPEN spine gives every bar its natural width, end to end', () => {
    const m = model(2)
    add(m, 1, 0, 1, 'q'); add(m, 2, 0, 1, 'q')
    const bars = spaceBarsOnSpine(m.getScore(), 100, 0, false)
    expect(bars[0].start).toBe(100)
    expect(bars[1].start).toBe(bars[0].end)
    expect(bars[1].end - 100).toBeCloseTo(naturalSpineLength(m.getScore()), 6)
  })

  it('⭐ a CLOSED spine is a JUSTIFIED line: the bars fill the room exactly, each in proportion to what it asks', () => {
    const m = model(2)
    for (let i = 0; i < 8; i++) add(m, 1, i, 2, '8')
    add(m, 2, 0, 1, 'h'); add(m, 2, 2, 1, 'h')
    const score = m.getScore()
    const room = naturalSpineLength(score) * 1.5
    const bars = spaceBarsOnSpine(score, 50, 50 + room, true)
    expect(bars[bars.length - 1].end).toBeCloseTo(50 + room, 6)
    const natural = spaceBarsOnSpine(score, 50, 0, false)
    const width = (b: { start: number; end: number }) => b.end - b.start
    expect(width(bars[0])).toBeGreaterThan(width(natural[0]))
    expect(width(bars[0]), 'the busier bar keeps the larger share').toBeGreaterThan(width(bars[1]))
  })

  it('every column stands inside its own bar, in order', () => {
    const m = model(1)
    for (let i = 0; i < 4; i++) add(m, 1, i, 1, 'q')
    const [bar] = spaceBarsOnSpine(m.getScore(), 0, 600, true)
    const at = [0, 1, 2, 3].map(n => bar.columnAt(beat(n)))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(at[0]).toBeGreaterThan(bar.start)
    expect(at[3]).toBeLessThan(bar.end)
  })
})

describe('spacing where the DEEPEST ink stands — a loop’s inside is shorter than its spine', () => {
  it('deepestInkPx is never less than the staff, and grows with a note below it', () => {
    const empty = model(1)
    expect(deepestInkPx(empty.getScore())).toBe(40)
    const low = model(1)
    low.addNote({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: { num: 0, den: 1 }, staff: 0 })
    expect(deepestInkPx(low.getScore())).toBeGreaterThan(40)
  })

  it('⭐ on the inner arc the columns stand exactly as the law says; on the spine they are that much further apart', () => {
    const m = model(1)
    for (let i = 0; i < 4; i++) add(m, 1, i, 1, 'q')
    const score = m.getScore()
    const ratio = 0.7
    const onSpine = spaceBarsOnSpine(score, 100, 100 + 700, true, ratio)[0]
    const onInnerArc = spaceBarsOnSpine(score, 0, 700 * ratio, true)[0]
    const gap = (bar: typeof onSpine) => bar.columnAt(beat(2)) - bar.columnAt(beat(1))
    expect(gap(onSpine) * ratio).toBeCloseTo(gap(onInnerArc), 6)
    expect(onSpine.end).toBeCloseTo(800, 6)
    expect(onSpine.start).toBe(100)
  })

  it('a ratio of 1 — a straight spine — changes nothing', () => {
    const m = model(1)
    add(m, 1, 0, 1, 'q')
    const a = spaceBarsOnSpine(m.getScore(), 10, 500, true)[0]
    const b = spaceBarsOnSpine(m.getScore(), 10, 500, true, 1)[0]
    expect([b.start, b.end, b.columnAt(beat(0))]).toEqual([a.start, a.end, a.columnAt(beat(0))])
  })
})

