/**
 * {@link pedalOps} — the sustain pedal as STORAGE: where it lives, what it refuses, what it
 * REPLACES, how far it reaches, and ⭐⭐ **the split that is this module's whole character** — the
 * model policing only coincidence while the ENTRY door resolves overlap by truncating
 * (docs/pedal-plan.md §3.3).
 *
 * There is no geometry here and there cannot be: where the `✻` lands is a column x the render reads
 * from a spacing solve a jsdom test has none of (docs/pedal-plan.md §5.2). What a unit test can
 * check is the model's own contract — the pedal rides its start measure, its extent is an amount of
 * MUSIC rather than a second address, a non-positive extent is refused, an override never outlives
 * its anchor, one (beat, staff) holds at most one pedal, and a press makes room for itself.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./pedalOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score, DynamicOffsetOverride } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import {
  addPedal, removePedal, updatePedal, setPedalLength, getPedalById, pedalMeasure, measurePedals,
  pedalEndBeat, pedalSpan, addPedalOverNotes, resizePedalBySlot,
} from './pedalOps'
import { setEngravingOverride } from './overrideOps'
import { engravingOverridesOf } from './engravingOverrides'

/** `beat+length` of every pedal in the score, in order — the shape most assertions here compare. */
const allPedals = (score: Score) =>
  score.measures.flatMap(m => (m.pedals ?? []).map(p => `${fracToNumber(p.beat)}+${fracToNumber(p.length)}`))

describe('pedalOps — storage', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
  })

  it('stores the pedal on the measure its START lands in, with a fresh id', () => {
    const created = addPedal(score, 1, { beat: frac(1, 1), length: frac(2, 1) })
    expect(created).not.toBeNull()
    expect(created!.id).toBeTruthy()
    expect(measurePedals(score.measures[0])).toHaveLength(1)
    expect(measurePedals(score.measures[1])).toHaveLength(0)
    expect(pedalMeasure(score, created!.id)).toBe(score.measures[0])
  })

  it('lets the pedal run PAST its own bar — length is not clamped to the measure', () => {
    const created = addPedal(score, 1, { beat: frac(3, 1), length: frac(6, 1) })!
    expect(fracToNumber(created.length)).toBe(6)
    expect(fracToNumber(pedalEndBeat(created))).toBe(9) // the LIFT, past the bar, deliberately
    expect(measurePedals(score.measures[0])).toHaveLength(1)
    expect(measurePedals(score.measures[1])).toHaveLength(0)
  })

  it('refuses a zero or negative length, on add, on update and on setPedalLength', () => {
    expect(addPedal(score, 1, { beat: frac(0, 1), length: frac(0, 1) })).toBeNull()
    expect(addPedal(score, 1, { beat: frac(0, 1), length: frac(-2, 1) })).toBeNull()

    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
    expect(updatePedal(score, p.id, { length: frac(0, 1) })).toBeNull()
    expect(setPedalLength(score, p.id, frac(-1, 1))).toBe(false)
    // …and the pedal is untouched by either refusal — a refusal is not a delete.
    expect(fracToNumber(getPedalById(score, p.id)!.length)).toBe(2)
  })

  it('refuses a measure that does not exist', () => {
    expect(addPedal(score, 99, { beat: frac(0, 1), length: frac(1, 1) })).toBeNull()
  })

  it('keeps the list sorted by beat, whatever order presses arrive in', () => {
    addPedal(score, 1, { beat: frac(3, 1), length: frac(1, 1) })
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })
    addPedal(score, 1, { beat: frac(2, 1), length: frac(1, 1) })
    expect(allPedals(score)).toEqual(['0+1', '2+1', '3+1'])
  })

  it('removes by id, drops the empty array, and returns false for an unknown id', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    expect(removePedal(score, 'no-such-pedal')).toBe(false)
    expect(removePedal(score, p.id)).toBe(true)
    expect(score.measures[0].pedals).toBeUndefined()
  })

  it('clears an engraving override keyed to the pedal it removes — an override may not outlive its anchor', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    setEngravingOverride(score, p.id, { kind: 'dynamicOffset', x: 3, y: -4 } as DynamicOffsetOverride)
    expect(engravingOverridesOf(score, p.id)).toHaveLength(1)
    removePedal(score, p.id)
    expect(engravingOverridesOf(score, p.id)).toHaveLength(0)
  })
})

