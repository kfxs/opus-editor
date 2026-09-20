import { dbg } from '@/utils/debug'
import { ScoreModel } from './models/ScoreModel'
import { CoordinateMapper } from './rendering/CoordinateMapper'
import { CollisionDetector } from './models/CollisionDetector'
import { durationToBeats, splitBeatsIntoDurations, midiToNoteName, tupletSpan, tupletScale, tupletWrittenDuration, beatToFrac } from '@/utils/musicUtils'
import { measureCapacityQuarters, measureCapacityFrac } from '@/utils/measureCapacity'
import {
  fracToNumber, fracEq, fracAdd, fracSub, fracMul, fracDiv,
  fracLt, fracGt, fracGte, fracLte,
} from '@/utils/fraction'
import { durationToFraction, fitRestDuration, slotLength, writtenLength } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import type { Note, NoteParams, PixelCoordinates, Tuplet, TupletFormat, NoteDuration, ArticulationType, Accidental, PitchSpelling, Measure } from '@/types/music'
import { spellingToMidi, formatPitch } from '@/utils/pitchSpelling'
import { entryAlteration } from './models/entryAlteration'
import { applyEntryOverwrites, overwriteOverlappedNotes } from './models/entryOverwriteOps'
import { addSplitNoteWithTie, splitExistingNoteWithTie } from './models/spanningNoteOps'
import { ElementRegistry } from './ElementRegistry'
import type { ElementInfo } from './ElementRegistry'
import { staffOf, voiceOf } from '@/utils/lanes'

