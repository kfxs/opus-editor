import { ScoreModel } from './models/ScoreModel'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import {
  durationToBeats, beatsToDuration, splitBeatsIntoDurations, midiToNoteName,
  getTupletBeatPositionsFrac, snapToTupletBeatFrac,
  getTupletNoteDurationFrac, getTupletTotalBeatsFrac, beatToFrac,
} from '@/utils/musicUtils'
import {
  fracToNumber, fracEq, fracAdd, fracSub, fracMul, fracDiv,
  fracLt, fracGt, fracGte, fracIsPositive, fracFromInt, fracCreate,
  durationToFraction, tupletNoteDurationFraction,
} from '@/utils/fraction'
import type { Fraction } from '@/utils/fraction'
import type { Note, NoteParams, PixelCoordinates, Tuplet, NoteDuration, ArticulationType, Accidental, PitchSpelling } from '@/types/music'
import { spellingToMidi, accidentalToAlter } from '@/utils/pitchSpelling'
import { ElementRegistry } from './ElementRegistry'
import type { ElementInfo } from './ElementRegistry'

const CLOSE_THRESHOLD = 25
const FAR_THRESHOLD = 40
export const INVALID_NOTE_ENTRY_TYPES = ['clef', 'timeSignature', 'barline', 'keySignature']

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
      finalBeatFrac = snapToTupletBeatFrac(params.beat, tupletAtBeat)
      tupletId = tupletAtBeat.id
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
    const toDelete = this.getScoreModel().getNotesInMeasure(params.measure).filter(n => {
      if (n.isRest) return false
      let nDuration = durationToBeats(n.duration, n.dots || 0)
      if (n.tupletId) {
        const nTuplet = (targetMeasure.tuplets || []).find(t => t.id === n.tupletId)
        if (nTuplet) nDuration *= nTuplet.notesOccupied / nTuplet.numNotes
      }
      const nBeat = fracToNumber(n.beat)
      const nEnd = nBeat + nDuration
      return nBeat + epsilon < noteEnd && nEnd - epsilon > finalBeat
    })
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
      console.log(`KeyboardEntry | ${params.step}${alt}${params.octave} dur:${params.duration} measure:${params.measure} beat:${finalBeat.toFixed(3)} → overflow ${overflow.overflowAmount.toFixed(3)}b — splitting with tie`)
      const splitNote = this.addSplitNoteWithTie(finalParams, overflow.overflowAmount)
      if (splitNote) {
        this.onCommit('Keyboard enter note')
      }
      return splitNote
    }

    const note = this.getScoreModel().addNote(finalParams)
    const noteAlt = note.alter === 2 ? '##' : note.alter === 1 ? '#' : note.alter === -1 ? 'b' : note.alter === -2 ? 'bb' : ''
    console.log(`✓ KeyboardEntry | ${note.step}${noteAlt}${note.octave} dur:${note.duration} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}${tupletAtBeat ? ` tuplet:${tupletAtBeat.id}` : ''}`)

    if (tupletAtBeat && tupletId) {
      // Add filler rests for the remainder of the slot (structurally necessary).
      // Return the placed note — cursor stays on it; the beat map naturally advances
      // to the next available sub-slot or slot boundary on the next key press.
      this.fillTupletSlotRemainder(params.measure, note.beat, params.duration, params.dots || 0, tupletAtBeat)
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
    articulations?: ArticulationType[]
  ): Note | null {
    const measure = this.getScoreModel().getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator
    const registry = this.elementRegistry

    // Get measure number from coordinates
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists
    if (!this.getScoreModel().getMeasure(measureNumber)) {
      console.log('✗ Invalid: measure does not exist')
      return null
    }

    // Check if click is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor) {
      if (INVALID_NOTE_ENTRY_TYPES.includes(elementAtCursor.type)) {
        console.log(`✗ Invalid: clicked on ${elementAtCursor.type}`)
        return null
      }
    }

    // Check if click is within valid staff area (X range)
    const staffGeometry = registry.getStaffGeometry(measureNumber)
    if (staffGeometry) {
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        console.log('✗ Invalid: X outside note entry area')
        return null
      }

      // Check if click is within valid Y range (reasonable pitch range)
      // Allow ~2 octaves above/below staff (staff lines span ~4 lines = 40px typically)
      const topLineY = staffGeometry.lineYPositions[0]
      const bottomLineY = staffGeometry.lineYPositions[4]
      const staffHeight = bottomLineY - topLineY
      const maxDistance = staffHeight * 2  // Allow 2x staff height above/below

      if (coords.y < topLineY - maxDistance || coords.y > bottomLineY + maxDistance) {
        console.log(`✗ Invalid: Y outside valid range (y=${coords.y.toFixed(0)}, valid=${(topLineY - maxDistance).toFixed(0)}-${(bottomLineY + maxDistance).toFixed(0)})`)
        return null
      }
    }

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
    } = this.resolveClickToBeat(coords, measureNumber, beatsInMeasure, durationToBeats(duration))
    let finalBeat: Fraction = beatToFrac(resolvedBeat)
    let decisionReason = resolvedReason

    // When using coordinate calculation, we need to find if there's a rest at that beat
    // or if we'd be creating a new note position
    if (useCoordinateCalculation) {
      const notesInMeasure = this.getScoreModel().getNotesInMeasure(measureNumber)
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
          // No rest and no notes at this beat - find nearest rest
          const nearestRest = this.findNearestRestToBeat(notesInMeasure, finalBeat)
          if (nearestRest) {
            finalBeat = nearestRest.beat
          } else {
            console.warn('No available position for note')
            return null
          }
        }
      }
    }

    // Check if the final beat falls within a tuplet
    // If so, snap to the nearest tuplet beat and inherit the tuplet ID
    let tupletId: string | undefined
    let tupletFillerRest: { beat: Fraction; duration: NoteDuration } | null = null
    const tupletAtBeat = this.getScoreModel().getTupletAtBeat(measureNumber, finalBeat)

    // Check if there's an existing tuplet rest at the final beat position
    // This handles subdivision positions (e.g., 0.5 in a triplet with 16th notes)
    // where we should use the exact beat rather than snapping to the base grid
    const existingTupletRestAtBeat = (() => {
      const notesInMeasure = this.getScoreModel().getNotesInMeasure(measureNumber)
      return notesInMeasure.find(n =>
        n.isRest && n.tupletId && fracEq(n.beat, finalBeat)
      )
    })()

    if (tupletAtBeat) {
      // Only snap to base grid if there's no existing tuplet rest at this exact position
      // Existing tuplet rests may be at subdivision positions that aren't on the base grid
      if (!existingTupletRestAtBeat) {
        finalBeat = snapToTupletBeatFrac(finalBeat, tupletAtBeat)
      }

      // Check if the selected duration is smaller than the tuplet's base duration
      // If so, we need to add a filler rest for the remaining time in that slot
      const baseDurationFrac = durationToFraction(tupletAtBeat.baseDuration)
      const selectedDurationFrac = durationToFraction(duration, dots)

      // Calculate the tuplet's total duration and remaining time
      const tupletTotalBeatsFrac = getTupletTotalBeatsFrac(tupletAtBeat.baseDuration, tupletAtBeat.notesOccupied)
      const tupletEndBeat = fracAdd(tupletAtBeat.startBeat, tupletTotalBeatsFrac)
      const remainingTupletBeats = fracSub(tupletEndBeat, finalBeat)

      // Check if the note is too large to fit in the tuplet
      // Case 1: Note larger than entire tuplet → delete tuplet and place at start
      const noteLargerThanEntireTuplet = fracGt(selectedDurationFrac, tupletTotalBeatsFrac)

      // Case 2: Note fits in tuplet overall but doesn't fit in REMAINING space
      // In a tuplet, durations are scaled by the tuplet ratio (notesOccupied / numNotes)
      // e.g., in a triplet (3:2), a quarter note takes 2/3 of its normal duration
      const scaledNoteDurationFrac = tupletNoteDurationFraction(duration, dots ?? 0, tupletAtBeat.numNotes, tupletAtBeat.notesOccupied)
      const noteTooLargeForRemainingSpace = fracGt(scaledNoteDurationFrac, remainingTupletBeats)

      if (noteLargerThanEntireTuplet) {
        // Note is too large for the tuplet - delete the tuplet and place note at tuplet's start
        this.getScoreModel().deleteTuplet(tupletAtBeat.id)
        // Place note at the tuplet's start beat (a clean position) instead of the clicked tuplet position
        finalBeat = tupletAtBeat.startBeat
        // Don't set tupletId - note will be placed outside of any tuplet
        decisionReason += ` → tuplet deleted (note too large), beat adjusted to ${fracToNumber(finalBeat).toFixed(3)}`
      } else if (noteTooLargeForRemainingSpace) {
        // Note doesn't fit in remaining tuplet space - reject the entry silently
        console.log(`Note rejected: duration (${fracToNumber(scaledNoteDurationFrac).toFixed(3)} scaled beats) too large for remaining tuplet space (${fracToNumber(remainingTupletBeats).toFixed(3)} beats)`)
        return null
      } else {
        // Note fits in tuplet
        tupletId = tupletAtBeat.id

        // Calculate how many "slots" (base durations) this note consumes
        const slotsConsumedFrac = fracDiv(selectedDurationFrac, baseDurationFrac)

        // Calculate the exact tuplet slot duration
        const tupletSlotDurationFrac = getTupletNoteDurationFrac(
          tupletAtBeat.baseDuration,
          tupletAtBeat.numNotes,
          tupletAtBeat.notesOccupied
        )

        if (fracLt(selectedDurationFrac, baseDurationFrac)) {
          // Note is SMALLER than base duration (e.g., 16th in 8th triplet)
          // Calculate how many of the selected duration fit in one base slot
          const subdivisionFactorFrac = fracDiv(baseDurationFrac, selectedDurationFrac)

          // Calculate the sub-slot duration (duration of one small note in tuplet time)
          const subSlotDurationFrac = fracDiv(tupletSlotDurationFrac, subdivisionFactorFrac)

          // We need a filler rest after this note
          // The rest duration should be the same as the note duration
          // and positioned at (note beat + subSlotDuration)
          tupletFillerRest = {
            beat: fracAdd(finalBeat, subSlotDurationFrac),
            duration: duration,
          }
        } else {
          // Note is >= base duration - check for fractional slots
          const fractionalSlotsFrac = fracSub(slotsConsumedFrac, fracFromInt(Math.floor(fracToNumber(slotsConsumedFrac))))

          if (fracIsPositive(fractionalSlotsFrac)) {
            // Note takes fractional slots (e.g., dotted 8th = 1.5 slots in 8th triplet)
            // Need to create a filler rest for the remaining fraction
            // e.g., 1.5 slots leaves 0.5 slots which needs a 16th rest

            // Calculate the filler rest duration in normal beats
            const remainderNormalBeatsFrac = fracMul(fractionalSlotsFrac, baseDurationFrac)
            const fillerDuration = beatsToDuration(fracToNumber(remainderNormalBeatsFrac))

            if (fillerDuration) {
              // Calculate where the filler rest goes (after the note ends in actual time)
              const fillerBeat = fracAdd(finalBeat, scaledNoteDurationFrac)

              // Only add filler if it's within the tuplet
              if (fracLt(fillerBeat, tupletEndBeat)) {
                tupletFillerRest = {
                  beat: fillerBeat,
                  duration: fillerDuration,
                }
              }
            } else {
              // Can't find a standard duration for the remainder - reject
              console.log(`Note rejected: fractional remainder ${fracToNumber(remainderNormalBeatsFrac).toFixed(3)} beats has no standard duration`)
              return null
            }
          }
        }

        decisionReason += ` → tuplet snap@${fracToNumber(finalBeat).toFixed(3)}`
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

    // Find and delete notes that would be overwritten by this note
    // This includes: notes within the duration range AND same-pitch notes at same beat (replacement)
    const notesToOverwrite = this.findNotesToOverwrite(measureNumber, finalBeat, duration, pitchMidi, false, tupletAtBeat)
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

    // Handle overflow by splitting note across bar line with tie
    // SKIP for tuplet notes - tuplets have shorter actual durations and are designed to fit within their span
    if (overflow.willOverflow && overflow.overflowAmount && !tupletId) {
      // Also update existing chord notes at the same beat to have the same duration and ties
      // Skip notes that are already tied (already split) to avoid creating duplicates
      const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n => !n.isRest && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi && !n.tiedTo)

      // Split each existing chord note with ties
      for (const chordNote of existingChordNotes) {
        this.splitExistingNoteWithTie(chordNote, duration, overflow.overflowAmount, dots)
      }

      const splitNote = this.addSplitNoteWithTie(noteParams, overflow.overflowAmount)
      if (splitNote) {
        this.onCommit(`Add ${midiToNoteName(pitchMidi)}`)
      }
      return splitNote
    }

    // For non-overflow cases, update existing chord notes to match duration
    const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi)
    for (const chordNote of existingChordNotes) {
      if (chordNote.duration !== duration) {
        this.getScoreModel().updateNote(chordNote.id, { duration })
      }
    }

    const note = this.getScoreModel().addNote(noteParams)

    // Fill remaining sub-slots in the tuplet slot with rests (general: works for any subdivision)
    if (note && tupletFillerRest && tupletId && tupletAtBeat) {
      this.fillTupletSlotRemainder(measureNumber, note.beat, duration, dots ?? 0, tupletAtBeat)
    }

    // Debug logging with full context
    if (note) {
      console.log('NoteEntry:', {
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
    const measure = this.getScoreModel().getMeasure(1)
    if (!measure) return null

    const beatsInMeasure = measure.timeSignature.numerator
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) {
      console.log('✗ Invalid: measure does not exist')
      return null
    }

    const noteDurationInBeats = durationToBeats(duration)
    const tupletTotalBeats = noteDurationInBeats * notesOccupied

    // Resolve beat using directional element logic
    const {
      beat: resolvedBeat, reason: decisionReason,
      nearestLeft, nearestRight, leftDistance, rightDistance,
    } = this.resolveClickToBeat(coords, measureNumber, beatsInMeasure, noteDurationInBeats)
    let beat = resolvedBeat

    // Clamp to valid range (tuplet must fit in measure)
    beat = Math.max(0, Math.min(beat, beatsInMeasure - tupletTotalBeats))

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

    // createTuplet deletes the element at this beat and fills all slots with rests
    const tuplet = this.getScoreModel().createTuplet(note.measure, note.beat, note.duration, numNotes, notesOccupied)

    const beatPositions = getTupletBeatPositionsFrac(note.beat, note.duration, numNotes, notesOccupied)
    const tupletNotes = this.getScoreModel().getNotesInTuplet(tuplet.id)
    const firstRest = tupletNotes.find(n => n.isRest && fracEq(n.beat, beatPositions[0]))

    if (!firstRest) {
      console.warn('Could not find first rest in tuplet after applying to selected note')
      return null
    }

    if (note.isRest) {
      // createTuplet already placed a rest here — nothing more to do
      this.onCommit('Apply tuplet')
      return { tuplet, note: firstRest }
    }

    // For pitched notes: replace the first rest with the original note's pitch
    this.getScoreModel().deleteNote(firstRest.id)
    const newNote = this.getScoreModel().addNote({
      step: note.step,
      alter: note.alter,
      octave: note.octave,
      duration: note.duration,
      measure: note.measure,
      beat: beatPositions[0],
      tupletId: tuplet.id,
      ...(note.stemDirection && { stemDirection: note.stemDirection }),
    })

    this.onCommit('Apply tuplet')
    return { tuplet, note: newNote }
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

    // Create the tuplet (fills with rests and deletes overlapping notes)
    const beatFrac = beatToFrac(beat)
    const tuplet = this.getScoreModel().createTuplet(measureNumber, beatFrac, duration, numNotes, notesOccupied)
    const beatPositions = getTupletBeatPositionsFrac(beatFrac, duration, numNotes, notesOccupied)
    const tupletNotes = this.getScoreModel().getNotesInTuplet(tuplet.id)
    const firstRest = tupletNotes.find(n => n.isRest && fracEq(n.beat, beatPositions[0]))

    let firstNote: Note

    if (existingNoteData) {
      // Re-add the pre-existing note as part of the tuplet, then add new note as chord
      if (firstRest) this.getScoreModel().deleteNote(firstRest.id)
      this.getScoreModel().addNote({
        step: existingNoteData.step,
        alter: existingNoteData.alter,
        octave: existingNoteData.octave,
        duration,
        measure: measureNumber,
        beat: beatPositions[0],
        tupletId: tuplet.id,
      })
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        measure: measureNumber,
        beat: beatPositions[0],
        tupletId: tuplet.id,
      })
    } else {
      // Replace the first rest with the new note
      if (!firstRest) {
        console.warn('Could not find first rest in tuplet')
        return null
      }
      this.getScoreModel().deleteNote(firstRest.id)
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        measure: measureNumber,
        beat: beatPositions[0],
        tupletId: tuplet.id,
      })
    }

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
    beatsInMeasure: number,
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
    const rawBeat = this.coordinateMapper.pixelXToBeat(coords.x, measureNumber, beatsInMeasure)
    const quantize = (raw: number) => {
      const q = Math.round(raw / quantizationBeats) * quantizationBeats
      return Math.max(0, Math.min(q, beatsInMeasure - quantizationBeats))
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
   * Split an existing note with a tie when its duration changes to overflow.
   */
  splitExistingNoteWithTie(existingNote: Note, newDuration: NoteParams['duration'], overflowAmount: number, newDots: number = 0): void {
    const totalBeats = durationToBeats(newDuration, newDots)
    const beatsInCurrentMeasure = totalBeats - overflowAmount
    const beatsInNextMeasure = overflowAmount

    const currentMeasureDurations = splitBeatsIntoDurations(beatsInCurrentMeasure)
    const nextMeasureDurations = splitBeatsIntoDurations(beatsInNextMeasure)

    if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
      console.warn('Could not split existing note into valid durations')
      return
    }

    // Update the existing note's duration to the first part (clear dots — split durations are always plain)
    this.getScoreModel().updateNote(existingNote.id, { duration: currentMeasureDurations[0], dots: 0 })

    // Check if next measure exists, if not create it
    const nextMeasureNumber = existingNote.measure + 1
    if (!this.getScoreModel().getMeasure(nextMeasureNumber)) {
      let attempts = 20
      while (!this.getScoreModel().getMeasure(nextMeasureNumber) && attempts-- > 0) {
        this.getScoreModel().addMeasure()
      }
      if (!this.getScoreModel().getMeasure(nextMeasureNumber)) {
        console.warn('Could not create next measure for tie split')
        return
      }
    }

    // Erode notes in the overflow zone of the next measure (Sibelius-style)
    this.erodeOverflowZone(nextMeasureNumber, beatsInNextMeasure)

    // Build a chain of tied notes across the barline.
    // Chain: existingNote → [extra current-measure notes if needed] → [next-measure notes]
    let previousNoteId = existingNote.id

    // Add any extra tied notes within the current measure (when split needs > 1 duration, e.g. 3 beats → h + q)
    let currentBeat = fracAdd(existingNote.beat, durationToFraction(currentMeasureDurations[0]))
    for (let i = 1; i < currentMeasureDurations.length; i++) {
      const dur = currentMeasureDurations[i]
      const extraNote = this.getScoreModel().addNote({
        step: existingNote.step,
        alter: existingNote.alter,
        octave: existingNote.octave,
        duration: dur,
        measure: existingNote.measure,
        beat: currentBeat,
      })
      this.getScoreModel().updateNote(previousNoteId, { tiedTo: extraNote.id })
      this.getScoreModel().updateNote(extraNote.id, { tiedFrom: previousNoteId })
      previousNoteId = extraNote.id
      currentBeat = fracAdd(currentBeat, durationToFraction(dur))
    }

    // Add tied continuation notes in the next measure
    let nextBeat = fracFromInt(0)
    for (const duration of nextMeasureDurations) {
      const continuationNote = this.getScoreModel().addNote({
        step: existingNote.step,
        alter: existingNote.alter,
        octave: existingNote.octave,
        duration,
        measure: nextMeasureNumber,
        beat: nextBeat,
      })
      this.getScoreModel().updateNote(previousNoteId, { tiedTo: continuationNote.id })
      this.getScoreModel().updateNote(continuationNote.id, { tiedFrom: previousNoteId })
      previousNoteId = continuationNote.id
      nextBeat = fracAdd(nextBeat, durationToFraction(duration))
    }

    console.log('Split existing note with tie:', {
      noteId: existingNote.id,
      step: existingNote.step,
      alter: existingNote.alter,
      octave: existingNote.octave,
      currentDurations: currentMeasureDurations,
      nextDurations: nextMeasureDurations,
    })
  }

  /**
   * Add a note that spans across a bar line by splitting it with a tie.
   * Returns the first note (in current measure) or null if failed.
   */
  private addSplitNoteWithTie(noteParams: NoteParams, overflowAmount: number): Note | null {
    const totalBeats = durationToBeats(noteParams.duration, noteParams.dots || 0)
    const beatsInCurrentMeasure = totalBeats - overflowAmount
    const beatsInNextMeasure = overflowAmount

    const currentMeasureDurations = splitBeatsIntoDurations(beatsInCurrentMeasure)
    const nextMeasureDurations = splitBeatsIntoDurations(beatsInNextMeasure)

    if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
      console.warn('Could not split note into valid durations')
      return null
    }

    // Check if next measure exists, if not create it
    const nextMeasureNumber = noteParams.measure + 1
    let nextMeasure = this.getScoreModel().getMeasure(nextMeasureNumber)
    if (!nextMeasure) {
      let attempts = 20
      while (!this.getScoreModel().getMeasure(nextMeasureNumber) && attempts-- > 0) {
        this.getScoreModel().addMeasure()
      }
      nextMeasure = this.getScoreModel().getMeasure(nextMeasureNumber)
      if (!nextMeasure) {
        console.warn('Could not create next measure for tie split')
        return null
      }
    }

    // Erode notes in the overflow zone of the next measure (Sibelius-style)
    this.erodeOverflowZone(nextMeasureNumber, beatsInNextMeasure)

    // Add notes in current measure (may need multiple if duration splits, e.g., dotted notes)
    let currentBeat = noteParams.beat
    let firstNote: Note | null = null
    let previousNote: Note | null = null

    for (const duration of currentMeasureDurations) {
      const note = this.getScoreModel().addNote({
        step: noteParams.step,
        alter: noteParams.alter,
        octave: noteParams.octave,
        duration,
        measure: noteParams.measure,
        beat: currentBeat,
        // No dots - split durations are standard non-dotted durations
      })
      if (!firstNote) firstNote = note

      // Link with previous note in current measure if there are multiple
      if (previousNote) {
        this.getScoreModel().updateNote(previousNote.id, { tiedTo: note.id })
        this.getScoreModel().updateNote(note.id, { tiedFrom: previousNote.id })
      }

      previousNote = note
      currentBeat = fracAdd(currentBeat, durationToFraction(duration))
    }

    // Add notes in next measure
    let nextBeat = fracFromInt(0)
    for (const duration of nextMeasureDurations) {
      const note = this.getScoreModel().addNote({
        step: noteParams.step,
        alter: noteParams.alter,
        octave: noteParams.octave,
        duration,
        measure: nextMeasureNumber,
        beat: nextBeat,
        // No dots - split durations are standard non-dotted durations
      })

      // Link with previous note (tie across bar line)
      if (previousNote) {
        this.getScoreModel().updateNote(previousNote.id, { tiedTo: note.id })
        this.getScoreModel().updateNote(note.id, { tiedFrom: previousNote.id })
      }

      previousNote = note
      nextBeat = fracAdd(nextBeat, durationToFraction(duration))
    }

    console.log('Split note with tie:', {
      currentMeasure: noteParams.measure,
      currentDurations: currentMeasureDurations,
      nextMeasure: nextMeasureNumber,
      nextDurations: nextMeasureDurations,
    })

    return firstNote
  }

  /**
   * Erode all notes in the overflow zone of the next measure.
   * Notes fully within [0, overflowBeats) are deleted.
   * Notes that straddle the boundary are trimmed and moved to start at overflowBeats.
   * Notes with a downstream tiedTo are deleted (punt case).
   */
  /**
   * After placing a note shorter than the tuplet's baseDuration, fill the remaining
   * sub-slots in that tuplet slot with rests of the same duration.
   *
   * General formula: subdivisionFactor = baseDuration / noteDuration (always a power of 2).
   * We need (subdivisionFactor - 1) filler rests spaced by (tupletSlotDuration / subdivisionFactor).
   *
   * Examples:
   *   16th in 8th triplet → factor=2 → 1 filler rest (fills half-slot)
   *   32nd in 8th triplet → factor=4 → 3 filler rests (fills 3/4 of slot)
   *   64th in 8th triplet → factor=8 → 7 filler rests
   */
  private fillTupletSlotRemainder(
    measureNumber: number,
    noteBeat: Fraction,
    noteDuration: NoteDuration,
    noteDots: number,
    tuplet: { id: string; baseDuration: NoteDuration; numNotes: number; notesOccupied: number; startBeat: Fraction },
  ): Note | null {
    const baseDurationFrac = durationToFraction(tuplet.baseDuration)
    const selectedDurationFrac = durationToFraction(noteDuration, noteDots)
    if (!fracLt(selectedDurationFrac, baseDurationFrac)) return null

    const tupletSlotDurationFrac = getTupletNoteDurationFrac(
      tuplet.baseDuration, tuplet.numNotes, tuplet.notesOccupied
    )
    const tupletEndBeat = fracAdd(tuplet.startBeat, getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied))

    // Sub-slot = actual time one noteDuration occupies inside the tuplet
    const subSlotDurationFrac = fracMul(
      tupletSlotDurationFrac,
      fracDiv(selectedDurationFrac, baseDurationFrac)
    )
    // Note's actual duration equals subSlotDurationFrac (one sub-slot)
    const noteActualDuration = subSlotDurationFrac
    const noteEnd = fracAdd(noteBeat, noteActualDuration)

    // Find which tuplet slot noteBeat falls in, then compute remaining space in that slot
    const offsetInTuplet = fracToNumber(fracSub(noteBeat, tuplet.startBeat))
    const slotDuration = fracToNumber(tupletSlotDurationFrac)
    const slotIndex = Math.floor(offsetInTuplet / slotDuration + 1e-9)
    const nextSlotBoundary = fracAdd(tuplet.startBeat, fracMul(fracFromInt(slotIndex + 1), tupletSlotDurationFrac))

    const remainingFrac = fracSub(nextSlotBoundary, noteEnd)
    const numFillers = Math.max(0, Math.round(fracToNumber(fracDiv(remainingFrac, subSlotDurationFrac))))

    let fillerBeat = noteEnd
    let lastFiller: Note | null = null
    for (let i = 0; i < numFillers; i++) {
      if (!fracLt(fillerBeat, tupletEndBeat)) break
      const existing = this.getScoreModel().getNotesInMeasure(measureNumber)
        .find(n => fracEq(n.beat, fillerBeat) && n.tupletId === tuplet.id)
      if (!existing) {
        lastFiller = this.getScoreModel().addNote({
          duration: noteDuration,
          measure: measureNumber,
          beat: fillerBeat,
          isRest: true,
          tupletId: tuplet.id,
        })
        console.log(`[Tuplet] filler rest dur:${noteDuration} at beat:${fracToNumber(fillerBeat).toFixed(4)}`)
      } else {
        lastFiller = existing
      }
      fillerBeat = fracAdd(fillerBeat, subSlotDurationFrac)
    }

    return lastFiller
  }

  private erodeOverflowZone(measureNumber: number, overflowBeats: number): void {
    const epsilon = 0.001
    const notes = this.getScoreModel().getNotesInMeasure(measureNumber)
    for (const note of notes) {
      if (note.isRest) continue
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
    tupletInfo?: Tuplet
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
