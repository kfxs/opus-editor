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
 * Diatonic step name (letter name of the note, independent of accidental)
 */
export type PitchStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * Chromatic alteration in semitones.
 * -2 = double-flat (bb), -1 = flat (b), 0 = natural, 1 = sharp (#), 2 = double-sharp (##)
 */
export type PitchAlter = -2 | -1 | 0 | 1 | 2

/**
 * Enharmonic-aware pitch spelling: step + alteration + scientific octave.
 *
 * This is the industry-standard representation (MusicXML, music21).
 * Unlike a bare MIDI integer, it distinguishes enharmonic equivalents:
 *   C#4 = { step: 'C', alter:  1, octave: 4 }  — MIDI 61
 *   Db4 = { step: 'D', alter: -1, octave: 4 }  — MIDI 61
 *
 * MIDI is always *derived* from this, never primary.
 * Use spellingToMidi() to compute the MIDI value.
 */
export interface PitchSpelling {
  step: PitchStep
  alter: PitchAlter
  /** Scientific octave number — C4 is middle C (MIDI 60) */
  octave: number
}

/**
 * Articulation types
 */
export type ArticulationType = 'accent' | 'staccato' | 'tenuto'

/**
 * Clef types
 */
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'

/**
 * A clef change positioned within a measure.
 *
 * Anchored to a beat that lands on a slot boundary (MusicXML / MuseScore model):
 * the clef applies to all slots with beat >= this beat, until the next change.
 * A change at beat 0 is the measure's opening clef (drawn at the barline / line
 * start); changes at beat > 0 render as inline (small) clefs before that slot.
 */
export interface ClefChange {
  /** Unique identifier */
  id: string
  /** Beat position within the measure (0 = opening clef) */
  beat: Fraction
  /** Clef that takes effect at this beat */
  clef: Clef
}

/**
 * Stem direction for notes
 * - 'auto': Calculate based on pitch and clef (default)
 * - 'up': Force stem up
 * - 'down': Force stem down
 */
export type StemDirection = 'auto' | 'up' | 'down'

/**
 * Explicit beaming override for a note.
 * - 'auto':     automatic beaming (default — uses beat-boundary rules)
 * - 'single':   force no beam (isolate this note)
 * - 'begin':    start an explicit beam group
 * - 'continue': continue the beam across a boundary (bridge two auto groups)
 * - 'end':      close the current explicit beam group
 */
export type BeamMode = 'auto' | 'single' | 'begin' | 'continue' | 'end'

/**
 * Represents a single musical note (or rest).
 *
 * Pitch is stored as step + alter + octave (PitchSpelling), NOT as a raw MIDI integer.
 * These fields are undefined for rests (isRest === true).
 * Use spellingToMidi(step!, alter!, octave!) to derive the MIDI value when needed.
 */
export interface Note {
  /** Unique identifier for the note */
  id: string
  /** Diatonic step name — undefined for rests */
  step?: PitchStep
  /** Chromatic alteration: -2=bb  -1=b  0=natural  1=#  2=## — undefined for rests */
  alter?: PitchAlter
  /** Scientific octave (C4 = middle C) — undefined for rests */
  octave?: number
  /** Note duration */
  duration: NoteDuration
  /** Measure number (1-indexed) */
  measure: number
  /** Beat position within the measure (0-indexed, exact rational fraction) */
  beat: Fraction
  /** If true, always show the accidental sign even when measure rules would suppress it */
  forceAccidental?: boolean
  /** Whether this note is a rest */
  isRest?: boolean
  /** True for a whole-bar measure rest (its `duration` is the nominal `'w'`, not
   *  a real chosen value). Mirrors {@link Rest.isMeasureRest} on the flat view. */
  isMeasureRest?: boolean
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
  /** Explicit beaming override */
  beam?: BeamMode
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
 * Internal pitch-only object stored inside a Chord.
 *
 * Pitch is stored as step + alter + octave (MusicXML / music21 convention),
 * NOT as a raw MIDI integer. This makes enharmonic spelling explicit:
 *   C#4 = { step:'C', alter:1,  octave:4 }
 *   Db4 = { step:'D', alter:-1, octave:4 }
 * Use spellingToMidi() from pitchSpelling.ts to derive the MIDI value.
 */
export interface NotePitch {
  id: string
  /** Diatonic step name */
  step: PitchStep
  /** Chromatic alteration: -2=bb  -1=b  0=natural  1=#  2=## */
  alter: PitchAlter
  /** Scientific octave — C4 is middle C */
  octave: number
  /** Show accidental sign even when measure context would suppress it */
  forceAccidental?: boolean
  tiedTo?: string      // ID of another NotePitch in another Chord
  tiedFrom?: string
}

/** A rhythmic slot containing one or more pitches */
export interface Chord {
  id: string
  type: 'chord'
  beat: Fraction
  duration: NoteDuration
  dots?: number
  measure: number
  voice?: 0 | 1 | 2 | 3
  stemDirection?: StemDirection
  beam?: BeamMode
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  notes: NotePitch[]
}

/** An empty rhythmic slot (silence) */
export interface Rest {
  id: string
  type: 'rest'
  beat: Fraction
  duration: NoteDuration
  dots?: number
  measure: number
  voice?: 0 | 1 | 2 | 3
  tupletId?: string
  actualDuration?: Fraction
  tiedFrom?: string
  /**
   * True for the single rest that fills an entire empty bar (a measure rest).
   * Rendered as a centred whole rest regardless of bar length (Phase 3); the
   * stored `duration` is `'w'` and `actualDuration` carries the true bar length.
   */
  isMeasureRest?: boolean
}

export type ChordRest = Chord | Rest

/**
 * Represents a measure in the score
 */
export interface Measure {
  /** Unique identifier for the measure */
  id: string
  /** Measure number (1-indexed) */
  number: number
  /** Rhythmic slots (chords and rests) in this measure */
  slots: ChordRest[]
  /** Time signature in effect for this measure (propagated from the last change). */
  timeSignature: TimeSignature
  /**
   * True when this measure begins an explicit time-signature change (a TS glyph
   * is drawn here). Always true for measure 1. Measures without this marker
   * inherit `timeSignature` from the most recent change. Resolution helpers live
   * in utils/meter (effectiveTimeSignature, isTimeSignatureChange).
   */
  timeSignatureChange?: boolean
  /**
   * Clef changes within this measure, sorted ascending by beat.
   * A change at beat 0 is the measure's opening clef; changes at beat > 0 are
   * mid-measure changes rendered as inline clefs. When empty/undefined, the
   * measure inherits the effective clef from earlier measures.
   * Resolution helpers live in utils/clefUtils (effectiveClefAt, measureOpeningClef).
   */
  clefs?: ClefChange[]
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
  /** Schema version for JSON forward-compatibility. Current: 2. */
  schemaVersion?: number
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
 * Ghost note preview shown while hovering before note entry.
 * Pitch is stored as spelling (step/alter/octave) — same as NotePitch.
 */
export interface GhostNote {
  step: PitchStep
  alter: PitchAlter
  octave: number
  duration: NoteDuration
  measure: number
  beat: number
  rawX?: number
  rawY?: number
  dots?: number
  articulations?: ArticulationType[]
}

/**
 * Pixel coordinates
 */
export interface PixelCoordinates {
  x: number
  y: number
}

/**
 * Parameters for creating or updating a note.
 *
 * Pitch is specified as step + alter + octave (PitchSpelling).
 * All three pitch fields should be provided together for non-rests;
 * they are omitted (or undefined) for rests.
 */
export interface NoteParams {
  /** Diatonic step name — omit for rests */
  step?: PitchStep
  /** Chromatic alteration — omit for rests, defaults to 0 (natural) when step is provided */
  alter?: PitchAlter
  /** Scientific octave — omit for rests */
  octave?: number
  duration: NoteDuration
  measure: number
  beat: Fraction
  forceAccidental?: boolean
  isRest?: boolean
  dots?: number
  tupletId?: string
  actualDuration?: Fraction
  articulations?: ArticulationType[]
  tiedTo?: string
  tiedFrom?: string
  stemDirection?: StemDirection
  beam?: BeamMode
}
