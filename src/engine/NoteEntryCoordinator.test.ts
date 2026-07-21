import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoteEntryCoordinator } from './NoteEntryCoordinator'
import { ScoreModel } from './models/ScoreModel'
import { CollisionDetector } from './models/CollisionDetector'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { ElementRegistry } from './ElementRegistry'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { durationToFraction } from '@/utils/durations'
import { getTupletTotalBeatsFrac } from '@/utils/musicUtils'

function makeCoordinator(scoreModel: ScoreModel) {
  const coordinateMapper = new CoordinateMapper({
    measureWidth: 240, staffHeight: 150, startX: 20, startY: 20,
    measuresPerLine: 4, lineSpacing: 10, measureLeftMargin: 100,
  })
  const collisionDetector = new CollisionDetector()
  const elementRegistry = new ElementRegistry()
  const onCommit = vi.fn()
  return new NoteEntryCoordinator(
    () => scoreModel,
    coordinateMapper,
    collisionDetector,
    elementRegistry,
    onCommit,
  )
}

describe('NoteEntryCoordinator.splitExistingNoteWithTie', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    // Ensure we have 2 measures
    scoreModel.addMeasure()
    coordinator = makeCoordinator(scoreModel)
  })

  it('splits a note at beat 0 into the next measure (basic case)', () => {
    // Add a quarter note at beat 0 in measure 1
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    // Request a whole note (4 beats) — only 4 available but note is at beat 0, so no overflow...
    // Let's put it at beat 2 so 2 beats remain, then request a whole note (4 beats) → overflow 2 beats
    scoreModel.deleteNote(note.id)
    const note2 = scoreModel.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    coordinator.splitExistingNoteWithTie(note2, 'w', 2) // whole = 4b, available = 2b, overflow = 2b

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest)
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)

    // Current measure: 2 beats remaining → half note
    expect(m1Notes).toHaveLength(1)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[0].step).toBe('E')

    // Next measure: 2 beats → half note
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('h')
    expect(m2Notes[0].step).toBe('E')

    // Tied together
    expect(m1Notes[0].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[0].id)
  })

  it('spans 3 remaining beats with ONE dotted half, not a half tied to a quarter', () => {
    // Note at beat 1 in 4/4 → 3 beats remain. Request whole (4 beats) → overflow = 1 beat.
    // splitBeatsIntoLengths(3) = [h.], splitBeatsIntoLengths(1) = [q] — the FEWEST values that span
    // it, dots included. It was ['h','q'], which cost an extra note and an extra tie for nothing.
    const note = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    coordinator.splitExistingNoteWithTie(note, 'w', 1) // overflow = 1 beat

    const m1Notes = scoreModel.getNotesInMeasure(1).filter(n => !n.isRest && n.step === 'G')
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest && n.step === 'G')

    // 3 beats in the current measure: ONE dotted half
    expect(m1Notes).toHaveLength(1)
    expect(m1Notes[0].duration).toBe('h')
    expect(m1Notes[0].dots).toBe(1)

    // 1 beat in the next measure: a quarter
    expect(m2Notes).toHaveLength(1)
    expect(m2Notes[0].duration).toBe('q')

    // ONE tie now, not two: dotted half → quarter
    expect(m1Notes[0].tiedTo).toBe(m2Notes[0].id)
    expect(m2Notes[0].tiedFrom).toBe(m1Notes[0].id)
    expect(m2Notes[0].tiedTo).toBeUndefined()
  })

  it('creates the next measure automatically if it does not exist', () => {
    // ScoreModel starts with 1 measure; remove the extra one we added
    const freshModel = new ScoreModel('Test')
    const freshCoord = makeCoordinator(freshModel)
    expect(freshModel.getScore().measures).toHaveLength(1)

    const note = freshModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    freshCoord.splitExistingNoteWithTie(note, 'w', 2)

    expect(freshModel.getScore().measures).toHaveLength(2)
    const m2Notes = freshModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes).toHaveLength(1)
  })

  it('displaces existing content in the next measure (MuseScore-style)', () => {
    // Pre-fill measure 2 with a quarter note
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })

    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    coordinator.splitExistingNoteWithTie(note, 'w', 2) // overflow 2 beats into m2

    // The D in measure 2 should be gone; the tied C continuation should be there instead
    const m2Notes = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2Notes.every(n => n.step !== 'D')).toBe(true)
    expect(m2Notes.some(n => n.step === 'C')).toBe(true)
  })
})

