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

  /**
   * Clear all stored elements (call before each render)
   */
  clear(): void {
    this.elements = []
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
}
