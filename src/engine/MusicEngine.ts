import { ScoreModel, type ClipDynamicInput, type ClipSlurInput } from './models/ScoreModel'
import { restPositionKey, restShiftOverrideOf, restHiddenOf, resolveStaffSpacingAbove, staffSystemSpacingKey, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from './models/engravingOverrides'
import { VexFlowRenderer, LAYOUT_CONFIG } from './rendering/VexFlowRenderer'
import type { ViewMode, GutterState, GutterStaffState } from './rendering/layoutConfig'
import type { Rect } from './ViewportModel'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { UndoRedoManager } from './UndoRedoManager'
import { NoteEntryCoordinator, INVALID_NOTE_ENTRY_TYPES } from './NoteEntryCoordinator'
import { getStaves, staffIdAtIndex } from './models/staffContent'
import { midiToNoteName, beatToFrac, measureCapacityQuarters, compareByPosition, getMeasureNotes } from '@/utils/musicUtils'
import { fracToNumber, fracEq, fracLt, fracCompare } from '@/utils/fraction'
import { quantizeBeat } from '@/utils/durations'
import { spellingToMidi, accidentalToAlter, spellingDiatonicPos } from '@/utils/pitchSpelling'
import { naturalStemDirection } from '@/utils/clefUtils'
import type { Score, Note, NoteParams, Fraction, PixelCoordinates, Tuplet, NoteDuration, ArticulationType, Accidental, PitchSpelling, GhostNote, Clef, TimeSignature, Dynamic, DynamicLevel, TempoMark, Slur, PitchAlter, CurveControlPointDeltas, SlurSegmentAddress, SlurSegmentEndpointAddress } from '@/types/music'
import { dynamicLabel } from '@/utils/dynamics'
import { tempoLabel } from '@/utils/tempoMap'
import type { ElementRegistry, ElementInfo } from './ElementRegistry'
import type { RebarEvent } from '@/utils/rebar'

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

  /** Mark the data model as changed so the next render repairs measure gaps. */
  private markModelDirty(): void {
    this.modelDirty = true
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
   * was "did the content actually differ". They diverge for an operation that saves without
   * changing anything (setting a value to what it already was) — that now pushes a no-op undo
   * step, costing one wasted Ctrl-Z rather than a wrong picture.
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
   * Get description of action that would be undone
   */
  getUndoDescription(): string | null {
    return this.undoRedoManager.getUndoDescription()
  }

  /**
   * Get description of action that would be redone
   */
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
      console.log('Cannot remove the last remaining measure')
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
  ): string[] {
    const ids = this.scoreModel.pasteEvents(measure, beat, lanes, spanBeats, targetVoice, clipRestShifts, clipRestHidden, targetStaff, clipDynamics, clipSlurs)
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
    voice: NoteParams['voice'] = 0
  ): Note | null {
    return this.noteEntryCoordinator.addNoteAtPosition(coords, duration, accidental, dots, articulations, beam, voice)
  }

  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction): Note {
    const rest = this.scoreModel.addRest(duration, measure, beat)
    this.commit('Add rest')
    return rest
  }

  // --- Mutation ---

  /** Returns all non-rest notes at the given beat in a measure (chord members). */
  private getChordNotesAt(measureNumber: number, beat: Fraction, voice: number = 0): Note[] {
    return this.scoreModel.getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && (n.voice ?? 0) === voice && fracEq(n.beat, beat))
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
   * Toggle an articulation on a note. Adds if absent, removes if present.
   */
  toggleArticulation(noteId: string, type: ArticulationType): Note | null {
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
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    const fmt = (n: typeof note) => n.isRest ? `rest` : `${n.step}${n.alter === 2 ? '##' : n.alter === 1 ? '#' : n.alter === -1 ? 'b' : n.alter === -2 ? 'bb' : ''}${n.octave} m${n.measure} beat:${fracToNumber(n.beat).toFixed(3)}`
    console.log(`[Tie] toggleTie | source: ${fmt(note)}`)

    if (note.tiedTo) {
      const tiedToNote = this.scoreModel.getNote(note.tiedTo)
      console.log(`[Tie] removing existing tie → was tied to: ${tiedToNote ? fmt(tiedToNote) : 'NOT FOUND'}`)
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
      const stream = allSlots.filter(n => (n.voice ?? 0) === (source.voice ?? 0) && (n.staff ?? 0) === (source.staff ?? 0))
      const nextStart = stream.find(n => compareByPosition(n, source) > 0)
      if (!nextStart) {
        console.log(`[Tie] no next slot found — tie not created`)
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
      console.log(`[Tie] tying to next slot: ${fmt(nextNote)}`)

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
      const stream = all.filter((n) => (n.voice ?? 0) === (source.voice ?? 0) && (n.staff ?? 0) === (source.staff ?? 0))
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
    // A slur lives in ONE voice. Derive it from the selection (the first resolved
    // note's voice) and keep only that voice's notes — so a voice-2 selection makes a
    // voice-2 slur. (Was hardcoded to voice 0, so `s` did nothing in any other voice.)
    const resolved = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n)
    if (resolved.length === 0) return null

    const slurVoice = resolved[0].voice ?? 0
    const slurStaff = resolved[0].staff ?? 0
    const selected = resolved
      .filter(n => (n.voice ?? 0) === slurVoice && (n.staff ?? 0) === slurStaff)
      .sort(compareByPosition)
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
    const key = restPositionKey(measure.id, note.voice ?? 0, note.beat)
    const ok = this.scoreModel.nudgeRestShift(key, delta)
    if (ok) {
      this.saveOnly('Nudge rest')
      const steps = restShiftOverrideOf(this.scoreModel.getScore(), key)?.steps ?? 0
      console.log(`[Rest] ${delta > 0 ? '↑' : '↓'} shift rest ${restId} (${key}) by ${delta} → total ${steps} step(s)`)
    }
    return ok
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
      console.log(`[Staff/linear] ${delta > 0 ? '↓' : '↑'} view spacing above staff ${staffIndex} by ${delta} → ${above} ss (view only, not saved)`)
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    const above = this.clampSpacingAbove(resolveStaffSpacingAbove(this.scoreModel.getScore(), t.staffId, t.openingMeasureId) + delta)
    this.scoreModel.setStaffSpacing(t.key, above) // absolute; clears at 0
    this.saveOnly('Nudge staff spacing')
    console.log(`[Staff] ${delta > 0 ? '↓' : '↑'} space above staff ${staffIndex} @sys(${t.openingMeasureId}) by ${delta} → ${above} ss`)
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
      console.log(`[Staff/linear] reset view spacing above staff ${staffIndex}`)
      return true
    }
    const t = this.staffSpacingTarget(staffIndex, measureNumber)
    if (!t) return false
    const removed = this.scoreModel.resetStaffSpacing(t.key)
    if (removed) {
      this.saveOnly('Reset staff spacing')
      console.log(`[Staff] reset space above staff ${staffIndex} @sys(${t.openingMeasureId})`)
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
   * A no-op for a non-rest / missing id. NO undo snapshot here — the multi-rest batch in the
   * shortcut handler owns the single snapshot (mirroring how Delete batches articulations).
   * @returns true if a rest was toggled.
   */
  toggleRestHidden(restId: string): boolean {
    const note = this.scoreModel.getNote(restId)
    if (!note || !note.isRest) return false
    const measure = this.scoreModel.getMeasure(note.measure)
    if (!measure) return false
    const key = restPositionKey(measure.id, note.voice ?? 0, note.beat)
    const nowHidden = !restHiddenOf(this.scoreModel.getScore(), key)
    this.scoreModel.toggleRestHidden(key)
    console.log(`[Rest] ${nowHidden ? 'hide' : 'show'} rest ${restId} (${key})`)
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
  private nextDistinctSlot(start: Note): Note | undefined {
    // Stay within the start note's own voice AND staff — a slur's end anchor must be the
    // next slot in the SAME stream, not whatever event comes next in another voice/staff.
    const startVoice = start.voice ?? 0
    const startStaff = start.staff ?? 0
    const sorted = this.scoreModel.getAllNotes()
      .filter(n => (n.voice ?? 0) === startVoice && (n.staff ?? 0) === startStaff)
      .sort(compareByPosition)
    const idx = sorted.findIndex(n => n.id === start.id)
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
    let active: PitchAlter = 0
    const preceding = getMeasureNotes(measure)
      .filter(n => !n.isRest && !n.tiedFrom && n.step !== undefined && fracLt(n.beat, note.beat))
      .sort((a, b) => fracCompare(a.beat, b.beat))
    for (const n of preceding) {
      if (spellingDiatonicPos(n.step!, n.octave!) === targetPos) active = n.alter ?? 0
    }
    return active
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

    // Check if this note is part of a chord (multiple notes at same beat, same measure)
    const notesAtSameBeat = this.getChordNotesAt(note.measure, note.beat, note.voice ?? 0)
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
      if (tuplet) this.scoreModel.refillTupletRemainder(note.measure, tuplet, note.voice ?? 0)
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

    return this.runBatch(`Move ${ordered.length} note(s) to voice ${targetVoice + 1}`, () => {
      for (const { id } of ordered) this.moveNoteToVoice(id, targetVoice, movingIds)
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
    voice: number = 0
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtPosition(coords, duration, spelling, numNotes, notesOccupied, voice)
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
    staff: number = 0
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtBeat(measureNumber, beat, duration, spelling, numNotes, notesOccupied, voice, staff)
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
    const note = this.scoreModel.getNote(noteId)
    if (!note || note.isRest) return null

    let newDirection: 'auto' | 'up' | 'down'

    if (note.stemDirection === 'up' || note.stemDirection === 'down') {
      // Already forced — toggle back to auto
      newDirection = 'auto'
    } else {
      // Auto state — compute natural direction and force the opposite
      const clef = this.scoreModel.getEffectiveClefAt(note.measure, note.beat, this.staffIdForIndex(note.staff))
      const natural = naturalStemDirection(note.step!, note.octave!, clef)
      newDirection = natural === 'down' ? 'up' : 'down'
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
    if (this.modelDirty) {
      this.scoreModel.repairAllMeasureGaps()
      this.modelDirty = false
    }
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
    ghostColor?: { fill: string; stroke: string }
  ): boolean {
    const measure = this.scoreModel.getMeasure(1)
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

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.renderer.clear()
  }

  /**
   * Re-initialize renderer with new dimensions
   */
  resizeCanvas(width: number, height: number): void {
    this.renderer.initialize(width, height)
    this.renderScore()
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
    if (nearestElement && nearestElement.beat !== undefined) {
      const elementCenterX = nearestElement.bbox.x + nearestElement.bbox.width / 2
      const distance = Math.abs(coords.x - elementCenterX)
      if (distance < nearestElement.bbox.width * 1.5) {
        beat = nearestElement.beat
      } else {
        beat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, barQuarters)
        if (duration) beat = quantizeBeat(beat, duration, barQuarters)
      }
    } else {
      beat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, barQuarters)
      if (duration) beat = quantizeBeat(beat, duration, barQuarters)
    }

    return { measure: measureNumber, beat, spelling, staff }
  }

  /**
   * Convert note to pixel coordinates
   */
  noteToPixel(note: Note, barQuarters: number): PixelCoordinates {
    return this.coordinateMapper.noteToPixel(note, barQuarters)
  }

  /**
   * Update coordinate mapper configuration
   */
  updateCoordinateConfig(config: Partial<CoordinateMapperConfig>): void {
    this.coordinateMapper.updateConfig(config)
  }

  // ==================== Collision Detection ====================

  /**
   * Check if a note would collide
   */
  checkCollision(noteParams: NoteParams) {
    return this.collisionDetector.checkNoteCollision(noteParams, this.scoreModel.getAllNotes())
  }

  /**
   * Check if adding a note would overflow the measure
   */
  checkOverflow(noteParams: NoteParams) {
    const measure = this.scoreModel.getMeasure(noteParams.measure)
    if (!measure) return null

    return this.collisionDetector.checkMeasureOverflow(
      noteParams,
      measure,
      this.scoreModel.getNotesInMeasure(noteParams.measure)
    )
  }

  /**
   * Find next available position for a note
   */
  findNextAvailablePosition(duration: string, measureNumber: number) {
    const measure = this.scoreModel.getMeasure(measureNumber)
    if (!measure) return null

    return this.collisionDetector.findNextAvailablePosition(
      duration,
      measure,
      this.scoreModel.getNotesInMeasure(measureNumber)
    )
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
   * Seek to a specific measure
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
   * Get playback position
   */
  getPlaybackPosition() {
    return this.playbackEngine.getPosition()
  }

  /**
   * Set playback volume (0-1)
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
