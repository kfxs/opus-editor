/**
 * ⭐ **The note OFFSET on the keys** — Ctrl+Shift+←/→ (wide) and Shift+Alt+←/→ (fine) nudge a SINGLE
 * selected note or rest off its natural column, Ctrl+Shift+Backspace / Shift+Alt+Backspace drop it
 * (docs/plans/note-offset-plan.md §C). An OFFSET, ⛔ not spacing: the bar keeps its width. Each
 * DECLINES (false) when no single note/rest is selected, or nothing changed, so the key falls through.
 * One undo per press. The engine keys the override (`slotLookup.offsetTargetOf`): the slot for a
 * chord or a rest, a fanned member's or a GRACE's own first pitch.
 *
 * ⭐ **A note with NO COLUMN of its own** ({@link selectedHasNoColumn}) — a grace, which is ink of its
 * main note's column — has no space before it for the MOVE keys (Ctrl+←/→, Ctrl+Backspace) to set,
 * so they offset it instead (his report, 2026-09-22: *"ctr arrow right left … the offset is not
 * working in the grace"*).
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'

/** The one selected NOTE item's id, or null — a rest is a `note` item too. */
function singleNoteId(state: EditorState): string | null {
  if (state.selectedItems.size !== 1) return null
  const item = [...state.selectedItems.values()][0]
  return item.kind === 'note' ? item.id : null
}

/** @param dx staff spaces, +right. @returns true when it consumed the key. */
export function nudgeSelectedNoteOffset(
  engine: MusicEngine | null, state: EditorState, dx: number, render: () => void,
): boolean {
  const id = singleNoteId(state)
  if (!engine || !id || !engine.nudgeNoteOffset(id, dx)) return false
  render()
  return true
}

/** Back to the natural column outright — the first-class reset, ⛔ not a walk back to 0. */
export function resetSelectedNoteOffset(
  engine: MusicEngine | null, state: EditorState, render: () => void,
): boolean {
  const id = singleNoteId(state)
  if (!engine || !id || !engine.resetNoteOffset(id)) return false
  render()
  return true
}

/** Is the ONE selected note one that stands in no column of its own? */
export function selectedHasNoColumn(engine: MusicEngine | null, state: EditorState): boolean {
  const id = singleNoteId(state)
  return !!engine && !!id && !!engine.getNote(id) && !engine.spacingColumnOf(id)
}
