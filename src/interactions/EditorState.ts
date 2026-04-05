import type { Accidental, NoteDuration } from '../types/music'

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

  // --- Palette ---
  selectedDuration: NoteDuration
  selectedAccidental: Accidental | null
  selectedDots: number
  accent: boolean
  staccato: boolean
  tenuto: boolean
  tupletMode: boolean

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
    selectedDuration: 'q',
    selectedAccidental: null,
    selectedDots: 0,
    accent: false,
    staccato: false,
    tenuto: false,
    tupletMode: false,
    showCursor: true,
    playbackState: 'stopped',
  }
}
