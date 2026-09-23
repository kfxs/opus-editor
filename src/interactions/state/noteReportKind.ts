/**
 * ⭐ **WHICH REPORT a selected note item gets** — `rest`, `grace` or `note`. All three are selected the
 * same way (a `note` item: an id), and a grace is a note to every command that re-pitches it, but the
 * Properties window is asked *what is this?* and "note" was the wrong answer for a grace (his report,
 * 2026-09-22). Kept out of `selectionSnapshot`, whose switch stays one exhaustive site.
 */
import type { Note, Score } from '@/types/music'
import { isGraceNote } from '@/engine/models/graceOps'
import { bracketedSideInfo, isBracketedGrace } from '@/engine/models/bracketedGraceOps'

export function noteReportKind(score: Score, note: Note): 'rest' | 'grace' | 'bracketed' | 'note' {
  if (note.isRest) return 'rest'
  // ⭐ …and a BRACKETED grace is reported as what it is (docs/plans/bracketed-grace-plan.md): its panel is
  //    the grace's — the offset — ⛔ not a note's (no stem to align, no beam, no fan).
  if (isBracketedGrace(score, note.id)) return 'bracketed'
  return isGraceNote(score, note.id) ? 'grace' : 'note'
}

/**
 * ⭐ What a note report COMPUTES beyond its data — today a BRACKETED grace's side and whether it may stand
 * after its target (bracketed-grace-plan P6, the Properties before/after switch). Empty for every other note.
 */
export function noteReportDerived(score: Score, note: Note): { derived?: { side: 'before' | 'after'; canBeAfter: boolean } } {
  const info = bracketedSideInfo(score, note.id)
  return info ? { derived: info } : {}
}
