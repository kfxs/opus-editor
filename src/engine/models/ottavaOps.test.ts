/**
 * {@link ottavaOps} — the octave line as STORAGE: where it lives, what it refuses, what it
 * REPLACES, and how far it reaches.
 *
 * There is no geometry here and there cannot be: where the bracket's ink stops is Gould's
 * last-notehead rule, derived by the render from columns a jsdom test has none of
 * (docs/ottava-plan.md §1 rule 2). What a unit test can check is the model's own contract — the
 * line rides its start measure, its extent is an amount of MUSIC rather than a second address, a
 * non-positive extent is refused, an override never outlives its anchor, and ⭐ **one (beat, staff)
 * holds at most one octave line**, which is the single rule separating this module from
 * `hairpinOps` and the reason it is a module at all.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./ottavaOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score, DynamicOffsetOverride } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import {
  addOttava, removeOttava, updateOttava, setOttavaLength, toggleOttavaDirection,
  getOttavaById, ottavaMeasure, measureOttavas, ottavaEndBeat, ottavaSpan, addOttavaOverNotes,
  resizeOttavaBySlot, moveOttavaStartBySlot, applyOttavaDrag,
} from './ottavaOps'
import { soundingShiftAt } from '@/utils/soundingShift'

/** The shift in force at (measure, beat) — asserted in SEMITONES, which is what an octave line
 *  is for; a length in beats can be right and still end on the wrong side of a barline. */
const soundingShiftAtBeat = (score: Score, measure: number, beat: number) =>
  soundingShiftAt(score, measure, frac(beat, 1))
import { setEngravingOverride } from './overrideOps'
import { engravingOverridesOf } from './engravingOverrides'

describe('ottavaOps — storage', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
  })

  it('stores the octave line on the measure its START lands in, with a fresh id', () => {
    const created = addOttava(score, 1, { beat: frac(1, 1), length: frac(2, 1), shift: 1 })
    expect(created).not.toBeNull()
    expect(created!.id).toBeTruthy()
    expect(measureOttavas(score.measures[0])).toHaveLength(1)
    expect(measureOttavas(score.measures[1])).toHaveLength(0)
    expect(ottavaMeasure(score, created!.id)).toBe(score.measures[0])
  })

  it('lets the line run PAST its own bar — length is not clamped to the measure', () => {
    const created = addOttava(score, 1, { beat: frac(3, 1), length: frac(6, 1), shift: -1 })!
    expect(fracToNumber(created.length)).toBe(6)
    expect(fracToNumber(ottavaEndBeat(created))).toBe(9) // past the bar, deliberately
    expect(measureOttavas(score.measures[0])).toHaveLength(1)
    expect(measureOttavas(score.measures[1])).toHaveLength(0)
  })

  it('refuses a zero or negative length, on add, on update and on setOttavaLength', () => {
    expect(addOttava(score, 1, { beat: frac(0, 1), length: frac(0, 1), shift: 1 })).toBeNull()
    expect(addOttava(score, 1, { beat: frac(0, 1), length: frac(-2, 1), shift: 1 })).toBeNull()
    expect(measureOttavas(score.measures[0])).toHaveLength(0)

    const id = addOttava(score, 1, { beat: frac(0, 1), length: frac(2, 1), shift: 1 })!.id
    expect(setOttavaLength(score, id, frac(0, 1))).toBe(false)
    expect(updateOttava(score, id, { length: frac(-1, 1) })).toBeNull()
    expect(fracToNumber(getOttavaById(score, id)!.length)).toBe(2) // unchanged
  })

  it('refuses a measure that does not exist', () => {
    expect(addOttava(score, 99, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })).toBeNull()
  })

  it('keeps the list sorted by beat', () => {
    addOttava(score, 1, { beat: frac(3, 1), length: frac(1, 1), shift: 1 })
    addOttava(score, 1, { beat: frac(1, 1), length: frac(1, 1), shift: -1 })
    expect(measureOttavas(score.measures[0]).map(o => fracToNumber(o.beat))).toEqual([1, 3])
  })
})

