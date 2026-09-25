/**
 * ⭐ **The GLISSANDO button's PRESS and its LIGHT** (docs/plans/glissando-plan.md P1) — what the dev
 * toolbar's `gliss` does, in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * His rule, 2026-09-25: *"i select a note, i click the gliss button so it defines the beginning
 * anchor"*. So a press puts one glissando on EACH selected head (a chord: one line per head, G9); where
 * it goes is not asked here — it is derived, every render, from the next note of the lane (G4).
 *
 * ⏳ Nothing selected does nothing yet (an armed click-stamp is a later phase). The Keypad Grace page's
 * `.` (`gliss`) stays a picture until he says otherwise.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
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
  const engine = host.getEngine()
  if (!engine) return
  const ids = selectedHeads(host.state, engine)
  if (!ids.length) {
    dbg('[glissando] nothing selected — select a note first')
    return
  }
  const made = engine.glissando.add(ids)
  dbg(`[glissando] ${made} made on ${ids.length} selected head(s)`)
  if (made) host.render()
}

/** Lit: every selected head already carries one. */
export function glissandoLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (!engine || state.selectedMarkingTool) return false
  const ids = selectedHeads(state, engine)
  return ids.length > 0 && ids.every(id => engine.glissando.on(id) !== undefined)
}
