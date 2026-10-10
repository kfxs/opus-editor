/**
 * ⭐ **The bracketed-accidental key's PRESS and its LIGHT** — the Keypad Accidentals page's `Enter`
 * (docs/plans/alteration-signs-plan.md K3), in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * Sibelius's parentheses button (docs/research/sibelius-keypad.md §"The parentheses button"), on what is
 * SELECTED:
 * 1. the BRACKETS themselves selected on the score → take them off;
 * 2. an ACCIDENTAL selected on the score → toggle its note's brackets;
 * 3. NOTES selected → toggle theirs (any bare ⇒ all get them; all ⇒ none) — a note that shows no sign
 *    shows its implied one in the brackets, and the second press hides it again (plan §5 default 2);
 * 4. NOTE ENTRY → arm / disarm the brackets for the notes entered next (`selectedSignEnclosure`, his ask
 *    2026-10-10) — the ghost wears them: the armed sign bracketed, or a bracketed natural with none armed;
 * 5. ⛔ nothing selected in selection mode → nothing (plan §5 default 3). No stamp.
 *
 * ⭐ Graces and fan members too (K3b, `engine/models/accidentalEnclosureOps`); ⚠️ a bracketed grace's id is skipped by the op.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import { selectedOf, type EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'

/** What a press needs: the state, the engine, and a redraw. */
export interface AccidentalEnclosureHost {
  state: EditorState
  getEngine(): MusicEngine | null
  render(): void
}

/** The pitches a press acts on — the selected accidental's note, else the selected notes (no rests). */
function targets(state: EditorState, engine: MusicEngine): string[] {
  const brackets = selectedOf(state, 'accidentalEnclosure')
  if (brackets) return [brackets.noteId]
  const sign = selectedOf(state, 'accidental')
  if (sign) return [sign.noteId]
  if (state.selectedTool !== 'selection') return []
  return selectedNoteIds(state.selectedItems.values()).filter(id => {
    const note = engine.getNote(id)
    return note !== undefined && note !== null && !note.isRest
  })
}

/** One press of `Enter` — see the header. */
export function pressAccidentalEnclosure(host: AccidentalEnclosureHost): void {
  const state = host.state
  if (state.selectedTool === 'entry' && !selectedOf(state, 'accidental') && !selectedOf(state, 'accidentalEnclosure')) {
    state.selectedSignEnclosure = state.selectedSignEnclosure ? null : 'round'
    dbg(`[accidental enclosure] entry ${state.selectedSignEnclosure ?? 'off'}`)
    return
  }
  const engine = host.getEngine()
  if (!engine) return
  const brackets = selectedOf(state, 'accidentalEnclosure')
  if (brackets) {
    // (1) The brackets themselves are selected → take them off; nothing is left to keep selected.
    if (engine.signEnclosure.set([brackets.noteId], null)) {
      state.selectedElement = null
      host.render()
    }
    return
  }
  const ids = targets(state, engine)
  if (!ids.length) return
  const written = engine.signEnclosure.toggle(ids)
  if (written !== undefined) host.render()
  dbg(`[accidental enclosure] ${written ?? 'nothing'} on ${ids.length} selected pitch(es)`)
}

/** Lit: every pitch a press would act on already has its accidental in brackets. */
export function accidentalEnclosureLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (selectedOf(state, 'accidentalEnclosure')) return true
  if (state.selectedTool === 'entry' && !selectedOf(state, 'accidental')) return state.selectedSignEnclosure !== null
  if (!engine) return false
  const ids = targets(state, engine)
  return ids.length > 0 && ids.every(id => engine.signEnclosure.of(id) !== undefined)
}