/**
 * ⭐ THE RULE THAT MAKES THIS A MODULE. A hairpin stacks; an octave line does not. Two wedges on a
 * beat are two readable marks, two octave shifts governing one staff from one beat is a
 * contradiction — so `addOttava` upserts, on the clef's terms, per (beat, STAFF).
 */
describe('ottavaOps — one (beat, staff) holds at most one line (the CLEF rule)', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  it('REPLACES an octave line already on that beat — last wins, not a stack', () => {
    const first = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    const second = addOttava(score, 1, { beat: frac(0, 1), length: frac(2, 1), shift: -1 })!

    const stored = measureOttavas(score.measures[0])
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(second.id)
    expect(stored[0].shift).toBe(-1)
    expect(getOttavaById(score, first.id)).toBeNull() // genuinely gone, not shadowed
  })

  it('leaves a line on ANOTHER beat alone', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })
    addOttava(score, 1, { beat: frac(2, 1), length: frac(1, 1), shift: 1 })
    expect(measureOttavas(score.measures[0])).toHaveLength(2)
  })

  it('leaves a line on another STAFF alone — the dedupe is per staff, as the clef\'s is', () => {
    const staffId = model.addStaffBelow(0)
    const top = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    const bottom = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: -1, staffId })!

    const stored = measureOttavas(score.measures[0])
    expect(stored).toHaveLength(2)
    expect(stored.map(o => o.id).sort()).toEqual([top.id, bottom.id].sort())
  })

  it('treats an EXPLICIT first-staff id and an absent one as the same staff', () => {
    // Staff 0 stores an absent `staffId` by convention, but a caller holding the real id must not
    // be able to sneak a second line onto the same staff at the same beat by naming it.
    const firstStaffId = score.staves![0].id
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    const named = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 2, staffId: firstStaffId })!

    const stored = measureOttavas(score.measures[0])
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(named.id)
  })

  it('⭐ toggleOttavaDirection NEGATES the shift — 8va ↔ 8vb, and the DISTANCE survives', () => {
    // His request, 2026-08-17: `x` switches a selected 8va to an 8vb. The signed shift is the whole
    // statement, so "switch" is a negation — a 15ma the user flips means 15mb, never 8vb.
    const alta = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(toggleOttavaDirection(score, alta.id)).toBe(-1)
    expect(toggleOttavaDirection(score, alta.id)).toBe(1)

    const quindicesima = addOttava(score, 2, { beat: frac(0, 1), length: frac(4, 1), shift: 2 })!
    expect(toggleOttavaDirection(score, quindicesima.id), 'two octaves, the other way').toBe(-2)
  })

  it('⭐⭐ the flip moves what the passage SOUNDS — it is a content edit, not a side-swap', () => {
    // The reason `MusicEngine.toggleOttavaDirection` commits (playback resync) where the trill's
    // branch of the same key only records undo: an octave line displaces sounding pitch.
    const ottava = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(soundingShiftAtBeat(score, 1, 0)).toBe(12)
    toggleOttavaDirection(score, ottava.id)
    expect(soundingShiftAtBeat(score, 1, 0), 'two octaves lower than before').toBe(-12)
  })

  it('declines an id that names no ottava, leaving the score alone', () => {
    expect(toggleOttavaDirection(score, 'ghost')).toBeNull()
  })

  it('does NOT upsert on updateOttava — moving one onto an occupied beat leaves both', () => {
    // A move is not a statement about which of two should win, and silently deleting the one
    // already there would destroy a span the user never named.
    addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })
    const mover = addOttava(score, 1, { beat: frac(2, 1), length: frac(1, 1), shift: -1 })!
    expect(updateOttava(score, mover.id, { beat: frac(0, 1) })).not.toBeNull()
    expect(measureOttavas(score.measures[0])).toHaveLength(2)
  })
})

