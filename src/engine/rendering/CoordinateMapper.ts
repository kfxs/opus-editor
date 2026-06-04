import type { PixelCoordinates, Note, PitchStep, PitchSpelling } from '@/types/music'
import type { MeasureBounds } from './VexFlowRenderer'
import { fracToNumber } from '@/utils/fraction'
import { spellingDiatonicPos, spellingToMidi, midiToSpelling } from '@/utils/pitchSpelling'

/** Treble-clef reference: F5 sits on staff line 0 (top line). diatonicPos = 5*7+3 = 38 */
const TREBLE_TOP_DIATONIC_POS = 38

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
   * @param barQuarters - Total bar length in quarter-note beats (e.g. 4 for 4/4, 3 for 6/8, 4 for 2/2)
   */
  beatToPixelX(beat: number, measureNumber: number, barQuarters: number): number {
    // Use actual VexFlow bounds if available
    const bounds = this.measureBounds.get(measureNumber)
    if (bounds) {
      const usableWidth = bounds.noteEndX - bounds.noteStartX
      const beatWidth = usableWidth / barQuarters
      return bounds.noteStartX + beat * beatWidth
    }

    // Fallback to calculated values
    const measurePos = this.getMeasurePosition(measureNumber)
    const leftMargin = this.getLeftMarginForMeasure(measureNumber)
    const usableWidth = this.config.measureWidth - leftMargin - 20 // 20px right margin
    const beatWidth = usableWidth / barQuarters

    return measurePos.x + leftMargin + beat * beatWidth
  }

  /**
   * Calculate pixel Y coordinate for a pitch spelling.
   * Uses spellingDiatonicPos for correct staff line positioning — accidentals
   * on the same diatonic step (e.g. C# and C♮) map to the same Y position.
   * @param step - Diatonic step name
   * @param _alter - Ignored for Y positioning (alter doesn't change staff line)
   * @param octave - Scientific octave
   * @param measureNumber - Measure number for Y offset calculation
   */
  pitchToPixelY(step: PitchStep, _alter: number, octave: number, measureNumber: number): number {
    const measurePos = this.getMeasurePosition(measureNumber)
    const SPACING = 10
    const HEADROOM = 4 // lines above staff

    // staff line 0 = F5 (top line); each half-line = one diatonic step down
    const dPos = spellingDiatonicPos(step, octave)
    const staffLine = (TREBLE_TOP_DIATONIC_POS - dPos) / 2

    return measurePos.y + (staffLine * SPACING) + (HEADROOM * SPACING)
  }

  /**
   * Convert a note to pixel coordinates
   */
  noteToPixel(note: Note, barQuarters: number): PixelCoordinates {
    return {
      x: this.beatToPixelX(fracToNumber(note.beat), note.measure, barQuarters),
      y: note.step !== undefined
        ? this.pitchToPixelY(note.step, note.alter ?? 0, note.octave!, note.measure)
        : this.getMeasurePosition(note.measure).y + 40, // rests: center of staff
    }
  }

  /**
   * Convert pixel coordinates to measure number
   * Uses actual VexFlow bounds if available for accurate hit detection with dynamic widths
   */
  pixelToMeasure(coords: PixelCoordinates): number {
    // First, try using actual measure bounds if available (supports dynamic widths)
    if (this.measureBounds.size > 0) {
      // Find which measure contains the click coordinates
      for (const [measureNumber, bounds] of this.measureBounds.entries()) {
        if (
          coords.x >= bounds.measureX &&
          coords.x < bounds.measureX + bounds.measureWidth &&
          coords.y >= bounds.measureY &&
          coords.y < bounds.measureY + this.config.staffHeight
        ) {
          return measureNumber
        }
      }

      // If no exact match found, find the closest measure on the correct line
      const line = Math.max(0, Math.floor((coords.y - this.config.startY) / this.config.staffHeight))
      let closestMeasure = 1
      let closestDistance = Infinity

      for (const [measureNumber, bounds] of this.measureBounds.entries()) {
        const measureLine = Math.floor((bounds.measureY - this.config.startY) / this.config.staffHeight)
        if (measureLine === line) {
          const measureCenterX = bounds.measureX + bounds.measureWidth / 2
          const distance = Math.abs(coords.x - measureCenterX)
          if (distance < closestDistance) {
            closestDistance = distance
            closestMeasure = measureNumber
          }
        }
      }

      return closestMeasure
    }

    // Fallback to calculated values (for uniform widths or when bounds not set)
    const line = Math.max(0, Math.floor((coords.y - this.config.startY) / this.config.staffHeight))
    const posInLine = Math.max(0, Math.floor((coords.x - this.config.startX) / this.config.measureWidth))

    return line * this.config.measuresPerLine + posInLine + 1 // Convert to 1-indexed
  }

  /**
   * Convert pixel X coordinate to beat position within a measure
   * Uses actual VexFlow bounds if available, otherwise falls back to calculated values
   */
  pixelXToBeat(x: number, measureNumber: number, barQuarters: number): number {
    // Use actual VexFlow bounds if available
    const bounds = this.measureBounds.get(measureNumber)
    if (bounds) {
      const relativeX = x - bounds.noteStartX
      const usableWidth = bounds.noteEndX - bounds.noteStartX

      if (relativeX < 0) return 0
      if (relativeX > usableWidth) return barQuarters

      const beat = (relativeX / usableWidth) * barQuarters
      return Math.round(beat * 4) / 4
    }

    // Fallback to calculated values
    const measurePos = this.getMeasurePosition(measureNumber)
    const leftMargin = this.getLeftMarginForMeasure(measureNumber)
    const relativeX = x - measurePos.x - leftMargin
    const usableWidth = this.config.measureWidth - leftMargin - 20

    if (relativeX < 0) return 0
    if (relativeX > usableWidth) return barQuarters

    const beat = (relativeX / usableWidth) * barQuarters

    // Snap to nearest quarter beat for easier note placement
    return Math.round(beat * 4) / 4
  }

  /**
   * Convert pixel Y coordinate to a PitchSpelling (always natural: alter=0).
   * Uses the inverse of spellingDiatonicPos with treble-clef reference (F5 at top line).
   */
  pixelYToPitch(y: number, measureNumber: number): PitchSpelling {
    const measurePos = this.getMeasurePosition(measureNumber)
    const SPACING = 10
    const HEADROOM = 4

    const staffLine = ((y - measurePos.y) / SPACING) - HEADROOM
    // Guard against an invalid measure position (e.g. cursor over an unrendered
    // region): a NaN staffLine would yield an undefined step. Default to B4
    // (treble middle line) so callers always receive a valid spelling.
    if (!Number.isFinite(staffLine)) {
      return { step: 'B', alter: 0, octave: 4 }
    }
    // Round to nearest half-staff-line (one diatonic step)
    const roundedLine = Math.round(staffLine * 2) / 2

    // diatonicPos = TREBLE_TOP_DIATONIC_POS - roundedLine * 2
    const diatonicPos = TREBLE_TOP_DIATONIC_POS - roundedLine * 2

    // Clamp to sensible range (C2 = pos 14, C8 = pos 56)
    const clampedDiatonic = Math.max(7, Math.min(63, diatonicPos))

    const octave = Math.floor(clampedDiatonic / 7)
    const stepIdx = ((Math.round(clampedDiatonic) % 7) + 7) % 7
    const STEPS: PitchStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

    // Final MIDI clamp to ensure we stay in playable range
    const step = STEPS[stepIdx]
    const midi = spellingToMidi(step, 0, octave)
    if (midi < 24 || midi > 108) {
      return midiToSpelling(Math.max(24, Math.min(108, midi)))
    }
    return { step, alter: 0, octave }
  }

  /**
   * Convert pixel coordinates to musical position
   * Returns measure, beat, and spelling (natural note at that staff position)
   */
  pixelToPosition(
    coords: PixelCoordinates,
    barQuarters: number
  ): { measure: number; beat: number; spelling: PitchSpelling } {
    const measure = this.pixelToMeasure(coords)
    const beat = this.pixelXToBeat(coords.x, measure, barQuarters)
    const spelling = this.pixelYToPitch(coords.y, measure)

    return { measure, beat, spelling }
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
