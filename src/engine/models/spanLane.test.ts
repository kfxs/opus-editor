/**
 * {@link staffOnsets} / {@link locateSpan} — the lane a bracket-shaped span walks, as its own
 * contract. `ottavaOps` and `pedalOps` specs still drive it through their gestures; what is pinned
 * here is what BOTH families are owed. A `ScoreModel` is the fixture.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { staffOnsets, locateSpan } from './spanLane'

const at = (lane: ReturnType<typeof staffOnsets>) =>
  lane.map(o => `${o.measure}:${fracToNumber(o.beat)}@${fracToNumber(o.abs)}+${fracToNumber(o.length)}`)

describe('spanLane.staffOnsets', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    model.addMeasure()
    score = model.getScore()
  })

  it('lists the staff\'s onsets in reading order, by absolute beat across the barline', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    const lane = at(staffOnsets(score, undefined))
    expect(lane[0]).toBe('1:0@0+2')
    expect(lane).toContain('2:0@4+2')
    expect(lane).toEqual([...lane].sort((a, b) => Number(a.split('@')[1].split('+')[0]) - Number(b.split('@')[1].split('+')[0])))
  })

  it('counts two voices attacking together ONCE, and keeps the LONGEST slot there', () => {
    model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const first = staffOnsets(score, undefined).filter(o => o.measure === 1 && fracToNumber(o.beat) === 0)
    expect(first).toHaveLength(1)
    expect(fracToNumber(first[0].length)).toBe(2)
  })
})

describe('spanLane.locateSpan', () => {
  let score: Score
  beforeEach(() => {
    const model = new ScoreModel()
    model.addMeasure()
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    score = model.getScore()
  })

  it('answers null when the family has no span or no mark', () => {
    const mark = { length: frac(2, 1) }
    expect(locateSpan(score, null, mark)).toBeNull()
    expect(locateSpan(score, { startMeasure: 1, startBeat: frac(0, 1) }, null)).toBeNull()
  })

  it('answers null for a start measure the score does not have', () => {
    expect(locateSpan(score, { startMeasure: 9, startBeat: frac(0, 1) }, { length: frac(1, 1) })).toBeNull()
  })

  it('places the mark by absolute beat — its end is start + length, across the barline', () => {
    const mark = { length: frac(3, 1) }
    const placed = locateSpan(score, { startMeasure: 1, startBeat: frac(2, 1) }, mark)!
    expect(placed.mark).toBe(mark)
    expect(placed.startMeasure).toBe(1)
    expect(fracToNumber(placed.startAbs)).toBe(2)
    expect(fracToNumber(placed.endAbs)).toBe(5)
    expect(at(placed.lane)).toContain('2:1@5+1')
  })
})
