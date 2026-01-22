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
  | 'tie'
  | 'accidental'
  | 'tuplet'

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
 * Clef types (duplicated here to avoid circular imports)
 */
export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor'

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
  /** Clef type for this staff */
  clef: ClefType
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
  measure?: number
  /** Beat position within measure (for notes/rests) */
  beat?: number
  /** MIDI pitch (for notes) */
  pitch?: number
  /** Pixel bounding box */
  bbox: BoundingBox
  // Tie-specific properties
  /** ID of the note this tie starts from (for ties) */
  fromNoteId?: string
  /** ID of the note this tie goes to (for ties) */
  toNoteId?: string
  /** Source measure number (for ties) */
  fromMeasure?: number
  /** Destination measure number (for ties) */
  toMeasure?: number
  /** Whether this is a partial tie (line break) */
  isPartial?: boolean
  /** Type of partial tie: 'start' or 'end' */
  partialType?: 'start' | 'end'
  // Accidental-specific properties
  /** Type of accidental: '#', 'b', 'n', '##', 'bb' (for accidentals) */
  accidentalType?: string
  /** ID of the note this accidental belongs to (for accidentals) */
  noteId?: string
  // Tuplet-specific properties
  /** Tuplet ID (for tuplet brackets, or for notes/rests belonging to a tuplet) */
  tupletId?: string
  /** Start beat of the tuplet */
  startBeat?: number
  /** Number of notes in the tuplet (e.g., 3 for triplet) */
  numNotes?: number
  /** Duration of the note/rest */
  duration?: string
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
   * Clef reference data: which pitch sits on which staff line
   * Staff lines are numbered 0-4 from top to bottom
   */
  private static readonly CLEF_REFERENCES: Record<ClefType, { pitch: number; line: number }> = {
    // Treble (G clef): G4 (67) on line 3 (second from bottom)
    treble: { pitch: 67, line: 3 },
    // Bass (F clef): F3 (53) on line 1 (second from top)
    bass: { pitch: 53, line: 1 },
    // Alto (C clef): C4 (60) on line 2 (middle)
    alto: { pitch: 60, line: 2 },
    // Tenor (C clef): C4 (60) on line 1 (second from top)
    tenor: { pitch: 60, line: 1 },
  }

  /**
   * Convert pixel Y coordinate to MIDI pitch using staff geometry
   * @param y - Pixel Y coordinate
   * @param measure - Measure number to get staff geometry from
   * @returns MIDI pitch number, or null if geometry not available
   */
  pixelYToPitch(y: number, measure: number): number | null {
    const geometry = this.staffGeometries.get(measure)
    if (!geometry) return null

    const { lineYPositions, lineSpacing, clef } = geometry

    // Calculate staff line from Y position
    const topLineY = lineYPositions[0]
    const staffLine = (y - topLineY) / lineSpacing

    // Convert staff line to pitch using clef-aware calculation
    const pitch = this.staffLineToPitch(staffLine, clef)

    // Clamp to valid MIDI range for notation
    return Math.max(21, Math.min(108, pitch))
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

    const { lineYPositions, lineSpacing, clef } = geometry
    const staffLine = this.pitchToStaffLine(pitch, clef)

    return lineYPositions[0] + staffLine * lineSpacing
  }

  /**
   * Get the diatonic pitch class (0-6 for C-B) from a MIDI pitch
   */
  private getDiatonicClass(pitch: number): number {
    // MIDI pitch to pitch class (0-11), then to diatonic class (0-6)
    const pitchClass = pitch % 12
    // Map: C=0, D=1, E=2, F=3, G=4, A=5, B=6
    // Chromatic to diatonic: 0->0, 1->0, 2->1, 3->1, 4->2, 5->3, 6->3, 7->4, 8->4, 9->5, 10->5, 11->6
    const chromaticToDiatonic = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
    return chromaticToDiatonic[pitchClass]
  }

  /**
   * Get the octave number from a MIDI pitch
   */
  private getOctave(pitch: number): number {
    return Math.floor(pitch / 12) - 1
  }

  /**
   * Calculate diatonic steps between two pitches
   * Positive = pitch2 is higher, negative = pitch2 is lower
   */
  private getDiatonicDistance(pitch1: number, pitch2: number): number {
    const octave1 = this.getOctave(pitch1)
    const octave2 = this.getOctave(pitch2)
    const class1 = this.getDiatonicClass(pitch1)
    const class2 = this.getDiatonicClass(pitch2)

    // Total diatonic steps = octave difference * 7 + class difference
    return (octave2 - octave1) * 7 + (class2 - class1)
  }

  /**
   * Convert staff line position to MIDI pitch (clef-aware)
   * Each half-line is one diatonic step
   * @param staffLine - Staff line position (0-4 for lines, 0.5, 1.5, etc. for spaces)
   * @param clef - The clef type
   */
  private staffLineToPitch(staffLine: number, clef: ClefType): number {
    const ref = ElementRegistry.CLEF_REFERENCES[clef]

    // Round to nearest half-line for diatonic snapping
    const roundedLine = Math.round(staffLine * 2) / 2

    // Calculate diatonic steps from reference
    // Moving DOWN the staff (increasing line number) = LOWER pitch
    const diatonicStepsFromRef = (roundedLine - ref.line) * 2

    // Convert diatonic steps to pitch
    return this.addDiatonicSteps(ref.pitch, -diatonicStepsFromRef)
  }

  /**
   * Convert MIDI pitch to staff line position (clef-aware)
   * @param pitch - MIDI pitch number
   * @param clef - The clef type
   */
  private pitchToStaffLine(pitch: number, clef: ClefType): number {
    const ref = ElementRegistry.CLEF_REFERENCES[clef]

    // Calculate diatonic distance from reference pitch
    const diatonicSteps = this.getDiatonicDistance(ref.pitch, pitch)

    // Convert to staff lines (2 diatonic steps per line, higher pitch = lower line number)
    return ref.line - diatonicSteps / 2
  }

  /**
   * Add diatonic steps to a pitch
   * @param pitch - Starting MIDI pitch
   * @param steps - Number of diatonic steps (positive = up, negative = down)
   */
  private addDiatonicSteps(pitch: number, steps: number): number {
    // Diatonic intervals in semitones from each pitch class
    // Starting from C: C->D=2, D->E=2, E->F=1, F->G=2, G->A=2, A->B=2, B->C=1
    const intervals = [2, 2, 1, 2, 2, 2, 1] // intervals from C, D, E, F, G, A, B

    let currentPitch = pitch
    const direction = steps > 0 ? 1 : -1
    const absSteps = Math.abs(steps)

    for (let i = 0; i < absSteps; i++) {
      const currentClass = this.getDiatonicClass(currentPitch)

      if (direction > 0) {
        // Moving up: add interval from current class
        currentPitch += intervals[currentClass]
      } else {
        // Moving down: subtract interval to previous class
        const prevClass = (currentClass + 6) % 7 // Previous diatonic class
        currentPitch -= intervals[prevClass]
      }
    }

    return currentPitch
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
   * Find the closest note to a given X,Y position
   * Used for selecting specific notes in chords
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @param measure - Measure number
   * @param xTolerance - Max X distance in pixels (default 30)
   * @returns The closest note element, or null if none found
   */
  findClosestNote(x: number, y: number, measure: number, xTolerance: number = 30): ElementInfo | null {
    const notes = this.elements.filter(
      el => el.measure === measure && el.type === 'note'
    )

    if (notes.length === 0) return null

    let closest: ElementInfo | null = null
    let minDistance = Infinity

    for (const note of notes) {
      const centerX = note.bbox.x + note.bbox.width / 2
      const xDist = Math.abs(x - centerX)

      // Only consider notes within X tolerance
      if (xDist <= xTolerance) {
        // For chords, notes share the same bbox but have different pitches
        // Use pitch-based Y position for accurate selection
        let noteY: number
        if (note.pitch !== undefined) {
          // Calculate actual Y position from pitch using staff geometry
          const pitchY = this.pitchToPixelY(note.pitch, measure)
          noteY = pitchY !== null ? pitchY : note.bbox.y + note.bbox.height / 2
        } else {
          noteY = note.bbox.y + note.bbox.height / 2
        }

        // Use Euclidean distance for selection
        const distance = Math.sqrt(xDist ** 2 + (y - noteY) ** 2)

        if (distance < minDistance) {
          minDistance = distance
          closest = note
        }
      }
    }

    return closest
  }

  /**
   * Find the closest note or rest to a given X,Y position
   * Used for selecting notes and rests in selection mode
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @param measure - Measure number
   * @param xTolerance - Max X distance in pixels (default 30)
   * @returns The closest note/rest element, or null if none found
   */
  findClosestNoteOrRest(x: number, y: number, measure: number, xTolerance: number = 30): ElementInfo | null {
    const elements = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
    )

    if (elements.length === 0) return null

    let closest: ElementInfo | null = null
    let minDistance = Infinity

    for (const element of elements) {
      const centerX = element.bbox.x + element.bbox.width / 2
      const xDist = Math.abs(x - centerX)

      // Only consider elements within X tolerance
      if (xDist <= xTolerance) {
        let elementY: number

        if (element.type === 'note' && element.pitch !== undefined) {
          // For notes in chords, use pitch-based Y position
          const pitchY = this.pitchToPixelY(element.pitch, measure)
          elementY = pitchY !== null ? pitchY : element.bbox.y + element.bbox.height / 2
        } else {
          // For rests (and notes without pitch), use bbox center
          elementY = element.bbox.y + element.bbox.height / 2
        }

        // Use Euclidean distance for selection
        const distance = Math.sqrt(xDist ** 2 + (y - elementY) ** 2)

        if (distance < minDistance) {
          minDistance = distance
          closest = element
        }
      }
    }

    return closest
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

  /**
   * Find notes/rests to left and right of a given X position
   * For directional note entry logic where:
   * - right element is rest → new note
   * - right element is note → add to chord
   *
   * @param x - Pixel X coordinate
   * @param measure - Measure number
   * @returns Object with nearestLeft and nearestRight elements (can be null)
   */
  findNotesLeftRight(x: number, measure: number): {
    nearestLeft: ElementInfo | null,
    nearestRight: ElementInfo | null,
    leftDistance: number,
    rightDistance: number
  } {
    const notesAndRests = this.elements.filter(
      el => el.measure === measure && (el.type === 'note' || el.type === 'rest')
    )

    let nearestLeft: ElementInfo | null = null
    let nearestRight: ElementInfo | null = null
    let leftDistance = Infinity
    let rightDistance = Infinity

    for (const el of notesAndRests) {
      const centerX = el.bbox.x + el.bbox.width / 2
      const distance = centerX - x  // Positive = right, negative = left

      if (distance <= 0) {
        // Element is to the left (or at click position)
        const absDistance = Math.abs(distance)
        if (absDistance < leftDistance) {
          leftDistance = absDistance
          nearestLeft = el
        }
      }
      if (distance >= 0) {
        // Element is to the right (or at click position)
        if (distance < rightDistance) {
          rightDistance = distance
          nearestRight = el
        }
      }
    }

    return { nearestLeft, nearestRight, leftDistance, rightDistance }
  }

  // ==================== Tuplet Lookup ====================

  /**
   * Find a tuplet bracket at a given coordinate
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @param measure - Measure number
   * @returns The tuplet element info, or null if not found
   */
  getTupletAt(x: number, y: number, measure: number): ElementInfo | null {
    const tuplets = this.elements.filter(
      el => el.type === 'tuplet' && el.measure === measure
    )

    for (const tuplet of tuplets) {
      const b = tuplet.bbox
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return tuplet
      }
    }
    return null
  }

  /**
   * Get a tuplet element by its tuplet ID
   * @param tupletId - The tuplet's unique ID
   * @returns The tuplet element info, or null if not found
   */
  getTupletById(tupletId: string): ElementInfo | null {
    return this.elements.find(el => el.type === 'tuplet' && el.tupletId === tupletId) || null
  }

  /**
   * Get all tuplet elements in a measure
   * @param measure - Measure number
   * @returns Array of tuplet element infos
   */
  getTupletsByMeasure(measure: number): ElementInfo[] {
    return this.elements.filter(el => el.type === 'tuplet' && el.measure === measure)
  }

  /**
   * Get all notes and rests belonging to a specific tuplet
   * @param tupletId - The tuplet's unique ID
   * @returns Array of note/rest element infos that belong to the tuplet
   */
  getNotesByTupletId(tupletId: string): ElementInfo[] {
    return this.elements.filter(
      el => (el.type === 'note' || el.type === 'rest') && el.tupletId === tupletId
    )
  }

  /**
   * Check if an element belongs to a tuplet
   * @param elementId - The note/rest ID
   * @returns The tupletId if the element is in a tuplet, undefined otherwise
   */
  getElementTupletId(elementId: string): string | undefined {
    const element = this.elements.find(el => el.id === elementId)
    return element?.tupletId
  }
}
