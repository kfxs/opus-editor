import { dbg } from '@/utils/debug'
import type { ArticulationType, PitchSpelling, Fraction, Note, SlurSegmentAddress } from '../types/music'
import type { MusicEngine, BarWidthRoom } from '../engine/MusicEngine'
import type { ElementInfo, ElementRegistry, ElementType } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, armedTool, armedNormalSide, armedTupletM, selectedOf, spendArmedTuplet } from './EditorState'
import { tempoLabel } from '../utils/tempoMap'
import { tempoFieldsFromTool } from '../utils/tempoText'
import { TempoTextSource } from './TempoTextSource'
import type { SelectionController } from './SelectionController'
import type { RenderController } from './RenderController'
import type { TextEditController } from './TextEditController'
import type { ClipboardController } from './ClipboardController'
import { DynamicTextSource } from './DynamicTextSource'
import { fracToNumber, fracEq } from '../utils/fraction'
import { dynamicTextFromTool, DEFAULT_DYNAMIC_TEXT } from '../utils/dynamics'
import { staffOf } from '@/utils/lanes'
import { stampFanAtClick } from './fanStamp'
import { stampSlurAtClick } from './slurStamp'
import { cpsFromDrawnControlPoints } from './slurHandleNudge'
import { stampTrillAtClick } from './trillStamp'
import { stampOttavaAtClick } from './ottavaStamp'
import { stampPedalAtClick } from './pedalStamp'
import { stampHairpinAtClick } from './hairpinStamp'
import { ELEMENT_HIT_ORDER, type ElementChainDeps, type MouseDownCtx } from './elements/chain'
import { articulationHit } from './elements/articulation'
/** Placeholder for a Ctrl+Alt+T tempo mark — exists only so the mark renders a measurable box; the
 *  edit box opens blank over it and an empty commit deletes it, so it is never actually seen. */
const DEFAULT_TEMPO_TEXT = 'Tempo'
import { measureSelectableNotes, beatToFrac } from '../utils/musicUtils'
import { measureCapacityQuarters } from '../utils/measureCapacity'
import { spellingToMidi, accidentalToAlter, formatPitch } from '../utils/pitchSpelling'

/** Registry element types that are staff background / structure rather than clickable
 *  notational objects. A Ctrl+Shift+click landing only on one of these is still "empty
 *  space" for the measure-box gesture (see handleModifierMouseDown). */
const MEASURE_BOX_IGNORE_TYPES = new Set<ElementType>(['staff', 'barline', 'beam'])

/** Vertical margin (px) added above/below a staff's five lines to define the band a plain
 *  click must land in to select that bar. Matches the drawn single box's ±12 extent
 *  (HighlightController.applyMeasureBox), so "click where the box would be → select"; a click
 *  in the GAP between two staves falls outside every band and selects nothing. */
const STAFF_BAND_PAD_PX = 12

/**
 * Handles all mouse interactions: clicks, drags, ghost-note preview.
 * Framework-agnostic: no Vue/React/Angular imports.
 * Call setup() after mount and teardown() before unmount.
 */
export class MouseController {
  // --- Internal ephemeral state (not in EditorState — not needed for reactivity) ---
  private lastCanvasMousePosition: { x: number; y: number } | null = null
  private isMouseButtonDown = false
  private isDraggingNote = false
  private draggedNoteOriginalPitch: PitchSpelling | null = null
  /**
   * Which gesture a note/rest drag turned out to be — **decided on the evidence, not on the
   * press** (the hand/pan plan's shape). `undecided` until the cursor has travelled far enough to
   * mean something, then the dominant axis picks: vertical → re-pitch, horizontal → note spacing.
   *
   * This is why the gate below is a DISTANCE and not the old elapsed-time one. A time gate can only
   * answer "has the user committed to dragging"; it cannot say to what. Under it, a horizontal drag
   * that wandered one staff step re-pitched the note before any axis could be read — the pitch edit
   * fired on the first frame past 150 ms in whichever direction the cursor happened to be.
   */
  private noteDragAxis: 'undecided' | 'pitch' | 'spacing' = 'undecided'
  /** Press point in svg coords — the origin both the axis decision and the spacing delta measure
   *  from. Null when no note/rest drag is armed. */
  private noteDragStart: { x: number; y: number } | null = null

  // --- Note-spacing drag (the horizontal branch of the note drag; docs/note-spacing-plan.md §5) ---
  /** The column being spaced: a space belongs to a (measure, beat), never to the grabbed note. */
  private spacingDragColumn: { measure: number; beat: Fraction } | null = null
  /** The space already authored there when the drag began — the delta rides on top of it. */
  private spacingDragBaseline = 0
  /** The leftward floor, measured ONCE off the picture the user grabbed. Re-measuring per frame
   *  would judge the gesture against a score that is moving because of the gesture. */
  private spacingDragMinSpace = 0
  /** Staff-line spacing (px) on the grabbed note's own staff — the divisor that turns the cursor's
   *  pixel delta into staff-spaces. Its OWN field, not the slur drag's `draggedStaffSpacePx`:
   *  that one is written only when a slur handle is grabbed, so borrowing it would silently scale
   *  this gesture by whatever slur was dragged last. */
  private spacingDragStaffSpacePx = 10
  private spacingDragChanged = false

  // --- Bar-width drag (docs/bar-width-plan.md P2) ---
  /** The bar whose ENDING barline is being dragged, with everything the gesture needs — captured
   *  ONCE at the grab, off the picture the user actually grabbed. Null when no drag is live: the
   *  press stays a plain barline selection. */
  private barWidthDrag: { measure: number; room: BarWidthRoom } | null = null
  /** SVG x at the grab. The gesture is horizontal only — the target is a barline, so unlike the
   *  note drag there is no axis contest and no dominant-axis rule to run. */
  private barWidthDragStartX = 0
  private barWidthDragChanged = false
  /** True while the drag is tracking but the bar is refusing the value — logged on the transition
   *  in, not per frame. Reset on every accepted move and when the drag ends. */
  private barWidthDragBlocked = false
  /** The casting-off the captured room describes (`MusicEngine.barWidthLineKey`). When the drag
   *  re-wraps the system this changes, and the room has to be re-taken — see the drag handler. */
  private barWidthDragLineKey: string | null = null
  /** True once the press has left the dead zone; until then it is still just a click. */
  private isDraggingBarWidth = false

  // --- Clef drag state (selection-tool drag, across slots and measures) ---
  private isDraggingClef = false
  private draggedClefMeasure: number | null = null      // current measure (updates during drag)
  private draggedClefBeat: Fraction | null = null        // current beat (updates during drag)
  private draggedClefStartMeasure: number | null = null  // measure at drag start (no-op check)
  private draggedClefStartBeat: Fraction | null = null   // beat at drag start (no-op check)
  private clefDragStartTime: number | null = null

