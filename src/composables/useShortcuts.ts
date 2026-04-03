import type { Ref } from 'vue'
import type { ArticulationType, NoteDuration, Accidental } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import { ShortcutManager } from '../shortcuts'

interface ShortcutsDeps {
  engine: Ref<MusicEngine | null>
  selectedTool: Ref<'entry' | 'selection'>
  selectedNoteId: Ref<string | null>
  selectedArticulationNoteId: Ref<string | null>
  selectedArticulationType: Ref<string | null>
  selectedAccidentalNoteId: Ref<string | null>
  selectedAccidentalType: Ref<string | null>
  selectedTupletId: Ref<string | null>
  // Palette actions
  setDuration: (d: NoteDuration) => void
  setAccidental: (a: Accidental | null) => void
  toggleAccent: () => void
  toggleStaccato: () => void
  toggleTenuto: () => void
  toggleTie: () => void
  toggleDot: () => void
  toggleTuplet: () => void
  resetPaletteToDefaults: () => void
  // Selection actions
  selectNote: (id: string | null) => void
  navigateSelection: (dir: number) => void
  navigateChord: (dir: number) => void
  adjustPitch: (dir: number) => void
  adjustOctave: (dir: number) => void
  // Keyboard entry actions
  enterNoteByLetter: (letter: string) => void
  enterRestAtCursorPosition: () => void
  addChordNoteByLetter: (letter: string) => void
  // Render
  renderScore: () => void
  // Mouse position (for ghost note after mode switch)
  getLastMousePosition: () => { x: number; y: number } | null
  renderPreview: (coords: { x: number; y: number }) => void
}

