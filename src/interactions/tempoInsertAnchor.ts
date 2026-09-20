/**
 * ⭐⭐ **WHERE AN INSERTED TEMPO MARK LANDS — the SELECTION's answer, one place** (his ask,
 * 2026-08-31: *"when a measure is selected and i chose to enter tempo the anchor point should be the
 * current measure, however if a barline is selected the anchor point should be the measure after
 * this barline"*).
 *
 * `Ctrl+Alt+T` (and the menu row behind it) used to read ONE thing — `selectedNoteId` — and place the
 * mark on that element's beat. That is right for a note and wrong for the two selections that are
 * about a PLACE rather than a sounding thing:
 *
 * | selected | the mark anchors at |
 * |---|---|
 * | a BARLINE | ⭐ the bar AFTER it, beat 0 — the line is a BOUNDARY, and *"from here on"* is the bar it opens |
 * | a MEASURE (or a passage) | ⭐ the FIRST bar of it, beat 0 — ⛔ not wherever inside it the box-select happened to leave `selectedNoteId` |
 * | a note or rest | its own (measure, beat), as before |
 * | nothing this can name | null — the caller arms the click-to-place tool |
 *
 * ⭐ **It is a MODULE and not a branch in `MouseController`** because it is a rule about the
 * SELECTION, and the controller is where per-kind slices go to breed (CLAUDE.md). Its caller today is
 * `MouseController.insertTempo` — Ctrl+Alt+T and the Insert menu's *Tempo* row, which is the same
 * method. ⏭️ `PaletteController.placeTempoAtSelectedNote` is the other half of this seam (a preset
 * stamp with no UI on it today) and should read this the day a tempo palette lands: ⛔ a second copy
 * of the table is a copy that can disagree.
 *
 * ⭐ **Every answer is resolved through `tempoOps.tempoAnchorAt`** — the model's own *"where may a
 * tempo mark land?"*, at-or-after, the same rule a paste obeys. ⛔ Never a raw `beat 0`: what the
 * mark is drawn ON is an onset (Gould p. 183), and a stop nothing sounds at is not one.
 *
 * ⛔ **The final barline answers NOTHING** — there is no bar after it, and the honest answer is null
 * rather than the last onset in the score, which is where `tempoAnchorAt`'s own end-of-score fallback
 * would quietly put it.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Stop } from '../engine/models/tempoOps'
import { tempoAnchorAt } from '../engine/models/tempoOps'
import { passageOf } from './state/measurePassage'
import type { EditorState } from './state/EditorState'
import { fracCreate } from '../utils/fraction'

/** What this needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TempoInsertEngine = Pick<MusicEngine, 'getScore' | 'getNote'>

/** The stop a tempo mark inserted right now would anchor to, or null when the selection names none
 *  (nothing selected, or the final barline — see the header). */
export function tempoInsertStop(state: EditorState, engine: TempoInsertEngine): Stop | null {
  const element = state.selectedElement
  if (element?.kind === 'barline') return barStart(engine, element.measure + 1)
  if (element?.kind === 'measureRange') return barStart(engine, passageOf(element).fromMeasure)

  const note = state.selectedNoteId ? engine.getNote(state.selectedNoteId) : null
  // ⚠️ A note's own beat IS an onset, so this is the address itself — ⛔ not a resolution that could
  //    move the mark off the thing the user is pointing at.
  return note ? { measure: note.measure, beat: note.beat } : null
}

/** The first stop of `measureNumber`, or null when the score has no such bar (the final barline's
 *  case, and the one reason this is not just `{ measure, beat: 0 }`). */
function barStart(engine: TempoInsertEngine, measureNumber: number): Stop | null {
  const score = engine.getScore()
  if (!score.measures.some(m => m.number === measureNumber)) return null
  return tempoAnchorAt(score, { measure: measureNumber, beat: fracCreate(0, 1) })
}
