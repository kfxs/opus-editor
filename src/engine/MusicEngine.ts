import { dbg } from '@/utils/debug'
import { ScoreModel, type ClipDynamicInput, type ClipSlurInput } from './models/ScoreModel'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, resolveStaffSpacingAbove, staffSystemSpacingKey, dynamicOffsetOverrideOf, noteOffsetOverrideOf, spacingPositionKey, leadingSpaceOverrideOf, barWidthKey, measureStretch, BAR_STRETCH_MIN, BAR_STRETCH_MAX, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from './models/engravingOverrides'
import { VexFlowRenderer, LAYOUT_CONFIG } from './rendering/VexFlowRenderer'
import type { ViewMode, GutterState, GutterStaffState } from './rendering/layoutConfig'
import { authoredScales, growthPayerShares, squeezedWidth } from './rendering/MeasureLayout'
import { FAN_MIN_HEAD_GAP_RATIO } from './rendering/FannedBeam'
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
import { quantizeBeat } from '@/utils/durations'
import { spellingToMidi, accidentalToAlter, spellingDiatonicPos, formatPitch } from '@/utils/pitchSpelling'
import { prevailingAlterAt } from '@/utils/accidentalState'
import type { BeamRole } from '@/utils/beaming'
import { naturalStemDirection } from '@/utils/clefUtils'
import type { Score, Note, NoteParams, Fraction, PixelCoordinates, Tuplet, TupletFormat, TupletMarkRun, TupletShape, TupletNumberStyle, NoteDuration, ArticulationType, Accidental, PitchSpelling, GhostNote, Clef, TimeSignature, Dynamic, DynamicLevel, TempoMark, Slur, PitchAlter, PitchStep, CurveControlPointDeltas, SlurSegmentAddress, SlurSegmentEndpointAddress, TremoloMark, FanMark } from '@/types/music'
import { dynamicLabel } from '@/utils/dynamics'
import { tempoLabel } from '@/utils/tempoMap'
import type { ElementRegistry, ElementInfo } from './ElementRegistry'
import type { RebarEvent } from '@/utils/rebar'
import { staffOf, voiceOf } from '@/utils/lanes'

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
}

/**
 * What a bar-width gesture may do to one bar, all read off the last render — the answer
 * {@link MusicEngine.barWidthRoom} gives, and what a drag captures ONCE at the grab
 * (docs/bar-width-plan.md §4–§5).
 */
