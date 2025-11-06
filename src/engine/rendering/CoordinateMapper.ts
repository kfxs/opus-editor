import type { PixelCoordinates, Position, Note, Measure } from '@/types/music'

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

    // Use the same geometry as pixelYToPitch for consistency
    const STAFF_LINE_SPACING = 10
    const STAFF_TOP_LINE_OFFSET = 40
    const STAFF_TOP_Y = measurePos.y + STAFF_TOP_LINE_OFFSET
    const topLinePitch = 77 // F5

    // Calculate how many half-spaces below the top line this pitch is
    const halfSpacesFromTop = topLinePitch - pitch
    const pixelOffset = halfSpacesFromTop * (STAFF_LINE_SPACING / 2)

    return STAFF_TOP_Y + pixelOffset
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
   * Uses VexFlow's staff geometry and treble clef positioning
   */
  pixelYToPitch(y: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)

    // VexFlow staff geometry:
    // - Staff has 5 lines with 10px spacing between lines (STAVE_LINE_DISTANCE = 10)
    // - Staff top is at measurePos.y (this is the Stave bounding box top)
    // - The actual top staff line is offset from this (VexFlow adds padding)
    // - In treble clef, the top line is F5 (MIDI 77), bottom line is E4 (MIDI 64)
    // - Each half-space is one semitone in chromatic scale

    const STAFF_LINE_SPACING = 10 // VexFlow's standard line spacing
    // Increased offset to account for VexFlow's stave padding and allow notes above the staff
    const STAFF_TOP_LINE_OFFSET = 40 // Offset from measurePos.y to actual top staff line
    const STAFF_TOP_Y = measurePos.y + STAFF_TOP_LINE_OFFSET

    // Calculate position relative to staff top line (0 = top line)
    const relativeY = y - STAFF_TOP_Y

    // In treble clef:
    // - Top line (line 0) = F5 (MIDI 77)
    // - Each staff line down is 2 semitones (whole step)
    // - Each half-space is 1 semitone

    // Convert Y pixels to half-spaces (each half-space = 5 pixels)
    const halfSpaces = Math.round(relativeY / (STAFF_LINE_SPACING / 2))

    // Top line of treble clef staff is F5 (MIDI 77)
    // Going down (positive Y) decreases pitch
    // Going up (negative Y) increases pitch
    const topLinePitch = 77 // F5
    const pitch = topLinePitch - halfSpaces

    console.log('🎵 pixelYToPitch DEBUG:', {
      y,
      measureNumber,
      'measurePos.y': measurePos.y,
      STAFF_TOP_Y,
      relativeY,
      halfSpaces,
      pitch,
      noteName: this.pitchToNoteName(pitch)
    })

    return pitch
  }

  /**
   * Helper to convert MIDI pitch to note name for debugging
   */
  private pitchToNoteName(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(midiNote / 12) - 1
    const noteName = noteNames[midiNote % 12]
    return `${noteName}${octave}`
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
