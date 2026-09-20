/**
 * MAKING A MEASURE — {@link insertMeasureAfter}, {@link addMeasure}, and the small helpers they
 * stand on. Asked of a plain `Score` (a `ScoreModel` only supplies one). Code-shape plan, 4.3e.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score } from '@/types/music'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { ScoreModel } from './ScoreModel'
import { addMeasure, copyTimeSignature, fillMeasureWithRests, insertMeasureAfter } from './measureOps'

describe('measureOps', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel('M') // one 4/4 bar
    score = model.getScore()
  })

  it('addMeasure appends a rest-filled bar in the meter in force', () => {
    score.measures[0].timeSignature = { numerator: 3, denominator: 4 }
    const bar = addMeasure(score)
    expect(bar.number).toBe(2)
    expect(bar.timeSignature).toEqual({ numerator: 3, denominator: 4 })
    expect(bar.timeSignatureChange).toBeUndefined() // a continuation, not a change
    expect(bar.slots).toHaveLength(1)
    expect(bar.slots[0]).toMatchObject({ type: 'rest', isMeasureRest: true })
    expect(fracToNumber(bar.slots[0].actualDuration!)).toBe(3)
  })

  it('insertMeasureAfter splices in and RENUMBERS what follows — the bars and their slots', () => {
    addMeasure(score)
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const inserted = insertMeasureAfter(score, 1)

    expect(score.measures.map(m => m.number)).toEqual([1, 2, 3])
    expect(score.measures[1]).toBe(inserted)
    expect(model.getNote(note.id)!.measure).toBe(3)
    expect(score.measures[2].slots.every(s => s.measure === 3)).toBe(true)
  })

  it('inserting at the very FRONT makes a bar 1 that states its meter explicitly', () => {
    const first = insertMeasureAfter(score, 0, { numerator: 6, denominator: 8 })
    expect(score.measures[0]).toBe(first)
    expect(first).toMatchObject({ number: 1, timeSignatureChange: true })
    expect(score.measures[1].number).toBe(2)
  })

  it('an explicit meter is COPIED — the caller\'s object (and its grouping) is not shared', () => {
    const ts = { numerator: 7, denominator: 8, grouping: [2, 2, 3] }
    const bar = addMeasure(score, ts)
    expect(bar.timeSignature).toEqual(ts)
    expect(bar.timeSignature).not.toBe(ts)
    expect(bar.timeSignature.grouping).not.toBe(ts.grouping)
  })

  it('copyTimeSignature keeps every field — `symbol` was the one a hand-written copy dropped', () => {
    const ts = { numerator: 4, denominator: 4, symbol: 'common' } as Parameters<typeof copyTimeSignature>[0]
    expect(copyTimeSignature(ts)).toEqual(ts)
  })

  it('fillMeasureWithRests gives an EMPTY bar one measure rest, in every meter', () => {
    const bar = score.measures[0]
    bar.slots = []
    bar.timeSignature = { numerator: 5, denominator: 8 }
    fillMeasureWithRests(bar)
    expect(bar.slots).toHaveLength(1)
    expect(bar.slots[0]).toMatchObject({ isMeasureRest: true })
    expect(fracToNumber(bar.slots[0].actualDuration!)).toBe(2.5)
  })
})
