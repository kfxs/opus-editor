import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { curveShapeOverrideOf } from './engravingOverrides'
import type { NoteParams, Slur } from '@/types/music'
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

    it('migrates a legacy pixel-space slur cps into the staff-space override compartment', () => {
      // Pre-Phase-1 scores stored the hand-edited shape inline on the slur, in pixels.
      model.getScore().slurs = [
        { id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b', cps: [{ x: 2, y: 14 }, { x: -3, y: 16 }] } as unknown as Slur,
      ]
      const loaded = ScoreModel.fromJSON(model.toJSON())
      // Inline cps is gone; the shape now lives in the compartment in staff-spaces (px / 10).
      expect((loaded.getScore().slurs?.[0] as { cps?: unknown }).cps).toBeUndefined()
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
        keySignature: { key: 'C', accidentals: 0 },
        defaultTimeSignature: { numerator: 4, denominator: 4 },
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
        keySignature: { key: 'C', accidentals: 0 },
        defaultTimeSignature: { numerator: 4, denominator: 4 },
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

      it('a score with no measure clefs inherits via score.clef', () => {
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

    it('stacks multiple dynamics at the same (beat, voice) without replacing', () => {
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'p', voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'text', text: 'dolce', voice: 0 })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'f', voice: 0 })
      const dyns = model.getDynamics(1)
      expect(dyns).toHaveLength(3)
      // Placement order is preserved within a beat (stable sort).
      expect(dyns.map(d => d.level ?? d.text)).toEqual(['p', 'dolce', 'f'])
    })

    it('playback uses the last (rightmost) level when several are stacked at a beat', () => {
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'p' })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'text', text: 'dolce' })
      model.addDynamic(1, { beat: frac(1, 1), kind: 'level', level: 'f' })
      expect(model.getActiveLevel(1, frac(1, 1))).toBe('f')
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

    it('re-anchors a measure\'s dynamics across a rebar (same absolute position)', () => {
      model.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
      expect(model.getDynamics(1)).toHaveLength(1)
      // A meter change rebars the region; the dynamic at beat 0 stays at measure 1
      // beat 0 (absolute offset 0 maps to the start of the rebar'd region).
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      const dyns = model.getDynamics(1)
      expect(dyns).toHaveLength(1)
      expect(dyns[0].level).toBe('p')
      expect(fracToNumber(dyns[0].beat)).toBe(0)
    })
  })
})

describe('rebar preserves beat-anchored annotations (clefs + dynamics)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  it('keeps a dynamic in place when its beat still fits the new bar', () => {
    // The reported scenario: f at measure 2 beat 2, then change measure 2 → 3/4.
    model.addDynamic(2, { beat: frac(2, 1), kind: 'level', level: 'f' })
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const dyns = model.getDynamics(2)
    expect(dyns).toHaveLength(1)
    expect(dyns[0].level).toBe('f')
    expect(fracToNumber(dyns[0].beat)).toBe(2) // 3/4 bar still holds beat 2
  })

  it('moves a dynamic to the next bar when its beat overflows the new bar', () => {
    // beat 3 of a 4/4 measure → absolute offset 3 → second 3/4 bar, beat 0.
    model.addDynamic(1, { beat: frac(3, 1), kind: 'level', level: 'p' })
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(model.getDynamics(1)).toHaveLength(0)
    const moved = model.getDynamics(2)
    expect(moved).toHaveLength(1)
    expect(moved[0].level).toBe('p')
    expect(fracToNumber(moved[0].beat)).toBe(0)
  })

  it('re-anchors a mid-measure clef change across a rebar', () => {
    model.setClefAt(2, frac(2, 1), 'bass')
    expect(model.getMeasure(2)!.clefs).toHaveLength(1)
    model.setTimeSignature(2, { numerator: 3, denominator: 4 })
    const clefs = model.getMeasure(2)!.clefs!
    expect(clefs).toHaveLength(1)
    expect(clefs[0].clef).toBe('bass')
    expect(fracToNumber(clefs[0].beat)).toBe(2)
  })

  it('moves a clef change to the next bar when its beat overflows', () => {
    model.setClefAt(1, frac(3, 1), 'bass')
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    expect(model.getMeasure(1)!.clefs).toBeUndefined()
    const clefs = model.getMeasure(2)!.clefs!
    expect(clefs).toHaveLength(1)
    expect(clefs[0].clef).toBe('bass')
    expect(fracToNumber(clefs[0].beat)).toBe(0)
  })
})

