import { dbg } from '@/utils/debug'
import { TUPLET_PRESETS, tupletPresetAction } from '@/utils/tupletPresets'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction } from '@/types/music'
import type { EditorState } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { PaletteController } from './PaletteController'
import type { KeyboardController } from './KeyboardController'
import type { RenderController } from './RenderController'
import type { ClipboardController } from './ClipboardController'
import type { ViewportHost } from './ViewportHost'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'
import { selectedArticulationNoteIds } from './selection'
import { windows } from '../windows'
import { openClefWindow } from '../windows/clefWindow'
import { toggleSymbolsWindow } from '../windows/symbols'
import { openTimeSignatureWindow } from '../windows/timeSignatureWindow'

/**
 * Wires keyboard shortcuts to controller actions. Framework-agnostic: it reads and writes
 * {@link EditorState} directly and takes the engine as a getter, which is all it ever needed —
 * living in `composables/` was an accident of history (it imported Vue for a single `type Ref`).
 */
export function wireShortcuts(
  state: EditorState,
  getEngine: () => MusicEngine | null,
  selection: SelectionController,
  palette: PaletteController,
  keyboard: KeyboardController,
  renderer: RenderController,
  clipboard: ClipboardController,
  viewport: ViewportHost,
  getLastMousePosition: () => { x: number; y: number } | null,
  insertExpression: () => void,
  insertTempo: () => void,
  editSelectedDynamic: () => boolean,
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

  // Staff-spacing nudge step (staff-spaces; docs/staff-spacing-plan.md §8). Shift+↑/↓ moves by
  // one, Alt+↑/↓ by four — starting conservative (rest-shift shipped too large), tune live.
  const STAFF_SPACING_FINE_SS = 1
  const STAFF_SPACING_COARSE_SS = 4

  // Note-spacing nudge step (staff-spaces; docs/note-spacing-plan.md §5). A quarter of a space per
  // press — small enough that Shift+Alt+→ reads as fine positioning rather than a jump, and it is
  // the same step the slur endpoints already use.
  const NOTE_SPACING_STEP_SS = 0.25

  // Bar-width nudge step (PIXELS of barline movement; docs/bar-width-plan.md §6). One staff-space,
  // so a step means the same distance whether it arrives from the keyboard or (P2) from the mouse —
  // rather than the keyboard nudging an abstract ratio, which would move a dense bar and a sparse
  // one by different amounts under the same key.
  const BAR_WIDTH_STEP_PX = 10

  // Nudge the armed slur endpoint by a staff-space delta (screen-down is +y, so "up arrow
  // lifts the point" passes a negative dy). Returns true when it consumed the key (an
  // endpoint was armed), false to DECLINE so the key falls through to its normal action.
  const nudgeArmedEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    if (!eng || !state.selectedSlurId || !state.selectedSlurEndpoint) return false
    eng.nudgeSlurEndpoint(state.selectedSlurId, state.selectedSlurEndpoint, dx, dy)
    renderer.renderScore()
    return true
  }

  // Same, but for an armed OPEN join (orange square) of a cross-system slur. Passes the
  // captured spanCount as the override's reset signature. See
  // docs/multisystem-slur-segment-endpoint-offset-plan.md.
  const nudgeArmedSegmentEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    if (!eng || !state.selectedSlurId || !state.selectedSlurSegmentEndpoint) return false
    eng.nudgeSlurSegmentEndpoint(state.selectedSlurId, state.selectedSlurSegmentEndpoint, dx, dy, state.selectedSlurSegmentSpanCount)
    renderer.renderScore()
    return true
  }

  // The arrow keys serve EITHER kind of armed slur point (blue true end OR orange open join);
  // the two are mutually exclusive, so try the true end first, then the open join. Returns
  // true if either consumed the key (so the caller skips its default action / DECLINEs).
  const nudgeArmedSlurPoint = (dx: number, dy: number): boolean =>
    nudgeArmedEndpoint(dx, dy) || nudgeArmedSegmentEndpoint(dx, dy)

  // ↑/↓ on a SINGLE selected rest = nudge its vertical shift by one staff-step (+up), instead
  // of the pitch edit (which skips rests anyway). One undo per press. See docs/rest-shift-plan.md.
  const nudgeSelectedRest = (delta: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    const note = eng.getNote(item.id)
    if (!note || !note.isRest) return false
    if (!eng.nudgeRestShift(item.id, delta)) return false
    renderer.renderScore()
    return true
  }

  // ←→↑↓ (fine) / Ctrl+arrow (coarse) on a selected DYNAMIC = nudge its position offset by a
  // staff-space delta (screen-down is +y, so "up arrow lifts the mark" passes a negative dy),
  // instead of the pitch/nav edit (which no-ops on a dynamic anyway). Disjoint from the
  // slur/rest/box selections, so it just adds another modal branch. One undo per press. Returns
  // true when it consumed the key, false to DECLINE so it falls through. See docs/dynamic-offset-plan.md.
  const nudgeSelectedDynamic = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    if (!eng || !state.selectedDynamicId) return false
    if (!eng.nudgeDynamicOffset(state.selectedDynamicId, dx, dy)) return false
    renderer.renderScore()
    return true
  }

  // Shift+↑/↓ (fine) / Alt+↑/↓ (coarse) on a plain-click SINGLE measure box = Sibelius
  // "space above staff": nudge the clicked staff's vertical spacing by `delta` staff-spaces
  // (+down). Gated to the single-box selection — disjoint from the chord-nav that Alt+↑/↓
  // otherwise drives (see docs/staff-spacing-plan.md §6). One undo per press. Returns true
  // when it consumed the key, false to DECLINE so it falls through to its normal action.
  const nudgeStaffSpacingIfBoxSelected = (delta: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedMeasureRange === null || state.selectedMeasureBoxStyle !== 'single') return false
    // Per-system (plan option C): the tweak targets the system the selected bar sits on.
    if (!eng.nudgeStaffSpacing(state.selectedMeasureStaff, state.selectedMeasureRange.anchor, delta)) return false
    renderer.renderScore()
    return true
  }

  // Shift+Alt+←/→ on a SINGLE selected note or rest = change the space allocated BEFORE its column
  // (Sibelius note spacing). Unlike every other nudge wired here this one has WIDTH: the bar grows
  // or shrinks and everything right of the column slides, so it re-runs the casting-off rather than
  // just repainting. The engine DECLINES (null) when it cannot measure how far left the column may
  // go — an unrendered bar has no gaps to read — and we decline with it rather than guessing.
  // One undo per press. See docs/note-spacing-plan.md §5.
  const selectedColumn = (): { measure: number; beat: Fraction } | null => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return null
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return null
    const note = eng.getNote(item.id)
    return note ? { measure: note.measure, beat: note.beat } : null
  }

  const nudgeSelectedNoteSpacing = (delta: number): boolean => {
    const eng = getEngine()
    const column = selectedColumn()
    if (!eng || !column) return false
    if (eng.nudgeNoteSpacing(column.measure, column.beat, delta) === null) return false
    renderer.renderScore()
    return true
  }

  // Shift+Alt+←/→ on a selected BARLINE = move that barline: the bar it ends gets roomier or
  // tighter, its music re-spaced proportionally, and the room comes from its neighbours on the line.
  // Same keys and same axis as the note-spacing nudge above, dispatched on WHAT IS SELECTED — a
  // note is note spacing, a barline is bar width. That is Sibelius's own behaviour, not a collision
  // being papered over, and it costs nothing: the note-spacing branch already declines when no
  // single note is selected, so this is a `||` onto it. The engine DECLINES (null) when the last
  // render cannot say how far the barline may go — including the barline that ENDS a system, which
  // justification pins to the right margin and no stretch can move. One undo per press.
  // See docs/bar-width-plan.md §4–§6.
  const nudgeSelectedBarWidth = (deltaPx: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedBarlineMeasure === null) return false
    if (eng.nudgeBarWidth(state.selectedBarlineMeasure, deltaPx) === null) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarWidth = (): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedBarlineMeasure === null) return false
    if (!eng.resetBarWidth(state.selectedBarlineMeasure)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedNoteSpacing = (): boolean => {
    const eng = getEngine()
    const column = selectedColumn()
    if (!eng || !column) return false
    if (!eng.resetNoteSpacing(column.measure, column.beat)) return false
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
    pressSpace: () => {
      // The typewriter: in keyboard entry, SPACE types a rest of the current duration and moves the
      // caret on — armed or not (the rest tool need not be selected first). It DECLINES (returns
      // false) in every other case, so the key keeps its original job below (start entry) untouched.
      if (keyboard.enterRestAtCursor()) return
      if (state.selectedTool !== 'selection' || !state.selectedNoteId) return
      state.selectedTool = 'entry'
      renderer.renderScore()
    },
    setActiveVoice1: () => palette.setActiveVoice(1),
    setActiveVoice2: () => palette.setActiveVoice(2),
    copySelection: () => clipboard.copy(),
    pasteClipboard: () => clipboard.paste(),
    // Ctrl+E — the same action as Insert ▸ Text ▸ Expression. The branch (attach-and-edit vs
    // arm the click-to-type tool) lives in MouseController.insertExpression, one source for both.
    editDynamicOnSelection: () => insertExpression(),
    // Enter — edit the selected dynamic inline (twin of double-click). Returns false to DECLINE
    // (keep Enter free) when no dynamic is selected. MouseController.editSelectedDynamic.
    editSelectedDynamic: () => editSelectedDynamic(),
    // Q — the same action as Insert ▸ Clef. Opening a window needs no controller, so this reaches
    // the window layer directly rather than taking a callback through App.ts.
    // (Braces, not a concise body: the handler's return value is the manager's DECLINE signal, and
    // the opened Window is not an answer to that question.)
    openClefWindow: () => {
      openClefWindow(windows)
    },
    // T — the same action as Insert ▸ Time Signature; reaches the window layer directly, like Q.
    openTimeSignatureWindow: () => {
      openTimeSignatureWindow(windows)
    },
    // Z — the Symbols chart. A TOGGLE, not an open: it is a panel you consult and dismiss with the
    // same key, and it has nothing to commit, so there is no dialog verdict to make Escape mean.
    openSymbolsWindow: () => {
      toggleSymbolsWindow(windows)
    },
    // Ctrl+Alt+T — the tempo twin; branch lives in MouseController.insertTempo.
    insertTempoOnSelection: () => insertTempo(),
    zoomIn: () => viewport.zoomToStop(1, viewportCenter()),
    zoomOut: () => viewport.zoomToStop(-1, viewportCenter()),
    zoomReset: () => {
      const z = viewport.model.getZoom()
      if (z === 1) return
      // factor 1/z lands exactly on 100%, anchored at the viewport center.
      viewport.zoomAt(1 / z, viewportCenter())
    },
    toggleViewMode: () => palette.toggleViewMode(),
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
      // Esc returns entry to the default voice 1 / staff 0 (Sibelius-style); the
      // selection-mode branch resets them via deselectAll() below, entry needs it explicitly.
      state.activeVoice = 1
      state.activeStaff = 0
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
      const eng = getEngine()
      const artNoteIds = selectedArticulationNoteIds(state.selectedItems.values())
      if (state.selectedMeasureRange !== null && state.selectedMeasureBoxStyle === 'double' && eng) {
        // A measure span is box-selected via Ctrl+Shift+click (the DOUBLE box, extendable) —
        // Delete removes every WHOLE bar in the span and its contents (Sibelius-style),
        // pulling later bars back and renumbering, all as one undo step. Removing the actual
        // bar is reserved for this gesture; the plain-click box only clears content (below).
        const { anchor, focus } = state.selectedMeasureRange
        const removed = eng.removeMeasureRange(anchor, focus)
        dbg(`✓ Removed ${removed} measure(s) in span ${Math.min(anchor, focus)}–${Math.max(anchor, focus)}`)
        state.selectedMeasureRange = null
        renderer.renderScore()
      } else if (state.selectedMeasureRange !== null && eng) {
        // A single bar is plain-click-selected (the SINGLE box) — Delete CLEARS its content
        // rather than removing the bar: the clicked staff's notes/rests reset to the default
        // rest fill (one measure rest, not a per-gap recompute) and the dynamics/slurs the box
        // pulled in are removed, all as ONE undo step (runBatch coalesces).
        const measure = state.selectedMeasureRange.anchor // single box: anchor === focus
        const staff = state.selectedMeasureStaff
        const items = [...state.selectedItems.values()]
        const dynIds = items.filter(i => i.kind === 'dynamic').map(i => i.id)
        const slurIds = items.filter(i => i.kind === 'slur').map(i => i.id)
        eng.runBatch(`Clear measure ${measure}`, () => {
          eng.clearMeasureStaff(measure, staff)
          for (const id of dynIds) eng.removeDynamic(id)
          for (const id of slurIds) eng.removeSlur(id)
        })
        dbg(`✓ Cleared measure ${measure} (staff ${staff}) to default rest`)
        selection.deselectAll()
        renderer.renderScore()
      } else if (artNoteIds.length && eng) {
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
      } else if (state.selectedDotNoteId && eng) {
        // Removes ALL of the slot's dots at once (`dots` is one value on the chord/rest), including
        // both of a double dot — there is no half-undotting. Keeps the note selected to keep
        // editing, like the accidental above.
        const noteId = state.selectedDotNoteId
        eng.updateNote(noteId, { dots: 0 })
        state.selectedDotNoteId = null
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
        state.selectedSlurSegmentEndpoint = null
        renderer.renderScore()
      } else if (state.selectedTupletId && eng) {
        eng.deleteTuplet(state.selectedTupletId)
        state.selectedTupletId = null
        renderer.renderScore()
      } else if (state.selectedClefMeasure !== null && eng) {
        const beat = beatToFrac(state.selectedClefBeat ?? 0)
        const removed = eng.removeClefAt(state.selectedClefMeasure, beat, state.selectedClefStaff)
        if (!removed) {
          dbg(`Cannot remove clef at measure ${state.selectedClefMeasure} beat ${state.selectedClefBeat ?? 0} (measure 1 opening clef can only be changed)`)
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
      } else if (state.selectedTempoId && eng) {
        // Removing the mark reverts the score to the previous mark's tempo (or
        // DEFAULT_TEMPO if it was the only one) — there is no global to fall back to.
        eng.removeTempoMark(state.selectedTempoId)
        state.selectedTempoId = null
        renderer.renderScore()
      } else if (state.selectedItems.size > 0 && eng) {
        // Delete the whole selection as ONE undoable action so a single Ctrl-Z restores the
        // group. The set holds notes plus any dynamics a Shift-click box pulled in.
        const items = [...state.selectedItems.values()]
        const noteIds = items.filter(i => i.kind === 'note').map(i => i.id)
        const dynIds = items.filter(i => i.kind === 'dynamic').map(i => i.id)
        const slurIds = items.filter(i => i.kind === 'slur').map(i => i.id)
        const extra = [
          dynIds.length ? `${dynIds.length} dynamic(s)` : '',
          slurIds.length ? `${slurIds.length} slur(s)` : '',
        ].filter(Boolean).join(' + ')
        const label = `Delete ${noteIds.length} note(s)${extra ? ` + ${extra}` : ''}`
        eng.runBatch(label, () => {
          for (const id of noteIds) eng.deleteNote(id)
          for (const id of dynIds) eng.removeDynamic(id)
          for (const id of slurIds) eng.removeSlur(id)
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
    // Numpad 0 — the Keypad's rest key by another name, so it routes to the same method the key
    // presses. The panel doesn't have to be open: the numpad IS the Keypad.
    convertToRest: () => palette.pressRest(),
    createSlur: () => palette.createSlur(),
    // Ctrl+Shift+B: keyboard accelerator for the "Add Measure" button — inserts one bar
    // after the Ctrl+Shift-selected measure span (Sibelius's single-bar shortcut). No-op
    // (logged) unless a measure box is selected; PaletteController owns the gating.
    addMeasureAfter: () => palette.addMeasureAfter(),
    toggleRestHidden: () => {
      // Sibelius-style hide/show: toggle every selected REST's own hidden state, all in one
      // undo step (mirrors how deleteSelected batches articulations). Non-rest selections are
      // ignored (notes/text not supported yet). See docs/rest-hide-plan.md.
      const eng = getEngine()
      if (!eng) return
      const restIds = [...state.selectedItems.values()]
        .filter((i) => i.kind === 'note')
        .map((i) => i.id)
        .filter((id) => eng.getNote(id)?.isRest)
      if (!restIds.length) return
      eng.runBatch(`Hide/Show ${restIds.length} rest(s)`, () => {
        for (const id of restIds) eng.toggleRestHidden(id)
      })
      renderer.renderScore()
    },
    selectNextNote: () => {
      // Armed slur point / selected dynamic → fine nudge right instead of navigating.
      if (nudgeArmedSlurPoint(NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedDynamic(NUDGE_FINE_SS, 0)) return
      // A selected BARLINE walks to the next one — same dispatch-on-selection as Shift+Alt+←/→.
      if (selection.navigateBarline(1)) return
      if (state.selectedTool === 'entry') {
        dbg(`[Nav] ArrowRight in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        selection.navigateSelection(1)
      } else {
        selection.navigateSelection(1)
      }
    },
    selectPreviousNote: () => {
      // Armed slur point / selected dynamic → fine nudge left instead of navigating.
      if (nudgeArmedSlurPoint(-NUDGE_FINE_SS, 0)) return
      if (nudgeSelectedDynamic(-NUDGE_FINE_SS, 0)) return
      if (selection.navigateBarline(-1)) return
      if (state.selectedTool === 'entry') {
        dbg(`[Nav] ArrowLeft in entry mode → switching to selection`)
        palette.disarmPositionalTools()
        state.selectedTool = 'selection'
        renderer.renderScore()
      } else {
        selection.navigateSelection(-1)
      }
    },
    // Alt+↑/↓ modally overloads by selection kind: a single measure box → nudge staff spacing
    // by the COARSE step (↑ lifts the staff = less space above = negative delta); otherwise →
    // chord navigation. The two selection states are disjoint (plan §6, the `pitchUp` precedent).
    chordNoteUp: () => { if (nudgeStaffSpacingIfBoxSelected(-STAFF_SPACING_COARSE_SS)) return; selection.navigateChord(1) },
    chordNoteDown: () => { if (nudgeStaffSpacingIfBoxSelected(STAFF_SPACING_COARSE_SS)) return; selection.navigateChord(-1) },
    // Shift+↑/↓ fine staff-spacing (only fires on a single measure box → no fallthrough
    // needed; Shift+Arrow is otherwise unbound).
    staffSpacingFineUp: () => { nudgeStaffSpacingIfBoxSelected(-STAFF_SPACING_FINE_SS) },
    staffSpacingFineDown: () => { nudgeStaffSpacingIfBoxSelected(STAFF_SPACING_FINE_SS) },
    voiceNavUp: () => selection.navigateVoice(1),
    voiceNavDown: () => selection.navigateVoice(-1),
    // Otherwise unbound, so these DECLINE (return false) when nothing single is selected — the key
    // falls through instead of being swallowed by a no-op.
    noteSpacingTighten: () =>
      nudgeSelectedNoteSpacing(-NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(-BAR_WIDTH_STEP_PX),
    noteSpacingWiden: () =>
      nudgeSelectedNoteSpacing(NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(BAR_WIDTH_STEP_PX),
    noteSpacingReset: () => resetSelectedNoteSpacing() || resetSelectedBarWidth(),
    // Vertical arrows: nudge the armed slur endpoint, else the normal pitch/octave edit.
    // (These keys are already bound, so they always consume — the nudge branch returns void
    // via the early return, so preventDefault still fires.)
    pitchUp: () => { if (nudgeArmedSlurPoint(0, -NUDGE_FINE_SS) || nudgeSelectedRest(1) || nudgeSelectedDynamic(0, -NUDGE_FINE_SS)) return; selection.adjustPitch(1) },
    pitchDown: () => { if (nudgeArmedSlurPoint(0, NUDGE_FINE_SS) || nudgeSelectedRest(-1) || nudgeSelectedDynamic(0, NUDGE_FINE_SS)) return; selection.adjustPitch(-1) },
    octaveUp: () => { if (!(nudgeArmedSlurPoint(0, -NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, -NUDGE_COARSE_SS))) selection.adjustOctave(1) },
    octaveDown: () => { if (!(nudgeArmedSlurPoint(0, NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, NUDGE_COARSE_SS))) selection.adjustOctave(-1) },
    // Horizontal COARSE nudge (Ctrl+←/→) is unbound otherwise → DECLINE (return false) when no
    // slur point is armed AND no dynamic is selected, keeping the key free until then.
    nudgeSlurEndpointCoarseLeft: () => nudgeArmedSlurPoint(-NUDGE_COARSE_SS, 0) || nudgeSelectedDynamic(-NUDGE_COARSE_SS, 0),
    nudgeSlurEndpointCoarseRight: () => nudgeArmedSlurPoint(NUDGE_COARSE_SS, 0) || nudgeSelectedDynamic(NUDGE_COARSE_SS, 0),
    undo: () => {
      const eng = getEngine()
      if (eng?.undo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    redo: () => {
      const eng = getEngine()
      if (eng?.redo()) {
        const restoredId = eng.getLastRestoredNoteId()
        const validId = restoredId && eng.getNote(restoredId) ? restoredId : null
        selection.selectNote(validId)
        renderer.renderScore()
      }
    },
    flipStemDirection: () => {
      const eng = getEngine()
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
    // One handler per preset, generated from the SAME table the keys are — see tupletPresets. The M
    // is worked out from the METER where the click lands (armTupletPreset), with the table's own M
    // as the fallback for a meter that has no tuplet of that N. Pressing the armed one disarms it.
    ...Object.fromEntries(
      TUPLET_PRESETS.map(preset => [
        tupletPresetAction(preset),
        () => palette.armTupletPreset(preset.n, preset.m),
      ]),
    ),
    enterNoteA: () => keyboard.enterNoteByLetter('a'),
    enterNoteB: () => keyboard.enterNoteByLetter('b'),
    enterNoteC: () => keyboard.enterNoteByLetter('c'),
    enterNoteD: () => keyboard.enterNoteByLetter('d'),
    enterNoteE: () => keyboard.enterNoteByLetter('e'),
    enterNoteF: () => keyboard.enterNoteByLetter('f'),
    enterNoteG: () => keyboard.enterNoteByLetter('g'),
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
