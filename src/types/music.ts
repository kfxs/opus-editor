/**
 * Core music types for the score editor
 */

import type { Fraction } from '../utils/fraction'
export type { Fraction }

/**
 * Note duration types supported by the editor
 */
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | '32'

/**
 * Tuplet definition (e.g., triplet = 3 notes in space of 2)
 */
export interface Tuplet {
  /** Unique identifier for the tuplet */
  id: string
  /** Beat position where the tuplet starts (exact rational) */
  startBeat: Fraction
  /** Base note duration for the tuplet (e.g., 'q' for quarter note triplet) */
  baseDuration: NoteDuration
  /** Number of notes in the tuplet (e.g., 3 for triplet) */
  numNotes: number
  /** Number of base notes the tuplet occupies (e.g., 2 for triplet) */
  notesOccupied: number
}

/**
 * Accidental types
 */
export type Accidental = '#' | 'b' | 'n'

/**
 * Articulation types
 */
export type ArticulationType = 'accent' | 'staccato' | 'tenuto'

/**
 * Clef types
 */
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'

/**
 * Stem direction for notes
 * - 'auto': Calculate based on pitch and clef (default)
 * - 'up': Force stem up
 * - 'down': Force stem down
 */
export type StemDirection = 'auto' | 'up' | 'down'

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
  /** Beat position within the measure (0-indexed, exact rational fraction) */
  beat: Fraction
  /** Optional accidental */
  accidental?: Accidental
  /** If true, always show the accidental sign even when measure rules would suppress it */
  forceAccidental?: boolean
  /** Whether this note is a rest */
  isRest?: boolean
  /** Stem direction override (default: 'auto' - calculated from pitch and clef) */
  stemDirection?: StemDirection
  /** ID of the note this note is tied TO (forward tie) */
  tiedTo?: string
  /** ID of the note this note is tied FROM (backward tie) */
  tiedFrom?: string
  /** Number of dots (0=none, 1=dotted, 2=double-dotted) */
  dots?: number
  /** ID of the tuplet this note belongs to */
  tupletId?: string
  /**
   * Exact sounding duration as a rational fraction (in beats).
   * For regular notes equals durationToFraction(duration, dots).
   * For tuplet notes equals that value × (notesOccupied / numNotes).
   * Stored explicitly so all timing comparisons can be exact — no epsilon.
   */
  actualDuration?: Fraction
  /** Articulations applied to this note */
  articulations?: ArticulationType[]
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
  /** Tuplets in this measure */
  tuplets: Tuplet[]
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
  /** Clef for the score (default: 'treble') */
  clef?: Clef
}

/**
 * Position in the score (for cursor, selection, etc.)
 */
export interface Position {
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position (0-indexed, exact rational fraction) */
  beat: Fraction
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
  beat: Fraction
  accidental?: Accidental
  forceAccidental?: boolean
  isRest?: boolean
  dots?: number
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  tiedTo?: string
  tiedFrom?: string
}
