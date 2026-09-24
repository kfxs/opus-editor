/**
 * ⭐ **The CUE-size button's PRESS and its LIGHT** (`docs/plans/cue-size-plan.md` P1) — what the dev
 * toolbar's `cue` does, in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * - NOTES selected (notes, rests and graces alike) → toggle theirs: any full-size ⇒ all cue; all cue ⇒ all
 *   full (`engine/models/cueOps.toggleCue`). One undo entry.
 * - ⏭️ In NOTE ENTRY the press will ARM cue for the notes entered next — his rule, 2026-09-24: *"for note
 *   entry what is important is what is armed on the pallette"*. Not built yet: the press logs and does
 *   nothing, rather than guess.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import type { SpanToolHost } from './spanToolPress'

/** The selected ids that name a note, a rest or a grace — what can be cue. */
function selectedCueIds(state: EditorState, engine: MusicEngine): string[] {
  return selectedNoteIds(state.selectedItems.values()).filter(id => engine.getNote(id))
}

/** One press of `cue` — see the header. */
export function pressCue(host: SpanToolHost): void {
  const state = host.state
  const engine = host.getEngine()
  if (!engine) return
  if (state.selectedTool !== 'selection') {
    dbg('[cue] note entry: arming cue for entry is not built yet (cue-size-plan, open)')
    return
  }
  const ids = selectedCueIds(state, engine)
  if (!ids.length) return
  const written = engine.cue.toggle(ids)
  if (written !== undefined) host.render()
  dbg(`[cue] ${written ? 'cue' : 'full'} size on ${ids.length} selected note(s)`)
}

/** Lit: in selection, every selected note is cue. */
export function cueLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (!engine || state.selectedTool !== 'selection') return false
  const ids = selectedCueIds(state, engine)
  return ids.length > 0 && ids.every(id => engine.cue.of(id))
}
