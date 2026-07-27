import type { Note, NoteParams, Measure } from '@/types/music'
import { measureCapacityQuarters } from '@/utils/musicUtils'
import { fracAdd, fracToNumber } from '@/utils/fraction'
import { slotLength } from '@/utils/durations'

/**
 * Result of a collision check
 */
export interface CollisionResult {
  /** Whether a collision was detected */
  hasCollision: boolean
  /** IDs of notes that collide */
  collidingNotes: string[]
  /** Reason for collision */
  reason?: string
}

/**
 * Result of an overflow check
 */
export interface OverflowResult {
  /** Whether the measure would overflow */
  willOverflow: boolean
  /** Amount of overflow in beats */
  overflowAmount?: number
  /** Suggested next measure for overflow notes */
  suggestedMeasure?: number
}

/**
 * CollisionDetector handles note collision detection and measure overflow checks
 */
export class CollisionDetector {
  /**
   * Check if adding a note would cause measure overflow
   */
  checkMeasureOverflow(
    note: NoteParams,
    measure: Measure,
    _existingNotes: Note[],
  ): OverflowResult {
    const noteDurFrac = slotLength(note)
    const noteEnd = fracToNumber(fracAdd(note.beat, noteDurFrac))
    const measureDuration = measureCapacityQuarters(measure)

    if (noteEnd > measureDuration) {
      return {
        willOverflow: true,
        overflowAmount: noteEnd - measureDuration,
        suggestedMeasure: measure.number + 1,
      }
    }

    return { willOverflow: false }
  }

}
