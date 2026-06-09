import type { Accidental, NoteDuration, BeamMode, Clef, TimeSignature, DynamicLevel } from '../types/music'

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
  selectedNoteId: string | null
  selectedArticulationNoteId: string | null
  selectedArticulationType: string | null
  selectedAccidentalNoteId: string | null
  selectedAccidentalType: string | null
  selectedTupletId: string | null
  selectedTieFromNoteId: string | null

  // --- Palette ---
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

  // --- Time signature tool ---
  /** Time signature armed for placement (null = TS tool not active). When set,
   *  canvas clicks set/change a measure's time signature and the ghost note is
   *  suppressed. */
  selectedTimeSignature: TimeSignature | null
  /** Measure of the on-score time-signature glyph selected for removal (selection
   *  tool); null if none. Distinct from `selectedTimeSignature` (the armed palette
   *  meter for placement). */
  selectedTimeSignatureMeasure: number | null

  // --- Dynamics tool ---
  /** Dynamic armed for placement (null = dynamics tool not active). A level
   *  (`p`/`mp`/`mf`/`f`) places that mark on click; `'text'` prompts for custom
   *  italic text. When set, canvas clicks place a dynamic and the ghost note is
   *  suppressed. */
  selectedDynamic: DynamicTool | null
  /** Id of the on-score dynamic selected for removal/edit (selection tool); null
   *  if none. Distinct from `selectedDynamic` (the armed palette tool). */
  selectedDynamicId: string | null

  // --- UI ---
  showCursor: boolean
  playbackState: PlaybackState
}

export function createEditorState(): EditorState {
  return {
    selectedTool: 'entry',
    selectedNoteId: null,
    selectedArticulationNoteId: null,
    selectedArticulationType: null,
    selectedAccidentalNoteId: null,
    selectedAccidentalType: null,
    selectedTupletId: null,
    selectedTieFromNoteId: null,
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
    selectedTimeSignature: null,
    selectedTimeSignatureMeasure: null,
    selectedDynamic: null,
    selectedDynamicId: null,
    showCursor: true,
    playbackState: 'stopped',
  }
}
