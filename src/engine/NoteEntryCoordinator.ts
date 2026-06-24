import { ScoreModel } from './models/ScoreModel'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import {
  durationToBeats, splitBeatsIntoDurations, midiToNoteName,
  getTupletNoteDurationFrac, getTupletTotalBeatsFrac, beatToFrac,
  measureCapacityQuarters,
} from '@/utils/musicUtils'
import {
  fracToNumber, fracEq, fracAdd, fracSub, fracMul,
  fracLt, fracGt, fracGte, fracFromInt, fracCreate,
} from '@/utils/fraction'
import { durationToFraction, tupletNoteDurationFraction } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import type { Note, NoteParams, PixelCoordinates, Tuplet, NoteDuration, ArticulationType, Accidental, PitchSpelling, Measure } from '@/types/music'
import { spellingToMidi, accidentalToAlter } from '@/utils/pitchSpelling'
import { ElementRegistry } from './ElementRegistry'
import type { ElementInfo } from './ElementRegistry'

const CLOSE_THRESHOLD = 25
const FAR_THRESHOLD = 40
/** Safety cap on the addMeasure() loop that extends the score to reach a target measure. */
const MAX_MEASURE_CREATE_ATTEMPTS = 20
export const INVALID_NOTE_ENTRY_TYPES = ['clef', 'timeSignature', 'barline', 'keySignature']

/** Float beat-comparison epsilon (pixel-boundary tolerance; see docs/ARCHITECTURE.md). */
const BEAT_EPSILON = 0.001

/** Internal context passed to the updateNote sub-methods. */
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
 * Handles all note/tuplet entry logic (keyboard and mouse).
 * Delegates data mutations to ScoreModel and coordinate math to CoordinateMapper.
 * Calls onCommit(description) to trigger undo-state save + playback sync.
 */
export class NoteEntryCoordinator {
  constructor(
    private getScoreModel: () => ScoreModel,
    private coordinateMapper: CoordinateMapper,
    private collisionDetector: CollisionDetector,
    private elementRegistry: ElementRegistry,
    private onCommit: (description: string) => void
  ) {}

  // ==================== Public: Keyboard Entry ====================

  /**
   * Add a note by beat/measure position with full overflow handling (tie splitting across barlines).
   * Use this for keyboard entry mode instead of addNote().
   * Returns the first note placed (in the current measure), or null if placement failed.
   */
  addNoteAtBeat(params: NoteParams): Note | null {
    const targetMeasure = this.getScoreModel().getMeasure(params.measure)
    if (!targetMeasure) return null

    // Detect tuplet context: auto-assign tupletId and snap beat if this beat falls inside a tuplet
    let finalBeatFrac = params.beat
    let tupletId = params.tupletId
    const tupletAtBeat = tupletId
      ? (targetMeasure.tuplets || []).find(t => t.id === tupletId)
      : this.getScoreModel().getTupletAtBeat(params.measure, params.beat)

    if (tupletAtBeat && !tupletId) {
      tupletId = tupletAtBeat.id
    }

    // Clamp note duration to remaining actual tuplet space (solution A).
    // If the selected written duration would overflow the tuplet, silently use the
    // largest standard duration that fits instead — same behaviour as Sibelius.
    if (tupletAtBeat) {
      const ratio = fracCreate(tupletAtBeat.notesOccupied, tupletAtBeat.numNotes)
      const tupletEnd = fracAdd(tupletAtBeat.startBeat, getTupletTotalBeatsFrac(tupletAtBeat.baseDuration, tupletAtBeat.notesOccupied))
      const remainingActual = fracSub(tupletEnd, finalBeatFrac)
      const noteActual = fracMul(durationToFraction(params.duration, params.dots || 0), ratio)
      if (fracGt(noteActual, remainingActual)) {
        const maxWritten = fracToNumber(fracMul(remainingActual, fracCreate(tupletAtBeat.numNotes, tupletAtBeat.notesOccupied)))
        const fitting = splitBeatsIntoDurations(maxWritten)
        if (fitting.length === 0) return null
        console.log(`[Tuplet] duration clamped: ${params.duration} → ${fitting[0]} (remaining actual: ${fracToNumber(remainingActual).toFixed(4)})`)
        params = { ...params, duration: fitting[0], dots: 0 }
      }
    }

    // Calculate effective note duration (scaled by tuplet ratio when inside a tuplet)
    const finalBeat = fracToNumber(finalBeatFrac)
    const nominalDuration = durationToBeats(params.duration, params.dots || 0)
    const tupletRatio = tupletAtBeat ? tupletAtBeat.notesOccupied / tupletAtBeat.numNotes : 1
    const effectiveDuration = nominalDuration * tupletRatio
    // Set actualDuration so checkMeasureOverflow uses the scaled duration, not the written one
    const actualDuration = tupletAtBeat
      ? fracMul(durationToFraction(params.duration, params.dots || 0), fracCreate(tupletAtBeat.notesOccupied, tupletAtBeat.numNotes))
      : undefined

    const finalParams: NoteParams = { ...params, beat: finalBeatFrac, ...(tupletId ? { tupletId } : {}), ...(actualDuration ? { actualDuration } : {}) }
    const noteEnd = finalBeat + effectiveDuration

    // Remove overlapping CHORD notes atomically, using scaled durations for tuplet notes.
    // Rests are intentionally skipped here — replaceRestsWithChord (inside addNote) handles
    // rest removal with proper tie migration, so deleting rests here would break that.
    const epsilon = 0.001
    const entryVoice = params.voice ?? 0
    const toDelete = this.getScoreModel().getNotesInMeasure(params.measure).filter(n => {
      if (n.isRest) return false
      // Other voices are independent streams — never clobber them.
      if ((n.voice ?? 0) !== entryVoice) return false
      let nDuration = durationToBeats(n.duration, n.dots || 0)
      if (n.tupletId) {
        const nTuplet = (targetMeasure.tuplets || []).find(t => t.id === n.tupletId)
        if (nTuplet) nDuration *= nTuplet.notesOccupied / nTuplet.numNotes
      }
      const nBeat = fracToNumber(n.beat)
      const nEnd = nBeat + nDuration
      return nBeat + epsilon < noteEnd && nEnd - epsilon > finalBeat
    })
    if (toDelete.length) {
      console.log(`[Entry] v${entryVoice} overwrites ${toDelete.length} same-voice note(s): ${toDelete.map(n => `${n.step}${n.octave}@b${fracToNumber(n.beat).toFixed(3)}`).join(', ')}`)
    }
    for (const n of toDelete) {
      this.getScoreModel().deleteNote(n.id)
    }

    const overflow = this.collisionDetector.checkMeasureOverflow(
      finalParams,
      targetMeasure,
      this.getScoreModel().getNotesInMeasure(params.measure)
    )

    if (overflow.willOverflow && overflow.overflowAmount) {
      const alt = params.alter === 2 ? '##' : params.alter === 1 ? '#' : params.alter === -1 ? 'b' : params.alter === -2 ? 'bb' : ''
      console.log(`[Entry] KeyboardEntry | v${entryVoice} ${params.step}${alt}${params.octave} dur:${params.duration} measure:${params.measure} beat:${finalBeat.toFixed(3)} → overflow ${overflow.overflowAmount.toFixed(3)}b — splitting with tie`)
      const splitNote = this.addSplitNoteWithTie(finalParams, overflow.overflowAmount)
      if (splitNote) {
        this.onCommit('Keyboard enter note')
      }
      return splitNote
    }

    const note = this.getScoreModel().addNote(finalParams)
    const noteAlt = note.alter === 2 ? '##' : note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === -2 ? 'bb' : ''
    console.log(`✓ [Entry] KeyboardEntry | v${note.voice ?? 0} ${note.step}${noteAlt}${note.octave} dur:${note.duration} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}${tupletAtBeat ? ` tuplet:${tupletAtBeat.id}` : ''}`)

    if (tupletAtBeat && tupletId) {
      this.getScoreModel().refillTupletRemainder(params.measure, tupletAtBeat)
    }

    this.onCommit('Keyboard enter note')
    return note
  }

