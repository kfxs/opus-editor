import type { NoteDuration, TimeSignature } from '@/types/music'

/**
 * Music utility functions for calculations and conversions
 */

/**
 * Convert note duration to beat value
 * @param duration - Note duration string
 * @returns Number of quarter note beats this duration represents
 */
export function durationToBeats(duration: NoteDuration): number {
  const durationMap: Record<NoteDuration, number> = {
    w: 4, // Whole note = 4 beats
    h: 2, // Half note = 2 beats
    q: 1, // Quarter note = 1 beat
    '8': 0.5, // Eighth note = 0.5 beats
    '16': 0.25, // Sixteenth note = 0.25 beats
    '32': 0.125, // Thirty-second note = 0.125 beats
  }
  return durationMap[duration]
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
  occupiedBeats: Array<{ beat: number; duration: NoteDuration }>,
  duration: NoteDuration,
  timeSignature: TimeSignature
): number {
  const measureDuration = getMeasureDuration(timeSignature)
  const noteDuration = durationToBeats(duration)

  // Sort occupied beats
  const sorted = [...occupiedBeats].sort((a, b) => a.beat - b.beat)

  // Check from the start
  let currentPosition = 0

  for (const occupied of sorted) {
    const occupiedDuration = durationToBeats(occupied.duration)

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
 * @param notes - Array of note objects with duration property
 * @returns Total duration in beats
 */
export function calculateTotalDuration(
  notes: Array<{ duration: NoteDuration }>
): number {
  return notes.reduce((total, note) => total + durationToBeats(note.duration), 0)
}
