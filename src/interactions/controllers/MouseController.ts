import { dbg } from '@/utils/debug'
import { windows } from '../../windows'
import { openScoreTextWindow } from '../../windows/scoreTextWindow'
import { scoreText } from '../../engine/models/scoreTextOps'
import type { ArticulationType, PitchSpelling, Fraction } from '../../types/music'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry, ElementType } from '../../engine/ElementRegistry'
import type { EditorState, SelectedElement } from '../state/EditorState'
import { activeVoiceToModel, armedTool, armedNormalSide, armedTupletM, selectedOf, spendArmedTuplet } from '../state/EditorState'
import { tempoLabel } from '../../utils/tempoMap'
import { tempoFieldsFromTool } from '../../utils/tempoText'
import { TempoTextSource } from '../text/TempoTextSource'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import type { TextEditController } from '../text/TextEditController'
import type { ClipboardController } from '../clipboard/ClipboardController'
import { DynamicTextSource } from '../text/DynamicTextSource'
import { fracToNumber } from '../../utils/fraction'
import { dynamicTextFromTool, DEFAULT_DYNAMIC_TEXT } from '../../utils/dynamics'
import { staffOf } from '@/utils/lanes'
import { nearestSlotBoundaryBeat } from '../../engine/layout/slotBoundary'
import { stampFanAtClick } from '../stamps/fanStamp'
import { stampGraceAtClick } from '../stamps/graceStamp'
import { stampSlurAtClick } from '../stamps/slurStamp'
import { tempoInsertStop } from '../lanes/tempoInsertAnchor'
import type { Stop as TempoStop } from '../../engine/models/tempoOps'
import { pickSlurHandleAt } from '../walks/slurHandlePick'
import { stampSpanMarkAtClick } from '../stamps/spanMarkStamp'
import { stampHairpinAtClick } from '../stamps/hairpinStamp'
import { stampArticulationAtClick } from '../stamps/articulationStamp'
import { stampTremoloAtClick } from '../stamps/tremoloStamp'
import { stampEnclosureAtClick } from '../stamps/enclosureStamp'
import { stampBarlineAtClick } from '../stamps/barlineStamp'
import { stampKeySignatureAtClick } from '../stamps/keySignatureStamp'
import { STAFF_BAND_PAD_PX } from '../state/staffBand'
import { ELEMENT_HIT_ORDER, type DoubleClickMark, type ElementChainDeps, type GestureDoor, type MouseDownCtx } from '../elements/chain'
import { armHairpinEndpointAt } from '../elements/hairpinHandles'
import type { DragHost, Gesture } from '../drags/gesture'
import { beginBarlineJoinDrag } from '../drags/barlineJoin'
import { beginMarkEndDrag, type MarkEndKind } from '../drags/markEnd'
import { beginNoteDrag } from '../drags/note'
import { beginSlurEndpointDrag } from '../drags/slurEndpoint'
import { beginSlurHandleDrag } from '../drags/slurHandle'
import { beginStaffGroupSpanDrag } from '../drags/staffGroupSpan'
import { beginStaffSpacingDrag } from '../drags/staffSpacing'
import { armOttavaEndpointAt } from '../elements/ottavaHandles'
import { barlineJoinGrabAt } from '../elements/barlineJoinHandles'
import { armPedalEndpointAt } from '../elements/pedalHandles'
import { armTrillEndpointAt } from '../elements/trillHandles'
import { articulationHit } from '../elements/articulation'
import { markAtPress } from '../state/markGroupSelect'
import { armMarkGroupDrag } from '../drags/markGroup'
/** Placeholder for a Ctrl+Alt+T tempo mark — exists only so the mark renders a measurable box; the
 *  edit box opens blank over it and an empty commit deletes it, so it is never actually seen. */
const DEFAULT_TEMPO_TEXT = 'Tempo'
import { beatToFrac } from '../../utils/musicUtils'
import { passageOf, passageNoteIds, spansStaves } from '../state/measurePassage'
import { stampGroupAtClick } from '../stamps/groupStamp'
import { measureCapacityQuarters } from '../../utils/measureCapacity'
import { accidentalToAlter, formatPitch } from '../../utils/pitchSpelling'


/** Registry element types that are staff background / structure rather than clickable
 *  notational objects. A Ctrl+Shift+click landing only on one of these is still "empty
 *  space" for the measure-box gesture (see handleModifierMouseDown). */
const MEASURE_BOX_IGNORE_TYPES = new Set<ElementType>(['staff', 'barline', 'repeatStart', 'beam'])

// ⭐ The measure-click band's tolerance moved to `./staffBand` (2026-08-26) so the BARLINE STAMP
// could read the same number: two gestures asking "which staff did they mean?" with two different
// answers is how a user learns that clicking works only sometimes (his report).

/**
 * Handles all mouse interactions: clicks, drags, ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 * Call setup() after mount and teardown() before unmount.
 */
export class MouseController {
  // --- Internal ephemeral state (not in EditorState — not needed for reactivity) ---
  private lastCanvasMousePosition: { x: number; y: number } | null = null
  private isMouseButtonDown = false
  /** ⭐⭐ **THE ONE GESTURE IN FLIGHT** — see {@link Gesture}, which carries the rule. */
  private activeDrag: Gesture | null = null
  /** What a gesture in `./drags/` may ask of this controller. */
  private readonly dragHost: DragHost = {
    getEngine: () => this.getEngine(),
    render: { previewMarks: (kind, id) => this.render.previewMarks(kind, id), renderScore: () => this.render.renderScore() },
    release: () => { this.activeDrag = null },
    setCursor: cursor => { const canvas = this.getScoreCanvas(); if (canvas) canvas.style.cursor = cursor },
  }
  /** What an element's gesture builder is handed (`elements/chain.ElementChainDeps.arm`). */
  private get gestureDoor(): GestureDoor {
    // ⚠️ A getter, not a field: `state` is a constructor parameter property, and a field
    //    initializer may run before it is assigned.
    return {
      host: this.dragHost,
      state: this.state,
      slotBeatAt: (engine, x, measure) => this.resolveSlotBeat(engine, x, measure),
      drawnMarkX: id => this.drawnMarkX(id),
    }
  }
  /** Hold the gesture a press armed. ⛔ null = it declined, and the press goes on being a click. */
  private begin(gesture: Gesture | null, event?: MouseEvent): void {
    if (!gesture) return
    this.activeDrag = gesture
    event?.preventDefault()
  }
  // --- Staff-spacing vertical drag (Sibelius "space above staff" — Client #7) ---
  /** ⭐ The measure box that was showing when THIS press began, remembered across the element
   *  clear so the empty-space fallback can re-grab it ({@link grabSelectedBox}). ⛔ Not state the
   *  app can read: it is alive for the length of one mousedown and means nothing after it. */
  private boxBeforePress: Extract<SelectedElement, { kind: 'measureRange' }> | null = null


  // --- Hand / grab-to-pan gesture (tool-agnostic navigation) ---
  // A press on empty space ARMS a possible pan but changes nothing yet; we decide
  // tap-vs-pan on RELEASE by movement distance (not time). Tracked in client (screen)
  // pixels, NOT svg coords — svg coords shift as the view scrolls and would feed the
  // scroll back on itself. Deltas drive `panBy(-dx, -dy)` so the content follows the hand.
  private isPanArmed = false
  private isPanning = false
  private panStartClient: { x: number; y: number } = { x: 0, y: 0 }
  private panLastClient: { x: number; y: number } = { x: 0, y: 0 }
  /** True only when armed in the selection tool: a tap-release clears the selection. */
  private pendingTapClearsSelection = false
  /** SVG coords of the armed empty-space press. On a tap-release we try to select the
   *  measure they fell inside (Sibelius plain-click passage select); only a tap OUTSIDE
   *  every bar falls back to clearing the selection. Null when no clearing pan is armed. */
  private pendingTapCoords: { x: number; y: number } | null = null
  /** Set on a pan-release so the trailing `click` doesn't run the tool's tap action. */
  private suppressNextClick = false
  /** Min cursor travel (px) from press before an armed press becomes a real pan. */
  private readonly PAN_THRESHOLD_PX = 4

  /** Clear all ephemeral pan flags. Called defensively at the top of every mousedown so
   *  a flag (notably `suppressNextClick`) can never outlive the gesture that set it —
   *  browsers don't reliably fire `click` after a movement-heavy press/release. */
  private resetPanState(): void {
    this.isPanArmed = false
    this.isPanning = false
    this.pendingTapClearsSelection = false
    this.suppressNextClick = false
    this.detachPanListeners()
  }

  /** Arm a possible pan from an empty-space press. Records the press point in client
   *  coords and attaches the document-level drivers; the pan only becomes real once
   *  movement crosses {@link PAN_THRESHOLD_PX}. */
  private armPan(event: MouseEvent, clearsSelection: boolean): void {
    this.isPanArmed = true
    this.pendingTapClearsSelection = clearsSelection
    this.panStartClient = { x: event.clientX, y: event.clientY }
    this.panLastClient = { x: event.clientX, y: event.clientY }
    this.attachPanListeners()
  }

  private attachPanListeners(): void {
    if (this.panListenersAttached) return
    document.addEventListener('mousemove', this.onDocPanMove, true)
    document.addEventListener('mouseup', this.onDocPanUp, true)
    this.panListenersAttached = true
  }

  private detachPanListeners(): void {
    if (!this.panListenersAttached) return
    document.removeEventListener('mousemove', this.onDocPanMove, true)
    document.removeEventListener('mouseup', this.onDocPanUp, true)
    this.panListenersAttached = false
  }

  /**
   * Document-level pan move. Drives the pan from anywhere on screen (not just over the
   * viewport), so leaving the viewport mid-drag keeps panning. Uses CLIENT coords — svg
   * coords shift as we scroll and would feed the scroll back on itself.
   */
  private handleDocPanMove(event: MouseEvent): void {
    if (!this.isPanArmed) return
    const cx = event.clientX
    const cy = event.clientY
    if (!this.isPanning) {
      const dist = Math.hypot(cx - this.panStartClient.x, cy - this.panStartClient.y)
      if (dist < this.PAN_THRESHOLD_PX) return // still within the dead zone — maybe a tap
      // Threshold crossed: a real pan has begun. Hide the OS pointer and measure deltas
      // from here (the small threshold travel is absorbed, not applied as a jump).
      this.isPanning = true
      this.state.isPanning = true
      this.panLastClient = { x: cx, y: cy }
      dbg('Pan started')
    }
    const dx = cx - this.panLastClient.x
    const dy = cy - this.panLastClient.y
    this.panLastClient = { x: cx, y: cy }
    this.panBy(-dx, -dy) // content follows the hand → scroll opposite to pointer motion
  }

  /** Document-level pan release. Resolves drag-vs-tap and tears the gesture down. */
  private handleDocPanUp(): void {
    if (!this.isPanArmed) return
    const { isPanning: wasPanning, pendingTapClearsSelection: clears, pendingTapCoords: tapCoords } = this
    this.detachPanListeners()
    this.isPanArmed = false
    this.isPanning = false
    this.pendingTapClearsSelection = false
    this.pendingTapCoords = null
    if (wasPanning) {
      // Real pan: swallow the trailing click, restore the pointer, keep the selection.
      this.suppressNextClick = true
      this.state.isPanning = false
      dbg('Pan ended')
    } else if (clears) {
      // Tap on empty space in the selection tool (deferred from mousedown). Sibelius-style:
      // a tap INSIDE a bar selects that whole bar (single blue box + its contents); only a
      // tap OUTSIDE every bar clears EVERYTHING, same as Esc — incl. tuplet/dynamic
      // selections and resetting entry to the default voice 1 (selectNote(null) alone would
      // leave the active voice stuck on a previously chosen voice).
      if (!tapCoords || !this.selectMeasureAt(tapCoords.x, tapCoords.y)) {
        this.selection.deselectAll()
        dbg('Selection cleared (tap)')
      }
      this.render.renderScore()
    }
  }

