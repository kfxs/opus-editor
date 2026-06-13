import type { Ref } from 'vue'
import type { ArticulationType } from '../types/music'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from '../interactions/EditorState'
import type { SelectionController } from '../interactions/SelectionController'
import type { PaletteController } from '../interactions/PaletteController'
import type { KeyboardController } from '../interactions/KeyboardController'
import type { RenderController } from '../interactions/RenderController'
import type { ClipboardController } from '../interactions/ClipboardController'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'

/**
 * Vue adapter that wires keyboard shortcuts to controller actions.
 * Reads/writes EditorState directly (no Vue ref wrappers needed).
 */
export function useShortcuts(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  selection: SelectionController,
  palette: PaletteController,
  keyboard: KeyboardController,
  renderer: RenderController,
  clipboard: ClipboardController,
  getLastMousePosition: () => { x: number; y: number } | null,
): { enable: () => void; disable: () => void } {
  const shortcutManager = new ShortcutManager()

  shortcutManager.registerActions({
    setEntryMode: () => {
      state.selectedTool = 'entry'
      state.selectedNoteId = null
      palette.resetToDefaults()
      const pos = getLastMousePosition()
      if (pos) renderer.renderPreview(pos)
    },
    enterEntryFromSelection: () => {
      if (state.selectedTool !== 'selection' || !state.selectedNoteId) return
      state.selectedTool = 'entry'
      renderer.renderScore()
    },
    copySelection: () => clipboard.copy(),
    pasteClipboard: () => clipboard.paste(),
    setSelectionMode: () => {
      // Esc first cancels a pending (armed) paste, if any.
      if (state.pastePlacementArmed) {
        clipboard.cancelArmedPaste()
        return
      }
      // Leaving entry mode disarms the entry-only positional tools (clef / time
      // signature / dynamic) so the palette stops showing them as selected.
      palette.disarmPositionalTools()
      if (state.selectedTool === 'entry') {
        state.selectedTool = 'selection'
        selection.selectNote(state.selectedNoteId)
        renderer.renderScore()
      } else if (state.selectedTool === 'selection' && state.selectedNoteId) {
        selection.selectNote(null)
        renderer.renderScore()
      } else {
        state.selectedTool = 'selection'
        renderer.renderScore()
      }
    },
    deleteSelected: () => {
      const eng = engine.value
      if (state.selectedArticulationNoteId && state.selectedArticulationType && eng) {
        const noteId = state.selectedArticulationNoteId
        eng.toggleArticulation(noteId, state.selectedArticulationType as ArticulationType)
        state.selectedArticulationNoteId = null
        state.selectedArticulationType = null
        selection.selectNote(noteId)
        renderer.renderScore()
      } else if (state.selectedAccidentalNoteId && eng) {
        const noteId = state.selectedAccidentalNoteId
        eng.updateNote(noteId, { forceAccidental: undefined })
        state.selectedAccidentalNoteId = null
        state.selectedAccidentalType = null
        selection.selectNote(noteId)
        renderer.renderScore()
      } else if (state.selectedTieFromNoteId && eng) {
        eng.toggleTie(state.selectedTieFromNoteId)
        state.selectedTieFromNoteId = null
        renderer.renderScore()
      } else if (state.selectedTupletId && eng) {
        eng.deleteTuplet(state.selectedTupletId)
        state.selectedTupletId = null
        renderer.renderScore()
      } else if (state.selectedClefMeasure !== null && eng) {
        const beat = beatToFrac(state.selectedClefBeat ?? 0)
        const removed = eng.removeClefAt(state.selectedClefMeasure, beat)
        if (!removed) {
          console.log(`Cannot remove clef at measure ${state.selectedClefMeasure} beat ${state.selectedClefBeat ?? 0} (measure 1 opening clef can only be changed)`)
        }
        state.selectedClefMeasure = null
        state.selectedClefBeat = null
        renderer.renderScore()
      } else if (state.selectedTimeSignatureMeasure !== null && eng) {
        const measureNum = state.selectedTimeSignatureMeasure
        if (measureNum === 1) {
          // Measure 1 carries the score's default meter and can't be removed — hide
          // the glyph instead (the 4/4 meter / bar sizing is kept).
          eng.setTimeSignatureHidden(measureNum, true)
        } else {
          // A mid-score change: revert this region to the prior meter and rebar.
          eng.removeTimeSignatureChange(measureNum)
        }
        state.selectedTimeSignatureMeasure = null
        renderer.renderScore()
      } else if (state.selectedDynamicId && eng) {
        eng.removeDynamic(state.selectedDynamicId)
        state.selectedDynamicId = null
        renderer.renderScore()
      } else if (state.selectedItems.size > 0 && eng) {
        // Delete every selected note as ONE undoable action (Phase 1: the set holds
        // only notes), so a single Ctrl-Z restores the whole group, not note-by-note.
        const ids = [...state.selectedItems.values()].filter(i => i.kind === 'note').map(i => i.id)
        eng.runBatch(`Delete ${ids.length} note(s)`, () => {
          for (const id of ids) eng.deleteNote(id)
        })
        selection.selectNote(null)
        renderer.renderScore()
      }
    },
    setDurationThirtySecond: () => palette.setDuration('32'),
    setDurationSixteenth: () => palette.setDuration('16'),
    setDurationEighth: () => palette.setDuration('8'),
    setDurationQuarter: () => palette.setDuration('q'),
    setDurationHalf: () => palette.setDuration('h'),
    setDurationWhole: () => palette.setDuration('w'),
    setAccidentalNatural: () => palette.setAccidental('n'),
    setAccidentalSharp: () => palette.setAccidental('#'),
    setAccidentalFlat: () => palette.setAccidental('b'),
    toggleAccent: () => palette.toggleAccent(),
    toggleStaccato: () => palette.toggleStaccato(),
    toggleTenuto: () => palette.toggleTenuto(),
    toggleTie: () => palette.toggleTie(),
    toggleSlur: () => palette.toggleSlur(),
    selectNextNote: () => {
      if (state.selectedTool === 'entry') {
        console.log(`[Nav] ArrowRight in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        selection.navigateSelection(1)
      } else {
        selection.navigateSelection(1)
      }
    },
    selectPreviousNote: () => {
      if (state.selectedTool === 'entry') {
        console.log(`[Nav] ArrowLeft in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        renderer.renderScore()
      } else {
        selection.navigateSelection(-1)
      }
    },
    chordNoteUp: () => selection.navigateChord(1),
    chordNoteDown: () => selection.navigateChord(-1),
    pitchUp: () => selection.adjustPitch(1),
    pitchDown: () => selection.adjustPitch(-1),
    octaveUp: () => selection.adjustOctave(1),
    octaveDown: () => selection.adjustOctave(-1),
    undo: () => {
      const eng = engine.value
      if (eng?.undo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    redo: () => {
      const eng = engine.value
      if (eng?.redo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    flipStemDirection: () => {
      const eng = engine.value
      if (!eng || !state.selectedNoteId) return
      eng.flipStemDirection(state.selectedNoteId)
      renderer.renderScore()
    },
    toggleDot: () => palette.toggleDot(),
    toggleTuplet: () => palette.toggleTuplet(),
    enterNoteA: () => keyboard.enterNoteByLetter('a'),
    enterNoteB: () => keyboard.enterNoteByLetter('b'),
    enterNoteC: () => keyboard.enterNoteByLetter('c'),
    enterNoteD: () => keyboard.enterNoteByLetter('d'),
    enterNoteE: () => keyboard.enterNoteByLetter('e'),
    enterNoteF: () => keyboard.enterNoteByLetter('f'),
    enterNoteG: () => keyboard.enterNoteByLetter('g'),
    enterRest: () => keyboard.enterRestAtCursorPosition(),
    addChordA: () => keyboard.addChordNoteByLetter('a'),
    addChordB: () => keyboard.addChordNoteByLetter('b'),
    addChordC: () => keyboard.addChordNoteByLetter('c'),
    addChordD: () => keyboard.addChordNoteByLetter('d'),
    addChordE: () => keyboard.addChordNoteByLetter('e'),
    addChordF: () => keyboard.addChordNoteByLetter('f'),
    addChordG: () => keyboard.addChordNoteByLetter('g'),
  })

  return {
    enable: () => shortcutManager.enable(),
    disable: () => shortcutManager.disable(),
  }
}