describe('rebar preserves slurs (phrasing spans)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  // Fill measure 1's 4/4 bar with eighth notes C4 D4 E4 F4 G4 A4 B4 C5 (beats 0..3.5).
  const steps: Array<[NoteParams['step'], number]> = [
    ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5],
  ]
  const fillBar = () =>
    steps.map(([step, octave], i) =>
      model.addNote({ step, alter: 0, octave, duration: '8', measure: 1, beat: frac(i, 2) }),
    )

  it('re-attaches a slur to the rebar\'d notes across a time-signature change', () => {
    const notes = fillBar()
    const slur = model.addSlur({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // 4/4 content → two 3/4 bars

    const slurs = model.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0].id).toBe(slur.id) // same slur, re-anchored (not dropped)

    // Endpoints were regenerated, but now point at LIVE notes at the same pitch/onset.
    expect(slurs[0].startNoteId).not.toBe(notes[0].id)
    expect(slurs[0].endNoteId).not.toBe(notes[7].id)

    const start = model.getNote(slurs[0].startNoteId)
    const end = model.getNote(slurs[0].endNoteId)
    expect(start).toBeDefined()
    expect(end).toBeDefined()
    expect(start!.step).toBe('C')
    expect(start!.octave).toBe(4)
    expect(start!.measure).toBe(1)
    expect(fracToNumber(start!.beat)).toBe(0)
    expect(end!.step).toBe('C')
    expect(end!.octave).toBe(5)
    expect(end!.measure).toBe(2) // offset 3.5 lands in the second 3/4 bar...
    expect(fracToNumber(end!.beat)).toBe(0.5) // ...at beat 0.5
  })

  it('drops a slur whose anchor is overwritten by a paste (no dangling id)', () => {
    const notes = fillBar()
    model.addSlur({ startNoteId: notes[0].id, endNoteId: notes[7].id, voice: 0 })

    // Overwrite the whole bar with a single whole rest's worth of content via paste of
    // one note at beat 0; the slur's end anchor (C5 @3.5) no longer exists afterwards.
    model.pasteEvents(1, frac(0, 1), [{ voice: 0, events: [{ offset: frac(0, 1), duration: frac(4, 1), pitches: [{ step: 'G', alter: 0, octave: 4 }] }] }], frac(4, 1), 0)

    // Whatever the outcome, no slur may reference a missing note.
    const ids = new Set<string>()
    for (const m of model.getScore().measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    }
    for (const sl of model.getSlurs()) {
      expect(ids.has(sl.startNoteId)).toBe(true)
      expect(ids.has(sl.endNoteId)).toBe(true)
    }
  })
})

// ===========================================================================
// Multi-voice rebar — a TS change / paste must not erase a secondary voice
// (docs/multivoice-rebar-plan.md, P1)
// ===========================================================================

