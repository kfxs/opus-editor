import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration } from '@/types/music'
import { getTupletTotalBeats, getTupletBeatPositions, isBeatInTuplet } from '@/utils/musicUtils'
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
      tuplets: [],
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
   *
   * Tuplet handling:
   * - If the note already has a tupletId, it's added as-is
   * - If replacing a tuplet rest, the note inherits the tuplet's ID
   * - Notes within tuplets use the tuplet's beat positioning
   */
  private replaceRestsWithNote(measure: Measure, note: Note): void {
    // Use tuplet-aware duration calculation
    // If the note has a tupletId, it's a tuplet note with adjusted duration
    const noteDuration = this.getActualNoteDuration(note, measure)
    const noteEnd = note.beat + noteDuration

    // Remove all rests that overlap with the note's time range
    const overlappingRests: Note[] = []
    const remainingNotes: Note[] = []

    // Track if we're replacing a tuplet rest
    let inheritedTupletId: string | undefined = note.tupletId

    // Use epsilon for floating point comparisons (important for tuplet fractions like 1/3)
    const epsilon = 0.001

    for (const existing of measure.notes) {
      if (existing.isRest) {
        // Use tuplet-aware duration for existing rests too
        const existingDuration = this.getActualNoteDuration(existing, measure)
        const existingEnd = existing.beat + existingDuration

        // Check if this rest overlaps with the new note
        // Use epsilon tolerance to avoid false positives from floating point errors
        // Two adjacent notes (one ending at beat X, another starting at beat X) should NOT overlap
        const overlaps =
          (note.beat + epsilon < existingEnd && noteEnd - epsilon > existing.beat)

        if (overlaps) {
          overlappingRests.push(existing)
          // If replacing a tuplet rest, inherit its tupletId
          if (existing.tupletId && !note.tupletId) {
            inheritedTupletId = existing.tupletId
          }
        } else {
          remainingNotes.push(existing)
        }
      } else {
        // For regular notes at the same beat (chord formation),
        // update their duration and dots to match the new note
        if (Math.abs(existing.beat - note.beat) < 0.001) {
          const existingDots = existing.dots || 0
          const noteDots = note.dots || 0
          // Don't update duration for tuplet notes (they have their own timing)
          if (!existing.tupletId && !note.tupletId) {
            if (existing.duration !== note.duration || existingDots !== noteDots) {
              existing.duration = note.duration
              existing.dots = noteDots
            }
          }
        }
        remainingNotes.push(existing)
      }
    }

    // Clear the measure and add back non-overlapping notes
    measure.notes = remainingNotes

    // Apply inherited tupletId if applicable
    if (inheritedTupletId && !note.tupletId) {
      note.tupletId = inheritedTupletId
    }

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
   * Skips any gaps that fall within tuplet time spans (tuplets manage their own rests)
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
      // Use tuplet-aware duration calculation
      const noteDuration = this.getActualNoteDuration(note, measure)
      currentBeat = note.beat + noteDuration
    }

    // Check for gap at the end
    if (currentBeat < totalBeats) {
      gaps.push({ start: currentBeat, end: totalBeats })
    }

    // Filter out gaps that fall within tuplet time spans
    // Tuplets manage their own internal rests
    const tuplets = measure.tuplets || []
    const epsilon = 0.001
    const filteredGaps = gaps.filter(gap => {
      // Check if this gap is entirely within a tuplet
      for (const tuplet of tuplets) {
        const tupletEnd = tuplet.startBeat + getTupletTotalBeats(tuplet.baseDuration, tuplet.notesOccupied)
        // Skip this gap if it starts within a tuplet
        // Use epsilon tolerance for floating point comparisons
        // (tuplet note durations can cause cumulative floating point errors)
        if (gap.start >= tuplet.startBeat - epsilon && gap.start < tupletEnd - epsilon) {
          return false
        }
      }
      return true
    })

    // Fill each gap with musically appropriate rests
    for (const gap of filteredGaps) {
      // Adjust gap boundaries to avoid overlapping with tuplets
      let adjustedStart = gap.start
      let adjustedEnd = gap.end

      for (const tuplet of tuplets) {
        // If tuplet is within gap, split around it
        if (tuplet.startBeat > adjustedStart && tuplet.startBeat < adjustedEnd) {
          adjustedEnd = tuplet.startBeat
        }
      }

      if (adjustedEnd <= adjustedStart) continue

      const rests = this.createMusicalRests(adjustedStart, adjustedEnd, measure.timeSignature)
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
        } else if (remaining >= 0.5 - epsilon) {
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
  private durationToBeats(duration: Note['duration'], dots: number = 0): number {
    const map: Record<Note['duration'], number> = {
      w: 4,
      h: 2,
      q: 1,
      '8': 0.5,
      '16': 0.25,
      '32': 0.125,
    }
    const baseBeats = map[duration] || 1
    // Apply dot multiplier: 1 dot = 1.5x, 2 dots = 1.75x, etc.
    const dotMultiplier = dots > 0 ? 2 - Math.pow(0.5, dots) : 1
    return baseBeats * dotMultiplier
  }

  /**
   * Calculate actual note duration accounting for tuplet timing
   * Tuplet notes have shorter actual durations: base * (notesOccupied / numNotes)
   * For a triplet (3:2), each note is 2/3 of its normal duration
   */
  private getActualNoteDuration(note: Note, measure: Measure): number {
    const baseDuration = this.durationToBeats(note.duration, note.dots || 0)

    if (note.tupletId && measure.tuplets) {
      const tuplet = measure.tuplets.find(t => t.id === note.tupletId)
      if (tuplet) {
        // Tuplet adjusts duration: actual = base * (notesOccupied / numNotes)
        return baseDuration * (tuplet.notesOccupied / tuplet.numNotes)
      }
    }

    return baseDuration
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

  // ==================== Tuplet Operations ====================

  /**
   * Create a tuplet in a measure
   * This creates the tuplet and fills it with rests at each tuplet beat position
   * @param measureNumber - Measure number (1-indexed)
   * @param startBeat - Starting beat position
   * @param baseDuration - Base note duration for the tuplet
   * @param numNotes - Number of notes in the tuplet (default: 3 for triplet)
   * @param notesOccupied - Number of base notes the tuplet spans (default: 2 for triplet)
   * @returns The created tuplet
   */
  createTuplet(
    measureNumber: number,
    startBeat: number,
    baseDuration: NoteDuration,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): Tuplet {
    const measure = this.getMeasure(measureNumber)
    if (!measure) {
      throw new Error(`Measure ${measureNumber} does not exist`)
    }

    // Create the tuplet
    const tuplet: Tuplet = {
      id: uuidv4(),
      startBeat,
      baseDuration,
      numNotes,
      notesOccupied,
    }

    // Initialize tuplets array if needed
    if (!measure.tuplets) {
      measure.tuplets = []
    }
    measure.tuplets.push(tuplet)

    // Remove any existing notes/rests that overlap with the tuplet's time span
    // Use getActualNoteDuration to correctly handle existing tuplet notes
    // (their durations are shorter than base duration)
    const tupletEnd = startBeat + getTupletTotalBeats(baseDuration, notesOccupied)
    const epsilon = 0.001
    measure.notes = measure.notes.filter(note => {
      const noteDuration = this.getActualNoteDuration(note, measure)
      const noteEnd = note.beat + noteDuration
      // Keep if note doesn't overlap with tuplet (with epsilon tolerance)
      return noteEnd <= startBeat + epsilon || note.beat >= tupletEnd - epsilon
    })

    // Create rests at each tuplet beat position
    const beatPositions = getTupletBeatPositions(startBeat, baseDuration, numNotes, notesOccupied)
    for (const beat of beatPositions) {
      const rest: Note = {
        id: uuidv4(),
        pitch: 0,
        duration: baseDuration,
        measure: measureNumber,
        beat,
        isRest: true,
        tupletId: tuplet.id,
      }
      measure.notes.push(rest)
    }

    // Sort notes by beat
    measure.notes.sort((a, b) => a.beat - b.beat)

    return tuplet
  }

  /**
   * Get a tuplet by its ID
   */
  getTuplet(tupletId: string): Tuplet | undefined {
    for (const measure of this.score.measures) {
      if (!measure.tuplets) continue
      const tuplet = measure.tuplets.find(t => t.id === tupletId)
      if (tuplet) return tuplet
    }
    return undefined
  }

  /**
   * Get the tuplet at a specific beat position in a measure
   * @param measureNumber - Measure number (1-indexed)
   * @param beat - Beat position to check
   * @returns The tuplet at that beat, or undefined
   */
  getTupletAtBeat(measureNumber: number, beat: number): Tuplet | undefined {
    const measure = this.getMeasure(measureNumber)
    if (!measure || !measure.tuplets) return undefined

    return measure.tuplets.find(tuplet => isBeatInTuplet(beat, tuplet))
  }

  /**
   * Get all notes that belong to a specific tuplet
   */
  getNotesInTuplet(tupletId: string): Note[] {
    for (const measure of this.score.measures) {
      const notes = measure.notes.filter(n => n.tupletId === tupletId)
      if (notes.length > 0) return notes
    }
    return []
  }

  /**
   * Delete a tuplet and replace it with an appropriate rest
   * @param tupletId - ID of the tuplet to delete
   * @returns true if deleted successfully
   */
  deleteTuplet(tupletId: string): boolean {
    for (const measure of this.score.measures) {
      if (!measure.tuplets) continue

      const tupletIndex = measure.tuplets.findIndex(t => t.id === tupletId)
      if (tupletIndex === -1) continue

      // Remove all notes belonging to this tuplet
      measure.notes = measure.notes.filter(n => n.tupletId !== tupletId)

      // Remove the tuplet
      measure.tuplets.splice(tupletIndex, 1)

      // Re-fill gaps with rests (this will fill the space left by the tuplet)
      this.fillGapsWithRests(measure)

      return true
    }
    return false
  }

  /**
   * Repair gaps in a single measure by filling with rests.
   * Called by MusicEngine after operations that may leave gaps (e.g. rest deletion).
   */
  repairMeasureGaps(measureNumber: number): void {
    const measure = this.getMeasure(measureNumber)
    if (measure) {
      this.fillGapsWithRests(measure)
    }
  }

  /**
   * Repair gaps in all measures. Called as a pre-render safety net.
   */
  repairAllMeasureGaps(): void {
    for (const measure of this.score.measures) {
      this.fillGapsWithRests(measure)
    }
  }

  /**
   * Clear all notes from the score and refill with rests
   */
  clearAllNotes(): void {
    this.score.measures.forEach(measure => {
      measure.notes = []
      measure.tuplets = []
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