describe('NoteEntryCoordinator — Sibelius-style erosion', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    scoreModel.addMeasure()
    coordinator = makeCoordinator(scoreModel)
  })

  it('trims a straddling note instead of deleting it (headline case)', () => {
    // 4/4: E4q at beat 2 → dotted half (3 beats). Overflow = 1 beat.
    // G4h at beat 0 in M2 straddles: remainder = 2 - 1 = 1 beat → G4q at beat 1
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })
    const note = scoreModel.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    coordinator.splitExistingNoteWithTie(note, 'h', 1) // 2b available, overflow = 1b → M2 gets E4q

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    const g4 = m2NonRest.find(n => n.step === 'G')
    const a4 = m2NonRest.find(n => n.step === 'A')

    // G4 must survive, trimmed to quarter, moved to beat 1
    expect(g4).toBeDefined()
    expect(g4!.duration).toBe('q')
    expect(fracToNumber(g4!.beat)).toBeCloseTo(1)

    // A4 untouched
    expect(a4).toBeDefined()
    expect(a4!.duration).toBe('h')
    expect(fracToNumber(a4!.beat)).toBeCloseTo(2)
  })

  it('deletes a note fully consumed by the overflow zone', () => {
    // G4q at beat 0 in M2, overflow = 2 beats → G4q entirely within [0,2), deleted
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    coordinator.splitExistingNoteWithTie(note, 'w', 2) // overflow = 2 beats

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G')).toBe(true)
  })

  it('writes a trimmed 3-beat remainder as ONE dotted half', () => {
    // G4 whole at beat 0 in M2, overflow = 1 beat → remainder = 3 beats. That is a dotted half at
    // beat 1, not h + q tied (the old plain-only split — see splitBeatsIntoLengths).
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })

    coordinator.splitExistingNoteWithTie(note, 'h', 1) // 1b available, overflow = 1b

    const m2G = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest && n.step === 'G')
    expect(m2G).toHaveLength(1)
    expect(m2G[0].duration).toBe('h')
    expect(m2G[0].dots).toBe(1)
    expect(fracToNumber(m2G[0].beat)).toBeCloseTo(1)
    expect(m2G[0].tiedTo).toBeUndefined() // one value, so nothing to tie it to
  })

  it('breaks the upstream tiedFrom pointer when eroding a note that has tiedFrom', () => {
    // G4h in M2 is the tied continuation of G4h in M1
    const g4m1 = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    const g4m2 = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.updateNote(g4m1.id, { tiedTo: g4m2.id })
    scoreModel.updateNote(g4m2.id, { tiedFrom: g4m1.id })

    // Now enter C4 at beat 2 M1 extended to whole → overflow 2 beats, erodes G4m2
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    coordinator.splitExistingNoteWithTie(note, 'w', 2) // overflow = 2 beats, G4h fully consumed

    // Upstream tie pointer on G4m1 should be cleared
    const updated = scoreModel.getNote(g4m1.id)
    expect(updated?.tiedTo).toBeUndefined()
  })

  it('falls back to deletion when the note to erode has a downstream tiedTo', () => {
    // G4h in M2 is itself tied forward to G4q in M2
    const g4head = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    const g4tail = scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(2, 1) })
    scoreModel.updateNote(g4head.id, { tiedTo: g4tail.id })
    scoreModel.updateNote(g4tail.id, { tiedFrom: g4head.id })

    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    coordinator.splitExistingNoteWithTie(note, 'h', 1) // overflow = 1 beat, G4h straddles

    // G4head must be deleted (punt case), not trimmed
    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G' || n.id === g4tail.id)).toBe(true)
  })

  it('erodes via addNoteAtBeat (addSplitNoteWithTie path)', () => {
    // Same headline scenario but triggered via addNoteAtBeat (new note entry)
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(2, 1) })

    // Fill M1 so beat 2 is a rest: add notes at 0 and 1
    scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Enter E4 dotted-half (3 beats) at beat 2 — overflow 1 beat, should erode G4h → G4q
    coordinator.addNoteAtBeat({
      step: 'E', alter: 0, octave: 4, duration: 'h', dots: 1, measure: 1, beat: frac(2, 1),
    })

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    const g4 = m2NonRest.find(n => n.step === 'G')
    expect(g4).toBeDefined()
    expect(g4!.duration).toBe('q')
    expect(fracToNumber(g4!.beat)).toBeCloseTo(1)
  })

  it('handles mixed overflow zone: fully-consumed note deleted, straddling note trimmed', () => {
    // M2: G4q at beat 0 (fully consumed), A4h at beat 1 (straddles). Overflow = 2 beats.
    // A4h: start=1, end=3, overflow=2 → remainder = 3-2 = 1b → A4q at beat 2
    scoreModel.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    scoreModel.addNote({ step: 'A', alter: 0, octave: 4, duration: 'h', measure: 2, beat: frac(1, 1) })
    const note = scoreModel.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    coordinator.splitExistingNoteWithTie(note, 'w', 2) // overflow = 2 beats

    const m2NonRest = scoreModel.getNotesInMeasure(2).filter(n => !n.isRest)
    expect(m2NonRest.every(n => n.step !== 'G')).toBe(true) // G4q deleted
    const a4 = m2NonRest.find(n => n.step === 'A')
    expect(a4).toBeDefined()
    expect(a4!.duration).toBe('q')
    expect(fracToNumber(a4!.beat)).toBeCloseTo(2)
  })
})

