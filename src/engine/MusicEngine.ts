import { ScoreModel } from './models/ScoreModel'
import { VexFlowRenderer } from './rendering/VexFlowRenderer'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { UndoRedoManager } from './UndoRedoManager'
import { durationToBeats, splitBeatsIntoDurations, midiToNoteName } from '@/utils/musicUtils'
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
  private undoRedoManager: UndoRedoManager

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
    this.undoRedoManager = new UndoRedoManager()

    // Initialize renderer
    this.renderer.initialize(width, height)

    // Set score in playback engine
    this.playbackEngine.setScore(this.scoreModel.getScore())

    // Save initial state for undo/redo
    this.undoRedoManager.saveInitialState(this.scoreModel.getScore())
  }

  // ==================== Undo/Redo ====================

  /**
   * Save current state to undo history (call after mutations)
   */
  private saveUndoState(description: string): void {
    this.undoRedoManager.pushState(this.scoreModel.getScore(), description)
  }

  /**
   * Undo the last action
   * @returns true if undo was successful
   */
  undo(): boolean {
    const previousState = this.undoRedoManager.undo()
    if (!previousState) return false

    // Restore the state
    this.scoreModel = ScoreModel.fromJSON(JSON.stringify(previousState))
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return true
  }

  /**
   * Redo the last undone action
   * @returns true if redo was successful
   */
  redo(): boolean {
    const nextState = this.undoRedoManager.redo()
    if (!nextState) return false

    // Restore the state
    this.scoreModel = ScoreModel.fromJSON(JSON.stringify(nextState))
    this.playbackEngine.setScore(this.scoreModel.getScore())
    return true
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoRedoManager.canUndo()
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoRedoManager.canRedo()
  }

  /**
   * Get description of action that would be undone
   */
  getUndoDescription(): string | null {
    return this.undoRedoManager.getUndoDescription()
  }

  /**
   * Get description of action that would be redone
   */
  getRedoDescription(): string | null {
    return this.undoRedoManager.getRedoDescription()
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
    this.saveUndoState(`Set title to "${title}"`)
  }

  /**
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scoreModel.setTempo(tempo)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState(`Set tempo to ${tempo}`)
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
    this.saveUndoState('Add measure')
  }

  // ==================== Note Operations ====================

  /**
   * Add a note at a specific position (internal - use addNoteAtPosition for UI)
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
        // Target is a NOTE → overwrite or form chord
        // In overwrite mode (like Finale), clicking on a note replaces it with the new duration
        finalBeat = targetElement.beat
        decisionReason += ` → note@${targetElement.beat} (overwrite/chord)`
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

    // Find and delete notes that would be overwritten by this note
    // This includes: notes within the duration range AND same-pitch notes at same beat (replacement)
    const notesToOverwrite = this.findNotesToOverwrite(measureNumber, finalBeat, duration, pitch)
    if (notesToOverwrite.length > 0) {
      console.log('Overwriting notes:', notesToOverwrite.map(n => `pitch:${n.pitch}@beat:${n.beat}`).join(', '))
      for (const noteToDelete of notesToOverwrite) {
        this.scoreModel.deleteNote(noteToDelete.id)
      }
    }

    // Handle overflow by splitting note across bar line with tie
    if (overflow.willOverflow && overflow.overflowAmount) {
      // Also update existing chord notes at the same beat to have the same duration and ties
      const existingChordNotes = this.scoreModel.getNotesInMeasure(measureNumber)
        .filter(n => !n.isRest && Math.abs(n.beat - finalBeat) < 0.001 && n.pitch !== pitch)

      // Split each existing chord note with ties
      for (const chordNote of existingChordNotes) {
        this.splitExistingNoteWithTie(chordNote, duration, overflow.overflowAmount)
      }

      const splitNote = this.addSplitNoteWithTie(noteParams, overflow.overflowAmount)
      if (splitNote) {
        const noteName = midiToNoteName(noteParams.pitch)
        this.saveUndoState(`Add ${noteName}`)
      }
      return splitNote
    }

    // For non-overflow cases, update existing chord notes to match duration
    const existingChordNotes = this.scoreModel.getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && Math.abs(n.beat - finalBeat) < 0.001 && n.pitch !== pitch)
    for (const chordNote of existingChordNotes) {
      if (chordNote.duration !== duration) {
        this.scoreModel.updateNote(chordNote.id, { duration })
      }
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

      // Save undo state for the complete add operation
      const noteName = midiToNoteName(pitch)
      this.saveUndoState(`Add ${noteName}`)
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
   * Split an existing note with a tie when its duration changes to overflow
   * @param existingNote - The existing note to split
   * @param newDuration - The new duration to apply
   * @param overflowAmount - Amount of beats that overflow into next measure
   */
  private splitExistingNoteWithTie(existingNote: Note, newDuration: NoteParams['duration'], overflowAmount: number): void {
    const totalBeats = durationToBeats(newDuration)
    const beatsInCurrentMeasure = totalBeats - overflowAmount
    const beatsInNextMeasure = overflowAmount

    // Get durations for each part
    const currentMeasureDurations = splitBeatsIntoDurations(beatsInCurrentMeasure)
    const nextMeasureDurations = splitBeatsIntoDurations(beatsInNextMeasure)

    if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
      console.warn('Could not split existing note into valid durations')
      return
    }

    // Update the existing note's duration to the first part
    this.scoreModel.updateNote(existingNote.id, { duration: currentMeasureDurations[0] })

    // Check if next measure exists, if not create it
    const nextMeasureNumber = existingNote.measure + 1
    if (!this.scoreModel.getMeasure(nextMeasureNumber)) {
      while (!this.scoreModel.getMeasure(nextMeasureNumber)) {
        this.scoreModel.addMeasure()
      }
    }

    // Add tied continuation note in next measure
    let previousNoteId = existingNote.id
    let nextBeat = 0

    for (const duration of nextMeasureDurations) {
      const continuationNote = this.addNote({
        pitch: existingNote.pitch,
        duration,
        measure: nextMeasureNumber,
        beat: nextBeat,
        ...(existingNote.accidental && { accidental: existingNote.accidental }),
      })

      // Link with tie
      this.scoreModel.updateNote(previousNoteId, { tiedTo: continuationNote.id })
      this.scoreModel.updateNote(continuationNote.id, { tiedFrom: previousNoteId })

      previousNoteId = continuationNote.id
      nextBeat += durationToBeats(duration)
    }

    console.log('Split existing chord note with tie:', {
      noteId: existingNote.id,
      pitch: existingNote.pitch,
      currentDuration: currentMeasureDurations[0],
      nextDurations: nextMeasureDurations,
    })
  }

  /**
   * Add a note that spans across bar line by splitting it with a tie
   * @param noteParams - Original note parameters
   * @param overflowAmount - Amount of beats that overflow into next measure
   * @returns The first note (in current measure) or null if failed
   */
  private addSplitNoteWithTie(noteParams: NoteParams, overflowAmount: number): Note | null {
    const totalBeats = durationToBeats(noteParams.duration)
    const beatsInCurrentMeasure = totalBeats - overflowAmount
    const beatsInNextMeasure = overflowAmount

    // Get durations for each part
    const currentMeasureDurations = splitBeatsIntoDurations(beatsInCurrentMeasure)
    const nextMeasureDurations = splitBeatsIntoDurations(beatsInNextMeasure)

    if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
      console.warn('Could not split note into valid durations')
      return null
    }

    // Check if next measure exists, if not create it
    const nextMeasureNumber = noteParams.measure + 1
    let nextMeasure = this.scoreModel.getMeasure(nextMeasureNumber)
    if (!nextMeasure) {
      // Add measures until we have the next one
      while (!this.scoreModel.getMeasure(nextMeasureNumber)) {
        this.scoreModel.addMeasure()
      }
      nextMeasure = this.scoreModel.getMeasure(nextMeasureNumber)
    }

    // Delete notes that would be overwritten in the next measure
    const notesToOverwriteNext = this.findNotesToOverwrite(nextMeasureNumber, 0, nextMeasureDurations[0], noteParams.pitch)
    for (const noteToDelete of notesToOverwriteNext) {
      this.scoreModel.deleteNote(noteToDelete.id)
    }

    // Add notes in current measure (may need multiple if duration splits, e.g., dotted notes)
    let currentBeat = noteParams.beat
    let firstNote: Note | null = null
    let previousNote: Note | null = null

    for (const duration of currentMeasureDurations) {
      const note = this.addNote({
        ...noteParams,
        duration,
        beat: currentBeat,
      })
      if (!firstNote) firstNote = note

      // Link with previous note in current measure if there are multiple
      if (previousNote) {
        this.scoreModel.updateNote(previousNote.id, { tiedTo: note.id })
        this.scoreModel.updateNote(note.id, { tiedFrom: previousNote.id })
      }

      previousNote = note
      currentBeat += durationToBeats(duration)
    }

    // Add notes in next measure
    let nextBeat = 0
    for (const duration of nextMeasureDurations) {
      const note = this.addNote({
        pitch: noteParams.pitch,
        duration,
        measure: nextMeasureNumber,
        beat: nextBeat,
        ...(noteParams.accidental && { accidental: noteParams.accidental }),
      })

      // Link with previous note (tie across bar line)
      if (previousNote) {
        this.scoreModel.updateNote(previousNote.id, { tiedTo: note.id })
        this.scoreModel.updateNote(note.id, { tiedFrom: previousNote.id })
      }

      previousNote = note
      nextBeat += durationToBeats(duration)
    }

    console.log('Split note with tie:', {
      currentMeasure: noteParams.measure,
      currentDurations: currentMeasureDurations,
      nextMeasure: nextMeasureNumber,
      nextDurations: nextMeasureDurations,
    })

    return firstNote
  }

  /**
   * Find notes that would be overwritten by a new note
   * This returns notes that fall within the new note's duration range.
   * Notes at the same beat with DIFFERENT pitch are kept (chords).
   * Notes at the same beat with SAME pitch are deleted (replacement).
   */
  private findNotesToOverwrite(
    measureNumber: number,
    beat: number,
    duration: NoteParams['duration'],
    pitch: number
  ): Note[] {
    const noteDurationInBeats = durationToBeats(duration)
    const noteEnd = beat + noteDurationInBeats
    const notesInMeasure = this.scoreModel.getNotesInMeasure(measureNumber)

    return notesInMeasure.filter(existing => {
      // Skip rests - they're handled separately by ScoreModel
      if (existing.isRest) return false

      // Notes at the same beat: only delete if same pitch (replacement)
      // Different pitch at same beat = chord (keep it)
      if (Math.abs(existing.beat - beat) < 0.001) {
        return existing.pitch === pitch  // Delete if same pitch (replacement)
      }

      // Check if this note starts within the new note's time range
      // A note should be deleted if it starts after our beat but before our end
      if (existing.beat > beat && existing.beat < noteEnd) {
        return true
      }

      return false
    })
  }

  /**
   * Add a rest
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: number): Note {
    const rest = this.scoreModel.addRest(duration, measure, beat)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Add rest')
    return rest
  }

  /**
   * Update a note
   * When duration is shortened, fills the gap with rests
   * When duration is lengthened, removes overlapping notes/rests
   * Duration is limited to fit within the current measure (no bar line crossing)
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    // Get the note before update to check if duration is changing
    const existingNote = this.scoreModel.getNote(noteId)
    if (!existingNote) {
      throw new Error(`Note ${noteId} not found`)
    }

    const oldDuration = existingNote.duration
    let newDuration = updates.duration || oldDuration

    // Find all notes in the same chord (same measure, same beat, non-rest)
    // All notes in a chord must have the same duration
    const measureNotes = this.scoreModel.getNotesInMeasure(existingNote.measure)
    const chordNotes = measureNotes.filter(
      n => !n.isRest && Math.abs(n.beat - existingNote.beat) < 0.001
    )
    const isChord = chordNotes.length > 1

    // Limit duration to fit within the measure
    const measure = this.scoreModel.getMeasure(existingNote.measure)
    if (measure && updates.duration) {
      const timeSignature = measure.timeSignature
      const measureTotalBeats = (4 / timeSignature.denominator) * timeSignature.numerator
      const availableBeats = measureTotalBeats - existingNote.beat
      const requestedBeats = durationToBeats(updates.duration)

      if (requestedBeats > availableBeats + 0.001) {
        // Find the largest duration that fits
        const fittingDuration = this.findLargestFittingDuration(availableBeats)
        if (fittingDuration) {
          newDuration = fittingDuration
          updates = { ...updates, duration: fittingDuration }
        } else {
          // No standard duration fits, keep the old duration
          newDuration = oldDuration
          delete updates.duration
        }
      }
    }

    // Calculate beat difference if duration is changing
    const oldBeats = durationToBeats(oldDuration)
    const newBeats = durationToBeats(newDuration)
    const beatDifference = oldBeats - newBeats

    // If duration is being lengthened, remove overlapping notes/rests first
    if (beatDifference < -0.001) {
      const noteEndBeat = existingNote.beat + newBeats

      // Find notes/rests that overlap with the new extended duration
      // These are notes that start after the original note ends but before the new end
      // Exclude notes that are part of the same chord
      const chordNoteIds = new Set(chordNotes.map(n => n.id))
      const notesToRemove: string[] = []
      let beatsToRecover = 0

      for (const n of measureNotes) {
        // Skip the note/rest being updated and other notes in the same chord
        if (n.id === noteId || chordNoteIds.has(n.id)) continue

        const nStart = n.beat
        const nEnd = n.beat + durationToBeats(n.duration)

        // Check if this note overlaps with the extended range
        // The extended range is from (existingNote.beat + oldBeats) to (existingNote.beat + newBeats)
        if (nStart >= existingNote.beat + oldBeats && nStart < noteEndBeat) {
          // This note starts within the extended range - remove it entirely
          notesToRemove.push(n.id)
          beatsToRecover += durationToBeats(n.duration)
        } else if (nStart < existingNote.beat + oldBeats && nEnd > existingNote.beat + oldBeats && nEnd <= noteEndBeat) {
          // This note starts before but extends into the range - remove it
          notesToRemove.push(n.id)
          beatsToRecover += durationToBeats(n.duration)
        }
      }

      // Remove overlapping notes
      for (const id of notesToRemove) {
        this.scoreModel.deleteNote(id)
      }

      // If we removed more beats than needed, add rests to fill the gap
      const beatsNeeded = Math.abs(beatDifference)
      const excessBeats = beatsToRecover - beatsNeeded

      if (excessBeats > 0.001) {
        const restStartBeat = noteEndBeat
        const restDurations = splitBeatsIntoDurations(excessBeats)

        let currentBeat = restStartBeat
        for (const restDuration of restDurations) {
          this.scoreModel.addRest(restDuration, existingNote.measure, currentBeat)
          currentBeat += durationToBeats(restDuration)
        }
      }
    }

    // Update all notes in the chord if duration is changing
    // All notes in a chord must have the same duration
    if (isChord && updates.duration) {
      for (const chordNote of chordNotes) {
        // Update each chord note's duration (but only duration, not other properties)
        this.scoreModel.updateNote(chordNote.id, { duration: updates.duration })
      }
      // Now update the target note with all requested updates (pitch, accidental, etc.)
      // Duration is already set, but include it to ensure consistency
      const note = this.scoreModel.updateNote(noteId, updates)

      // If duration was shortened, fill the gap with rests
      if (beatDifference > 0.001) {
        const restStartBeat = note.beat + newBeats
        const restDurations = splitBeatsIntoDurations(beatDifference)

        let currentBeat = restStartBeat
        for (const restDuration of restDurations) {
          this.scoreModel.addRest(restDuration, note.measure, currentBeat)
          currentBeat += durationToBeats(restDuration)
        }
      }

      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState('Update note')
      return note
    }

    // Single note update (not part of a chord)
    const note = this.scoreModel.updateNote(noteId, updates)

    // If duration was shortened, fill the gap with rests
    if (beatDifference > 0.001) {
      const restStartBeat = note.beat + newBeats
      const restDurations = splitBeatsIntoDurations(beatDifference)

      let currentBeat = restStartBeat
      for (const restDuration of restDurations) {
        this.scoreModel.addRest(restDuration, note.measure, currentBeat)
        currentBeat += durationToBeats(restDuration)
      }
    }

    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Update note')
    return note
  }

  /**
   * Find the largest standard note duration that fits within available beats
   */
  private findLargestFittingDuration(availableBeats: number): NoteParams['duration'] | null {
    const durations: { duration: NoteParams['duration']; beats: number }[] = [
      { duration: 'w', beats: 4 },
      { duration: 'h', beats: 2 },
      { duration: 'q', beats: 1 },
      { duration: '8', beats: 0.5 },
      { duration: '16', beats: 0.25 },
      { duration: '32', beats: 0.125 },
    ]

    for (const { duration, beats } of durations) {
      if (beats <= availableBeats + 0.001) {
        return duration
      }
    }
    return null
  }

  /**
   * Get a note by ID
   */
  getNote(noteId: string): Note | undefined {
    return this.scoreModel.getNote(noteId)
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    // Get note info before deleting for undo description
    const note = this.scoreModel.getNote(noteId)
    const description = note && !note.isRest
      ? `Delete ${midiToNoteName(note.pitch)}`
      : 'Delete rest'

    const result = this.scoreModel.deleteNote(noteId)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    if (result) {
      this.saveUndoState(description)
    }
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
    this.saveUndoState('Clear all notes')
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
    // Reset undo history with loaded state as initial
    this.undoRedoManager.saveInitialState(this.scoreModel.getScore())
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
