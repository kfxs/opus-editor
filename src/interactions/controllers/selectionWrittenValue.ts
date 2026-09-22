/**
 * ⭐ **A DURATION or DOT key with notes selected** — the value written onto the selection
 * (`PaletteController.setDuration` / `toggleDot`, extracted).
 *
 * - Every selected GRACE takes it (his report, 2026-09-22: *"i select some graces and changed the
 *   duration but it is only affecting the first"*): a grace's value is DRAWN, never counted, so it can
 *   go on all of them without moving a beat — ONE undo entry (`graceCommands.setGraceWritten`).
 * - An ordinary ANCHOR note takes it as it always did — `updateNote` on the one note the palette
 *   follows, which rebars. ⛔ Spreading a counted duration over a multi-selection is a different
 *   question (what the bar does), not answered here.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { NoteDuration } from '../../types/music'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'

export function writeSelectionValue(
  engine: MusicEngine, state: EditorState, written: { duration?: NoteDuration; dots?: number },
): void {
  const graces = selectedNoteIds(state.selectedItems.values()).filter(id => engine.isGraceNote(id))
  if (graces.length) engine.grace.setGraceWritten(graces, written)
  const anchor = state.selectedNoteId
  if (anchor && !graces.includes(anchor)) engine.updateNote(anchor, written)
}
