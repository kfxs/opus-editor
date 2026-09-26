/**
 * ⭐ **The CUE-size key's PRESS and its LIGHT** (`docs/plans/cue-size-plan.md` P1) — what the Keypad Grace
 * page's `Enter` does (the dev toolbar's `cue` did, until it was removed 2026-09-26), in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * - NOTES selected (notes, rests and graces alike) → toggle theirs: any full-size ⇒ all cue; all cue ⇒ all
 *   full (`engine/models/cueOps.toggleCue`). One undo entry.
 * - In NOTE ENTRY the press ARMS cue for the notes entered next (and a re-press disarms it) — his rule,
 *   2026-09-24: *"for note entry what is important is what is armed on the pallette"*. `state.selectedCue`, the
 *   brackets' twin: every note and rest entered is born cue-sized; its ghost shows it; Escape clears it.
 * - ⭐ NOTHING selected, in selection mode → the CUE STAMP: note entry with a QUARTER and cue armed (his rule,
 *   2026-09-24: *"nothing selected and i hit cue and nothing happend, we should be able to stamp cue maybe in this
 *   case we use quarter as default duration for cue stamp"*). What a quarter press from nothing-selected does
 *   (`PaletteController.setDuration`: a stale accidental dropped, entry mode) — plus cue: every click places a cue
 *   quarter, the Keypad retunes the length, a re-press of `cue` disarms.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { NoteDuration } from '@/types/music'
import type { EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import type { SpanToolHost } from './spanToolPress'

/** The length the CUE STAMP opens with — a quarter (his call, 2026-09-24). */
export const CUE_STAMP_DURATION: NoteDuration = 'q'

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
    state.selectedCue = !state.selectedCue
    host.render()
    dbg(`[cue] entry ${state.selectedCue ? 'armed' : 'off'}`)
    return
  }
  const ids = selectedCueIds(state, engine)
  if (!ids.length) {
    if (state.selectedMarkingTool || state.selectedNoteId || state.selectedItems.size > 0) return
    state.selectedAccidental = null
    state.selectedDuration = CUE_STAMP_DURATION
    state.selectedDots = 0
    state.selectedCue = true
    state.selectedTool = 'entry'
    host.render()
    dbg(`[cue] stamp: note entry with a ${CUE_STAMP_DURATION} and cue armed`)
    return
  }
  const written = engine.cue.toggle(ids)
  if (written !== undefined) host.render()
  dbg(`[cue] ${written ? 'cue' : 'full'} size on ${ids.length} selected note(s)`)
}

/** Lit: in note entry, cue ARMED; in selection, every selected note is cue. */
export function cueLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (state.selectedTool !== 'selection') return state.selectedCue
  if (!engine) return false
  const ids = selectedCueIds(state, engine)
  return ids.length > 0 && ids.every(id => engine.cue.of(id))
}
