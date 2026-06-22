/**
 * Mutating clef sub-API over a `Score` — extracted from {@link ScoreModel}, which
 * keeps thin public delegators to these free functions.
 *
 * Clefs live at (measure, beat) on `measure.clefs` (typed `ClefChange[]`). The
 * read-side resolvers (`effectiveClefAt`, `measureOpeningClef`, …) stay in
 * `utils/clefUtils.ts`; this module owns only the writes (set / remove / move /
 * normalize). Every function takes the `score` it operates on as a parameter — no
 * shared instance state — matching the `utils/rebar.ts` / `utils/restFill.ts` idiom.
 */
import type { Score, Measure, Clef, Fraction } from '@/types/music'
import { fracEq, fracCompare, fracIsZero } from '@/utils/fraction'
import { effectiveClefBefore } from '@/utils/clefUtils'
import { v4 as uuidv4 } from 'uuid'

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/**
 * Set/change the clef at (measure, beat). `beat` must already be snapped to a
 * slot boundary by the caller.
 *
 * - Measure 1 / beat 0 always stores an explicit opening clef and mirrors it
 *   into `score.clef` so the document keeps an opening clef.
 * - Otherwise the change is normalized: if `clef` equals the clef already in
 *   effect immediately before this beat, no visible change exists, so any
 *   existing change at this beat is removed instead of storing a redundant one.
 *
 * @returns true if the score changed.
 */
export function setClefAt(score: Score, measureNumber: number, beat: Fraction, clef: Clef): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  const isOpening = fracIsZero(beat)

  if (measureNumber === 1 && isOpening) {
    const scoreChanged = score.clef !== clef
    score.clef = clef
    const upserted = upsertClefChange(measure, beat, clef)
    return upserted || scoreChanged
  }

  // Redundant change → remove any existing change at this beat instead
  const inherited = effectiveClefBefore(score, measureNumber, beat)
  if (clef === inherited) {
    return removeClefChangeAt(measure, beat)
  }

  return upsertClefChange(measure, beat, clef)
}

/**
 * Remove a clef change at (measure, beat), reverting that position to the
 * inherited clef. Measure 1 / beat 0 cannot be removed (only changed).
 * @returns true if a change was removed.
 */
export function removeClefAt(score: Score, measureNumber: number, beat: Fraction): boolean {
  if (measureNumber === 1 && fracIsZero(beat)) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  return removeClefChangeAt(measure, beat)
}

/**
 * Relocate a clef change to a new position, possibly in a different measure.
 * Raw move: no normalization and no undo (the caller records a single undo
 * entry when the drag completes). The dragged clef has authority — if another
 * clef change already sits at the target beat, it is overwritten (removed) so
 * the dragged clef can take that position; this lets a drag pass through other
 * clefs rather than getting stuck. Refuses only a no-op move or landing on
 * measure 1 beat 0 (the protected score opening clef).
 * @returns true if the clef was relocated.
 */
export function moveClef(score: Score, fromMeasure: number, fromBeat: Fraction, toMeasure: number, toBeat: Fraction): boolean {
  if (fromMeasure === toMeasure && fracEq(fromBeat, toBeat)) return false
  if (toMeasure === 1 && fracIsZero(toBeat)) return false
  const src = getMeasure(score, fromMeasure)
  if (!src?.clefs) return false
  const idx = src.clefs.findIndex(c => fracEq(c.beat, fromBeat))
  if (idx === -1) return false
  const dst = getMeasure(score, toMeasure)
  if (!dst) return false

  const [moving] = src.clefs.splice(idx, 1)
  if (src.clefs.length === 0 && fromMeasure !== toMeasure) delete src.clefs

  if (!dst.clefs) dst.clefs = []
  // Overwrite any clef already sitting at the target beat.
  const occupantIdx = dst.clefs.findIndex(c => fracEq(c.beat, toBeat))
  if (occupantIdx !== -1) dst.clefs.splice(occupantIdx, 1)

  moving.beat = toBeat
  dst.clefs.push(moving)
  dst.clefs.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/** Relocate a clef change within a single measure (see {@link moveClef}). */
export function moveClefWithinMeasure(score: Score, measureNumber: number, fromBeat: Fraction, toBeat: Fraction): boolean {
  return moveClef(score, measureNumber, fromBeat, measureNumber, toBeat)
}

/**
 * Remove the clef change at (measure, beat) if it is redundant — i.e. equals
 * the clef already in effect immediately before it. Measure 1 / beat 0 (the
 * protected opening) is never removed. Used to clean up after a clef drag,
 * where redundant positions are allowed transiently but shouldn't persist.
 * @returns true if a redundant change was removed.
 */
export function normalizeClefAt(score: Score, measureNumber: number, beat: Fraction): boolean {
  if (measureNumber === 1 && fracIsZero(beat)) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure?.clefs) return false
  const change = measure.clefs.find(c => fracEq(c.beat, beat))
  if (!change) return false
  if (change.clef !== effectiveClefBefore(score, measureNumber, beat)) return false
  return removeClefChangeAt(measure, beat)
}

/** Insert or replace a clef change at the given beat, keeping the list sorted. */
function upsertClefChange(measure: Measure, beat: Fraction, clef: Clef): boolean {
  if (!measure.clefs) measure.clefs = []
  const existing = measure.clefs.find(c => fracEq(c.beat, beat))
  if (existing) {
    if (existing.clef === clef) return false
    existing.clef = clef
    return true
  }
  measure.clefs.push({ id: uuidv4(), beat, clef })
  measure.clefs.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/** Remove a clef change at the given beat, if present. */
function removeClefChangeAt(measure: Measure, beat: Fraction): boolean {
  if (!measure.clefs) return false
  const idx = measure.clefs.findIndex(c => fracEq(c.beat, beat))
  if (idx === -1) return false
  measure.clefs.splice(idx, 1)
  if (measure.clefs.length === 0) delete measure.clefs
  return true
}
