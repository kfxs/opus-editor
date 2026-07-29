import { describe, it, expect, beforeEach } from 'vitest'
import { levelToGlyphString, dynamicLevelOf } from '@/utils/dynamics'
import { ScoreModel } from './ScoreModel'
import { curveShapeOverrideOf, restPositionKey, restShiftOverrideOf, dynamicOffsetOverrideOf } from './engravingOverrides'
import type { NoteParams } from '@/types/music'
import { fracCreate as frac, fracCompare, fracToNumber } from '@/utils/fraction'
import { tupletSpan } from '@/utils/musicUtils'
import { measureOpeningClef } from '@/utils/clefUtils'
import type { ChordRest } from '@/types/music'

/**
 * Build a 2nd staff (index 1) exactly as the removed `addTempSecondStaff` scaffold did —
 * via the real {@link ScoreModel.addStaffBelow}, then seeded with a bass opening clef and
 * C3 + G3 half notes in m1 — so the staff-scoping fixtures below are unchanged. Returns
 * the new staff's id.
 */
function seedSecondStaff(model: ScoreModel): string {
  const staffId = model.addStaffBelow(0)
  model.setClefAt(1, frac(0, 1), 'bass', staffId)
  model.addNote({ step: 'C', octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 })
  model.addNote({ step: 'G', octave: 3, duration: 'h', measure: 1, beat: frac(2, 1), staff: 1 })
  return staffId
}

