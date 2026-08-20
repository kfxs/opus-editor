/**
 * {@link soundingShiftAt} / {@link soundingShiftBySlot} — **the one place written pitch becomes
 * sound** (docs/ottava-plan.md §6).
 *
 * The model stores what the notehead says, so this function is the entire difference between the
 * page and the ear. What is asked here is its resolution rules: the span is half-open, it is
 * per-STAFF, and ⭐ when two octave lines cover one note the **latest-starting one still covering
 * it** wins — `effectiveClefAt`'s rule, never a sum.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./soundingShift`.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addOttava } from '@/engine/models/ottavaOps'
import { fracCreate as frac } from './fraction'
import { applySoundingShift, soundingShiftAt, soundingShiftBySlot } from './soundingShift'
import { pitchToMidi } from './pitchSpelling'

describe('soundingShiftAt — the position under an octave line', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  it('is 0 for a score with no octave line at all', () => {
    expect(soundingShiftAt(score, 1, frac(0, 1))).toBe(0)
  })

  it('is +12 under an 8va and −12 under an 8vb — SEMITONES, not octaves', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    expect(soundingShiftAt(score, 1, frac(2, 1))).toBe(12)

    model.removeOttava(score.measures[0].ottavas![0].id)
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: -1 })
    expect(soundingShiftAt(score, 1, frac(2, 1))).toBe(-12)
  })

  it('scales with |shift| — a 15ma is two octaves', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 2 })
    expect(soundingShiftAt(score, 1, frac(0, 1))).toBe(24)
  })

  it('⭐ the span is HALF-OPEN — the note where it ends is the first one NOT under it', () => {
    // `length` is an amount of MUSIC: a note attacking exactly at the end is outside the bracket.
    addOttava(score, 1, { beat: frac(1, 1), length: frac(2, 1), shift: 1 })
    expect(soundingShiftAt(score, 1, frac(0, 1)), 'before the start').toBe(0)
    expect(soundingShiftAt(score, 1, frac(1, 1)), 'ON the start — inside').toBe(12)
    expect(soundingShiftAt(score, 1, frac(2, 1)), 'mid-span').toBe(12)
    expect(soundingShiftAt(score, 1, frac(3, 1)), 'ON the end — outside').toBe(0)
  })

  it('reaches across barlines — the extent is music, not a bar count', () => {
    addOttava(score, 1, { beat: frac(2, 1), length: frac(6, 1), shift: 1 })
    expect(soundingShiftAt(score, 2, frac(0, 1))).toBe(12)
    expect(soundingShiftAt(score, 2, frac(3, 1))).toBe(12)
    expect(soundingShiftAt(score, 3, frac(0, 1)), 'the span ran out at bar 2\'s end').toBe(0)
  })

  it('⭐ governs ONE staff — the other is untouched', () => {
    const lower = model.addStaffBelow(0)
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    expect(soundingShiftAt(score, 1, frac(0, 1))).toBe(12)
    expect(soundingShiftAt(score, 1, frac(0, 1), lower)).toBe(0)
  })

  it('treats an EXPLICIT first-staff id and an absent one as the same staff', () => {
    const firstStaffId = score.staves![0].id
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    expect(soundingShiftAt(score, 1, frac(0, 1), firstStaffId)).toBe(12)
  })

  it('answers 0 for a measure that does not exist rather than guessing', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(4, 1), shift: 1 })
    expect(soundingShiftAt(score, 99, frac(0, 1))).toBe(0)
  })
})

/**
 * ⭐⭐ THE OVERLAP RULE. `ottavaOps` refuses two lines that START on one (beat, staff) but leaves two
 * merely overlapping ones storable — so this is the reader that has to choose, and the choice is
 * `effectiveClefAt`'s: the latest-starting line that still covers the position.
 */
describe('soundingShiftAt — two lines over one note', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    model.addMeasure()
    score = model.getScore()
  })

  it('⭐ the LATER-starting line takes over, exactly as a clef change does', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(8, 1), shift: 1 })  // 8va over bars 1–2
    addOttava(score, 1, { beat: frac(2, 1), length: frac(2, 1), shift: 2 })  // 15ma from beat 2

    expect(soundingShiftAt(score, 1, frac(1, 1)), 'before the inner one').toBe(12)
    expect(soundingShiftAt(score, 1, frac(2, 1)), 'the inner one takes over').toBe(24)
  })

  it('⭐ …and the outer one RESUMES when the inner ends — the question is what COVERS the note', () => {
    addOttava(score, 1, { beat: frac(0, 1), length: frac(8, 1), shift: 1 })
    addOttava(score, 1, { beat: frac(2, 1), length: frac(2, 1), shift: 2 })
    expect(soundingShiftAt(score, 2, frac(0, 1))).toBe(12)
  })

  it('⛔ NEVER a sum — two 8vas over one note are 12, not 24', () => {
    // Adding them would turn the least reliable input (a contradiction) into the loudest wrong
    // answer. Two lines saying different things is not a 15ma.
    score.measures[0].ottavas = [
      { id: 'a', beat: frac(0, 1), length: frac(4, 1), shift: 1 },
      { id: 'b', beat: frac(1, 1), length: frac(2, 1), shift: 1 },
    ]
    expect(soundingShiftAt(score, 1, frac(1, 1))).toBe(12)
  })

  it('on an exact tie of start beats, the LAST stored wins', () => {
    // `ottavaOps` upserts, so this only arrives from hand-written JSON — but it must be total.
    score.measures[0].ottavas = [
      { id: 'a', beat: frac(0, 1), length: frac(4, 1), shift: 1 },
      { id: 'b', beat: frac(0, 1), length: frac(4, 1), shift: -1 },
    ]
    expect(soundingShiftAt(score, 1, frac(0, 1))).toBe(-12)
  })
})