describe('ottavaOps — removal, and what dies with it', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  it('removes by id and drops the array once it is empty', () => {
    const id = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!.id
    expect(removeOttava(score, id)).toBe(true)
    expect(score.measures[0].ottavas).toBeUndefined()
    expect(removeOttava(score, id)).toBe(false) // second removal is a no-op
  })

  it('takes any engraving override keyed to it — an override may not outlive its anchor', () => {
    const id = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!.id
    const nudge: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 3, y: -4 }
    setEngravingOverride(score, id, nudge)
    expect(engravingOverridesOf(score, id)).toHaveLength(1)

    removeOttava(score, id)
    expect(engravingOverridesOf(score, id)).toHaveLength(0)
  })

  it('takes the REPLACED line\'s override too, when an upsert evicts it', () => {
    // The eviction inside addOttava is a removal by another name, so it must clean up like one.
    const first = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!
    setEngravingOverride(score, first.id, { kind: 'dynamicOffset', x: 1, y: 1 } as DynamicOffsetOverride)
    addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: -1 })
    expect(engravingOverridesOf(score, first.id)).toHaveLength(0)
  })
})

/**
 * The span — the price of having no foreign key, paid here rather than in the renderer. Nothing on
 * an `Ottava` names the bar it ends in, so the end address is DERIVED from the music that is
 * actually there, every time.
 */
describe('ottavaOps — ottavaSpan walks the bars\' capacities', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // 4/4
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  it('answers within one bar', () => {
    const id = addOttava(score, 1, { beat: frac(1, 1), length: frac(2, 1), shift: 1 })!.id
    const span = ottavaSpan(score, id)!
    expect(span.startMeasure).toBe(1)
    expect(fracToNumber(span.startBeat)).toBe(1)
    expect(span.endMeasure).toBe(1)
    expect(fracToNumber(span.endBeat)).toBe(3)
  })

  it('walks into a later bar', () => {
    const id = addOttava(score, 1, { beat: frac(2, 1), length: frac(5, 1), shift: 1 })!.id
    const span = ottavaSpan(score, id)!
    expect(span.endMeasure).toBe(2)
    expect(fracToNumber(span.endBeat)).toBe(3) // 2 remaining in bar 1, then 3 into bar 2
  })

  it('an end landing exactly on the barline belongs to THIS bar, not beat 0 of the next', () => {
    // `<` instead of `<=` here would govern one whole bar too much — and under an ottava that is
    // an extra bar of music sounding an octave away.
    const id = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!.id
    const span = ottavaSpan(score, id)!
    expect(span.endMeasure).toBe(1)
    expect(fracToNumber(span.endBeat)).toBe(4)
  })

  it('CLAMPS a span running past the end of the score to the last bar\'s end', () => {
    const id = addOttava(score, 3, { beat: frac(0, 1), length: frac(40, 1), shift: 1 })!.id
    const span = ottavaSpan(score, id)!
    expect(span.endMeasure).toBe(3)
    expect(fracToNumber(span.endBeat)).toBe(4)
  })

  it('returns null for an id nothing holds', () => {
    expect(ottavaSpan(score, 'nope')).toBeNull()
  })
})

describe('ottavaOps — the JSON round trip', () => {
  it('survives export/import verbatim, Fractions and signed shift included', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const created = addOttava(model.getScore(), 1, { beat: frac(1, 2), length: frac(7, 2), shift: -2 })!

    const reloaded = ScoreModel.fromJSON(model.toJSON())
    const stored = measureOttavas(reloaded.getScore().measures[0])
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(created.id)
    expect(stored[0].shift).toBe(-2)
    expect(fracToNumber(stored[0].beat)).toBe(0.5)
    expect(fracToNumber(stored[0].length)).toBe(3.5)
  })
})

