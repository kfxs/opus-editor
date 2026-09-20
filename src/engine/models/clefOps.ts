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
import { clearClefOffset } from './overrideOps'

/**
 * Same-staff test for two clef changes. Staff 0 always stores an ABSENT `staffId`
 * (the write convention — {@link MusicEngine.staffIdForIndex} yields undefined for
 * index 0), and any later staff stores its real id, so strict equality is exact: two
 * clefs on one staff share the same (possibly undefined) id. See docs/plans/multi-staff-plan.md §4.
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
 * Clef is per-staff content — there is no document-level clef. The change is
 * normalized uniformly for every staff (including m1 b0): if `clef` equals the
 * clef already in effect immediately before this beat on this staff, no visible
 * change exists, so any change at this beat is removed instead of storing a
 * redundant one. At m1 b0 the "inherited before" is the universal 'treble'
 * default, so setting `treble` there stores nothing and the opening renders
 * `treble` via the default.
 *
 * @returns true if the score changed.
 */
export function setClefAt(score: Score, measureNumber: number, beat: Fraction, clef: Clef, staffId?: string): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false

  // Redundant change (equals THIS staff's inherited clef) → remove any change here instead
  const inherited = effectiveClefBefore(score, measureNumber, beat, staffId)
  if (clef === inherited) {
    return removeClefChangeAt(measure, beat, staffId)
  }

  return upsertClefChange(measure, beat, clef, staffId)
}

/**
 * Remove a clef change at (measure, beat), reverting that position to the
 * inherited clef. Measure 1 / beat 0 (each staff's opening clef) cannot be
 * removed (only changed) — protected on every staff for symmetry.
 * @returns true if a change was removed.
 */
export function removeClefAt(score: Score, measureNumber: number, beat: Fraction, staffId?: string): boolean {
  if (measureNumber === 1 && fracIsZero(beat)) return false
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  // ⛔ **An override must not outlive its anchor** — the sweep every id-keyed client owes the
  // compartment (`removeDynamic`'s rule). Read the id BEFORE the removal, or there is nothing left
  // to key by.
  const dying = clefChangeAt(score, measureNumber, beat, staffId)
  const removed = removeClefChangeAt(measure, beat, staffId)
  if (removed && dying) clearClefOffset(score, dying.id)
  return removed
}

/**
 * ⭐ **The clef change written at (measure, beat) on a staff**, or undefined when nothing is written
 * there. The one lookup that hands back the CHANGE OBJECT rather than a resolved clef — which is what
 * anything keyed by {@link ClefChange.id} needs (the hand-nudged horizontal offset, his ask of
 * 2026-08-28).
 *
 * ⚠️ ⛔ Not `getEffectiveClefAt`: that answers *what clef sounds here*, walking back through earlier
 * bars, and a caller asking it for an id would be handed the id of a change written somewhere else.
 * This one is strictly *is there a change AT this address*.
 */
export function clefChangeAt(
  score: Score, measureNumber: number, beat: Fraction, staffId?: string,
): ClefChange | undefined {
  const measure = getMeasure(score, measureNumber)
  return measure?.clefs?.find(c => fracEq(c.beat, beat) && sameStaff(c.staffId, staffId))
}

/**
 * Relocate a clef change to a new position, possibly in a different measure.
 * Raw move: no normalization and no undo (the caller records a single undo
 * entry when the drag completes). The dragged clef has authority — if another
 * clef change already sits at the target beat, it is overwritten (removed) so
 * the dragged clef can take that position; this lets a drag pass through other
 * clefs rather than getting stuck. Refuses only a no-op move or landing on
 * measure 1 beat 0 (each staff's protected opening clef).
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
  // ⭐⭐ **A RE-ANCHOR DROPS THE HAND NUDGE** — the offset family's standing rule (the dynamic's
  // `moveDynamicBySlot` and the note's `moveNoteOffset` both do this). The nudge said *"a little to
  // the right of where the engraver put you HERE"*; carried to another slot it is a sentence about a
  // place the clef has left, and it would land the glyph at an offset nobody authored.
  clearClefOffset(score, moving.id)
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
