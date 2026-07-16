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
  /**
   * Articulations armed as a STAMP tool (empty = not active). Distinct from the
   * `accent`/`staccato`/`tenuto` flags above, which arm an articulation for the NEXT note
   * ENTERED. This is a marking tool (like {@link selectedClef}): armed from selection mode with no
   * note/group selected, it switches to entry mode, shows a ghost of the armed articulations
   * following the cursor, and a click ADDS them to the note clicked (existing notes only — no note
   * entry). ADDITIVE: pressing another articulation key adds it to the armed set (all get stamped
   * together); pressing an armed one removes it; emptying the set disarms back to selection mode.
   * Mutually exclusive with the clef/TS/dynamic/tempo tools. Always REASSIGNED (never mutated in
   * place) so the observable state emits a change. */
  selectedArticulationTools: ArticulationType[]
  /**
   * An accidental armed as a STAMP tool (null = not active). Distinct from
   * {@link selectedAccidental}, which arms an accidental for the NEXT note ENTERED. Like
   * {@link selectedArticulationTools} but SINGLE-valued: a note has exactly one accidental state, so
   * pressing a different accidental key SWAPS the armed one rather than stacking. Armed from
   * selection mode with no note/group selected; switches to entry mode, shows a ghost accidental
   * following the cursor, and a click SETS that accidental on the note clicked (existing notes only,
   * changing its pitch — no note entry). Idempotent: clicking a note that already has that
   * accidental does nothing. Pressing a duration while armed promotes it into note-entry (the
   * "accidental + duration" workflow). Mutually exclusive with the other marking tools. */
  selectedAccidentalTool: Accidental | null
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

  /** Which box the {@link selectedMeasureRange} renders as. `'double'` = the visual-only
   *  Ctrl+Shift+click marker (two nested rectangles, no objects selected). `'single'` = the
   *  Sibelius-style plain-click passage selection: ONE rectangle around a single bar whose
   *  contents (notes/rests + enclosed dynamics/slurs) ARE selected. Only meaningful while
   *  {@link selectedMeasureRange} is non-null. */
  selectedMeasureBoxStyle: 'single' | 'double'

  // --- Dynamics tool ---
  /** Dynamic armed for placement (null = dynamics tool not active). A level
   *  (`p`/`mp`/`mf`/`f`) places that mark on click; `'text'` prompts for custom
   *  italic text. When set, canvas clicks place a dynamic and the ghost note is
   *  suppressed. */
  selectedDynamic: DynamicTool | null
  /** Id of the on-score dynamic selected for removal/edit (selection tool); null
   *  if none. Distinct from `selectedDynamic` (the armed palette tool). */
  selectedDynamicId: string | null

  // --- Tempo tool ---
  /** Tempo mark armed for placement (null = tempo tool not active). Placed on the next
   *  canvas click, at the clicked bar's nearest slot beat. System-level: no staff, no
   *  voice — clicking any staff places ONE mark governing the whole system. */
  selectedTempo: TempoTool | null
  /** Id of the on-score tempo mark selected for removal/edit (selection tool); null if
   *  none. Distinct from `selectedTempo` (the armed palette tool). */
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
    selectedArticulationTools: [],
    selectedAccidentalTool: null,
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
    selectedMeasureBoxStyle: 'double',
    selectedDynamic: null,
    selectedDynamicId: null,
    selectedTempo: null,
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
