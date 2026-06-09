import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { NoteParams } from '@/types/music'
import { fracCreate as frac, fracCompare, fracToNumber } from '@/utils/fraction'
import type { ChordRest } from '@/types/music'

describe('ScoreModel', () => {
  let model: ScoreModel

  beforeEach(() => {
    model = new ScoreModel('Test Score', 120)
  })

  describe('initialization', () => {
    it('should create a score with default values', () => {
      const score = model.getScore()
      expect(score.title).toBe('Test Score')
      expect(score.tempo).toBe(120)
      expect(score.measures).toHaveLength(1)
    })

    it('should create score with default title and tempo', () => {
      const defaultModel = new ScoreModel()
      const score = defaultModel.getScore()
      expect(score.title).toBe('Untitled Score')
      expect(score.tempo).toBe(120)
    })
  })

  describe('setTitle', () => {
    it('should update the score title', () => {
      model.setTitle('New Title')
      expect(model.getScore().title).toBe('New Title')
    })
  })

  describe('setTempo', () => {
    it('should update the tempo', () => {
      model.setTempo(90)
      expect(model.getScore().tempo).toBe(90)
    })

    it('should throw error for tempo below 20', () => {
      expect(() => model.setTempo(10)).toThrow('Tempo must be between 20 and 300 BPM')
    })

    it('should throw error for tempo above 300', () => {
      expect(() => model.setTempo(400)).toThrow('Tempo must be between 20 and 300 BPM')
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

  describe('serialization', () => {
    it('should serialize score to JSON', () => {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const json = model.toJSON()
      const parsed = JSON.parse(json)

      expect(json).toContain('"title": "Test Score"')
      expect(json).toContain('"tempo": 120')
      expect(parsed.schemaVersion).toBe(2)
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
      expect(loaded.getScore().tempo).toBe(120)
      const actualNotes = loaded.getAllNotes().filter(n => !n.isRest)
      expect(actualNotes).toHaveLength(1)
    })

    it('round-trips dynamics (level + custom text) through JSON', () => {
      model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
      model.addDynamic(1, { beat: frac(2, 1), kind: 'text', text: 'dolce', voice: 0 })

      const loaded = ScoreModel.fromJSON(model.toJSON())
      const dyns = loaded.getDynamics(1)
      expect(dyns).toHaveLength(2)
      expect(dyns[0]).toMatchObject({ kind: 'level', level: 'p' })
      expect(dyns[0].beat).toEqual(frac(0, 1))
      expect(dyns[1]).toMatchObject({ kind: 'text', text: 'dolce' })
      // resolution still works after a load
      expect(loaded.getActiveLevel(1, frac(1, 1))).toBe('p')
    })

    it('loads legacy JSON with no dynamics array (backward-compatible)', () => {
      const legacy = JSON.stringify({
        id: 'x', title: 'Legacy', tempo: 100,
        keySignature: { key: 'C', accidentals: 0 },
        defaultTimeSignature: { numerator: 4, denominator: 4 },
        schemaVersion: 2,
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

    it('removes overlapping slots when creating a tuplet', () => {
      // There should be a whole rest covering the measure before creating the tuplet
      const before = model.getNotesInMeasure(1)
      expect(before.some(n => n.isRest)).toBe(true)

      model.createTuplet(1, frac(0, 1), '8', 3, 2)

      // The whole rest should be gone — tuplet cleared it
      const after = model.getNotesInMeasure(1).filter(n => !n.tupletId)
      expect(after.every(n => !n.isRest || frac(0, 1) !== n.beat)).toBe(true)
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

      it('falls back to the score opening clef', () => {
        model.getScore().clef = 'bass'
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
      it('stores an explicit clef on measure 1 and mirrors it to score.clef', () => {
        expect(model.setClef(1, 'bass')).toBe(true)
        expect(clefAt(1, 0)).toBe('bass')
        expect(model.getScore().clef).toBe('bass')
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

      it('migrates a legacy per-measure clef into the positioned list', () => {
        const legacy = JSON.stringify({
          id: 'x', title: 't', tempo: 120,
          keySignature: { key: 'C', accidentals: 0 },
          defaultTimeSignature: { numerator: 4, denominator: 4 },
          clef: 'bass',
          measures: [
            { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], clef: 'alto' },
          ],
        })
        const restored = ScoreModel.fromJSON(legacy)
        expect(restored.getEffectiveClef(1)).toBe('alto')                  // measure clef migrated
        expect(restored.getMeasure(1)!.clefs?.[0].clef).toBe('alto')
        expect((restored.getMeasure(1) as { clef?: string }).clef).toBeUndefined() // legacy field removed
      })

      it('old files with neither measure clefs nor migration inherit via score.clef', () => {
        const legacy = JSON.stringify({
          id: 'x', title: 't', tempo: 120,
          keySignature: { key: 'C', accidentals: 0 },
          defaultTimeSignature: { numerator: 4, denominator: 4 },
          clef: 'bass',
          measures: [
            { id: 'm1', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [] },
          ],
        })
        const restored = ScoreModel.fromJSON(legacy)
        expect(restored.getEffectiveClef(1)).toBe('bass')
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
      model.addDynamic(1, { beat: frac(2, 1), kind: 'level', level: 'f' })
      const first = model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
      expect(first?.id).toBeTruthy()
      expect(model.getDynamics(1).map(d => [d.beat.num, d.level])).toEqual([
        [0, 'p'],
        [2, 'f'],
      ])
    })

    it('returns null when the measure does not exist', () => {
      expect(model.addDynamic(99, { beat: frac(0, 1), kind: 'level', level: 'p' })).toBeNull()
    })

    it('replaces an existing dynamic at the same (beat, voice)', () => {
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'p', voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'f', voice: 0 })
      const dyns = model.getDynamics(1)
      expect(dyns).toHaveLength(1)
      expect(dyns[0].level).toBe('f')
    })

    it('keeps separate dynamics at the same beat in different voices', () => {
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'p', voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'f', voice: 1 })
      expect(model.getDynamics(1)).toHaveLength(2)
    })

    it('stores a custom text dynamic', () => {
      const d = model.addDynamic(2, { beat: frac(0, 1), kind: 'text', text: 'dolce' })
      expect(d?.kind).toBe('text')
      expect(model.getDynamics(2)[0].text).toBe('dolce')
    })

    it('updates a dynamic by id', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })!
      const updated = model.updateDynamic(d.id, { level: 'f' })
      expect(updated?.level).toBe('f')
      expect(model.getDynamics(1)[0].level).toBe('f')
    })

    it('re-sorts when an update changes the beat', () => {
      const a = model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })!
      model.addDynamic(1, { beat: frac(2, 1), kind: 'level', level: 'f' })
      model.updateDynamic(a.id, { beat: frac(3, 1) })
      expect(model.getDynamics(1).map(d => d.level)).toEqual(['f', 'p'])
    })

    it('returns null when updating a missing id', () => {
      expect(model.updateDynamic('nope', { level: 'f' })).toBeNull()
    })

    it('removes a dynamic by id and drops the empty array', () => {
      const d = model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })!
      expect(model.removeDynamic(d.id)).toBe(true)
      expect(model.getDynamics(1)).toEqual([])
      expect(model.getMeasure(1)!.dynamics).toBeUndefined()
    })

    it('returns false when removing a missing id', () => {
      expect(model.removeDynamic('nope')).toBe(false)
    })

    it('resolves the active level via getActiveLevel', () => {
      model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
      model.addDynamic(2, { beat: frac(0, 1), kind: 'level', level: 'f' })
      expect(model.getActiveLevel(1, frac(1, 1))).toBe('p')
      expect(model.getActiveLevel(3, frac(0, 1))).toBe('f') // inherited from m2
    })

    it('clears a measure\'s dynamics on a rebar (shares the clef limitation)', () => {
      model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
      expect(model.getDynamics(1)).toHaveLength(1)
      // A meter change rebars the region, rebuilding slots and dropping anchors.
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      expect(model.getMeasure(1)!.dynamics).toBeUndefined()
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

describe('ScoreModel.setTimeSignature', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS', 120) })

  it('changes an empty bar and resizes its measure rest', () => {
    expect(model.setTimeSignature(1, ts(3, 4))).toBe(true)
    const m = model.getMeasure(1)!
    expect(m.timeSignature).toEqual(ts(3, 4))
    expect(m.timeSignatureChange).toBe(true)
    expect(model.getScore().defaultTimeSignature).toEqual(ts(3, 4))
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

  it('re-bars over-full music across moved barlines (rebar default)', () => {
    // Four quarters fill 4/4; shrinking to 3/4 re-bars the 4th into measure 2.
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    model.setTimeSignature(1, ts(3, 4))
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))).toEqual([0, 1, 2])
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))).toEqual([0])
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(3, 4))
    // No note lost: four quarter-notes across the region.
    const chordCount = [1, 2].reduce((n, m) => n + slotsOf(model, m).filter((s) => s.type === 'chord').length, 0)
    expect(chordCount).toBe(4)
  })

  it('splits a note straddling a moved barline with a tie (rebar default)', () => {
    // Half note at beat 2 in 4/4 spans [2,4); in 3/4 it crosses the bar 1/2 line at 3.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(2, 1) })
    model.setTimeSignature(1, ts(3, 4))
    const a = slotsOf(model, 1).find((s) => s.type === 'chord') as any
    const b = slotsOf(model, 2).find((s) => s.type === 'chord') as any
    expect(fracToNumber(a.beat)).toBe(2)
    expect(a.duration).toBe('q')
    expect(fracToNumber(b.beat)).toBe(0)
    expect(b.duration).toBe('q')
    // Pitch-level tie links the two halves of the split note.
    expect(a.notes[0].tiedTo).toBe(b.notes[0].id)
    expect(b.notes[0].tiedFrom).toBe(a.notes[0].id)
  })

  it('keeps a tuplet intact (atomic) through a rebar', () => {
    // An eighth-note triplet at beat 0 of measure 1; rebar 4/4 → 3/4.
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    model.refillTupletRemainder(1, tuplet) // fill the triplet with its filler rests
    const before = model.getMeasure(1)!.slots.filter((s) => s.tupletId === tuplet.id).length
    model.setTimeSignature(1, ts(3, 4))
    // The triplet survives intact (same slot count, anchored at beat 0).
    const m1 = model.getMeasure(1)!
    expect(m1.tuplets).toHaveLength(1)
    const tupletSlots = m1.slots.filter((s) => s.tupletId === m1.tuplets[0].id)
    expect(tupletSlots).toHaveLength(before)
    expect(fracToNumber(m1.tuplets[0].startBeat)).toBe(0)
  })

  it('preserves a tie crossing into a re-barred region (re-attaches, no dangle)', () => {
    // C4 in measure 1 tied to C4 in measure 2; re-barring measure 2 regenerates
    // its slot ids, so the incoming tie must be re-attached to the new C4.
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addMeasure()
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })

    model.setTimeSignature(2, ts(5, 8)) // re-bars measure 2 → b gets a new id

    // The tie is preserved: m1's C4 now points to the rebar'd C4 (a real note).
    const aAfter = model.getNote(a.id)!
    expect(aAfter.tiedTo).toBeDefined()
    const target = model.getNote(aAfter.tiedTo!)
    expect(target).toBeTruthy()
    expect(target!.step).toBe('C')
    expect(target!.octave).toBe(4)
    expect(target!.measure).toBe(2)
    expect(target!.tiedFrom).toBe(a.id)
    // Global invariant: every tie pointer references an existing slot.
    const ids = new Set<string>()
    for (const m of model.getScore().measures)
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    let dangling = 0
    for (const m of model.getScore().measures)
      for (const s of m.slots) {
        if (s.type === 'chord') {
          for (const p of s.notes) {
            if (p.tiedTo && !ids.has(p.tiedTo)) dangling++
            if (p.tiedFrom && !ids.has(p.tiedFrom)) dangling++
          }
        } else if (s.tiedFrom && !ids.has(s.tiedFrom)) dangling++
      }
    expect(dangling).toBe(0)
  })

  it('rewrite:"none" keeps an over-full bar crowded (no rebar)', () => {
    for (let b = 0; b < 4; b++) {
      model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    model.setTimeSignature(1, ts(3, 4), { rewrite: 'none' })
    const chordBeats = slotsOf(model, 1).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat))
    expect(chordBeats).toEqual([0, 1, 2, 3]) // all four kept in one crowded bar
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
    const model = new ScoreModel('V', 120)
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
    const model = new ScoreModel('V', 120)
    const before = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 0).length
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    const after = slotsOf(model, 1).filter(s => (s.voice ?? 0) === 0).length
    expect(after).toBe(before) // voice 0 stream untouched
  })
})

