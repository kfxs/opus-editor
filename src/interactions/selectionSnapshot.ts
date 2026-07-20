import type { EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { selectedNoteIds } from './selection'

/**
 * What is selected in the score, resolved to the OBJECTS behind it.
 *
 * `EditorState` stores a selection as locators — an id here, a (measure, beat) there, a Map of
 * items for notes — spread across a dozen `selected*` fields. That is the right shape for the
 * editor (each command asks about the kind it acts on) and the wrong shape for anything that wants
 * to show the user what they picked. This turns the locators into the elements.
 *
 * Read-only, and derived: it holds nothing, subscribes to nothing, and writing to what it returns
 * changes nothing. Recompute it whenever state changes — that is cheap, and it is the only way it
 * cannot go stale.
 *
 * Its first client is the Properties window, which stringifies the result — a sketch of the panel
 * that will eventually EDIT these. The function is the part worth getting right now: "what is
 * selected, and what is its object" is the same question the editable panel will ask, and today it
 * has no single answer anywhere in the codebase.
 *
 * An ARRAY, not one element, because the selection genuinely can be several things: notes
 * multi-select through `selectedItems`, and the scalar kinds are independent fields that can in
 * principle be set alongside them. Reporting only the first would be a guess about precedence that
 * the editor itself does not make.
 */
export interface SelectedElement {
  /** Which kind of thing this is — the discriminator, not a label to show the user. */
  kind: string
  /** The element's own data, as the model holds it, or the locator when there is no object to fetch. */
  data: unknown
}

export function selectedElements(state: EditorState, engine: MusicEngine | null): SelectedElement[] {
  const out: SelectedElement[] = []
  if (!engine) return out

  // Notes and rests. The multi-select set is authoritative; `selectedNoteId` is its mirror for the
  // single case, so reading the set alone covers both and cannot report the same note twice.
  const noteIds = selectedNoteIds(state.selectedItems.values())
  const ids = noteIds.length ? noteIds : state.selectedNoteId ? [state.selectedNoteId] : []
  for (const id of ids) {
    const note = engine.getNote(id)
    // A note whose id no longer resolves is worth SHOWING, not hiding: a stale selection is exactly
    // the kind of thing this window exists to make visible.
    out.push({ kind: note?.isRest ? 'rest' : 'note', data: note ?? { id, missing: true } })
  }

  if (state.selectedDynamicId) {
    out.push({ kind: 'dynamic', data: engine.getDynamicById(state.selectedDynamicId) ?? { id: state.selectedDynamicId, missing: true } })
  }
  if (state.selectedTempoId) {
    out.push({ kind: 'tempo', data: engine.getTempoMarkById(state.selectedTempoId) ?? { id: state.selectedTempoId, missing: true } })
  }
  if (state.selectedSlurId) {
    out.push({ kind: 'slur', data: engine.getSlurById(state.selectedSlurId) ?? { id: state.selectedSlurId, missing: true } })
  }

  // The kinds below have no object of their own in the model — an articulation, an accidental, a
  // dot and a tie are PROPERTIES of a note, not entries in a list. Their locator IS the truth, so
  // the locator is what is reported, with the note it hangs on.
  if (state.selectedArticulationNoteId) {
    out.push({
      kind: 'articulation',
      data: { noteId: state.selectedArticulationNoteId, type: state.selectedArticulationType, note: engine.getNote(state.selectedArticulationNoteId) },
    })
  }
  if (state.selectedAccidentalNoteId) {
    out.push({
      kind: 'accidental',
      data: { noteId: state.selectedAccidentalNoteId, type: state.selectedAccidentalType, note: engine.getNote(state.selectedAccidentalNoteId) },
    })
  }
  if (state.selectedDotNoteId) {
    out.push({ kind: 'dot', data: { noteId: state.selectedDotNoteId, note: engine.getNote(state.selectedDotNoteId) } })
  }
  if (state.selectedTieFromNoteId) {
    out.push({ kind: 'tie', data: { fromNoteId: state.selectedTieFromNoteId, from: engine.getNote(state.selectedTieFromNoteId) } })
  }

  if (state.selectedTupletId) {
    out.push({ kind: 'tuplet', data: { id: state.selectedTupletId } })
  }

  // Clef and time signature are positional: they belong to a measure (and, for a clef, a staff and
  // a beat), so the position IS the identity — there is no id to look up. Reported with the
  // measure they sit in, which is where their values live.
  if (state.selectedClefMeasure !== null) {
    out.push({
      kind: 'clef',
      data: {
        measure: state.selectedClefMeasure,
        beat: state.selectedClefBeat,
        staff: state.selectedClefStaff,
        clefs: engine.getScore().measures.find((m) => m.number === state.selectedClefMeasure)?.clefs,
      },
    })
  }
  if (state.selectedTimeSignatureMeasure !== null) {
    const measure = engine.getScore().measures.find((m) => m.number === state.selectedTimeSignatureMeasure)
    out.push({
      kind: 'timeSignature',
      data: { measure: state.selectedTimeSignatureMeasure, timeSignature: measure?.timeSignature },
    })
  }

  // A measure range is a selection of MEASURES, not of anything inside them — the box the user drew.
  if (state.selectedMeasureRange) {
    out.push({
      kind: 'measureRange',
      data: {
        ...state.selectedMeasureRange,
        staff: state.selectedMeasureStaff,
        style: state.selectedMeasureBoxStyle,
      },
    })
  }

  return out
}
