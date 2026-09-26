/**
 * ⭐ **The BRACKETED grace tool's PRESS and its LIGHT** (`docs/plans/bracketed-grace-plan.md` P2) — what
 * the Keypad Grace page's `-` does (the dev toolbar's `bracket.` did, until removed 2026-09-26), in its own module (the palette lends it its arm/disarm,
 * {@link SpanToolHost}), as `./graceTool` is the grace buttons'.
 *
 * ⭐ In SELECTION mode with NOTES selected, a press arms nothing: each note BECOMES a bracketed grace before
 * the rest that takes its place (his rule, 2026-09-23: *"if a note is selected and we press the bracket
 * this note becomes a bracket and we fill the note slot with a rest of it duration, similar to grace"*),
 * and what was made is the selection — a selected GRACE likewise, its target what stands to its right
 * (`noteToBracketedOps.graceToBracketed`). With BRACKETED graces selected, the lit button toggles them OFF:
 * each target takes its pitch (`noteToBracketedOps.bracketedToNote`). Otherwise it arms the stamp.
 */
import { dbg } from '@/utils/debug'
import type { BracketedSide } from '@/utils/bracketedGraces'
import { armedTool, type EditorState } from '../state/EditorState'
import type { SpanToolHost } from './spanToolPress'
import type { MusicEngine } from '@/engine/MusicEngine'
import { itemKey, selectedNoteIds, type SelectionItem } from '../state/selection'
import { durationHighlight } from '../controllers/keypadSync'
import { BRACKETED_DEFAULT_DURATION } from '@/engine/models/bracketedGraceOps'

/** Arm the bracketed stamp for `side` — or disarm it, when the same one is armed already. */
export function pressBracketedTool(host: SpanToolHost, side: BracketedSide): void {
  const engine = host.getEngine()
  const ids = host.state.selectedTool === 'selection' && engine ? selectedNoteIds(host.state.selectedItems.values()) : []
  // ⭐ Selected BRACKETED graces → the lit button TOGGLES them OFF (his rule, 2026-09-23): each target takes
  //    its pitch, keeping its value, and the bracketed grace goes. What was re-pitched is the selection.
  const bracketed = engine ? ids.filter(id => engine.bracketed.isBracketed(id)) : []
  if (engine && bracketed.length) {
    const made = engine.bracketed.toNotes(bracketed)
    if (made.length) {
      host.state.selectedItems = new Map(made.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
      host.state.selectedNoteId = made[0]
      host.render()
    }
    dbg(`[bracketed] selection → ${made.length} bracketed grace(s) toggled off onto their targets`)
    return
  }
  // ⭐ Selected GRACES → each becomes a bracketed grace, its target what stands to its right (his rule,
  //    2026-09-23); the rest of its group stays.
  const graces = engine ? ids.filter(id => engine.isGraceNote(id)) : []
  // Ordinary notes — a rest has no pitch; a grace or a bracketed grace is not a note to convert.
  const notes = engine
    ? ids.filter(id => !engine.isGraceNote(id) && !engine.bracketed.isBracketed(id) && engine.getNote(id)?.isRest === false)
    : []
  if (engine && (graces.length || notes.length)) {
    let made: string[] = []
    engine.runBatch('Make bracketed grace', () => {
      made = [...engine.bracketed.convertGraces(graces), ...engine.bracketed.convertNotes(notes)]
    })
    // REASSIGN, never mutate: the observable state only sees a top-level write.
    if (made.length) {
      host.state.selectedItems = new Map(made.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
      host.state.selectedNoteId = made[0]
      host.render()
    }
    dbg(`[bracketed] selection → ${made.length} grace(s)/note(s) made bracketed graces`)
    return
  }
  const armed = armedTool(host.state, 'bracketedGrace')
  if (armed && armed.side === side) {
    host.state.selectedAccidental = null
    // Back to NOTE ENTRY, as the grace's re-press is (his report, 2026-09-22).
    host.disarmToEntry()
    dbg('[bracketed] stamp disarmed — note entry')
    return
  }
  // Read BEFORE arming, as the grace does: nothing lit ⇒ nothing was chosen, so a quarter's black head
  // (B7's picture); a lit key is a value somebody chose, and it stays.
  if (!armed && durationHighlight(host.state) === null) {
    host.state.selectedDuration = BRACKETED_DEFAULT_DURATION
    host.state.selectedDots = 0
  }
  // A stale note-entry accidental is not a choice made for it (the grace's rule).
  if (!armed) host.state.selectedAccidental = null
  host.arm({ kind: 'bracketedGrace', side })
  dbg(`[bracketed] stamp armed (${side})`)
}

/**
 * Is the button for `side` lit? By the ARMED tool — or, ⭐ with none armed, in SELECTION mode, by a
 * SELECTED bracketed grace on that side (his report, 2026-09-23: *"when i have a bracket selected i dont
 * see the state in the bracket pallete button"* — the grace buttons' rule, `./graceTool.graceToolLit`).
 */
export function bracketedToolLit(state: EditorState, side: BracketedSide, engine?: MusicEngine | null): boolean {
  const armed = armedTool(state, 'bracketedGrace')
  if (armed) return armed.side === side
  if (!engine || state.selectedTool !== 'selection') return false
  return selectedNoteIds(state.selectedItems.values()).some(id => engine.bracketed.find(id)?.side === side)
}