describe('ScoreModel', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel('Test Score')
  })

  describe('initialization', () => {
    it('should create a score with default values', () => {
      const score = model.getScore()
      expect(score.title).toBe('Test Score')
      expect(score.measures).toHaveLength(1)
    })

    it('should create score with default title', () => {
      const defaultModel = new ScoreModel()
      expect(defaultModel.getScore().title).toBe('Fragment 1')
    })

    // Tempo is NOT a score field: a fresh score makes no tempo statement at all. It plays
    // at the engine constant DEFAULT_TEMPO and prints nothing. A stored global would also
    // be, implicitly, "the tempo at bar 1" — the conflation that made score.clef bleed.
    // See docs/tempo-marks-plan.md §0.
    it('should NOT carry a tempo field (tempo is resolved from marks, not stored)', () => {
      const score = model.getScore()
      expect('tempo' in score).toBe(false)
      expect(score.measures[0].tempos).toBeUndefined()
    })
  })

  describe('setTitle', () => {
    it('should update the score title', () => {
      model.setTitle('New Title')
      expect(model.getScore().title).toBe('New Title')
    })
  })

  describe('measure operations', () => {
    it('should add a new measure', () => {
      const measure = model.addMeasure()
      expect(model.getScore().measures).toHaveLength(2)
      expect(measure.number).toBe(2)
    })

    it('should get a measure by number', () => {
      const measure = model.getMeasure(1)
      expect(measure).toBeDefined()
      expect(measure?.number).toBe(1)
    })

    it('should return undefined for non-existent measure', () => {
      const measure = model.getMeasure(999)
      expect(measure).toBeUndefined()
    })

    it('should remove a measure and renumber subsequent measures', () => {
      model.addMeasure()
      model.addMeasure()
      model.removeMeasure(2)

      expect(model.getScore().measures).toHaveLength(2)
      expect(model.getMeasure(2)?.number).toBe(2)
      expect(model.getMeasure(3)).toBeUndefined()
    })

    it('should return false when removing non-existent measure', () => {
      expect(model.removeMeasure(999)).toBe(false)
    })

    describe('insertMeasureAfter', () => {
      it('inserts after a measure and renumbers following measures + their slots', () => {
        model.addMeasure(); model.addMeasure() // measures 1, 2, 3
        // A note in (old) measure 3 lets us verify slot.measure is renumbered.
        const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
        model.insertMeasureAfter(1)
        expect(model.getScore().measures).toHaveLength(4)
        expect(model.getMeasure(2)).toBeDefined()
        // The note slid from measure 3 to measure 4; its slot's .measure followed.
        const slot = model.getMeasure(4)!.slots.find((s) => s.type === 'chord')!
        expect(slot.measure).toBe(4)
        // The inserted measure carries the note's id nowhere — it is freshly rest-filled.
        expect(model.getMeasure(2)!.slots.every((s) => s.type === 'rest')).toBe(true)
        // measure numbers stay contiguous 1..4
        expect(model.getScore().measures.map((m) => m.number)).toEqual([1, 2, 3, 4])
        void note
      })

      it('appending via insertMeasureAfter(length) equals addMeasure', () => {
        const m = model.insertMeasureAfter(model.getScore().measures.length)
        expect(m.number).toBe(2)
        expect(model.getScore().measures).toHaveLength(2)
      })

      it('a mid-score inserted bar is NOT marked as a time-signature change', () => {
        model.addMeasure() // measures 1, 2
        const inserted = model.insertMeasureAfter(1)
        expect(inserted.number).toBe(2)
        expect(inserted.timeSignatureChange).toBeFalsy()
      })

      it('measure 1 keeps its opening time-signature flag (constructor + delegate)', () => {
        // Constructor builds measure 1 via addMeasure → insertMeasureAfter(0).
        expect(model.getMeasure(1)!.timeSignatureChange).toBe(true)
      })
    })
  })

  describe('note operations', () => {
    const noteParams: NoteParams = {
      step: 'C',
      alter: 0,
      octave: 4,
      duration: 'q',
      measure: 1,
      beat: frac(0, 1),
    }

    it('should add a note to a measure', () => {
      const note = model.addNote(noteParams)
      expect(note.step).toBe('C')
      expect(note.alter).toBe(0)
      expect(note.octave).toBe(4)
      expect(note.duration).toBe('q')
      expect(note.measure).toBe(1)
      expect(note.beat).toEqual(frac(0, 1))
      expect(note.id).toBeDefined()
    })

    it('should throw error when adding note to non-existent measure', () => {
      expect(() =>
        model.addNote({ ...noteParams, measure: 999 })
      ).toThrow('Measure 999 does not exist')
    })

    it('should throw error for note without step', () => {
      expect(() =>
        model.addNote({ duration: 'q', measure: 1, beat: frac(0, 1) })
      ).toThrow('Non-rest notes must have a step')
    })

    it('should sort notes by beat position', () => {
      model.addNote({ ...noteParams, beat: frac(2, 1) })
      model.addNote({ ...noteParams, beat: frac(0, 1) })
      model.addNote({ ...noteParams, beat: frac(1, 1) })

      const notes = model.getNotesInMeasure(1)
      expect(notes[0].beat).toEqual(frac(0, 1))
      expect(notes[1].beat).toEqual(frac(1, 1))
      expect(notes[2].beat).toEqual(frac(2, 1))
    })

    it('should get a note by ID', () => {
      const addedNote = model.addNote(noteParams)
      const foundNote = model.getNote(addedNote.id)
      expect(foundNote).toEqual(addedNote)
    })

    it('should return undefined for non-existent note', () => {
      const note = model.getNote('non-existent-id')
      expect(note).toBeUndefined()
    })

    it('should get all notes in a measure', () => {
      model.addNote(noteParams)
      model.addNote({ ...noteParams, beat: frac(1, 1) })

      const notes = model.getNotesInMeasure(1)
      const actualNotes = notes.filter(n => !n.isRest)
      expect(actualNotes).toHaveLength(2)
    })

    it('should update a note', () => {
      const note = model.addNote(noteParams)
      model.updateNote(note.id, { step: 'E', alter: 0, octave: 4, duration: 'h' })

      const updated = model.getNote(note.id)
      expect(updated?.step).toBe('E')
      expect(updated?.octave).toBe(4)
      expect(updated?.duration).toBe('h')
    })

    it('should evict overlapping rests when a note is lengthened in place', () => {
      // A short note leaves the rest of the 4/4 bar as trailing rests. Growing it
      // to a whole note must reclaim that space, not leave the bar overfull.
      const note = model.addNote({ ...noteParams, duration: '16' })
      model.updateNote(note.id, { duration: 'w' })

      const slots = model.getSlotsInMeasure(1)
      const total = slots.reduce(
        (sum, s) => fracToNumber(s.actualDuration!) + sum,
        0,
      )
      expect(total).toBe(4) // exactly one 4/4 bar, not overfull
      // The grown note occupies the whole bar, so it is the only slot left.
      expect(slots).toHaveLength(1)
      expect(slots[0].type).toBe('chord')
    })

    it('should evict overlapping rests when a lengthened note is one of several', () => {
      // Fill the bar with quarters, then grow the first to a half note: the rest
      // (or note) sitting on beat 1 is inside the new span and must be evicted.
      model.addNote({ ...noteParams, duration: 'q', beat: frac(0, 1) })
      const first = model.getNotesInMeasure(1).find(n => !n.isRest && fracToNumber(n.beat) === 0)!
      model.updateNote(first.id, { duration: 'h' })

      const slots = model.getSlotsInMeasure(1)
      const total = slots.reduce((sum, s) => fracToNumber(s.actualDuration!) + sum, 0)
      expect(total).toBe(4)
      // Nothing else may start inside [0,2) — the half note owns that span.
      const inSpan = slots.filter(s => {
        const b = fracToNumber(s.beat)
        return b > 0 && b < 2
      })
      expect(inSpan).toHaveLength(0)
    })

    it('should move note to different measure when updating', () => {
      model.addMeasure()
      const note = model.addNote(noteParams)
      model.updateNote(note.id, { measure: 2 })

      const measure1Notes = model.getNotesInMeasure(1).filter(n => !n.isRest)
      const measure2Notes = model.getNotesInMeasure(2).filter(n => !n.isRest)
      expect(measure1Notes).toHaveLength(0)
      expect(measure2Notes).toHaveLength(1)
      expect(model.getNote(note.id)?.measure).toBe(2)
    })

    it('should throw error when updating to non-existent measure', () => {
      const note = model.addNote(noteParams)
      expect(() =>
        model.updateNote(note.id, { measure: 999 })
      ).toThrow('Target measure 999 does not exist')
    })

    it('should delete a note', () => {
      const note = model.addNote(noteParams)
      const deleted = model.deleteNote(note.id)

      expect(deleted).toBe(true)
      expect(model.getNote(note.id)).toBeUndefined()
      const remainingNotes = model.getNotesInMeasure(1).filter(n => !n.isRest)
      expect(remainingNotes).toHaveLength(0)
    })

    it('should return false when deleting non-existent note', () => {
      expect(model.deleteNote('non-existent-id')).toBe(false)
    })

    it('should get all notes in the score', () => {
      model.addMeasure()
      model.addNote(noteParams)
      model.addNote({ ...noteParams, measure: 2 })

      const allNotes = model.getAllNotes()
      const actualNotes = allNotes.filter(n => !n.isRest)
      expect(actualNotes).toHaveLength(2)
    })

    it('should clear all notes', () => {
      model.addNote(noteParams)
      model.addNote({ ...noteParams, beat: frac(1, 1) })
      model.clearAllNotes()

      const remainingNotes = model.getAllNotes().filter(n => !n.isRest)
      expect(remainingNotes).toHaveLength(0)
    })
  })

  describe('measure integrity check', () => {
    // A well-formed 4/4 bar: a whole-note chord fills it exactly.
    const wellFormed = JSON.stringify({
      title: 'ok',
      measures: [{
        id: 'm1', number: 1,
        timeSignature: { numerator: 4, denominator: 4 },
        tuplets: [],
        slots: [{
          id: 'c1', type: 'chord', beat: { num: 0, den: 1 }, duration: 'w', measure: 1,
          notes: [{ id: 'n1', step: 'C', alter: 0, octave: 4 }],
        }],
      }],
      staves: [{ id: 's1' }],
    })

    // The bug shape from the report: a whole-note chord (4 beats) AND a leftover
    // quarter rest in the same 4/4 bar → 5 beats, overfull by one.
    const overfull = JSON.stringify({
      title: 'bad',
      measures: [{
        id: 'm1', number: 1,
        timeSignature: { numerator: 4, denominator: 4 },
        tuplets: [],
        slots: [
          {
            id: 'c1', type: 'chord', beat: { num: 0, den: 1 }, duration: 'w', measure: 1,
            notes: [{ id: 'n1', step: 'C', alter: 0, octave: 4 }],
          },
          { id: 'r1', type: 'rest', beat: { num: 0, den: 1 }, duration: 'q', measure: 1 },
        ],
      }],
      staves: [{ id: 's1' }],
    })

    it('passes a well-formed bar (no throw)', () => {
      const m = ScoreModel.fromJSON(wellFormed)
      expect(() => m.repairAllMeasureGaps()).not.toThrow()
    })

    it('throws on an overfull bar under strict (test) mode', () => {
      const m = ScoreModel.fromJSON(overfull)
      expect(() => m.repairAllMeasureGaps()).toThrow(/integrity.*OVERFULL/)
    })
  })

  describe('serialization', () => {
    it('should serialize score to JSON', () => {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const json = model.toJSON()
      const parsed = JSON.parse(json)

      expect(json).toContain('"title": "Test Score"')
      expect(json).not.toContain('"tempo"') // no global tempo is serialized — it does not exist
      const chord = parsed.measures[0].slots.find((s: any) => s.type === 'chord')
      expect(chord).toBeDefined()
      expect(chord.notes[0].step).toBe('C')
      expect(chord.notes[0].alter).toBe(0)
      expect(chord.notes[0].octave).toBe(4)
    })

    it('should deserialize score from JSON', () => {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const json = model.toJSON()

      const loaded = ScoreModel.fromJSON(json)
      expect(loaded.getScore().title).toBe('Test Score')
      const actualNotes = loaded.getAllNotes().filter(n => !n.isRest)
      expect(actualNotes).toHaveLength(1)
    })

    it('round-trips dynamics (level + custom text) through JSON', () => {
      model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
      model.addDynamic(1, { beat: frac(2, 1), text: 'dolce', voice: 0 })

      const loaded = ScoreModel.fromJSON(model.toJSON())
      const dyns = loaded.getDynamics(1)
      expect(dyns).toHaveLength(2)
      expect(dyns[0]).toMatchObject({ text: levelToGlyphString('p') })
      expect(dyns[0].beat).toEqual(frac(0, 1))
      expect(dyns[1]).toMatchObject({ text: 'dolce' })
      // resolution still works after a load
      expect(loaded.getActiveLevel(1, frac(1, 1))).toBe('p')
    })

    it('round-trips top-level slurs through JSON', () => {
      // No slur API yet (Phase 0 is types/serialization only) — set the
      // top-level array directly and confirm it survives a save/load cycle.
      model.getScore().slurs = [
        { id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b', voice: 0, placement: 'above' },
      ]

      const loaded = ScoreModel.fromJSON(model.toJSON())
      expect(loaded.getScore().slurs).toEqual([
        { id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b', voice: 0, placement: 'above' },
      ])
    })

    it('round-trips tempo marks through JSON (and still sounds the same)', () => {
      model.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro (♩. = 96)', unit: 'q', dots: 1, bpm: 96 })
      model.addTempoMark(1, { beat: frac(2, 1), text: 'meno mosso' }) // word only, no bpm

      const loaded = ScoreModel.fromJSON(model.toJSON())
      const marks = loaded.getTempoMarks(1)
      expect(marks).toHaveLength(2)
      expect(marks[0]).toMatchObject({ text: 'Allegro (♩. = 96)', unit: 'q', dots: 1, bpm: 96 })
      expect(marks[1]).toMatchObject({ text: 'meno mosso' })
      expect(marks[1].bpm).toBeUndefined()
      // The Fraction beat survives as an exact fraction, so the mark still sounds where it was:
      // ♩. = 96 → 144 qpm (the unit is half the meaning).
      expect(loaded.getEffectiveTempoAt(1, frac(3, 1))).toBe(144)
    })

    it('serializes no tempos key for a mark-free score', () => {
      expect(model.toJSON()).not.toContain('"tempos"')
    })

    it('round-trips a slur curve shape through the override compartment', () => {
      model.getScore().slurs = [{ id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b' }]
      model.setSlurShape('slur-1', [{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }])
      const loaded = ScoreModel.fromJSON(model.toJSON())
      expect(curveShapeOverrideOf(loaded.getScore(), 'slur-1')?.cps).toEqual([{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }])
    })

    it('setSlurShape writes then clears the curve-shape override (compartment)', () => {
      model.getScore().slurs = [{ id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b' }]
      expect(model.setSlurShape('slur-1', [{ x: 0.1, y: 1.0 }, { x: 0.1, y: 1.0 }])).toBe(true)
      expect(curveShapeOverrideOf(model.getScore(), 'slur-1')?.cps).toEqual([{ x: 0.1, y: 1.0 }, { x: 0.1, y: 1.0 }])

      expect(model.setSlurShape('slur-1', null)).toBe(true)
      expect(curveShapeOverrideOf(model.getScore(), 'slur-1')).toBeUndefined() // override removed
      expect(model.getScore().engravingOverrides).toBeUndefined() // compartment pruned clean

      expect(model.setSlurShape('missing', null)).toBe(false)
    })

    it('loads a score with no slurs array (absent = empty)', () => {
      const legacy = JSON.stringify({
        id: 'x', title: 'Legacy', tempo: 100,
        measures: [
          { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] },
        ],
      })
      const loaded = ScoreModel.fromJSON(legacy)
      expect(loaded.getScore().slurs).toBeUndefined()
      // Consumers treat absent as empty.
      expect(loaded.getScore().slurs ?? []).toEqual([])
    })

    it('loads a score with no dynamics array (absent = empty)', () => {
      const legacy = JSON.stringify({
        id: 'x', title: 'Legacy', tempo: 100,
        measures: [
          { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] },
        ],
      })
      const loaded = ScoreModel.fromJSON(legacy)
      expect(loaded.getDynamics(1)).toEqual([])
      expect(loaded.getActiveLevel(1, frac(0, 1))).toBe('mf') // DEFAULT_DYNAMIC
    })
  })

  // ==================== Tuplet Tests ====================

  describe('createTuplet', () => {
    it('starts empty — no initial rests placed', () => {
      model.addMeasure()
      // Fill measure 1 with a whole rest first
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      const tupletNotes = model.getNotesInTuplet(tuplet.id)
      expect(tupletNotes).toHaveLength(0)
    })

    it('stores the format it was given, and stores nothing when given none', () => {
      model.addMeasure()
      const plain = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      // Absent MEANS "engrave by the rules", so a tuplet nobody argued with carries no look at all.
      expect(plain.numberStyle).toBeUndefined()
      expect(plain.bracket).toBeUndefined()
      expect(plain.bracketEnd).toBeUndefined()

      const formatted = model.createTuplet(2, frac(0, 1), '8', 3, 2, 0, 0, 0, undefined, {
        numberStyle: 'ratioNote',
        bracket: 'never',
        bracketEnd: 'division',
      })
      expect(formatted.numberStyle).toBe('ratioNote')
      expect(formatted.bracket).toBe('never')
      expect(formatted.bracketEnd).toBe('division')
    })

    it('removes overlapping slots when creating a tuplet', () => {
      // There should be a whole rest covering the measure before creating the tuplet
      const before = model.getNotesInMeasure(1)
      expect(before.some(n => n.isRest)).toBe(true)

      model.createTuplet(1, frac(0, 1), '8', 3, 2)

      // The whole rest should be gone — tuplet cleared it
      const after = model.getNotesInMeasure(1).filter(n => !n.tupletId)
      expect(after.every(n => !n.isRest || frac(0, 1) !== n.beat)).toBe(true)
    })

    it('clears only its own voice, leaving other voices intact', () => {
      // Voice 1 has a note at beat 0 (with rest-fill across the bar).
      model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
      const v1Before = model.getNotesInMeasure(1).filter(n => (n.voice ?? 0) === 1).length
      expect(v1Before).toBeGreaterThan(0)

      // A voice-0 triplet over beats 0–1 must not wipe voice 1's slots.
      model.createTuplet(1, frac(0, 1), '8', 3, 2, 0)

      const v1After = model.getNotesInMeasure(1).filter(n => (n.voice ?? 0) === 1)
      expect(v1After.length).toBe(v1Before) // voice 1 untouched
    })

    it('places filler rests in the tuplet\'s own voice', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2, 1)
      model.refillTupletRemainder(1, tuplet, 1)

      const notes = model.getNotesInTuplet(tuplet.id)
      expect(notes.length).toBeGreaterThan(0)
      expect(notes.every(n => (n.voice ?? 0) === 1)).toBe(true)
    })
  })

  describe('refillTupletRemainder', () => {
    it('places filler rests spanning the full tuplet when empty', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      // Remaining written = 1 × 3/2 = 1.5 beats → splitBeatsIntoDurations(1.5) = ['q', '8']
      expect(notes).toHaveLength(2)
      expect(notes.every(n => n.isRest)).toBe(true)
      expect(notes[0].duration).toBe('q')
      expect(notes[1].duration).toBe('8')
    })

    it('total actual duration of filler rests equals tuplet span when empty', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      // Sum of actualDurations should equal 1 beat (the tuplet span)
      const totalActual = notes.reduce((sum, n) => {
        const ad = n.actualDuration
        return sum + (ad ? ad.num / ad.den : 0)
      }, 0)
      expect(totalActual).toBeCloseTo(1, 10)
    })

    it('places correct filler after one full-slot note (8th in 3:2 triplet)', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      // Add C4 8th — actual = 1/3 beat
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id, actualDuration: frac(1, 3) })
      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      const realNotes = notes.filter(n => !n.isRest)
      const rests = notes.filter(n => n.isRest)

      expect(realNotes).toHaveLength(1)
      // Remaining actual = 2/3 beat. Written = 2/3 × 3/2 = 1 beat = quarter
      // splitBeatsIntoDurations(1) = ['q']
      expect(rests).toHaveLength(1)
      expect(rests[0].duration).toBe('q')

      // Total actual = 1/3 + 2/3 = 1 beat
      const totalActual = notes.reduce((sum, n) => {
        const ad = n.actualDuration
        return sum + (ad ? ad.num / ad.den : 0)
      }, 0)
      expect(totalActual).toBeCloseTo(1, 10)
    })

    it('places correct filler for the bug scenario: 8th + 16th + 8th in triplet', () => {
      // This is the exact bug: C4(8th) + D4(16th) + E4(8th) → should leave 16th filler
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      const ratio = { num: 2, den: 3 }

      // C4 8th: actual = 1/2 × 2/3 = 1/3
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id, actualDuration: frac(1, 3) })
      // D4 16th: actual = 1/4 × 2/3 = 1/6
      model.addNote({ step: 'D', alter: 0, octave: 4, duration: '16', measure: 1, beat: frac(1, 3), tupletId: tuplet.id, actualDuration: frac(1, 6) })
      // E4 8th at beat 1/2 (mid-slot, the bug position): actual = 1/3
      model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 2), tupletId: tuplet.id, actualDuration: frac(1, 3) })

      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      const rests = notes.filter(n => n.isRest)

      // Fill pointer = 1/2 + 1/3 = 5/6. Remaining actual = 1/6. Written = 1/6 × 3/2 = 1/4 → '16'
      expect(rests).toHaveLength(1)
      expect(rests[0].duration).toBe('16')

      // Total actual must equal 1 beat for the voice to be complete
      const totalActual = notes.reduce((sum, n) => {
        const ad = n.actualDuration
        return sum + (ad ? ad.num / ad.den : 0)
      }, 0)
      expect(totalActual).toBeCloseTo(1, 10)
      void ratio // suppress unused warning
    })

    it('does nothing when tuplet is full', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      // Fill with 3 eighth notes (each actual = 1/3, total = 1)
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), tupletId: tuplet.id, actualDuration: frac(1, 3) })
      model.addNote({ step: 'D', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(1, 3), tupletId: tuplet.id, actualDuration: frac(1, 3) })
      model.addNote({ step: 'E', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(2, 3), tupletId: tuplet.id, actualDuration: frac(1, 3) })

      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      expect(notes.filter(n => n.isRest)).toHaveLength(0)
      expect(notes.filter(n => !n.isRest)).toHaveLength(3)
    })

    it('preserves existing rests and only fills empty gaps', () => {
      // Setup: triplet with a 16th rest at beat 0 and an 8th rest at beat 1/3
      // There is a gap at [1/6, 1/3) that must be filled
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      model.addNote({ duration: '16', measure: 1, beat: frac(0, 1), isRest: true, tupletId: tuplet.id, actualDuration: frac(1, 6) })
      model.addNote({ duration: '8',  measure: 1, beat: frac(1, 3), isRest: true, tupletId: tuplet.id, actualDuration: frac(1, 3) })
      model.addNote({ duration: '8',  measure: 1, beat: frac(2, 3), isRest: true, tupletId: tuplet.id, actualDuration: frac(1, 3) })

      model.refillTupletRemainder(1, tuplet)

      const notes = model.getNotesInTuplet(tuplet.id)
      expect(notes).toHaveLength(4)
      expect(notes.every(n => n.isRest)).toBe(true)

      // Verify total actual duration still equals 1 beat
      const totalActual = notes.reduce((sum, n) => sum + (n.actualDuration ? n.actualDuration.num / n.actualDuration.den : 0), 0)
      expect(totalActual).toBeCloseTo(1, 10)

      // The gap at [1/6, 1/3) = 1/6 actual → should be filled with a 16th rest
      const sorted = [...notes].sort((a, b) => fracCompare(a.beat, b.beat))
      expect(sorted[0].duration).toBe('16') // original 16th rest preserved
      expect(sorted[1].duration).toBe('16') // new filler rest in the gap
      expect(sorted[2].duration).toBe('8')  // original 8th rest preserved
      expect(sorted[3].duration).toBe('8')  // original 8th rest preserved
    })

    it('does not duplicate rests when called multiple times', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
      model.refillTupletRemainder(1, tuplet)
      model.refillTupletRemainder(1, tuplet) // second call must be idempotent

      const notes = model.getNotesInTuplet(tuplet.id)
      const totalActual = notes.reduce((sum, n) => sum + (n.actualDuration ? n.actualDuration.num / n.actualDuration.den : 0), 0)
      expect(totalActual).toBeCloseTo(1, 10)
    })
  })

  describe('clef operations', () => {
    beforeEach(() => {
      // Start each clef test with 5 measures (constructor creates measure 1)
      for (let i = 0; i < 4; i++) model.addMeasure()
    })

    describe('getEffectiveClef', () => {
      it('defaults to treble when nothing is set', () => {
        expect(model.getEffectiveClef(1)).toBe('treble')
        expect(model.getEffectiveClef(5)).toBe('treble')
      })

      it('inherits an explicit opening clef forward', () => {
        model.setClef(1, 'bass')
        expect(model.getEffectiveClef(3)).toBe('bass')
      })

      it('inherits the most recent explicit clef change', () => {
        model.setClef(3, 'bass')
        expect(model.getEffectiveClef(2)).toBe('treble')
        expect(model.getEffectiveClef(3)).toBe('bass')
        expect(model.getEffectiveClef(4)).toBe('bass')
      })

      it('uses the nearest preceding change when several exist', () => {
        model.setClef(2, 'bass')
        model.setClef(4, 'alto')
        expect(model.getEffectiveClef(1)).toBe('treble')
        expect(model.getEffectiveClef(2)).toBe('bass')
        expect(model.getEffectiveClef(3)).toBe('bass')
        expect(model.getEffectiveClef(4)).toBe('alto')
        expect(model.getEffectiveClef(5)).toBe('alto')
      })
    })

    // Read a measure's clef change at a given beat (undefined if none)
    const clefAt = (m: number, beatNum: number) =>
      model.getMeasure(m)!.clefs?.find(c => c.beat.num === beatNum && c.beat.den === 1)?.clef

    describe('setClef (beat 0 / opening)', () => {
      it('stores an explicit opening clef on measure 1', () => {
        expect(model.setClef(1, 'bass')).toBe(true)
        expect(clefAt(1, 0)).toBe('bass')
      })

      it('stores a clef change on a later measure', () => {
        expect(model.setClef(3, 'alto')).toBe(true)
        expect(clefAt(3, 0)).toBe('alto')
      })

      it('normalizes a redundant change to no override (clears it)', () => {
        expect(model.setClef(3, 'treble')).toBe(false)
        expect(clefAt(3, 0)).toBeUndefined()
      })

      it('clears an existing override when set back to the inherited clef', () => {
        model.setClef(3, 'bass')
        expect(clefAt(3, 0)).toBe('bass')
        expect(model.setClef(3, 'treble')).toBe(true)
        expect(clefAt(3, 0)).toBeUndefined()
      })

      it('returns false when the clef is already set to that value', () => {
        model.setClef(3, 'bass')
        expect(model.setClef(3, 'bass')).toBe(false)
      })
    })

    describe('setClefAt / getEffectiveClefAt (mid-measure)', () => {
      it('stores a mid-measure change and applies it from its beat onward', () => {
        expect(model.setClefAt(3, frac(2, 1), 'bass')).toBe(true)
        expect(clefAt(3, 2)).toBe('bass')
        // Before the change → inherited treble; at/after → bass
        expect(model.getEffectiveClefAt(3, frac(1, 1))).toBe('treble')
        expect(model.getEffectiveClefAt(3, frac(2, 1))).toBe('bass')
        expect(model.getEffectiveClefAt(3, frac(3, 1))).toBe('bass')
      })

      it('carries the last clef of a measure into the next measure', () => {
        model.setClefAt(3, frac(2, 1), 'bass')
        expect(model.getEffectiveClef(4)).toBe('bass')        // opening of next measure
        expect(model.getEffectiveClefAt(4, frac(0, 1))).toBe('bass')
      })

      it('supports multiple changes within one measure', () => {
        model.setClefAt(3, frac(1, 1), 'bass')
        model.setClefAt(3, frac(3, 1), 'alto')
        expect(model.getEffectiveClefAt(3, frac(0, 1))).toBe('treble')
        expect(model.getEffectiveClefAt(3, frac(1, 1))).toBe('bass')
        expect(model.getEffectiveClefAt(3, frac(2, 1))).toBe('bass')
        expect(model.getEffectiveClefAt(3, frac(3, 1))).toBe('alto')
      })

      it('normalizes a redundant mid-measure change against what precedes it', () => {
        model.setClefAt(3, frac(1, 1), 'bass')
        // A bass change at beat 3 is redundant (already bass since beat 1) → removed
        expect(model.setClefAt(3, frac(3, 1), 'bass')).toBe(false)
        expect(clefAt(3, 3)).toBeUndefined()
      })
    })

    describe('removeClef / removeClefAt', () => {
      it('removes an opening clef change and reverts to inherited', () => {
        model.setClef(3, 'bass')
        expect(model.removeClef(3)).toBe(true)
        expect(clefAt(3, 0)).toBeUndefined()
        expect(model.getEffectiveClef(3)).toBe('treble')
      })

      it('removes a mid-measure change', () => {
        model.setClefAt(3, frac(2, 1), 'bass')
        expect(model.removeClefAt(3, frac(2, 1))).toBe(true)
        expect(clefAt(3, 2)).toBeUndefined()
        expect(model.getEffectiveClefAt(3, frac(2, 1))).toBe('treble')
      })

      it('refuses to remove measure 1 / beat 0', () => {
        model.setClef(1, 'bass')
        expect(model.removeClefAt(1, frac(0, 1))).toBe(false)
        expect(clefAt(1, 0)).toBe('bass')
      })

      it('returns false when there is no change to remove', () => {
        expect(model.removeClefAt(3, frac(2, 1))).toBe(false)
      })
    })

    describe('moveClefWithinMeasure', () => {
      it('relocates a mid-measure change to a new beat', () => {
        model.setClefAt(3, frac(2, 1), 'bass')
        expect(model.moveClefWithinMeasure(3, frac(2, 1), frac(3, 1))).toBe(true)
        expect(clefAt(3, 2)).toBeUndefined()
        expect(clefAt(3, 3)).toBe('bass')
        // The clef now governs from its new beat onward.
        expect(model.getEffectiveClefAt(3, frac(2, 1))).toBe('treble')
        expect(model.getEffectiveClefAt(3, frac(3, 1))).toBe('bass')
      })

      it('moves a beat-0 opening change to mid-measure (opening reverts to inherited)', () => {
        model.setClef(3, 'bass')
        expect(model.moveClefWithinMeasure(3, frac(0, 1), frac(2, 1))).toBe(true)
        expect(model.getEffectiveClef(3)).toBe('treble')           // opening inherited again
        expect(model.getEffectiveClefAt(3, frac(2, 1))).toBe('bass')
      })

      it('overwrites a clef already sitting at the target beat (dragged clef wins)', () => {
        model.setClefAt(3, frac(1, 1), 'bass')
        model.setClefAt(3, frac(3, 1), 'alto')
        // Drag the alto onto the bass's beat: alto wins, bass is removed.
        expect(model.moveClefWithinMeasure(3, frac(3, 1), frac(1, 1))).toBe(true)
        expect(clefAt(3, 3)).toBeUndefined()
        expect(clefAt(3, 1)).toBe('alto')
        expect(model.getMeasure(3)!.clefs?.length).toBe(1)
      })

      it('refuses to move onto measure 1 / beat 0 (protected opening)', () => {
        model.setClefAt(1, frac(2, 1), 'bass')
        expect(model.moveClefWithinMeasure(1, frac(2, 1), frac(0, 1))).toBe(false)
        expect(clefAt(1, 2)).toBe('bass')
      })

      it('returns false for a no-op move or a missing source clef', () => {
        model.setClefAt(3, frac(2, 1), 'bass')
        expect(model.moveClefWithinMeasure(3, frac(2, 1), frac(2, 1))).toBe(false)
        expect(model.moveClefWithinMeasure(3, frac(1, 1), frac(3, 1))).toBe(false)
      })
    })

    describe('moveClef (cross-measure)', () => {
      it('moves a clef change from one measure to another', () => {
        model.setClefAt(2, frac(2, 1), 'bass')
        expect(model.moveClef(2, frac(2, 1), 4, frac(1, 1))).toBe(true)
        expect(clefAt(2, 2)).toBeUndefined()
        expect(clefAt(4, 1)).toBe('bass')
        // The clef now governs from measure 4 beat 1 onward; measure 2 reverts.
        expect(model.getEffectiveClefAt(2, frac(2, 1))).toBe('treble')
        expect(model.getEffectiveClefAt(4, frac(1, 1))).toBe('bass')
      })

      it('drops the source measure clefs array when it becomes empty', () => {
        model.setClefAt(2, frac(2, 1), 'bass')
        model.moveClef(2, frac(2, 1), 3, frac(0, 1))
        expect(model.getMeasure(2)!.clefs).toBeUndefined()
        expect(clefAt(3, 0)).toBe('bass')
      })

      it('overwrites a clef already at the target position in another measure', () => {
        model.setClefAt(2, frac(2, 1), 'bass')
        model.setClefAt(4, frac(1, 1), 'alto')
        expect(model.moveClef(2, frac(2, 1), 4, frac(1, 1))).toBe(true)
        expect(clefAt(4, 1)).toBe('bass')
        expect(model.getMeasure(4)!.clefs?.length).toBe(1)
      })

      it('refuses to land on measure 1 / beat 0', () => {
        model.setClefAt(2, frac(2, 1), 'bass')
        expect(model.moveClef(2, frac(2, 1), 1, frac(0, 1))).toBe(false)
        expect(clefAt(2, 2)).toBe('bass')
      })
    })

    describe('normalizeClefAt', () => {
      it('removes a change that equals the clef in effect before it', () => {
        model.setClefAt(3, frac(1, 1), 'bass')
        model.setClefAt(3, frac(2, 1), 'treble') // differs from bass at 1 → kept
        model.removeClefAt(3, frac(1, 1))         // now treble at 2 matches inherited treble
        expect(model.normalizeClefAt(3, frac(2, 1))).toBe(true)
        expect(clefAt(3, 2)).toBeUndefined()
      })

      it('keeps a change that actually differs from what precedes it', () => {
        model.setClefAt(3, frac(2, 1), 'bass')
        expect(model.normalizeClefAt(3, frac(2, 1))).toBe(false)
        expect(clefAt(3, 2)).toBe('bass')
      })

      it('never removes measure 1 / beat 0', () => {
        expect(model.normalizeClefAt(1, frac(0, 1))).toBe(false)
      })
    })

    describe('JSON round-trip', () => {
      it('preserves opening and mid-measure clef changes', () => {
        model.setClef(1, 'bass')
        model.setClefAt(3, frac(2, 1), 'alto')
        const restored = ScoreModel.fromJSON(model.toJSON())
        expect(restored.getEffectiveClef(1)).toBe('bass')
        expect(restored.getEffectiveClefAt(3, frac(1, 1))).toBe('bass')   // inherited before the change
        expect(restored.getEffectiveClefAt(3, frac(2, 1))).toBe('alto')
      })
    })
  })

  describe('dynamic operations', () => {
    beforeEach(() => {
      // 3 measures (constructor creates measure 1)
      model.addMeasure()
      model.addMeasure()
    })

    it('adds a dynamic, generates an id, and stores it sorted by beat', () => {
      model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f') })
      const first = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
      expect(first?.id).toBeTruthy()
      expect(model.getDynamics(1).map(d => [d.beat.num, dynamicLevelOf(d)])).toEqual([
        [0, 'p'],
        [2, 'f'],
      ])
    })

    it('returns null when the measure does not exist', () => {
      expect(model.addDynamic(99, { beat: frac(0, 1), text: levelToGlyphString('p') })).toBeNull()
    })

    it('stacks multiple dynamics at the same (beat, voice) without replacing', () => {
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('p'), voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), text: 'dolce', voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f'), voice: 0 })
      const dyns = model.getDynamics(1)
      expect(dyns).toHaveLength(3)
      // Placement order is preserved within a beat (stable sort).
      expect(dyns.map(d => dynamicLevelOf(d) ?? d.text)).toEqual(['p', 'dolce', 'f'])
    })

    it('playback uses the last (rightmost) level when several are stacked at a beat', () => {
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('p') })
      model.addDynamic(1, { beat: frac(1, 1), text: 'dolce' })
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f') })
      expect(model.getActiveLevel(1, frac(1, 1))).toBe('f')
    })

    it('keeps separate dynamics at the same beat in different voices', () => {
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('p'), voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f'), voice: 1 })
      expect(model.getDynamics(1)).toHaveLength(2)
    })

    it('stores a custom text dynamic', () => {
      const d = model.addDynamic(2, { beat: frac(0, 1), text: 'dolce' })
      expect(d?.text).toBe('dolce')
      expect(model.getDynamics(2)[0].text).toBe('dolce')
    })

    it('updates a dynamic by id', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
      const updated = model.updateDynamic(d.id, { text: levelToGlyphString('f') })
      expect(dynamicLevelOf(updated!)).toBe('f')
      expect(dynamicLevelOf(model.getDynamics(1)[0])).toBe('f')
    })

    it('re-sorts when an update changes the beat', () => {
      const a = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
      model.addDynamic(1, { beat: frac(2, 1), text: levelToGlyphString('f') })
      model.updateDynamic(a.id, { beat: frac(3, 1) })
      expect(model.getDynamics(1).map(d => dynamicLevelOf(d))).toEqual(['f', 'p'])
    })

    it('returns null when updating a missing id', () => {
      expect(model.updateDynamic('nope', { text: levelToGlyphString('f') })).toBeNull()
    })

    it('removes a dynamic by id and drops the empty array', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
      expect(model.removeDynamic(d.id)).toBe(true)
      expect(model.getDynamics(1)).toEqual([])
      expect(model.getMeasure(1)!.dynamics).toBeUndefined()
    })

    it('returns false when removing a missing id', () => {
      expect(model.removeDynamic('nope')).toBe(false)
    })

    it('clears a hand-nudged offset override so it does not orphan on delete', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
      model.nudgeDynamicOffset(d.id, 0, 3)
      expect(model.getEngravingOverride(d.id, 'dynamicOffset')).toBeDefined()
      expect(model.removeDynamic(d.id)).toBe(true)
      expect(model.getEngravingOverride(d.id, 'dynamicOffset')).toBeUndefined()
    })

    it('resolves the active level via getActiveLevel', () => {
      model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
      model.addDynamic(2, { beat: frac(0, 1), text: levelToGlyphString('f') })
      expect(model.getActiveLevel(1, frac(1, 1))).toBe('p')
      expect(model.getActiveLevel(3, frac(0, 1))).toBe('f') // inherited from m2
    })

    it('re-anchors a measure\'s dynamics across a rebar (same absolute position)', () => {
      model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })
      expect(model.getDynamics(1)).toHaveLength(1)
      // A meter change rebars the region; the dynamic at beat 0 stays at measure 1
      // beat 0 (absolute offset 0 maps to the start of the rebar'd region).
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      const dyns = model.getDynamics(1)
      expect(dyns).toHaveLength(1)
      expect(dynamicLevelOf(dyns[0])).toBe('p')
      expect(fracToNumber(dyns[0].beat)).toBe(0)
    })

    it('carries a hand-nudged offset (client #8) across a rebar and clears the old id', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), text: levelToGlyphString('p') })!
      model.nudgeDynamicOffset(d.id, 1, 4)
      expect(dynamicOffsetOverrideOf(model.getScore(), d.id)).toBeDefined()

      model.setTimeSignature(1, { numerator: 3, denominator: 4 })

      // Rebar regenerates the dynamic's id; the offset must follow the new id, not orphan on the old.
      const dyn = model.getDynamics(1)[0]
      expect(dyn.id).not.toBe(d.id)
      expect(dynamicOffsetOverrideOf(model.getScore(), dyn.id)).toEqual({ kind: 'dynamicOffset', x: 1, y: 4 })
      expect(dynamicOffsetOverrideOf(model.getScore(), d.id)).toBeUndefined() // old id no longer present
    })
  })
})