describe('NoteEntryCoordinator — multi-voice duration change isolation', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
    // Two voices, identical streams: q-note@0 + q-rest@1 + h-rest@2 each.
    coordinator.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    coordinator.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
  })

  // voice-1 (model 0) projection of a measure's slots
  const voiceSlots = (model: ScoreModel, measure: number, voice: number) =>
    model.getNotesInMeasure(measure)
      .filter(n => (n.voice ?? 0) === voice)
      .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))

  it('lengthening a rest in one voice leaves the other voice untouched', () => {
    const v1Rest = voiceSlots(scoreModel, 1, 0).find(n => n.isRest && fracToNumber(n.beat) === 1)!
    coordinator.updateNote(v1Rest.id, { duration: 'h' })

    // Edited voice: note@0, half-rest@1 (spans 1–3), quarter-rest@3 — sums to the bar.
    const v0 = voiceSlots(scoreModel, 1, 0)
    expect(v0.map(n => `${n.isRest ? 'r' : 'n'}${n.duration}@${fracToNumber(n.beat)}`))
      .toEqual(['nq@0', 'rh@1', 'rq@3'])

    // Other voice: completely unchanged.
    const v1 = voiceSlots(scoreModel, 1, 1)
    expect(v1.map(n => `${n.isRest ? 'r' : 'n'}${n.duration}@${fracToNumber(n.beat)}`))
      .toEqual(['nq@0', 'rq@1', 'rh@2'])

    // No stray rests past the bar.
    expect(scoreModel.getNotesInMeasure(1).every(n => fracToNumber(n.beat) < 4)).toBe(true)
  })

  it('lengthening a note in voice 2 does not disturb voice 1', () => {
    const v2Note = voiceSlots(scoreModel, 1, 1).find(n => !n.isRest)!
    coordinator.updateNote(v2Note.id, { duration: 'h' })

    const v0 = voiceSlots(scoreModel, 1, 0)
    expect(v0.map(n => `${n.isRest ? 'r' : 'n'}${n.duration}@${fracToNumber(n.beat)}`))
      .toEqual(['nq@0', 'rq@1', 'rh@2'])

    const v1 = voiceSlots(scoreModel, 1, 1)
    expect(v1.map(n => `${n.isRest ? 'r' : 'n'}${n.duration}@${fracToNumber(n.beat)}`))
      .toEqual(['nh@0', 'rh@2'])
  })
})

