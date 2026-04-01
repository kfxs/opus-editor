import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration, ChordRest, Chord, Rest, NotePitch } from '@/types/music'
import {
  getTupletBeatPositionsFrac,
  isBeatInTupletFrac,
  getTupletTotalBeatsFrac,
  noteSpansOverlapFrac,
  beatToFrac,
} from '@/utils/musicUtils'
import {
  type Fraction,
  durationToFraction,
  fracCreate,
  fracAdd,
  fracMul,
  fracCompare,
  fracLt,
  fracLte,
  fracGt,
  fracGte,
  fracEq,
  fracToNumber,
} from '@/utils/fraction'
import { v4 as uuidv4 } from 'uuid'

/**
 * A whole note equals 4 quarter notes.
 * This constant is used to convert time signature denominators to our internal beat system
 * where quarter note = 1 beat.
 *
 * Examples:
 * - 4/4: beatUnit = 4/4 = 1 (quarter note = 1 beat), totalBeats = 4 * 1 = 4
 * - 7/8: beatUnit = 4/8 = 0.5 (eighth note = 0.5 beats), totalBeats = 7 * 0.5 = 3.5
 * - 3/16: beatUnit = 4/16 = 0.25 (sixteenth = 0.25 beats), totalBeats = 3 * 0.25 = 0.75
 */
const WHOLE_NOTE_IN_QUARTERS = 4

/**
 * ScoreModel manages the musical score data and provides CRUD operations
 * This is the core data model for Developer A's music engine
 */
export class ScoreModel {
  private score: Score

  constructor(title: string = 'Untitled Score', tempo: number = 120) {
    this.score = {
      id: uuidv4(),
      title,
      tempo,
      keySignature: { key: 'C', accidentals: 0 },
      defaultTimeSignature: { numerator: 4, denominator: 4 },
      measures: [],
    }
    // Initialize with one empty measure
    this.addMeasure()
  }

  /**
   * Get the complete score
   */
  getScore(): Score {
    return this.score
  }

  /**
   * Set the score title
   */
  setTitle(title: string): void {
    this.score.title = title
  }

  /**
   * Set the tempo in BPM
   */
  setTempo(tempo: number): void {
    if (tempo < 20 || tempo > 300) {
      throw new Error('Tempo must be between 20 and 300 BPM')
    }
    this.score.tempo = tempo
  }

  /**
   * Add a new measure to the score
   * The measure is automatically filled with rests to match the time signature
   */
  addMeasure(timeSignature?: TimeSignature): Measure {
    const measureNumber = this.score.measures.length + 1
    const ts = timeSignature || this.score.defaultTimeSignature
    const measure: Measure = {
      id: uuidv4(),
      number: measureNumber,
      slots: [],
      timeSignature: ts,
      tuplets: [],
    }
    this.score.measures.push(measure)

    // Fill the measure with rests to match the time signature
    this.fillMeasureWithRests(measure)

    return measure
  }

  /**
   * Calculate total beats in a measure based on its time signature
   * Converts to our internal system where quarter note = 1 beat
   */
  private getMeasureTotalBeats(timeSignature: TimeSignature): number {
    const beatUnit = WHOLE_NOTE_IN_QUARTERS / timeSignature.denominator
    return timeSignature.numerator * beatUnit
  }

  /**
   * Get the beat unit (duration of one "count") for a time signature
   * In 4/4: 1 (quarter note), in 7/8: 0.5 (eighth note), etc.
   */
  private getBeatUnit(timeSignature: TimeSignature): number {
    return WHOLE_NOTE_IN_QUARTERS / timeSignature.denominator
  }