// ===========================================================================
// Phase 5 — time-signature engine API
// ===========================================================================

const ts = (numerator: number, denominator: number) => ({ numerator, denominator })

/** Slots in a measure, sorted by beat. */
function slotsOf(model: ScoreModel, measureNumber: number): ChordRest[] {
  return [...(model.getMeasure(measureNumber)?.slots ?? [])].sort((a, b) => fracCompare(a.beat, b.beat))
}

/** Total sounding length of a measure's slots, as a float (quarters). */
function totalLen(model: ScoreModel, measureNumber: number): number {
  return slotsOf(model, measureNumber).reduce((sum, s) => {
    const d = s.actualDuration ?? frac(0, 1)
    return sum + fracToNumber(d)
  }, 0)
}

const measureRest = (model: ScoreModel, n: number) =>
  slotsOf(model, n).find((s) => s.type === 'rest' && s.isMeasureRest)

/**
 * A new bar with no explicit meter inherits the meter IN EFFECT where it lands — not a
 * score-wide "default" (which was only ever bar 1's meter in disguise; see the note on
 * `Score` in types/music.ts). A bar added inside a 3/4 region is a 3/4 bar.
 */
describe('ScoreModel — a new measure inherits the meter in effect', () => {
  it('appends in the meter of the last bar, not the opening one', () => {
    const model = new ScoreModel('TS') // bar 1 = 4/4
    model.addMeasure()
    model.setTimeSignature(2, ts(3, 4)) // bars 2.. are 3/4
    expect(model.addMeasure().timeSignature).toEqual(ts(3, 4))
  })

  it('inserts inside a region in that region\'s meter', () => {
    const model = new ScoreModel('TS')
    model.addMeasure()
    model.addMeasure()
    model.setTimeSignature(2, ts(7, 8)) // bars 2..3 are 7/8
    expect(model.insertMeasureAfter(2).timeSignature).toEqual(ts(7, 8))
  })

  it('inserts at the very front in the constant default (nothing precedes it)', () => {
    const model = new ScoreModel('TS')
    model.setTimeSignature(1, ts(3, 4))
    expect(model.insertMeasureAfter(0).timeSignature).toEqual(ts(4, 4))
  })

  it('does not alias the constant — editing the new bar cannot corrupt later ones', () => {
    const model = new ScoreModel('TS')
    const a = model.addMeasure()
    const b = model.addMeasure()
    expect(a.timeSignature).not.toBe(b.timeSignature)
  })
})

