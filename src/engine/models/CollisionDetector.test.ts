import { describe, it, expect, beforeEach } from 'vitest'
import { CollisionDetector } from './CollisionDetector'
import type { Note, NoteParams, Measure } from '@/types/music'

describe('CollisionDetector', () => {
  let detector: CollisionDetector
  let measure: Measure

  beforeEach(() => {
    detector = new CollisionDetector()
    measure = {
      id: '1',
      number: 1,
      notes: [],
      timeSignature: { numerator: 4, denominator: 4 },
    }
  })

  describe('checkNoteCollision', () => {
    it('should not detect collision with empty notes list', () => {
      const newNote: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const result = detector.checkNoteCollision(newNote, [])
      expect(result.hasCollision).toBe(false)
    })

    it('should detect collision with same pitch and overlapping time', () => {
      const existingNote: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const newNote: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0.5, // Overlaps with existing note
      }

      const result = detector.checkNoteCollision(newNote, [existingNote])
      expect(result.hasCollision).toBe(true)
      expect(result.collidingNotes).toContain('1')
    })

    it('should not detect collision with different pitch', () => {
      const existingNote: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const newNote: NoteParams = {
        pitch: 64, // Different pitch
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const result = detector.checkNoteCollision(newNote, [existingNote])
      expect(result.hasCollision).toBe(false)
    })

    it('should not detect collision with non-overlapping time', () => {
      const existingNote: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const newNote: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 1, // Starts after existing note ends
      }

      const result = detector.checkNoteCollision(newNote, [existingNote])
      expect(result.hasCollision).toBe(false)
    })

    it('should detect collision when new note encompasses existing note', () => {
      const existingNote: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 1,
      }

      const newNote: NoteParams = {
        pitch: 60,
        duration: 'w', // Whole note encompasses the quarter note
        measure: 1,
        beat: 0,
      }

      const result = detector.checkNoteCollision(newNote, [existingNote])
      expect(result.hasCollision).toBe(true)
    })

    it('should not detect collision in different measures', () => {
      const existingNote: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const newNote: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 2, // Different measure
        beat: 0,
      }

      const result = detector.checkNoteCollision(newNote, [existingNote])
      expect(result.hasCollision).toBe(false)
    })
  })

  describe('checkMeasureOverflow', () => {
    it('should not detect overflow for note that fits', () => {
      const note: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(false)
    })

    it('should detect overflow for note extending beyond measure', () => {
      const note: NoteParams = {
        pitch: 60,
        duration: 'w',
        measure: 1,
        beat: 2, // Whole note starting at beat 2 will overflow
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(true)
      expect(result.overflowAmount).toBe(2) // 4 beats - 2 beats available
      expect(result.suggestedMeasure).toBe(2)
    })

    it('should allow note at exact end of measure', () => {
      const note: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 3, // Quarter note at beat 3 ends exactly at 4
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(false)
    })
  })

  describe('findNextAvailablePosition', () => {
    it('should return 0 for empty measure', () => {
      const position = detector.findNextAvailablePosition('q', measure, [])
      expect(position).toBe(0)
    })

    it('should return position after existing note', () => {
      const existingNotes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
      ]

      const position = detector.findNextAvailablePosition('q', measure, existingNotes)
      expect(position).toBe(1)
    })

    it('should find gap between notes', () => {
      const existingNotes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
        {
          id: '2',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 2,
        },
      ]

      const position = detector.findNextAvailablePosition('q', measure, existingNotes)
      expect(position).toBe(1)
    })

    it('should return null when measure is full', () => {
      const existingNotes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'w',
          measure: 1,
          beat: 0,
        },
      ]

      const position = detector.findNextAvailablePosition('q', measure, existingNotes)
      expect(position).toBeNull()
    })

    it('should respect startFromBeat parameter', () => {
      const position = detector.findNextAvailablePosition('q', measure, [], 2)
      expect(position).toBe(2)
    })
  })

  describe('getAffectedNotes', () => {
    it('should return empty array for non-overlapping note', () => {
      const existingNotes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
      ]

      const newNote: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 2,
      }

      const affected = detector.getAffectedNotes(newNote, existingNotes)
      expect(affected).toHaveLength(0)
    })

    it('should return affected notes for overlapping position', () => {
      const existingNotes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
        {
          id: '2',
          pitch: 64,
          duration: 'q',
          measure: 1,
          beat: 0.5,
        },
      ]

      const newNote: NoteParams = {
        pitch: 67,
        duration: 'h',
        measure: 1,
        beat: 0,
      }

      const affected = detector.getAffectedNotes(newNote, existingNotes)
      expect(affected).toHaveLength(2)
    })
  })

  describe('getMeasureUsage', () => {
    it('should return zero usage for empty measure', () => {
      const usage = detector.getMeasureUsage(measure, [])
      expect(usage.used).toBe(0)
      expect(usage.available).toBe(4)
      expect(usage.percentage).toBe(0)
    })

    it('should calculate usage correctly', () => {
      const notes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'h',
          measure: 1,
          beat: 0,
        },
      ]

      const usage = detector.getMeasureUsage(measure, notes)
      expect(usage.used).toBe(2)
      expect(usage.available).toBe(2)
      expect(usage.percentage).toBe(50)
    })

    it('should use maximum end position', () => {
      const notes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
        {
          id: '2',
          pitch: 64,
          duration: 'q',
          measure: 1,
          beat: 3,
        },
      ]

      const usage = detector.getMeasureUsage(measure, notes)
      expect(usage.used).toBe(4) // Second note ends at beat 4
    })
  })

  describe('validateMeasure', () => {
    it('should validate empty measure', () => {
      const result = detector.validateMeasure(measure, [])
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate measure with valid notes', () => {
      const notes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: 0,
        },
      ]

      const result = detector.validateMeasure(measure, notes)
      expect(result.isValid).toBe(true)
    })

    it('should detect overflow error', () => {
      const notes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'w',
          measure: 1,
          beat: 2,
        },
      ]

      const result = detector.validateMeasure(measure, notes)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect negative beat position', () => {
      const notes: Note[] = [
        {
          id: '1',
          pitch: 60,
          duration: 'q',
          measure: 1,
          beat: -1,
        },
      ]

      const result = detector.validateMeasure(measure, notes)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('negative'))).toBe(true)
    })
  })

  describe('quantizeNote', () => {
    it('should quantize note to nearest subdivision', () => {
      const note: NoteParams = {
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0.6,
      }

      const quantized = detector.quantizeNote(note, measure.timeSignature, 4)
      expect(quantized.beat).toBe(1) // Snapped to 1 (0.6 rounds to 1)
    })

    it('should clamp to measure boundaries', () => {
      const note: NoteParams = {
        pitch: 60,
        duration: 'h',
        measure: 1,
        beat: 3.5,
      }

      const quantized = detector.quantizeNote(note, measure.timeSignature, 4)
      expect(quantized.beat).toBeLessThanOrEqual(2) // Can't start past beat 2 with half note
    })
  })
})
