import type { Score, Measure, Note, NoteParams, TimeSignature } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'

/**
 * A whole note equals 4 quarter notes.
 * This constant is used to convert time signature denominators to our internal beat system
 * where quarter note = 1 beat.
 *
 * Examples:
 * - 4/4: beatUnit = 4/4 = 1 (quarter note = 1 beat), totalBeats = 4 * 1 = 4
 * - 7/8: beatUnit = 4/8 = 0.5 (eighth note = 0.5 beats), totalBeats = 7 * 0.5 = 3.5
 * - 3/16: beatUnit = 4/16 = 0.25 (sixteenth = 0.25 beats), totalBeats = 3 * 0.25 = 0.75
 */
const WHOLE_NOTE_IN_QUARTERS = 4

/**
 * ScoreModel manages the musical score data and provides CRUD operations
 * This is the core data model for Developer A's music engine
 */
export class ScoreModel {
  private score: Score

  constructor(title: string = 'Untitled Score', tempo: number = 120) {
    this.score = {
      id: uuidv4(),
      title,
      tempo,
      keySignature: { key: 'C', accidentals: 0 },
      defaultTimeSignature: { numerator: 4, denominator: 4 },
      measures: [],
    }
    // Initialize with one empty measure
    this.addMeasure()
  }

  /**
   * Get the complete score
   */
  getScore(): Score {
    return this.score
  }

  /**
   * Set the score title
   */
  setTitle(title: string): void {
    this.score.title = title
  }

  /**
   * Set the tempo in BPM
   */
  setTempo(tempo: number): void {
    if (tempo < 20 || tempo > 300) {
      throw new Error('Tempo must be between 20 and 300 BPM')
    }
    this.score.tempo = tempo
  }

  /**
   * Add a new measure to the score
   * The measure is automatically filled with rests to match the time signature
   */
  addMeasure(timeSignature?: TimeSignature): Measure {
    const measureNumber = this.score.measures.length + 1
    const ts = timeSignature || this.score.defaultTimeSignature
    const measure: Measure = {
      id: uuidv4(),
      number: measureNumber,
      notes: [],
      timeSignature: ts,
    }
    this.score.measures.push(measure)

    // Fill the measure with rests to match the time signature
    this.fillMeasureWithRests(measure)

    return measure
  }

  /**
   * Calculate total beats in a measure based on its time signature
   * Converts to our internal system where quarter note = 1 beat
   */
  private getMeasureTotalBeats(timeSignature: TimeSignature): number {
    const beatUnit = WHOLE_NOTE_IN_QUARTERS / timeSignature.denominator
    return timeSignature.numerator * beatUnit
  }

  /**
   * Get the beat unit (duration of one "count") for a time signature
   * In 4/4: 1 (quarter note), in 7/8: 0.5 (eighth note), etc.
   */
  private getBeatUnit(timeSignature: TimeSignature): number {
    return WHOLE_NOTE_IN_QUARTERS / timeSignature.denominator
  }

  /**
   * Fill a measure with rests to complete its time signature
   * For 4/4 time, this creates a whole rest (4 beats)
   */
  private fillMeasureWithRests(measure: Measure): void {
    const totalBeats = this.getMeasureTotalBeats(measure.timeSignature)

    // For 4/4 time, use a single whole rest
    if (totalBeats === 4 && measure.timeSignature.denominator === 4) {
      const rest: Note = {
        id: uuidv4(),
        pitch: 0, // Pitch doesn't matter for rests
        duration: 'w', // Whole rest
        measure: measure.number,
        beat: 0,
        isRest: true,
      }
      measure.notes.push(rest)
    } else {
      // For other time signatures, fill with musically appropriate rests
      const rests = this.createMusicalRests(0, totalBeats, measure.timeSignature)
      for (const rest of rests) {
        measure.notes.push({
          id: uuidv4(),
          pitch: 0,
          duration: rest.duration,
          measure: measure.number,
          beat: rest.beat,
          isRest: true,
        })
      }
    }
  }

  /**
   * Get a measure by its number
   */
  getMeasure(measureNumber: number): Measure | undefined {
    return this.score.measures.find(m => m.number === measureNumber)
  }

  /**
   * Remove a measure by its number
   */
  removeMeasure(measureNumber: number): boolean {
    const index = this.score.measures.findIndex(m => m.number === measureNumber)
    if (index === -1) return false

    this.score.measures.splice(index, 1)
    // Renumber subsequent measures
    for (let i = index; i < this.score.measures.length; i++) {
      this.score.measures[i].number = i + 1
      // Update note measure numbers
      this.score.measures[i].notes.forEach(note => {
        note.measure = i + 1
      })
    }
    return true
  }

