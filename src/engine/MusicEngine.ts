import { dbg } from '@/utils/debug'
import { ScoreModel } from './models/ScoreModel'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, resolveStaffSpacingAbove, staffSystemSpacingKey, dynamicOffsetOverrideOf, tempoOffsetOverrideOf, noteOffsetOverrideOf, spacingPositionKey, leadingSpaceOverrideOf, barlineSpaceKey, barlineSpaceOf, barWidthKey, measureStretch, BAR_STRETCH_MIN } from './models/engravingOverrides'
import { resolveStaffSize, STAFF_SPACE_PX } from './models/staffSize'
import type { HairpinDragWrite } from './models/hairpinOps'
import type { DynamicSlotTarget } from './models/dynamicOps'
import type { Stop as TempoStop } from './models/tempoOps'
import type { OttavaDragWrite } from './models/ottavaOps'
import type { PedalDragWrite } from './models/pedalOps'
import { staveHeightPx, systemStaffTops, minSpacingAboveSpaces, spacingAbovePx, MIN_SPACING_ABOVE_AT_PAGE_TOP } from './layout/staffStride'
import { VexFlowRenderer } from './rendering/VexFlowRenderer'
import type { ViewMode, GutterState, GutterStaffState } from './rendering/layoutConfig'
import type { ToolGhost } from './rendering/ghostTypes'
import { measuredShrinkRoom, fanMemberShrinkRoom, measuredBarShrinkPx, measuredBarlineGapRoom } from './layout/measuredRoom'
import { barWidthRoom as barWidthRoomOf, type BarWidthRoom } from './layout/barWidthRoom'
import { resolveSurface, SKETCH_CANVAS, type Surface } from './layout/surface'
import { neighbourBandOf, stepStaysInBand } from './layout/systemBand'
import type { InkBox } from './layout/pageBounds'
import { nudgeFitsOnPage } from './layout/pageBounds'
import { CULL_OVERSCAN, expandRect, rectContains, type Rect } from './ViewportModel'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { UndoRedoManager } from './UndoRedoManager'
import { NoteEntryCoordinator, INVALID_NOTE_ENTRY_TYPES } from './NoteEntryCoordinator'
import { getStaves, staffIdAtIndex, staffSlots } from './models/staffContent'
import { midiToNoteName, beatToFrac, compareByPosition, measureAccidentalNotes, deriveTupletM, tupletMarkRuns } from '@/utils/musicUtils'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { fracToNumber, fracEq } from '@/utils/fraction'
import { quantizeBeat, slotLength } from '@/utils/durations'
import { spellingToMidi, accidentalToAlter, spellingDiatonicPos, formatPitch } from '@/utils/pitchSpelling'
import { prevailingAlterAt } from '@/utils/accidentalState'
import type { BeamRole } from '@/utils/beaming'
import { naturalStemDirection } from '@/utils/clefUtils'
import type { Score, Note, NoteParams, Fraction, PixelCoordinates, Tuplet, TupletFormat, TupletMarkRun, TupletShape, TupletNumberStyle, NoteDuration, ArticulationType, Accidental, PitchSpelling, GhostNote, Clef, TimeSignature, Dynamic, DynamicLevel, Hairpin, Ottava, Pedal, TempoMark, Slur, Trill, TrillContinuationLabel, PitchAlter, PitchStep, CurveControlPointDeltas, SlurSegmentAddress, SlurSegmentEndpointAddress, TremoloMark, FanMark } from '@/types/music'
import { dynamicLabel } from '@/utils/dynamics'
import { tempoLabel } from '@/utils/tempoMap'
import type { ElementRegistry, ElementInfo, ElementType } from './ElementRegistry'
import type { Clip, ClipTarget } from '@/utils/clip'
import type { TrillAuxiliary } from '@/utils/trillPitch'
import type { TrillSpan } from '@/engine/models/trillOps'
import { staffOf, voiceOf } from '@/utils/lanes'
import type { VoiceScope } from '@/utils/dynamicScope'

/**
 * Configuration for the MusicEngine
 */
export interface MusicEngineConfig {
  /** Container element for rendering */
  container: HTMLElement
  /** Initial canvas width */
  width?: number
  /** Initial canvas height */
  height?: number
  /** Coordinate mapper configuration */
  coordinateConfig?: Partial<CoordinateMapperConfig>
  /**
   * What to draw ON — a page or the sketching canvas (`engine/layout/surface.ts`). Omitted, the
   * engine draws the canvas: an embedder that has said nothing about paper has not asked for any.
   * `App.ts` states A4, which is what makes the editor open on a page.
   */
  surface?: Surface
}

/** Re-exported: the type moved to `engine/layout/barWidthRoom` with the function that builds it,
 *  and `MouseController` (its only other reader) still names it off the engine. */
export type { BarWidthRoom }

/**
 * MusicEngine is the main API that Developer B will use
 * It coordinates all music engine components (models, rendering, audio, collision)
 */
export class MusicEngine {
  private scoreModel: ScoreModel
  private renderer: VexFlowRenderer
  private coordinateMapper: CoordinateMapper
  private collisionDetector: CollisionDetector
  private playbackEngine: PlaybackEngine
  private undoRedoManager: UndoRedoManager
  private noteEntryCoordinator: NoteEntryCoordinator

  constructor(config: MusicEngineConfig) {
    this.scoreModel = new ScoreModel()
    this.renderer = new VexFlowRenderer(config.container)

    // Calculate coordinate mapper config based on container size. ⚠️ These size the *DOM element*
    // before anything is engraved — `renderScore` resizes the SVG to whatever surface it cast off
    // onto. Taken from the engine's own surface rather than a literal, so there is one answer to
    // "how wide is this thing" and not two.
    const width = config.width || resolveSurface(this.surface).widthPx
    const height = config.height || 400
    const measuresPerLine = 4 // 4 measures per line
    const margin = 20
    const availableWidth = width - (margin * 2)
    const staveWidth = Math.floor(availableWidth / measuresPerLine)

    this.coordinateMapper = new CoordinateMapper({
      measureWidth: staveWidth, // No gaps between measures
      staffHeight: 120 + 30, // per-staff stride: staveHeight + verticalSpacing
      numStaves: 1, // multi-staff: kept in sync with the model on each render
      startX: margin,
      startY: margin,
      measuresPerLine: measuresPerLine,
      lineSpacing: 10,
      measureLeftMargin: 100,
      ...config.coordinateConfig
    })

    this.collisionDetector = new CollisionDetector()
    this.playbackEngine = new PlaybackEngine()
    this.undoRedoManager = new UndoRedoManager()
    this.noteEntryCoordinator = new NoteEntryCoordinator(
      () => this.scoreModel,
      this.coordinateMapper,
      this.collisionDetector,
      this.renderer.getElementRegistry(),
      (description) => {
        this.commit(description)
      }
    )

    // Initialize renderer
    this.renderer.initialize(width, height)
    // Stated, or the plain canvas both this and the renderer already default to. Pushed only when
    // stated, so the two can never disagree and an embedder that says nothing gets no paper.
    if (config.surface) this.setSurface(config.surface)

    // Set score in playback engine
    this.playbackEngine.setScore(this.scoreModel.getScore())

    // Save initial state for undo/redo
    this.undoRedoManager.saveInitialState(this.scoreModel.getScore())
  }

  // ==================== Undo/Redo ====================

  /** While true, individual mutations skip their undo snapshot — a surrounding
   *  {@link runBatch} owns the single snapshot for the whole group. */
  private undoSuppressed = false

  /** Set whenever the data model changes (any edit, undo/redo, or load); cleared
   *  after {@link renderScore} repairs measure gaps. Lets a pure re-render (selection,
   *  scroll, zoom, playback cursor) skip the gap-repair pass — it only needs to run
   *  after a real change, not on every paint. Starts true so the first render repairs. */
  private modelDirty = true

  /** Anything that must be told the SCORE changed — as opposed to the editor's selection, which
   *  `EditorState.subscribe` already publishes. See {@link onModelChange}. */
  private modelListeners = new Set<() => void>()
  /** One notification per turn, however many mutations it took. See {@link onModelChange}. */
  private modelNotifyScheduled = false

  /** Mark the data model as changed so the next render repairs measure gaps. */
  private markModelDirty(): void {
    this.modelDirty = true
    this.scheduleModelNotify()
  }

  /**
   * Tell me when the SCORE changed.
   *
   * The editor already publishes when the *selection* changes (`EditorState.subscribe`), and for a
   * long time that was enough, because everything watching was watching the selection. It is not
   * enough for anything that displays the selected element's CONTENTS: retuning a selected rest
   * changes the model and not the selection, so a selection-only subscriber never hears about the
   * edit — and worse, the one state change it does hear (`selectedDuration`) fires BEFORE the
   * mutation, so it reads the note in its old state and then goes quiet. That is the Properties
   * window's stale-dump bug, and it belongs here rather than in a workaround at the panel.
   *
   * Delivery is deferred to a microtask, deliberately, and that is what makes it safe to use:
   *
   * - **Ordering.** Mutators mark dirty through `saveUndoState`, which some call before the write
   *     and some after. A synchronous notification would therefore sometimes fire mid-edit, and
   *     every listener would need to know which. Deferred, the model is always settled.
   * - **Coalescing.** A `runBatch` of forty edits marks dirty forty times and notifies once.
   *
   * Listeners must READ ONLY. Mutating the score from one re-enters this in a way nothing here
   * defends against; if a listener needs to edit, it wants a command, not a notification.
   */
  onModelChange(fn: () => void): () => void {
    this.modelListeners.add(fn)
    return () => this.modelListeners.delete(fn)
  }

  private scheduleModelNotify(): void {
    if (this.modelNotifyScheduled || this.modelListeners.size === 0) return
    this.modelNotifyScheduled = true
    queueMicrotask(() => {
      this.modelNotifyScheduled = false
      for (const fn of this.modelListeners) fn()
    })
  }

  /** The view state as of the last full render — half of {@link isRenderStale}'s key. */
  private lastViewStateKey: string | null = null

  /**
   * Is the drawn SVG still a correct picture of the score? (docs/render-performance-plan.md §5a)
   *
   * Three ways it can be wrong, and **the selection is none of them** — that is the point of P3.
   * A selection change only needs the highlight pass repainted, not a 200-bar score re-laid-out
   * and redrawn.
   *
   *  1. **Content** — {@link modelDirty}. Every edit funnels through `commit`/`saveUndoState`
   *     (the ARCHITECTURE invariant), which sets it. A direct write to `scoreModel` that bypasses
   *     the facade would defeat this — but that write is already a bug.
   *  2. **View state** — {@link VexFlowRenderer.viewStateKey}: view mode, the linear staff-spacing
   *     knob, a suppressed (being-text-edited) dynamic/tempo, a frozen layout, a dragged clef.
   *
   * A ghost on the canvas is deliberately NOT a third reason: since P4 the preview is an overlay,
   * so taking it down is a DOM removal ({@link clearGhosts}), not a reason to re-engrave.
   */
  isRenderStale(): boolean {
    return this.modelDirty || this.renderer.viewStateKey(this.scoreModel.getScore()) !== this.lastViewStateKey
  }

  /** Take down the preview ghost, if any. O(1) — see {@link VexFlowRenderer.clearGhosts}. */
  clearGhosts(): void {
    this.renderer.clearGhosts()
  }

  /** Re-place the barline ink on the pixel grid after a ZOOM — two attributes per barline, no
   *  re-engraving. See {@link VexFlowRenderer.hintBarlines}. */
  hintBarlines(force = false): void {
    this.renderer.hintBarlines(force)
  }

  /** How many times an undo snapshot has been ASKED for — incremented even when the ask is
   *  suppressed inside a batch. {@link runBatch} reads it to answer "did `fn` change anything?"
   *  without serializing the score. @see runBatch */
  private undoRequests = 0

  /**
   * Run several mutations as ONE undoable action. Every saveUndoState inside `fn`
   * is suppressed; a single snapshot of the final state is pushed afterward (only
   * if `fn` actually changed something). One Ctrl-Z then restores the whole group
   * (e.g. deleting or transposing a multi-note selection), not one element at a
   * time. Nested batches are flattened — only the outermost pushes.
   *
   * "Did `fn` change anything?" used to be answered by stringifying the WHOLE SCORE before and
   * after and comparing — two full serializations per batched edit, on top of the deep clone
   * `pushState` already does. At orchestral scale that is ~150 ms of the ~220 ms an edit spends
   * in undo (docs/render-performance-plan.md §7). But every mutation that wants an undo entry
   * calls {@link saveUndoState}, which bumps {@link undoRequests} *even while suppressed* — so
   * the answer is already known, for free.
   *
   * **The trade, honestly:** this is "did anything ASK to be saved", where the stringify-compare
   * was "did the content actually differ". They diverge in BOTH directions:
   *
   * 1. An operation that **saves without changing anything** (setting a value to what it already
   *    was) pushes a no-op undo step — one wasted Ctrl-Z. Harmless.
   * 2. ⚠️ An operation that **changes without asking to be saved** is INVISIBLE here. `fn` mutates
   *    the model, this counts zero requests, concludes nothing happened, and never calls
   *    `saveUndoState` — which is the only thing that calls `markModelDirty()`. So the edit lands
   *    in the model, the next render is skipped as "nothing changed", and there is no undo entry.
   *    A wrong picture AND a lost undo, from an operation that looked correct.
   *
   * (2) is not hypothetical: `toggleRestHidden` was written that way, deliberately skipping its
   * snapshot on the grounds that "the batch owns it" — which is exactly the circle this cannot
   * close. **Every mutator must call `saveUndoState`, batched or not.** Inside a batch that is free:
   * it marks dirty, counts the request, and returns without pushing.
   *
   * @returns true if a snapshot was pushed, false otherwise.
   */
  runBatch(description: string, fn: () => void): boolean {
    if (this.undoSuppressed) { fn(); return false } // inner batch: outer owns the snapshot

    const requestsBefore = this.undoRequests
    this.undoSuppressed = true
    try {
      fn()
    } finally {
      this.undoSuppressed = false
    }
    const changed = this.undoRequests > requestsBefore
    if (changed) this.saveUndoState(description)
    return changed
  }

  /**
   * Save current state to undo history (call after mutations)
   */
  private saveUndoState(description: string): void {
    // Any save means the model changed (even a batched one the runBatch will push later), so
    // flag it dirty and count the request BEFORE the suppressed-return: the next render needs
    // the former to repair gaps, and the surrounding runBatch needs the latter to know that
    // `fn` did something.
    this.markModelDirty()
    this.undoRequests++
    if (this.undoSuppressed) return // batched: the surrounding runBatch pushes once
    this.undoRedoManager.pushState(this.scoreModel.getScore(), description)
  }

  /**
   * Sync playback with the current score, then snapshot for undo. Use for any score
   * mutation that changes what plays. setScore always runs; saveUndoState self-
   * suppresses inside a runBatch.
   */
  private commit(description: string): void {
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState(description)
  }

  /**
   * Snapshot for undo WITHOUT a playback resync. Use only for changes that do not
   * affect audible output (title, display-only flags, slur/tie/clef visual edits).
   */
  /**
   * ⭐⭐ **THE PAGE LIMIT — may this hand-nudge be WRITTEN?** His report, 2026-08-17: *"all the
   * objects that we offset, when in wrapped mode, can go out of the page… when we have boundaries
   * there must be a limit."*
   *
   * ⭐ **It refuses the WRITE, which is the whole point** — see `layout/pageBounds` for his own
   * argument. A limit applied only where the ink is drawn lets the stored offset run on invisibly
   * (his ottava log reached −45 spaces with the numeral standing still), and then coming back needs
   * forty presses that do nothing.
   *
   * ⭐ **`type` + `id` is a ROW, and every offset client has exactly one.** Which drawn ink an
   * override moves is the only thing the clients disagree about; the rule itself is one module.
   *
   * ⚠️ **`dx`/`dy` are STAFF SPACES here and PIXELS in the rule** — the conversion is this one line,
   * because what is drawn is `automatic + offset` and the rule has to predict where the ink lands.
   * A client counting in something else converts at its own row (the rest counts staff STEPS).
   *
   * ⛔ Silently ALLOWS when the surface is not paper (canvas, linear view — his call) and when the
   * element has no drawn ink to measure. See `nudgeFitsOnPage`.
   */
  private nudgeStaysOnPage(type: ElementType, id: string, dx: number, dy: number): boolean {
    // ⚠️ `getByType` is called through an optional chain because the registry is STUBBED in several
    // engine specs (a partial object with the handful of methods those files need). No entries means
    // no drawn ink, which this rule already treats as "allow" — so a stub degrades to the same
    // answer it gives for an element that is simply off-screen, rather than throwing.
    const registry = this.renderer.getElementRegistry() as {
      getByType?: (t: ElementType) => ElementInfo[]
    }
    const drawn = (registry.getByType?.(type) ?? [])
      .filter((e: ElementInfo) => e.id === id).map((e: ElementInfo) => e.bbox)
    return nudgeFitsOnPage(
      resolveSurface(this.surface), drawn, dx * STAFF_SPACE_PX, dy * STAFF_SPACE_PX)
  }

  /**
   * ⭐⭐ **THE BAND LIMIT — would this nudge put the ink in a NEIGHBOUR's room?** His report,
   * 2026-08-18: a dragged slur endpoint reached 66 staff-spaces, the arc a near-vertical hairline
   * across five systems, and nothing refused it.
   *
   * ⚠️ **The page limit was not at fault** — it forbids a step that pushes ink further off its SHEET,
   * and 660 px down from mid-page is still on the page. The missing rule is about the ink's
   * neighbours, and it lives in `layout/systemBand` (which also records why MuseScore needs no such
   * rule and we do: its user-moved slurs enter the skyline and the systems open up).
   *
   * ⚠️ `dy` is STAFF SPACES here and pixels in the rule, exactly as in {@link nudgeStaysOnPage}; the
   * horizontal is not judged, since a band is a vertical extent and the page limit already answers
   * for x. ⛔ Allows when the anchor staff was not painted (nothing to measure) — same rule as the
   * page limit, for the same reason.
   */
  private nudgeStaysInBand(drawn: readonly InkBox[], measure: number, staff: number, dy: number): boolean {
    const registry = this.renderer.getElementRegistry() as {
      getStaffGeometry?: (m: number, s: number) => { lineYPositions: readonly number[] } | undefined
      staffBands?: () => { top: number; bottom: number }[]
    }
    const geometry = registry.getStaffGeometry?.(measure, staff)
    if (!geometry) return true
    const mine = { top: geometry.lineYPositions[0], bottom: geometry.lineYPositions[4] }
    const others = (registry.staffBands?.() ?? []).filter(b => b.top !== mine.top || b.bottom !== mine.bottom)
    return stepStaysInBand(neighbourBandOf(mine, others), drawn, dy * STAFF_SPACE_PX)
  }

  /**
   * ⭐⭐ **The drawn HANDLE of the end being moved** — the ink the band limit judges, and ⛔ NOT the
   * slur's bounding box.
   *
   * 🚨 His report, 2026-08-18: with an end 9.9 sp below the staff the endpoint could not be dragged
   * back UP. The box was the whole arc's, which spans from the arch down to that end, so its TOP
   * already poked above the band's ceiling — and the rule refuses a step that grows the overhang on
   * ANY edge, so moving up (shrinking the bottom overhang, growing the top one) was refused. The
   * endpoint was nowhere near the top; the ARCH was.
   *
   * ⚠️ The page limit's use of the whole bbox is right for the page — a sheet cares about all the ink.
   * A BAND is about one point's room, so the ink is that point. ⛔ Empty when the squares are not drawn
   * (an unselected slur, linear view), which the rule reads as "nothing to measure" and allows.
   */
  private slurEndpointInk(id: string, which: 'start' | 'end'): InkBox[] {
    const registry = this.renderer.getElementRegistry() as {
      getByType?: (t: ElementType) => ElementInfo[]
    }
    return (registry.getByType?.('slur-endpoint') ?? [])
      .filter((e: ElementInfo) => e.slurId === id && e.endpoint === which)
      .map((e: ElementInfo) => e.bbox)
  }

  /** Where the slur end being moved is anchored, for {@link nudgeStaysInBand}. Null when the anchor
   *  is not resolvable, which the caller treats as "no limit to apply". */
  private slurEndpointLane(id: string, which: 'start' | 'end'): { measure: number; staff: number } | null {
    const slur = this.scoreModel.getSlurById(id)
    if (!slur) return null
    const note = this.scoreModel.getNote(which === 'start' ? slur.startNoteId : slur.endNoteId)
    return note ? { measure: note.measure, staff: note.staff ?? 0 } : null
  }