describe('rebar preserves secondary voices', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    model.addMeasure()
  })

  const voiceNotes = (m: number, v: number) =>
    model.getNotesInMeasure(m).filter(n => (n.voice ?? 0) === v && !n.isRest)

  it('keeps both voices across a time-signature change (4/4 → 3/4)', () => {
    // V1: four quarters C4 D4 E4 F4. V2: two half notes G3 B3.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })
    model.addNote({ step: 'B', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(2, 1), voice: 1 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 }) // 4 quarters → two 3/4 bars

    // Both voices survive, re-barred across the moved barline.
    const v0 = [...voiceNotes(1, 0), ...voiceNotes(2, 0)]
    const v1 = [...voiceNotes(1, 1), ...voiceNotes(2, 1)]
    expect(v0.map(n => n.step)).toEqual(['C', 'D', 'E', 'F'])
    // V2's second half note (beat 2–4) crosses the moved 3/4 barline → split + tied.
    expect(v1.map(n => n.step)).toEqual(['G', 'B', 'B'])
    expect(v1.every(n => n.voice === 1)).toBe(true) // voice tag intact
    expect(v1[1].tiedTo).toBeDefined() // the B is tied across the barline

    // Each bar tiles exactly (no overflow / gap in either voice).
    expect(model.validateMeasure(1)).toEqual([])
    expect(model.validateMeasure(2)).toEqual([])
  })

  it('keeps both voices when a TS change is removed', () => {
    model.setTimeSignature(2, { numerator: 3, denominator: 4 }) // explicit change at m2
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(1, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 2, beat: frac(0, 1), voice: 1 })

    model.removeTimeSignatureChange(2) // 3/4 → inherited 4/4

    expect(voiceNotes(2, 0).map(n => n.step)).toEqual(['C', 'D'])
    const v1 = voiceNotes(2, 1)
    expect(v1.map(n => n.step)).toEqual(['G'])
    expect(v1[0].voice).toBe(1)
    expect(model.validateMeasure(2)).toEqual([])
  })

  it('survives a paste into voice 0 of a two-voice bar (voice 2 untouched)', () => {
    // V1 quarters, V2 a half note in m1.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 3, duration: 'h', measure: 1, beat: frac(0, 1), voice: 1 })

    // Paste a single quarter at beat 0 of voice 0.
    model.pasteEvents(1, frac(0, 1), [{ voice: 0, events: [{ offset: frac(0, 1), duration: frac(1, 1), pitches: [{ step: 'A', alter: 0, octave: 4 }] }] }], frac(1, 1), 0)

    // Voice 2's half note is still there, still tagged voice 1.
    const v1 = voiceNotes(1, 1)
    expect(v1.map(n => n.step)).toEqual(['G'])
    expect(v1[0].voice).toBe(1)
    // Voice 0 got the pasted A4 at beat 0.
    expect(voiceNotes(1, 0).find(n => fracToNumber(n.beat) === 0)?.step).toBe('A')
    expect(model.validateMeasure(1)).toEqual([])
  })

  it('does not inject phantom rests into voice 1 when voice 0 has a tuplet', () => {
    // Voice 0: an eighth-note triplet at beat 0. Voice 1: four quarters filling 4/4.
    // Regression: flattenRegion used to emit a voice-0 tuplet as a phantom atomic
    // into voice 1's stream, corrupting the re-lay (extra leading rests).
    const tuplet = model.createTuplet(1, frac(0, 1), '8', 3, 2)
    model.refillTupletRemainder(1, tuplet)
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1), voice: 1 })
    model.addNote({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })

    model.setTimeSignature(1, { numerator: 2, denominator: 4 }) // 4 quarters → two 2/4 bars

    // Voice 1 keeps exactly its four quarters across the two bars — no phantom rests.
    const v1 = [...voiceNotes(1, 1), ...voiceNotes(2, 1)]
    expect(v1.map(n => n.step)).toEqual(['C', 'D', 'E', 'F'])
    expect(v1.every(n => n.voice === 1)).toBe(true)
    // The voice-0 tuplet stays atomic in bar 1 (not duplicated into voice 1).
    expect(model.getMeasure(1)!.tuplets).toHaveLength(1)
    expect(model.validateMeasure(1)).toEqual([])
    expect(model.validateMeasure(2)).toEqual([])
  })
})

