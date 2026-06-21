import { ScoreModel } from './models/ScoreModel'
import { VexFlowRenderer, LAYOUT_CONFIG } from './rendering/VexFlowRenderer'
import type { Rect } from './ViewportModel'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { UndoRedoManager } from './UndoRedoManager'
import { NoteEntryCoordinator, INVALID_NOTE_ENTRY_TYPES } from './NoteEntryCoordinator'
import { durationToBeats, midiToNoteName, beatToFrac, measureCapacityQuarters, compareByPosition } from '@/utils/musicUtils'
import { fracToNumber, fracEq, fracAdd } from '@/utils/fraction'
import { durationToFraction, quantizeBeat } from '@/utils/durations'
import { spellingToMidi, accidentalToAlter } from '@/utils/pitchSpelling'
import { naturalStemDirection } from '@/utils/clefUtils'
import type { Score, Note, NoteParams, Fraction, PixelCoordinates, Tuplet, NoteDuration, ArticulationType, Measure, Accidental, PitchSpelling, GhostNote, Clef, TimeSignature, Dynamic, DynamicLevel, Slur } from '@/types/music'
import { dynamicLabel } from '@/utils/dynamics'
import type { ElementRegistry, ElementInfo } from './ElementRegistry'
import type { RebarEvent } from '@/utils/rebar'

/**
 * Tolerance for comparing FLOAT beat values at the pixel/quantization boundary.
 * Beats are exact `Fraction`s in the model; this epsilon only guards the float
 * round-trip (see the Fraction/float invariant in docs/ARCHITECTURE.md). New code
 * should prefer fracCompare/fracEq over this.
 */
const BEAT_EPSILON = 0.001

