import type { Accidental, NoteDuration, BeamMode, Clef, TimeSignature, DynamicLevel, ArticulationType } from '../types/music'
import type { SelectionItem } from './selection'
import type { ViewMode } from '../engine/rendering/layoutConfig'

/** A value armed on the dynamics palette: an interpreted level, or the custom-text tool. */
export type DynamicTool = DynamicLevel | 'text'

/**
 * A tempo mark armed on the palette, ready to be placed by the next canvas click. The
 * palette's preset words pre-FILL this (they are not an enum of legal values — the word is
 * free text, see decision D2), and the metronome builder fills unit/dots/bpm. It carries
 * everything except the beat, which the click supplies.
 */
export type TempoTool = {
  text?: string
  unit?: NoteDuration
  dots?: number
  bpm?: number
  showMetronome?: boolean
}

export type ToolMode = 'entry' | 'selection'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/**
 * The tool armed for placement — ONE of eight, or none. Arming one switches to entry mode, hides the
 * keyboard cursor, previews itself as a ghost at the pointer, and makes the next canvas click place
 * or stamp rather than enter a note.
 *
 * WHY ONE FIELD. These were eight independent fields (`selectedClef`, `selectedTieTool`, …). They are
 * mutually exclusive, but nothing said so: the type could express "the tie and the dot are both
 * armed" — a sentence with no meaning — and the only thing preventing it was eight arm-sites each
 * remembering to clear the other seven, plus every press handler naming its siblings to switch. That
 * is N² edits to keep in sync, and a missed one is SILENT. It bit us: `dac5f42` fixed a press that
 * armed TWO tools, because the check had been written naming only the sibling that existed that day.
 *
 * Holding the armed tool in one value makes the illegal states unrepresentable rather than merely
 * unreached: arming IS clearing, so there is nothing to keep in sync. Dispatch by `switch (t.kind)`
 * with an exhaustiveness check ({@link assertNeverTool}) and a NINTH tool cannot be added without the
 * compiler naming every site that must handle it.
 *
 * The two "stamp value" kinds carry what they arm; the two valueless stamps carry nothing, because
 * there is nothing to carry (a note is tied, or it is not).
 */
export type MarkingTool =
  | { kind: 'clef'; clef: Clef }
  | { kind: 'timeSignature'; timeSignature: TimeSignature }
  | { kind: 'dynamic'; dynamic: DynamicTool }
  | { kind: 'tempo'; tempo: TempoTool }
  /** ADDITIVE: pressing another articulation key grows the set; all get stamped together. Emptying
   *  it disarms. Distinct from the `accent`/`staccato`/`tenuto` flags, which arm for the next note
   *  ENTERED — this stamps notes that already exist. */
  | { kind: 'articulation'; types: ArticulationType[] }
  /** SINGLE-valued: a note has one accidental state, so a different key SWAPS rather than stacks.
   *  Distinct from `selectedAccidental`, which arms for the next note ENTERED. */
  | { kind: 'accidental'; sign: Accidental }
  /** VALUELESS — a note ties to the next slot or it does not. */
  | { kind: 'tie' }
  /** VALUELESS — the UI's dot is on or off. The one stamp that also applies to RESTS. */
  | { kind: 'dot' }
  /** VALUELESS, but not for the others' reason: a rest is nothing WITHOUT a length, so rather than
   *  carry its own it READS the armed one (`selectedDuration` + `selectedDots`) — the very fields the
   *  duration and dot keys already set. One source of truth: a `{ duration }` here would be a second
   *  copy to keep in step, which is the N² problem this union was built to delete. It is why this is
   *  the only tool the note-entry keys stay LIVE under — see {@link MARKING_TOOL_USES_ARMED_LENGTH}. */
  | { kind: 'rest' }

/**
 * The length the editor starts from, and returns to. A quarter, undotted — the value
 * `createEditorState` mints, `PaletteController.resetToDefaults` restores, and a fresh rest stamp
 * arms with. It was written out at each of those sites; naming it is what makes "the default
 * duration" a thing the code can say rather than three `'q'`s that happen to agree.
 */
export const DEFAULT_DURATION: NoteDuration = 'q'
export const DEFAULT_DOTS = 0