/**
 * ⭐ `addOttavaOverNotes` — the arithmetic behind BOTH doors (the palette over a selection, and one
 * click of the stamp). The caller says which notes; this says how much music that is.
 *
 * ⚠️ The assertions are on the SPAN rather than on the raw length wherever the two differ, because
 * the span is what every reader downstream actually asks — and because a length that looks right in
 * beats can still end on the wrong side of a barline.
 */
describe('ottavaOps — addOttavaOverNotes', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // 4/4
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  const over = (
    start: [number, number], end: [number, number], endLen: number, shift: -3 | -2 | -1 | 1 | 2 | 3 = 1,
  ) => addOttavaOverNotes(
    score, shift,
    { measure: start[0], beat: frac(start[1], 1) },
    { measure: end[0], beat: frac(end[1], 1), length: frac(endLen, 1) },
  )

  it('⭐ COVERS the last note — the span reaches past its onset, not up to it', () => {
    // Not a matter of taste as it is for a wedge: the span is HALF-OPEN, so an end on the last
    // note's onset would leave it drawn under the bracket and sounding un-shifted.
    const created = over([1, 0], [1, 3], 1)!
    expect(fracToNumber(created.length)).toBe(4)
    expect(soundingShiftAtBeat(score, 1, 3)).toBe(12)
  })

  it('one note gives a line covering exactly that note', () => {
    const created = over([1, 1], [1, 1], 1)!
    expect(fracToNumber(created.beat)).toBe(1)
    expect(fracToNumber(created.length)).toBe(1)
    expect(soundingShiftAtBeat(score, 1, 0)).toBe(0)
    expect(soundingShiftAtBeat(score, 1, 1)).toBe(12)
    expect(soundingShiftAtBeat(score, 1, 2)).toBe(0)
  })

  it('reaches across barlines by walking the bars’ capacities', () => {
    const created = over([1, 2], [2, 1], 1)!
    expect(fracToNumber(created.length)).toBe(4) // 2 left in bar 1, then 0..2 of bar 2
    const span = ottavaSpan(score, created.id)!
    expect(span.endMeasure).toBe(2)
    expect(fracToNumber(span.endBeat)).toBe(2)
  })

  it('refuses a span that covers no music, and one that runs backwards', () => {
    expect(over([1, 2], [1, 2], 0)).toBeNull()
    expect(over([2, 0], [1, 0], 1)).toBeNull()
  })

  it('refuses a measure that does not exist rather than guessing', () => {
    expect(over([9, 0], [9, 1], 1)).toBeNull()
  })

  it('⭐ UPSERTS through the same door — two calls on one beat leave ONE line', () => {
    const first = over([1, 0], [1, 1], 1, 1)!
    const second = over([1, 0], [1, 3], 1, -1)!
    expect(measureOttavas(score.measures[0])).toHaveLength(1)
    expect(getOttavaById(score, first.id)).toBeNull()
    expect(getOttavaById(score, second.id)!.shift).toBe(-1)
  })

  it('carries the staff it was given, and nothing else', () => {
    const lower = model.addStaffBelow(0)
    const created = addOttavaOverNotes(
      score, 1, { measure: 1, beat: frac(0, 1) },
      { measure: 1, beat: frac(0, 1), length: frac(1, 1) }, lower)!
    expect(created.staffId).toBe(lower)
    // ⭐ No voice — the one span in this model that has none. If a `voice` ever appears on an
    // `Ottava`, this assertion is the first thing that should have to be deleted.
    expect('voice' in created).toBe(false)
  })
})

/**
 * ⭐⭐ `Ctrl+Shift+←/→` with the bracket's END square armed — the model write behind the key
 * (his ask, 2026-08-17).
 *
 * ⭐ **The lane is the STAFF**, which is the one place this differs from the hairpin's resize and
 * the reason it is its own function: an octave line has no voice, so every voice's onset is a step
 * it can take. The chapter's last two cases are what would go wrong if it walked a voice instead —
 * and both are audible, not cosmetic, because the span decides which notes SOUND displaced.
 */