/** Internal context passed to updateNote sub-methods */
interface NoteUpdateCtx {
  noteId: string
  updates: Partial<NoteParams>
  existingNote: Note
  measureNotes: Note[]
  chordNotes: Note[]
  isChord: boolean
  oldBeats: number
  newBeats: number
  newDuration: NoteDuration
  newDots: number
  beatDifference: number
}

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
      staffHeight: 120 + 30, // staveHeight + verticalSpacing
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

  /**
   * Run several mutations as ONE undoable action. Every saveUndoState inside `fn`
   * is suppressed; a single snapshot of the final state is pushed afterward (only
   * if `fn` actually changed something). One Ctrl-Z then restores the whole group
   * (e.g. deleting or transposing a multi-note selection), not one element at a
   * time. Nested batches are flattened — only the outermost pushes.
   *
   * @returns true if a snapshot was pushed (something changed), false otherwise.
   */
  runBatch(description: string, fn: () => void): boolean {
    if (this.undoSuppressed) { fn(); return false } // inner batch: outer owns the snapshot

    const before = JSON.stringify(this.scoreModel.getScore())
    this.undoSuppressed = true
    try {
      fn()
    } finally {
      this.undoSuppressed = false
    }
    const changed = JSON.stringify(this.scoreModel.getScore()) !== before
    if (changed) this.saveUndoState(description)
    return changed
  }

  /**
   * Save current state to undo history (call after mutations)
   */
  private saveUndoState(description: string): void {
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
   * Undo the last action
   * @returns true if undo was successful
   */
  undo(): boolean {
    const previousState = this.undoRedoManager.undo()
    if (!previousState) return false

    // Restore the state
    this.scoreModel = ScoreModel.fromJSON(JSON.stringify(previousState))
    this.playbackEngine.setScore(this.scoreModel.getScore())
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
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scoreModel.setTempo(tempo)
    this.commit(`Set tempo to ${tempo}`)
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
    this.saveOnly('Add measure')
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

  // ==================== Clef Operations ====================

  /** Clef drawn at the start of a measure (its beat-0 change, or inherited). */
  getEffectiveClef(measureNumber: number): Clef {
    return this.scoreModel.getEffectiveClef(measureNumber)
  }

  /** Resolve the clef in effect at a position (measure, beat). */
  getEffectiveClefAt(measureNumber: number, beat: Fraction): Clef {
    return this.scoreModel.getEffectiveClefAt(measureNumber, beat)
  }

  /**
   * Set/change the clef at (measure, beat). `beat` must be a slot-boundary beat.
   * Clef is visual-only, so playback is unaffected. Saves undo state when changed.
   * @returns true if the score changed.
   */
  setClefAt(measureNumber: number, beat: Fraction, clef: Clef): boolean {
    const changed = this.scoreModel.setClefAt(measureNumber, beat, clef)
    if (changed) {
      this.commit(`Set ${clef} clef at measure ${measureNumber} beat ${fracToNumber(beat)}`)
    }
    return changed
  }

  /**
   * Remove a clef change at (measure, beat), reverting to the inherited clef.
   * Measure 1 / beat 0 cannot be removed (only changed). Saves undo state when changed.
   * @returns true if a change was removed.
   */
  removeClefAt(measureNumber: number, beat: Fraction): boolean {
    const changed = this.scoreModel.removeClefAt(measureNumber, beat)
    if (changed) {
      this.commit(`Remove clef at measure ${measureNumber} beat ${fracToNumber(beat)}`)
    }
    return changed
  }

  // --- Measure-level (beat 0) convenience wrappers ---

  /** Set the measure's opening clef (beat 0). */
  setClef(measureNumber: number, clef: Clef): boolean {
    return this.setClefAt(measureNumber, beatToFrac(0), clef)
  }

  /** Remove the measure's opening clef (beat 0). */
  removeClef(measureNumber: number): boolean {
    return this.removeClefAt(measureNumber, beatToFrac(0))
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
  pasteEvents(measure: number, beat: Fraction, events: RebarEvent[], spanBeats: Fraction): string[] {
    const ids = this.scoreModel.pasteEvents(measure, beat, events, spanBeats)
    this.commit('Paste')
    return ids
  }

  addNoteAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: Accidental,
    dots?: number,
    articulations?: ArticulationType[],
    beam?: NoteParams['beam']
  ): Note | null {
    return this.noteEntryCoordinator.addNoteAtPosition(coords, duration, accidental, dots, articulations, beam)
  }

  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction): Note {
    const rest = this.scoreModel.addRest(duration, measure, beat)
    this.commit('Add rest')
    return rest
  }

  // --- Mutation ---

  /** Returns all non-rest notes at the given beat in a measure (chord members). */
  private getChordNotesAt(measureNumber: number, beat: Fraction): Note[] {
    return this.scoreModel.getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && fracEq(n.beat, beat))
  }

  /**
   * Update a note.
   * Dispatches to updateTupletNote or updateNonTupletNote based on context.
   * When duration is shortened, fills the gap with rests.
   * When duration is lengthened, removes overlapping notes/rests.
   * Duration is limited to fit within the current measure (no bar line crossing).
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const existingNote = this.scoreModel.getNote(noteId)
    if (!existingNote) throw new Error(`Note ${noteId} not found`)

    const oldDuration = existingNote.duration
    const oldDots = existingNote.dots || 0
    let newDuration = updates.duration || oldDuration
    // Handle dots: if dots is explicitly set in updates (even to 0), use it; otherwise keep old
    const newDots = updates.dots !== undefined ? updates.dots : oldDots

    const measureNotes = this.scoreModel.getNotesInMeasure(existingNote.measure)
    const chordNotes = this.getChordNotesAt(existingNote.measure, existingNote.beat)
    const isChord = chordNotes.length > 1

    // Check for measure overflow (considering dots)
    const measure = this.scoreModel.getMeasure(existingNote.measure)
    if (measure && (updates.duration || updates.dots !== undefined)) {
      const measureTotalBeats = measureCapacityQuarters(measure)
      const availableBeats = measureTotalBeats - fracToNumber(existingNote.beat)
      const requestedBeats = durationToBeats(newDuration, newDots)

      // Tuplet overflow is handled by updateTupletNote (which uses the correct tuplet ratio).
      // Measure-level overflow only applies to non-tuplet notes.
      if (requestedBeats > availableBeats + BEAT_EPSILON && !existingNote.tupletId) {
        if (!existingNote.isRest) {
          // Non-tuplet, non-rest overflow: split with tie across the barline (Dorico-style)
          const overflowAmount = requestedBeats - availableBeats
          const oldNoteEnd = fracToNumber(existingNote.beat) + durationToBeats(oldDuration, oldDots)

          // Clear notes in the current measure that fall within the newly extended range
          for (const n of measureNotes) {
            if (n.id === noteId || chordNotes.some(c => c.id === n.id)) continue
            const nStart = fracToNumber(n.beat)
            if (nStart >= oldNoteEnd - BEAT_EPSILON && nStart < fracToNumber(existingNote.beat) + availableBeats - BEAT_EPSILON) {
              this.scoreModel.deleteNote(n.id)
            }
          }

          // Split chord members (other notes at the same beat)
          for (const chordNote of chordNotes) {
            if (chordNote.id === noteId) continue
            this.noteEntryCoordinator.splitExistingNoteWithTie(chordNote, newDuration, overflowAmount, newDots)
          }

          // Split the target note itself
          this.noteEntryCoordinator.splitExistingNoteWithTie(existingNote, newDuration, overflowAmount, newDots)

          this.commit('Update note duration')
          return this.scoreModel.getNote(noteId)!
        }

        // Non-tuplet rest overflow: clip to fit within the measure
        const fittingDuration = this.findLargestFittingDuration(availableBeats)
        if (fittingDuration) {
          newDuration = fittingDuration
          updates = { ...updates, duration: fittingDuration, dots: 0 }
        } else {
          // No standard duration fits, keep the old duration
          newDuration = oldDuration
          delete updates.duration
          delete updates.dots
        }
      }
    }

    const oldBeats = durationToBeats(oldDuration, oldDots)
    const newBeats = durationToBeats(newDuration, newDots)
    const beatDifference = oldBeats - newBeats

    const ctx: NoteUpdateCtx = {
      noteId, updates, existingNote, measureNotes,
      chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference,
    }

    // Tuplet notes have special duration constraints and filler rest logic
    if (existingNote.tupletId && measure) {
      const tuplet = measure.tuplets?.find(t => t.id === existingNote.tupletId)
      if (tuplet) return this.updateTupletNote(ctx, measure, tuplet)
    }

    return this.updateNonTupletNote(ctx)
  }

  /** Handles duration updates for notes inside a tuplet. */
  private updateTupletNote(ctx: NoteUpdateCtx, _measure: Measure, tuplet: Tuplet): Note {
    let { noteId, updates, existingNote, measureNotes, chordNotes, isChord, newBeats, newDuration, newDots } = ctx

    const tupletRatio = tuplet.notesOccupied / tuplet.numNotes
    const tupletTotalBeats = durationToBeats(tuplet.baseDuration) * tuplet.notesOccupied
    const tupletEndBeat = fracToNumber(tuplet.startBeat) + tupletTotalBeats
    // Remaining space runs from this note's start to the tuplet end
    const remainingTupletBeats = tupletEndBeat - fracToNumber(existingNote.beat)

    // Clamp new duration if it exceeds remaining tuplet space
    const scaledNewDuration = newBeats * tupletRatio
    if (scaledNewDuration > remainingTupletBeats + BEAT_EPSILON) {
      const maxNormalBeats = remainingTupletBeats / tupletRatio
      const fittingDuration = this.findLargestFittingDuration(maxNormalBeats)
      if (fittingDuration) {
        newDuration = fittingDuration
        updates = { ...updates, duration: fittingDuration, dots: 0 }
        newBeats = durationToBeats(fittingDuration)
      } else {
        return existingNote
      }
    }

    // Delete any tuplet items that fall inside the new note's actual time span
    const actualNewDuration = newBeats * tupletRatio
    const noteEndBeat = fracToNumber(existingNote.beat) + actualNewDuration
    const existingBeatNum = fracToNumber(existingNote.beat)
    const itemsToDelete = measureNotes.filter(n =>
      n.tupletId === existingNote.tupletId &&
      n.id !== noteId &&
      fracToNumber(n.beat) > existingBeatNum + BEAT_EPSILON &&
      fracToNumber(n.beat) < noteEndBeat - BEAT_EPSILON
    )
    for (const item of itemsToDelete) this.scoreModel.deleteNote(item.id)

    const updatedNote = this.scoreModel.updateNote(noteId, updates)

    // Recompute all filler rests from the fill pointer
    this.scoreModel.refillTupletRemainder(existingNote.measure, tuplet)

    // Also update chord notes to keep duration in sync
    if (isChord) {
      for (const chordNote of chordNotes) {
        if (chordNote.id !== noteId) {
          this.scoreModel.updateNote(chordNote.id, { duration: newDuration, dots: newDots })
        }
      }
    }

    this.commit('Update tuplet note')
    return updatedNote
  }

  /** Handles duration updates for regular (non-tuplet) notes, both chords and singles. */
  private updateNonTupletNote(ctx: NoteUpdateCtx): Note {
    const { noteId, updates, existingNote, measureNotes, chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference } = ctx

    // If duration is being lengthened, remove overlapping notes/rests first
    if (beatDifference < -BEAT_EPSILON) {
      const existingBeatNum = fracToNumber(existingNote.beat)
      const noteEndBeat = existingBeatNum + newBeats
      const chordNoteIds = new Set(chordNotes.map(n => n.id))
      const notesToRemove: string[] = []
      let beatsToRecover = 0

      for (const n of measureNotes) {
        if (n.id === noteId || chordNoteIds.has(n.id)) continue
        const nStart = fracToNumber(n.beat)
        const nEnd = nStart + durationToBeats(n.duration, n.dots || 0)
        // Note starts within the extended range - remove it entirely
        if (nStart >= existingBeatNum + oldBeats && nStart < noteEndBeat) {
          notesToRemove.push(n.id)
          beatsToRecover += durationToBeats(n.duration, n.dots || 0)
        // Note starts before but extends into the range - remove it
        } else if (nStart < existingBeatNum + oldBeats && nEnd > existingBeatNum + oldBeats && nEnd <= noteEndBeat) {
          notesToRemove.push(n.id)
          beatsToRecover += durationToBeats(n.duration, n.dots || 0)
        }
      }

      for (const id of notesToRemove) this.scoreModel.deleteNote(id)

      // If we removed more beats than needed, add rests to fill the excess
      const excessBeats = beatsToRecover - Math.abs(beatDifference)
      if (excessBeats > BEAT_EPSILON) {
        this.scoreModel.fillGapWithRests(
          existingNote.measure,
          fracAdd(existingNote.beat, durationToFraction(newDuration, newDots)),
          excessBeats,
        )
      }
    }

    // For chords, update all members' duration and dots so they stay in sync
    if (isChord && (updates.duration || updates.dots !== undefined)) {
      for (const chordNote of chordNotes) {
        if (chordNote.id === noteId) continue
        this.scoreModel.updateNote(chordNote.id, { duration: newDuration, dots: newDots })
      }
    }

    // Apply all requested updates to the target note
    const note = this.scoreModel.updateNote(noteId, updates)

    // If duration was shortened, fill the freed space with rests.
    if (beatDifference > BEAT_EPSILON) {
      if (existingNote.isRest) {
        // Meter-aware refill: the shortened rest's remainder is regrouped for the
        // bar's meter. This both fixes the bar length (a former measure rest's
        // nominal 'w' is 4 quarters, not the real bar length) and groups rests
        // correctly in compound/irregular meters — the legacy float splitter
        // below does neither.
        this.scoreModel.fillMeasureGaps(note.measure)
      } else {
        this.scoreModel.fillGapWithRests(
          note.measure,
          fracAdd(note.beat, durationToFraction(newDuration, newDots)),
          beatDifference,
        )

        // Break tiedTo if the shortened note no longer abuts its tie target
        if (note.tiedTo) {
          const tiedTarget = this.scoreModel.getNote(note.tiedTo)
          if (tiedTarget) {
            const noteEnd = fracToNumber(note.beat) + durationToBeats(newDuration, newDots)
            const targetBeat = fracToNumber(tiedTarget.beat)
            if (Math.abs(noteEnd - targetBeat) > BEAT_EPSILON || note.measure !== tiedTarget.measure) {
              console.log(`[Tie] broken — ${note.step}${note.octave} m${note.measure} no longer abuts tied target after duration change`)
              this.scoreModel.updateNote(note.id, { tiedTo: undefined })
              this.scoreModel.updateNote(tiedTarget.id, { tiedFrom: undefined })
            }
          }
        }
      }
    }

    this.commit('Update note')
    return note
  }

  /**
   * Find the largest standard note duration that fits within available beats
   */
  private findLargestFittingDuration(availableBeats: number): NoteParams['duration'] | null {
    const durations: { duration: NoteParams['duration']; beats: number }[] = [
      { duration: 'w', beats: 4 },
      { duration: 'h', beats: 2 },
      { duration: 'q', beats: 1 },
      { duration: '8', beats: 0.5 },
      { duration: '16', beats: 0.25 },
      { duration: '32', beats: 0.125 },
    ]

    for (const { duration, beats } of durations) {
      if (beats <= availableBeats + BEAT_EPSILON) {
        return duration
      }
    }
    return null
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
      // Tie to the immediately next slot (rest or note — no pitch filter)
      const allSlots = this.scoreModel.getAllNotes()
        .sort(compareByPosition)
      const idx = allSlots.findIndex(n => n.id === noteId)
      const nextNote = allSlots[idx + 1]
      if (!nextNote) {
        console.log(`[Tie] no next slot found — tie not created`)
        return null
      }
      console.log(`[Tie] tying to next slot: ${fmt(nextNote)}`)

      this.scoreModel.updateNote(noteId, { tiedTo: nextNote.id })
      this.scoreModel.updateNote(nextNote.id, { tiedFrom: noteId })
      this.commit('Add tie')
      return true
    }
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
    // Resolve selected ids → flat notes, keep voice 0 only, sort by (measure, beat).
    const selected = noteIds
      .map(id => this.scoreModel.getNote(id))
      .filter((n): n is Note => !!n && (n.voice ?? 0) === 0)
      .sort(compareByPosition)
    if (selected.length === 0) return null

    const startNote = selected[0]
    const endNote = selected.length >= 2
      ? selected[selected.length - 1]
      : this.nextDistinctSlot(startNote)
    if (!endNote || endNote.id === startNote.id) return null

    const existing = this.scoreModel.findSlurByEndpoints(startNote.id, endNote.id)
    if (existing) return existing // idempotent — never duplicate, never remove

    const created = this.scoreModel.addSlur({ startNoteId: startNote.id, endNoteId: endNote.id, voice: 0 })
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
   *  control-point deltas; see {@link Slur.cps}). Saves one undo step on success.
   *  @returns true if the slur exists and was updated. */
  setSlurShape(id: string, cps: Slur['cps'] | null): boolean {
    const updated = this.scoreModel.setSlurShape(id, cps)
    if (updated) this.saveOnly(cps ? 'Reshape slur' : 'Reset slur shape')
    return updated
  }

  /** Live (preview) shape update used **while dragging a slur handle** — mutates the
   *  slur's `cps` but does NOT record undo. Call {@link commitSlurShape} on drop to
   *  push the single undo entry (mirrors `moveClef` / `commitClefMove`). */
  previewSlurShape(id: string, cps: Slur['cps']): boolean {
    return this.scoreModel.setSlurShape(id, cps)
  }

  /** Record one undo entry after a slur-handle drag settles. */
  commitSlurShape(): void {
    this.saveOnly('Reshape slur')
  }

  /** Live (preview) re-anchor used **while dragging a slur endpoint handle** — moves
   *  one end of the slur onto `noteId` and resets its custom shape, WITHOUT recording
   *  undo. Returns false (no-op) when the target is invalid (collapses the span or is
   *  unchanged). Call {@link commitSlurEndpoint} on drop for the single undo entry. */
  previewSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
    return this.scoreModel.setSlurEndpoint(id, which, noteId)
  }

  /** Record one undo entry after a slur-endpoint re-anchor drag settles. */
  commitSlurEndpoint(): void {
    this.saveOnly('Re-anchor slur')
  }

  /** Flip a slur to the opposite side (above ↔ below). Sets an explicit `placement`
   *  that overrides auto stem-based placement. For an auto-placed slur the flip targets
   *  the opposite of whatever was last *drawn* (read from the registry), so the first
   *  press always visibly flips. Saves one undo step. @returns true if it flipped. */
  flipSlur(id: string): boolean {
    const slur = this.scoreModel.getSlurById(id)
    if (!slur) return false
    let currentDir: number
    if (slur.placement === 'above') currentDir = -1
    else if (slur.placement === 'below') currentDir = 1
    else {
      // Best-effort: read the side the renderer last drew (auto placement). Guarded
      // so a stubbed/headless renderer just falls back to "above".
      const el = this.renderer.getElementRegistry?.()?.getByType?.('slur').find(e => e.id === id)
      currentDir = el?.slurDirection ?? -1 // default: treat as above
    }
    slur.placement = currentDir === -1 ? 'below' : 'above'
    this.saveOnly('Flip slur')
    return true
  }

  /** Flip the tie starting at `fromNoteId` to the opposite curve direction (up ↔ down).
   *  A tie stays flat and notehead-anchored, so this only inverts the arc (and its
   *  endpoint lift), unlike {@link flipSlur} which is stem-aware. Sets an explicit
   *  `tieDirection` override; for an auto tie the flip targets the opposite of whatever
   *  was last *drawn* (read from the registry) so the first press always visibly flips.
   *  Saves one undo step. @returns true if it flipped. */
  flipTie(fromNoteId: string): boolean {
    const pitch = this.scoreModel.getNotePitch(fromNoteId)
    if (!pitch || !pitch.tiedTo) return false
    let currentDir: number
    if (pitch.tieDirection !== undefined) currentDir = pitch.tieDirection
    else {
      // Best-effort: read the side the renderer last drew (auto placement). Guarded
      // so a stubbed/headless renderer just falls back to "down" (+1).
      const el = this.renderer.getElementRegistry?.()?.getByType?.('tie').find(e => e.fromNoteId === fromNoteId)
      currentDir = el?.tieDirection ?? 1
    }
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
   */
  private reanchorSlurs(oldId: string, newId: string | null): void {
    const slurs = this.scoreModel.getScore().slurs
    if (!slurs) return
    for (let i = slurs.length - 1; i >= 0; i--) {
      const s = slurs[i]
      if (s.startNoteId !== oldId && s.endNoteId !== oldId) continue
      if (newId === null) { slurs.splice(i, 1); continue }
      if (s.startNoteId === oldId) s.startNoteId = newId
      if (s.endNoteId === oldId) s.endNoteId = newId
      if (s.startNoteId === s.endNoteId) slurs.splice(i, 1)
    }
  }

  /**
   * The next slot after `start` whose `(measure, beat)` differs from it — i.e. the
   * next musical event, skipping sibling chord heads that share `start`'s beat.
   * `getAllNotes()` emits one entry per pitch, hence the dedupe.
   */
  private nextDistinctSlot(start: Note): Note | undefined {
    const sorted = this.scoreModel.getAllNotes()
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
    const notesAtSameBeat = this.getChordNotesAt(note.measure, note.beat)
    const isPartOfChord = notesAtSameBeat.length > 1

    // Save the tiedFrom source before deletion clears it.
    // When a single note is replaced by a rest, we re-link the source tie to the new rest
    // so the tie arc remains visible (the owner of the tie is the source, not the target).
    const tiedFromSourceId = !note.isRest && !isPartOfChord ? note.tiedFrom : undefined

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
      })

      // Re-link the source tie to the new rest so the tie arc is preserved
      if (tiedFromSourceId && replacementRest) {
        this.scoreModel.updateNote(tiedFromSourceId, { tiedTo: replacementRest.id })
        this.scoreModel.updateNote(replacementRest.id, { tiedFrom: tiedFromSourceId })
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
      if (tuplet) this.scoreModel.refillTupletRemainder(note.measure, tuplet)
      this.reanchorSlurs(noteId, null)
    }

    this.playbackEngine.setScore(this.scoreModel.getScore())
    if (result) {
      this.saveUndoState(description)
    }
    return result
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
    notesOccupied: number = 2
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtPosition(coords, duration, spelling, numNotes, notesOccupied)
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
    notesOccupied: number = 2
  ): { tuplet: Tuplet; firstNote: Note } | null {
    return this.noteEntryCoordinator.createTupletAtBeat(measureNumber, beat, duration, spelling, numNotes, notesOccupied)
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
   * Get the tuplet at a specific beat position in a measure
   */
  getTupletAtBeat(measureNumber: number, beat: Fraction): Tuplet | undefined {
    return this.scoreModel.getTupletAtBeat(measureNumber, beat)
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
      const clef = this.scoreModel.getEffectiveClefAt(note.measure, note.beat)
      const natural = naturalStemDirection(note.step!, note.octave!, clef)
      newDirection = natural === 'down' ? 'up' : 'down'
    }

    const updated = this.scoreModel.updateNote(noteId, { stemDirection: newDirection })
    this.commit('Flip stem direction')
    return updated
  }

  /**
   * Flip the side (above/below) of a note's articulations. Default placement is
   * auto (stem-derived); this stores an explicit override flipping to the other
   * side, and flips back on a repeat. No-op for rests / notes with no articulation.
   */
  flipArticulation(noteId: string): Note | null {
    const result = this.scoreModel.flipArticulationPlacement(noteId)
    if (!result) return null
    this.saveOnly('Flip articulation')
    return result
  }

  // ==================== Rendering Operations ====================

  /**
   * Render the score
   */
  renderScore(): void {
    // Repair any data model gaps before rendering (defensive safety net)
    this.scoreModel.repairAllMeasureGaps()
    this.renderer.renderScore(this.scoreModel.getScore())
    // Update coordinate mapper with actual VexFlow bounds
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
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
    articulations?: ArticulationType[]
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
        // Don't show ghost note over these elements
        this.renderScore()
        return false
      }
    }

    // Use centralized position calculation with duration for beat quantization
    const position = this.getPositionFromPixels(coords, barQuarters, duration)

    // Validate measure exists
    if (!this.scoreModel.getMeasure(position.measure)) {
      this.renderScore()
      return false
    }

    // Check if cursor is within valid staff area (note entry zone)
    const staffGeometry = registry.getStaffGeometry(position.measure)
    if (staffGeometry) {
      // Check if X is within the note entry area (between noteStartX and noteEndX)
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        // Cursor is outside the note entry area (over clef, time sig, or past barline)
        this.renderScore()
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
      rawX: coords.x,
      rawY: coords.y,
      ...(dots && { dots }),
      ...(articulations?.length && { articulations }),
    }

    // Pass raw cursor coordinates for smooth visual positioning
    const ghostNoteRendered = this.renderer.renderScoreWithGhostNote(
      this.scoreModel.getScore(),
      ghostNote
    )

    // Update coordinate mapper with actual VexFlow bounds
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    return ghostNoteRendered
  }

  /**
   * Render the score with a free-floating translucent ghost clef that follows the
   * cursor. The clef glyph tracks the mouse anywhere on the canvas; on click it is
   * applied to whichever measure was clicked (see MouseController).
   * @returns true if a ghost clef was drawn, false otherwise
   */
  renderScoreWithClefGhost(coords: PixelCoordinates, clef: Clef): boolean {
    const drawn = this.renderer.renderScoreWithClefGhost(this.scoreModel.getScore(), coords.x, coords.y, clef)
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    return drawn
  }

  /**
   * Render the score with a free-floating translucent ghost time signature that
   * follows the cursor; on click it is applied to the clicked measure.
   * @returns true if a ghost time signature was drawn, false otherwise
   */
  renderScoreWithTimeSignatureGhost(coords: PixelCoordinates, ts: TimeSignature): boolean {
    const drawn = this.renderer.renderScoreWithTimeSignatureGhost(this.scoreModel.getScore(), coords.x, coords.y, ts)
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    return drawn
  }

  /**
   * Render the score with a free-floating translucent ghost dynamic that follows
   * the cursor; on click it is applied to the clicked slot.
   * @returns true if a ghost dynamic was drawn, false otherwise
   */
  renderScoreWithDynamicGhost(coords: PixelCoordinates, dynamic: Dynamic): boolean {
    const drawn = this.renderer.renderScoreWithDynamicGhost(this.scoreModel.getScore(), coords.x, coords.y, dynamic)
    this.coordinateMapper.setMeasureBounds(this.renderer.getAllMeasureBounds())
    return drawn
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
  pixelToPosition(coords: PixelCoordinates, barQuarters: number): { measure: number; beat: Fraction; spelling: PitchSpelling } {
    const { measure, beat, spelling } = this.getPositionFromPixels(coords, barQuarters)
    return { measure, beat: beatToFrac(beat), spelling }
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
  ): { measure: number; beat: number; spelling: PitchSpelling } {
    const registry = this.renderer.getElementRegistry()
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Get natural spelling from ElementRegistry (more accurate) with fallback.
    // Pass X so mid-measure clef regions resolve to the correct clef. A registry
    // result with an undefined step (degenerate geometry) is treated as a miss.
    const registrySpelling = registry.pixelYToPitch(coords.y, measureNumber, coords.x)
    const spelling = registrySpelling?.step !== undefined
      ? registrySpelling
      : this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)

    // Get beat from ElementRegistry or coordinateMapper
    let beat: number
    const nearestElement = registry.findNearestNoteOrRest(coords.x, measureNumber)
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

    return { measure: measureNumber, beat, spelling }
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
   * Pixel rectangle of a rendered measure in content coordinates (height = one stave), or
   * null if that measure isn't currently rendered. Used by playback-follow to scroll the
   * playing measure into the viewport. `measureNumber` is the measure's `.number` (1-indexed),
   * matching the playback position callback.
   */
  getMeasureRect(measureNumber: number): Rect | null {
    const b = this.renderer.getMeasureBounds(measureNumber)
    if (!b) return null
    return { x: b.measureX, y: b.measureY, width: b.measureWidth, height: LAYOUT_CONFIG.STAVE_HEIGHT }
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