  /** Both limits an endpoint offset must satisfy: it may not leave its SHEET
   *  ({@link nudgeStaysOnPage}) and it may not enter a neighbouring staff's room
   *  ({@link nudgeStaysInBand}). Shared by the keyboard nudge and every drag frame, so the two
   *  devices cannot disagree about what is allowed. */
  private slurEndpointOffsetAllowed(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('slur', id, dx, dy)) return false
    const lane = this.slurEndpointLane(id, which)
    return !lane || this.nudgeStaysInBand(this.slurEndpointInk(id, which), lane.measure, lane.staff, dy)
  }

  /** The same two limits for a move of the WHOLE curve ({@link nudgeSlur}) — ⭐ the band one applied
   *  to EACH end in its own band, since a rigid translate moves both and a cross-system slur's ends
   *  live in different systems. ⛔ Still not the arc's bbox: `slurEndpointInk`'s note says why. */
  private slurOffsetAllowed(id: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('slur', id, dx, dy)) return false
    for (const which of ['start', 'end'] as const) {
      const lane = this.slurEndpointLane(id, which)
      if (lane && !this.nudgeStaysInBand(this.slurEndpointInk(id, which), lane.measure, lane.staff, dy)) return false
    }
    return true
  }

  private saveOnly(description: string): void {
    this.saveUndoState(description)
  }

  /**
   * Record the undo entry for a change the model has **already taken and the screen has already
   * shown** — the drop of a live drag, whose every frame went through a `preview*` method.
   *
   * It records history; it does not change content. So unlike {@link saveUndoState} it must NOT
   * flag the model dirty: doing so re-engraves the entire score to paint a picture that is
   * already on screen. That was costing a full render on every drag release (visible in the
   * census as `handleMouseLeave` — docs/render-performance-plan.md §5a).
   *
   * Inside a `runBatch` the surrounding batch owns the snapshot, exactly as in `saveUndoState`.
   */
  private commitPreviewed(description: string): void {
    this.undoRequests++ // a batch around it must still see that something happened
    if (this.undoSuppressed) return
    this.undoRedoManager.pushState(this.scoreModel.getScore(), description)
  }

  /**
   * Undo the last action
   * @returns true if undo was successful
   */
  undo(): boolean {
    const previousState = this.undoRedoManager.undo()
    if (!previousState) return false

    // Restore the state
    this.scoreModel = ScoreModel.fromJSON(JSON.stringify(previousState))
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.markModelDirty()
    return true
  }

  /**
   * Redo the last undone action
   * @returns true if redo was successful
   */
  redo(): boolean {
    const nextState = this.undoRedoManager.redo()
    if (!nextState) return false

    // Restore the state
    this.scoreModel = ScoreModel.fromJSON(JSON.stringify(nextState))
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.markModelDirty()
    return true
  }

  /** Store the selectedNoteId alongside the current undo state. */
  updateUndoNoteId(id: string | null): void {
    this.undoRedoManager.updateCurrentNoteId(id)
  }

  /** Returns the selectedNoteId recorded in the state just restored by undo/redo. */
  getLastRestoredNoteId(): string | null {
    return this.undoRedoManager.getLastRestoredNoteId()
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoRedoManager.canUndo()
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoRedoManager.canRedo()
  }

  /**
   * Description of the action that would be undone / redone (e.g. "Reshape slur").
   * Reserved for the Edit menu's labelled Undo/Redo items; currently exercised only by
   * tests. Keep — the undo stack already carries these labels, so the menu is a thin read.
   */
  getUndoDescription(): string | null {
    return this.undoRedoManager.getUndoDescription()
  }

  getRedoDescription(): string | null {
    return this.undoRedoManager.getRedoDescription()
  }

  // ==================== Score Operations ====================

  /**
   * Get the current score
   */
  getScore(): Score {
    return this.scoreModel.getScore()
  }

  /**
   * Set score title
   */
  setTitle(title: string): void {
    this.scoreModel.setTitle(title)
    this.saveOnly(`Set title to "${title}"`)
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
    this.saveOnly('Add measure')
  }

  /**
   * Add a new (rest-filled, treble-default) staff immediately ABOVE the staff at the given
   * 0-based index, growing the staff group. Records its own undo entry. @returns the new id.
   */
  addStaffAbove(refStaffIndex: number): string {
    const id = this.scoreModel.addStaffAbove(refStaffIndex)
    this.saveOnly(`Add staff above ${refStaffIndex}`)
    return id
  }

  /**
   * Add a new (rest-filled, treble-default) staff immediately BELOW the staff at the given
   * 0-based index, growing the staff group. Records its own undo entry. @returns the new id.
   */
  addStaffBelow(refStaffIndex: number): string {
    const id = this.scoreModel.addStaffBelow(refStaffIndex)
    this.saveOnly(`Add staff below ${refStaffIndex}`)
    return id
  }

  /**
   * Set how big the staff at the given 0-based index is DRAWN, as a ratio (`1` full size, `0.7` a
   * small staff — docs/staff-size-plan.md). Records its own undo entry, like the two above.
   *
   * The write lives on the facade for the one reason a write ever does: undo. The value itself and
   * the rule that reads it are `engine/models/staffSize.ts`; this takes an INDEX because that is
   * what an editor selection carries, and resolves it to the staff's durable id.
   *
   * @returns whether the score changed (false for an unknown staff, an invalid ratio, or a size
   *          that was already what was asked).
   */
  setStaffSize(staffIndex: number, size: number): boolean {
    const staffId = staffIdAtIndex(this.scoreModel.getScore(), staffIndex)
    if (staffId === undefined) return false
    if (!this.scoreModel.setStaffSize(staffId, size)) return false
    this.saveOnly(`Staff ${staffIndex} size ${size}`)
    return true
  }

  /**
   * Insert a measure immediately after `afterNumber` (0 = front), pushing every
   * following measure forward. Building block for a future "add measure" GUI;
   * records its own undo entry (rebar's internal inserts run under the enclosing
   * setTimeSignature snapshot instead).
   */
  insertMeasureAfter(afterNumber: number): void {
    this.scoreModel.insertMeasureAfter(afterNumber)
    this.saveOnly(`Insert measure after ${afterNumber}`)
  }

  /**
   * Remove an entire measure and its contents, pulling every following measure back
   * one and renumbering (Sibelius-style bar delete). Dangling ties/slurs are pruned
   * inside {@link ScoreModel.removeMeasure}. Refuses to remove the last remaining
   * measure (a score always keeps at least one bar). Records its own undo entry.
   * @returns true if a measure was removed.
   */
  removeMeasure(measureNumber: number): boolean {
    if (this.scoreModel.getScore().measures.length <= 1) {
      dbg('Cannot remove the last remaining measure')
      return false
    }
    const removed = this.scoreModel.removeMeasure(measureNumber)
    if (removed) this.saveOnly(`Remove measure ${measureNumber}`)
    return removed
  }

  /**
   * Remove a contiguous run of measures [from..to] (inclusive, order-agnostic) as ONE
   * undoable action — the box-selected passage delete. Removes from the high number
   * down so earlier numbers stay valid across the splices, and always keeps at least
   * one bar in the score.
   * @returns how many measures were actually removed.
   */
  removeMeasureRange(fromNumber: number, toNumber: number): number {
    const lo = Math.min(fromNumber, toNumber)
    const hi = Math.max(fromNumber, toNumber)
    let removedCount = 0
    for (let m = hi; m >= lo; m--) {
      if (this.scoreModel.getScore().measures.length <= 1) break // keep at least one bar
      if (this.scoreModel.removeMeasure(m)) removedCount++
    }
    if (removedCount > 0) this.saveOnly(`Remove ${removedCount} measure(s)`)
    return removedCount
  }

  /**
   * Clear one staff's content in a measure back to a single default rest (the plain-click
   * "select bar + Delete"). Delegates to {@link ScoreModel.clearMeasureStaff}; audio-
   * affecting (notes removed), so it commits. Inside a runBatch the commit coalesces, so
   * clearing + removing the bar's dynamics/slurs lands as ONE undo step.
   * @returns true if the measure existed.
   */
  clearMeasureStaff(measureNumber: number, staff: number): boolean {
    const cleared = this.scoreModel.clearMeasureStaff(measureNumber, staff)
    if (cleared) this.commit(`Clear measure ${measureNumber}`)
    return cleared
  }

  // ==================== Clef Operations ====================

  /** Clef drawn at the start of a measure (its beat-0 change, or inherited) on `staff`. */
  getEffectiveClef(measureNumber: number, staff?: number): Clef {
    return this.scoreModel.getEffectiveClef(measureNumber, this.staffIdForIndex(staff))
  }

  /** Resolve the clef in effect at a position (measure, beat) on `staff`. */
  getEffectiveClefAt(measureNumber: number, beat: Fraction, staff?: number): Clef {
    return this.scoreModel.getEffectiveClefAt(measureNumber, beat, this.staffIdForIndex(staff))
  }

  /**
   * Set/change the clef at (measure, beat). `beat` must be a slot-boundary beat.
   * Clef is visual-only, so playback is unaffected. Saves undo state when changed.
   * @returns true if the score changed.
   */
  setClefAt(measureNumber: number, beat: Fraction, clef: Clef, staff: number = 0): boolean {
    const changed = this.scoreModel.setClefAt(measureNumber, beat, clef, this.staffIdForIndex(staff))
    if (changed) {
      this.commit(`Set ${clef} clef at measure ${measureNumber} beat ${fracToNumber(beat)} staff ${staff}`)
    }
    return changed
  }

  /**
   * Remove a clef change at (measure, beat), reverting to the inherited clef.
   * Measure 1 / beat 0 cannot be removed (only changed). Saves undo state when changed.
   * @returns true if a change was removed.
   */
  removeClefAt(measureNumber: number, beat: Fraction, staff: number = 0): boolean {
    const changed = this.scoreModel.removeClefAt(measureNumber, beat, this.staffIdForIndex(staff))
    if (changed) {
      this.commit(`Remove clef at measure ${measureNumber} beat ${fracToNumber(beat)} staff ${staff}`)
    }
    return changed
  }

  // --- Measure-level (beat 0) convenience wrappers ---

  /** Set the measure's opening clef (beat 0). */
  setClef(measureNumber: number, clef: Clef, staff: number = 0): boolean {
    return this.setClefAt(measureNumber, beatToFrac(0), clef, staff)
  }

  /** Remove the measure's opening clef (beat 0). */
  removeClef(measureNumber: number, staff: number = 0): boolean {
    return this.removeClefAt(measureNumber, beatToFrac(0), staff)
  }

  // ==================== Time Signature Operations ====================

  /**
   * Set the time signature at a measure: marks an explicit change, propagates it
   * forward to the next change, and reconciles rests (never losing notes — an
   * over-full bar renders crowded). Affects playback bar lengths. Saves undo
   * state when changed.
   * @throws if `ts` is non-dyadic / out of range.
   * @returns true if the score changed.
   */
  setTimeSignature(
    measureNumber: number,
    ts: TimeSignature,
    options?: { extent?: 'measure' | 'toNextChange'; rewrite?: 'rebar' | 'none' },
  ): boolean {
    const changed = this.scoreModel.setTimeSignature(measureNumber, ts, options)
    if (changed) {
      this.commit(`Set time signature ${ts.numerator}/${ts.denominator} at measure ${measureNumber}`)
    }
    return changed
  }

  /**
   * The WHOLE meter change the Time Signature window describes, applied to one bar: the meter, the
   * cautionary decision, and the pickup — which are three mutators and ONE act.
   *
   * It exists because there are now two ways to say where: clicking a bar with the meter armed, and
   * choosing a bar first and letting OK apply it. Both mean the same thing, so both call this rather
   * than each assembling the sequence — the shape where one path grows a step the other forgets.
   *
   * `runBatch` makes it a single undo. Three separate mutators meant three presses of Ctrl+Z to get
   * back from one dialog, with the bar in a half-changed state in between.
   *
   * `cautionary`/`pickup` are OPTIONAL and absent means "no opinion" — the older palette arming path
   * says nothing about either, and must leave what it finds alone. For `pickup`, `null` is an
   * opinion ("a full bar") that CLEARS any pickup already on the bar; only `undefined` is silence.
   *
   * @returns whether the METER changed (a re-applied 4/4 is a no-op worth reporting as such).
   */
  applyTimeSignatureChange(
    measureNumber: number,
    change: { timeSignature: TimeSignature; cautionary?: boolean; pickup?: Fraction | null },
  ): boolean {
    const { timeSignature: ts, cautionary, pickup } = change
    let meterChanged = false
    this.runBatch(`Set time signature ${ts.numerator}/${ts.denominator} at measure ${measureNumber}`, () => {
      meterChanged = this.setTimeSignature(measureNumber, ts)
      if (cautionary !== undefined) this.setCautionaryAllowed(measureNumber, cautionary)
      if (pickup !== undefined) this.setMeasureActualDuration(measureNumber, pickup)
    })
    return meterChanged
  }

  /**
   * Remove the explicit time-signature change at a measure, reverting it (and
   * the measures after it, until the next change) to the inherited signature.
   * Re-bars the region by default (the meter changes); pass `rewrite: 'none'` to
   * keep barlines fixed. Measure 1 cannot be removed (use {@link setTimeSignatureHidden}).
   * Saves undo state when changed.
   * @returns true if a change was removed.
   */
  removeTimeSignatureChange(measureNumber: number, options?: { rewrite?: 'rebar' | 'none' }): boolean {
    const changed = this.scoreModel.removeTimeSignatureChange(measureNumber, options)
    if (changed) {
      this.commit(`Remove time signature change at measure ${measureNumber}`)
    }
    return changed
  }

  /**
   * Show/hide a measure's time-signature glyph without changing the meter (used to
   * delete the displayed default on measure 1: the meter stays, only the glyph is
   * suppressed). Saves undo state when changed.
   * @returns true if the visibility changed.
   */
  setTimeSignatureHidden(measureNumber: number, hidden: boolean): boolean {
    const changed = this.scoreModel.setTimeSignatureHidden(measureNumber, hidden)
    if (changed) {
      this.saveOnly(`${hidden ? 'Hide' : 'Show'} time signature at measure ${measureNumber}`)
    }
    return changed
  }

  /**
   * Set (or clear) a measure's actual playable length — a pickup / anacrusis bar.
   * `actual` is in quarter-note beats (exact Fraction); pass `null` to clear, or a
   * value ≥ the nominal bar length to clear. Saves undo state when changed.
   * @returns true if the measure changed.
   */
  setMeasureActualDuration(measureNumber: number, actual: Fraction | null): boolean {
    const changed = this.scoreModel.setMeasureActualDuration(measureNumber, actual)
    if (changed) {
      this.commit(
        actual ? `Set pickup at measure ${measureNumber}` : `Clear pickup at measure ${measureNumber}`,
      )
    }
    return changed
  }

  // ==================== Dynamic Operations ====================

  /**
   * The `staffId` string to stamp for a 0-based staff index, following the write
   * convention shared with note entry: the FIRST staff (index 0) stamps NO id (absent =
   * staff 0, keeps single-staff output byte-identical); any later staff stamps its real
   * id. Used by callers that place staff-anchored content storing a `staffId` directly
   * (dynamics, clefs) — the analogue of {@link NoteParams.staff} → id for slots.
   */
  staffIdForIndex(index: number | undefined): string | undefined {
    if (!index) return undefined
    return staffIdAtIndex(this.scoreModel.getScore(), index)
  }

  /**
   * Add a dynamic at (measure, dynamic.beat). `beat` must be a slot-boundary beat.
   * Replaces any existing dynamic at the same (beat, voice). Interpreted level
   * marks affect playback loudness; custom text marks are silent. Saves undo state
   * when added.
   * @returns the stored Dynamic, or null if the measure does not exist.
   */
  addDynamic(measureNumber: number, dynamic: Omit<Dynamic, 'id'>): Dynamic | null {
    const created = this.scoreModel.addDynamic(measureNumber, dynamic)
    if (created) {
      this.commit(`Add dynamic ${dynamicLabel(created)} at measure ${measureNumber}`)
    }
    return created
  }

  /**
   * Edit an existing dynamic (level / text / placement / beat / voice) by id.
   * Saves undo state when found. @returns the updated Dynamic, or null if missing.
   */
  updateDynamic(id: string, updates: Partial<Omit<Dynamic, 'id'>>): Dynamic | null {
    const updated = this.scoreModel.updateDynamic(id, updates)
    if (updated) {
      this.commit(`Edit dynamic ${dynamicLabel(updated)}`)
    }
    return updated
  }

  /**
   * Remove a dynamic by id. Saves undo state when removed.
   * @returns true if a dynamic was removed.
   */
  removeDynamic(id: string): boolean {
    const removed = this.scoreModel.removeDynamic(id)
    if (removed) {
      this.commit('Remove dynamic')
    }
    return removed
  }

  /**
   * Move a dynamic one slot back (−1) or on (+1) through its own lane — `Ctrl+Shift+←/→` with the
   * mark selected, the RE-ANCHOR.
   *
   * ⚠️ A CONTENT edit, where the plain / `Ctrl` arrow on the same selection writes an engraving
   * override: two chords, two categories, the arrangement every other family on the dynamics line
   * already runs (`nudgeDynamicOffset` is the other one). Playback can tell the difference — the
   * level applies from the beat this writes. Saves ONE undo entry per press, and the model drops
   * the mark's own nudge on the way (`dynamicOps.moveDynamicBySlot`).
   * @returns true when the mark moved; false (declining the key) when the walk runs off the end of
   *   the lane, or the id is no longer in the score.
   */
  /**
   * ⭐⭐ **Set which voices a dynamic or a hairpin GOVERNS** — one method for both kinds, because
   * `Alt+1…5` does not ask which one is selected: it asks what the selection can take
   * (`interactions/markVoiceScope`, docs/dynamic-voice-scope-plan.md P4).
   *
   * `'all'` is the absence — the mark governs every voice of its staff — and the model DELETES the
   * field for it rather than storing an `undefined` (`dynamicOps.setDynamicVoiceScope`).
   *
   * ⚠️ Declines (false) when nothing has that id, and when the scope is already what is asked; the
   * caller must not repaint on a false, or every press of the lit button re-renders the score.
   */
  setMarkVoiceScope(id: string, scope: VoiceScope): boolean {
    const ok = this.scoreModel.setDynamicVoiceScope(id, scope) || this.scoreModel.setHairpinVoiceScope(id, scope)
    if (ok) {
      this.commit(scope === 'all' ? 'Mark governs all voices' : `Mark governs voice ${scope + 1}`)
      dbg(`[Scope] ${id} → ${scope === 'all' ? 'ALL voices' : `voice ${scope + 1}`}`)
    }
    return ok
  }

  moveDynamicBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.moveDynamicBySlot(id, direction)
    if (ok) {
      this.commit(direction === -1 ? 'Move dynamic back' : 'Move dynamic on')
      dbg(`[Dynamic] re-anchored ${id} ${direction === -1 ? 'back' : 'on'} one slot`)
    }
    return ok
  }

  /** Record ONE undo entry after a dynamic drag settles. */
  commitDynamicDrag(): void {
    this.commitPreviewed('Move dynamic')
  }

  /**
   * Live (preview) re-anchor of a dragged dynamic onto `target` — writes the model but records no
   * undo; {@link commitDynamicDrag} records the gesture once on the drop.
   *
   * ⚠️ **The whole-slot flavour**, so it drops the mark's sideways nudge like any re-anchor: the
   * drag reaches for this only when the ink has crossed onto ANOTHER SYSTEM
   * (`interactions/dynamicLane.crossedSystemSlotAt`), which is a jump and not a walk. Ordinary
   * within-system crossings go through {@link previewDynamicSlotKeepingOffset} below, where the
   * whole point is that nothing visibly changes.
   */
  previewDynamicSlot(id: string, target: DynamicSlotTarget): boolean {
    this.markModelDirty() // live drag, undo deferred to commitDynamicDrag
    return this.scoreModel.setDynamicAtSlot(id, target)
  }

  /** The undo-free twin of {@link moveDynamicToSlotKeepingOffset} — one crossing of a dragged mark's
   *  walk; {@link commitDynamicDrag} records the whole gesture once on the drop. */
  previewDynamicSlotKeepingOffset(id: string, target: DynamicSlotTarget): boolean {
    this.markModelDirty() // live drag, undo deferred to commitDynamicDrag
    return this.scoreModel.setDynamicAtSlotKeepingOffset(id, target)
  }

  /** The undo-free twin of {@link nudgeDynamicOffset} — accumulates the same way, keeps the same
   *  page limit, records no undo step. One frame of a dynamic drag. */
  previewDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('dynamic', dynamicId, dx, dy)) return false
    if (!this.scoreModel.getDynamicById(dynamicId)) return false
    this.markModelDirty()
    return this.scoreModel.nudgeDynamicOffset(dynamicId, dx, dy)
  }

  /**
   * Hand a dynamic onto the lane slot at `target` **keeping its hand-nudged offset** — the crossing
   * of the interpolating walk (`interactions/dynamicWalk`), where {@link moveDynamicBySlot} above
   * drops it. Content, and audible, for that method's reason.
   *
   * ⚠️ Saves its own undo entry, so the walk wraps the crossing pair (this write and the re-base
   * that cancels it) in one `runBatch`: an undo that took back only half would leave the mark
   * somewhere nobody put it.
   */
  moveDynamicToSlotKeepingOffset(id: string, target: DynamicSlotTarget): boolean {
    const ok = this.scoreModel.setDynamicAtSlotKeepingOffset(id, target)
    if (ok) {
      this.commit('Move dynamic')
      dbg(`[Dynamic] walked ${id} onto m${target.measure} beat ${target.beat.num}/${target.beat.den}`)
    }
    return ok
  }

  /** Where {@link moveDynamicBySlot} would put the mark, without putting it there — the walk reads
   *  it to measure how far away the next stop is drawn (`dynamicOps.nextDynamicSlot`). */
  nextDynamicSlot(id: string, direction: 1 | -1): DynamicSlotTarget | null {
    return this.scoreModel.nextDynamicSlot(id, direction)
  }

  /** A measure's dynamics, sorted ascending by beat (a copy; empty if none). */
  getDynamics(measureNumber: number): Dynamic[] {
    return this.scoreModel.getDynamics(measureNumber)
  }

  /** Find a dynamic anywhere in the score by id (live reference), or null. */
  getDynamicById(id: string): Dynamic | null {
    return this.scoreModel.getDynamicById(id)
  }

  // ==================== Ottava operations ====================
  //
  // One-line delegations, the hairpin block's arrangement below. Everything an octave line IS lives
  // in `engine/models/ottavaOps`; what these add is the editor's own concern and nothing else — an
  // undo entry per edit. ⚠️ There is no `createOttava` here yet: *which notes did the user mean* is
  // the entry phase's question (docs/ottava-plan.md P5), and inventing it early would give the
  // palette and the stamp two different answers to it.

  /**
   * Add an octave line starting at (measure, `ottava.beat`) covering `ottava.length` of music,
   * REPLACING any line already on that (beat, staff) — the clef's rule, see
   * {@link ottavaOps.addOttava}. `beat` must be a slot-boundary beat. Saves undo state when added.
   * @returns the stored Ottava, or null if the measure is missing or the length is not positive.
   */
  addOttava(measureNumber: number, ottava: Omit<Ottava, 'id'>): Ottava | null {
    const created = this.scoreModel.addOttava(measureNumber, ottava)
    if (created) this.commit(`Add ${created.shift > 0 ? '8va' : '8vb'} at measure ${measureNumber}`)
    return created
  }

  /**
   * ⭐ **Create an octave line over the notes the user meant** — the Lines palette row and the armed
   * stamp's click both arrive here, so a line made one way is the line the other would have made.
   *
   * ⭐⭐ **The lane is a STAFF, not a (staff, voice) pair** — the one place this parts company with
   * `createSlur` / `createHairpin` / `createTrill`, all of which narrow to the first note's voice
   * and drop the rest. An ottava governs the staff, so a selection spanning two voices of one staff
   * produces ONE line covering both, and narrowing would silently leave half the selection sounding
   * where it was. Notes on OTHER staves are still dropped: an octave line cannot govern two.
   *
   * ⭐ **The span COVERS the last note** (`addOttavaOverNotes` adds that note's own length), which
   * for one selected note means the line covers exactly that note. Unlike the hairpin's — where "end
   * where the next note begins" was his correction — that is not a matter of taste here: the span is
   * half-open, so an end on the last note's onset would leave it drawn under the bracket and
   * sounding un-shifted.
   *
   * ⛔ **A REST cannot anchor one**, the hairpin's refusal and for its reason: an octave line
   * displaces sounding music, and the engine resolves by slot, so it would happily start from
   * silence.
   *
   * ⏭️ **§7.3, THE OPEN QUESTION, and this is where it is answered by hand.** Selecting a high
   * passage and pressing 8va can either (a) leave the noteheads and let the passage sound an octave
   * higher — Sibelius's, and what this does — or (b) drop every covered note's written pitch an
   * octave in the same batch so the SOUND is unchanged and the noteheads come down off their ledger
   * lines — Dorico's. (b) is one added loop over the covered notes calling `updateNote`, inside this
   * same `runBatch`, and it is **not a stored flag** either way (docs/ottava-plan.md §2's tail).
   * Shipping (a) first because it is the literal reading of the gesture — the command adds a MARK —
   * and because it is not destructive: (b) rewrites pitches, and a wrong default there is undone one
   * `Ctrl+Z` at a time on real music.
   *
   * @returns the stored Ottava, or null when there is no usable span.
   */
  createOttava(noteIds: string[], shift: Ottava['shift']): Ottava | null {
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n && !n.isRest)
    if (resolved.length === 0) return null

    const staff = staffOf(resolved[0])
    const selected = resolved
      .filter(n => staffOf(n) === staff)
      .sort((a, b) => this.compareForSpan(a, b))
    if (selected.length === 0) return null

    const startNote = selected[0]
    const endNote = selected[selected.length - 1]

    const created = this.scoreModel.addOttavaOverNotes(
      shift,
      { measure: startNote.measure, beat: startNote.beat },
      { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
      this.staffIdForIndex(staff),
    )
    if (created) this.saveOnly(`Add ${shift > 0 ? '8va' : '8vb'}`)
    return created
  }

  /**
   * ⭐ Flip a selected octave line's DIRECTION — 8va ↔ 8vb, 15ma ↔ 15mb — the `x` key's ottava
   * branch (`interactions/flipSelection.ts`). His request, 2026-08-17.
   *
   * ⚠️ **`commit`, not `saveOnly`, and that is the difference from the trill's branch of the same
   * key.** Flipping a trill swaps a SIDE — nothing audible — so it only records undo. An ottava's
   * shift is what the covered notes SOUND (`soundingShiftAt`), which is `commit`'s stated condition
   * and the hairpin's reason for using it too. ⚠️ The resync inside `commit` re-hands the SAME live
   * score object today (`ScoreModel.getScore` returns the model's own), so what this actually buys
   * is the convention, not a fix for a stale-playback bug — but the classification is the part a
   * future non-live score would depend on. @returns the new shift, or null if no ottava has that id.
   */
  toggleOttavaDirection(id: string): Ottava['shift'] | null {
    const shift = this.scoreModel.toggleOttavaDirection(id)
    if (shift) this.commit(`Flip octave line to ${shift > 0 ? '8va' : '8vb'}`)
    return shift
  }

  /**
   * Re-anchor an octave line's END by one slot of its staff — `Ctrl+Shift+→` / `←` with its end
   * square armed. Saves undo state when it changed. See {@link ottavaOps.resizeOttavaBySlot}.
   *
   * ⚠️ **A CONTENT edit, like the flip above it**: the notes the bracket newly covers (or lets go)
   * change octave when they SOUND. Hence `commit`, not `saveOnly`.
   */
  resizeOttavaBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.resizeOttavaBySlot(id, direction)
    if (ok) this.commit(direction === 1 ? 'Lengthen octave line' : 'Shorten octave line')
    return ok
  }

  /**
   * Move an octave line's BEGINNING by one slot of its staff, holding its end — `Ctrl+Shift+←/→`
   * with its start square armed. Saves undo state when it changed. See
   * {@link ottavaOps.moveOttavaStartBySlot}.
   */
  moveOttavaStartBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.moveOttavaStartBySlot(id, direction)
    if (ok) this.commit('Move octave line start')
    return ok
  }

  /**
   * ⭐⭐ **Nudge the armed end of an octave bracket's INK** — a plain or `Ctrl` arrow with that square
   * armed. Staff-spaces; screen-down is +y.
   *
   * ⭐ **`outward` moves the WHOLE bracket** however it is asked for, because an octave line is a
   * straight horizontal rule and {@link OttavaOffsetOverride} has nowhere to put a second height.
   * That is his rule, kept in the model's SHAPE rather than in the code that writes it.
   *
   * ⭐⭐ **`outward` is a distance FROM THE STAFF, not a screen delta** — `+` is up for an 8va and
   * down for an 8vb (his correction: a screen value reads backwards on one side). ⚠️ Callers that
   * speak screen convert on the way in; `shortcutWiring` is the one that does, because `↑` is a
   * screen direction. `dx` is unaffected — right is right on both sides of the staff.
   *
   * ⚠️ An override, so `saveOnly` rather than `commit`: moving ink changes nothing audible, unlike
   * the extent edits above it.
   */
  nudgeOttavaEndpoint(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
    // ⚠️ The PAGE LIMIT predicts where ink lands, so it needs a SCREEN delta — the second of the two
    // places that convert (the renderer is the other). Above the staff, further out is further UP.
    const above = (this.getOttavaById(id)?.shift ?? 1) > 0
    if (!this.nudgeStaysOnPage('ottava', id, dx, above ? -outward : outward)) return false
    const ok = this.scoreModel.setOttavaEndpointOffset(id, which, dx, outward)
    if (ok) this.saveOnly('Nudge octave line')
    return ok
  }

  /**
   * ⭐⭐ **Move the WHOLE octave bracket** by a staff-space delta and save ONE undo step — the arrows
   * with an ottava selected and NO square armed.
   *
   * ⚠️ `outward` is a distance FROM THE STAFF, like its per-end twin, and the page limit needs a
   * SCREEN delta to predict where the ink lands — so the same negation happens here.
   */
  nudgeOttava(id: string, dx: number, outward: number): boolean {
    const above = (this.getOttavaById(id)?.shift ?? 1) > 0
    if (!this.nudgeStaysOnPage('ottava', id, dx, above ? -outward : outward)) return false
    const ok = this.scoreModel.setOttavaOffset(id, dx, outward)
    if (ok) this.saveOnly('Nudge octave line')
    return ok
  }

  /** `Ctrl+Backspace` with a bracket selected and nothing armed: every nudge dropped. DECLINEs when
   *  it carries none. */
  resetOttavaOffset(id: string): boolean {
    const ok = this.scoreModel.resetOttavaOffset(id)
    if (ok) this.saveOnly('Reset octave line nudge')
    return ok
  }

  /** `Ctrl+Backspace` on an armed square: that end's `x` and the shared `y` back to the engraver's
   *  own. @returns false when it carries no nudge, so the key falls through. */
  resetOttavaEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    const ok = this.scoreModel.resetOttavaEndpointOffset(id, which)
    if (ok) this.saveOnly('Reset octave line nudge')
    return ok
  }

  /**
   * Live (preview) end-move used **while dragging one of an ottava's squares** — writes the model
   * but does NOT record undo; call {@link commitOttavaDrag} on the drop for the single entry. The
   * hairpin's `previewHairpinEnd` / `commitHairpinDrag` pair verbatim, and for its reason: every
   * frame of a drag would otherwise be its own undo step.
   *
   * `write` carries the address AND which end of the bracket lands on it — two cases, not the
   * wedge's three (see {@link OttavaDragWrite}). @returns true when the model changed.
   */
  previewOttavaEnd(id: string, write: OttavaDragWrite): boolean {
    this.markModelDirty() // live drag, undo deferred to commitOttavaDrag
    return this.scoreModel.applyOttavaDrag(id, write)
  }

  /** Record ONE undo entry after an ottava-square drag settles. */
  commitOttavaDrag(which: 'start' | 'end'): void {
    this.commitPreviewed(which === 'start' ? 'Move octave line start' : 'Resize octave line')
  }

  /** Remove an octave line by id. Saves undo state when one was removed. */
  removeOttava(id: string): boolean {
    const removed = this.scoreModel.removeOttava(id)
    if (removed) this.commit('Remove octave line')
    return removed
  }

  /** The octave lines STARTING in a measure, sorted by beat (empty if none or no such measure). */
  getOttavas(measureNumber: number): Ottava[] {
    return this.scoreModel.getOttavas(measureNumber)
  }

  // ==================== Sustain pedal operations ====================
  //
  // One-line delegations, the ottava block's arrangement above. Everything a pedal IS lives in
  // `engine/models/pedalOps`; what these add is the editor's own concern and nothing else — an undo
  // entry per edit. ⚠️ There is no `createPedal` here yet, for `createOttava`'s reason: *which notes
  // did the user mean* is the entry phase's question (docs/pedal-plan.md P4), and inventing it early
  // would give the palette and the stamp two different answers to it.

  /**
   * Add a sustain pedal starting at (measure, `pedal.beat`) holding `pedal.length` of music,
   * REPLACING any pedal already on that (beat, staff) — the clef's rule, see {@link pedalOps.addPedal}.
   * `beat` must be a slot-boundary beat. Saves undo state when added.
   *
   * ⚠️ This is the LOW-level door: it stores, it does not make room. Lifting a pedal that was still
   * down is the ENTRY door's job (`addPedalOverNotes`), which is P4's (docs/pedal-plan.md §3.3).
   * @returns the stored Pedal, or null if the measure is missing or the length is not positive.
   */
  addPedal(measureNumber: number, pedal: Omit<Pedal, 'id'>): Pedal | null {
    const created = this.scoreModel.addPedal(measureNumber, pedal)
    if (created) this.commit(`Add pedal at measure ${measureNumber}`)
    return created
  }

  /**
   * ⭐⭐ **Put a pedal under the notes the user meant** — the Lines palette row and the armed stamp's
   * click both arrive here, so a pedal made one way is the pedal the other would have made.
   *
   * ⭐ **The lane is a STAFF, not a (staff, voice) pair** — `createOttava`'s exception, for a
   * physical rather than a notational reason: an octave line governs a staff because a bracket says
   * so, a pedal governs it because there is one foot. So a selection spanning two voices of one
   * staff makes ONE pedal holding both. Notes on OTHER staves are still dropped: one damper cannot
   * belong to two instruments.
   *
   * ⭐ **The span COVERS the last note** (`addPedalOverNotes` adds that note's own length), and here
   * that is literal rather than a matter of taste: the span is half-open (`holdUnderPedals`), so a
   * lift on the last note's onset would release the very note the user pointed at.
   *
   * ⭐⭐ **It also LIFTS whatever was still down** — the truncation rule lives in `addPedalOverNotes`
   * (docs/pedal-plan.md §3.3), so both doors make room the same way and neither invents it. That is
   * the whole reason the entry phase has a door of its own rather than calling `addPedal`.
   *
   * ⛔ **A REST cannot anchor one**, the ottava's and hairpin's refusal — the engine resolves by
   * slot, so a rest would happily start a pedal from silence, and the gesture means *hold these
   * notes*.
   *
   * @returns the stored Pedal, or null when there is no usable span.
   */
  createPedal(noteIds: string[]): Pedal | null {
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n && !n.isRest)
    if (resolved.length === 0) return null

    const staff = staffOf(resolved[0])
    const selected = resolved
      .filter(n => staffOf(n) === staff)
      .sort((a, b) => this.compareForSpan(a, b))
    if (selected.length === 0) return null

    const startNote = selected[0]
    const endNote = selected[selected.length - 1]

    const created = this.scoreModel.addPedalOverNotes(
      { measure: startNote.measure, beat: startNote.beat },
      { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
      this.staffIdForIndex(staff),
    )
    if (created) this.saveOnly('Add pedal')
    return created
  }

  /** Remove a sustain pedal by id. Saves undo state when one was removed. */
  removePedal(id: string): boolean {
    const removed = this.scoreModel.removePedal(id)
    if (removed) this.commit('Remove pedal')
    return removed
  }

  /** Move the LIFT — set how much music a pedal holds. Saves undo state when it changed. */
  setPedalLength(id: string, length: Fraction): boolean {
    const ok = this.scoreModel.setPedalLength(id, length)
    if (ok) this.commit('Resize pedal')
    return ok
  }

  /** Move a pedal's LIFT by one slot of its staff — `Ctrl+Shift+→` / `←` with its END square armed.
   *  Saves undo state when it changed. See {@link pedalOps.resizePedalBySlot}. */
  resizePedalBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.resizePedalBySlot(id, direction)
    if (ok) this.commit(direction === 1 ? 'Lengthen pedal' : 'Shorten pedal')
    return ok
  }

  /** Move a pedal's PRESS by one slot, holding its lift — the same chord with the START square
   *  armed. ⚠️ `commit`, like its twin: when the damper falls is AUDIBLE, so this is never a
   *  save-only cosmetic write. See {@link pedalOps.movePedalStartBySlot}. */
  movePedalStartBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.movePedalStartBySlot(id, direction)
    if (ok) this.commit(direction === 1 ? 'Move pedal start later' : 'Move pedal start earlier')
    return ok
  }

  /**
   * Live (preview) end-move used **while dragging one of a pedal's squares** — writes the model but
   * does NOT record undo; call {@link commitPedalDrag} on the drop for the single entry.
   * {@link previewOttavaEnd}'s twin, and for its reason: every frame of a drag would otherwise be
   * its own undo step. @returns true when the model changed.
   */
  previewPedalEnd(id: string, write: PedalDragWrite): boolean {
    this.markModelDirty() // live drag, undo deferred to commitPedalDrag
    return this.scoreModel.applyPedalDrag(id, write)
  }

  /** Record ONE undo entry after a pedal-square drag settles. */
  commitPedalDrag(which: 'start' | 'end'): void {
    this.commitPreviewed(which === 'start' ? 'Move pedal start' : 'Move pedal lift')
  }

  /**
   * ⭐⭐ **Nudge the armed SIGN's ink** — a plain or `Ctrl` arrow with that square armed.
   * Staff-spaces, screen-signed (+ down).
   *
   * ⭐ `dy` moves BOTH signs however it is asked for: a pedal and its own release share one baseline
   * (Gould p. 333), so {@link PedalOffsetOverride} has nowhere to put a second height. That is an
   * engraving rule kept in the model's SHAPE rather than in the code that writes it.
   *
   * ⚠️ **No screen→outward conversion here, unlike the bracket's twin** — a pedal has one side
   * permanently, so `+ down` means the same thing everywhere it can be drawn.
   *
   * ⚠️ An override, so `saveOnly` rather than `commit`: moving ink changes nothing audible, which is
   * exactly what separates this key from `Ctrl+Shift+arrow` on the same square.
   */
  nudgePedalEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('pedal', id, dx, dy)) return false
    const ok = this.scoreModel.setPedalEndpointOffset(id, which, dx, dy)
    if (ok) this.saveOnly('Nudge pedal')
    return ok
  }

  /** ⭐⭐ **Move the WHOLE pedal** by a staff-space delta — the arrows with a pedal selected and NO
   *  square armed. One undo step. */
  nudgePedal(id: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('pedal', id, dx, dy)) return false
    const ok = this.scoreModel.setPedalOffset(id, dx, dy)
    if (ok) this.saveOnly('Nudge pedal')
    return ok
  }

  /** `Ctrl+Backspace` with a pedal selected and nothing armed: every nudge dropped. DECLINEs when it
   *  carries none. */
  resetPedalOffset(id: string): boolean {
    const ok = this.scoreModel.resetPedalOffset(id)
    if (ok) this.saveOnly('Reset pedal nudge')
    return ok
  }

  /** `Ctrl+Backspace` on an armed square: that sign's `x` and the shared `y` back to the engraver's
   *  own. @returns false when it carries no nudge, so the key falls through. */
  resetPedalEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    const ok = this.scoreModel.resetPedalEndpointOffset(id, which)
    if (ok) this.saveOnly('Reset pedal nudge')
    return ok
  }

  /** The sustain pedals STARTING in a measure, sorted by beat (empty if none or no such measure). */
  getPedals(measureNumber: number): Pedal[] {
    return this.scoreModel.getPedals(measureNumber)
  }

  // ==================== Hairpin operations ====================
  //
  // One-line delegations. Everything a hairpin IS lives in `engine/models/hairpinOps`; what these
  // add is the editor's own concern and nothing else: an undo entry per edit.

  /**
   * Add a hairpin starting at (measure, `hairpin.beat`) and covering `hairpin.length` of music.
   * `beat` must be a slot-boundary beat. Saves undo state when added.
   * @returns the stored Hairpin, or null if the measure is missing or the length is not positive.
   */
  addHairpin(measureNumber: number, hairpin: Omit<Hairpin, 'id'>): Hairpin | null {
    const created = this.scoreModel.addHairpin(measureNumber, hairpin)
    if (created) {
      this.commit(`Add ${created.type === 'cresc' ? 'crescendo' : 'diminuendo'} at measure ${measureNumber}`)
    }
    return created
  }

  /**
   * ⭐ **Create a hairpin over the notes the user meant** — the `H` / `Shift+H` key, the Lines
   * palette rows and the armed stamp's click all arrive here, so a wedge made one way is the wedge
   * the other two would have made.
   *
   * The note resolution is `createSlur`'s: a hairpin lives in ONE voice on ONE staff, taken from
   * the first resolved note, and notes in other lanes are dropped rather than silently widening the
   * span.
   *
   * ⭐⭐ **THE WEDGE COVERS EXACTLY THE MUSIC SELECTED — never a note more.** From the first
   * selected note's onset to the END of the last selected one, so with ONE note it covers that note
   * and stops where the next begins. His report on seeing the first build, 2026-08-12: selecting a
   * whole-note E and pressing `H` drew a wedge running to the far edge of the F after it —
   * *"what is expected for me is that it end when the F starts"*. He is right, and it is what a
   * hairpin MEANS: the wedge is the approach, and the note you arrive on is where the new level is
   * reached, not part of the climb.
   *
   * ⛔ This deliberately drops the plan's §11.4 sketch ("this note → the end of the NEXT slot").
   * That was reasoned from minimum-length — a wedge over one quarter is short — but the fix for a
   * short wedge is the angle cap (`rendering/hairpinShape.ts`), not silently covering music the
   * user did not select. `Ctrl+→` is how a wedge grows, and it is the only thing that should.
   *
   * ⛔ **A REST cannot anchor one.** A hairpin says the sounding music is getting louder; the engine
   * resolves by slot and would happily span from silence, so the refusal is here.
   *
   * Idempotent (`addHairpinOverNotes` returns an identical existing wedge). Saves undo state.
   * @returns the stored Hairpin, or null when there is no usable span.
   */
  createHairpin(noteIds: string[], type: Hairpin['type']): Hairpin | null {
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n && !n.isRest)
    if (resolved.length === 0) return null

    const voice = voiceOf(resolved[0])
    const staff = staffOf(resolved[0])
    const selected = resolved
      .filter(n => voiceOf(n) === voice && staffOf(n) === staff)
      .sort((a, b) => this.compareForSpan(a, b))
    if (selected.length === 0) return null

    const startNote = selected[0]
    // The LAST SELECTED note, even when that is the only one — the span is the selection's, and
    // `addHairpinOverNotes` adds that note's own length so the wedge ends where the next begins.
    const endNote = selected[selected.length - 1]

    // ⭐⭐ The lane CHOOSES the notes; it does not become the wedge's SCOPE. `voice` above filtered
    // the selection to one stream (a wedge cannot span two), and it is deliberately NOT passed on:
    // a wedge with no voice governs every voice of its staff, which is the default the user asked
    // for. Narrowing it is a second, explicit act. See docs/dynamic-voice-scope-plan.md.
    const created = this.scoreModel.addHairpinOverNotes(
      type,
      { measure: startNote.measure, beat: startNote.beat },
      { measure: endNote.measure, beat: endNote.beat, length: slotLength(endNote) },
      { ...(this.staffIdForIndex(staff) !== undefined ? { staffId: this.staffIdForIndex(staff) } : {}) },
    )
    if (created) this.saveOnly(`Add ${type === 'cresc' ? 'crescendo' : 'diminuendo'}`)
    return created
  }

  /** Remove a hairpin by id. Saves undo state when removed. @returns true if one was removed. */
  removeHairpin(id: string): boolean {
    const removed = this.scoreModel.removeHairpin(id)
    if (removed) this.commit('Remove hairpin')
    return removed
  }

  /** Edit a hairpin by id. Saves undo state when found. @returns the updated Hairpin, or null. */
  updateHairpin(id: string, updates: Partial<Omit<Hairpin, 'id'>>): Hairpin | null {
    const updated = this.scoreModel.updateHairpin(id, updates)
    if (updated) this.commit('Edit hairpin')
    return updated
  }

  /**
   * Set how much music a hairpin covers — the model write behind lengthen/shorten. ⚠️ This is a
   * CONTENT edit, not an engraving nudge: the same key on a slur endpoint one branch over writes
   * an override instead (docs/dynamics-line-and-hairpins-plan.md §4). Saves undo state.
   * @returns true if the hairpin exists and the length is positive.
   */
  setHairpinLength(id: string, length: Fraction): boolean {
    const ok = this.scoreModel.setHairpinLength(id, length)
    if (ok) this.commit('Change hairpin length')
    return ok
  }

  /**
   * Grow (+1) or shrink (−1) the hairpin by one slot of its own lane — `Ctrl+→` / `Ctrl+←`.
   * ⚠️ A CONTENT edit: it rewrites `length`, where the same key on a slur endpoint writes an
   * engraving override (docs/dynamics-line-and-hairpins-plan.md §4). Saves undo state.
   * @returns true when the wedge changed; false (declining the key) when there is nothing to
   *   reach, or when shrinking would leave it covering no music.
   */
  resizeHairpinBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.resizeHairpinBySlot(id, direction)
    if (ok) this.commit(direction === 1 ? 'Lengthen hairpin' : 'Shorten hairpin')
    return ok
  }

  /**
   * Move the hairpin's START one slot earlier (−1) or later (+1) **without moving its end** —
   * `Ctrl+Shift+←/→` with the wedge's left square armed.
   *
   * ⚠️ A CONTENT edit like the resize beside it, and the one that writes BOTH of the model's fields:
   * holding the end still means `length' = end − start'` (see `hairpinOps.moveHairpinStartBySlot`
   * for why that is not a sign the model wants two addresses). Saves ONE undo state for the pair.
   * @returns true when the start moved; false (declining the key) when there is no slot to reach, or
   *   when it would reach the end.
   */
  moveHairpinStartBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.moveHairpinStartBySlot(id, direction)
    if (ok) this.commit(direction === -1 ? 'Extend hairpin start' : 'Trim hairpin start')
    return ok
  }

  /**
   * Live (preview) end-move used **while dragging a hairpin's square** — writes the model but does
   * NOT record undo; call {@link commitHairpinDrag} on the drop for the single entry (the
   * `previewSlurEndpoint` / `commitSlurEndpoint` pair, and for its reason: every frame of a drag
   * would otherwise be its own undo step).
   *
   * `write` carries the address AND which boundary of it the grabbed square lands on — the tip sits
   * where the renderer draws it, which is a note's left edge rather than its head (see
   * {@link HairpinDragWrite}). @returns true when the model changed.
   */
  previewHairpinEnd(id: string, write: HairpinDragWrite): boolean {
    this.markModelDirty() // live drag, undo deferred to commitHairpinDrag — see previewSlurShape
    return this.scoreModel.applyHairpinDrag(id, write)
  }

  /** Record ONE undo entry after a hairpin-square drag settles. */
  commitHairpinDrag(which: 'start' | 'end'): void {
    this.commitPreviewed(which === 'start' ? 'Move hairpin start' : 'Resize hairpin')
  }

  /**
   * Nudge one drawn END of a hairpin by a staff-space delta and save ONE undo step — the wedge's
   * RESHAPE (plain arrow fine, `Ctrl`+arrow coarse, with that square armed).
   *
   * ⚠️ An ENGRAVING OVERRIDE, where `resizeHairpinBySlot` one method up writes the model: same two
   * squares, two chords, two categories. Nothing about the music moves — playback cannot tell — and
   * that is exactly why it may not be stored as a shorter `length`
   * (docs/dynamics-line-and-hairpins-plan.md §4).
   */
  nudgeHairpinEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('hairpin', id, dx, dy)) return false
    const ok = this.scoreModel.setHairpinEndpointOffset(id, which, dx, dy)
    if (ok) this.saveOnly('Reshape hairpin')
    return ok
  }

  /**
   * Move the WHOLE selected wedge by a staff-space delta and save ONE undo step — the arrows with a
   * hairpin selected and NO square armed.
   *
   * ⚠️ An ENGRAVING OVERRIDE like the per-end nudge it is made of (both ends, same delta): the wedge
   * moves on the page and covers the same notes, so nothing about the music changes. Moving WHICH
   * notes it covers is `Ctrl+Shift+←/→` on a square, which writes the model instead.
   */
  nudgeHairpin(id: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('hairpin', id, dx, dy)) return false
    const ok = this.scoreModel.setHairpinOffset(id, dx, dy)
    if (ok) this.saveOnly('Move hairpin')
    return ok
  }

  /**
   * Live (preview) whole-wedge move used **while dragging a hairpin's BODY** — writes the model but
   * does NOT record undo; call {@link commitHairpinOffsetDrag} on the drop for the single entry.
   * `previewHairpinEnd` / `commitHairpinDrag`'s pair, and for its reason: every frame of a drag
   * would otherwise be its own undo step.
   *
   * ⚠️ It is {@link nudgeHairpin} without the undo — an ACCUMULATING nudge, so the caller passes the
   * delta since the last accepted frame rather than a total. And the PAGE LIMIT still refuses the
   * write, so a wedge dragged off the sheet simply stops moving (⛔ the drawing is never clamped —
   * see `nudgeStaysOnPage`).
   * @returns true when the model changed.
   */
  previewHairpinOffset(id: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('hairpin', id, dx, dy)) return false
    this.markModelDirty() // live drag, undo deferred to commitHairpinOffsetDrag
    return this.scoreModel.setHairpinOffset(id, dx, dy)
  }

  /** Record ONE undo entry after a hairpin BODY drag settles. */
  commitHairpinOffsetDrag(): void {
    this.commitPreviewed('Move hairpin')
  }

  /** Drop BOTH ends' reshapes and save ONE undo step (`Ctrl+Backspace`, nothing armed).
   *  @returns false when neither end carries one, so the key falls through. */
  resetHairpinOffset(id: string): boolean {
    const ok = this.scoreModel.resetHairpinOffset(id)
    if (ok) this.saveOnly('Reset hairpin position')
    return ok
  }

  /** Drop ONE end's reshape and save ONE undo step (`Ctrl+Backspace` with that square armed).
   *  @returns false when that end has no offset, so the key falls through. */
  resetHairpinEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    const ok = this.scoreModel.resetHairpinEndpointOffset(id, which)
    if (ok) this.saveOnly('Reset hairpin end')
    return ok
  }

  /**
   * Set (or clear with `null`) the selected hairpin's MOUTH, in staff-spaces, and save ONE undo step
   * (the Properties input).
   *
   * ⚠️ An ENGRAVING OVERRIDE, like the end nudges and unlike the extent — how wide a wedge opens is
   * drawing, and the loudness it means is the same either way. It replaces the automatic length-aware
   * aperture; the steepness cap still applies over it, so a short wedge cannot be authored into an
   * arrowhead. @returns false when the hairpin is unknown, the value is not positive, or there was
   * nothing to clear.
   */
  setHairpinAperture(id: string, aperture: number | null): boolean {
    const ok = this.scoreModel.setHairpinAperture(id, aperture)
    if (ok) this.saveOnly(aperture === null ? 'Reset hairpin mouth' : 'Set hairpin mouth')
    return ok
  }

  /** Flip a hairpin between crescendo and diminuendo. Saves undo state. @returns the new type. */
  toggleHairpinType(id: string): 'cresc' | 'dim' | null {
    const type = this.scoreModel.toggleHairpinType(id)
    if (type) this.commit(`Change to ${type === 'cresc' ? 'crescendo' : 'diminuendo'}`)
    return type
  }

  /** The hairpins STARTING in a measure, sorted by beat (a wedge may run past the bar's end). */
  getHairpins(measureNumber: number): Hairpin[] {
    return this.scoreModel.getHairpins(measureNumber)
  }

  /** Find a hairpin anywhere in the score by id (live reference), or null. */
  getHairpinById(id: string): Hairpin | null {
    return this.scoreModel.getHairpinById(id)
  }

  // ==================== Tempo Mark Operations ====================
  //
  // A tempo mark is SYSTEM-level — it governs the clock, not a staff — so unlike the
  // dynamics facades above, none of these take a staff index. commit() gives undo/redo
  // and JSON for free. There is no setTempo(): the global was deleted (P1).

  /**
   * Add a tempo mark at (measure, mark.beat) — a word ('Allegro'), a metronome (♩ = 120),
   * or both. `beat` must be a slot-boundary beat; an existing mark on that beat is
   * REPLACED (one clock statement per point in time). `text` is what gets PRINTED, `bpm` what
   * SOUNDS — and a mark can sound without printing its number (the word 'Allegro' quietly
   * meaning 144), which is why they are separate fields.
   * Saves undo state when added.
   * @returns the stored TempoMark, or null if the measure does not exist.
   * @throws if bpm is outside 20..300.
   */
  addTempoMark(measureNumber: number, mark: Omit<TempoMark, 'id'>): TempoMark | null {
    const created = this.scoreModel.addTempoMark(measureNumber, mark)
    if (created) {
      this.commit(`Add tempo ${tempoLabel(created)} at measure ${measureNumber}`)
    }
    return created
  }

  /**
   * Edit an existing tempo mark by id (text / unit / dots / bpm / beat). The mark IS its text:
   * `text` is stored verbatim and `unit`/`dots`/`bpm` are the speed parsed out of it, so the two
   * are written together (utils/tempoText).
   * Saves undo state when found. @returns the updated TempoMark, or null if missing.
   */
  updateTempoMark(id: string, updates: Partial<Omit<TempoMark, 'id'>>): TempoMark | null {
    const updated = this.scoreModel.updateTempoMark(id, updates)
    if (updated) {
      this.commit(`Edit tempo ${tempoLabel(updated)}`)
    }
    return updated
  }

  /**
   * Remove a tempo mark by id. The score reverts to the previous mark's tempo (or
   * DEFAULT_TEMPO if it was the only one). Saves undo state when removed.
   * @returns true if a mark was removed.
   */
  removeTempoMark(id: string): boolean {
    const removed = this.scoreModel.removeTempoMark(id)
    if (removed) {
      this.commit('Remove tempo mark')
    }
    return removed
  }

  /** A measure's tempo marks, sorted ascending by beat (a copy; empty if none). */
  getTempoMarks(measureNumber: number): TempoMark[] {
    return this.scoreModel.getTempoMarks(measureNumber)
  }

  /** Find a tempo mark anywhere in the score by id (live reference), or null. */
  getTempoMarkById(id: string): TempoMark | null {
    return this.scoreModel.getTempoMarkById(id)
  }

  /**
   * The sounding tempo (quarter-notes per minute) at a position — for a "what's the tempo
   * here?" readout. DEFAULT_TEMPO when the score states none; there is no score.tempo.
   */
  getEffectiveTempoAt(measureNumber: number, beat: Fraction, scope?: string): number {
    return this.scoreModel.getEffectiveTempoAt(measureNumber, beat, scope)
  }

  /** The interpreted dynamic level in effect at (measure, beat) for a lane — a voice on a staff.
   *  Both default to the FIRST one; a staff-wide mark answers whatever voice is asked. */
  getActiveLevel(measureNumber: number, beat: Fraction, voice: number = 0, staffId?: string): DynamicLevel {
    return this.scoreModel.getActiveLevel(measureNumber, beat, voice, staffId)
  }

  /**
   * Relocate a clef change to a new position, possibly across measures. Raw move
   * used while dragging — does NOT record undo. Call commitClefMove when the drag
   * ends.
   * @returns true if the clef was relocated.
   */
  moveClef(fromMeasure: number, fromBeat: Fraction, toMeasure: number, toBeat: Fraction): boolean {
    return this.scoreModel.moveClef(fromMeasure, fromBeat, toMeasure, toBeat)
  }

  /**
   * Finish a clef drag: drop the clef if it landed in a redundant position
   * (equals the clef already in effect there), then record one undo entry.
   */
  commitClefMove(measureNumber: number, beat: Fraction): void {
    this.scoreModel.normalizeClefAt(measureNumber, beat)
    this.saveOnly(`Move clef to measure ${measureNumber} beat ${fracToNumber(beat)}`)
  }

  /**
   * Tell the renderer which clef is being dragged (or null when none), so a
   * redundant dragged clef can be shown as a faded ghost instead of vanishing.
   */
  setDraggingClef(info: { measure: number; beat: Fraction } | null): void {
    this.renderer.setDraggingClef(info)
  }

  // ==================== Note Operations ====================

  // --- Entry ---

  /**
   * Add a note by beat/measure position with full overflow handling (tie splitting across barlines).
   * Use this for keyboard entry mode instead of addNote().
   * Returns the first note placed (in the current measure), or null if placement failed.
   */
  addNoteAtBeat(params: NoteParams): Note | null {
    return this.noteEntryCoordinator.addNoteAtBeat(params)
  }

  /**
   * Add a note to an existing chord (same beat/measure as an existing note). Saves undo state.
   */
  addChordNote(params: NoteParams): Note {
    const note = this.scoreModel.addNote(params)
    const noteName = params.step ? midiToNoteName(spellingToMidi(params.step, params.alter ?? 0, params.octave!)) : 'rest'
    this.commit(`Add chord note ${noteName}`)
    return note
  }

  /**
   * Stack a pitch onto the FANNED MEMBER holding `noteId` — the member's own `Shift`+letter.
   *
   * A member is a chord in its own right, so it is the thing being added to; going through
   * {@link addChordNote} would resolve the position and land the note on the group's FIRST head.
   * Returns null when the id is not a member's (the caller then takes the ordinary path).
   */
  addFanMemberPitch(noteId: string, spelling: { step: PitchStep; alter: PitchAlter; octave: number }): Note | null {
    const note = this.scoreModel.addFanMemberPitch(noteId, spelling)
    if (!note) return null
    this.commit(`Add chord note ${midiToNoteName(spellingToMidi(spelling.step, spelling.alter, spelling.octave))}`)
    return note
  }

  /** The pitches of the fanned MEMBER holding `noteId` (its own chord), or null if not a member. */
  fanMemberPitches(noteId: string): Note[] | null {
    const pitches = this.scoreModel.fanMemberPitches(noteId)
    return pitches ? pitches.map(p => this.scoreModel.getNote(p.id)).filter((n): n is Note => !!n) : null
  }

  /**
   * Paste a {@link Clip} at `target`, overwriting forward for the clip's span (see
   * {@link ScoreModel.pasteEvents}). One undo entry.
   * @returns the ids of the notes that landed inside the paste window.
   */
  pasteEvents(clip: Clip, target: ClipTarget): string[] {
    const ids = this.scoreModel.pasteEvents(clip, target)
    this.commit('Paste')
    return ids
  }

  addNoteAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: Accidental,
    dots?: number,
    articulations?: ArticulationType[],
    beam?: NoteParams['beam'],
    voice: NoteParams['voice'] = 0,
    /** The armed entry tremolo, if any — the mark the entered note is born with (§10). */
    tremolo?: NoteParams['tremolo'],
  ): Note | null {
    return this.noteEntryCoordinator.addNoteAtPosition(coords, duration, accidental, dots, articulations, beam, voice, tremolo)
  }


  // --- Mutation ---

  /** Returns all non-rest notes at the given beat AND voice AND staff in a measure (chord members).
   *  Staff-scoped: two staves holding a note at the same beat/voice is ordinary, not a chord. */
  private getChordNotesAt(measureNumber: number, beat: Fraction, voice: number = 0, staff: number = 0): Note[] {
    return this.scoreModel.getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && voiceOf(n) === voice && staffOf(n) === staff && fracEq(n.beat, beat))
  }

  /**
   * Update a note (pitch/duration/etc). The overflow / cross-barline split / rest-fill
   * logic lives in NoteEntryCoordinator, which records its own undo entry via onCommit;
   * the facade just delegates.
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    return this.noteEntryCoordinator.updateNote(noteId, updates)
  }

  // --- Articulations & Ties ---

  /**
   * ⛔ Is this id a FANNED MEMBER, which the command about to run cannot attach to?
   *
   * A member is a PITCH inside one event — the ties, slurs, articulations, dots, duration and stem
   * all belong to the SLOT, the whole gesture (docs/fanned-beam-pitches-plan.md §3). The model
   * already refuses to store any of it (`findSlot` finds a member only when asked, and `updateNote`
   * writes nothing but spelling onto one), so this is not what makes the edit safe — it is what
   * makes the refusal a DECISION: the command stops here, reports nothing happened, and mints no
   * undo entry for an edit that did not occur.
   */
  /**
   * Is this id a FANNED MEMBER — a pitch living inside a fan rather than in the slot's own chord?
   *
   * The public face of the same question {@link refusesFanMember} asks privately, for the callers
   * that must SKIP a member rather than refuse the whole press: `pressFan` marks a selection, and a
   * member in it is not a note the mark can go on (`getNote` no longer reports the owner's fan on
   * one, so the direction read cannot answer for it either).
   */
  isFanMember(noteId: string): boolean {
    return this.scoreModel.isFanMember(noteId)
  }

  private refusesFanMember(noteId: string, what: string): boolean {
    if (!this.scoreModel.isFanMember(noteId)) return false
    dbg(`[Fan] ${what} refused on member ${noteId} — it attaches to the slot, not to one member`)
    return true
  }

  /**
   * Toggle an articulation on a note. Adds if absent, removes if present.
   */
  toggleArticulation(noteId: string, type: ArticulationType): Note | null {
    // ⭐ NOT refused for a fanned member any more (his ask, after using it — the same correction that
    // made slurs an exception). A fan is how you write N attacks and an articulation belongs to an
    // attack, so each member carries its own; `updateNote` writes them onto the member's own record.
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    const existing = note.articulations || []
    const hasIt = existing.includes(type)
    const updated = hasIt ? existing.filter(a => a !== type) : [...existing, type]

    const result = this.scoreModel.updateNote(noteId, { articulations: updated })
    this.commit(hasIt ? `Remove ${type}` : `Add ${type}`)
    return result
  }

  /**
   * Remove ALL articulations from a note (and drop any side override). Used by the
   * Sibelius-style group selection where Delete clears the whole articulation group.
   * No-op (returns null) for rests / notes that have none.
   */
  clearArticulations(noteId: string): Note | null {
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest || !note.articulations?.length) return null
    const result = this.scoreModel.updateNote(noteId, { articulations: [], articulationPlacement: undefined })
    this.commit('Remove articulations')
    return result
  }

  /**
   * Toggle a tie from a note to the next note with the same pitch.
   * If the note already has a forward tie, removes it.
   * Returns true if tie added, false if removed, null if no candidate found.
   */
  toggleTie(noteId: string): boolean | null {
    if (this.refusesFanMember(noteId, 'tie')) return null
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    const fmt = (n: typeof note) => n.isRest ? `rest` : `${formatPitch(n)} m${n.measure} beat:${fracToNumber(n.beat).toFixed(3)}`
    dbg(`[Tie] toggleTie | source: ${fmt(note)}`)

    if (note.tiedTo) {
      const tiedToNote = this.scoreModel.getNote(note.tiedTo)
      dbg(`[Tie] removing existing tie → was tied to: ${tiedToNote ? fmt(tiedToNote) : 'NOT FOUND'}`)
      const tiedToId = note.tiedTo
      // Drop any flip override so a future re-tie starts from auto placement again.
      this.scoreModel.clearTieDirection(noteId)
      this.scoreModel.updateNote(noteId, { tiedTo: undefined })
      // The target may be gone (e.g. severed by a re-bar) — only clear it if present.
      if (tiedToNote) this.scoreModel.updateNote(tiedToId, { tiedFrom: undefined })
      this.commit('Remove tie')
      return false
    } else {
      // Tie to the next slot STRICTLY AFTER this note's position — never a sibling
      // sharing the same chord/beat (that would tie two notes of one chord to each
      // other). Within that next slot (itself possibly a chord) prefer the SAME
      // pitch so a chord tie joins like to like; otherwise fall back to the first
      // event there (incl. a rest, for the tie-into-rest case).
      const allSlots = this.scoreModel.getAllNotes().sort(compareByPosition)
      const source = allSlots.find(n => n.id === noteId)
      if (!source) return null
      // A tie stays within ONE stream — the source's own voice AND staff. Searching all
      // slots would tie a staff-1 note to whatever staff-0 note happens to sit at the next
      // position (voices/staves are independent streams).
      const stream = allSlots.filter(n => voiceOf(n) === voiceOf(source) && staffOf(n) === staffOf(source))
      const nextStart = stream.find(n => compareByPosition(n, source) > 0)
      if (!nextStart) {
        dbg(`[Tie] no next slot found — tie not created`)
        return null
      }
      const samePitch = stream.find(n =>
        compareByPosition(n, nextStart) === 0 && !n.isRest
        && n.step === source.step && (n.alter ?? 0) === (source.alter ?? 0) && n.octave === source.octave)
      // Prefer the same pitch in the next slot (chord ties join like to like); otherwise
      // tie forward to whatever is there (incl. a different pitch or a rest) — a "let
      // ring" / l.v. tie. Two notes tying into one target is fine: the tie is owned by
      // each source's `tiedTo`, and deleting the target reassigns ALL of them onto the
      // replacement rest (see deleteNote), so nothing is left dangling.
      const nextNote = samePitch ?? nextStart
      dbg(`[Tie] tying to next slot: ${fmt(nextNote)}`)

      this.scoreModel.updateNote(noteId, { tiedTo: nextNote.id })
      this.scoreModel.updateNote(nextNote.id, { tiedFrom: noteId })
      this.commit('Add tie')
      return true
    }
  }

  /**
   * Tie a whole selection at once (key Enter with >1 note selected). Each selected
   * note ties to the SAME PITCH in the next slot, so a chord ties pitch-for-pitch to
   * the next chord. Notes at the last selected position don't tie forward (nothing
   * within the selection follows them) — but a single-position selection (one chord)
   * does tie to the next slot, matching the single-note behaviour. One undo entry;
   * toggles off when every resolved pair is already tied.
   *
   * A single selected note routes to {@link toggleTie} (preserves tie-into-rest and
   * the flip-direction reset on removal).
   */
  tieSelection(noteIds: string[]): boolean | null {
    // A member in the selection is DROPPED, not a reason to refuse the press: the other notes were
    // selected too and a tie is theirs to take. Same shape as the rests this already skips.
    noteIds = noteIds.filter(id => !this.scoreModel.isFanMember(id))
    const ids = [...new Set(noteIds)]
    if (ids.length <= 1) return ids[0] ? this.toggleTie(ids[0]) : null

    const all = this.scoreModel.getAllNotes().sort(compareByPosition)
    const selected = ids
      .map((id) => all.find((n) => n.id === id))
      .filter((n): n is Note => !!n && !n.isRest)
      .sort(compareByPosition)
    if (selected.length === 0) return null

    // Distinct selected positions, in order. Notes at the LAST position never tie
    // forward; a single-position selection (one chord) ties to the next slot.
    const posKey = (n: Note) => `${n.measure}:${fracToNumber(n.beat)}`
    const positions = [...new Set(selected.map(posKey))]
    const lastPos = positions[positions.length - 1]
    const sources = positions.length > 1 ? selected.filter((n) => posKey(n) !== lastPos) : selected

    // Resolve each source's forward target: prefer the same pitch in the next slot
    // (chords join like to like), else tie to whatever is there (let-ring / l.v.).
    const pairs: { source: Note; target: Note }[] = []
    for (const source of sources) {
      // Scope the forward target to the source's own voice AND staff (independent streams).
      const stream = all.filter((n) => voiceOf(n) === voiceOf(source) && staffOf(n) === staffOf(source))
      const next = stream.find((n) => compareByPosition(n, source) > 0)
      if (!next) continue
      const samePitch = stream.find(
        (n) =>
          compareByPosition(n, next) === 0 && !n.isRest &&
          n.step === source.step && (n.alter ?? 0) === (source.alter ?? 0) && n.octave === source.octave,
      )
      pairs.push({ source, target: samePitch ?? next })
    }
    if (pairs.length === 0) return null

    const allTied = pairs.every((p) => p.source.tiedTo === p.target.id)
    this.runBatch(allTied ? 'Remove ties' : 'Add ties', () => {
      for (const { source, target } of pairs) {
        if (allTied) {
          this.scoreModel.clearTieDirection(source.id)
          this.scoreModel.updateNote(source.id, { tiedTo: undefined })
          this.scoreModel.updateNote(target.id, { tiedFrom: undefined })
        } else if (source.tiedTo !== target.id) {
          this.scoreModel.updateNote(source.id, { tiedTo: target.id })
          this.scoreModel.updateNote(target.id, { tiedFrom: source.id })
        }
      }
    })
    return !allTied
  }

  // --- Slurs (phrasing) ---

  /**
   * Create a phrasing slur over the current selection (a span object on
   * {@link Score.slurs}, distinct from ties). Endpoint resolution:
   *  - **1 note**  → slur from it to the NEXT distinct slot (note or rest). The
   *    next-slot scan dedupes by `(measure, beat)` so a chord member slurs to the
   *    next *event*, not a sibling head at the same beat.
   *  - **N notes** → slur first→last in score order (`measure`, then `beat`),
   *    filtered to voice 0 (other voices ignored; see docs/slur-plan.md §1).
   *
   * Create-only and **idempotent**: if a slur with the same endpoints already
   * exists, the existing one is returned and nothing is added (no duplicate). There
   * is intentionally no toggle-off here — removal is a separate operation (select
   * the arc + Delete → {@link removeSlur}); see docs/slur-plan.md §1.
   *
   * Slurs are notational only — no playback change — so the audio engine isn't touched.
   * @returns the created (or pre-existing) Slur, or null if no valid span resolved.
   */
  createSlur(noteIds: string[]): Slur | null {
    // ⭐ A FANNED MEMBER *can* anchor a slur — unlike a tie. The plan refused both together
    // (docs/fanned-beam-pitches-plan.md §3) and that was right for the tie: it is a pitch-to-pitch
    // continuation, and a member has no length of its own to continue into. A slur is not an
    // attachment to the event's rhythm, it is a SPAN between two points, and member 2 → member 5 is
    // a perfectly good span (his ask). So members stay in the candidate list here.
    // A slur lives in ONE voice. Derive it from the selection (the first resolved
    // note's voice) and keep only that voice's notes — so a voice-2 selection makes a
    // voice-2 slur. (Was hardcoded to voice 0, so `s` did nothing in any other voice.)
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n)
    if (resolved.length === 0) return null

    const slurVoice = voiceOf(resolved[0])
    const slurStaff = staffOf(resolved[0])
    const selected = resolved
      .filter(n => voiceOf(n) === slurVoice && staffOf(n) === slurStaff)
      .sort((a, b) => this.compareForSpan(a, b))
    if (selected.length === 0) return null

    const startNote = selected[0]
    const endNote = selected.length >= 2
      ? selected[selected.length - 1]
      : this.nextDistinctSlot(startNote)
    if (!endNote || endNote.id === startNote.id) return null

    const existing = this.scoreModel.findSlurByEndpoints(startNote.id, endNote.id)
    if (existing) return existing // idempotent — never duplicate, never remove

    const created = this.scoreModel.addSlur({ startNoteId: startNote.id, endNoteId: endNote.id, voice: slurVoice })
    this.saveOnly('Add slur')
    return created
  }

  /** Remove a slur by id (the arc only — never the anchored notes). Saves undo
   *  state when removed. @returns true if a slur was removed. */
  removeSlur(id: string): boolean {
    const removed = this.scoreModel.removeSlur(id)
    if (removed) this.saveOnly('Remove slur')
    return removed
  }

  // ==================== Trills ====================
  // P0 of docs/trill-plan.md — the model reaching the facade, nothing more. The COMMANDS
  // (`createTrill` over a selection, the stamp) are P4 and resolve notes the way `createSlur`
  // above does; these four are one-line delegations, as CLAUDE.md's rule allows.

  /** All trills (the live array; empty if none). See {@link Trill}. */
  getTrills(): Trill[] {
    return this.scoreModel.getTrills()
  }

  /** Find a trill anywhere by id (live reference), or null. */
  getTrillById(id: string): Trill | null {
    return this.scoreModel.getTrillById(id)
  }

  /**
   * Add a trill on a note — idempotent, and refused on a rest or a fanned member
   * ({@link trillOps.addTrill}). @returns the stored Trill, the existing one, or null.
   *
   * ⚠️ `commit`, not `saveOnly`, and unlike the slur beside it: a trill CHANGES WHAT PLAYS
   * (docs/trill-plan.md §7 — it turns one sounding note into alternating attacks), so playback has
   * to be resynced. A slur is a phrasing curve with no attacks of its own, which is why it gets the
   * cheaper snapshot.
   */
  addTrill(trill: Omit<Trill, 'id'>): Trill | null {
    const created = this.scoreModel.addTrill(trill)
    if (created) this.commit('Add trill')
    return created
  }

  /**
   * ⭐ **Create a trill over the notes the user meant** — the Lines palette row and the armed
   * stamp's click both arrive here, so a trill made one way is the trill the other would have made.
   *
   * The note resolution is `createSlur`'s, with two differences that are the trill's own:
   *
   *  - ⭐ **ONE note is a complete trill**, where one note only gives a slur something to reach
   *    FROM. A slur must span two points, so a single selected note resolves to "this note and the
   *    next slot"; a trill on one note is a finished ornament, and its span comes from the ties
   *    (`trillSpan`) rather than from a second anchor. So a single selection gets **no
   *    `endNoteId`** — deliberately not "this note to the next", which would draw a wavy line the
   *    user did not ask for.
   *  - ⛔ **A fanned member is refused**, where a slur accepts one. `trillOps.addTrill` is where
   *    that decision lives and why (docs/trill-plan.md §2.2); this method simply lets it answer.
   *
   * A trill lives in ONE voice on ONE staff, taken from the first resolved note — notes in other
   * lanes are dropped rather than silently widening the span, `createSlur`'s rule exactly.
   *
   * Create-only and **idempotent**: a note already carrying a trill gets that trill back and
   * nothing is added. Removal is select-the-ornament + Delete.
   *
   * @returns the created (or pre-existing) Trill, or null if no valid anchor resolved.
   */
  createTrill(noteIds: string[]): Trill | null {
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n && !n.isRest)
    if (resolved.length === 0) return null

    const voice = voiceOf(resolved[0])
    const staff = staffOf(resolved[0])
    const inLane = resolved
      .filter(n => voiceOf(n) === voice && staffOf(n) === staff)
      .sort((a, b) => this.compareForSpan(a, b))
    if (inLane.length === 0) return null

    const start = inLane[0]
    const end = inLane.length >= 2 ? inLane[inLane.length - 1] : undefined
    const created = this.scoreModel.addTrill({
      startNoteId: start.id,
      ...(end && end.id !== start.id ? { endNoteId: end.id } : {}),
      voice,
    })
    if (created) this.commit('Add trill')
    return created
  }

  /** Remove a trill by id (the ornament only — never the anchored notes). Saves undo state and
   *  resyncs playback when removed. @returns true if one was removed. */
  removeTrill(id: string): boolean {
    const removed = this.scoreModel.removeTrill(id)
    if (removed) this.commit('Remove trill')
    return removed
  }

  /** What music a trill actually covers, right now — its slots, and where it starts and stops.
   *  Derived every time; nothing about a span is stored. See {@link trillOps.trillSpan}. */
  trillSpan(id: string): TrillSpan | null {
    return this.scoreModel.trillSpan(id)
  }

  /**
   * ⭐⭐ **Re-anchor one END of a trill by NOTE** — `Ctrl+Shift+←/→` with that square armed
   * (`interactions/trillReanchor`). `noteId === null` on the END clears it, back to the one-note
   * trill whose extent comes from the ties.
   *
   * ⚠️ **`commit`, not `saveOnly`** — unlike the continuation label below it. Which notes a trill
   * covers is which notes get the alternation, so this is AUDIBLE: `trilledSlotIds` reads the span
   * and the playback schedule generates its repeats from it.
   *
   * @returns true when the model changed (the caller then re-renders).
   */
  setTrillAnchor(id: string, which: 'start' | 'end', noteId: string | null): boolean {
    const ok = which === 'end'
      ? this.scoreModel.setTrillEnd(id, noteId)
      : noteId !== null && this.scoreModel.setTrillStart(id, noteId)
    if (ok) this.commit(which === 'start' ? 'Move trill start' : 'Move trill end')
    return ok
  }

  /**
   * Live (preview) re-anchor used **while dragging one of a trill's squares** — writes the model but
   * does NOT record undo; call {@link commitTrillDrag} on the drop for the single entry.
   * {@link previewPedalEnd}'s twin, and for its reason: every frame of a drag would otherwise be its
   * own undo step.
   *
   * ⭐ The model is the authority on the destination — a rest, a fanned member, a note that already
   * trills, or a step past the other end are all refused there, and reaching the other end COLLAPSES
   * the trill rather than being refused ({@link setTrillAnchor}).
   *
   * @returns true when the model changed.
   */
  previewTrillAnchor(id: string, which: 'start' | 'end', noteId: string): boolean {
    this.markModelDirty() // live drag, undo deferred to commitTrillDrag
    return which === 'end'
      ? this.scoreModel.setTrillEnd(id, noteId)
      : this.scoreModel.setTrillStart(id, noteId)
  }

  /**
   * ⭐⭐ **THE BARE `tr`** — the wavy line off or back on, reached from the END square's walk one step
   * past the collapse. ⚠️ `commit`, not `saveOnly`: turning the line off CLEARS an explicit end, and
   * which notes a trill covers is what the notes SOUND. In the ordinary case (the trill was already
   * a one-note trill) nothing audible changes and the entry is simply cheap.
   */
  setTrillExtension(id: string, extension: 'none' | undefined): boolean {
    const ok = this.scoreModel.setTrillExtension(id, extension)
    if (ok) this.commit(extension === 'none' ? 'Trill without a line' : 'Trill with a line')
    return ok
  }

  /** Live (preview) line on/off while DRAGGING the end square past the start —
   *  {@link previewTrillAnchor}'s twin, committed by {@link commitTrillDrag}. */
  previewTrillExtension(id: string, extension: 'none' | undefined): boolean {
    this.markModelDirty()
    return this.scoreModel.setTrillExtension(id, extension)
  }

  /**
   * ⭐⭐ **Nudge the armed end of a trill's INK** — a plain or `Ctrl` arrow with that square armed.
   * Staff-spaces.
   *
   * ⭐ `outward` moves the WHOLE ornament however it is asked for: the sign and the wiggle share one
   * baseline, so {@link TrillOffsetOverride} has nowhere to put a second height.
   *
   * ⭐⭐ **`outward` is a distance FROM THE STAFF, not a screen delta** — `+` is up for an `above`
   * trill and down for a `below` one, because `x` flips the side and a screen-signed field would
   * invert the nudge with it. ⚠️ Callers that speak screen convert on the way in; `shortcutWiring`
   * is the one that does.
   *
   * ⚠️ An override, so `saveOnly` rather than `commit`: moving ink changes nothing audible, which is
   * exactly what separates this key from `Ctrl+Shift+arrow` on the same square.
   */
  nudgeTrillEndpoint(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
    // ⚠️ The PAGE LIMIT predicts where ink lands, so it needs a SCREEN delta — the second of the two
    // places that convert (the renderer is the other). Above the staff, further out is further UP.
    const above = (this.getTrillById(id)?.placement ?? 'above') === 'above'
    if (!this.nudgeStaysOnPage('trill', id, dx, above ? -outward : outward)) return false
    const ok = this.scoreModel.setTrillEndpointOffset(id, which, dx, outward)
    if (ok) this.saveOnly('Nudge trill')
    return ok
  }

  /** ⭐⭐ **Move the WHOLE ornament** by a staff-space delta — the arrows with a trill selected and NO
   *  square armed. One undo step; the same screen→outward negation as its per-end twin. */
  nudgeTrill(id: string, dx: number, outward: number): boolean {
    const above = (this.getTrillById(id)?.placement ?? 'above') === 'above'
    if (!this.nudgeStaysOnPage('trill', id, dx, above ? -outward : outward)) return false
    const ok = this.scoreModel.setTrillOffset(id, dx, outward)
    if (ok) this.saveOnly('Nudge trill')
    return ok
  }

  /** `Ctrl+Backspace` with a trill selected and nothing armed: every nudge dropped. DECLINEs when it
   *  carries none. */
  resetTrillOffset(id: string): boolean {
    const ok = this.scoreModel.resetTrillOffset(id)
    if (ok) this.saveOnly('Reset trill nudge')
    return ok
  }

  /** `Ctrl+Backspace` on an armed square: that end's `x` and the shared vertical back to the
   *  engraver's own. @returns false when it carries no nudge, so the key falls through. */
  resetTrillEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    const ok = this.scoreModel.resetTrillEndpointOffset(id, which)
    if (ok) this.saveOnly('Reset trill nudge')
    return ok
  }

  /** Record ONE undo entry after a trill-square drag settles. */
  commitTrillDrag(which: 'start' | 'end'): void {
    this.commitPreviewed(which === 'start' ? 'Move trill start' : 'Move trill end')
  }

  /**
   * Set how a CONTINUATION system labels a trill — `(tr)` (default), a plain `tr`, or nothing.
   * See {@link Trill.continuationLabel} for the three, and who does which.
   *
   * ⚠️ `saveOnly`: a label is notation, and it changes nothing audible.
   */
  setTrillContinuationLabel(id: string, label: TrillContinuationLabel): boolean {
    const ok = this.scoreModel.setTrillContinuationLabel(id, label)
    if (ok) this.saveOnly('Trill continuation label')
    return ok
  }

  /** Flip a trill between above and below the staff — the `x` key's trill branch. Saves undo state.
   *  ⚠️ `saveOnly`, unlike {@link addTrill}: a side is notation, and it changes nothing audible. */
  toggleTrillPlacement(id: string): 'above' | 'below' | null {
    const side = this.scoreModel.toggleTrillPlacement(id)
    if (side) this.saveOnly('Flip trill side')
    return side
  }

  /** ⭐ What a trill alternates WITH — the diatonic step above, resolved against the key and the
   *  bar's accidentals. DERIVED every time, never stored (docs/trill-plan.md §3). The renderer asks
   *  for the printed sign; playback asks for the sounding pitch. @returns null if it does not resolve. */
  trillAuxiliaryOf(id: string): TrillAuxiliary | null {
    return this.scoreModel.trillAuxiliaryOf(id)
  }

  /** Set (or clear with `null`) a slur's user-edited curve shape (the two cubic
   *  control-point deltas, in **staff-spaces** — the caller converts from pixels). Stored
   *  in the engraving-overrides compartment, not on the slur (see
   *  {@link CurveShapeOverride}). Saves one undo step on success.
   *  @returns true if the slur exists and was updated. */
  setSlurShape(id: string, cps: CurveControlPointDeltas | null): boolean {
    const updated = this.scoreModel.setSlurShape(id, cps)
    if (updated) this.saveOnly(cps ? 'Reshape slur' : 'Reset slur shape')
    return updated
  }

  /** Live (preview) shape update used **while dragging a slur handle** — updates the
   *  slur's curve-shape override (staff-spaces) but does NOT record undo. Call
   *  {@link commitSlurShape} on drop to push the single undo entry (mirrors `moveClef` /
   *  `commitClefMove`).
   *
   *  A same-line slur (no `segment`) reshapes its whole-arc `curveShape`. A cross-system
   *  slur passes the grabbed segment's address + the live `spanCount`, routing the edit
   *  into the per-segment `segmentCurveShape` override instead. */
  previewSlurShape(
    id: string,
    cps: CurveControlPointDeltas,
    segment?: SlurSegmentAddress,
    spanCount?: number,
  ): boolean {
    // Live drag: mutates the model but defers its undo entry to commitSlurShape, so it never
    // passes through saveUndoState — the one place that flags the model dirty. Flag it here or
    // the next render would skip, and the drag would not appear (render-performance-plan §5a).
    this.markModelDirty()
    return segment && spanCount !== undefined
      ? this.scoreModel.setSlurSegmentShape(id, segment, cps, spanCount)
      : this.scoreModel.setSlurShape(id, cps)
  }

  /** Record one undo entry after a slur-handle drag settles. */
  commitSlurShape(): void {
    this.commitPreviewed('Reshape slur')
  }

  /** Re-anchor without undo — moves one end of the slur onto `noteId` and resets the edits that
   *  were authored against the old anchor (see `slurOps.setSlurEndpoint`). Returns false (no-op)
   *  when the target is invalid (collapses the span or is unchanged). Pair it with
   *  {@link commitSlurEndpoint} for the single undo entry: every FRAME of an endpoint drag, or the
   *  one step of a Ctrl+Shift+←/→ press (`interactions/slurReanchor`, where the two run back to
   *  back — a press is already a whole gesture). */
  previewSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
    this.markModelDirty() // live drag, undo deferred to commitSlurEndpoint — see previewSlurShape
    return this.scoreModel.setSlurEndpoint(id, which, noteId)
  }

  /** Record one undo entry for a re-anchor: after the drag settles, or per keyboard step. */
  commitSlurEndpoint(): void {
    this.commitPreviewed('Re-anchor slur')
  }

  /** Re-point one end onto `noteId` **keeping** the arc's shape and both ends' nudges, and save ONE
   *  undo step. The interpolating walk's write (`interactions/slurEndpointWalk`), which pairs it
   *  with a re-basing {@link nudgeSlurEndpoint} inside a {@link runBatch} so the press is one entry.
   *  ⚠️ NOT the general re-anchor — see `slurOps.setSlurEndpointKeepingEdits` for which caller wants
   *  which. @returns false (no-op) when the target is invalid or already the anchor. */
  setSlurEndpointKeepingEdits(id: string, which: 'start' | 'end', noteId: string): boolean {
    const ok = this.scoreModel.setSlurEndpointKeepingEdits(id, which, noteId)
    if (ok) this.saveOnly('Re-anchor slur')
    return ok
  }

  /** The undo-free twin of {@link setSlurEndpointKeepingEdits}, for a live endpoint DRAG whose every
   *  frame may cross a note. Pair with {@link commitSlurEndpoint} on drop. */
  previewSlurEndpointKeepingEdits(id: string, which: 'start' | 'end', noteId: string): boolean {
    this.markModelDirty() // live drag, undo deferred to commitSlurEndpoint — see previewSlurShape
    return this.scoreModel.setSlurEndpointKeepingEdits(id, which, noteId)
  }

  /** The undo-free twin of {@link nudgeSlurEndpoint} — accumulates the same way, keeps the same page
   *  limit, records no undo step. One frame of an endpoint drag. */
  previewSlurEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.slurEndpointOffsetAllowed(id, which, dx, dy)) return false
    this.markModelDirty()
    return this.scoreModel.setSlurEndpointOffset(id, which, dx, dy)
  }

  /** Drop a slur's hand-edited ARC shape and save ONE undo step — the reset half of the handle
   *  nudges, on the key that resets everything else (`interactions/slurHandleReset`). Pass a
   *  `segment` + live `spanCount` for one segment of a cross-system slur, neither for the whole
   *  slur. @returns false when there was nothing authored to reset — the caller then DECLINEs and
   *  the key falls through. */
  resetSlurShape(id: string, segment?: SlurSegmentAddress, spanCount?: number): boolean {
    const ok = this.scoreModel.resetSlurShape(id, segment, spanCount)
    if (ok) this.saveOnly('Reset slur shape')
    return ok
  }

  /** Drop ONE true end's nudge and save ONE undo step — the reset half of {@link nudgeSlurEndpoint}.
   *  @returns false if that end has no offset, so the caller DECLINEs and the key falls through. */
  resetSlurEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    const ok = this.scoreModel.resetSlurEndpointOffset(id, which)
    if (ok) this.saveOnly('Reset slur endpoint')
    return ok
  }

  /** Drop ONE open join's nudge and save ONE undo step — the reset half of
   *  {@link nudgeSlurSegmentEndpoint}. @returns false if that join has no offset. */
  resetSlurSegmentEndpointOffset(id: string, address: SlurSegmentEndpointAddress, spanCount: number): boolean {
    const ok = this.scoreModel.resetSlurSegmentEndpointOffset(id, address, spanCount)
    if (ok) this.saveOnly('Reset slur segment endpoint')
    return ok
  }

  /** Nudge a slur endpoint by a staff-space delta and save ONE undo step (the keyboard
   *  fine-positioning — see docs/slur-endpoint-offset-plan.md). Unlike a mouse drag each
   *  arrow press is already a discrete commit, so there is no preview/commit split. */
  nudgeSlurEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.slurEndpointOffsetAllowed(id, which, dx, dy)) return false
    const ok = this.scoreModel.setSlurEndpointOffset(id, which, dx, dy)
    if (ok) this.saveOnly('Nudge slur endpoint')
    return ok
  }

  /**
   * ⭐⭐ **Nudge the WHOLE curve** by a staff-space delta and save ONE undo step — the arrows with the
   * slur selected and no handle armed (his ask, 2026-08-18), the family's rule that a hairpin, a
   * bracket, a pedal and a trill already follow. The shape does not change: see
   * {@link SlurOffsetOverride} for why this is one rigid translate rather than two endpoint nudges.
   *
   * ⚠️ **Both limits, judged END BY END.** The page limit reads the whole slur's ink (a sheet cares
   * about all of it, and each drawn fragment is judged against its own page). The BAND limit reads
   * each end's own handle in its OWN system's band — the correction of 2026-08-18 twice over: the
   * arc's bbox spans the arch, so judging it would refuse every vertical move of a curve whose arch
   * already overhangs, and on a cross-system slur the two ends do not even share a band.
   */
  nudgeSlur(id: string, dx: number, dy: number): boolean {
    if (!this.slurOffsetAllowed(id, dx, dy)) return false
    const ok = this.scoreModel.setSlurOffset(id, dx, dy)
    if (ok) this.saveOnly('Nudge slur')
    return ok
  }

  /** The undo-free twin of {@link nudgeSlur} — one frame of an ARC-BODY drag. Accumulating, so the
   *  caller passes the delta since the last ACCEPTED frame; both limits still refuse the write, so a
   *  curve dragged into a neighbour's room stops moving (⛔ the drawing is never clamped). Pair with
   *  {@link commitSlurOffsetDrag} on the drop. @returns true when the model changed. */
  previewSlurOffset(id: string, dx: number, dy: number): boolean {
    if (!this.slurOffsetAllowed(id, dx, dy)) return false
    this.markModelDirty() // live drag, undo deferred to commitSlurOffsetDrag
    return this.scoreModel.setSlurOffset(id, dx, dy)
  }

  /** Record ONE undo entry after an arc-body drag settles. */
  commitSlurOffsetDrag(): void {
    this.commitPreviewed('Move slur')
  }

  /** Drop the whole curve's offset and save ONE undo step — `Ctrl+Backspace` with nothing armed.
   *  @returns false when it carries none, so the caller DECLINEs and the key falls through. */
  resetSlurOffset(id: string): boolean {
    const ok = this.scoreModel.resetSlurOffset(id)
    if (ok) this.saveOnly('Reset slur offset')
    return ok
  }

  /**
   * Nudge a selected rest's vertical shift by `delta` whole staff-steps and save ONE undo step
   * (the ↑/↓ keyboard fine-positioning — see docs/rest-shift-plan.md). Resolves the rest id to
   * its position address here (the override is position-keyed, since rests have no durable id)
   * and delegates the accumulate/clear to the model. A no-op for a non-rest / missing id.
   * @returns true if a rest was nudged.
   */
  nudgeRestShift(restId: string, delta: number): boolean {
    // ⚠️ `delta` counts whole staff STEPS — half a space each — and counts them UPWARD, while
    // screen-down is +y. So the row converts and flips: this is the one client that does not hand
    // the guard staff spaces.
    if (!this.nudgeStaysOnPage('rest', restId, 0, -delta / 2)) return false
    const note = this.scoreModel.getNote(restId)
    if (!note || !note.isRest) return false
    const measure = this.scoreModel.getMeasure(note.measure)
    if (!measure) return false
    const key = restPositionKey(measure.id, voiceOf(note), note.beat, this.staffIdForIndex(note.staff))
    const ok = this.scoreModel.nudgeRestShift(key, delta)
    if (ok) {
      this.saveOnly('Nudge rest')
      const steps = restShiftOverrideOf(this.scoreModel.getScore(), key)?.steps ?? 0
      dbg(`[Rest] ${delta > 0 ? '↑' : '↓'} shift rest ${restId} (${key}) by ${delta} → total ${steps} step(s)`)
    }
    return ok
  }

  /**
   * Set the user-authored leading space before one rhythmic column and save ONE undo step
   * (client #10 — docs/note-spacing-plan.md). `space` is in staff-spaces, signed; `0` clears.
   *
   * Keyed by measure **id** and beat, with no voice and no staff: a space belongs to the column,
   * so every voice and every staff at that beat moves together by construction. The caller supplies
   * `minSpace` — the floor a negative space may not pass — because only whoever has the last render
   * in hand can measure the gap it would close; see `ScoreModel.setNoteSpacing` for why that clamp
   * cannot live at draw time.
   *
   * @returns the space actually stored (after the clamp), or null for an unknown measure.
   */
  setNoteSpacing(measureNumber: number, beat: Fraction, space: number, minSpace: number): number | null {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null
    const key = spacingPositionKey(measure.id, beat)
    const stored = this.scoreModel.setNoteSpacing(key, space, minSpace)
    this.saveOnly('Note spacing')
    dbg(`[Spacing] bar ${measureNumber} beat ${beat.num}/${beat.den} (${key}) → ${stored} staff-space(s)`)
    return stored
  }

  /**
   * ⭐ The COLUMN a selected note is spaced by — **its own beat inside a fan** rather than the
   * group's (docs/note-spacing-plan.md §7). Every spacing caller resolves its address through here
   * instead of reading `getNote().beat`, which reports the SLOT's beat for a fanned member and so
   * spaced the whole group.
   *
   * `memberIndex` ≥ 1 says the address is a gap INSIDE a fan, which is what
   * {@link noteSpacingRoom} needs before it goes looking for a drawn column that does not exist.
   */
  spacingColumnOf(noteId: string): { measure: number; beat: Fraction; memberIndex: number } | null {
    return this.scoreModel.spacingColumnOf(noteId)
  }

  /** The authored leading space at this column, in staff-spaces. 0 = none (the engraver's own). */
  getNoteSpacing(measureNumber: number, beat: Fraction): number {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return 0
    return leadingSpaceOverrideOf(this.scoreModel.getScore(), spacingPositionKey(measure.id, beat))?.space ?? 0
  }

  /**
   * Nudge the leading space before one column by `delta` staff-spaces and save ONE undo step —
   * the keyboard fine-positioning (Shift+Alt+←/→). Accumulates onto whatever is already there;
   * returning to zero clears the entry.
   *
   * The floor comes from {@link measuredShrinkRoom}, so a leftward nudge stops when the column
   * reaches its neighbour instead of walking through it. **Declines when the room cannot be
   * measured** — an unrendered bar has no gaps to read, and inventing one would engrave a rule
   * nobody chose.
   *
   * `anchorNoteId` names the note the address came from, so a gap inside a fan is floored against
   * the head behind it rather than against a column that does not exist (§7). Absent ⇒ an ordinary
   * column, exactly as before.
   *
   * @returns the space now stored, or null if the nudge was declined.
   */
  nudgeNoteSpacing(measureNumber: number, beat: Fraction, delta: number, anchorNoteId?: string): number | null {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null
    const room = this.noteSpacingRoom(measureNumber, beat, anchorNoteId)
    if (room === null) {
      dbg(`[Spacing] declined bar ${measureNumber} beat ${beat.num}/${beat.den} — no drawn gap to measure the floor against`)
      return null
    }
    const key = spacingPositionKey(measure.id, beat)
    const current = leadingSpaceOverrideOf(this.scoreModel.getScore(), key)?.space ?? 0
    const stored = this.scoreModel.setNoteSpacing(key, current + delta, current - room)
    this.saveOnly('Note spacing')
    dbg(`[Spacing] bar ${measureNumber} beat ${beat.num}/${beat.den} ${delta > 0 ? '→' : '←'} ${stored} staff-space(s) (room ${room.toFixed(2)})`)
    return stored
  }

  /**
   * How far the column at (measure, beat) may still be pulled left, in staff-spaces — the public
   * face of {@link measuredShrinkRoom}, for a drag that wants the floor ONCE at grab time rather
   * than re-measuring every frame.
   *
   * Capturing it at the grab is the right shape for a drag and not merely the cheap one: the whole
   * gesture is then judged against the picture the user actually grabbed, so the floor cannot creep
   * as the drag redraws underneath it.
   *
   * `anchorNoteId` routes a fanned MEMBER's address to {@link fanMemberShrinkRoom} — the gap it may
   * close is the one before its own head, not the one before the group (§7).
   *
   * @returns null when the last render cannot answer — the caller must not drag rather than invent
   * a floor.
   */
  noteSpacingRoom(measureNumber: number, beat: Fraction, anchorNoteId?: string): number | null {
    // ⚠️ The staleness rule for BOTH readings, in one place: the gap on screen already includes
    // whatever space is stored, so the room and the stored value have to come from the same moment.
    // See `engine/layout/measuredRoom.ts`, which is measurement only and trusts this guard.
    if (this.modelDirty) return null
    const registry = this.renderer.getElementRegistry()
    if (anchorNoteId) {
      const column = this.scoreModel.spacingColumnOf(anchorNoteId)
      if (column && column.memberIndex >= 1) {
        // The member BEHIND it — resolved here, because this is the side that has the model.
        const behind = this.scoreModel.fanMembersOfSlot(anchorNoteId)?.[column.memberIndex - 1]
        return behind ? fanMemberShrinkRoom(registry, measureNumber, anchorNoteId, behind.id) : null
      }
    }
    return measuredShrinkRoom(registry, measureNumber, beat)
  }

  /**
   * Live-set the leading space at a column during a drag: takes effect on screen, records **no**
   * undo. Call {@link commitNoteSpacing} on drop for the single undo entry — the same
   * preview/commit pair as `previewStaffSpacing` / `previewSlurShape`.
   *
   * `minSpace` is the floor captured at grab time (see {@link noteSpacingRoom}); this applies it
   * verbatim rather than re-measuring, because the picture is moving under the gesture.
   *
   * @returns true if the stored space changed — the caller's "did this drag do anything" flag.
   */
  previewNoteSpacing(measureNumber: number, beat: Fraction, space: number, minSpace: number): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    const key = spacingPositionKey(measure.id, beat)
    const before = leadingSpaceOverrideOf(this.scoreModel.getScore(), key)?.space ?? 0
    const after = this.scoreModel.setNoteSpacing(key, space, minSpace)
    const changed = after !== before
    // A spacing change re-runs the casting-off, unlike the weightless previews — so the dirty flag
    // is what makes the bar re-measure at all, not just repaint. See docs/note-spacing-plan.md §2.
    // ⚠️ Only when it CHANGED — a no-op frame that marks the model dirty is never rendered (the
    // caller repaints on `true`) and so never cleaned, and `noteSpacingRoom` then refuses every
    // later gesture. See {@link previewBarWidth} for the report that found it.
    if (changed) this.markModelDirty()
    return changed
  }

  /** Record one undo entry after a note-spacing drag settles (the drop of a live drag whose every
   *  frame went through {@link previewNoteSpacing}). */
  commitNoteSpacing(): void {
    this.commitPreviewed('Note spacing')
  }

  /** Drop the authored space before this column, back to the engraver's own spacing. One undo step.
   *  @returns true if anything was there to reset. */
  resetNoteSpacing(measureNumber: number, beat: Fraction): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    const key = spacingPositionKey(measure.id, beat)
    if (!leadingSpaceOverrideOf(this.scoreModel.getScore(), key)) return false
    this.scoreModel.setNoteSpacing(key, 0, 0)
    this.saveOnly('Reset note spacing')
    dbg(`[Spacing] reset bar ${measureNumber} beat ${beat.num}/${beat.den}`)
    return true
  }

  /**
   * How much of its barline gap this bar can still give back, in staff-spaces — the negative limit
   * of {@link nudgeBarlineSpace}. Measured off the last render (`measuredBarlineGapRoom`).
   *
   * ⚠️ Refuses on a dirty model, exactly like {@link barWidthRoom} and for the same reason: the
   * drawn gap already contains the stored space, so the picture and the number have to come from
   * the same moment. Null is "I don't know" and the caller must decline, not guess.
   */
  barlineGapRoom(measureNumber: number): number | null {
    if (this.modelDirty) return null
    return measuredBarlineGapRoom(this.renderer.getElementRegistry(), measureNumber)
  }

  /** The authored gap before this bar's barline, in staff-spaces. 0 = the engraver's own. */
  getBarlineSpace(measureNumber: number): number {
    const measure = this.scoreModel.getMeasure(measureNumber)
    return measure ? barlineSpaceOf(this.scoreModel.getScore(), measure.id) : 0
  }

  /**
   * Widen or tighten the gap between a bar's last element and its barline by `delta` staff-spaces,
   * and save ONE undo step. The keyboard gesture (`Shift+←/→` on a selected barline).
   *
   * **Not a bar width and not an offset.** A bar width multiplies the whole note space and re-spaces
   * the music proportionally; this adds a fixed distance at one end and moves no note at all. It is
   * the same quantity as a note-spacing nudge, at the one address that gesture cannot reach — see
   * {@link BarlineSpaceOverride}.
   *
   * @returns the space now stored, or null when the last render cannot measure the floor.
   */
  nudgeBarlineSpace(measureNumber: number, delta: number): number | null {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null
    const room = this.barlineGapRoom(measureNumber)
    if (room === null) {
      dbg(`[BarlineGap] declined bar ${measureNumber} — no drawn gap to measure the floor against`)
      return null
    }
    const current = barlineSpaceOf(this.scoreModel.getScore(), measure.id)
    // The floor is relative: `room` is what the CURRENT gap can still give up, so the stored value
    // may go down by that much and no further.
    const stored = this.scoreModel.setBarlineSpace(barlineSpaceKey(measure.id), current + delta, current - room)
    this.saveOnly('Barline gap')
    dbg(`[BarlineGap] bar ${measureNumber} ${delta > 0 ? '→' : '←'} ${stored} staff-space(s) (room ${room.toFixed(2)})`)
    return stored
  }

  /** Drop the bar's authored barline gap, back to the engraver's own. One undo step.
   *  @returns true if anything was there to reset. */
  resetBarlineSpace(measureNumber: number): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    if (barlineSpaceOf(this.scoreModel.getScore(), measure.id) === 0) return false
    this.scoreModel.setBarlineSpace(barlineSpaceKey(measure.id), 0, 0)
    this.saveOnly('Reset barline gap')
    dbg(`[BarlineGap] reset bar ${measureNumber}`)
    return true
  }

  /**
   * Set a bar's authored **stretch** and save ONE undo step (client #11 —
   * docs/bar-width-plan.md). `stretch` multiplies the bar's own note space; `1` clears.
   *
   * Keyed by the measure **id**, so the stretch rides through a rebar untouched (a rebar keeps
   * ids) — no capture/restore, unlike the column-keyed leading spaces. `minStretch` is the floor
   * measured off the last render by whoever has it in hand (P1); pass `BAR_STRETCH_MIN` when there
   * is nothing to measure against — `ScoreModel.setBarWidth` applies the absolute clamp regardless.
   *
   * A stretch changes what the bar is worth, so the casting-off must re-run — `saveOnly` flags the
   * model dirty for us, exactly as on a leading space. (A live drag will need the preview/commit
   * pair instead; that is P2's, not this.)
   *
   * @returns the stretch actually stored (after the clamps), or null for an unknown measure.
   */
  setBarWidth(measureNumber: number, stretch: number, minStretch: number = BAR_STRETCH_MIN): number | null {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null
    const stored = this.scoreModel.setBarWidth(barWidthKey(measure.id), stretch, minStretch)
    this.saveOnly('Bar width')
    dbg(`[BarWidth] bar ${measureNumber} (${measure.id}) → ×${stored}`)
    return stored
  }

  /** The bar's authored stretch multiplier. 1 = none (the engraver's own width). */
  getBarWidth(measureNumber: number): number {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return 1
    return measureStretch(this.scoreModel.getScore(), measure.id)
  }

  /**
   * How much room a bar-width gesture has on this bar, and what a pixel is worth in it — everything
   * needed to move a barline, measured off the **last render** (docs/bar-width-plan.md §4–§5).
   *
   * The arithmetic itself is {@link barWidthRoomOf}, a pure function of the things read here.
   * What this method owns is the READING, and one rule that goes with it: ⚠️ **a dirty model cannot
   * answer at all**, because the picture and the numbers would then come from different moments.
   *
   * @returns null — "I don't know", decline rather than guess — when the model is dirty, nothing is
   * drawn for the bar yet, or it has no note space to multiply.
   */
  barWidthRoom(measureNumber: number): BarWidthRoom | null {
    if (this.modelDirty) return null
    const slackPx = measuredBarShrinkPx(this.renderer.getElementRegistry(), measureNumber)
    if (slackPx === null) return null
    return barWidthRoomOf({
      measureNumber,
      layout: this.renderer.getMeasureLayoutInfo(),
      stretch: this.getBarWidth(measureNumber),
      viewMode: this.getViewMode(),
      surface: resolveSurface(this.surface),
      slackPx,
    })
  }

  /**
   * A cheap signature of the casting-off around this bar: which system it is on, and which bars
   * share it. Two renders with the same key laid the same bars on the same line.
   *
   * The one thing a live bar-width drag must watch. Its captured room (`T`, `P`, the slope) is only
   * valid while the line holds the same bars — so when a stretch pushes one onto the next system,
   * the formula stops describing the picture and the barline slides out from under the pointer.
   * §5 of the plan avoided this by refusing to re-wrap at all, which a key press showed to be the
   * wrong trade; the drag re-anchors instead. Null when the last render cannot say.
   */
  barWidthLineKey(measureNumber: number): string | null {
    const layout = this.renderer.getMeasureLayoutInfo()
    const info = layout.get(measureNumber)
    if (!info) return null
    const line = [...layout.values()]
      .filter(i => i.lineNumber === info.lineNumber)
      .map(i => i.measureNumber)
      .sort((a, b) => a - b)
    return `${info.lineNumber}:${line[0]}-${line[line.length - 1]}`
  }

  /**
   * Move the barline that ends this bar by `barlineDeltaPx` and save ONE undo step — the keyboard
   * gesture (Shift+Alt+←/→ on a selected barline). The bar to the LEFT gets roomier or tighter,
   * with its music re-spaced proportionally; the room comes from its neighbours on the line.
   *
   * The argument is in **pixels of barline movement**, not in stretch, so a step means the same
   * distance whether it arrives from the keyboard or (P2) from the mouse — the px→ratio conversion
   * happens here, through {@link barWidthRoom}'s slope.
   *
   * ⚠️ **When the barline cannot move, the step falls back to the bar's own music.** The barline
   * that ends a system is pinned to the right margin by justification (slope 0), and so is the one
   * after a bar that sits alone on its line — but "this barline can't move" must not mean "this bar
   * can't be resized", or the last bar of every system would be untouchable and a bar stretched
   * until it is alone on its system could never be brought back. So the step is spent on the bar's
   * note space instead: the same pixels, measured on the music rather than on the barline. What
   * they buy is a re-wrap — which is what a pinned barline was always going to mean.
   *
   * A press may therefore change which bars sit on which system. That is deliberate (see
   * {@link barWidthRoom}) and matches Sibelius / Finale / MuseScore.
   *
   * **Declines** (null) only when the room cannot be measured at all. A declined nudge stores
   * nothing.
   *
   * @returns the stretch now stored, or null if the nudge was declined.
   */
  nudgeBarWidth(measureNumber: number, barlineDeltaPx: number): number | null {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null
    const room = this.barWidthRoom(measureNumber)
    if (room === null) {
      dbg(`[BarWidth] declined bar ${measureNumber} — nothing drawn to measure the step against`)
      return null
    }
    const pinned = room.barlineSlope <= 1e-6
    const clamp = (v: number) => Math.min(room.maxStretch, Math.max(room.minStretch, v))
    // The KEY-PRESS answer (`stretchForStep`), not the continuous one — this is the keyboard.
    let bounded = clamp(room.stretchForStep(barlineDeltaPx))
    // ⚠️ **A PRESS MUST MOVE, OR THE LIMIT MUST BE REAL.** The threshold jump aims at the stretch
    // where the casting-off changes, and it can be a FIXED POINT: aim past the bar below, apply it,
    // and if that bar is itself stretched it still does not fit — the bar is still alone, the next
    // press computes the identical target, and the gesture is dead with the log happily reporting a
    // jump. Reported from use twice, from a score where bar 1 sat at ×15.738 and would not shrink.
    //
    // Guessing a better threshold is the wrong fix (it has to be right about every reason a bar
    // might not fit). Falling back is: if the jump changes nothing, spend the press continuously
    // instead. A press then either moves the bar or is genuinely against `minStretch`/`maxStretch`,
    // which is a limit the user can see.
    if (Math.abs(bounded - room.stretch) < 1e-9) {
      const continuous = clamp(room.stretchForBarlineDelta(barlineDeltaPx))
      if (Math.abs(continuous - room.stretch) > 1e-9) bounded = continuous
    }
    const stored = this.scoreModel.setBarWidth(barWidthKey(measure.id), bounded, BAR_STRETCH_MIN)
    this.saveOnly('Bar width')
    dbg(
      `[BarWidth] bar ${measureNumber} ${barlineDeltaPx > 0 ? '→' : '←'} ×${stored.toFixed(3)} ` +
        `[${this.renderer.getMeasureLayoutInfo().get(measureNumber)?.stretchScalesShare ? 'empty bar: scales its share' : 'has music: reserved space'}] ` +
        `(${room.alone ? 'alone on its system — stepping to the next casting-off threshold'
            : pinned ? 'barline pinned — stepping the bar’s own music' : `slope ${room.barlineSlope.toFixed(3)}`}` +
        `, range ×${room.minStretch.toFixed(2)}…×${room.maxStretch.toFixed(2)}` +
        `${room.capped ? ', line past the authored-space cap' : ''})`,
    )
    return stored
  }

  /**
   * Live-set a bar's stretch during a drag: takes effect on screen, records **no** undo. Call
   * {@link commitBarWidth} on drop for the single entry — the same preview/commit pair as
   * `previewNoteSpacing` / `previewStaffSpacing`.
   *
   * The bounds are the caller's, captured once at grab ({@link barWidthRoom}) and applied verbatim
   * rather than re-measured: the picture is moving under the gesture, and a floor that re-measures
   * every frame creeps along with it.
   *
   * @returns true if the stored stretch changed — the caller's "did this drag do anything" flag.
   */
  previewBarWidth(measureNumber: number, stretch: number, minStretch: number, maxStretch: number): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    const key = barWidthKey(measure.id)
    const before = measureStretch(this.scoreModel.getScore(), measure.id)
    const after = this.scoreModel.setBarWidth(key, Math.min(maxStretch, stretch), minStretch)
    const changed = after !== before
    // A stretch re-runs the casting-off, unlike the weightless previews — the dirty flag is what
    // makes the bar re-measure at all rather than just repaint.
    //
    // ⚠️ **Only when it CHANGED, and that is not a tidiness point.** `modelDirty` means "the model
    // has moved on from the picture", and only a render clears it. A frame that stored the same
    // value has not moved on from anything — but marking it anyway left the model permanently dirty
    // whenever a drag's LAST frame was a no-op, which is what a drag pushed past its clamp always
    // ends with. The caller only repaints when this returns true, so nothing ever cleared it, and
    // the next gesture to ask {@link barWidthRoom} — which refuses on a dirty model, rightly — got
    // "I don't know" forever. Reported as: drag one barline hard, and the NEXT barline you grab
    // will not move. Same shape in {@link previewNoteSpacing}.
    if (changed) this.markModelDirty()
    return changed
  }

  /** Record one undo entry after a bar-width drag settles (a drag whose every frame went through
   *  {@link previewBarWidth}). */
  commitBarWidth(): void {
    this.commitPreviewed('Bar width')
  }

  /** Drop the bar's authored stretch, back to the engraver's own width. One undo step.
   *  @returns true if anything was there to reset. */
  resetBarWidth(measureNumber: number): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    if (measureStretch(this.scoreModel.getScore(), measure.id) === 1) return false
    this.scoreModel.setBarWidth(barWidthKey(measure.id), 1, BAR_STRETCH_MIN)
    this.saveOnly('Reset bar width')
    dbg(`[BarWidth] reset bar ${measureNumber}`)
    return true
  }

  /**
   * Nudge a selected dynamic's position offset by `(dx, dy)` staff-spaces and save ONE undo step
   * (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see docs/dynamic-offset-plan.md). The
   * override is element-id-keyed (dynamics have durable ids), so this delegates straight to the
   * model with the dynamic id. A no-op for a missing id.
   * @returns true if the dynamic was nudged.
   */
  nudgeDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('dynamic', dynamicId, dx, dy)) return false
    if (!this.scoreModel.getDynamicById(dynamicId)) return false
    const ok = this.scoreModel.nudgeDynamicOffset(dynamicId, dx, dy)
    if (ok) {
      this.saveOnly('Nudge dynamic')
      const off = dynamicOffsetOverrideOf(this.scoreModel.getScore(), dynamicId)
      dbg(`[Dynamic] nudge ${dynamicId} by (${dx}, ${dy}) → offset (${off?.x ?? 0}, ${off?.y ?? 0}) staff-space(s)`)
    }
    return ok
  }

  /**
   * Nudge a selected TEMPO mark's position offset by `(dx, dy)` staff-spaces and save ONE undo step
   * — the ←→↑↓ / Ctrl+arrow fine-positioning, his ask of 2026-08-19.
   *
   * {@link nudgeDynamicOffset} above in all but one respect: same page limit, same id-keyed override,
   * same accumulate-and-clear-at-zero in the model — but ⚠️ **`dy` is OUTWARD here, +up**, because a
   * tempo mark is always drawn above the staff and a number a human types about it means *how far
   * from the staff*. See {@link TempoOffsetOverride}; the sign is converted here and in the render,
   * nowhere else.
   * @returns true if the mark was nudged; false for an unknown id or a step the page refuses.
   */
  nudgeTempoOffset(tempoId: string, dx: number, dy: number): boolean {
    // 🚨 `dy` is OUTWARD (+up) for this mark alone — see `TempoOffsetOverride`. The page limit reasons
    // in SCREEN pixels, so the sign is flipped for it and only for it.
    if (!this.nudgeStaysOnPage('tempo', tempoId, dx, -dy)) return false
    if (!this.scoreModel.getTempoMarkById(tempoId)) return false
    const ok = this.scoreModel.nudgeTempoOffset(tempoId, dx, dy)
    if (ok) {
      this.saveOnly('Nudge tempo mark')
      const off = tempoOffsetOverrideOf(this.scoreModel.getScore(), tempoId)
      dbg(`[Tempo] nudge ${tempoId} by (${dx}, ${dy}) → offset (${off?.x ?? 0}, ${off?.y ?? 0}) staff-space(s)`)
    }
    return ok
  }

  /**
   * Move a tempo mark one onset back (−1) or on (+1) — `Ctrl+Shift+←/→` with the mark selected, the
   * RE-ANCHOR (his ask, 2026-08-19).
   *
   * ⚠️ **A CONTENT edit, and an AUDIBLE one**, where the plain / `Ctrl` arrow on the same selection
   * writes an engraving override: the tempo applies from the beat this writes, so the tempo map and
   * every scheduled note after it move with the mark. Two chords, two categories — `moveDynamicBySlot`
   * above is the same arrangement on the letters. Saves ONE undo entry per press.
   * @returns true when the mark moved; false (declining the key) at either end of the score, when the
   *   stop it would land on already holds a mark, or for an id no longer in the score.
   */
  moveTempoBySlot(id: string, direction: 1 | -1): boolean {
    const ok = this.scoreModel.moveTempoBySlot(id, direction)
    if (ok) {
      this.commit(direction === -1 ? 'Move tempo mark back' : 'Move tempo mark on')
      dbg(`[Tempo] re-anchored ${id} ${direction === -1 ? 'back' : 'on'} one onset`)
    }
    return ok
  }

  /**
   * Hand a tempo mark onto `target` **keeping its hand-nudged offset** — the crossing of the
   * interpolating walk (`interactions/tempoWalk`), where {@link moveTempoBySlot} above drops it.
   * Content, and audible, for that method's reason. ⚠️ Saves its own undo entry, so the walk wraps
   * the crossing pair in one `runBatch`.
   */
  moveTempoToSlotKeepingOffset(id: string, target: TempoStop): boolean {
    const ok = this.scoreModel.setTempoAtSlotKeepingOffset(id, target)
    if (ok) {
      this.commit('Move tempo mark')
      dbg(`[Tempo] walked ${id} onto m${target.measure} beat ${target.beat.num}/${target.beat.den}`)
    }
    return ok
  }

  /** The undo-free twin of {@link moveTempoToSlotKeepingOffset} — one crossing of a dragged mark's
   *  walk; {@link commitTempoDrag} records the whole gesture once on the drop. */
  previewTempoSlotKeepingOffset(id: string, target: TempoStop): boolean {
    this.markModelDirty() // live drag, undo deferred to commitTempoDrag
    return this.scoreModel.setTempoAtSlotKeepingOffset(id, target)
  }

  /** The whole-stop flavour, undo-free: what a drag lands with when the ink has left the mark's own
   *  SYSTEM (`interactions/tempoWalk`), which is a jump and not a walk — so it drops the nudge. */
  previewTempoSlot(id: string, target: TempoStop): boolean {
    this.markModelDirty()
    return this.scoreModel.setTempoAtSlot(id, target)
  }

  /** The undo-free twin of {@link nudgeTempoOffset} — accumulates the same way, keeps the same page
   *  limit (and its OUTWARD `dy`), records no undo step. One frame of a tempo drag. */
  previewTempoOffset(id: string, dx: number, dy: number): boolean {
    if (!this.nudgeStaysOnPage('tempo', id, dx, -dy)) return false
    if (!this.scoreModel.getTempoMarkById(id)) return false
    this.markModelDirty()
    return this.scoreModel.nudgeTempoOffset(id, dx, dy)
  }

  /** Record ONE undo entry after a tempo drag settles. */
  commitTempoDrag(): void {
    this.commitPreviewed('Move tempo mark')
  }

  /** Where {@link moveTempoBySlot} would put the mark, without putting it there — the walk reads it
   *  to measure how far away the next stop is drawn. */
  nextTempoSlot(id: string, direction: 1 | -1): TempoStop | null {
    return this.scoreModel.nextTempoSlot(id, direction)
  }

  /**
   * `Ctrl+Backspace` on a selected DYNAMIC / TEMPO mark: drop its hand nudge (his report,
   * 2026-08-19 — *"the ctr backspace is not working for me"*, on the tempo offset built that day;
   * the dynamic had the same hole since its own offset shipped).
   * @returns false when the mark carries no nudge, so the key falls through to its other tenants.
   */
  resetDynamicOffset(id: string): boolean {
    const ok = this.scoreModel.resetDynamicOffset(id)
    if (ok) this.saveOnly('Reset dynamic nudge')
    return ok
  }

  resetTempoOffset(id: string): boolean {
    const ok = this.scoreModel.resetTempoOffset(id)
    if (ok) this.saveOnly('Reset tempo nudge')
    return ok
  }

  /**
   * Nudge a selected note's horizontal offset by `dx` staff-spaces and save ONE undo step (the
   * Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md). Selection gives a *pitch*
   * id; the override is keyed by whatever {@link ScoreModel.offsetTargetOf} resolves — the SLOT for
   * anything ordinary (a chord moves as a unit, and a rest is a slot too), the MEMBER's own key
   * inside a fan — and the accumulate/clear is the model's. A no-op for an id no longer in the score.
   * @returns true if the note was nudged.
   */
  nudgeNoteOffset(noteId: string, dx: number): boolean {
    if (!this.nudgeStaysOnPage('note', noteId, dx, 0)) return false
    const target = this.scoreModel.offsetTargetOf(noteId)
    if (!target) return false
    const ok = this.scoreModel.nudgeNoteOffset(target.key, dx)
    if (ok) {
      this.saveOnly('Nudge note')
      const off = noteOffsetOverrideOf(this.scoreModel.getScore(), target.key)
      const what = target.memberIndex ? `fan member ${target.memberIndex}` : 'slot'
      dbg(`[Note] nudge ${noteId} (${what} ${target.key}) by ${dx} → offset ${off?.x ?? 0} staff-space(s)`)
    }
    return ok
  }

  /**
   * Reset a selected note to its natural column, dropping its horizontal offset outright (the
   * Ctrl+Backspace first-class reset — see docs/note-offset-plan.md). Keyed by
   * {@link ScoreModel.offsetTargetOf} like {@link nudgeNoteOffset}. One undo step.
   * @returns true if an offset was there to reset.
   */
  resetNoteOffset(noteId: string): boolean {
    const target = this.scoreModel.offsetTargetOf(noteId)
    if (!target) return false
    if (!this.scoreModel.clearNoteOffset(target.key)) return false
    this.saveOnly('Reset note offset')
    dbg(`[Note] reset offset ${noteId} (key ${target.key})`)
    return true
  }

  /** The note's current horizontal offset in staff-spaces (0 when none). The absolute value the
   *  Properties input reads and steps from; `NoteOffsetController` turns a new absolute into the
   *  facade's relative `nudgeNoteOffset(dx = new − current)`. Read at the same key the nudge writes
   *  ({@link ScoreModel.offsetTargetOf}) — a member must be told its OWN number, not its owner's. */
  getNoteOffset(noteId: string): number {
    const target = this.scoreModel.offsetTargetOf(noteId)
    if (!target) return 0
    return noteOffsetOverrideOf(this.scoreModel.getScore(), target.key)?.x ?? 0
  }

  /** The compartment key a note's horizontal offset lives at, and which fan member (0 = none) it
   *  names — exposed so the Properties seam and the renderer resolve the address exactly as the
   *  nudge does. See {@link ScoreModel.offsetTargetOf}. */
  offsetTargetOf(noteId: string): { key: string; memberIndex: number } | undefined {
    return this.scoreModel.offsetTargetOf(noteId)
  }

  /**
   * The durable `staffSystemSpacingKey` for staff `staffIndex` on the system that currently
   * contains `measureNumber`. Resolves the system via the last render's layout (per-system,
   * plan option C) and maps its opening measure NUMBER → durable id. Returns undefined when the
   * index has no staff or the system isn't laid out (score not yet rendered). Also returns the
   * `openingMeasureId` and `staffId` so callers can resolve/fall back without re-deriving them.
   *
   * **Null in linear view, always** — and that one line is the whole safety layer of
   * docs/linear-view-plan.md §4.1. This key is a *system* address, and linear view's single
   * system opens at measure 1: resolving it here would hand every caller the key of wrapped
   * view's first system, so a staff drag in linear view would silently rewrite the wrapped
   * layout. Since every staff-spacing path (nudge / reset / preview / the drag's baseline read)
   * comes through this one resolver, refusing here refuses all of them at the source — the UI
   * gates on top are convenience, not the guard.
   */
  private staffSpacingTarget(staffIndex: number, measureNumber: number):
    { key: string; staffId: string; openingMeasureId: string } | null {
    if (this.viewMode === 'linear') return null
    const staffId = staffIdAtIndex(this.scoreModel.getScore(), staffIndex)
    if (!staffId) return null
    const openerNum = this.renderer.getSystemOpeningMeasureNumber(measureNumber)
    if (openerNum === undefined) return null
    const openingMeasureId = this.scoreModel.getMeasure(openerNum)?.id
    if (!openingMeasureId) return null
    return { key: staffSystemSpacingKey(staffId, openingMeasureId), staffId, openingMeasureId }
  }

  /**
   * Clamp a requested space-above so shrinking can't collide the staff/system with the one
   * above it. `above` is an offset from the default stride, and every consecutive gap is that
   * stride plus `above·ss`, so a single lower bound on `above` floors every gap at once. No upper
   * bound — you can widen freely. See docs/staff-spacing-plan.md and `layout/staffStride`.
   *
   * ⚠️ **Two staves' sizes, and they are different staves.** The gap this `above` controls sits
   * between staff `staffIndex` and the one ABOVE it: it is the upper staff's ink you would collide
   * with (so the floor comes from *its* size), while `above` itself is authored in the dragged
   * staff's own spaces. The top staff of a system has no staff above it inside the system — that
   * gap runs to the previous system's last staff — so it floors against its own, which is exactly
   * what every staff did while there was one size. See docs/staff-size-plan.md §5.
   *
   * ⭐ **Unless that system opens a PAGE, where there is no staff above it at all** — only the
   * sheet's top margin, which `above = 0` already sits against. A collision floor prices ink you
   * could bump into; here the thing above is paper, so the floor is 0 and the music cannot be
   * dragged off the top of the page (`MIN_SPACING_ABOVE_AT_PAGE_TOP`). That is a casting-off fact,
   * so it is asked of the last render — and answered `false` before there is one, which only ever
   * loosens the clamp back to what it was.
   */
  private clampSpacingAbove(above: number, staffIndex: number, measureNumber: number): number {
    const score = this.scoreModel.getScore()
    const sizeOf = (index: number): number => {
      const id = staffIdAtIndex(score, index)
      return id ? resolveStaffSize(score, id) : 1
    }
    const atPageTop = staffIndex === 0 && this.renderer.systemOpensPage(measureNumber)
    const floor = atPageTop
      ? MIN_SPACING_ABOVE_AT_PAGE_TOP
      : minSpacingAboveSpaces(sizeOf(Math.max(0, staffIndex - 1)), sizeOf(staffIndex))
    return Math.max(above, floor)
  }

  // ---- Linear view's staff-spacing VIEW KNOB (docs/linear-view-plan.md §4.2b) ----

  /**
   * Space above each staff *as you are currently looking at it in linear view*, keyed by staffId,
   * in staff-spaces. A **view knob**, not an override: pulling two staves closer together to read
   * them while you work is a viewing decision, in the same family as scroll and zoom. So it lives
   * here on the engine beside {@link viewMode} — **never in `score`, never in
   * `engravingOverrides`, never in `toJSON`, and never in an undo snapshot.** It is ephemeral:
   * gone on reload, and invisible to wrapped view.
   *
   * This is emphatically NOT the forbidden `score.linearStaffSpacing` (§4.4). That ban is on a
   * second set of *persisted* overrides sitting beside the wrapped ones — a hand-rolled second
   * layout. Nobody would call `zoom` an override, and this is the same category.
   *
   * ⚠️ The line to hold: **the moment this must survive a reload it stops being a view knob** and
   * belongs in a real layout scope (§7) — not in a field on Score. That wish will arrive dressed
   * as a convenience; it is exactly the trap §4.4 exists to catch.
   */
  private linearStaffSpacing = new Map<string, number>()

  /** Push the knob down to the renderer, which needs it on every linear-view draw. */
  private syncLinearStaffSpacing(): void {
    this.renderer.setLinearStaffSpacing(new Map(this.linearStaffSpacing))
  }

  /** The staffId the spacing gestures act on, or null if the index has no staff. */
  private staffIdForSpacing(staffIndex: number): string | null {
    return staffIdAtIndex(this.scoreModel.getScore(), staffIndex) ?? null
  }

  /**
   * Nudge the space above staff `staffIndex` on the system containing `measureNumber` by
   * `delta` staff-spaces, saving ONE undo step (Shift+↑/↓ fine / Alt+↑/↓ coarse — see
   * docs/staff-spacing-plan.md). Per-system (plan option C): the tweak is keyed to that system's
   * opening measure. Accumulates onto the currently-shown value (per-system, else the global
   * fallback) so nudging is continuous even over a global default. Clears at 0.
   *
   * In LINEAR view it moves the {@link linearStaffSpacing} view knob instead — same gesture, and
   * deliberately **no undo entry**, because nothing about the score changed. @returns true.
   */
  nudgeStaffSpacing(staffIndex: number, measureNumber: number, delta: number): boolean {
    if (this.viewMode === 'linear') {
      const staffId = this.staffIdForSpacing(staffIndex)
      if (!staffId) return false
      const above = this.clampSpacingAbove(this.getStaffSpacingAbove(staffIndex, measureNumber) + delta, staffIndex, measureNumber)
      this.linearStaffSpacing.set(staffId, above)
      this.syncLinearStaffSpacing()
      dbg(`[Staff/linear] ${delta > 0 ? '↓' : '↑'} view spacing above staff ${staffIndex} by ${delta} → ${above} ss (view only, not saved)`)
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    const above = this.clampSpacingAbove(resolveStaffSpacingAbove(this.scoreModel.getScore(), t.staffId, t.openingMeasureId) + delta, staffIndex, measureNumber)
    this.scoreModel.setStaffSpacing(t.key, above) // absolute; clears at 0
    this.saveOnly('Nudge staff spacing')
    dbg(`[Staff] ${delta > 0 ? '↓' : '↑'} space above staff ${staffIndex} @sys(${t.openingMeasureId}) by ${delta} → ${above} ss`)
    return true
  }

  /**
   * Reset staff `staffIndex` to default spacing on the system containing `measureNumber`
   * (Layout → Reset Space Above): drops that system's per-system override and saves ONE undo
   * step. Per-system, keyed like {@link nudgeStaffSpacing}. This is the write path a future
   * "Reset spacing" palette button / keybinding calls; nudging/dragging to 0 clears it too.
   * @returns true if an override was removed (false when there was nothing to reset).
   */
  resetStaffSpacing(staffIndex: number, measureNumber: number): boolean {
    if (this.viewMode === 'linear') {
      const staffId = this.staffIdForSpacing(staffIndex)
      if (!staffId || !this.linearStaffSpacing.has(staffId)) return false
      this.linearStaffSpacing.delete(staffId)
      this.syncLinearStaffSpacing()
      dbg(`[Staff/linear] reset view spacing above staff ${staffIndex}`)
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    const removed = this.scoreModel.resetStaffSpacing(t.key)
    if (removed) {
      this.saveOnly('Reset staff spacing')
      dbg(`[Staff] reset space above staff ${staffIndex} @sys(${t.openingMeasureId})`)
    }
    return removed
  }

  /**
   * The space above staff `staffIndex` on the system containing `measureNumber`, in staff-spaces
   * — the drag reads this as its baseline at grab time.
   *
   * Wrapped: the per-system value, else the global fallback, else 0.
   * Linear: the view knob, else the **global** value (a content-keyed engraving fact, so it is
   * honoured here — see §4.2), else 0. Never the per-system value, which is a layout artifact of
   * the wrapped casting-off and means nothing in a view with one system.
   */
  getStaffSpacingAbove(staffIndex: number, measureNumber: number): number {
    if (this.viewMode === 'linear') {
      const staffId = this.staffIdForSpacing(staffIndex)
      if (!staffId) return 0
      const knob = this.linearStaffSpacing.get(staffId)
      if (knob !== undefined) return knob
      return resolveStaffSpacingAbove(this.scoreModel.getScore(), staffId, undefined)
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return 0
    return resolveStaffSpacingAbove(this.scoreModel.getScore(), t.staffId, t.openingMeasureId)
  }

  /** Live (preview) staff-spacing update used **while dragging** — sets the absolute space
   *  above staff `staffIndex` on the system containing `measureNumber` (per-system) but does NOT
   *  record undo. Call {@link commitStaffSpacing} on drop for the single undo entry (mirrors
   *  `previewSlurShape` / `commitSlurShape`). In LINEAR view it drives the view knob instead, and
   *  there is nothing to commit. @returns true if a staff was updated. */
  previewStaffSpacing(staffIndex: number, measureNumber: number, above: number): boolean {
    // Live drag, undo deferred to commitStaffSpacing — see previewSlurShape. (The linear branch
    // below writes the view knob, which the view-state key already covers; flagging both is
    // harmless and keeps the rule "a preview marks dirty" without an exception.)
    this.markModelDirty()
    if (this.viewMode === 'linear') {
      const staffId = this.staffIdForSpacing(staffIndex)
      if (!staffId) return false
      this.linearStaffSpacing.set(staffId, this.clampSpacingAbove(above, staffIndex, measureNumber))
      this.syncLinearStaffSpacing()
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    return this.scoreModel.setStaffSpacing(t.key, this.clampSpacingAbove(above, staffIndex, measureNumber))
  }

  /** Record one undo entry after a staff-spacing drag settles. A no-op in linear view: the drag
   *  moved a view knob, not the score, so there is nothing to undo. */
  commitStaffSpacing(): void {
    if (this.viewMode === 'linear') return
    this.commitPreviewed('Adjust staff spacing')
  }

  /**
   * Toggle whether a selected rest is hidden (the Sibelius-style Ctrl+Shift+H — see
   * docs/rest-hide-plan.md). Resolves the rest id to its position address (the override is
   * position-keyed, since rests have no durable id) and delegates the set/clear to the model.
   * A no-op for a non-rest / missing id.
   *
   * **It must call `saveUndoState`, even though the surrounding batch owns the actual snapshot.**
   * It used to skip it, reasoning that the multi-rest `runBatch` in the shortcut handler would push
   * the one snapshot for the group. That was circular: `runBatch` decides whether `fn` did anything
   * by *counting `saveUndoState` requests*, so an operation that mutates without asking to be saved
   * is invisible to it. The batch concluded nothing had happened, never called `saveUndoState`, and
   * therefore never called `markModelDirty()` — so the hide landed in the model but the next render
   * was skipped as "nothing changed", and no undo entry was pushed either.
   *
   * Calling it here is not a double-snapshot: inside a batch, `saveUndoState` marks the model dirty
   * and counts the request, then returns WITHOUT pushing (see its own note). Outside a batch — a
   * lone toggle — pushing is exactly right.
   *
   * @returns true if a rest was toggled.
   */
  /**
   * Say whether the meter change at `measureNumber` allows a courtesy time signature — Sibelius's
   * *Allow cautionary*. Half the rule; the other half is whether that change opens a system, which
   * only the layout knows (MeasureLayout).
   *
   * `saveOnly`: nothing audible changes — the meter, the bars and the playback are identical either
   * way, and only the engraving differs.
   * @returns true if the stored state changed.
   */
  setCautionaryAllowed(measureNumber: number, allowed: boolean): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    const changed = this.scoreModel.setCautionaryAllowed(measure.id, allowed)
    if (changed) this.saveOnly(allowed ? 'Allow cautionary time signature' : 'No cautionary time signature')
    return changed
  }

  /**
   * Say whether the clef change at `measureNumber` on `staff` allows a courtesy clef at the end of
   * the previous system — the clef twin of {@link setCautionaryAllowed}, and half the rule: the
   * other half is whether that change opens a system, which only the layout knows.
   *
   * `saveOnly`: the clef, the pitches and the playback are identical either way; only the engraving
   * differs.
   * @returns true if the stored state changed.
   */
  setCautionaryClefAllowed(measureNumber: number, staff: number, allowed: boolean): boolean {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return false
    const changed = this.scoreModel.setCautionaryClefAllowed(measure.id, this.staffIdForIndex(staff), allowed)
    if (changed) this.saveOnly(allowed ? 'Allow cautionary clef' : 'No cautionary clef')
    return changed
  }

  toggleRestHidden(restId: string): boolean {
    const note = this.scoreModel.getNote(restId)
    if (!note || !note.isRest) return false
    const measure = this.scoreModel.getMeasure(note.measure)
    if (!measure) return false
    const key = restPositionKey(measure.id, voiceOf(note), note.beat, this.staffIdForIndex(note.staff))
    const nowHidden = !restHiddenOf(this.scoreModel.getScore(), key)
    this.scoreModel.toggleRestHidden(key)
    this.saveUndoState(`${nowHidden ? 'Hide' : 'Show'} rest`)
    dbg(`[Rest] ${nowHidden ? 'hide' : 'show'} rest ${restId} (${key})`)
    return true
  }

  /** Nudge one OPEN join of a cross-system slur by a staff-space delta and save ONE undo step
   *  (the keyboard fine-positioning for the orange segment-endpoint squares — see
   *  docs/multisystem-slur-segment-endpoint-offset-plan.md). `spanCount` is the live system
   *  count at the time of the edit (the override's reset signature). */
  nudgeSlurSegmentEndpoint(id: string, address: SlurSegmentEndpointAddress, dx: number, dy: number, spanCount: number): boolean {
    if (!this.nudgeStaysOnPage('slur', id, dx, dy)) return false
    const ok = this.scoreModel.setSlurSegmentEndpointOffset(id, address, dx, dy, spanCount)
    if (ok) this.saveOnly('Nudge slur segment endpoint')
    return ok
  }

  /** Flip a slur with a Sibelius-style `x` toggle: auto ↔ flipped. When the slur already
   *  carries an explicit `placement`, clear it back to the context-aware auto default;
   *  otherwise set an explicit side opposite to whatever was last *drawn* (read from the
   *  registry), so the first press always visibly flips. Two presses round-trip to auto.
   *  Saves one undo step. @returns true if it flipped. */
  flipSlur(id: string): boolean {
    const slur = this.scoreModel.getSlurById(id)
    if (!slur) return false
    if (slur.placement !== undefined) {
      // Overridden → return to the auto (stem-derived) default.
      delete slur.placement
      this.saveOnly('Reset slur to auto')
      return true
    }
    // Auto → pin the opposite of the last-drawn side. Guarded so a stubbed/headless
    // renderer just falls back to "above" (dir -1).
    const el = this.renderer.getElementRegistry?.()?.getByType?.('slur').find(e => e.id === id)
    const currentDir = el?.slurDirection ?? -1
    slur.placement = currentDir === -1 ? 'below' : 'above'
    this.saveOnly('Flip slur')
    return true
  }

  /** Flip a tuplet's bracket/number with a Sibelius-style `x` toggle: auto ↔ flipped. When
   *  the tuplet already carries an explicit `placement`, clear it back to the context-aware
   *  auto default (voice/stem rule); otherwise set an explicit side opposite to whatever was
   *  last *drawn* (read from the registry), so the first press always visibly flips. Two
   *  presses round-trip to auto. Saves one undo step. @returns true if it flipped. */
  flipTuplet(id: string): boolean {
    const tuplet = this.scoreModel.getTuplet(id)
    if (!tuplet) return false
    if (tuplet.placement !== undefined) {
      // Overridden → return to the auto (voice/stem-derived) default.
      this.scoreModel.setTupletPlacement(id, undefined)
      this.saveOnly('Reset tuplet to auto')
      return true
    }
    // Auto → pin the opposite of the last-drawn side. Guarded so a stubbed/headless
    // renderer just falls back to "above" (LOCATION_TOP = 1).
    const el = this.renderer.getElementRegistry?.()?.getTupletById?.(id)
    const currentDir = el?.tupletGeometry?.location ?? 1
    this.scoreModel.setTupletPlacement(id, currentDir === 1 ? 'below' : 'above')
    this.saveOnly('Flip tuplet')
    return true
  }

  /** Flip the tie starting at `fromNoteId` with a Sibelius-style `x` toggle: auto ↔ flipped.
   *  A tie stays flat and notehead-anchored, so this only inverts the arc (and its endpoint
   *  lift), unlike {@link flipSlur} which is stem-aware. When the tie already carries an
   *  explicit `tieDirection`, clear it back to the auto default; otherwise set an explicit
   *  direction opposite to whatever was last *drawn* (read from the registry), so the first
   *  press always visibly flips. Two presses round-trip to auto. Saves one undo step.
   *  @returns true if it flipped. */
  flipTie(fromNoteId: string): boolean {
    const pitch = this.scoreModel.getNotePitch(fromNoteId)
    if (!pitch || !pitch.tiedTo) return false
    if (pitch.tieDirection !== undefined) {
      // Overridden → return to the auto default.
      this.scoreModel.clearTieDirection(fromNoteId)
      this.saveOnly('Reset tie to auto')
      return true
    }
    // Auto → pin the opposite of the last-drawn side. Guarded so a stubbed/headless
    // renderer just falls back to "down" (+1).
    const el = this.renderer.getElementRegistry?.()?.getByType?.('tie').find(e => e.fromNoteId === fromNoteId)
    const currentDir = el?.tieDirection ?? 1
    if (!this.scoreModel.setTieDirection(fromNoteId, currentDir === -1 ? 1 : -1)) return false
    this.saveOnly('Flip tie')
    return true
  }

  /**
   * Re-anchor or drop every slur referencing `oldId` (a deleted/replaced head):
   *  - `newId` given → re-point the anchor (e.g. to a surviving chord sibling, or
   *    to the rest that replaced a deleted single note — like the tie re-link).
   *  - `newId === null` → drop the slur (no surviving anchor).
   * A re-anchor that collapses the span (start === end) drops the slur too.
   * Mutates the live score in place; the caller owns the surrounding undo step.
   *
   * Both outcomes provably break any hand-tuned shape (plan §3.3): a drop ends the
   * slur, a re-point moves an endpoint onto a *different* element — so the
   * engraving-overrides auto-reset fires here too (drop → clear all; re-point → clear
   * the span-relative `curveShape`), matching {@link ScoreModel.setSlurEndpoint}.
   */
  private reanchorSlurs(oldId: string, newId: string | null): void {
    const slurs = this.scoreModel.getScore().slurs
    if (!slurs) return
    for (let i = slurs.length - 1; i >= 0; i--) {
      const s = slurs[i]
      if (s.startNoteId !== oldId && s.endNoteId !== oldId) continue
      if (newId === null) {
        slurs.splice(i, 1)
        this.scoreModel.clearEngravingOverride(s.id) // auto-reset (§3.3): no surviving anchor → slur dropped
        continue
      }
      if (s.startNoteId === oldId) s.startNoteId = newId
      if (s.endNoteId === oldId) s.endNoteId = newId
      if (s.startNoteId === s.endNoteId) {
        slurs.splice(i, 1)
        this.scoreModel.clearEngravingOverride(s.id) // auto-reset (§3.3): re-anchor collapsed the span → dropped
      } else {
        this.scoreModel.clearEngravingOverride(s.id, 'curveShape') // auto-reset (§3.3): endpoint re-pointed onto a different element
      }
    }
  }

  /**
   * The next slot after `start` whose `(measure, beat)` differs from it — i.e. the
   * next musical event, skipping sibling chord heads that share `start`'s beat.
   * `getAllNotes()` emits one entry per pitch, hence the dedupe.
   */
  /**
   * ⭐ Order two notes for a SPAN — by position, and INSIDE a fan by member index.
   *
   * ⚠️ Position alone cannot order members: every one reports the SLOT's beat (deliberately — that
   * is what keeps `pixelXToBeat` seeing one column), so `compareByPosition` calls them simultaneous
   * and the sort keeps whatever order they were CLICKED in. A slur built from that is drawn
   * backwards — right head to left head — which is exactly as broken as it sounds, and only when
   * you happened to select the later member first.
   */
  private compareForSpan(a: Note, b: Note): number {
    const byPosition = compareByPosition(a, b)
    if (byPosition !== 0) return byPosition
    const ia = this.scoreModel.fanMemberIndexOf(a.id)
    const ib = this.scoreModel.fanMemberIndexOf(b.id)
    return ia !== null && ib !== null ? ia - ib : 0
  }

  private nextDistinctSlot(start: Note): Note | undefined {
    // ⭐ Inside a FAN, "the next thing" is the next MEMBER (his ask).
    //
    // ⚠️ Including from the note you TYPED — it is member 0, not a thing standing outside the group,
    // so `s` on it slurs to member 1. (I first restricted this to members proper, reasoning that the
    // typed note means "the whole event"; it does not, once you are working member by member.) To
    // slur a fan to something outside it, select BOTH ends — that path never asks this question.
    let walkFromId = start.id
    const group = this.scoreModel.fanMembersOfSlot(start.id)
    if (group) {
      const at = this.scoreModel.fanMemberIndexOf(start.id) ?? -1
      if (at >= 0 && at + 1 < group.length) return group[at + 1]
      // The LAST member slurs OUT of the fan — and it has to walk on from the SLOT, since the flat
      // note list has no entry for a member to find itself in.
      walkFromId = group[0]?.id ?? start.id
    }
    // Stay within the start note's own voice AND staff — a slur's end anchor must be the
    // next slot in the SAME stream, not whatever event comes next in another voice/staff.
    const startVoice = voiceOf(start)
    const startStaff = staffOf(start)
    const sorted = this.scoreModel.getAllNotes()
      .filter(n => voiceOf(n) === startVoice && staffOf(n) === startStaff)
      .sort(compareByPosition)
    const idx = sorted.findIndex(n => n.id === walkFromId)
    if (idx < 0) return undefined
    for (let i = idx + 1; i < sorted.length; i++) {
      if (sorted[i].measure !== start.measure || !fracEq(sorted[i].beat, start.beat)) return sorted[i]
    }
    return undefined
  }

  /** All phrasing slurs (live array; empty if none). */
  getSlurs(): Slur[] {
    return this.scoreModel.getSlurs()
  }

  /** Find a slur anywhere by id (live reference), or null. */
  getSlurById(id: string): Slur | null {
    return this.scoreModel.getSlurById(id)
  }

  // --- Query & Deletion ---

  /**
   * Get a note by ID
   */
  getNote(noteId: string): Note | undefined {
    return this.scoreModel.getNote(noteId)
  }

  /**
   * The note's ACTUAL beam role (begin/continue/end/single), computed from the engraved grouping —
   * the fact `getNote().beam` cannot give you, since that reports only what was authored and is
   * absent (`auto`) on every note nobody has touched.
   */
  getBeamRole(noteId: string): BeamRole | null {
    return this.scoreModel.getBeamRole(noteId)
  }

  /**
   * The alteration (sharp/flat/natural) in effect for a note's staff position from
   * running accidentals earlier in its measure — i.e. what the note would sound as
   * if it carried no explicit accidental. Returns 0 when nothing earlier altered it.
   *
   * Mirrors the renderer's running-accidental logic (NoteBuilder): only preceding,
   * non-tied notes on the same diatonic position count; key signature is not folded
   * in (VexFlow draws those separately). Used by "remove accidental" so the note
   * reverts to the prevailing alteration and its sign disappears.
   */
  getPrevailingAlter(noteId: string): PitchAlter {
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest || note.step === undefined || note.octave === undefined) return 0
    const measure = this.scoreModel.getScore().measures.find(m => m.number === note.measure)
    if (!measure) return 0
    const targetPos = spellingDiatonicPos(note.step, note.octave)
    // A FANNED member alters its position for the rest of the bar too, so the list includes them
    // (docs/fanned-beam-pitches-plan.md §2) — `getMeasureNotes` alone would answer "nothing in force"
    // for a bar whose only sharp is inside a fan.
    return prevailingAlterAt(measureAccidentalNotes(measure), targetPos, note.beat)
  }

  /**
   * Set a note's accidental to `accidental` (sharp/flat/natural), changing its pitch. Shared by the
   * palette's "apply to selected note" path and the accidental STAMP tool, so both re-spell a note
   * identically. Mirrors the non-null branches of `PaletteController.setAccidental`:
   *  - `n`: revert to natural (alter 0). A ♮ that cancels an earlier sharp/flat in the bar shows
   *    automatically; a courtesy natural (nothing to cancel) must be FORCED to appear.
   *  - `#`/`b`: alter ±1. If the note already sits at that alteration the sign would auto-hide, so
   *    force it (re-showing a required accidental).
   * Removal ("no accidental") is NOT handled here — that reverts to the prevailing alteration and
   * lives in the palette's null branch / the Delete key. Returns the updated Note, or null on miss.
   */
  setNoteAccidental(noteId: string, accidental: Accidental): Note | null {
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null
    if (accidental === 'n') {
      const wouldAutoShow = this.getPrevailingAlter(noteId) !== 0
      return this.updateNote(noteId, { alter: 0, forceAccidental: wouldAutoShow ? undefined : true })
    }
    const newAlter: PitchAlter = accidental === '#' ? 1 : -1
    const forceAccidental = note.alter === newAlter ? true : undefined
    return this.updateNote(noteId, { alter: newAlter, forceAccidental })
  }

  /**
   * Whether `note` already DISPLAYS `accidental` — used by the stamp tool for its idempotency check
   * (clicking a note that already has that accidental does nothing). Sharp/flat is a pure alter
   * match; a natural counts as "already there" only when its sign is actually visible (a required ♮
   * cancelling an earlier accidental, or a forced courtesy ♮) — a plain natural note with no sign
   * does NOT, so stamping ♮ on it still forces the courtesy sign to appear.
   */
  noteDisplaysAccidental(noteId: string, accidental: Accidental): boolean {
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return false
    if (accidental === '#') return note.alter === 1
    if (accidental === 'b') return note.alter === -1
    // natural: only if a sign is currently drawn (prevailing cancels it, or it's forced)
    return note.alter === 0 && (this.getPrevailingAlter(noteId) !== 0 || note.forceAccidental === true)
  }

  /**
   * The rest STAMP's click: place a rest of the ARMED length at the clicked position. Returns the
   * new rest, or null if nothing could be placed there.
   *
   * POSITION-based, like note entry with the mouse — not a hit-test on a glyph. You click a place in
   * the bar and the rest goes there, replacing whatever it covers; you do not have to find and hit
   * the existing rest. (It was built the other way first, off `findClosestNoteOrRest`, and it made
   * the tool nearly unusable: every click in open space reported "not on a note or rest — no change"
   * and only a direct hit on the default rest did anything.)
   *
   * The sibling of {@link convertToRest}, and the difference is whose length wins. Convert is an
   * EDIT of what is there ("this same length, but silent"); the stamp PLACES a length of its own
   * ("a half rest, here"), so it goes through note entry — which is exactly what it is, with
   * `isRest`. See {@link NoteEntryCoordinator.addRestAtPosition}.
   */
  stampRestAtPosition(coords: PixelCoordinates, duration: NoteDuration, dots: number, voice: NoteParams['voice'] = 0): Note | null {
    return this.noteEntryCoordinator.addRestAtPosition(coords, duration, dots, voice)
  }

  /**
   * Silence the slot holding `noteId`: it becomes a rest of its OWN duration, keeping its beat,
   * dots, tuplet membership, voice and staff. Returns the new rest, or null if nothing changed.
   *
   * Not a delete. Delete says "this shouldn't be here" and leaves a gap for the meter-aware fill to
   * re-decide; this says "this lasts exactly as long, but silent", so the length is preserved rather
   * than re-derived (see {@link ScoreModel.convertToRest}). The two agree on a plain note in a plain
   * bar, which is why they look alike — they part company on a dotted note, a tuplet member, or a
   * chord, where the fill would answer a question it was never asked.
   *
   * The returned rest carries a NEW id (a rest is a different slot, not a re-typed one), so every
   * anchor to the old head must move: slurs re-anchor here, ties inside the model. Callers wanting
   * it selected use the returned id — the point of returning the rest rather than a boolean.
   */
  convertToRest(noteId: string): Note | null {
    if (this.refusesFanMember(noteId, 'convert to rest')) return null
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    // BEFORE the swap: once the slot is a rest there are no heads left to find.
    const pitchIds = this.slotPitchIdsFor(note, noteId)

    const rest = this.scoreModel.convertToRest(noteId)
    if (!rest) return null

    // Slurs anchored to ANY head of the old slot follow it onto the rest — the slot is still there
    // and still has a length, so the arc still has something to hang on.
    for (const id of pitchIds) this.reanchorSlurs(id, rest.id)

    // Silencing the last note of a secondary voice leaves it all rests → it collapses, exactly as
    // after a delete (Sibelius-style).
    this.scoreModel.collapseEmptyVoices(note.measure)

    const label = !note.isRest && note.step
      ? `Convert ${midiToNoteName(spellingToMidi(note.step, note.alter ?? 0, note.octave!))} to rest`
      : 'Convert to rest'
    this.commit(label)
    return this.scoreModel.getNote(rest.id) ?? null
  }

  /** Every pitch id sharing `note`'s slot — its chord siblings and itself. Scoped to the note's own
   *  (voice, staff) via {@link getChordNotesAt}: two staves holding a note at the same beat in voice 0
   *  is ordinary, not a chord, and re-anchoring the OTHER staff's slurs onto this rest would be a real
   *  bug. `noteId` is appended defensively so the note being converted is always covered. */
  private slotPitchIdsFor(note: Note, noteId: string): string[] {
    const ids = this.getChordNotesAt(note.measure, note.beat, voiceOf(note), staffOf(note))
      .map(n => n.id)
    return ids.includes(noteId) ? ids : [...ids, noteId]
  }

  /**
   * Delete a note
   * If the note is part of a chord, just remove it from the chord.
   * If it's a single note, replace it with a rest of the same duration.
   */
  deleteNote(noteId: string): boolean {
    // Get note info before deleting for undo description
    const note = this.scoreModel.getNote(noteId)
    if (!note) return false

    const description = !note.isRest && note.step
      ? `Delete ${midiToNoteName(spellingToMidi(note.step, note.alter ?? 0, note.octave!))}`
      : 'Delete rest'

    // ⭐ A FANNED MEMBER deletes as a MEMBER, and must never reach the slot bookkeeping below: the
    // model takes the pitch out (and the member with it, when it was the last one — the group is one
    // shorter), while everything after this is about a SLOT leaving the bar. A member reports the
    // slot's beat, so `getChordNotesAt` would answer for the OWNER's chord — one note — and the
    // "single note becomes a rest" branch would drop a rest into a bar that still has its event in
    // it. Nothing here is a guard: each line below is simply a different edit.
    //
    // A slur can anchor to a member, so one that just lost its anchor is dropped — but only when the
    // whole MEMBER went. Losing one pitch of a member that has others leaves the anchor standing.
    if (this.scoreModel.isFanMember(noteId)) {
      const wholeMember = (this.scoreModel.fanMemberPitches(noteId)?.length ?? 0) <= 1
      if (!this.scoreModel.deleteNote(noteId)) return false
      if (wholeMember) this.reanchorSlurs(noteId, null)
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState(description)
      return true
    }

    // Check if this note is part of a chord (multiple notes at same beat, same voice, same staff)
    const notesAtSameBeat = this.getChordNotesAt(note.measure, note.beat, voiceOf(note), staffOf(note))
    const isPartOfChord = notesAtSameBeat.length > 1

    // Save EVERY tie that targets this note before deletion clears them. When a single
    // note is replaced by a rest, we re-link each source tie onto the new rest so the
    // tie survives the delete (the owner of the tie is the source, not the target) and
    // simply re-points to the rest. Scan-based (not the note's single `tiedFrom`) so a
    // chord tied into this note keeps every arc, and no tie is left dangling.
    const tieSourceIds = !note.isRest && !isPartOfChord
      ? this.scoreModel.getAllNotes().filter(n => !n.isRest && n.tiedTo === noteId).map(n => n.id)
      : []

    // A surviving chord sibling (if any) to re-anchor dependent slurs onto.
    const slurSiblingId = isPartOfChord
      ? notesAtSameBeat.find(n => n.id !== noteId)?.id
      : undefined

    // Delete the note
    const result = this.scoreModel.deleteNote(noteId)

    // If it's a single note (not a chord), replace with a rest of the same duration
    if (result && !isPartOfChord && !note.isRest) {
      const replacementRest = this.scoreModel.addNote({
        duration: note.duration,
        measure: note.measure,
        beat: note.beat,
        isRest: true,
        dots: note.dots,
        tupletId: note.tupletId, // Preserve tuplet membership
        ...(note.voice && { voice: note.voice }), // keep the rest in the note's own voice
      })

      // Re-point every tie that targeted the deleted note onto the replacement rest,
      // so deleting a tie's target reassigns the tie instead of dropping it. (The rest
      // records one `tiedFrom` for bookkeeping; the arcs themselves are owned by the
      // source notes' `tiedTo`, which all now point at the rest.)
      if (replacementRest && tieSourceIds.length) {
        for (const sid of tieSourceIds) {
          this.scoreModel.updateNote(sid, { tiedTo: replacementRest.id })
        }
        this.scoreModel.updateNote(replacementRest.id, { tiedFrom: tieSourceIds[0] })
      }
      // A slur anchored to this head follows the note onto its replacement rest
      // (the rest gets a NEW id), or is dropped if the rest couldn't be placed.
      if (result) this.reanchorSlurs(noteId, replacementRest?.id ?? null)
    } else if (result && isPartOfChord) {
      // Chord head removed but the chord survives — re-anchor slurs to a sibling head.
      this.reanchorSlurs(noteId, slurSiblingId ?? null)
    } else if (result && !isPartOfChord && note.isRest && !note.tupletId) {
      // Standalone rest deleted without replacement — re-fill the measure to close the gap
      this.scoreModel.repairMeasureGaps(note.measure)
      this.reanchorSlurs(noteId, null) // the rest anchor is gone — drop dependent slurs
    } else if (result && !isPartOfChord && note.isRest && note.tupletId) {
      // Rest inside a tuplet deleted — fill the empty gap it left behind
      const measure = this.scoreModel.getMeasure(note.measure)
      const tuplet = measure?.tuplets?.find(t => t.id === note.tupletId)
      if (tuplet) this.scoreModel.refillTupletRemainder(note.measure, tuplet, voiceOf(note))
      this.reanchorSlurs(noteId, null)
    }

    // If that deletion emptied a secondary voice (no notes left, only rests), drop it
    // so the bar reverts to a single voice (Sibelius-style collapse).
    if (result) this.scoreModel.collapseEmptyVoices(note.measure)

    this.playbackEngine.setScore(this.scoreModel.getScore())
    if (result) {
      this.saveUndoState(description)
    }
    return result
  }

  /**
   * Move a single note's pitch into another voice, preserving its id so ties,
   * slurs, articulations and the live selection stay anchored (move-note-to-voice
   * plan, Phase 1). Plain notes only for now — tuplet members are deferred.
   * Commits (sync playback + undo, marks the model dirty); the caller re-renders,
   * and the render loop repairs/regroups. Returns true if it moved.
   */
  moveNoteToVoice(pitchId: string, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
    const moved = this.scoreModel.moveNoteToVoice(pitchId, targetVoice, movingIds)
    if (moved) this.commit(`Move note to voice ${targetVoice + 1}`)
    return moved
  }

  /**
   * Move several notes' pitches into a voice as ONE atomic, single-undo action
   * (move-note-to-voice plan, Phase 3). Notes are processed in a stable order
   * (measure, then beat) so chord-merge "shorter wins" is deterministic; each
   * per-note move skips no-ops and rests itself. Ids are preserved, so the
   * caller's selection stays valid (just re-render). Returns true if anything
   * actually moved.
   */
  moveSelectionToVoice(pitchIds: string[], targetVoice: number): boolean {
    const ordered = pitchIds
      .map(id => ({ id, note: this.scoreModel.getNote(id) }))
      .filter((x): x is { id: string; note: Note } => !!x.note)
      .sort((a, b) => compareByPosition(a.note, b.note))

    // The full set of moving pitch ids — so a tie/slur whose BOTH ends are in the
    // selection survives the move (its partner is moving to the same voice too).
    const movingIds = new Set(ordered.map(o => o.id))

    // A beamed-over rest cannot MOVE (rests are per-voice, each voice fills its own), but the flag is
    // the user's intent and must reappear on the target voice's rest at the same beat — else the beam
    // group arrives in the new voice with its interior rest un-beamed. Capture where before the move
    // refills both voices, re-apply after (ScoreModel.setRestBeamOver).
    const beamOverRests = ordered
      .filter(o => o.note.isRest && o.note.beamOver)
      .map(o => ({ measure: o.note.measure, beat: o.note.beat, staff: staffOf(o.note) }))

    // Bars a two-note tremolo could have been torn across — collected BEFORE the move, since a note
    // that leaves takes its bar number with it.
    const touchedMeasures = new Set(ordered.map(o => o.note.measure))

    return this.runBatch(`Move ${ordered.length} note(s) to voice ${targetVoice + 1}`, () => {
      for (const { id } of ordered) this.moveNoteToVoice(id, targetVoice, movingIds)
      for (const r of beamOverRests) this.scoreModel.setRestBeamOver(r.measure, r.beat, targetVoice, r.staff, true)
      // AFTER the loop, never inside it: moving both notes of a pair moves them one at a time, and
      // between the two the pair is invalid. Pruning per note would kill a mark that is about to be
      // whole again in the new voice — which is the whole point of moving both.
      for (const m of touchedMeasures) this.scoreModel.dropStaleTremoloPairs(m)
    })
  }

  /**
   * Clear all notes
   */
  clearAllNotes(): void {
    this.scoreModel.clearAllNotes()
    this.commit('Clear all notes')
  }

  // ==================== Tuplet Operations ====================

  /** Create a tuplet at a pixel position. Delegates to NoteEntryCoordinator. */
  createTupletAtPosition(
    coords: PixelCoordinates,
    duration: NoteDuration,
    spelling: PitchSpelling,
    numNotes: number = 3,
    notesOccupied: number = 2,
    voice: number = 0,
    /** Dots on the tuplet's UNIT — a triplet of DOTTED quarters. */
    dots: number = 0,
    /** The NORMAL side's own note value, when the user named one ("in the time of a QUARTER"). */
    normal?: { duration: NoteDuration; dots?: number; count?: number },
    /** How the group is DRAWN — mark style, bracket, bracket end. Absent = the renderer's rules.
     *  See {@link TupletFormat}. */
    format?: TupletFormat,
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtPosition(coords, duration, spelling, numNotes, notesOccupied, voice, dots, normal, format)
  }

  /**
   * Create a tuplet at a specific beat position (for keyboard entry mode).
   * Delegates to NoteEntryCoordinator.
   */
  createTupletAtBeat(
    measureNumber: number,
    beat: number,
    duration: NoteDuration,
    spelling: PitchSpelling,
    numNotes: number = 3,
    notesOccupied: number = 2,
    voice: number = 0,
    staff: number = 0,
    /** Dots on the tuplet's UNIT — see {@link createTupletAtPosition}. */
    dots: number = 0,
    /** The NORMAL side's own note value — see {@link createTupletAtPosition}. */
    normal?: { duration: NoteDuration; dots?: number; count?: number },
    /** How the group is DRAWN — mark style, bracket, bracket end. Absent = the renderer's rules.
     *  See {@link TupletFormat}. */
    format?: TupletFormat,
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtBeat(measureNumber, beat, duration, spelling, numNotes, notesOccupied, voice, staff, dots, normal, format)
  }

  /**
   * Convert an existing selected note into the first note of a tuplet (for selection mode).
   */
  applyTupletToNote(
    noteId: string,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): { tuplet: Tuplet; note: Note } | null {
    return this.noteEntryCoordinator.applyTupletToNote(noteId, numNotes, notesOccupied)
  }

  /**
   * Delete a tuplet and replace it with a rest
   * @param tupletId - ID of the tuplet to delete
   * @returns true if deleted successfully
   */
  deleteTuplet(tupletId: string): boolean {
    const result = this.scoreModel.deleteTuplet(tupletId)
    if (result) {
      this.commit('Delete triplet')
    }
    return result
  }

  /**
   * Get a tuplet by its ID
   */
  getTuplet(tupletId: string): Tuplet | undefined {
    return this.scoreModel.getTuplet(tupletId)
  }

  /**
   * Get the model voice (0-based) a tuplet belongs to, derived from its slots.
   * Defaults to voice 0 if the tuplet has no slots yet.
   */
  getTupletVoice(tupletId: string): number {
    const notes = this.scoreModel.getNotesInTuplet(tupletId)
    return notes[0]?.voice ?? 0
  }

  /**
   * Get the tuplet at a specific beat position in a measure
   */
  getTupletAtBeat(measureNumber: number, beat: Fraction, voice?: number, staff?: number): Tuplet | undefined {
    return this.scoreModel.getTupletAtBeat(measureNumber, beat, voice, staff)
  }

  /**
   * Toggle stem direction for a note between auto and the opposite of its natural direction.
   * - If already forced (up/down): reset to auto.
   * - If auto: calculate natural direction from pitch, force the opposite.
   * Rests are ignored (no stem).
   */
  flipStemDirection(noteId: string): Note | null {
    // The stem is the GROUP's — one beam, one side — so a member cannot flip it (P2 decided it over
    // every member's pitches). Refused rather than written and ignored.
    if (this.refusesFanMember(noteId, 'stem flip')) return null
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    let newDirection: 'auto' | 'up' | 'down'

    if (note.stemDirection === 'up' || note.stemDirection === 'down') {
      // Already forced — toggle back to auto
      newDirection = 'auto'
    } else {
      // Auto state — force the opposite of the direction actually DISPLAYED. In a
      // multi-voice bar the shown stem is forced by voice PARITY (V1/V3 up, V2/V4 down),
      // NOT the pitch-natural one — so flipping against pitch would target the side the
      // note is already on and do nothing (repro: a low V2/V4 note never flipped). Mirror
      // the renderer's per-staff multiVoice + forcedStem (VexFlowRenderer: stemUp = voice % 2 === 0).
      const staffId = this.staffIdForIndex(note.staff)
      const measure = this.scoreModel.getMeasure(note.measure)
      const multiVoice = measure
        ? new Set(staffSlots(measure, staffId, this.scoreModel.getScore()).map(s => voiceOf(s))).size > 1
        : false
      const displayed: 'up' | 'down' = multiVoice
        ? (voiceOf(note) % 2 === 0 ? 'up' : 'down')
        : naturalStemDirection(note.step!, note.octave!, this.scoreModel.getEffectiveClefAt(note.measure, note.beat, staffId))
      newDirection = displayed === 'down' ? 'up' : 'down'
    }

    const updated = this.scoreModel.updateNote(noteId, { stemDirection: newDirection })
    this.commit('Flip stem direction')
    return updated
  }

  /**
   * Flip a note's articulations with a Sibelius-style `x` toggle: auto ↔ flipped.
   * Default placement is the context-aware auto (voice-aware in multi-voice bars,
   * stem-derived otherwise). When a note already carries an explicit override this
   * clears it back to auto; otherwise it pins the opposite of the current drawn side.
   * Two presses round-trip to auto, so a flipped-then-unflipped mark follows the
   * voice default again when a 2nd voice is added later. No-op for rests / notes with
   * no articulation.
   */
  flipArticulation(noteId: string): Note | null {
    const result = this.scoreModel.flipArticulationPlacement(noteId)
    if (!result) return null
    this.saveOnly('Flip articulation')
    return result
  }

  /**
   * Toggle whether a note's stem-side articulations align to the stem (modern)
   * or the notehead (traditional default). Per-note; only affects marks that land
   * on the stem side. No-op for rests / notes without an articulation.
   */
  setArticulationStemAlign(noteId: string, align: boolean): Note | null {
    const result = this.scoreModel.setArticulationStemAlign(noteId, align)
    if (!result) return null
    this.saveOnly('Align articulation to stem')
    return result
  }

  /**
   * Set — or with `null`, remove — the single-note tremolo on the slot containing `noteId`.
   * Single-valued: a different mark replaces the one there. No-op (null) for a rest.
   *
   * `commit`, not `saveOnly`: a tremolo is an instruction to the PLAYER, so it belongs with the
   * changes that resync playback — even though nothing is scheduled for it until
   * docs/tremolo-plan.md §5 lands. Calling it a display-only flag today would be a thing to
   * remember to change later, and this is the seam that would be silently wrong.
   */
  setTremolo(noteId: string, tremolo: TremoloMark | null): Note | null {
    const result = this.scoreModel.setTremolo(noteId, tremolo)
    if (!result) return null
    this.commit(tremolo === null ? 'Remove tremolo' : `Set tremolo ${tremolo}`)
    return result
  }

  /**
   * Set — or with `false`, remove — the TWO-NOTE tremolo on the slot containing `noteId`: this note
   * and the one after it alternate, and both are drawn at double their written value.
   *
   * Returns null when the pair is refused (`ScoreModel.setTremoloPair` — the §0 list) so the press
   * does nothing, and `commit` for the same reason {@link setTremolo} does: it is an instruction to
   * the player, so it belongs with the changes that resync playback.
   */
  setTremoloPair(noteId: string, on: boolean): Note | null {
    const result = this.scoreModel.setTremoloPair(noteId, on)
    if (!result) return null
    this.commit(on ? 'Two-note tremolo' : 'Remove two-note tremolo')
    return result
  }

  /**
   * Set — or with `null`, remove — the FANNED (feathered) beam on the slot containing `noteId`:
   * "play this one event as N notes, speeding up or slowing down across its own duration".
   *
   * Returns null when the fan is refused (a rest, a tuplet member, or nothing to remove — see
   * `ScoreModel.setFan`), so the press does nothing and mints no undo entry.
   *
   * `commit`, not `saveOnly`: a fan changes what SOUNDS, so it belongs with the edits that resync
   * playback — the same call {@link setTremolo} documents itself making, and the seam that would
   * otherwise be silently wrong the day P3 lands.
   */
  setFan(noteId: string, fan: FanMark | null): Note | null {
    const result = this.scoreModel.setFan(noteId, fan)
    if (!result) return null
    this.commit(fan === null ? 'Remove fanned beam' : `Fanned beam ${fan.direction}`)
    return result
  }

  /**
   * ⭐ Collapse the selected PASSAGE into one fanned slot: the notes you typed become the attacks of
   * one gesture, spanning exactly the time they spanned. Returns the surviving note (the group's
   * first) for the caller to keep selected, or null when the selection is not a passage —
   * `fanCollapse.collapseIntoFan` owns that list, and the press then does nothing at all.
   *
   * `commit`, for {@link setFan}'s reason: it changes what sounds.
   */
  collapseIntoFan(noteIds: string[], direction: 'accel' | 'rit'): Note | null {
    const result = this.scoreModel.collapseIntoFan(noteIds, direction)
    if (!result) return null
    this.commit(`Fanned beam ${direction}`)
    return result
  }

  /**
   * How a two-note tremolo's strokes meet the stems — `'joined'` or `'open'`. Returns null when the
   * pair does not accept the choice (see `ScoreModel.setTremoloPairStyle`), so the press does nothing.
   *
   * `saveOnly`, not `commit`: this is how the mark is DRAWN, and nothing about it changes a note.
   */
  setTremoloPairStyle(noteId: string, style: 'joined' | 'open'): Note | null {
    const result = this.scoreModel.setTremoloPairStyle(noteId, style)
    if (!result) return null
    this.saveOnly(`Tremolo strokes ${style}`)
    return result
  }

  /** Read-only: does this note's two-note tremolo accept the `'joined'` style (a drawn blanca)? */
  tremoloPairAcceptsJoined(noteId: string): boolean {
    return this.scoreModel.tremoloPairAcceptsJoined(noteId)
  }

  // ==================== Rendering Operations ====================

  /**
   * Wrapped (stacked systems, justified) vs linear (one endless system, intrinsic widths).
   * View state, not score data: it lives on the engine, never in the model, and never in
   * `toJSON`. See docs/linear-view-plan.md §5.
   *
   * The engine owns it — not EditorState, not a `renderScore` parameter — because the engine
   * re-renders *itself* from several internal call sites that never pass through
   * RenderController, so a mode held anywhere else would go stale exactly there. Engine
   * ownership is also what lets P2 refuse the system-keyed staff-spacing writes at the source.
   */
  private viewMode: ViewMode = 'wrapped'

  getViewMode(): ViewMode {
    return this.viewMode
  }

  /**
   * Switch the layout mode. Sets state only — the caller repaints through RenderController,
   * so the highlight pass runs too (an engine-level `renderScore()` here would paint a score
   * with every selection highlight dropped).
   */
  setViewMode(mode: ViewMode): void {
    this.viewMode = mode
    this.renderer.setViewMode(mode)
  }

  /** Is the LAST system stretched to the page width? True = Finale/Sibelius (the default here);
   *  false = LilyPond's `ragged-last`, where a short final system keeps its natural width. */
  getJustifyLastLine(): boolean {
    return this.renderer.getJustifyLastLine()
  }

  /** Sets state only — the caller repaints through RenderController, like {@link setViewMode}. */
  setJustifyLastLine(justify: boolean): void {
    this.renderer.setJustifyLastLine(justify)
  }

  /**
   * The **surface** the music is being drawn on — a sketching canvas or a page
   * (`engine/layout/surface.ts`, docs/layout-plan.md).
   *
   * ⚠️ The default here is the plain canvas, and **the editor opens on A4 by saying so**
   * (`MusicEngineConfig.surface`, set in `App.ts`). Deliberate: an engine embedded somewhere else
   * has no business assuming a European paper size, and this is the layer that is one day a
   * package. Paper is always an explicit statement — which is the same reason `renderScoreSvg` and
   * `exportScorePdf` default to the canvas when a caller states nothing.
   *
   * ⭐ Held exactly as {@link viewMode} is: one replaceable field of session state, so the renders
   * this engine starts internally use the same surface as the ones the editor asks for. That is a
   * *convenience*, NOT an ownership edge — a surface is paired with a score at the moment of use
   * and the pairing evaporates. ⛔ There is no `score.layout`, no `Document { score, layout }`, and
   * no such thing as "the layout **of** the score"; it is "the surface this render is using".
   */
  private surface: Surface = SKETCH_CANVAS

  getSurface(): Surface {
    return this.surface
  }

  /** Sets state only — the caller repaints through RenderController, like {@link setViewMode}. */
  setSurface(surface: Surface): void {
    this.surface = surface
    this.renderer.setSurface(surface)
  }

  /**
   * What the frozen left gutter must show at layout-x `x` (docs/linear-view-plan.md §P3): the
   * clef *in force* there, per staff, the y each staff sits at, and the measure you are looking
   * at — everything the gutter needs and nothing about how it is drawn. No meter: the music draws
   * its own where it changes.
   *
   * Pure read off the last render's geometry, so scrolling never re-renders the score: the
   * caller redraws only its own small pinned SVG. Clef resolution goes through the registry's
   * `clefAtX`, the same function the pitch math uses, so a mid-measure clef change shows in the
   * gutter the moment you scroll past it — not at the next barline.
   *
   * Null in wrapped view (no gutter) or before the first render (no geometry yet).
   */
  getGutterState(x: number): GutterState | null {
    if (this.viewMode !== 'linear') return null
    const score = this.scoreModel.getScore()
    const bounds = this.renderer.getAllMeasureBounds()
    if (bounds.size === 0) return null

    // The measure containing `x` = the last one that starts at/before it. Scrolled left of the
    // first measure (or past the last), the nearest end measure's state is the right answer.
    let measureNumber = score.measures[0]?.number
    if (measureNumber === undefined) return null
    for (const m of score.measures) {
      const b = bounds.get(m.number)
      if (b && b.measureX <= x) measureNumber = m.number
      else if (b) break
    }
    const registry = this.renderer.getElementRegistry()
    const staves = getStaves(score)
    const staffList = staves.length > 0 ? staves : [{ id: staffIdAtIndex(score, 0) }]

    const gutterStaves: GutterStaffState[] = []
    staffList.forEach((_staff, staffIndex) => {
      const geo = registry.getStaffGeometry(measureNumber, staffIndex)
      if (!geo) return
      gutterStaves.push({
        topLineY: geo.lineYPositions[0],
        lineSpacing: geo.lineSpacing,
        // What the staff was DRAWN at: the registry holds the real (scaled-out) spacing, so a staff
        // engraved at 0.7 reports 7 where a full one reports STAFF_SPACE_PX.
        size: geo.lineSpacing / STAFF_SPACE_PX,
        clef: registry.clefAtX(geo, x) as Clef,
      })
    })
    if (gutterStaves.length === 0) return null

    // Where the score's own opening meter is drawn — the fact the far-left pan limit is read off
    // (GUTTER_METER_AIR). The FIRST measure's, whatever it is numbered: linear view has one system,
    // so that is the only bar drawing a header, and it is the only one the gutter can ever cover.
    const firstNumber = score.measures[0].number
    const openingMeter = registry
      .getByType('timeSignature')
      .filter(el => el.measure === firstNumber)
      .map(el => el.bbox.x)
    const openingMeterX = openingMeter.length > 0 ? Math.min(...openingMeter) : null

    return { measureNumber, staves: gutterStaves, openingMeterX }
  }

  /**
   * Render the score
   */
  renderScore(): void {
    // Repair measure gaps only after a real data change — a pure re-render (selection,
    // scroll, zoom, playback cursor) leaves the model untouched and needs no repair.
    const contentChanged = this.modelDirty
    if (contentChanged) {
      this.scoreModel.repairAllMeasureGaps()
      this.modelDirty = false
    }
    // The engine is the ONLY thing that can vouch for "the model did not change", so it is the only
    // thing that may license the renderer to reuse the last render's casting-off. Under P6 this is
    // what makes scrolling free again: a scroll moves the window, the window cannot change a bar's
    // width, and recomputing all of them cost 13 ms a frame at 200 bars (VexFlowRenderer.layoutCache).
    this.renderer.setLayoutReusable(!contentChanged)
    this.renderer.renderScore(this.scoreModel.getScore())
    // The SVG now matches the model AND this view state — record the latter so the next
    // render can tell whether anything but the selection moved (see isRenderStale).
    this.lastViewStateKey = this.renderer.viewStateKey(this.scoreModel.getScore())
    // Update coordinate mapper with actual VexFlow bounds
    this.syncCoordinateMapperBounds()
  }

  /**
   * Push VexFlow's post-render measure bounds into the coordinate mapper, and keep its
   * `numStaves` in sync with the model so Y→measure/line math spans the whole (multi-)staff
   * system. Called after every render path (score, ghost note/clef/time-sig/dynamic previews).
   */
  private syncCoordinateMapperBounds(): void {
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    this.coordinateMapper.updateConfig({
      numStaves: Math.max(getStaves(this.scoreModel.getScore()).length, 1),
    })
  }

  /**
   * Freeze/unfreeze the line layout. While frozen, renders reuse the cached
   * measure widths and line assignments — used during a clef drag so the score
   * doesn't reflow on every mouse move. Unfreeze and re-render to settle.
   */
  setLayoutFrozen(frozen: boolean): void {
    this.renderer.setLayoutFrozen(frozen)
  }

  // ==================== Virtualization (P6) ====================

  /** The window tier 2 last painted — the visible rect plus overscan. See {@link setVisibleRect}. */
  private cullWindow: Rect | null = null

  /**
   * **P6 — tell the engine where the user is looking** (docs/render-performance-plan.md §8).
   *
   * `visible` is the viewport in layout coordinates. The engine keeps a *larger* window around it —
   * the visible rect grown by {@link CULL_OVERSCAN} — and that grown window is what the renderer
   * actually paints. So:
   *
   *  - while the viewport stays inside the drawn window, this does **nothing at all**, and scrolling
   *    remains the free CSS scroll it has always been;
   *  - the moment it escapes, the window is recentred and the renderer is told. The new window
   *    overlaps the old almost everywhere, so the bars that were already drawn are *reused* (their
   *    shape and position are unchanged — P5.4 handles them for free) and only the newly-exposed
   *    strip is engraved.
   *
   * @returns whether the window moved — i.e. whether the caller now owes a `renderScore()`. The
   *          caller renders rather than this method, so the render goes through the one path that
   *          also repaints the highlights (`RenderController.renderScore`); a note that scrolls back
   *          into view must come back with its selection colour on it.
   */
  setVisibleRect(visible: Rect | null): boolean {
    if (!visible) {
      if (!this.cullWindow) return false
      this.cullWindow = null
      this.renderer.setCullWindow(null)
      return true
    }
    // A zero-sized viewport (not laid out yet) would cull the entire score. Draw everything until
    // the DOM tells us how big the window really is.
    if (visible.width <= 0 || visible.height <= 0) return false
    if (this.cullWindow && rectContains(this.cullWindow, visible)) return false

    this.cullWindow = expandRect(visible, CULL_OVERSCAN)
    this.renderer.setCullWindow(this.cullWindow)
    return true
  }

  /**
   * Render the score with a ghost note preview at mouse position
   * Uses ElementRegistry for accurate beat detection based on rendered element positions
   * @returns true if ghost note was rendered, false otherwise
   */
  renderScoreWithPreview(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: Accidental,
    dots?: number,
    articulations?: ArticulationType[],
    /** The armed entry tremolo, drawn ON the ghost note — the preview for "this click enters a
     *  note wearing this mark". Not to be confused with the tremolo STAMP's ghost, which is the
     *  mark alone (renderScoreWithTremoloGhost): here the note is what is coming. */
    tremolo?: NoteParams['tremolo'],
    ghostColor?: { fill: string; stroke: string },
    /**
     * The armed tuplet, if any — as a SHAPE plus how it was armed, not as a finished mark.
     *
     * The mark is built here rather than handed in because it depends on WHERE the cursor is: M can
     * come from the meter of the hovered bar, and whether a bare number is readable depends on that
     * same meter. The caller does not know the hovered position; this method resolves it anyway.
     */
    armedTuplet?: {
      shape: TupletShape
      /** Derive M from the hovered bar's meter, using `shape.notesOccupied` as the fallback. */
      deriveM?: boolean
      style?: TupletNumberStyle
    },
  ): boolean {
    // Resolve the HOVERED measure first (the same order addNoteAtPosition uses), so the
    // beat-quantization fallback in getPositionFromPixels uses THAT measure's capacity — a
    // 3/4 or pickup bar quantizes against its own length, not bar 1's.
    const hoveredMeasureNumber = this.coordinateMapper.pixelToMeasure(coords)
    const measure = this.scoreModel.getMeasure(hoveredMeasureNumber)
    if (!measure) {
      console.warn('No measure found for preview')
      return false
    }
    const barQuarters = measureCapacityQuarters(measure)
    const registry = this.renderer.getElementRegistry()

    // Check if cursor is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor) {
      if (INVALID_NOTE_ENTRY_TYPES.includes(elementAtCursor.type)) {
        // No ghost over a clef/TS/barline. Erasing the last one is a DOM removal, not a full
        // render — this branch used to re-engrave the whole score to hide one notehead (P4).
        this.renderer.clearGhosts()
        return false
      }
    }

    // Use centralized position calculation with duration for beat quantization
    const position = this.getPositionFromPixels(coords, barQuarters, duration)

    // Validate measure exists
    if (!this.scoreModel.getMeasure(position.measure)) {
      this.renderer.clearGhosts()
      return false
    }

    // Check if cursor is within valid staff area (note entry zone)
    const staffGeometry = registry.getStaffGeometry(position.measure, position.staff)
    if (staffGeometry) {
      // Check if X is within the note entry area (between noteStartX and noteEndX)
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        // Cursor is outside the note entry area (over clef, time sig, or past barline)
        this.renderer.clearGhosts()
        return false
      }
    }

    // Render score with ghost note
    // Apply accidental from palette to the resolved spelling
    const alter = accidentalToAlter(accidental)
    const ghostSpelling = { ...position.spelling, alter }

    // The armed tuplet's mark, resolved AT THE HOVERED POSITION — both halves of it. M may come from
    // this bar's meter (`Ctrl+5` is 5:4 here and 5:3 over a 6/8 bar), and the automatic mark style
    // asks the same meter whether a bare number is enough. Move the cursor into another meter and the
    // preview changes, which is the point: what it shows is what that click would write.
    const previewMeasure = this.scoreModel.getMeasure(position.measure)
    let tupletLabel: TupletMarkRun[] | undefined
    if (armedTuplet && previewMeasure) {
      const meter = previewMeasure.timeSignature
      // `getPositionFromPixels` answers in float beats; every rule below is exact.
      const beatFrac = beatToFrac(position.beat)
      const shape: TupletShape = armedTuplet.deriveM
        ? {
            ...armedTuplet.shape,
            notesOccupied:
              deriveTupletM(
                armedTuplet.shape.numNotes,
                armedTuplet.shape.baseDuration,
                armedTuplet.shape.baseDots ?? 0,
                meter,
                beatFrac,
              ) ?? armedTuplet.shape.notesOccupied,
          }
        : armedTuplet.shape
      tupletLabel = tupletMarkRuns(shape, armedTuplet.style, { meter, beat: beatFrac })
    }

    const ghostNote: GhostNote = {
      ...ghostSpelling,
      duration,
      measure: position.measure,
      beat: position.beat,
      staff: position.staff,
      rawX: coords.x,
      rawY: coords.y,
      ...(dots && { dots }),
      ...(articulations?.length && { articulations }),
      ...(tremolo !== undefined && { tremolo }),
      // An armed natural is alter 0 (no glyph of its own) — flag it so the ghost still shows the ♮.
      ...(accidental === 'n' && { forceAccidental: true }),
      ...(tupletLabel && { tupletLabel }),
      ...(ghostColor && { fillColor: ghostColor.fill, strokeColor: ghostColor.stroke }),
    }

    // Pass raw cursor coordinates for smooth visual positioning
    return this.renderer.drawGhostNote(this.scoreModel.getScore(), ghostNote)
  }

  /**
   * Render the score with ONE free-floating translucent ghost following the cursor — the preview
   * for whatever marking tool is armed (clef, meter, dynamic, tempo, and the five stamps). The
   * glyph tracks the mouse anywhere on the canvas; on click, whatever it previews is applied to
   * what was clicked (see MouseController).
   *
   * ⚠️ ONE method, and it stays one. This was ten (`renderScoreWithClefGhost`,
   * `…TimeSignatureGhost`, …), each a single delegating statement to a matching one-liner on
   * `VexFlowRenderer` — twenty methods of pure forwarding, so a new ghost was four files' work to
   * add nothing (docs/modularity-plan-2026-07-28.md Phase 2). A new ghost is now a {@link ToolGhost}
   * member and a `GHOST_DRAWERS` row; this facade does not learn about it.
   *
   * ⚠️ The ghost NOTE is not one of these — it rides the armed duration/accidental/tuplet and goes
   * through {@link renderScoreWithPreview}.
   *
   * @returns true if a ghost was actually drawn, false otherwise
   */
  renderScoreWithToolGhost(coords: PixelCoordinates, ghost: ToolGhost): boolean {
    return this.renderer.renderScoreWithToolGhost(coords.x, coords.y, ghost)
  }

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.renderer.clear()
  }

  // ==================== Coordinate Mapping ====================

  /**
   * Convert pixel coordinates to measure number
   */
  pixelToMeasure(coords: PixelCoordinates): number {
    return this.coordinateMapper.pixelToMeasure(coords)
  }

  /**
   * Convert pixel coordinates to musical position
   * Uses ElementRegistry for accurate position calculation based on actual rendered elements
   */
  pixelToPosition(coords: PixelCoordinates, barQuarters: number): { measure: number; beat: Fraction; spelling: PitchSpelling; staff: number } {
    const { measure, beat, spelling, staff } = this.getPositionFromPixels(coords, barQuarters)
    return { measure, beat: beatToFrac(beat), spelling, staff }
  }

  /**
   * Core pixel→position resolver using ElementRegistry with coordinateMapper fallback.
   * Also used by renderScoreWithPreview for beat quantization during ghost-note preview.
   * @param duration - Optional duration for beat quantization
   */
  private getPositionFromPixels(
    coords: PixelCoordinates,
    barQuarters: number,
    duration?: NoteParams['duration']
  ): { measure: number; beat: number; spelling: PitchSpelling; staff: number } {
    const registry = this.renderer.getElementRegistry()
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)
    // Which stacked staff (0-based) does this click fall on? Resolved from the real per-staff
    // line Y-bands; at N=1 always 0. Drives the staff-aware pitch resolution below and is
    // returned so entry can target it (used in Phase 3). The X spine is shared across staves.
    const staff = registry.staffIndexAtY(measureNumber, coords.y)

    // Get natural spelling from ElementRegistry (more accurate) with fallback.
    // Pass X so mid-measure clef regions resolve to the correct clef, and the staff so pitch
    // resolves against THAT staff's clef/lines. A registry result with an undefined step
    // (degenerate geometry) is treated as a miss.
    const registrySpelling = registry.pixelYToPitch(coords.y, measureNumber, coords.x, staff)
    const spelling = registrySpelling?.step !== undefined
      ? registrySpelling
      : this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)

    // Get beat from ElementRegistry or coordinateMapper
    let beat: number
    const nearestElement = registry.findNearestNoteOrRest(coords.x, measureNumber, staff)
    if (nearestElement && nearestElement.beat !== undefined
      && Math.abs(coords.x - (nearestElement.bbox.x + nearestElement.bbox.width / 2)) < nearestElement.bbox.width * 1.5) {
      // Right on top of a note: take its beat verbatim, unrounded — this is the one path that can
      // return an exact triplet beat.
      beat = nearestElement.beat
    } else {
      // Between columns. Ask the DRAWN columns where this pixel falls (piecewise through the real
      // note positions); only when nothing is drawn there does the even-division mapper answer.
      // That fallback is a genuine last resort, not a preference: it divides the bar as if time and
      // space were proportional, which they are not in any bar with mixed durations — still less in
      // one the user has spaced by hand.
      const fromColumns = registry.pixelXToBeat(coords.x, measureNumber, barQuarters, staff)
      beat = fromColumns ?? this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, barQuarters)
      if (duration) beat = quantizeBeat(beat, duration, barQuarters)
    }

    return { measure: measureNumber, beat, spelling, staff }
  }

  // ==================== Playback Operations ====================

  /**
   * Play the score
   */
  async play(): Promise<void> {
    await this.playbackEngine.play()
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.playbackEngine.pause()
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.playbackEngine.stop()
  }

  /**
   * Seek to a specific measure. Reserved for the transport bar's seek/scrub UI (no caller
   * yet); the playback engine already supports it, so this stays as the ready seam.
   */
  seekToMeasure(measureNumber: number): void {
    this.playbackEngine.seekToMeasure(measureNumber)
  }

  /**
   * Get playback state
   */
  getPlaybackState() {
    return this.playbackEngine.getState()
  }

  /**
   * Current playback position. Reserved for the transport bar's playhead readout (no caller
   * yet, apart from tests). Keep alongside {@link seekToMeasure} / {@link setVolume}.
   */
  getPlaybackPosition() {
    return this.playbackEngine.getPosition()
  }

  /**
   * Set playback volume (0-1). Reserved for the transport bar's volume control (no caller yet).
   */
  setVolume(volume: number): void {
    this.playbackEngine.setVolume(volume)
  }

  /**
   * ⚠️ TEMPORARY — dev-only sound picker. Set the GM program the whole score plays as
   * (takes effect on the next play()). Not part of the score/JSON; remove when a real
   * instrument model lands. See WebAudioFontInstrument.DEV_SOUNDS.
   */
  setInstrumentProgram(program: number): void {
    this.playbackEngine.setInstrumentProgram(program)
  }

  /**
   * Register playback callbacks
   */
  setPlaybackCallbacks(callbacks: PlaybackCallbacks): void {
    this.playbackEngine.setCallbacks(callbacks)
  }

  // ==================== Serialization ====================

  /**
   * Export score as JSON
   */
  exportJSON(): string {
    return this.scoreModel.toJSON()
  }

  /**
   * Load score from JSON
   */
  loadJSON(json: string): void {
    const loaded = ScoreModel.fromJSON(json)
    this.scoreModel = loaded
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.markModelDirty()
    this.renderScore()
    // Reset undo history with loaded state as initial
    this.undoRedoManager.saveInitialState(this.scoreModel.getScore())
  }

  // ==================== Element Registry ====================

  /**
   * Get the element registry (contains positions of all rendered elements)
   */
  getElementRegistry(): ElementRegistry {
    return this.renderer.getElementRegistry()
  }

  /**
   * Find element at a specific pixel coordinate
   */
  getElementAt(coords: PixelCoordinates): ElementInfo | null {
    return this.renderer.getElementRegistry().getAt(coords.x, coords.y)
  }

  /**
   * Find element by its ID (for notes/rests)
   */
  getElementById(id: string): ElementInfo | null {
    return this.renderer.getElementRegistry().getById(id)
  }

  /**
   * Where to scroll to bring a note into view — its own bounding box if it has one, else the
   * rectangle of the **measure holding it**.
   *
   * The fallback is P6's doing. A note's bbox is tier-2 geometry: it exists only once the note has
   * been *drawn*, and under virtualization a note far outside the window has not been. Scrolling to
   * a note you cannot see is exactly the case that then breaks — the selection jumps somewhere
   * distant (paste, undo, a click on a search result) and `getElementById` finds nothing, so the
   * viewport would simply not move and the note would stay invisible, selected, off-screen.
   *
   * Its *measure*, though, is always known: measure bounds are tier 1 and are computed for every bar
   * in the score, drawn or not (§8, "geometry consumers that read the renderer"). So we scroll to
   * the bar, which brings the note inside the window, which draws it. Bar-accurate rather than
   * notehead-accurate for one frame; the alternative is not scrolling at all.
   */
  getScrollRectForNote(noteId: string): Rect | null {
    const element = this.getElementById(noteId)
    if (element) return element.bbox

    const note = this.scoreModel.getNote(noteId)
    return note ? this.getMeasureRect(note.measure) : null
  }

  /**
   * Pixel rectangle of a rendered measure in content coordinates, or null if that measure
   * isn't currently rendered. The height spans the whole **system** — every stacked staff of
   * a shared-spine bar, not just staff 0 — so a multi-staff bar's hit-box (Ctrl+Shift+click
   * measure-box select) and playback scroll-into-view cover the lower staves too. At N=1 this
   * is exactly one stave. `measureNumber` is the measure's `.number` (1-indexed), matching the
   * playback position callback.
   */
  getMeasureRect(measureNumber: number): Rect | null {
    const b = this.renderer.getMeasureBounds(measureNumber)
    if (!b) return null
    const score = this.scoreModel.getScore()
    const staffList = getStaves(score)
    if (staffList.length === 0) {
      return { x: b.measureX, y: b.measureY, width: b.measureWidth, height: staveHeightPx(1) }
    }
    // Client #7 staff-spacing pushes the lower staves further down, and a staff drawn small takes
    // a smaller slot — so this is the render's own vertical arithmetic, asked for one system.
    // Resolve both PER-SYSTEM against the opening measure of the system this bar sits on (plan
    // option C for spacing; ignored by size until per-system size exists).
    const openerNum = this.renderer.getSystemOpeningMeasureNumber(measureNumber)
    const openingMeasureId = openerNum !== undefined ? this.scoreModel.getMeasure(openerNum)?.id : undefined
    const sizes = staffList.map(s => resolveStaffSize(score, s.id, openingMeasureId))
    const abovePx = staffList.map((s, i) =>
      spacingAbovePx(resolveStaffSpacingAbove(score, s.id, openingMeasureId), sizes[i]))
    const { topPx } = systemStaffTops(sizes, abovePx)
    // Top of staff 0 → bottom of the last staff. `b.measureY` is staff 0's real drawn top (it
    // already reflects staff 0's own space-above), so measure from `topPx[0]` rather than from the
    // system top; and the trailing inter-staff gap is not part of the bar, so the last staff
    // contributes its stave height and not its stride.
    const last = staffList.length - 1
    const height = topPx[last] - topPx[0] + staveHeightPx(sizes[last])
    return { x: b.measureX, y: b.measureY, width: b.measureWidth, height }
  }

  /**
   * Find tuplet element by its tuplet ID
   */
  getTupletElementById(tupletId: string): ElementInfo | null {
    return this.renderer.getElementRegistry().getTupletById(tupletId)
  }

  /**
   * Get the rendered SVG group for a note/rest plus its key index within the chord.
   * Used to recolor exactly one note for the selection highlight (no document scan).
   */
  getStaveNoteSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number; stem: SVGGElement | null } | null {
    return this.renderer.getStaveNoteSVGGroup(noteId)
  }

  /**
   * The SVG group of one FANNED MEMBER's ink (head + sign + ledgers + stem), for the same recolour.
   * A member has no `StaveNote`, so this is its answer to {@link getStaveNoteSVGGroup}.
   */
  getFanMemberSVGGroup(noteId: string): { group: SVGGElement; noteIndex: number } | null {
    return this.renderer.getFanMemberSVGGroup(noteId)
  }

  /**
   * Get the rendered SVG group for a tuplet (its bracket + number), to recolor exactly
   * one tuplet for the selection highlight (no document scan).
   */
  getTupletSVGGroup(tupletId: string): SVGGElement | null {
    return this.renderer.getTupletSVGGroup(tupletId)
  }

  /**
   * Get the rendered SVG group (`<g class="vf-annotation">`) for a dynamic, to
   * recolor exactly one dynamic for the selection highlight (no document scan).
   */
  /** The `<g>` a tempo mark was drawn into (TempoLayout opens it — StaveTempo does not).
   *  Used by the selection highlight to recolor the mark and nothing else. */
  getTempoSVGGroup(tempoId: string): SVGGElement | null {
    return this.renderer.getTempoSVGGroup(tempoId)
  }

  /** Hide one tempo mark from the next renders (null = restore) — used by the text-edit
   *  overlay so the engraved word isn't drawn under the DOM input. */
  setSuppressedTempoId(tempoId: string | null): void {
    this.renderer.setSuppressedTempoId(tempoId)
  }

  getDynamicSVGGroup(dynamicId: string): SVGGElement | null {
    return this.renderer.getDynamicSVGGroup(dynamicId)
  }

  /** The `<g id="vf-mN-sX">` a measure-on-staff was drawn into. The clef and time
   *  signature glyphs render inside it (VexFlow draws them as part of `stave.draw()` and
   *  wraps no finer group), so the selection highlight scopes its glyph scan to this
   *  group instead of the whole document — a neighbouring system's clef lives in a
   *  different group and so can never be recolored. */
  getMeasureSVGGroup(measureNumber: number, staffIndex: number): SVGGElement | null {
    return this.renderer.getMeasureSVGGroup(measureNumber, staffIndex)
  }

  /**
   * Get the rendered SVG group (`<g class="vf-slur">`) for a slur, to recolor
   * exactly one slur for the selection highlight (no document-wide bbox scan).
   */
  /** The `<g class="vf-hairpin">` of one hairpin, for a scoped highlight. */
  getHairpinSVGGroup(hairpinId: string): SVGGElement | null {
    return this.renderer.getHairpinSVGGroup(hairpinId)
  }

  /** The rendered `<g class="vf-trill">` for a trill, or null — scoped highlight's target. One group
   *  per trill even when it repeats on a later system, so colouring it colours the whole ornament. */
  getTrillSVGGroup(trillId: string): SVGGElement | null {
    return this.renderer.getTrillSVGGroup(trillId)
  }

  /** The rendered SVG group for an octave line, for scoped highlight. */
  getOttavaSVGGroup(ottavaId: string): SVGGElement | null {
    return this.renderer.getOttavaSVGGroup(ottavaId)
  }

  /** The rendered SVG group for a sustain pedal, for scoped highlight — one group per pedal,
   *  holding `Ped.`, every `(Ped.)` resumption and the `✻`. */
  getPedalSVGGroup(pedalId: string): SVGGElement | null {
    return this.renderer.getPedalSVGGroup(pedalId)
  }

  /** Find a sustain pedal anywhere in the score by id (live reference), or null. */
  getPedalById(id: string): Pedal | null {
    return this.scoreModel.getPedalById(id)
  }

  /** The two (measure, beat) addresses a pedal covers — the press and ⭐ the LIFT, which `length`
   *  alone does not name (see `pedalOps.pedalSpan`). */
  getPedalSpan(id: string) {
    return this.scoreModel.getPedalSpan(id)
  }

  /** Find an octave line anywhere in the score by id (live reference), or null. */
  getOttavaById(id: string): Ottava | null {
    return this.scoreModel.getOttavaById(id)
  }

  /** The two (measure, beat) addresses an octave line covers — the MUSICAL span, ⚠️ not the drawn
   *  one (the bracket's ink stops at the last notehead; see `ottavaOps.ottavaSpan`). */
  getOttavaSpan(id: string) {
    return this.scoreModel.getOttavaSpan(id)
  }

  getSlurSVGGroup(slurId: string): SVGGElement | null {
    return this.renderer.getSlurSVGGroup(slurId)
  }

  /** The rendered SVG group (`<g class="vf-tie">`) for a tie, keyed by its from-note id.
   *  Lets the highlight recolor exactly one tie for the selection highlight (no
   *  document-wide bbox scan, which bled onto staff lines). */
  getTieSVGGroup(fromNoteId: string): SVGGElement | null {
    return this.renderer.getTieSVGGroup(fromNoteId)
  }

  /**
   * Suppress one dynamic from rendering (null = restore). Re-render to apply. Used by the in-canvas
   * text editor to remove the engraved glyph while editing.
   *
   * ⭐ `liveInkWidth` (the score's own pixels) is how much room the OPEN EDITOR is taking, which the
   * engine cannot see: a suppressed mark is not drawn and therefore measures nothing, so a hairpin
   * broken for it would close its hole and draw through the editor. See
   * `VexFlowRenderer.setSuppressedDynamicId`.
   */
  setSuppressedDynamicId(dynamicId: string | null, liveInkWidth?: number): void {
    this.renderer.setSuppressedDynamicId(dynamicId, liveInkWidth)
  }

  // ==================== Cleanup ====================

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.playbackEngine.dispose()
    this.renderer.clear()
  }
}