describe('ScoreModel measure-rest update (regression)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS', 120) })

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
  beforeEach(() => { model = new ScoreModel('TS', 120) })

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

  it('re-bars the region back to the inherited meter (rebar default)', () => {
    model.addMeasure(); model.addMeasure() // 2, 3
    model.setTimeSignature(2, ts(2, 4)) // measures 2,3 → 2/4 (2 quarters each)
    // Fill measures 2 and 3 with 2 quarters each (4 quarters of content total).
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(1, 1) })
    expect(model.removeTimeSignatureChange(2)).toBe(true)
    // Reverted to 4/4 and re-barred: the 4 quarters now fill a single 4/4 bar (measure 2).
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(4, 4))
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat)))
      .toEqual([0, 1, 2, 3])
  })

  it("with rewrite 'none' reverts the meter but keeps barlines fixed", () => {
    model.addMeasure(); model.addMeasure() // 2, 3
    model.setTimeSignature(2, ts(2, 4))
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 3, beat: frac(0, 1) })
    expect(model.removeTimeSignatureChange(2, { rewrite: 'none' })).toBe(true)
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(4, 4))
    // No rebar/merge: measure 3 keeps its own note in place.
    expect(slotsOf(model, 3).filter((s) => s.type === 'chord').map((c) => fracToNumber(c.beat)))
      .toEqual([0])
  })
})

