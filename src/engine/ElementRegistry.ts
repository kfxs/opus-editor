/**
 * ElementRegistry - Maps rendered SVG elements to score data
 *
 * After VexFlow renders, this registry stores the bounding box of each element
 * along with its score data (note ID, measure, beat, pitch, etc.)
 *
 * This allows:
 * - Hit detection: "What element is at pixel (x, y)?"
 * - Position lookup: "Where is note with ID 'abc123' on screen?"
 */

/**
 * Types of elements we track
 */
export type ElementType =
  | 'note'
  | 'rest'
  | 'clef'
  | 'timeSignature'
  | 'keySignature'
  | 'barline'
  | 'beam'
  | 'staff'

/**
 * Bounding box in pixel coordinates
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Staff geometry for a measure - stores actual Y positions of staff lines
 * Used for accurate pitch calculation from cursor Y position
 */
export interface StaffGeometry {
  /** Measure number (1-indexed) */
  measure: number
  /** Y positions of staff lines 0-4 (top to bottom) */
  lineYPositions: [number, number, number, number, number]
  /** Spacing between staff lines in pixels */
  lineSpacing: number
  /** X where notes can start (after clef/time sig) */
  noteStartX: number
  /** X where notes must end (before barline) */
  noteEndX: number
}

/**
 * Information about a rendered element
 */
export interface ElementInfo {
  /** Type of element */
  type: ElementType
  /** Our internal ID (for notes/rests) */
  id?: string
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position within measure (for notes/rests) */
  beat?: number
  /** MIDI pitch (for notes) */
  pitch?: number
  /** Pixel bounding box */
  bbox: BoundingBox
}

/**
 * Registry that tracks all rendered elements
 */
export class ElementRegistry {
  private elements: ElementInfo[] = []
  private staffGeometries: Map<number, StaffGeometry> = new Map()

  /**
   * Clear all stored elements (call before each render)
   */
  clear(): void {
    this.elements = []
    this.staffGeometries.clear()
  }

  /**
   * Set staff geometry for a measure
   */
  setStaffGeometry(geometry: StaffGeometry): void {
    this.staffGeometries.set(geometry.measure, geometry)
  }

  /**
   * Get staff geometry for a measure
   */
  getStaffGeometry(measure: number): StaffGeometry | undefined {
    return this.staffGeometries.get(measure)
  }

  /**
   * Add an element to the registry
   */
  add(element: ElementInfo): void {
    this.elements.push(element)
  }

  /**
   * Get all registered elements
   */
  getAll(): ElementInfo[] {
    return this.elements
  }

