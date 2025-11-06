import type { Score, Measure, Note, NoteParams, TimeSignature } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'

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
   */
  addMeasure(timeSignature?: TimeSignature): Measure {
    const measureNumber = this.score.measures.length + 1
    const measure: Measure = {
      id: uuidv4(),
      number: measureNumber,
      notes: [],
      timeSignature: timeSignature || this.score.defaultTimeSignature,
    }
    this.score.measures.push(measure)
    return measure
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
   */
  addNote(params: NoteParams): Note {
    const measure = this.getMeasure(params.measure)
    if (!measure) {
      throw new Error(`Measure ${params.measure} does not exist`)
    }

    // Validate pitch
    if (params.pitch < 0 || params.pitch > 127) {
      throw new Error('Pitch must be between 0 and 127')
    }

    const note: Note = {
      id: uuidv4(),
      ...params,
    }

    measure.notes.push(note)
    // Sort notes by beat position
    measure.notes.sort((a, b) => a.beat - b.beat)

    return note
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
   * Clear all notes from the score
   */
  clearAllNotes(): void {
    this.score.measures.forEach(measure => {
      measure.notes = []
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