describe('ottavaOps — resizeOttavaBySlot', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
  })

  /** Four quarters in bar `m`. */
  const quarters = (m: number) =>
    [0, 1, 2, 3].map(b =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1) }))

  const lengthOf = (id: string) => fracToNumber(getOttavaById(score, id)!.length)

  it('GROWS through the next slot — its onset PLUS its own length, so the note is covered', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(true)
    expect(lengthOf(o.id)).toBe(2)
    // ⭐ The point of "through", not "to": the beat-1 quarter now SOUNDS an octave up. An end that
    // stopped ON its onset would draw a bracket over a note the half-open span leaves alone.
    expect(soundingShiftAtBeat(score, 1, 1)).toBe(12)
    expect(soundingShiftAtBeat(score, 1, 2)).toBe(0)
  })

  it('SHRINKS by dropping the last slot it holds', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(3, 1), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, -1)).toBe(true)
    expect(lengthOf(o.id)).toBe(2)
    expect(soundingShiftAtBeat(score, 1, 2), 'let go of the beat-2 quarter').toBe(0)
  })

  it('⛔ REFUSES to shrink to nothing rather than deleting the line', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, -1)).toBe(false)
    expect(getOttavaById(score, o.id), 'still there — a shortening gesture never destroys').not.toBeNull()
    expect(lengthOf(o.id)).toBe(1)
  })

  it('grows ACROSS a barline into the next bar\'s music', () => {
    quarters(1)
    quarters(2)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: -1 })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(true)
    expect(lengthOf(o.id)).toBe(5) // through bar 2's first quarter
    expect(soundingShiftAtBeat(score, 2, 0)).toBe(-12)
  })

  it('declines when there is nothing further in the score at all', () => {
    quarters(1)
    quarters(2)
    const o = addOttava(score, 2, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(false)
  })

  it('declines for an id no ottava has', () => {
    quarters(1)
    expect(resizeOttavaBySlot(score, 'nope', 1)).toBe(false)
  })

  it('⭐⭐ steps through EVERY VOICE of its staff — a hairpin walks one voice, an octave line the staff', () => {
    // An eighth in voice 2 between the voice-1 quarters IS a step, because the line displaces it too.
    // Walking voice 1 alone would jump the end from beat ½ straight to beat 1 and silently re-octave
    // a note the key never passed.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 2), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(true)
    expect(lengthOf(o.id), 'the voice-2 eighth: ½ + ½').toBe(1)
  })

  it('⭐ two voices attacking TOGETHER are one step, and it reaches through the LONGER of them', () => {
    // Voice 1 takes a quarter at beat 2, voice 2 a half. Reaching through the quarter would put the
    // end at beat 3 — a position no onset occupies, so the bracket would stop inside a sounding
    // note and the next press would have to skip the rest of it. The longer slot is the one that
    // makes the end a boundary again.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 })
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(2, 1), shift: 1 })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(true)
    expect(lengthOf(o.id), 'through the HALF at beat 2, not the quarter beside it').toBe(4)
  })

  it('⭐ stays on ITS OWN staff — the other staff\'s onsets are not steps', () => {
    // ⚠️ Built so the two lanes give DIFFERENT answers, or it would agree with itself: the LOWER
    // staff holds one semibreve, so after beat 0 it has no onset until bar 2, while the upper staff
    // has one every quarter. A line on the lower staff that leaked into the upper would stop at
    // beat 1; reading its own staff it must reach bar 2.
    const lower = model.addStaffBelow(0)
    quarters(1)
    model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'w', measure: 1, beat: frac(0, 1), staff: 1 })
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1, staffId: lower })!
    expect(resizeOttavaBySlot(score, o.id, 1)).toBe(true)
    expect(lengthOf(o.id), 'past the semibreve into bar 2, not the upper staff\'s beat 1').toBe(8)
  })
})

