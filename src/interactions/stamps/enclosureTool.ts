/**
 * ⭐ **The PARENTHESISED-note button's PRESS and its LIGHT** (`docs/plans/parenthesised-note-plan.md` P1)
 * — what the dev toolbar's `paren.` button does, in its own module (`CLAUDE.md`: a new feature adds a
 * MODULE). ⛔ Not a stamp: it arms nothing. It acts on the SELECTED heads — notes and grace notes alike —
 * through `engine.enclosure.toggle` (any bare ⇒ all get brackets; all bracketed ⇒ all lose them).
 *
 * The Keypad's Grace-page `1` key (`parenthesised note`) stays a picture until he says otherwise.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import type { SpanToolHost } from './spanToolPress'

/** The selected ids that name a head that may wear brackets (a rest or a bracketed grace may not). */
function selectedHeads(state: EditorState, engine: MusicEngine): string[] {
  return selectedNoteIds(state.selectedItems.values()).filter(id => {
    const note = engine.getNote(id)
    return note !== undefined && note !== null && !note.isRest && !engine.bracketed.isBracketed(id)
  })
}

/** Toggle the brackets on the selected heads — ONE undo entry — and redraw. */
export function pressEnclosure(host: SpanToolHost): void {
  const engine = host.getEngine()
  if (!engine) return
  const ids = selectedHeads(host.state, engine)
  const written = engine.enclosure.toggle(ids)
  if (written === undefined) return
  host.render()
  dbg(`[enclosure] ${written ?? 'none'} on ${ids.length} selected head(s)`)
}

/** Lit when every selected head wears brackets. */
export function enclosureLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (!engine) return false
  const ids = selectedHeads(state, engine)
  return ids.length > 0 && ids.every(id => engine.enclosure.of(id) !== undefined)
}

/** Pressable when at least one selected head may wear brackets. */
export function enclosureEnabled(state: EditorState, engine: MusicEngine | null): boolean {
  return !!engine && selectedHeads(state, engine).length > 0
}