  /**
   * Add a note to the score
   * If adding a regular note (not a rest), this will replace overlapping rests
   */
  addNote(params: NoteParams): Note {
    const measure = this.getMeasure(params.measure)
    if (!measure) {
      throw new Error(`Measure ${params.measure} does not exist`)
    }

    // Validate pitch (skip validation for rests)
    if (!params.isRest && (params.pitch < 0 || params.pitch > 127)) {
      throw new Error('Pitch must be between 0 and 127')
    }

    const note: Note = {
      id: uuidv4(),
      ...params,
    }

    // If adding a regular note (not a rest), replace overlapping rests
    if (!params.isRest) {
      this.replaceRestsWithNote(measure, note)
    } else {
      measure.notes.push(note)
      measure.notes.sort((a, b) => a.beat - b.beat)
    }

    return note
  }

  /**
   * Replace rests with a new note and fill gaps with new rests
   * Also handles chord formation: when adding a note at the same beat as existing notes,
   * all notes at that beat will have their duration updated to match the new note
   */
  private replaceRestsWithNote(measure: Measure, note: Note): void {
    const noteDuration = this.durationToBeats(note.duration)
    const noteEnd = note.beat + noteDuration

    // Remove all rests that overlap with the note's time range
    const overlappingRests: Note[] = []
    const remainingNotes: Note[] = []

    for (const existing of measure.notes) {
      if (existing.isRest) {
        const existingDuration = this.durationToBeats(existing.duration)
        const existingEnd = existing.beat + existingDuration

        // Check if this rest overlaps with the new note
        const overlaps =
          (note.beat < existingEnd && noteEnd > existing.beat)

        if (overlaps) {
          overlappingRests.push(existing)
        } else {
          remainingNotes.push(existing)
        }
      } else {
        // For regular notes at the same beat (chord formation),
        // update their duration to match the new note's duration
        if (existing.beat === note.beat && existing.duration !== note.duration) {
          existing.duration = note.duration
        }
        remainingNotes.push(existing)
      }
    }

    // Clear the measure and add back non-overlapping notes
    measure.notes = remainingNotes

    // Add the new note
    measure.notes.push(note)

    // Find gaps and fill with rests
    this.fillGapsWithRests(measure)

    // Sort by beat
    measure.notes.sort((a, b) => a.beat - b.beat)
  }

  /**
   * Fill gaps in a measure with rests
   * Uses musical rest placement: fills to beat boundaries first with small rests,
   * then uses larger rests for full beats.
   */
  private fillGapsWithRests(measure: Measure): void {
    const totalBeats = this.getMeasureTotalBeats(measure.timeSignature)

    // Sort notes by beat
    const sortedNotes = [...measure.notes].sort((a, b) => a.beat - b.beat)

    // Find gaps
    const gaps: Array<{ start: number; end: number }> = []
    let currentBeat = 0

    for (const note of sortedNotes) {
      if (note.beat > currentBeat) {
        // There's a gap before this note
        gaps.push({ start: currentBeat, end: note.beat })
      }
      const noteDuration = this.durationToBeats(note.duration)
      currentBeat = note.beat + noteDuration
    }

    // Check for gap at the end
    if (currentBeat < totalBeats) {
      gaps.push({ start: currentBeat, end: totalBeats })
    }

    // Fill each gap with musically appropriate rests
    for (const gap of gaps) {
      const rests = this.createMusicalRests(gap.start, gap.end, measure.timeSignature)
      for (const rest of rests) {
        measure.notes.push({
          id: uuidv4(),
          pitch: 0,
          duration: rest.duration,
          measure: measure.number,
          beat: rest.beat,
          isRest: true,
        })
      }
    }
  }