describe('rebar voice-scopes ties and slurs (P2)', () => {
  let model: ScoreModel
  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
  })

  it('re-attaches boundary ties to the right voice when both voices are a unison at the edge', () => {
    // m1 (external): C4 in voice 0 AND C4 in voice 1, both at the last beat.
    const a0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    const a1 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 })
    // m2 (the region we re-bar): a unison C4 in both voices at beat 0.
    model.addMeasure()
    const b0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    const b1 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), voice: 1 })
    model.updateNote(a0.id, { tiedTo: b0.id })
    model.updateNote(b0.id, { tiedFrom: a0.id })
    model.updateNote(a1.id, { tiedTo: b1.id })
    model.updateNote(b1.id, { tiedFrom: a1.id })

    model.setTimeSignature(2, { numerator: 3, denominator: 4 }) // re-bars m2 → b0/b1 get new ids

    // Each external tie re-attaches WITHIN its own voice (not stolen by the unison).
    const t0 = model.getNote(model.getNote(a0.id)!.tiedTo!)
    const t1 = model.getNote(model.getNote(a1.id)!.tiedTo!)
    expect(t0).toBeTruthy()
    expect(t1).toBeTruthy()
    expect(t0!.voice ?? 0).toBe(0)
    expect(t1!.voice).toBe(1)
    expect(t0!.id).not.toBe(t1!.id) // distinct targets, one per voice
  })

  it('keeps a voice-2 slur on its own voice when voice 0 is a unison at the same beats', () => {
    // Voice 0 and voice 1 share pitch+beat columns (C4@0, D4@1). The slur is voice 1.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const s0 = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const s1 = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const slur = model.addSlur({ startNoteId: s0.id, endNoteId: s1.id, voice: 1 })

    model.setTimeSignature(1, { numerator: 3, denominator: 4 })

    const slurs = model.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0].id).toBe(slur.id)
    expect(slurs[0].voice).toBe(1)
    // Both re-anchored endpoints land on voice-1 notes (not the voice-0 unison).
    const start = model.getNote(slurs[0].startNoteId)!
    const end = model.getNote(slurs[0].endNoteId)!
    expect(start.voice).toBe(1)
    expect(end.voice).toBe(1)
    expect(start.step).toBe('C')
    expect(end.step).toBe('D')
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

  it('pushes the next TS change forward instead of cramming the bounded region (repro)', () => {
    // m1 & m2 each filled with 16 sixteenth-notes in 4/4 (4 beats each).
    model.addMeasure() // measure 2
    for (const m of [1, 2]) {
      for (let k = 0; k < 16; k++) {
        model.addNote({ step: 'C', alter: 0, octave: 4, duration: '16', measure: m, beat: frac(k, 4) })
      }
    }
    // 5/8 at measure 2 → its 16 sixteenths grow to m2+m3 (10 + 6), m2 carries the change.
    model.setTimeSignature(2, ts(5, 8))
    expect(model.getMeasure(2)!.timeSignatureChange).toBe(true)

    // 2/4 at measure 1 → its 16 sixteenths need TWO 2/4 bars; rather than cram them
    // into a single bounded bar, a bar is inserted and the 5/8 change is PUSHED to m3.
    model.setTimeSignature(1, ts(2, 4))

    expect(model.getMeasure(1)!.timeSignature).toEqual(ts(2, 4))
    expect(model.getMeasure(2)!.timeSignature).toEqual(ts(2, 4))
    expect(model.getMeasure(2)!.timeSignatureChange).toBeFalsy() // continuation bar
    expect(model.getMeasure(3)!.timeSignature).toEqual(ts(5, 8))
    expect(model.getMeasure(3)!.timeSignatureChange).toBe(true) // change pushed here

    // Each 2/4 bar holds exactly 8 sixteenths (no cram); two quarters of length each.
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord')).toHaveLength(8)
    expect(slotsOf(model, 2).filter((s) => s.type === 'chord')).toHaveLength(8)
    expect(totalLen(model, 1)).toBe(2)
    expect(totalLen(model, 2)).toBe(2)
    // No note lost: the 32 sixteenths still span the score.
    const chordCount = model.getScore().measures.reduce(
      (n, m) => n + m.slots.filter((s) => s.type === 'chord').length, 0)
    expect(chordCount).toBe(32)
  })

  it('shrink case keeps freed bars as trailing rests and leaves the next change unmoved', () => {
    model.addMeasure(); model.addMeasure() // m1, m2, m3 (all 4/4)
    model.setTimeSignature(3, ts(3, 4)) // explicit change pins region [m1,m2]
    model.setTimeSignature(1, ts(2, 4)) // m1, m2 → 2/4
    // Two quarters exactly fill ONE 2/4 bar.
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Widen to 4/4: the content now fits in a single bar, freeing measure 2.
    model.setTimeSignature(1, ts(4, 4))
    expect(model.getScore().measures).toHaveLength(3) // no bars added or removed
    expect(slotsOf(model, 1).filter((s) => s.type === 'chord')).toHaveLength(2)
    expect(slotsOf(model, 2).every((s) => s.type === 'rest')).toBe(true) // kept as a rest bar
    // The next explicit change is untouched (not pulled earlier).
    expect(model.getMeasure(3)!.timeSignature).toEqual(ts(3, 4))
    expect(model.getMeasure(3)!.timeSignatureChange).toBe(true)
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

  it('a voice-0 tuplet does not block rest-fill in another voice', () => {
    const model = new ScoreModel('V', 120)
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
    const model = new ScoreModel('V', 120)
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

describe('ScoreModel.moveNoteToVoice — Phase 1 (plain notes)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV', 120) })

  const v = (s: ChordRest) => s.voice ?? 0
  const total = (slots: ChordRest[]) =>
    slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)

  it('moves a plain note into another voice, keeping its pitch id', () => {
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(model.moveNoteToVoice(note.id, 1)).toBe(true)

    const slots = slotsOf(model, 1)
    const v1Chords = slots.filter(s => s.type === 'chord' && v(s) === 1)
    expect(v1Chords).toHaveLength(1)
    expect((v1Chords[0] as any).notes[0].id).toBe(note.id) // SAME id (the spine)
    expect(fracToNumber(v1Chords[0].beat)).toBe(0)

    // Source voice 0 left with rests only; both voices still sum to the bar.
    const v0 = slots.filter(s => v(s) === 0)
    expect(v0.every(s => s.type === 'rest')).toBe(true)
    expect(total(v0)).toBeCloseTo(4, 5)
    expect(total(slots.filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })

  it('collapses the source secondary voice when its last note leaves', () => {
    const note = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    expect(model.moveNoteToVoice(note.id, 0)).toBe(true)

    const slots = slotsOf(model, 1)
    expect(slots.some(s => v(s) === 1)).toBe(false) // voice 1 collapsed away
    const moved = slots.find(s => s.type === 'chord') as any
    expect(moved.notes[0].id).toBe(note.id)
    expect(v(moved)).toBe(0)
  })

  it('is a no-op (returns false) when the note is already in the target voice', () => {
    const note = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(model.moveNoteToVoice(note.id, 0)).toBe(false)
  })

  it('moves just one pitch out of a chord, leaving the others behind', () => {
    const c = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const g = model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(g.id, 1)).toBe(true)

    const slots = slotsOf(model, 1)
    const v0Chord = slots.find(s => s.type === 'chord' && v(s) === 0) as any
    expect(v0Chord.notes.map((n: any) => n.id).sort()).toEqual([c.id, e.id].sort())
    const v1Chord = slots.find(s => s.type === 'chord' && v(s) === 1) as any
    expect(v1Chord.notes).toHaveLength(1)
    expect(v1Chord.notes[0].id).toBe(g.id)
  })

  it('drops a tie whose partner stays behind (both reciprocal sides cleared)', () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    model.updateNote(a.id, { tiedTo: b.id })
    model.updateNote(b.id, { tiedFrom: a.id })

    expect(model.moveNoteToVoice(a.id, 1)).toBe(true)

    expect(model.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(model.getNote(b.id)!.tiedFrom).toBeUndefined()
  })

  it('keeps a slur valid by preserving the moved note id', () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = model.addSlur({ startNoteId: a.id, endNoteId: b.id, voice: 0 })

    expect(model.moveNoteToVoice(a.id, 1)).toBe(true)

    const kept = model.getSlurs().find(s => s.id === slur.id)!
    expect(kept.startNoteId).toBe(a.id)
    expect(model.getNote(a.id)).toBeDefined() // anchor still resolves
  })

  it("syncs a slur's stored voice once BOTH its anchors have moved", () => {
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = model.addSlur({ startNoteId: a.id, endNoteId: b.id, voice: 0 })

    model.moveNoteToVoice(a.id, 1)
    // Only one anchor moved → slur spans two voices → stored field left as-is.
    expect(model.getSlurs().find(s => s.id === slur.id)!.voice ?? 0).toBe(0)

    model.moveNoteToVoice(b.id, 1)
    // Both anchors now in voice 1 → the slur adopts it.
    expect(model.getSlurs().find(s => s.id === slur.id)!.voice).toBe(1)
  })

  it('ignores a rest id (returns false)', () => {
    const rest = slotsOf(model, 1).find(s => s.type === 'rest')!
    expect(model.moveNoteToVoice(rest.id, 1)).toBe(false)
  })
})

