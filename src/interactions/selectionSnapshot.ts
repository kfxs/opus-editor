import type { EditorState } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EngravingOverride, Note, Score } from '../types/music'
import { cautionaryClefKey, cautionaryKey, restPositionKey } from '../engine/models/engravingOverrides'
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
  /**
   * The authored geometry hanging off this element — its entries in the engraving-overrides
   * compartment (`score.engravingOverrides`), if any.
   *
   * A SEPARATE field and deliberately not folded into `data`, because that is exactly what the
   * compartment is: geometry kept OUT of the content model so transposition, playback and
   * re-barring never trip over pixels (docs/engraving-overrides-plan.md). A dump that merged the
   * two would show a shape the model does not have. Absent when the element has none.
   */
  overrides?: EngravingOverride[]
}

/** The compartment's entries under one key, or undefined when there are none (never an empty list —
 *  the panel shows the section only when there is something in it). */
function overridesAt(score: Score, key: string | undefined): EngravingOverride[] | undefined {
  if (!key) return undefined
  const entries = score.engravingOverrides?.[key]
  return entries?.length ? entries : undefined
}

/** The entries under SEVERAL keys, as one list — for an element addressed more than one way (see
 *  {@link noteOverrideKeys}). Undefined when none of them holds anything. */
function overridesAtAny(score: Score, keys: string[]): EngravingOverride[] | undefined {
  const entries = keys.flatMap((key) => score.engravingOverrides?.[key] ?? [])
  return entries.length ? entries : undefined
}

/**
 * EVERY compartment key a note or rest answers to — plural, because one element can be addressed
 * more than one way and the panel must show what the model will accept, not what one lookup happens
 * to find (the `getNote` lesson).
 *
 * ⚠️ **Three different addressing schemes meet on this one element:**
 * - **The horizontal offset (client #12) is `MusicEngine.offsetTargetOf`** — the SLOT id for an
 *   ordinary note (a chord moves as a unit) or a rest, and a fanned MEMBER's own first pitch id.
 *   ⛔ Not `slotIdForNote`: that resolves a member to the chord containing it, so a selected member
 *   reported its OWNER's number while the nudge wrote its own (docs/note-offset-plan.md).
 * - **A rest's shift and its hide are POSITION-keyed**, because a rest has no durable id — rebar
 *   makes and unmakes rests freely.
 * - …so a REST has BOTH, and reading either one alone hides the other silently: an empty section
 *   looks exactly like "this element has none".
 */
function noteOverrideKeys(score: Score, engine: MusicEngine, note: Note): string[] {
  const keys: string[] = []
  const target = engine.offsetTargetOf(note.id)
  if (target) keys.push(target.key)
  if (!note.isRest) return keys
  const measure = score.measures.find((m) => m.number === note.measure)
  if (measure) keys.push(restPositionKey(measure.id, note.voice ?? 0, note.beat, score.staves?.[note.staff ?? 0]?.id))
  return keys
}

