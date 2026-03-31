import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration } from '@/types/music'
import {
  getTupletBeatPositionsFrac,
  isBeatInTupletFrac,
  getTupletTotalBeatsFrac,
  noteSpansOverlapFrac,
  beatToFrac,
} from '@/utils/musicUtils'
import {
  type Fraction,
  durationToFraction,
  fracCreate,
  fracAdd,
  fracMul,
  fracCompare,
  fracLt,
  fracLte,
  fracGt,
  fracGte,
  fracEq,
  fracToNumber,
} from '@/utils/fraction'
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
        beat: fracCreate(0, 1),
        isRest: true,
        actualDuration: durationToFraction('w'),
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
          beat: beatToFrac(rest.beat),
          isRest: true,
          actualDuration: durationToFraction(rest.duration),
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

    // Compute and store the exact sounding duration as a Fraction
    note.actualDuration = this.computeActualDuration(note, measure)

    // If adding a regular note (not a rest), replace overlapping rests
    if (!params.isRest) {
      this.replaceRestsWithNote(measure, note)
    } else {
      measure.notes.push(note)
      measure.notes.sort((a, b) => fracCompare(a.beat, b.beat))
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
    // Exact Fraction spans — no epsilon needed
    const noteDurFrac = note.actualDuration ?? durationToFraction(note.duration, note.dots ?? 0)

    // Remove all rests that overlap with the note's time range
    const overlappingRests: Note[] = []
    const remainingNotes: Note[] = []

    // Track if we're replacing a tuplet rest
    let inheritedTupletId: string | undefined = note.tupletId

    for (const existing of measure.notes) {
      if (existing.isRest) {
        const existingDurFrac =
          existing.actualDuration ?? durationToFraction(existing.duration, existing.dots ?? 0)

        // Exact overlap: [noteStart, noteEnd) ∩ [existingStart, existingEnd) ≠ ∅
        // Adjacent spans (one ends where the other starts) do NOT overlap — no epsilon needed
        const overlaps = noteSpansOverlapFrac(note.beat, noteDurFrac, existing.beat, existingDurFrac)

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
        if (fracEq(existing.beat, note.beat)) {
          const existingDots = existing.dots || 0
          const noteDots = note.dots || 0
          // Don't update duration for tuplet notes (they have their own timing)
          if (!existing.tupletId && !note.tupletId) {
            if (existing.duration !== note.duration || existingDots !== noteDots) {
              existing.duration = note.duration
              existing.dots = noteDots
              existing.actualDuration = this.computeActualDuration(existing, measure)
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
    measure.notes.sort((a, b) => fracCompare(a.beat, b.beat))
  }

  /**
   * Fill gaps in a measure with rests
   * Uses musical rest placement: fills to beat boundaries first with small rests,
   * then uses larger rests for full beats.
   * Skips any gaps that fall within tuplet time spans (tuplets manage their own rests)
   */
  private fillGapsWithRests(measure: Measure): void {
    const totalBeats = this.getMeasureTotalBeats(measure.timeSignature)
    const totalBeatsFrac: Fraction = fracCreate(
      Math.round(totalBeats * 8),
      8,
    ) // totalBeats is always dyadic (1, 2, 3.5, 4, …)

    // Sort notes by beat position
    const sortedNotes = [...measure.notes].sort((a, b) => fracCompare(a.beat, b.beat))

    // Find gaps using exact Fraction accumulation — no floating-point drift
    const gaps: Array<{ start: Fraction; end: Fraction }> = []
    let currentBeat: Fraction = fracCreate(0, 1)

    for (const note of sortedNotes) {
      if (fracLt(currentBeat, note.beat)) {
        gaps.push({ start: currentBeat, end: note.beat })
      }
      const noteDurFrac = note.actualDuration ?? durationToFraction(note.duration, note.dots ?? 0)
      currentBeat = fracAdd(note.beat, noteDurFrac)
    }

    // Check for gap at the end of the measure
    if (fracLt(currentBeat, totalBeatsFrac)) {
      gaps.push({ start: currentBeat, end: totalBeatsFrac })
    }

    // Filter out gaps that start inside a tuplet's span.
    // Tuplets manage their own internal rests.
    const tuplets = measure.tuplets || []
    const filteredGaps = gaps.filter(gap => {
      for (const tuplet of tuplets) {
        const tupletEndFrac = fracAdd(
          tuplet.startBeat,
          getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied),
        )
        // Exact: gap starts inside this tuplet → skip
        if (fracGte(gap.start, tuplet.startBeat) && fracLt(gap.start, tupletEndFrac)) {
          return false
        }
      }
      return true
    })

    // Fill each gap with musically appropriate rests
    for (const gap of filteredGaps) {
      // If a tuplet starts inside this gap, trim the gap to end there
      let adjustedStart = gap.start
      let adjustedEnd = gap.end

      for (const tuplet of tuplets) {
        if (fracGt(tuplet.startBeat, adjustedStart) && fracLt(tuplet.startBeat, adjustedEnd)) {
          adjustedEnd = tuplet.startBeat
        }
      }

      if (fracLte(adjustedEnd, adjustedStart)) continue

      // createMusicalRests still works with numbers (all values here are dyadic)
      const rests = this.createMusicalRests(
        fracToNumber(adjustedStart),
        fracToNumber(adjustedEnd),
        measure.timeSignature,
      )
      for (const rest of rests) {
        measure.notes.push({
          id: uuidv4(),
          pitch: 0,
          duration: rest.duration,
          measure: measure.number,
          beat: beatToFrac(rest.beat),
          isRest: true,
          actualDuration: durationToFraction(rest.duration),
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
   * Compute the exact sounding duration of a note as a Fraction.
   * For regular notes: durationToFraction(duration, dots).
   * For tuplet notes: that value × (notesOccupied / numNotes).
   */
  private computeActualDuration(note: Note, measure: Measure) {
    const base = durationToFraction(note.duration, note.dots ?? 0)
    if (note.tupletId && measure.tuplets) {
      const tuplet = measure.tuplets.find(t => t.id === note.tupletId)
      if (tuplet) {
        return fracMul(base, fracCreate(tuplet.notesOccupied, tuplet.numNotes))
      }
    }
    return base
  }

  /**
   * Add a rest to the score
   * A rest is a note with isRest=true and pitch=0 (pitch is ignored for rests)
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction): Note {
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
      newMeasure.notes.sort((a, b) => fracCompare(a.beat, b.beat))
    } else {
      // Update in place
      Object.assign(note, updates)
      // Re-sort if beat changed
      if (updates.beat !== undefined) {
        const measure = this.getMeasure(note.measure)
        if (measure) {
          measure.notes.sort((a, b) => fracCompare(a.beat, b.beat))
        }
      }
    }

    // Recompute actualDuration whenever duration-related fields may have changed
    if (updates.duration !== undefined || updates.dots !== undefined || updates.tupletId !== undefined) {
      const measure = this.getMeasure(note.measure)
      if (measure) {
        note.actualDuration = this.computeActualDuration(note, measure)
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
    startBeat: Fraction,
    baseDuration: NoteDuration,
    numNotes: number = 3,
    notesOccupied: number = 2,
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

    // Remove any existing notes/rests that overlap with the tuplet's time span.
    const tupletDurFrac = getTupletTotalBeatsFrac(baseDuration, notesOccupied)
    measure.notes = measure.notes.filter(note => {
      const noteDurFrac = note.actualDuration ?? durationToFraction(note.duration, note.dots ?? 0)
      return !noteSpansOverlapFrac(note.beat, noteDurFrac, startBeat, tupletDurFrac)
    })

    // Create rests at each tuplet beat position
    const tupletActualDuration = fracMul(
      durationToFraction(baseDuration),
      fracCreate(notesOccupied, numNotes),
    )
    const beatPositions = getTupletBeatPositionsFrac(startBeat, baseDuration, numNotes, notesOccupied)
    for (const beat of beatPositions) {
      const rest: Note = {
        id: uuidv4(),
        pitch: 0,
        duration: baseDuration,
        measure: measureNumber,
        beat,
        isRest: true,
        tupletId: tuplet.id,
        actualDuration: tupletActualDuration,
      }
      measure.notes.push(rest)
    }

    // Sort notes by beat
    measure.notes.sort((a, b) => fracCompare(a.beat, b.beat))

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
  getTupletAtBeat(measureNumber: number, beat: Fraction): Tuplet | undefined {
    const measure = this.getMeasure(measureNumber)
    if (!measure || !measure.tuplets) return undefined

    return measure.tuplets.find(tuplet => isBeatInTupletFrac(beat, tuplet))
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
    // Migrate legacy scores: beat and startBeat were stored as plain numbers.
    // Convert them to Fractions, then recompute actualDuration.
    for (const measure of model.score.measures) {
      for (const tuplet of measure.tuplets ?? []) {
        if (typeof (tuplet.startBeat as unknown) === 'number') {
          tuplet.startBeat = beatToFrac(tuplet.startBeat as unknown as number)
        }
      }
      for (const note of measure.notes) {
        if (typeof (note.beat as unknown) === 'number') {
          note.beat = beatToFrac(note.beat as unknown as number)
        }
        note.actualDuration = model.computeActualDuration(note, measure)
      }
    }
    return model
  }
}
