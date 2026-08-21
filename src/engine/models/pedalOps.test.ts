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
  pedalEndBeat, pedalSpan, addPedalOverNotes, resizePedalBySlot, movePedalStartBySlot,
  setPedalStartAtSlot, setPedalLiftAt, setPedalAtSlot, setPedalEndpointOffset, setPedalOffset, resetPedalOffset,
  resetPedalEndpointOffset,
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

/**
 * ⭐⭐ `Ctrl+Shift+←/→` with the pedal's START square armed — **move the press, hold the lift**.
 *
 * The claim under test is the one the model shape makes non-obvious: a `Pedal` stores a start and an
 * AMOUNT, so "hold the lift" is `length' = lift − start'`, two fields written together. Every case
 * here therefore asserts the LIFT'S ABSOLUTE POSITION as well as the length — a length that is right
 * while the press moved the wrong way looks correct in `length` alone.
 */
describe('pedalOps — movePedalStartBySlot', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  const quarters = (m: number, staff?: number) =>
    [0, 1, 2, 3].map(b =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1), ...(staff !== undefined ? { staff } : {}) }))

  /** The press and the lift as absolute quarter-beats, so "the far end held" is directly assertable
   *  (bar 1 starts at 0, bar 2 at 4 in 4/4). */
  const span = (id: string) => {
    const p = getPedalById(score, id)!
    const measure = pedalMeasure(score, id)!
    const base = (measure.number - 1) * 4
    return { press: base + fracToNumber(p.beat), lift: base + fracToNumber(pedalEndBeat(p)) }
  }

  it('⭐ reaches the press BACK a slot and holds the lift', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(2, 1), length: frac(1, 1) })!
    expect(movePedalStartBySlot(score, p.id, -1)).toBe(true)
    expect(span(p.id)).toEqual({ press: 1, lift: 3 })
  })

  it('⭐ steps the press IN and holds the lift', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(3, 1) })!
    expect(movePedalStartBySlot(score, p.id, 1)).toBe(true)
    expect(span(p.id)).toEqual({ press: 1, lift: 3 })
  })

  it('⭐⭐ steps the press ONTO the lift and PUSHES it — ⛔ never refuses, never deletes', () => {
    // Until 2026-08-21 this refused, and the refusal read as a guard rail. It is not one: the walk
    // stops at the first stop the model declines (`interactions/markWalk.carryMark`), so a press
    // parked against its own lift turned every further arrow into pure ink and the square walked off
    // the page while the pedal stood still. See {@link setPedalStartAtSlot}.
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    expect(movePedalStartBySlot(score, p.id, 1)).toBe(true)
    expect(span(p.id), 'the foot lands on beat 1 and holds that quarter').toEqual({ press: 1, lift: 2 })
  })

  it('declines when there is no earlier onset to reach', () => {
    quarters(1)
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
    expect(movePedalStartBySlot(score, p.id, -1)).toBe(false)
  })

  it('⭐ a press crossing a BARLINE re-files the pedal under its new bar, SAME id', () => {
    quarters(1)
    quarters(2)
    const p = addPedal(score, 2, { beat: frac(0, 1), length: frac(2, 1) })!
    expect(movePedalStartBySlot(score, p.id, -1)).toBe(true)
    // ⚠️ The id survives — the selection the gesture is driven from would otherwise evaporate
    // mid-press, taking the square the user is holding with it.
    expect(pedalMeasure(score, p.id)!.number).toBe(1)
    expect(getPedalById(score, p.id)!.id).toBe(p.id)
    expect(span(p.id), 'press back one quarter, lift held at 6').toEqual({ press: 3, lift: 6 })
    // …and bar 2's emptied array is DELETED, not left as `[]` — one spelling of "none" in the JSON.
    expect(score.measures.find(m => m.number === 2)!.pedals).toBeUndefined()
  })

  it('⭐⭐ steps through EVERY VOICE of its staff — the same lane the lift walks', () => {
    // If the two ends walked different lanes, one square could reach a position the other could not
    // pass through, and a pedal's two signs would sit on different grids.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })
    const p = addPedal(score, 1, { beat: frac(1, 1), length: frac(1, 1) })!
    expect(movePedalStartBySlot(score, p.id, -1)).toBe(true)
    expect(span(p.id), 'the voice-2 eighth at ½ is a step the foot can take').toEqual({ press: 0.5, lift: 2 })
  })

  it('is false for an unknown id', () => {
    expect(movePedalStartBySlot(score, 'nope', -1)).toBe(false)
  })
})

/**
 * ⭐⭐ **THE TWO ADDRESS WRITES BOTH DEVICES END AT** — {@link setPedalStartAtSlot} and
 * {@link setPedalLiftAt}. The arrows reach them through the walk and so does a square drag
 * (`interactions/pedalWalk`), so a dragged pedal cannot land where the keys could not put it.
 *
 * ⭐ **Two doors, ⛔ not one, and that is the pedal's third end rule showing through**: the press
 * takes an ONSET of its staff, the lift takes a MOMENT — no note need stand there
 * ({@link PedalLiftTarget}).
 *
 * ⚠️ This chapter replaced `applyPedalDrag`'s on 2026-08-21, when the drag stopped snapping to an
 * address and started walking to one; the op it drove went with the snap, and every claim it carried
 * is below.
 */