/**
 * Does the armed tool USE the note-entry armed length (`selectedDuration` + `selectedDots`)?
 *
 * This is the ONE question that decides whether the duration and dot keys stay live while a tool is
 * armed. The answer used to be "never": every marking tool arms into entry mode but enters no note,
 * so a lit duration key would claim a quarter note was coming while what was really armed was a clef
 * (`92fbe3d`). The rest tool is the first counter-example — a rest IS a duration, so its keys must
 * keep working, and pressing one must retune the armed rest instead of ending it.
 *
 * A Record and not `kind === 'rest'`, for the reason `MEASURE_RENDER_ROLE` is one: a tenth tool
 * cannot be added without answering this, and the answer is not guessable from the outside. An
 * earlier list of "the stamp kinds" encoded no real distinction and rotted; this one encodes a real
 * property — does the tool have a length of its own to place?
 */
export const MARKING_TOOL_USES_ARMED_LENGTH: Record<MarkingTool['kind'], boolean> = {
  rest: true,        // a rest is nothing without a length
  clef: false,       // the four below place OBJECTS — a length means nothing to them
  timeSignature: false,
  dynamic: false,
  tempo: false,
  articulation: false, // the four stamps mark notes that ALREADY have their length
  accidental: false,
  tie: false,
  dot: false,
}

/** Whether the armed tool (if any) uses the armed length — see {@link MARKING_TOOL_USES_ARMED_LENGTH}.
 *  False with nothing armed: the keys are live then for the ordinary reason (note entry). */
export function armedToolUsesLength(state: EditorState): boolean {
  const tool = state.selectedMarkingTool
  return tool ? MARKING_TOOL_USES_ARMED_LENGTH[tool.kind] : false
}

/**
 * The armed tool IF it is of `kind`, else null — the read half of {@link MarkingTool}, typed so the
 * payload narrows: `armedTool(state, 'clef')?.clef` is a `Clef`. Prefer narrowing on `.kind`
 * directly inside a dispatch; this is for the one-kind-or-nothing reads (a palette button asking
 * "am I the armed one?").
 */
export function armedTool<K extends MarkingTool['kind']>(
  state: EditorState,
  kind: K,
): Extract<MarkingTool, { kind: K }> | null {
  const tool = state.selectedMarkingTool
  return tool?.kind === kind ? (tool as Extract<MarkingTool, { kind: K }>) : null
}

/** Compile-time exhaustiveness: a `switch` over {@link MarkingTool} that forgets a kind fails to
 *  build here, which is what makes adding a ninth tool safe instead of a memory test. */
export function assertNeverTool(tool: never): never {
  throw new Error(`Unhandled marking tool: ${JSON.stringify(tool)}`)
}

/**
 * All mutable UI state for the score editor.
 *
 * Framework-agnostic: no Vue, React, or Angular imports.
 * In Vue:   wrap with reactive(createEditorState())
 * In React: use useReducer / useState / MobX observable
 * In Angular: use as a plain service property
 */
export interface EditorState {
  // --- Tool ---
  selectedTool: ToolMode

