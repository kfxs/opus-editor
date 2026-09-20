/**
 * THE LANE A SPAN MARK WALKS — what `ottavaOps` and `pedalOps` each spelled for themselves, word for
 * word (docs/code-shape-plan-2026-09-19.md, Phase 5).
 *
 * A bracket-shaped span (an octave line, a pedal) stands on a STAFF, not in a voice: its ends step
 * between that staff's onsets, every voice counted once. So "where is this mark now, and what may
 * its ends step to" is one question with one answer, and the two endpoint gestures of a mark — and
 * the two families — cannot come to disagree about it.
 *
 * ⛔ **NOT the hairpin's lane** (`hairpinOps.laneOnStaff`), which looks like this and is a different
 * rule: at a shared onset a wedge keeps the SHORTEST slot (its tip reaches "the next onset in the
 * lane"), where a bracket keeps the LONGEST. A name is not a body — that one stays where it is.
 */
import type { Fraction, Score } from '@/types/music'
import { fracAdd, fracCompare } from '@/utils/fraction'
import { measureStartOffsets } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { matchesStaff } from './staffContent'

/** One onset of a staff: where it is in the score, how long its slot runs, and its address. */
export interface LaneOnset {
  abs: Fraction
  length: Fraction
  measure: number
  beat: Fraction
}

/**
 * Every onset of one STAFF, by absolute quarter-beat, with the slot's own length and address —
 * every VOICE (a bracket has none of its own), de-duplicated by beat so two voices attacking
 * together are ONE step rather than two presses of the key for one move, and sorted.
 *
 * ⚠️ De-duplicating keeps the LONGEST slot at a shared onset, which is what "reach through the next
 * slot" has to mean when two voices start together and one is longer: the shorter one's end is
 * inside the longer one's note, so stopping there would put the mark's end at a position no onset
 * occupies — and the next press would then have to skip the rest of that note.
 *
 * ⚠️ `staffId` is a real answer: absent IS the first staff, ⛔ never "whichever staff the mark is on".
 */
export function staffOnsets(
  score: Score,
  staffId: string | undefined,
  starts: Map<number, Fraction> = measureStartOffsets(score.measures),
): LaneOnset[] {
  const at = new Map<string, LaneOnset>()
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if (!matchesStaff(slot.staffId, staffId, score)) continue
      const abs = fracAdd(base, slot.beat)
      const length = slotLength(slot)
      const key = `${abs.num}/${abs.den}`
      const seen = at.get(key)
      if (!seen || fracCompare(length, seen.length) > 0) {
        at.set(key, { abs, length, measure: measure.number, beat: slot.beat })
      }
    }
  }
  return [...at.values()].sort((a, b) => fracCompare(a.abs, b.abs))
}

/** A span mark as this module needs it: how far it runs, and the staff it stands on. */
interface LaneMark {
  length: Fraction
  staffId?: string
}

/** Where a located mark is, and the onsets of its STAFF its ends may be moved between. */
export interface LocatedSpan<M extends LaneMark> {
  mark: M
  startMeasure: number
  startAbs: Fraction
  endAbs: Fraction
  lane: LaneOnset[]
}

/**
 * Everything a span-editing op reads: the mark, where it currently reaches, and its staff's lane.
 * The family answers the two things only it knows — its own `span` (where the mark starts, clamped
 * the way that family clamps) and the `mark` itself; null for either is null here.
 */
export function locateSpan<M extends LaneMark>(
  score: Score,
  span: { startMeasure: number; startBeat: Fraction } | null,
  mark: M | null,
): LocatedSpan<M> | null {
  if (!span || !mark) return null

  const starts = measureStartOffsets(score.measures)
  const base = starts.get(span.startMeasure)
  if (base === undefined) return null
  const startAbs = fracAdd(base, span.startBeat)

  return {
    mark,
    startMeasure: span.startMeasure,
    startAbs,
    endAbs: fracAdd(startAbs, mark.length),
    lane: staffOnsets(score, mark.staffId, starts),
  }
}