  // --- Manual double-click detection (the native dblclick event is defeated by the
  // re-render-on-select swapping SVG nodes) ---
  /**
   * The last thing pressed, as `mark:id` — ⭐ ONE pair for every family, where this was a pair of
   * fields PER MARK until the header lines wanted double-clicking too (2026-08-27). A third family
   * would have been a third pair and a third branch in {@link pressIsDoubleClick}; keying by the
   * mark makes it none of either, and it is exactly as strict — two different marks make two
   * different keys, so a tempo press followed by a dynamic press is still not a double-click.
   */
  private lastPressKey: string | null = null
  private lastPressTime = 0
  private readonly DOUBLE_CLICK_MS = 400

  private readonly onDocMouseDown = () => { this.isMouseButtonDown = true }
  private readonly onDocMouseUp = (event: MouseEvent) => {
    this.isMouseButtonDown = false
    // ⭐⭐ **EVERY drag is settled HERE as well as in the element's own handler**, because a release
    // outside the viewport never reaches that one — and a drag left armed is not a harmless leak: it
    // holds an uncommitted preview, so the score keeps changing under the next mouse move with no
    // button held (his report, 2026-08-20: *"i click release outside the viewport, and then when i
    // went back with no mouse pressed the system think i'm still pressing"*).
    //
    // ⭐ It runs the SAME chain the canvas's own release runs — ⛔ not a list of gestures repeated
    // here, which is a list that would be one short again the next time a drag is added. The gesture
    // carries its own ender and clears {@link activeDrag} on the way out, so whichever handler runs
    // first does the work and the other no-ops. Capture-phase, so this one is first.
    this.handleMouseUp(event)
  }

  /**
   * ⭐⭐ **EVERY DRAG KEEPS TRACKING WHEN THE POINTER LEAVES THE CANVAS** — his report, 2026-08-21:
   * *"i move up and then i dont release the mouse but went out of the viefinder and when i go back
   * im not editing the slur… this is wrong"*.
   *
   * ⭐ It is the PAN's own mechanism, which has had it since the hand tool shipped and says why in
   * `handleMouseLeave`: the element's `mousemove` stops firing once the pointer exits the canvas, so
   * a gesture that lives on it dies at the edge. ⛔ The list of gestures is not repeated here — this
   * forwards the SAME `handleMouseMove` the canvas calls, and every drag handler in it is guarded by
   * the one session ({@link Gesture}).
   *
   * ⚠️ **Only OUTSIDE the canvas**, or the element's own handler and this one would both fire and the
   * gesture would move twice per frame. Capture phase, so the target test happens before the element
   * sees it.
   *
   * ⚠️ **Only with the button DOWN.** With nothing held there is no gesture to keep alive, and
   * `handleMouseMove` returns early on `isMouseButtonDown` before any ghost work, so a move outside
   * the viewport costs nothing.
   */
  private readonly onDocMouseMove = (event: MouseEvent) => {
    if (!this.isMouseButtonDown) return
    const canvas = this.getScoreCanvas()
    if (!canvas || canvas.contains(event.target as Node)) return
    this.handleMouseMove(event)
  }

  // Document-level pan drivers: attached for the duration of an armed pan so the gesture
  // keeps tracking movement and release even when the pointer leaves the viewport (the
  // element's own mousemove/mouseup stop firing once the pointer exits scoreCanvas).
  private readonly onDocPanMove = (e: MouseEvent) => this.handleDocPanMove(e)
  private readonly onDocPanUp = () => this.handleDocPanUp()
  private panListenersAttached = false

  constructor(
    private getEngine: () => MusicEngine | null,
    private getScoreCanvas: () => HTMLElement | null,
    private state: EditorState,
    private selection: SelectionController,
    private render: RenderController,
    private getPendingArticulations: () => ArticulationType[] | undefined,
    private getTextEdit: () => TextEditController | null,
    private clipboard: ClipboardController,
    /** Arm the click-to-type expression tool (PaletteController.armDynamicEntry). Injected rather
     *  than reached for so {@link insertExpression} — the Ctrl+E / Insert▸Text▸Expression action —
     *  can live here (with the attach-and-edit half) without MouseController depending on the palette. */
    private armDynamicEntry: () => void,
    /** Arm the click-to-type tempo tool (PaletteController.armTempoEntry) — the tempo twin of
     *  `armDynamicEntry`, used by {@link insertTempo} (Ctrl+Alt+T). */
    private armTempoEntry: () => void,
    /** Scroll the viewport by a client-pixel delta (content follows the hand). */
    private panBy: (dx: number, dy: number) => void,
    /** Current view zoom — handed to the text editor so its (fixed-position) font scales (§5.4). */
    private getZoom: () => number = () => 1,
  ) {}

  /** Register document-level event listeners. Call on mount. */
  setup(): void {
    document.addEventListener('mousedown', this.onDocMouseDown, true)
    document.addEventListener('mouseup', this.onDocMouseUp, true)
    document.addEventListener('mousemove', this.onDocMouseMove, true)
  }