  // --- Note selection ---
  /**
   * The multi-selection set, keyed by `itemKey(item)` (ordered: insertion = click
   * order). Phase 1 holds only `note` items; other element kinds are still
   * single-select via the scalar fields below.
   */
  selectedItems: Map<string, SelectionItem>
  /**
   * The selection ANCHOR: the id of the last-added note (or null when no note is
   * selected). Single-target operations — keyboard nav, the entry cursor, drag,
   * palette-sync — act on the anchor, so with exactly one selected note this is
   * identical to the pre-multi-select behavior. Kept in sync with `selectedItems`
   * by SelectionController.
   */
  selectedNoteId: string | null
  /**
   * The Shift-range PIVOT: the id of the last plainly/Ctrl-clicked note. Shift-click
   * selects the temporal range pivot→target. Stays fixed across consecutive
   * Shift-clicks so the range endpoint can be re-flowed from the same point.
   */
  selectionPivotId: string | null
  /**
   * The selection snapshot a Shift-range is unioned onto — captured at the last
   * plain/Ctrl click. Lets Shift-click keep the already-selected (e.g. Ctrl-clicked)
   * notes while re-flowing the new range, instead of piling range on range.
   */
  selectionBase: SelectionItem[]
  selectedArticulationNoteId: string | null
  selectedArticulationType: string | null
  selectedAccidentalNoteId: string | null
  selectedAccidentalType: string | null
  /**
   * The slot whose augmentation DOTS are selected (null = none). One id for ALL of them: `dots` is
   * a single value on the `Chord`/`Rest` (it modifies the duration), even though VexFlow draws one
   * dot per notehead per dot — so a chord's dots select and delete together, and "dot one head of a
   * chord" has no representation. Holds the chord's lowest pitch id (the anchor its dots register
   * against, like articulations) or a rest's own id — a rest IS its slot. A dotted REST is ordinary,
   * not exotic: you can author one, and `restFill` picks them for compound beats (6/8 is full of
   * them). No companion `selectedDotCount` — the count is read live off the note, exactly as the tie
   * is read off `tiedTo`. */
  selectedDotNoteId: string | null
  selectedTupletId: string | null
  selectedTieFromNoteId: string | null
  /** Id of the on-score slur selected for removal (selection tool); null if none. */
  selectedSlurId: string | null
  /** Which endpoint (in/out) of the selected slur is armed for keyboard nudging — set by
   *  clicking a blue endpoint square (docs/slur-endpoint-offset-plan.md). Only meaningful
   *  while {@link selectedSlurId} is set; reset to null whenever `selectedSlurId` is
   *  assigned or cleared, so a stale endpoint can't nudge a newly-selected slur. */
  selectedSlurEndpoint: 'start' | 'end' | null
  /** Which OPEN join of a cross-system slur is armed for keyboard nudging — set by clicking
   *  an orange segment-endpoint square (docs/multisystem-slur-segment-endpoint-offset-plan.md).
   *  Mutually exclusive with {@link selectedSlurEndpoint} (arming one disarms the other); reset
   *  to null at every selection change so a stale join can't nudge a newly-selected slur. */
  selectedSlurSegmentEndpoint:
    | { role: 'begin' }
    | { role: 'end' }
    | { role: 'middle'; ordinal: number; side: 'left' | 'right' }
    | null
  /** The live system count captured when {@link selectedSlurSegmentEndpoint} was armed — passed
   *  to `nudgeSlurSegmentEndpoint` as the override's reset signature (matches the count the
   *  handle was registered with). Only meaningful while the segment endpoint is armed. */
  selectedSlurSegmentSpanCount: number
  /** While dragging a slur endpoint handle: the note the slur would snap onto if
   *  released now (highlighted as the candidate anchor); null when not dragging. */
  slurEndpointCandidateNoteId: string | null

  // --- Palette ---
  /**
   * The voice notes are entered into (Sibelius-style). Voice 1 is the default and
   * always present in every bar; voice 2 is the optional second stream. Resets to
   * `1` on selection-clear / fresh entry. (The model supports 1–4 voices; the UI
   * exposes 2 for now.)
   */
  activeVoice: 1 | 2
  /**
   * The staff (0-based index into `Score.staves`) that entry/nav target — the multi-staff
   * analogue of {@link activeVoice}, but a raw model index (staff 0 is the default, always
   * present). A click sets it to the clicked staff; selecting a note syncs it to that note's
   * staff; it resets to 0 on selection-clear. Keyboard entry stays on the cursor note's staff.
   */
  activeStaff: number
  selectedDuration: NoteDuration
  selectedAccidental: Accidental | null
  selectedDots: number
  accent: boolean
  staccato: boolean
  tenuto: boolean
  /**
   * The ONE marking tool armed for placement, or null. See {@link MarkingTool}: the eight tools are
   * mutually exclusive, and holding them in ONE field is what makes "two armed at once" impossible
   * to write, rather than something eight arm-sites have to remember to prevent.
   *
   * Always REASSIGNED (never mutated in place) so the observable state emits a change. Read it by
   * narrowing on `.kind`, or with {@link armedTool} when you want one kind or nothing. */
  selectedMarkingTool: MarkingTool | null
  tupletMode: boolean
  selectedBeam: BeamMode

  // --- Clef tool ---
  /** Measure of the clef selected for removal (selection tool); null if none. */
  selectedClefMeasure: number | null
  /** Beat of the selected clef within its measure (0 = opening clef). */
  selectedClefBeat: number | null
  /** 0-based staff of the selected clef (multi-staff); a delete/edit stays on it. */
  selectedClefStaff: number