  /**
   * Fill a measure with rests to complete its time signature
   * For 4/4 time, this creates a whole rest (4 beats)
   */
  private fillMeasureWithRests(measure: Measure): void {
    const totalBeats = this.getMeasureTotalBeats(measure.timeSignature)

    // For 4/4 time, use a single whole rest
    if (totalBeats === 4 && measure.timeSignature.denominator === 4) {
      const rest: Rest = {
        id: uuidv4(),
        type: 'rest',
        duration: 'w',
        measure: measure.number,
        beat: fracCreate(0, 1),
        actualDuration: durationToFraction('w'),
      }
      measure.slots.push(rest)
    } else {
      // For other time signatures, fill with musically appropriate rests
      const rests = this.createMusicalRests(0, totalBeats, measure.timeSignature)
      for (const rest of rests) {
        measure.slots.push({
          id: uuidv4(),
          type: 'rest',
          duration: rest.duration,
          measure: measure.number,
          beat: beatToFrac(rest.beat),
          actualDuration: durationToFraction(rest.duration),
        })
      }
    }
  }

  /**
   * Get a measure by its number
   */
  getMeasure(measureNumber: number): Measure | undefined {
    return this.score.measures.find(m => m.number === measureNumber)
  }

  /**
   * Remove a measure by its number
   */
  removeMeasure(measureNumber: number): boolean {
    const index = this.score.measures.findIndex(m => m.number === measureNumber)
    if (index === -1) return false

    this.score.measures.splice(index, 1)
    // Renumber subsequent measures
    for (let i = index; i < this.score.measures.length; i++) {
      this.score.measures[i].number = i + 1
      // Update slot measure numbers
      this.score.measures[i].slots.forEach(slot => {
        slot.measure = i + 1
      })
    }
    return true
  }

  // ==================== Internal helpers ====================

