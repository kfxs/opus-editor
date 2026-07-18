import type { NoteDuration, TimeSignature, Tuplet, Measure, Note, Score } from '@/types/music'
import {
  type Fraction,
  fracCreate,
  fracMul,
  fracAdd,
  fracLte,
  fracLt,
  fracGte,
  fracCompare,
  fracToNumber,
} from '@/utils/fraction'
import {
  durationToFraction,
  durationToBeats,
  getDotMultiplier,
  beatsToDuration,
  splitBeatsIntoDurations,
} from '@/utils/durations'

/**
 * Music utility functions for calculations and conversions.
 *
 * The duration ↔ beats / Fraction / VexFlow maps now live in `utils/durations.ts`
 * (single source of truth). The duration helpers below are re-exported from
 * here so existing `@/utils/musicUtils` imports keep working.
 */

export { durationToBeats, getDotMultiplier, beatsToDuration, splitBeatsIntoDurations }

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
 * Exact bar length in quarter-note beats for a time signature.
 *
 * The `Fraction` counterpart of {@link getMeasureDuration}: every internal
 * timing comparison should use this rather than float beats, so non-`/4`
 * meters (and `/16`, `/32`) stay exact. 4/4 → 4/1, 6/8 → 3/1, 9/8 → 9/2,
 * 5/8 → 5/2, 7/8 → 7/2.
 */
export function getMeasureDurationFrac(timeSignature: TimeSignature): Fraction {
  return fracMul(
    fracCreate(timeSignature.numerator, 1),
    fracCreate(4, timeSignature.denominator),
  )
}

/**
 * The actual playable length of a measure in quarter-note beats: its
 * {@link Measure.actualDurationOverride} (pickup / anacrusis) when present,
 * else its nominal time-signature length. This is the single source of truth
 * for a bar's *capacity*; use it instead of `getMeasureDuration(measure
 * .timeSignature)` wherever the value means "how much fits in this bar".
 */
export function measureCapacityFrac(measure: Measure): Fraction {
  return measure.actualDurationOverride ?? getMeasureDurationFrac(measure.timeSignature)
}

/** Float counterpart of {@link measureCapacityFrac}. */
export function measureCapacityQuarters(measure: Measure): number {
  return fracToNumber(measureCapacityFrac(measure))
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
 * Calculate total duration of all notes in beats
 * @param notes - Array of note objects with duration and optional dots property
 * @returns Total duration in beats
 */
export function calculateTotalDuration(
  notes: Array<{ duration: NoteDuration; dots?: number }>
): number {
  return notes.reduce((total, note) => total + durationToBeats(note.duration, note.dots || 0), 0)
}

// beatsToDuration and splitBeatsIntoDurations now live in utils/durations.ts
// (re-exported above).

// ==================== Tuplet Utilities ====================

// ==================== Exact Fraction Tuplet Utilities ====================

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
 * Compare two notes by their position ACROSS the whole score: measure first, then
 * exact beat. Use this for cross-measure ordering; within a single measure use
 * `fracCompare(a.beat, b.beat)` directly (no measure tiebreak needed there).
 */
export const compareByPosition = (
  a: { measure: number; beat: Fraction },
  b: { measure: number; beat: Fraction },
): number => (a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat))

/**
 * Convert a numeric beat value to an exact Fraction.
 * Used wherever beat positions are computed via float arithmetic (coordinate mapping,
 * tuplet ratios, quantization) and need to be passed to APIs that expect Fraction.
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
 *
 * Reserved for the nested-tuplets containment guard (docs: allow one tuplet fully inside
 * another, reject a partial overlap). No caller yet — kept because that guard is the exact
 * shape this computes; delete if nested tuplets are ruled out. See project_nested_tuplets_future.
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
/**
 * Resolve a slot's `staffId` (string) to a 0-based staff index for the flat {@link Note}
 * projection. Absent `staffId`, no score, or an unknown id all resolve to staff 0 (the N=1
 * default). Inlined here (rather than importing the engine's staffContent seam) so this leaf
 * util keeps no upward dependency on the engine layer.
 */
function resolveStaffIndex(score: Score | undefined, staffId: string | undefined): number {
  if (!score || staffId === undefined) return 0
  const idx = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return idx < 0 ? 0 : idx
}

/**
 * Flatten a measure's slots to `Note[]`. Pass `score` to also project each note's 0-based
 * `staff` index (multi-staff) — the interaction layer needs it for staff-scoped nav/entry/
 * selection. Without `score`, `staff` is left undefined (= staff 0), preserving the
 * single-staff behaviour of every existing caller.
 */
export function getMeasureNotes(measure: Measure, score?: Score): Note[] {
  const result: Note[] = []
  const staffOf = (staffId: string | undefined): number | undefined =>
    score ? resolveStaffIndex(score, staffId) : undefined
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
        voice: slot.voice,
        staff: staffOf(slot.staffId),
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
          articulations: slot.articulations,
          voice: slot.voice,
          staff: staffOf(slot.staffId),
        })
      }
    }
  }
  return result
}
