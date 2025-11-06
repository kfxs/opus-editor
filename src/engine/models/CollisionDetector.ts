import type { Note, NoteParams, Measure, TimeSignature } from '@/types/music'
import { durationToBeats, getMeasureDuration } from '@/utils/musicUtils'

/**
 * Result of a collision check
 */
export interface CollisionResult {
  /** Whether a collision was detected */
  hasCollision: boolean
  /** IDs of notes that collide */
  collidingNotes: string[]
  /** Reason for collision */
  reason?: string
}

/**
 * Result of an overflow check
 */
export interface OverflowResult {
  /** Whether the measure would overflow */
  willOverflow: boolean
  /** Amount of overflow in beats */
  overflowAmount?: number
  /** Suggested next measure for overflow notes */
  suggestedMeasure?: number
}

/**
 * CollisionDetector handles note collision detection and measure overflow checks
 */
export class CollisionDetector {
  /**
   * Check if a new note would collide with existing notes
   *
   * Collision rules:
   * 1. Same beat + same pitch + same duration = DUPLICATE (collision)
   * 2. Same beat + different pitch + same duration = CHORD (allowed)
   * 3. Overlapping time but different beats = COLLISION (not allowed)
   */
  checkNoteCollision(newNote: NoteParams, existingNotes: Note[]): CollisionResult {
    const newNoteDuration = durationToBeats(newNote.duration)
    const newNoteEnd = newNote.beat + newNoteDuration

    const collidingNotes: string[] = []

    for (const existing of existingNotes) {
      // Skip notes in different measures
      if (existing.measure !== newNote.measure) continue

      // Skip rests - they don't participate in chords
      if (existing.isRest) continue

      const existingDuration = durationToBeats(existing.duration)
      const existingEnd = existing.beat + existingDuration

      // Check if notes start at the EXACT same beat position
      const sameStartBeat = Math.abs(newNote.beat - existing.beat) < 0.001 // tolerance for floating point

      if (sameStartBeat) {
        // Notes starting at same beat - check if they form a chord or duplicate
        const samePitch = existing.pitch === newNote.pitch
        const sameDuration = Math.abs(newNoteDuration - existingDuration) < 0.001

        if (samePitch && sameDuration) {
          // Exact duplicate note - reject
          collidingNotes.push(existing.id)
        }
        // Different pitch or duration at same beat = chord (allowed, no collision)
      } else {
        // Different start beats - check for partial time overlap (true collision)
        const timeOverlap =
          (newNote.beat > existing.beat && newNote.beat < existingEnd) ||
          (newNoteEnd > existing.beat && newNoteEnd < existingEnd) ||
          (newNote.beat <= existing.beat && newNoteEnd >= existingEnd)

        if (timeOverlap) {
          collidingNotes.push(existing.id)
        }
      }
    }

    return {
      hasCollision: collidingNotes.length > 0,
      collidingNotes,
      reason: collidingNotes.length > 0 ? 'Note overlaps with existing note(s) or is a duplicate' : undefined,
    }
  }

  /**
   * Check if adding a note would cause measure overflow
   */
  checkMeasureOverflow(
    note: NoteParams,
    measure: Measure,
    existingNotes: Note[]
  ): OverflowResult {
    const noteDuration = durationToBeats(note.duration)
    const noteEnd = note.beat + noteDuration
    const measureDuration = getMeasureDuration(measure.timeSignature)

    // Check if note extends beyond measure
    if (noteEnd > measureDuration) {
      return {
        willOverflow: true,
        overflowAmount: noteEnd - measureDuration,
        suggestedMeasure: measure.number + 1,
      }
    }

    return {
      willOverflow: false,
    }
  }

  /**
   * Find the next available position in a measure for a note
   * Returns null if no space is available
   */
  findNextAvailablePosition(
    duration: string,
    measure: Measure,
    existingNotes: Note[],
    startFromBeat: number = 0
  ): number | null {
    const noteDuration = durationToBeats(duration as any)
    const measureDuration = getMeasureDuration(measure.timeSignature)

    // Sort notes by beat
    const sortedNotes = [...existingNotes].sort((a, b) => a.beat - b.beat)

    let currentBeat = startFromBeat

    for (const note of sortedNotes) {
      const noteEnd = note.beat + durationToBeats(note.duration)

      // Can we fit before this note?
      if (currentBeat + noteDuration <= note.beat) {
        return currentBeat
      }

      // Move to after this note
      currentBeat = Math.max(currentBeat, noteEnd)
    }

    // Can we fit at the end?
    if (currentBeat + noteDuration <= measureDuration) {
      return currentBeat
    }

    return null // No space available
  }

  /**
   * Get all notes that would be affected by inserting a note at a position
   * This includes notes that would need to be moved or split
   */
  getAffectedNotes(newNote: NoteParams, existingNotes: Note[]): Note[] {
    const newNoteDuration = durationToBeats(newNote.duration)
    const newNoteEnd = newNote.beat + newNoteDuration

    return existingNotes.filter(note => {
      if (note.measure !== newNote.measure) return false

      const noteDuration = durationToBeats(note.duration)
      const noteEnd = note.beat + noteDuration

      // Check for any overlap in time
      return (
        (newNote.beat >= note.beat && newNote.beat < noteEnd) ||
        (newNoteEnd > note.beat && newNoteEnd <= noteEnd) ||
        (newNote.beat <= note.beat && newNoteEnd >= noteEnd)
      )
    })
  }

  /**
   * Calculate total duration used in a measure
   */
  getMeasureUsage(measure: Measure, notes: Note[]): {
    used: number
    available: number
    percentage: number
  } {
    const measureDuration = getMeasureDuration(measure.timeSignature)
    const measureNotes = notes.filter(n => n.measure === measure.number)

    // Find the latest end point
    let maxEnd = 0
    for (const note of measureNotes) {
      const noteEnd = note.beat + durationToBeats(note.duration)
      maxEnd = Math.max(maxEnd, noteEnd)
    }

    return {
      used: maxEnd,
      available: measureDuration - maxEnd,
      percentage: (maxEnd / measureDuration) * 100,
    }
  }

  /**
   * Validate that all notes in a measure fit within its time signature
   */
  validateMeasure(measure: Measure, notes: Note[]): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    const measureDuration = getMeasureDuration(measure.timeSignature)
    const measureNotes = notes.filter(n => n.measure === measure.number)

    for (const note of measureNotes) {
      const noteEnd = note.beat + durationToBeats(note.duration)

      if (noteEnd > measureDuration) {
        errors.push(
          `Note ${note.id} extends beyond measure (ends at ${noteEnd}, measure duration is ${measureDuration})`
        )
      }

      if (note.beat < 0) {
        errors.push(`Note ${note.id} has negative beat position: ${note.beat}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Suggest automatic note quantization to fit in measure
   * Quantizes beat positions to nearest valid subdivision
   */
  quantizeNote(
    note: NoteParams,
    timeSignature: TimeSignature,
    subdivision: number = 4
  ): NoteParams {
    const measureDuration = getMeasureDuration(timeSignature)
    const quantum = measureDuration / subdivision

    const quantizedBeat = Math.round(note.beat / quantum) * quantum

    return {
      ...note,
      beat: Math.max(0, Math.min(quantizedBeat, measureDuration - durationToBeats(note.duration))),
    }
  }
}