describe('ScoreModel.setTimeSignature', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('changes an empty bar and resizes its measure rest', () => {
    expect(model.setTimeSignature(1, ts(3, 4))).toBe(true)
    const m = model.getMeasure(1)!
    expect(m.timeSignature).toEqual(ts(3, 4))
    expect(m.timeSignatureChange).toBe(true)
    const mr = measureRest(model, 1)!
    expect(mr).toBeDefined()
    expect(fracToNumber(mr.actualDuration!)).toBe(3) // 3/4 bar = 3 quarters
  })

  it('rejects a non-dyadic meter', () => {
    expect(() => model.setTimeSignature(1, ts(4, 3))).toThrow()
  })

  it('is a no-op when re-applying the same signature', () => {
    model.setTimeSignature(1, ts(3, 4))
    expect(model.setTimeSignature(1, ts(3, 4))).toBe(false)
  })

  it('propagates forward to following measures (3/4 → 6/8)', () => {
    model.addMeasure(); model.addMeasure() // measures 2, 3 (4/4)
    model.setTimeSignature(1, ts(6, 8))
    for (const n of [1, 2, 3]) {
      expect(model.getMeasure(n)!.timeSignature).toEqual(ts(6, 8))
      expect(fracToNumber(measureRest(model, n)!.actualDuration!)).toBe(3) // 6/8 = 3 quarters
    }
    // Only measure 1 carries the explicit change marker.
    expect(model.getMeasure(1)!.timeSignatureChange).toBe(true)
    expect(model.getMeasure(2)!.timeSignatureChange).toBeFalsy()
  })

  it('propagation stops at the next explicit change', () => {
    model.addMeasure(); model.addMeasure(); model.addMeasure() // 2,3,4
    model.setTimeSignature(3, ts(2, 4)) // explicit change at 3 → 3,4 = 2/4
    model.setTimeSignature(1, ts(3, 4)) // 1,2 = 3/4, must not touch 3,4
    expect(model.getMeasure(1)!.timeSignature).toEqual(ts(3, 4))
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(3, 4))
    expect(model.getMeasure(3)!.timeSignature).toEqual(ts(2, 4))
    expect(model.getMeasure(3)!.timeSignatureChange).toBe(true)
    expect(model.getMeasure(4)!.timeSignature).toEqual(ts(2, 4))
  })

  it('under-full bar over notes gains trailing rests, keeping the notes', () => {
    model.setTimeSignature(1, ts(2, 4))
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.setTimeSignature(1, ts(4, 4)) // bar grows 2 → 4 quarters
    const chords = slotsOf(model, 1).filter((s) => s.type === 'chord')
    expect(chords.map((c) => fracToNumber(c.beat))).toEqual([0, 1])
    expect(totalLen(model, 1)).toBe(4) // notes (2) + trailing rests (2)
  })

  it('stores an additive grouping and rejects an invalid one', () => {
    expect(model.setTimeSignature(1, { numerator: 7, denominator: 8, grouping: [2, 2, 3] })).toBe(true)
    expect(model.getMeasure(1)!.timeSignature.grouping).toEqual([2, 2, 3])
    // Deep-copied (mutating the source array must not affect the stored meter).
    expect(() => model.setTimeSignature(1, { numerator: 7, denominator: 8, grouping: [3, 3] })).toThrow()
  })

  it('changing only the grouping is not a no-op', () => {
    model.setTimeSignature(1, { numerator: 7, denominator: 8, grouping: [2, 2, 3] })
    expect(model.setTimeSignature(1, { numerator: 7, denominator: 8, grouping: [3, 2, 2] })).toBe(true)
    expect(model.getMeasure(1)!.timeSignature.grouping).toEqual([3, 2, 2])
  })
})

