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
import type { Score, Measure, Clef, ClefChange, Fraction } from '@/types/music'
import { fracEq, fracCompare, fracIsZero } from '@/utils/fraction'
import { effectiveClefBefore } from '@/utils/clefUtils'
import { v4 as uuidv4 } from 'uuid'

/**
 * Same-staff test for two clef changes. Staff 0 always stores an ABSENT `staffId`
 * (the write convention — {@link MusicEngine.staffIdForIndex} yields undefined for
 * index 0), and any later staff stores its real id, so strict equality is exact: two
 * clefs on one staff share the same (possibly undefined) id. See docs/multi-staff-plan.md §4.
 */
function sameStaff(a: string | undefined, b: string | undefined): boolean {
  return a === b
}

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
export function setClefAt(score: Score, measureNumber: number, beat: Fraction, clef: Clef, staffId?: string): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  const isOpening = fracIsZero(beat)

  // Only the FIRST staff (absent staffId) owns `score.clef`, the document's single
  // opening clef. A later staff's beat-0 clef is an ordinary per-staff change.
  if (measureNumber === 1 && isOpening && staffId === undefined) {
    const scoreChanged = score.clef !== clef
    score.clef = clef
    const upserted = upsertClefChange(measure, beat, clef, staffId)
    return upserted || scoreChanged
  }

  // Redundant change (equals THIS staff's inherited clef) → remove any change here instead
  const inherited = effectiveClefBefore(score, measureNumber, beat, staffId)
  if (clef === inherited) {
    return removeClefChangeAt(measure, beat, staffId)
  }

  return upsertClefChange(measure, beat, clef, staffId)
}

/**
 * Remove a clef change at (measure, beat), reverting that position to the
 * inherited clef. Measure 1 / beat 0 cannot be removed (only changed).
 * @returns true if a change was removed.
 */
export function removeClefAt(score: Score, measureNumber: number, beat: Fraction, staffId?: string): boolean {
  if (measureNumber === 1 && fracIsZero(beat) && staffId === undefined) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  return removeClefChangeAt(measure, beat, staffId)
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
  // Overwrite any clef already sitting at the target beat ON THE SAME STAFF (a clef on
  // another staff at the same beat is an independent change and must survive the move).
  const occupantIdx = dst.clefs.findIndex(c => fracEq(c.beat, toBeat) && sameStaff(c.staffId, moving.staffId))
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
export function normalizeClefAt(score: Score, measureNumber: number, beat: Fraction, staffId?: string): boolean {
  if (measureNumber === 1 && fracIsZero(beat) && staffId === undefined) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure?.clefs) return false
  const change = measure.clefs.find(c => fracEq(c.beat, beat) && sameStaff(c.staffId, staffId))
  if (!change) return false
  if (change.clef !== effectiveClefBefore(score, measureNumber, beat, staffId)) return false
  return removeClefChangeAt(measure, beat, staffId)
}

/** Insert or replace a clef change at the given beat ON A STAFF, keeping the list sorted. */
function upsertClefChange(measure: Measure, beat: Fraction, clef: Clef, staffId?: string): boolean {
  if (!measure.clefs) measure.clefs = []
  const existing = measure.clefs.find(c => fracEq(c.beat, beat) && sameStaff(c.staffId, staffId))
  if (existing) {
    if (existing.clef === clef) return false
    existing.clef = clef
    return true
  }
  const change: ClefChange = { id: uuidv4(), beat, clef }
  if (staffId !== undefined) change.staffId = staffId
  measure.clefs.push(change)
  measure.clefs.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/** Remove a clef change at the given beat ON A STAFF, if present. */
function removeClefChangeAt(measure: Measure, beat: Fraction, staffId?: string): boolean {
  if (!measure.clefs) return false
  const idx = measure.clefs.findIndex(c => fracEq(c.beat, beat) && sameStaff(c.staffId, staffId))
  if (idx === -1) return false
  measure.clefs.splice(idx, 1)
  if (measure.clefs.length === 0) delete measure.clefs
  return true
}