const CLOSE_THRESHOLD = 25
const FAR_THRESHOLD = 40
export const INVALID_NOTE_ENTRY_TYPES = ['clef', 'timeSignature', 'barline']

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
    const finalBeatFrac = params.beat
    let tupletId = params.tupletId
    const tupletAtBeat = tupletId
      ? (targetMeasure.tuplets || []).find(t => t.id === tupletId)
      : this.getScoreModel().getTupletAtBeat(params.measure, params.beat, voiceOf(params), staffOf(params))

    if (tupletAtBeat && !tupletId) {
      tupletId = tupletAtBeat.id
    }

    // Clamp note duration to remaining actual tuplet space (solution A).
    // If the selected written duration would overflow the tuplet, silently use the
    // largest standard duration that fits instead — same behaviour as Sibelius.
    if (tupletAtBeat) {
      const ratio = tupletScale(tupletAtBeat)
      const tupletEnd = fracAdd(tupletAtBeat.startBeat, tupletSpan(tupletAtBeat))
      const remainingActual = fracSub(tupletEnd, finalBeatFrac)
      const noteActual = fracMul(writtenLength(params), ratio)
      if (fracGt(noteActual, remainingActual)) {
        // ÷ the tuplet's own ratio, NOT × N/M. They agree for an ordinary tuplet and part company
        // the moment the two sides carry different note values: "2 quarters in the time of 3
        // eighths" has N/M = 1 while its real scale is 3/4, and clamping by the wrong one computes a
        // written duration a quarter too short. `tupletScale` is the ratio; nothing else is.
        // Float only at the very end, because `splitBeatsIntoDurations` takes a number.
        const maxWritten = fracToNumber(fracDiv(remainingActual, ratio))
        const fitting = splitBeatsIntoDurations(maxWritten)
        if (fitting.length === 0) return null
        dbg(`[Tuplet] duration clamped: ${params.duration} → ${fitting[0]} (remaining actual: ${fracToNumber(remainingActual).toFixed(4)})`)
        params = { ...params, duration: fitting[0], dots: 0 }
      }
    }

    // How long the incoming note actually SOUNDS — scaled by the tuplet when it is going into one.
    // Exact, and exact all the way through the overlap test below: this is a beat, and a beat is a
    // Fraction (see the invariant in ARCHITECTURE.md).
    const soundingDuration = tupletAtBeat
      ? tupletWrittenDuration(tupletAtBeat, params.duration, params.dots || 0)
      : writtenLength(params)
    // Set actualDuration so checkMeasureOverflow uses the scaled duration, not the written one
    const actualDuration = tupletAtBeat ? soundingDuration : undefined

    const finalParams: NoteParams = { ...params, beat: finalBeatFrac, ...(tupletId ? { tupletId } : {}), ...(actualDuration ? { actualDuration } : {}) }
    const noteEnd = fracAdd(finalBeatFrac, soundingDuration)

    // Remove the same-voice, same-staff notes the incoming note overlaps (a stamped REST too — that
    // is what lets it overwrite the notes it covers). The rule is `entryOverwriteOps`.
    const entryVoice = voiceOf(params)
    overwriteOverlappedNotes(this.getScoreModel(), targetMeasure, {
      beat: finalBeatFrac, end: noteEnd, voice: entryVoice, staff: staffOf(params),
    })

    const overflow = this.collisionDetector.checkMeasureOverflow(
      finalParams,
      targetMeasure,
      this.getScoreModel().getNotesInMeasure(params.measure)
    )

    if (overflow.willOverflow && overflow.overflowAmount) {
      dbg(`[Entry] KeyboardEntry | v${entryVoice} ${formatPitch(params)} dur:${params.duration} measure:${params.measure} beat:${fracToNumber(finalBeatFrac).toFixed(3)} → overflow ${overflow.overflowAmount.toFixed(3)}b — splitting with tie`)
      const splitNote = addSplitNoteWithTie(this.getScoreModel(), finalParams, overflow.overflowAmount)
      if (splitNote) {
        this.onCommit('Keyboard enter note')
      }
      return splitNote
    }

    const note = this.getScoreModel().addNote(finalParams)
    dbg(`✓ [Entry] KeyboardEntry | v${voiceOf(note)} ${formatPitch(note)} dur:${note.duration} measure:${note.measure} beat:${fracToNumber(note.beat).toFixed(3)}${tupletAtBeat ? ` tuplet:${tupletAtBeat.id}` : ''}`)

    if (tupletAtBeat && tupletId) {
      this.getScoreModel().refillTupletRemainder(params.measure, tupletAtBeat, voiceOf(params))
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
  /**
   * Place a REST at a clicked position — the rest stamp's click. Note entry with `isRest`, and it is
   * deliberately built out of the same parts: the click resolves to a BEAT the same way a note's
   * does (`resolveClickToBeat`, the same quantization and the same snap to the nearest slot), lands
   * on the same staff, and goes through the same `addNoteAtBeat`, which evicts whatever it covers.
   *
   * Half of {@link addNoteAtPosition}'s body has no meaning here and is absent rather than skipped:
   * a rest has no pitch, so nothing reads Y for a spelling, nothing can collide at a pitch, and
   * nothing can chord. The cursor's Y is read for ONE thing — which staff was clicked.
   *
   * The armed length is capped to what the bar has left ({@link fitRestDuration}); a rest cannot
   * split and tie across a barline the way an overflowing note does.
   */
  addRestAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    dots: number,
    voice: NoteParams['voice'] = 0,
  ): Note | null {
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)
    const entryStaff = this.elementRegistry.staffIndexAtY(measureNumber, coords.y)

    const measure = this.getScoreModel().getMeasure(measureNumber)
    if (!measure) {
      dbg('✗ Rest stamp: measure does not exist')
      return null
    }
    // The same gate note entry uses: a click on the clef / meter / past the barline places nothing.
    if (!this.isValidEntryClick(coords, measureNumber, entryStaff)) return null

    const barQuarters = measureCapacityQuarters(measure)
    const { beat, reason } = this.resolveClickToBeat(
      coords, measureNumber, barQuarters, durationToBeats(duration, dots), entryStaff,
    )
    let finalBeat = beatToFrac(beat)

    // Snap onto the slot already at this beat in the entry stream, so a stamp lands on the grid the
    // bar actually has rather than a pixel-derived beat between two slots. A note does this via its
    // rest/chord branches; a rest has one case — whatever is there, notes included, is replaced.
    const stream = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => voiceOf(n) === (voice ?? 0) && staffOf(n) === entryStaff)
    const covering = stream.find(n => {
      const end = fracAdd(n.beat, slotLength(n))
      return fracGte(finalBeat, n.beat) && fracLt(finalBeat, end)
    })
    if (covering) finalBeat = covering.beat

    const available = fracSub(measureCapacityFrac(measure), finalBeat)
    const fitted = fitRestDuration(duration, dots, available)
    if (!fitted) {
      dbg(`✗ Rest stamp: no room at m${measureNumber} b${fracToNumber(finalBeat).toFixed(3)}`)
      return null
    }
    if (fitted.duration !== duration || fitted.dots !== dots) {
      dbg(`[Rest stamp] ${duration}${'.'.repeat(dots)} exceeds the ${fracToNumber(available).toFixed(3)} beat(s) left in m${measureNumber} → ${fitted.duration}${'.'.repeat(fitted.dots)}`)
    }
    dbg(`[Rest stamp] click → m${measureNumber} b${fracToNumber(finalBeat).toFixed(3)} staff${entryStaff} v${voice ?? 0} (${reason})`)

    return this.addNoteAtBeat({
      duration: fitted.duration,
      measure: measureNumber,
      beat: finalBeat,
      isRest: true,
      ...(fitted.dots && { dots: fitted.dots }),
      ...(voice && { voice }),
      ...(entryStaff && { staff: entryStaff }),
    })
  }

  addNoteAtPosition(
    coords: PixelCoordinates,
    duration: NoteParams['duration'],
    accidental?: Accidental,
    dots?: number,
    articulations?: ArticulationType[],
    beam?: NoteParams['beam'],
    voice: NoteParams['voice'] = 0,
    /** The armed entry tremolo, if any — a note property like the accidental and the dots. */
    tremolo?: NoteParams['tremolo'],
  ): Note | null {
    const registry = this.elementRegistry
    const entryVoice = voice ?? 0

    // Get measure number from coordinates
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)
    // Which stacked staff the click landed on (0-based; 0 at N=1). Note entry targets THIS
    // staff, exactly as pitch is resolved from Y — a click on the bass staff writes there,
    // never merging into the treble staff's same-beat content.
    const entryStaff = registry.staffIndexAtY(measureNumber, coords.y)

    // Validate measure exists, then use ITS capacity (honours a pickup bar)
    const measure = this.getScoreModel().getMeasure(measureNumber)
    if (!measure) {
      dbg('✗ Invalid: measure does not exist')
      return null
    }
    const barQuarters = measureCapacityQuarters(measure)

    // Reject clicks on invalid targets or outside the staff's note-entry area.
    if (!this.isValidEntryClick(coords, measureNumber, entryStaff)) return null

    // Get natural pitch spelling from Y coordinate (that staff's clef) — the LETTER the click
    // landed on. Its alteration is decided below, once the beat is known.
    const naturalSpelling = registry.pixelYToPitch(coords.y, measureNumber, coords.x, entryStaff)
      ?? this.coordinateMapper.pixelYToPitch(coords.y, measureNumber)

    // Resolve beat using directional element logic
    const {
      beat: resolvedBeat, reason: resolvedReason,
      usedCoordCalc: useCoordinateCalculation,
      nearestLeft, nearestRight, leftDistance, rightDistance,
    } = this.resolveClickToBeat(coords, measureNumber, barQuarters, durationToBeats(duration), entryStaff)
    let finalBeat: Fraction = beatToFrac(resolvedBeat)
    let decisionReason = resolvedReason

    // ⭐ …then the alteration: the ARMED accidental if there is one, else what is in force where the
    //   click landed — the bar's running accidental, else the KEY SIGNATURE
    //   ({@link entryAlteration}). Without that last fallback a click in G major enters an F♮ and
    //   the renderer draws it a natural, on every note (docs/key-signature-plan.md §3.1).
    // ⚠️ Resolved AFTER the beat, because the question is positional. Nothing above reads the pitch.
    const alter = entryAlteration(
      this.getScoreModel().getScore(), { measure: measureNumber, beat: finalBeat, staff: entryStaff },
      naturalSpelling.step, naturalSpelling.octave, accidental,
    )
    const spelling: PitchSpelling = { ...naturalSpelling, alter }
    const pitchMidi = spellingToMidi(spelling.step, spelling.alter, spelling.octave)

    // When using coordinate calculation, we need to find if there's a rest at that beat
    // or if we'd be creating a new note position
    if (useCoordinateCalculation) {
      // Scope rest/chord/nearest-rest decisions to the entry voice AND staff — other
      // voices/staves are independent streams and must not steer (or be clobbered by) this
      // placement.
      const notesInMeasure = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n => voiceOf(n) === entryVoice && staffOf(n) === entryStaff)
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
    // Scope to the entry voice AND staff — a tuplet in another voice, or on another staff, must not
    // govern this placement (a voice-0 triplet must not reject a plain voice-2 note; a top-staff
    // triplet must not claim a bottom-staff note — `vexflow-removal-map.md` §9.4 #7).
    const tupletAtBeat = this.getScoreModel().getTupletAtBeat(measureNumber, finalBeat, entryVoice, entryStaff)

    if (tupletAtBeat) {
      const selectedDurationFrac = durationToFraction(duration, dots)
      const tupletTotalBeatsFrac = tupletSpan(tupletAtBeat)
      const tupletEndBeat = fracAdd(tupletAtBeat.startBeat, tupletTotalBeatsFrac)

      // Compute fill pointer: end of last real note in the tuplet
      const ratio = tupletScale(tupletAtBeat)
      const realNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
        .filter(n => n.tupletId === tupletAtBeat.id && !n.isRest)
        .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      let fillPointer: Fraction
      if (realNotes.length === 0) {
        fillPointer = tupletAtBeat.startBeat
      } else {
        const last = realNotes[realNotes.length - 1]
        const lastActual = last.actualDuration
          ?? fracMul(writtenLength(last), ratio)
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
        const scaledNoteDurationFrac = tupletWrittenDuration(tupletAtBeat, duration, dots ?? 0)
        if (fracGt(scaledNoteDurationFrac, remainingActual)) {
          dbg(`Note rejected: scaled duration (${fracToNumber(scaledNoteDurationFrac).toFixed(3)}) exceeds remaining tuplet space (${fracToNumber(remainingActual).toFixed(3)})`)
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
      ...(tremolo !== undefined && { tremolo }),
      ...(beam && beam !== 'auto' && { beam }),
      ...(entryVoice && { voice: entryVoice }),
      ...(entryStaff && { staff: entryStaff }),
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
    applyEntryOverwrites(this.getScoreModel(), measureNumber, finalBeat, duration, dots, pitchMidi, tupletId, tupletAtBeat, entryVoice, entryStaff)

    // Handle overflow by splitting the note across the bar line with a tie.
    // SKIP for tuplet notes — tuplets have shorter actual durations, designed to fit their span.
    if (overflow.willOverflow && overflow.overflowAmount && !tupletId) {
      return this.placeSplitNote(noteParams, overflow.overflowAmount, measureNumber, finalBeat, pitchMidi, duration, dots)
    }

    // For non-overflow cases, update existing chord notes (same beat + voice + staff) to match duration
    const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && voiceOf(n) === entryVoice && staffOf(n) === entryStaff && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi)
    for (const chordNote of existingChordNotes) {
      if (chordNote.duration !== duration) {
        this.getScoreModel().updateNote(chordNote.id, { duration })
      }
    }

    const note = this.getScoreModel().addNote(noteParams)

    if (note && tupletAtBeat && tupletId) {
      this.getScoreModel().refillTupletRemainder(measureNumber, tupletAtBeat, entryVoice)
    }

    // Debug logging with full context
    if (note) {
      dbg('[Entry] NoteEntry:', {
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
  private isValidEntryClick(coords: PixelCoordinates, measureNumber: number, staff: number = 0): boolean {
    const registry = this.elementRegistry

    // Check if click is over an invalid element (clef, time signature, barline)
    const elementAtCursor = registry.getAt(coords.x, coords.y)
    if (elementAtCursor && INVALID_NOTE_ENTRY_TYPES.includes(elementAtCursor.type)) {
      dbg(`✗ Invalid: clicked on ${elementAtCursor.type}`)
      return false
    }

    // Check if click is within valid staff area (X range), using the clicked staff's geometry
    const staffGeometry = registry.getStaffGeometry(measureNumber, staff)
    if (staffGeometry) {
      if (coords.x < staffGeometry.noteStartX || coords.x > staffGeometry.noteEndX) {
        dbg('✗ Invalid: X outside note entry area')
        return false
      }

      // Check if click is within valid Y range (reasonable pitch range)
      // Allow ~2 octaves above/below staff (staff lines span ~4 lines = 40px typically)
      const topLineY = staffGeometry.lineYPositions[0]
      const bottomLineY = staffGeometry.lineYPositions[4]
      const staffHeight = bottomLineY - topLineY
      const maxDistance = staffHeight * 2  // Allow 2x staff height above/below

      if (coords.y < topLineY - maxDistance || coords.y > bottomLineY + maxDistance) {
        dbg(`✗ Invalid: Y outside valid range (y=${coords.y.toFixed(0)}, valid=${(topLineY - maxDistance).toFixed(0)}-${(bottomLineY + maxDistance).toFixed(0)})`)
        return false
      }
    }
    return true
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
    const splitVoice = voiceOf(noteParams)
    const splitStaff = staffOf(noteParams)
    const existingChordNotes = this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && voiceOf(n) === splitVoice && staffOf(n) === splitStaff && fracEq(n.beat, finalBeat) && spellingToMidi(n.step!, n.alter!, n.octave!) !== pitchMidi && !n.tiedTo)
    for (const chordNote of existingChordNotes) {
      splitExistingNoteWithTie(this.getScoreModel(), chordNote, duration, overflowAmount, dots)
    }

    const splitNote = addSplitNoteWithTie(this.getScoreModel(), noteParams, overflowAmount)
    if (splitNote) {
      this.onCommit(`Add ${midiToNoteName(pitchMidi)}`)
    }
    return splitNote
  }

  // ==================== Public: Note Update ====================

  /** All non-rest notes at the given beat AND voice in a measure (chord members). */
  private getChordNotesAt(measureNumber: number, beat: Fraction, voice: number = 0, staff: number = 0): Note[] {
    return this.getScoreModel().getNotesInMeasure(measureNumber)
      .filter(n => !n.isRest && voiceOf(n) === voice && staffOf(n) === staff && fracEq(n.beat, beat))
  }

  /**
   * Update a note.
   * Dispatches to updateTupletNote or updateNonTupletNote based on context.
   * When duration is shortened, fills the gap with rests.
   * When duration is lengthened, removes overlapping notes/rests (splitting across the
   * barline with a tie when it overflows the bar).
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    // ⭐ A FANNED MEMBER goes STRAIGHT to the model — none of the rhythm machinery below applies to
    // it (docs/fanned-beam-pitches-plan.md §2 P3). A member has no duration of its own to shorten,
    // no gap to rest-fill and no barline to split across: the slot owns all of that, and re-spelling
    // a pitch inside the group changes none of it. The model writes the spelling and ignores the
    // rest. This is also what keeps a member's id out of the rebar path entirely.
    if (this.getScoreModel().isFanMember(noteId)) {
      const updated = this.getScoreModel().updateNote(noteId, updates)
      // 🚨 AND IT COMMITS, like every other branch here. Writing to the model without asking to be
      // saved is the documented trap (`MusicEngine.runBatch` case 2): `saveUndoState` is the only
      // thing that marks the model dirty and the only thing a surrounding `runBatch` counts — so an
      // uncommitted edit lands in the data, mints no undo entry, and `adjustPitch` sees "nothing
      // changed" and SKIPS THE REPAINT. The member moves in the model and not on the page until
      // some later edit forces a redraw. (His report, first thing he tried.)
      this.onCommit('Update note')
      return updated
    }
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
    const editVoice = voiceOf(existingNote)
    const editStaff = staffOf(existingNote)
    const measureNotes = this.getScoreModel().getNotesInMeasure(existingNote.measure)
      .filter(n => voiceOf(n) === editVoice && staffOf(n) === editStaff)
    const chordNotes = this.getChordNotesAt(existingNote.measure, existingNote.beat, editVoice, editStaff)
    const isChord = chordNotes.length > 1

    const target = existingNote.isRest ? 'REST' : `${existingNote.step}${existingNote.octave}`
    dbg(`[Edit] v${editVoice} ${target} m${existingNote.measure} b${fracToNumber(existingNote.beat).toFixed(3)} | dur ${oldDuration}${oldDots ? '.'.repeat(oldDots) : ''}→${newDuration}${newDots ? '.'.repeat(newDots) : ''}${isChord ? ` (chord of ${chordNotes.length})` : ''} | scoped to ${measureNotes.length} same-voice slot(s)`, updates)

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
            splitExistingNoteWithTie(this.getScoreModel(), chordNote, newDuration, overflowAmount, newDots)
          }

          // Split the target note itself
          splitExistingNoteWithTie(this.getScoreModel(), existingNote, newDuration, overflowAmount, newDots)

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
    let { updates, newDuration } = ctx
    const { noteId, existingNote, measureNotes, chordNotes, isChord } = ctx
    // The dots that will actually be WRITTEN. The clamp below drops them, and everything after it —
    // the span this note covers, and the chord members kept in step — has to use what was written
    // rather than what was asked for. (The chord sync used to read the asked-for dots, so a clamped
    // chord ended up with its members dotted and its top note not.)
    let newDots = ctx.newDots

    // All exact. Every quantity here is a beat or a factor between beats, and the model keeps those
    // as Fractions; the floats these replace were an epsilon comparison sized when every tuplet was
    // 3:2, in the one file where 4:5 and 8:11 now turn up.
    const ratio = tupletScale(tuplet)
    const tupletEnd = fracAdd(tuplet.startBeat, tupletSpan(tuplet))
    // Remaining space runs from this note's start to the tuplet end
    const remaining = fracSub(tupletEnd, existingNote.beat)

    // Clamp new duration if it exceeds remaining tuplet space
    if (fracGt(fracMul(durationToFraction(newDuration, newDots), ratio), remaining)) {
      const fittingDuration = this.findLargestFittingDuration(fracToNumber(fracDiv(remaining, ratio)))
      if (fittingDuration) {
        newDuration = fittingDuration
        newDots = 0
        updates = { ...updates, duration: fittingDuration, dots: 0 }
      } else {
        return existingNote
      }
    }

    // Delete any tuplet items that fall inside the new note's actual time span. STRICTLY inside:
    // an item starting exactly where this note ends is the next slot, not something it covers.
    const noteEnd = fracAdd(existingNote.beat, fracMul(durationToFraction(newDuration, newDots), ratio))
    const itemsToDelete = measureNotes.filter(n =>
      n.tupletId === existingNote.tupletId &&
      n.id !== noteId &&
      fracGt(n.beat, existingNote.beat) &&
      fracLt(n.beat, noteEnd)
    )
    for (const item of itemsToDelete) this.getScoreModel().deleteNote(item.id)

    const updatedNote = this.getScoreModel().updateNote(noteId, updates)

    // Recompute all filler rests from the fill pointer (in the tuplet's own voice)
    this.getScoreModel().refillTupletRemainder(existingNote.measure, tuplet, voiceOf(existingNote))

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
    const editVoice = voiceOf(existingNote)
    const editStaff = staffOf(existingNote)

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

      dbg(`[Edit] lengthen v${editVoice}: removing ${notesToRemove.length} overlapped same-voice slot(s), recovered ${beatsToRecover.toFixed(3)}b (need ${Math.abs(beatDifference).toFixed(3)}b)`)
      for (const id of notesToRemove) this.getScoreModel().deleteNote(id)

      // If we removed more beats than needed, add rests to fill the excess
      const excessBeats = beatsToRecover - Math.abs(beatDifference)
      if (excessBeats > BEAT_EPSILON) {
        dbg(`[Edit] lengthen v${editVoice}: ${excessBeats.toFixed(3)}b excess → fill with rests`)
        this.getScoreModel().fillGapWithRests(
          existingNote.measure,
          fracAdd(existingNote.beat, durationToFraction(newDuration, newDots)),
          excessBeats,
          editVoice,
          editStaff,
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
      dbg(`[Edit] shorten v${editVoice}: freed ${beatDifference.toFixed(3)}b → fill with rests (${existingNote.isRest ? 'meter-aware whole-measure refill' : `from b${fracToNumber(fracAdd(note.beat, durationToFraction(newDuration, newDots))).toFixed(3)}`})`)
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
          editStaff,
        )

        // Break tiedTo if the shortened note no longer abuts its tie target
        if (note.tiedTo) {
          const tiedTarget = this.getScoreModel().getNote(note.tiedTo)
          if (tiedTarget) {
            const noteEnd = fracToNumber(note.beat) + durationToBeats(newDuration, newDots)
            const targetBeat = fracToNumber(tiedTarget.beat)
            if (Math.abs(noteEnd - targetBeat) > BEAT_EPSILON || note.measure !== tiedTarget.measure) {
              dbg(`[Tie] broken — ${note.step}${note.octave} m${note.measure} no longer abuts tied target after duration change`)
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
    notesOccupied: number = 2,
    voice: number = 0,
    /** Dots on the tuplet's UNIT — the armed dot, so a triplet OF DOTTED quarters is enterable. */
    dots: number = 0,
    /** The NORMAL side's own note value, when the user named one ("in the time of a QUARTER"). */
    normal?: { duration: NoteDuration; dots?: number; count?: number },
  /** How the group is DRAWN — mark style, bracket, bracket end. Absent, and every field inside it
   *  absent, means "the renderer's own rules". See {@link TupletFormat}. */
  format?: TupletFormat,
  ): { tuplet: Tuplet; firstNote: Note } | null {
    const measureNumber = this.coordinateMapper.pixelToMeasure(coords)

    // Validate measure exists, then use ITS capacity (honours a pickup bar)
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) {
      dbg('✗ Invalid: measure does not exist')
      return null
    }
    // Which staff the click lands on (like plain note entry — resolved from the click Y).
    const entryStaff = this.elementRegistry.staffIndexAtY(measureNumber, coords.y)
    const barQuarters = measureCapacityQuarters(targetMeasure)

    const tupletTotalBeats = fracToNumber(tupletSpan({ numNotes, notesOccupied, baseDuration: duration, baseDots: dots }))

    // Resolve beat using directional element logic. Quantize the tuplet START to
    // the tuplet's OWN SPAN (e.g. a whole beat for an 8th-triplet), not the inner
    // note duration — a tuplet conventionally begins on a beat, so a click near
    // the start of a bar should land on beat 0, and successive tuplets tile on
    // beat boundaries (0/1/2/3) instead of snapping to an off-beat like 0.5.
    const {
      beat: resolvedBeat, reason: decisionReason,
      nearestLeft, nearestRight, leftDistance, rightDistance,
    } = this.resolveClickToBeat(coords, measureNumber, barQuarters, tupletTotalBeats, entryStaff)
    let beat = resolvedBeat

    // Clamp to valid range (tuplet must fit in measure)
    beat = Math.max(0, Math.min(beat, barQuarters - tupletTotalBeats))

    // The clamp slides it left to fit, but it cannot save a tuplet LONGER than the whole bar —
    // `barQuarters - tupletTotalBeats` goes negative, Math.max pins it to 0, and it overflows from
    // there. Same guard as the toggle path (see tupletFitsBar).
    if (!this.tupletFitsBar(measureNumber, beatToFrac(beat), beatToFrac(tupletTotalBeats))) {
      dbg(`✗ Tuplet refused: ${numNotes}-in-${notesOccupied} of ${duration} needs ${tupletTotalBeats} beat(s), more than m${measureNumber} holds`)
      return null
    }

    // Check if there's already a tuplet in this voice AND staff at this position
    const existingTuplet = this.getScoreModel().getTupletAtBeat(measureNumber, beatToFrac(beat), voice, entryStaff)
    if (existingTuplet) {
      dbg('✗ Tuplet already exists at this beat')
      return null
    }

    // Log tuplet entry decision
    dbg('TupletEntry:', {
      decision: decisionReason,
      left: nearestLeft ? `${nearestLeft.type}@${nearestLeft.beat} (${leftDistance.toFixed(0)}px)` : null,
      right: nearestRight ? `${nearestRight.type}@${nearestRight.beat} (${rightDistance.toFixed(0)}px)` : null,
      finalBeat: beat,
      tupletSpan: `${beat} to ${(beat + tupletTotalBeats).toFixed(3)}`,
      config: `${numNotes}:${notesOccupied} ${duration}${'.'.repeat(dots)}`,
    })

    return this.buildTupletWithFirstNote(measureNumber, beat, duration, spelling, numNotes, notesOccupied, voice, entryStaff, dots, normal, format)
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
    notesOccupied: number = 2,
    voice: number = 0,
    staff: number = 0,
    /** Dots on the unit — see {@link createTupletAtPosition}. */
    dots: number = 0,
    /** The NORMAL side's own note value — see {@link createTupletAtPosition}. */
    normal?: { duration: NoteDuration; dots?: number; count?: number },
  /** How the group is DRAWN — mark style, bracket, bracket end. Absent, and every field inside it
   *  absent, means "the renderer's own rules". See {@link TupletFormat}. */
  format?: TupletFormat,
  ): { tuplet: Tuplet; firstNote: Note } | null {
    const targetMeasure = this.getScoreModel().getMeasure(measureNumber)
    if (!targetMeasure) return null

    const existingTuplet = this.getScoreModel().getTupletAtBeat(measureNumber, beatToFrac(beat), voice, staff)
    if (existingTuplet) return null

    return this.buildTupletWithFirstNote(measureNumber, beat, duration, spelling, numNotes, notesOccupied, voice, staff, dots, normal, format)
  }

  /**
   * Convert an existing selected note or rest into the first element of a tuplet.
   * Used when the user presses the tuplet button in selection mode with a note/rest selected.
   */
  /**
   * Does a tuplet of `span` actual beats starting at `beat` fit inside the bar?
   *
   * A tuplet CANNOT cross a barline — it is a local re-division of one bar's time — and nothing was
   * checking it. The span is the trap: a triplet of HALVES is three notes in the time of TWO HALVES,
   * i.e. four quarter-beats, so from beat 2 of 4/4 it runs to beat 6 and the bar quietly held six
   * beats (reported). The written duration ('h') looks like it fits; the ACTUAL span is what counts.
   *
   * Refusing is the answer for now, over re-scaling the tuplet to something that does fit: a triplet
   * that silently became a different triplet is a worse surprise than one that did not appear.
   */
  private tupletFitsBar(measureNumber: number, beat: Fraction, span: Fraction): boolean {
    const measure = this.getScoreModel().getMeasure(measureNumber)
    if (!measure) return false
    return fracLte(fracAdd(beat, span), measureCapacityFrac(measure))
  }

  applyTupletToNote(
    noteId: string,
    numNotes: number = 3,
    notesOccupied: number = 2
  ): { tuplet: Tuplet; note: Note } | null {
    // No `baseDots` parameter: the unit IS the selected note, so its dots are the tuplet's dots.
    // Reading them off the note is what keeps the span and the note's own value from disagreeing.
    const note = this.getScoreModel().getNote(noteId)
    if (!note || note.tupletId) return null

    // The tuplet inherits the selected note's voice AND staff (a tuplet is a
    // single-voice run on one staff). Reject if any same-voice, same-staff tuplet
    // already overlaps the span the new tuplet would occupy (not just the exact start beat).
    const voice = voiceOf(note)
    const staff = staffOf(note)
    // The shape the tuplet WILL have, built before it exists so the span is computed by the same
    // rule the stored tuplet will use. Both sides are the note's own value here — turning a note
    // into a tuplet cannot say "in the time of" something else.
    const shape = { numNotes, notesOccupied, baseDuration: note.duration, baseDots: note.dots }
    const applySpan = tupletSpan(shape)
    if (this.getScoreModel().tupletSpanOverlaps(note.measure, note.beat, applySpan, voice, staff)) return null

    // …and it has to FIT (see tupletFitsBar). Nothing checked this: the bar went overfull.
    if (!this.tupletFitsBar(note.measure, note.beat, applySpan)) {
      dbg(`✗ Tuplet refused: ${numNotes}-in-${notesOccupied} of ${note.duration} needs ${fracToNumber(applySpan).toFixed(3)} beat(s) from b${fracToNumber(note.beat).toFixed(3)}, past the end of m${note.measure}`)
      return null
    }

    // createTuplet removes overlapping slots (same voice + staff only); places no initial rests
    const tuplet = this.getScoreModel().createTuplet(note.measure, note.beat, note.duration, numNotes, notesOccupied, voice, staff, note.dots ?? 0)
    const actualDuration = tupletWrittenDuration(shape, note.duration, note.dots ?? 0)

    let resultNote: Note
    if (note.isRest) {
      // Tuplet starts empty — refill will place the full-span filler rest
      this.getScoreModel().refillTupletRemainder(note.measure, tuplet, voice)
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
        ...(voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}),
        ...(staff ? { staff } : {}),
        ...(note.stemDirection && { stemDirection: note.stemDirection }),
      })
      this.getScoreModel().refillTupletRemainder(note.measure, tuplet, voice)
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
    notesOccupied: number,
    voice: number = 0,
    staff: number = 0,
    dots: number = 0,
    normal?: { duration: NoteDuration; dots?: number; count?: number },
  /** How the group is DRAWN — mark style, bracket, bracket end. Absent, and every field inside it
   *  absent, means "the renderer's own rules". See {@link TupletFormat}. */
  format?: TupletFormat,
  ): { tuplet: Tuplet; firstNote: Note } | null {
    // Refuse to create a tuplet whose span would overlap an existing same-voice,
    // same-staff tuplet. Two overlapping tuplets in one voice corrupt entry: a beat
    // inside both resolves ambiguously and notes/rests get pulled into the wrong one.
    const beatFracGuard = beatToFrac(beat)
    // Built before the tuplet exists, so the guards below measure exactly what will be stored.
    const shape = {
      numNotes, notesOccupied, baseDuration: duration, baseDots: dots,
      ...(normal && { normalDuration: normal.duration, normalDots: normal.dots, normalCount: normal.count }),
    }
    const newSpan = tupletSpan(shape)
    if (this.getScoreModel().tupletSpanOverlaps(measureNumber, beatFracGuard, newSpan, voice, staff)) {
      dbg(`✗ Tuplet not created: span overlaps an existing v${voice} s${staff} tuplet`)
      return null
    }
    // …and it has to FIT. The check lived only on the mouse path (createTupletAtPosition) and the
    // apply path, so the KEYBOARD could write a tuplet straight past the barline — 3:2 of halves is
    // four beats, and of dotted halves six. Here it covers all three callers at once.
    if (!this.tupletFitsBar(measureNumber, beatFracGuard, newSpan)) {
      dbg(`✗ Tuplet refused: ${numNotes}:${notesOccupied} of ${duration}${'.'.repeat(dots)} needs ${fracToNumber(newSpan).toFixed(3)} beat(s) from b${beat}, past the end of m${measureNumber}`)
      return null
    }

    const voiceParam = voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}
    const staffParam = staff ? { staff } : {}
    // Save any existing same-voice, same-staff note at the start position before createTuplet deletes it
    const existingNoteAtStart = this.getScoreModel().getNotesInMeasure(measureNumber)
      .find(n => !n.isRest && !n.tupletId && voiceOf(n) === voice && staffOf(n) === staff && Math.abs(fracToNumber(n.beat) - beat) < 0.001)
    const existingNoteData = existingNoteAtStart
      ? { step: existingNoteAtStart.step, alter: existingNoteAtStart.alter, octave: existingNoteAtStart.octave }
      : null

    // Create the tuplet (removes overlapping same-voice + same-staff slots, places no initial rests)
    const beatFrac = beatToFrac(beat)
    const tuplet = this.getScoreModel().createTuplet(measureNumber, beatFrac, duration, numNotes, notesOccupied, voice, staff, dots, normal, format)
    const actualDuration = tupletWrittenDuration(shape, duration, dots)

    let firstNote: Note

    if (existingNoteData) {
      // Re-add the pre-existing note as chord member, then add new note
      this.getScoreModel().addNote({
        step: existingNoteData.step,
        alter: existingNoteData.alter,
        octave: existingNoteData.octave,
        duration,
        // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
        // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
        // that is a third too long.
        ...(dots ? { dots } : {}),
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
        ...voiceParam,
        ...staffParam,
      })
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
        // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
        // that is a third too long.
        ...(dots ? { dots } : {}),
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
        ...voiceParam,
        ...staffParam,
      })
    } else {
      firstNote = this.getScoreModel().addNote({
        step: spelling.step,
        alter: spelling.alter,
        octave: spelling.octave,
        duration,
        // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
        // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
        // that is a third too long.
        ...(dots ? { dots } : {}),
        measure: measureNumber,
        beat: beatFrac,
        tupletId: tuplet.id,
        actualDuration,
        ...voiceParam,
        ...staffParam,
      })
    }

    this.getScoreModel().refillTupletRemainder(measureNumber, tuplet, voice)
    this.onCommit(`Create ${numNotes}:${notesOccupied} tuplet`)
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
    quantizationBeats: number,
    staff: number = 0,
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
      registry.findNotesLeftRight(coords.x, measureNumber, staff)

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
        const restEnd = fracAdd(note.beat, writtenLength(note))
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
}
