/**
 * What the span and dynamics LANES each asked of the last render in the same words — four tiny
 * bodies spelled once per family (docs/code-shape-plan-2026-09-19.md, Phase 5). ⛔ No gesture decides
 * anything here: these READ the registry, and every family's walk stays its own.
 *
 * ⚠️ Measured before merging — only copies that were identical line for line are here. NOT here, on
 * purpose: the slur body's staff space (it prefers a space MEASURED on the drawn arc), and each
 * family's `drawnOnsets` (the pedal's reads a measure rest at its bar's onset, the ottava's keeps the
 * right edge its hook closes around).
 */
import type { Fraction, Score } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry, ElementType } from '../engine/ElementRegistry'
import { fracCompare } from '../utils/fraction'
import { lastMeasureNumber, systemInkAt, type SystemInk } from './markBreakWrap'

/** The 0-based staff a mark's `staffId` names. ⚠️ Absent IS the first staff, and so is an id the
 *  score no longer has. */
export function staffIndexOf(score: Score, staffId: string | undefined): number {
  if (!staffId) return 0
  const at = score.staves?.findIndex(s => s.id === staffId) ?? -1
  return at === -1 ? 0 : at
}

/**
 * The staff space, in pixels, of the staff a mark was DRAWN on — the px→staff-space scale its drag
 * and its arrows are measured in. ⛔ Null when the mark drew nothing or its staff has no measured
 * geometry: a guessed scale would move a small staff's mark by the wrong amount.
 */
export function markStaffSpacePx(registry: ElementRegistry, kind: ElementType, id: string): number | null {
  const drawn = registry.getByType(kind).find(e => e.id === id)
  if (!drawn || drawn.measure === undefined) return null
  return registry.getStaffGeometry(drawn.measure, drawn.staff ?? 0)?.lineSpacing ?? null
}

/** The ink range of the SYSTEM an address stands on, for the staff a mark belongs to — what a
 *  crossing is measured against (`./markBreakWrap`). Null when that bar was not drawn. */
export function markSystemInkLimit(
  engine: Pick<MusicEngine, 'getScore' | 'getElementRegistry'>,
  staffId: string | undefined,
  at: { measure: number },
): SystemInk | null {
  const score = engine.getScore()
  return systemInkAt(engine.getElementRegistry(), staffIndexOf(score, staffId), at.measure, lastMeasureNumber(score))
}

/** Two slot addresses name the same place. */
export function sameSlotAddress(
  a: { measure: number; beat: Fraction },
  b: { measure: number; beat: Fraction },
): boolean {
  return a.measure === b.measure && fracCompare(a.beat, b.beat) === 0
}
