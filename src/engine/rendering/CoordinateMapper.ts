import type { PixelCoordinates, Position, Note, Measure } from '@/types/music'
import type { MeasureBounds } from './VexFlowRenderer'

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
  /** Actual measure bounds from VexFlow (after rendering) */
  private measureBounds: Map<number, MeasureBounds> = new Map()

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
   * Update measure bounds from VexFlow's actual rendered positions
   * This should be called after each render
   */
  setMeasureBounds(bounds: Map<number, MeasureBounds>): void {
    // Copy the map to avoid sharing reference with VexFlowRenderer
    // (otherwise clear() in renderer would also clear our bounds)
    this.measureBounds = new Map(bounds)
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
   * Check if a measure is the first in its line (has clef)
   */
  private isFirstInLine(measureNumber: number): boolean {
    const measureIndex = measureNumber - 1 // Convert to 0-indexed
    const positionInLine = measureIndex % this.config.measuresPerLine
    return positionInLine === 0
  }

  /**
   * Get the left margin for a specific measure
   * First measure of each line has clef, so needs more space
   */
  private getLeftMarginForMeasure(measureNumber: number): number {
    if (this.isFirstInLine(measureNumber)) {
      return this.config.measureLeftMargin // Full margin for clef
    }
    return 20 // Minimal margin for measures without clef
  }

  /**
   * Calculate pixel X coordinate for a beat position within a measure
   * Uses actual VexFlow bounds if available, otherwise falls back to calculated values
   * @param beat - Beat position (0-indexed, fractional allowed)
   * @param measureNumber - Measure number (1-indexed)
   * @param beatsInMeasure - Total beats in the measure (e.g., 4 for 4/4)
   */
  beatToPixelX(beat: number, measureNumber: number, beatsInMeasure: number): number {
    // Use actual VexFlow bounds if available
    const bounds = this.measureBounds.get(measureNumber)
    if (bounds) {
      const usableWidth = bounds.noteEndX - bounds.noteStartX
      const beatWidth = usableWidth / beatsInMeasure
      return bounds.noteStartX + beat * beatWidth
    }

    // Fallback to calculated values
    const measurePos = this.getMeasurePosition(measureNumber)
    const leftMargin = this.getLeftMarginForMeasure(measureNumber)
    const usableWidth = this.config.measureWidth - leftMargin - 20 // 20px right margin
    const beatWidth = usableWidth / beatsInMeasure

    return measurePos.x + leftMargin + beat * beatWidth
  }

  /**
   * Calculate pixel Y coordinate for a pitch (MIDI number)
   * Uses VexFlow's coordinate system formula: getYForLine
   * Formula from VexFlow: y = stave.y + (line * spacing) + (headroom * spacing)
   * @param pitch - MIDI note number
   * @param measureNumber - Measure number for Y offset calculation
   */
  pitchToPixelY(pitch: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)

    // VexFlow's standard geometry
    const SPACING_BETWEEN_LINES = 10
    const SPACE_ABOVE_STAFF = 4 // headroom in line units

    // Convert pitch to staff line (inverse of staffLineToPitch)
    const staffLine = this.pitchToStaffLine(pitch)

    // VexFlow's getYForLine formula:
    // y = stave.y + (line * spacing) + (headroom * spacing)
    const y = measurePos.y + (staffLine * SPACING_BETWEEN_LINES) + (SPACE_ABOVE_STAFF * SPACING_BETWEEN_LINES)

    return y
  }

  /**
   * Convert MIDI pitch to staff line position (inverse of staffLineToPitch)
   * @param pitch - MIDI pitch number
   * @returns Staff line position (0 = top line, 4 = bottom line)
   */
  private pitchToStaffLine(pitch: number): number {
    // Define the diatonic scale from F5 descending
    const diatonicNotes = [
      77, 76, 74, 72, 71, 69, 67, 65, 64, 62, 60, 59, 57, 55
    ]

    // Check if pitch is in the main lookup table
    const index = diatonicNotes.indexOf(pitch)
    if (index !== -1) {
      return index / 2 // Convert index to staff line (0.0, 0.5, 1.0, etc.)
    }

    // Handle notes above the staff
    const positionsAbove = [79, 81, 83, 84, 86, 88, 89, 91]
    const aboveIndex = positionsAbove.indexOf(pitch)
    if (aboveIndex !== -1) {
      return -(aboveIndex + 1) / 2 // Negative values for above staff
    }

    // For any other pitch, calculate relative to F5 (77)
    // This is an approximation for pitches not in the diatonic scale
    const pitchDiff = 77 - pitch

    // Approximate: each diatonic step is about 1-2 semitones
    // Use average of 1.7 semitones per staff position
    return pitchDiff / 1.7
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
    // Clamp to non-negative values to handle mouse positions outside valid area
    const line = Math.max(0, Math.floor((coords.y - this.config.startY) / this.config.staffHeight))
    const posInLine = Math.max(0, Math.floor((coords.x - this.config.startX) / this.config.measureWidth))

    return line * this.config.measuresPerLine + posInLine + 1 // Convert to 1-indexed
  }

  /**
   * Convert pixel X coordinate to beat position within a measure
   * Uses actual VexFlow bounds if available, otherwise falls back to calculated values
   */
  pixelXToBeat(x: number, measureNumber: number, beatsInMeasure: number): number {
    // Use actual VexFlow bounds if available
    const bounds = this.measureBounds.get(measureNumber)
    if (bounds) {
      const relativeX = x - bounds.noteStartX
      const usableWidth = bounds.noteEndX - bounds.noteStartX

      if (relativeX < 0) return 0
      if (relativeX > usableWidth) return beatsInMeasure

      const beat = (relativeX / usableWidth) * beatsInMeasure
      return Math.round(beat * 4) / 4
    }

    // Fallback to calculated values
    const measurePos = this.getMeasurePosition(measureNumber)
    const leftMargin = this.getLeftMarginForMeasure(measureNumber)
    const relativeX = x - measurePos.x - leftMargin
    const usableWidth = this.config.measureWidth - leftMargin - 20

    if (relativeX < 0) return 0
    if (relativeX > usableWidth) return beatsInMeasure

    const beat = (relativeX / usableWidth) * beatsInMeasure

    // Snap to nearest quarter beat for easier note placement
    return Math.round(beat * 4) / 4
  }

  /**
   * Convert pixel Y coordinate to MIDI pitch
   * Uses VexFlow's coordinate system with diatonic (scale-based) mapping
   * Formula from VexFlow: line = ((y - stave.y) / spacing) - headroom
   */
  pixelYToPitch(y: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)

    // VexFlow's standard geometry (matching Stave defaults)
    const SPACING_BETWEEN_LINES = 10 // pixels between staff lines
    const SPACE_ABOVE_STAFF = 4 // headroom in "line units" (4 * 10 = 40px)

    // VexFlow's getLineForY formula:
    // line = ((y - stave.y) / spacing) - headroom
    const staffLine = ((y - measurePos.y) / SPACING_BETWEEN_LINES) - SPACE_ABOVE_STAFF

    // Convert staff line to diatonic pitch (C major scale)
    const pitch = this.staffLineToPitch(staffLine)

    return pitch
  }

  /**
   * Convert staff line position to MIDI pitch (diatonic mapping)
   * In treble clef, staff positions map to: F E D C B A G F E D C B A G...
   * @param staffLine - Staff line position (0 = top line, 4 = bottom line)
   * @returns MIDI pitch number
   */
  private staffLineToPitch(staffLine: number): number {
    // Top line (line 0) = F5 (MIDI 77)
    // Treble clef notes descending: F E D C B A G F E D C B A G F...
    // Semitone pattern: -1, -2, -2, -1, -2, -2, -2 (repeating)

    // Round to nearest half-line (0.0, 0.5, 1.0, 1.5, etc.)
    const roundedLine = Math.round(staffLine * 2) / 2

    // Define the diatonic scale from F5 descending (C major scale starting on F)
    // Position 0.0 = F5, 0.5 = E5, 1.0 = D5, 1.5 = C5, 2.0 = B4, etc.
    const diatonicNotes = [
      77, // 0.0: F5
      76, // 0.5: E5
      74, // 1.0: D5
      72, // 1.5: C5
      71, // 2.0: B4
      69, // 2.5: A4
      67, // 3.0: G4
      65, // 3.5: F4
      64, // 4.0: E4
      62, // 4.5: D4
      60, // 5.0: C4
      59, // 5.5: B3
      57, // 6.0: A3
      55, // 6.5: G3
    ]

    // Handle positions above the staff (negative values)
    if (roundedLine < 0) {
      // Above the staff: G5, A5, B5, C6, D6, E6, F6, G6...
      const positionsAbove = [
        79, // -0.5: G5
        81, // -1.0: A5
        83, // -1.5: B5
        84, // -2.0: C6
        86, // -2.5: D6
        88, // -3.0: E6
        89, // -3.5: F6
        91, // -4.0: G6
      ]
      const index = Math.floor(Math.abs(roundedLine) * 2) - 1
      if (index < positionsAbove.length) {
        return positionsAbove[index]
      }
      // For very high notes, continue the pattern
      return 77 + Math.ceil(Math.abs(roundedLine) * 2) // Approximate
    }

    // Use lookup table for staff and below
    const index = Math.floor(roundedLine * 2)
    if (index < diatonicNotes.length) {
      return diatonicNotes[index]
    }

    // For very low notes below the table, continue the pattern (descending by 2 or 1)
    // F E D C B A G pattern repeats
    const notesPerOctave = 7 // diatonic scale
    const octaveOffset = Math.floor(index / (notesPerOctave * 2))
    const posInOctave = index % (notesPerOctave * 2)
    return diatonicNotes[posInOctave] - (octaveOffset * 12)
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
