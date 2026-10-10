import { signs } from '@/testing/signs'
import { describe, it, expect } from 'vitest'
import type { PitchStep } from '@/types/music'
import { midiToSpelling, pitchToMidi, spellingToMidi } from './equalTemperament'

describe('equalTemperament', () => {

  describe('spellingToMidi', () => {
    it('converts middle C (C4) to MIDI 60', () => {
      expect(spellingToMidi('C', signs(0), 4)).toBe(60)
    })

    it('converts concert A (A4) to MIDI 69', () => {
      expect(spellingToMidi('A', signs(0), 4)).toBe(69)
    })

    it('converts C#4 to MIDI 61', () => {
      expect(spellingToMidi('C', signs(1), 4)).toBe(61)
    })

    it('converts Db4 to MIDI 61 (same as C#4)', () => {
      expect(spellingToMidi('D', signs(-1), 4)).toBe(61)
    })

    it('converts B3 to MIDI 59', () => {
      expect(spellingToMidi('B', signs(0), 3)).toBe(59)
    })

    it('converts C5 to MIDI 72', () => {
      expect(spellingToMidi('C', signs(0), 5)).toBe(72)
    })

    it('converts Bb4 to MIDI 70', () => {
      expect(spellingToMidi('B', signs(-1), 4)).toBe(70)
    })

    it('converts A#4 to MIDI 70 (same as Bb4)', () => {
      expect(spellingToMidi('A', signs(1), 4)).toBe(70)
    })

    it('converts G##4 (double-sharp) to MIDI 69', () => {
      expect(spellingToMidi('G', signs(2), 4)).toBe(69)
    })

    it('converts Abb4 (double-flat) to MIDI 67', () => {
      expect(spellingToMidi('A', signs(-2), 4)).toBe(67)
    })

    it('converts C0 to MIDI 12', () => {
      expect(spellingToMidi('C', signs(0), 0)).toBe(12)
    })

    it('converts all natural notes in octave 4 correctly', () => {
      expect(spellingToMidi('C', signs(0), 4)).toBe(60)
      expect(spellingToMidi('D', signs(0), 4)).toBe(62)
      expect(spellingToMidi('E', signs(0), 4)).toBe(64)
      expect(spellingToMidi('F', signs(0), 4)).toBe(65)
      expect(spellingToMidi('G', signs(0), 4)).toBe(67)
      expect(spellingToMidi('A', signs(0), 4)).toBe(69)
      expect(spellingToMidi('B', signs(0), 4)).toBe(71)
    })
  })

  describe('midiToSpelling', () => {
    it('converts middle C (MIDI 60) to C4', () => {
      expect(midiToSpelling(60)).toEqual({ step: 'C', octave: 4 })
    })

    it('converts concert A (MIDI 69) to A4', () => {
      expect(midiToSpelling(69)).toEqual({ step: 'A', octave: 4 })
    })

    it('converts MIDI 59 to B3', () => {
      expect(midiToSpelling(59)).toEqual({ step: 'B', octave: 3 })
    })

    it('converts MIDI 72 to C5', () => {
      expect(midiToSpelling(72)).toEqual({ step: 'C', octave: 5 })
    })

    // Black key — default (no hint) → sharp
    it('converts MIDI 61 with no hint to C#4', () => {
      expect(midiToSpelling(61)).toEqual({ step: 'C', alteration: ['sharp'], octave: 4 })
    })

    it('converts MIDI 61 with hint "#" to C#4', () => {
      expect(midiToSpelling(61, '#')).toEqual({ step: 'C', alteration: ['sharp'], octave: 4 })
    })

    it('converts MIDI 61 with hint "b" to Db4', () => {
      expect(midiToSpelling(61, 'b')).toEqual({ step: 'D', alteration: ['flat'], octave: 4 })
    })

    it('converts MIDI 70 with no hint to A#4', () => {
      expect(midiToSpelling(70)).toEqual({ step: 'A', alteration: ['sharp'], octave: 4 })
    })

    it('converts MIDI 70 with hint "b" to Bb4', () => {
      expect(midiToSpelling(70, 'b')).toEqual({ step: 'B', alteration: ['flat'], octave: 4 })
    })

    it('hint "n" on white key has no effect (still natural)', () => {
      expect(midiToSpelling(60, 'n')).toEqual({ step: 'C', octave: 4 })
    })

    it('hint "n" on black key defaults to sharp (n means no alteration on the key)', () => {
      expect(midiToSpelling(61, 'n')).toEqual({ step: 'C', alteration: ['sharp'], octave: 4 })
    })

    it('round-trips with spellingToMidi for all white keys in octave 4', () => {
      const whiteMidis = [60, 62, 64, 65, 67, 69, 71]
      for (const midi of whiteMidis) {
        const s = midiToSpelling(midi)
        expect(spellingToMidi(s.step, s.alteration, s.octave)).toBe(midi)
      }
    })

    it('round-trips with spellingToMidi for sharp black keys in octave 4', () => {
      const blackMidis = [61, 63, 66, 68, 70]
      for (const midi of blackMidis) {
        const s = midiToSpelling(midi, '#')
        expect(spellingToMidi(s.step, s.alteration, s.octave)).toBe(midi)
      }
    })

    it('round-trips with spellingToMidi for flat black keys in octave 4', () => {
      const blackMidis = [61, 63, 66, 68, 70]
      for (const midi of blackMidis) {
        const s = midiToSpelling(midi, 'b')
        expect(spellingToMidi(s.step, s.alteration, s.octave)).toBe(midi)
      }
    })
  })


  // -------------------------------------------------------------------------
  // ⚠️ In THIS tuning, two spellings can be one key — which is why "the same pitch?" is never asked
  // here (`utils/pitchOrder.samePitch` compares what is written).
  describe('enharmonics share a key', () => {
    const key = (step: PitchStep, alter: number, octave: number) => spellingToMidi(step, signs(alter), octave)
    it('C#4 = Db4, A#4 = Bb4, G##4 = A4', () => {
      expect(key('C', 1, 4)).toBe(key('D', -1, 4))
      expect(key('A', 1, 4)).toBe(key('B', -1, 4))
      expect(key('G', 2, 4)).toBe(key('A', 0, 4))
    })
    it('C4 ≠ C5, C#4 ≠ D4', () => {
      expect(key('C', 0, 4)).not.toBe(key('C', 0, 5))
      expect(key('C', 1, 4)).not.toBe(key('D', 0, 4))
    })
  })

})

