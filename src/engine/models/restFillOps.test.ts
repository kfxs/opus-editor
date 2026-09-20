import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { Measure, Rest } from '@/types/music'
import { fillGapsWithRests, pushRestSlot } from './restFillOps'

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
    model = new ScoreModel('Baseline')
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

/**
 * {@link fillGapsWithRests} asked DIRECTLY — a hole made by hand in a real score, then filled. The
 * baseline above reaches it through `addNote`; these pin what is the fill's own: the lanes and the
 * tuplets. (Moved here with the module — code-shape plan, Phase 4.3b.)
 */
describe('fillGapsWithRests — per staff, per voice, around tuplets', () => {
  let model: ScoreModel
  let bar: Measure
  beforeEach(() => {
    model = new ScoreModel('Fill')
    bar = model.getMeasure(1)!
  })

  const rests = (pred: (r: Rest) => boolean = () => true) =>
    bar.slots.filter((s): s is Rest => s.type === 'rest' && pred(s))
      .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      .map(r => `${r.duration}${'.'.repeat(r.dots ?? 0)}@${fracToNumber(r.beat)}`)
  const dropRests = (pred: (r: Rest) => boolean = () => true) => {
    bar.slots = bar.slots.filter(s => !(s.type === 'rest' && pred(s)))
  }

  it('an EMPTY bar gets one measure rest, whose length is the BAR\'s', () => {
    dropRests()
    fillGapsWithRests(model.getScore(), bar)
    expect(bar.slots).toHaveLength(1)
    expect(bar.slots[0]).toMatchObject({ type: 'rest', duration: 'w', isMeasureRest: true })
    expect(fracToNumber(bar.slots[0].actualDuration!)).toBe(4)
  })

  it('is idempotent — a full bar is left alone', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const before = JSON.stringify(bar.slots)
    fillGapsWithRests(model.getScore(), bar)
    expect(JSON.stringify(bar.slots)).toBe(before)
  })

  it('each VOICE is its own stream: a hole in voice 2 is filled in voice 2, voice 1 untouched', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    dropRests(r => r.voice === 1)
    fillGapsWithRests(model.getScore(), bar)
    expect(rests(r => r.voice === 1)).toEqual(['q@1', 'h@2'])
    expect(rests(r => (r.voice ?? 0) === 0)).toEqual([])
  })

  it('each STAFF is its own lane, and the FIRST staff\'s rests carry no staffId', () => {
    model.addStaffBelow(0)
    const lowId = model.getScore().staves![1].id
    model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 })
    dropRests()
    fillGapsWithRests(model.getScore(), bar)
    expect(rests(r => r.staffId === lowId)).toEqual(['h@2'])
    expect(rests(r => r.staffId === undefined)).toEqual(['w@0'])
  })

  it('a gap INSIDE a tuplet is the tuplet\'s own time — skipped; a gap running INTO one is trimmed', () => {
    const tuplet = model.createTuplet(1, frac(2, 1), '8', 3, 2) // beats 2–3, no slots yet
    dropRests()
    fillGapsWithRests(model.getScore(), bar)
    // [0,2) filled and stopped at the tuplet's start; nothing minted inside [2,3). (What follows the
    // tuplet is found only once its own slots exist — the cursor walks SLOTS, not tuplets.)
    expect(rests().filter(r => r.startsWith('h@0'))).toEqual(['h@0'])
    expect(bar.slots.some(s => fracToNumber(s.beat) >= 2 && fracToNumber(s.beat) < 3)).toBe(false)
    expect(tuplet.id).toBeTruthy()
  })
})

describe('pushRestSlot — the one place a filler rest is minted', () => {
  it('voice 0 and the first staff are ABSENT, not written as defaults', () => {
    const model = new ScoreModel('Push')
    const bar = model.getMeasure(1)!
    bar.slots = []
    pushRestSlot(bar, { duration: 'q', dots: 0, beat: frac(0, 1) }, 0)
    pushRestSlot(bar, { duration: 'q', dots: 1, beat: frac(1, 1) }, 1, 'staff-2')
    expect('voice' in bar.slots[0]).toBe(false)
    expect('staffId' in bar.slots[0]).toBe(false)
    expect(bar.slots[1]).toMatchObject({ voice: 1, staffId: 'staff-2', dots: 1 })
    expect(fracToNumber(bar.slots[1].actualDuration!)).toBe(1.5)
  })
})
