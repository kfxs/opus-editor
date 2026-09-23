/**
 * ⭐ **The PARENTHESISED-note button's PRESS and its LIGHT** (`docs/plans/parenthesised-note-plan.md` P1,
 * P4b) — what the dev toolbar's `paren.` does, in its own module (`CLAUDE.md`: a new feature adds a
 * MODULE). The CONTEXT decides what a press means — the tremolo's routing (`PaletteController.
 * pressTremoloRouted`), his rules of 2026-09-23:
 *
 * 0. its own STAMP armed → a re-press DISARMS it; another tool armed → this stamp replaces it;
 * 1. the BRACKETS selected on the score → a press takes them off;
 * 2. NOTES selected (notes and graces alike) → toggle theirs (any bare ⇒ all get them; all ⇒ none);
 * 3. *"if nothing selected and nothing armed … we stamp just parenthesis"* → ARM the stamp
 *    (`./enclosureStamp`);
 * 4. *"if a duration is armed … we arm note stamp with parenthesis and other things armed"* — NOTE ENTRY →
 *    toggle `selectedEnclosure`: every note entered is born in brackets.
 *
 * The Keypad's Grace-page `1` key (`parenthesised note`) stays a picture until he says otherwise.
 */
import { dbg } from '@/utils/debug'
import type { HeadEnclosure } from '@/types/music'
import type { MusicEngine } from '@/engine/MusicEngine'
import { armedTool, selectedOf, type EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import type { SpanToolHost } from './spanToolPress'

/** The one shape the button arms today (N2 — `'square'` will be a second button, or a menu). */
const SHAPE: HeadEnclosure = 'round'

/** The selected ids that name a head that may wear brackets (a rest or a bracketed grace may not). */
function selectedHeads(state: EditorState, engine: MusicEngine): string[] {
  return selectedNoteIds(state.selectedItems.values()).filter(id => {
    const note = engine.getNote(id)
    return note !== undefined && note !== null && !note.isRest && !engine.bracketed.isBracketed(id)
  })
}

/** One press of `paren.` — see the header for which of the five it is. */
export function pressEnclosure(host: SpanToolHost): void {
  const state = host.state
  const engine = host.getEngine()
  // (0) The stamp is live: a re-press disarms. Another tool: this one replaces it.
  if (armedTool(state, 'headEnclosure')) {
    host.disarm()
    dbg('[enclosure] stamp disarmed')
    return
  }
  if (state.selectedMarkingTool) {
    host.arm({ kind: 'headEnclosure', shape: SHAPE })
    return
  }
  if (!engine) return
  // (1) The brackets themselves are selected → take them off.
  const brackets = selectedOf(state, 'headEnclosure')
  if (brackets) {
    if (engine.enclosure.set(engine.enclosure.headsOf(brackets.noteId), null)) {
      state.selectedElement = null
      host.render()
    }
    return
  }
  if (state.selectedTool === 'selection') {
    // (2) Notes selected → toggle theirs.
    const ids = selectedHeads(state, engine)
    if (ids.length) {
      const written = engine.enclosure.toggle(ids)
      if (written !== undefined) host.render()
      dbg(`[enclosure] ${written ?? 'none'} on ${ids.length} selected head(s)`)
      return
    }
    // (3) Nothing to act on → arm the stamp.
    host.arm({ kind: 'headEnclosure', shape: SHAPE })
    dbg('[enclosure] stamp armed')
    return
  }
  // (4) Note entry → the next notes are born in brackets (or no longer are).
  state.selectedEnclosure = state.selectedEnclosure === SHAPE ? null : SHAPE
  dbg(`[enclosure] entry ${state.selectedEnclosure ?? 'off'}`)
}

/** Lit: the stamp armed; in note entry, the entry value; in selection, every selected head bracketed. */
export function enclosureLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (armedTool(state, 'headEnclosure')) return true
  if (state.selectedMarkingTool) return false
  if (selectedOf(state, 'headEnclosure')) return true
  if (state.selectedTool === 'entry') return state.selectedEnclosure !== null
  if (!engine) return false
  const ids = selectedHeads(state, engine)
  return ids.length > 0 && ids.every(id => engine.enclosure.of(id) !== undefined)
}
