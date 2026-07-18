import { describe, it, expect, beforeEach } from 'vitest'
import { CollisionDetector } from './CollisionDetector'
import type { NoteParams, Measure } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

// Helpers for common note pitches used throughout
const C4: Pick<NoteParams, 'step' | 'alter' | 'octave'> = { step: 'C', alter: 0, octave: 4 }

describe('CollisionDetector', () => {
  let detector: CollisionDetector
  let measure: Measure

  beforeEach(() => {
    detector = new CollisionDetector()
    measure = {
      id: '1',
      number: 1,
      slots: [],
      timeSignature: { numerator: 4, denominator: 4 },
      tuplets: [],
    }
  })

  describe('checkMeasureOverflow', () => {
    it('should not detect overflow for note that fits', () => {
      const note: NoteParams = {
        ...C4,
        duration: 'q',
        measure: 1,
        beat: frac(0, 1),
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(false)
    })

    it('should detect overflow for note extending beyond measure', () => {
      const note: NoteParams = {
        ...C4,
        duration: 'w',
        measure: 1,
        beat: frac(2, 1), // Whole note starting at beat 2 will overflow
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(true)
      expect(result.overflowAmount).toBe(2) // 4 beats - 2 beats available
      expect(result.suggestedMeasure).toBe(2)
    })

    it('should allow note at exact end of measure', () => {
      const note: NoteParams = {
        ...C4,
        duration: 'q',
        measure: 1,
        beat: frac(3, 1), // Quarter note at beat 3 ends exactly at 4
      }

      const result = detector.checkMeasureOverflow(note, measure, [])
      expect(result.willOverflow).toBe(false)
    })
  })
})
