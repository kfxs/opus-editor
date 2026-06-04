import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration, ChordRest, Chord, Rest, NotePitch, PitchAlter, Clef } from '@/types/music'
import {
  isBeatInTupletFrac,
  getTupletTotalBeatsFrac,
  noteSpansOverlapFrac,
  splitBeatsIntoDurations,
} from '@/utils/musicUtils'
import { durationToFraction } from '@/utils/durations'
import { getMeterInfo, type MeterInfo } from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import {
  type Fraction,
  fracCreate,
  fracAdd,
  fracSub,
  fracMul,
  fracCompare,
  fracLt,
  fracLte,
  fracGt,
  fracGte,
  fracEq,
  fracIsZero,
  fracToNumber,
} from '@/utils/fraction'
import { effectiveClefAt, effectiveClefBefore, measureOpeningClef } from '@/utils/clefUtils'
import { v4 as uuidv4 } from 'uuid'

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
      schemaVersion: 1,
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
   * Fill an empty measure with rests for its time signature. An empty bar
   * collapses to a single measure rest in every meter (see {@link fillRests}).
   */
  private fillMeasureWithRests(measure: Measure): void {
    const meter = getMeterInfo(measure.timeSignature)
    const rests = fillRests(fracCreate(0, 1), meter.barQuarters, meter)
    for (const rest of rests) {
      this.pushRestSlot(measure, rest, meter, 0)
    }
  }

  /**
   * Materialise a {@link RestSlot} produced by `fillRests` into a measure slot.
   * Measure rests store the true bar length as `actualDuration` (the `duration`
   * stays `'w'`); the voice is only recorded when non-default.
   */
  private pushRestSlot(measure: Measure, rest: RestSlot, meter: MeterInfo, voice: number): void {
    const slot: Rest = {
      id: uuidv4(),
      type: 'rest',
      duration: rest.duration,
      measure: measure.number,
      beat: rest.beat,
      actualDuration: rest.isMeasureRest ? meter.barQuarters : durationToFraction(rest.duration, rest.dots),
    }
    if (rest.dots) slot.dots = rest.dots
    if (rest.isMeasureRest) slot.isMeasureRest = true
    if (voice !== 0) slot.voice = voice as 0 | 1 | 2 | 3
    measure.slots.push(slot)
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

  // ==================== Clef operations ====================

  /**
   * Resolve the clef in effect at a position (measure, beat).
   * Delegates to the shared resolver in utils/clefUtils.
   */
  getEffectiveClefAt(measureNumber: number, beat: Fraction): Clef {
    return effectiveClefAt(this.score, measureNumber, beat)
  }

  /** Clef drawn at the start of a measure (its beat-0 change, or inherited). */
  getEffectiveClef(measureNumber: number): Clef {
    return measureOpeningClef(this.score, measureNumber)
  }

  /**
   * Set/change the clef at (measure, beat). `beat` must already be snapped to a
   * slot boundary by the caller.
   *
   * - Measure 1 / beat 0 always stores an explicit opening clef and mirrors it
   *   into `score.clef` so the document keeps an opening clef.
   * - Otherwise the change is normalized: if `clef` equals the clef already in
   *   effect immediately before this beat, no visible change exists, so any
   *   existing change at this beat is removed instead of storing a redundant one.
   *
   * @returns true if the score changed.
   */
  setClefAt(measureNumber: number, beat: Fraction, clef: Clef): boolean {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false

    const isOpening = fracIsZero(beat)

    if (measureNumber === 1 && isOpening) {
      const scoreChanged = this.score.clef !== clef
      this.score.clef = clef
      const upserted = this.upsertClefChange(measure, beat, clef)
      return upserted || scoreChanged
    }

    // Redundant change → remove any existing change at this beat instead
    const inherited = effectiveClefBefore(this.score, measureNumber, beat)
    if (clef === inherited) {
      return this.removeClefChangeAt(measure, beat)
    }

    return this.upsertClefChange(measure, beat, clef)
  }

  /**
   * Remove a clef change at (measure, beat), reverting that position to the
   * inherited clef. Measure 1 / beat 0 cannot be removed (only changed).
   * @returns true if a change was removed.
   */
  removeClefAt(measureNumber: number, beat: Fraction): boolean {
    if (measureNumber === 1 && fracIsZero(beat)) return false
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false
    return this.removeClefChangeAt(measure, beat)
  }

  // --- Measure-level (beat 0) convenience wrappers ---

  /** Set the measure's opening clef (beat 0). */
  setClef(measureNumber: number, clef: Clef): boolean {
    return this.setClefAt(measureNumber, fracCreate(0, 1), clef)
  }

  /** Remove the measure's opening clef (beat 0). */
  removeClef(measureNumber: number): boolean {
    return this.removeClefAt(measureNumber, fracCreate(0, 1))
  }

  /**
   * Relocate a clef change to a new position, possibly in a different measure.
   * Raw move: no normalization and no undo (the caller records a single undo
   * entry when the drag completes). The dragged clef has authority — if another
   * clef change already sits at the target beat, it is overwritten (removed) so
   * the dragged clef can take that position; this lets a drag pass through other
   * clefs rather than getting stuck. Refuses only a no-op move or landing on
   * measure 1 beat 0 (the protected score opening clef).
   * @returns true if the clef was relocated.
   */
  moveClef(fromMeasure: number, fromBeat: Fraction, toMeasure: number, toBeat: Fraction): boolean {
    if (fromMeasure === toMeasure && fracEq(fromBeat, toBeat)) return false
    if (toMeasure === 1 && fracIsZero(toBeat)) return false
    const src = this.getMeasure(fromMeasure)
    if (!src?.clefs) return false
    const idx = src.clefs.findIndex(c => fracEq(c.beat, fromBeat))
    if (idx === -1) return false
    const dst = this.getMeasure(toMeasure)
    if (!dst) return false

    const [moving] = src.clefs.splice(idx, 1)
    if (src.clefs.length === 0 && fromMeasure !== toMeasure) delete src.clefs

    if (!dst.clefs) dst.clefs = []
    // Overwrite any clef already sitting at the target beat.
    const occupantIdx = dst.clefs.findIndex(c => fracEq(c.beat, toBeat))
    if (occupantIdx !== -1) dst.clefs.splice(occupantIdx, 1)

    moving.beat = toBeat
    dst.clefs.push(moving)
    dst.clefs.sort((a, b) => fracCompare(a.beat, b.beat))
    return true
  }

  /** Relocate a clef change within a single measure (see {@link moveClef}). */
  moveClefWithinMeasure(measureNumber: number, fromBeat: Fraction, toBeat: Fraction): boolean {
    return this.moveClef(measureNumber, fromBeat, measureNumber, toBeat)
  }

  /**
   * Remove the clef change at (measure, beat) if it is redundant — i.e. equals
   * the clef already in effect immediately before it. Measure 1 / beat 0 (the
   * protected opening) is never removed. Used to clean up after a clef drag,
   * where redundant positions are allowed transiently but shouldn't persist.
   * @returns true if a redundant change was removed.
   */
  normalizeClefAt(measureNumber: number, beat: Fraction): boolean {
    if (measureNumber === 1 && fracIsZero(beat)) return false
    const measure = this.getMeasure(measureNumber)
    if (!measure?.clefs) return false
    const change = measure.clefs.find(c => fracEq(c.beat, beat))
    if (!change) return false
    if (change.clef !== effectiveClefBefore(this.score, measureNumber, beat)) return false
    return this.removeClefChangeAt(measure, beat)
  }

  /** Insert or replace a clef change at the given beat, keeping the list sorted. */
  private upsertClefChange(measure: Measure, beat: Fraction, clef: Clef): boolean {
    if (!measure.clefs) measure.clefs = []
    const existing = measure.clefs.find(c => fracEq(c.beat, beat))
    if (existing) {
      if (existing.clef === clef) return false
      existing.clef = clef
      return true
    }
    measure.clefs.push({ id: uuidv4(), beat, clef })
    measure.clefs.sort((a, b) => fracCompare(a.beat, b.beat))
    return true
  }

  /** Remove a clef change at the given beat, if present. */
  private removeClefChangeAt(measure: Measure, beat: Fraction): boolean {
    if (!measure.clefs) return false
    const idx = measure.clefs.findIndex(c => fracEq(c.beat, beat))
    if (idx === -1) return false
    measure.clefs.splice(idx, 1)
    if (measure.clefs.length === 0) delete measure.clefs
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

  /** Assemble a flat Note from a Chord + NotePitch. */
  private toFlatNote(chord: Chord, pitch: NotePitch): Note {
    return {
      id: pitch.id,
      step: pitch.step,
      alter: pitch.alter,
      octave: pitch.octave,
      duration: chord.duration,
      measure: chord.measure,
      beat: chord.beat,
      isRest: false,
      forceAccidental: pitch.forceAccidental,
      stemDirection: chord.stemDirection,
      beam: chord.beam,
      tiedTo: pitch.tiedTo,
      tiedFrom: pitch.tiedFrom,
      dots: chord.dots,
      tupletId: chord.tupletId,
      actualDuration: chord.actualDuration,
      articulations: chord.articulations,
    }
  }

  /** Assemble a flat Note from a Rest. */
  private restToFlatNote(rest: Rest): Note {
    return {
      id: rest.id,
      duration: rest.duration,
      measure: rest.measure,
      beat: rest.beat,
      isRest: true,
      dots: rest.dots,
      tupletId: rest.tupletId,
      actualDuration: rest.actualDuration,
      tiedFrom: rest.tiedFrom,
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
    if (!params.isRest && !params.step) {
      throw new Error('Non-rest notes must have a step')
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
        step: params.step!,
        alter: (params.alter ?? 0) as PitchAlter,
        octave: params.octave!,
        forceAccidental: params.forceAccidental,
        tiedTo: params.tiedTo,
        tiedFrom: params.tiedFrom,
      }
      if (params.articulations !== undefined) existingChord.articulations = params.articulations
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
      step: params.step!,
      alter: (params.alter ?? 0) as PitchAlter,
      octave: params.octave!,
      forceAccidental: params.forceAccidental,
      tiedTo: params.tiedTo,
      tiedFrom: params.tiedFrom,
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
      articulations: params.articulations,
      beam: params.beam === 'auto' ? undefined : params.beam,
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
          // Migrate any tie pointing TO this rest onto the new chord's first note
          if (chord.notes.length > 0) {
            const newNp = chord.notes[0]
            if (existing.tiedFrom) newNp.tiedFrom = existing.tiedFrom
            this.migrateRestTieTo(existing.id, newNp.id)
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
   * Update all NotePitch.tiedTo pointers that reference a deleted rest ID,
   * redirecting them to newNotePitchId.
   */
  private migrateRestTieTo(restId: string, newNotePitchId: string): void {
    for (const measure of this.score.measures) {
      for (const slot of measure.slots) {
        if (slot.type === 'chord') {
          for (const pitch of slot.notes) {
            if (pitch.tiedTo === restId) {
              pitch.tiedTo = newNotePitchId
            }
          }
        }
      }
    }
  }

  /**
   * Fill gaps in a measure with engraving-correct rests, per voice.
   *
   * Each voice (defaulting to 0) is an independent rhythmic stream that must sum
   * to the bar length, so gaps are found and filled per voice. Within a voice,
   * tuplet spans are skipped and gaps are trimmed at tuplet boundaries — that
   * tuplet-awareness stays here; the meter-aware decomposition is delegated to
   * the tuplet-unaware {@link fillRests}.
   */
  private fillGapsWithRests(measure: Measure): void {
    const meter = getMeterInfo(measure.timeSignature)
    const barEnd = meter.barQuarters
    const tuplets = measure.tuplets || []

    // Distinct voices present (always include voice 0 so an empty bar fills).
    const voices = new Set<number>([0])
    for (const slot of measure.slots) voices.add(slot.voice ?? 0)

    for (const voice of voices) {
      const voiceSlots = measure.slots
        .filter(slot => (slot.voice ?? 0) === voice)
        .sort((a, b) => fracCompare(a.beat, b.beat))

      // Find gaps in this voice's stream.
      const gaps: Array<{ start: Fraction; end: Fraction }> = []
      let currentBeat: Fraction = fracCreate(0, 1)
      for (const slot of voiceSlots) {
        if (fracLt(currentBeat, slot.beat)) {
          gaps.push({ start: currentBeat, end: slot.beat })
        }
        const slotDurFrac = slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0)
        currentBeat = fracAdd(slot.beat, slotDurFrac)
      }
      if (fracLt(currentBeat, barEnd)) {
        gaps.push({ start: currentBeat, end: barEnd })
      }

      // Skip gaps that start inside a tuplet's span (the tuplet owns that time).
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

      for (const gap of filteredGaps) {
        let adjustedEnd = gap.end
        // Trim a gap that runs into a later tuplet so fillRests never spans one.
        for (const tuplet of tuplets) {
          if (fracGt(tuplet.startBeat, gap.start) && fracLt(tuplet.startBeat, adjustedEnd)) {
            adjustedEnd = tuplet.startBeat
          }
        }
        if (fracLte(adjustedEnd, gap.start)) continue

        for (const rest of fillRests(gap.start, adjustedEnd, meter)) {
          this.pushRestSlot(measure, rest, meter, voice)
        }
      }
    }
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

      // Convert rest → chord when isRest is explicitly set to false
      if (updates.isRest === false && updates.step !== undefined) {
        const measure = this.getMeasure(rest.measure)
        if (!measure) throw new Error(`Measure ${rest.measure} does not exist`)

        const notePitch: NotePitch = {
          id: rest.id,   // reuse rest ID so the caller's selectedNoteId stays valid
          step: updates.step!,
          alter: (updates.alter ?? 0) as PitchAlter,
          octave: updates.octave!,
          forceAccidental: updates.forceAccidental,
          tiedFrom: rest.tiedFrom,  // preserve incoming tie
        }
        const chord: Chord = {
          id: uuidv4(),
          type: 'chord',
          beat: updates.beat ?? rest.beat,
          duration: updates.duration ?? rest.duration,
          dots: updates.dots ?? rest.dots,
          measure: rest.measure,
          tupletId: updates.tupletId ?? rest.tupletId,
          actualDuration: rest.actualDuration,
          articulations: updates.articulations,
          notes: [notePitch],
        }
        chord.actualDuration = this.computeActualDurationForSlot(chord, measure)

        measure.slots = measure.slots.filter(s => s.id !== rest.id)
        measure.slots.push(chord)
        measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))

        return this.toFlatNote(chord, notePitch)
      }

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
        if (updates.tiedFrom !== undefined) rest.tiedFrom = updates.tiedFrom
        if ('tiedFrom' in updates && updates.tiedFrom === undefined) rest.tiedFrom = undefined
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

    // Pitch updates — apply spelling fields directly
    if (updates.step !== undefined) pitch.step = updates.step
    if (updates.alter !== undefined) pitch.alter = updates.alter
    if (updates.octave !== undefined) pitch.octave = updates.octave
    if ('forceAccidental' in updates) pitch.forceAccidental = updates.forceAccidental
    if (updates.tiedTo !== undefined) pitch.tiedTo = updates.tiedTo
    if (updates.tiedFrom !== undefined) pitch.tiedFrom = updates.tiedFrom
    if (updates.articulations !== undefined) chord.articulations = updates.articulations

    // Handle explicit undefined for tie fields
    if ('tiedTo' in updates && updates.tiedTo === undefined) pitch.tiedTo = undefined
    if ('tiedFrom' in updates && updates.tiedFrom === undefined) pitch.tiedFrom = undefined

    // Chord-level timing and style updates
    if (updates.duration !== undefined) chord.duration = updates.duration
    if (updates.dots !== undefined) chord.dots = updates.dots
    if (updates.tupletId !== undefined) chord.tupletId = updates.tupletId
    if (updates.beat !== undefined) chord.beat = updates.beat
    if (updates.actualDuration !== undefined) chord.actualDuration = updates.actualDuration
    if (updates.stemDirection !== undefined) chord.stemDirection = updates.stemDirection === 'auto' ? undefined : updates.stemDirection
    if (updates.beam !== undefined) chord.beam = updates.beam === 'auto' ? undefined : updates.beam

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
      const rest = found.rest
      // Clean up tie partners before removing
      if (rest.tiedFrom) {
        const partner = this.findSlot(rest.tiedFrom)
        if (partner?.type === 'chord') partner.pitch.tiedTo = undefined
      }
      for (const measure of this.score.measures) {
        const idx = measure.slots.findIndex(s => s.id === rest.id)
        if (idx !== -1) {
          measure.slots.splice(idx, 1)
          return true
        }
      }
      return false
    }

    // Chord case
    const { chord, pitch } = found

    // Clean up tie partners before removing this pitch
    if (pitch.tiedTo) {
      const partner = this.findSlot(pitch.tiedTo)
      if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
      else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
    }
    if (pitch.tiedFrom) {
      const partner = this.findSlot(pitch.tiedFrom)
      if (partner?.type === 'chord') partner.pitch.tiedTo = undefined
    }

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
   * Fill any empty gaps in a tuplet with filler rests.
   *
   * Algorithm:
   *   1. Collect all existing slots (notes AND rests) in the tuplet, sorted by beat.
   *   2. Walk the tuplet's time span looking for empty gaps (ranges with no slot).
   *   3. Fill only those empty gaps with new rests.
   *
   * Rests are treated as first-class slots and are never deleted here.
   * Callers are responsible for removing slots before calling this (e.g. when a
   * note grows into a rest's time span).
   */
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet): void {
    const ratio = fracCreate(tuplet.notesOccupied, tuplet.numNotes)
    const inverseRatio = fracCreate(tuplet.numNotes, tuplet.notesOccupied)
    const tupletEnd = fracAdd(tuplet.startBeat, getTupletTotalBeatsFrac(tuplet.baseDuration, tuplet.notesOccupied))

    // Get ALL existing slots (notes and rests) sorted by beat
    const allSlots = this.getNotesInTuplet(tuplet.id)
      .sort((a, b) => fracCompare(a.beat, b.beat))

    // Fill a gap in actual-time [from, to) with tuplet filler rests
    const fillGap = (from: Fraction, to: Fraction): void => {
      if (!fracLt(from, to)) return
      const actualGap = fracSub(to, from)
      const writtenGap = fracMul(actualGap, inverseRatio)
      const durations = splitBeatsIntoDurations(fracToNumber(writtenGap))
      let beat = from
      for (const dur of durations) {
        const actualDur = fracMul(durationToFraction(dur), ratio)
        this.addNote({
          duration: dur,
          measure: measureNumber,
          beat,
          isRest: true,
          tupletId: tuplet.id,
          actualDuration: actualDur,
        })
        beat = fracAdd(beat, actualDur)
      }
    }

    // Walk through all slots filling empty gaps between them
    let pointer: Fraction = tuplet.startBeat
    for (const slot of allSlots) {
      fillGap(pointer, slot.beat)
      const slotActual = slot.actualDuration
        ?? fracMul(durationToFraction(slot.duration, slot.dots ?? 0), ratio)
      pointer = fracAdd(slot.beat, slotActual)
    }
    fillGap(pointer, tupletEnd)
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

    for (const measure of model.score.measures) {
      // Migrate legacy per-measure clef (single `clef`) to the positioned list.
      const legacyClef = (measure as { clef?: Clef }).clef
      if (legacyClef && !measure.clefs) {
        measure.clefs = [{ id: uuidv4(), beat: fracCreate(0, 1), clef: legacyClef }]
        delete (measure as { clef?: Clef }).clef
      }

      // Recompute actualDuration for all slots (not stored reliably across versions)
      for (const slot of measure.slots ?? []) {
        slot.actualDuration = model.computeActualDurationForSlot(slot, measure)
      }
    }

    return model
  }
}