export function useShortcuts(deps: ShortcutsDeps) {
  const {
    engine,
    selectedTool, selectedNoteId,
    selectedArticulationNoteId, selectedArticulationType,
    selectedAccidentalNoteId, selectedAccidentalType,
    selectedTupletId,
    setDuration, setAccidental,
    toggleAccent, toggleStaccato, toggleTenuto, toggleTie, toggleDot, toggleTuplet,
    resetPaletteToDefaults,
    selectNote,
    navigateSelection, navigateChord, adjustPitch, adjustOctave,
    enterNoteByLetter, enterRestAtCursorPosition, addChordNoteByLetter,
    renderScore,
    getLastMousePosition, renderPreview,
  } = deps

  const shortcutManager = new ShortcutManager()

  shortcutManager.registerActions({
    setEntryMode: () => {
      selectedTool.value = 'entry'
      selectedNoteId.value = null
      resetPaletteToDefaults()
      // Show ghost note at last known mouse position
      const pos = getLastMousePosition()
      if (pos) renderPreview(pos)
    },
    enterEntryFromSelection: () => {
      // Only acts when in selection mode with a note selected
      if (selectedTool.value !== 'selection' || !selectedNoteId.value) return
      selectedTool.value = 'entry'
      renderScore()
    },
    setSelectionMode: () => {
      if (selectedTool.value === 'entry') {
        // Exit entry mode → back to selection, keep current note selected
        // Call selectNote to sync palette (accidental, duration, dots) to the note's actual state
        selectedTool.value = 'selection'
        selectNote(selectedNoteId.value)
        renderScore()
      } else if (selectedTool.value === 'selection' && selectedNoteId.value) {
        // If already in selection mode with a note selected, clear selection
        selectNote(null)
        renderScore()
      } else {
        // Otherwise, switch to selection mode
        selectedTool.value = 'selection'
        renderScore() // Clear ghost note immediately
      }
    },
    deleteSelected: () => {
      if (selectedArticulationNoteId.value && selectedArticulationType.value && engine.value) {
        // Delete selected articulation; keep the note
        const noteId = selectedArticulationNoteId.value
        engine.value.toggleArticulation(noteId, selectedArticulationType.value as ArticulationType)
        selectedArticulationNoteId.value = null
        selectedArticulationType.value = null
        selectNote(noteId)
        renderScore()
      } else if (selectedAccidentalNoteId.value && engine.value) {
        // Delete selected accidental; keep the note
        const noteId = selectedAccidentalNoteId.value
        engine.value.updateNote(noteId, { forceAccidental: undefined })
        selectedAccidentalNoteId.value = null
        selectedAccidentalType.value = null
        selectNote(noteId)
        renderScore()
      } else if (selectedTupletId.value && engine.value) {
        // Delete selected tuplet
        engine.value.deleteTuplet(selectedTupletId.value)
        selectedTupletId.value = null
        renderScore()
      } else if (selectedNoteId.value && engine.value) {
        // Delete selected note
        engine.value.deleteNote(selectedNoteId.value)
        selectNote(null)
        renderScore()
      }
    },
    setDurationThirtySecond: () => setDuration('32'),
    setDurationSixteenth: () => setDuration('16'),
    setDurationEighth: () => setDuration('8'),
    setDurationQuarter: () => setDuration('q'),
    setDurationHalf: () => setDuration('h'),
    setDurationWhole: () => setDuration('w'),
    setAccidentalNatural: () => setAccidental('n'),
    setAccidentalSharp: () => setAccidental('#'),
    setAccidentalFlat: () => setAccidental('b'),
    toggleAccent: () => toggleAccent(),
    toggleStaccato: () => toggleStaccato(),
    toggleTenuto: () => toggleTenuto(),
    toggleTie: () => toggleTie(),
    selectNextNote: () => {
      if (selectedTool.value === 'entry') {
        // Right arrow: exit keyboard mode and land on the note AT the cursor
        // (the next beat after the last edited note)
        selectedTool.value = 'selection'
        navigateSelection(1)
      } else {
        navigateSelection(1)
      }
    },
    selectPreviousNote: () => {
      if (selectedTool.value === 'entry') {
        // Left arrow: exit keyboard mode and land on the note to the LEFT of the cursor
        // (the last edited note — already selectedNoteId, no movement needed)
        selectedTool.value = 'selection'
        renderScore()
      } else {
        navigateSelection(-1)
      }
    },
    chordNoteUp: () => navigateChord(1),
    chordNoteDown: () => navigateChord(-1),
    pitchUp: () => adjustPitch(1),
    pitchDown: () => adjustPitch(-1),
    octaveUp: () => adjustOctave(1),
    octaveDown: () => adjustOctave(-1),
    undo: () => {
      if (engine.value?.undo()) {
        const restoredId = engine.value.getLastRestoredNoteId()
        const validId = restoredId && engine.value.getNote(restoredId) ? restoredId : null
        selectNote(validId)
        renderScore()
      }
    },
    redo: () => {
      if (engine.value?.redo()) {
        const restoredId = engine.value.getLastRestoredNoteId()
        const validId = restoredId && engine.value.getNote(restoredId) ? restoredId : null
        selectNote(validId)
        renderScore()
      }
    },
    toggleDot,
    toggleTuplet,
    enterNoteA: () => enterNoteByLetter('a'),
    enterNoteB: () => enterNoteByLetter('b'),
    enterNoteC: () => enterNoteByLetter('c'),
    enterNoteD: () => enterNoteByLetter('d'),
    enterNoteE: () => enterNoteByLetter('e'),
    enterNoteF: () => enterNoteByLetter('f'),
    enterNoteG: () => enterNoteByLetter('g'),
    enterRest: () => enterRestAtCursorPosition(),
    addChordA: () => addChordNoteByLetter('a'),
    addChordB: () => addChordNoteByLetter('b'),
    addChordC: () => addChordNoteByLetter('c'),
    addChordD: () => addChordNoteByLetter('d'),
    addChordE: () => addChordNoteByLetter('e'),
    addChordF: () => addChordNoteByLetter('f'),
    addChordG: () => addChordNoteByLetter('g'),
  })

  return {
    enable: () => shortcutManager.enable(),
    disable: () => shortcutManager.disable(),
  }
}
