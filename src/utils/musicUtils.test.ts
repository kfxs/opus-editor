import { describe, it, expect } from 'vitest'
import {
  durationToBeats,
  getMeasureDuration,
  midiToNoteName,
  calculateTotalDuration,
  measureCapacityFrac,
  measureCapacityQuarters,
  tupletMarkText,
  tupletMarkRuns,
  deriveTupletM,
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
      expect(tupletMarkText(shape(3, 2), 'ratioNote')).toBe('\uE883\uE88A\uE882\uECA7')
      expect(tupletMarkText(shape(3, 2, { baseDuration: 'q', baseDots: 1 }), 'ratioNote'))
        .toBe('\uE883\uE88A\uE882\uECA5\uECB7')
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
      expect(tupletMarkText(half, 'ratioNote')).toBe('\uE882\uE88A\uE883\uECA7')
    })
  })

  // "Entry ratio" prints the SENTENCE: each side's count with its own note value, where `ratio`
  // converts the second figure into the tuplet's written unit.
  describe('tupletMarkRuns — entry ratio', () => {
    it('quotes both sides in the values that were typed', () => {
      // "5 sixteenths in the time of 1 quarter": ratio says 5:4 (four sixteenths), entry says 5x:1q.
      const entered: TupletShape = {
        numNotes: 5, notesOccupied: 4, baseDuration: '16',
        normalDuration: 'q', normalCount: 1,
      }
      expect(tupletMarkText(entered, 'ratio')).toBe('\uE885\uE88A\uE884')
      // `space` is air the RENDERER measures \u2014 a music font's space character is next to nothing
      // wide. Everything after the first figure gets it: a value beside its count, and a colon that
      // has a glyph on its left rather than a digit.
      expect(tupletMarkRuns(entered, 'entryRatio')).toEqual([
        { text: '\uE885' },                               // 5
        { text: '\uECA9', glyph: true, space: true },     // metNote16thUp
        { text: '\uE88A', space: true },                  // tupletColon
        { text: '\uE881', space: true },                  // 1
        { text: '\uECA5', glyph: true, space: true },     // metNoteQuarterUp
      ])
    })

    it('falls back to the actual side when no entry was recorded', () => {
      // Both sides the same value — the sentence was "3 eighths in the time of 2 eighths".
      expect(tupletMarkText({ numNotes: 3, notesOccupied: 2, baseDuration: '8' }, 'entryRatio'))
        .toBe('\uE883\uECA7\uE88A\uE882\uECA7')
    })
  })

  // M comes from the METER, not from N: the same key means a different tuplet in a different bar.
  describe('deriveTupletM', () => {
    const simple: TimeSignature = { numerator: 4, denominator: 4 }
    const compound: TimeSignature = { numerator: 6, denominator: 8 }
    const bar0 = fracCreate(0, 1)
    const m = (n: number, meter: TimeSignature, unit: NoteDuration = '8') =>
      deriveTupletM(n, unit, 0, meter, bar0)

    it('borrows from the binary beat in simple meter', () => {
      expect(m(3, simple)).toBe(2)
      expect(m(5, simple)).toBe(4)
      expect(m(6, simple)).toBe(4)
      expect(m(7, simple)).toBe(4)
      expect(m(9, simple)).toBe(8)
    })

    it('borrows from the ternary beat in compound meter', () => {
      expect(m(4, compound)).toBe(3)
      expect(m(5, compound)).toBe(3)
      expect(m(7, compound)).toBe(6)
      expect(m(8, compound)).toBe(6)
    })

    it('STRETCHES for the duplet, the one case where M exceeds N', () => {
      expect(m(2, compound)).toBe(3)
    })

    it('declines when the meter has no tuplet of that N', () => {
      // 2:1 and 4:2 are not tuplets — the same notes at another value. And in 6/8 the eighths ARE
      // the triplet division, so a "3" of them is just three eighths.
      expect(m(2, simple)).toBeNull()
      expect(m(4, simple)).toBeNull()
      expect(m(8, simple)).toBeNull()
      expect(m(3, compound)).toBeNull()
      expect(m(6, compound)).toBeNull()
    })

    it('answers the same whatever the written value — the SPAN moves, not the ratio', () => {
      expect(m(5, simple, '16')).toBe(4)
      expect(m(5, simple, 'q')).toBe(4)
      expect(m(5, compound, '16')).toBe(3)
    })

    it('follows the GROUP inside an additive bar', () => {
      const sevenEight: TimeSignature = { numerator: 7, denominator: 8, grouping: [3, 2, 2] }
      // On the 3-group the beat is ternary; after it, binary — in the same bar.
      expect(deriveTupletM(2, '8', 0, sevenEight, fracCreate(0, 1))).toBe(3)
      expect(deriveTupletM(2, '8', 0, sevenEight, fracCreate(3, 2))).toBeNull()
      expect(deriveTupletM(3, '8', 0, sevenEight, fracCreate(3, 2))).toBe(2)
    })
  })

  // The AUTO mark: a bare number when the meter already says what it is in the time of.
  describe('tupletMarkText — the meter-aware auto style', () => {
    const at = (meter: TimeSignature) => ({ meter, beat: fracCreate(0, 1) })
    const duplet: TupletShape = { numNotes: 2, notesOccupied: 3, baseDuration: '8' }

    it('prints a bare number where the meter explains it', () => {
      // 6/8 knows what a "2" is: the duplet.
      expect(tupletMarkText(duplet, undefined, at({ numerator: 6, denominator: 8 }))).toBe('\uE882')
    })

    it('prints the ratio where it does not', () => {
      // The same tuplet in 4/4 is a borrowed span nobody can infer — so it is spelled out.
      expect(tupletMarkText(duplet, undefined, at({ numerator: 4, denominator: 4 }))).toBe('\uE882\uE88A\uE883')
    })

    it('leaves the triplet bare in simple meter and spells the quadruplet', () => {
      const c = at({ numerator: 4, denominator: 4 })
      expect(tupletMarkText({ numNotes: 3, notesOccupied: 2, baseDuration: '8' }, undefined, c)).toBe('\uE883')
      expect(tupletMarkText({ numNotes: 4, notesOccupied: 3, baseDuration: '8' }, undefined, c)).toBe('\uE884\uE88A\uE883')
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