describe('soundingShiftBySlot — the per-slot prepass', () => {
  let model: ScoreModel
  let score: Score
  beforeEach(() => {
    model = new ScoreModel()
    model.addMeasure()
    score = model.getScore()
  })

  const noteAt = (beat: number, measure = 1) =>
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure, beat: frac(beat, 1) })

  it('is EMPTY for a score with no octave line — the un-shifted path costs one map lookup', () => {
    noteAt(0); noteAt(1)
    expect(soundingShiftBySlot(score).size).toBe(0)
  })

  it('carries only the shifted slots, keyed by SLOT id', () => {
    const a = noteAt(0)
    const b = noteAt(2)
    addOttava(score, 1, { beat: frac(0, 1), length: frac(1, 1), shift: 1 })

    const shifts = soundingShiftBySlot(score)
    /** The SLOT holding a flat note's id — the prepass is keyed by the slot, not by the pitch. */
    const slotOf = (noteId: string) =>
      score.measures[0].slots.find(s => s.type === 'chord' && s.notes.some(n => n.id === noteId))!.id
    expect(shifts.get(slotOf(a.id))).toBe(12)
    expect(shifts.has(slotOf(b.id)), 'outside the span').toBe(false)
    expect(shifts.size).toBe(1)
  })

  it('agrees with soundingShiftAt on every slot it covers', () => {
    noteAt(0); noteAt(1); noteAt(2); noteAt(3)
    addOttava(score, 1, { beat: frac(1, 1), length: frac(2, 1), shift: -1 })

    const shifts = soundingShiftBySlot(score)
    for (const slot of score.measures[0].slots) {
      expect(shifts.get(slot.id) ?? 0).toBe(soundingShiftAt(score, 1, slot.beat, slot.staffId))
    }
  })
})

/**
 * ⭐⭐ {@link applySoundingShift} — **the fold that lets the schedule carry a PITCH.**
 *
 * Built 2026-08-20 with the pitch-not-MIDI move (docs/playback-semantics-plan.md). The whole
 * question is which FIELD the shift lands in, and the answer is `octave`: an octave is 12 semitones,
 * ×2 in frequency and +1 to the octave number in every tuning system, so this is the one
 * transformation that survives a change of representation. ⛔ `alter` is never touched — an 8va
 * changes a register, not an accidental.
 */
describe('applySoundingShift', () => {
  const C4 = { step: 'C', alter: 0, octave: 4 } as const

  it('an unshifted note comes back as itself', () => {
    expect(applySoundingShift(C4, 0)).toEqual({ step: 'C', alter: 0, octave: 4 })
  })

  it('⭐ an octave up is +1 to the OCTAVE — not +12 to anything else', () => {
    expect(applySoundingShift(C4, 12)).toEqual({ step: 'C', alter: 0, octave: 5 })
    expect(applySoundingShift(C4, 24), 'two octaves').toEqual({ step: 'C', alter: 0, octave: 6 })
    expect(applySoundingShift(C4, -12)).toEqual({ step: 'C', alter: 0, octave: 3 })
  })

  it('⛔ leaves `alter` alone — the accidental is NOTATION and an octave line is not', () => {
    const fSharp3 = { step: 'F', alter: 1, octave: 3 } as const
    expect(applySoundingShift(fSharp3, 12)).toEqual({ step: 'F', alter: 1, octave: 4 })
  })

  it('⭐ keeps the ENHARMONIC — which is the entire reason the schedule carries a spelling', () => {
    // G♯4 and A♭4 are one MIDI number and two pitches (meantone: G♯ is the lower).
    const gSharp = applySoundingShift({ step: 'G', alter: 1, octave: 4 }, 12)
    const aFlat = applySoundingShift({ step: 'A', alter: -1, octave: 4 }, 12)
    expect(gSharp).not.toEqual(aFlat)
    expect(pitchToMidi(gSharp), 'and they are still enharmonic').toBe(pitchToMidi(aFlat))
  })

  it('does not mutate its input', () => {
    const written = { step: 'D', alter: -1, octave: 5 } as const
    applySoundingShift(written, -24)
    expect(written).toEqual({ step: 'D', alter: -1, octave: 5 })
  })

  describe('a shift that is NOT a whole octave', () => {
    afterEach(() => { vi.restoreAllMocks() })

    it('🚨 sounds the WRITTEN pitch and says so — ⛔ it never rounds to the nearest octave', () => {
      // Unreachable from any score the editor writes (`Ottava.shift` counts octaves), reachable from
      // hand-edited JSON. A non-octave shift is a SPELLING transposition, not a number — see the
      // function's note and docs/tuning-systems-and-alteration.md.
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(applySoundingShift(C4, 7), 'unshifted, not C4+7 rounded anywhere')
        .toEqual({ step: 'C', alter: 0, octave: 4 })
      expect(spy).toHaveBeenCalledOnce()
    })
  })
})
