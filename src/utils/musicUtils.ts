import type { NoteDuration, TimeSignature, Tuplet, Measure, Note } from '@/types/music'
import {
  type Fraction,
  durationToFraction,
  fracCreate,
  fracMul,
  fracAdd,
  fracLte,
  fracLt,
  fracGte,
  fracCompare,
  fracToNumber,
} from '@/utils/fraction'

/**
 * Music utility functions for calculations and conversions
 */

/**
 * Get the multiplier for dotted notes
 * - 1 dot = 1.5x (2 - 1/2)
 * - 2 dots = 1.75x (2 - 1/4)
 * - 3 dots = 1.875x (2 - 1/8)
 * @param dots - Number of dots (0, 1, 2, etc.)
 * @returns Multiplier for the duration
 */
export function getDotMultiplier(dots: number): number {
  return dots > 0 ? 2 - Math.pow(0.5, dots) : 1
}

/**
 * Convert note duration to beat value
 * @param duration - Note duration string
 * @param dots - Number of dots (optional, default 0)
 * @returns Number of quarter note beats this duration represents
 */
export function durationToBeats(duration: NoteDuration, dots: number = 0): number {
  const durationMap: Record<NoteDuration, number> = {
    w: 4, // Whole note = 4 beats
    h: 2, // Half note = 2 beats
    q: 1, // Quarter note = 1 beat
    '8': 0.5, // Eighth note = 0.5 beats
    '16': 0.25, // Sixteenth note = 0.25 beats
    '32': 0.125, // Thirty-second note = 0.125 beats
  }
  return durationMap[duration] * getDotMultiplier(dots)
}

/**
 * Calculate the total duration (in beats) of a measure given its time signature
 * @param timeSignature - Time signature object
 * @returns Total beats in the measure
 */
export function getMeasureDuration(timeSignature: TimeSignature): number {
  // Convert to quarter note equivalents
  // For example: 3/4 = 3 beats, 6/8 = 3 beats (6 * 0.5), 2/2 = 4 beats (2 * 2)
  const beatValue = 4 / timeSignature.denominator
  return timeSignature.numerator * beatValue
}

/**
 * Check if a note duration fits within remaining space in a measure
 * @param currentBeat - Current beat position in measure
 * @param duration - Duration to add
 * @param timeSignature - Time signature of the measure
 * @returns True if the note fits, false otherwise
 */
export function noteCanFitInMeasure(
  currentBeat: number,
  duration: NoteDuration,
  timeSignature: TimeSignature
): boolean {
  const noteDuration = durationToBeats(duration)
  const measureDuration = getMeasureDuration(timeSignature)
  return currentBeat + noteDuration <= measureDuration
}

/**
 * Convert MIDI note number to note name with octave
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name with octave (e.g., 'C4', 'A#3')
 */
export function midiToNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNote / 12) - 1
  const noteName = noteNames[midiNote % 12]
  return `${noteName}${octave}`
}

/**
 * Convert note name with octave to MIDI number
 * @param noteName - Note name with octave (e.g., 'C4', 'A#3')
 * @returns MIDI note number (0-127)
 */
