import { describe, it, expect } from 'vitest'
import {
  durationToBeats,
  getMeasureDuration,
  midiToNoteName,
  calculateTotalDuration,
  measureCapacityFrac,
  measureCapacityQuarters,
  tupletMarkText,
} from './musicUtils'
import { fracCreate } from './fraction'
import type { TimeSignature, NoteDuration, Measure } from '@/types/music'

describe('musicUtils', () => {
  describe('durationToBeats', () => {
    it('should convert whole note to 4 beats', () => {
      expect(durationToBeats('w')).toBe(4)
    })

    it('should convert half note to 2 beats', () => {
      expect(durationToBeats('h')).toBe(2)
    })

    it('should convert quarter note to 1 beat', () => {
      expect(durationToBeats('q')).toBe(1)
    })

    it('should convert eighth note to 0.5 beats', () => {
      expect(durationToBeats('8')).toBe(0.5)
    })

    it('should convert sixteenth note to 0.25 beats', () => {
      expect(durationToBeats('16')).toBe(0.25)
    })

    it('should convert thirty-second note to 0.125 beats', () => {
      expect(durationToBeats('32')).toBe(0.125)
    })
  })

  describe('tupletMarkText', () => {
    // SMuFL tuplet digits, NOT ASCII: tuplet0..9 = U+E880 + d, tupletColon = U+E88A. Asserted by
    // codepoint because the characters are invisible in an editor — a stray ASCII '3' would look
    // identical here and render in the wrong face.
    it('writes a triplet as one SMuFL digit', () => {
      expect(tupletMarkText(3, 2)).toBe('\uE883')
    })

    it('writes the ratio when the counts differ by more than one', () => {
      expect(tupletMarkText(7, 4)).toBe('\uE887\uE88A\uE884')
    })

    it('carries digits past nine', () => {
      expect(tupletMarkText(13, 8)).toBe('\uE881\uE883\uE88A\uE888')
    })
  })

  describe('getMeasureDuration', () => {
    it('should calculate 4/4 time signature as 4 beats', () => {
      const ts: TimeSignature = { numerator: 4, denominator: 4 }
      expect(getMeasureDuration(ts)).toBe(4)
    })

    it('should calculate 3/4 time signature as 3 beats', () => {
      const ts: TimeSignature = { numerator: 3, denominator: 4 }
      expect(getMeasureDuration(ts)).toBe(3)
    })

    it('should calculate 6/8 time signature as 3 beats', () => {
      const ts: TimeSignature = { numerator: 6, denominator: 8 }
      expect(getMeasureDuration(ts)).toBe(3)
    })

    it('should calculate 2/2 time signature as 4 beats', () => {
      const ts: TimeSignature = { numerator: 2, denominator: 2 }
      expect(getMeasureDuration(ts)).toBe(4)
    })
  })

  describe('midiToNoteName', () => {
    it('should convert MIDI 60 to C4', () => {
      expect(midiToNoteName(60)).toBe('C4')
    })

    it('should convert MIDI 69 to A4', () => {
      expect(midiToNoteName(69)).toBe('A4')
    })

    it('should convert MIDI 21 to A0', () => {
      expect(midiToNoteName(21)).toBe('A0')
    })

    it('should convert MIDI 108 to C8', () => {
      expect(midiToNoteName(108)).toBe('C8')
    })

    it('should handle sharps correctly', () => {
      expect(midiToNoteName(61)).toBe('C#4')
      expect(midiToNoteName(66)).toBe('F#4')
    })
  })

  describe('calculateTotalDuration', () => {
    it('should calculate total duration of notes', () => {
      const notes = [
        { duration: 'q' as NoteDuration },
        { duration: 'q' as NoteDuration },
        { duration: 'h' as NoteDuration },
      ]
      expect(calculateTotalDuration(notes)).toBe(4)
    })

    it('should return 0 for empty array', () => {
      expect(calculateTotalDuration([])).toBe(0)
    })
  })

  describe('measureCapacity (pickup-aware bar length)', () => {
    const bar = (ts: TimeSignature, override?: { num: number; den: number }): Measure => ({
      id: 'm', number: 1, slots: [], tuplets: [], timeSignature: ts,
      ...(override ? { actualDurationOverride: fracCreate(override.num, override.den) } : {}),
    })

    it('uses the nominal time-signature length when there is no override', () => {
      expect(measureCapacityQuarters(bar({ numerator: 4, denominator: 4 }))).toBe(4)
      expect(measureCapacityQuarters(bar({ numerator: 6, denominator: 8 }))).toBe(3)
      expect(measureCapacityFrac(bar({ numerator: 7, denominator: 8 }))).toEqual(fracCreate(7, 2))
    })

    it('uses the override when present (a 1-beat pickup in 4/4)', () => {
      const pickup = bar({ numerator: 4, denominator: 4 }, { num: 1, den: 1 })
      expect(measureCapacityQuarters(pickup)).toBe(1)
      expect(measureCapacityFrac(pickup)).toEqual(fracCreate(1, 1))
    })
  })
})