describe('ScoreModel.setMeasureActualDuration (pickup / anacrusis)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel() })

  it('shrinks an empty 4/4 bar to a 1-beat pickup → a quarter rest, not a measure rest', () => {
    expect(model.setMeasureActualDuration(1, frac(1, 1))).toBe(true)
    const slots = slotsOf(model, 1)
    expect(totalLen(model, 1)).toBe(1) // bar now sums to one quarter
    expect(slots.every((s) => !(s.type === 'rest' && s.isMeasureRest))).toBe(true)
    const rests = slots.filter((s) => s.type === 'rest')
    expect(rests).toHaveLength(1)
    expect(rests[0].duration).toBe('q')
  })

  it('clears the override when passed null or a length ≥ nominal', () => {
    model.setMeasureActualDuration(1, frac(1, 1))
    expect(model.getMeasure(1)!.actualDurationOverride).toBeDefined()
    expect(model.setMeasureActualDuration(1, null)).toBe(true)
    expect(model.getMeasure(1)!.actualDurationOverride).toBeUndefined()
    // ≥ nominal also clears (a pickup must be shorter)
    model.setMeasureActualDuration(1, frac(1, 1))
    expect(model.setMeasureActualDuration(1, frac(4, 1))).toBe(true)
    expect(model.getMeasure(1)!.actualDurationOverride).toBeUndefined()
    // no-op when already clear
    expect(model.setMeasureActualDuration(1, null)).toBe(false)
  })

  it('keeps notes that exceed a newly-shortened bar (over-full, never trimmed)', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })
    model.setMeasureActualDuration(1, frac(1, 1)) // shrink under the half note
    const chords = slotsOf(model, 1).filter((s) => s.type === 'chord')
    expect(chords).toHaveLength(1) // the half note is kept (renders crowded/SOFT)
  })

  it('re-barring a measure clears its pickup override (v1 limitation)', () => {
    model.setMeasureActualDuration(1, frac(1, 1))
    model.setTimeSignature(1, ts(3, 4)) // rebar rewrites the bar to nominal length
    expect(model.getMeasure(1)!.actualDurationOverride).toBeUndefined()
  })
})

