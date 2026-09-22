/**
 * ⭐ **The GRACE tool's PRESS and its LIGHT** (`docs/plans/grace-notes-plan.md` §3) — what the dev
 * toolbar's `acciacc.` / `appogg.` buttons do, in its own module (`CLAUDE.md`: a new feature adds a
 * MODULE; the palette lends it its arm/disarm, {@link SpanToolHost}).
 *
 * ⭐ D6 (decided 2026-09-22): a press ARMS the stamp. ⏳ What a press does to a SELECTED note is open —
 * his to find by iteration (plan §3 rule 2) — so until he picks, it arms the stamp exactly as with
 * nothing selected. ⛔ Nothing is built on either candidate.
 */
import { dbg } from '@/utils/debug'
import type { GraceSide } from '@/types/music'
import type { GraceForm } from '@/engine/models/graceOps'
import { armedTool, type EditorState } from '../state/EditorState'
import { durationHighlight } from '../controllers/keypadSync'
import type { SpanToolHost } from './spanToolPress'
import { itemKey, selectedNoteIds, type SelectionItem } from '../state/selection'
import type { MusicEngine } from '@/engine/MusicEngine'
import { graceGroupAt } from '@/engine/models/graceToNoteOps'

/** A grace's written value when the duration keys say nothing — an 8th (the convention for a single
 *  grace, Gould p. 125). ⚠️ A DEFAULT, his *"lets say yes"* on 2026-09-22; a value set by hand wins. */
const GRACE_DEFAULT_DURATION = '8'

/**
 * Arm the grace stamp for `form` / `side` — or disarm it, when the same one is armed already.
 * ⭐ In SELECTION mode with something selected it arms nothing (plan §3 rule 2, his rules of 2026-09-22):
 * - selected GRACES become this FORM (*"with the grace selected i press acciacc"*) — or, pressed with
 *   their OWN form, are TOGGLED OFF: the first selected becomes its main slot's note and the graces after
 *   it go; a whole group selected just goes (`models/graceToNoteOps`);
 * - selected NOTES become GRACES of this form, each before the rest that takes its place (*"i have a note,
 *   i converted to a grace so in the space of the note now is a rest and of course the grace is in the
 *   left part of the rest"*) — and what was made (graces, or notes) is the selection.
 */
export function pressGraceTool(host: SpanToolHost, form: GraceForm, side: GraceSide): void {
  const engine = host.getEngine()
  const ids = host.state.selectedTool === 'selection' && engine ? selectedNoteIds(host.state.selectedItems.values()) : []
  const graces = engine ? ids.filter(id => engine.isGraceNote(id)) : []
  const notes = engine ? ids.filter(id => !engine.isGraceNote(id) && engine.getNote(id)?.isRest === false) : []
  if (engine && (graces.length || notes.length)) {
    let made: string[] = []
    const changed = engine.runBatch(form === 'acciaccatura' ? 'Make acciaccatura' : 'Make appoggiatura', () => {
      // Graces: the other form → re-formed; their own form → TOGGLED OFF (back to a note, or the group gone).
      if (graces.length) made.push(...engine.grace.pressGraceForm(graces, form).madeNotes)
      if (notes.length) made = [...made, ...engine.grace.convertNotesToGraces(notes, form)]
    })
    // REASSIGN, never mutate: the observable state only sees a top-level write. What was made is the
    // selection; failing that, what is still there (a cleared group's graces are gone).
    const keep = made.length ? made : ids.filter(id => engine.getNote(id))
    if (made.length || keep.length !== ids.length) {
      host.state.selectedItems = new Map(keep.map((id): [string, SelectionItem] => [itemKey({ kind: 'note', id }), { kind: 'note', id }]))
      host.state.selectedNoteId = keep[0] ?? null
    }
    if (changed) host.render()
    dbg(`[grace] selection → ${form}: ${graces.length} grace(s) re-formed, ${made.length} note(s) made graces`)
    return
  }
  const armed = armedTool(host.state, 'grace')
  if (armed && armed.form === form && armed.side === side) {
    // What was armed FOR the grace goes with it — or it would mark the next typed note.
    clearEntryMarks(host.state)
    // ⭐ Back to NOTE ENTRY, ⛔ not selection (his report, 2026-09-22: *"im just disarming the grace and
    //    not entering in select mode"*) — a grace is entered among notes, as the clef's re-press does.
    host.disarmToEntry()
    dbg(`[grace] ${form} stamp disarmed — note entry`)
    return
  }
  // Read BEFORE arming, as the rest tool does: nothing lit ⇒ nothing was chosen, so the convention's
  // value; a lit key is a value somebody chose, and it stays.
  if (!armed && durationHighlight(host.state) === null) {
    host.state.selectedDuration = GRACE_DEFAULT_DURATION
    host.state.selectedDots = 0
  }
  // A stale note-entry accidental or articulation is not a choice made for the grace (the rest tool's rule).
  if (!armed) clearEntryMarks(host.state)
  host.arm({ kind: 'grace', form, side })
  dbg(`[grace] ${form} stamp armed (${side}, ${host.state.selectedDuration})`)
}

/** The note-entry marks a grace reads — its accidental and articulations. */
function clearEntryMarks(state: EditorState): void {
  state.selectedAccidental = null
  state.accent = false
  state.staccato = false
  state.tenuto = false
}

/**
 * Is the button for `form` / `side` lit? By the ARMED grace tool — or, ⭐ with none armed, in SELECTION
 * mode, by a SELECTED grace whose group is that form (his report, 2026-09-22: *"when i select a grace i
 * dont see its status as grace in the grace palette (so i cannot toggle off)"* — the lit button is the
 * one that toggles it off).
 */
export function graceToolLit(state: EditorState, form: GraceForm, side: GraceSide, engine?: MusicEngine | null): boolean {
  const armed = armedTool(state, 'grace')
  if (armed) return armed.form === form && armed.side === side
  if (!engine || state.selectedTool !== 'selection') return false
  const score = engine.getScore()
  return selectedNoteIds(state.selectedItems.values()).some(id => {
    const at = graceGroupAt(score, id)
    return !!at && (at.group.slash ? 'acciaccatura' : 'appoggiatura') === form
  })
}
