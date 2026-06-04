import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Phase 0 BASELINE snapshots of the current (float-based, 4/4-biased) rest
 * filler. These lock today's behaviour so the Phase 2b rewrite (meter-aware,
 * exact `fillRests`) has an explicit before/after. Some of these outputs are
 * NOT engraving-ideal — Phase 2b is expected to UPDATE these expectations, not
 * preserve them. See docs/time-signature-plan.md §2.3 / Phase 2b.
 */
describe('rest-fill baseline (4/4) — pre-Phase-2b', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel('Baseline', 120)
  })

  /** [duration, beatNum/beatDen] tuples for every rest in measure 1, in order. */
  function restShape(): Array<[string, number, number]> {
    return model
      .getNotesInMeasure(1)
      .filter(n => n.isRest)
      .map(n => [n.duration, n.beat.num, n.beat.den] as [string, number, number])
  }

  it('empty 4/4 measure → a single whole rest at beat 0', () => {
    expect(restShape()).toEqual([['w', 0, 1]])
  })

  it('quarter at beat 0 → rest fill of the remaining 3 beats', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(restShape()).toEqual([
      ['q', 1, 1],
      ['h', 2, 1],
    ])
  })

  it('half note at beat 2 → rest fill of the leading 2 beats', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    expect(restShape()).toEqual([['h', 0, 1]])
  })

  it('quarter at beat 1 → rests before and after', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(restShape()).toEqual([
      ['q', 0, 1],
      ['h', 2, 1],
    ])
  })
})
