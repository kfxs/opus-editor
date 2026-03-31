import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import type { NoteParams } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

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
      pitch: 60,
      duration: 'q',
      measure: 1,
      beat: frac(0, 1),
    }

    it('should add a note to a measure', () => {
      const note = model.addNote(noteParams)
      expect(note.pitch).toBe(60)
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

    it('should throw error for invalid pitch', () => {
      expect(() =>
        model.addNote({ ...noteParams, pitch: 200 })
      ).toThrow('Pitch must be between 0 and 127')
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
      model.updateNote(note.id, { pitch: 64, duration: 'h' })

      const updated = model.getNote(note.id)
      expect(updated?.pitch).toBe(64)
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
      model.addNote({ pitch: 60, duration: 'q', measure: 1, beat: frac(0, 1) })
      const json = model.toJSON()

      expect(json).toContain('"title": "Test Score"')
      expect(json).toContain('"tempo": 120')
      expect(json).toContain('"pitch": 60')
    })

    it('should deserialize score from JSON', () => {
      model.addNote({ pitch: 60, duration: 'q', measure: 1, beat: frac(0, 1) })
      const json = model.toJSON()

      const loaded = ScoreModel.fromJSON(json)
      expect(loaded.getScore().title).toBe('Test Score')
      expect(loaded.getScore().tempo).toBe(120)
      const actualNotes = loaded.getAllNotes().filter(n => !n.isRest)
      expect(actualNotes).toHaveLength(1)
    })
  })
})