  // --- Slur control-point handle drag (reshape the selected slur's curve) ---
  private isDraggingSlurHandle = false
  private draggedSlurId: string | null = null
  private draggedCpIndex: 0 | 1 | undefined = undefined
  private draggedSlurEndpoints: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number } | null = null
  /** The slur's [cp0, cp1] at drag start; the non-dragged control point is held fixed. */
  private draggedSlurBaselineCps: [{ x: number; y: number }, { x: number; y: number }] | null = null
  /** Stave line spacing (px) where the dragged slur was drawn — converts the new pixel
   *  shape to staff-spaces before storing (the override is resolution-independent). */
  private draggedStaffSpacePx = 10
  /** For a cross-system slur, which segment the grabbed handle reshapes (begin/end/middle
   *  ordinal). Undefined = a same-line single arc → routes to the slur's `curveShape`. */
  private draggedSlurSegment: SlurSegmentAddress | undefined = undefined
  /** Live system count carried from the handle, written as the `segmentCurveShape` reset
   *  signature (only used when `draggedSlurSegment` is set). */
  private draggedSlurSpanCount: number | undefined = undefined
  private slurDragChanged = false
  private slurDragStartTime: number | null = null

  // --- Slur endpoint handle drag (re-anchor the selected slur's in/out point) ---
  private isDraggingSlurEndpoint = false
  private draggedEndpointSlurId: string | null = null
  private draggedEndpoint: 'start' | 'end' | undefined = undefined
  /** True once a preview re-anchor fired, so the drop records one undo entry. */
  private slurEndpointDragChanged = false
  private slurEndpointDragStartTime: number | null = null

  // --- Staff-spacing vertical drag (Sibelius "space above staff" — Client #7) ---
  private isDraggingStaffSpacing = false
  private draggedSpacingStaff = 0            // staff index being spaced
  private draggedSpacingMeasure = 0          // a measure on the target SYSTEM (per-system key)
  private draggedSpacingBaseline = 0         // its `above` (staff-spaces) at drag start
  private draggedSpacingStartY = 0           // cursor Y (px) at drag start
  private staffSpacingDragChanged = false
  private staffSpacingDragStartTime: number | null = null

  /** Max cursor→notehead distance (px) for an endpoint drag to snap onto a note. */
  private readonly SLUR_ENDPOINT_SNAP_PX = 60

  private readonly DRAG_TIME_THRESHOLD_MS = 150

  /** Min cursor travel (px) before a note/rest press becomes a drag AND picks its axis. The same
   *  dead-zone idea as {@link PAN_THRESHOLD_PX}, a little wider: this one also has to tell two
   *  gestures apart, and 4px of jitter is a coin toss between them. */
  private readonly NOTE_DRAG_THRESHOLD_PX = 6

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
    const wasPanning = this.isPanning
    const clears = this.pendingTapClearsSelection
    const tapCoords = this.pendingTapCoords
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

  // --- Manual double-click detection for the in-canvas text editor (the native
  // dblclick event is defeated by the re-render-on-select swapping SVG nodes) ---
  private lastDynamicDownId: string | null = null
  private lastDynamicDownTime = 0
  private lastTempoDownId: string | null = null
  private lastTempoDownTime = 0
  private readonly DOUBLE_CLICK_MS = 400

  private readonly onDocMouseDown = () => { this.isMouseButtonDown = true }
  private readonly onDocMouseUp = () => {
    this.isMouseButtonDown = false
    // A bar-width drag is settled HERE as well as in the element's own handler, because a release
    // outside the viewport never reaches that one — and this drag hides the pointer and holds an
    // uncommitted preview, so being left armed is not a harmless leak: the score keeps re-sizing
    // under the next mouse move with no button held, and the cursor stays invisible. Capture-phase,
    // so it lands before `handleMouseUp`; whichever runs first clears the state and the other
    // no-ops.
    if (this.barWidthDrag) this.endBarWidthDrag()
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
  }

  /** Remove document-level event listeners. Call on unmount. */
  teardown(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown, true)
    document.removeEventListener('mouseup', this.onDocMouseUp, true)
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
    const registry = engine.getElementRegistry()
    const els = registry.getByMeasure(measureNum)
      .filter(e => (e.type === 'note' || e.type === 'rest') && e.beat !== undefined)

    let bestBeatNum = 0
    let bestDist = Infinity
    for (const e of els) {
      const dist = Math.abs(x - e.bbox.x)
      if (dist < bestDist) {
        bestDist = dist
        bestBeatNum = e.beat as number
      }
    }

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
    // keeps single-staff output byte-identical. Voice 0 — see the VOICE SEAM note above.
    const staffId = engine.staffIdForIndex(staffOf(note))
    const staffParam = staffId ? { staffId } : {}
    const created = engine.addDynamic(note.measure, {
      beat: note.beat, text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below', ...staffParam,
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
    const staff = engine.getElementRegistry().staffIndexAtY(measure, coords.y)
    dbg(`Paste placement click | measure:${measure} beat:${fracToNumber(beat)} staff:${staff}`)
    this.clipboard.pasteAt(measure, beat, staff)
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
    armClefDrag: (clef, event) => this.armClefDrag(clef, event),
    armBarWidthDrag: (measure, x) => {
      const engine = this.getEngine()
      if (engine) this.armBarWidthDrag(engine, measure, x)
    },
    isDoubleClick: (mark, id) => this.pressIsDoubleClick(mark, id),
    openEditor: (mark, id) => {
      if (mark === 'tempo') this.openTempoTextEditor(id, false)
      else this.openTextEditor(id, false)
    },
  }

  /**
   * Arm the horizontal drag for a MOVABLE clef (every clef except the big line-start one),
   * recovering the exact `Fraction` beat from the model — the pixel beat on the registry entry is
   * rounded, and a drag has to move the real change.
   *
   * Freezes line breaks so sliding the clef re-pitches notes without reflowing the score; we settle
   * the layout on drop.
   */
  private armClefDrag(clefAt: ElementInfo, event: MouseEvent): void {
    if (clefAt.immovable || clefAt.measure === undefined) return
    const engine = this.getEngine()
    if (!engine) return
    const measure = engine.getScore().measures.find(m => m.number === clefAt.measure)
    const approxBeat = clefAt.beat ?? 0
    const change = measure?.clefs?.find(c => Math.abs(fracToNumber(c.beat) - approxBeat) < 1e-6)
    if (!change) return
    this.isDraggingClef = true
    this.draggedClefMeasure = clefAt.measure
    this.draggedClefBeat = change.beat
    this.draggedClefStartMeasure = clefAt.measure
    this.draggedClefStartBeat = change.beat
    this.clefDragStartTime = Date.now()
    engine.setLayoutFrozen(true)
    engine.setDraggingClef({ measure: clefAt.measure, beat: change.beat })
    event.preventDefault()
  }

  /**
   * Record this press on a tempo mark / dynamic and answer whether it was the SECOND on the same
   * one inside the double-click window, consuming the pair when it was (so a third click is not
   * another double).
   *
   * ⚠️ Manual, not the native `dblclick` event: selecting re-renders the score on every mousedown,
   * which swaps the SVG nodes, so the two clicks land on different element instances and the
   * browser never fires it.
   */
  private pressIsDoubleClick(mark: 'tempo' | 'dynamic', id: string): boolean {
    const now = Date.now()
    const lastId = mark === 'tempo' ? this.lastTempoDownId : this.lastDynamicDownId
    const lastTime = mark === 'tempo' ? this.lastTempoDownTime : this.lastDynamicDownTime
    const isDouble = lastId === id && (now - lastTime) < this.DOUBLE_CLICK_MS
    const keptId = isDouble ? null : id // consume, so a 3rd click isn't another double
    if (mark === 'tempo') {
      this.lastTempoDownId = keptId
      this.lastTempoDownTime = now
    } else {
      this.lastDynamicDownId = keptId
      this.lastDynamicDownTime = now
    }
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
    if (this.handleStaffSpacingMouseDown(ctx)) return

    // Whatever was picked is gone; the handlers below each set what this press picked instead.
    // ⭐ ONE assignment — this used to be twelve fields, and the third of four clear-lists that had
    // to agree (it was the one missing the accidental, articulation, dot, stem and tremolo).
    this.state.selectedElement = null

    // Single-click element hit-tests, in priority order — one entry per selectable kind, each
    // consuming the press or declining it. ⭐ THE ORDER IS THE CONTENT and it lives in
    // {@link ELEMENT_HIT_ORDER}, with the comments that argue it: the dot before the note, the
    // tremolo before the stem, the barline last of all. Twelve `if`s here, and twelve bodies four
    // hundred lines below, said the same thing in two places that could disagree.
    for (const element of ELEMENT_HIT_ORDER) {
      if (element.hit(ctx, this.elementDeps)) return
    }
    this.handleNoteOrEmptyMouseDown(ctx)
  }

  /**
   * Ctrl/Cmd or Shift click → build a multi-selection (notes/articulation groups
   * only). Always "consumes" the press when a modifier is held (it never falls
   * through to single-select), so returns true whenever additive/range is active.
   */
  private handleModifierMouseDown(ctx: MouseDownCtx): boolean {
    const { event, registry, x, y, closestElement } = ctx
    // Modifier clicks build a multi-selection (Phase 1: notes only, so they ignore
    // every other element kind, never clear the set, and arm no drag — clicking
    // empty space or a non-note element is a no-op):
    //   - Shift  → select the temporal range pivot→target (rests + whole chords),
    //              unioned onto the existing selection (range wins when both held).
    //   - Ctrl/Cmd → toggle the clicked note in/out.
    const additive = event.ctrlKey || event.metaKey
    const range = event.shiftKey
    if (!(additive || range)) return false

    // Any modifier press dismisses a showing measure box — but capture the current span
    // FIRST so a Ctrl+Shift+click can extend from its anchor (re-set in selectMeasureBox).
    const prevRange = selectedOf(this.state, 'measureRange')
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
    if (closestElement && closestElement.id) {
      const bbox = closestElement.bbox
      const centerX = bbox.x + bbox.width / 2
      let elementY: number
      if (closestElement.type === 'note' && closestElement.pitch !== undefined && closestElement.measure !== undefined) {
        const pitchY = registry.pitchToPixelY(closestElement.pitch, closestElement.measure, centerX, closestElement.staff)
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
    const ids = measureSelectableNotes(m, score).filter(n => staffOf(n) === staff).map(n => n.id)
    if (!ids.length) return false

    this.selection.selectMeasureContents(ids)
    // AFTER selectMeasureContents, which clears the element selection on its way through.
    this.state.selectedElement = {
      kind: 'measureRange', anchor: measure, focus: measure, staff, boxStyle: 'single',
    }
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
          const noteY = registry.pitchToPixelY(note.pitch, note.measure, note.bbox.x + note.bbox.width / 2, note.staff)
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

    // Slur control-point handle drag.
    const handle = registry.getByType('slur-handle').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    })
    // The handle carries its OWN segment's drag context (endpoints + control points +
    // staff spacing + segment address + span count), so we read everything straight off it
    // — no re-lookup of a 'slur' partial, which on a cross-system slur would ambiguously
    // resolve to the wrong segment (§4a). cpIndex disambiguates the two dots within it.
    if (handle?.slurId === selectedSlur.id && handle.cpIndex !== undefined
        && handle.slurEndpoints && handle.controlPoints) {
      this.isDraggingSlurHandle = true
      this.draggedSlurId = handle.slurId
      this.draggedCpIndex = handle.cpIndex
      this.draggedSlurEndpoints = handle.slurEndpoints
      // The keyboard nudge inverts the same math from the same registry fields, so the conversion
      // lives next to it (`./slurHandleNudge`) rather than being kept twice.
      this.draggedSlurBaselineCps = cpsFromDrawnControlPoints(handle.controlPoints, handle.slurEndpoints)
      this.draggedStaffSpacePx = handle.staffSpacePx ?? 10
      this.draggedSlurSegment = handle.segmentRole === undefined ? undefined
        : handle.segmentRole === 'middle' ? { role: 'middle', ordinal: handle.segmentOrdinal ?? 0 }
        : { role: handle.segmentRole }
      this.draggedSlurSpanCount = handle.slurSpanCount
      this.slurDragChanged = false
      this.slurDragStartTime = Date.now()
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

    // Slur endpoint (square) handle drag — re-anchor the in/out point onto a
    // different note.
    const endHandle = registry.getByType('slur-endpoint').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    })
    if (endHandle?.slurId === selectedSlur.id && endHandle.endpoint) {
      this.isDraggingSlurEndpoint = true
      this.draggedEndpointSlurId = endHandle.slurId
      this.draggedEndpoint = endHandle.endpoint
      this.slurEndpointDragChanged = false
      this.slurEndpointDragStartTime = Date.now()
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
    // docs/multisystem-slur-segment-endpoint-offset-plan.md.
    const segEndHandle = registry.getByType('slur-segment-endpoint').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    })
    if (segEndHandle?.slurId === selectedSlur.id && segEndHandle.segmentRole) {
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
   * If a plain-click SINGLE measure box is already selected and this press lands inside its
   * band, arm a vertical drag that adjusts the staff's "space above" (Sibelius staff drag —
   * Client #7, docs/staff-spacing-plan.md §6). Runs before the selection clear so the box
   * stays selected through the drag; the box highlight follows live as the model re-renders.
   * Mirrors {@link handleSlurHandleMouseDown}: you first select the box, then grab it.
   */
  private handleStaffSpacingMouseDown(ctx: MouseDownCtx): boolean {
    const { engine, event, registry, x, y } = ctx
    const box = selectedOf(this.state, 'measureRange')
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

    if (!this.armStaffSpacingDrag(engine, measure, y)) return false
    dbg(`Staff-spacing drag ready | measure:${measure} staff:${staff} baseline:${this.draggedSpacingBaseline} ss`)
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
   *  (docs/linear-view-plan.md §4.2b). Same gesture, and the engine decides which — so nothing
   *  keyed to a system can be written from a view that has no system worth naming (§4.1).
   *  @returns true if a drag was armed. */
  private armStaffSpacingDrag(engine: MusicEngine, measure: number, startY: number): boolean {
    const staff = selectedOf(this.state, 'measureRange')?.staff ?? 0
    this.isDraggingStaffSpacing = true
    this.draggedSpacingStaff = staff
    this.draggedSpacingMeasure = measure
    this.draggedSpacingBaseline = engine.getStaffSpacingAbove(staff, measure)
    this.draggedSpacingStartY = startY
    this.staffSpacingDragChanged = false
    this.staffSpacingDragStartTime = Date.now()
    return true
  }

  /**
   * Arm a bar-width drag on the grabbed barline: capture the room ONCE, off the last render
   * (docs/bar-width-plan.md §4–§6). Everything the gesture needs is fixed at this moment — the
   * slope, the measured floor, the ceiling — because a stretch changes no bar's *intrinsic* width,
   * so none of those terms move while the drag runs. That is what makes one capture correct rather
   * than merely cheap.
   *
   * **Declines silently** (leaving a plain selection) only when the room cannot be measured at all.
   *
   * ⚠️ It used to decline on a PINNED barline too — the one ending a system, held at the right
   * margin by justification, which cannot follow the pointer by any amount — on the reasoning that
   * a drag unable to track its own cursor should not start. Reported from use: stretch a bar until
   * it fills its system and it becomes **unshrinkable**, because from then on its barline is pinned
   * and no drag would arm. A gesture you can get into and not out of is worse than one that lags.
   * So it arms anyway and the room answers continuously (by the bar's own music rather than by its
   * immovable barline); the moment that shrink re-wraps the system, `reanchorIfRewrapped` picks the
   * tracking back up. Hiding the pointer for the gesture is what makes the untracked stretch
   * unnoticeable rather than wrong-feeling.
   */
  private armBarWidthDrag(engine: MusicEngine, measure: number, x: number): void {
    this.barWidthDrag = null
    this.barWidthDragChanged = false
    this.isDraggingBarWidth = false
    const room = engine.barWidthRoom(measure)
    if (!room) {
      // ⚠️ Was a silent return, and silence is the wrong answer here: from the outside a refusal
      // and a working drag that happens to have no room look identical — the barline lights up and
      // will not move. `barWidthRoom` declines on a dirty model, on a bar with nothing DRAWN (a
      // culled bar still has a hit-box: tier 1 registers every bar in the score), and on a bar with
      // no note space. `__barlines.boxes()` says which of those it is, for every bar at once.
      // ⚠️ Say WHICH of the three reasons it was. `barWidthRoom` returns a bare null — "I don't
      // know", by design — and the three causes are indistinguishable from the outside while
      // looking identical to the user: the barline lights up and will not move. Naming them here is
      // what turned "sometimes the drag dies" into a one-line diagnosis twice over.
      const registry = engine.getElementRegistry()
      const columns = registry.getByMeasure(measure)
        .filter(el => (el.type === 'note' || el.type === 'rest') && el.beat !== undefined).length
      dbg(`Bar width | bar ${measure} REFUSES the drag — no room. `
        + `painted:${registry.isPainted(measure, 0)} · drawn columns:${columns} · `
        + `geometry:${!!registry.getStaffGeometry(measure, 0)} · render stale:${engine.isRenderStale()} `
        + '— Try __barlines.boxes()')
      return
    }
    if (room.barlineSlope <= 0) {
      dbg(`Bar width | bar ${measure} ends its system — its barline is pinned, so the drag moves the bar's own music`)
    }
    this.barWidthDrag = { measure, room }
    this.barWidthDragStartX = x
    this.barWidthDragLineKey = engine.barWidthLineKey(measure)
    dbg(`Bar width | armed on bar ${measure} · now ×${engine.getBarWidth(measure).toFixed(3)} · `
      + `room ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
      + `barline slope ${room.barlineSlope.toFixed(3)} · line ${this.barWidthDragLineKey}`)
  }

  /**
   * Bar-width drag: the grabbed barline follows the cursor, and the bar to its LEFT takes or gives
   * up the room — with its music re-spaced proportionally, not pushed to one end.
   *
   * The px→stretch conversion is the room's own (`stretchForBarlineDelta`), which is why the
   * barline lands under the pointer instead of somewhere short of it: widening a bar also shrinks
   * its own justified share AND every bar's before it on the line. Continuous by contract — never
   * the keyboard's `stretchForStep`, which is allowed to jump the casting-off.
   *
   * Returns true while the drag owns the move.
   */
  private handleBarWidthDrag(engine: MusicEngine, x: number): boolean {
    // Armed-ness IS the guard: `barWidthDrag` is non-null only between the barline press and its
    // release, exactly like the other gestures' own flags.
    if (!this.barWidthDrag) return false
    const dx = x - this.barWidthDragStartX
    if (!this.isDraggingBarWidth) {
      if (Math.abs(dx) < this.NOTE_DRAG_THRESHOLD_PX) return false // still a click
      this.isDraggingBarWidth = true
      // Hide the pointer for the gesture. The barline follows it exactly until the system
      // re-wraps, and at that boundary the layout genuinely moves discontinuously — no arithmetic
      // can keep the line under a cursor that is still visible beside it. With the pointer gone the
      // barline IS the cursor, and the jump reads as the music re-flowing rather than as a slip.
      const canvas = this.getScoreCanvas()
      if (canvas) canvas.style.cursor = 'none'
    }
    const { measure, room } = this.barWidthDrag
    const target = room.stretchForBarlineDelta(dx)
    if (engine.previewBarWidth(measure, target, room.minStretch, room.maxStretch)) {
      this.barWidthDragBlocked = false
      this.barWidthDragChanged = true
      this.render.renderScore()
      this.reanchorIfRewrapped(engine, measure, x)
    } else if (!this.barWidthDragBlocked) {
      // Once per stall, not once per frame: a mousemove fires ~60×/s and the interesting event is
      // the TRANSITION into "the drag is armed and tracking, but the bar will not take the value".
      this.barWidthDragBlocked = true
      dbg(`Bar width | bar ${measure} not moving · asked ×${target.toFixed(3)} · `
        + `clamp ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)} · `
        + `now ×${engine.getBarWidth(measure).toFixed(3)} · dx ${dx.toFixed(1)}px`)
    }
    return true
  }

  /**
   * Re-take the room when the drag has RE-WRAPPED the system, and re-anchor to the pointer's
   * current x.
   *
   * The captured room describes one casting-off: `T`, `P` and the slope are sums over the bars
   * sharing the grabbed bar's line, and they hold only while that line holds the same bars. Push
   * one onto the next system and the formula stops describing the picture — measured, the barline
   * tracked the cursor to the pixel and then ran 21px ahead of it and stayed there, gaining more on
   * every further re-wrap.
   *
   * The plan (§5) avoided this by refusing to re-wrap at all. A key press showed that to be the
   * wrong trade — a gesture that seizes up at a boundary reads as broken — so the drag re-anchors
   * instead: one jump at the boundary, which is honest (the layout really did change
   * discontinuously, and every editor does it), then exact tracking again from wherever the barline
   * landed. Cheap, too: this only re-reads on the frames where the system actually re-wrapped.
   */
  private reanchorIfRewrapped(engine: MusicEngine, measure: number, x: number): void {
    const key = engine.barWidthLineKey(measure)
    if (key === null || key === this.barWidthDragLineKey) return
    const fresh = engine.barWidthRoom(measure)
    if (!fresh) return
    this.barWidthDrag = { measure, room: fresh }
    this.barWidthDragStartX = x
    this.barWidthDragLineKey = key
    dbg(`Bar width | system re-wrapped mid-drag — re-anchored on bar ${measure} (slope ${fresh.barlineSlope.toFixed(3)})`)
  }

  /** Finish a bar-width drag: one undo entry if the barline actually moved, then reset. */
  private endBarWidthDrag(): void {
    if (this.barWidthDragChanged) {
      const engine = this.getEngine()
      if (engine && this.barWidthDrag) {
        engine.commitBarWidth()
        dbg(`Bar width set | bar ${this.barWidthDrag.measure} → ×${engine.getBarWidth(this.barWidthDrag.measure).toFixed(3)}`)
      }
    }
    const canvas = this.getScoreCanvas()
    if (canvas) canvas.style.cursor = ''
    this.barWidthDrag = null
    this.barWidthDragChanged = false
    this.barWidthDragBlocked = false
    this.isDraggingBarWidth = false
    this.barWidthDragLineKey = null
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
   * Ctrl+Alt+T does. With a note/rest selected, place a tempo mark at its (measure, beat) and open
   * the edit box blank to type the whole mark; with nothing selected, arm the click-to-type tempo
   * tool (blue cursor) so the next canvas click places and edits one.
   */
  insertTempo(): void {
    if (this.state.selectedNoteId) this.editTempoOnSelection()
    else this.armTempoEntry()
  }

  /**
   * Ctrl+Alt+T with a note/rest selected: place a tempo mark at that element's (measure, beat) and
   * open the edit box blank. Tempo is system-level, so — unlike a dynamic — the mark carries NO
   * staffId and NO voice (it governs the clock, not the staff it was placed from). The placeholder
   * text only exists so the mark renders a measurable box; the box opens blank (seedText `''`) and,
   * being `isNew`, deletes the mark on an empty commit.
   */
  private editTempoOnSelection(): void {
    const engine = this.getEngine()
    const textEdit = this.getTextEdit()
    if (!engine || !textEdit || this.state.editingText) return
    const noteId = this.state.selectedNoteId
    if (!noteId) return
    const note = engine.getNote(noteId)
    if (!note) return
    const created = engine.addTempoMark(note.measure, { beat: note.beat, text: DEFAULT_TEMPO_TEXT })
    if (!created) return
    // Render so the mark is in the DOM for TempoTextSource to measure; openTempoTextEditor then
    // suppresses + re-renders it — both before paint, so the placeholder never flashes.
    this.render.renderScore()
    this.openTempoTextEditor(created.id, true, '')
    dbg(`✓ Insert tempo on selection: measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} (note ${noteId})`)
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
          const origNote = engine.getNote(closestElement.id)
          this.isDraggingNote = true
          this.noteDragAxis = 'undecided'
          this.noteDragStart = { x, y }
          this.draggedNoteOriginalPitch = origNote && origNote.step
            ? { step: origNote.step, alter: origNote.alter!, octave: origNote.octave! }
            : null
          this.armSpacingDrag(engine, origNote)
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
   * (endStaffSpacingDrag is a no-op), leaving exactly the old tap-to-select behavior.
   */
  private beginBoxSelectOrPan(ctx: MouseDownCtx): void {
    const { engine, event, x, y } = ctx
    if (this.selectMeasureAt(x, y)) {
      this.render.renderScore()
      this.armStaffSpacingDrag(engine, selectedOf(this.state, 'measureRange')!.anchor, y)
      event.preventDefault()
      return
    }
    // Not on a staff/bar: defer to a pan (drag pans; tap-release clears the selection).
    this.pendingTapCoords = { x, y }
    this.armPan(event, true)
  }

  handleMouseUp(_event: MouseEvent): void {
    // Note: a hand/grab pan release is resolved by the document-level handleDocPanUp, not
    // here — so it fires even when the pointer is released outside the viewport.
    if (this.isDraggingNote) {
      dbg(`Drag ended | note:${this.state.selectedNoteId}`)
      this.endNoteDrag()
    }
    if (this.isDraggingClef) {
      this.endClefDrag()
    }
    if (this.isDraggingSlurHandle) {
      this.endSlurHandleDrag()
    }
    if (this.isDraggingSlurEndpoint) {
      this.endSlurEndpointDrag()
    }
    if (this.isDraggingStaffSpacing) {
      this.endStaffSpacingDrag()
    }
    // Unconditional: an armed-but-never-moved press has state to clear too.
    if (this.barWidthDrag) {
      this.endBarWidthDrag()
    }
  }

  /** Finish a clef drag: record one undo entry if it actually moved, then reset. */
  private endClefDrag(): void {
    const engine = this.getEngine()
    const moved = this.draggedClefMeasure !== null && this.draggedClefBeat !== null
      && (this.draggedClefMeasure !== this.draggedClefStartMeasure
        || (this.draggedClefStartBeat !== null && !fracEq(this.draggedClefBeat, this.draggedClefStartBeat)))
    if (engine && moved && this.draggedClefMeasure !== null && this.draggedClefBeat !== null) {
      engine.commitClefMove(this.draggedClefMeasure, this.draggedClefBeat)
      dbg(`Clef moved | measure:${this.draggedClefMeasure} beat:${fracToNumber(this.draggedClefBeat)}`)
    }
    this.isDraggingClef = false
    this.draggedClefMeasure = null
    this.draggedClefBeat = null
    this.draggedClefStartMeasure = null
    this.draggedClefStartBeat = null
    this.clefDragStartTime = null
    // Clear the ghost, unfreeze, and re-render once so the layout settles (and a
    // redundant clef, now removed by commitClefMove, is gone) at its final spot.
    if (engine) {
      engine.setDraggingClef(null)
      engine.setLayoutFrozen(false)
      this.render.renderScore()
    }
  }

  /** Finish a slur-handle drag: record one undo entry if the shape changed, then reset. */
  private endSlurHandleDrag(): void {
    const engine = this.getEngine()
    if (engine && this.slurDragChanged) {
      engine.commitSlurShape()
      dbg(`Slur reshaped | id:${this.draggedSlurId}`)
    }
    this.isDraggingSlurHandle = false
    this.draggedSlurId = null
    this.draggedCpIndex = undefined
    this.draggedSlurEndpoints = null
    this.draggedSlurBaselineCps = null
    this.draggedSlurSegment = undefined
    this.draggedSlurSpanCount = undefined
    this.slurDragChanged = false
    this.slurDragStartTime = null
  }

  /**
   * Vertical staff-spacing drag: turn the cursor's Y travel since grab into a new "space
   * above" for the selected staff and preview it live (no undo until drop — mirrors the slur
   * handle). Screen-down (+dy) widens the space (pushes the staff and everything below it
   * down); the box highlight follows because the model re-renders each move. One staff-space
   * = the stored line spacing (px), so dy ÷ that is the delta in staff-spaces.
   */
  private handleStaffSpacingDrag(engine: MusicEngine, _x: number, y: number): boolean {
    if (!this.isDraggingStaffSpacing) return false
    if (this.staffSpacingDragStartTime !== null && Date.now() - this.staffSpacingDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const dy = y - this.draggedSpacingStartY
    const above = this.draggedSpacingBaseline + dy / this.draggedStaffSpacePx
    if (engine.previewStaffSpacing(this.draggedSpacingStaff, this.draggedSpacingMeasure, above)) {
      // Only a real change from the baseline arms the commit — so a press that never moves
      // vertically (a plain tap-to-select, or a horizontal wiggle) records no undo entry.
      if (above !== this.draggedSpacingBaseline) this.staffSpacingDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a staff-spacing drag: record one undo entry if it actually moved, then reset. */
  private endStaffSpacingDrag(): void {
    const engine = this.getEngine()
    if (engine && this.staffSpacingDragChanged) {
      engine.commitStaffSpacing()
      dbg(`Staff spacing set | staff:${this.draggedSpacingStaff} → ${engine.getStaffSpacingAbove(this.draggedSpacingStaff, this.draggedSpacingMeasure)} ss`)
    }
    this.isDraggingStaffSpacing = false
    this.staffSpacingDragChanged = false
    this.staffSpacingDragStartTime = null
  }

  /**
   * Nearest note head to (x, y) within {@link SLUR_ENDPOINT_SNAP_PX}, by distance to
   * the notehead bbox center, excluding `excludeId` (the slur's other endpoint — both
   * ends can't share a note). Returns the note id, or null if none is close enough.
   */
  private nearestNoteId(x: number, y: number, excludeId?: string): string | null {
    const engine = this.getEngine()
    if (!engine) return null
    let bestId: string | null = null
    let bestDist = this.SLUR_ENDPOINT_SNAP_PX
    for (const el of engine.getElementRegistry().getByType('note')) {
      if (!el.id || el.id === excludeId) continue
      const cx = el.bbox.x + el.bbox.width / 2
      const cy = el.bbox.y + el.bbox.height / 2
      const d = Math.hypot(x - cx, y - cy)
      if (d < bestDist) { bestDist = d; bestId = el.id }
    }
    return bestId
  }

  /** Finish a slur-endpoint drag: record one undo entry if it re-anchored, clear the
   *  candidate tint, then reset. */
  private endSlurEndpointDrag(): void {
    const engine = this.getEngine()
    if (engine && this.slurEndpointDragChanged) {
      engine.commitSlurEndpoint()
      dbg(`Slur re-anchored | id:${this.draggedEndpointSlurId} end:${this.draggedEndpoint}`)
    }
    this.isDraggingSlurEndpoint = false
    this.draggedEndpointSlurId = null
    this.draggedEndpoint = undefined
    this.slurEndpointDragChanged = false
    this.slurEndpointDragStartTime = null
    this.state.slurEndpointCandidateNoteId = null
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
    if (this.placeDynamicAtClick(engine, x, y, measureNum)) return
    if (this.placeDynamicEntryAtClick(engine, x, y, measureNum)) return
    if (this.placeTempoAtClick(engine, x, measureNum)) return
    if (this.placeTempoEntryAtClick(engine, x, measureNum)) return
    if (this.stampArticulationAtClick(engine, registry, x, y)) return
    if (this.stampAccidentalAtClick(engine, registry, x, y)) return
    if (this.stampTieAtClick(engine, registry, x, y)) return
    if (this.stampDotAtClick(engine, registry, x, y)) return
    if (this.stampTremoloAtClick(engine, registry, x, y)) return
    if (this.stampRestAtClick(engine, x, y)) return
    // The feather stamp's whole click lives in its own module (interactions/fanStamp); this is the
    // row that gives it a turn.
    if (stampFanAtClick(this.state, engine, x, y, () => this.render.renderScore())) return
    // The slur stamp's click lives in its own module too (interactions/slurStamp); this is its turn.
    if (stampSlurAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampHairpinAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    // …and the trill's (interactions/trillStamp). Last of the spanner stamps; each answers only for
    // its own armed tool, so the order among them decides nothing.
    if (stampTrillAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampOttavaAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return
    if (stampPedalAtClick(this.state, engine, registry, x, y, () => this.render.renderScore())) return

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
   * VOICE SEAM: `voice: 0` is the only hardcoded voice in the dynamics feature —
   * every resolution/render/playback path already keys on `voiceOf` (see
   * utils/dynamics resolveActiveLevel/resolveChordLevels, ScoreModel.addDynamic,
   * DynamicsLayout.attachDynamicsToSlots). When multi-voice editing lands, the
   * ONLY change here is to source the voice from a UI selector (or the active
   * voice) instead of the literal 0; the timeline math needs no rework.
   */
  private placeDynamicAtClick(engine: MusicEngine, x: number, y: number, measureNum: number): boolean {
    const tool = armedTool(this.state, 'dynamic')?.dynamic
    if (!tool) return false
    const beat = this.resolveSlotBeat(engine, x, measureNum)
    // Anchor the mark to the STAFF the click landed on (else it renders on staff 0).
    const staff = engine.getElementRegistry().staffIndexAtY(measureNum, y)
    const staffId = engine.staffIdForIndex(staff)
    const staffParam = staffId ? { staffId } : {}
    engine.addDynamic(measureNum, { beat, text: dynamicTextFromTool(tool), voice: 0, placement: 'below', ...staffParam })
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
    const created = engine.addDynamic(measureNum, { beat, text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below', ...staffParam })
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
    const created = engine.addTempoMark(measureNum, { beat, text: DEFAULT_TEMPO_TEXT })
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
    const created = engine.addTempoMark(measureNum, { beat, ...tempoFieldsFromTool(tool) })
    if (created) {
      dbg(`✓ Tempo ${tempoLabel(created)} at measure ${measureNum} beat ${fracToNumber(beat).toFixed(3)}`)
    }
    this.render.renderScore()
    return true
  }

  /**
   * Articulation stamp tool: add the armed articulation(s) to the note clicked. Only a real note
   * counts — a rest, empty staff space, or any other element is a no-op (but still consumes the
   * click, since the tool is armed). Uses the same note-body hit-test as selection-mode clicks
   * ({@link ElementRegistry.hitsNoteOrRestBody}), so clicking near-but-not-on a note does nothing.
   * Only the armed articulations the note LACKS are added (adding one it already has is meaningless);
   * the additions land as ONE undo entry via runBatch. Returns true whenever the stamp tool is armed
   * (the click is ours either way).
   */
  private stampArticulationAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const types = armedTool(this.state, 'articulation')?.types
    if (!types?.length) return false

    const el = registry.findClosestNoteOrRest(x, y)
    if (!el?.id || !registry.hitsNoteOrRestBody(el, x, y)) {
      dbg(`· Articulation stamp: click not on a note — no change`)
      return true
    }
    const noteId = el.id
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Articulation stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    const missing = types.filter(t => !note.articulations?.includes(t))
    if (missing.length === 0) {
      dbg(`· Articulation stamp: note ${noteId} already has ${types.join('+')} — no change`)
      return true
    }
    engine.runBatch(`Add ${missing.join('+')}`, () => {
      for (const t of missing) engine.toggleArticulation(noteId, t) // each adds (note lacks it)
    })
    dbg(`✓ Articulation stamped | ${missing.join('+')} on note ${noteId}`)
    this.render.renderScore()
    return true
  }

  /**
   * Accidental stamp tool: a click SETS the armed accidental on the hovered note, changing its
   * pitch (existing notes only). Mirrors {@link stampArticulationAtClick} — same note-body hit-test,
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
   * Tremolo stamp tool: a click puts the armed tremolo on the note clicked. Mirrors
   * {@link stampAccidentalAtClick} — one `runBatch` = one undo, SINGLE-valued and IDEMPOTENT (a note
   * already carrying that mark is a no-op; a note carrying a DIFFERENT one is replaced, because a
   * note has one tremolo).
   *
   * ⚠️ THE ONE STAMP WITH TWO TARGETS: the notehead **or the stem**. Every other stamp takes the
   * head alone, because that is where its mark lands. A tremolo's strokes ride the STEM, so that is
   * where the pointer naturally goes — insisting on the head would mean aiming at one place to put
   * ink in another. The head test runs first and unchanged (a click there still resolves by nearest
   * note); {@link ElementRegistry.findStemAt} is the second chance, and it hits the stem's OWN
   * registered rect — a containment test, not a nearest-note one, because a click at the top of a
   * stem is a whole stem-length from its own notehead, which is exactly where "nearest" picks the
   * wrong note.
   *
   * A REST is refused: you cannot tremolo silence. The click is still consumed — the tool is armed,
   * so a near-miss must not fall through to note entry.
   *
   * No playability ceiling, and none is needed: past the unmeasured threshold nothing is scheduled
   * as a subdivision at all, so there is no absurd note value to guard against (docs/tremolo-plan.md
   * §2). A ceiling would also be unenforceable — shortening the note afterwards recreates the same
   * combination with no stamp in sight.
   */
  private stampTremoloAtClick(engine: MusicEngine, registry: ElementRegistry, x: number, y: number): boolean {
    const tremolo = armedTool(this.state, 'tremolo')?.tremolo
    if (tremolo === undefined) return false

    const nearest = registry.findClosestNoteOrRest(x, y)
    const onHead = nearest && registry.hitsNoteOrRestBody(nearest, x, y)
    // A stem carries `noteId`, never `id` (a stem must never answer a lookup for its note).
    const noteId = onHead ? nearest.id : registry.findStemAt(x, y)?.noteId
    if (!noteId) {
      dbg(`· Tremolo stamp: click not on a notehead or stem — no change`)
      return true
    }
    const note = engine.getNote(noteId)
    if (!note || note.isRest) {
      dbg(`· Tremolo stamp: ${note?.isRest ? 'rest' : 'non-note'} — no change`)
      return true
    }
    if (note.tremolo === tremolo) {
      dbg(`· Tremolo stamp: note ${noteId} already has tremolo ${tremolo} — no change`)
      return true
    }
    engine.runBatch(`Set tremolo ${tremolo}`, () => engine.setTremolo(noteId, tremolo))
    dbg(`✓ Tremolo stamped | ${tremolo} on note ${noteId}`)
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

    // Armed paste: show a colored caret at the slot the click would target.
    if (this.state.pastePlacementArmed) {
      this.render.renderPasteCaret({ x, y })
      return
    }

    // Live drag gestures — each returns true if it owns the move.
    if (this.handleBarWidthDrag(engine, x)) return
    if (this.handleNoteDrag(engine, x, y)) return
    if (this.handleSlurHandleDrag(engine, x, y)) return
    if (this.handleSlurEndpointDrag(engine, x, y)) return
    if (this.handleStaffSpacingDrag(engine, x, y)) return
    if (this.handleClefDrag(engine, x, y)) return

    // A hand/grab pan is armed: bail before the ghost/preview logic. The pan itself is
    // driven by the document-level handlers (handleDocPanMove) so it keeps working when
    // the pointer leaves the viewport — this element handler only needs to not draw a
    // ghost note underneath the gesture.
    if (this.isPanArmed) return

    if (this.state.selectedTool === 'selection') return
    if (this.isMouseButtonDown) return

    // No throttle: since P4 the ghost is an overlay, so following the cursor costs one small
    // draw rather than a re-layout of the whole score. The old 50 ms gate existed only to
    // ration that cost, and capped the preview at 20 fps (docs/render-performance-plan.md §5b).
    this.render.renderToolGhost({ x, y })
  }

  /**
   * The note/rest drag — **one press, two gestures, decided from the movement.**
   *
   * Vertical wins → re-pitch (what this always did). Horizontal wins → note spacing, the axis
   * that used to carry no meaning at all. Nothing happens until the cursor leaves a small dead
   * zone, so a click still cannot nudge anything; and because the decision reads the *shape* of
   * the movement rather than its age, a horizontal drag can wander a staff step without silently
   * committing a pitch change on the way past.
   *
   * Once decided, the axis is FIXED for the rest of the press. Re-deciding per frame would let a
   * curved drag re-pitch a note it had already started spacing — and both edits are real writes to
   * the score, not previews you can take back by moving the mouse elsewhere.
   *
   * Returns true while a note/rest drag is active (the move belongs to this gesture).
   */
  private handleNoteDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!this.isDraggingNote || !this.state.selectedNoteId || !this.noteDragStart) return false

    if (this.noteDragAxis === 'undecided') {
      const dx = x - this.noteDragStart.x
      const dy = y - this.noteDragStart.y
      if (Math.hypot(dx, dy) < this.NOTE_DRAG_THRESHOLD_PX) return true // dead zone: still a click
      this.noteDragAxis = Math.abs(dx) > Math.abs(dy) ? 'spacing' : 'pitch'
      dbg(`Note drag axis | ${this.noteDragAxis} (dx:${dx.toFixed(1)} dy:${dy.toFixed(1)})`)
    }

    if (this.noteDragAxis === 'spacing') return this.dragNoteSpacing(engine, x)
    if (this.draggedNoteOriginalPitch === null) return true // a rest: nothing to re-pitch

    // ⚠️ Through the ENGINE, not a `getMeasureNotes` walk: that walk reads `slot.notes` and so is
    // blind to a FANNED MEMBER, which would leave the drag silently doing nothing on exactly the
    // notes P3 made draggable (his report). `getNote` answers for both.
    const selectedNote = engine.getNote(this.state.selectedNoteId)

    if (selectedNote && !selectedNote.isRest) {
      const measure = engine.getScore().measures.find(m => m.number === selectedNote.measure)
      if (measure) {
        const barQuarters = measureCapacityQuarters(measure)
        const position = engine.pixelToPosition({ x, y }, barQuarters)
        const cursorSpelling = position.spelling
        const cursorMidi = spellingToMidi(cursorSpelling.step, cursorSpelling.alter, cursorSpelling.octave)
        const noteMidi = spellingToMidi(selectedNote.step!, selectedNote.alter!, selectedNote.octave!)

        if (cursorMidi !== noteMidi) {
          dbg(`Drag pitch change | midi:${noteMidi} -> ${cursorMidi}`)
          engine.updateNote(this.state.selectedNoteId, { step: cursorSpelling.step, alter: cursorSpelling.alter, octave: cursorSpelling.octave })
          this.render.renderScore()
        }
      }
    }
    return true
  }

  /**
   * Arm the horizontal half of a note/rest drag: remember which COLUMN was grabbed, the space
   * already authored there, and how far left it may go.
   *
   * The floor is measured now, once, against the picture the user grabbed — see
   * `MusicEngine.noteSpacingRoom`. `null` means the last render cannot answer, and then the
   * spacing branch simply never arms: the press stays a pitch drag rather than moving a column by
   * a made-up amount.
   */
  private armSpacingDrag(engine: MusicEngine, note: Note | undefined): void {
    this.spacingDragColumn = null
    this.spacingDragChanged = false
    if (!note) return
    // ⭐ A fanned member's own gap, not its group's — `spacingColumnOf` is the address, because the
    // flat note carries the SLOT's beat (docs/note-spacing-plan.md §7).
    const column = engine.spacingColumnOf(note.id)
    if (!column) return
    const room = engine.noteSpacingRoom(column.measure, column.beat, note.id)
    if (room === null) return
    this.spacingDragColumn = { measure: column.measure, beat: column.beat }
    this.spacingDragBaseline = engine.getNoteSpacing(column.measure, column.beat)
    this.spacingDragMinSpace = this.spacingDragBaseline - room
    this.spacingDragStaffSpacePx =
      engine.getElementRegistry().getStaffGeometry(note.measure, staffOf(note))?.lineSpacing ?? 10
  }

  /**
   * Note-spacing drag: the grabbed column follows the cursor horizontally, and everything right of
   * it slides with it. Live-updates without undo; the drop records one entry (`commitNoteSpacing`).
   *
   * The pixel delta is divided by the staff space to become staff-spaces, because the model holds
   * no pixels. No zoom division: `clientToSvg` goes through `getScreenCTM().inverse()`, so these
   * coords are already layout px with the zoom transform undone.
   * Returns true: while the axis is `spacing`, the move is ours.
   */
  private dragNoteSpacing(engine: MusicEngine, x: number): boolean {
    if (!this.spacingDragColumn || !this.noteDragStart) return true
    const dx = (x - this.noteDragStart.x) / this.spacingDragStaffSpacePx
    const { measure, beat } = this.spacingDragColumn
    if (engine.previewNoteSpacing(measure, beat, this.spacingDragBaseline + dx, this.spacingDragMinSpace)) {
      this.spacingDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /** Finish a note/rest drag. A spacing drag that actually moved the column records its one undo
   *  entry here; a pitch drag already committed each change as it went. */
  private endNoteDrag(): void {
    if (this.noteDragAxis === 'spacing' && this.spacingDragChanged) {
      const engine = this.getEngine()
      if (engine && this.spacingDragColumn) {
        engine.commitNoteSpacing()
        const { measure, beat } = this.spacingDragColumn
        dbg(`Note spacing set | bar ${measure} beat ${beat.num}/${beat.den} → ${engine.getNoteSpacing(measure, beat)} ss`)
      }
    }
    this.isDraggingNote = false
    this.noteDragAxis = 'undecided'
    this.noteDragStart = null
    this.draggedNoteOriginalPitch = null
    this.spacingDragColumn = null
    this.spacingDragChanged = false
  }

  /**
   * Slur handle drag: the grabbed control point follows the cursor. Invert the
   * renderCurve math to a cps delta, hold the other control point fixed, live-update
   * (no undo) and re-render — the re-render redraws the handles at the new spots.
   * Returns true while a slur-handle drag is active.
   */
  private handleSlurHandleDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingSlurHandle && this.draggedSlurId && this.draggedCpIndex !== undefined
        && this.draggedSlurEndpoints && this.draggedSlurBaselineCps)) return false
    if (this.slurDragStartTime !== null && Date.now() - this.slurDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const { p0, p1, direction } = this.draggedSlurEndpoints
    const spacing = (p1.x - p0.x) / 4
    const dragged = this.draggedCpIndex === 0
      ? { x: x - p0.x - spacing, y: (y - p0.y) * direction }
      : { x: x - p1.x + spacing, y: (y - p1.y) * direction }
    const cps: [{ x: number; y: number }, { x: number; y: number }] = this.draggedCpIndex === 0
      ? [dragged, this.draggedSlurBaselineCps[1]]
      : [this.draggedSlurBaselineCps[0], dragged]
    // The drag math is in pixels; the override is stored in staff-spaces (resolution-
    // independent), so divide by the stave line spacing before handing it to the model.
    const ss = this.draggedStaffSpacePx
    const cpsStaffSpaces: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: cps[0].x / ss, y: cps[0].y / ss },
      { x: cps[1].x / ss, y: cps[1].y / ss },
    ]
    if (engine.previewSlurShape(this.draggedSlurId, cpsStaffSpaces, this.draggedSlurSegment, this.draggedSlurSpanCount)) {
      this.slurDragChanged = true
      this.render.renderScore()
    }
    return true
  }

  /**
   * Slur endpoint drag: snap the grabbed in/out point to the nearest note head and
   * re-anchor live (no undo). The candidate note is tinted so it's clear where the end
   * will land; releasing over empty space keeps the last snapped note. Returns true
   * while a slur-endpoint drag is active.
   */
  private handleSlurEndpointDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingSlurEndpoint && this.draggedEndpointSlurId && this.draggedEndpoint)) return false
    if (this.slurEndpointDragStartTime !== null
        && Date.now() - this.slurEndpointDragStartTime < this.DRAG_TIME_THRESHOLD_MS) return true
    const slur = engine.getSlurById(this.draggedEndpointSlurId)
    const otherId = slur
      ? (this.draggedEndpoint === 'start' ? slur.endNoteId : slur.startNoteId)
      : undefined
    const candidate = this.nearestNoteId(x, y, otherId)
    const prevCandidate = this.state.slurEndpointCandidateNoteId
    this.state.slurEndpointCandidateNoteId = candidate
    if (candidate) {
      // previewSlurEndpoint no-ops when the target is already the anchor, so this
      // only re-renders/flags on a real move.
      if (engine.previewSlurEndpoint(this.draggedEndpointSlurId, this.draggedEndpoint, candidate)) {
        this.slurEndpointDragChanged = true
        this.render.renderScore()
      } else if (candidate !== prevCandidate) {
        this.render.renderScore() // candidate tint moved even if anchor unchanged
      }
    } else if (prevCandidate) {
      this.render.renderScore() // cleared the tint
    }
    return true
  }

  /**
   * Clef drag: snap the cursor to a slot boundary in whatever measure it's over and
   * relocate the clef there (raw move, across measures; undo on drop). Returns true
   * while a clef drag is active.
   */
  private handleClefDrag(engine: MusicEngine, x: number, y: number): boolean {
    if (!(this.isDraggingClef && this.draggedClefMeasure !== null && this.draggedClefBeat !== null)) return false
    if (this.clefDragStartTime !== null) {
      const elapsed = Date.now() - this.clefDragStartTime
      if (elapsed < this.DRAG_TIME_THRESHOLD_MS) return true
    }
    const targetMeasure = engine.pixelToMeasure({ x, y })
    const targetBeat = this.resolveSlotBeat(engine, x, targetMeasure)
    if (targetMeasure !== this.draggedClefMeasure || !fracEq(targetBeat, this.draggedClefBeat)) {
      if (engine.moveClef(this.draggedClefMeasure, this.draggedClefBeat, targetMeasure, targetBeat)) {
        this.draggedClefMeasure = targetMeasure
        this.draggedClefBeat = targetBeat
        this.state.selectedElement = {
          kind: 'clef',
          measure: targetMeasure,
          beat: fracToNumber(targetBeat),
          // The staff does not move with the drag — a clef slides along its own staff.
          staff: selectedOf(this.state, 'clef')?.staff ?? 0,
        }
        engine.setDraggingClef({ measure: targetMeasure, beat: targetBeat })
        dbg(`Clef drag | measure:${targetMeasure} beat:${fracToNumber(targetBeat)}`)
        this.render.renderScore()
      }
    }
    return true
  }

  handleMouseLeave(): void {
    const engine = this.getEngine()
    if (!engine) return

    // A hand/grab pan must SURVIVE the pointer leaving the viewport — it's driven by the
    // document-level handlers and ends on the real mouseup wherever that happens. Bail
    // here so we don't tear it down or re-render underneath it.
    if (this.isPanArmed || this.isPanning) return

    if (this.isDraggingNote) {
      dbg('Drag ended (mouse left canvas)')
      // Through endNoteDrag, so a spacing drag interrupted by leaving the viewport still records
      // the undo entry for the space it already moved — the score has changed either way.
      this.endNoteDrag()
    }
    if (this.isDraggingClef) {
      dbg('Clef drag ended (mouse left canvas)')
      this.endClefDrag()
    }
    if (this.isDraggingSlurHandle) {
      dbg('Slur handle drag ended (mouse left canvas)')
      this.endSlurHandleDrag()
    }
    if (this.isDraggingSlurEndpoint) {
      dbg('Slur endpoint drag ended (mouse left canvas)')
      this.endSlurEndpointDrag()
    }
    if (this.isDraggingStaffSpacing) {
      dbg('Staff-spacing drag ended (mouse left canvas)')
      this.endStaffSpacingDrag()
    }

    this.lastCanvasMousePosition = null
    this.render.renderScore()
    this.state.showCursor = true
  }
}
