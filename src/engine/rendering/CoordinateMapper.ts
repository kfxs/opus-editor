import type { PixelCoordinates, Position, Note, Measure } from '@/types/music'
import { getStaffLinePosition } from '@/utils/musicUtils'

/**
 * Configuration for the coordinate mapping system
 */
export interface CoordinateMapperConfig {
  /** Width of each measure in pixels */
  measureWidth: number
  /** Height of the staff in pixels */
  staffHeight: number
  /** X offset for the first measure */
  startX: number
  /** Y offset for the first staff line */
  startY: number
  /** Number of measures per line */
  measuresPerLine: number
  /** Vertical spacing between staff lines in pixels */
  lineSpacing: number
  /** Horizontal margin before the first beat */
  measureLeftMargin: number
}

/**
 * CoordinateMapper handles bidirectional conversion between pixel coordinates
 * and musical positions (measure/beat/pitch)
 */
export class CoordinateMapper {
  private config: CoordinateMapperConfig

  constructor(config: Partial<CoordinateMapperConfig> = {}) {
    this.config = {
      measureWidth: 500,
      staffHeight: 150,
      startX: 10,
      startY: 40,
      measuresPerLine: 2,
      lineSpacing: 10, // pixels per staff line
      measureLeftMargin: 100, // space for clef, time signature
      ...config,
    }
  }

  /**
   * Update the mapper configuration
   */
  updateConfig(config: Partial<CoordinateMapperConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get the current configuration
   */
  getConfig(): CoordinateMapperConfig {
    return { ...this.config }
  }

  /**
   * Calculate the pixel position for a measure
   */
  getMeasurePosition(measureNumber: number): PixelCoordinates {
    const measureIndex = measureNumber - 1 // Convert to 0-indexed
    const line = Math.floor(measureIndex / this.config.measuresPerLine)
    const positionInLine = measureIndex % this.config.measuresPerLine

    return {
      x: this.config.startX + positionInLine * this.config.measureWidth,
      y: this.config.startY + line * this.config.staffHeight,
    }
  }

  /**
   * Calculate pixel X coordinate for a beat position within a measure
   * @param beat - Beat position (0-indexed, fractional allowed)
   * @param measureNumber - Measure number (1-indexed)
   * @param beatsInMeasure - Total beats in the measure (e.g., 4 for 4/4)
   */
  beatToPixelX(beat: number, measureNumber: number, beatsInMeasure: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)
    const usableWidth = this.config.measureWidth - this.config.measureLeftMargin - 20 // 20px right margin
    const beatWidth = usableWidth / beatsInMeasure

    return measurePos.x + this.config.measureLeftMargin + beat * beatWidth
  }

  /**
   * Calculate pixel Y coordinate for a pitch (MIDI number)
   * @param pitch - MIDI note number
   * @param measureNumber - Measure number for Y offset calculation
   */
  pitchToPixelY(pitch: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)
    const staffLinePos = getStaffLinePosition(pitch)

    // VexFlow staff has 5 lines, middle line is typically around the center
    // Negative staff positions are below middle C, positive are above
    const pixelOffset = -staffLinePos * this.config.lineSpacing

    return measurePos.y + 60 + pixelOffset // 60 is approximate center of staff
  }

  /**
   * Convert a note to pixel coordinates
   */
  noteToPixel(note: Note, beatsInMeasure: number): PixelCoordinates {
    return {
      x: this.beatToPixelX(note.beat, note.measure, beatsInMeasure),
      y: this.pitchToPixelY(note.pitch, note.measure),
    }
  }

  /**
   * Convert pixel coordinates to measure number
   */
  pixelToMeasure(coords: PixelCoordinates): number {
    const line = Math.floor((coords.y - this.config.startY) / this.config.staffHeight)
    const posInLine = Math.floor((coords.x - this.config.startX) / this.config.measureWidth)

    return line * this.config.measuresPerLine + posInLine + 1 // Convert to 1-indexed
  }

  /**
   * Convert pixel X coordinate to beat position within a measure
   */
  pixelXToBeat(x: number, measureNumber: number, beatsInMeasure: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)
    const relativeX = x - measurePos.x - this.config.measureLeftMargin
    const usableWidth = this.config.measureWidth - this.config.measureLeftMargin - 20

    if (relativeX < 0) return 0
    if (relativeX > usableWidth) return beatsInMeasure

    const beat = (relativeX / usableWidth) * beatsInMeasure

    // Snap to nearest quarter beat for easier note placement
    return Math.round(beat * 4) / 4
  }

  /**
   * Convert pixel Y coordinate to MIDI pitch
   * Middle C (60) is the baseline
   */
  pixelYToPitch(y: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)
    const relativeY = y - (measurePos.y + 60) // 60 is center offset

    const staffLines = -Math.round(relativeY / this.config.lineSpacing)

    // Convert staff line position to MIDI pitch
    // Each staff line is a whole step (2 semitones)
    const middleC = 60
    return middleC + staffLines * 2
  }

  /**
   * Convert pixel coordinates to musical position
   * Returns measure, beat, and pitch
   */
  pixelToPosition(
    coords: PixelCoordinates,
    beatsInMeasure: number
  ): { measure: number; beat: number; pitch: number } {
    const measure = this.pixelToMeasure(coords)
    const beat = this.pixelXToBeat(coords.x, measure, beatsInMeasure)
    const pitch = this.pixelYToPitch(coords.y, measure)

    return { measure, beat, pitch }
  }

  /**
   * Get the bounding box for a measure in pixels
   */
  getMeasureBounds(measureNumber: number): {
    x: number
    y: number
    width: number
    height: number
  } {
    const pos = this.getMeasurePosition(measureNumber)
    return {
      x: pos.x,
      y: pos.y,
      width: this.config.measureWidth,
      height: 100, // Approximate staff height
    }
  }

  /**
   * Check if pixel coordinates are within a valid measure area
   */
  isWithinMeasureBounds(coords: PixelCoordinates, measureNumber: number): boolean {
    const bounds = this.getMeasureBounds(measureNumber)
    return (
      coords.x >= bounds.x &&
      coords.x <= bounds.x + bounds.width &&
      coords.y >= bounds.y &&
      coords.y <= bounds.y + bounds.height
    )
  }
}
