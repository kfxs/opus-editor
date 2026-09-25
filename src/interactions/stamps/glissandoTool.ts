/**
 * ⭐ **The GLISSANDO button's PRESS and its LIGHT** (docs/plans/glissando-plan.md P1) — what the dev
 * toolbar's `gliss` does, in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * His rule, 2026-09-25: *"i select a note, i click the gliss button so it defines the beginning
 * anchor"*. So a press puts one glissando on EACH selected head (a chord: one line per head, G9); where
 * it goes is not asked here — it is derived, every render, from the next note of the lane (G4).
 * ⭐ And a press where every selected head already has one takes them OFF — the brackets' toggle (his ask).
 *
 * ⭐ Nothing selected ARMS the stamp (the blue cursor — `./glissandoStamp`); pressed again, it disarms. The
 * Keypad Grace page's `.` (`gliss`) stays a picture until he says otherwise.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import { armedTool, type EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import type { SpanToolHost } from './spanToolPress'

/** The selected ids that name a head (a rest may not carry one — the ops refuse it anyway). */
function selectedHeads(state: EditorState, engine: MusicEngine): string[] {
  return selectedNoteIds(state.selectedItems.values()).filter(id => {
    const note = engine.getNote(id)
    return note !== undefined && note !== null && !note.isRest
  })
}

/** One press of `gliss`. */
export function pressGlissando(host: SpanToolHost): void {
  const state = host.state
  // The STAMP is live: a re-press disarms. Another tool armed: this one replaces it (the brackets' rule).
  if (armedTool(state, 'glissandoLine')) {
    host.disarm()
    dbg('[glissando] stamp disarmed')
    return
  }
  if (state.selectedMarkingTool) {
    host.arm({ kind: 'glissandoLine' })
    return
  }
  const engine = host.getEngine()
  if (!engine) return
  const ids = selectedHeads(state, engine)
  if (!ids.length) {
    // ⭐ Nothing selected → ARM the stamp: the blue cursor, and a click puts a glissando on the head it lands
    //   on (his ask, 2026-09-25 — `./glissandoStamp`).
    host.arm({ kind: 'glissandoLine' })
    dbg('[glissando] stamp armed')
    return
  }
  // ⭐ A TOGGLE (his ask, 2026-09-25): any selected head without one ⇒ all get one; all with one ⇒ all lose it.
  const did = engine.glissando.toggle(ids)
  dbg(`[glissando] ${did ?? 'nothing'} on ${ids.length} selected head(s)`)
  if (did) host.render()
}

/** Lit: the stamp armed; or every selected head already carries one. */
export function glissandoLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (armedTool(state, 'glissandoLine')) return true
  if (!engine || state.selectedMarkingTool) return false
  const ids = selectedHeads(state, engine)
  return ids.length > 0 && ids.every(id => engine.glissando.on(id) !== undefined)
}