export function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  }

  // Parse note name and octave
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/)
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`)
  }

  const [, note, octaveStr] = match
  const octave = parseInt(octaveStr, 10)
  const noteValue = noteMap[note]

  if (noteValue === undefined) {
    throw new Error(`Invalid note: ${note}`)
  }

  return (octave + 1) * 12 + noteValue
}

/**
 * Calculate the next available beat position in a measure
 * @param occupiedBeats - Array of beat positions already occupied
 * @param duration - Duration of the note to add
 * @param timeSignature - Time signature of the measure
 * @returns Next available beat position, or -1 if measure is full
 */
export function getNextAvailableBeat(
  occupiedBeats: Array<{ beat: number; duration: NoteDuration; dots?: number }>,
  duration: NoteDuration,
  timeSignature: TimeSignature,
  dots: number = 0
): number {
  const measureDuration = getMeasureDuration(timeSignature)
  const noteDuration = durationToBeats(duration, dots)

  // Sort occupied beats
  const sorted = [...occupiedBeats].sort((a, b) => a.beat - b.beat)

  // Check from the start
  let currentPosition = 0

  for (const occupied of sorted) {
    const occupiedDuration = durationToBeats(occupied.duration, occupied.dots || 0)

    // Check if there's space before this note
    if (currentPosition + noteDuration <= occupied.beat) {
      return currentPosition
    }

    // Move past this occupied note
    currentPosition = Math.max(currentPosition, occupied.beat + occupiedDuration)
  }

  // Check if there's space at the end
  if (currentPosition + noteDuration <= measureDuration) {
    return currentPosition
  }

  return -1 // Measure is full
}

/**
 * Get the staff line position for a MIDI note
 * Middle C (MIDI 60) is the baseline
 * @param midiNote - MIDI note number
 * @returns Staff line position (positive = above middle C, negative = below)
 */
export function getStaffLinePosition(midiNote: number): number {
  const middleC = 60
  const halfSteps = midiNote - middleC
  // Each staff line represents a whole step (2 semitones)
  return Math.round(halfSteps / 2)
}

/**
 * Calculate total duration of all notes in beats
 * @param notes - Array of note objects with duration and optional dots property
 * @returns Total duration in beats
 */
export function calculateTotalDuration(
  notes: Array<{ duration: NoteDuration; dots?: number }>
): number {
  return notes.reduce((total, note) => total + durationToBeats(note.duration, note.dots || 0), 0)
}

/**
 * Convert a beat value to the closest note duration
 * @param beats - Number of beats
 * @returns The closest NoteDuration, or null if no match
 */
export function beatsToDuration(beats: number): NoteDuration | null {
  const epsilon = 0.001
  if (Math.abs(beats - 4) < epsilon) return 'w'
  if (Math.abs(beats - 2) < epsilon) return 'h'
  if (Math.abs(beats - 1) < epsilon) return 'q'
  if (Math.abs(beats - 0.5) < epsilon) return '8'
  if (Math.abs(beats - 0.25) < epsilon) return '16'
  if (Math.abs(beats - 0.125) < epsilon) return '32'
  return null
}

/**
 * Split a duration into parts that fit within available beats
 * Returns an array of durations that sum to the original duration
 * Used for splitting notes across bar lines
 * @param totalBeats - Total beats to fill
 * @returns Array of NoteDuration values
 */
export function splitBeatsIntoDurations(totalBeats: number): NoteDuration[] {
  const durations: NoteDuration[] = []
  let remaining = totalBeats
  const epsilon = 0.001

  // Available durations from largest to smallest
  const availableDurations: { duration: NoteDuration; beats: number }[] = [
    { duration: 'w', beats: 4 },
    { duration: 'h', beats: 2 },
    { duration: 'q', beats: 1 },
    { duration: '8', beats: 0.5 },
    { duration: '16', beats: 0.25 },
    { duration: '32', beats: 0.125 },
  ]

  while (remaining > epsilon) {
    let found = false
    for (const { duration, beats } of availableDurations) {
      if (remaining >= beats - epsilon) {
        durations.push(duration)
        remaining -= beats
        found = true
        break
      }
    }
    if (!found) break // Prevent infinite loop for very small remainders
  }

  return durations
}

// ==================== Tuplet Utilities ====================

/**
 * Get the duration in beats of a single note within a tuplet
 * For a triplet of eighth notes (3:2), each eighth note = (0.5 * 2) / 3 = 0.333 beats
 * @param baseDuration - The base note duration (e.g., '8' for eighth note triplet)
 * @param numNotes - Number of notes in the tuplet (e.g., 3)
 * @param notesOccupied - Number of base notes the tuplet spans (e.g., 2)
 * @returns Duration in beats of one tuplet note
 */
export function getTupletNoteDuration(
  baseDuration: NoteDuration,
  numNotes: number,
  notesOccupied: number
): number {
  const baseBeats = durationToBeats(baseDuration)
  return (baseBeats * notesOccupied) / numNotes
}

/**
 * Get the total duration in beats that a tuplet occupies
 * For a triplet of eighth notes (3:2), total = 0.5 * 2 = 1 beat
 * @param baseDuration - The base note duration
 * @param notesOccupied - Number of base notes the tuplet spans
 * @returns Total duration in beats
 */
export function getTupletTotalBeats(
  baseDuration: NoteDuration,
  notesOccupied: number
): number {
  return durationToBeats(baseDuration) * notesOccupied
}

// ==================== Exact Fraction Tuplet Utilities ====================
// The float variants above remain for VexFlow/pixel callers that need numbers.

/**
 * Exact duration (in beats) of a single note within a tuplet.
 * Result is fully reduced: triplet eighth → Fraction(1, 3).
 */
export function getTupletNoteDurationFrac(
  baseDuration: NoteDuration,
  numNotes: number,
  notesOccupied: number,
): Fraction {
  return fracMul(durationToFraction(baseDuration), fracCreate(notesOccupied, numNotes))
}

/**
 * Exact total duration (in beats) the entire tuplet group occupies.
 * e.g. triplet of eighths → 2 eighths → Fraction(1, 1).
 */
export function getTupletTotalBeatsFrac(
  baseDuration: NoteDuration,
  notesOccupied: number,
): Fraction {
  return fracMul(durationToFraction(baseDuration), fracCreate(notesOccupied, 1))
}

/**
 * Exact beat positions for every note slot in a tuplet.
 * Positions are accumulated by repeated fraction addition — no floating-point drift.
 *
 * @param startBeat - Tuplet start position (as a Fraction, in beats)
 * @param baseDuration - Written note type of each tuplet slot
 * @param numNotes - N in N:M (e.g. 3 for triplet)
 * @param notesOccupied - M in N:M (e.g. 2 for triplet)
 */
export function getTupletBeatPositionsFrac(
  startBeat: Fraction,
  baseDuration: NoteDuration,
  numNotes: number,
  notesOccupied: number,
): Fraction[] {
  const step = getTupletNoteDurationFrac(baseDuration, numNotes, notesOccupied)
  const positions: Fraction[] = []
  let current = startBeat
  for (let i = 0; i < numNotes; i++) {
    positions.push(current)
    current = fracAdd(current, step)
  }
  return positions
}

/**
 * Exact check: does `beat` fall within the given tuplet's time span?
 * No epsilon — comparison is cross-multiplication of integers.
 *
 * Inclusive of startBeat, exclusive of end.
 */
export function isBeatInTupletFrac(beat: Fraction, tuplet: Tuplet): boolean {
  const end = fracAdd(tuplet.startBeat, getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied))
  return fracGte(beat, tuplet.startBeat) && fracLt(beat, end)
}

/**
 * Find the nearest valid tuplet slot to `beat` (as a Fraction).
 * Returns the closest Fraction position from getTupletBeatPositionsFrac.
 */
export function snapToTupletBeatFrac(beat: Fraction, tuplet: Tuplet): Fraction {
  const positions = getTupletBeatPositionsFrac(
    tuplet.startBeat,
    tuplet.baseDuration,
    tuplet.numNotes,
    tuplet.notesOccupied,
  )

  let nearest = positions[0]
  // Compare distances using cross-multiplication to stay exact
  for (const pos of positions) {
    // |beat - pos| vs |beat - nearest| — compare by squaring avoids abs on fractions
    // Simpler: convert distances to number only for comparison (not for the result)
    const dCurrent = Math.abs(fracToNumber(beat) - fracToNumber(pos))
    const dBest = Math.abs(fracToNumber(beat) - fracToNumber(nearest))
    if (dCurrent < dBest) nearest = pos
  }

  return nearest
}

/**
 * Sort an array of Fraction beat positions in ascending order (mutates in place).
 * Uses exact cross-multiplication comparison.
 */
export function sortBeatsFrac(positions: Fraction[]): Fraction[] {
  return positions.sort(fracCompare)
}

/**
 * Bridge helper: convert a number beat (from legacy Note.beat) to a Fraction
 * using the same candidate-denominator approach as fracFromFloat.
 * Only needed during Phase 2.5–3 while note.beat is still a number.
 */
export function beatToFrac(beat: number): Fraction {
  // Fast path for common integer and dyadic values
  if (Number.isInteger(beat)) return fracCreate(beat, 1)
  // Try denominators that cover all standard + tuplet subdivisions
  const DENS = [2, 3, 4, 5, 6, 7, 8, 12, 14, 16, 21, 24, 28, 32, 48, 56, 96, 112]
  for (const d of DENS) {
    const n = Math.round(beat * d)
    if (Math.abs(beat - n / d) < 1e-9) return fracCreate(n, d)
  }
  // Fallback: rational approximation with den=96 (covers up to 32nd-note triplets)
  return fracCreate(Math.round(beat * 96), 96)
}

/**
 * Exact overlap check for two note spans [aStart, aStart+aDur) and [bStart, bStart+bDur).
 * Returns true if they overlap (share any time), false if they are adjacent or disjoint.
 */
export function noteSpansOverlapFrac(
  aStart: Fraction,
  aDur: Fraction,
  bStart: Fraction,
  bDur: Fraction,
): boolean {
  const aEnd = fracAdd(aStart, aDur)
  const bEnd = fracAdd(bStart, bDur)
  // Overlap iff aStart < bEnd AND bStart < aEnd
  return fracLt(aStart, bEnd) && fracLt(bStart, aEnd)
}

/**
 * Check if span [start, start+dur) is fully contained within [regionStart, regionEnd).
 */
export function spanContainedInFrac(
  start: Fraction,
  dur: Fraction,
  regionStart: Fraction,
  regionEnd: Fraction,
): boolean {
  return fracGte(start, regionStart) && fracLte(fracAdd(start, dur), regionEnd)
}

/**
 * Flatten a Measure's ChordRest slots into a backward-compatible Note[] array.
 * Each Rest slot becomes one Note with isRest=true.
 * Each Chord slot becomes one Note per pitch.
 */
export function getMeasureNotes(measure: Measure): Note[] {
  const result: Note[] = []
  for (const slot of measure.slots) {
    if (slot.type === 'rest') {
      result.push({
        id: slot.id,
        duration: slot.duration,
        measure: slot.measure,
        beat: slot.beat,
        isRest: true,
        dots: slot.dots,
        tupletId: slot.tupletId,
        actualDuration: slot.actualDuration,
      })
    } else {
      for (const pitch of slot.notes) {
        result.push({
          id: pitch.id,
          step: pitch.step,
          alter: pitch.alter,
          octave: pitch.octave,
          duration: slot.duration,
          measure: slot.measure,
          beat: slot.beat,
          isRest: false,
          forceAccidental: pitch.forceAccidental,
          stemDirection: slot.stemDirection,
          tiedTo: pitch.tiedTo,
          tiedFrom: pitch.tiedFrom,
          dots: slot.dots,
          tupletId: slot.tupletId,
          actualDuration: slot.actualDuration,
          articulations: pitch.articulations,
        })
      }
    }
  }
  return result
}