  /** Remove document-level event listeners. Call on unmount. */
  teardown(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown, true)
    document.removeEventListener('mouseup', this.onDocMouseUp, true)
    document.removeEventListener('mousemove', this.onDocMouseMove, true)
    this.detachPanListeners()
  }

  getLastMousePosition(): { x: number; y: number } | null {
    return this.lastCanvasMousePosition
  }

  // --- Private helpers ---

  private clientToSvg(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } | null {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPoint = point.matrixTransform(ctm.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  }

  /**
   * Resolve a click X within a measure to the beat of the nearest slot boundary
   * (by the slot's left edge). A beat-anchored marking (clef change, dynamic) is
   * placed at that slot; clicking near the measure start resolves to beat 0.
   * Returns the slot's exact Fraction beat when available.
   */
  private resolveSlotBeat(engine: MusicEngine, x: number, measureNum: number): Fraction {
    // Where each slot's ink begins — asked of the head and its accidental (`layout/slotBoundary`),
    // ⛔ no longer of VexFlow's union box. An empty bar resolves to beat 0, as it always has.
    const bestBeatNum = nearestSlotBoundaryBeat(engine.getElementRegistry(), x, measureNum) ?? 0

    // Recover the slot's exact Fraction beat from the model (numbers lose tuplet precision).
    const measure = engine.getScore().measures.find(m => m.number === measureNum)
    const slot = measure?.slots.find(s => Math.abs(fracToNumber(s.beat) - bestBeatNum) < 1e-6)
    return slot ? slot.beat : beatToFrac(bestBeatNum)
  }

  /**
   * Open the in-canvas text editor on a custom-text dynamic. Builds a
   * {@link DynamicTextSource} (which carries the model write + positioning + glyph
   * hide) and hands it to the shared {@link TextEditController}. No-op if the text
   * editor isn't wired (e.g. before mount).
   */
  private openTextEditor(dynamicId: string, isNew: boolean, seedText?: string): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit) return
    const source = new DynamicTextSource(
      dynamicId,
      isNew,
      engine,
      () => this.getScoreCanvas(),
      () => this.render.renderScore(),
      this.getZoom,
      seedText,
    )
    textEdit.open(source)
  }

  /**
   * Ctrl+E: attach a custom-text dynamic to the currently selected note/rest and open
   * the in-canvas editor to type it immediately — no armed tool, no placeholder to clear
   * out first. The mark is placed carrying the default placeholder so it renders a real
   * box for the overlay to position against, but the editor opens BLANK (seedText `''`)
   * and, being `isNew`, deletes itself on an empty commit — so typing nothing leaves no
   * trace. The place-render and the editor's suppress-render both run before the browser
   * paints, so the placeholder never flashes on screen. No-op with nothing selected, mid
   * text-edit, or before the editor is wired.
   */
  editDynamicOnSelection(): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit || this.state.editingText) return
    const noteId = this.state.selectedNoteId
    if (!noteId) return
    const note = engine.getNote(noteId)
    if (!note) return
    // Anchor to the selected note's STAFF (else it renders on staff 0); absent staffId
    // keeps single-staff output byte-identical. ⭐ No voice = every voice of that staff — see the
    // SCOPE note above. ⚠️ NOT the clicked note's voice: a mark is placed AT a note, not INTO it.
    const staffId = engine.staffIdForIndex(staffOf(note))
    const staffParam = staffId ? { staffId } : {}
    // ⭐ A PREVIEW, not an edit: the typed text commits placement + text as ONE undo entry
    // (`dynamicCommands.placeDynamicForTyping`), so `Ctrl+Z` never stops at the placeholder.
    const created = engine.dynamic.placeDynamicForTyping(note.measure, {
      beat: note.beat, text: DEFAULT_DYNAMIC_TEXT, placement: 'below', ...staffParam,
    })
    if (!created) return
    // Render so registerDynamics stores the mark's bbox; openTextEditor's source snapshots
    // its position from the registry, then immediately suppresses + re-renders it.
    this.render.renderScore()
    this.openTextEditor(created.id, true, '')
    dbg(`✓ Insert dynamic on selection: measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} staff ${staffOf(note)} (note ${noteId})`)
  }

  /**
   * The "insert an expression" action — the ONE thing Ctrl+E and Insert ▸ Text ▸ Expression both do,
   * so the two entry points share it instead of each spelling the branch. With a note/rest selected,
   * attach a dynamic to it and edit inline; with nothing selected, arm the click-to-type tool (blue
   * cursor) so the next canvas click places and edits one.
   */
  insertExpression(): void {
    if (this.state.selectedNoteId) this.editDynamicOnSelection()
    else this.armDynamicEntry()
  }

  /**
   * Open the inline editor on the currently SELECTED dynamic — the keyboard twin of double-clicking
   * it (bound to Enter). Returns whether it acted, so the Enter shortcut DECLINES (stays free) when
   * no dynamic is selected. No-op mid text-edit or before the editor is wired.
   */
  editSelectedDynamic(): boolean {
    if (this.state.editingText) return false
    const id = selectedOf(this.state, 'dynamic')?.id
    if (!id || !this.getEngine()?.getDynamicById(id)) return false
    this.openTextEditor(id, false)
    return true
  }

  /** Resolve a paste-placement click to a (measure, slot beat) and commit the paste. */
  private commitArmedPaste(event: MouseEvent): void {
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const measure = engine.pixelToMeasure(coords)
    const beat = this.resolveSlotBeat(engine, coords.x, measure)
    // Which stacked staff the click landed on is the paste destination staff (multi-staff).
    const registry = engine.getElementRegistry()
    const staff = registry.staffIndexAtY(measure, coords.y)
    // ⭐⭐ **WHICH NOTE the click landed ON, if any** — his rule for the slur, 2026-08-20: *"for
    // slurring a note we should be really close to the bbox of that note"*. A place is not enough
    // for a kind whose anchor is a NOTE, and only the pointer can say whether one was meant: the
    // click must be inside the note's own ink, ⛔ not merely nearest to it, which is how an empty bar
    // still produced a slur. A rest never qualifies — it cannot anchor one.
    // ⚠️ Optional-chained: the registry is STUBBED in several specs (a partial object with the
    // handful of methods those files need), and a paste that cannot ask simply names no note — which
    // is the same answer it gives for a click on empty staff.
    // ⭐ `noteOrRestAtBody` is the SLUR STAMP's own test (`./slurStamp`), asked once in the registry
    // rather than written out again here: a mark that attaches to an event must land ON one.
    const hit = registry.noteOrRestAtBody?.(coords.x, coords.y)
    const noteId = hit?.type === 'note' ? hit.id : undefined
    dbg(`Paste placement click | measure:${measure} beat:${fracToNumber(beat)} staff:${staff}`
      + `${noteId ? ' on a note' : ''}`)
    this.clipboard.pasteAt(measure, beat, staff, noteId)
  }

  /**
   * What the per-kind hit-tests in `elements/` are allowed to do besides answering "mine" — the
   * shared tail, the two drags they may arm, and the double-click editors. Built once: a press
   * hands the same object to every entry in {@link ELEMENT_HIT_ORDER}.
   *
   * ⭐ `pick` IS the tail eleven of the twelve handlers used to end in — clear the whole NOTE
   * selection (the multi-select Map drives the note highlight, not just `selectedNoteId`), make
   * this the ONE selected element, repaint. Written once here instead of eleven times there.
   */
  private readonly elementDeps: ElementChainDeps = {
    pick: (element, arm) => {
      this.selection.selectNote(null)
      this.state.selectedElement = element
      arm?.()
      this.render.renderScore()
      return true
    },
    pickArticulationGroup: (noteId) => {
      this.selection.selectArticulation(noteId)
      this.render.renderScore()
      return true
    },
    // ⭐ The SCORE's answer, asked at press time — see `ElementChainDeps.groupSymbolOf`.
    groupSymbolOf: (groupId) =>
      this.getEngine()?.getScore().staffGroups?.find(g => g.id === groupId)?.symbol,
    arm: (build, event) => this.begin(build(this.gestureDoor), event),
    isDoubleClick: (mark, id) => this.pressIsDoubleClick(mark, id),
    openEditor: (mark, id) => {
      if (mark === 'tempo') this.openTempoTextEditor(id, false)
      else this.openTextEditor(id, false)
    },
    // 🚧 The header lines have no in-canvas editor to open — they are edited in the very dialog the
    // Score menu opens, so a double-click summons that. ⭐ Opened HERE rather than routed through a
    // hook, because that is what `shortcutWiring` already does for every window a key opens
    // (`openClefWindow(windows)`); a second arrangement for one row would be the odd one out. The
    // dialog opens on what the score says NOW — it is a dumb publisher and may not read it itself
    // (`bus/scoreTextSelection`).
    openScoreTextDialog: (field) => {
      const score = this.getEngine()?.getScore()
      openScoreTextWindow(windows, field, score ? scoreText(score, field) : undefined)
    },
  }

  /**
   * Record this press and answer whether it was the SECOND on the same thing inside the
   * double-click window, consuming the pair when it was (so a third click is not another double).
   *
   * ⚠️ Manual, not the native `dblclick` event: selecting re-renders the score on every mousedown,
   * which swaps the SVG nodes, so the two clicks land on different element instances and the
   * browser never fires it.
   */
  private pressIsDoubleClick(mark: DoubleClickMark, id: string): boolean {
    const now = Date.now()
    const key = `${mark}:${id}`
    const isDouble = this.lastPressKey === key && (now - this.lastPressTime) < this.DOUBLE_CLICK_MS
    this.lastPressKey = isDouble ? null : key // consume, so a 3rd click isn't another double
    this.lastPressTime = now
    return isDouble
  }

  // --- Mouse handlers ---

  handleMouseDown(event: MouseEvent): void {
    // Primary button only. A right-click is not an editing gesture — it opens the context menu
    // (src/menus) — and without this it would ALSO run this whole path: change the selection, arm a
    // drag, arm a box-select. The `click` event never fires for button 2, so only mousedown needed
    // guarding, which is exactly why this went unnoticed until there was a menu to notice it.
    if (event.button !== 0) return
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    // Armed paste: this click chooses the insertion point.
    if (this.state.pastePlacementArmed) { this.commitArmedPaste(event); return }
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return
    // A press on the viewport's own scrollbar/gutter targets the scroll container element
    // itself, not the SVG inside it. Ignore it — otherwise dragging the scrollbar would map
    // to empty space and clear the selection.
    if (event.target === scoreCanvas) return

    // Defensive reset: a stale pan flag must never outlive its gesture (see resetPanState).
    this.resetPanState()

    // Non-selection tools (entry/clef/dynamic/TS) do their placement in handleClick, not
    // here. Arm a pan on this empty-space press so a drag pans the view instead of placing;
    // a tap falls through to handleClick (which suppresses nothing). These tools have no
    // selection to clear, so pendingTapClearsSelection stays false.
    if (this.state.selectedTool !== 'selection') {
      this.armPan(event, false)
      return
    }

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const registry = engine.getElementRegistry()
    // Selection is resolved by each element's own rendered geometry, NOT by the
    // click's vertical staff band: a note/tuplet drawn far from its staff (ledger
    // lines, brackets) lands in a neighbouring band, so a band-derived measure would
    // pick the wrong line and miss the element. (Band resolution via pixelToMeasure
    // is still correct for note entry / clef tool / clef drag below.)
    const ctx: MouseDownCtx = {
      event, engine, registry,
      x: coords.x, y: coords.y,
      closestElement: registry.findClosestNoteOrRest(coords.x, coords.y),
      tupletAtClick: registry.getTupletAt(coords.x, coords.y),
    }

    // Multi-select and handle-drags run BEFORE the scalar sub-selection clear below,
    // so they keep the existing selection / selected slur intact through the gesture.
    if (this.handleModifierMouseDown(ctx)) return
    if (this.handleTupletMouseDown(ctx)) return
    if (this.handleSlurHandleMouseDown(ctx)) return
    // A press on one of a selected hairpin's blue squares ARMS that end. A pre-step for the slur
    // handles' reason and one of its own: a square can sit inside the box of the dynamic at the
    // wedge's mouth, and `DYNAMIC_ELEMENT` runs ahead of `HAIRPIN_ELEMENT` in the chain — a handle
    // you can see must win the press. The module owns everything but the repaint.
    if (armHairpinEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) moves that end. The square stays armed after either, so the arrows can carry on
      // from where the mouse stopped.
      this.armMarkEndDrag('hairpin', coords)
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and the same for a selected OTTAVA's two squares. ⚠️ A pre-step for the hairpin's reason with
    // a different overlap behind it: the bracket sits on the outside-staff ladder directly above what
    // it clears, so a square can land inside a TRILL's or a TEMPO mark's box — and both run ahead of
    // `OTTAVA_ELEMENT` in the chain.
    if (armOttavaEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) re-anchors that end. The square stays armed after either, so the arrows can
      // carry on from where the mouse stopped.
      this.armMarkEndDrag('ottava', coords)
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and a selected PEDAL's two squares. ⚠️ A pre-step with the strongest case of the three: the
    // pedal is the OUTERMOST below-staff family, so its squares sit beyond everything the ladder put
    // inside it — a dynamic, a hairpin, a trill, an octave line — and every one of those runs ahead
    // of `PEDAL_ELEMENT` in the chain.
    if (armPedalEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) moves that end through the music. The square stays armed after either, so the
      // arrows can carry on from where the mouse stopped.
      this.armMarkEndDrag('pedal', coords)
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and a selected TRILL's two squares (2026-08-18). ⚠️ A pre-step for the family's reason: the
    // ornament sits on the ladder between the octave bracket and the tempo mark, and BOTH run ahead
    // of `TRILL_ELEMENT` in the chain, so a square beyond the wiggle can land inside either's box.
    //
    // ⚠️ No drag is armed here, unlike the wedge's, the bracket's and the pedal's: these squares ARM
    // and nothing more for now (`trillHandles`), so there is no end for a drag to move.
    if (armTrillEndpointAt(this.state, registry, coords.x, coords.y)) {
      // Click = pick the square; drag (decided on move, past the same time threshold every other
      // handle uses) re-anchors that end. The square stays armed after either, so the arrows can
      // carry on from where the mouse stopped.
      this.armMarkEndDrag('trill', coords)
      this.render.renderScore()
      event.preventDefault()
      return
    }
    // …and a press on a selected barline's JOIN SQUARE arms the join drag (P3 of
    // docs/plans/barline-join-plan.md). ⚠️ **BEFORE the staff-spacing drag, and it must be**: the square
    // sits 10 px into the gap, inside the 12 px PADDED band (`./staffBand`) that gesture claims, and
    // a handle you can SEE has to win the press over whatever it happens to overlap.
    //
    // ⭐ It selects NOTHING — the barline stays selected right through the drag, which is what keeps
    // the square painted while you hold it.
    // ⭐⭐ A press on a SELECTED GROUPING SIGN'S SQUARE resizes the group — his ask, 2026-08-29.
    //   ⚠️ Before the join square and the staff-spacing drag, for the join square's reason: a handle
    //   you can SEE has to win the press over whatever band it happens to sit in. ⭐ It selects
    //   NOTHING — the sign stays selected through the drag, which keeps its squares painted.
    const groupResize = beginStaffGroupSpanDrag(this.dragHost, this.state, registry, coords.x, coords.y)
    if (groupResize) {
      this.activeDrag = groupResize
      event.preventDefault()
      return
    }
    const joinGrab = barlineJoinGrabAt(registry, coords.x, coords.y)
    if (joinGrab) {
      this.activeDrag = beginBarlineJoinDrag(this.dragHost, this.state, joinGrab)
      event.preventDefault()
      return
    }
    // Whatever was picked is gone; the handlers below each set what this press picked instead.
    // ⭐ ONE assignment — this used to be twelve fields, and the third of four clear-lists that had
    // to agree (it was the one missing the accidental, articulation, dot, stem and tremolo).
    //
    // ⭐ **The measure box outlives the clear by exactly one press**, because the gesture that
    // re-grabs it ({@link grabSelectedBox}) runs at the very END — see there for why.
    this.boxBeforePress = selectedOf(this.state, 'measureRange')
    this.state.selectedElement = null

    // Single-click element hit-tests, in priority order — one entry per selectable kind, each
    // consuming the press or declining it. ⭐ THE ORDER IS THE CONTENT and it lives in
    // {@link ELEMENT_HIT_ORDER}, with the comments that argue it: the dot before the note, the
    // tremolo before the stem, the barline last of all. Twelve `if`s here, and twelve bodies four
    // hundred lines below, said the same thing in two places that could disagree.
    if (armMarkGroupDrag(ctx, this.state, this.elementDeps, this.dragHost)) return // a GROUP of marks
    for (const element of ELEMENT_HIT_ORDER) if (element.hit(ctx, this.elementDeps)) return
    this.handleNoteOrEmptyMouseDown(ctx)
  }

  /**
   * Ctrl/Cmd or Shift click → build a multi-selection. Always "consumes" the press when a modifier
   * is held (it never falls through to single-select), so returns true whenever additive/range is
   * active.
   *
   * ⭐ Ctrl/Cmd toggles NOTES, ARTICULATION groups and — since 2026-08-19 — the six MARK kinds the
   * set can hold (`./markGroupSelect`). Shift stays temporal: a range is an amount of MUSIC, and a
   * hairpin is not a position you can range from.
   */
  private handleModifierMouseDown(ctx: MouseDownCtx): boolean {
    const { event, registry, x, y, closestElement } = ctx
    // Modifier clicks build a multi-selection — they never clear the set and arm no drag, so a
    // press on empty space (or on a kind the set cannot hold) is a no-op:
    //   - Shift  → select the temporal range pivot→target (rests + whole chords),
    //              unioned onto the existing selection (range wins when both held).
    //   - Ctrl/Cmd → toggle the clicked note, articulation group or MARK in/out.
    const additive = event.ctrlKey || event.metaKey
    const range = event.shiftKey
    if (!(additive || range)) return false

    // Any modifier press dismisses a showing measure box — but capture the current span
    // FIRST so a Ctrl+Shift+click can extend from its anchor (re-set in selectMeasureBox).
    const prevRange = selectedOf(this.state, 'measureRange')

    // ⭐⭐ **SHIFT ALONE, ON A SHOWING PASSAGE, EXTENDS THE PASSAGE** — in BARS and in STAVES.
    //
    // 🚨 His report, 2026-08-29: with two staves, click a bar on staff 0 then shift-click the bar
    // below to select *"the measure but in both staves"*. It went to the note-range path instead
    // (`Range extended to Rest`) — twice over: the passage was cleared two lines below before
    // anything could extend it, and a two-staff measure selection had no way to be REPRESENTED
    // (`measurePassage.ts`). ⚠️ Note it landed on a rest at all only because an empty bar's whole
    // rest sits mid-bar, inside the note fallback's 30 px reach — so this could never have been
    // fixed by nudging that radius.
    //
    // ⭐ Sibelius's rule, which is the one he named for this feature: with a passage selected,
    //   shift-click grows the passage. ⛔ Before the note-range branch, and before the dismissal
    //   below, so it wins over both.
    if (range && !additive && prevRange?.boxStyle === 'single' && this.extendPassage(ctx, prevRange)) {
      return true
    }

    if (prevRange) this.state.selectedElement = null

    // Ctrl+Shift+click on empty space inside a bar → Sibelius-style blue measure box.
    // Purely visual: NO objects are selected. Fires only when the click misses every
    // rendered element (strict registry hit-test), so Ctrl+Shift directly on a note
    // still range-extends the note selection below. A repeat click extends the span.
    if (additive && range) {
      const hitEl = registry.getAt(x, y)
      const hitTuplet = ctx.tupletAtClick?.tupletId ?? null
      // The registry also registers the staff/barline/beam as elements — those are
      // background/structure, not notational objects, so a click on them is still
      // "empty space" for the measure-box gesture. Only a real object blocks the box.
      const onObject = hitEl != null && !MEASURE_BOX_IGNORE_TYPES.has(hitEl.type)
      dbg(
        `⎇ Ctrl+Shift+click | pos:(${Math.round(x)},${Math.round(y)}) | ` +
        `element:${hitEl ? `${hitEl.type}#${hitEl.id ?? '?'}` : 'none'}` +
        `${hitEl && !onObject ? ' (background→empty)' : ''} | ` +
        `tuplet:${hitTuplet ?? 'none'}`,
      )
      if (!onObject && !hitTuplet) {
        if (this.selectMeasureBox(ctx, prevRange)) return true
      } else {
        dbg('  ↳ landed on an object — falling through to note range/toggle (no box)')
      }
    }

    // Ctrl/Cmd-click toggles an articulation GROUP into the multi-selection (so the
    // user can grab several articulations and delete/flip them all at once). Checked
    // before notes since a glyph sits right on its note head; Shift-range isn't
    // supported for articulations yet, so only `additive` arms this path.
    if (additive) {
      const artHit = articulationHit(x, y, closestElement, registry)
      if (artHit?.noteId) {
        this.selection.toggleArticulation(artHit.noteId)
        dbg(`✓ Articulation group toggled in selection | noteId:${artHit.noteId} | size:${this.state.selectedItems.size}`)
        this.render.renderScore()
        return true
      }
    }
    // ⭐ Ctrl/Cmd-click toggles a MARK into the group — a hairpin, a trill, a slur, a dynamic, an
    // 8va, a pedal (`./markGroupSelect`, which re-runs the press chain rather than re-asking where
    // the marks are). BEFORE the note fallback below, whose 30px reach would otherwise swallow a
    // press aimed at a wedge under the staff.
    if (additive) {
      const mark = markAtPress(ctx)
      if (mark) {
        this.selection.toggleMark(mark)
        dbg(`✓ ${mark.kind} toggled in selection | id:${mark.id} | size:${this.state.selectedItems.size}`)
        this.render.renderScore()
        return true
      }
    }
    if (closestElement && closestElement.id) {
      const bbox = closestElement.bbox
      const centerX = bbox.x + bbox.width / 2
      let elementY: number
      if (closestElement.type === 'note' && closestElement.pitch !== undefined && closestElement.measure !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, closestElement.measure, centerX, closestElement.headStaff ?? closestElement.staff)
        elementY = pitchY !== null ? pitchY : bbox.y + bbox.height / 2
      } else {
        elementY = bbox.y + bbox.height / 2
      }
      const distance = Math.sqrt((x - centerX) ** 2 + (y - elementY) ** 2)
      if (distance < 30) {
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        if (range) {
          this.selection.extendSelectionTo(closestElement.id)
          dbg(`✓ Range extended to ${typeLabel} | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
        } else {
          this.selection.toggleNote(closestElement.id)
          dbg(`✓ ${typeLabel} toggled in selection | id:${closestElement.id} | size:${this.state.selectedItems.size}`)
        }
        this.render.renderScore()
      }
    }
    return true
  }

  /**
   * Outline the clicked measure with the Sibelius-style blue double box. Returns false
   * (so the caller keeps looking) when the click, though empty of elements, doesn't land
   * inside any measure's rectangle — `pixelToMeasure` falls back to the nearest measure on
   * the line, which we don't want to hijack for a stray click below/above the staff.
   */
  private selectMeasureBox(ctx: MouseDownCtx, prevRange: { anchor: number; focus: number } | null): boolean {
    const { engine, x, y } = ctx
    const measure = engine.pixelToMeasure({ x, y })
    const rect = engine.getMeasureRect(measure)
    if (!rect) {
      dbg(`  ↳ no rect for measure ${measure} — box not drawn`)
      return false
    }
    const inside = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
    if (!inside) {
      dbg(
        `  ↳ click outside measure ${measure} rect ` +
        `(x:${Math.round(rect.x)}–${Math.round(rect.x + rect.width)}, ` +
        `y:${Math.round(rect.y)}–${Math.round(rect.y + rect.height)}) — box not drawn`,
      )
      return false
    }
    // GROW the span to include the clicked bar (union with the current span), so a
    // repeat Ctrl+Shift+click on either side only ever makes the selection bigger; a
    // click already inside the span is a no-op. Start a fresh single-bar span when none
    // is active. (To shrink/restart, plain-click first to clear, then Ctrl+Shift+click.)
    const lo = prevRange ? Math.min(prevRange.anchor, prevRange.focus, measure) : measure
    const hi = prevRange ? Math.max(prevRange.anchor, prevRange.focus, measure) : measure
    // The box stands alone — clear any prior selection first, then set the span
    // (deselectAll clears the element selection, so order matters: we set it AFTER).
    this.selection.deselectAll()
    this.state.selectedElement = {
      kind: 'measureRange',
      anchor: lo,
      focus: hi,
      // Which stacked staff the click fell on — the reference staff the "Staff:" add-above/below
      // buttons insert relative to (multi-staff Phase 4). N=1 → always 0.
      staff: engine.getElementRegistry().staffIndexAtY(measure, y),
      // ⭐ The `double` box has ALWAYS covered every staff (its painter spans staff 0 → the last),
      //   because add/remove-measure is a system-wide edit. `focusStaff` now says so in the model
      //   rather than only in the drawing — ⛔ it is not a new behaviour.
      focusStaff: (engine.getScore().staves?.length ?? 1) - 1,
      boxStyle: 'double',
    }
    dbg(
      lo === hi
        ? `✓ Measure box selected | measure:${measure}`
        : `✓ Measure span selected | measures:${lo}–${hi} (grew to include ${measure})`,
    )
    this.render.renderScore()
    return true
  }

  /**
   * ⭐⭐ **Grow a showing passage to the clicked bar AND the clicked staff.**
   *
   * The anchor end never moves; the focus end goes wherever the shift-click landed, on both axes at
   * once — so one gesture reaches a bar to the right, a staff below, or both. ⭐ Re-gathering through
   * {@link passageNoteIds} is what keeps *the highlight promising the copy*: the box the user sees
   * and the ids a Delete or a Copy will act on come from **one** answer.
   *
   * @returns false when the press was not inside any bar, so the caller keeps looking (a shift-click
   *   out in the margin should still fall through to whatever else wants it).
   */
  private extendPassage(
    ctx: MouseDownCtx,
    prev: { anchor: number; focus: number; staff: number; focusStaff: number },
  ): boolean {
    const { engine, x, y } = ctx
    const measure = engine.pixelToMeasure({ x, y })
    const rect = engine.getMeasureRect(measure)
    // ⚠️ `pixelToMeasure` falls back to the nearest bar on the line, so a press far from any bar
    //    would otherwise silently extend to it. The rect test is what makes the gesture local.
    if (!rect || x < rect.x || x >= rect.x + rect.width) return false

    const registry = engine.getElementRegistry()
    const staff = registry.staffIndexAtY(measure, y)
    const span = { anchor: prev.anchor, focus: measure, staff: prev.staff, focusStaff: staff }
    const passage = passageOf(span)
    const score = engine.getScore()
    const ids = passageNoteIds(score, passage)
    if (!ids.length) return false

    this.selection.selectMeasureContents(ids)
    // AFTER selectMeasureContents, which clears the element selection on its way through.
    this.state.selectedElement = { kind: 'measureRange', ...span, boxStyle: 'single' }
    dbg(
      `✓ Passage extended | measures:${passage.fromMeasure}–${passage.toMeasure} ` +
      `staves:${passage.fromStaff}–${passage.toStaff}` +
      `${spansStaves(passage) ? ' (multi-staff)' : ''} | items:${this.state.selectedItems.size}`,
    )
    this.render.renderScore()
    return true
  }

  /**
   * Sibelius plain-click passage select: a tap on empty space inside a bar selects that
   * whole bar on the clicked staff — its notes/rests plus enclosed dynamics and slurs
   * (ties ride along via their notes) — and outlines it with a SINGLE blue box. Returns
   * false (→ caller clears the selection instead) when the tap doesn't land ON a staff:
   * horizontally outside the bar (`pixelToMeasure` snaps to the nearest bar on the line), or
   * vertically off the clicked staff's band — crucially the GAP BETWEEN STAVES, since the
   * bar's `getMeasureRect` spans all staves top-to-bottom and would otherwise grab a gap
   * click for whichever staff is nearest.
   */
  private selectMeasureAt(x: number, y: number): boolean {
    const engine = this.getEngine()
    if (!engine) return false
    const measure = engine.pixelToMeasure({ x, y })
    const rect = engine.getMeasureRect(measure)
    if (!rect) return false
    // Horizontal: within this bar's x-range (reject the nearest-bar snap for a click past
    // the last bar on a line).
    if (x < rect.x || x >= rect.x + rect.width) return false

    const registry = engine.getElementRegistry()
    const staff = registry.staffIndexAtY(measure, y)
    // Vertical: must land ON the clicked staff's own band (its five lines + a small ledger
    // margin, matching the drawn box). A click in the gap between staves — or well above/
    // below the system — is not on any staff, so it selects nothing and the caller clears.
    const geo = registry.getStaffGeometry(measure, staff)
    if (!geo) return false
    if (y < geo.lineYPositions[0] - STAFF_BAND_PAD_PX || y > geo.lineYPositions[4] + STAFF_BAND_PAD_PX) return false

    const score = engine.getScore()
    const m = score.measures.find(mm => mm.number === measure)
    if (!m) return false
    // Every note/rest on the clicked staff of this bar (rests included — a bar always has
    // content), AND every fanned member: selecting a bar means selecting what is in it, and a
    // member is a head with an id like any other. `getMeasureNotes` alone selected one note out
    // of six for a bar holding a fan — so the delete or copy that followed took one note out of
    // six. In beat order, so the anchor is genuinely the bar's last event (`measureSelectableNotes`).
    // These ids drive both the selection and the enclosed-dynamics/slurs pull.
    const span = { anchor: measure, focus: measure, staff, focusStaff: staff }
    const ids = passageNoteIds(score, passageOf(span))
    if (!ids.length) return false

    this.selection.selectMeasureContents(ids)
    // AFTER selectMeasureContents, which clears the element selection on its way through.
    this.state.selectedElement = { kind: 'measureRange', ...span, boxStyle: 'single' }
    dbg(`✓ Measure selected (plain click) | measure:${measure} staff:${staff} | items:${this.state.selectedItems.size}`)
    return true
  }

  /** Select a whole tuplet when the click is on its bracket/number (far enough from
   *  any of its notes); falls through (returns false) when the click is near a note. */
  private handleTupletMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, y, tupletAtClick } = ctx
    if (tupletAtClick && tupletAtClick.tupletId) {
      const tupletNotes = registry.getNotesByTupletId(tupletAtClick.tupletId)
      let minVerticalDistance = Infinity

      for (const note of tupletNotes) {
        if (note.pitch !== undefined && note.measure !== undefined) {
          const noteY = registry.pitchToPixelY(note.pitch, note.measure, note.bbox.x + note.bbox.width / 2, note.headStaff ?? note.staff)
          if (noteY !== null) {
            const verticalDistance = Math.abs(y - noteY)
            minVerticalDistance = Math.min(minVerticalDistance, verticalDistance)
          }
        }
      }

      if (minVerticalDistance > 12) {
        this.state.selectedElement = { kind: 'tuplet', id: tupletAtClick.tupletId }
        this.state.selectedNoteId = null
        dbg(`✓ Tuplet selected on mousedown | id:${tupletAtClick.tupletId}`)
        this.render.renderScore()
        return true
      }
    }
    return false
  }

  /**
   * If a slur is already selected and the user grabbed one of its handle dots, arm a
   * reshape or endpoint-re-anchor drag. Runs before the selection clears so the slur
   * stays selected throughout the drag.
   */
  private handleSlurHandleMouseDown(ctx: MouseDownCtx): boolean {
    const { event, registry, x, y } = ctx
    const selectedSlur = selectedOf(this.state, 'slur')
    if (!selectedSlur) return false

    // ⭐⭐ ONE decision for all three handle families: the NEAREST one wins (`./slurHandlePick`).
    // This used to be three `.find()`s in a row, so a press that touched both an arc dot and an end
    // square always took the dot — his report, 2026-08-18: *"im trying to get the endpoint but i'm
    // getting the control point"*. The boxes genuinely overlap on a short slur.
    const pick = pickSlurHandleAt(registry, selectedSlur.id, x, y)

    // Slur control-point handle drag.
    // The handle carries its OWN segment's drag context (endpoints + control points +
    // staff spacing + segment address + span count), so we read everything straight off it
    // — no re-lookup of a 'slur' partial, which on a cross-system slur would ambiguously
    // resolve to the wrong segment (§4a). cpIndex disambiguates the two dots within it.
    if (pick?.kind === 'control') {
      const handle = pick.entry
      const gesture = beginSlurHandleDrag(this.dragHost, selectedSlur.id, handle)
      if (gesture && handle.cpIndex !== undefined) {
      this.activeDrag = gesture
      // Grabbing a round (angle) handle PICKS that dot, and by construction disarms any armed
      // endpoint square — the two are different editing targets, so the arrows shouldn't keep
      // nudging an endpoint after you reach for the curve shape (slur-endpoint-offset-plan).
      // ⭐ The dot is recorded by segment as well as index so a cross-system slur lights the one you
      // grabbed rather than one per system, and re-rendered UNCONDITIONALLY (it used to repaint only
      // when a square had been armed) so the picked dot shows the moment you touch it.
      this.state.selectedElement = {
        kind: 'slur',
        id: selectedSlur.id,
        controlPoint: {
          cpIndex: handle.cpIndex,
          segmentRole: handle.segmentRole,
          segmentOrdinal: handle.segmentOrdinal,
        },
      }
      this.render.renderScore()
      dbg(`Slur handle drag ready | id:${handle.slurId} cp:${handle.cpIndex} seg:${handle.segmentRole ?? 'single'}${handle.segmentRole === 'middle' ? `#${handle.segmentOrdinal}` : ''}`)
        event.preventDefault()
        return true
      }
    }

    // Slur endpoint (square) handle drag — re-anchor the in/out point onto a
    // different note.
    if (pick?.kind === 'endpoint' && pick.entry.endpoint) {
      const endHandle = pick.entry
      const which = pick.entry.endpoint
      this.activeDrag = beginSlurEndpointDrag(this.dragHost, this.state, selectedSlur.id, which, x, y)
      // Click = select this point for keyboard nudging; drag (decided on move) re-anchors.
      // Either way the point stays armed afterward, so arrows can fine-tune it. Re-render so
      // the selected square's highlighted border shows immediately (slur-endpoint-offset-plan).
      // Arming a blue square disarms an orange one — one object, so that is now by construction
      // rather than a second line that had to remember.
      this.state.selectedElement = { kind: 'slur', id: selectedSlur.id, endpoint: endHandle.endpoint }
      this.render.renderScore()
      dbg(`Slur endpoint armed | id:${endHandle.slurId} end:${endHandle.endpoint}`)
      event.preventDefault()
      return true
    }

    // Slur SEGMENT endpoint (orange square) — an OPEN join of a cross-system slur. Click ARMS
    // it for keyboard nudging; there is NO drag/re-anchor (no note to anchor onto). Arming
    // disarms the blue endpoint (mutually exclusive). See
    // docs/plans/multisystem-slur-segment-endpoint-offset-plan.md.
    if (pick?.kind === 'segmentEndpoint' && pick.entry.segmentRole) {
      const segEndHandle = pick.entry
      const role = segEndHandle.segmentRole
      this.state.selectedElement = {
        kind: 'slur',
        id: selectedSlur.id,
        segmentEndpoint:
          role === 'middle' ? { role: 'middle', ordinal: segEndHandle.segmentOrdinal!, side: segEndHandle.segmentSide! }
          : role === 'begin' ? { role: 'begin' }
          : { role: 'end' },
        segmentSpanCount: segEndHandle.slurSpanCount ?? 0,
      }
      this.render.renderScore()
      dbg(`Slur segment endpoint armed | id:${segEndHandle.slurId} role:${role}${role === 'middle' ? `#${segEndHandle.segmentOrdinal} ${segEndHandle.segmentSide}` : ''}`)
      event.preventDefault()
      return true
    }
    return false
  }

  /**
   * ⭐⭐ **RE-GRAB THE BOX THIS PRESS LANDED INSIDE** — a plain-click SINGLE measure box that is
   * already selected keeps its selection, and the press arms the vertical drag that adjusts the
   * staff's "space above" (Sibelius staff drag — Client #7, docs/plans/staff-spacing-plan.md §6).
   * Mirrors {@link handleSlurHandleMouseDown}: you first select the box, then grab it.
   *
   * 🚨🚨 **IT RUNS LAST, AND THAT IS THE WHOLE POINT — his report, 2026-08-31**: *"if a measure is
   * selected and we click inside on a selectable object, we should reselect and not keep the measure
   * selection"*. This test used to run BEFORE the element chain, and its only question is *did the
   * press land in this bar's staff band?* — which every note, dynamic, clef, accidental and barline
   * inside the bar answers YES to. So one bar selected turned the whole bar into a spacing handle:
   * clicking a note in it selected nothing, and the box stayed.
   *
   * ⭐ Now it is the EMPTY-SPACE fallback's first question ({@link beginBoxSelectOrPan}), reached
   * only after every element hit-test has declined — the same position the select-and-grab path
   * beside it already had. ⛔ The alternative (asking here whether an object was hit) is a second
   * copy of `ELEMENT_HIT_ORDER`'s answer, and a copy that can disagree.
   *
   * ⚠️ It reads {@link boxBeforePress}, because by the time the fallback is reached the press has
   * already cleared the element selection — and it puts that box back, so the highlight survives the
   * press and follows the drag live.
   */
  private grabSelectedBox(ctx: MouseDownCtx): boolean {
    const { engine, event, registry, x, y } = ctx
    const box = this.boxBeforePress
    if (!box || box.boxStyle !== 'single') return false
    const measure = box.anchor // single box: anchor === focus
    const rect = engine.getMeasureRect(measure)
    if (!rect) return false
    // Hit-test the exact drawn box: this bar's x-range × the selected staff's band (its five
    // lines + the same ±STAFF_BAND_PAD_PX the box and the plain-click select use).
    if (x < rect.x || x >= rect.x + rect.width) return false
    const staff = box.staff
    const geo = registry.getStaffGeometry(measure, staff)
    if (!geo) return false
    if (y < geo.lineYPositions[0] - STAFF_BAND_PAD_PX || y > geo.lineYPositions[4] + STAFF_BAND_PAD_PX) return false

    // ⭐ Put the box back before arming: the drag reads the selected staff off it, the highlight
    //   paints from it, and this press cleared it on its way past the element chain.
    this.state.selectedElement = box
    if (!this.armStaffSpacingDrag(measure, y)) return false
    event.preventDefault()
    return true
  }

  /** Arm the vertical staff-spacing drag on the currently-selected single box's staff,
   *  capturing its current per-system `above` as the baseline and `startY` as the grab origin.
   *  `measure` fixes the target SYSTEM (per-system key). Shared by the "grab an already-selected
   *  box" path and the "select-and-grab in one press" path.
   *
   *  Works in BOTH views, but writes different things: in wrapped view the drag engraves a
   *  per-system override; in linear view it moves an ephemeral VIEW KNOB that persists nothing
   *  (docs/plans/linear-view-plan.md §4.2b). Same gesture, and the engine decides which — so nothing
   *  keyed to a system can be written from a view that has no system worth naming (§4.1).
   *  @returns true if a drag was armed. */
  private armStaffSpacingDrag(measure: number, startY: number): boolean {
    const staff = selectedOf(this.state, 'measureRange')?.staff ?? 0
    const gesture = beginStaffSpacingDrag(this.dragHost, staff, measure, startY)
    if (gesture) this.activeDrag = gesture
    return gesture !== null
  }

  /** Open the in-canvas text overlay over a tempo mark — the WHOLE mark, `Allegro (♩ = 144)`,
   *  as one editable string (TempoTextSource parses the model back out of it). `seedText` opens the
   *  box with different initial text than the model holds — `''` for the blank Ctrl+Alt+T flow. */
  private openTempoTextEditor(tempoId: string, isNew: boolean, seedText?: string): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit) return
    textEdit.open(new TempoTextSource(
      tempoId,
      isNew,
      engine,
      () => this.getScoreCanvas(),
      () => this.render.renderScore(),
      this.getZoom,
      seedText,
    ))
  }

  /**
   * The "insert a tempo" action — the tempo twin of {@link insertExpression}, and the one thing
   * Ctrl+Alt+T (and the Insert menu's *Tempo* row) does. With a selection that names a place, place a
   * tempo mark there and open the edit box blank to type the whole mark; with nothing selected, arm
   * the click-to-type tempo tool (blue cursor) so the next canvas click places and edits one.
   *
   * ⭐ **WHERE it lands is `./tempoInsertAnchor`'s table**, ⛔ not a branch here: a barline names the
   * bar AFTER it, a measure selection names its FIRST bar, a note names its own beat (his ask,
   * 2026-08-31).
   */
  insertTempo(): void {
    const engine = this.getEngine()
    const stop = engine ? tempoInsertStop(this.state, engine) : null
    if (stop) this.editTempoAt(stop)
    else this.armTempoEntry()
  }

  /**
   * Place a tempo mark at `stop` and open the edit box blank. Tempo is system-level, so — unlike a
   * dynamic — the mark carries NO staffId and NO voice (it governs the clock, not the staff it was
   * placed from). The placeholder text only exists so the mark renders a measurable box; the box
   * opens blank (seedText `''`) and, being `isNew`, deletes the mark on an empty commit.
   */
  private editTempoAt(stop: TempoStop): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit || this.state.editingText) return
    // ⭐ A PREVIEW, not an edit: the typed text commits placement + text as ONE undo entry
    // (`tempoCommands.placeTempoMarkForTyping`), so `Ctrl+Z` never stops at the placeholder.
    const created = engine.tempo.placeTempoMarkForTyping(stop.measure, { beat: stop.beat, text: DEFAULT_TEMPO_TEXT })
    if (!created) return
    // ⭐ The selection that SAID WHERE is spent — his call, 2026-08-31: *"if we select a measure and
    //   then chose to enter tempo… the measure should not be selected anymore (we are doing tempo
    //   editing now and no measure selection operations)"*. It goes before the render, so the bar's
    //   blue box is gone in the same paint the edit box opens in. ⛔ Not `deselectAll`, which also
    //   sends note ENTRY back to voice 1 / staff 0 — typing a tempo is not a change of lane.
    this.selection.selectNote(null)
    // Render so the mark is in the DOM for TempoTextSource to measure; openTempoTextEditor then
    // suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTempoTextEditor(created.id, true, '')
    dbg(`✓ Insert tempo on selection: measure ${stop.measure}`
      + ` beat ${fracToNumber(stop.beat).toFixed(3)}`)
  }

  /**
   * Last resort: select the note/rest under the cursor (and arm a pitch drag for a note), or —
   * on empty staff space — hand off to {@link beginBoxSelectOrPan}: select the bar's box on this
   * press and arm the staff-spacing drag if it's on a staff, else arm a pan.
   */
  private handleNoteOrEmptyMouseDown(ctx: MouseDownCtx): void {
    const { engine, event, registry, x, y, closestElement } = ctx
    if (closestElement && closestElement.id) {
      // Gate on the note HEAD (or rest glyph), not a wide radius: clicking the empty
      // staff space around a note — e.g. a space below it to pan — must not select it.
      if (registry.hitsNoteOrRestBody(closestElement, x, y)) {
        this.selection.selectNote(closestElement.id)
        const typeLabel = closestElement.type === 'rest' ? 'Rest' : 'Note'
        dbg(`✓ ${typeLabel} selected on mousedown | id:${closestElement.id}`)
        this.render.renderScore()

        // Arm the drag on a note OR a rest. A rest used to arm nothing at all, because the only
        // gesture here was re-pitch and a rest has no pitch to drag; note spacing gave the
        // horizontal axis a meaning that applies to both — a rest occupies a column exactly as a
        // note does. Which axis this press turns out to be is decided later, from the movement.
        if (closestElement.type === 'note' || closestElement.type === 'rest') {
          this.activeDrag = beginNoteDrag(this.dragHost, this.state, engine, closestElement.id, x, y)
          dbg(`Drag ready | ${closestElement.type}:${closestElement.id}`)
          event.preventDefault()
        }
      } else {
        // Empty space (too far from any element): select-and-grab, or arm a pan.
        this.beginBoxSelectOrPan(ctx)
      }
    } else {
      // Empty space (no element at all): same — select-and-grab, or arm a pan.
      this.beginBoxSelectOrPan(ctx)
    }
  }

  /**
   * A press on empty staff space. If it lands ON a staff inside a bar, select that bar's SINGLE
   * box NOW — on mousedown, not release — and arm the vertical staff-spacing drag, so one
   * fluid press-drag both selects and adjusts the staff's "space above" (no select-then-regrab).
   * A press that misses every staff (the gap between staves, the margins, past the last bar)
   * has no box to grab, so it falls back to arming a pan whose tap-release clears the selection.
   *
   * This is why plain measure-select fires on DOWN: a tap that never drags still lands here,
   * selects the box, and — since the drag never crosses the move threshold — commits nothing
   * (the gesture records nothing — `./drags/staffSpacing`), leaving exactly the old tap-to-select behavior.
   */
  private beginBoxSelectOrPan(ctx: MouseDownCtx): void {
    const { event, x, y } = ctx
    // ⭐ A press on empty space INSIDE the box that was already showing keeps that selection exactly
    //   as it is — a passage extended over several bars survives its own grab — and only arms the
    //   drag. ⛔ Before the re-select below, which would collapse such a passage to one bar.
    if (this.grabSelectedBox(ctx)) return
    if (this.selectMeasureAt(x, y)) {
      this.render.renderScore()
      this.armStaffSpacingDrag(selectedOf(this.state, 'measureRange')!.anchor, y)
      event.preventDefault()
      return
    }
    // Not on a staff/bar: defer to a pan (drag pans; tap-release clears the selection).
    //
    // 🚨 **The box goes BACK before the pan is armed** — his report, 2026-09-22: *"i mark the first
    //   bar… then i drag so im going now in the page… then i decided to go back… the elements of the
    //   bar are highlighted but the blue square disappear."* The press cleared `selectedElement` on
    //   its way past the element chain ({@link boxBeforePress}), and a real pan KEEPS the selection
    //   ({@link handleDocPanUp}) — but kept only what was left, which was the notes and not their box.
    //   The pan's own renders then repainted a passage with no box. A tap-release still decides for
    //   itself: it selects the bar under it or clears everything, so putting the box back here
    //   changes nothing about a tap.
    if (this.boxBeforePress) this.state.selectedElement = this.boxBeforePress
    this.pendingTapCoords = { x, y }
    this.armPan(event, true)
  }

  /**
   * ⭐⭐ **THE RELEASE ENDS THE GESTURE — one call, whichever gesture it was** ({@link Gesture}).
   *
   * This was fourteen sequential `if`s, one per family, each naming its own flag and its own ender —
   * and the list had to be extended by every feature that added a drag. ⭐ Now the gesture carries
   * its own ender, so a new one is a `kind` and an `arm`, ⛔ never a line here.
   *
   * ⚠️ **It is called from THREE places and must stay idempotent**: the canvas's own `mouseup`,
   * {@link onDocMouseUp} (capture phase, so it usually runs first), and {@link handleMouseMove}'s
   * `buttons === 0`. Every ender clears {@link activeDrag}, so the second caller finds nothing —
   * which is what makes three redundant paths safe rather than three commits.
   *
   * ⚠️ A hand/grab PAN is not here: it is resolved by the document-level `handleDocPanUp`, so it
   * settles even when the release lands outside the viewport. See {@link Gesture} for why it is
   * the one exception.
   */
  handleMouseUp(_event: MouseEvent): void {
    if (this.activeDrag?.kind === 'note') dbg(`Drag ended | note:${this.state.selectedNoteId}`)
    this.activeDrag?.end()
  }

  handleClick(event: MouseEvent): void {
    // A pan just ended: swallow the trailing click so a drag in entry mode doesn't drop a
    // stray note on release. Consume the flag here; the defensive reset in handleMouseDown
    // covers the case where the browser never fires this click at all.
    if (this.suppressNextClick) { this.suppressNextClick = false; return }
    if (this.state.editingText) return // modal: a text edit is open (belt; DOM swallows the click-away)
    // Armed paste (e.g. while in entry mode): this click chooses the insertion point.
    if (this.state.pastePlacementArmed) { this.commitArmedPaste(event); return }
    if (this.state.selectedTool === 'selection') return

    dbg(`Click RAW | client:(${event.clientX},${event.clientY})`)

    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) {
      dbg('✗ Click ignored: engine or canvas not ready')
      return
    }
    // Scrollbar/gutter clicks target the scroll container element itself, not the SVG —
    // ignore them so using the scrollbar in entry mode doesn't plant a stray note.
    if (event.target === scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) {
      dbg('✗ Click ignored: SVG not found')
      return
    }

    const coords = this.clientToSvg(event, svg)
    if (!coords) {
      dbg('✗ Click ignored: no CTM')
      return
    }
    const { x, y } = coords

    const registry = engine.getElementRegistry()
    const measureNum = engine.pixelToMeasure({ x, y })

    // Marking tools place at the click; each returns true if it consumed the click.
    if (this.placeTimeSignatureAtClick(engine, measureNum)) return
    if (this.placeClefAtClick(engine, x, y, measureNum)) return
    // ⭐ The KEY SIGNATURE stamp (`./keySignatureStamp`): the key goes at the head of the bar the
    // press landed in — the clef's and the meter's question, ⛔ not the barline's nearest-LINE one.
    // The event travels because `Ctrl`/`Cmd` NARROWS the drop to the staff under the pointer, which
    // is MuseScore's polarity and all four apps' default (plan §5.1).
    if (stampKeySignatureAtClick(this.state, engine, y, measureNum, event, () => this.render.renderScore())) return
    // ⭐ The GROUPING SIGN's armed click — his third case, and the only one that reaches the score
    //   through a click rather than through a selection (`interactions/stamps/groupStamp`).
    if (stampGroupAtClick(this.state, engine, y, measureNum, () => this.render.renderScore())) return
    if (this.placeDynamicAtClick(engine, x, y, measureNum)) return
    if (this.placeDynamicEntryAtClick(engine, x, y, measureNum)) return
    if (this.placeTempoAtClick(engine, x, measureNum)) return
    if (this.placeTempoEntryAtClick(engine, x, measureNum)) return
    if (stampArticulationAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (this.stampAccidentalAtClick(engine, registry, x, y)) return
    if (this.stampTieAtClick(engine, registry, x, y)) return
    if (this.stampDotAtClick(engine, registry, x, y)) return
    if (stampTremoloAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampEnclosureAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (this.stampRestAtClick(engine, x, y)) return
    // The feather stamp's whole click lives in its own module (interactions/stamps/fanStamp); this is the
    // row that gives it a turn.
    if (stampFanAtClick(this.state, engine, x, y, () => this.render.renderScore())) return
    if (stampGraceAtClick(this.state, engine, registry, x, y, () => this.render.renderScore(), id => this.selection.moveCaretTo(id))) return
    // The slur stamp's click lives in its own module too (interactions/stamps/slurStamp); this is its turn.
    if (stampSlurAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampHairpinAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    // …and the TRILL's, the OTTAVA's and the PEDAL's, through the family's one driver
    // (`./spanMarkStamp`) reading their rows in `SPAN_MARK_TOOLS`. Each answers only for its own
    // armed tool, so the order among them decides nothing.
    if (stampSpanMarkAtClick('trill', this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampSpanMarkAtClick('ottava', this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampSpanMarkAtClick('pedal', this.state, engine, registry, x, y, () => this.render.renderScore())) return
    // ⭐ The BARLINE stamp (`./barlineStamp`): its sign goes on the LINE nearest the pointer (a
    // barline is system-wide, so the y only picks the staff band).
    // ⚠️ It takes the PRESS, ⛔ not the clicked bar: his rule of 2026-08-26 is that the sign lands on
    // the line NEAREST THE POINTER. `pixelToMeasure` puts a press on a boundary in the bar to its
    // right, so the bar was an indirection that got it wrong for exactly the presses that were aimed
    // at a barline.
    if (stampBarlineAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return

    // No marking tool armed → note/tuplet entry.
    this.placeNoteAtClick(engine, registry, x, y, measureNum)
  }

  /**
   * Time-signature tool: set/change the measure's time signature (always at beat 0).
   * Propagation + rest reconcile are handled by the engine.
   */
  private placeTimeSignatureAtClick(engine: MusicEngine, measureNum: number): boolean {
    const armed = armedTool(this.state, 'timeSignature')
    const ts = armed?.timeSignature
    if (!ts) return false
    try {
      // The meter, its cautionary and its pickup are ONE act, and the engine owns the sequence —
      // shared with the apply-to-selected-bar path (PaletteController.armTimeSignature), so a click
      // and an OK on a chosen bar cannot drift apart.
      const changed = engine.applyTimeSignatureChange(measureNum, armed)
      dbg(changed
        ? `✓ Time signature set | ${ts.numerator}/${ts.denominator} at measure ${measureNum}`
        : `Time signature unchanged at measure ${measureNum}`)
    } catch (e) {
      console.warn(`✗ Time signature ${ts.numerator}/${ts.denominator} rejected:`, e)
    }
    this.render.renderScore()
    return true
  }

  /**
   * Clef tool: set/change the clef at the nearest slot boundary. A clef change anchors
   * to a slot (beat 0 = the measure's opening clef, drawn at the barline; beat > 0 = an
   * inline mid-measure clef before that slot).
   */
  private placeClefAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    const armed = armedTool(this.state, 'clef')
    const clef = armed?.clef
    if (!clef) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // Anchor the clef to the staff the click landed on (else it changes staff 0's clef).
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const changed = engine.setClefAt(measureNum, beat, clef, staff)
    // The courtesy decision belongs to the change just made. Only written when the arming path
    // carried an opinion, so the older palette path leaves the flag as it found it.
    if (armed.cautionary !== undefined) engine.setCautionaryClefAllowed(measureNum, staff, armed.cautionary)
    dbg(changed
      ? `✓ Clef set | ${clef} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`
      : `Clef unchanged at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    this.render.renderScore()
    return true
  }

  /**
   * Dynamics tool: place a dynamic at the nearest slot boundary. A level mark is
   * interpreted (drives playback); the `'text'` tool drops a silent custom mark.
   * Always placed below the staff.
   *
   * ⭐⭐ SCOPE SEAM: the placed mark carries **NO `voice`, which means it governs EVERY voice of
   * the staff it landed on** (`utils/dynamicScope`, docs/plans/dynamic-voice-scope-plan.md) — the
   * ordinary notation rule, and what the user asked for: *"the default is that it affect ALL"*.
   *
   * ⚠️ This used to write a hardcoded `voice: 0`, and the note here predicted the wrong fix — that
   * the literal would one day be *sourced from a selector*. It should not be sourced at all: the
   * entry voice says which stream you are TYPING INTO, and a dynamic is not typed into a stream.
   * Narrowing the scope is a deliberate second act (`Alt+1…4` on the selected mark), never the
   * by-product of what the palette happened to have armed when the click landed.
   */
  private placeDynamicAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    const tool = armedTool(this.state, 'dynamic')?.dynamic
    if (!tool) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // Anchor the mark to the STAFF the click landed on (else it renders on staff 0).
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const staffId = engine.staffIdForIndex(staff)
    const staffParam = staffId ? { staffId } : {}
    engine.dynamic.addDynamic(measureNum, { beat, text: dynamicTextFromTool(tool), placement: 'below', ...staffParam })
    dbg(`✓ Dynamic ${tool} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    this.render.renderScore()
    return true
  }

  /**
   * Ctrl+E expression-entry tool (armed with nothing selected): the click places a custom-text
   * dynamic on the nearest slot of the clicked bar/staff and opens the inline editor BLANK to type
   * it — the click-to-place twin of {@link editDynamicOnSelection}. Single-shot: it disarms back to
   * selection mode (this is expression entry, not a repeat stamp). The placeholder text only exists
   * so the mark renders a real box for the overlay to position against; the editor opens blank
   * (seedText `''`) and, being `isNew`, deletes the mark on an empty commit.
   */
  private placeDynamicEntryAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    if (!armedTool(this.state, 'dynamicEntry')) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const staffId = engine.staffIdForIndex(staff)
    const staffParam = staffId ? { staffId } : {}
    // ⭐ A PREVIEW until the text is typed — `editDynamicOnSelection`'s reason.
    const created = engine.dynamic.placeDynamicForTyping(measureNum, { beat, text: DEFAULT_DYNAMIC_TEXT, placement: 'below', ...staffParam })
    // Disarm to selection mode either way — the click is consumed. (Reassign, never mutate: the
    // observable Proxy only traps the SET.)
    this.state.selectedMarkingTool = null
    this.state.selectedTool = 'selection'
    if (!created) { this.render.renderScore(); return true }
    // Render so registerDynamics stores the mark's bbox; openTextEditor snapshots its position, then
    // immediately suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTextEditor(created.id, true, '')
    dbg(`✓ Expression entry: dynamic at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)} staff ${staff}`)
    return true
  }

  /**
   * Ctrl+Alt+T tempo-entry tool (armed with nothing selected): the click places a tempo mark at the
   * nearest slot of the clicked bar and opens the edit box BLANK to type it — the click-to-place twin
   * of {@link editTempoOnSelection}. Single-shot: it disarms back to selection mode. NO staff (tempo
   * is system-level); the placeholder text only exists so the mark renders a measurable box.
   */
  private placeTempoEntryAtClick(engine: MusicEngine, x: number, measureNum: number): boolean {
    if (!armedTool(this.state, 'tempoEntry')) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // ⭐ A PREVIEW until the text is typed — `editTempoAt`'s reason.
    const created = engine.tempo.placeTempoMarkForTyping(measureNum, { beat, text: DEFAULT_TEMPO_TEXT })
    // Disarm to selection mode either way — the click is consumed. (Reassign, never mutate.)
    this.state.selectedMarkingTool = null
    this.state.selectedTool = 'selection'
    if (!created) { this.render.renderScore(); return true }
    // Render so the mark is in the DOM for TempoTextSource to measure; openTempoTextEditor then
    // suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTempoTextEditor(created.id, true, '')
    dbg(`✓ Tempo entry: mark at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
    return true
  }

  /**
   * Tempo tool: place the armed mark at the nearest slot boundary of the clicked bar.
   *
   * NO staff and NO voice, deliberately — unlike `placeDynamicAtClick`, which anchors the
   * mark to the staff the click landed on. A tempo mark governs the clock, so clicking any
   * staff of a grand staff places ONE system-level mark (rendered above the top staff).
   * The armed preset carries the word/unit/bpm; the click supplies only the beat.
   */
  private placeTempoAtClick(engine: MusicEngine, x: number, measureNum: number): boolean {
    const tool = armedTool(this.state, 'tempo')?.tempo
    if (!tool) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // The TOOL is a form (word? metronome? bracketed?); the MARK is the text that form produces.
    // `tempoFieldsFromTool` is the one place the two meet — from then on the string is the truth,
    // and deleting the brackets in the editor deletes them for good. The ghost preview goes
    // through it too, so what you see under the cursor is what gets engraved.
    const created = engine.tempo.addTempoMark(measureNum, { beat, ...tempoFieldsFromTool(tool) })
    if (created) {
      dbg(`✓ Tempo ${tempoLabel(created)} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
    }
    this.render.renderScore()
    return true
  }

  /**
   * Accidental stamp tool: a click SETS the armed accidental on the hovered note, changing its
   * pitch (existing notes only). Mirrors `stamps/articulationStamp` — same note-body hit-test,
   * one `runBatch` = one undo — but SINGLE-valued and IDEMPOTENT: clicking a note that already shows
   * that accidental does nothing (removal is the Delete key, not a re-stamp). Consumes any click
   * while the tool is armed (returns true) so a near-miss doesn't fall through to note entry.
   */
  private stampAccidentalAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const accidental = armedTool(this.state, 'accidental')?.sign
    if (!accidental) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Accidental stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Accidental stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (engine.noteDisplaysAccidental(noteId, accidental)) {
      dbg(`· Accidental stamp: note ${noteId} already shows ${accidental} — no change`)
      return true
    }
    engine.runBatch(`Set ${accidental}`, () => engine.setNoteAccidental(noteId, accidental))
    dbg(`✓ Accidental stamped | ${accidental} on note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Tie stamp tool: a click TIES the note clicked to the next slot in its own voice and staff (the
   * engine resolves the target — same pitch where there is one, else a let-ring tie into whatever
   * is there). Mirrors {@link stampAccidentalAtClick} — same note-body hit-test, one `runBatch` =
   * one undo, IDEMPOTENT: clicking an already-tied note does nothing, because a stamp only ever
   * ADDS (removal is Delete, or the Keypad with the tie itself selected). A note with nothing after
   * it is a no-op too — `toggleTie` finds no candidate and returns null. Consumes any click while
   * the tool is armed (returns true) so a near-miss doesn't fall through to note entry.
   */
  private stampTieAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    if (!armedTool(this.state, 'tie')) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Tie stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Tie stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (note.tiedTo) {
      dbg(`· Tie stamp: note ${noteId} is already tied — no change`)
      return true
    }
    // toggleTie commits its own undo entry; runBatch keeps the stamp's shape identical to its
    // siblings (one click = one undo) and is what marks the model dirty for the repaint.
    engine.runBatch('Add tie', () => engine.toggleTie(noteId))
    dbg(`✓ Tie stamped | from note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Dot stamp tool: a click DOTS the note clicked. Mirrors its siblings — same note-body hit-test,
   * one `runBatch` = one undo, IDEMPOTENT (an already-dotted note is a no-op, since a stamp only
   * ever adds; removal is Delete or the Keypad with the dots selected).
   *
   * The one stamp that ALSO applies to RESTS: a rest takes a dot exactly as a note does, so there is
   * no `isRest` guard here. Dotting can still be REFUSED when it does not fit (a dotted rest needs
   * 3 beats where 2 remain, and the bar reflows around what does fit) — the model coerces `dots`
   * back to 0 rather than throwing, so report what actually happened instead of assuming.
   */
  private stampDotAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    if (!armedTool(this.state, 'dot')) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Dot stamp: click not on a note or rest — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note) {
      dbg(`· Dot stamp: non-note — no change`)
      return true
    }
    if (note.dots) {
      dbg(`· Dot stamp: ${noteId} already has ${note.dots} dot(s) — no change`)
      return true
    }
    engine.runBatch('Add dot', () => engine.updateNote(noteId, { dots: 1 }))
    if (engine.getNote(noteId)?.dots) dbg(`✓ Dot stamped | on ${note.isRest ? 'rest' : 'note'} ${noteId}`)
    else dbg(`· Dot stamp: no room to dot ${noteId} — the bar cannot hold the longer value`)
    this.render.renderScore()
    return true
  }

  /**
   * Rest stamp tool: a click PLACES a rest of the armed length at that position, replacing what it
   * covers. It is note entry with `isRest`, and behaves like it — click anywhere in the bar, not on
   * a glyph. (See MusicEngine.stampRestAtPosition for why it is not a hit-test.)
   *
   * Still the odd one out among the stamps: the others ADD a mark to the note clicked and are
   * idempotent; this one replaces the slot, so clicking a note destroys it. That is the point.
   *
   * The cursor's Y picks only the STAFF — a rest has no pitch, so the click chooses a slot and the
   * rest lands at its standard height. The ghost floats with the pointer to show WHAT is being
   * placed, the same split every stamp makes (the accidental ghost hovers, then lands on a note).
   */
  private stampRestAtClick(engine: MusicEngine, x: number, y: number): boolean {
    if (!armedTool(this.state, 'rest')) return false

    const rest = engine.stampRestAtPosition(
      { x, y },
      this.state.selectedDuration,
      this.state.selectedDots,
      activeVoiceToModel(this.state.activeVoice),
    )
    if (rest) {
      dbg(`✓ Rest stamped | ${rest.duration}${'.'.repeat(rest.dots ?? 0)} at m${rest.measure} b${fracToNumber(rest.beat).toFixed(3)}`)
      // PLACING something is what ends keyboard entry — not arming the tool (see armMarkingTool).
      // The caret is `selectedNoteId` in entry mode, so dropping it takes the caret down and leaves
      // you stamping with the mouse, which is what you just did. The tool stays armed: a stamp is
      // used in runs, and you have said nothing about being finished with it.
      this.state.selectedNoteId = null
      this.render.renderScore()
    }
    return true
  }

  /** Default click action when no marking tool is armed: enter a note or tuplet. */
  private placeNoteAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number, measureNum: number): void {
    const nearestElement = registry.findNearestNoteOrRest(x, measureNum)
    const elementAt = registry.getAt(x, y)
    dbg(`Click | svg:(${x.toFixed(0)},${y.toFixed(0)}) measure:${measureNum} | nearestElement:`, nearestElement ? {
      type: nearestElement.type,
      beat: nearestElement.beat,
      bbox: `(${nearestElement.bbox.x.toFixed(0)},${nearestElement.bbox.y.toFixed(0)}) ${nearestElement.bbox.width.toFixed(0)}x${nearestElement.bbox.height.toFixed(0)}`,
    } : null, '| elementAt:', elementAt?.type || null)

    try {
      if (this.state.armedTuplet) {
        const score = engine.getScore()
        const measure = score.measures.find(m => m.number === measureNum)
        const barQuarters = measure
          ? measureCapacityQuarters(measure)
          : 4
        const position = engine.pixelToPosition({ x, y }, barQuarters)
        const existingTuplet = engine.getTupletAtBeat(measureNum, position.beat, activeVoiceToModel(this.state.activeVoice))

        if (existingTuplet) {
          dbg(`Tuplet mode: clicking inside existing tuplet at beat ${fracToNumber(position.beat).toFixed(3)}, adding note instead`)
          const note = engine.addNoteAtPosition(
            { x, y },
            this.state.selectedDuration,
            this.state.selectedAccidental || undefined,
            this.state.selectedDots || undefined,
            this.getPendingArticulations(),
            this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
            activeVoiceToModel(this.state.activeVoice),
            this.state.selectedTremolo ?? undefined,
            this.state.selectedEnclosure ?? undefined, this.state.selectedCue || undefined,
          )

          if (note) {
            const pitch = note.isRest ? 'rest' : formatPitch(note)
            dbg(`✓ Note added to tuplet | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
            this.selection.moveCaretTo(note.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            dbg('✗ Note NOT added to tuplet (collision or invalid location)')
          }
        } else {
          // Spell the first note against the CLICKED staff's clef (bass 2nd staff ≠ treble).
          const tupletStaff = registry.staffIndexAtY(measureNum, y)
          const naturalSpelling = registry.pixelYToPitch(y, measureNum, x, tupletStaff)
          const spelling: PitchSpelling = naturalSpelling
            ? { ...naturalSpelling, alter: accidentalToAlter(this.state.selectedAccidental) }
            : { step: 'B', alter: 0, octave: 4 }

          // M is decided HERE, not when the key was pressed: `Ctrl+5` says "a 5", and what a 5 is in
          // the time of comes from the meter of the bar being clicked (see armedTupletM).
          const notesOccupied = armedTupletM(
            this.state.armedTuplet,
            this.state.selectedDuration,
            this.state.selectedDots,
            (measure ?? score.measures[0]).timeSignature,
            position.beat,
          )

          const result = engine.createTupletAtPosition(
            { x, y },
            this.state.selectedDuration,
            spelling,
            this.state.armedTuplet.numNotes,
            notesOccupied,
            activeVoiceToModel(this.state.activeVoice),
            this.state.selectedDots,
            armedNormalSide(this.state.armedTuplet),
            this.state.armedTuplet.format,
          )

          if (result) {
            const fn = result.firstNote
            const fnPitch = formatPitch(fn)
            dbg(`✓ Tuplet created | tupletId:${result.tuplet.id} firstNote:${fnPitch} measure:${fn.measure} beat:${fracToNumber(fn.beat).toFixed(3)}`)
            // The group exists now, so the ratio has been spent: the clicks that follow fill it as
            // ordinary notes (see spendArmedTuplet). Entry mode STAYS — you are still writing.
            spendArmedTuplet(this.state)
            this.selection.moveCaretTo(result.firstNote.id)
            this.state.selectedTool = 'entry'
            this.render.renderScore()
          } else {
            dbg('✗ Tuplet NOT created (collision or invalid location)')
          }
        }
      } else {
        const note = engine.addNoteAtPosition(
          { x, y },
          this.state.selectedDuration,
          this.state.selectedAccidental || undefined,
          this.state.selectedDots || undefined,
          this.getPendingArticulations(),
          this.state.selectedBeam !== 'auto' ? this.state.selectedBeam : undefined,
          activeVoiceToModel(this.state.activeVoice),
          // The armed entry tremolo — read straight off state like the duration/accidental/dots
          // beside it, so the entered note is BORN with the mark (one undo entry, and the
          // cross-barline split carries it to every piece).
          this.state.selectedTremolo ?? undefined,
          this.state.selectedEnclosure ?? undefined, this.state.selectedCue || undefined,
        )

        if (note) {
          const pitch = note.isRest ? 'rest' : formatPitch(note)
          dbg(`✓ Note added | ${pitch} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}`)
          this.selection.moveCaretTo(note.id)
          this.state.selectedTool = 'entry'
          this.render.renderScore()
        } else {
          dbg('✗ Note NOT added (collision or invalid location)')
        }
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Cannot add note: ' + (error as Error).message)
    }
  }

  handleMouseMove(event: MouseEvent): void {
    // 🚨 **THE BUTTON CAME UP WHERE WE COULD NOT SEE IT.** A release outside the BROWSER WINDOW fires
    // no `mouseup` anywhere — not on the canvas and not on `document` — so the drag would still be
    // armed when the hand comes back, and the wedge (or note, or slur) would follow a pointer with
    // no button held. His report, 2026-08-20. `buttons` is the truth every move carries: 0 means
    // nothing is pressed, whatever we last saw.
    if (event.buttons === 0 && this.isMouseButtonDown) {
      this.isMouseButtonDown = false
      this.handleMouseUp(event)
    }
    if (this.state.editingText) return // modal: suppress ghost/preview while a text edit is open
    const engine = this.getEngine()
    const scoreCanvas = this.getScoreCanvas()
    if (!engine || !scoreCanvas) return

    const svg = scoreCanvas.querySelector('svg') as SVGSVGElement | null
    if (!svg) return

    const coords = this.clientToSvg(event, svg)
    if (!coords) return
    const { x, y } = coords

    this.lastCanvasMousePosition = { x, y }

    // ⭐ An armed paste draws NOTHING at the pointer — his call, 2026-08-19: *"we dont need the green
    // carret, just the arrow"*. The blue place-cursor (`scoreCursorClass`) is the whole indicator,
    // so a move costs no render at all where the caret used to force one per frame. The guard stays:
    // an armed paste must not draw a TOOL ghost underneath itself either.
    if (this.state.pastePlacementArmed) return

    // The gesture in flight takes the move (`./drags/`) — unless it says the move is not yet its own.
    if (this.activeDrag && this.activeDrag.move(engine, x, y) !== false) return

    // A hand/grab pan is armed: bail before the ghost/preview logic. The pan itself is
    // driven by the document-level handlers (handleDocPanMove) so it keeps working when
    // the pointer leaves the viewport — this element handler only needs to not draw a
    // ghost note underneath the gesture.
    if (this.isPanArmed) return

    if (this.state.selectedTool === 'selection') return
    if (this.isMouseButtonDown) return

    // No throttle: since P4 the ghost is an overlay, so following the cursor costs one small
    // draw rather than a re-layout of the whole score. The old 50 ms gate existed only to
    // ration that cost, and capped the preview at 20 fps (docs/history/render-performance-plan.md §5b).
    this.render.renderToolGhost({ x, y })
  }

  /**
   * ⚠️ EXPLORATORY INSTRUMENT (2026-08-31, `./dragTrace`) — **where a mark's glyph really is on the
   * page**, in the viewport's own pixels, straight off the DOM.
   *
   * 🚨 It exists because every other number in the tempo trace is the MODEL's or the registry's, and
   * both of those move when a transform is written whether or not the ink did. ⛔ Null when the
   * glyph is not in this render's SVG — which is itself an answer.
   */
  private drawnMarkX(id: string): number | null {
    const el = this.getScoreCanvas()?.querySelector(`[id="${id}"]`) as SVGGraphicsElement | null
    return el ? el.getBoundingClientRect().x : null
  }

  /** A press on a square opens its gesture (`./drags/markEnd`). ⚠️ The caller prevents the default
   *  itself, armed or not: the press has already picked the square. */
  private armMarkEndDrag(kind: MarkEndKind, coords: { x: number; y: number }): void {
    const gesture = beginMarkEndDrag(this.dragHost, kind, selectedOf(this.state, kind), coords.x, coords.y)
    if (gesture) this.activeDrag = gesture
  }

  /**
   * ⭐⭐ **THE POINTER LEFT THE CANVAS — and that ends NOTHING.** It clears the HOVER state (the
   * tool ghost, the place-cursor, the last position) and nothing else.
   *
   * 🚨 His report, 2026-08-21: *"i move up and then i dont release the mouse but went out of the
   * viefinder and when i go back im not editing the slur… this is wrong"*. A gesture belongs to the
   * hand that is performing it, and the edge of a viewport is not a decision the hand made.
   *
   * ⭐ With the button still DOWN the gesture stays armed and keeps tracking, because
   * {@link onDocMouseMove} drives it from the document — the pan's own mechanism, one rule wider.
   * ⛔ And no re-render either: it would draw over a live preview.
   *
   * ⭐⭐ **With the button UP there is nothing left to end** — the release has already been settled.
   * {@link handleMouseUp} is the only thing that ends a drag, and it is reached by three paths that
   * between them see every release ({@link Gesture}). ⚠️ Until 2026-08-24 six of the fourteen
   * gestures were ALSO torn down here by name; that list had fallen four gestures behind, and by then
   * it could not run at all — both assignments of `isMouseButtonDown = false` call `handleMouseUp`
   * first, so past the guard below every gesture is already over. It was dead code from the day the
   * document listener landed.
   */
  handleMouseLeave(): void {
    const engine = this.getEngine()
    if (!engine) return

    // A hand/grab pan must SURVIVE the pointer leaving the viewport — it's driven by the
    // document-level handlers and ends on the real mouseup wherever that happens. Bail
    // here so we don't tear it down or re-render underneath it.
    if (this.isPanArmed || this.isPanning) return
    if (this.isMouseButtonDown) return

    this.lastCanvasMousePosition = null
    this.render.renderScore()
    this.state.showCursor = true
  }
}
