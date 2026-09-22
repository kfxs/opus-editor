/**
 * ⭐ **WHICH REPORT a selected note item gets** — `rest`, `grace` or `note`. All three are selected the
 * same way (a `note` item: an id), and a grace is a note to every command that re-pitches it, but the
 * Properties window is asked *what is this?* and "note" was the wrong answer for a grace (his report,
 * 2026-09-22). Kept out of `selectionSnapshot`, whose switch stays one exhaustive site.
 */
import type { Note, Score } from '@/types/music'
import { isGraceNote } from '@/engine/models/graceOps'

export function noteReportKind(score: Score, note: Note): 'rest' | 'grace' | 'note' {
  if (note.isRest) return 'rest'
  return isGraceNote(score, note.id) ? 'grace' : 'note'
}
