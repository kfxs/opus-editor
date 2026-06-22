/**
 * Tuplet sub-API over a `Score` — extracted from {@link ScoreModel}, which keeps
 * thin public delegators to these free functions.
 *
 * Create / query / refill / delete of tuplets and their slots. Each function takes
 * the `score` it operates on as a parameter (no shared instance state), matching the
 * `utils/rebar.ts` / `clefOps.ts` idiom. Two operations reach back into ScoreModel's
 * larger note-entry machinery — `refillTupletRemainder` needs `addNote` and
 * `deleteTuplet` needs `fillGapsWithRests` — so those are passed in as callbacks
 * rather than duplicated here.
 */
import type { Score, Measure, Note, NoteParams, Tuplet, NoteDuration, Fraction } from '@/types/music'
import {
  getTupletTotalBeatsFrac,
  isBeatInTupletFrac,
  noteSpansOverlapFrac,
  splitBeatsIntoDurations,
} from '@/utils/musicUtils'
import { durationToFraction } from '@/utils/durations'
import {
  fracCreate,
  fracAdd,
  fracSub,
  fracMul,
  fracCompare,
  fracLt,
  fracToNumber,
} from '@/utils/fraction'
import { toFlatNote, restToFlatNote } from './noteProjection'
import { v4 as uuidv4 } from 'uuid'

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/** Create a tuplet in a measure, removing any slots that overlap its time span. */
export function createTuplet(
  score: Score,
  measureNumber: number,
  startBeat: Fraction,
  baseDuration: NoteDuration,
  numNotes: number = 3,
  notesOccupied: number = 2,
): Tuplet {
  const measure = getMeasure(score, measureNumber)
  if (!measure) {
    throw new Error(`Measure ${measureNumber} does not exist`)
  }

  const tuplet: Tuplet = {
    id: uuidv4(),
    startBeat,
    baseDuration,
    numNotes,
    notesOccupied,
  }

  if (!measure.tuplets) {
    measure.tuplets = []
  }
  measure.tuplets.push(tuplet)

  // Remove any existing slots that overlap with the tuplet's time span
  const tupletDurFrac = getTupletTotalBeatsFrac(baseDuration, notesOccupied)
  measure.slots = measure.slots.filter(slot => {
    const slotDurFrac = slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)
    return !noteSpansOverlapFrac(slot.beat, slotDurFrac, startBeat, tupletDurFrac)
  })

  // Sort by beat
  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))

  return tuplet
}

/** Get a tuplet by its ID. */
export function getTuplet(score: Score, tupletId: string): Tuplet | undefined {
  for (const measure of score.measures) {
    if (!measure.tuplets) continue
    const tuplet = measure.tuplets.find(t => t.id === tupletId)
    if (tuplet) return tuplet
  }
  return undefined
}

/** Get the tuplet at a specific beat position in a measure. */
export function getTupletAtBeat(score: Score, measureNumber: number, beat: Fraction): Tuplet | undefined {
  const measure = getMeasure(score, measureNumber)
  if (!measure || !measure.tuplets) return undefined
  return measure.tuplets.find(tuplet => isBeatInTupletFrac(beat, tuplet))
}

/** Get all notes that belong to a specific tuplet (as flat Notes). */
export function getNotesInTuplet(score: Score, tupletId: string): Note[] {
  for (const measure of score.measures) {
    const slots = measure.slots.filter(s => s.tupletId === tupletId)
    if (slots.length > 0) {
      const result: Note[] = []
      for (const slot of slots) {
        if (slot.type === 'rest') {
          result.push(restToFlatNote(slot))
        } else {
          for (const pitch of slot.notes) {
            result.push(toFlatNote(slot, pitch))
          }
        }
      }
      return result
    }
  }
  return []
}

/**
 * Fill any empty gaps in a tuplet with filler rests.
 *
 * Algorithm:
 *   1. Collect all existing slots (notes AND rests) in the tuplet, sorted by beat.
 *   2. Walk the tuplet's time span looking for empty gaps (ranges with no slot).
 *   3. Fill only those empty gaps with new rests.
 *
 * Rests are treated as first-class slots and are never deleted here.
 * Callers are responsible for removing slots before calling this (e.g. when a
 * note grows into a rest's time span).
 *
 * `addNote` is injected (it stays on ScoreModel) to place the filler rests.
 */
export function refillTupletRemainder(
  score: Score,
  measureNumber: number,
  tuplet: Tuplet,
  addNote: (params: NoteParams) => Note,
): void {
  const ratio = fracCreate(tuplet.notesOccupied, tuplet.numNotes)
  const inverseRatio = fracCreate(tuplet.numNotes, tuplet.notesOccupied)
  const tupletEnd = fracAdd(tuplet.startBeat, getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied))

  // Get ALL existing slots (notes and rests) sorted by beat
  const allSlots = getNotesInTuplet(score, tuplet.id)
    .sort((a, b) => fracCompare(a.beat, b.beat))

  // Fill a gap in actual-time [from, to) with tuplet filler rests
  const fillGap = (from: Fraction, to: Fraction): void => {
    if (!fracLt(from, to)) return
    const actualGap = fracSub(to, from)
    const writtenGap = fracMul(actualGap, inverseRatio)
    const durations = splitBeatsIntoDurations(fracToNumber(writtenGap))
    let beat = from
    for (const dur of durations) {
      const actualDur = fracMul(durationToFraction(dur), ratio)
      addNote({
        duration: dur,
        measure: measureNumber,
        beat,
        isRest: true,
        tupletId: tuplet.id,
        actualDuration: actualDur,
      })
      beat = fracAdd(beat, actualDur)
    }
  }

  // Walk through all slots filling empty gaps between them
  let pointer: Fraction = tuplet.startBeat
  for (const slot of allSlots) {
    fillGap(pointer, slot.beat)
    const slotActual = slot.actualDuration
      ?? fracMul(durationToFraction(slot.duration, slot.dots ?? 0), ratio)
    pointer = fracAdd(slot.beat, slotActual)
  }
  fillGap(pointer, tupletEnd)
}

/**
 * Delete a tuplet and replace it with an appropriate rest.
 * `fillGapsWithRests` is injected (it stays on ScoreModel).
 */
export function deleteTuplet(
  score: Score,
  tupletId: string,
  fillGapsWithRests: (measure: Measure) => void,
): boolean {
  for (const measure of score.measures) {
    if (!measure.tuplets) continue

    const tupletIndex = measure.tuplets.findIndex(t => t.id === tupletId)
    if (tupletIndex === -1) continue

    // Remove all slots belonging to this tuplet
    measure.slots = measure.slots.filter(s => s.tupletId !== tupletId)

    // Remove the tuplet
    measure.tuplets.splice(tupletIndex, 1)

    // Re-fill gaps with rests
    fillGapsWithRests(measure)

    return true
  }
  return false
}