describe('pedalOps — setPedalStartAtSlot / setPedalLiftAt', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
  })

  const spanOf = (id: string) => {
    const p = getPedalById(score, id)!
    return { press: fracToNumber(p.beat), lift: fracToNumber(pedalEndBeat(p)) }
  }

  it('the START lands on the given slot, holding the lift', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(3, 1) })!
    expect(setPedalStartAtSlot(score, p.id, { measure: 1, beat: frac(2, 1) })).toBe(true)
    expect(spanOf(p.id)).toEqual({ press: 2, lift: 3 })
  })

  it('⭐ the LIFT lands ON the given moment — the note struck there is NOT held', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    expect(setPedalLiftAt(score, p.id, { measure: 1, beat: frac(2, 1) })).toBe(true)
    expect(spanOf(p.id), 'the damper comes up as the beat-2 note is struck').toEqual({ press: 0, lift: 2 })
  })

  it('⭐⭐ …and a moment PAST the last onset holds it — the address no onset can name', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(1, 1) })!
    // The last quarter of the bar rings to the barline. Asking for beat 3 instead would leave that
    // note dry, and there is no onset after it to name the difference with — which is why a lift is
    // a MOMENT and not a slot. ⭐ The walk reaches it one step at a time (`nextPedalLift` reaches
    // THROUGH the final slot), so no gesture needs a candidate of its own for it.
    expect(setPedalLiftAt(score, p.id, { measure: 1, beat: frac(4, 1) })).toBe(true)
    expect(spanOf(p.id)).toEqual({ press: 0, lift: 4 })
  })

  it('⛔ refuses a LIFT at or before the press — ⛔ never a delete', () => {
    const p = addPedal(score, 1, { beat: frac(1, 1), length: frac(1, 1) })!
    expect(setPedalLiftAt(score, p.id, { measure: 1, beat: frac(1, 1) })).toBe(false)
    expect(setPedalLiftAt(score, p.id, { measure: 1, beat: frac(0, 1) })).toBe(false)
    expect(spanOf(p.id), 'untouched by both').toEqual({ press: 1, lift: 2 })
  })

  it('⭐⭐ …but a PRESS onto or past the lift PUSHES it — the two feet never collide', () => {
    // The asymmetry is his rule of 2026-08-21, given for the bracket and stated about the anchors:
    // *"when the left anchor push the right anchor then the right anchor should reanchor"*. It is
    // what keeps the walk alive — a stop the model can refuse FOREVER is a dead gesture
    // (`setPedalStartAtSlot`), and only the LEFT foot has somewhere further to go.
    const p = addPedal(score, 1, { beat: frac(1, 1), length: frac(1, 1) })!
    expect(setPedalStartAtSlot(score, p.id, { measure: 1, beat: frac(2, 1) })).toBe(true)
    expect(spanOf(p.id), 'it keeps the one slot it now stands on').toEqual({ press: 2, lift: 3 })
  })

  it('⛔ the PRESS refuses an address that is not an onset of the pedal\'s own staff', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
    expect(setPedalStartAtSlot(score, p.id, { measure: 1, beat: frac(5, 2) })).toBe(false)
    expect(setPedalStartAtSlot(score, p.id, { measure: 9, beat: frac(0, 1) })).toBe(false)
  })

  it('⚠️ …the LIFT does not, because a moment needs no note under it — but its BAR must exist', () => {
    const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
    expect(setPedalLiftAt(score, p.id, { measure: 1, beat: frac(5, 2) }), 'mid-note is a moment').toBe(true)
    expect(spanOf(p.id)).toEqual({ press: 0, lift: 2.5 })
    expect(setPedalLiftAt(score, p.id, { measure: 9, beat: frac(0, 1) })).toBe(false)
  })

  it('is false for an unknown id', () => {
    expect(setPedalStartAtSlot(score, 'nope', { measure: 1, beat: frac(0, 1) })).toBe(false)
    expect(setPedalLiftAt(score, 'nope', { measure: 1, beat: frac(1, 1) })).toBe(false)
  })

  /**
   * ⭐⭐ {@link setPedalAtSlot} — the WHOLE pedal onto a slot, the body walk's re-anchor. The claim
   * that separates it from its two neighbours: `length` is not touched, so the LIFT travels. Moving
   * a mark, ⛔ not reshaping it.
   */
  describe('setPedalAtSlot — moving the pedal as ONE', () => {
    it('⭐ carries the lift along: the span moves, its LENGTH does not change', () => {
      const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
      expect(setPedalAtSlot(score, p.id, { measure: 1, beat: frac(1, 1) })).toBe(true)
      expect(spanOf(p.id), 'both feet a beat later').toEqual({ press: 1, lift: 3 })
    })

    it('⭐⭐ …which is exactly what the START square does NOT do', () => {
      // The same target through the other door holds the lift and shortens the pedal. Two gestures,
      // two writes, and the armed square is the whole of the difference.
      const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
      setPedalStartAtSlot(score, p.id, { measure: 1, beat: frac(1, 1) })
      expect(spanOf(p.id)).toEqual({ press: 1, lift: 2 })
    })

    it('⛔ refuses an address that is not an onset of the pedal\'s own staff', () => {
      const p = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!
      expect(setPedalAtSlot(score, p.id, { measure: 1, beat: frac(5, 2) })).toBe(false)
      expect(setPedalAtSlot(score, p.id, { measure: 9, beat: frac(0, 1) })).toBe(false)
      expect(spanOf(p.id), 'untouched').toEqual({ press: 0, lift: 2 })
    })

    it('is false for an unknown id', () => {
      expect(setPedalAtSlot(score, 'nope', { measure: 1, beat: frac(0, 1) })).toBe(false)
    })
  })
})

