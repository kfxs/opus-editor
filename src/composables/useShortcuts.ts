import type { Ref } from 'vue'
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from '../interactions/EditorState'
import type { SelectionController } from '../interactions/SelectionController'
import type { PaletteController } from '../interactions/PaletteController'
import type { KeyboardController } from '../interactions/KeyboardController'
import type { RenderController } from '../interactions/RenderController'
import type { ClipboardController } from '../interactions/ClipboardController'
import type { ViewportHost } from './useViewport'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'
import { selectedArticulationNoteIds } from '../interactions/selection'

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
  viewport: ViewportHost,
  getLastMousePosition: () => { x: number; y: number } | null,
): { enable: () => void; disable: () => void } {
  const shortcutManager = new ShortcutManager()

  // Focal point for keyboard zoom = the viewport center (screen coords); the keys carry no
  // cursor position, so the center is the natural anchor (the wheel uses the cursor instead).
  const viewportCenter = () => {
    const { w, h } = viewport.model.getViewportSize()
    return { x: w / 2, y: h / 2 }
  }

  // Slur endpoint keyboard nudge step (staff-spaces; see docs/slur-endpoint-offset-plan.md):
  // a plain arrow is fine, Ctrl+arrow is coarse.
  const NUDGE_FINE_SS = 0.25
  const NUDGE_COARSE_SS = 1.0

  // Nudge the armed slur endpoint by a staff-space delta (screen-down is +y, so "up arrow
  // lifts the point" passes a negative dy). Returns true when it consumed the key (an
  // endpoint was armed), false to DECLINE so the key falls through to its normal action.
  const nudgeArmedEndpoint = (dx: number, dy: number): boolean => {
    const eng = engine.value
    if (!eng || !state.selectedSlurId || !state.selectedSlurEndpoint) return false
    eng.nudgeSlurEndpoint(state.selectedSlurId, state.selectedSlurEndpoint, dx, dy)
    renderer.renderScore()
    return true
  }

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
    setActiveVoice1: () => palette.setActiveVoice(1),
    setActiveVoice2: () => palette.setActiveVoice(2),
    copySelection: () => clipboard.copy(),
    pasteClipboard: () => clipboard.paste(),
    zoomIn: () => viewport.zoomToStop(1, viewportCenter()),
    zoomOut: () => viewport.zoomToStop(-1, viewportCenter()),
    zoomReset: () => {
      const z = viewport.model.getZoom()
      if (z === 1) return
      // factor 1/z lands exactly on 100%, anchored at the viewport center.
      viewport.zoomAt(1 / z, viewportCenter())
    },
    setSelectionMode: () => {
      // Esc first cancels a pending (armed) paste, if any.
      if (state.pastePlacementArmed) {
        clipboard.cancelArmedPaste()
        return
      }
      // Drop focus from the last-clicked toolbar button. Without this it keeps a focus
      // ring — and the Esc keypress itself marks it as keyboard-focused (:focus-visible),
      // so it shows even after the armed tool is disarmed below.
      if (typeof document !== 'undefined') (document.activeElement as HTMLElement | null)?.blur()
      // Leaving entry mode disarms the entry-only positional tools (clef / time
      // signature / dynamic) so the palette stops showing them as selected.
      palette.disarmPositionalTools()
      // Esc returns entry to the default voice 1 (Sibelius-style); the selection-mode
      // branch resets it via deselectAll() below, the entry branch needs it explicitly.
      state.activeVoice = 1
      if (state.selectedTool === 'entry') {
        // Entry → selection: keep the cursor note as the selected note.
        state.selectedTool = 'selection'
        selection.selectNote(state.selectedNoteId)
      } else {
        // Already in selection mode: Esc clears the whole current selection — a note OR
        // a scalar element (dynamic, clef, tie, slur, accidental, tuplet, time signature).
        selection.deselectAll()
      }
      renderer.renderScore()
    },
    deleteSelected: () => {
      const eng = engine.value
      const artNoteIds = selectedArticulationNoteIds(state.selectedItems.values())
      if (artNoteIds.length && eng) {
        // Group selection: Delete removes every articulation on every selected note,
        // as ONE undoable action (a single Ctrl-Z restores them all).
        eng.runBatch(`Clear articulations on ${artNoteIds.length} note(s)`, () => {
          for (const noteId of artNoteIds) eng.clearArticulations(noteId)
        })
        selection.selectNote(null)
        renderer.renderScore()
      } else if (state.selectedAccidentalNoteId && eng) {
        const noteId = state.selectedAccidentalNoteId
        // Remove the accidental by reverting the note to the measure's prevailing
        // alteration, then clearing any forced sign. This makes the glyph disappear in
        // every case: a lone sharp/flat → natural (prevailing 0); a required natural
        // (♮ cancelling an earlier sharp) → back to that sharp (prevailing ±1).
        eng.updateNote(noteId, { alter: eng.getPrevailingAlter(noteId), forceAccidental: undefined })
        state.selectedAccidentalNoteId = null
        state.selectedAccidentalType = null
        selection.selectNote(noteId)
        renderer.renderScore()
      } else if (state.selectedTieFromNoteId && eng) {
        eng.toggleTie(state.selectedTieFromNoteId)
        state.selectedTieFromNoteId = null
        renderer.renderScore()
      } else if (state.selectedSlurId && eng) {
        eng.removeSlur(state.selectedSlurId)
        state.selectedSlurId = null
        state.selectedSlurEndpoint = null
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
    createSlur: () => palette.createSlur(),
    selectNextNote: () => {
      // Armed slur endpoint → fine nudge right instead of navigating.
      if (nudgeArmedEndpoint(NUDGE_FINE_SS, 0)) return
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
      // Armed slur endpoint → fine nudge left instead of navigating.
      if (nudgeArmedEndpoint(-NUDGE_FINE_SS, 0)) return
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
    voiceNavUp: () => selection.navigateVoice(1),
    voiceNavDown: () => selection.navigateVoice(-1),
    // Vertical arrows: nudge the armed slur endpoint, else the normal pitch/octave edit.
    // (These keys are already bound, so they always consume — the nudge branch returns void
    // via the early return, so preventDefault still fires.)
    pitchUp: () => { if (!nudgeArmedEndpoint(0, -NUDGE_FINE_SS)) selection.adjustPitch(1) },
    pitchDown: () => { if (!nudgeArmedEndpoint(0, NUDGE_FINE_SS)) selection.adjustPitch(-1) },
    octaveUp: () => { if (!nudgeArmedEndpoint(0, -NUDGE_COARSE_SS)) selection.adjustOctave(1) },
    octaveDown: () => { if (!nudgeArmedEndpoint(0, NUDGE_COARSE_SS)) selection.adjustOctave(-1) },
    // Horizontal COARSE nudge (Ctrl+←/→) is unbound otherwise → DECLINE (return the false
    // from nudgeArmedEndpoint) when no endpoint is armed, keeping the key free.
    nudgeSlurEndpointCoarseLeft: () => nudgeArmedEndpoint(-NUDGE_COARSE_SS, 0),
    nudgeSlurEndpointCoarseRight: () => nudgeArmedEndpoint(NUDGE_COARSE_SS, 0),
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
      if (!eng) return
      // A selected slur flips side (above ↔ below); a selected articulation flips its
      // side; otherwise x flips a note's stem.
      if (state.selectedSlurId) {
        eng.flipSlur(state.selectedSlurId)
        renderer.renderScore()
        return
      }
      // A selected tie flips its curve direction (up ↔ below), staying notehead-anchored.
      if (state.selectedTieFromNoteId) {
        eng.flipTie(state.selectedTieFromNoteId)
        renderer.renderScore()
        return
      }
      // A selected tuplet flips its bracket/number side (above ↔ below).
      if (state.selectedTupletId) {
        eng.flipTuplet(state.selectedTupletId)
        renderer.renderScore()
        return
      }
      const artNoteIds = selectedArticulationNoteIds(state.selectedItems.values())
      if (artNoteIds.length) {
        // Flip the side of every selected articulation group as ONE undoable action.
        eng.runBatch(`Flip articulations on ${artNoteIds.length} note(s)`, () => {
          for (const noteId of artNoteIds) eng.flipArticulation(noteId)
        })
        renderer.renderScore()
        return
      }
      if (!state.selectedNoteId) return
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
