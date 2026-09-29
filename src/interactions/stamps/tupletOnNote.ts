/**
 * ⭐ **A tuplet key pressed ON A NOTE** — what `Ctrl+`N (or a ratio button) does to the note it finds,
 * before `PaletteController.armTuplet` falls back to arming the ratio for the next entry.
 *
 * - SELECTION mode, a note selected → turn it into the tuplet's first note; a second press on a note
 *   already in a tuplet REMOVES that tuplet (as it always did).
 * - ENTRY mode, a cursor note → turn THAT note into the tuplet's first — type a note, then `Ctrl+3`, the
 *   way the tie key ties the note just entered (reported 2026-09-29). ⛔ A cursor note already in a
 *   tuplet is never removed from here: that would wipe what was just typed — the key ARMS instead. And
 *   only a PLAIN ratio: the Tuplet window's "in the time of" and Format are things
 *   `applyTupletToNote` cannot carry, so that press still arms.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { EditorState } from '../state/EditorState'

/** What the press did: `handled` false = nothing to act on, arm the ratio; `select` = the note to select. */
export type TupletOnNoteResult = { handled: false } | { handled: true; select?: string }

export function pressTupletOnNote(
  engine: MusicEngine | null,
  state: EditorState,
  numNotes: number,
  notesOccupied: number,
  /** No "in the time of" and no Format — a preset or `Ctrl+`N. */
  plainRatio: boolean,
): TupletOnNoteResult {
  if (!engine || !state.selectedNoteId) return { handled: false }
  const note = engine.getNote(state.selectedNoteId)

  if (state.selectedTool === 'selection') {
    if (!note) return { handled: true }
    if (note.tupletId) {
      engine.deleteTuplet(note.tupletId)
      return { handled: true }
    }
    const result = engine.applyTupletToNote(note.id, numNotes, notesOccupied)
    return { handled: true, ...(result && { select: result.note.id }) }
  }

  if (state.selectedTool !== 'entry' || state.selectedMarkingTool || !plainRatio) return { handled: false }
  if (!note || note.tupletId) return { handled: false }
  const result = engine.applyTupletToNote(note.id, numNotes, notesOccupied)
  if (!result) return { handled: false }
  state.armedTuplet = null // the ratio is spent on the note — reassign, not mutate
  return { handled: true, select: result.note.id }
}
