import { dbg } from '@/utils/debug'
import { TUPLET_PRESETS, tupletPresetAction } from '@/utils/tupletPresets'
import type { MusicEngine } from '../engine/MusicEngine'
import { ELEMENT_SPECS } from './elements/chain'
import type { KeysCtx } from './elements/keys'
import type { Fraction } from '@/types/music'
import type { EditorState } from './EditorState'
import { assertNeverElement, selectedOf } from './EditorState'
import { keySignatureStavesAt } from './keySignatureScope'
import type { SelectionController } from './SelectionController'
import type { PaletteController } from './PaletteController'
import type { KeyboardController } from './KeyboardController'
import type { RenderController } from './RenderController'
import type { ClipboardController } from './ClipboardController'
import type { ViewportHost } from './ViewportHost'
import { ShortcutManager } from '../shortcuts'
import { beatToFrac } from '../utils/musicUtils'
import { selectedArticulationNoteIds } from './selection'
import { markItems, marksLabel, removeMarks } from './enclosedMarks'
import { passageOf, spansStaves } from './measurePassage'
import { flipSelection } from './flipSelection'
import { repeatSelectedPassage } from './repeatPassage'
import { nudgeArmedHairpinMouth, resetArmedHairpinMouth } from './elements/hairpinHandles'
import { keyRunTick } from './keyRun'
import type { MarkPreviewKind } from '../engine/rendering/markPreviewPass'
import { windows } from '../windows'
import { openClefWindow } from '../windows/clefWindow'
import { openKeySignatureWindow } from '../windows/keySignatureWindow'
import { openLinesWindow } from '../windows/lines'
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

  // ⭐ Hairpin MOUTH step (staff-spaces). Small on purpose: the whole authorable range is about one
  // space wide (`authoredApertureRange`), so a quarter-space step would offer four stops in it. The
  // Properties input uses the same number.
  const MOUTH_STEP_SS = 0.05

  /**
   * ⭐⭐ **AFTER AN ACCEPTED ARROW ON A MARK — a WALK is a RUN, anything else renders.** His rule,
   * 2026-08-30: *"we should apply the same solution of the held to all walkings — pedal, ottava,
   * hairpin, dynamics and tempo"*, after the trill's held key was measured at ~50 ms a press
   * against a ~33 ms repeat (`./keyRun` carries the numbers).
   *
   * ⭐ The horizontal walk previews and settles once — ONE undo entry, ONE real render. ⛔ The
   * VERTICAL is not a run: it still writes an entry per press and renders for real, because it goes
   * through different ops (`nudgeWhole` / `nudgeEnd`) that have no preview twin on this path.
   */
  const afterMarkPress = (
    kind: MarkPreviewKind,
    id: string,
    dx: number,
    dy: number,
    commit: () => void,
  ): void => {
    if (dy !== 0 || dx === 0) {
      renderer.renderScore()
      return
    }
    keyRunTick({
      key: `${kind}:${id}`,
      commit,
      preview: () => renderer.previewMarks(kind, id),
      render: () => renderer.renderScore(),
    })
  }

  /**
   * ⭐⭐ **THE ARROWS ASK THE SELECTED ELEMENT'S OWN ROW** (`elements/keys`, the `keys` column of
   * `ELEMENT_SPECS`). ⛔ No per-kind closure and no `||` link per kind here: a kind that answers the
   * arrows says so in `elements/<kind>Keys`. DECLINEs when nothing is selected, or the kind has no
   * answer — and then the key carries on down whatever is left of its chain.
   */
  const keysCtx = (engine: MusicEngine): KeysCtx =>
    ({ engine, state, render: () => renderer.renderScore(), afterMarkPress })
  const nudgeSelectedElement = (dx: number, dy: number): boolean => {
    const eng = getEngine()
    const element = state.selectedElement
    if (!eng || !element) return false
    return ELEMENT_SPECS[element.kind].keys?.nudge?.(keysCtx(eng), element, dx, dy) ?? false
  }
  const resetSelectedElement = (): boolean => {
    const eng = getEngine()
    const element = state.selectedElement
    if (!eng || !element) return false
    return ELEMENT_SPECS[element.kind].keys?.reset?.(keysCtx(eng), element) ?? false
  }
  const reanchorSelectedElement = (direction: 1 | -1): boolean => {
    const eng = getEngine()
    const element = state.selectedElement
    if (!eng || !element) return false
    return ELEMENT_SPECS[element.kind].keys?.reanchor?.(keysCtx(eng), element, direction) ?? false
  }
  const cycleSelectedElement = (step: 1 | -1): boolean => {
    const eng = getEngine()
    const element = state.selectedElement
    if (!eng || !element) return false
    return ELEMENT_SPECS[element.kind].keys?.cycle?.(keysCtx(eng), element, step) ?? false
  }

  /**
   * ⭐⭐ **Shift+↑/↓ opens and closes the MOUTH** of the selected wedge, with its mouth-bearing square
   * armed — the right-hand one on a crescendo, the left on a diminuendo (his ask, 2026-08-17).
   * `Shift+Backspace` puts it back to automatic, the matching backspace every arrow-chord here has.
   *
   * ⚠️ It rode `Shift+←/→` for an hour first, on an argument about the mouth being a symmetric spread
   * that no vertical direction describes. He tried it: *"i test it and is not intuitive, lets try
   * arrow up down instead"* — and in the hand ↑ = wider is immediate, because what you are reaching
   * for is the ARM, not the pair. The reasoning was sound and the hand still won; see
   * `elements/hairpinHandles`.
   *
   * ⭐ Disjoint on both keys: `Shift+↑/↓`'s other tenant is the fine STAFF-SPACING nudge, which needs a
   * selected measure box, and `Shift+Backspace`'s is the barline gap, which needs a selected barline.
   * The module owns every reason this can decline.
   */
  const nudgeArmedMouth = (delta: number): boolean => {
    const eng = getEngine()
    if (!eng || !nudgeArmedHairpinMouth(state, eng, delta)) return false
    renderer.renderScore()
    return true
  }

  const resetArmedMouth = (): boolean => {
    const eng = getEngine()
    if (!eng || !resetArmedHairpinMouth(state, eng)) return false
    renderer.renderScore()
    return true
  }

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
  /**
   * ⭐⭐ **THE BAR THE SELECTED LINE ENDS** — the one address the four width/gap gestures below share,
   * resolved from EITHER barline selection.
   *
   * A `barline` selection already IS that measure. ⭐ A `repeatStart` selection names the same line
   * from the other side: the `|:` opening bar *M* stands on the line that ends bar *M−1*. Both
   * gestures act on the line, not on the sign drawn on it, so both selections must reach them —
   * otherwise clicking the special barline (which since 2026-08-26 selects the SIGN, `ELEMENT_HIT_ORDER`)
   * would silently cost you the width nudge you had a moment ago.
   *
   * ⛔ Null for the `|:` that opens bar 1: there is no bar 0, so that sign stands on no line — which
   * is the same "I don't know" the engine answers with for a line no render can measure.
   */
  const selectedBoundaryMeasure = (): number | undefined => {
    const line = selectedOf(state, 'barline')
    if (line) return line.measure
    const openRepeat = selectedOf(state, 'repeatStart')
    if (openRepeat && openRepeat.measure > 1) return openRepeat.measure - 1
    return undefined
  }

  const nudgeSelectedBarWidth = (deltaPx: number): boolean => {
    const eng = getEngine()
    const measure = selectedBoundaryMeasure()
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarWidth(measure, deltaPx) === null) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarWidth = (): boolean => {
    const eng = getEngine()
    const measure = selectedBoundaryMeasure()
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
    const measure = selectedBoundaryMeasure()
    if (!eng || measure === undefined) return false
    if (eng.nudgeBarlineSpace(measure, deltaSs) === null) return false
    renderer.renderScore()
    return true
  }

  const resetSelectedBarlineGap = (): boolean => {
    const eng = getEngine()
    const measure = selectedBoundaryMeasure()
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
    // ⭐ Alt+5 — the MARK half alone: `'all'` returns before touching the entry voice, so this key
    // is inert unless a dynamic or a hairpin is selected (`interactions/markVoiceScope`).
    setMarkScopeAllVoices: () => palette.setActiveVoice('all'),
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
    // L — the same action as Insert ▸ Lines; reaches the window layer directly, like Q.
    openLinesWindow: () => {
      openLinesWindow(windows)
    },
    // K — the same action as Insert ▸ Key Signature; reaches the window layer directly, like Q.
    openKeySignatureWindow: () => {
      openKeySignatureWindow(windows)
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
            const { anchor, focus, staff, focusStaff, boxStyle } = element
            if (boxStyle === 'double') {
              // A measure span is box-selected via Ctrl+Shift+click (the DOUBLE box, extendable) —
              // Delete removes every WHOLE bar in the span and its contents (Sibelius-style),
              // pulling later bars back and renumbering, all as one undo step. Removing the actual
              // bar is reserved for this gesture; the plain-click box only clears content (below).
              const removed = eng.removeMeasureRange(anchor, focus)
              dbg(`✓ Removed ${removed} measure(s) in span ${Math.min(anchor, focus)}–${Math.max(anchor, focus)}`)
              state.selectedElement = null
            } else {
              // The SINGLE box is plain-click-selected and shift-extendable — Delete CLEARS its
              // content rather than removing the bar: every cell's notes/rests reset to the default
              // rest fill (one measure rest, not a per-gap recompute) and the dynamics/slurs the box
              // pulled in are removed, all as ONE undo step (runBatch coalesces).
              //
              // 🚨 **HIS REPORT, 2026-08-30**: a bar selected on BOTH staves cleared only the
              // first. The box is a PASSAGE — bars × staves (`./measurePassage`) — and this read
              // `anchor` and `staff` alone, i.e. the anchor CELL of a rectangle. The highlight had
              // already grown to the rectangle, so Delete was taking less than the box promised
              // ([[project_passage_selection_marks]]). ⛔ Not `anchor === focus`: the shift
              // extension moves BOTH axes, so the run of bars is as real as the run of staves.
              const passage = passageOf({ anchor, focus, staff, focusStaff })
              // ⭐ Every mark the box dragged in goes with it — the dynamics and slurs it always
              // took, and (2026-08-19) the four SPANS it now also highlights. Delete takes what the
              // highlight showed, or the highlight is a promise the editor does not keep.
              const marks = markItems(state.selectedItems.values())
              const bars = `${passage.fromMeasure}${passage.toMeasure > passage.fromMeasure ? `–${passage.toMeasure}` : ''}`
              eng.runBatch(`Clear measure ${bars}`, () => {
                for (let m = passage.fromMeasure; m <= passage.toMeasure; m++) {
                  for (let s = passage.fromStaff; s <= passage.toStaff; s++) eng.clearMeasureStaff(m, s)
                }
                removeMarks(eng, marks)
              })
              dbg(
                `✓ Cleared measures ${bars} (staves ${passage.fromStaff}–${passage.toStaff}` +
                `${spansStaves(passage) ? ', multi-staff' : ''}) to default rest`,
              )
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
          case 'keySignature': {
            // ⭐⭐ **BACK TO THE KEY THE BAR BEFORE IT WAS IN** — the only thing "delete" can mean for
            // a signature: every bar is in SOME key, so removing the change at this bar reverts it
            // (and the bars after it, until the next change) to the inherited one. `keyOps.removeKeyAt`
            // is the write, and it does not touch its neighbours — propagation is a WALK, never a
            // rewrite (docs/key-signature-plan.md §5.1).
            //
            // ⭐ **Measure 1 is NOT refused** — his report, 2026-08-28: *"here i remove the key but
            // nothing hapend i still see the key on screen."* The guard that swallowed it was
            // MuseScore's, and `keyOps.removeKeyAt` says why their reason does not transfer: our
            // `mode` field tells C major from open/atonal, so a bar-1 removal means C major, full stop.
            //
            // ⭐⭐ **EVERY STAFF THE HIGHLIGHT LIT — his report, 2026-08-28:** *"and if i remove i
            // remove the first stave only."* The scope is one function, shared with the highlight
            // (`./keySignatureScope`), which is what makes the lit ink a promise rather than a
            // coincidence: a key placed on all staves is ONE statement, so Delete takes it all back;
            // two staves in genuinely different keys are two statements and are deleted separately.
            //
            // ⭐ ONE undo for the whole gesture, for `applyKeySignature`'s reason: you deleted one
            // signature, and taking that back must not cost one Ctrl+Z per staff.
            const staves = keySignatureStavesAt(eng, element.measure, element.staff)
            let removed = false
            eng.runBatch(`Remove key signature at measure ${element.measure}`, () => {
              for (const staff of staves) removed = eng.removeKeyAt(element.measure, staff) || removed
            })
            if (!removed) {
              dbg(`Cannot remove key signature at measure ${element.measure} staves [${staves.join(',')}]`
                + ' (nothing stored here — this bar reprints the key it inherited)')
            }
            // Cleared like the `|:` and unlike the barline: this selection names INK, and where the
            // removal succeeded the ink is no longer on the page.
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
            // ⭐⭐ **BACK TO A PLAIN LINE** — his, 2026-08-26: *"delete key should remove special
            // barline and turn it into a normal barline"*. `barlineOps.clearBarline` drops the SIGN
            // standing at this boundary (a final bar's style, an end repeat), never the boundary:
            // the measures array is the barline spine, so a bar always ends in a line and "delete"
            // can only mean the STATEMENT drawn on it (docs/barline-types-plan.md §8 P5).
            //
            // ⚠️ This overturns the non-behaviour that stood here until P5, and the reasoning it
            // replaces was right about the identity and wrong about the consequence: a barline IS a
            // boundary with no object behind it — and since P1 that boundary can carry a statement,
            // which is a thing to delete. ⛔ It still never merges two bars.
            //
            // ⛔ And it does NOT touch the `|:` that may be standing at the same line: that sign
            // belongs to the bar it OPENS and is its own selection (`repeatStart` below), which is
            // the whole point of being able to pick the half you clicked.
            eng.clearBarline(element.measure)
            renderer.renderScore()
            return
          case 'repeatStart':
            // The other half of the same sentence: the `|:` opening this bar. Selecting it is what
            // makes the initial repeat — drawn past bar 1's clef, at no boundary at all — deletable.
            eng.setRepeatStart(element.measure, false)
            // ⚠️ Cleared, unlike the barline above: that selection is a BOUNDARY and outlives the
            // sign drawn on it (it is still the bar-width handle), where this one names ink that is
            // no longer on the page.
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'stem':
            // Nothing to delete. A stem is a property every non-rest note has; removing it is not a
            // thing you can do to a note. It is selectable so it can be nudged/dragged, and Delete
            // declines rather than falling through to something else's meaning.
            return
          case 'scoreText':
            // 🚧 **DELETE REMOVES THE FIELD** — his, 2026-08-27: *"delete the title field from the
            // json"*. `Score.title` / `Score.composer` are optional and their ABSENCE is "untitled"
            // / "anonymous", so `clearScoreText` deletes the key rather than blanking it; the
            // exported JSON then simply has no such field. ⛔ Not `= ''`, which would be a title you
            // typed nothing into (see `Score.title` and `engine/models/scoreTextOps`).
            eng.clearScoreText(element.field)
            // Cleared like the `|:` above and unlike the barline: this selection names INK, and the
            // ink is no longer on the page.
            state.selectedElement = null
            renderer.renderScore()
            return
          case 'staffGroup':
            // ⭐⭐ **DELETE REMOVES THE GROUP** — the only thing "delete" can mean for a grouping
            // sign: the sign IS the group, so there is no sign left to keep once it goes.
            // `staffGroupOps.applyGroupSymbol(…, undefined)` is the write, through the engine so it
            // records undo like every other edit.
            eng.removeStaffGroup(element.groupId)
            // Cleared, like the score text above and unlike the barline: this selection names INK,
            // and the ink is no longer on the page.
            state.selectedElement = null
            renderer.renderScore()
            return
          default:
            assertNeverElement(element)
        }
      }

      if (state.selectedItems.size > 0) {
        // Delete the whole selection as ONE undoable action so a single Ctrl-Z restores the
        // group. The set holds notes plus every mark a box pulled in (`./enclosedMarks`).
        const items = [...state.selectedItems.values()]
        const noteIds = items.filter(i => i.kind === 'note').map(i => i.id)
        const marks = markItems(items)
        const extra = marksLabel(marks)
        const label = `Delete ${noteIds.length} note(s)${extra ? ` + ${extra}` : ''}`
        // ⭐ ONE call, not a loop: Delete clears the REGION, and the meter decides the silence that
        // replaces it (`engine/models/clearOps`). Looping `deleteNote` gave each slot a rest of its
        // own length, so clearing half a 4/4 bar came back as `8 + 16×6` instead of one half rest.
        // No size branch — a single note is a range of one.
        eng.runBatch(label, () => {
          eng.deleteNotes(noteIds)
          removeMarks(eng, marks)
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
      return true
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
    // ⭐ Tab walks the selected slur's handles. Returning the DECLINE straight through is what keeps
    // Tab the browser's focus key when no slur is selected — the manager only calls preventDefault
    // when a handler does not answer false.
    nextHandle: () => cycleSelectedElement(1),
    previousHandle: () => cycleSelectedElement(-1),
    selectNextNote: () => {
      // Whatever ELEMENT is selected answers first (`elements/keys`) — fine nudge right, not navigation.
      if (nudgeSelectedElement(NUDGE_FINE_SS, 0)) return
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
      // Whatever ELEMENT is selected answers first (`elements/keys`) — fine nudge left, not navigation.
      if (nudgeSelectedElement(-NUDGE_FINE_SS, 0)) return
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
    // ⭐ Shift+↑/↓ = OPEN / close the armed wedge's mouth, else the fine staff-spacing nudge on a
    //   selected measure box. Disjoint selections, so it is one more branch and no reordering.
    staffSpacingFineUp: () => nudgeArmedMouth(MOUTH_STEP_SS) || nudgeStaffSpacingIfBoxSelected(-STAFF_SPACING_FINE_SS),
    staffSpacingFineDown: () => nudgeArmedMouth(-MOUTH_STEP_SS) || nudgeStaffSpacingIfBoxSelected(STAFF_SPACING_FINE_SS),
    // Shift+←/→ = the barline gap, the fine horizontal partner of Shift+↑/↓ above.
    barlineGapTighten: () => { nudgeSelectedBarlineGap(-BARLINE_GAP_STEP_SS) },
    barlineGapWiden: () => { nudgeSelectedBarlineGap(BARLINE_GAP_STEP_SS) },
    resetBarlineGap: () => resetArmedMouth() || resetSelectedBarlineGap(),
    voiceNavUp: () => selection.navigateVoice(1),
    voiceNavDown: () => selection.navigateVoice(-1),
    // Vertical arrows: the selected ELEMENT answers first (`elements/keys`), then a selected REST's
    // shift, else the normal pitch / octave edit.
    // (These keys are already bound, so they always consume — the nudge branch returns void
    // via the early return, so preventDefault still fires.)
    pitchUp: () => { if (nudgeSelectedElement(0, -NUDGE_FINE_SS) || nudgeSelectedRest(1)) return; selection.adjustPitch(1) },
    pitchDown: () => { if (nudgeSelectedElement(0, NUDGE_FINE_SS) || nudgeSelectedRest(-1)) return; selection.adjustPitch(-1) },
    octaveUp: () => { if (!nudgeSelectedElement(0, -NUDGE_COARSE_SS)) selection.adjustOctave(1) },
    octaveDown: () => { if (!nudgeSelectedElement(0, NUDGE_COARSE_SS)) selection.adjustOctave(-1) },
    // ── Ctrl+←/→ = MOVE: change the space before a selected note's column, or a selected barline's
    //    bar width — "move a lot" gets the easy key (docs/note-offset-plan.md §C swap). Joins the
    //    slur-endpoint / dynamic COARSE nudge that already owned Ctrl+←/→ (all selections disjoint).
    //    Left = tighten/narrow, right = widen. DECLINEs (false) when nothing applicable is selected,
    //    keeping the key free. One undo per press.
    //    ⭐⭐ EVERY BRANCH HERE WRITES AN OFFSET — this chord moves INK, and the model write that
    //    moves a span through the music is `Ctrl+Shift+←/→` below. Two families have been moved out
    //    of here to keep that true: the HAIRPIN's resize (2026-08-17) and the PEDAL's lift
    //    (2026-08-18), both ungated, so a selected wedge or pedal ate this chord outright and did
    //    something AUDIBLE with it. ⛔ Do not put a model write back on this key.
    //
    //    ⭐⭐ **ONE EXCEPTION, his call (2026-08-18): the armed slur ENDPOINT.** Its offset now
    //    carries the anchor along once the ink reaches the next note (`./slurEndpointWalk`), which
    //    is a model write on this key and IS audible — a slur's span is what `legatoChordIds`
    //    lengthens. It is allowed because it is not the failure the rule was written about: the two
    //    evicted families ate the chord OUTRIGHT and changed the music on the first press with
    //    nothing on screen to say so. This one moves ink press after press, re-anchors only on
    //    arrival at a note the user has steered the ink onto, and the note it lands on is TINTED
    //    throughout (`paintArmedSlurAnchorNote`) — so the change is asked for, visible, and one
    //    undo press away. *"a shortcut is for making the live easy to the user"*. ⛔ The rule still
    //    stands for everything else: an ungated model write here is still the bug it was.
    //    ⭐ The pedal came BACK to it the same day as its ink offsets — as an offset this time, and
    //    gated: armed square → that sign, nothing armed → both. It is the fourth family to read the
    //    same way here (slur point, wedge, bracket, pedal).
    //    ⭐⭐ …and the DYNAMIC is the second exception, his ask of 2026-08-19 (`./dynamicWalk`): the
    //    same interpolating walk, on a mark whose anchor is a SLOT rather than a note. It is allowed
    //    for the slur endpoint's reason and no other — ink press after press, a re-anchor only on
    //    arrival at a slot the user has steered the ink onto, and the mark's own guide line drawn to
    //    its anchor throughout, so the change is asked for, visible, and one undo press away.
    ctrlArrowLeft: () =>
      nudgeSelectedElement(-NUDGE_COARSE_SS, 0)
      || nudgeSelectedNoteSpacing(-NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(-BAR_WIDTH_STEP_PX),
    ctrlArrowRight: () =>
      nudgeSelectedElement(NUDGE_COARSE_SS, 0)
      || nudgeSelectedNoteSpacing(NOTE_SPACING_STEP_SS) || nudgeSelectedBarWidth(BAR_WIDTH_STEP_PX),
    // Ctrl+Backspace = reset the MOVE (the space before the note / the bar's width).
    resetMove: () => resetSelectedElement()
      || resetSelectedNoteSpacing() || resetSelectedBarWidth(),

    // ── Note OFFSET (the small, deliberate nudge off the natural column) rides the harder chords:
    //    Ctrl+Shift+←/→ = WIDE (1 space), Shift+Alt+←/→ = FINE (¼ space). "Should not offset that
    //    much" → the deliberate chords, not the easy key. Each DECLINEs when no single note/rest is
    //    selected. See docs/note-offset-plan.md §C.
    //    ⭐ An armed slur ENDPOINT gets the chord first: it re-anchors one note left/right instead
    //    (Ctrl+←/→ already nudges that point by pixels, so Shift on the same axis means "move the
    //    anchor" — see `slurReanchor`). Disjoint from the offset, which needs a selected NOTE.
    //    ⭐ …and an armed hairpin square moves ITS OWN end by a slot on the same chord (his call,
    //    2026-08-17): the same sentence — "move this end of the span" — about the other kind of
    //    spanner. The RIGHT square resizes; the LEFT one moves the start and holds the end. Two
    //    branches rather than one because they are two model writes, and both DECLINE unless their
    //    square is the armed one. Disjoint from the note offset: one `selectedElement`, one kind.
    //    ⭐ …and the same pair again for an armed OTTAVA square, his ask of the same day: the RIGHT
    //    square re-anchors the end, the LEFT one moves the beginning and holds the end. Two branches
    //    for the hairpin's reason (two model writes), and both walk the whole STAFF rather than a
    //    voice, because an octave line has none.
    //    ⭐ …and a fourth family, the TRILL (2026-08-18) — ⭐⭐ but ONE branch, not a pair, and by
    //    NOTE rather than by slot: a trill's anchors are notes, and the same module answers for both
    //    of its squares because the walk is one lane either way (`trillReanchor`).
    //    ⭐ …and the same pair a third time for an armed PEDAL square (2026-08-18): the RIGHT one
    //    moves the LIFT, the LEFT one moves the press and holds the lift. 🚨 The lift move ARRIVED
    //    HERE FROM `Ctrl+←/→`, where it had been ungated since P3 — the pedal was the family whose
    //    "resize" is audible sitting on the chord that nudges ink. The three pairs now read the
    //    same, which is the point: one sentence, one chord, whichever spanner is selected.
    ctrlShiftArrowLeft: () => reanchorSelectedElement(-1) || nudgeSelectedNoteOffset(-NUDGE_COARSE_SS),
    ctrlShiftArrowRight: () => reanchorSelectedElement(1) || nudgeSelectedNoteOffset(NUDGE_COARSE_SS),
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
    // `r` = repeat the selected bar(s) forward — a copy-paste over what follows, never an
    // insertion. WHICH passage and WHERE it lands is `interactions/repeatPassage.ts`; the decline
    // (no measure box selected) returns the key, and the repaint stays conditional on it.
    repeatSelection: () => {
      const eng = getEngine()
      if (!eng || !repeatSelectedPassage(eng, state, selection)) return false
      renderer.renderScore()
      return true
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