/**
 * ⭐⭐ THE HAND-NUDGED INK — `PedalOffsetOverride`, the last thing docs/pedal-plan.md §6.3 left for
 * later. The claim under test is the SHAPE: two horizontals and ONE vertical, because a pedal and
 * its own release share a baseline (Gould p. 333, `reference/` on disk).
 */
describe('pedalOps — the ink offsets', () => {
  let model: ScoreModel
  let score: Score
  let id: string
  beforeEach(() => {
    model = new ScoreModel()
    score = model.getScore()
    id = addPedal(score, 1, { beat: frac(0, 1), length: frac(2, 1) })!.id
  })
  const off = () => engravingOverridesOf(score, id)[0]

  it('accumulates per SIGN horizontally, and shares ONE vertical', () => {
    expect(setPedalEndpointOffset(score, id, 'start', 1, 0)).toBe(true)
    setPedalEndpointOffset(score, id, 'start', 0.5, 0)
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1.5 })
    // The other sign's x is its own…
    setPedalEndpointOffset(score, id, 'end', -2, 0)
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1.5, endX: -2 })
    // …but the vertical asked for at EITHER square is the pair's one number.
    setPedalEndpointOffset(score, id, 'end', 0, 0.25)
    setPedalEndpointOffset(score, id, 'start', 0, 0.25)
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1.5, endX: -2, y: 0.5 })
  })

  it('⭐ PRUNES zeros, so a horizontal-only nudge writes no `y` for the other square to find', () => {
    setPedalEndpointOffset(score, id, 'start', 1, 0)
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1 })
    expect('y' in off()).toBe(false)
    // …and nudged back to nothing, the entry goes entirely.
    setPedalEndpointOffset(score, id, 'start', -1, 0)
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
  })

  it('🚨 the WHOLE-pedal move applies the shared vertical ONCE, not twice', () => {
    expect(setPedalOffset(score, id, 1, 2)).toBe(true)
    // ⭐⭐ THE BREAK-TEST for `setPedalOffset`'s second call passing 0: handing `dy` to both per-sign
    // writes gives y: 4 — a double step vertically, with the horizontal (which really is per sign)
    // looking perfectly correct beside it.
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1, endX: 1, y: 2 })
  })

  it('⭐ `Ctrl+Backspace` on a square drops THAT sign\'s x and the shared y, keeping the other\'s', () => {
    setPedalOffset(score, id, 1, 2)
    setPedalEndpointOffset(score, id, 'end', 2, 0) // end is now 3
    expect(resetPedalEndpointOffset(score, id, 'start')).toBe(true)
    expect(off()).toEqual({ kind: 'pedalOffset', endX: 3 })
  })

  it('⚠️ that reset DECLINES when the square carries nothing, so the key falls through', () => {
    // ⭐ The case the zero-pruning exists for: a purely horizontal nudge on the OTHER sign must not
    // leave a `y: 0` here for this square to claim as a nudge of its own.
    setPedalEndpointOffset(score, id, 'end', 2, 0)
    expect(resetPedalEndpointOffset(score, id, 'start')).toBe(false)
    expect(off()).toEqual({ kind: 'pedalOffset', endX: 2 })
    expect(resetPedalEndpointOffset(score, 'nope', 'start')).toBe(false)
  })

  it('the whole-pedal reset drops everything, and declines when there is nothing to drop', () => {
    expect(resetPedalOffset(score, id)).toBe(false)
    setPedalOffset(score, id, 1, 1)
    expect(resetPedalOffset(score, id)).toBe(true)
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
  })

  it('⚠️ the nudge DIES WITH THE PEDAL — an override may not outlive its anchor', () => {
    setPedalOffset(score, id, 1, 1)
    removePedal(score, id)
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
  })

  it('⚠️ SURVIVES an extent edit — the nudge is a statement about the drawing', () => {
    setPedalOffset(score, id, 1, 1)
    setPedalLength(score, id, frac(3, 1))
    expect(off()).toEqual({ kind: 'pedalOffset', startX: 1, endX: 1, y: 1 })
  })

  it('is false for an unknown id', () => {
    expect(setPedalEndpointOffset(score, 'nope', 'start', 1, 1)).toBe(false)
    expect(setPedalOffset(score, 'nope', 1, 1)).toBe(false)
    expect(resetPedalOffset(score, 'nope')).toBe(false)
  })
})