/**
 * ⭐⭐ The CLEF rule, and it is exactly as far as the model goes. Two presses on one beat is a
 * contradiction the model can see without knowing anything about gestures; two OVERLAPPING presses
 * is a contradiction only a gesture can resolve, so the model leaves it (see the `addPedalOverNotes`
 * block below, which is where it IS resolved).
 */
describe('pedalOps — one (beat, staff) holds at most one pedal', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  it('REPLACES a pedal already on that beat — last press wins', () => {
    const first = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    const second = addPedal(score, 1, { beat: frac(0, 1), length: frac(4, 1) })!
    expect(allPedals(score)).toEqual(['0+4'])
    expect(getPedalById(score, first.id)).toBeNull()
    expect(getPedalById(score, second.id)).not.toBeNull()
  })

  it('clears the replaced pedal\'s override too — the same anchor rule as a delete', () => {
    const first = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    setEngravingOverride(score, first.id, { kind: 'dynamicOffset', x: 1, y: 1 } as DynamicOffsetOverride)
    addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })
    expect(engravingOverridesOf(score, first.id)).toHaveLength(0)
  })

  it('does NOT replace across staves — two staves have two feet as far as storage is concerned', () => {
    const lower = model.addStaffBelow(0)
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })
    addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1), staffId: lower })
    expect(allPedals(score)).toEqual(['0+1', '0+2'])
  })

  it('treats an EXPLICIT first-staff id and an absent one as the same staff (matchesStaff, not ===)', () => {
    const firstId = score.staves![0].id
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })
    addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1), staffId: firstId })
    expect(allPedals(score)).toEqual(['0+2'])
  })

  it('⭐ leaves a merely OVERLAPPING pedal alone — the model refuses only what it can call wrong', () => {
    addPedal(score, 1, { beat: frac(0, 1), length: frac(4, 1) })
    addPedal(score, 1, { beat: frac(2, 1), length: frac(4, 1) })
    // Both stand. Resolving this is the entry door's job, not `addPedal`'s: an overlap also arrives
    // from a re-bar and a paste, where there is no gesture to read.
    expect(allPedals(score)).toEqual(['0+4', '2+4'])
  })

  it('does not upsert on a MOVE — updatePedal onto an occupied beat leaves both', () => {
    addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })
    const moving = addPedal(score, 1, { beat: frac(2, 1), length: frac(1, 1) })!
    expect(updatePedal(score, moving.id, { beat: frac(0, 1) })).not.toBeNull()
    expect(allPedals(score)).toEqual(['0+1', '0+1'])
  })
})

/** `beat + length` walked forward through the bars — the LIFT as a (measure, beat) address. */
describe('pedalOps — pedalSpan', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  it('lifts inside its own bar when it fits', () => {
    const p = addPedal(score, 1, { beat: frac(1, 1), length: frac(2, 1) })!
    expect(pedalSpan(score, p.id)).toMatchObject({ startMeasure: 1, endMeasure: 1 })
    expect(fracToNumber(pedalSpan(score, p.id)!.endBeat)).toBe(3)
  })

  it('⭐ a lift landing ON the barline belongs to THAT bar\'s end, not to beat 0 of the next', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(4, 1) })!
    const span = pedalSpan(score, p.id)!
    // Gould's rule as arithmetic: the release is at or before the barline, never after it.
    expect(span.endMeasure).toBe(1)
    expect(fracToNumber(span.endBeat)).toBe(4)
  })

  it('walks into a later bar when it holds more music than its own', () => {
    const p = addPedal(score, 1, { beat: frac(2, 1), length: frac(5, 1) })!
    const span = pedalSpan(score, p.id)!
    expect(span.endMeasure).toBe(2)
    expect(fracToNumber(span.endBeat)).toBe(3)
  })

  it('CLAMPS a pedal running off the end of the score to the last bar\'s end', () => {
    const p = addPedal(score, 3, { beat: frac(0, 1), length: frac(99, 1) })!
    const span = pedalSpan(score, p.id)!
    expect(span.endMeasure).toBe(3)
    expect(fracToNumber(span.endBeat)).toBe(4)
  })

  it('is null for an unknown id', () => {
    expect(pedalSpan(score, 'nope')).toBeNull()
  })
})

