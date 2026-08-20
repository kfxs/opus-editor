/**
 * ⭐⭐ **THE SUSTAIN PEDAL SOUNDS** (docs/pedal-plan.md §9, P1) — notes struck under a depressed
 * damper ring until the foot comes up, and nothing else about them changes.
 *
 * That last clause is what most of this chapter is for. The clamp itself is one line; the reason it
 * is a POST-PASS over emitted events rather than a longer sounding length is that the repeat
 * families GENERATE their subdivisions from that length, so extending it upstream would make a
 * pedalled trill trill more. ⭐ **The break-test that matters is therefore a COUNT, not a duration**:
 * a trill under a pedal must have exactly the attacks it had without one. It is written to fail on
 * the implementation this file exists to rule out.
 *
 * The window arithmetic (absolute clock, half-open, which staves) is `utils/pedalScope.test.ts`'s.
 */
import { describe, it, expect } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from '../models/ScoreModel'
import { addPedal } from '../models/pedalOps'
import { collectScheduledNotes } from './playbackSchedule'
import { fracCreate as frac } from '@/utils/fraction'
import { pitchToMidi } from '@/utils/pitchSpelling'

/** Sounding length of the event attacked at `onset` (the first one, if several share it). */
const lengthAt = (score: Score, onset: number) =>
  collectScheduledNotes(score).find(e => Math.abs(e.startBeats - onset) < 1e-9)!.durationBeats

/** Every event, in onset order. */
const evs = (score: Score) => collectScheduledNotes(score).sort((a, b) => a.startBeats - b.startBeats)

/** One quarter note per beat of bar `m`, 4/4. */
function quarters(model: ScoreModel, m: number, beats: number[] = [0, 1, 2, 3]) {
  return beats.map(b =>
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1) }))
}

describe('a note under the pedal rings to the LIFT', () => {
  it('⭐ holds a quarter for the whole pedal — release moves to the lift', () => {
    const model = new ScoreModel()
    quarters(model, 1)
    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1) })

    // Every note of the bar rings to beat 4, whatever its own written length.
    expect(lengthAt(model.getScore(), 0)).toBeCloseTo(4, 10)
    expect(lengthAt(model.getScore(), 1)).toBeCloseTo(3, 10)
    expect(lengthAt(model.getScore(), 3)).toBeCloseTo(1, 10)
  })

  it('⭐ NEVER shortens — a note already outlasting the lift keeps its own length', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(1, 1) })
    expect(lengthAt(model.getScore(), 0)).toBeCloseTo(4, 10) // the whole note, untouched
  })

  it('holds across a barline when the lift is in a later bar', () => {
    const model = new ScoreModel()
    model.addMeasure()
    quarters(model, 1)
    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(6, 1) })
    expect(lengthAt(model.getScore(), 3)).toBeCloseTo(3, 10) // beat 3 → the lift at 6
  })

  it('⭐ arrives through JSON — which is P1\'s whole promise, since nothing enters one by hand yet', () => {
    // The editor has no pedal door until P4, so the only way to hear one today is to write it into
    // the file. `fromJSON` assigns the parsed score wholesale, so this is the real path a user takes.
    const model = new ScoreModel()
    quarters(model, 1)
    const raw = JSON.parse(model.toJSON())
    raw.measures[0].pedals = [{ id: 'pd-json', beat: { num: 0, den: 1 }, length: { num: 4, den: 1 } }]

    const loaded = ScoreModel.fromJSON(JSON.stringify(raw))
    expect(lengthAt(loaded.getScore(), 0)).toBeCloseTo(4, 10)
    // …and it survives the round trip back out, so the file is not quietly losing it.
    expect(JSON.parse(loaded.toJSON()).measures[0].pedals).toHaveLength(1)
  })

  it('changes nothing at all when the score has no pedal', () => {
    const model = new ScoreModel()
    quarters(model, 1)
    const before = evs(model.getScore()).map(e => e.durationBeats)
    expect(before.every(d => Math.abs(d - 1) < 1e-9)).toBe(true)
  })
})

