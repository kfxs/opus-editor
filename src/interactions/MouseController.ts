import { dbg } from '@/utils/debug'
import type { ArticulationType, PitchSpelling, Fraction, Note, SlurSegmentAddress } from '../types/music'
import type { MusicEngine, BarWidthRoom } from '../engine/MusicEngine'
import type { ElementInfo, ElementRegistry, ElementType } from '../engine/ElementRegistry'
import type { EditorState } from './EditorState'
import { activeVoiceToModel, armedTool, armedNormalSide, armedTupletM, spendArmedTuplet } from './EditorState'
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
/** Placeholder for a Ctrl+Alt+T tempo mark — exists only so the mark renders a measurable box; the
 *  edit box opens blank over it and an empty commit deletes it, so it is never actually seen. */
const DEFAULT_TEMPO_TEXT = 'Tempo'
import { getMeasureNotes, beatToFrac, measureCapacityQuarters } from '../utils/musicUtils'
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

/** Shortest distance from point (px,py) to the line segment a→b (clamped to the
 *  segment, so endpoints don't over-grab). Used for arc-proximity slur hit-testing. */
function distToSegment(
  px: number, py: number,
  a: { x: number; y: number }, b: { x: number; y: number },
): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y)
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

/**
 * Resolved targets for one selection-tool mousedown, computed once and shared by the
 * per-gesture `handle*MouseDown` methods so they don't each re-hit-test.
 */
