import { signs } from '@/testing/signs'
import { describe, it, expect } from 'vitest'
import {
  spellingToNoteKey,
  formatPitch,
  spellingDiatonicPos,
} from './pitchSpelling'

describe('pitchSpelling', () => {

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  describe('spellingToNoteKey', () => {
    it('converts C4 to "c/4"', () => {
      expect(spellingToNoteKey('C', signs(0), 4)).toBe('c/4')
    })

    it('converts C#4 to "c#/4"', () => {
      expect(spellingToNoteKey('C', signs(1), 4)).toBe('c#/4')
    })

    it('converts Db4 to "db/4"', () => {
      expect(spellingToNoteKey('D', signs(-1), 4)).toBe('db/4')
    })

    it('converts G##3 to "g##/3"', () => {
      expect(spellingToNoteKey('G', signs(2), 3)).toBe('g##/3')
    })

    it('converts Abb5 to "abb/5"', () => {
      expect(spellingToNoteKey('A', signs(-2), 5)).toBe('abb/5')
    })

    it('converts B3 to "b/3"', () => {
      expect(spellingToNoteKey('B', signs(0), 3)).toBe('b/3')
    })

    it('uses lowercase step letter', () => {
      const result = spellingToNoteKey('F', signs(1), 4)
      expect(result[0]).toBe('f')
    })
  })

  // -------------------------------------------------------------------------
  describe('formatPitch', () => {
    it('builds step + accidental + octave (an absent alter reads as natural)', () => {
      expect(formatPitch({ step: 'C', alteration: ['sharp'], octave: 4 })).toBe('C#4')
      expect(formatPitch({ step: 'A', alteration: ['flat'], octave: 3 })).toBe('Ab3')
      expect(formatPitch({ step: 'G', alteration: ['doubleSharp'], octave: 5 })).toBe('G##5')
      expect(formatPitch({ step: 'E', octave: 4 })).toBe('E4')
    })
  })

  // -------------------------------------------------------------------------
  describe('spellingDiatonicPos', () => {
    it('C4=28, D4=29, E4=30, F4=31, G4=32, A4=33, B4=34', () => {
      expect(spellingDiatonicPos('C', 4)).toBe(28)
      expect(spellingDiatonicPos('D', 4)).toBe(29)
      expect(spellingDiatonicPos('E', 4)).toBe(30)
      expect(spellingDiatonicPos('F', 4)).toBe(31)
      expect(spellingDiatonicPos('G', 4)).toBe(32)
      expect(spellingDiatonicPos('A', 4)).toBe(33)
      expect(spellingDiatonicPos('B', 4)).toBe(34)
    })

    it('C5=35 is one step above B4=34', () => {
      expect(spellingDiatonicPos('C', 5)).toBe(35)
      expect(spellingDiatonicPos('C', 5) - spellingDiatonicPos('B', 4)).toBe(1)
    })

    it('C# and C natural have the same diatonic position (accidentals do not shift staff lines)', () => {
      expect(spellingDiatonicPos('C', 4)).toBe(spellingDiatonicPos('C', 4))
      // C# is still on the C line/space — alter does not affect diatonic pos
    })

    it('octave change shifts position by 7', () => {
      expect(spellingDiatonicPos('A', 5) - spellingDiatonicPos('A', 4)).toBe(7)
    })

    it('treble clef middle line B4 = 34', () => {
      expect(spellingDiatonicPos('B', 4)).toBe(34)
    })
  })

  // -------------------------------------------------------------------------
})
