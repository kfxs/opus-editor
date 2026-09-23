/**
 * ⭐ **THE REPORT'S SHAPE** — what `selectionSnapshot.selectedElements` hands a reader for each kind
 * of selected thing. Types only: the snapshot is the one WRITER (its switch stays one exhaustive
 * site, by decision), and this is the contract the compiler holds it to.
 *
 * ⚠️ `InspectedElement`, not `SelectedElement` — the latter is the STATE (`EditorState
 * .selectedElement`, the locator union). This is the REPORT: the same selection resolved to its
 * objects, for something that wants to show it. Two names because they are two things.
 */
import type {
  Dynamic, EngravingOverride, Hairpin, Measure, Note, Ottava, Pedal, Slur, TempoMark, Trill, Tuplet,
} from '../../types/music'
import type { BarlineSignKind } from '@/engine/models/boundarySign'
import type { ScoreTextField } from '@/engine/models/scoreTextOps'

/** What is reported for an id that no longer resolves — a stale selection is worth SHOWING, not
 *  hiding: it is exactly the kind of thing the Properties window exists to make visible. */
export interface MissingElement { id: string; missing: true }

/** The model's object, or the note that it is gone. */
type Located<T> = T | MissingElement

/**
 * One member of {@link InspectedElement}: `K`'s own `data`, and `V` for what is `derived`.
 *
 * ⚠️ `derived` is typed precisely ONLY where something READS it (a Properties panel's row); everywhere
 * else it is an open record, because its one reader is a JSON dump and a hand-kept copy of the
 * engine's span types would be a field list that rots.
 */
interface Report<K extends string, D, V = Record<string, unknown>> {
  /** Which kind of thing this is — the discriminator, not a label to show the user. */
  kind: K
  /** The element's own data, as the model holds it, or the locator when there is no object to fetch. */
  data: D
  /**
   * The authored geometry hanging off this element — its entries in the engraving-overrides
   * compartment (`score.engravingOverrides`), if any.
   *
   * A SEPARATE field and deliberately not folded into `data`, because that is exactly what the
   * compartment is: geometry kept OUT of the content model so transposition, playback and
   * re-barring never trip over pixels (docs/plans/engraving-overrides-plan.md). A dump that merged the
   * two would show a shape the model does not have. Absent when the element has none.
   */
  overrides?: EngravingOverride[]
  /**
   * Facts COMPUTED from the model for this element, which the model deliberately does not store.
   *
   * ⭐ A SEPARATE field for exactly {@link overrides}' reason, one step further: folding these into
   * `data` would show a shape the model does not have. The first client is the TRILL, whose
   * auxiliary pitch is derived from the key and the bar's accidentals rather than stored
   * (docs/plans/trill-plan.md §3) — so "what does this trill actually play?" is unanswerable from `data`
   * alone, and it is the one question a reader of this panel will have. Absent when there is
   * nothing derived worth reporting.
   */
  derived?: V
}

/** The pair a panel's number row needs: what is on the page now, and whose number it is. */
interface EffectiveValue { value: number; authored: boolean }
/** The sign on a selected LINE — a fact about two bars, so never `data`. */
interface BoundaryDerived { sign: BarlineSignKind; winged: boolean }
/** A property OF a note (a dot, a stem, a tremolo…): the locator IS the truth, reported with its note. */
interface OnNote { noteId: string; note: Note | undefined }

/**
 * ⭐ **A discriminated union keyed by `kind`** (docs/plans/code-shape-plan-2026-09-19.md, Phase 3.4), so a
 * reader that has switched on the kind — a Properties panel is handed {@link InspectedOf} its own —
 * reads `data` with no cast. {@link selectedElements} is the one writer, and the compiler now holds
 * it to these shapes.
 */
export type InspectedElement =
  | Report<'note', Located<Note>>
  | Report<'rest', Located<Note>>
  /** ⭐ A GRACE NOTE — selected as a note (its pitch id), reported as what it is. */
  | Report<'grace', Located<Note>>
  /** ⭐ A BRACKETED grace — selected as a note (its pitch id), reported as what it is. */
  | Report<'bracketed', Located<Note>, { side: 'before' | 'after'; canBeAfter: boolean }>
  | Report<'dynamic', Located<Dynamic>>
  | Report<'tempo', Located<TempoMark>>
  | Report<'slur', Located<Slur>, {
    arc: { cps: [{ x: number; y: number }, { x: number; y: number }] | null; segment: string | null; armed: 0 | 1 | null }
  }>
  | Report<'trill', Located<Trill>>
  | Report<'ottava', Located<Ottava>>
  | Report<'pedal', Located<Pedal>>
  | Report<'hairpin', Located<Hairpin>, {
    mouth: (EffectiveValue & { min: number; max: number }) | null
  }>
  | Report<'articulation', OnNote & { type: string | null }>
  | Report<'accidental', OnNote & { type: string | null }>
  | Report<'dot', OnNote>
  | Report<'headEnclosure', OnNote>
  | Report<'stem', OnNote>
  | Report<'tremolo', OnNote>
  | Report<'tie', { fromNoteId: string; from: Note | undefined }>
  | Report<'tuplet', Located<Tuplet>>
  | Report<'clef', {
    measure: number; beat: number; staff: number
    clefs: Measure['clefs']; offset: number; offsettable: boolean
  }>
  | Report<'timeSignature', { measure: number; timeSignature: Measure['timeSignature'] | undefined }>
  | Report<'keySignature', { measure: number; staff: number; keys: Measure['keys'] }, {
    inForce: unknown; cautionaryGap: EffectiveValue | null; fifths: number | null
  }>
  | Report<'barline', {
    endsMeasure: number; style: NonNullable<Measure['barline']>['style'] | undefined
    repeatEnd: Measure['repeatEnd']
  }, BoundaryDerived>
  | Report<'repeatStart', { opensMeasure: number; repeatStart: Measure['repeatStart'] }, BoundaryDerived>
  | Report<'scoreText', { field: ScoreTextField; text: string | undefined }>
  | Report<'measureRange', { anchor: number; focus: number; staff: unknown; style: unknown }>
  | Report<'staffGroup', { symbol: 'brace' | 'bracket' | 'subBracket'; staves: number }>

/** The report for ONE kind — what a reader that has already switched on `kind` is handed. */
export type InspectedOf<K extends InspectedElement['kind']> = Extract<InspectedElement, { kind: K }>