  /**
   * Find the slot containing the given note/pitch ID.
   */
  private findSlot(noteId: string):
    | { type: 'chord'; chord: Chord; pitch: NotePitch }
    | { type: 'rest'; rest: Rest }
    | undefined {
    for (const measure of this.score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'rest' && slot.id === noteId) {
          return { type: 'rest', rest: slot }
        }
        if (slot.type === 'chord') {
          const pitch = slot.notes.find(n => n.id === noteId)
          if (pitch) return { type: 'chord', chord: slot, pitch }
        }
      }
    }
    return undefined
  }

  /** Assemble a backward-compat flat Note from a Chord + NotePitch. */
  private toFlatNote(chord: Chord, pitch: NotePitch): Note {
    return {
      id: pitch.id,
      pitch: pitch.pitch,
      duration: chord.duration,
      measure: chord.measure,
      beat: chord.beat,
      isRest: false,
      accidental: pitch.accidental,
      forceAccidental: pitch.forceAccidental,
      stemDirection: chord.stemDirection,
      tiedTo: pitch.tiedTo,
      tiedFrom: pitch.tiedFrom,
      dots: chord.dots,
      tupletId: chord.tupletId,
      actualDuration: chord.actualDuration,
      articulations: pitch.articulations,
    }
  }

  /** Assemble a backward-compat flat Note from a Rest. */
  private restToFlatNote(rest: Rest): Note {
    return {
      id: rest.id,
      pitch: 0,
      duration: rest.duration,
      measure: rest.measure,
      beat: rest.beat,
      isRest: true,
      dots: rest.dots,
      tupletId: rest.tupletId,
      actualDuration: rest.actualDuration,
    }
  }

  // ==================== Note Entry ====================

  /**
   * Add a note to the score
   * If adding a regular note (not a rest), this will replace overlapping rests
   * and may join an existing Chord at the same beat.
   */
  addNote(params: NoteParams): Note {
    const measure = this.getMeasure(params.measure)
    if (!measure) {
      throw new Error(`Measure ${params.measure} does not exist`)
    }

    // Validate pitch (skip validation for rests)
    if (!params.isRest && (params.pitch < 0 || params.pitch > 127)) {
      throw new Error('Pitch must be between 0 and 127')
    }

    if (params.isRest) {
      // Create a Rest slot
      const rest: Rest = {
        id: uuidv4(),
        type: 'rest',
        beat: params.beat,
        duration: params.duration,
        measure: params.measure,
        dots: params.dots,
        tupletId: params.tupletId,
        actualDuration: params.actualDuration,
      }
      rest.actualDuration = this.computeActualDurationForSlot(rest, measure)
      measure.slots.push(rest)
      measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      return this.restToFlatNote(rest)
    }

    // Regular note — look for existing Chord at same beat
    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, params.beat)
    )

    if (existingChord) {
      // Add pitch to existing chord
      const notePitch: NotePitch = {
        id: uuidv4(),
        pitch: params.pitch,
        accidental: params.accidental,
        forceAccidental: params.forceAccidental,
        tiedTo: params.tiedTo,
        tiedFrom: params.tiedFrom,
        articulations: params.articulations,
      }
      existingChord.notes.push(notePitch)
      // Sync duration/dots if new note differs (and neither is a tuplet note)
      if (!existingChord.tupletId && !params.tupletId) {
        const noteDots = params.dots || 0
        if (existingChord.duration !== params.duration || (existingChord.dots || 0) !== noteDots) {
          existingChord.duration = params.duration
          existingChord.dots = params.dots
          existingChord.actualDuration = this.computeActualDurationForSlot(existingChord, measure)
        }
      }
      // Sync stem direction if provided
      if (params.actualDuration !== undefined) {
        existingChord.actualDuration = params.actualDuration
      }
      return this.toFlatNote(existingChord, notePitch)
    }

    // No existing chord at beat — replace any overlapping rests and create new Chord
    const notePitch: NotePitch = {
      id: uuidv4(),
      pitch: params.pitch,
      accidental: params.accidental,
      forceAccidental: params.forceAccidental,
      tiedTo: params.tiedTo,
      tiedFrom: params.tiedFrom,
      articulations: params.articulations,
    }

    const chord: Chord = {
      id: uuidv4(),
      type: 'chord',
      beat: params.beat,
      duration: params.duration,
      dots: params.dots,
      measure: params.measure,
      tupletId: params.tupletId,
      actualDuration: params.actualDuration,
      notes: [notePitch],
    }
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)

    this.replaceRestsWithChord(measure, chord)

    return this.toFlatNote(chord, notePitch)
  }

  /**
   * Replace rests overlapping a new Chord and fill gaps with new rests.
   * Also inherits tupletId from any replaced tuplet rest.
   */
  private replaceRestsWithChord(measure: Measure, chord: Chord): void {
    const chordDurFrac = chord.actualDuration ?? durationToFraction(chord.duration, chord.dots ?? 0)

    // Remove overlapping rests; keep non-overlapping slots (both chords and rests)
    let inheritedTupletId: string | undefined = chord.tupletId
    const remaining: ChordRest[] = []

    for (const existing of measure.slots) {
      if (existing.type === 'rest') {
        const existingDurFrac =
          existing.actualDuration ?? durationToFraction(existing.duration, existing.dots ?? 0)
        const overlaps = noteSpansOverlapFrac(chord.beat, chordDurFrac, existing.beat, existingDurFrac)
        if (overlaps) {
          if (existing.tupletId && !chord.tupletId) {
            inheritedTupletId = existing.tupletId
          }
          // Remove (don't keep)
        } else {
          remaining.push(existing)
        }
      } else {
        // Existing chord — keep it
        remaining.push(existing)
      }
    }

    // Apply inherited tupletId
    if (inheritedTupletId && !chord.tupletId) {
      chord.tupletId = inheritedTupletId
      // Recompute actual duration with the now-known tuplet
      chord.actualDuration = this.computeActualDurationForSlot(chord, measure)
    }

    measure.slots = remaining
    measure.slots.push(chord)

    // Fill gaps with rests
    this.fillGapsWithRests(measure)

    // Sort by beat
    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  }

  /**
   * Fill gaps in a measure with rests
   */
  private fillGapsWithRests(measure: Measure): void {
    const totalBeats = this.getMeasureTotalBeats(measure.timeSignature)
    const totalBeatsFrac: Fraction = fracCreate(
      Math.round(totalBeats * 8),
      8,
    )

    // Sort slots by beat position
    const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))

    // Find gaps
    const gaps: Array<{ start: Fraction; end: Fraction }> = []
    let currentBeat: Fraction = fracCreate(0, 1)

    for (const slot of sortedSlots) {
      if (fracLt(currentBeat, slot.beat)) {
        gaps.push({ start: currentBeat, end: slot.beat })
      }
      const slotDurFrac = slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)
      currentBeat = fracAdd(slot.beat, slotDurFrac)
    }

    // Check for gap at the end of the measure
    if (fracLt(currentBeat, totalBeatsFrac)) {
      gaps.push({ start: currentBeat, end: totalBeatsFrac })
    }

    // Filter out gaps that start inside a tuplet's span
    const tuplets = measure.tuplets || []
    const filteredGaps = gaps.filter(gap => {
      for (const tuplet of tuplets) {
        const tupletEndFrac = fracAdd(
          tuplet.startBeat,
          getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied),
        )
        if (fracGte(gap.start, tuplet.startBeat) && fracLt(gap.start, tupletEndFrac)) {
          return false
        }
      }
      return true
    })

    // Fill each gap with musically appropriate rests
    for (const gap of filteredGaps) {
      let adjustedStart = gap.start
      let adjustedEnd = gap.end

      for (const tuplet of tuplets) {
        if (fracGt(tuplet.startBeat, adjustedStart) && fracLt(tuplet.startBeat, adjustedEnd)) {
          adjustedEnd = tuplet.startBeat
        }
      }

      if (fracLte(adjustedEnd, adjustedStart)) continue

      const rests = this.createMusicalRests(
        fracToNumber(adjustedStart),
        fracToNumber(adjustedEnd),
        measure.timeSignature,
      )
      for (const rest of rests) {
        measure.slots.push({
          id: uuidv4(),
          type: 'rest',
          duration: rest.duration,
          measure: measure.number,
          beat: beatToFrac(rest.beat),
          actualDuration: durationToFraction(rest.duration),
        })
      }
    }
  }

  /**
   * Create musically appropriate rests for a gap
   */
  private createMusicalRests(
    start: number,
    end: number,
    timeSignature: TimeSignature
  ): Array<{ beat: number; duration: Note['duration'] }> {
    const rests: Array<{ beat: number; duration: Note['duration'] }> = []
    let current = start
    const epsilon = 0.001

    const beatUnit = this.getBeatUnit(timeSignature)

    while (current < end - epsilon) {
      const remaining = end - current
      const beatFraction = current % beatUnit
      const isOnBeat = beatFraction < epsilon || beatFraction > beatUnit - epsilon

      if (!isOnBeat) {
        const toNextBeat = beatUnit - beatFraction

        if (toNextBeat >= 0.5 - epsilon && remaining >= 0.5 - epsilon) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (toNextBeat >= 0.25 - epsilon && remaining >= 0.25 - epsilon) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else if (toNextBeat >= 0.125 - epsilon && remaining >= 0.125 - epsilon) {
          rests.push({ beat: current, duration: '32' })
          current += 0.125
        } else {
          break
        }
      } else {
        if (remaining >= 4 - epsilon && Math.abs(current % 4) < epsilon) {
          rests.push({ beat: current, duration: 'w' })
          current += 4
        } else if (remaining >= 2 - epsilon && Math.abs(current % 2) < epsilon) {
          rests.push({ beat: current, duration: 'h' })
          current += 2
        } else if (remaining >= 1 - epsilon && beatUnit <= 1) {
          rests.push({ beat: current, duration: 'q' })
          current += 1
        } else if (remaining >= 0.5 - epsilon) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (remaining >= 0.25 - epsilon && beatUnit <= 0.25) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else if (remaining >= 0.125 - epsilon) {
          rests.push({ beat: current, duration: '32' })
          current += 0.125
        } else if (remaining >= 1 - epsilon) {
          rests.push({ beat: current, duration: 'q' })
          current += 1
        } else if (remaining >= 0.5 - epsilon) {
          rests.push({ beat: current, duration: '8' })
          current += 0.5
        } else if (remaining >= 0.25 - epsilon) {
          rests.push({ beat: current, duration: '16' })
          current += 0.25
        } else {
          break
        }
      }
    }

    return rests
  }

  /**
   * Compute the exact sounding duration of a slot as a Fraction.
   */
  private computeActualDurationForSlot(slot: ChordRest | { duration: NoteDuration; dots?: number; tupletId?: string }, measure: Measure): Fraction {
    const base = durationToFraction(slot.duration, slot.dots ?? 0)
    if (slot.tupletId && measure.tuplets) {
      const tuplet = measure.tuplets.find(t => t.id === slot.tupletId)
      if (tuplet) {
        return fracMul(base, fracCreate(tuplet.notesOccupied, tuplet.numNotes))
      }
    }
    return base
  }

  /**
   * Add a rest to the score
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction): Note {
    return this.addNote({
      pitch: 0,
      duration,
      measure,
      beat,
      isRest: true,
    })
  }

  /**
   * Get a note by its ID
   */
  getNote(noteId: string): Note | undefined {
    const found = this.findSlot(noteId)
    if (!found) return undefined
    if (found.type === 'rest') return this.restToFlatNote(found.rest)
    return this.toFlatNote(found.chord, found.pitch)
  }

  /**
   * Get all notes in a specific measure (as flat Note objects for backward compat)
   */
  getNotesInMeasure(measureNumber: number): Note[] {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return []
    const result: Note[] = []
    for (const slot of measure.slots) {
      if (slot.type === 'rest') {
        result.push(this.restToFlatNote(slot))
      } else {
        for (const pitch of slot.notes) {
          result.push(this.toFlatNote(slot, pitch))
        }
      }
    }
    return result
  }

  /**
   * Get the slots in a measure (returns the internal ChordRest[] directly)
   */
  getSlotsInMeasure(measureNumber: number): ChordRest[] {
    const measure = this.getMeasure(measureNumber)
    return measure ? [...measure.slots] : []
  }

  /**
   * Update a note
   */
  updateNote(noteId: string, updates: Partial<NoteParams>): Note {
    const found = this.findSlot(noteId)
    if (!found) {
      throw new Error(`Note ${noteId} not found`)
    }

    if (found.type === 'rest') {
      const rest = found.rest
      const oldMeasure = rest.measure

      // If measure is being changed, move the rest
      if (updates.measure !== undefined && updates.measure !== oldMeasure) {
        const oldMeasureObj = this.getMeasure(oldMeasure)
        const newMeasureObj = this.getMeasure(updates.measure)
        if (!newMeasureObj) throw new Error(`Target measure ${updates.measure} does not exist`)
        if (oldMeasureObj) {
          oldMeasureObj.slots = oldMeasureObj.slots.filter(s => s.id !== rest.id)
        }
        if (updates.duration !== undefined) rest.duration = updates.duration
        if (updates.dots !== undefined) rest.dots = updates.dots
        if (updates.beat !== undefined) rest.beat = updates.beat
        if (updates.tupletId !== undefined) rest.tupletId = updates.tupletId
        rest.measure = updates.measure
        rest.actualDuration = this.computeActualDurationForSlot(rest, newMeasureObj)
        newMeasureObj.slots.push(rest)
        newMeasureObj.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      } else {
        if (updates.duration !== undefined) rest.duration = updates.duration
        if (updates.dots !== undefined) rest.dots = updates.dots
        if (updates.tupletId !== undefined) rest.tupletId = updates.tupletId
        if (updates.beat !== undefined) {
          rest.beat = updates.beat
          const m = this.getMeasure(rest.measure)
          if (m) m.slots.sort((a, b) => fracCompare(a.beat, b.beat))
        }
        if (updates.duration !== undefined || updates.dots !== undefined || updates.tupletId !== undefined) {
          const m = this.getMeasure(rest.measure)
          if (m) rest.actualDuration = this.computeActualDurationForSlot(rest, m)
        }
      }
      return this.restToFlatNote(rest)
    }

    // Chord case
    const { chord, pitch } = found
    const oldMeasure = chord.measure

    // Pitch-only updates
    if (updates.pitch !== undefined) pitch.pitch = updates.pitch
    if (updates.accidental !== undefined) pitch.accidental = updates.accidental
    if (updates.forceAccidental !== undefined) pitch.forceAccidental = updates.forceAccidental
    if (updates.tiedTo !== undefined) pitch.tiedTo = updates.tiedTo
    if (updates.tiedFrom !== undefined) pitch.tiedFrom = updates.tiedFrom
    if (updates.articulations !== undefined) pitch.articulations = updates.articulations

    // Handle explicit undefined for tie fields
    if ('tiedTo' in updates && updates.tiedTo === undefined) pitch.tiedTo = undefined
    if ('tiedFrom' in updates && updates.tiedFrom === undefined) pitch.tiedFrom = undefined

    // Chord-level timing updates
    if (updates.duration !== undefined) chord.duration = updates.duration
    if (updates.dots !== undefined) chord.dots = updates.dots
    if (updates.tupletId !== undefined) chord.tupletId = updates.tupletId
    if (updates.beat !== undefined) chord.beat = updates.beat
    if (updates.actualDuration !== undefined) chord.actualDuration = updates.actualDuration

    // If measure is being changed, move the whole chord
    if (updates.measure !== undefined && updates.measure !== oldMeasure) {
      const oldMeasureObj = this.getMeasure(oldMeasure)
      const newMeasureObj = this.getMeasure(updates.measure)
      if (!newMeasureObj) throw new Error(`Target measure ${updates.measure} does not exist`)
      if (oldMeasureObj) {
        oldMeasureObj.slots = oldMeasureObj.slots.filter(s => s.id !== chord.id)
      }
      chord.measure = updates.measure
      chord.actualDuration = this.computeActualDurationForSlot(chord, newMeasureObj)
      newMeasureObj.slots.push(chord)
      newMeasureObj.slots.sort((a, b) => fracCompare(a.beat, b.beat))
    } else {
      if (updates.beat !== undefined) {
        const m = this.getMeasure(chord.measure)
        if (m) m.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      }
      if (updates.duration !== undefined || updates.dots !== undefined || updates.tupletId !== undefined) {
        const m = this.getMeasure(chord.measure)
        if (m) chord.actualDuration = this.computeActualDurationForSlot(chord, m)
      }
    }

    return this.toFlatNote(chord, pitch)
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    const found = this.findSlot(noteId)
    if (!found) return false

    if (found.type === 'rest') {
      for (const measure of this.score.measures) {
        const idx = measure.slots.findIndex(s => s.id === found.rest.id)
        if (idx !== -1) {
          measure.slots.splice(idx, 1)
          return true
        }
      }
      return false
    }

    // Chord case
    const { chord, pitch } = found
    for (const measure of this.score.measures) {
      const idx = measure.slots.findIndex(s => s.id === chord.id)
      if (idx !== -1) {
        if (chord.notes.length <= 1) {
          // Remove the whole chord slot
          measure.slots.splice(idx, 1)
        } else {
          // Remove just this pitch from the chord
          chord.notes = chord.notes.filter(n => n.id !== pitch.id)
        }
        return true
      }
    }
    return false
  }

  /**
   * Get all notes in the score (as flat Note objects for backward compat)
   */
  getAllNotes(): Note[] {
    return this.score.measures.flatMap(m => this.getNotesInMeasure(m.number))
  }

  // ==================== Tuplet Operations ====================

  /**
   * Create a tuplet in a measure
   */
  createTuplet(
    measureNumber: number,
    startBeat: Fraction,
    baseDuration: NoteDuration,
    numNotes: number = 3,
    notesOccupied: number = 2,
  ): Tuplet {
    const measure = this.getMeasure(measureNumber)
    if (!measure) {
      throw new Error(`Measure ${measureNumber} does not exist`)
    }

    const tuplet: Tuplet = {
      id: uuidv4(),
      startBeat,
      baseDuration,
      numNotes,
      notesOccupied,
    }

    if (!measure.tuplets) {
      measure.tuplets = []
    }
    measure.tuplets.push(tuplet)

    // Remove any existing slots that overlap with the tuplet's time span
    const tupletDurFrac = getTupletTotalBeatsFrac(baseDuration, notesOccupied)
    measure.slots = measure.slots.filter(slot => {
      const slotDurFrac = slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)
      return !noteSpansOverlapFrac(slot.beat, slotDurFrac, startBeat, tupletDurFrac)
    })

    // Create rest slots at each tuplet beat position
    const tupletActualDuration = fracMul(
      durationToFraction(baseDuration),
      fracCreate(notesOccupied, numNotes),
    )
    const beatPositions = getTupletBeatPositionsFrac(startBeat, baseDuration, numNotes, notesOccupied)
    for (const beat of beatPositions) {
      const rest: Rest = {
        id: uuidv4(),
        type: 'rest',
        duration: baseDuration,
        measure: measureNumber,
        beat,
        tupletId: tuplet.id,
        actualDuration: tupletActualDuration,
      }
      measure.slots.push(rest)
    }

    // Sort by beat
    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))

    return tuplet
  }

  /**
   * Get a tuplet by its ID
   */
  getTuplet(tupletId: string): Tuplet | undefined {
    for (const measure of this.score.measures) {
      if (!measure.tuplets) continue
      const tuplet = measure.tuplets.find(t => t.id === tupletId)
      if (tuplet) return tuplet
    }
    return undefined
  }

  /**
   * Get the tuplet at a specific beat position in a measure
   */
  getTupletAtBeat(measureNumber: number, beat: Fraction): Tuplet | undefined {
    const measure = this.getMeasure(measureNumber)
    if (!measure || !measure.tuplets) return undefined
    return measure.tuplets.find(tuplet => isBeatInTupletFrac(beat, tuplet))
  }

  /**
   * Get all notes that belong to a specific tuplet (as flat Notes)
   */
  getNotesInTuplet(tupletId: string): Note[] {
    for (const measure of this.score.measures) {
      const slots = measure.slots.filter(s => s.tupletId === tupletId)
      if (slots.length > 0) {
        const result: Note[] = []
        for (const slot of slots) {
          if (slot.type === 'rest') {
            result.push(this.restToFlatNote(slot))
          } else {
            for (const pitch of slot.notes) {
              result.push(this.toFlatNote(slot, pitch))
            }
          }
        }
        return result
      }
    }
    return []
  }

  /**
   * Delete a tuplet and replace it with an appropriate rest
   */
  deleteTuplet(tupletId: string): boolean {
    for (const measure of this.score.measures) {
      if (!measure.tuplets) continue

      const tupletIndex = measure.tuplets.findIndex(t => t.id === tupletId)
      if (tupletIndex === -1) continue

      // Remove all slots belonging to this tuplet
      measure.slots = measure.slots.filter(s => s.tupletId !== tupletId)

      // Remove the tuplet
      measure.tuplets.splice(tupletIndex, 1)

      // Re-fill gaps with rests
      this.fillGapsWithRests(measure)

      return true
    }
    return false
  }

  /**
   * Repair gaps in a single measure by filling with rests.
   */
  repairMeasureGaps(measureNumber: number): void {
    const measure = this.getMeasure(measureNumber)
    if (measure) {
      this.fillGapsWithRests(measure)
    }
  }

  /**
   * Repair gaps in all measures. Called as a pre-render safety net.
   */
  repairAllMeasureGaps(): void {
    for (const measure of this.score.measures) {
      this.fillGapsWithRests(measure)
    }
  }

  /**
   * Clear all notes from the score and refill with rests
   */
  clearAllNotes(): void {
    this.score.measures.forEach(measure => {
      measure.slots = []
      measure.tuplets = []
      this.fillMeasureWithRests(measure)
    })
  }

  /**
   * Serialize the score to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.score, null, 2)
  }

  /**
   * Load a score from JSON
   */
  static fromJSON(json: string): ScoreModel {
    const scoreData = JSON.parse(json)
    const model = new ScoreModel()
    model.score = scoreData

    // Migrate legacy scores: if measures have 'notes' but no 'slots', convert.
    for (const measure of model.score.measures) {
      // Migrate legacy notes array to slots
      if ((measure as any).notes && !(measure as any).slots) {
        ;(measure as any).slots = ScoreModel.migrateNotesToSlots((measure as any).notes)
        delete (measure as any).notes
      }

      // Migrate legacy tuplet startBeat from number to Fraction
      for (const tuplet of measure.tuplets ?? []) {
        if (typeof (tuplet.startBeat as unknown) === 'number') {
          tuplet.startBeat = beatToFrac(tuplet.startBeat as unknown as number)
        }
      }

      // Migrate slot beats from number to Fraction and recompute actualDuration
      for (const slot of measure.slots ?? []) {
        if (typeof (slot.beat as unknown) === 'number') {
          slot.beat = beatToFrac(slot.beat as unknown as number)
        }
        if (slot.type === 'chord') {
          slot.actualDuration = model.computeActualDurationForSlot(slot, measure)
        } else {
          slot.actualDuration = model.computeActualDurationForSlot(slot, measure)
        }
      }
    }

    return model
  }

  /**
   * Migrate old flat Note[] to ChordRest[].
   * Groups same-beat real notes into Chords, converts rest notes to Rest slots.
   */
  private static migrateNotesToSlots(notes: any[]): ChordRest[] {
    const slots: ChordRest[] = []

    // Separate rests and real notes
    const restNotes = notes.filter((n: any) => n.isRest)
    const realNotes = notes.filter((n: any) => !n.isRest)

    // Convert rests
    for (const n of restNotes) {
      const rest: Rest = {
        id: n.id,
        type: 'rest',
        beat: typeof n.beat === 'number' ? beatToFrac(n.beat) : n.beat,
        duration: n.duration,
        dots: n.dots,
        measure: n.measure,
        tupletId: n.tupletId,
        actualDuration: n.actualDuration,
      }
      slots.push(rest)
    }

    // Group real notes by beat
    const beatGroups = new Map<string, any[]>()
    for (const n of realNotes) {
      const beatFrac = typeof n.beat === 'number' ? beatToFrac(n.beat) : n.beat
      const key = `${beatFrac.num}/${beatFrac.den}`
      if (!beatGroups.has(key)) beatGroups.set(key, [])
      beatGroups.get(key)!.push({ ...n, beat: beatFrac })
    }

    // Create Chord per group
    for (const group of beatGroups.values()) {
      const firstNote = group[0]
      const chord: Chord = {
        id: uuidv4(),
        type: 'chord',
        beat: firstNote.beat,
        duration: firstNote.duration,
        dots: firstNote.dots,
        measure: firstNote.measure,
        tupletId: firstNote.tupletId,
        actualDuration: firstNote.actualDuration,
        stemDirection: firstNote.stemDirection,
        notes: group.map((n: any) => ({
          id: n.id,
          pitch: n.pitch,
          accidental: n.accidental,
          forceAccidental: n.forceAccidental,
          tiedTo: n.tiedTo,
          tiedFrom: n.tiedFrom,
          articulations: n.articulations,
        })),
      }
      slots.push(chord)
    }

    // Sort by beat
    slots.sort((a, b) => fracCompare(a.beat, b.beat))
    return slots
  }
}
