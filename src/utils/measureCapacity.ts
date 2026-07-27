import type { Measure, TimeSignature } from '@/types/music'
import { type Fraction, fracCreate, fracMul, fracToNumber } from '@/utils/fraction'

/**
 * How much fits in a bar — the four functions that answer it, and nothing else.
 *
 * They lived in `musicUtils` until 2026-07-27, where they were the load-bearing end of a real import
 * cycle: `musicUtils → tempoText → tempoMap → musicUtils`, closed by `tempoMap` needing
 * {@link measureCapacityQuarters} to lay a score out in time. ESM hoisting happens to make that work
 * today; a change in bundling order turns it into `undefined is not a function` at module init, and
 * the failure would look like nothing to do with meter. Splitting the leaf out breaks it for good
 * (docs/refactor-plan-2026-07-27.md 3d).
 *
 * The split is not just cycle-breaking, though — this IS a subject. "How long is this bar" is the
 * question every timing decision starts from (entry overflow, re-barring, playback, layout, the
 * cursor), and it has exactly one right answer per measure. A grab-bag module is the wrong place to
 * keep the thing everything else is measured against.
 *
 * Depends on nothing but `Fraction` and the types, so it is callable from anywhere in the core.
 */

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
