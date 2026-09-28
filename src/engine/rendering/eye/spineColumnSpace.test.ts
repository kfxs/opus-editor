import { describe, expect, it } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { spacingPositionKey } from '@/engine/models/engravingOverrides'
import { spaceBarsOnSpine } from './spineSpacing'
import { spineColumnKeyOf } from './spineColumnSpace'

/** Subject: `./spineColumnSpace` — a note's SPACE on the spine moves its COLUMN (his ask, 2026-09-28). */
function fourQuarters(bars = 1) {
  const m = new ScoreModel('space')
  for (let i = 1; i < bars; i++) m.addMeasure()
  for (let bar = 1; bar <= bars; bar++) {
    for (let i = 0; i < 4; i++) m.addNote({ step: 'G', octave: 4, duration: 'q', measure: bar, beat: { num: i, den: 1 }, staff: 0 })
  }
  return m
}
const beat = (num: number, den = 1) => ({ num, den })
const SP = 10

describe('spineColumnSpace', () => {
  it('a note is found by the id the editor selects it by — its column is the page\'s column key', () => {
    const m = fourQuarters()
    const score = m.getScore()
    const slot = score.measures[0].slots[2]
    const id = slot.type === 'chord' ? slot.notes[0].id : slot.id
    expect(spineColumnKeyOf(score, id)).toBe(spacingPositionKey(score.measures[0].id, beat(2)))
    expect(spineColumnKeyOf(score, 'nope')).toBeUndefined()
  })

  it('⭐ it MOVES the column and every later one by the space — the earlier ones stay (an open spine)', () => {
    const m = fourQuarters()
    const score = m.getScore()
    const plain = spaceBarsOnSpine(score, 0, 0, false)[0]
    const spaced = spaceBarsOnSpine(score, 0, 0, false, 1, {
      columnSpace: new Map([[spacingPositionKey(score.measures[0].id, beat(2)), 2]]),
    })[0]
    expect(spaced.columnAt(beat(1))).toBeCloseTo(plain.columnAt(beat(1)), 6)
    expect(spaced.columnAt(beat(2)) - plain.columnAt(beat(2))).toBeCloseTo(2 * SP, 6)
    expect(spaced.columnAt(beat(3)) - plain.columnAt(beat(3))).toBeCloseTo(2 * SP, 6)
  })

  it('before a bar\'s FIRST column the space goes into the lead-in', () => {
    const m = fourQuarters()
    const score = m.getScore()
    const plain = spaceBarsOnSpine(score, 0, 0, false)[0]
    const spaced = spaceBarsOnSpine(score, 0, 0, false, 1, {
      columnSpace: new Map([[spacingPositionKey(score.measures[0].id, beat(0)), 1.5]]),
    })[0]
    expect(spaced.columnAt(beat(0)) - plain.columnAt(beat(0))).toBeCloseTo(1.5 * SP, 6)
  })

  it('⭐ his report (2026-09-28): on a STRETCHED (justified) spine tighter keeps moving the note until the ink — not to a limit measured at rest', () => {
    const m = fourQuarters(2)
    const score = m.getScore()
    const natural = spaceBarsOnSpine(score, 0, 0, false)
    const room = natural[natural.length - 1].end * 1.5
    const gapAt = (space: number) => {
      const bar = spaceBarsOnSpine(score, 0, room, true, 1, {
        columnSpace: new Map([[spacingPositionKey(score.measures[0].id, beat(1)), space]]),
      })[0]
      return bar.columnAt(beat(1)) - bar.columnAt(beat(0))
    }
    // At rest a quarter's gap could give ≈ 1.5 sp; stretched, it keeps giving past that…
    const gaps = [0, -1, -2].map(gapAt)
    for (let i = 1; i < gaps.length; i++) expect(gaps[i], `space ${-i} tighter than ${-(i - 1)}`).toBeLessThan(gaps[i - 1] - 1)
    // …and at the very end the ink holds: a notehead's width and more, however far it is asked.
    expect(gapAt(-100)).toBeGreaterThan(SP)
    expect(gapAt(-100)).toBeCloseTo(gapAt(-200), 6)
  })

  it('⛔ tighter stops at the ink: a huge negative space never takes a column into the one before it', () => {
    const m = fourQuarters()
    const score = m.getScore()
    const spaced = spaceBarsOnSpine(score, 0, 0, false, 1, {
      columnSpace: new Map([[spacingPositionKey(score.measures[0].id, beat(2)), -50]]),
    })[0]
    expect(spaced.columnAt(beat(2))).toBeGreaterThan(spaced.columnAt(beat(1)))
    const first = spaceBarsOnSpine(score, 0, 0, false, 1, {
      columnSpace: new Map([[spacingPositionKey(score.measures[0].id, beat(0)), -50]]),
    })[0]
    expect(first.musicStart, 'never before the bar\'s own start').toBeGreaterThanOrEqual(first.start)
  })
})