describe('ScoreModel voice-aware fill (scaffolding)', () => {
  it('fills each voice independently up to the bar length', () => {
    const model = new ScoreModel('V')
    // Voice 0 starts as a whole-bar measure rest. Add a voice-1 quarter at beat 0.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    const all = slotsOf(model, 1)
    const v0 = all.filter(s => (s.voice ?? 0) === 0)
    const v1 = all.filter(s => (s.voice ?? 0) === 1)

    // Voice 0 untouched: still a single whole-bar measure rest.
    expect(v0).toHaveLength(1)
    expect((v0[0] as { isMeasureRest?: boolean }).isMeasureRest).toBe(true)

    // Voice 1: the quarter note + rests, summing to the full 4/4 bar.
    const v1Chord = v1.find(s => s.type === 'chord')!
    expect(v1Chord.duration).toBe('q')
    const v0Total = v0.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    const v1Total = v1.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    expect(v0Total).toBeCloseTo(4, 5)
    expect(v1Total).toBeCloseTo(4, 5)
  })

  it('adding a note in one voice does not remove another voice\'s rests', () => {
    const model = new ScoreModel('V')
    const before = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 0).length
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    const after = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 0).length
    expect(after).toBe(before) // voice 0 stream untouched
  })

  it('a voice-0 tuplet does not block rest-fill in another voice', () => {
    const model = new ScoreModel('V')
    // Voice 0: a triplet at beat 0 (spans beats 0→1).
    model.createTuplet(1, frac(0, 1), '8', 3, 2)
    // Voice 1: a single 8th note at beat 0, also inside the v0 tuplet's span.
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), voice: 1 })

    const v1 = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 1)
    // The note plus filler rests must sum to the full 4/4 bar — the v0 triplet
    // must not steal voice 1's time and leave the bar short.
    const v1Total = v1.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    expect(v1Total).toBeCloseTo(4, 5)
    expect(v1.some(s => s.type === 'rest')).toBe(true) // rests actually filled
  })

  it('converting a voice-1 rest into a note keeps it in voice 1', () => {
    const model = new ScoreModel('V')
    // Voice 1 gets an 8th note, leaving filler rests in the same voice.
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), voice: 1 })
    const restAtHalf = slotsOf(model, 1).find(
      s => (s.voice ?? 0) === 1 && s.type === 'rest' && fracToNumber(s.beat) === 0.5,
    )!
    expect(restAtHalf).toBeDefined()

    // Edit that rest in place into a pitch (the rest→chord conversion path).
    model.updateNote(restAtHalf.id, { step: 'C', alter: 0, octave: 5, isRest: false })

    const converted = slotsOf(model, 1).find(
      s => s.type === 'chord' && fracToNumber(s.beat) === 0.5,
    )!
    expect(converted).toBeDefined()
    expect(converted.voice).toBe(1) // did not fall back to voice 0
    // And no stray rest was dropped on top of it (voice 1 still sums to one bar).
    const v1 = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 1)
    const v1Total = v1.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    expect(v1Total).toBeCloseTo(4, 5)
  })
})

describe('ScoreModel measure-rest update (regression)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('changing a measure rest\'s duration drops the measure-rest flag and resizes it', () => {
    const mr = measureRest(model, 1)!
    expect(mr).toBeDefined()
    expect(fracToNumber(mr.actualDuration!)).toBe(4) // 4/4 whole-bar measure rest

    model.updateNote(mr.id, { duration: '8' })

    const after = model.getMeasure(1)!.slots.find((s) => s.id === mr.id)!
    expect(after.type).toBe('rest')
    // No longer a whole-bar measure rest...
    expect((after as { isMeasureRest?: boolean }).isMeasureRest).toBeFalsy()
    expect(after.duration).toBe('8')
    // ...and its sounding length is the real 8th-note value, not the bar length.
    expect(fracToNumber(after.actualDuration!)).toBe(0.5)
  })

  it('the resized rest no longer claims the whole bar (only one measure rest exists)', () => {
    const mr = measureRest(model, 1)!
    model.updateNote(mr.id, { duration: '8' })
    expect(measureRest(model, 1)).toBeUndefined() // the lone measure rest is gone
  })
})

describe('ScoreModel.removeTimeSignatureChange', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('reverts a change and its region to the inherited signature', () => {
    model.addMeasure(); model.addMeasure() // 2, 3
    model.setTimeSignature(2, ts(3, 4)) // 2,3 → 3/4
    expect(model.removeTimeSignatureChange(2)).toBe(true)
    for (const n of [1, 2, 3]) expect(model.getMeasure(n)!.timeSignature).toEqual(ts(4, 4))
    expect(model.getMeasure(2)!.timeSignatureChange).toBeFalsy()
  })

  it('cannot remove the opening signature at measure 1', () => {
    expect(model.removeTimeSignatureChange(1)).toBe(false)
  })

  it('returns false when there is no explicit change to remove', () => {
    model.addMeasure()
    expect(model.removeTimeSignatureChange(2)).toBe(false)
  })
})

describe('ScoreModel.setTimeSignatureHidden', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS') })

  it('hides the glyph but keeps the meter and bar capacity', () => {
    expect(model.setTimeSignatureHidden(1, true)).toBe(true)
    expect(model.getMeasure(1)!.timeSignatureHidden).toBe(true)
    expect(model.getMeasure(1)!.timeSignature).toEqual(ts(4, 4)) // meter unchanged
    expect(fracToNumber(measureRest(model, 1)!.actualDuration!)).toBe(4) // still a 4/4 bar
  })

  it('is a no-op when already in the requested visibility', () => {
    expect(model.setTimeSignatureHidden(1, false)).toBe(false) // already visible
    model.setTimeSignatureHidden(1, true)
    expect(model.setTimeSignatureHidden(1, true)).toBe(false)
  })

  it('setTimeSignature un-hides a hidden measure (not a no-op)', () => {
    model.setTimeSignatureHidden(1, true)
    expect(model.setTimeSignature(1, ts(4, 4))).toBe(true) // re-applying the meter un-hides
    expect(model.getMeasure(1)!.timeSignatureHidden).toBeFalsy()
  })
})

