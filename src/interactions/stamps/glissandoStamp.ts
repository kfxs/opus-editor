/**
 * ⭐ **The GLISSANDO stamp's click** (docs/plans/glissando-plan.md; his ask, 2026-09-25) — a click puts a
 * glissando on the head it lands on, to the next note of its lane (derived — G4). One undo entry
 * (`engine.glissando`).
 *
 * ⛔ **ADDITIVE ONLY**, the brackets' rule (`./enclosureStamp`): a head that already carries one is left as it
 * is — taking it off is Delete (the line selected) or `gliss` with the note selected.
 * A rest or empty paper: the click is still CONSUMED — the tool is armed, so a near-miss must not fall
 * through to note entry.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, type EditorState } from '../state/EditorState'

export function stampGlissandoAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
): boolean {
  if (!armedTool(state, 'glissandoLine')) return false
  const nearest = registry.findClosestNoteOrRest(x, y)
  const noteId = nearest && registry.hitsNoteOrRestBody(nearest, x, y) ? nearest.id : undefined
  const note = noteId ? engine.getNote(noteId) : undefined
  if (!noteId || !note || note.isRest) {
    dbg(`· Glissando stamp: ${note?.isRest ? 'a rest' : 'not on a head'} — no change`)
    return true
  }
  if (engine.glissando.on(noteId)) {
    dbg(`· Glissando stamp: ${noteId} already has one — no change`)
    return true
  }
  if (engine.glissando.add([noteId])) {
    dbg(`✓ Glissando stamped on ${noteId}`)
    render()
  }
  return true
}