  /**
   * Find element at a specific pixel coordinate
   * Returns the topmost (last added) element if multiple overlap
   */
  getAt(x: number, y: number): ElementInfo | null {
    // Search in reverse order (last added = on top)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i]
      const b = el.bbox
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return el
      }
    }
    return null
  }

  /**
   * Find element by its ID (for notes/rests)
   */
  getById(id: string): ElementInfo | null {
    return this.elements.find(el => el.id === id) || null
  }

  /**
   * Get all elements in a specific measure
   */
  getByMeasure(measure: number): ElementInfo[] {
    return this.elements.filter(el => el.measure === measure)
  }

  /**
   * Get all elements of a specific type
   */
  getByType(type: ElementType): ElementInfo[] {
    return this.elements.filter(el => el.type === type)
  }

  /**
   * Find all elements within a rectangle (for marquee selection)
   */
  getInRect(rect: BoundingBox): ElementInfo[] {
    return this.elements.filter(el => {
      const b = el.bbox
      return (
        b.x < rect.x + rect.width &&
        b.x + b.width > rect.x &&
        b.y < rect.y + rect.height &&
        b.y + b.height > rect.y
      )
    })
  }

  /**
   * Get count of registered elements
   */
  get count(): number {
    return this.elements.length
  }

  // ==================== Pitch Calculation ====================

  /**
   * Convert pixel Y coordinate to MIDI pitch using staff geometry
   * @param y - Pixel Y coordinate
   * @param measure - Measure number to get staff geometry from
   * @returns MIDI pitch number, or null if geometry not available
   */
  pixelYToPitch(y: number, measure: number): number | null {
    const geometry = this.staffGeometries.get(measure)
    if (!geometry) return null

    const { lineYPositions, lineSpacing } = geometry

    // Calculate staff line from Y position
    // Line 0 (top) = F5 (MIDI 77), Line 4 (bottom) = E4 (MIDI 64)
    const topLineY = lineYPositions[0]
    const staffLine = (y - topLineY) / lineSpacing

    // Convert staff line to pitch using diatonic scale
    return this.staffLineToPitch(staffLine)
  }

  /**
   * Convert MIDI pitch to pixel Y coordinate using staff geometry
   * @param pitch - MIDI pitch number
   * @param measure - Measure number to get staff geometry from
   * @returns Pixel Y coordinate, or null if geometry not available
   */
  pitchToPixelY(pitch: number, measure: number): number | null {
    const geometry = this.staffGeometries.get(measure)
    if (!geometry) return null

    const { lineYPositions, lineSpacing } = geometry
    const staffLine = this.pitchToStaffLine(pitch)

    return lineYPositions[0] + staffLine * lineSpacing
  }

  /**
   * Convert staff line position to MIDI pitch (diatonic mapping for treble clef)
   * Line 0 = F5 (77), 0.5 = E5 (76), 1.0 = D5 (74), etc.
   */
  private staffLineToPitch(staffLine: number): number {
    // Round to nearest half-line
    const roundedLine = Math.round(staffLine * 2) / 2

    // Diatonic notes from F5 descending
    const diatonicNotes = [
      77, 76, 74, 72, 71, 69, 67, 65, 64, 62, 60, 59, 57, 55, 53, 52
    ]

    // Handle positions above the staff (negative values)
    if (roundedLine < 0) {
      const positionsAbove = [79, 81, 83, 84, 86, 88, 89, 91]
      const index = Math.floor(Math.abs(roundedLine) * 2) - 1
      if (index >= 0 && index < positionsAbove.length) {
        return positionsAbove[index]
      }
      return 77 + Math.ceil(Math.abs(roundedLine) * 2)
    }

    // On or below staff
    const index = Math.floor(roundedLine * 2)
    if (index < diatonicNotes.length) {
      return diatonicNotes[index]
    }

    // Below lookup table - extrapolate
    return diatonicNotes[diatonicNotes.length - 1] - (index - diatonicNotes.length + 1)
  }

  /**
   * Convert MIDI pitch to staff line position
   */
  private pitchToStaffLine(pitch: number): number {
    const diatonicNotes = [77, 76, 74, 72, 71, 69, 67, 65, 64, 62, 60, 59, 57, 55]

    const index = diatonicNotes.indexOf(pitch)
    if (index !== -1) {
      return index / 2
    }

    // Notes above staff
    const positionsAbove = [79, 81, 83, 84, 86, 88, 89, 91]
    const aboveIndex = positionsAbove.indexOf(pitch)
    if (aboveIndex !== -1) {
      return -(aboveIndex + 1) / 2
    }

    // Approximate for other pitches
    return (77 - pitch) / 1.7
  }

  // ==================== Nearby Element Finding ====================

  /**
   * Find the nearest note or rest to a given X position within a measure
   * Used for beat snapping when placing new notes
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @returns The nearest note/rest element, or null if none found
   */
  findNearestNoteOrRest(x: number, measure: number): ElementInfo | null {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
    )

    if (notesAndRests.length === 0) return null

    let nearest: ElementInfo | null = null
    let minDistance = Infinity

    for (const el of notesAndRests) {
      const centerX = el.bbox.x + el.bbox.width / 2
      const distance = Math.abs(x - centerX)
      if (distance < minDistance) {
        minDistance = distance
        nearest = el
      }
    }

    return nearest
  }

  /**
   * Find notes/rests near a given X position (within tolerance)
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @param tolerance - Max distance in pixels (default 30)
   * @returns Array of nearby elements sorted by distance
   */
  findNotesNearX(x: number, measure: number, tolerance: number = 30): ElementInfo[] {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
    )

    return notesAndRests
      .map(el => ({
        el,
        distance: Math.abs(x - (el.bbox.x + el.bbox.width / 2))
      }))
      .filter(({ distance }) => distance <= tolerance)
      .sort((a, b) => a.distance - b.distance)
      .map(({ el }) => el)
  }
}