describe('ScoreModel.moveNoteToVoice — Phase 2 (collision: shorter wins)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV', 120) })

  const v = (s: ChordRest) => s.voice ?? 0
  const total = (slots: ChordRest[]) =>
    slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
  const v1ChordAt = (beat: number) =>
    slotsOf(model, 1).find(s => s.type === 'chord' && v(s) === 1 && fracToNumber(s.beat) === beat) as any

  it('chords with target when both share a beat; keeps the EXISTING shorter duration', () => {
    // Target voice 1 has a quarter at beat 1; move a voice-0 HALF onto it.
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const half = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(1, 1) })

    expect(model.moveNoteToVoice(half.id, 1)).toBe(true)

    const chord = v1ChordAt(1)
    expect(chord.notes).toHaveLength(2)                 // chorded
    expect(chord.notes.map((n: any) => n.id)).toContain(half.id)
    expect(chord.duration).toBe('q')                    // quarter (shorter) wins, half's extra length discarded
    expect(total(slotsOf(model, 1).filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })

  it('adopts the INCOMING shorter duration and rest-fills the freed time', () => {
    // Target voice 1 has a quarter at beat 0; move a voice-0 EIGHTH onto it.
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const eighth = model.addNote({ step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(eighth.id, 1)).toBe(true)

    const chord = v1ChordAt(0)
    expect(chord.notes).toHaveLength(2)
    expect(chord.duration).toBe('8')                    // eighth (shorter) wins
    // Freed half-beat is now a voice-1 rest; the voice still sums to a full bar.
    const v1 = slotsOf(model, 1).filter(s => v(s) === 1)
    expect(v1.some(s => s.type === 'rest' && fracToNumber(s.beat) === 0.5)).toBe(true)
    expect(total(v1)).toBeCloseTo(4, 5)
  })

  it('equal durations just chord together, no extra rests', () => {
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    const q = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })

    expect(model.moveNoteToVoice(q.id, 1)).toBe(true)

    const chord = v1ChordAt(0)
    expect(chord.notes).toHaveLength(2)
    expect(chord.duration).toBe('q')
    expect(total(slotsOf(model, 1).filter(s => v(s) === 1))).toBeCloseTo(4, 5)
  })
})

