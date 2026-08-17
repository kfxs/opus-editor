import { dbg } from '@/utils/debug'
import { TUPLET_PRESETS, tupletPresetAction } from '@/utils/tupletPresets'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction } from '@/types/music'
import type { EditorState } from './EditorState'
import { assertNeverElement, selectedOf } from './EditorState'
import type { SelectionController } from './SelectionController'
import type { PaletteController } from './PaletteController'
import type { KeyboardController } from './KeyboardController'
import type { RenderController } from './RenderController'
import type { ClipboardController } from './ClipboardController'
import type { ViewportHost } from './ViewportHost'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'
import { selectedArticulationNoteIds } from './selection'
import { flipSelection } from './flipSelection'
import { reanchorArmedSlurEndpoint } from './slurReanchor'
import { windows } from '../windows'
import { openClefWindow } from '../windows/clefWindow'
import { toggleSymbolsWindow } from '../windows/symbols'
import { openTimeSignatureWindow } from '../windows/timeSignatureWindow'
import { openFeatherWindow } from '../windows/featherWindow'
import { openTupletWindow } from '../windows/tupletWindow'
import { keypadCellForCode } from '../windows/keypad/keypadLayouts'
import { pressKeypadCell } from '../windows/keypad/keypadPress'
import { keypadPageSelection } from '../windows/keypad/keypadPageSelection'

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
  /** Start playback, or stop it if it is running — the SAME toggle the dev shell's ▶ button runs
   *  (`App.togglePlayback`), so one gesture cannot drift from the other. */
  togglePlayback: () => void,
): { enable: () => void; disable: () => void; run: (action: string) => void } {
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

  // Barline-gap step (staff-spaces). The same quarter-space as the note-spacing nudge, because it
  // is the same quantity at a different address — and because Shift+arrows are the FINE chord here.
  const BARLINE_GAP_STEP_SS = 0.25

  // Nudge the armed slur endpoint by a staff-space delta (screen-down is +y, so "up arrow
  // lifts the point" passes a negative dy). Returns true when it consumed the key (an
  // endpoint was armed), false to DECLINE so the key falls through to its normal action.
  const nudgeArmedEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur?.endpoint) return false
    eng.nudgeSlurEndpoint(slur.id, slur.endpoint, dx, dy)
    renderer.renderScore()
    return true
  }

  // Same, but for an armed OPEN join (orange square) of a cross-system slur. Passes the
  // captured spanCount as the override's reset signature. See
  // docs/multisystem-slur-segment-endpoint-offset-plan.md.
  const nudgeArmedSegmentEndpoint = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const slur = selectedOf(state, 'slur')
    if (!eng || !slur?.segmentEndpoint) return false
    eng.nudgeSlurSegmentEndpoint(slur.id, slur.segmentEndpoint, dx, dy, slur.segmentSpanCount ?? 0)
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+←/→ on an armed TRUE endpoint: walk the anchor one note, instead of nudging it by
  // pixels. The module owns every reason it can decline (no armed end, off the lane, at the other
  // end); this just repaints on a yes. See `slurReanchor`.
  const reanchorArmedEndpoint = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    if (!eng || !reanchorArmedSlurEndpoint(state, eng, direction)) return false
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
    const dynamicId = selectedOf(state, 'dynamic')?.id
    if (!eng || !dynamicId) return false
    if (!eng.nudgeDynamicOffset(dynamicId, dx, dy)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+←/→ (wide) / Shift+Alt+←/→ (fine) on a SINGLE selected note or rest = nudge its
  // horizontal offset by a staff-space delta (+right), an OFFSET off its natural column (NOT
  // spacing — the bar keeps its width). Rides the deliberate chords, not the easy key: a note's
  // plain ←/→ is navigation and the easy Ctrl+←/→ is the MOVE (spacing/bar width). Returns true
  // when it consumed the key, false to DECLINE so it falls through. One undo per press. The engine
  // keys the override by SLOT, so a chord (and a rest) moves as a unit. See docs/note-offset-plan.md §C.
  const nudgeSelectedNoteOffset = (dx: number): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    if (!eng.nudgeNoteOffset(item.id, dx)) return false
    renderer.renderScore()
    return true
  }

  // Ctrl+Shift+Backspace / Shift+Alt+Backspace on a SINGLE selected note/rest = reset it to its
  // natural column outright (drop the offset entry, the first-class reset every override client gets
  // — not a walk back to 0). DECLINEs (false) when there is nothing to reset, keeping the key free.
  const resetSelectedNoteOffset = (): boolean => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return false
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return false
    if (!eng.resetNoteOffset(item.id)) return false
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
    const box = selectedOf(state, 'measureRange')
    if (!eng || !box || box.boxStyle !== 'single') return false
    // Per-system (plan option C): the tweak targets the system the selected bar sits on.
    if (!eng.nudgeStaffSpacing(box.staff, box.anchor, delta)) return false
    renderer.renderScore()
    return true
  }

  // Shift+Alt+←/→ on a SINGLE selected note or rest = change the space allocated BEFORE its column
  // (Sibelius note spacing). Unlike every other nudge wired here this one has WIDTH: the bar grows
  // or shrinks and everything right of the column slides, so it re-runs the casting-off rather than
  // just repainting. The engine DECLINES (null) when it cannot measure how far left the column may
  // go — an unrendered bar has no gaps to read — and we decline with it rather than guessing.
  // One undo per press. See docs/note-spacing-plan.md §5.
  // ⭐ The address comes from `spacingColumnOf`, NOT from `getNote().beat`: a fanned member's flat
  // note carries the SLOT's beat, so reading it there spaced the whole fan whichever member was
  // selected (docs/note-spacing-plan.md §7). The id travels with the column so the engine can floor
  // a member's nudge against the head behind it.
  const selectedColumn = (): { measure: number; beat: Fraction; noteId: string } | null => {
    const eng = getEngine()
    if (!eng || state.selectedItems.size !== 1) return null
    const item = [...state.selectedItems.values()][0]
    if (item.kind !== 'note') return null
    const column = eng.spacingColumnOf(item.id)
    return column ? { measure: column.measure, beat: column.beat, noteId: item.id } : null
  }

  const nudgeSelectedNoteSpacing = (delta: number): boolean => {
    const eng = getEngine()
    const column = selectedColumn()
    if (!eng || !column) return false
    if (eng.nudgeNoteSpacing(column.measure, column.beat, delta, column.noteId) === null) return false
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
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarWidth(measure, deltaPx) === null) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Lengthen / shorten the selected hairpin by one SLOT** — Sibelius spells this Space; we
   * already have the gesture, since `Ctrl+←/→` is one action routed by what is selected.
   *
   * ⚠️ **On a hairpin this key writes the MODEL, where one branch over (a slur endpoint, a dynamic)
   * it writes a cosmetic override.** That is not an inconsistency to tidy away — it is §4's rule:
   * a hairpin's EXTENT is musical (it says which notes get louder) and its height is not. Letting
   * this write an offset instead would give us two ways to say "three beats long" that can
   * disagree, with playback believing the one the eye does not. It follows that `Ctrl+Backspace`
   * (`resetMove`) does NOT apply to a hairpin: nothing cosmetic was written, so there is nothing to
   * reset.
   *
   * ⭐ **By a SLOT, not by a fixed fraction.** The step is the duration of the note the wedge
   * currently ends on (growing) or the one it would end on after shrinking — so the end always
   * lands on a notehead, which is the only place a wedge can honestly stop. A fixed step of, say,
   * a quarter would leave the end mid-triplet.
   *
   * DECLINEs (false) when no hairpin is selected, or when the edit would make the wedge non-positive
   * — `setHairpinLength` refuses that rather than deleting the thing being shortened.
   */
  const resizeSelectedHairpin = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const id = selectedOf(state, 'hairpin')?.id
    if (!eng || !id) return false
    if (!eng.resizeHairpinBySlot(id, direction)) return false
    renderer.renderScore()
    return true
  }

  /**
   * ⭐ **Move a selected pedal's LIFT by one slot** — `resizeSelectedHairpin`'s twin, and it is a
   * separate branch rather than a shared one because the two step through different lanes: a wedge
   * walks its own VOICE, a pedal walks its whole STAFF (one damper — `pedalOps.resizePedalBySlot`).
   *
   * ⚠️ It writes the MODEL, like the hairpin's and for a sharper reason: how long the damper is down
   * is what the notes SOUND (docs/pedal-plan.md §9), so a cosmetic offset would leave playback
   * believing a lift the eye does not see. `Ctrl+Backspace` therefore has nothing to reset here.
   *
   * DECLINEs (false) when no pedal is selected, or when the edit would leave it holding no music —
   * `setPedalLength` refuses that rather than deleting the thing being shortened.
   */
  const resizeSelectedPedal = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const id = selectedOf(state, 'pedal')?.id
    if (!eng || !id) return false
    if (!eng.resizePedalBySlot(id, direction)) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarWidth = (): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (!eng.resetBarWidth(measure)) return false
    renderer.renderScore()
    return true
  }

  /**
   * The BARLINE GAP — the space between the bar's last element and the line that ends it.
   *
   * The third thing you can do to a selected barline, and deliberately the smallest: bar width
   * (Ctrl+←/→) re-spaces the bar's whole music, this moves the line alone and leaves every note
   * where it was. It rides Shift+←/→ because Shift+↑/↓ is already the fine staff-spacing nudge.
   *
   * DECLINEs (false) when no barline is selected, so the key falls through, and when the engine
   * cannot measure the floor from the last render — the same "I don't know" contract as every
   * other measured gesture.
   */
  const nudgeSelectedBarlineGap = (deltaSs: number): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarlineSpace(measure, deltaSs) === null) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarlineGap = (): boolean => {
    const eng = getEngine()
    const measure = selectedOf(state, 'barline')?.measure
    if (!eng || measure === undefined) return false
    if (!eng.resetBarlineSpace(measure)) return false
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
    togglePlayback: () => togglePlayback(),
    setActiveVoice1: () => palette.setActiveVoice(1),
    setActiveVoice2: () => palette.setActiveVoice(2),
    setActiveVoice3: () => palette.setActiveVoice(3),
    setActiveVoice4: () => palette.setActiveVoice(4),
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
    // U — the same action as Insert ▸ Tuplet; reaches the window layer directly, like Q and T.
    openTupletWindow: () => {
      openTupletWindow(windows)
    },
    // Ctrl+F — the same action as Insert ▸ Feathered Beam; reaches the window layer directly, like Q.
    openFeatherWindow: () => {
      openFeatherWindow(windows)
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
      // ⭐ Esc STOPS PLAYBACK, before anything else it might mean. It is the universal "stop what
      // is happening" key, and while music is playing that is what is happening — `p` toggles, but
      // reaching for Escape is the reflex. Nothing is lost by taking the key here: starting
      // playback clears the selection (`App.togglePlayback`), so there is nothing left for Esc's
      // other duties to clear, and a second press does them anyway.
      if (state.playbackState === 'playing') {
        togglePlayback() // toggling WHILE PLAYING is a stop — one seam, so the two cannot drift
        return
      }
      // Esc then cancels a pending (armed) paste, if any.
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
      // …and drops the accent/staccato/tenuto armed for the next note: that note is not coming, and
      // an articulation left armed would ride the next note entered in some later session. The
      // duration and accidental DO carry over — see clearArmedArticulations for why they differ.
      palette.clearArmedArticulations()
      // Esc returns entry to the default voice 1 / staff 0 (Sibelius-style); the
      // selection-mode branch resets them via deselectAll() below, entry needs it explicitly.
      state.activeVoice = 1
      state.activeStaff = 0
      if (state.selectedTool === 'entry') {
        // Entry → selection: keep the cursor note as the selected note.
        state.selectedTool = 'selection'
        selection.selectNote(state.selectedNoteId)
      } else {
        // Already in selection mode: Esc clears the whole current selection — the notes AND
        // the one selected element (dynamic, clef, tie, slur, accidental, tuplet, meter, …).
        selection.deselectAll()
      }
      renderer.renderScore()
    },
    deleteSelected: () => {
      const eng = getEngine()
      if (!eng) return
      const element = state.selectedElement

      // ⭐ A `switch` over the ONE selected element, not a chain of `else if`s over a dozen
      // independent fields. The chain's ORDER used to be load-bearing (several could be set at
      // once, so the first match won); with one field they are mutually exclusive by construction,
      // and `assertNeverElement` makes a fifteenth kind impossible to add without deciding what
      // Delete does to it — which is the one thing you must not forget for a selectable element.
      if (element) {
        switch (element.kind) {
          case 'measureRange': {
            const { anchor, focus, staff, boxStyle } = element
            if (boxStyle === 'double') {
              // A measure span is box-selected via Ctrl+Shift+click (the DOUBLE box, extendable) —
              // Delete removes every WHOLE bar in the span and its contents (Sibelius-style),
              // pulling later bars back and renumbering, all as one undo step. Removing the actual
              // bar is reserved for this gesture; the plain-click box only clears content (below).
              const removed = eng.removeMeasureRange(anchor, focus)
              dbg(`✓ Removed ${removed} measure(s) in span ${Math.min(anchor, focus)}–${Math.max(anchor, focus)}`)
              state.selectedElement = null
            } else {
              // A single bar is plain-click-selected (the SINGLE box) — Delete CLEARS its content
              // rather than removing the bar: the clicked staff's notes/rests reset to the default
              // rest fill (one measure rest, not a per-gap recompute) and the dynamics/slurs the box
              // pulled in are removed, all as ONE undo step (runBatch coalesces).
              const measure = anchor // single box: anchor === focus
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
            }
            renderer.renderScore()
            return
          }
          case 'articulation': {
            // Group selection: Delete removes every articulation on every selected note,
            // as ONE undoable action (a single Ctrl-Z restores them all). The SET is authoritative
            // (Ctrl-click adds groups); the element is its anchor, and the fallback for safety.
            const ids = selectedArticulationNoteIds(state.selectedItems.values())
            const artNoteIds = ids.length ? ids : [element.noteId]
            eng.runBatch(`Clear articulations on ${artNoteIds.length} note(s)`, () => {
              for (const noteId of artNoteIds) eng.clearArticulations(noteId)
            })
            selection.selectNote(null)
            renderer.renderScore()
            return
          }
          case 'accidental': {
            const noteId = element.noteId
            // Remove the accidental by reverting the note to the measure's prevailing
            // alteration, then clearing any forced sign. This makes the glyph disappear in
            // every case: a lone sharp/flat → natural (prevailing 0); a required natural
            // (♮ cancelling an earlier sharp) → back to that sharp (prevailing ±1).
            eng.updateNote(noteId, { alter: eng.getPrevailingAlter(noteId), forceAccidental: undefined })
            state.selectedElement = null
            selection.selectNote(noteId)
            renderer.renderScore()
            return
          }
          case 'dot': {
            // Removes ALL of the slot's dots at once (`dots` is one value on the chord/rest),
            // including both of a double dot — there is no half-undotting. Keeps the note selected
            // to keep editing, like the accidental above.
            const noteId = element.noteId
            eng.updateNote(noteId, { dots: 0 })
            state.selectedElement = null
            selection.selectNote(noteId)
            renderer.renderScore()
            return
          }
          case 'tremolo': {
            // The whole mark goes, whatever it was: a tremolo is ONE value on the slot, so there is
            // no "remove a stroke" here — that is a different edit (change the mark), and it belongs
            // to the palette/Keypad rather than to Delete. Keeps the note selected afterwards, like
            // the accidental and the dot above, so the obvious next thing (stamp a different mark)
            // is one press away. Until this landed, a stamped tremolo could only be taken off with
            // Ctrl+Z (docs/tremolo-plan.md §2).
            const noteId = element.noteId
            eng.setTremolo(noteId, null)
            state.selectedElement = null
            selection.selectNote(noteId)
            dbg(`✓ Tremolo removed | noteId:${noteId}`)
            renderer.renderScore()
            return
          }
          case 'tie':
            eng.toggleTie(element.fromNoteId)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'slur':
            eng.removeSlur(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'hairpin':
            // The wedge only — never the notes it spans, the slur's rule exactly.
            eng.removeHairpin(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'trill':
            // The ornament only — never the notes it covers, the hairpin's rule exactly.
            eng.removeTrill(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'ottava':
            // The bracket only — never the notes it governs. ⚠️ Deleting it CHANGES WHAT THEY
            // SOUND (the written pitch stays, so the passage drops back an octave), which is the
            // one Delete here whose audible effect is bigger than its visible one. That is the
            // whole point of storing written pitch, not a surprise to guard against.
            eng.removeOttava(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'pedal':
            // The pedal only — never the notes it holds. ⚠️ Like the ottava above, deleting it
            // CHANGES WHAT THEY SOUND: the notes stop ringing to the lift and fall back to their own
            // written lengths (docs/pedal-plan.md §9). Visible and audible, and both intended.
            eng.removePedal(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'tuplet':
            eng.deleteTuplet(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'clef': {
            const removed = eng.removeClefAt(element.measure, beatToFrac(element.beat), element.staff)
            if (!removed) {
              dbg(`Cannot remove clef at measure ${element.measure} beat ${element.beat} (measure 1 opening clef can only be changed)`)
            }
            state.selectedElement = null
            renderer.renderScore()
            return
          }
          case 'timeSignature': {
            const measureNum = element.measure
            if (measureNum === 1) {
              // Measure 1 carries the score's default meter and can't be removed — hide
              // the glyph instead (the 4/4 meter / bar sizing is kept).
              eng.setTimeSignatureHidden(measureNum, true)
            } else {
              // A mid-score change: revert this region to the prior meter and rebar.
              eng.removeTimeSignatureChange(measureNum)
            }
            state.selectedElement = null
            renderer.renderScore()
            return
          }
          case 'dynamic':
            eng.removeDynamic(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'tempo':
            // Removing the mark reverts the score to the previous mark's tempo (or
            // DEFAULT_TEMPO if it was the only one) — there is no global to fall back to.
            eng.removeTempoMark(element.id)
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'barline':
          case 'stem':
            // Nothing to delete. A barline is a BOUNDARY, not an object — the measures array is the
            // spine, so "delete this barline" would mean merging two bars, a different edit. A stem
            // is a property every non-rest note has; removing it is not a thing you can do to a
            // note. Both are selectable so they can be nudged/dragged, and Delete declines rather
            // than falling through to something else's meaning.
            return
          default:
            assertNeverElement(element)
        }
      }

      if (state.selectedItems.size > 0) {
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
    // EVERY numpad key, through one handler — the pad IS the Keypad panel, so a key press is the
    // press of the cell it sits under ON THE PAGE THAT IS SHOWING, and it runs the same
    // `pressKeypadCell` a click on that cell runs. The panel does not have to be open: the page lives
    // on its own seam, and the presses go out through the palette stores either way.
    //
    // The `code` is the only thing the handler needs, which is why this action serves 16 keys: the
    // meaning is the LAYOUT's to know, never this table's. A code the pad doesn't define declines
    // (`false`), leaving the key to the browser.
    keypadKey: (event) => {
      // No event = invoked from a menu (`ShortcutManager.run`), which cannot name a cell. Decline:
      // this action's whole input IS the key code.
      if (!event) return false
      const cell = keypadCellForCode(keypadPageSelection.get(), event.code)
      if (!cell) return false
      pressKeypadCell(cell)
    },
    // Straight to a NAMED Keypad page, rather than stepping the `+` ring to reach it. The seam is
    // the same one the panel and the numpad read, so the pad follows whether or not it is open.
    keypadNoteEntryPage: () => keypadPageSelection.set('noteEntry'),
    createSlur: () => palette.createSlur(),
    createCrescendo: () => palette.createCrescendo(),
    createDiminuendo: () => palette.createDiminuendo(),
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
    // Shift+←/→ = the barline gap, the fine horizontal partner of Shift+↑/↓ above.
    barlineGapTighten: () => { nudgeSelectedBarlineGap(-BARLINE_GAP_STEP_SS) },
    barlineGapWiden: () => { nudgeSelectedBarlineGap(BARLINE_GAP_STEP_SS) },
    resetBarlineGap: () => { resetSelectedBarlineGap() },
    voiceNavUp: () => selection.navigateVoice(1),
    voiceNavDown: () => selection.navigateVoice(-1),
    // Vertical arrows: nudge the armed slur endpoint, else the normal pitch/octave edit.
    // (These keys are already bound, so they always consume — the nudge branch returns void
    // via the early return, so preventDefault still fires.)
    pitchUp: () => { if (nudgeArmedSlurPoint(0, -NUDGE_FINE_SS) || nudgeSelectedRest(1) || nudgeSelectedDynamic(0, -NUDGE_FINE_SS)) return; selection.adjustPitch(1) },
    pitchDown: () => { if (nudgeArmedSlurPoint(0, NUDGE_FINE_SS) || nudgeSelectedRest(-1) || nudgeSelectedDynamic(0, NUDGE_FINE_SS)) return; selection.adjustPitch(-1) },
    octaveUp: () => { if (!(nudgeArmedSlurPoint(0, -NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, -NUDGE_COARSE_SS))) selection.adjustOctave(1) },
    octaveDown: () => { if (!(nudgeArmedSlurPoint(0, NUDGE_COARSE_SS) || nudgeSelectedDynamic(0, NUDGE_COARSE_SS))) selection.adjustOctave(-1) },
    // ── Ctrl+←/→ = MOVE: change the space before a selected note's column, or a selected barline's
    //    bar width — "move a lot" gets the easy key (docs/note-offset-plan.md §C swap). Joins the
    //    slur-endpoint / dynamic COARSE nudge that already owned Ctrl+←/→ (all selections disjoint).
    //    Left = tighten/narrow, right = widen. DECLINEs (false) when nothing applicable is selected,
    //    keeping the key free. One undo per press.
    //    ⚠️ A selected HAIRPIN joins this chain, and it is the one branch that writes the MODEL
    //    rather than an override — see `resizeSelectedHairpin` for why that is the rule and not a
    //    slip. All the selections remain disjoint, so it is one more branch and no reordering.
    //    ⭐ A selected PEDAL joins it beside the hairpin, on the same terms and for a stronger
    //    version of the same reason: its extent is how long the notes RING (`resizeSelectedPedal`).
    ctrlArrowLeft: () =>
      nudgeArmedSlurPoint(-NUDGE_COARSE_SS, 0) || nudgeSelectedDynamic(-NUDGE_COARSE_SS, 0)
      || resizeSelectedHairpin(-1) || resizeSelectedPedal(-1)
      || nudgeSelectedNoteSpacing(-NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(-BAR_WIDTH_STEP_PX),
    ctrlArrowRight: () =>
      nudgeArmedSlurPoint(NUDGE_COARSE_SS, 0) || nudgeSelectedDynamic(NUDGE_COARSE_SS, 0)
      || resizeSelectedHairpin(1) || resizeSelectedPedal(1)
      || nudgeSelectedNoteSpacing(NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(BAR_WIDTH_STEP_PX),
    // Ctrl+Backspace = reset the MOVE (the space before the note / the bar's width).
    resetMove: () => resetSelectedNoteSpacing() || resetSelectedBarWidth(),

    // ── Note OFFSET (the small, deliberate nudge off the natural column) rides the harder chords:
    //    Ctrl+Shift+←/→ = WIDE (1 space), Shift+Alt+←/→ = FINE (¼ space). "Should not offset that
    //    much" → the deliberate chords, not the easy key. Each DECLINEs when no single note/rest is
    //    selected. See docs/note-offset-plan.md §C.
    //    ⭐ An armed slur ENDPOINT gets the chord first: it re-anchors one note left/right instead
    //    (Ctrl+←/→ already nudges that point by pixels, so Shift on the same axis means "move the
    //    anchor" — see `slurReanchor`). Disjoint from the offset, which needs a selected NOTE.
    ctrlShiftArrowLeft: () => reanchorArmedEndpoint(-1) || nudgeSelectedNoteOffset(-NUDGE_COARSE_SS),
    ctrlShiftArrowRight: () => reanchorArmedEndpoint(1) || nudgeSelectedNoteOffset(NUDGE_COARSE_SS),
    nudgeNoteOffsetFineLeft: () => nudgeSelectedNoteOffset(-NUDGE_FINE_SS),
    nudgeNoteOffsetFineRight: () => nudgeSelectedNoteOffset(NUDGE_FINE_SS),
    // Ctrl+Shift+Backspace AND Shift+Alt+Backspace both reset the offset — it is one value, and each
    // of its two arrow-chords gets a matching backspace. DECLINEs when nothing to reset.
    resetNoteOffset: () => resetSelectedNoteOffset(),
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
    // `x` = turn the selected thing around. WHICH thing, and what "around" means for it, is
    // `interactions/flipSelection.ts`'s table — it used to be a six-branch chain here, and the
    // octave line would have made it seven. ⚠️ The repaint is conditional: a decline means the key
    // did nothing, and rendering to show no change is the reflex to avoid.
    flipStemDirection: () => {
      const eng = getEngine()
      if (eng && flipSelection(state, eng)) renderer.renderScore()
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
    // A MENU ROW runs its command through here — the same handler the accelerator runs, never a
    // copy of it. See `ShortcutManager.run`.
    run: (action: string) => shortcutManager.run(action),
  }
}
