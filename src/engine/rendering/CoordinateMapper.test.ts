import { describe, it, expect, beforeEach } from 'vitest'
import { CoordinateMapper } from './CoordinateMapper'
import type { Note } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { getMeasureDuration } from '@/utils/musicUtils'

describe('CoordinateMapper', () => {
  let mapper: CoordinateMapper

  beforeEach(() => {
    mapper = new CoordinateMapper({
      measureWidth: 500,
      staffHeight: 150,
      startX: 10,
      startY: 40,
      measuresPerLine: 2,
      lineSpacing: 10,
      measureLeftMargin: 100,
    })
  })

  describe('getMeasurePosition', () => {
    it('should return position for first measure', () => {
      const pos = mapper.getMeasurePosition(1)
      expect(pos).toEqual({ x: 10, y: 40 })
    })

    it('should return position for second measure on same line', () => {
      const pos = mapper.getMeasurePosition(2)
      expect(pos).toEqual({ x: 510, y: 40 })
    })

    it('should return position for third measure on second line', () => {
      const pos = mapper.getMeasurePosition(3)
      expect(pos).toEqual({ x: 10, y: 190 })
    })

    it('should handle multiple lines correctly', () => {
      const pos = mapper.getMeasurePosition(5)
      expect(pos).toEqual({ x: 10, y: 340 })
    })
  })

  describe('beatToPixelX', () => {
    it('should convert beat 0 to start of usable measure space', () => {
      const x = mapper.beatToPixelX(0, 1, 4)
      expect(x).toBe(110) // startX + leftMargin
    })

    it('should convert beat 2 in 4/4 time to middle of measure', () => {
      const x = mapper.beatToPixelX(2, 1, 4)
      const expectedX = 110 + (380 / 4) * 2 // leftMargin + half of usable width
      expect(x).toBeCloseTo(expectedX, 1)
    })

    it('should handle fractional beats', () => {
      const x = mapper.beatToPixelX(0.5, 1, 4)
      const expectedX = 110 + (380 / 4) * 0.5
      expect(x).toBeCloseTo(expectedX, 1)
    })
  })

  describe('pitchToPixelY', () => {
    it('should return correct Y for middle C (C4)', () => {
      const y = mapper.pitchToPixelY('C', 0, 4, 1)
      // C4: dPos=28, staffLine=(38-28)/2=5.0
      // y = startY + (5.0 * 10) + (4 * 10) = 40 + 50 + 40 = 130
      expect(y).toBe(130)
    })

    it('should return lower Y for higher pitch', () => {
      const yC = mapper.pitchToPixelY('C', 0, 4, 1)
      const yE = mapper.pitchToPixelY('E', 0, 4, 1)
      expect(yE).toBeLessThan(yC) // Higher pitch = lower on screen
    })

    it('should return higher Y for lower pitch', () => {
      const yC = mapper.pitchToPixelY('C', 0, 4, 1)
      const yG = mapper.pitchToPixelY('G', 0, 3, 1)
      expect(yG).toBeGreaterThan(yC) // Lower pitch = higher on screen
    })
  })

  describe('noteToPixel', () => {
    it('should convert note to pixel coordinates', () => {
      const note: Note = {
        id: '1',
        step: 'C',
        alter: 0,
        octave: 4,
        duration: 'q',
        measure: 1,
        beat: frac(0, 1),
      }

      const coords = mapper.noteToPixel(note, 4)
      expect(coords.x).toBe(110) // startX + measureLeftMargin
      expect(coords.y).toBe(130) // C4 at staff line 5.0
    })

    it('should handle notes in different measures', () => {
      const note: Note = {
        id: '1',
        step: 'C',
        alter: 0,
        octave: 4,
        duration: 'q',
        measure: 2,
        beat: frac(0, 1),
      }

      const coords = mapper.noteToPixel(note, 4)
      // Measure 2 is not first in line, so leftMargin = 20
      // x = startX + measureWidth + 20 = 10 + 500 + 20 = 530
      expect(coords.x).toBe(530)
    })
  })

  describe('pixelToMeasure', () => {
    it('should convert pixel to first measure', () => {
      const measure = mapper.pixelToMeasure({ x: 100, y: 50 })
      expect(measure).toBe(1)
    })

    it('should convert pixel to second measure', () => {
      const measure = mapper.pixelToMeasure({ x: 600, y: 50 })
      expect(measure).toBe(2)
    })

    it('should convert pixel to third measure on second line', () => {
      const measure = mapper.pixelToMeasure({ x: 100, y: 200 })
      expect(measure).toBe(3)
    })
  })

  describe('pixelXToBeat', () => {
    it('should convert pixel X to beat 0', () => {
      const beat = mapper.pixelXToBeat(110, 1, 4)
      expect(beat).toBe(0)
    })

    it('should convert pixel X to beat 2', () => {
      const middleX = 110 + (380 / 4) * 2
      const beat = mapper.pixelXToBeat(middleX, 1, 4)
      expect(beat).toBe(2)
    })

    it('should snap to nearest quarter beat', () => {
      const x = 110 + 50 // Arbitrary position
      const beat = mapper.pixelXToBeat(x, 1, 4)
      expect(beat % 0.25).toBe(0) // Should be multiple of 0.25
    })

    it('should clamp to 0 for negative positions', () => {
      const beat = mapper.pixelXToBeat(50, 1, 4)
      expect(beat).toBe(0)
    })

    it('should clamp to max beats for positions beyond measure', () => {
      const beat = mapper.pixelXToBeat(1000, 1, 4)
      expect(beat).toBe(4)
    })
  })

  // Phase 1: callers pass bar length in QUARTER-NOTE beats (barQuarters =
  // getMeasureDuration(ts)), not the time-signature numerator. These round-trips
  // pin that contract for non-/4 meters, where numerator !== barQuarters.
  describe('barQuarters (non-4/4 meters)', () => {
    const usableWidth = 380 // measureWidth(500) - leftMargin(100) - 20 (see beatToPixelX)
    const centerX = 110 + usableWidth / 2

    // [label, timeSignature, expected barQuarters, expected center beat]
    const cases: Array<[string, { numerator: number; denominator: number }, number, number]> = [
      ['3/4', { numerator: 3, denominator: 4 }, 3, 1.5],
      ['6/8', { numerator: 6, denominator: 8 }, 3, 1.5],
      ['2/2', { numerator: 2, denominator: 2 }, 4, 2],
    ]

    for (const [label, ts, expectedQuarters, centerBeat] of cases) {
      it(`${label}: getMeasureDuration is the quarter-beat bar length`, () => {
        expect(getMeasureDuration(ts)).toBe(expectedQuarters)
      })

      it(`${label}: bar center maps to the correct quarter-beat (round-trip)`, () => {
        const barQuarters = getMeasureDuration(ts)
        // pixel -> beat: the visual middle of the bar is its center beat
        expect(mapper.pixelXToBeat(centerX, 1, barQuarters)).toBeCloseTo(centerBeat, 5)
        // beat -> pixel: the center beat lands at the visual middle
        expect(mapper.beatToPixelX(centerBeat, 1, barQuarters)).toBeCloseTo(centerX, 1)
      })

      it(`${label}: clamps past the barline to barQuarters, not the numerator`, () => {
        const barQuarters = getMeasureDuration(ts)
        expect(mapper.pixelXToBeat(10000, 1, barQuarters)).toBe(barQuarters)
      })
    }
  })

  describe('pixelYToPitch', () => {
    it('should convert Y=130 to middle C (C4)', () => {
      // y=130: staffLine = ((130 - 40) / 10) - 4 = 9 - 4 = 5.0 → dPos=28 → C4
      const spelling = mapper.pixelYToPitch(130, 1)
      expect(spelling.step).toBe('C')
      expect(spelling.octave).toBe(4)
      expect(spellingToMidi(spelling.step, spelling.alter, spelling.octave)).toBe(60)
    })

    it('should convert lower Y to higher pitch', () => {
      const spellingC = mapper.pixelYToPitch(130, 1)  // C4
      const spellingHigh = mapper.pixelYToPitch(80, 1)  // Higher on staff
      expect(spellingToMidi(spellingHigh.step, spellingHigh.alter, spellingHigh.octave))
        .toBeGreaterThan(spellingToMidi(spellingC.step, spellingC.alter, spellingC.octave))
    })

    it('should convert higher Y to lower pitch', () => {
      const spellingC = mapper.pixelYToPitch(130, 1)  // C4
      const spellingLow = mapper.pixelYToPitch(140, 1) // Lower on staff
      expect(spellingToMidi(spellingLow.step, spellingLow.alter, spellingLow.octave))
        .toBeLessThan(spellingToMidi(spellingC.step, spellingC.alter, spellingC.octave))
    })
  })

  describe('pixelToPosition', () => {
    it('should convert pixel coordinates to complete position', () => {
      // Use y=130 for middle C (C4)
      const position = mapper.pixelToPosition({ x: 110, y: 130 }, 4)

      expect(position.measure).toBe(1)
      expect(position.beat).toBe(0)
      expect(position.spelling.step).toBe('C')
      expect(position.spelling.octave).toBe(4)
    })

    it('should handle different pixel positions', () => {
      const position = mapper.pixelToPosition({ x: 700, y: 80 }, 4)

      expect(position.measure).toBe(2)
      expect(position.beat).toBeGreaterThanOrEqual(0)
      expect(spellingToMidi(position.spelling.step, position.spelling.alter, position.spelling.octave))
        .toBeGreaterThan(60)
    })
  })

  describe('getMeasureBounds', () => {
    it('should return correct bounds for first measure', () => {
      const bounds = mapper.getMeasureBounds(1)

      expect(bounds.x).toBe(10)
      expect(bounds.y).toBe(40)
      expect(bounds.width).toBe(500)
      expect(bounds.height).toBe(100)
    })

    it('should return correct bounds for second measure', () => {
      const bounds = mapper.getMeasureBounds(2)

      expect(bounds.x).toBe(510)
      expect(bounds.y).toBe(40)
    })
  })

  describe('isWithinMeasureBounds', () => {
    it('should return true for coordinates within measure', () => {
      const isWithin = mapper.isWithinMeasureBounds({ x: 100, y: 60 }, 1)
      expect(isWithin).toBe(true)
    })

    it('should return false for coordinates outside measure', () => {
      const isWithin = mapper.isWithinMeasureBounds({ x: 1000, y: 60 }, 1)
      expect(isWithin).toBe(false)
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      mapper.updateConfig({ measureWidth: 600 })
      const config = mapper.getConfig()
      expect(config.measureWidth).toBe(600)
    })

    it('should preserve other config values when updating', () => {
      mapper.updateConfig({ measureWidth: 600 })
      const config = mapper.getConfig()
      expect(config.startX).toBe(10)
      expect(config.startY).toBe(40)
    })
  })
})