describe('NoteEntryCoordinator — tuplet in a secondary voice', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  const voiceSlots = (model: ScoreModel, measure: number, voice: number) =>
    model.getNotesInMeasure(measure).filter(n => (n.voice ?? 0) === voice)

  it('applies a tuplet to a voice-2 note without touching voice 1', () => {
    // Voice 0 (UI voice 1) gets a quarter at beat 0, then a voice-1 quarter at beat 0.
    coordinator.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const v2Note = coordinator.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!

    const v0Before = voiceSlots(scoreModel, 1, 0).length
    const result = coordinator.applyTupletToNote(v2Note.id)
    expect(result).not.toBeNull()

    // Every slot in the new tuplet is voice 1.
    const tupletSlots = scoreModel.getNotesInTuplet(result!.tuplet.id)
    expect(tupletSlots.length).toBeGreaterThan(0)
    expect(tupletSlots.every(n => (n.voice ?? 0) === 1)).toBe(true)

    // Voice 0 is untouched by the voice-1 tuplet.
    expect(voiceSlots(scoreModel, 1, 0).length).toBe(v0Before)
    expect(voiceSlots(scoreModel, 1, 0).some(n => !n.isRest && n.step === 'B')).toBe(true)
  })

  it('keeps every slot of a voice-2 tuplet in voice 2 after adding a note inside it', () => {
    // A voice-1 (UI voice 2) triplet, then add a second note inside it.
    const tuplet = scoreModel.createTuplet(1, frac(0, 1), '8', 3, 2, 1)
    scoreModel.refillTupletRemainder(1, tuplet, 1)
    coordinator.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 3), voice: 1 })

    // No slot of this tuplet may leak into voice 0 — a mixed-voice tuplet is what
    // scattered the bracket across both voices and made VexFlow throw on a
    // negative bracket width.
    const tupletSlots = scoreModel.getNotesInTuplet(tuplet.id)
    expect(tupletSlots.length).toBeGreaterThan(0)
    expect(tupletSlots.every(n => (n.voice ?? 0) === 1)).toBe(true)
  })

  it('refuses to create a tuplet whose span overlaps an existing same-voice tuplet', () => {
    // First triplet spans beats 0–1.
    const first = coordinator.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })
    expect(first).not.toBeNull()

    // A second triplet starting at beat 0.5 would span 0.5–1.5 and collide with
    // the first — even though beat 0.5 isn't the first tuplet's start beat.
    const second = coordinator.createTupletAtBeat(1, 0.5, '8', { step: 'A', alter: 0, octave: 4 })
    expect(second).toBeNull()

    // Only the original tuplet survives.
    expect(scoreModel.getMeasure(1)!.tuplets!.length).toBe(1)
  })
})

/**
 * A tuplet whose UNIT is dotted — three DOTTED quarters in the time of two of them.
 *
 * The dot has to reach the span, and the span is what every other decision is made against: the
 * bar-fit check, the overlap check, the rebar event, the filler rests. Drop it at one site and the
 * group is computed a third short, which surfaces as a rebar or overflow bug three layers away and
 * never as "the dot went missing".
 */
describe('NoteEntryCoordinator — dotted tuplet unit', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  it('spans two DOTTED quarters (= 3 beats), not two plain ones', () => {
    const result = coordinator.createTupletAtBeat(1, 0, 'q', { step: 'C', alter: 0, octave: 5 }, 3, 2, 0, 0, 1)
    expect(result).not.toBeNull()
    expect(result!.tuplet.baseDots).toBe(1)

    // 2 × dotted quarter = 3 quarter-beats. Undotted, this would have been 2 — the silent failure.
    const span = getTupletTotalBeatsFrac(result!.tuplet.baseDuration, result!.tuplet.notesOccupied, result!.tuplet.baseDots)
    expect(fracToNumber(span)).toBe(3)

    // Each written note is a DOTTED quarter sounding × 2/3 — one plain quarter.
    const notes = scoreModel.getNotesInTuplet(result!.tuplet.id)
    expect(notes.length).toBe(3)
    expect(notes.every(n => n.duration === 'q' && n.dots === 1)).toBe(true)
    expect(notes.map(n => fracToNumber(n.beat))).toEqual([0, 1, 2])
  })

  it('refuses one that no longer fits the bar once the dot is counted', () => {
    // 3 dotted HALVES in the time of 2 = 6 quarter-beats, past the end of a 4/4 bar. Without the dot
    // the span reads as 4 and it would have been accepted, overfilling the measure.
    const tooBig = coordinator.createTupletAtBeat(1, 0, 'h', { step: 'C', alter: 0, octave: 5 }, 3, 2, 0, 0, 1)
    expect(tooBig).toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets ?? []).toHaveLength(0)
  })

  it('takes the dots off the NOTE when a dotted note is turned into a tuplet', () => {
    const dotted = coordinator.addNoteAtBeat({ step: 'B', alter: 0, octave: 4, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })!
    const result = coordinator.applyTupletToNote(dotted.id)
    expect(result).not.toBeNull()
    expect(result!.tuplet.baseDots).toBe(1)
  })

  it('leaves baseDots absent when there is no dot, so old scores serialize unchanged', () => {
    const plain = coordinator.createTupletAtBeat(1, 0, '8', { step: 'C', alter: 0, octave: 5 })
    expect('baseDots' in plain!.tuplet).toBe(false)
  })
})

/**
 * The rest stamp's click. It is NOTE ENTRY with `isRest`, and the point of these tests is that it
 * behaves like it: a click anywhere in the bar places a rest at that beat, replacing what it covers.
 * The first build hit-tested the glyph instead (`findClosestNoteOrRest`), so every click in open
 * space did nothing and you had to land on the default rest — the bug that produced this shape.
 */