interface MouseDownCtx {
  event: MouseEvent
  engine: MusicEngine
  registry: ElementRegistry
  x: number
  y: number
  closestElement: ElementInfo | null
  tupletAtClick: ElementInfo | null
}

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
    const staffId = engine.staffIdForIndex(note.staff ?? 0)
    const staffParam = staffId ? { staffId } : {}
    const created = engine.addDynamic(note.measure, {
      beat: note.beat, text: DEFAULT_DYNAMIC_TEXT, voice: 0, placement: 'below', ...staffParam,
    })
    if (!created) return
    // Render so registerDynamics stores the mark's bbox; openTextEditor's source snapshots
    // its position from the registry, then immediately suppresses + re-renders it.
    this.render.renderScore()
    this.openTextEditor(created.id, true, '')
    dbg(`✓ Insert dynamic on selection: measure ${note.measure} beat ${fracToNumber(note.beat).toFixed(3)} staff ${note.staff ?? 0} (note ${noteId})`)
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
    const id = this.state.selectedDynamicId
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

  // --- Mouse handlers ---

  /**
   * Resolve the articulation under (x, y), or null. An accent/staccato/tenuto glyph
   * sits right against its note head, and the padded bbox can cover the head too — so
   * a click aimed at the note would be "stolen" by the articulation. We only take the
   * articulation when the click is genuinely closer to the glyph than to the nearest
   * note/rest; otherwise the caller falls through to note selection.
   */
  private articulationHit(
    x: number, y: number, closestElement: ElementInfo | null, registry: ElementRegistry,
  ): ElementInfo | null {
    const artPad = 8
    const articulationAt = registry.getByType('articulation').find(el => {
      const b = el.bbox
      return x >= b.x - artPad && x <= b.x + b.width + artPad && y >= b.y - artPad && y <= b.y + b.height + artPad
    }) ?? null
    if (!articulationAt?.noteId) return null
    const artCx = articulationAt.bbox.x + articulationAt.bbox.width / 2
    const artCy = articulationAt.bbox.y + articulationAt.bbox.height / 2
    const artDist = Math.sqrt((x - artCx) ** 2 + (y - artCy) ** 2)
    const noteDist = closestElement && closestElement.id
      ? registry.noteOrRestHitDistance(closestElement, x, y)
      : Infinity
    if (artDist <= noteDist) return articulationAt
    dbg(`· Articulation skipped — note closer (artDist:${artDist.toFixed(1)} > noteDist:${noteDist.toFixed(1)})`)
    return null
  }

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

    this.state.selectedTupletId = null
    this.state.selectedTieFromNoteId = null
    this.state.selectedSlurId = null
    this.state.selectedSlurEndpoint = null
    this.state.selectedSlurSegmentEndpoint = null
    this.state.selectedClefMeasure = null
    this.state.selectedClefBeat = null
    this.state.selectedTimeSignatureMeasure = null
    this.state.selectedBarlineMeasure = null
    this.state.selectedDynamicId = null
    this.state.selectedTempoId = null
    this.state.selectedMeasureRange = null

    // Single-click element hit-tests, in priority order. Each returns true if it
    // consumed the press; otherwise we fall through to the next kind.
    if (this.handleClefMouseDown(ctx)) return
    if (this.handleTimeSignatureMouseDown(ctx)) return
    if (this.handleTempoMouseDown(ctx)) return
    if (this.handleDynamicMouseDown(ctx)) return
    if (this.handleTieMouseDown(ctx)) return
    if (this.handleSlurMouseDown(ctx)) return
    if (this.handleAccidentalMouseDown(ctx)) return
    if (this.handleArticulationMouseDown(ctx)) return
    // Dots last of the sub-elements: they sit right beside the notehead, so a dot must never win a
    // press that a neighbouring glyph could claim. It still precedes the note itself — a dot's box
    // is outside the head, so it can only take clicks that would otherwise select the note.
    if (this.handleDotMouseDown(ctx)) return
    // The stem after every glyph that can sit ON it (articulations and dots at the tip, an arc
    // crossing it) and before the barline, whose pad reaches into the bar's last column. Its own
    // handler stands down for a press the notehead owns.
    //
    // The tremolo goes immediately before it: the mark is drawn on the stem, so it wins inside its
    // own ink and the stem keeps the rest of its length.
    if (this.handleTremoloMouseDown(ctx)) return
    if (this.handleStemMouseDown(ctx)) return
    // The barline last of all: its box has to be padded to be clickable at 4px, and that pad
    // reaches into the last column of the bar — so every glyph that could own the click gets
    // asked first, and the note itself is guarded for inside the handler.
    if (this.handleBarlineMouseDown(ctx)) return
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
    const prevRange = this.state.selectedMeasureRange
    this.state.selectedMeasureRange = null

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
      const artHit = this.articulationHit(x, y, closestElement, registry)
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
    // (deselectAll resets selectedMeasureRange via clearScalarSubSelections, so order
    // matters: we set it AFTER).
    this.selection.deselectAll()
    this.state.selectedMeasureRange = { anchor: lo, focus: hi }
    this.state.selectedMeasureBoxStyle = 'double'
    // Remember which stacked staff the click fell on — the reference staff the "Staff:"
    // add-above/below buttons insert relative to (multi-staff Phase 4). N=1 → always 0.
    this.state.selectedMeasureStaff = engine.getElementRegistry().staffIndexAtY(measure, y)
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
    // content). These ids drive both the selection and the enclosed-dynamics/slurs pull.
    const ids = getMeasureNotes(m, score).filter(n => (n.staff ?? 0) === staff).map(n => n.id)
    if (!ids.length) return false

    this.selection.selectMeasureContents(ids)
    this.state.selectedMeasureRange = { anchor: measure, focus: measure }
    this.state.selectedMeasureStaff = staff
    this.state.selectedMeasureBoxStyle = 'single'
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
        this.state.selectedTupletId = tupletAtClick.tupletId
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
    if (!this.state.selectedSlurId) return false

    // Slur control-point handle drag.
    const handle = registry.getByType('slur-handle').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    })
    // The handle carries its OWN segment's drag context (endpoints + control points +
    // staff spacing + segment address + span count), so we read everything straight off it
    // — no re-lookup of a 'slur' partial, which on a cross-system slur would ambiguously
    // resolve to the wrong segment (§4a). cpIndex disambiguates the two dots within it.
    if (handle?.slurId === this.state.selectedSlurId && handle.cpIndex !== undefined
        && handle.slurEndpoints && handle.controlPoints) {
      this.isDraggingSlurHandle = true
      this.draggedSlurId = handle.slurId
      this.draggedCpIndex = handle.cpIndex
      this.draggedSlurEndpoints = handle.slurEndpoints
      this.draggedSlurBaselineCps = this.cpsFromControlPoints(handle.controlPoints, handle.slurEndpoints)
      this.draggedStaffSpacePx = handle.staffSpacePx ?? 10
      this.draggedSlurSegment = handle.segmentRole === undefined ? undefined
        : handle.segmentRole === 'middle' ? { role: 'middle', ordinal: handle.segmentOrdinal ?? 0 }
        : { role: handle.segmentRole }
      this.draggedSlurSpanCount = handle.slurSpanCount
      this.slurDragChanged = false
      this.slurDragStartTime = Date.now()
      // Grabbing a round (angle) handle disarms any armed endpoint square — the two are
      // different editing targets, so the arrows shouldn't keep nudging an endpoint after
      // you reach for the curve shape (slur-endpoint-offset-plan).
      if (this.state.selectedSlurEndpoint !== null || this.state.selectedSlurSegmentEndpoint !== null) {
        this.state.selectedSlurEndpoint = null
        this.state.selectedSlurSegmentEndpoint = null
        this.render.renderScore()
      }
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
    if (endHandle?.slurId === this.state.selectedSlurId && endHandle.endpoint) {
      this.isDraggingSlurEndpoint = true
      this.draggedEndpointSlurId = endHandle.slurId
      this.draggedEndpoint = endHandle.endpoint
      this.slurEndpointDragChanged = false
      this.slurEndpointDragStartTime = Date.now()
      // Click = select this point for keyboard nudging; drag (decided on move) re-anchors.
      // Either way the point stays armed afterward, so arrows can fine-tune it. Re-render so
      // the selected square's highlighted border shows immediately (slur-endpoint-offset-plan).
      this.state.selectedSlurEndpoint = endHandle.endpoint
      this.state.selectedSlurSegmentEndpoint = null // arming a blue square disarms an orange one
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
    if (segEndHandle?.slurId === this.state.selectedSlurId && segEndHandle.segmentRole) {
      const role = segEndHandle.segmentRole
      this.state.selectedSlurEndpoint = null
      this.state.selectedSlurSegmentEndpoint =
        role === 'middle' ? { role: 'middle', ordinal: segEndHandle.segmentOrdinal!, side: segEndHandle.segmentSide! }
        : role === 'begin' ? { role: 'begin' }
        : { role: 'end' }
      this.state.selectedSlurSegmentSpanCount = segEndHandle.slurSpanCount ?? 0
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
    if (this.state.selectedMeasureRange === null || this.state.selectedMeasureBoxStyle !== 'single') return false
    const measure = this.state.selectedMeasureRange.anchor // single box: anchor === focus
    const rect = engine.getMeasureRect(measure)
    if (!rect) return false
    // Hit-test the exact drawn box: this bar's x-range × the selected staff's band (its five
    // lines + the same ±STAFF_BAND_PAD_PX the box and the plain-click select use).
    if (x < rect.x || x >= rect.x + rect.width) return false
    const staff = this.state.selectedMeasureStaff
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
    const staff = this.state.selectedMeasureStaff
    this.isDraggingStaffSpacing = true
    this.draggedSpacingStaff = staff
    this.draggedSpacingMeasure = measure
    this.draggedSpacingBaseline = engine.getStaffSpacingAbove(staff, measure)
    this.draggedSpacingStartY = startY
    this.staffSpacingDragChanged = false
    this.staffSpacingDragStartTime = Date.now()
    return true
  }

  /** Select a clef glyph for removal, and arm a horizontal drag for movable clefs. */
  private handleClefMouseDown(ctx: MouseDownCtx): boolean {
    const { engine, event, registry, x, y } = ctx
    // Clef change selection — click a clef glyph to select it for removal.
    const clefAt = registry.getByType('clef').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (clefAt?.measure === undefined) return false

    this.selection.selectNote(null)
    this.state.selectedClefMeasure = clefAt.measure
    this.state.selectedClefBeat = clefAt.beat ?? 0
    this.state.selectedClefStaff = clefAt.staff ?? 0
    const isProtected = clefAt.measure === 1 && (clefAt.beat ?? 0) === 0
    dbg(`✓ Clef selected | measure:${clefAt.measure} beat:${clefAt.beat ?? 0}${isProtected ? ' (measure 1 opening: change only, cannot remove)' : ''}`)

    // Arm horizontal dragging for movable clefs (every clef except the big
    // line-start one). Recover the exact Fraction beat from the model.
    if (!clefAt.immovable) {
      const measure = engine.getScore().measures.find(m => m.number === clefAt.measure)
      const approxBeat = clefAt.beat ?? 0
      const change = measure?.clefs?.find(c => Math.abs(fracToNumber(c.beat) - approxBeat) < 1e-6)
      if (change) {
        this.isDraggingClef = true
        this.draggedClefMeasure = clefAt.measure
        this.draggedClefBeat = change.beat
        this.draggedClefStartMeasure = clefAt.measure
        this.draggedClefStartBeat = change.beat
        this.clefDragStartTime = Date.now()
        // Freeze line breaks so sliding the clef re-pitches notes without
        // reflowing the score; we settle the layout on drop.
        engine.setLayoutFrozen(true)
        engine.setDraggingClef({ measure: clefAt.measure, beat: change.beat })
        event.preventDefault()
      }
    }
    this.render.renderScore()
    return true
  }

  /** Select a time-signature glyph for removal. */
  private handleTimeSignatureMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y } = ctx
    // Time-signature selection — click the TS glyph to select it for removal.
    // The TS column sits to the right of the clef (no overlap), and the glyph is
    // only registered where it's drawn (measure 1 + change measures).
    const timeSigAt = registry.getByType('timeSignature').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (timeSigAt?.measure === undefined) return false

    this.selection.selectNote(null)
    this.state.selectedTimeSignatureMeasure = timeSigAt.measure
    const isDefault = timeSigAt.measure === 1
    dbg(`✓ Time signature selected | measure:${timeSigAt.measure}${isDefault ? ' (measure 1 default: delete hides the glyph, meter kept)' : ' (delete reverts to prior meter + rebars)'}`)
    this.render.renderScore()
    return true
  }

  /**
   * Select the barline that ENDS a measure.
   *
   * Registered per (measure, staff) — the ink is drawn once per staff — but selected as ONE
   * system-wide thing (`selectedBarlineMeasure`), so whichever staff the click lands on, the whole
   * line is what gets picked. See EditorState.selectedBarlineMeasure for why that is the identity.
   */
  private handleBarlineMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y, closestElement } = ctx
    // The registered box is 4px wide (it straddles the drawn line) — not a clickable target on its
    // own, so widen it horizontally. NOT vertically: the box is exactly the five staff lines, and a
    // click in the gap between two staves is on no barline at all.
    const pad = 4
    const barlineAt = registry.getByType('barline').find(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (barlineAt?.measure === undefined) return false

    // Never steal a click that lands on a note/rest body — the bar's last column sits close to the
    // barline, and the pad above reaches into it.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    this.selection.selectNote(null)
    this.state.selectedBarlineMeasure = barlineAt.measure
    this.armBarWidthDrag(ctx.engine, barlineAt.measure, x)
    dbg(`✓ Barline selected | ends measure:${barlineAt.measure}`)
    this.render.renderScore()
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
    if (!room) return
    if (room.barlineSlope <= 0) {
      dbg(`Bar width | bar ${measure} ends its system — its barline is pinned, so the drag moves the bar's own music`)
    }
    this.barWidthDrag = { measure, room }
    this.barWidthDragStartX = x
    this.barWidthDragLineKey = engine.barWidthLineKey(measure)
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
      this.barWidthDragChanged = true
      this.render.renderScore()
      this.reanchorIfRewrapped(engine, measure, x)
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
    this.isDraggingBarWidth = false
    this.barWidthDragLineKey = null
  }

  /**
   * Select a tempo mark (above the staff) for removal. A tempo mark is system-level, so
   * this is NOT scoped to the clicked staff — the mark is drawn once, above the top staff.
   */
  private handleTempoMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y, closestElement } = ctx
    const pad = 6
    const tempoAt = registry.getByType('tempo').find(el => {
      const b = el.bbox
      return x >= b.x - pad && x <= b.x + b.width + pad
        && y >= b.y - pad && y <= b.y + b.height + pad
    }) ?? null
    if (!tempoAt?.id) return false

    // Never steal a click that lands on a note/rest body — a high note can sit under the
    // mark's padded box (it is engraved on a fixed line above the staff).
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // Double-click → edit the whole mark in place, as one string ('Allegro (♩ = 144)'). The
    // model is read back out of what was typed — see TempoTextSource / utils/tempoText.
    const now = Date.now()
    const isDoubleClick = this.lastTempoDownId === tempoAt.id
      && (now - this.lastTempoDownTime) < this.DOUBLE_CLICK_MS
    this.lastTempoDownId = tempoAt.id
    this.lastTempoDownTime = now

    if (isDoubleClick) {
      this.lastTempoDownId = null // consume, so a 3rd click isn't another double
      // Stop the browser's default mousedown focus/selection — it would steal focus back
      // from the overlay right after we focus it, and typing would go nowhere.
      ctx.event.preventDefault()
      dbg(`✓ Editing tempo mark | id:${tempoAt.id}`)
      this.openTempoTextEditor(tempoAt.id, false)
      return true
    }

    this.selection.selectNote(null)
    this.state.selectedTempoId = tempoAt.id
    dbg(`✓ Tempo mark selected | id:${tempoAt.id}`)
    this.render.renderScore()
    return true
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

  /** Select a dynamic mark for removal, or open the text editor on a double-click. */
  private handleDynamicMouseDown(ctx: MouseDownCtx): boolean {
    const { engine, event, registry, x, y, closestElement } = ctx
    // Dynamic selection — click a dynamic mark (below the staff) to select it for
    // removal. Small pad makes the small glyph/text easier to hit.
    const dynPad = 6
    const dynamicAt = registry.getByType('dynamic').find(el => {
      const b = el.bbox
      return x >= b.x - dynPad && x <= b.x + b.width + dynPad
        && y >= b.y - dynPad && y <= b.y + b.height + dynPad
    }) ?? null
    if (!dynamicAt?.id) return false

    // A dynamic's padded hit-box can overlap a notehead/rest; never let it steal a
    // click that actually lands on a note/rest body — the note is the intended target.
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // Manual double-click detection: a second mousedown on the SAME dynamic within
    // the threshold opens the in-canvas text editor. We can't use the native
    // `dblclick` event here because selecting re-renders the score on every
    // mousedown, swapping the SVG nodes — so the two clicks land on different
    // element instances and the browser never fires dblclick.
    const now = Date.now()
    const isDoubleClick = this.lastDynamicDownId === dynamicAt.id
      && (now - this.lastDynamicDownTime) < this.DOUBLE_CLICK_MS
    this.lastDynamicDownId = dynamicAt.id
    this.lastDynamicDownTime = now

    if (isDoubleClick) {
      const dyn = engine.getDynamicById(dynamicAt.id)
      if (dyn) {
        // Any dynamic is editable — a level ('p'/'f') seeds the editor with its
        // letters, custom text with its text (expression == dynamic, Step 1).
        this.lastDynamicDownId = null // consume, so a 3rd click isn't a double
        // Stop the browser's default mousedown focus/selection — otherwise it
        // steals focus back from the overlay right after we focus it, and typing
        // goes nowhere.
        event.preventDefault()
        dbg(`✓ Editing dynamic | id:${dynamicAt.id}`)
        this.openTextEditor(dynamicAt.id, false)
        return true
      }
    }

    this.selection.selectNote(null)
    this.state.selectedDynamicId = dynamicAt.id
    dbg(`✓ Dynamic selected | id:${dynamicAt.id}`)
    this.render.renderScore()
    return true
  }

  /** Select a tie arc for removal. */
  private handleTieMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y } = ctx
    const tiePad = 6
    const tieAt = registry.getByType('tie').find(el => {
      const b = el.bbox
      return x >= b.x - tiePad && x <= b.x + b.width + tiePad
        && y >= b.y - tiePad && y <= b.y + b.height + tiePad
    }) ?? null
    if (!tieAt?.fromNoteId) return false

    // Clear the whole note selection (the multi-select Map, not just the anchor)
    // and any scalar sub-selections, so only the tie ends up selected.
    this.selection.selectNote(null)
    this.state.selectedTieFromNoteId = tieAt.fromNoteId
    dbg(`✓ Tie selected | fromNoteId:${tieAt.fromNoteId} toNoteId:${tieAt.toNoteId} fromMeasure:${tieAt.fromMeasure} toMeasure:${tieAt.toMeasure}`)
    this.render.renderScore()
    return true
  }

  /** Select a slur arc for removal (hit-tested against the sampled curve points). */
  private handleSlurMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y } = ctx
    // Slur selection — hit-test by proximity to the ARC, not the coarse bbox
    // rectangle (which sits over the spanned notes). Clicking near the curve selects
    // it; Delete removes the arc (never the notes). We measure distance to the line
    // SEGMENTS between consecutive sampled points (a continuous ribbon along the
    // curve), not to the discrete points — otherwise wide arcs (cross-system BEGIN/
    // MIDDLE/END segments span a whole system, so the fixed ~17 samples sit tens of
    // px apart) would only be clickable right on a sample dot.
    const slurPad = 7
    const slurAt = registry.getByType('slur').find(el => {
      const pts = el.points
      if (!pts?.length) return false
      if (pts.length === 1) return (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2 <= slurPad * slurPad
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= slurPad) return true
      }
      return false
    }) ?? null
    if (!slurAt?.id) return false

    this.selection.selectNote(null)
    this.state.selectedSlurId = slurAt.id
    // Selecting the slur by its arc disarms any previously-armed endpoint nudge — clicking
    // a blue (true end) or orange (open join) square is the only thing that re-arms one.
    this.state.selectedSlurEndpoint = null
    this.state.selectedSlurSegmentEndpoint = null
    dbg(`✓ Slur selected | id:${slurAt.id}`)
    this.render.renderScore()
    return true
  }

  /**
   * Select a slot's augmentation DOTS. Clicking any one dot selects them ALL — `dots` is a single
   * value on the chord/rest, so the glyphs (one per notehead per dot) share one anchor id and there
   * is no individual dot to select. Works on a dotted REST too — the dot is the only sub-element a
   * rest carries, and it is a normal thing to author (and what restFill picks for a compound beat).
   */
  private handleDotMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y } = ctx

    // A dot glyph is ~3px across, so its bare bbox is unclickable — pad it, like the tie (6) /
    // dynamic (6) / articulation (8) boxes.
    //
    // Padding alone is not enough here, though. The note's own hit-box is not the notehead: it is a
    // generous ±1.1 staff spaces from the head CENTRE (ElementRegistry.hitsNoteOrRestBody), while
    // the head is only ~0.65 spaces half-wide — and VexFlow parks the dot in the gap just beyond it.
    // So the dot lies INSIDE the note's click margin: the two boxes overlap by construction, and
    // whichever is tested first simply wins while the loser becomes unclickable. Ordering cannot
    // separate them, and shrinking the note's margin would make every note harder to hit.
    //
    // So discriminate by PROXIMITY: the click goes to whichever centre it is nearer. A dot sits
    // beside its head at much the same height, so the X distance is what separates the two.
    const dotPad = 6
    const centerX = (el: ElementInfo) => el.bbox.x + el.bbox.width / 2
    const hits = registry.getByType('dot').filter(el => {
      const b = el.bbox
      return x >= b.x - dotPad && x <= b.x + b.width + dotPad
        && y >= b.y - dotPad && y <= b.y + b.height + dotPad
    })
    if (!hits.length) return false
    const dotAt = hits.reduce((best, el) =>
      Math.abs(x - centerX(el)) < Math.abs(x - centerX(best)) ? el : best)
    if (!dotAt.noteId) return false

    const head = registry.findClosestNoteOrRest(x, y)
    if (head && registry.hitsNoteOrRestBody(head, x, y)) {
      const headX = head.headX ?? centerX(head)
      // Ties go to the note: it is the primary target, and its dots are reachable from it anyway.
      if (Math.abs(x - headX) <= Math.abs(x - centerX(dotAt))) return false
    }

    // Clear the whole note selection (the multi-select Map drives the note highlight, not just
    // selectedNoteId) so only the dots show selected — mirrors the accidental.
    this.selection.selectNote(null)
    this.state.selectedDotNoteId = dotAt.noteId
    dbg(`✓ Dot selected | noteId:${dotAt.noteId} dots:${this.getEngine()?.getNote(dotAt.noteId)?.dots ?? 0}`)
    this.render.renderScore()
    return true
  }

  /** Select an accidental glyph for removal. */
  private handleAccidentalMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y } = ctx
    const accidentalAt = registry.getByType('accidental').find(el => {
      const b = el.bbox
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
    }) ?? null
    if (!accidentalAt?.noteId) return false

    // Clear the whole note selection (the multi-select Map drives the note
    // highlight, not just selectedNoteId) so only the accidental shows selected.
    this.selection.selectNote(null)
    this.state.selectedAccidentalNoteId = accidentalAt.noteId
    this.state.selectedAccidentalType = accidentalAt.accidentalType || null
    dbg(`✓ Accidental selected | noteId:${accidentalAt.noteId} type:${accidentalAt.accidentalType}`)
    this.render.renderScore()
    return true
  }

  /**
   * Select a slot's TREMOLO mark — asked immediately before the stem, because it is drawn ON the
   * stem and the two rects overlap wherever the strokes are.
   *
   * THE MARK WINS ONLY INSIDE ITS OWN BOUNDARIES. Both are registered as INK, and this test is bare
   * containment (no pad, see {@link ElementRegistry.findTremoloAt}), so the border between the two
   * is the edge of the strokes themselves: press on the strokes and you get the mark; press on the
   * stem above or below them — which on a two-stroke tremolo is most of its length — and the stem is
   * still perfectly selectable.
   *
   * The notehead keeps its ground first, exactly as it does against the stem: a tremolo's stack is
   * centred on the stem and cannot reach the head, so this only ever declines a press the head
   * already owns.
   */
  private handleTremoloMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y, closestElement } = ctx
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // A tremolo carries `noteId`, never `id` — like the stem it rides.
    const noteId = registry.findTremoloAt(x, y)?.noteId
    if (!noteId) return false

    this.selection.selectNote(null)
    this.state.selectedTremoloNoteId = noteId
    dbg(`✓ Tremolo selected | noteId:${noteId} mark:${this.getEngine()?.getNote(noteId)?.tremolo}`)
    this.render.renderScore()
    return true
  }

  /**
   * Select a slot's STEM — the twin of the dot/accidental handlers, and the pointer half of the
   * `'stem'` element the renderer already registers.
   *
   * THE NOTE COMES FIRST. `hitsNoteOrRestBody` deliberately ignores the stem (its tall box is what
   * made selection feel over-eager), so a stem click can only ever be one the note itself declined
   * — but the two rects DO overlap where the stem meets the head, so the note is asked first and
   * keeps that ground. What is left is the stem's free length, which is exactly what "click the
   * stem" means.
   *
   * Containment on the stem's own ink (padded), never nearest-note: a click at the TIP of a stem is
   * a whole stem-length from its own notehead, so proximity would hand it to a denser neighbour —
   * the same reason the tremolo stamp resolves through {@link ElementRegistry.findStemAt}.
   *
   * Selection only: nothing acts on the selected stem yet (see EditorState.selectedStemNoteId).
   */
  private handleStemMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y, closestElement } = ctx
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false

    // A stem carries `noteId`, never `id` (a stem must never answer a lookup for its note).
    const noteId = registry.findStemAt(x, y)?.noteId
    if (!noteId) return false

    // Clear the whole note selection (the multi-select Map drives the note highlight, not just
    // selectedNoteId) so only the stem shows selected — mirrors the accidental and the dots.
    this.selection.selectNote(null)
    this.state.selectedStemNoteId = noteId
    dbg(`✓ Stem selected | noteId:${noteId}`)
    this.render.renderScore()
    return true
  }

  /** Select a whole articulation group (Sibelius-style) on the clicked note. */
  private handleArticulationMouseDown(ctx: MouseDownCtx): boolean {
    const { registry, x, y, closestElement } = ctx
    const articulationAt = this.articulationHit(x, y, closestElement, registry)
    if (!articulationAt?.noteId) return false

    // Sibelius-style: clicking any articulation selects the whole group on that
    // note (all its articulations), not just the clicked glyph.
    this.selection.selectArticulation(articulationAt.noteId)
    dbg(`✓ Articulation group selected | noteId:${articulationAt.noteId} (clicked:${articulationAt.articulationType})`)
    this.render.renderScore()
    return true
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
      this.armStaffSpacingDrag(engine, this.state.selectedMeasureRange!.anchor, y)
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

  /**
   * Invert `Curve.renderCurve`'s control-point math (the same math `drawCurveArc` uses
   * forward) to recover the **pixel** control-point deltas from the two on-screen control
   * points and the arc's endpoint geometry (the caller converts to staff-spaces before
   * storing). With xShift/yShift = 0 and `cps.length === 2`,
   * `spacing = (p1.x - p0.x) / 4`, `C0 = (p0.x+spacing+cp0.x, p0.y+cp0.y·dir)` and
   * `C1 = (p1.x-spacing+cp1.x, p1.y+cp1.y·dir)`.
   */
  private cpsFromControlPoints(
    cps: [{ x: number; y: number }, { x: number; y: number }],
    ep: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number },
  ): [{ x: number; y: number }, { x: number; y: number }] {
    const { p0, p1, direction } = ep
    const spacing = (p1.x - p0.x) / 4
    return [
      { x: cps[0].x - p0.x - spacing, y: (cps[0].y - p0.y) * direction },
      { x: cps[1].x - p1.x + spacing, y: (cps[1].y - p1.y) * direction },
    ]
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
   * every resolution/render/playback path already keys on `voice ?? 0` (see
   * utils/dynamics resolveActiveLevel/resolveChordLevels, ScoreModel.addDynamic,
   * VexFlowRenderer.attachDynamicsToSlots). When multi-voice editing lands, the
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

    const score = engine.getScore()
    let selectedNote = null
    for (const measure of score.measures) {
      const note = getMeasureNotes(measure).find(n => n.id === this.state.selectedNoteId)
      if (note) { selectedNote = note; break }
    }

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
    const room = engine.noteSpacingRoom(note.measure, note.beat)
    if (room === null) return
    this.spacingDragColumn = { measure: note.measure, beat: note.beat }
    this.spacingDragBaseline = engine.getNoteSpacing(note.measure, note.beat)
    this.spacingDragMinSpace = this.spacingDragBaseline - room
    this.spacingDragStaffSpacePx =
      engine.getElementRegistry().getStaffGeometry(note.measure, note.staff ?? 0)?.lineSpacing ?? 10
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
        this.state.selectedClefMeasure = targetMeasure
        this.state.selectedClefBeat = fracToNumber(targetBeat)
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