describe('ScoreModel JSON — time-signature validation', () => {
  /** Build a score JSON with the given per-measure meters. */
  function scoreJson(meters: Array<[number, number]>): string {
    return JSON.stringify({
      id: 'x', title: 't',
      measures: meters.map(([n, d], i) => ({
        id: `m${i + 1}`, number: i + 1, slots: [], tuplets: [],
        timeSignature: { numerator: n, denominator: d },
      })),
    })
  }

  it('rejects a non-dyadic opening time signature on load', () => {
    expect(() => ScoreModel.fromJSON(scoreJson([[4, 3]]))).toThrow()
  })

  it('rejects a non-dyadic per-measure time signature on load', () => {
    expect(() => ScoreModel.fromJSON(scoreJson([[4, 4], [5, 3]]))).toThrow()
  })

  it('restores a non-4/4 measure-rest with the correct bar-length actualDuration', () => {
    const model = new ScoreModel('TS')
    model.setTimeSignature(1, ts(3, 4))
    const restored = ScoreModel.fromJSON(model.toJSON())
    const mr = restored.getMeasure(1)!.slots.find((s) => s.type === 'rest' && s.isMeasureRest)!
    expect(fracToNumber(mr.actualDuration!)).toBe(3) // not 4 (the nominal 'w')
  })
})

/**
 * Rest-shift TRAVEL (docs/rest-shift-plan.md §3–§4): the position-keyed override survives
 * plain edits / measure inserts on its own (position-key + measure-id wins), and is carried
 * across a rebar by captureRestShifts/restoreRestShifts — re-stamped where a rest still
 * starts at the same region-relative offset, dropped otherwise.
 */
describe('rest-shift travel (option 3)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score') })

  /** Add a quarter C on beat 0 of measure 1, then return the first rest slot it leaves. */
  const firstRest = (measureNumber: number) =>
    model.getMeasure(measureNumber)!.slots.find((s) => s.type === 'rest')!

  it('survives a plain same-bar edit of ANOTHER beat (position-key win)', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const m1 = model.getMeasure(1)!
    const rest = firstRest(1)
    const key = restPositionKey(m1.id, rest.voice ?? 0, rest.beat)
    model.nudgeRestShift(key, 2)

    // Edit a DIFFERENT beat (last beat). Rests regenerate (fresh ids) but the shifted rest
    // keeps its onset → its position key is unchanged → the shift re-attaches.
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(2)
  })

  it('survives inserting a measure before it (measure-id key, not number)', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const m1 = model.getMeasure(1)!
    const rest = firstRest(1)
    const key = restPositionKey(m1.id, rest.voice ?? 0, rest.beat)
    model.nudgeRestShift(key, -1)

    model.insertMeasureAfter(0) // new bar at the front → old m1 renumbers to m2, id unchanged

    expect(model.getMeasure(2)!.id).toBe(m1.id)         // same object, new number
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(-1) // key still resolves
  })

  it('resurrects on a plain rest→note→rest (no prune, §4 accepted)', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const m1 = model.getMeasure(1)!
    const rest = firstRest(1)
    const key = restPositionKey(m1.id, rest.voice ?? 0, rest.beat)
    model.nudgeRestShift(key, 3)

    // Put a note ON the shifted rest's beat: no rebar fires, so the stored override stays.
    const onTop = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: rest.beat })
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(3) // still stored (not drawn)

    // Remove the note → a rest returns at that beat → the prior shift resurrects.
    model.deleteNote(onTop.id)
    expect(restShiftOverrideOf(model.getScore(), key)?.steps).toBe(3)
  })

  it('rebar KEEPS the shift when a rest still starts at the same offset', () => {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const m1 = model.getMeasure(1)!
    // Shift the rest on beat 1 (absolute offset 1 from the region start).
    const beat1 = frac(1, 1)
    model.nudgeRestShift(restPositionKey(m1.id, 0, beat1), 2)

    // Rebar 4/4 → 2/4: offset 1 lands on measure 1 beat 1, where a rest still starts.
    model.setTimeSignature(1, { numerator: 2, denominator: 4 })

    const after = model.getMeasure(1)!
    expect(restShiftOverrideOf(model.getScore(), restPositionKey(after.id, 0, beat1))?.steps).toBe(2)
  })

  it('rebar DROPS the shift when the new tiling has no rest START at that offset', () => {
    // 4/4: C@0(q), rest@1(q), rest@2(HALF). Shift the half rest on beat 2 (offset 2).
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const m1 = model.getMeasure(1)!
    model.nudgeRestShift(restPositionKey(m1.id, 0, frac(2, 1)), 2)
    expect(model.getScore().engravingOverrides).toBeDefined()

    // Rebar 4/4 → 3/4: the gap re-tiles to C@0(q) + a HALF rest starting at beat 1, so
    // nothing STARTS at offset 2 → the shift is dropped (plan §4 / §9, the merge case).
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  // Multi-staff Phase 3: note entry is staff-scoped. A note added to one staff must never
  // merge into, or clobber the rests of, another staff that shares the same beat + voice.
  describe('addNote staff scoping', () => {
    beforeEach(() => {
      // Seeds a 2nd staff (index 1) with a C3 half note at m1 beat 0 and G3 at beat 2.
      seedSecondStaff(model)
    })

    it('does NOT merge a staff-0 note into a staff-1 chord at the same beat/voice', () => {
      // Before the fix, addNote matched by (beat, voice) only, so this A4 joined the bass
      // staff's C3 chord. It must instead create a separate chord on staff 0.
      const staff1Id = model.getScore().staves![1].id
      const note = model.addNote({ step: 'A', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1), staff: 0 })
      expect(note.staff ?? 0).toBe(0)

      const slots = model.getSlotsInMeasure(1)
      // The staff-1 C3 chord at beat 0 is untouched — still exactly one pitch (C3).
      const bassChord = slots.find(s => s.type === 'chord' && s.staffId === staff1Id && fracToNumber(s.beat) === 0)
      expect(bassChord && bassChord.type === 'chord' && bassChord.notes).toHaveLength(1)
      expect(bassChord && bassChord.type === 'chord' && bassChord.notes[0].step).toBe('C')
      // A4 is a distinct chord on staff 0 (absent staffId), not chorded with C3.
      const trebleChord = slots.find(s => s.type === 'chord' && s.staffId === undefined && fracToNumber(s.beat) === 0)
      expect(trebleChord && trebleChord.type === 'chord' && trebleChord.notes[0].step).toBe('A')
    })

    it('stamps the target staffId on a note added to a later staff', () => {
      const staff1Id = model.getScore().staves![1].id
      const note = model.addNote({ step: 'E', octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), staff: 1 })
      expect(note.staff).toBe(1)
      // It joined staff 1's existing C3 chord at beat 0 (same staff + beat + voice).
      const slots = model.getSlotsInMeasure(1)
      const bassChord = slots.find(s => s.type === 'chord' && s.staffId === staff1Id && fracToNumber(s.beat) === 0)
      expect(bassChord && bassChord.type === 'chord' && bassChord.notes.map(n => n.step).sort()).toEqual(['C', 'E'])
    })

    it('keeps a note on staff 0 with no staffId (single-staff byte-identical convention)', () => {
      const note = model.addNote({ step: 'D', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
      expect(note.staff ?? 0).toBe(0)
      const slots = model.getSlotsInMeasure(1)
      const trebleChord = slots.find(s => s.type === 'chord' && s.staffId === undefined && fracToNumber(s.beat) === 0)
      expect(trebleChord).toBeDefined()
      expect(trebleChord!.staffId).toBeUndefined()
    })

    // Converting a rest → note in place (keyboard edit-in-place) must KEEP the rest's staff.
    // Before the fix the new chord dropped staffId and jumped to staff 0.
    it('preserves the staff when a staff-1 rest is converted to a note', () => {
      const staff1Id = model.getScore().staves![1].id
      // A rest on staff 1 at m1 beat 2 (staff 1's half note there is replaced first).
      const rest = model.addNote({ duration: 'h', measure: 1, beat: frac(2, 1), isRest: true, staff: 1 })
      expect(rest.staff).toBe(1)
      const updated = model.updateNote(rest.id, { step: 'E', alter: 0, octave: 3, isRest: false })
      expect(updated.staff).toBe(1)
      const chord = model.getSlotsInMeasure(1).find(s => s.type === 'chord' && s.staffId === staff1Id && fracToNumber(s.beat) === 2)
      expect(chord).toBeDefined()
    })
  })

  // Multi-staff tuplet entry: a tuplet created on staff 1 must stamp its staffId and place
  // its filler rests on staff 1 — not silently on staff 0.
  describe('createTuplet staff scoping', () => {
    beforeEach(() => {
      seedSecondStaff(model)
    })

    it('stamps the target staffId on a tuplet created on a later staff', () => {
      const staff1Id = model.getScore().staves![1].id
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2, 0, 1)
      expect(tuplet.staffId).toBe(staff1Id)
    })

    it('places filler rests on the tuplet\'s own staff', () => {
      const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2, 0, 1)
      model.refillTupletRemainder(1, tuplet, 0)
      const restsInTuplet = model.getNotesInTuplet(tuplet.id)
      expect(restsInTuplet.length).toBeGreaterThan(0)
      expect(restsInTuplet.every(n => (n.staff ?? 0) === 1)).toBe(true)
    })

    it('leaves a staff-0 tuplet free to coexist with a staff-1 tuplet at the same beat', () => {
      model.createTuplet(1, frac(0, 1), '8', 3, 2, 0, 0)
      // A staff-1 tuplet at the same beat is NOT blocked by the staff-0 one.
      const overlaps = model.tupletSpanOverlaps(1, frac(0, 1), tupletSpan({ numNotes: 3, notesOccupied: 2, baseDuration: '8' }), 0, 1)
      expect(overlaps).toBe(false)
    })
  })

  // Multi-staff rebar: a TS change re-bars every staff on the shared spine INDEPENDENTLY.
  // Before the (staff,voice) lane fix, flattenRegion merged both staves into one voice-0
  // stream, so a TS change collapsed staff 1's music onto staff 0.
  describe('rebar staff scoping (TS change)', () => {
    beforeEach(() => {
      model.addMeasure() // measure 2
      seedSecondStaff(model)
    })

    it('keeps each staff\'s pitches on its own staff after a time-signature change', () => {
      const staff1Id = model.getScore().staves![1].id
      // Distinct content per staff in m2: treble G4 quarters, bass C3 quarters.
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), staff: 0 })
      model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 2, beat: frac(1, 1), staff: 0 })
      model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 2, beat: frac(0, 1), staff: 1 })
      model.addNote({ step: 'C', octave: 3, duration: 'q', measure: 2, beat: frac(1, 1), staff: 1 })

      model.setTimeSignature(2, { numerator: 2, denominator: 4 })

      // Scope to m2 (the region m1 keeps the temp staff's own seeded notes).
      const notes = model.getNotesInMeasure(2).filter(n => !n.isRest)
      const treble = notes.filter(n => (n.staff ?? 0) === 0)
      const bass = notes.filter(n => (n.staff ?? 0) === 1)
      // Neither staff's notes leaked onto the other; pitches stayed put.
      expect(treble.length).toBeGreaterThan(0)
      expect(treble.every(n => n.step === 'G' && n.octave === 4)).toBe(true)
      expect(bass.length).toBeGreaterThan(0)
      expect(bass.every(n => n.step === 'C' && n.octave === 3)).toBe(true)
      // Bass notes carry the real staffId (didn't collapse to absent = staff 0).
      const bassSlots = model.getSlotsInMeasure(2).filter(s => s.type === 'chord' && s.staffId === staff1Id)
      expect(bassSlots.length).toBeGreaterThan(0)
    })
  })

  // Multi-staff clefs: a clef change lands on the placing staff, and per-staff clefs at
  // the same beat coexist without one clobbering the other.
  describe('clef staff scoping', () => {
    beforeEach(() => {
      model.addMeasure() // measure 2
      seedSecondStaff(model)
    })

    // Staff 1 inherits BASS (the temp staff's seeded opening clef), so use a clef that
    // differs from it — otherwise the change is (correctly) dropped as redundant.
    it('stamps the staffId on a clef change placed on a later staff', () => {
      const staff1Id = model.getScore().staves![1].id
      expect(model.setClefAt(2, frac(2, 1), 'treble', staff1Id)).toBe(true)
      const clef = model.getMeasure(2)!.clefs!.find(c => c.staffId === staff1Id)
      expect(clef?.clef).toBe('treble')
    })

    it('lets a staff-0 and staff-1 clef change coexist at the same beat', () => {
      const staff1Id = model.getScore().staves![1].id
      model.setClefAt(2, frac(2, 1), 'alto')              // staff 0 (absent id; inherits treble)
      model.setClefAt(2, frac(2, 1), 'treble', staff1Id)  // staff 1 (inherits bass)
      const clefs = model.getMeasure(2)!.clefs!.filter(c => fracToNumber(c.beat) === 2)
      expect(clefs).toHaveLength(2)
      expect(clefs.find(c => c.staffId === undefined)?.clef).toBe('alto')
      expect(clefs.find(c => c.staffId === staff1Id)?.clef).toBe('treble')
    })

    it('removes only the addressed staff\'s clef change', () => {
      const staff1Id = model.getScore().staves![1].id
      model.setClefAt(2, frac(2, 1), 'alto')              // staff 0
      model.setClefAt(2, frac(2, 1), 'treble', staff1Id)  // staff 1
      model.removeClefAt(2, frac(2, 1), staff1Id)         // remove only staff 1's
      const clefs = model.getMeasure(2)!.clefs!.filter(c => fracToNumber(c.beat) === 2)
      expect(clefs).toHaveLength(1)
      expect(clefs[0].staffId).toBeUndefined()
      expect(clefs[0].clef).toBe('alto')
    })
  })

  // Regression: clef is per-staff content — there is no document-level clef, so a staff
  // without its own opening clef falls back to the universal 'treble' default, never to
  // another staff's clef. (The `score.clef` removal; the cross-staff opening-clef bleed.)
  describe('clef per-staff independence (no document clef)', () => {
    it('changing one staff opening clef does not bleed to a staff without its own', () => {
      const staff1Id = model.addStaffBelow(0) // staff 1: no opening clef of its own
      model.setClefAt(1, frac(0, 1), 'alto')  // staff 0 (absent id)
      expect(measureOpeningClef(model.getScore(), 1)).toBe('alto')        // staff 0 changed
      expect(measureOpeningClef(model.getScore(), 1, staff1Id)).toBe('treble') // staff 1 stays default
    })

    it('protects a lower staff opening clef from removal (decision b)', () => {
      const staff1Id = seedSecondStaff(model) // staff 1 opens bass
      expect(model.removeClefAt(1, frac(0, 1), staff1Id)).toBe(false) // lower staff opening protected
      expect(model.removeClefAt(1, frac(0, 1))).toBe(false)           // staff 0 opening protected too
    })

    // getEffectiveClef(At) used to drop the staffId and always resolve staff 0's clef,
    // so stem-direction / articulation-side on a staff 1+ chord were computed against the
    // wrong clef. They now resolve per-staff.
    it('getEffectiveClef(At) resolves per-staff, not always staff 0', () => {
      const staff1Id = seedSecondStaff(model) // staff 0 = treble, staff 1 = bass
      expect(model.getEffectiveClef(1)).toBe('treble')          // staff 0 (absent id)
      expect(model.getEffectiveClef(1, staff1Id)).toBe('bass')  // staff 1
      expect(model.getEffectiveClefAt(1, frac(2, 1))).toBe('treble')
      expect(model.getEffectiveClefAt(1, frac(2, 1), staff1Id)).toBe('bass')
    })
  })
})