describe('NoteEntryCoordinator.addRestAtPosition', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  // The harness's CoordinateMapper: measure 1 starts at x=20 with a 100px left margin, 240 wide.
  // A click in the middle of the bar is open space — no glyph under it, which is the whole point.
  const clickInBar1 = (x: number) => ({ x, y: 60 })

  it('places a rest from a click in OPEN SPACE — no glyph needed', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(200), 'q', 0)
    expect(rest).not.toBeNull()
    expect(rest!.isRest).toBe(true)
    expect(rest!.duration).toBe('q')
    expect(rest!.measure).toBe(1)
  })

  it('places the ARMED length, not the length of what it lands on', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(140), 'h', 0)
    expect(rest!.duration).toBe('h') // the empty bar held a WHOLE measure rest
  })

  it('carries the armed DOTS', () => {
    const rest = coordinator.addRestAtPosition(clickInBar1(140), 'q', 1)
    expect(rest!.duration).toBe('q')
    expect(rest!.dots).toBe(1)
  })

  it('leaves the bar exactly full — the rest it lands on is replaced, not stacked on', () => {
    coordinator.addRestAtPosition(clickInBar1(140), 'q', 0)
    // The rest branch of addNote does not fill gaps (it is often the FILLER's own caller — see
    // evictRestsOverlapping); the render's repair closes them, so do what the render does. The
    // integrity check inside it THROWS under Vitest, so an overfull bar fails here regardless.
    scoreModel.repairAllMeasureGaps()
    const m1 = scoreModel.getMeasure(1)!
    const total = m1.slots.reduce(
      (acc, s) => acc + fracToNumber(s.actualDuration ?? durationToFraction(s.duration, s.dots ?? 0)), 0)
    expect(total).toBe(4) // 4/4 — not 5, which is what stacking would give
  })

  it('replaces the NOTE it lands on', () => {
    const note = coordinator.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    coordinator.addRestAtPosition(clickInBar1(125), 'q', 0)
    expect(scoreModel.getNote(note.id)).toBeFalsy()
  })
})

/**
 * A tuplet cannot cross a barline. The trap is that the SPAN, not the written duration, is what must
 * fit: a triplet of halves is three notes in the time of two halves = four quarter-beats.
 */
describe('NoteEntryCoordinator — a tuplet must fit the bar', () => {
  let scoreModel: ScoreModel
  let coordinator: NoteEntryCoordinator

  beforeEach(() => {
    scoreModel = new ScoreModel('Test')
    coordinator = makeCoordinator(scoreModel)
  })

  const barBeats = (measure: number) =>
    scoreModel.getMeasure(measure)!.slots.reduce(
      (acc, sl) => acc + fracToNumber(sl.actualDuration ?? durationToFraction(sl.duration, sl.dots ?? 0)), 0)

  it('REFUSES a triplet of halves at beat 2 of 4/4 — it needs 4 beats and 2 remain (reported)', () => {
    // Reported bar: A3 q@0, rest q@1, then a triplet of halves toggled onto the rest at beat 2. Its
    // span runs to beat 6 and the bar summed to SIX beats in 4/4.
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(2, 1), isRest: true })
    expect(coordinator.applyTupletToNote(rest.id, 3, 2)).toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets ?? []).toHaveLength(0)
  })

  it('leaves the bar exactly full when it refuses', () => {
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(2, 1), isRest: true })
    coordinator.applyTupletToNote(rest.id, 3, 2)
    scoreModel.repairAllMeasureGaps() // throws under Vitest if the bar is malformed
    expect(barBeats(1)).toBe(4)
  })

  it('ALLOWS a triplet of quarters at beat 2 of 4/4 — 2 beats, and 2 remain', () => {
    const rest = scoreModel.addNote({ duration: 'q', measure: 1, beat: frac(2, 1), isRest: true })
    const result = coordinator.applyTupletToNote(rest.id, 3, 2)
    expect(result).not.toBeNull()
    expect(scoreModel.getMeasure(1)!.tuplets).toHaveLength(1)
  })

  it('ALLOWS a triplet of halves at beat 0 — the whole bar is exactly its span', () => {
    const rest = scoreModel.addNote({ duration: 'h', measure: 1, beat: frac(0, 1), isRest: true })
    expect(coordinator.applyTupletToNote(rest.id, 3, 2)).not.toBeNull()
  })
})