export interface BarWidthRoom {
  /** The bar's stretch as stored right now. */
  stretch: number
  /** The bar's note space in px — the unit a stretch multiplies, and the px→ratio divisor. */
  noteSpace: number
  /** Px the bar's ENDING BARLINE moves per px added to its stretch space: `1 − P(m)/T`. **0 means
   *  pinned** — the bar ends its system, so justification holds its barline at the right margin.
   *  Not a refusal: the bar can still be resized, and doing so re-wraps (see `nudgeBarWidth`). */
  barlineSlope: number
  /** Px the bar's own WIDTH changes per px added to its stretch space. 1 while the line still has
   *  somebody who can pay for the growth (a transfer arrives whole), 0 once nobody has slack left.
   *  The one the measured shrink floor converts through. */
  widthSlope: number
  /**
   * The bar is the ONLY one on its system — so nothing about it can move (justification hands it
   * the whole line whatever its stretch) and a key press steps to the next casting-off threshold
   * instead of spending itself on an identical picture.
   *
   * ⚠️ Stated, not inferred. It used to be read off `widthSlope === 0`, which stopped being the
   * same question: a bar whose neighbours are all at their floors also has `widthSlope` 0, and
   * treating THAT as alone made the shrink step a fixed point — it stored the stretch it already
   * had, every press, and the bar stopped shrinking with the log claiming it was alone.
   */
  alone: boolean
  /** The tightest stretch this bar may take: the drawn music's own floor (`MIN_NOTE_SPACING` per
   *  column, measured) or the absolute `BAR_STRETCH_MIN`, whichever binds. */
  minStretch: number
  /** The roomiest: the stretch at which this bar's width becomes the WHOLE LINE — derived per bar,
   *  because that is the widest picture there is (past it the bar is alone on its system and
   *  justified back to exactly the line width, so nothing changes). Deliberately NOT a reflow
   *  limit: running out of line is what makes a bar move to the next system, not a wall. Linear
   *  view has no line to fill, so there it is the absolute `BAR_STRETCH_MAX`. */
  maxStretch: number
  /** The line's authored total has passed `USER_SPACE_LINE_FRACTION`, past which the authored space
   *  is scaled down and the closed form above stops describing the picture exactly. Reported rather
   *  than refused; a live drag (P2) may want to decline on it, a key press does not care. */
  capped: boolean
  /**
   * The stretch that moves this bar's ending barline by `deltaPx` — **before** clamping to
   * [{@link minStretch}, {@link maxStretch}]. Ask this rather than multiplying by a slope: for a
   * bar with music the two agree exactly (the model is linear in the authored term), but for a
   * share-scaling empty bar the mapping is a hyperbola, and stepping along its tangent is not
   * reversible — ←← then →→ would leave the bar narrower than it started.
   *
   * Captured with the rest of the room at grab time, so a drag can call it per frame. **Continuous
   * by contract** — it never jumps the layout, and where the barline cannot move it answers "no
   * change" rather than doing something else that can be seen. A key press wants
   * {@link stretchForStep} instead.
   */
  stretchForBarlineDelta(deltaPx: number): number
  /**
   * The same question asked by a KEY PRESS — discrete, and free to jump.
   *
   * Identical to {@link stretchForBarlineDelta} everywhere the picture responds continuously. It
   * differs only for a bar ALONE on its system, where no stretch moves anything until the line's
   * membership changes: there a press goes straight to that threshold, so crossing a bar onto the
   * next system and bringing it back costs one press each way instead of one out and ten back.
   *
   * ⚠️ **A drag must not call this.** Jumping the casting-off while the pointer holds a barline is
   * precisely the desync §4 exists to prevent. The two only diverge in a state where a drag cannot
   * track regardless (`barlineSlope === 0`), which is where P2 should decline the grab.
   */
  stretchForStep(deltaPx: number): number
}

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

    // Calculate coordinate mapper config based on container size
    const width = config.width || 1000
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
    return this.modelDirty || this.renderer.viewStateKey() !== this.lastViewStateKey
  }

  /** Take down the preview ghost, if any. O(1) — see {@link VexFlowRenderer.clearGhosts}. */
  clearGhosts(): void {
    this.renderer.clearGhosts()
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

  /** A measure's dynamics, sorted ascending by beat (a copy; empty if none). */
  getDynamics(measureNumber: number): Dynamic[] {
    return this.scoreModel.getDynamics(measureNumber)
  }

  /** Find a dynamic anywhere in the score by id (live reference), or null. */
  getDynamicById(id: string): Dynamic | null {
    return this.scoreModel.getDynamicById(id)
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

  /** The interpreted dynamic level in effect at (measure, beat) for a voice. */
  getActiveLevel(measureNumber: number, beat: Fraction, voice: number = 0): DynamicLevel {
    return this.scoreModel.getActiveLevel(measureNumber, beat, voice)
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
   * Paste a clipboard event stream at (measure, beat), overwriting forward for the
   * clip's span (see {@link ScoreModel.pasteEvents}). One undo entry.
   * @returns the ids of the notes that landed inside the paste window.
   */
  pasteEvents(
    measure: number,
    beat: Fraction,
    lanes: { staff: number; voice: number; events: RebarEvent[] }[],
    spanBeats: Fraction,
    targetVoice: number,
    clipRestShifts: { staff: number; voice: number; restShifts: Array<{ offset: Fraction; steps: number }> }[] = [],
    clipRestHidden: { staff: number; voice: number; restHidden: Array<{ offset: Fraction }> }[] = [],
    targetStaff: number = 0,
    clipDynamics: ClipDynamicInput[] = [],
    clipSlurs: ClipSlurInput[] = [],
    clipSpaces: Array<{ offset: Fraction; space: number }> = [],
    clipNoteOffsets: { staff: number; voice: number; noteOffsets: Array<{ offset: Fraction; x: number; member?: number }> }[] = [],
  /** Two-note tremolos the clip carries, per lane — see `ClipboardLane.tremoloPairs`. */
  clipTremoloPairs: { staff: number; voice: number; tremoloPairs: Array<{ offset: Fraction; style?: 'joined' | 'open' }> }[] = [],
  ): string[] {
    const ids = this.scoreModel.pasteEvents(measure, beat, lanes, spanBeats, targetVoice, clipRestShifts, clipRestHidden, targetStaff, clipDynamics, clipSlurs, clipSpaces, clipNoteOffsets, clipTremoloPairs)
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
    if (this.refusesFanMember(noteId, 'articulation')) return null
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
    if (this.refusesFanMember(noteId, 'articulation')) return null
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

  /** Live (preview) re-anchor used **while dragging a slur endpoint handle** — moves
   *  one end of the slur onto `noteId` and resets its custom shape, WITHOUT recording
   *  undo. Returns false (no-op) when the target is invalid (collapses the span or is
   *  unchanged). Call {@link commitSlurEndpoint} on drop for the single undo entry. */
  previewSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
    this.markModelDirty() // live drag, undo deferred to commitSlurEndpoint — see previewSlurShape
    return this.scoreModel.setSlurEndpoint(id, which, noteId)
  }

  /** Record one undo entry after a slur-endpoint re-anchor drag settles. */
  commitSlurEndpoint(): void {
    this.commitPreviewed('Re-anchor slur')
  }

  /** Nudge a slur endpoint by a staff-space delta and save ONE undo step (the keyboard
   *  fine-positioning — see docs/slur-endpoint-offset-plan.md). Unlike a mouse drag each
   *  arrow press is already a discrete commit, so there is no preview/commit split. */
  nudgeSlurEndpoint(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    const ok = this.scoreModel.setSlurEndpointOffset(id, which, dx, dy)
    if (ok) this.saveOnly('Nudge slur endpoint')
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
   * How much further LEFT this column may still be pulled before it closes on its left neighbour,
   * in staff-spaces (≥ 0) — the floor `setNoteSpacing` clamps against, and the reason that clamp
   * lives at the write site rather than at draw time.
   *
   * **Measured off the last render, not predicted.** The gap between two columns is the formatter's
   * answer, not arithmetic we can redo: it depends on glyph widths, accidentals, the line's stretch
   * and the space already authored here. So this reads the drawn positions back out of the
   * `ElementRegistry` — which registers post-draw — and asks what is actually there.
   *
   * The gap is the **minimum across staves**, because the column is system-wide: pulling it left
   * far enough to collide on any one staff is too far for all of them. Each staff is asked for its
   * own first column at or after the anchor beat — the same "tick, not slot" rule the renderer
   * uses, so a staff whose rhythm has no event exactly there still gets a vote.
   *
   * ⚠️ **A STALE render cannot answer either, and that is not a technicality.** The gap on screen
   * already includes whatever space is stored here, so the room and the stored value have to come
   * from the same moment. Measure a fresh value against an old picture and the floor slides down by
   * one step per press — the clamp then never bites and the column walks straight through its
   * neighbour, which is exactly what it exists to prevent. So: model dirty ⇒ we don't know.
   * (Model-dirty only, deliberately — `isRenderStale` also trips on scroll and zoom, and neither
   * moves a note relative to its neighbour.)
   *
   * @returns null when the last render cannot answer (nothing drawn in that bar yet, no column at
   * or after the beat on any staff, or an edit not yet drawn). Null is "I don't know", and the
   * caller must decline rather than substitute a guess — a made-up floor silently becomes the rule.
   */
  private measuredShrinkRoom(measureNumber: number, beat: Fraction): number | null {
    if (this.modelDirty) return null
    const registry = this.renderer.getElementRegistry()
    const target = fracToNumber(beat)
    const EPSILON = 1e-9

    const byStaff = new Map<number, { beat: number; x: number }[]>()
    for (const el of registry.getByMeasure(measureNumber)) {
      if ((el.type !== 'note' && el.type !== 'rest') || el.beat === undefined) continue
      const staff = staffOf(el)
      const list = byStaff.get(staff) ?? []
      const x = el.headX ?? el.bbox.x
      // Voices and chord tones share a column: keep its LEFTMOST ink, which is the column's edge.
      const seen = list.find(c => Math.abs(c.beat - el.beat!) < EPSILON)
      if (seen) seen.x = Math.min(seen.x, x)
      else list.push({ beat: el.beat, x })
      byStaff.set(staff, list)
    }

    let room: number | null = null
    for (const [staff, columns] of byStaff) {
      columns.sort((a, b) => a.beat - b.beat)
      const at = columns.findIndex(c => c.beat >= target - EPSILON)
      if (at < 0) continue // nothing at or after the anchor on this staff — it has no say
      const geometry = registry.getStaffGeometry(measureNumber, staff)
      // The left neighbour, or — for the bar's first column — where notes may start at all.
      const leftX = at > 0 ? columns[at - 1].x : geometry?.noteStartX
      if (leftX === undefined) continue
      const staffSpacePx = geometry?.lineSpacing ?? VEXFLOW_DEFAULT_STAFF_SPACE_PX
      const slack = (columns[at].x - leftX - LAYOUT_CONFIG.MIN_NOTE_SPACING) / staffSpacePx
      room = room === null ? Math.max(0, slack) : Math.min(room, Math.max(0, slack))
    }
    return room
  }

  /**
   * ⭐ The same question for a gap INSIDE a fan (§7): how far left may this MEMBER be pulled before
   * its head closes on the one behind it, in staff-spaces.
   *
   * {@link measuredShrinkRoom} cannot answer it, and not by oversight: a member is registered under
   * the SLOT's beat (so `pixelXToBeat` keeps the group on one column), so that walk dedups the whole
   * fan into a single anchor and would measure the gap before the group instead of the gap before
   * the head. The heads are drawn ink, so the honest measurement is the drawn ink: two registry
   * entries, both head CENTRES, and the floor the geometry itself refuses to cross
   * ({@link FAN_MIN_HEAD_GAP_RATIO} × the notehead's own measured width).
   *
   * ⚠️ Same staleness rule as its sibling — a fresh number against an old picture slides the floor
   * down one step per press, and the clamp then never bites.
   *
   * @returns null when the last render cannot answer (either head undrawn, or an edit not yet drawn).
   */
  private fanMemberShrinkRoom(measureNumber: number, noteId: string, memberIndex: number): number | null {
    if (this.modelDirty) return null
    const group = this.scoreModel.fanMembersOfSlot(noteId)
    const behind = group?.[memberIndex - 1]
    if (!behind) return null

    const registry = this.renderer.getElementRegistry()
    const here = registry.getById(noteId)
    const prev = registry.getById(behind.id)
    if (!here || !prev) return null
    const x = here.headX ?? here.bbox.x + here.bbox.width / 2
    const prevX = prev.headX ?? prev.bbox.x + prev.bbox.width / 2

    const geometry = registry.getStaffGeometry(measureNumber, staffOf(here))
    const staffSpacePx = geometry?.lineSpacing ?? VEXFLOW_DEFAULT_STAFF_SPACE_PX
    const minGap = here.bbox.width * FAN_MIN_HEAD_GAP_RATIO
    return Math.max(0, (x - prevX - minGap) / staffSpacePx)
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
    if (anchorNoteId) {
      const column = this.scoreModel.spacingColumnOf(anchorNoteId)
      if (column && column.memberIndex >= 1) return this.fanMemberShrinkRoom(measureNumber, anchorNoteId, column.memberIndex)
    }
    return this.measuredShrinkRoom(measureNumber, beat)
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
    // A spacing change re-runs the casting-off, unlike the weightless previews — so the dirty flag
    // is what makes the bar re-measure at all, not just repaint. See docs/note-spacing-plan.md §2.
    this.markModelDirty()
    return after !== before
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
   * The trap it exists to solve: widening bar *m* also shrinks bar *m*'s own justified share, and
   * shrinks every bar *before* it on the line, so the barline you are holding does **not** move by
   * what you added. From `distributeLineWidths`, with `A` the available width, `I(k)` each bar's
   * intrinsic width and `T = Σ I` on the line, `finalWidth(m) = I(m)·(A − U)/T + u(m)` — linear in
   * the authored term, which is what makes the whole thing invertible in closed form:
   *
   *   d(bar m's width)   = e · (1 − I(m)/T)          ← {@link BarWidthRoom.widthSlope}
   *   d(barline after m) = e · (1 − P(m)/T)          ← {@link BarWidthRoom.barlineSlope}
   *
   * where `P(m) = Σ_{k≤m} I(k)`, the line's intrinsic up to **and including** the grabbed bar (the
   * barlines to its left slide left while you drag right, and carry the grabbed one back with them).
   *
   * Read once, legitimately rather than merely cheaply: none of these terms move during a gesture,
   * because a stretch changes no bar's *intrinsic* width.
   *
   * ⚠️ **A re-wrap is NOT a limit, and neither is a pinned barline.** The plan's §5 stopped the
   * gesture where the line would stop holding the same bars, to keep a dragged barline under the
   * cursor. Reported from use: it reads as the bar getting stuck for no visible reason, and it is
   * not what the field does — Sibelius, Finale and MuseScore all let the music re-wrap as you
   * spread it, which is the whole point of spreading it. So both reflow clamps are gone: stretching
   * far enough pushes a bar onto the next system, shrinking far enough pulls one up. The cursor
   * argument was only ever about a live drag (P2's problem, and it can re-add a guard for itself);
   * a key press has no cursor to lose.
   *
   * Same for the **last bar of a line**, where `P(m) = T` and `barlineSlope` is 0: its barline is
   * the right margin and genuinely cannot move — but the BAR can still be made wider or narrower,
   * and doing so is how music moves between systems. So a zero slope is reported, not declined, and
   * the caller steps in the bar's own note space instead (see {@link nudgeBarWidth}). Declining
   * there would also have been a trap once re-wrapping is allowed: stretch a bar until it is alone
   * on its system and there would be no key left that could bring it back.
   *
   * @returns null — "I don't know", decline rather than guess — only when the last render cannot
   * answer at all: the model is dirty (the picture and the numbers would come from different
   * moments), nothing is drawn for the bar yet, or it has no note space to multiply.
   */
  barWidthRoom(measureNumber: number): BarWidthRoom | null {
    if (this.modelDirty) return null
    const info = this.renderer.getMeasureLayoutInfo().get(measureNumber)
    if (!info?.noteSpace) return null
    const stretch = this.getBarWidth(measureNumber)

    // Linear view justifies nothing, so finalWidth IS minWidth and both slopes are exactly 1. It
    // must take this branch rather than the formula below: every bar there carries lineNumber 0, so
    // `T` would become the whole score and the slope would come out wrong by a little in a long
    // score and badly wrong in a short one.
    let barlineSlope = 1
    let widthSlope = 1
    let capped = false
    // How far the stretch must travel to move the barline by `d` px. Linear models answer with the
    // slope; the share model has to SOLVE, because its mapping is a hyperbola and a derivative does
    // not come back to where it started (press ←← then →→ and the bar ends up narrower than it
    // began). Assigned by whichever branch below applies.
    let solveForBarlineDelta = (d: number) => stretch + d / info.noteSpace!
    // The DISCRETE twin, for a key press. Identical to the above except where the picture cannot
    // respond continuously — see the alone-on-its-system block. Never call it from a drag.
    let stepFor: ((d: number) => number) | null = null
    let alone = false
    // The ceiling, DERIVED rather than picked: the stretch at which this bar's width reaches the
    // whole line. That is the largest one anybody can see — pass 1 puts an oversized bar alone on
    // its own line and justification then hands it exactly `availableWidth`, so every stretch past
    // this draws the identical picture. It is also, in one number, "make this bar the whole system",
    // which a fixed multiplier could never express: the same 8× is a third of a line for a sparse
    // bar and more than a line for a dense one.
    let maxStretch = BAR_STRETCH_MAX

    if (this.getViewMode() === 'linear') {
      // Nothing is justified: the bar's width IS its minWidth, so a px of stretch space is a px of
      // barline movement, whichever model the bar uses.
      solveForBarlineDelta = (d: number) => stretch + d / info.noteSpace!
    } else {
      const layout = this.renderer.getMeasureLayoutInfo()
      const line = [...layout.values()].filter(i => i.lineNumber === info.lineNumber)

      // ⭐ Growth is a **TRANSFER** (MeasureLayout.distributeLineWidths): the bar is handed its
      // growth whole, and the same number of pixels is taken back from the others in tier order —
      // spare empty bars first, music only once the silence is spent. So the bar's own width tracks
      // the gesture 1:1, and the barline moves by whatever the payers SITTING BEFORE IT give up.
      //
      // Two things fall out, and both are simplifications of what stood here. Growth is
      // `noteSpace × (stretch − 1)` in BOTH width models — the empty bar's share model and the
      // reserved one — so ONE formula covers them where there used to be a branch. And it is
      // LINEAR, so the slope is the exact inverse: the hyperbola the share model needed (and the
      // "press ←← then →→ and the bar ends up narrower" problem it existed to solve) is gone.
      // ⚠️ **Is this line actually FULL?** Everything below about limits assumes a justified line —
      // a fixed page total, so what one bar gains another pays. The LAST system is ragged by
      // default (LilyPond's `ragged-last`), and a ragged line has no fixed total: a grown bar just
      // makes it longer and nobody pays. Reported — with the last system ragged, a bar alone on it
      // could not be widened at all, because the ceiling below read "alone ⇒ it already IS the
      // line" and refused every press. That reasoning is sound only when the line fills the page.
      //
      // Measured off the drawn picture rather than asked of the flag: the layout justifies a ragged
      // last line anyway when it over-asks (see `calculateMeasureWidths`), so the flag alone would
      // not tell the truth about THIS line. What is on screen does.
      const lineWidth = line.reduce((sum, m) => sum + m.finalWidth, 0)
      const lineFills = lineWidth >= LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2 - 0.5

      const shares = growthPayerShares(line, measureNumber)
      // Nobody left with anything to give: the line cannot absorb another pixel, so no stretch
      // changes the picture — the same state a bar alone on its system is in, and handled below.
      const canPay = shares.size > 0
      const upToShare = line
        .filter(m => m.measureNumber <= measureNumber)
        .reduce((sum, m) => sum + (shares.get(m.measureNumber) ?? 0), 0)
      // Snapped, not just clamped: `1 − Σshares` lands on 1.1e-16 rather than 0 for a bar whose
      // payers all sit before it (the system-ending barline), and "pinned" has to read as pinned.
      const slope = canPay ? 1 - upToShare : 0
      barlineSlope = Math.abs(slope) < 1e-9 ? 0 : Math.max(0, slope)
      widthSlope = canPay ? 1 : 0
      if (barlineSlope > 1e-6) {
        solveForBarlineDelta = (d: number) => stretch + d / barlineSlope / info.noteSpace!
      }

      // ⚠️ **A bar ALONE on its system: a KEY PRESS steps to the next casting-off threshold.**
      // Nothing about such a bar can move — justification hands it the whole line whatever its
      // stretch — so every intermediate value draws the identical picture and a per-pixel step is
      // spent on nothing. That is not merely wasteful, it is asymmetric: reported from use, one
      // press pushed a bar down onto the next system and **ten** were needed to bring it back,
      // because the press that crossed the boundary was scaled by the slope and the presses coming
      // back were not. The only stretches that change anything here are the two where the line's
      // membership changes, so a press goes straight to the one it is heading for. Crossing out and
      // back is then one press each way.
      //
      // ⚠️ **Only when the bar is GENUINELY ALONE — asked of the line, not inferred from a slope.**
      // This used to read `widthSlope <= 1e-6`, which was a fair proxy while justification handed a
      // lone bar the whole line and nothing else could pin it. Under the transfer model it is not:
      // `widthSlope` is also 0 when the bar has neighbours who are simply all at their floors, and a
      // bar with company then took this branch and asked it to pull a bar up from the next system.
      // The target it computes is a FIXED POINT there — the press stores the stretch it already had,
      // every time, so shrinking stopped dead with the log cheerfully reporting "alone on its
      // system" about a bar sitting next to seven others. Reported from use.
      //
      // A last-of-line bar that still has neighbours is pinned at the barline but its own width very
      // much moves — the neighbours take what it gives up — so its intermediate values are real and
      // it keeps stepping by pixels. Same for a bar whose neighbours are spent: it can still hand
      // room BACK to them, which needs no payer at all.
      //
      // 🖱️ **And only for the KEYBOARD.** A jump is exactly what a drag must not do: the pointer is
      // holding a barline, and teleporting the layout out from under it is the one failure the whole
      // §4 inversion exists to prevent. This is safe to separate rather than reconcile, because the
      // state it fires in is one where a drag cannot track anyway — the barline is pinned, so it
      // cannot follow the pointer by any amount. `stretchForBarlineDelta` stays continuous and
      // answers "nothing moves"; P2 should read `barlineSlope === 0` and decline the grab outright.
      alone = line.length === 1
      // ⚠️ **The two directions do not fire on the same condition, and that is the whole fix.**
      // GROWING is dead whenever nobody on the line can absorb another pixel (`!canPay`): every
      // intermediate stretch draws the identical picture, so the press should go straight to the
      // casting-off threshold it is heading for — that is the reported 1-press-out/10-presses-back
      // asymmetry. SHRINKING is never dead that way: handing room back needs no payer, so it moves
      // the picture immediately. It stops only when the bar is the ONLY one on its system, where
      // the sole thing a shrink can change is pulling a bar up from below.
      //
      // Collapsing the two (both gated on `widthSlope === 0`) is what froze the shrink: a bar with
      // seven neighbours at their floors took the alone-branch, whose shrink target is a fixed
      // point, and every press re-stored the stretch it already had.
      if (lineFills && (alone || !canPay)) {
        const available = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2
        const nextLineFirst = [...layout.values()]
          .filter(i => i.lineNumber === info.lineNumber + 1)
          .sort((a, b) => a.measureNumber - b.measureNumber)[0]
        const HAIR = 0.5 // px past the threshold, so the comparison lands the intended side
        // ⚠️ The bar below is measured AS A LINE-OPENER, so its `minWidth` carries a full clef it
        // will stop paying the moment it moves up here (mid-line it pays nothing, or the smaller
        // change width). Aim at its width WITHOUT that premium or the jump lands short and the bar
        // never comes up — and a threshold press that changes nothing repeats forever, since it
        // returns the same target every time. Assume the worst case (it pays the change width), so
        // the jump always clears: the cost is that pushing the bar back down can take a second press.
        const clefPremium = LAYOUT_CONFIG.CLEF_WIDTH - LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
        const stretchForWidth = (target: number) => stretch + (target - info.minWidth) / info.noteSpace!
        // Smooth, and by the bar's own music rather than by its (immovable) barline.
        const continuous = (d: number) => stretch + d / info.noteSpace!
        stepFor = (d: number) => {
          if (d < 0) {
            // Handing room back always moves the picture, so a shrink steps by pixels like any
            // other — unless the bar is alone, where the only thing that can change is whether a
            // bar comes up from below.
            if (!alone) return continuous(d)
            if (!nextLineFirst) return stretch // nothing below to pull up
            // ⚠️ Its SQUEEZED width, not its `minWidth`. The bar below comes up if the line can be
            // made to hold it, and pass 1 asks that of `squeezedWidth` — so aiming at its full asked
            // width undershoots badly and the way back costs ~10 presses where the way out cost one.
            // Aiming accurately used to be unsafe (miss, and a threshold press that changes nothing
            // repeats forever); it is safe now that such a press falls back to a continuous step.
            return Math.min(stretch, stretchForWidth(available - (squeezedWidth(nextLineFirst) - clefPremium) - HAIR))
          }
          // Widen to the next casting-off threshold — **which is not the same target when the bar
          // has company.** Alone, the threshold is "worth more than the whole line". With
          // neighbours it is "worth more than the line minus what they can be squeezed to", which
          // is where the LAST bar on the line gets pushed off. Aiming at the whole line there sent
          // one press from ×4.75 straight to ×21.6 — reported from the log, and it is the same
          // mistake as the shrink direction: a rule written for a lone bar applied to one that
          // merely has nothing left to take from.
          const others = line
            .filter(m => m.measureNumber !== measureNumber)
            .reduce((sum, m) => sum + squeezedWidth(m), 0)
          return Math.max(stretch, stretchForWidth(available - others + HAIR))
        }
        // The MOUSE never jumps: teleporting the layout out from under a pointer is the one failure
        // the whole §4 inversion exists to prevent. It must not freeze either — a drag that reaches
        // this state mid-gesture would otherwise be dead in the hand.
        solveForBarlineDelta = continuous
      }

      const available = LAYOUT_CONFIG.CONTAINER_WIDTH - LAYOUT_CONFIG.MARGIN * 2
      // Asked of the layout, not re-derived here: the two must agree about the same line, or the
      // gesture inverts a formula the picture is no longer following.
      const scales = authoredScales(line, available)
      capped = scales.userScale < 1 || scales.stretchScale < 1
      // ⭐ **A bar ALONE on its system IS the line — that is its maximum, whatever it is.** Asked,
      // reported: "a measure has a max width, the width of the line, so after that we should not add
      // more". There was a ceiling already — `available − minWidth` over the note space, the stretch
      // at which the bar's width reaches the full line — but it is blind to the bar having become
      // the whole system EARLIER, by pushing its neighbours off. Measured on his score: bar 1 went
      // alone at ×17.1 and the ceiling still said ×21.6, so a press bought +4.5 that drew the
      // IDENTICAL picture, then seven more did nothing, and every one of those units had to be
      // walked back before anything moved. Dead range is worse than a wall: a wall you can see.
      //
      // So once alone, the bar is already as wide as anything can make it and the ceiling is where
      // it stands. Growth is refused — against a limit the picture explains.
      maxStretch = alone && lineFills
        ? stretch
        : Math.min(
            BAR_STRETCH_MAX,
            Math.max(stretch, stretch + (available - info.minWidth) / info.noteSpace),
          )
    }

    // The one limit that is real in BOTH directions: the bar keeps the room its music is actually
    // using, measured off the drawn picture. A bar alone on its line (widthSlope 0) is already
    // exactly as wide as the line, so no stretch changes its drawn width and the floor cannot bind.
    const slackPx = this.measuredBarShrinkPx(measureNumber)
    if (slackPx === null) return null
    const shrinkRoom = widthSlope > 1e-6 ? slackPx / widthSlope : Infinity

    // A share-scaling (empty) bar has a second floor, and it is the layout's own: `measureWidthParts`
    // clamps its scalable area at one column's `MIN_NOTE_SPACING`. Below that the stored number keeps
    // falling while the picture stands still — a dead press, which is the thing every one of these
    // limits exists to avoid.
    const layoutFloor = info.stretchScalesShare ? LAYOUT_CONFIG.MIN_NOTE_SPACING / info.noteSpace : 0

    return {
      stretch,
      noteSpace: info.noteSpace,
      barlineSlope,
      widthSlope,
      capped,
      alone,
      stretchForBarlineDelta: solveForBarlineDelta,
      stretchForStep: stepFor ?? solveForBarlineDelta,
      minStretch: Math.max(BAR_STRETCH_MIN, layoutFloor, stretch - shrinkRoom / info.noteSpace),
      maxStretch,
    }
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
   * How many pixels of width the **drawn** bar can give back before its music is tighter than the
   * engraver's own floor — `MIN_NOTE_SPACING` (18px) per column, the same rule
   * `noteSpaceForLane` applies when it decides how wide a bar needs to be, but measured on the
   * picture instead of predicted.
   *
   * Measured, and not stated as "never below its own intrinsic width", because that absolute is
   * wrong and measurably so: on a compressed line every bar is *already* under its intrinsic width
   * (a `compressionRatio` below 1 is ordinary), so an absolute floor would refuse every shrink on
   * exactly the crowded lines where a shrink is most wanted.
   *
   * The **minimum across staves** — the bar is system-wide, so the tightest staff decides for all
   * of them. Columns, not slots: two voices sounding at one beat share a column.
   *
   * @returns null when the last render cannot answer (nothing drawn in that bar, or no geometry).
   */
  private measuredBarShrinkPx(measureNumber: number): number | null {
    const registry = this.renderer.getElementRegistry()
    const columnsByStaff = new Map<number, Set<number>>()
    for (const el of registry.getByMeasure(measureNumber)) {
      if ((el.type !== 'note' && el.type !== 'rest') || el.beat === undefined) continue
      const staff = staffOf(el)
      const columns = columnsByStaff.get(staff) ?? new Set<number>()
      columns.add(Math.round(el.beat * 1e6))
      columnsByStaff.set(staff, columns)
    }
    if (columnsByStaff.size === 0) return null

    let slack: number | null = null
    for (const [staff, columns] of columnsByStaff) {
      const geometry = registry.getStaffGeometry(measureNumber, staff)
      if (!geometry) return null
      const drawn = geometry.noteEndX - geometry.noteStartX
      const floor = columns.size * LAYOUT_CONFIG.MIN_NOTE_SPACING
      const mine = Math.max(0, drawn - floor)
      slack = slack === null ? mine : Math.min(slack, mine)
    }
    return slack
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
    // A stretch re-runs the casting-off, unlike the weightless previews — the dirty flag is what
    // makes the bar re-measure at all rather than just repaint.
    this.markModelDirty()
    return after !== before
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
   * Nudge a selected note's horizontal offset by `dx` staff-spaces and save ONE undo step (the
   * Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md). Selection gives a *pitch*
   * id; the override is keyed by whatever {@link ScoreModel.offsetTargetOf} resolves — the SLOT for
   * anything ordinary (a chord moves as a unit, and a rest is a slot too), the MEMBER's own key
   * inside a fan — and the accumulate/clear is the model's. A no-op for an id no longer in the score.
   * @returns true if the note was nudged.
   */
  nudgeNoteOffset(noteId: string, dx: number): boolean {
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

  /** The smallest stave-top-to-top distance (px) staff-spacing may shrink TO — the collision
   *  floor. Default distance is `STAVE_HEIGHT + VERTICAL_SPACING`; this keeps enough of it that a
   *  staff (or a whole system, for the top staff) can't be dragged/nudged up INTO the one above.
   *  Tunable — start conservative and adjust against the rendered look. */
  private static readonly MIN_STAFF_STRIDE_PX = 90

  /**
   * Clamp a requested space-above so shrinking can't collide the staff/system with the one
   * above it. `above` is an offset from the default stride, and every consecutive gap (staves
   * within a system AND system-to-system for the top staff) is `VERTICAL_SPACING + above·ss`, so
   * a single lower bound on `above` floors every gap at once. No upper bound — you can widen
   * freely. See docs/staff-spacing-plan.md.
   */
  private clampSpacingAbove(above: number): number {
    const staffStride = LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING
    const minAbove = (MusicEngine.MIN_STAFF_STRIDE_PX - staffStride) / VEXFLOW_DEFAULT_STAFF_SPACE_PX
    return Math.max(above, minAbove)
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
      const above = this.clampSpacingAbove(this.getStaffSpacingAbove(staffIndex, measureNumber) + delta)
      this.linearStaffSpacing.set(staffId, above)
      this.syncLinearStaffSpacing()
      dbg(`[Staff/linear] ${delta > 0 ? '↓' : '↑'} view spacing above staff ${staffIndex} by ${delta} → ${above} ss (view only, not saved)`)
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    const above = this.clampSpacingAbove(resolveStaffSpacingAbove(this.scoreModel.getScore(), t.staffId, t.openingMeasureId) + delta)
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
      this.linearStaffSpacing.set(staffId, this.clampSpacingAbove(above))
      this.syncLinearStaffSpacing()
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    return this.scoreModel.setStaffSpacing(t.key, this.clampSpacingAbove(above))
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
        clef: registry.clefAtX(geo, x) as Clef,
      })
    })
    if (gutterStaves.length === 0) return null

    return { measureNumber, staves: gutterStaves }
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
    this.lastViewStateKey = this.renderer.viewStateKey()
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
   * Render the score with a free-floating translucent ghost clef that follows the
   * cursor. The clef glyph tracks the mouse anywhere on the canvas; on click it is
   * applied to whichever measure was clicked (see MouseController).
   * @returns true if a ghost clef was drawn, false otherwise
   */
  renderScoreWithClefGhost(coords: PixelCoordinates, clef: Clef): boolean {
    return this.renderer.renderScoreWithClefGhost(coords.x, coords.y, clef)
  }

  /**
   * Render the score with a free-floating translucent ghost time signature that
   * follows the cursor; on click it is applied to the clicked measure.
   * @returns true if a ghost time signature was drawn, false otherwise
   */
  renderScoreWithTimeSignatureGhost(coords: PixelCoordinates, ts: TimeSignature): boolean {
    return this.renderer.renderScoreWithTimeSignatureGhost(coords.x, coords.y, ts)
  }

  /**
   * Render the score with a free-floating translucent ghost dynamic that follows
   * the cursor; on click it is applied to the clicked slot.
   * @returns true if a ghost dynamic was drawn, false otherwise
   */
  /** Render the score with a ghost tempo mark following the cursor (armed tempo tool). */
  renderScoreWithTempoGhost(coords: PixelCoordinates, mark: TempoMark): boolean {
    return this.renderer.renderScoreWithTempoGhost(coords.x, coords.y, mark)
  }

  renderScoreWithDynamicGhost(coords: PixelCoordinates, dynamic: Dynamic): boolean {
    return this.renderer.renderScoreWithDynamicGhost(coords.x, coords.y, dynamic)
  }

  renderScoreWithArticulationGhost(coords: PixelCoordinates, types: ArticulationType[]): boolean {
    return this.renderer.renderScoreWithArticulationGhost(coords.x, coords.y, types)
  }

  renderScoreWithAccidentalGhost(coords: PixelCoordinates, accidental: Accidental): boolean {
    return this.renderer.renderScoreWithAccidentalGhost(coords.x, coords.y, accidental)
  }

  renderScoreWithTieGhost(coords: PixelCoordinates): boolean {
    return this.renderer.renderScoreWithTieGhost(coords.x, coords.y)
  }

  renderScoreWithDotGhost(coords: PixelCoordinates): boolean {
    return this.renderer.renderScoreWithDotGhost(coords.x, coords.y)
  }

  /** Ghost tremolo MARK at the cursor — see {@link VexFlowRenderer.renderScoreWithTremoloGhost}. */
  renderScoreWithTremoloGhost(coords: PixelCoordinates, mark: TremoloMark): boolean {
    return this.renderer.renderScoreWithTremoloGhost(coords.x, coords.y, mark)
  }

  /** Ghost REST at the cursor, showing the armed length (duration + dots) — see
   *  {@link VexFlowRenderer.renderScoreWithRestGhost}. */
  renderScoreWithRestGhost(coords: PixelCoordinates, duration: NoteDuration, dots: number): boolean {
    return this.renderer.renderScoreWithRestGhost(coords.x, coords.y, duration, dots)
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
    const numStaves = Math.max(1, staffList.length)
    const staffStride = LAYOUT_CONFIG.STAVE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING
    // Client #7 staff-spacing pushes the lower staves further down. `b.measureY` is staff 0's
    // real drawn top (already reflects its own space-above), so extend the height by the extra
    // space introduced BETWEEN staff 0 and the last staff — the sum of every lower staff's
    // space-above (staff 0's own doesn't grow this bar's span). Resolve PER-SYSTEM against the
    // opening measure of the system this bar sits on (plan option C).
    const openerNum = this.renderer.getSystemOpeningMeasureNumber(measureNumber)
    const openingMeasureId = openerNum !== undefined ? this.scoreModel.getMeasure(openerNum)?.id : undefined
    let betweenPx = 0
    for (let i = 1; i < staffList.length; i++) {
      betweenPx += resolveStaffSpacingAbove(score, staffList[i].id, openingMeasureId) * VEXFLOW_DEFAULT_STAFF_SPACE_PX
    }
    // Top of staff 0 → bottom of the last staff (the trailing inter-staff gap is not part of
    // the bar, so subtract one VERTICAL_SPACING from a naive numStaves*staffStride).
    const height = (numStaves - 1) * staffStride + LAYOUT_CONFIG.STAVE_HEIGHT + betweenPx
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
  getSlurSVGGroup(slurId: string): SVGGElement | null {
    return this.renderer.getSlurSVGGroup(slurId)
  }

  /** The rendered SVG group (`<g class="vf-tie">`) for a tie, keyed by its from-note id.
   *  Lets the highlight recolor exactly one tie for the selection highlight (no
   *  document-wide bbox scan, which bled onto staff lines). */
  getTieSVGGroup(fromNoteId: string): SVGGElement | null {
    return this.renderer.getTieSVGGroup(fromNoteId)
  }

  /** Suppress one dynamic from rendering (null = restore). Re-render to apply.
   *  Used by the in-canvas text editor to remove the engraved glyph while editing. */
  setSuppressedDynamicId(dynamicId: string | null): void {
    this.renderer.setSuppressedDynamicId(dynamicId)
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
