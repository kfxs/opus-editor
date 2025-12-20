import { ScoreModel } from './models/ScoreModel'
import { VexFlowRenderer } from './rendering/VexFlowRenderer'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { durationToBeats } from '@/utils/musicUtils'
import type { Score, Note, NoteParams, PixelCoordinates } from '@/types/music'
import type { ElementRegistry, ElementInfo } from './ElementRegistry'

/**
 * Configuration for the MusicEngine
 */
export interface MusicEngineConfig {
  /** Container element for rendering */
  container: HTMLElement
  /** Initial canvas width */
  width?: number
  /** Initial canvas height */
  height?: number
  /** Coordinate mapper configuration */
  coordinateConfig?: Partial<CoordinateMapperConfig>
}

/**
 * MusicEngine is the main API that Developer B will use
 * It coordinates all music engine components (models, rendering, audio, collision)
 */
export class MusicEngine {
  private scoreModel: ScoreModel
  private renderer: VexFlowRenderer
  private coordinateMapper: CoordinateMapper
  private collisionDetector: CollisionDetector
  private playbackEngine: PlaybackEngine

  constructor(config: MusicEngineConfig) {
    this.scoreModel = new ScoreModel()
    this.renderer = new VexFlowRenderer(config.container)

    // Calculate coordinate mapper config based on container size
    const width = config.width || 1000
    const height = config.height || 400
    const numMeasures = 8 // 8 measures total
    const measuresPerLine = 4 // 4 measures per line
    const margin = 20
    const availableWidth = width - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine)

    this.coordinateMapper = new CoordinateMapper({
      measureWidth: staveWidth, // No gaps between measures
      staffHeight: 120 + 30, // staveHeight + verticalSpacing
      startX: margin,
      startY: margin,
      measuresPerLine: measuresPerLine,
      lineSpacing: 10,
      measureLeftMargin: 100,
      ...config.coordinateConfig
    })

    this.collisionDetector = new CollisionDetector()
    this.playbackEngine = new PlaybackEngine()

    // Initialize renderer
    this.renderer.initialize(width, height)

    // Set score in playback engine
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  // ==================== Score Operations ====================

  /**
   * Get the current score
   */
  getScore(): Score {
    return this.scoreModel.getScore()
  }

  /**
   * Set score title
   */
  setTitle(title: string): void {
    this.scoreModel.setTitle(title)
  }

  /**
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scoreModel.setTempo(tempo)
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
  }

  // ==================== Note Operations ====================

  /**
   * Add a note at a specific position
   */
  addNote(params: NoteParams): Note {
    const note = this.scoreModel.addNote(params)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return note
  }

  /**
   * Convert pixel coordinates to musical position using ElementRegistry
   * This is the centralized method for accurate position calculation
   * Uses actual rendered element positions from VexFlow
   * @param duration - Optional duration for beat quantization
   */
  private getPositionFromPixels(
    coords: PixelCoordinates,
    beatsInMeasure: number,
    duration?: NoteParams['duration']
  ): { measure: number; beat: number; pitch: number } {
    const registry = this.renderer.getElementRegistry()
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Get pitch from ElementRegistry (more accurate) with fallback
    let pitch = registry.pixelYToPitch(coords.y, measureNumber)
    if (pitch === null) {
      pitch = this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)
    }

    // Get beat from ElementRegistry or coordinateMapper
    let beat: number
    const nearestElement = registry.findNearestNoteOrRest(coords.x, measureNumber)
    if (nearestElement && nearestElement.beat !== undefined) {
      const elementCenterX = nearestElement.bbox.x + nearestElement.bbox.width / 2
      const distance = Math.abs(coords.x - elementCenterX)
      if (distance < nearestElement.bbox.width * 1.5) {
        beat = nearestElement.beat
      } else {
        beat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
        // Quantize beat if duration provided
        if (duration) {
          const noteDurationInBeats = durationToBeats(duration)
          beat = Math.round(beat / noteDurationInBeats) * noteDurationInBeats
          beat = Math.max(0, Math.min(beat, beatsInMeasure - noteDurationInBeats))
        }
      }
    } else {
      beat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
      // Quantize beat if duration provided
      if (duration) {
        const noteDurationInBeats = durationToBeats(duration)
        beat = Math.round(beat / noteDurationInBeats) * noteDurationInBeats
        beat = Math.max(0, Math.min(beat, beatsInMeasure - noteDurationInBeats))
      }
    }

