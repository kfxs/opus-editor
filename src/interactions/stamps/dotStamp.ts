/**
 * ⭐ **The DOT stamp's click**, in its own module (moved out of `MouseController` for the double and triple
 * dot, docs/plans/multiple-dots-plan.md P2 — as every newer stamp already lives here).
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, type EditorState } from '../state/EditorState'

/**
 * Dot stamp tool: a click gives the note clicked the armed COUNT of dots — 1, 2 or 3 (D5). Mirrors its
 * siblings: the same note-body hit-test, one `runBatch` = one undo, IDEMPOTENT (a note that already
 * has that count is a no-op; a note with ANOTHER count is switched to it — the counts are a radio, D6).
 * Removal is Delete, or the dot key with the dots selected.
 *
 * The one stamp that ALSO applies to RESTS: a rest takes dots exactly as a note does, so there is no
 * `isRest` guard. Dotting can be REFUSED (D4): a REST or tuplet member that no longer fits, or more dots
 * than the value takes, writes nothing; a NOTE past the barline crosses it tied. The model does not
 * throw, so report what actually happened instead of assuming.
 */
export function stampDotAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const count = armedTool(state, 'dot')?.count
  if (count === undefined) return false

  const el = registry.findClosestNoteOrRest(x, y)
  if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
    dbg(`· Dot stamp: click not on a note or rest — no change`)
    return true
  }
  const noteId = el.id
  const note = engine.getNote(noteId)
  if (!note) {
    dbg(`· Dot stamp: non-note — no change`)
    return true
  }
  if ((note.dots ?? 0) === count) {
    dbg(`· Dot stamp: ${noteId} already has ${count} dot(s) — no change`)
    return true
  }
  engine.runBatch(count === 1 ? 'Add dot' : `Add ${count} dots`, () => engine.updateNote(noteId, { dots: count }))
  if ((engine.getNote(noteId)?.dots ?? 0) === count) dbg(`✓ Dot stamped | ${count} on ${note.isRest ? 'rest' : 'note'} ${noteId}`)
  else dbg(`· Dot stamp: ${count} dot(s) refused on ${noteId} — see the model's reason above`)
  render()
  return true
}
