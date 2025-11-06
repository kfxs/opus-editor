/**
 * Core music types for the score editor
 */

/**
 * Note duration types supported by the editor
 */
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'

/**
 * Accidental types
 */
export type Accidental = '#' | 'b' | 'n'

/**
 * Represents a single musical note
 */
export interface Note {
  /** Unique identifier for the note */
  id: string
  /** MIDI pitch number (21-108 for piano, 0-127 for full MIDI range) */
  pitch: number
  /** Note duration */
  duration: NoteDuration
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position within the measure (0-indexed, fractional for subdivisions) */
  beat: number
  /** Optional accidental */
  accidental?: Accidental
  /** Whether this note is a rest */
  isRest?: boolean
}

/**
 * Time signature representation
 */
export interface TimeSignature {
  /** Number of beats per measure */
  numerator: number
  /** Note value that gets the beat (4 = quarter note, 8 = eighth note) */
  denominator: number
}

/**
 * Represents a measure in the score
 */
export interface Measure {
  /** Unique identifier for the measure */
  id: string
  /** Measure number (1-indexed) */
  number: number
  /** Notes in this measure */
  notes: Note[]
  /** Time signature for this measure */
  timeSignature: TimeSignature
  /** Optional key signature (number of sharps/flats, positive = sharps, negative = flats) */
  keySignature?: number
}

/**
 * Key signature representation
 */
export interface KeySignature {
  /** Key name (e.g., 'C', 'G', 'Dm') */
  key: string
  /** Number of sharps (positive) or flats (negative) */
  accidentals: number
}

/**
 * Represents a complete musical score
 */
export interface Score {
  /** Unique identifier for the score */
  id: string
  /** Title of the score */
  title: string
  /** Composer name */
  composer?: string
  /** Measures in the score */
  measures: Measure[]
  /** Default tempo in BPM */
  tempo: number
  /** Key signature for the score */
  keySignature: KeySignature
  /** Default time signature */
  defaultTimeSignature: TimeSignature
}

/**
 * Position in the score (for cursor, selection, etc.)
 */
export interface Position {
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position (0-indexed) */
  beat: number
}

/**
 * Pixel coordinates
 */
export interface PixelCoordinates {
  x: number
  y: number
}

/**
 * Parameters for creating a new note
 */
export interface NoteParams {
  pitch: number
  duration: NoteDuration
  measure: number
  beat: number
  accidental?: Accidental
  isRest?: boolean
}