  // ==================== Public: Mouse Entry ====================

  /**
   * Add a note at pixel coordinates.
   *
   * Directional Logic:
   * 1. Find elements to the LEFT and RIGHT of the click position
   * 2. If click is FAR from all elements → use coordinate-based beat calculation
   * 3. Priority: Element to the RIGHT determines behavior
   *    - If RIGHT is a REST → place note at that rest's beat (new note)
   *    - If RIGHT is a NOTE → add to that chord (if different pitch)
   * 4. If only LEFT element and it's close → use LEFT's beat
   * 5. If same pitch collision → find next rest
   */
  addNoteAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: Accidental,
    dots?: number,
    articulations?: ArticulationType[],
    beam?: NoteParams['beam'],
    voice: NoteParams['voice'] = 0
  ): Note | null {
    const registry = this.elementRegistry
    const entryVoice = voice ?? 0

    // Get measure number from coordinates
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists, then use ITS capacity (honours a pickup bar)
    const measure = this.getScoreModel().getMeasure(measureNumber)
    if (!measure) {
      console.log('✗ Invalid: measure does not exist')
      return null
    }
    const barQuarters = measureCapacityQuarters(measure)

    // Reject clicks on invalid targets or outside the staff's note-entry area.
    if (!this.isValidEntryClick(coords, measureNumber)) return null

    // Get natural pitch spelling from Y coordinate, then apply accidental from palette
    const naturalSpelling = registry.pixelYToPitch(coords.y, measureNumber)
      ?? this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)
    const alter = accidentalToAlter(accidental)
    const spelling: PitchSpelling = { ...naturalSpelling, alter }
    const pitchMidi = spellingToMidi(spelling.step, spelling.alter, spelling.octave)

    // Resolve beat using directional element logic
    const {
      beat: resolvedBeat, reason: resolvedReason,
      usedCoordCalc: useCoordinateCalculation,
      nearestLeft, nearestRight, leftDistance, rightDistance,
    } = this.resolveClickToBeat(coords, measureNumber, barQuarters, durationToBeats(duration))
    let finalBeat: Fraction = beatToFrac(resolvedBeat)
    let decisionReason = resolvedReason

    // When using coordinate calculation, we need to find if there's a rest at that beat
    // or if we'd be creating a new note position
    if (useCoordinateCalculation) {
      // Scope rest/chord/nearest-rest decisions to the entry voice — other voices are
      // independent streams and must not steer (or be clobbered by) this placement.
      const notesInMeasure = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n => (n.voice ?? 0) === entryVoice)
      const restAtBeat = this.findRestAtBeat(notesInMeasure, finalBeat)
      if (!restAtBeat) {
        // Check if there's a note at this beat we could chord with
        const notesAtBeat = notesInMeasure.filter(n => !n.isRest && fracEq(n.beat, finalBeat))
        if (notesAtBeat.length > 0) {
          // There are notes at this beat - check for collision
          const hasSamePitch = notesAtBeat.some(n => !n.isRest && spellingToMidi(n.step!, n.alter!, n.octave!) === pitchMidi)
          if (hasSamePitch) {
            console.warn('Same pitch collision at calculated beat')
            return null
          }
          // Different pitch - will form chord (continue with finalBeat)
        } else {
          // No rest and no notes at this beat - snap onto the nearest existing rest
          // in this voice, if any.
          const nearestRest = this.findNearestRestToBeat(notesInMeasure, finalBeat)
          if (nearestRest) {
            finalBeat = nearestRest.beat
          }
          // Otherwise the entry voice is empty/absent in this bar (secondary voices
          // are collapsed when they hold no notes — see ScoreModel.collapseEmptyVoices).
          // There is nothing to snap to, so keep the quantized coordCalc beat, which is
          // already clamped to the bar by resolveClickToBeat. Returning null here would
          // make voice 2 unwritable in any measure where it doesn't exist yet.
        }
      }
    }

    // Check if the final beat falls within a tuplet
    // If so, snap to the nearest tuplet beat and inherit the tuplet ID
    let tupletId: string | undefined
    const tupletAtBeat = this.getScoreModel().getTupletAtBeat(measureNumber, finalBeat)

    if (tupletAtBeat) {
      const selectedDurationFrac = durationToFraction(duration, dots)
      const tupletTotalBeatsFrac = getTupletTotalBeatsFrac(tupletAtBeat.baseDuration, tupletAtBeat.notesOccupied)
      const tupletEndBeat = fracAdd(tupletAtBeat.startBeat, tupletTotalBeatsFrac)

      // Compute fill pointer: end of last real note in the tuplet
      const ratio = fracCreate(tupletAtBeat.notesOccupied, tupletAtBeat.numNotes)
      const realNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n => n.tupletId === tupletAtBeat.id && !n.isRest)
        .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      let fillPointer: Fraction
      if (realNotes.length === 0) {
        fillPointer = tupletAtBeat.startBeat
      } else {
        const last = realNotes[realNotes.length - 1]
        const lastActual = last.actualDuration
          ?? fracMul(durationToFraction(last.duration, last.dots ?? 0), ratio)
        fillPointer = fracAdd(last.beat, lastActual)
      }

      // Case 1: Note larger than entire tuplet → delete tuplet, place at start
      if (fracGt(selectedDurationFrac, tupletTotalBeatsFrac)) {
        this.getScoreModel().deleteTuplet(tupletAtBeat.id)
        finalBeat = tupletAtBeat.startBeat
        decisionReason += ` → tuplet deleted (note too large), beat adjusted to ${fracToNumber(finalBeat).toFixed(3)}`
      } else {
        // Case 2: Check if note fits in remaining space (from fill pointer to tuplet end)
        const remainingActual = fracSub(tupletEndBeat, fillPointer)
        const scaledNoteDurationFrac = tupletNoteDurationFraction(duration, dots ?? 0, tupletAtBeat.numNotes, tupletAtBeat.notesOccupied)
        if (fracGt(scaledNoteDurationFrac, remainingActual)) {
          console.log(`Note rejected: scaled duration (${fracToNumber(scaledNoteDurationFrac).toFixed(3)}) exceeds remaining tuplet space (${fracToNumber(remainingActual).toFixed(3)})`)
          return null
        }
        // Note fits — place at fill pointer
        tupletId = tupletAtBeat.id
        finalBeat = fillPointer
        decisionReason += ` → tuplet fill@${fracToNumber(finalBeat).toFixed(3)}`
      }
    }

    const noteParams: NoteParams = {
      step: spelling.step,
      alter: spelling.alter,
      octave: spelling.octave,
      duration,
      measure: measureNumber,
      beat: finalBeat,
      // User explicitly armed ♮ in the palette → force the natural sign to display
      ...(accidental === 'n' && { forceAccidental: true }),
      ...(dots && { dots }),
      ...(tupletId && { tupletId }),
      ...(articulations?.length && { articulations }),
      ...(beam && beam !== 'auto' && { beam }),
      ...(entryVoice && { voice: entryVoice }),
    }

    // Get the target measure for overflow check
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) return null

    // Check for measure overflow
    const overflow = this.collisionDetector.checkMeasureOverflow(
      noteParams,
      targetMeasure,
      this.getScoreModel().getNotesInMeasure(measureNumber)
    )

    // Delete anything the new note overwrites (range/same-pitch replacements, plus
    // tuplet items inside a multi-slot tuplet note's actual-time span).
    this.applyEntryOverwrites(measureNumber, finalBeat, duration, dots, pitchMidi, tupletId, tupletAtBeat, entryVoice)

    // Handle overflow by splitting the note across the bar line with a tie.
    // SKIP for tuplet notes — tuplets have shorter actual durations, designed to fit their span.
    if (overflow.willOverflow && overflow.overflowAmount && !tupletId) {
      return this.placeSplitNote(noteParams, overflow.overflowAmount, measureNumber, finalBeat, pitchMidi, duration, dots)
    }

    // For non-overflow cases, update existing chord notes (same beat + voice) to match duration
    const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && (n.voice ?? 0) === entryVoice && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi)
    for (const chordNote of existingChordNotes) {
      if (chordNote.duration !== duration) {
        this.getScoreModel().updateNote(chordNote.id, { duration })
      }
    }

    const note = this.getScoreModel().addNote(noteParams)

    if (note && tupletAtBeat && tupletId) {
      this.getScoreModel().refillTupletRemainder(measureNumber, tupletAtBeat)
    }

    // Debug logging with full context
    if (note) {
      console.log('[Entry] NoteEntry:', {
        voice: entryVoice,
        pitch: `${note.step}${note.octave}`,
        duration: note.duration,
        measure: measureNumber,
        decision: decisionReason,
        left: nearestLeft ? `${nearestLeft.type}@${nearestLeft.beat} (${leftDistance.toFixed(0)}px)` : null,
        right: nearestRight ? `${nearestRight.type}@${nearestRight.beat} (${rightDistance.toFixed(0)}px)` : null,
        finalBeat: fracToNumber(finalBeat),
        coordCalc: useCoordinateCalculation
      })

      // Save undo state for the complete add operation
      this.onCommit(`Add ${midiToNoteName(pitchMidi)}`)
    }

    return note
  }

  /**
   * Reject a note-entry click on an invalid target (clef/TS/barline) or outside the
   * staff's note-entry X/Y area. Returns false (with a log) when no note can be placed.
   */
  private isValidEntryClick(coords: PixelCoordinates, measureNumber: number): boolean {
    const registry = this.elementRegistry

    // Check if click is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor && INVALID_NOTE_ENTRY_TYPES.includes(elementAtCursor.type)) {
      console.log(`✗ Invalid: clicked on ${elementAtCursor.type}`)
      return false
    }

    // Check if click is within valid staff area (X range)
    const staffGeometry = registry.getStaffGeometry(measureNumber)
    if (staffGeometry) {
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        console.log('✗ Invalid: X outside note entry area')
        return false
      }

      // Check if click is within valid Y range (reasonable pitch range)
      // Allow ~2 octaves above/below staff (staff lines span ~4 lines = 40px typically)
      const topLineY = staffGeometry.lineYPositions[0]
      const bottomLineY = staffGeometry.lineYPositions[4]
      const staffHeight = bottomLineY - topLineY
      const maxDistance = staffHeight * 2  // Allow 2x staff height above/below

      if (coords.y < topLineY - maxDistance || coords.y > bottomLineY + maxDistance) {
        console.log(`✗ Invalid: Y outside valid range (y=${coords.y.toFixed(0)}, valid=${(topLineY - maxDistance).toFixed(0)}-${(bottomLineY + maxDistance).toFixed(0)})`)
        return false
      }
    }
    return true
  }

  /**
   * Delete everything the incoming note overwrites: notes in its duration range or a
   * same-pitch note at its beat (replacement), plus — for a multi-slot tuplet note —
   * any tuplet items inside its actual-time span.
   */
  private applyEntryOverwrites(
    measureNumber: number,
    finalBeat: Fraction,
    duration: NoteParams['duration'],
    dots: number | undefined,
    pitchMidi: number,
    tupletId: string | undefined,
    tupletAtBeat: Tuplet | undefined,
    voice: number = 0,
  ): void {
    const notesToOverwrite = this.findNotesToOverwrite(measureNumber, finalBeat, duration, pitchMidi, false, tupletAtBeat, voice)
    if (notesToOverwrite.length > 0) {
      console.log('Overwriting notes:', notesToOverwrite.map(n => {
        const a = n.alter === 2 ? '##' : n.alter === 1 ? '#' : n.alter === -1 ? 'b' : n.alter === -2 ? 'bb' : ''
        return `${n.step}${a}${n.octave}@beat:${fracToNumber(n.beat).toFixed(3)}`
      }).join(', '))
      for (const noteToDelete of notesToOverwrite) {
        this.getScoreModel().deleteNote(noteToDelete.id)
      }
    }

    // For tuplet notes that span multiple slots (e.g., quarter note in eighth triplet),
    // delete any existing tuplet notes/rests that fall within the note's actual time range
    if (tupletId && tupletAtBeat) {
      const actualNoteDurationFrac = tupletNoteDurationFraction(duration, dots ?? 0, tupletAtBeat.numNotes, tupletAtBeat.notesOccupied)
      const noteEndBeat = fracAdd(finalBeat, actualNoteDurationFrac)

      const tupletItemsToDelete = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n =>
          n.tupletId === tupletId &&
          fracGt(n.beat, finalBeat) && // After the note's start (exclusive)
          fracLt(n.beat, noteEndBeat)  // Before the note's end (exclusive)
        )

      for (const itemToDelete of tupletItemsToDelete) {
        this.getScoreModel().deleteNote(itemToDelete.id)
      }
    }
  }

  /**
   * Overflow path: split the new note across the barline with a tie, and split any
   * same-beat chord notes too (skipping ones already tied, to avoid duplicates).
   * Records one undo entry. Returns the first (current-measure) note, or null.
   */
  private placeSplitNote(
    noteParams: NoteParams,
    overflowAmount: number,
    measureNumber: number,
    finalBeat: Fraction,
    pitchMidi: number,
    duration: NoteParams['duration'],
    dots: number | undefined,
  ): Note | null {
    const splitVoice = noteParams.voice ?? 0
    const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && (n.voice ?? 0) === splitVoice && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi && !n.tiedTo)
    for (const chordNote of existingChordNotes) {
      this.splitExistingNoteWithTie(chordNote, duration, overflowAmount, dots)
    }

    const splitNote = this.addSplitNoteWithTie(noteParams, overflowAmount)
    if (splitNote) {
      this.onCommit(`Add ${midiToNoteName(pitchMidi)}`)
    }
    return splitNote
  }

  // ==================== Public: Note Update ====================

  /** All non-rest notes at the given beat AND voice in a measure (chord members). */
  private getChordNotesAt(measureNumber: number, beat: Fraction, voice: number = 0): Note[] {
    return this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && (n.voice ?? 0) === voice && fracEq(n.beat, beat))
  }

  /**
   * Update a note.
   * Dispatches to updateTupletNote or updateNonTupletNote based on context.
   * When duration is shortened, fills the gap with rests.
   * When duration is lengthened, removes overlapping notes/rests (splitting across the
   * barline with a tie when it overflows the bar).
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const existingNote = this.getScoreModel().getNote(noteId)
    if (!existingNote) throw new Error(`Note ${noteId} not found`)

    const oldDuration = existingNote.duration
    const oldDots = existingNote.dots || 0
    let newDuration = updates.duration || oldDuration
    // Handle dots: if dots is explicitly set in updates (even to 0), use it; otherwise keep old
    const newDots = updates.dots !== undefined ? updates.dots : oldDots

    // Edits act on ONE voice's stream. Scope the measure view + chord lookup to the
    // edited note's voice so a duration change never deletes or fills another voice's
    // notes/rests (voices are independent streams that each sum to the bar length).
    const editVoice = existingNote.voice ?? 0
    const measureNotes = this.getScoreModel().getNotesInMeasure(existingNote.measure)
      .filter(n => (n.voice ?? 0) === editVoice)
    const chordNotes = this.getChordNotesAt(existingNote.measure, existingNote.beat, editVoice)
    const isChord = chordNotes.length > 1

    const target = existingNote.isRest ? 'REST' : `${existingNote.step}${existingNote.octave}`
    console.log(`[Edit] v${editVoice} ${target} m${existingNote.measure} b${fracToNumber(existingNote.beat).toFixed(3)} | dur ${oldDuration}${oldDots ? '.'.repeat(oldDots) : ''}→${newDuration}${newDots ? '.'.repeat(newDots) : ''}${isChord ? ` (chord of ${chordNotes.length})` : ''} | scoped to ${measureNotes.length} same-voice slot(s)`, updates)

    // Check for measure overflow (considering dots)
    const measure = this.getScoreModel().getMeasure(existingNote.measure)
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
              this.getScoreModel().deleteNote(n.id)
            }
          }

          // Split chord members (other notes at the same beat)
          for (const chordNote of chordNotes) {
            if (chordNote.id === noteId) continue
            this.splitExistingNoteWithTie(chordNote, newDuration, overflowAmount, newDots)
          }

          // Split the target note itself
          this.splitExistingNoteWithTie(existingNote, newDuration, overflowAmount, newDots)

          this.onCommit('Update note duration')
          return this.getScoreModel().getNote(noteId)!
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
    let { updates, newBeats, newDuration } = ctx
    const { noteId, existingNote, measureNotes, chordNotes, isChord, newDots } = ctx

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
    for (const item of itemsToDelete) this.getScoreModel().deleteNote(item.id)

    const updatedNote = this.getScoreModel().updateNote(noteId, updates)

    // Recompute all filler rests from the fill pointer
    this.getScoreModel().refillTupletRemainder(existingNote.measure, tuplet)

    // Also update chord notes to keep duration in sync
    if (isChord) {
      for (const chordNote of chordNotes) {
        if (chordNote.id !== noteId) {
          this.getScoreModel().updateNote(chordNote.id, { duration: newDuration, dots: newDots })
        }
      }
    }

    this.onCommit('Update tuplet note')
    return updatedNote
  }

  /** Handles duration updates for regular (non-tuplet) notes, both chords and singles. */
  private updateNonTupletNote(ctx: NoteUpdateCtx): Note {
    const { noteId, updates, existingNote, measureNotes, chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference } = ctx
    const editVoice = existingNote.voice ?? 0

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

      console.log(`[Edit] lengthen v${editVoice}: removing ${notesToRemove.length} overlapped same-voice slot(s), recovered ${beatsToRecover.toFixed(3)}b (need ${Math.abs(beatDifference).toFixed(3)}b)`)
      for (const id of notesToRemove) this.getScoreModel().deleteNote(id)

      // If we removed more beats than needed, add rests to fill the excess
      const excessBeats = beatsToRecover - Math.abs(beatDifference)
      if (excessBeats > BEAT_EPSILON) {
        console.log(`[Edit] lengthen v${editVoice}: ${excessBeats.toFixed(3)}b excess → fill with rests`)
        this.getScoreModel().fillGapWithRests(
          existingNote.measure,
          fracAdd(existingNote.beat, durationToFraction(newDuration, newDots)),
          excessBeats,
          editVoice,
        )
      }
    }

    // For chords, update all members' duration and dots so they stay in sync
    if (isChord && (updates.duration || updates.dots !== undefined)) {
      for (const chordNote of chordNotes) {
        if (chordNote.id === noteId) continue
        this.getScoreModel().updateNote(chordNote.id, { duration: newDuration, dots: newDots })
      }
    }

    // Apply all requested updates to the target note
    const note = this.getScoreModel().updateNote(noteId, updates)

    // If duration was shortened, fill the freed space with rests.
    if (beatDifference > BEAT_EPSILON) {
      console.log(`[Edit] shorten v${editVoice}: freed ${beatDifference.toFixed(3)}b → fill with rests (${existingNote.isRest ? 'meter-aware whole-measure refill' : `from b${fracToNumber(fracAdd(note.beat, durationToFraction(newDuration, newDots))).toFixed(3)}`})`)
      if (existingNote.isRest) {
        // Meter-aware refill: the shortened rest's remainder is regrouped for the
        // bar's meter. This both fixes the bar length (a former measure rest's
        // nominal 'w' is 4 quarters, not the real bar length) and groups rests
        // correctly in compound/irregular meters — the legacy float splitter
        // below does neither.
        this.getScoreModel().fillMeasureGaps(note.measure)
      } else {
        this.getScoreModel().fillGapWithRests(
          note.measure,
          fracAdd(note.beat, durationToFraction(newDuration, newDots)),
          beatDifference,
          editVoice,
        )

        // Break tiedTo if the shortened note no longer abuts its tie target
        if (note.tiedTo) {
          const tiedTarget = this.getScoreModel().getNote(note.tiedTo)
          if (tiedTarget) {
            const noteEnd = fracToNumber(note.beat) + durationToBeats(newDuration, newDots)
            const targetBeat = fracToNumber(tiedTarget.beat)
            if (Math.abs(noteEnd - targetBeat) > BEAT_EPSILON || note.measure !== tiedTarget.measure) {
              console.log(`[Tie] broken — ${note.step}${note.octave} m${note.measure} no longer abuts tied target after duration change`)
              this.getScoreModel().updateNote(note.id, { tiedTo: undefined })
              this.getScoreModel().updateNote(tiedTarget.id, { tiedFrom: undefined })
            }
          }
        }
      }
    }

    this.onCommit('Update note')
    return note
  }

  /** Find the largest standard note duration that fits within available beats. */
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

  // ==================== Public: Tuplet Entry ====================

  /**
   * Create a tuplet at a pixel position.
   * Creates a complete tuplet with the first note at the given pitch and remaining positions as rests.
   */
  createTupletAtPosition(
    coords: PixelCoordinates,
    duration: NoteDuration,
    spelling: PitchSpelling,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): { tuplet: Tuplet; firstNote: Note } | null {
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists, then use ITS capacity (honours a pickup bar)
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) {
      console.log('✗ Invalid: measure does not exist')
      return null
    }
    const barQuarters = measureCapacityQuarters(targetMeasure)

    const noteDurationInBeats = durationToBeats(duration)
    const tupletTotalBeats = noteDurationInBeats * notesOccupied

    // Resolve beat using directional element logic
    const {
      beat: resolvedBeat, reason: decisionReason,
      nearestLeft, nearestRight, leftDistance, rightDistance,
    } = this.resolveClickToBeat(coords, measureNumber, barQuarters, noteDurationInBeats)
    let beat = resolvedBeat

    // Clamp to valid range (tuplet must fit in measure)
    beat = Math.max(0, Math.min(beat, barQuarters - tupletTotalBeats))

    // Check if there's already a tuplet at this position
    const existingTuplet = this.getScoreModel().getTupletAtBeat(measureNumber, beatToFrac(beat))
    if (existingTuplet) {
      console.log('✗ Tuplet already exists at this beat')
      return null
    }

    // Log tuplet entry decision
    console.log('TupletEntry:', {
      decision: decisionReason,
      left: nearestLeft ? `${nearestLeft.type}@${nearestLeft.beat} (${leftDistance.toFixed(0)}px)` : null,
      right: nearestRight ? `${nearestRight.type}@${nearestRight.beat} (${rightDistance.toFixed(0)}px)` : null,
      finalBeat: beat,
      tupletSpan: `${beat} to ${(beat + tupletTotalBeats).toFixed(3)}`,
      config: `${numNotes}:${notesOccupied} ${duration}`,
    })

    return this.buildTupletWithFirstNote(measureNumber, beat, duration, spelling, numNotes, notesOccupied)
  }

  /**
   * Create a tuplet at a specific beat position (for keyboard entry mode).
   * Same logic as createTupletAtPosition but takes beat/measure directly.
   */
  createTupletAtBeat(
    measureNumber: number,
    beat: number,
    duration: NoteDuration,
    spelling: PitchSpelling,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): { tuplet: Tuplet; firstNote: Note } | null {
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) return null

    const existingTuplet = this.getScoreModel().getTupletAtBeat(measureNumber, beatToFrac(beat))
    if (existingTuplet) return null

    return this.buildTupletWithFirstNote(measureNumber, beat, duration, spelling, numNotes, notesOccupied)
  }

  /**
   * Convert an existing selected note or rest into the first element of a tuplet.
   * Used when the user presses the tuplet button in selection mode with a note/rest selected.
   */
  applyTupletToNote(
    noteId: string,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): { tuplet: Tuplet; note: Note } | null {
    const note = this.getScoreModel().getNote(noteId)
    if (!note || note.tupletId) return null

    const existingTuplet = this.getScoreModel().getTupletAtBeat(note.measure, note.beat)
    if (existingTuplet) return null

    // createTuplet removes overlapping slots; places no initial rests
    const tuplet = this.getScoreModel().createTuplet(note.measure, note.beat, note.duration, numNotes, notesOccupied)
    const actualDuration = fracMul(durationToFraction(note.duration), fracCreate(notesOccupied, numNotes))

    let resultNote: Note
    if (note.isRest) {
      // Tuplet starts empty — refill will place the full-span filler rest
      this.getScoreModel().refillTupletRemainder(note.measure, tuplet)
      const rests = this.getScoreModel().getNotesInTuplet(tuplet.id)
      resultNote = rests[0]
      if (!resultNote) return null
    } else {
      // Place the original note as the first tuplet note, then fill remainder
      resultNote = this.getScoreModel().addNote({
        step: note.step,
        alter: note.alter,
        octave: note.octave,
        duration: note.duration,
        measure: note.measure,
        beat: tuplet.startBeat,
        tupletId: tuplet.id,
        actualDuration,
        ...(note.stemDirection && { stemDirection: note.stemDirection }),
      })
      this.getScoreModel().refillTupletRemainder(note.measure, tuplet)
    }

    this.onCommit('Apply tuplet')
    return { tuplet, note: resultNote }
  }

  // ==================== Private Helpers ====================

  /**
   * Create a tuplet and place the first note (or chord with an existing note).
   * Shared by createTupletAtPosition and createTupletAtBeat.
   */
  private buildTupletWithFirstNote(
    measureNumber: number,
    beat: number,
    duration: NoteDuration,
    spelling: PitchSpelling,
    numNotes: number,
    notesOccupied: number
  ): { tuplet: Tuplet; firstNote: Note } | null {
    // Save any existing note at the start position before createTuplet deletes it
    const existingNoteAtStart = this.getScoreModel().getNotesInMeasure(measureNumber)
      .find(n => !n.isRest && !n.tupletId && Math.abs(fracToNumber(n.beat) - beat) < 0.001)
    const existingNoteData = existingNoteAtStart
      ? { step: existingNoteAtStart.step, alter: existingNoteAtStart.alter, octave: existingNoteAtStart.octave }
      : null

    // Create the tuplet (removes overlapping slots, places no initial rests)
    const beatFrac = beatToFrac(beat)
    const tuplet = this.getScoreModel().createTuplet(measureNumber, beatFrac, duration, numNotes, notesOccupied)
    const actualDuration = fracMul(durationToFraction(duration), fracCreate(notesOccupied, numNotes))

    let firstNote: Note

    if (existingNoteData) {
      // Re-add the pre-existing note as chord member, then add new note
      this.getScoreModel().addNote({
        step: existingNoteData.step,
        alter: existingNoteData.alter,
        octave: existingNoteData.octave,
        duration,
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
      })
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
      })
    } else {
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
      })
    }

    this.getScoreModel().refillTupletRemainder(measureNumber, tuplet)
    this.onCommit('Create triplet')
    return { tuplet, firstNote }
  }

  /**
   * Resolve a pixel click to a beat position using directional element logic.
   * Finds nearest left/right elements and uses thresholds to determine the target beat.
   * Falls back to coordinate-based quantized calculation when no element is close enough.
   */
  private resolveClickToBeat(
    coords: PixelCoordinates,
    measureNumber: number,
    barQuarters: number,
    quantizationBeats: number
  ): {
    beat: number
    reason: string
    usedCoordCalc: boolean
    nearestLeft: ElementInfo | null
    nearestRight: ElementInfo | null
    leftDistance: number
    rightDistance: number
  } {
    const registry = this.elementRegistry
    const { nearestLeft, nearestRight, leftDistance, rightDistance } =
      registry.findNotesLeftRight(coords.x, measureNumber)

    const nearestDistance = Math.min(
      nearestLeft ? leftDistance : Infinity,
      nearestRight ? rightDistance : Infinity
    )
    const rawBeat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, barQuarters)
    const quantize = (raw: number) => {
      const q = Math.round(raw / quantizationBeats) * quantizationBeats
      return Math.max(0, Math.min(q, barQuarters - quantizationBeats))
    }

    let beat = 0
    let reason = ''
    let usedCoordCalc = false

    if (nearestDistance > FAR_THRESHOLD) {
      usedCoordCalc = true
      beat = quantize(rawBeat)
      reason = `coordCalc (nearest=${nearestDistance.toFixed(0)}px > ${FAR_THRESHOLD}px)`
    } else {
      let targetElement: { type: string; beat: number } | null = null

      if (nearestRight && nearestRight.beat !== undefined && rightDistance <= FAR_THRESHOLD) {
        if (nearestLeft && nearestLeft.beat !== undefined && leftDistance < CLOSE_THRESHOLD && leftDistance < rightDistance) {
          targetElement = { type: nearestLeft.type, beat: nearestLeft.beat }
          reason = `left (${leftDistance.toFixed(0)}px < ${CLOSE_THRESHOLD}px, closer than right)`
        } else {
          targetElement = { type: nearestRight.type, beat: nearestRight.beat }
          reason = `right (${rightDistance.toFixed(0)}px)`
        }
      } else if (nearestLeft && nearestLeft.beat !== undefined && leftDistance <= FAR_THRESHOLD) {
        targetElement = { type: nearestLeft.type, beat: nearestLeft.beat }
        reason = `left-only (${leftDistance.toFixed(0)}px)`
      }

      if (!targetElement) {
        usedCoordCalc = true
        beat = quantize(rawBeat)
        reason = 'coordCalc (no valid target)'
      } else if (targetElement.type === 'rest') {
        beat = targetElement.beat
        reason += ` → rest@${targetElement.beat}`
      } else if (targetElement.type === 'note') {
        beat = targetElement.beat
        reason += ` → note@${targetElement.beat}`
      } else {
        usedCoordCalc = true
        beat = quantize(rawBeat)
        reason = 'coordCalc (unknown element type)'
      }
    }

    return { beat, reason, usedCoordCalc, nearestLeft, nearestRight, leftDistance, rightDistance }
  }

  /**
   * Find a rest that covers the given beat position.
   * Returns the rest if found, null otherwise.
   */
  private findRestAtBeat(notes: Note[], beat: Fraction): Note | null {
    for (const note of notes) {
      if (note.isRest) {
        const restEnd = fracAdd(note.beat, durationToFraction(note.duration, note.dots || 0))
        // Check if the beat falls within this rest's time span
        if (fracGte(beat, note.beat) && fracLt(beat, restEnd)) {
          return note
        }
      }
    }
    return null
  }

  /**
   * Find the rest nearest to the given beat (before or after).
   * Used when coordinate calculation lands on a beat without a rest.
   */
  private findNearestRestToBeat(notes: Note[], targetBeat: Fraction): Note | null {
    let nearestRest: Note | null = null
    let smallestDistance = Infinity

    for (const note of notes) {
      if (note.isRest) {
        const distance = Math.abs(fracToNumber(fracSub(note.beat, targetBeat)))
        if (distance < smallestDistance) {
          smallestDistance = distance
          nearestRest = note
        }
      }
    }
    return nearestRest
  }

  /**
   * Place a note that spans across one barline by splitting it into a tied chain:
   * `currentMeasureDurations` in the start measure, `nextMeasureDurations` in the next.
   * The single primitive behind both note-entry and duration-change overflow.
   *
   * The ONLY difference between those two callers is the chain head: pass
   * `existingHeadId` to reuse an existing note as the first link (duration change),
   * or omit it to create the head fresh (note entry). Returns the first note in the
   * chain (the reused/created head), or null if the split or measure creation fails.
   */
  private placeSpanningNote(p: {
    step: NoteParams['step']
    alter: NoteParams['alter']
    octave: NoteParams['octave']
    startMeasure: number
    startBeat: Fraction
    totalBeats: number
    overflowAmount: number
    voice?: NoteParams['voice']
    existingHeadId?: string
  }): Note | null {
    const beatsInCurrentMeasure = p.totalBeats - p.overflowAmount
    const beatsInNextMeasure = p.overflowAmount

    const currentMeasureDurations = splitBeatsIntoDurations(beatsInCurrentMeasure)
    const nextMeasureDurations = splitBeatsIntoDurations(beatsInNextMeasure)

    if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
      console.warn('Could not split spanning note into valid durations')
      return null
    }

    const nextMeasureNumber = p.startMeasure + 1
    if (!this.ensureMeasureExists(nextMeasureNumber)) {
      console.warn('Could not create next measure for tie split')
      return null
    }

    // Erode notes in the overflow zone of the next measure (Sibelius-style)
    this.erodeOverflowZone(nextMeasureNumber, beatsInNextMeasure, p.voice ?? 0)

    const model = this.getScoreModel()
    const pitch = { step: p.step, alter: p.alter, octave: p.octave, ...(p.voice && { voice: p.voice }) }

    // Build the tied chain. Split durations are always plain (dots cleared).
    let firstNote: Note | null = null
    let previousNoteId: string | null = null
    let currentBeat = p.startBeat
    let startIndex = 0

    if (p.existingHeadId) {
      // Reuse the existing note as the head: retitle its duration to the first piece.
      model.updateNote(p.existingHeadId, { duration: currentMeasureDurations[0], dots: 0 })
      firstNote = model.getNote(p.existingHeadId) ?? null
      previousNoteId = p.existingHeadId
      currentBeat = fracAdd(currentBeat, durationToFraction(currentMeasureDurations[0]))
      startIndex = 1
    }

    // Remaining current-measure pieces (when the split needs > 1, e.g. 3 beats → h + q)
    for (let i = startIndex; i < currentMeasureDurations.length; i++) {
      const note = model.addNote({ ...pitch, duration: currentMeasureDurations[i], measure: p.startMeasure, beat: currentBeat })
      if (!firstNote) firstNote = note
      if (previousNoteId) {
        model.updateNote(previousNoteId, { tiedTo: note.id })
        model.updateNote(note.id, { tiedFrom: previousNoteId })
      }
      previousNoteId = note.id
      currentBeat = fracAdd(currentBeat, durationToFraction(currentMeasureDurations[i]))
    }

    // Tied continuation pieces in the next measure
    let nextBeat = fracFromInt(0)
    for (const duration of nextMeasureDurations) {
      const note = model.addNote({ ...pitch, duration, measure: nextMeasureNumber, beat: nextBeat })
      if (previousNoteId) {
        model.updateNote(previousNoteId, { tiedTo: note.id })
        model.updateNote(note.id, { tiedFrom: previousNoteId })
      }
      previousNoteId = note.id
      nextBeat = fracAdd(nextBeat, durationToFraction(duration))
    }

    console.log('Placed spanning note with tie:', {
      head: p.existingHeadId ?? firstNote?.id, currentDurations: currentMeasureDurations,
      nextMeasure: nextMeasureNumber, nextDurations: nextMeasureDurations,
    })
    return firstNote
  }

  /** Extend the score with empty measures until `measureNumber` exists. */
  private ensureMeasureExists(measureNumber: number): boolean {
    let attempts = MAX_MEASURE_CREATE_ATTEMPTS
    while (!this.getScoreModel().getMeasure(measureNumber) && attempts-- > 0) {
      this.getScoreModel().addMeasure()
    }
    return !!this.getScoreModel().getMeasure(measureNumber)
  }

  /**
   * Split an existing note with a tie when its duration changes to overflow.
   * Thin wrapper: reuses the note as the chain head via {@link placeSpanningNote}.
   */
  splitExistingNoteWithTie(existingNote: Note, newDuration: NoteParams['duration'], overflowAmount: number, newDots: number = 0): void {
    this.placeSpanningNote({
      step: existingNote.step,
      alter: existingNote.alter,
      octave: existingNote.octave,
      startMeasure: existingNote.measure,
      startBeat: existingNote.beat,
      totalBeats: durationToBeats(newDuration, newDots),
      overflowAmount,
      voice: existingNote.voice,
      existingHeadId: existingNote.id,
    })
  }

  /**
   * Add a note that spans across a bar line by splitting it with a tie.
   * Thin wrapper: creates a fresh chain head via {@link placeSpanningNote}.
   * Returns the first note (in the current measure) or null if failed.
   */
  private addSplitNoteWithTie(noteParams: NoteParams, overflowAmount: number): Note | null {
    return this.placeSpanningNote({
      step: noteParams.step,
      alter: noteParams.alter,
      octave: noteParams.octave,
      startMeasure: noteParams.measure,
      startBeat: noteParams.beat,
      totalBeats: durationToBeats(noteParams.duration, noteParams.dots || 0),
      overflowAmount,
      voice: noteParams.voice,
    })
  }

  /**
   * Erode all notes in the overflow zone of the next measure.
   * Notes fully within [0, overflowBeats) are deleted.
   * Notes that straddle the boundary are trimmed and moved to start at overflowBeats.
   * Notes with a downstream tiedTo are deleted (punt case).
   */
  private erodeOverflowZone(measureNumber: number, overflowBeats: number, voice: number = 0): void {
    const epsilon = 0.001
    const notes = this.getScoreModel().getNotesInMeasure(measureNumber)
    for (const note of notes) {
      if (note.isRest) continue
      // Only erode the overflowing note's own voice — other streams are independent.
      if ((note.voice ?? 0) !== voice) continue
      const noteBeat = fracToNumber(note.beat)
      if (noteBeat >= overflowBeats - epsilon) continue
      this.erodeNoteAtBoundary(note, overflowBeats)
    }
  }

  /**
   * Erode a single note that starts within the overflow zone.
   * - Fully consumed (noteEnd <= overflowBeats): break upstream tiedFrom, delete.
   * - Straddles (noteEnd > overflowBeats, no tiedTo): trim duration and move to overflowBeats.
   *   If the remainder needs multiple durations, build a tie chain for the tail.
   * - Has tiedTo (downstream chain): delete (punt case — too complex to rewire).
   */
  private erodeNoteAtBoundary(note: Note, overflowBeats: number): void {
    const epsilon = 0.001
    const noteBeat = fracToNumber(note.beat)
    const noteDurBeats = durationToBeats(note.duration, note.dots ?? 0)
    const noteEnd = noteBeat + noteDurBeats

    if (noteEnd <= overflowBeats + epsilon) {
      // Fully consumed — break upstream tie pointer then delete
      if (note.tiedFrom) {
        this.getScoreModel().updateNote(note.tiedFrom, { tiedTo: undefined })
      }
      this.getScoreModel().deleteNote(note.id)
      return
    }

    // Straddles boundary — punt to deletion if note has a downstream tie chain
    if (note.tiedTo) {
      this.getScoreModel().deleteNote(note.id)
      return
    }

    // Trim: remainder starts at overflowBeats
    const remainderBeats = noteEnd - overflowBeats
    const remainderDurations = splitBeatsIntoDurations(remainderBeats)
    if (remainderDurations.length === 0) {
      this.getScoreModel().deleteNote(note.id)
      return
    }

    // Break incoming tie
    if (note.tiedFrom) {
      this.getScoreModel().updateNote(note.tiedFrom, { tiedTo: undefined })
    }

    // Update the note: first remainder duration, moved to overflowBeats
    this.getScoreModel().updateNote(note.id, {
      duration: remainderDurations[0],
      dots: 0,
      beat: beatToFrac(overflowBeats),
      tiedFrom: undefined,
    })

    // Build tie chain for any additional remainder durations
    if (remainderDurations.length > 1) {
      let prevId = note.id
      let currentBeat = fracAdd(beatToFrac(overflowBeats), durationToFraction(remainderDurations[0]))
      for (let i = 1; i < remainderDurations.length; i++) {
        const dur = remainderDurations[i]
        const tailNote = this.getScoreModel().addNote({
          step: note.step,
          alter: note.alter,
          octave: note.octave,
          duration: dur,
          measure: note.measure,
          beat: currentBeat,
          ...(note.voice && { voice: note.voice }),
        })
        this.getScoreModel().updateNote(prevId, { tiedTo: tailNote.id })
        this.getScoreModel().updateNote(tailNote.id, { tiedFrom: prevId })
        prevId = tailNote.id
        currentBeat = fracAdd(currentBeat, durationToFraction(dur))
      }
    }
  }

  /**
   * Find notes that would be overwritten by a new note.
   * Returns notes that fall within the new note's duration range.
   * Notes at the same beat with DIFFERENT pitch are kept (chords).
   * Notes at the same beat with SAME pitch are deleted (replacement).
   *
   * @param isTiedContinuation - If true, delete ALL notes at the same beat (tied notes eat existing notes)
   */
  private findNotesToOverwrite(
    measureNumber: number,
    beat: Fraction,
    duration: NoteParams['duration'],
    pitch: number,
    isTiedContinuation: boolean = false,
    tupletInfo?: Tuplet,
    voice: number = 0,
  ): Note[] {
    // For tuplet notes, use the actual tuplet note duration, not the base duration
    const noteDurationFrac = tupletInfo
      ? getTupletNoteDurationFrac(tupletInfo.baseDuration, tupletInfo.numNotes, tupletInfo.notesOccupied)
      : durationToFraction(duration)
    const noteEnd = fracAdd(beat, noteDurationFrac)
    const notesInMeasure = this.getScoreModel().getNotesInMeasure(measureNumber)

    return notesInMeasure.filter(existing => {
      // Skip rests - they're handled separately by ScoreModel
      if (existing.isRest) return false

      // Other voices are independent streams — never overwrite them.
      if ((existing.voice ?? 0) !== voice) return false

      // Never delete notes that are in the same tuplet (except for same-beat replacement)
      // Notes within a tuplet should coexist and not overwrite each other based on range
      if (tupletInfo && existing.tupletId === tupletInfo.id) {
        // Only allow deletion if at the exact same beat AND same pitch (replacement)
        if (fracEq(existing.beat, beat) && !existing.isRest && spellingToMidi(existing.step!, existing.alter!, existing.octave!) === pitch) {
          return true
        }
        return false  // Protect all other notes in the same tuplet
      }

      // Notes at the same beat:
      // - For tied continuations: delete ALL notes (tied notes "eat" existing notes)
      // - For normal notes: only delete if same pitch (replacement), different pitch = chord
      if (fracEq(existing.beat, beat)) {
        if (isTiedContinuation) {
          return true  // Delete all notes at this beat for tied continuations
        }
        return !existing.isRest && spellingToMidi(existing.step!, existing.alter!, existing.octave!) === pitch  // Delete if same MIDI pitch (replacement)
      }

      // Check if this note starts within the new note's time range
      if (fracGt(existing.beat, beat) && fracLt(existing.beat, noteEnd)) {
        return true
      }

      return false
    })
  }
}
