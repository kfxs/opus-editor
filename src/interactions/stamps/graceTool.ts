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
import { selectedNoteIds } from '../state/selection'

/** A grace's written value when the duration keys say nothing — an 8th (the convention for a single
 *  grace, Gould p. 125). ⚠️ A DEFAULT, his *"lets say yes"* on 2026-09-22; a value set by hand wins. */
const GRACE_DEFAULT_DURATION = '8'

/**
 * Arm the grace stamp for `form` / `side` — or disarm it, when the same one is armed already.
 * ⭐ In SELECTION mode with graces selected it arms nothing: it makes their groups this FORM (his rule,
 * 2026-09-22 — plan §3 rule 2: *"with the grace selected i press acciacc"*).
 */
export function pressGraceTool(host: SpanToolHost, form: GraceForm, side: GraceSide): void {
  const engine = host.getEngine()
  const graces = host.state.selectedTool === 'selection' && engine
    ? selectedNoteIds(host.state.selectedItems.values()).filter(id => engine.isGraceNote(id))
    : []
  if (engine && graces.length) {
    if (engine.grace.setGraceForm(graces, form)) host.render()
    dbg(`[grace] ${graces.length} selected grace(s) → ${form}`)
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

/** Is the button for `form` / `side` lit? While a tool is armed, only by the ARMED grace tool. */
export function graceToolLit(state: EditorState, form: GraceForm, side: GraceSide): boolean {
  const armed = armedTool(state, 'grace')
  return !!armed && armed.form === form && armed.side === side
}
