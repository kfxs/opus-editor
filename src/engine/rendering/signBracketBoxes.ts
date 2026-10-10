/**
 * ⭐ **An accidental's hit boxes** — the sign's own (`accidental`, the whole run) and, for a BRACKETED sign
 * (docs/plans/alteration-signs-plan.md K3), `(` and `)` each filed as an `accidentalEnclosure` entry under
 * the pitch, so a press on a bracket selects the brackets ALONE (his ask, 2026-10-10: *"i should be also able
 * to select the parenthesis individual so i can delete it"*).
 *
 * Moved out of `ScoreRenderer` with K3 so the renderer's line names no element kind (`lint:hubs`).
 */
import type { ElementInfo, ElementRegistry } from '@/engine/ElementRegistry'
import type { EngravedAccidental } from './engraved/EngravedAccidental'
import { accidentalHitBox } from './painter/drawnHitBox'

/** File the sign, then its brackets, each from its own drawn ink, with one locator. */
export function registerSignBoxes(
  registry: ElementRegistry,
  sign: EngravedAccidental,
  drawn: ElementInfo['accidentalType'],
  at: Pick<ElementInfo, 'noteId' | 'measure' | 'staff' | 'beat' | 'staffPosition'>,
): void {
  const box = accidentalHitBox(sign)
  if (box) registry.add({ type: 'accidental', ...at, accidentalType: drawn, bbox: box })
  for (const bracket of sign.drawnBracketInk()) {
    registry.add({ type: 'accidentalEnclosure', ...at, bbox: bracket })
  }
}
