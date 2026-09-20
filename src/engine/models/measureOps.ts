/**
 * ⭐ **MAKING A MEASURE** — {@link insertMeasureAfter} (splice + renumber + rest-fill) and
 * {@link addMeasure} (the same, at the end). Score logic, moved off `ScoreModel`
 * (docs/plans/code-shape-plan-2026-09-19.md, Phase 4.3e): they were the last two BODIES `rebarOps` could
 * only reach as callbacks — a re-bar that grows the score appends bars, and one that pushes a
 * downstream meter change forward inserts them.
 *
 * ⛔ REMOVING a measure is not here: it takes the marks anchored in it along, and stays where those
 * sweeps are called (`ScoreModel.removeMeasure`).
 */
import type { Measure, Score, TimeSignature } from '@/types/music'
import { fracCreate } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { effectiveTimeSignature, getMeterInfo } from '@/utils/meter'
import { fillRests } from '@/utils/restFill'
import { v4 as uuidv4 } from 'uuid'
import { pushRestSlot } from './restFillOps'

/** Deep-copy a time signature, including any additive grouping array. */
export function copyTimeSignature(ts: TimeSignature): TimeSignature {
  // SPREAD, then deep-copy the one field that is a reference. Listing the fields by hand is what
  // silently dropped `symbol`: the meter reached the model as 4/4 with a C on it and was stored as
  // a bare 4/4, so the ghost drew C and the score drew 4/4. Every field added to TimeSignature from
  // here on survives this function without anyone remembering to come back to it.
  return ts.grouping ? { ...ts, grouping: [...ts.grouping] } : { ...ts }
}

/**
 * Insert a fresh measure immediately AFTER the measure numbered `afterNumber`
 * (`afterNumber === 0` inserts at the very front; `afterNumber === length`
 * appends). Subsequent measures — and each of their slots' `.measure` field —
 * are renumbered, mirroring {@link removeMeasure}'s splice+renumber pattern.
 *
 * The new bar is rest-filled for its meter. A mid-score inserted bar is a
 * continuation, NOT an explicit change, so it is left unmarked — EXCEPT measure
 * 1, which always carries the score's opening time signature explicitly. Rebar
 * uses this to push a downstream TS change forward by materialising over the
 * inserted bars; `materializeBar` overwrites the rest-fill wholesale.
 *
 * With no explicit `timeSignature`, the bar inherits the meter in effect at the
 * measure it follows — so a bar added inside a 3/4 region is a 3/4 bar. (An empty
 * score has nothing to inherit from: DEFAULT_TIME_SIGNATURE.)
 */
export function insertMeasureAfter(score: Score, afterNumber: number, timeSignature?: TimeSignature): Measure {
  // Resolved BEFORE the splice below, so `afterNumber` still means the preceding bar.
  const ts = copyTimeSignature(timeSignature ?? effectiveTimeSignature(score, afterNumber))
  const measure: Measure = {
    id: uuidv4(),
    number: afterNumber + 1,
    slots: [],
    timeSignature: ts,
    tuplets: [],
  }
  // Measure 1 always carries the score's opening time signature explicitly.
  if (afterNumber === 0) measure.timeSignatureChange = true

  // Splice in right after `afterNumber` (front when 0, end when not found).
  const idx = afterNumber === 0 ? -1 : score.measures.findIndex((m) => m.number === afterNumber)
  const insertIdx = idx === -1 ? (afterNumber === 0 ? 0 : score.measures.length) : idx + 1
  score.measures.splice(insertIdx, 0, measure)

  // Renumber this measure + everything after it (and their slots' .measure).
  for (let i = insertIdx; i < score.measures.length; i++) {
    score.measures[i].number = i + 1
    score.measures[i].slots.forEach((slot) => {
      slot.measure = i + 1
    })
  }

  // Fill the measure with rests to match the time signature
  fillMeasureWithRests(measure)

  return measure
}

/** Append a measure at the end of the score — {@link insertMeasureAfter} the last one. */
export function addMeasure(score: Score, timeSignature?: TimeSignature): Measure {
  return insertMeasureAfter(score, score.measures.length, timeSignature)
}

/**
 * Fill an empty measure with rests for its time signature. An empty bar
 * collapses to a single measure rest in every meter (see {@link fillRests}).
 */
export function fillMeasureWithRests(measure: Measure): void {
  const meter = getMeterInfo(measure.timeSignature)
  const rests = fillRests(fracCreate(0, 1), measureCapacityFrac(measure), meter)
  for (const rest of rests) {
    pushRestSlot(measure, rest, 0)
  }
}