/**
 * ⭐⭐ `Ctrl+Shift+←/→` with the bracket's BEGINNING square armed — the other half of the pair
 * (his ask, 2026-08-17).
 *
 * ⭐ **What every case here is really checking is that the END DID NOT MOVE.** The model stores a
 * start and an AMOUNT, so holding the end is `length' = end − start'` — arithmetic that is easy to
 * get right in one direction and wrong in the other, and whose failure looks like the whole bracket
 * sliding. Each case therefore asserts the end address, not just the length.
 */
describe('ottavaOps — moveOttavaStartBySlot', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
  })

  const quarters = (m: number) =>
    [0, 1, 2, 3].map(b =>
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1) }))

  /** The span's END, as (measure, beat) — the quantity these gestures must never disturb. */
  const endOf = (id: string) => {
    const s = ottavaSpan(score, id)!
    return [s.endMeasure, fracToNumber(s.endBeat)]
  }

  it('⭐ REACHES BACK a slot and the end stays put — the length grows by exactly the step', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(2, 1), length: frac(2, 1), shift: 1 })!
    expect(moveOttavaStartBySlot(score, o.id, -1)).toBe(true)
    expect(fracToNumber(getOttavaById(score, o.id)!.beat)).toBe(1)
    expect(endOf(o.id), 'the end has not moved').toEqual([1, 4])
    expect(soundingShiftAtBeat(score, 1, 1), 'the note it reached back over is now displaced').toBe(12)
  })

  it('⭐ STEPS IN a slot and the end stays put', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(moveOttavaStartBySlot(score, o.id, 1)).toBe(true)
    expect(fracToNumber(getOttavaById(score, o.id)!.beat)).toBe(1)
    expect(endOf(o.id)).toEqual([1, 4])
    expect(soundingShiftAtBeat(score, 1, 0), 'the note it let go of is back to written pitch').toBe(0)
  })

  it('⛔ REFUSES to step the beginning onto or past the end, rather than deleting the line', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(2, 1), length: frac(1, 1), shift: 1 })!
    expect(moveOttavaStartBySlot(score, o.id, 1)).toBe(false)
    expect(getOttavaById(score, o.id), 'still there').not.toBeNull()
    expect(fracToNumber(getOttavaById(score, o.id)!.beat)).toBe(2)
  })

  it('declines when there is no earlier slot to reach back to', () => {
    quarters(1)
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(2, 1), shift: 1 })!
    expect(moveOttavaStartBySlot(score, o.id, -1)).toBe(false)
  })

  it('⭐⭐ a beginning crossing a BARLINE re-files the line, keeping the SAME id', () => {
    quarters(1)
    quarters(2)
    const o = addOttava(score, 2, { beat: frac(0, 1), length: frac(4, 1), shift: -1 })!
    expect(moveOttavaStartBySlot(score, o.id, -1)).toBe(true)
    // It now lives on bar 1 — the list it sits in IS "the lines that start here".
    expect(measureOttavas(score.measures[0]).map(x => x.id)).toEqual([o.id])
    expect(measureOttavas(score.measures[1])).toHaveLength(0)
    expect(score.measures[1].ottavas, 'an emptied array is DELETED, not left as []').toBeUndefined()
    // ⭐ Same id — a re-created line would deselect itself mid-gesture, taking the square with it.
    expect(getOttavaById(score, o.id)).not.toBeNull()
    expect(fracToNumber(getOttavaById(score, o.id)!.beat)).toBe(3)
    expect(endOf(o.id), 'and the end still has not moved').toEqual([2, 4])
  })

  it('⭐ steps through EVERY VOICE of its staff, like the end does', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })
    const o = addOttava(score, 1, { beat: frac(1, 1), length: frac(3, 1), shift: 1 })!
    expect(moveOttavaStartBySlot(score, o.id, -1)).toBe(true)
    expect(fracToNumber(getOttavaById(score, o.id)!.beat), 'the voice-2 eighth at ½').toBe(0.5)
    expect(endOf(o.id)).toEqual([1, 4])
  })

  it('declines for an id no ottava has', () => {
    quarters(1)
    expect(moveOttavaStartBySlot(score, 'nope', -1)).toBe(false)
  })
})

