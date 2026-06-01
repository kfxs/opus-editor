/**
 * Pure clef-resolution helpers shared by ScoreModel (data ops) and the renderer.
 *
 * Clefs are positioned at (measure, beat). The effective clef at a position is
 * the latest clef change at or before it, walking back across measures, falling
 * back to the score's opening clef, then 'treble'.
 */
import type { Score, Clef, ClefChange, Fraction } from '@/types/music'
import { fracCreate, fracEq, fracLte, fracLt, fracGt } from './fraction'

const ZERO: Fraction = fracCreate(0, 1)

/** Clef changes of a measure, sorted ascending by beat (empty if none). */
export function measureClefChanges(score: Score, measureNumber: number): ClefChange[] {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure?.clefs?.length) return []
  return [...measure.clefs].sort((a, b) => (fracLt(a.beat, b.beat) ? -1 : fracGt(a.beat, b.beat) ? 1 : 0))
}

/** The last (highest-beat) clef change in the nearest earlier measure, if any. */
function inheritedClef(score: Score, measureNumber: number): Clef | undefined {
  for (let n = measureNumber - 1; n >= 1; n--) {
    const changes = measureClefChanges(score, n)
    if (changes.length) return changes[changes.length - 1].clef
  }
  return undefined
}

/**
 * Clef in effect at (measureNumber, beat): the latest change with beat <= the
 * target in this measure, else inherited from earlier measures, else score
 * default, else 'treble'.
 */
export function effectiveClefAt(score: Score, measureNumber: number, beat: Fraction): Clef {
  const changes = measureClefChanges(score, measureNumber)
  let best: ClefChange | undefined
  for (const c of changes) {
    if (fracLte(c.beat, beat)) best = c // changes are sorted, so the last match wins
    else break
  }
  if (best) return best.clef
  return inheritedClef(score, measureNumber) ?? score.clef ?? 'treble'
}

/**
 * Clef in effect strictly before (measureNumber, beat) — ignores a change exactly
 * at that beat. Used to detect redundant changes during normalization.
 */
export function effectiveClefBefore(score: Score, measureNumber: number, beat: Fraction): Clef {
  const changes = measureClefChanges(score, measureNumber)
  let best: ClefChange | undefined
  for (const c of changes) {
    if (fracLt(c.beat, beat)) best = c
    else break
  }
  if (best) return best.clef
  return inheritedClef(score, measureNumber) ?? score.clef ?? 'treble'
}

/** The clef drawn at the start of a measure (its beat-0 change, or inherited). */
export function measureOpeningClef(score: Score, measureNumber: number): Clef {
  return effectiveClefAt(score, measureNumber, ZERO)
}

/**
 * The clef in effect at the *end* of a measure — its last (highest-beat) change,
 * else its opening clef. This is the clef carried silently into the next measure,
 * so a mid-line measure only needs to redraw its clef when its opening differs
 * from the previous measure's ending clef.
 */
export function measureEndingClef(score: Score, measureNumber: number): Clef {
  const changes = measureClefChanges(score, measureNumber)
  if (changes.length) return changes[changes.length - 1].clef
  return measureOpeningClef(score, measureNumber)
}

/** Mid-measure clef changes (beat > 0) of a measure, sorted by beat. */
export function midMeasureClefChanges(score: Score, measureNumber: number): ClefChange[] {
  return measureClefChanges(score, measureNumber).filter(c => !fracEq(c.beat, ZERO))
}
