import { describe, it, expect } from 'vitest'
import {
  durationToBeats,
  getMeasureDuration,
  midiToNoteName,
  calculateTotalDuration,
  measureCapacityFrac,
  measureCapacityQuarters,
  tupletMarkText,
  tupletBracketed,
} from './musicUtils'
import { fracCreate } from './fraction'
import type { TimeSignature, NoteDuration, Measure, TupletShape } from '@/types/music'

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
    const shape = (numNotes: number, notesOccupied: number, rest: Partial<TupletShape> = {}): TupletShape =>
      ({ numNotes, notesOccupied, baseDuration: '8', ...rest })

    // SMuFL tuplet digits, NOT ASCII: tuplet0..9 = U+E880 + d, tupletColon = U+E88A. Asserted by
    // codepoint because the characters are invisible in an editor — a stray ASCII '3' would look
    // identical here and render in the wrong face.
    it('writes a triplet as one SMuFL digit', () => {
      expect(tupletMarkText(shape(3, 2))).toBe('\uE883')
    })

    // The AUTO rule: a bare number, except when N is a power of two above 2. `4` and `8` can only be
    // borrowing from a ternary span and the reader cannot tell which (4:3 or 4:6), so those print in
    // full - while 6:4 and 7:4 do not, since 6 and 7 name their tuplet by convention.
    it('writes a bare number for every N that names its own tuplet', () => {
      expect(tupletMarkText(shape(5, 4))).toBe('\uE885')
      expect(tupletMarkText(shape(6, 4))).toBe('\uE886')
      expect(tupletMarkText(shape(7, 4))).toBe('\uE887')
      expect(tupletMarkText(shape(2, 3))).toBe('\uE882')
    })

    it('writes the ratio when N is a power of two above 2', () => {
      expect(tupletMarkText(shape(4, 3))).toBe('\uE884\uE88A\uE883')
      expect(tupletMarkText(shape(8, 6))).toBe('\uE888\uE88A\uE886')
    })

    it('carries digits past nine', () => {
      expect(tupletMarkText(shape(13, 8), 'ratio')).toBe('\uE881\uE883\uE88A\uE888')
      expect(tupletMarkText(shape(16, 12))).toBe('\uE881\uE886\uE88A\uE881\uE882')
    })

    // The style is the user's choice; absent is AUTO (the two cases above).
    it('obeys an explicit style over the automatic rule', () => {
      expect(tupletMarkText(shape(7, 4), 'number')).toBe('\uE887')
      expect(tupletMarkText(shape(3, 2), 'ratio')).toBe('\uE883\uE88A\uE882')
      expect(tupletMarkText(shape(3, 2), 'none')).toBe('')
    })

    // "Ratio + note" names the value the two printed figures are counting.
    it("adds the tuplet's own note value, dots included", () => {
      expect(tupletMarkText(shape(3, 2), 'ratioNote')).toBe('\uE883\uE88A\uE882♪')
      expect(tupletMarkText(shape(3, 2, { baseDuration: 'q', baseDots: 1 }), 'ratioNote'))
        .toBe('\uE883\uE88A\uE882♩.')
    })

    // DERIVED, not read off the model: the label is `span ÷ unit`, so a stored `notesOccupied` that
    // disagreed with the entry could not put a wrong number on the page.
    it('counts the WRITTEN note even when the stored number does not', () => {
      // "5 quarters in the time of 8 eighths" — eight eighths is four quarters, so the mark reads 5:4.
      const entered = shape(5, 4, { baseDuration: 'q', normalDuration: '8', normalCount: 8 })
      expect(tupletMarkText(entered, 'ratio')).toBe('\uE885\uE88A\uE884')
      // …and it stays 5:4 even if the stored figure is wrong, because nothing reads it.
      expect(tupletMarkText({ ...entered, notesOccupied: 99 }, 'ratio')).toBe('\uE885\uE88A\uE884')
    })

    // When the span is not a whole number of the written note, the ratio is quoted in the value the
    // user named — and "ratio + note" then prints THAT value, which is what makes it unambiguous.
    it('falls back to the entry\'s own value when the span is not whole units', () => {
      // "2 quarters in the time of 3 eighths" — one and a half quarters.
      const half = shape(2, 3, { baseDuration: 'q', normalDuration: '8', normalCount: 3 })
      expect(tupletMarkText(half, 'ratio')).toBe('\uE882\uE88A\uE883')
      expect(tupletMarkText(half, 'ratioNote')).toBe('\uE882\uE88A\uE883♪')
    })
  })

  describe('tupletBracketed', () => {
    // The rule for `auto` (and for a tuplet that stores nothing): the beam already says "one group",
    // so a bracket on top of it says it twice.
    it('brackets an unbeamed group and leaves a beamed one alone', () => {
      expect(tupletBracketed({}, false)).toBe(true)
      expect(tupletBracketed({}, true)).toBe(false)
      expect(tupletBracketed({ bracket: 'auto' }, true)).toBe(false)
    })

    it('obeys an explicit choice whatever the beam does', () => {
      expect(tupletBracketed({ bracket: 'always' }, true)).toBe(true)
      expect(tupletBracketed({ bracket: 'never' }, false)).toBe(false)
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