/**
 * ⭐⭐ One frame of a DRAG — {@link applyOttavaDrag}, the mouse's road to the same two model writes
 * the keyboard reaches by stepping.
 *
 * ⭐ **The claim worth pinning is that there are TWO cases and not the hairpin's three.** A wedge's
 * tip is drawn at the first UNCOVERED note, so a drag has to say "end before this slot" as well as
 * "cover it"; a bracket ends ON its last notehead, so every address a drag can name is a covered
 * slot. Porting the third case would end the line one note early, pointing at nothing.
 */
describe('ottavaOps — applyOttavaDrag', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    score = model.getScore()
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
  })

  const spanOf = (id: string) => {
    const sp = ottavaSpan(score, id)!
    return [sp.startMeasure, fracToNumber(sp.startBeat), sp.endMeasure, fracToNumber(sp.endBeat)]
  }

  it('⭐ an END drop COVERS the slot it names — its onset PLUS its own length', () => {
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })!
    expect(applyOttavaDrag(score, o.id, { at: 'end', measure: 1, beat: frac(2, 1) })).toBe(true)
    expect(spanOf(o.id)).toEqual([1, 0, 1, 3])
    expect(soundingShiftAtBeat(score, 1, 2), 'the note dropped on is displaced').toBe(12)
    expect(soundingShiftAtBeat(score, 1, 3)).toBe(0)
  })

  it('⭐ an END drop SHORTENS as readily as it lengthens — a drag has no direction', () => {
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(applyOttavaDrag(score, o.id, { at: 'end', measure: 1, beat: frac(1, 1) })).toBe(true)
    expect(spanOf(o.id)).toEqual([1, 0, 1, 2])
  })

  it('⭐ a START drop holds the END, exactly as the arrow key does', () => {
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })!
    expect(applyOttavaDrag(score, o.id, { at: 'start', measure: 1, beat: frac(2, 1) })).toBe(true)
    expect(spanOf(o.id)).toEqual([1, 2, 1, 4])
  })

  it('⛔ refuses a drop that would leave the line covering nothing, and one off its staff', () => {
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(2, 1), shift: 1 })!
    // A start dropped ON or past the end: refused rather than deleting the line.
    expect(applyOttavaDrag(score, o.id, { at: 'start', measure: 1, beat: frac(3, 1) })).toBe(false)
    // An address with no slot at it — bar 9 does not exist, and beat 7 of bar 1 holds nothing.
    expect(applyOttavaDrag(score, o.id, { at: 'end', measure: 9, beat: frac(0, 1) })).toBe(false)
    expect(applyOttavaDrag(score, o.id, { at: 'start', measure: 1, beat: frac(7, 1) })).toBe(false)
    expect(spanOf(o.id), 'untouched by all three').toEqual([1, 0, 1, 2])
  })

  it('⭐ a START dragged across a BARLINE re-files the line, keeping the same id', () => {
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(b, 1) })
    }
    const o = addOttava(score, 1, { beat: frac(0, 1), length: frac(6, 1), shift: 1 })!
    expect(applyOttavaDrag(score, o.id, { at: 'start', measure: 2, beat: frac(1, 1) })).toBe(true)
    expect(measureOttavas(score.measures[1]).map(x => x.id)).toEqual([o.id])
    expect(score.measures[0].ottavas).toBeUndefined()
    expect(spanOf(o.id), 'and the end has not moved').toEqual([2, 1, 2, 2])
  })
})
