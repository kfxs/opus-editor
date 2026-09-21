/**
 * ⭐ **↑/↓ on selected RESTS — shift them up or down by one staff step**, instead of the pitch edit
 * (which skips rests anyway). docs/plans/rest-shift-plan.md.
 *
 * 🚨 His report, 2026-09-21: *"i selected more than one rest and im pressing arrow up down to move
 * it but is not moving it"*. This was a closure in `shortcutWiring` that answered only for a
 * selection of exactly ONE item. It now answers for a selection made ENTIRELY of rests, however
 * many — each shifted by the same step, as ONE undo entry.
 *
 * ⛔ A MIXED selection (rests and notes) DECLINES, as it always did: ↑/↓ then re-pitch the notes and
 * leave the rests where they are — what a passage selected for transposing wants.
 *
 * ⚠️ Per rest, the engine may refuse (the page limit): the others still move, and the key is
 * consumed as long as one of them did.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'

/** @param delta staff STEPS, counted UPWARD (+1 = one step up). @returns true when it consumed the key. */
export function nudgeSelectedRests(
  engine: MusicEngine | null,
  state: EditorState,
  delta: number,
  render: () => void,
): boolean {
  if (!engine || state.selectedItems.size === 0) return false
  // ⚠️ `selectedNoteIds` keeps only the `note` items, so an equal COUNT is what says "nothing else
  //   is selected" — a dynamic riding along with the rests makes it a mixed selection too.
  const ids = selectedNoteIds(state.selectedItems.values())
  if (ids.length !== state.selectedItems.size) return false
  if (!ids.every(id => engine.getNote(id)?.isRest)) return false

  const moved = engine.runBatch(`Nudge ${ids.length} rest(s)`, () => {
    for (const id of ids) engine.nudgeRestShift(id, delta)
  })
  if (!moved) return false
  render()
  return true
}