describe('ScoreModel.setTimeSignatureHidden', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('TS', 120) })

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

describe('ScoreModel JSON — time-signature migration & validation', () => {
  /** Build a v1 (markerless) score JSON with the given per-measure meters. */
  function v1Json(meters: Array<[number, number]>): string {
    return JSON.stringify({
      id: 'x', title: 't', tempo: 120, schemaVersion: 1,
      keySignature: { key: 'C', accidentals: 0 },
      defaultTimeSignature: { numerator: meters[0][0], denominator: meters[0][1] },
      measures: meters.map(([n, d], i) => ({
        id: `m${i + 1}`, number: i + 1, slots: [], tuplets: [],
        timeSignature: { numerator: n, denominator: d },
      })),
    })
  }

  it('derives change markers from differing signatures (v1 → v2)', () => {
    const model = ScoreModel.fromJSON(v1Json([[4, 4], [3, 4], [3, 4]]))
    expect(model.getMeasure(1)!.timeSignatureChange).toBe(true) // measure 1 always
    expect(model.getMeasure(2)!.timeSignatureChange).toBe(true) // differs from m1
    expect(model.getMeasure(3)!.timeSignatureChange).toBeFalsy() // same as m2
    expect(model.getScore().schemaVersion).toBe(2)
  })

  it('rejects a non-dyadic default time signature on load', () => {
    expect(() => ScoreModel.fromJSON(v1Json([[4, 3]]))).toThrow()
  })

  it('rejects a non-dyadic per-measure time signature on load', () => {
    expect(() => ScoreModel.fromJSON(v1Json([[4, 4], [5, 3]]))).toThrow()
  })

  it('restores a non-4/4 measure-rest with the correct bar-length actualDuration', () => {
    const model = new ScoreModel('TS', 120)
    model.setTimeSignature(1, ts(3, 4))
    const restored = ScoreModel.fromJSON(model.toJSON())
    const mr = restored.getMeasure(1)!.slots.find((s) => s.type === 'rest' && s.isMeasureRest)!
    expect(fracToNumber(mr.actualDuration!)).toBe(3) // not 4 (the nominal 'w')
  })
})
