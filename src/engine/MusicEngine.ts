import { ScoreModel } from './models/ScoreModel'
import { VexFlowRenderer } from './rendering/VexFlowRenderer'
import { CoordinateMapper, type CoordinateMapperConfig } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { PlaybackEngine, type PlaybackCallbacks } from './audio/PlaybackEngine'
import { UndoRedoManager } from './UndoRedoManager'
import { NoteEntryCoordinator, INVALID_NOTE_ENTRY_TYPES } from './NoteEntryCoordinator'
import { durationToBeats, splitBeatsIntoDurations, midiToNoteName, beatToFrac, getMeasureDuration } from '@/utils/musicUtils'
import { fracToNumber, fracCompare, fracEq, fracAdd } from '@/utils/fraction'
import { durationToFraction } from '@/utils/durations'
import { spellingToMidi, accidentalToAlter, spellingDiatonicPos } from '@/utils/pitchSpelling'
import type { Score, Note, NoteParams, Fraction, PixelCoordinates, Tuplet, NoteDuration, ArticulationType, Measure, Accidental, PitchSpelling, GhostNote, Clef } from '@/types/music'
import type { ElementRegistry, ElementInfo } from './ElementRegistry'

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
        this.playbackEngine.setScore(this.scoreModel.getScore())
        this.saveUndoState(description)
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

  /**
   * Save current state to undo history (call after mutations)
   */
  private saveUndoState(description: string): void {
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
    this.saveUndoState(`Set title to "${title}"`)
  }

  /**
   * Set tempo
   */
  setTempo(tempo: number): void {
    this.scoreModel.setTempo(tempo)
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState(`Set tempo to ${tempo}`)
  }

  /**
   * Add a measure
   */
  addMeasure(): void {
    this.scoreModel.addMeasure()
    this.saveUndoState('Add measure')
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
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState(`Set ${clef} clef at measure ${measureNumber} beat ${fracToNumber(beat)}`)
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
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState(`Remove clef at measure ${measureNumber} beat ${fracToNumber(beat)}`)
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
    this.saveUndoState(`Move clef to measure ${measureNumber} beat ${fracToNumber(beat)}`)
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
    this.playbackEngine.setScore(this.scoreModel.getScore())
    const noteName = params.step ? midiToNoteName(spellingToMidi(params.step, params.alter ?? 0, params.octave!)) : 'rest'
    this.saveUndoState(`Add chord note ${noteName}`)
    return note
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
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Add rest')
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
      const measureTotalBeats = getMeasureDuration(measure.timeSignature)
      const availableBeats = measureTotalBeats - fracToNumber(existingNote.beat)
      const requestedBeats = durationToBeats(newDuration, newDots)

      // Tuplet overflow is handled by updateTupletNote (which uses the correct tuplet ratio).
      // Measure-level overflow only applies to non-tuplet notes.
      if (requestedBeats > availableBeats + 0.001 && !existingNote.tupletId) {
        if (!existingNote.isRest) {
          // Non-tuplet, non-rest overflow: split with tie across the barline (Dorico-style)
          const overflowAmount = requestedBeats - availableBeats
          const oldNoteEnd = fracToNumber(existingNote.beat) + durationToBeats(oldDuration, oldDots)

          // Clear notes in the current measure that fall within the newly extended range
          for (const n of measureNotes) {
            if (n.id === noteId || chordNotes.some(c => c.id === n.id)) continue
            const nStart = fracToNumber(n.beat)
            if (nStart >= oldNoteEnd - 0.001 && nStart < fracToNumber(existingNote.beat) + availableBeats - 0.001) {
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

          this.playbackEngine.setScore(this.scoreModel.getScore())
          this.saveUndoState('Update note duration')
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
    if (scaledNewDuration > remainingTupletBeats + 0.001) {
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
      fracToNumber(n.beat) > existingBeatNum + 0.001 &&
      fracToNumber(n.beat) < noteEndBeat - 0.001
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

    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Update tuplet note')
    return updatedNote
  }

  /** Handles duration updates for regular (non-tuplet) notes, both chords and singles. */
  private updateNonTupletNote(ctx: NoteUpdateCtx): Note {
    const { noteId, updates, existingNote, measureNotes, chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference } = ctx

    // If duration is being lengthened, remove overlapping notes/rests first
    if (beatDifference < -0.001) {
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
      if (excessBeats > 0.001) {
        let currentBeat = fracAdd(existingNote.beat, durationToFraction(newDuration, newDots))
        for (const restDuration of splitBeatsIntoDurations(excessBeats)) {
          this.scoreModel.addRest(restDuration, existingNote.measure, currentBeat)
          currentBeat = fracAdd(currentBeat, durationToFraction(restDuration))
        }
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

    // If duration was shortened, fill the gap with rests
    if (beatDifference > 0.001) {
      let currentBeat = fracAdd(note.beat, durationToFraction(newDuration, newDots))
      for (const restDuration of splitBeatsIntoDurations(beatDifference)) {
        this.scoreModel.addRest(restDuration, note.measure, currentBeat)
        currentBeat = fracAdd(currentBeat, durationToFraction(restDuration))
      }

      // Break tiedTo if the shortened note no longer abuts its tie target
      if (note.tiedTo) {
        const tiedTarget = this.scoreModel.getNote(note.tiedTo)
        if (tiedTarget) {
          const noteEnd = fracToNumber(note.beat) + durationToBeats(newDuration, newDots)
          const targetBeat = fracToNumber(tiedTarget.beat)
          if (Math.abs(noteEnd - targetBeat) > 0.001 || note.measure !== tiedTarget.measure) {
            console.log(`[Tie] broken — ${note.step}${note.octave} m${note.measure} no longer abuts tied target after duration change`)
            this.scoreModel.updateNote(note.id, { tiedTo: undefined })
            this.scoreModel.updateNote(tiedTarget.id, { tiedFrom: undefined })
          }
        }
      }
    }

    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Update note')
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
      if (beats <= availableBeats + 0.001) {
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
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState(hasIt ? `Remove ${type}` : `Add ${type}`)
    return result
  }

  /**
   * Directly link two notes with a tie (fromNoteId → toNoteId).
   * Used when the target note already exists (e.g. pending tie resolution in keyboard entry).
   */
  /**
   * If toNoteId is a valid pending-tie target for fromNoteId (same pitch, comes after),
   * link the tie and return true. Otherwise return false without side effects.
   * Call this after any note placement or pitch change when a pending tie is armed.
   */
  /**
  linkTie(fromNoteId: string, toNoteId: string): void {
    const fromNote = this.scoreModel.getNote(fromNoteId)
    const toNote = this.scoreModel.getNote(toNoteId)
    if (!fromNote || !toNote) {
      console.log(`[Tie] linkTie FAILED — fromNote:${fromNote ? 'ok' : 'NOT FOUND'} toNote:${toNote ? 'ok' : 'NOT FOUND'}`)
      return
    }
    const fmt = (n: typeof fromNote) => n.isRest ? `rest` : `${n.step}${n.alter === 2 ? '##' : n.alter === 1 ? '#' : n.alter === -1 ? 'b' : n.alter === -2 ? 'bb' : ''}${n.octave} m${n.measure} beat:${fracToNumber(n.beat).toFixed(3)}`
    console.log(`[Tie] linkTie | FROM: ${fmt(fromNote)} → TO: ${fmt(toNote)}`)
    this.scoreModel.updateNote(fromNoteId, { tiedTo: toNoteId })
    this.scoreModel.updateNote(toNoteId, { tiedFrom: fromNoteId })
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Add tie')
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
      this.scoreModel.updateNote(noteId, { tiedTo: undefined })
      this.scoreModel.updateNote(tiedToId, { tiedFrom: undefined })
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState('Remove tie')
      return false
    } else {
      // Tie to the immediately next slot (rest or note — no pitch filter)
      const allSlots = this.scoreModel.getAllNotes()
        .sort((a, b) => a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat))
      const idx = allSlots.findIndex(n => n.id === noteId)
      const nextNote = allSlots[idx + 1]
      if (!nextNote) {
        console.log(`[Tie] no next slot found — tie not created`)
        return null
      }
      console.log(`[Tie] tying to next slot: ${fmt(nextNote)}`)

      this.scoreModel.updateNote(noteId, { tiedTo: nextNote.id })
      this.scoreModel.updateNote(nextNote.id, { tiedFrom: noteId })
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState('Add tie')
      return true
    }
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
    } else if (result && !isPartOfChord && note.isRest && !note.tupletId) {
      // Standalone rest deleted without replacement — re-fill the measure to close the gap
      this.scoreModel.repairMeasureGaps(note.measure)
    } else if (result && !isPartOfChord && note.isRest && note.tupletId) {
      // Rest inside a tuplet deleted — fill the empty gap it left behind
      const measure = this.scoreModel.getMeasure(note.measure)
      const tuplet = measure?.tuplets?.find(t => t.id === note.tupletId)
      if (tuplet) this.scoreModel.refillTupletRemainder(note.measure, tuplet)
    }

    this.playbackEngine.setScore(this.scoreModel.getScore())
    if (result) {
      this.saveUndoState(description)
    }
    return result
  }

  /**
   * Get note at pixel position
   */
  getNoteAtPosition(coords: PixelCoordinates, tolerance: number = 10): Note | null {
    const allNotes = this.scoreModel.getAllNotes()
    const measure = this.scoreModel.getMeasure(1)
    if (!measure) return null

    const barQuarters = getMeasureDuration(measure.timeSignature)

    for (const note of allNotes) {
      const noteCoords = this.coordinateMapper.noteToPixel(note, barQuarters)

      const distance = Math.sqrt(
        Math.pow(noteCoords.x - coords.x, 2) + Math.pow(noteCoords.y - coords.y, 2)
      )

      if (distance <= tolerance) {
        return note
      }
    }

    return null
  }

  /**
   * Clear all notes
   */
  clearAllNotes(): void {
    this.scoreModel.clearAllNotes()
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Clear all notes')
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
      this.playbackEngine.setScore(this.scoreModel.getScore())
      this.saveUndoState('Delete triplet')
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
      const middleLineDiatonic: Record<string, number> = {
        treble: 34, bass: 22, alto: 28, tenor: 26,
      }
      const middleDiatonic = middleLineDiatonic[clef] ?? 34
      const dPos = spellingDiatonicPos(note.step!, note.octave!)
      // Natural: at/above middle → down; below → up. Force the opposite.
      newDirection = dPos >= middleDiatonic ? 'up' : 'down'
    }

    const updated = this.scoreModel.updateNote(noteId, { stemDirection: newDirection })
    this.playbackEngine.setScore(this.scoreModel.getScore())
    this.saveUndoState('Flip stem direction')
    return updated
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
    const barQuarters = getMeasureDuration(measure.timeSignature)
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
        if (duration) {
          const noteDurationInBeats = durationToBeats(duration)
          beat = Math.round(beat / noteDurationInBeats) * noteDurationInBeats
          beat = Math.max(0, Math.min(beat, barQuarters - noteDurationInBeats))
        }
      }
    } else {
      beat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, barQuarters)
      if (duration) {
        const noteDurationInBeats = durationToBeats(duration)
        beat = Math.round(beat / noteDurationInBeats) * noteDurationInBeats
        beat = Math.max(0, Math.min(beat, barQuarters - noteDurationInBeats))
      }
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

  // ==================== Cleanup ====================

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.playbackEngine.dispose()
    this.renderer.clear()
  }
}