describe('WHICH notes it holds — onset membership, half-open', () => {
  it('does not catch a note struck BEFORE the press', () => {
    const model = new ScoreModel()
    quarters(model, 1)
    addPedal(model.getScore(), 1, { beat: frac(2, 1), length: frac(2, 1) })

    expect(lengthAt(model.getScore(), 0)).toBeCloseTo(1, 10) // before the press — its key is up
    expect(lengthAt(model.getScore(), 1)).toBeCloseTo(1, 10)
    expect(lengthAt(model.getScore(), 2)).toBeCloseTo(2, 10) // caught
    expect(lengthAt(model.getScore(), 3)).toBeCloseTo(1, 10) // caught, but the lift is at 4
  })

  it('⭐ does not catch a note struck exactly ON the lift — its own damper is down again', () => {
    const model = new ScoreModel()
    quarters(model, 1)
    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(2, 1) })
    expect(lengthAt(model.getScore(), 2)).toBeCloseTo(1, 10)
  })

  it('governs the staff it is on — the other staff plays as written', () => {
    const model = new ScoreModel()
    const lower = model.addStaffBelow(0)
    model.addNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
    model.addNote({ step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1), staffId: lower })

    const sounded = evs(model.getScore())
    expect(sounded.find(e => pitchToMidi(e.pitch) === 72)!.durationBeats).toBeCloseTo(1, 10) // upper staff, untouched
    expect(sounded.find(e => pitchToMidi(e.pitch) === 48)!.durationBeats).toBeCloseTo(4, 10) // lower staff, held
  })

  it('⭐ two OVERLAPPING pedals: the latest press at or before the onset wins', () => {
    // The model permits this (only the entry door truncates — docs/pedal-plan.md §3.3), so the
    // reader has to resolve it, and it resolves the way the foot does: pressing again lifts first.
    const model = new ScoreModel()
    model.addMeasure()
    quarters(model, 1)
    const score = model.getScore()
    addPedal(score, 1, { beat: frac(0, 1), length: frac(8, 1) }) // down from 0 to 8
    addPedal(score, 1, { beat: frac(2, 1), length: frac(1, 1) }) // re-pressed at 2, up at 3

    expect(lengthAt(score, 0)).toBeCloseTo(8, 10) // struck under the first press
    expect(lengthAt(score, 2)).toBeCloseTo(1, 10) // …the re-press ends at 3, ⛔ not 8
    expect(lengthAt(score, 3)).toBeCloseTo(5, 10) // past the re-press's lift: the long one again
  })
})

describe('⭐ the pedal beats the articulation', () => {
  it('a STACCATO note under the pedal rings — the damper is up, whatever the key did', () => {
    const model = new ScoreModel()
    const [note] = quarters(model, 1, [0])
    model.updateNote(note.id, { articulations: ['staccato'] })

    const dry = lengthAt(model.getScore(), 0)
    expect(dry).toBeLessThan(1) // staccato shortened it…

    addPedal(model.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1) })
    expect(lengthAt(model.getScore(), 0)).toBeCloseTo(4, 10) // …and the pedal overrides that
  })
})

/**
 * ⭐⭐ THE BREAK-TESTS. Each of these passes today and FAILS on the implementation this design
 * rejects — extending the slot's sounding length before the family expands it.
 */
describe('⭐⭐ a repeat family under the pedal keeps its own attacks', () => {
  it('a TRILL under a pedal has exactly the attacks it had without one', () => {
    const trilled = () => {
      const model = new ScoreModel()
      const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      model.addTrill({ startNoteId: note.id })
      return model
    }

    const dry = collectScheduledNotes(trilled().getScore()).length
    expect(dry).toBeGreaterThan(1) // it really is alternating, or this test proves nothing

    const wet = trilled()
    addPedal(wet.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1) })
    const held = collectScheduledNotes(wet.getScore())

    expect(held).toHaveLength(dry) // ⭐ the pedal must not add one alternation
    // …and every attack rings on to the lift, which is what a real damper does.
    expect(held.every(e => Math.abs(e.durationBeats - (4 - e.startBeats)) < 1e-9)).toBe(true)
  })

  it('a TREMOLO under a pedal has exactly the attacks it had without one', () => {
    const tremoloed = () => {
      const model = new ScoreModel()
      const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      model.setTremolo(note.id, 2) // two strokes on a quarter — measured 16ths, several attacks
      return model
    }

    const dry = collectScheduledNotes(tremoloed().getScore()).length
    expect(dry).toBeGreaterThan(1)

    const wet = tremoloed()
    addPedal(wet.getScore(), 1, { beat: frac(0, 1), length: frac(4, 1) })
    expect(collectScheduledNotes(wet.getScore())).toHaveLength(dry)
  })
})