  /**
   * Create musically appropriate rests for a gap
   * Rules:
   * 1. If not on a beat boundary, use small rests to reach the next beat
   * 2. Once on a beat boundary, use the largest rest that fits
   * @param timeSignature - Used to determine beat boundaries for the time signature
   */
  private createMusicalRests(
    start: number,
    end: number,
    timeSignature: TimeSignature
  ): Array<{ beat: number; duration: Note['duration'] }> {
    const rests: Array<{ beat: number; duration: Note['duration'] }> = []
    let current = start
    const epsilon = 0.001

    // Beat unit determines what counts as a "beat boundary"
    // In 4/4: 1 (quarter), in 7/8: 0.5 (eighth), in 3/16: 0.25 (sixteenth)
    const beatUnit = this.getBeatUnit(timeSignature)

    while (current < end - epsilon) {
      const remaining = end - current
      // Check if we're on a beat boundary for this time signature
      const beatFraction = current % beatUnit
      const isOnBeat = beatFraction < epsilon || beatFraction > beatUnit - epsilon

      if (!isOnBeat) {
        // Not on a beat boundary - use small rests to reach next beat
        const toNextBeat = beatUnit - beatFraction

        // Use smallest rests that fit to reach the beat boundary
        if (toNextBeat >= 0.5 - epsilon && remaining >= 0.5 - epsilon) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (toNextBeat >= 0.25 - epsilon && remaining >= 0.25 - epsilon) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else if (toNextBeat >= 0.125 - epsilon && remaining >= 0.125 - epsilon) {
          rests.push({ beat: current, duration: '32' })
          current += 0.125
        } else {
          break
        }
      } else {
        // On a beat boundary - use largest appropriate rest that ends on a beat boundary
        if (remaining >= 4 - epsilon && Math.abs(current % 4) < epsilon) {
          rests.push({ beat: current, duration: 'w' })
          current += 4
        } else if (remaining >= 2 - epsilon && Math.abs(current % 2) < epsilon) {
          rests.push({ beat: current, duration: 'h' })
          current += 2
        } else if (remaining >= 1 - epsilon && beatUnit <= 1) {
          rests.push({ beat: current, duration: 'q' })
          current += 1
        } else if (remaining >= 0.5 - epsilon && beatUnit <= 0.5) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (remaining >= 0.25 - epsilon && beatUnit <= 0.25) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else if (remaining >= 0.125 - epsilon) {
          rests.push({ beat: current, duration: '32' })
          current += 0.125
        } else if (remaining >= 1 - epsilon) {
          // Fallback for larger beat units
          rests.push({ beat: current, duration: 'q' })
          current += 1
        } else if (remaining >= 0.5 - epsilon) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (remaining >= 0.25 - epsilon) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else {
          break
        }
      }
    }

    return rests
  }

  /**
   * Convert note duration to beats
   */
  private durationToBeats(duration: Note['duration']): number {
    const map: Record<Note['duration'], number> = {
      w: 4,
      h: 2,
      q: 1,
      '8': 0.5,
      '16': 0.25,
      '32': 0.125,
    }
    return map[duration] || 1
  }

  /**
   * Add a rest to the score
   * A rest is a note with isRest=true and pitch=0 (pitch is ignored for rests)
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: number): Note {
    return this.addNote({
      pitch: 0, // Pitch doesn't matter for rests
      duration,
      measure,
      beat,
      isRest: true,
    })
  }

  /**
   * Get a note by its ID
   */
  getNote(noteId: string): Note | undefined {
    for (const measure of this.score.measures) {
      const note = measure.notes.find(n => n.id === noteId)
      if (note) return note
    }
    return undefined
  }

  /**
   * Get all notes in a specific measure
   */
  getNotesInMeasure(measureNumber: number): Note[] {
    const measure = this.getMeasure(measureNumber)
    return measure ? [...measure.notes] : []
  }

  /**
   * Update a note
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const note = this.getNote(noteId)
    if (!note) {
      throw new Error(`Note ${noteId} not found`)
    }

    // If measure is being changed, move the note
    if (updates.measure !== undefined && updates.measure !== note.measure) {
      const oldMeasure = this.getMeasure(note.measure)
      const newMeasure = this.getMeasure(updates.measure)

      if (!newMeasure) {
        throw new Error(`Target measure ${updates.measure} does not exist`)
      }

      // Remove from old measure
      if (oldMeasure) {
        const index = oldMeasure.notes.findIndex(n => n.id === noteId)
        if (index !== -1) {
          oldMeasure.notes.splice(index, 1)
        }
      }

      // Add to new measure
      Object.assign(note, updates)
      newMeasure.notes.push(note)
      newMeasure.notes.sort((a, b) => a.beat - b.beat)
    } else {
      // Update in place
      Object.assign(note, updates)
      // Re-sort if beat changed
      if (updates.beat !== undefined) {
        const measure = this.getMeasure(note.measure)
        if (measure) {
          measure.notes.sort((a, b) => a.beat - b.beat)
        }
      }
    }

    return note
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    for (const measure of this.score.measures) {
      const index = measure.notes.findIndex(n => n.id === noteId)
      if (index !== -1) {
        measure.notes.splice(index, 1)
        return true
      }
    }
    return false
  }

  /**
   * Get all notes in the score
   */
  getAllNotes(): Note[] {
    return this.score.measures.flatMap(m => m.notes)
  }

  /**
   * Clear all notes from the score and refill with rests
   */
  clearAllNotes(): void {
    this.score.measures.forEach(measure => {
      measure.notes = []
      this.fillMeasureWithRests(measure)
    })
  }

  /**
   * Serialize the score to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.score, null, 2)
  }

  /**
   * Load a score from JSON
   */
  static fromJSON(json: string): ScoreModel {
    const scoreData: Score = JSON.parse(json)
    const model = new ScoreModel()
    model.score = scoreData
    return model
  }
}
