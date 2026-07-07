import type { Accidental, NoteDuration, BeamMode, Clef, TimeSignature, DynamicLevel } from '../types/music'
import type { SelectionItem } from './selection'

/** A value armed on the dynamics palette: an interpreted level, or the custom-text tool. */
export type DynamicTool = DynamicLevel | 'text'

export type ToolMode = 'entry' | 'selection'
export type PlaybackState = 'stopped' | 'playing' | 'paused'

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
  tupletMode: boolean
  selectedBeam: BeamMode

  // --- Clef tool ---
  /** Clef armed for placement (null = clef tool not active). When set, canvas
   *  clicks set/change a measure's clef and the ghost note is suppressed. */
  selectedClef: Clef | null
  /** Measure of the clef selected for removal (selection tool); null if none. */
  selectedClefMeasure: number | null
  /** Beat of the selected clef within its measure (0 = opening clef). */
  selectedClefBeat: number | null
  /** 0-based staff of the selected clef (multi-staff); a delete/edit stays on it. */
  selectedClefStaff: number

  // --- Time signature tool ---
  /** Time signature armed for placement (null = TS tool not active). When set,
   *  canvas clicks set/change a measure's time signature and the ghost note is
   *  suppressed. */
  selectedTimeSignature: TimeSignature | null
  /** Measure of the on-score time-signature glyph selected for removal (selection
   *  tool); null if none. Distinct from `selectedTimeSignature` (the armed palette
   *  meter for placement). */
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

  // --- Dynamics tool ---
  /** Dynamic armed for placement (null = dynamics tool not active). A level
   *  (`p`/`mp`/`mf`/`f`) places that mark on click; `'text'` prompts for custom
   *  italic text. When set, canvas clicks place a dynamic and the ghost note is
   *  suppressed. */
  selectedDynamic: DynamicTool | null
  /** Id of the on-score dynamic selected for removal/edit (selection tool); null
   *  if none. Distinct from `selectedDynamic` (the armed palette tool). */
  selectedDynamicId: string | null

  // --- In-canvas text editing ---
  /** Set while a seamless DOM-overlay text editor is open over a mark; null when
   *  not editing. While non-null, the canvas mouse handlers (click / move) bail so
   *  the edit is modal-ish and a commit-click can't plant a stray mark. `kind` is a
   *  discriminator for future text types (lyric/technique/…); `isNew` carries the
   *  empty-text rule's "just placed vs existing" signal to the source. */
  editingText: { targetId: string; kind: 'dynamic'; isNew: boolean } | null

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
    selectedTool: 'entry',
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
    selectedTupletId: null,
    selectedTieFromNoteId: null,
    selectedSlurId: null,
    selectedSlurEndpoint: null,
    selectedSlurSegmentEndpoint: null,
    selectedSlurSegmentSpanCount: 0,
    slurEndpointCandidateNoteId: null,
    selectedDuration: 'q',
    selectedAccidental: null,
    selectedDots: 0,
    accent: false,
    staccato: false,
    tenuto: false,
    tupletMode: false,
    selectedBeam: 'auto',
    selectedClef: null,
    selectedClefMeasure: null,
    selectedClefBeat: null,
    selectedClefStaff: 0,
    selectedTimeSignature: null,
    selectedTimeSignatureMeasure: null,
    selectedMeasureRange: null,
    selectedMeasureStaff: 0,
    selectedDynamic: null,
    selectedDynamicId: null,
    editingText: null,
    pastePlacementArmed: false,
    showCursor: true,
    isPanning: false,
    playbackState: 'stopped',
  }
}