describe('ScoreModel.moveNoteToVoice — Phase 4 (tuplets, ordinal fill)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('MV', 120) })

  const v = (s: ChordRest) => s.voice ?? 0
  const tupletChords = (voice: number) =>
    slotsOf(model, 1).filter(s => s.type === 'chord' && v(s) === voice && s.tupletId) as any[]

  /** Build a full eighth-triplet (3 notes) in `voice` at beat 0; returns the 3 pitch ids. */
  function buildTriplet(voice: number, steps: Array<{ step: string; octave: number }>): string[] {
    const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, voice)
    const slot = frac(1, 3) // actual spacing of an eighth-triplet slot
    return steps.map((st, i) =>
      model.addNote({
        step: st.step as any, alter: 0, octave: st.octave,
        duration: '8', measure: 1, beat: frac(i, 3), voice: (voice || undefined) as any,
        tupletId: t.id, actualDuration: slot,
      }).id)
  }

  it('4a: moves a tuplet note into an empty voice → rest·B·rest, source A·rest·C', () => {
    const [a, b, c] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    // Voice 1: a triplet with B in slot 1, rests either side.
    const v1 = tupletChords(1)
    expect(v1).toHaveLength(1)
    expect(v1[0].notes[0].id).toBe(b)
    expect(fracToNumber(v1[0].beat)).toBeCloseTo(1 / 3, 5) // slot index 1 (actual spacing 1/3)
    expect(v1[0].duration).toBe('8')
    const v1Rests = slotsOf(model, 1).filter(s => v(s) === 1 && s.tupletId && s.type === 'rest')
    expect(v1Rests).toHaveLength(2)

    // Voice 0: A and C survive, B's slot is now a rest.
    const v0 = tupletChords(0)
    expect(v0.flatMap(ch => ch.notes.map((n: any) => n.id)).sort()).toEqual([a, c].sort())
    expect(model.getNote(a)!.voice ?? 0).toBe(0)
    expect(model.getNote(c)!.voice ?? 0).toBe(0)
    expect(model.getNote(b)!.voice).toBe(1)
  })

  it('4b: pours existing target-voice notes into the free slots → d·B·e', () => {
    const [, b] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])
    // Voice 1 already has two eighths d, e on beat 1's span.
    const d = model.addNote({ step: 'D', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1), voice: 1 })
    const e = model.addNote({ step: 'E', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(1, 2), voice: 1 })

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    const v1 = tupletChords(1).sort((x, y) => fracCompare(x.beat, y.beat))
    expect(v1).toHaveLength(3)                                  // d · B · e, all in the triplet
    expect(v1.map(ch => ch.notes[0].id)).toEqual([d.id, b, e.id])
    expect(v1.every(ch => ch.duration === '8')).toBe(true)     // all re-expressed as triplet eighths
    expect(v1.every(ch => !!ch.tupletId)).toBe(true)
  })

  it('4b overflow: extra target notes beyond the free slots are dropped', () => {
    const [, b] = buildTriplet(0, [{ step: 'A', octave: 4 }, { step: 'B', octave: 4 }, { step: 'C', octave: 5 }])
    // Voice 1 has FOUR sixteenths in beat 1's span — more than the 2 free slots.
    const ids = [0, 1, 2, 3].map(i =>
      model.addNote({ step: 'D', alter: 0, octave: 5, duration: '16', measure: 1, beat: frac(i, 4), voice: 1 }).id)

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([]) // no crash / no half-formed bar

    const v1 = tupletChords(1)
    expect(v1).toHaveLength(3)                  // 2 poured + the moved B; no rests, no overflow
    // The moved B is present; only the first two sixteenths survived.
    const survivors = v1.flatMap(ch => ch.notes.map((n: any) => n.id))
    expect(survivors).toContain(b)
    expect(survivors.filter(id => ids.includes(id))).toHaveLength(2)
  })

  it('a note already on a target grid slot keeps its slot when a second note arrives', () => {
    // Regression: moving G (slot 2) then E (slot 0) of a triplet into voice 1 must
    // give E·rest·G — G must NOT get re-poured down to slot 1.
    const [e, , g] = buildTriplet(0, [{ step: 'E', octave: 4 }, { step: 'F', octave: 4 }, { step: 'G', octave: 4 }])

    expect(model.moveNoteToVoice(g, 1)).toBe(true) // G → voice 1 slot 2
    expect(model.moveNoteToVoice(e, 1)).toBe(true) // E → voice 1 slot 0
    expect(model.validateMeasure(1)).toEqual([])

    const v1 = tupletChords(1).sort((x, y) => fracCompare(x.beat, y.beat))
    expect(v1).toHaveLength(2)
    expect(v1[0].notes[0].id).toBe(e)
    expect(fracToNumber(v1[0].beat)).toBeCloseTo(0, 5)        // E stayed at slot 0
    expect(v1[1].notes[0].id).toBe(g)
    expect(fracToNumber(v1[1].beat)).toBeCloseTo(2 / 3, 5)    // G stayed at slot 2 (NOT 1/3)
    // Voice 1 slot 1 is a rest; F is still alone in voice 0.
    expect(slotsOf(model, 1).some(s => v(s) === 1 && s.tupletId && s.type === 'rest'
      && fracToNumber(s.beat) === 1 / 3)).toBe(true)
  })

  it('drops the source tuplet when its last note leaves (becomes plain rests)', () => {
    // A triplet whose only note is B (slots 0 and 2 stay rests).
    const t = model.createTuplet(1, frac(0, 1), '8', 3, 2, 0)
    model.refillTupletRemainder(1, t, 0)
    const midRest = slotsOf(model, 1)
      .filter(s => s.tupletId === t.id && s.type === 'rest')
      .sort((a, b) => fracCompare(a.beat, b.beat))[1]
    const b = model.updateNote(midRest.id, { step: 'B', alter: 0, octave: 4, isRest: false }).id

    expect(model.moveNoteToVoice(b, 1)).toBe(true)
    expect(model.validateMeasure(1)).toEqual([])

    // Source voice 0 no longer has the tuplet; voice 1 has it.
    expect(slotsOf(model, 1).some(s => v(s) === 0 && s.tupletId)).toBe(false)
    expect(model.getMeasure(1)!.tuplets!.every(tup =>
      model.getMeasure(1)!.slots.some(s => s.tupletId === tup.id))).toBe(true) // no dangling tuplet
    expect(model.getNote(b)!.voice).toBe(1)
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

describe('ScoreModel JSON — time-signature validation', () => {
  /** Build a score JSON with the given per-measure meters. */
  function scoreJson(meters: Array<[number, number]>): string {
    return JSON.stringify({
      id: 'x', title: 't', tempo: 120,
      keySignature: { key: 'C', accidentals: 0 },
      defaultTimeSignature: { numerator: meters[0][0], denominator: meters[0][1] },
      measures: meters.map(([n, d], i) => ({
        id: `m${i + 1}`, number: i + 1, slots: [], tuplets: [],
        timeSignature: { numerator: n, denominator: d },
      })),
    })
  }

  it('rejects a non-dyadic default time signature on load', () => {
    expect(() => ScoreModel.fromJSON(scoreJson([[4, 3]]))).toThrow()
  })

  it('rejects a non-dyadic per-measure time signature on load', () => {
    expect(() => ScoreModel.fromJSON(scoreJson([[4, 4], [5, 3]]))).toThrow()
  })

  it('restores a non-4/4 measure-rest with the correct bar-length actualDuration', () => {
    const model = new ScoreModel('TS', 120)
    model.setTimeSignature(1, ts(3, 4))
    const restored = ScoreModel.fromJSON(model.toJSON())
    const mr = restored.getMeasure(1)!.slots.find((s) => s.type === 'rest' && s.isMeasureRest)!
    expect(fracToNumber(mr.actualDuration!)).toBe(3) // not 4 (the nominal 'w')
  })
})