  // --- Time signature tool ---
  /** Measure of the on-score time-signature glyph selected for removal (selection
   *  tool); null if none. Distinct from the armed `{ kind: 'timeSignature' }` marking
   *  tool (the meter waiting to be placed). */
  selectedTimeSignatureMeasure: number | null

  // --- Measure box selection ---
  /** The contiguous run of measures outlined by the Sibelius-style blue double box
   *  (Ctrl+Shift+click on empty space inside a bar); null if none. `anchor`/`focus` hold
   *  the span's low/high bounds (every measure between them inclusive is selected). A
   *  repeat Ctrl+Shift+click GROWS the span to also include the clicked bar (union) — it
   *  only ever gets bigger; a plain click clears it to start fresh. Purely a visual
   *  marker — NO objects in the measures are selected. Cleared on any other interaction. */
  selectedMeasureRange: { anchor: number; focus: number } | null

  /** The 0-based staff the last measure box-select landed on (which stacked staff the
   *  Ctrl+Shift+click fell on). The reference staff the "Staff: + Above / + Below" buttons
   *  insert relative to. Only meaningful while {@link selectedMeasureRange} is non-null. */
  selectedMeasureStaff: number

  /** Which box the {@link selectedMeasureRange} renders as. `'double'` = the visual-only
   *  Ctrl+Shift+click marker (two nested rectangles, no objects selected). `'single'` = the
   *  Sibelius-style plain-click passage selection: ONE rectangle around a single bar whose
   *  contents (notes/rests + enclosed dynamics/slurs) ARE selected. Only meaningful while
   *  {@link selectedMeasureRange} is non-null. */
  selectedMeasureBoxStyle: 'single' | 'double'

  // --- Dynamics tool ---
  /** Id of the on-score dynamic selected for removal/edit (selection tool); null
   *  if none. Distinct from the armed `{ kind: 'dynamic' }` marking tool. */
  selectedDynamicId: string | null

  // --- Tempo tool ---
  /** Id of the on-score tempo mark selected for removal/edit (selection tool); null if
   *  none. Distinct from the armed `{ kind: 'tempo' }` marking tool. */
  selectedTempoId: string | null

  // --- In-canvas text editing ---
  /** Set while a seamless DOM-overlay text editor is open over a mark; null when
   *  not editing. While non-null, the canvas mouse handlers (click / move) bail so
   *  the edit is modal-ish and a commit-click can't plant a stray mark. `kind` is a
   *  discriminator for future text types (lyric/technique/…); `isNew` carries the
   *  empty-text rule's "just placed vs existing" signal to the source. */
  editingText: { targetId: string; kind: 'dynamic' | 'tempo'; isNew: boolean } | null

  // --- Clipboard ---
  /** True while a paste is waiting for the user to click the insertion point —
   *  entered when Ctrl+V is pressed with an empty selection. A colored caret
   *  follows the pointer; the next canvas click commits the paste origin, Esc
   *  cancels. (With a non-empty selection, paste lands at the selection start and
   *  this stays false.) */
  pastePlacementArmed: boolean

  // --- UI ---
  showCursor: boolean
  /** True while a hand/grab pan is actively moving the view (set once the drag crosses
   *  the movement threshold, cleared on release). Bound in the template to hide the OS
   *  mouse pointer via `cursor: none`. Distinct from `showCursor`, which toggles the
   *  in-score keyboard caret, not the OS pointer. */
  isPanning: boolean
  playbackState: PlaybackState
  /** MIRROR of the engine's view mode (wrapped ↔ linear), for the palette button's lit state —
   *  the engine OWNS it (docs/linear-view-plan.md §5), and a MusicEngine is not a reactive
   *  object, so a Vue template cannot track `engine.getViewMode()` directly. Written only by
   *  `PaletteController.setViewMode`, alongside the engine itself, so the two cannot diverge:
   *  never assign this field from anywhere else, and never read it to DECIDE anything — the
   *  gestures and the renderer ask the engine (the owner). */
  viewMode: ViewMode
}

/**
 * Map the 1-based UI active voice (`1`|`2`, Sibelius display convention) to the
 * 0-based model voice (`0`|`1`). The model's primary/default stream is voice 0 —
 * every existing note is voice 0 — so UI "Voice 1" is model voice 0 and UI
 * "Voice 2" is model voice 1.
 */