/**
 * ⭐⭐ THE ENTRY DOOR. `addPedal` above stores; this makes room first — the pianist's *lift,
 * re-press*, which is the one thing a gesture knows and the model does not.
 */
describe('pedalOps — addPedalOverNotes makes room', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  /** The span from (m1,b1) covering through the end of a note at (m2,b2) of `len` quarters. */
  const over = (m1: number, b1: number, m2: number, b2: number, len: number, staffId?: string) =>
    addPedalOverNotes(score, { measure: m1, beat: frac(b1, 1) }, { measure: m2, beat: frac(b2, 1), length: frac(len, 1) }, staffId)

  it('covers the last note rather than stopping on its onset', () => {
    const p = over(1, 0, 1, 3, 1)!
    expect(fracToNumber(p.length)).toBe(4) // through the end of the note at beat 3
  })

  it('measures across barlines by the bars\' capacities', () => {
    const p = over(1, 2, 2, 1, 1)!
    expect(fracToNumber(p.length)).toBe(4) // 2 left in bar 1, then 0→2 of bar 2
  })

  it('refuses a span covering no music', () => {
    expect(over(2, 0, 1, 0, 0)).toBeNull() // end before start
    expect(addPedalOverNotes(score, { measure: 1, beat: frac(0, 1) }, { measure: 1, beat: frac(0, 1), length: frac(0, 1) })).toBeNull()
  })

  it('⭐ LIFTS a pedal that was still down — it ends where the new one begins', () => {
    over(1, 0, 1, 3, 1)   // 0 → 4
    over(1, 2, 1, 3, 1)   // press again at 2
    expect(allPedals(score)).toEqual(['0+2', '2+2'])
  })

  it('leaves an earlier pedal alone when it had already lifted', () => {
    over(1, 0, 1, 1, 1)   // 0 → 2
    over(1, 2, 1, 3, 1)   // 2 → 4, no overlap
    expect(allPedals(score)).toEqual(['0+2', '2+2'])
  })

  it('⭐ STOPS at a press already inside the new span rather than swallowing it', () => {
    over(1, 3, 1, 3, 1)          // an existing press at 3 → 4
    const wide = over(1, 0, 2, 0, 1)!  // a wide press from 0 that would have run to 5
    expect(fracToNumber(wide.length)).toBe(3) // stops where the later press begins
    expect(allPedals(score)).toEqual(['0+3', '3+1'])
  })

  it('REPLACES a press on its exact beat (addPedal\'s upsert, reached through the door)', () => {
    over(1, 0, 1, 0, 1)   // 0 → 1
    over(1, 0, 1, 3, 1)   // same beat, longer
    expect(allPedals(score)).toEqual(['0+4'])
  })

  it('⚠️ only makes room on its OWN staff', () => {
    const lower = model.addStaffBelow(0)
    over(1, 0, 1, 3, 1)              // upper staff, 0 → 4
    over(1, 2, 1, 3, 1, lower)       // lower staff, 2 → 4
    // The upper staff's pedal is untouched: a second foot on another instrument is not this one.
    expect(allPedals(score)).toEqual(['0+4', '2+2'])
  })

  it('never leaves a zero-length pedal behind when it truncates', () => {
    over(1, 0, 1, 3, 1)   // 0 → 4
    over(1, 0, 1, 1, 1)   // same START beat: an upsert, not a truncation to nothing
    expect(allPedals(score)).toEqual(['0+2'])
  })
})

