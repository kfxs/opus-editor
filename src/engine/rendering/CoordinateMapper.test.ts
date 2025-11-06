import { describe, it, expect, beforeEach } from 'vitest'
import { CoordinateMapper } from './CoordinateMapper'
import type { Note } from '@/types/music'

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
    it('should return center Y for middle C (MIDI 60)', () => {
      const y = mapper.pitchToPixelY(60, 1)
      expect(y).toBe(100) // startY + 60
    })

    it('should return lower Y for higher pitch', () => {
      const yC = mapper.pitchToPixelY(60, 1)
      const yE = mapper.pitchToPixelY(64, 1)
      expect(yE).toBeLessThan(yC) // Higher pitch = lower on screen
    })

    it('should return higher Y for lower pitch', () => {
      const yC = mapper.pitchToPixelY(60, 1)
      const yG = mapper.pitchToPixelY(55, 1)
      expect(yG).toBeGreaterThan(yC) // Lower pitch = higher on screen
    })
  })

  describe('noteToPixel', () => {
    it('should convert note to pixel coordinates', () => {
      const note: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 1,
        beat: 0,
      }

      const coords = mapper.noteToPixel(note, 4)
      expect(coords.x).toBe(110)
      expect(coords.y).toBe(100)
    })

    it('should handle notes in different measures', () => {
      const note: Note = {
        id: '1',
        pitch: 60,
        duration: 'q',
        measure: 2,
        beat: 0,
      }

      const coords = mapper.noteToPixel(note, 4)
      expect(coords.x).toBe(610) // Second measure X position + leftMargin
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

  describe('pixelYToPitch', () => {
    it('should convert center Y to middle C', () => {
      const pitch = mapper.pixelYToPitch(100, 1)
      expect(pitch).toBe(60)
    })

    it('should convert lower Y to higher pitch', () => {
      const pitch = mapper.pixelYToPitch(80, 1)
      expect(pitch).toBeGreaterThan(60)
    })

    it('should convert higher Y to lower pitch', () => {
      const pitch = mapper.pixelYToPitch(120, 1)
      expect(pitch).toBeLessThan(60)
    })
  })

  describe('pixelToPosition', () => {
    it('should convert pixel coordinates to complete position', () => {
      const position = mapper.pixelToPosition({ x: 110, y: 100 }, 4)

      expect(position.measure).toBe(1)
      expect(position.beat).toBe(0)
      expect(position.pitch).toBe(60)
    })

    it('should handle different pixel positions', () => {
      const position = mapper.pixelToPosition({ x: 700, y: 80 }, 4)

      expect(position.measure).toBe(2)
      expect(position.beat).toBeGreaterThanOrEqual(0)
      expect(position.pitch).toBeGreaterThan(60)
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