export function selectedElements(state: EditorState, engine: MusicEngine | null): SelectedElement[] {
  const out: SelectedElement[] = []
  if (!engine) return out
  const score = engine.getScore()

  // Notes and rests. The multi-select set is authoritative; `selectedNoteId` is its mirror for the
  // single case, so reading the set alone covers both and cannot report the same note twice.
  const noteIds = selectedNoteIds(state.selectedItems.values())
  const ids = noteIds.length ? noteIds : state.selectedNoteId ? [state.selectedNoteId] : []
  for (const id of ids) {
    const note = engine.getNote(id)
    // A note whose id no longer resolves is worth SHOWING, not hiding: a stale selection is exactly
    // the kind of thing this window exists to make visible.
    out.push({
      kind: note?.isRest ? 'rest' : 'note',
      data: note ?? { id, missing: true },
      overrides: note ? overridesAtAny(score, noteOverrideKeys(score, engine, note)) : undefined,
    })
  }

  if (state.selectedDynamicId) {
    out.push({
      kind: 'dynamic',
      data: engine.getDynamicById(state.selectedDynamicId) ?? { id: state.selectedDynamicId, missing: true },
      overrides: overridesAt(score, state.selectedDynamicId),
    })
  }
  if (state.selectedTempoId) {
    out.push({
      kind: 'tempo',
      data: engine.getTempoMarkById(state.selectedTempoId) ?? { id: state.selectedTempoId, missing: true },
      overrides: overridesAt(score, state.selectedTempoId),
    })
  }
  if (state.selectedSlurId) {
    out.push({
      kind: 'slur',
      data: engine.getSlurById(state.selectedSlurId) ?? { id: state.selectedSlurId, missing: true },
      overrides: overridesAt(score, state.selectedSlurId),
    })
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
  if (state.selectedStemNoteId) {
    // Same shape as the dot: a stem is a PROPERTY of the slot (its direction lives on the note),
    // not an object in the model — the locator plus the note it belongs to is the whole truth.
    out.push({ kind: 'stem', data: { noteId: state.selectedStemNoteId, note: engine.getNote(state.selectedStemNoteId) } })
  }
  if (state.selectedTremoloNoteId) {
    // The MARK is a field on the slot (`tremolo`), so the note carries the whole truth — reported
    // like the dot above, locator plus note.
    out.push({ kind: 'tremolo', data: { noteId: state.selectedTremoloNoteId, note: engine.getNote(state.selectedTremoloNoteId) } })
  }
  if (state.selectedTieFromNoteId) {
    out.push({ kind: 'tie', data: { fromNoteId: state.selectedTieFromNoteId, from: engine.getNote(state.selectedTieFromNoteId) } })
  }

  if (state.selectedTupletId) {
    // The OBJECT, like every other kind above — this used to report `{ id }` alone, so the one
    // element whose fields you most want to read (the ratio, the unit, what was typed) showed
    // nothing but a uuid.
    out.push({
      kind: 'tuplet',
      data: engine.getTuplet(state.selectedTupletId) ?? { id: state.selectedTupletId, missing: true },
      overrides: overridesAt(score, state.selectedTupletId),
    })
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
        clefs: score.measures.find((m) => m.number === state.selectedClefMeasure)?.clefs,
      },
      // Now that clefs HAVE an override kind, this branch has a key to ask for — per staff, like
      // the flag itself.
      overrides: overridesAt(
        score,
        (() => {
          const measure = score.measures.find((m) => m.number === state.selectedClefMeasure)
          if (!measure) return undefined
          // The first staff is ABSENT in the key, not named — `staffIdForIndex`'s rule, and the
          // reason this branch showed nothing at first: it asked under a key nobody writes.
          const staff = state.selectedClefStaff ?? 0
          return cautionaryClefKey(measure.id, staff ? score.staves?.[staff]?.id : undefined)
        })(),
      ),
    })
  }
  if (state.selectedTimeSignatureMeasure !== null) {
    const measure = score.measures.find((m) => m.number === state.selectedTimeSignatureMeasure)
    out.push({
      kind: 'timeSignature',
      data: { measure: state.selectedTimeSignatureMeasure, timeSignature: measure?.timeSignature },
      // Its overrides answer to a key of their OWN (`caution:<measureId>`), not to the measure id
      // and not to a position key — so a kind that looks up nothing shows nothing, which is exactly
      // what this did until a selected meter turned out to have a cautionary flag worth seeing.
      overrides: overridesAt(score, measure ? cautionaryKey(measure.id) : undefined),
    })
  }

  // A barline is the one selectable thing with NO object behind it at all: the measures are the
  // barline spine, so the selection is a boundary. Reported as the measure it closes, which is the
  // whole of its identity (and the address a barline TYPE would eventually be stored at).
  if (state.selectedBarlineMeasure !== null) {
    out.push({ kind: 'barline', data: { endsMeasure: state.selectedBarlineMeasure } })
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