// Multi-staff Phase 4: the real "add staff" operation behind the "Staff:" toolbar group.
describe('ScoreModel.addStaff (multi-staff Phase 4)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Staff') }) // one measure, one staff

  it('addStaffBelow appends a staff and rest-fills every measure', () => {
    model.addMeasure() // two measures now
    const id = model.addStaffBelow(0)
    const staves = model.getScore().staves!
    expect(staves).toHaveLength(2)
    expect(staves[1].id).toBe(id)
    // Every bar has a rest lane for the new staff (index 1) — nothing was left empty.
    for (const m of [1, 2]) {
      const staff1Rests = model.getSlotsInMeasure(m).filter(s => s.type === 'rest' && s.staffId === id)
      expect(staff1Rests.length).toBeGreaterThan(0)
    }
  })

  it('creates a single group spanning both staves on the FIRST add (0→1 transition)', () => {
    expect(model.getScore().staffGroups).toBeUndefined() // a lone staff is not a group
    const id = model.addStaffBelow(0)
    const groups = model.getScore().staffGroups!
    expect(groups).toHaveLength(1)
    expect(groups[0].staffIds).toEqual([model.getScore().staves![0].id, id])
  })

  it('GROWS the one group (not a new group) on a later add', () => {
    model.addStaffBelow(0)                              // 2 staves, 1 group
    const groupId = model.getScore().staffGroups![0].id
    model.addStaffBelow(1)                              // add a 3rd staff below
    const groups = model.getScore().staffGroups!
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe(groupId)                 // same group object, grown
    expect(groups[0].staffIds).toEqual(model.getScore().staves!.map(s => s.id))
  })

  it('addStaffAbove(0) prepends and keeps existing content on its (now 2nd) staff', () => {
    // A note on the original (only) staff is stored with an ABSENT staffId (= staff 0).
    const note = model.addNote({ step: 'A', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const originalStaffId = model.getScore().staves![0].id

    const newTopId = model.addStaffAbove(0)
    const staves = model.getScore().staves!
    expect(staves[0].id).toBe(newTopId)                // the new staff is on top (index 0)
    expect(staves[1].id).toBe(originalStaffId)         // the original slid to index 1

    // The A4 stayed on the ORIGINAL staff (now index 1) — it did NOT jump to the new top
    // staff, because the prepend solidified its absent staffId into the explicit original id.
    expect(model.getNote(note.id)!.staff).toBe(1)
    const slot = model.getSlotsInMeasure(1).find(s => s.type === 'chord')
    expect(slot!.staffId).toBe(originalStaffId)

    // The freshly inserted top staff carries only rests (no pitched content leaked up to it).
    const topPitched = model.getNotesInMeasure(1).filter(n => (n.staff ?? 0) === 0 && !n.isRest)
    expect(topPitched).toHaveLength(0)
  })
})
