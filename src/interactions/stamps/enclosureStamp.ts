/**
 * ⭐ **The PARENTHESISED-note stamp's click** (`docs/plans/parenthesised-note-plan.md` P4b) — a click puts
 * the armed brackets on the head it lands on: a note's, or a grace's (graces register as notes). One
 * undo entry (`engine.enclosure`).
 *
 * ⛔ **ADDITIVE ONLY** — his word, 2026-09-23: *"clicking an already-bracketed note with the stamp, dont
 * toggle anything is like clicking a sharp on a note that already has a sharp"*. Taking them off is
 * Delete (the brackets selected) or `paren.` with the note selected.
 *
 * A rest, a bracketed grace (already in brackets) or empty paper: the click is still CONSUMED — the tool
 * is armed, so a near-miss must not fall through to note entry (the tremolo stamp's rule).
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, type EditorState } from '../state/EditorState'

export function stampEnclosureAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  const shape = armedTool(state, 'headEnclosure')?.shape
  if (shape === undefined) return false
  const nearest = registry.findClosestNoteOrRest(x, y)
  const noteId = nearest && registry.hitsNoteOrRestBody(nearest, x, y) ? nearest.id : undefined
  const note = noteId ? engine.getNote(noteId) : undefined
  if (!noteId || !note || note.isRest || engine.bracketed.isBracketed(noteId)) {
    dbg(`· Brackets stamp: ${note?.isRest ? 'a rest' : 'not on a head'} — no change`)
    return true
  }
  if (note.enclosure) {
    dbg(`· Brackets stamp: ${noteId} is already in brackets — no change (like a sharp on a sharp)`)
    return true
  }
  engine.enclosure.set([noteId], shape)
  dbg(`✓ Brackets stamped | ${shape} on ${noteId}`)
  render()
  return true
}