    return { measure: measureNumber, beat, pitch }
  }

  /**
   * Add a note at pixel coordinates
   *
   * Directional Logic:
   * 1. Find elements to the LEFT and RIGHT of the click position
   * 2. If click is FAR from all elements → use coordinate-based beat calculation
   * 3. Priority: Element to the RIGHT determines behavior
   *    - If RIGHT is a REST → place note at that rest's beat (new note)
   *    - If RIGHT is a NOTE → add to that chord (if different pitch)
   * 4. If only LEFT element and it's close → use LEFT's beat
   * 5. If same pitch collision → find next rest
   */
  addNoteAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: NoteParams['accidental']
  ): Note | null {
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator
    const registry = this.renderer.getElementRegistry()

    // Get measure number from coordinates
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists
    if (!this.scoreModel.getMeasure(measureNumber)) {
      console.log('✗ Invalid: measure does not exist')
      return null
    }

    // Check if click is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor) {
      const invalidTypes = ['clef', 'timeSignature', 'barline', 'keySignature']
      if (invalidTypes.includes(elementAtCursor.type)) {
        console.log(`✗ Invalid: clicked on ${elementAtCursor.type}`)
        return null
      }
    }

    // Check if click is within valid staff area (X range)
    const staffGeometry = registry.getStaffGeometry(measureNumber)
    if (staffGeometry) {
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        console.log('✗ Invalid: X outside note entry area')
        return null
      }

      // Check if click is within valid Y range (reasonable pitch range)
      // Allow ~2 octaves above/below staff (staff lines span ~4 lines = 40px typically)
      const topLineY = staffGeometry.lineYPositions[0]
      const bottomLineY = staffGeometry.lineYPositions[4]
      const staffHeight = bottomLineY - topLineY
      const maxDistance = staffHeight * 2  // Allow 2x staff height above/below

      if (coords.y < topLineY - maxDistance || coords.y > bottomLineY + maxDistance) {
        console.log(`✗ Invalid: Y outside valid range (y=${coords.y.toFixed(0)}, valid=${(topLineY - maxDistance).toFixed(0)}-${(bottomLineY + maxDistance).toFixed(0)})`)
        return null
      }
    }

    // Get pitch from Y coordinate
    let pitch = registry.pixelYToPitch(coords.y, measureNumber)
    if (pitch === null) {
      pitch = this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)
    }

    // Find elements to the left and right of click
    const { nearestLeft, nearestRight, leftDistance, rightDistance } =
      registry.findNotesLeftRight(coords.x, measureNumber)

    // Distance thresholds
    const CLOSE_THRESHOLD = 25   // For preferring left element when very close
    const FAR_THRESHOLD = 40     // Beyond this, use coordinate-based calculation

    // Check if click is far from all elements - use coordinate-based beat
    const nearestDistance = Math.min(
      nearestLeft ? leftDistance : Infinity,
      nearestRight ? rightDistance : Infinity
    )

    let finalBeat: number
    let useCoordinateCalculation = false
    let decisionReason = ''  // For debug logging

    // Get the beat subdivision based on note duration (for quantization)
    const noteDurationInBeats = durationToBeats(duration)

    if (nearestDistance > FAR_THRESHOLD) {
      // Click is far from any element - use coordinate calculation
      // This handles empty/sparse measures where user clicks in open space
      useCoordinateCalculation = true
      const rawBeat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
      // Quantize beat to note duration grid (e.g., quarter notes snap to 0,1,2,3)
      finalBeat = Math.round(rawBeat / noteDurationInBeats) * noteDurationInBeats
      // Clamp to valid range
      finalBeat = Math.max(0, Math.min(finalBeat, beatsInMeasure - noteDurationInBeats))
      decisionReason = `coordCalc (nearest=${nearestDistance.toFixed(0)}px > ${FAR_THRESHOLD}px)`
    } else {
      // Click is near an element - use directional logic
      let targetElement: { type: string; beat: number } | null = null

      if (nearestRight && nearestRight.beat !== undefined && rightDistance <= FAR_THRESHOLD) {
        if (nearestLeft && leftDistance < CLOSE_THRESHOLD && leftDistance < rightDistance) {
          // Click is very close to left element - use it
          targetElement = { type: nearestLeft.type, beat: nearestLeft.beat! }
          decisionReason = `left (close: ${leftDistance.toFixed(0)}px < ${CLOSE_THRESHOLD}px)`
        } else {
          // Use right element (the primary directional logic)
          targetElement = { type: nearestRight.type, beat: nearestRight.beat }
          decisionReason = `right (${rightDistance.toFixed(0)}px)`
        }
      } else if (nearestLeft && nearestLeft.beat !== undefined && leftDistance <= FAR_THRESHOLD) {
        // Only left element available and it's close enough
        targetElement = { type: nearestLeft.type, beat: nearestLeft.beat }
        decisionReason = `left-only (${leftDistance.toFixed(0)}px)`
      }

      if (!targetElement) {
        // No element close enough - fall back to coordinates with quantization
        useCoordinateCalculation = true
        const rawBeat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
        finalBeat = Math.round(rawBeat / noteDurationInBeats) * noteDurationInBeats
        finalBeat = Math.max(0, Math.min(finalBeat, beatsInMeasure - noteDurationInBeats))
        decisionReason = 'coordCalc (no valid target)'
      } else if (targetElement.type === 'rest') {
        // Target is a REST → place note at rest's beat
        finalBeat = targetElement.beat
        decisionReason += ` → rest@${targetElement.beat}`
      } else if (targetElement.type === 'note') {
        // Target is a NOTE → check for collision
        const notesAtBeat = this.scoreModel.getNotesInMeasure(measureNumber)
          .filter(n => !n.isRest && n.beat === targetElement!.beat)

        const hasSamePitch = notesAtBeat.some(n => n.pitch === pitch)

        if (hasSamePitch) {
          // Same pitch exists at this beat → find the next available rest
          const notesInMeasure = this.scoreModel.getNotesInMeasure(measureNumber)
          const nextRest = this.findNextRestAfterBeat(notesInMeasure, targetElement.beat)

          if (nextRest) {
            // Found a rest after this note → place note there
            finalBeat = nextRest.beat
            decisionReason += ` → note@${targetElement.beat} (collision→rest@${nextRest.beat})`
          } else {
            // No rest available after this position
            console.warn('No available rest position after this note')
            return null
          }
        } else {
          // Different pitch → form chord at this beat
          finalBeat = targetElement.beat
          decisionReason += ` → note@${targetElement.beat} (chord)`
        }
      } else {
        // Unknown element type, fall back to coordinate calculation with quantization
        useCoordinateCalculation = true
        const rawBeat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
        finalBeat = Math.round(rawBeat / noteDurationInBeats) * noteDurationInBeats
        finalBeat = Math.max(0, Math.min(finalBeat, beatsInMeasure - noteDurationInBeats))
        decisionReason = 'coordCalc (unknown element type)'
      }
    }

    // When using coordinate calculation, we need to find if there's a rest at that beat
    // or if we'd be creating a new note position
    if (useCoordinateCalculation) {
      const notesInMeasure = this.scoreModel.getNotesInMeasure(measureNumber)
      const restAtBeat = this.findRestAtBeat(notesInMeasure, finalBeat)
      if (!restAtBeat) {
        // Check if there's a note at this beat we could chord with
        const notesAtBeat = notesInMeasure.filter(n => !n.isRest && n.beat === finalBeat)
        if (notesAtBeat.length > 0) {
          // There are notes at this beat - check for collision
          const hasSamePitch = notesAtBeat.some(n => n.pitch === pitch)
          if (hasSamePitch) {
            console.warn('Same pitch collision at calculated beat')
            return null
          }
          // Different pitch - will form chord (continue with finalBeat)
        } else {
          // No rest and no notes at this beat - find nearest rest
          const nearestRest = this.findNearestRestToBeat(notesInMeasure, finalBeat)
          if (nearestRest) {
            finalBeat = nearestRest.beat
          } else {
            console.warn('No available position for note')
            return null
          }
        }
      }
    }

    const noteParams: NoteParams = {
      pitch,
      duration,
      measure: measureNumber,
      beat: finalBeat,
      ...(accidental && { accidental }),
    }

    // Get the target measure for overflow check
    const targetMeasure = this.scoreModel.getMeasure(measureNumber)
    if (!targetMeasure) return null

    // Check for measure overflow
    const overflow = this.collisionDetector.checkMeasureOverflow(
      noteParams,
      targetMeasure,
      this.scoreModel.getNotesInMeasure(measureNumber)
    )

    if (overflow.willOverflow) {
      console.warn('Note would overflow measure:', overflow)
      return null
    }

    // Check for collisions (additional safety check)
    const collision = this.collisionDetector.checkNoteCollision(
      noteParams,
      this.scoreModel.getAllNotes()
    )

    if (collision.hasCollision) {
      console.warn('Note collision detected:', collision.reason)
      return null
    }

    const note = this.addNote(noteParams)

    // Debug logging with full context
    if (note) {
      console.log('NoteEntry:', {
        decision: decisionReason,
        left: nearestLeft ? `${nearestLeft.type}@${nearestLeft.beat} (${leftDistance.toFixed(0)}px)` : null,
        right: nearestRight ? `${nearestRight.type}@${nearestRight.beat} (${rightDistance.toFixed(0)}px)` : null,
        finalBeat,
        coordCalc: useCoordinateCalculation
      })
    }

    return note
  }

  /**
   * Find a rest that covers the given beat position
   * Returns the rest if found, null otherwise
   */
  private findRestAtBeat(notes: Note[], beat: number): Note | null {
    for (const note of notes) {
      if (note.isRest) {
        const restEnd = note.beat + durationToBeats(note.duration)
        // Check if the beat falls within this rest's time span
        if (beat >= note.beat && beat < restEnd) {
          return note
        }
      }
    }
    return null
  }

  /**
   * Find the first rest that starts after the given beat
   * Returns the rest if found, null otherwise
   */
  private findNextRestAfterBeat(notes: Note[], beat: number): Note | null {
    let nextRest: Note | null = null
    let smallestBeatAfter = Infinity

    for (const note of notes) {
      if (note.isRest && note.beat > beat) {
        if (note.beat < smallestBeatAfter) {
          smallestBeatAfter = note.beat
          nextRest = note
        }
      }
    }
    return nextRest
  }

  /**
   * Find the rest nearest to the given beat (before or after)
   * Used when coordinate calculation lands on a beat without a rest
   */
  private findNearestRestToBeat(notes: Note[], targetBeat: number): Note | null {
    let nearestRest: Note | null = null
    let smallestDistance = Infinity

    for (const note of notes) {
      if (note.isRest) {
        const distance = Math.abs(note.beat - targetBeat)
        if (distance < smallestDistance) {
          smallestDistance = distance
          nearestRest = note
        }
      }
    }
    return nearestRest
  }

  /**
   * Add a rest
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: number): Note {
    const rest = this.scoreModel.addRest(duration, measure, beat)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return rest
  }

  /**
   * Update a note
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const note = this.scoreModel.updateNote(noteId, updates)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return note
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    const result = this.scoreModel.deleteNote(noteId)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return result
  }

  /**
   * Get note at pixel position
   */
  getNoteAtPosition(coords: PixelCoordinates, tolerance: number = 10): Note | null {
    const allNotes = this.scoreModel.getAllNotes()
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator

    for (const note of allNotes) {
      const noteCoords = this.coordinateMapper.noteToPixel(note, beatsInMeasure)

      const distance = Math.sqrt(
        Math.pow(noteCoords.x - coords.x, 2) + Math.pow(noteCoords.y - coords.y, 2)
      )

      if (distance <= tolerance) {
        return note
      }
    }

    return null
  }

  /**
   * Clear all notes
   */
  clearAllNotes(): void {
    this.scoreModel.clearAllNotes()
    this.playbackEngine.setScore(this.scoreModel.getScore())
  }

  // ==================== Rendering Operations ====================

  /**
   * Render the score
   */
  renderScore(): void {
    this.renderer.renderScore(this.scoreModel.getScore())
    // Update coordinate mapper with actual VexFlow bounds
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
  }

  /**
   * Render the score with a ghost note preview at mouse position
   * Uses ElementRegistry for accurate beat detection based on rendered element positions
   * @returns true if ghost note was rendered, false otherwise
   */
  renderScoreWithPreview(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: NoteParams['accidental']
  ): boolean {
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) {
      console.warn('No measure found for preview')
      return false
    }
    const beatsInMeasure = measure.timeSignature.numerator
    const registry = this.renderer.getElementRegistry()

    // Check if cursor is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor) {
      const invalidTypes = ['clef', 'timeSignature', 'barline', 'keySignature']
      if (invalidTypes.includes(elementAtCursor.type)) {
        // Don't show ghost note over these elements
        this.renderScore()
        return false
      }
    }

    // Use centralized position calculation with duration for beat quantization
    const position = this.getPositionFromPixels(coords, beatsInMeasure, duration)

    // Validate measure exists
    if (!this.scoreModel.getMeasure(position.measure)) {
      this.renderScore()
      return false
    }

    // Check if cursor is within valid staff area (note entry zone)
    const staffGeometry = registry.getStaffGeometry(position.measure)
    if (staffGeometry) {
      // Check if X is within the note entry area (between noteStartX and noteEndX)
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        // Cursor is outside the note entry area (over clef, time sig, or past barline)
        this.renderScore()
        return false
      }
    }

    // Render score with ghost note
    // Pass raw cursor coordinates for smooth visual positioning
    const ghostNoteRendered = this.renderer.renderScoreWithGhostNote(
      this.scoreModel.getScore(),
      {
        pitch: position.pitch,
        duration,
        measure: position.measure,
        beat: position.beat,
        rawX: coords.x,  // For smooth X positioning (follows cursor)
        rawY: coords.y,  // For reference
        ...(accidental && { accidental }),
      }
    )

    // Update coordinate mapper with actual VexFlow bounds
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    return ghostNoteRendered
  }

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.renderer.clear()
  }

  /**
   * Re-initialize renderer with new dimensions
   */
  resizeCanvas(width: number, height: number): void {
    this.renderer.initialize(width, height)
    this.renderScore()
  }

  // ==================== Coordinate Mapping ====================

  /**
   * Convert pixel coordinates to measure number
   */
  pixelToMeasure(coords: PixelCoordinates): number {
    return this.coordinateMapper.pixelToMeasure(coords)
  }

  /**
   * Convert pixel coordinates to musical position
   * Uses ElementRegistry for accurate position calculation based on actual rendered elements
   */
  pixelToPosition(coords: PixelCoordinates, beatsInMeasure: number) {
    return this.getPositionFromPixels(coords, beatsInMeasure)
  }

  /**
   * Convert note to pixel coordinates
   */
  noteToPixel(note: Note, beatsInMeasure: number): PixelCoordinates {
    return this.coordinateMapper.noteToPixel(note, beatsInMeasure)
  }

  /**
   * Update coordinate mapper configuration
   */
  updateCoordinateConfig(config: Partial<CoordinateMapperConfig>): void {
    this.coordinateMapper.updateConfig(config)
  }

  // ==================== Collision Detection ====================

  /**
   * Check if a note would collide
   */
  checkCollision(noteParams: NoteParams) {
    return this.collisionDetector.checkNoteCollision(noteParams, this.scoreModel.getAllNotes())
  }

  /**
   * Check if adding a note would overflow the measure
   */
  checkOverflow(noteParams: NoteParams) {
    const measure = this.scoreModel.getMeasure(noteParams.measure)
    if (!measure) return null

    return this.collisionDetector.checkMeasureOverflow(
      noteParams,
      measure,
      this.scoreModel.getNotesInMeasure(noteParams.measure)
    )
  }

  /**
   * Find next available position for a note
   */
  findNextAvailablePosition(duration: string, measureNumber: number) {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null

    return this.collisionDetector.findNextAvailablePosition(
      duration,
      measure,
      this.scoreModel.getNotesInMeasure(measureNumber)
    )
  }

  // ==================== Playback Operations ====================

  /**
   * Play the score
   */
  async play(): Promise<void> {
    await this.playbackEngine.play()
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.playbackEngine.pause()
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.playbackEngine.stop()
  }

  /**
   * Seek to a specific measure
   */
  seekToMeasure(measureNumber: number): void {
    this.playbackEngine.seekToMeasure(measureNumber)
  }

  /**
   * Get playback state
   */
  getPlaybackState() {
    return this.playbackEngine.getState()
  }

  /**
   * Get playback position
   */
  getPlaybackPosition() {
    return this.playbackEngine.getPosition()
  }

  /**
   * Set playback volume (0-1)
   */
  setVolume(volume: number): void {
    this.playbackEngine.setVolume(volume)
  }

  /**
   * Register playback callbacks
   */
  setPlaybackCallbacks(callbacks: PlaybackCallbacks): void {
    this.playbackEngine.setCallbacks(callbacks)
  }

  // ==================== Serialization ====================

  /**
   * Export score as JSON
   */
  exportJSON(): string {
    return this.scoreModel.toJSON()
  }

  /**
   * Load score from JSON
   */
  loadJSON(json: string): void {
    const loaded = ScoreModel.fromJSON(json)
    this.scoreModel = loaded
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.renderScore()
  }

  // ==================== Element Registry ====================

  /**
   * Get the element registry (contains positions of all rendered elements)
   */
  getElementRegistry(): ElementRegistry {
    return this.renderer.getElementRegistry()
  }

  /**
   * Find element at a specific pixel coordinate
   */
  getElementAt(coords: PixelCoordinates): ElementInfo | null {
    return this.renderer.getElementRegistry().getAt(coords.x, coords.y)
  }

  /**
   * Find element by its ID (for notes/rests)
   */
  getElementById(id: string): ElementInfo | null {
    return this.renderer.getElementRegistry().getById(id)
  }

  // ==================== Cleanup ====================

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.playbackEngine.dispose()
    this.renderer.clear()
  }
}