/**
 * ⭐⭐ `Ctrl+←/→` — the model write behind the key, and the ONE place a pedal's lane matters: it steps
 * through its whole STAFF where a hairpin steps through its own voice (docs/pedal-plan.md §6.3).
 */
describe('pedalOps — resizePedalBySlot', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  /** Four quarters in bar `m`. */
  const quarters = (m: number, staff?: number) =>
    [0, 1, 2, 3].map(b =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1), ...(staff !== undefined ? { staff } : {}) }))

  const lengthOf = (id: string) => fracToNumber(getPedalById(score, id)!.length)

  it('GROWS through the next slot at or after the lift', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    expect(resizePedalBySlot(score, p.id, 1)).toBe(true)
    expect(lengthOf(p.id)).toBe(2) // the lift moves from beat 1 to beat 2
  })

  it('SHRINKS by dropping the last slot it holds', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(3, 1) })!
    expect(resizePedalBySlot(score, p.id, -1)).toBe(true)
    expect(lengthOf(p.id)).toBe(2)
  })

  it('⛔ REFUSES to shrink to nothing rather than deleting the pedal', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    expect(resizePedalBySlot(score, p.id, -1)).toBe(false)
    expect(getPedalById(score, p.id), 'still there — a shortening gesture never destroys').not.toBeNull()
    expect(lengthOf(p.id)).toBe(1)
  })

  it('⭐ grows through a REST — a damper holds sound across silence, which is half of what it is for', () => {
    // ⚠️ Bar 2 is not empty: `restFill` gives every bar its rests, so "the next slot" there is a
    // measure rest. Reaching it is CORRECT — pedalling through a rest is ordinary pianism, and the
    // notes struck before it keep ringing.
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(4, 1) })!
    expect(resizePedalBySlot(score, p.id, 1)).toBe(true)
    expect(lengthOf(p.id), 'through bar 2\'s measure rest').toBe(8)
  })

  it('declines when there is nothing further in the score at all', () => {
    quarters(1)
    quarters(2)
    const p = addPedal(score, 2, { beat: frac(0, 1), length: frac(4, 1) })!
    expect(resizePedalBySlot(score, p.id, 1)).toBe(false) // the lift is already the score's end
  })

  it('grows ACROSS a barline into the next bar\'s music', () => {
    quarters(1)
    quarters(2)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(4, 1) })!
    expect(resizePedalBySlot(score, p.id, 1)).toBe(true)
    expect(lengthOf(p.id)).toBe(5) // through bar 2's first quarter
  })

  it('⭐⭐ steps through EVERY VOICE of its staff — the hairpin walks one voice, a pedal walks the staff', () => {
    // One damper: an eighth in voice 2 between the voice-1 quarters IS a step the foot can take, and
    // it is where the renderer will read the lift x from (§5.2). Ignoring it would move the `✻`
    // somewhere nothing is drawn.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 2) })!
    expect(resizePedalBySlot(score, p.id, 1)).toBe(true)
    expect(lengthOf(p.id), 'reached the voice-2 eighth at beat ½, which ends at 1').toBe(1)
  })

  it('⚠️ steps by ITS OWN staff’s slots, never the other staff’s', () => {
    const lower = model.addStaffBelow(0)
    quarters(1, 0)  // upper staff: four quarters
    model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 })
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1), staffId: lower })!

    expect(resizePedalBySlot(score, p.id, 1)).toBe(true)
    // The LOWER staff's next slot at or after beat 1 is bar 2's rest (its whole note starts at 0),
    // so the lift lands at 8. Walking the upper staff would have given 2 — which is the bug this
    // pins: the render reads the lift x from this staff, so a step off another one would move the
    // `✻` somewhere nothing is drawn.
    expect(lengthOf(p.id)).toBe(8)
  })

  it('is false for an unknown id', () => {
    expect(resizePedalBySlot(score, 'nope', 1)).toBe(false)
  })
})
