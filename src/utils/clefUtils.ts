/**
 * Pure clef-resolution helpers shared by ScoreModel (data ops) and the renderer.
 *
 * Clefs are positioned at (measure, beat). The effective clef at a position is
 * the latest clef change at or before it, walking back across measures, falling
 * back to the score's opening clef, then 'treble'.
 */
import type { Score, Clef, ClefChange, Fraction, PitchStep } from '@/types/music'
import { fracCreate, fracEq, fracLte, fracLt, fracGt } from './fraction'
import { spellingDiatonicPos } from './pitchSpelling'

const ZERO: Fraction = fracCreate(0, 1)

/**
 * Diatonic position (`spellingDiatonicPos`) of each clef's middle (3rd) staff line —
 * the reference for natural stem direction and the default tie/slur side. Single
 * source of truth; do not re-inline this table. treble=B4, bass=D3, alto=C4, tenor=A3.
 */
export const CLEF_MIDDLE_LINE_DIATONIC: Record<Clef, number> = {
  treble: 34, bass: 22, alto: 28, tenor: 26,
}

/** Middle-line diatonic position for a clef, defaulting to treble's (34 = B4). */
export function middleLineDiatonicPos(clef: Clef): number {
  return CLEF_MIDDLE_LINE_DIATONIC[clef] ?? 34
}

/**
 * Natural (un-forced) stem direction for a single note: at or above the clef's middle
 * line points the stem **down**, below it points **up**. Matches the convention used
 * across the renderer and data model.
 */
export function naturalStemDirection(step: PitchStep, octave: number, clef: Clef): 'up' | 'down' {
  return spellingDiatonicPos(step, octave) >= middleLineDiatonicPos(clef) ? 'down' : 'up'
}

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
