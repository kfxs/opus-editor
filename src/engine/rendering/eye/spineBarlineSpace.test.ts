import { describe, expect, it } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { spaceBarsOnSpine } from './spineSpacing'

/** Subject: `./spineBarlineSpace` — the space between a bar's last note and its barline on the spine (his ask, 2026-09-28). */
function fourQuarters(bars: number) {
  const m = new ScoreModel('barline space')
  for (let i = 1; i < bars; i++) m.addMeasure()
  for (let bar = 1; bar <= bars; bar++) {
    for (let i = 0; i < 4; i++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: bar, beat: { num: i, den: 1 }, staff: 0 })
  }
  return m
}
const beat = (num: number) => ({ num, den: 1 })
const SP = 10

describe('spineBarlineSpace', () => {
  it('⭐ it MOVES the barline by the space — the bar\'s notes stay, the next bar moves with it (an open spine)', () => {
    const score = fourQuarters(2).getScore()
    const plain = spaceBarsOnSpine(score, 0, 0, false)
    const spaced = spaceBarsOnSpine(score, 0, 0, false, 1, { barlineSpace: new Map([[score.measures[0].id, 1.5]]) })
    expect(spaced[0].columnAt(beat(3))).toBeCloseTo(plain[0].columnAt(beat(3)), 6)
    expect(spaced[0].end - plain[0].end).toBeCloseTo(1.5 * SP, 6)
    expect(spaced[1].columnAt(beat(0)) - plain[1].columnAt(beat(0))).toBeCloseTo(1.5 * SP, 6)
  })

  it('⛔ tighter stops at the ink: a huge negative space never takes the barline into the last note', () => {
    const score = fourQuarters(1).getScore()
    const [plain] = spaceBarsOnSpine(score, 0, 0, false)
    const [tight] = spaceBarsOnSpine(score, 0, 0, false, 1, { barlineSpace: new Map([[score.measures[0].id, -50]]) })
    expect(tight.end).toBeLessThan(plain.end)
    // Still clear of the last notehead's centre by more than half a head.
    expect(tight.end - tight.columnAt(beat(3))).toBeGreaterThan(0.5 * SP)
  })
})