export function activeVoiceToModel(activeVoice: 1 | 2): 0 | 1 {
  return (activeVoice - 1) as 0 | 1
}

/**
 * Inverse of {@link activeVoiceToModel}: map a 0-based model voice back to the
 * 1-based UI active voice. Only voices 0/1 are editable today, so anything else
 * clamps into that range (voice 0 → UI "Voice 1").
 */
export function modelVoiceToActive(voice: number | undefined): 1 | 2 {
  return (voice ?? 0) >= 1 ? 2 : 1
}

export function createEditorState(): EditorState {
  return {
    selectedTool: 'selection',
    activeVoice: 1,
    activeStaff: 0,
    selectedItems: new Map(),
    selectedNoteId: null,
    selectionPivotId: null,
    selectionBase: [],
    selectedArticulationNoteId: null,
    selectedArticulationType: null,
    selectedAccidentalNoteId: null,
    selectedAccidentalType: null,
    selectedDotNoteId: null,
    selectedTupletId: null,
    selectedTieFromNoteId: null,
    selectedSlurId: null,
    selectedSlurEndpoint: null,
    selectedSlurSegmentEndpoint: null,
    selectedSlurSegmentSpanCount: 0,
    slurEndpointCandidateNoteId: null,
    selectedDuration: DEFAULT_DURATION,
    selectedAccidental: null,
    selectedDots: DEFAULT_DOTS,
    accent: false,
    staccato: false,
    tenuto: false,
    selectedMarkingTool: null,
    tupletMode: false,
    selectedBeam: 'auto',
    selectedClefMeasure: null,
    selectedClefBeat: null,
    selectedClefStaff: 0,
    selectedTimeSignatureMeasure: null,
    selectedMeasureRange: null,
    selectedMeasureStaff: 0,
    selectedMeasureBoxStyle: 'double',
    selectedDynamicId: null,
    selectedTempoId: null,
    editingText: null,
    pastePlacementArmed: false,
    showCursor: true,
    isPanning: false,
    playbackState: 'stopped',
    viewMode: 'wrapped',
  }
}

/** A framework-agnostic change-notification: fired with the top-level key that was written. */
export type StateListener = (key: keyof EditorState) => void

/**
 * An {@link EditorState} that carries its OWN change-notification, independent of any
 * framework. Read and write `state` exactly as a plain object; `subscribe(fn)` registers a
 * listener called with the key on every top-level write.
 *
 * The whole mechanism is a Proxy `set` trap (see docs/observable-editorstate-plan.md). It
 * composes with Vue: `reactive(observable.state)` wraps the emitting Proxy, so a single
 * assignment fires BOTH Vue's dependents and these listeners. When Vue eventually leaves,
 * this `subscribe` is the end-state reactivity — nothing here is scaffolding.
 *
 * Contract for subscribers (emits are synchronous, one per write — NOT batched like Vue):
 *   1. Idempotent — called several times per gesture; the last call settles it.
 *   2. Torn-state tolerant — early emits run against mid-transition state.
 *   3. Never a state writer — a write from inside a callback is a re-entrant emit.
 *
 * Limit: only TOP-LEVEL writes emit. Mutating a nested value in place
 * (`state.selectedItems.set(…)`) does not — the trap never sees it. Every current writer
 * ends by assigning a top-level scalar, so coverage is complete; keep it that way.
 */
export interface ObservableEditorState {
  /** Read & write exactly as a plain EditorState; every top-level write notifies subscribers. */
  state: EditorState
  /** Register a change listener; returns an unsubscribe fn. */
  subscribe(fn: StateListener): () => void
}

export function createObservableEditorState(): ObservableEditorState {
  const raw = createEditorState()
  const listeners = new Set<StateListener>()
  const state = new Proxy(raw, {
    set(target, key, value) {
      const changed = target[key as keyof EditorState] !== value
      Reflect.set(target, key, value)
      // The write has already landed, so a throwing subscriber must not starve the others.
      if (changed) {
        for (const fn of listeners) {
          try {
            fn(key as keyof EditorState)
          } catch (e) {
            console.error('[EditorState] listener failed:', e)
          }
        }
      }
      return true
    },
  })
  return {
    state,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