/**
 * ⭐⭐ {@link pitchToMidi} — **the interpret step's own conversion, and the only 12-EDO step the
 * sound path is allowed to take** (docs/plans/playback-semantics-plan.md, 2026-08-20).
 *
 * It is `spellingToMidi` read off one object, so the arithmetic is covered above. What is
 * worth pinning here is the property that makes its POSITION matter: it is LOSSY, and what it loses
 * is the only thing a tuning system could have interpreted.
 */
describe('pitchToMidi', () => {
  it('is spellingToMidi, read off a PitchSpelling', () => {
    expect(pitchToMidi({ step: 'C', octave: 4 })).toBe(60)
    expect(pitchToMidi({ step: 'A', octave: 4 })).toBe(69)
    expect(pitchToMidi({ step: 'B', octave: 3 })).toBe(59)
  })

  it('🚨 COLLAPSES the enharmonic — which is why it must be the LAST step, never the schedule\'s', () => {
    // In meantone G♯ sounds LOWER than A♭; in Pythagorean, higher. Once both are 61 no later layer
    // can tell which was written (docs/how-it-works/tuning-systems-and-alteration.md).
    expect(pitchToMidi({ step: 'G', alteration: ['sharp'], octave: 4 })).toBe(68)
    expect(pitchToMidi({ step: 'A', alteration: ['flat'], octave: 4 })).toBe(68)
  })
})
