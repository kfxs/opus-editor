import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration, ChordRest, Chord, Rest, NotePitch, PitchAlter, Clef, Dynamic } from '@/types/music'
import {
  isBeatInTupletFrac,
  getTupletTotalBeatsFrac,
  noteSpansOverlapFrac,
  splitBeatsIntoDurations,
  measureCapacityFrac,
  getMeasureDurationFrac,
} from '@/utils/musicUtils'
import { durationToFraction } from '@/utils/durations'
import {
  getMeterInfo,
  isValidTimeSignature,
  effectiveTimeSignature,
  sameTimeSignature,
} from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { flattenRegion, relayEvents, type RebarPiece, type RebarEvent } from '@/utils/rebar'
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
  fracIsPositive,
  fracToNumber,
} from '@/utils/fraction'
import { effectiveClefAt, effectiveClefBefore, measureOpeningClef } from '@/utils/clefUtils'
import { measureDynamics, resolveActiveLevel } from '@/utils/dynamics'
import { v4 as uuidv4 } from 'uuid'

/**
 * A beat-anchored annotation (clef change or dynamic) snapshotted before a rebar,
 * keyed by its absolute beat offset from the region start so it can be re-anchored
 * into the new bar layout. See {@link ScoreModel.captureBeatAnchors}.
 */
type CapturedAnchor =
  | { kind: 'clef'; absBeat: Fraction; clef: Clef }
  | { kind: 'dynamic'; absBeat: Fraction; dyn: Dynamic }

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
      schemaVersion: 2,
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
    // Measure 1 always carries the score's opening time signature explicitly.
    if (measureNumber === 1) measure.timeSignatureChange = true
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
    const rests = fillRests(fracCreate(0, 1), measureCapacityFrac(measure), meter)
    for (const rest of rests) {
      this.pushRestSlot(measure, rest, 0)
    }
  }

  /**
   * Materialise a {@link RestSlot} produced by `fillRests` into a measure slot.
   * Measure rests store the true bar length as `actualDuration` (the `duration`
   * stays `'w'`); the voice is only recorded when non-default.
   */
  private pushRestSlot(measure: Measure, rest: RestSlot, voice: number): void {
    const slot: Rest = {
      id: uuidv4(),
      type: 'rest',
      duration: rest.duration,
      measure: measure.number,
      beat: rest.beat,
      actualDuration: rest.isMeasureRest ? measureCapacityFrac(measure) : durationToFraction(rest.duration, rest.dots),
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

  // ==================== Dynamic operations ====================

  /**
   * Add a dynamic at (measureNumber, dynamic.beat). `beat` must already be
   * snapped to a slot boundary by the caller. Multiple dynamics may share the
   * same (beat, voice) — nothing is replaced — so the user can freely stack
   * marks at one spot (e.g. a level + expressive text like `p dolce`, or two
   * levels). Co-located marks are laid out side-by-side by the renderer; if more
   * than one is interpreted (a level), the last one wins for playback. The list
   * is kept sorted ascending by beat (a stable sort preserves placement order
   * within a beat). A fresh id is generated.
   * @returns the stored Dynamic, or null if the measure does not exist.
   */
  addDynamic(measureNumber: number, dynamic: Omit<Dynamic, 'id'>): Dynamic | null {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return null
    if (!measure.dynamics) measure.dynamics = []

    const created: Dynamic = { ...dynamic, id: uuidv4() }
    measure.dynamics.push(created)
    measure.dynamics.sort((a, b) => fracCompare(a.beat, b.beat))
    return created
  }

  /**
   * Edit an existing dynamic (level / text / placement / beat / voice) by id.
   * The owning measure's list is re-sorted in case the beat changed.
   * @returns the updated Dynamic, or null if no dynamic with that id exists.
   */
  updateDynamic(id: string, updates: Partial<Omit<Dynamic, 'id'>>): Dynamic | null {
    for (const measure of this.score.measures) {
      const dyn = measure.dynamics?.find(d => d.id === id)
      if (!dyn) continue
      Object.assign(dyn, updates)
      measure.dynamics!.sort((a, b) => fracCompare(a.beat, b.beat))
      return dyn
    }
    return null
  }

  /**
   * Remove a dynamic by id, cleaning up the array when it becomes empty.
   * @returns true if a dynamic was removed.
   */
  removeDynamic(id: string): boolean {
    for (const measure of this.score.measures) {
      if (!measure.dynamics) continue
      const idx = measure.dynamics.findIndex(d => d.id === id)
      if (idx === -1) continue
      measure.dynamics.splice(idx, 1)
      if (measure.dynamics.length === 0) delete measure.dynamics
      return true
    }
    return false
  }

  /** A measure's dynamics, sorted ascending by beat (a copy; empty if none). */
  getDynamics(measureNumber: number): Dynamic[] {
    return measureDynamics(this.score, measureNumber)
  }

  /** Find a dynamic anywhere in the score by id (live reference), or null. Used by
   *  the in-canvas text editor to seed the overlay with the mark's current text. */
  getDynamicById(id: string): Dynamic | null {
    for (const measure of this.score.measures) {
      const dyn = measure.dynamics?.find(d => d.id === id)
      if (dyn) return dyn
    }
    return null
  }

  /**
   * The interpreted dynamic level in effect at (measure, beat) for a voice.
   * Delegates to the shared resolver in utils/dynamics (walk-back reference).
   */
  getActiveLevel(measureNumber: number, beat: Fraction, voice: number = 0) {
    return resolveActiveLevel(this.score, measureNumber, beat, voice)
  }

  // ==================== Time signature operations ====================

  /**
   * Set the time signature at a measure, marking it as an explicit change and
   * propagating the new signature forward to every following measure until the
   * next explicit change (or the end of the score).
   *
   * `options.rewrite` controls what happens to existing music in that region:
   *   - `'rebar'` (default): the Sibelius/Finale/MuseScore behaviour — the region
   *     is **re-barred** to the new bar length, notes straddling a moved barline
   *     are split with **ties**, and overflow flows forward (growing the region
   *     when unbounded). Nothing is lost. See {@link rebarRegion}.
   *   - `'none'`: only rests are reconciled (under-full bars rest-filled; over-full
   *     bars keep every note and render crowded/SOFT). Barlines do not move.
   *
   * `options.extent` = `'toNextChange'` (default) applies to the whole region;
   * `'measure'` touches only this bar and always uses the `'none'` rest reconcile.
   * Setting measure 1 also updates `score.defaultTimeSignature`.
   *
   * @throws if `ts` is non-dyadic / out of range.
   * @returns true if the score changed.
   */
  setTimeSignature(
    measureNumber: number,
    ts: TimeSignature,
    options?: { extent?: 'measure' | 'toNextChange'; rewrite?: 'rebar' | 'none' },
  ): boolean {
    if (!isValidTimeSignature(ts)) {
      throw new Error(
        `Unsupported time signature ${ts.numerator}/${ts.denominator}: ` +
          `denominator must be a power of two up to 32, numerator a positive integer, ` +
          `and any grouping must sum to the numerator.`,
      )
    }
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false

    // No-op: this measure already carries exactly this signature as a change AND
    // its glyph is visible. (A hidden glyph still unhides below, so it's not a no-op.)
    if (
      measure.timeSignatureChange === true &&
      !measure.timeSignatureHidden &&
      sameTimeSignature(measure.timeSignature, ts)
    ) {
      return false
    }

    const extent = options?.extent ?? 'toNextChange'
    const rewrite = options?.rewrite ?? 'rebar'

    // Mark the explicit change on this measure (its TS is set below / by rebar).
    measure.timeSignatureChange = true
    // Setting a signature always re-shows the glyph (un-hides a hidden measure 1).
    delete measure.timeSignatureHidden
    if (measureNumber === 1) this.score.defaultTimeSignature = copyTimeSignature(ts)

    if (rewrite === 'rebar' && extent === 'toNextChange') {
      // rebarRegion flattens the region (old meter) first, then re-bars it.
      this.rebarRegion(measureNumber, ts)
      return true
    }

    // Legacy keep-crowded path: set the TS, reconcile rests, propagate.
    measure.timeSignature = copyTimeSignature(ts)
    this.reconcileMeasureRests(measure)
    if (extent === 'toNextChange') {
      this.propagateTimeSignature(measureNumber, ts)
    }
    return true
  }

  /**
   * Remove the explicit time-signature change at a measure, reverting it (and
   * the measures after it, until the next change) to the inherited signature.
   * Because the meter changes, the region is **re-barred** by default — exactly
   * like {@link setTimeSignature} with `rewrite: 'rebar'`: existing music is
   * re-laid into bars of the inherited meter's length, straddling notes split
   * with ties, overflow flowing forward. `options.rewrite: 'none'` keeps the old
   * keep-crowded behaviour (rests reconciled, barlines fixed).
   * Measure 1 cannot be removed (it always carries the opening signature; use
   * {@link setTimeSignatureHidden} to hide its glyph instead).
   * @returns true if a change was removed.
   */
  removeTimeSignatureChange(
    measureNumber: number,
    options?: { rewrite?: 'rebar' | 'none' },
  ): boolean {
    if (measureNumber === 1) return false
    const measure = this.getMeasure(measureNumber)
    if (!measure || measure.timeSignatureChange !== true) return false

    const inherited = effectiveTimeSignature(this.score, measureNumber - 1)
    const rewrite = options?.rewrite ?? 'rebar'
    delete measure.timeSignatureChange

    if (rewrite === 'rebar') {
      // rebarRegion flattens the region using the CURRENT (removed) meter, then
      // applies the inherited meter and re-lays the music across moved barlines.
      this.rebarRegion(measureNumber, inherited)
    } else {
      measure.timeSignature = copyTimeSignature(inherited)
      this.reconcileMeasureRests(measure)
      this.propagateTimeSignature(measureNumber, inherited)
    }
    return true
  }

  /**
   * Show or hide a measure's time-signature glyph without changing the meter in
   * effect. Used when deleting the displayed signature on measure 1: a score must
   * always have a meter, so the glyph is hidden (capacity / playback / rest-fill
   * stay on `measure.timeSignature`) rather than removed. On other measures the
   * glyph only exists for an explicit change, so deleting there removes the change
   * (see {@link removeTimeSignatureChange}); hiding is still permitted generally.
   * @returns true if the visibility changed.
   */
  setTimeSignatureHidden(measureNumber: number, hidden: boolean): boolean {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false
    const current = measure.timeSignatureHidden === true
    if (current === hidden) return false
    if (hidden) measure.timeSignatureHidden = true
    else delete measure.timeSignatureHidden
    return true
  }

  /**
   * Set (or clear) a measure's actual playable length — a pickup / anacrusis bar
   * (see {@link Measure.actualDurationOverride}). `actual` is in quarter-note
   * beats; pass `null` to clear. An `actual` that is non-positive, or ≥ the bar's
   * nominal length (a pickup must be shorter), clears the override instead.
   * Existing notes are kept even if they now exceed the shorter bar (over-full →
   * SOFT render, never trimmed); plain rests are re-filled to the new capacity.
   * @returns true if the measure changed.
   */
  setMeasureActualDuration(measureNumber: number, actual: Fraction | null): boolean {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false

    const nominal = getMeasureDurationFrac(measure.timeSignature)
    const clear = actual === null || !fracIsPositive(actual) || fracGte(actual, nominal)

    if (clear) {
      if (measure.actualDurationOverride === undefined) return false
      delete measure.actualDurationOverride
    } else {
      if (measure.actualDurationOverride && fracEq(measure.actualDurationOverride, actual)) return false
      measure.actualDurationOverride = { num: actual.num, den: actual.den }
    }
    this.reconcileMeasureRests(measure)
    return true
  }

  /** The measure's actual capacity in quarter beats (override or nominal). */
  getMeasureCapacityFrac(measureNumber: number): Fraction | undefined {
    const measure = this.getMeasure(measureNumber)
    return measure ? measureCapacityFrac(measure) : undefined
  }

  /**
   * Copy `ts` into every measure after `fromMeasure`, reconciling rests, until
   * the next measure that carries its own explicit change (which is left alone).
   */
  private propagateTimeSignature(fromMeasure: number, ts: TimeSignature): void {
    for (const m of this.score.measures) {
      if (m.number <= fromMeasure) continue
      if (m.timeSignatureChange) break // next explicit change owns its region
      m.timeSignature = copyTimeSignature(ts)
      this.reconcileMeasureRests(m)
    }
  }

  /**
   * Re-fill a measure's rests for its current meter without disturbing notes.
   * Plain (non-tuplet) rests are dropped and regenerated by the meter-aware
   * filler; chords and tuplet-owned rests are kept. Notes past the bar end are
   * preserved (over-full → SOFT render); under-full bars gain trailing rests.
   */
  private reconcileMeasureRests(measure: Measure): void {
    measure.slots = measure.slots.filter((s) => s.type !== 'rest' || !!s.tupletId)
    this.fillGapsWithRests(measure)
  }

  /**
   * Re-bar the region starting at `fromMeasure` to `ts` (Phase 8). The region
   * runs forward until the next explicit TS change (bounded) or the end of the
   * score (unbounded). Existing music is flattened (old meter) into an absolute
   * stream, the new meter is applied, then the stream is re-laid into bars of the
   * new length with straddling notes split by ties and gaps rest-filled.
   *
   * Unbounded regions grow (extra bars appended) when the content needs more bars
   * and keep trailing measure-rest bars when it needs fewer. Bounded regions fold
   * any overflow into the last bar (crowded/SOFT) rather than crossing the next
   * change. Single-voice today (voice 0); the relay is per-voice-ready.
   *
   * Known Phase-8 limitation: clef changes anchored to a moved beat are dropped
   * (mid-bar clef remapping across moved barlines is future work); opening clefs
   * (beat 0) and the key signature survive because they live on the measure.
   */
  private rebarRegion(fromMeasure: number, ts: TimeSignature): void {
    const ordered = [...this.score.measures].sort((a, b) => a.number - b.number)
    const fromIdx = ordered.findIndex((m) => m.number === fromMeasure)
    if (fromIdx === -1) return

    // Region [fromMeasure..endIdx]; bounded if a later explicit change pins the end.
    let bounded = false
    let endIdx = fromIdx
    for (let i = fromIdx + 1; i < ordered.length; i++) {
      if (ordered[i].timeSignatureChange) {
        bounded = true
        break
      }
      endIdx = i
    }
    const regionMeasures = ordered.slice(fromIdx, endIdx + 1)
    const targetBars = regionMeasures.length

    // Capture ties that cross the region boundary BEFORE ids are regenerated, so
    // they can be re-attached to the rebar'd note at the same position/pitch.
    const boundary = this.captureBoundaryTies(regionMeasures)

    // Flatten using the CURRENT (old) meter, before changing it.
    const events = flattenRegion(regionMeasures, 0)

    // Capture beat-anchored annotations (clef changes + dynamics) by their ABSOLUTE
    // offset from the region start, using the OLD capacities — before the meter is
    // overwritten below. They are re-anchored after rebar (see restoreBeatAnchors).
    const anchors = this.captureBeatAnchors(regionMeasures)

    // Apply the new meter to every region measure. Re-barring rewrites bars to
    // nominal length, so any pickup override on a rewritten bar is cleared (v1).
    for (const m of regionMeasures) {
      m.timeSignature = copyTimeSignature(ts)
      delete m.actualDurationOverride
    }

    const meter = getMeterInfo(ts)
    const plan = relayEvents(events, meter, { targetBars, bounded })

    // Numbers of the measures that hold the plan; append bars if it grew.
    const regionNumbers = regionMeasures.map((m) => m.number)
    for (let i = targetBars; i < plan.length; i++) {
      regionNumbers.push(this.addMeasure(ts).number)
    }

    // Materialise each bar; collect chord pieces (in temporal order) for ties.
    const created: Array<{ piece: RebarPiece; chord: Chord }> = []
    for (let i = 0; i < plan.length; i++) {
      const m = this.getMeasure(regionNumbers[i])
      if (m) this.materializeBar(m, plan[i], created)
    }
    this.linkRebarTies(created)

    // Re-barring regenerated the region's slot ids, so a tie that crossed the
    // region boundary now points at a deleted id. Re-attach it to the rebar'd
    // note at the boundary (same pitch/position); anything unrestorable is then
    // severed so no pointer is left dangling (would crash tie editing).
    this.restoreBoundaryTies(fromMeasure, regionNumbers[regionNumbers.length - 1], boundary)
    this.repairDanglingTies()

    // Re-anchor the captured clef changes / dynamics into the new bar layout,
    // mapping each absolute offset to the (measure, beat) it now lands on.
    this.restoreBeatAnchors(regionNumbers, anchors)
  }

  /**
   * Paste a clipboard event stream at (targetMeasure, targetBeat), OVERWRITING the
   * existing music forward for the clip's span. Reuses the rebar pipeline so the
   * paste inherits its correctness for free: existing content overlapping the paste
   * window is dropped, the clip's events are dropped in at the target offset, and
   * the merged stream is re-barred (barline-crossing notes split with ties, gaps
   * rest-filled, the region grown if it overflows).
   *
   * The region runs from `targetMeasure` to the next explicit TS change (or score
   * end); a single meter governs it (Phase A: pasting across a meter change is not
   * supported — the clip flows in the target region's meter).
   *
   * @returns the ids of the flat notes that landed inside the paste window, for
   *          selecting the pasted material.
   */
  pasteEvents(targetMeasure: number, targetBeat: Fraction, clip: RebarEvent[], spanBeats: Fraction): string[] {
    const ordered = [...this.score.measures].sort((a, b) => a.number - b.number)
    const fromIdx = ordered.findIndex((m) => m.number === targetMeasure)
    if (fromIdx === -1) return []

    // Region [targetMeasure..endIdx]; bounded if a later explicit change pins the end.
    let bounded = false
    let endIdx = fromIdx
    for (let i = fromIdx + 1; i < ordered.length; i++) {
      if (ordered[i].timeSignatureChange) { bounded = true; break }
      endIdx = i
    }
    const regionMeasures = ordered.slice(fromIdx, endIdx + 1)
    const ts = regionMeasures[0].timeSignature

    // The paste window, as offsets from the region start (= targetMeasure start).
    const pasteStart = targetBeat
    const pasteEnd = fracAdd(pasteStart, spanBeats)

    const boundary = this.captureBoundaryTies(regionMeasures)
    const existing = flattenRegion(regionMeasures, 0)
    const anchors = this.captureBeatAnchors(regionMeasures)

    // Overwrite: keep only existing events that lie wholly outside the paste window;
    // anything overlapping it is replaced by the clip (and rest-fill for any remainder).
    const kept = existing.filter((e) => {
      const end = fracAdd(e.offset, e.duration)
      return fracCompare(end, pasteStart) <= 0 || fracGte(e.offset, pasteEnd)
    })
    const shifted = clip.map((e) => ({ ...e, offset: fracAdd(e.offset, pasteStart) }))
    const merged = [...kept, ...shifted].sort((a, b) => fracCompare(a.offset, b.offset))

    const meter = getMeterInfo(ts)
    const targetBars = regionMeasures.length
    const plan = relayEvents(merged, meter, { targetBars, bounded })

    const regionNumbers = regionMeasures.map((m) => m.number)
    for (let i = targetBars; i < plan.length; i++) {
      regionNumbers.push(this.addMeasure(ts).number)
    }

    const created: Array<{ piece: RebarPiece; chord: Chord }> = []
    for (let i = 0; i < plan.length; i++) {
      const m = this.getMeasure(regionNumbers[i])
      if (m) this.materializeBar(m, plan[i], created)
    }
    this.linkRebarTies(created)
    this.restoreBoundaryTies(targetMeasure, regionNumbers[regionNumbers.length - 1], boundary)
    this.repairDanglingTies()
    this.restoreBeatAnchors(regionNumbers, anchors)

    // Collect the ids of notes whose absolute offset falls inside the paste window.
    const startOfMeasure = new Map<number, Fraction>()
    let base = fracCreate(0, 1)
    for (const num of regionNumbers) {
      startOfMeasure.set(num, base)
      const m = this.getMeasure(num)
      base = fracAdd(base, m ? measureCapacityFrac(m) : fracCreate(0, 1))
    }
    const pastedIds: string[] = []
    for (const { chord } of created) {
      const mStart = startOfMeasure.get(chord.measure)
      if (!mStart) continue
      const absOffset = fracAdd(mStart, chord.beat)
      if (fracGte(absOffset, pasteStart) && fracLt(absOffset, pasteEnd)) {
        for (const np of chord.notes) pastedIds.push(np.id)
      }
    }
    return pastedIds
  }

  /**
   * Capture each region clef change / dynamic by its ABSOLUTE beat offset from the
   * region start (cumulative measure capacities + the item's in-measure beat),
   * measured with the measures' CURRENT (pre-rebar) capacities. Mirrors how
   * {@link captureBoundaryTies} snapshots state before ids/bars are regenerated.
   * The originals are wiped by {@link materializeBar}; {@link restoreBeatAnchors}
   * re-creates them (fresh ids) at the position each offset maps to afterwards.
   */
  private captureBeatAnchors(regionMeasures: Measure[]): CapturedAnchor[] {
    const out: CapturedAnchor[] = []
    let base = fracCreate(0, 1)
    for (const m of regionMeasures) {
      const cap = measureCapacityFrac(m)
      for (const c of m.clefs ?? []) {
        out.push({ kind: 'clef', absBeat: fracAdd(base, c.beat), clef: c.clef })
      }
      for (const d of m.dynamics ?? []) {
        out.push({ kind: 'dynamic', absBeat: fracAdd(base, d.beat), dyn: d })
      }
      base = fracAdd(base, cap)
    }
    return out
  }

  /**
   * Re-anchor captured clef changes / dynamics into the rebar'd region: walk the
   * new bars accumulating their capacities, find which measure each absolute offset
   * now lands in, and re-create the annotation there at the local beat. An offset
   * past the (defensively) rebuilt region is clamped to the last bar. A collision
   * at the same beat (+ voice, for dynamics) is overwritten — last wins.
   */
  private restoreBeatAnchors(regionNumbers: number[], anchors: CapturedAnchor[]): void {
    if (anchors.length === 0) return

    const ranges: Array<{ measure: Measure; start: Fraction; cap: Fraction }> = []
    let base = fracCreate(0, 1)
    for (const num of regionNumbers) {
      const m = this.getMeasure(num)
      if (!m) continue
      const cap = measureCapacityFrac(m)
      ranges.push({ measure: m, start: base, cap })
      base = fracAdd(base, cap)
    }
    if (ranges.length === 0) return

    for (const a of anchors) {
      let target = ranges[ranges.length - 1]
      for (const r of ranges) {
        if (fracGte(a.absBeat, r.start) && fracLt(a.absBeat, fracAdd(r.start, r.cap))) {
          target = r
          break
        }
      }
      let beat = fracSub(a.absBeat, target.start)
      if (fracLt(beat, fracCreate(0, 1))) beat = fracCreate(0, 1)
      if (fracGte(beat, target.cap)) beat = target.cap // clamp into the bar (defensive)
      const m = target.measure

      if (a.kind === 'clef') {
        if (!m.clefs) m.clefs = []
        const dup = m.clefs.findIndex((c) => fracCompare(c.beat, beat) === 0)
        if (dup !== -1) m.clefs.splice(dup, 1)
        m.clefs.push({ id: uuidv4(), beat, clef: a.clef })
        m.clefs.sort((x, y) => fracCompare(x.beat, y.beat))
      } else {
        // Dynamics may stack at one (beat, voice) — keep them all (no dedupe).
        if (!m.dynamics) m.dynamics = []
        m.dynamics.push({ ...a.dyn, id: uuidv4(), beat })
        m.dynamics.sort((x, y) => fracCompare(x.beat, y.beat))
      }
    }
  }

  /**
   * Record ties that cross the region's edges: an external note tied INTO the
   * region (incoming) or tied FROM the region out to a later note (outgoing).
   * Keyed by the external note id + its pitch, so the partner can be re-found in
   * the rebar'd region by position/pitch.
   */
  private captureBoundaryTies(regionMeasures: Measure[]): {
    incoming: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number } }>
    outgoing: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number } }>
  } {
    const regionIds = new Set<string>()
    for (const m of regionMeasures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) regionIds.add(p.id)
        else regionIds.add(s.id)
      }
    }
    const lo = regionMeasures[0].number
    const hi = regionMeasures[regionMeasures.length - 1].number
    const incoming: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number } }> = []
    const outgoing: typeof incoming = []
    for (const m of this.score.measures) {
      if (m.number >= lo && m.number <= hi) continue // external notes only
      for (const s of m.slots) {
        if (s.type !== 'chord') continue
        for (const p of s.notes) {
          const pitch = { step: p.step, alter: p.alter, octave: p.octave }
          if (p.tiedTo && regionIds.has(p.tiedTo)) incoming.push({ externalId: p.id, pitch })
          if (p.tiedFrom && regionIds.has(p.tiedFrom)) outgoing.push({ externalId: p.id, pitch })
        }
      }
    }
    return { incoming, outgoing }
  }

  /** Re-attach captured boundary ties to the rebar'd note at the boundary. */
  private restoreBoundaryTies(
    firstMeasure: number,
    lastMeasure: number,
    boundary: ReturnType<ScoreModel['captureBoundaryTies']>,
  ): void {
    for (const { externalId, pitch } of boundary.incoming) {
      const targetId = this.boundaryPitchId(firstMeasure, pitch, 'first')
      if (targetId) this.linkTieById(externalId, targetId)
    }
    for (const { externalId, pitch } of boundary.outgoing) {
      const sourceId = this.boundaryPitchId(lastMeasure, pitch, 'last')
      if (sourceId) this.linkTieById(sourceId, externalId)
    }
  }

  /** Id of the matching pitch in the first/last chord (by beat) of a measure. */
  private boundaryPitchId(
    measureNumber: number,
    pitch: { step: Note['step']; alter: Note['alter']; octave: number },
    which: 'first' | 'last',
  ): string | undefined {
    const m = this.getMeasure(measureNumber)
    if (!m) return undefined
    const chords = (m.slots.filter((s) => s.type === 'chord') as Chord[])
      .sort((a, b) => fracCompare(a.beat, b.beat))
    const ordered = which === 'first' ? chords : chords.reverse()
    for (const c of ordered) {
      const np = c.notes.find((p) => p.step === pitch.step && p.alter === pitch.alter && p.octave === pitch.octave)
      if (np) return np.id
    }
    return undefined
  }

  /** Directly link `fromId` →(tiedTo)→ `toId` on their chord pitches. */
  private linkTieById(fromId: string, toId: string): void {
    const from = this.findSlot(fromId)
    const to = this.findSlot(toId)
    if (!from || from.type !== 'chord' || !to || to.type !== 'chord') return
    from.pitch.tiedTo = toId
    to.pitch.tiedFrom = fromId
  }

  /**
   * Clear `tiedTo`/`tiedFrom` pointers that reference ids no longer present in the
   * score (e.g. after re-barring regenerates region slot ids). Ties are severed,
   * never left dangling, so tie editing/rendering can't hit a missing note.
   */
  private repairDanglingTies(): void {
    const ids = new Set<string>()
    for (const m of this.score.measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    }
    for (const m of this.score.measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') {
          for (const p of s.notes) {
            if (p.tiedTo && !ids.has(p.tiedTo)) delete p.tiedTo
            if (p.tiedFrom && !ids.has(p.tiedFrom)) delete p.tiedFrom
          }
        } else if (s.tiedFrom && !ids.has(s.tiedFrom)) {
          delete s.tiedFrom
        }
      }
    }
  }

  /** Replace a measure's slots/tuplets with a rebar {@link RebarPiece} plan. */
  private materializeBar(
    measure: Measure,
    plan: RebarPiece[],
    created: Array<{ piece: RebarPiece; chord: Chord }>,
  ): void {
    measure.slots = []
    measure.tuplets = []
    delete measure.clefs // mid-bar clefs anchored to moved beats are dropped (Phase 8 limitation)
    delete measure.dynamics // dynamics share the clef limitation: beat anchors don't survive a rebar

    for (const piece of plan) {
      if (piece.atomic && piece.payload) {
        this.materializeAtomicPiece(measure, piece)
        continue
      }
      if (piece.isRest) {
        this.pushRestSlot(
          measure,
          { beat: piece.beat, duration: piece.duration, dots: piece.dots, isMeasureRest: piece.isMeasureRest },
          0,
        )
        continue
      }
      const chord: Chord = {
        id: uuidv4(),
        type: 'chord',
        beat: piece.beat,
        duration: piece.duration,
        measure: measure.number,
        actualDuration: durationToFraction(piece.duration, piece.dots ?? 0),
        notes: (piece.pitches ?? []).map((p) => {
          const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
          if (p.forceAccidental) np.forceAccidental = true
          return np
        }),
      }
      if (piece.dots) chord.dots = piece.dots
      if (piece.stemDirection) chord.stemDirection = piece.stemDirection
      if (piece.articulations) chord.articulations = piece.articulations
      measure.slots.push(chord)
      created.push({ piece, chord })
    }

    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  }

  /** Re-create an atomic tuplet (verbatim slots, fresh ids) at the piece's beat. */
  private materializeAtomicPiece(measure: Measure, piece: RebarPiece): void {
    const payload = piece.payload
    if (!payload) return
    const newTupletId = uuidv4()
    const delta = fracSub(piece.beat, payload.def.startBeat)
    measure.tuplets.push({ ...payload.def, id: newTupletId, startBeat: piece.beat })

    for (const src of payload.slots) {
      const slot = structuredClone(src)
      slot.id = uuidv4()
      slot.tupletId = newTupletId
      slot.measure = measure.number
      slot.beat = fracAdd(src.beat, delta)
      if (slot.type === 'chord') {
        slot.notes = slot.notes.map((p) => ({
          ...p,
          id: uuidv4(),
          tiedTo: undefined,
          tiedFrom: undefined,
        }))
      }
      measure.slots.push(slot)
    }
  }

  /** Link `tiedTo`/`tiedFrom` across consecutive tied chord pieces from rebar. */
  private linkRebarTies(created: Array<{ piece: RebarPiece; chord: Chord }>): void {
    let pending: Chord | null = null
    for (const { piece, chord } of created) {
      if (piece.tieFromPrev && pending) {
        for (const cur of chord.notes) {
          const prev = pending.notes.find(
            (p) => p.step === cur.step && p.alter === cur.alter && p.octave === cur.octave,
          )
          if (prev) {
            prev.tiedTo = cur.id
            cur.tiedFrom = prev.id
          }
        }
      }
      pending = piece.tieToNext ? chord : null
    }
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
      voice: chord.voice,
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
      isMeasureRest: rest.isMeasureRest,
      dots: rest.dots,
      tupletId: rest.tupletId,
      actualDuration: rest.actualDuration,
      tiedFrom: rest.tiedFrom,
      voice: rest.voice,
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
      if (params.voice) rest.voice = params.voice
      rest.actualDuration = this.computeActualDurationForSlot(rest, measure)
      measure.slots.push(rest)
      measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      return this.restToFlatNote(rest)
    }

    // Regular note — look for an existing Chord at the same beat AND voice
    // (different voices are independent streams and never merge into one chord).
    const noteVoice = params.voice ?? 0
    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, params.beat) && (s.voice ?? 0) === noteVoice
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
    if (params.voice) chord.voice = params.voice
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
    const chordVoice = chord.voice ?? 0

    // Remove overlapping rests IN THE SAME VOICE; keep everything else (chords, and
    // rests belonging to other voices — voices are independent streams).
    let inheritedTupletId: string | undefined = chord.tupletId
    const remaining: ChordRest[] = []

    for (const existing of measure.slots) {
      if (existing.type === 'rest') {
        const existingDurFrac =
          existing.actualDuration ?? durationToFraction(existing.duration, existing.dots ?? 0)
        const overlaps =
          (existing.voice ?? 0) === chordVoice &&
          noteSpansOverlapFrac(chord.beat, chordDurFrac, existing.beat, existingDurFrac)
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
   * Public: refill a measure's gaps with engraving-correct, meter-aware rests
   * (per voice). Used after an edit frees space — e.g. shortening a rest — so the
   * remainder is regrouped for the measure's meter instead of by the legacy
   * float splitter. No-op if the measure doesn't exist.
   */
  fillMeasureGaps(measureNumber: number): void {
    const measure = this.getMeasure(measureNumber)
    if (measure) this.fillGapsWithRests(measure)
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
    const barEnd = measureCapacityFrac(measure)
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
          this.pushRestSlot(measure, rest, voice)
        }
      }
    }
  }

  /**
   * Compute the exact sounding duration of a slot as a Fraction.
   *
   * A measure rest spans the whole bar regardless of its `'w'` glyph, so its
   * actual length is the meter's bar length — correct in every meter, not just
   * 4/4 where `'w'` happens to equal four quarters.
   */
  private computeActualDurationForSlot(slot: ChordRest | { duration: NoteDuration; dots?: number; tupletId?: string; isMeasureRest?: boolean }, measure: Measure): Fraction {
    if ('isMeasureRest' in slot && slot.isMeasureRest) {
      return measureCapacityFrac(measure)
    }
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
        // A relocated rest is no longer the whole-bar measure rest.
        delete rest.isMeasureRest
        rest.actualDuration = this.computeActualDurationForSlot(rest, newMeasureObj)
        newMeasureObj.slots.push(rest)
        newMeasureObj.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      } else {
        // Giving the rest a specific duration/dots/beat individualises it — it is
        // no longer the whole-bar measure rest, so drop the flag (otherwise it keeps
        // rendering as a centred whole rest and claiming the whole bar's length).
        if (updates.duration !== undefined || updates.dots !== undefined || updates.beat !== undefined) {
          delete rest.isMeasureRest
        }
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
    const scoreData = JSON.parse(json) as Score
    const model = new ScoreModel()
    model.score = scoreData

    // The load boundary is the only place a bad meter can enter (the
    // TimeSignature type permits any integers), so reject non-dyadic / out-of-
    // range signatures here before they detonate in meter.ts or the renderer.
    ScoreModel.validateMeters(scoreData)

    // v1 had no time-signature-change markers; derive them so the change-aware
    // layers (and any future re-bar) have an authoritative source.
    const needsTsMigration = (scoreData.schemaVersion ?? 1) < 2
    let prevTs: TimeSignature | null = null

    for (const measure of model.score.measures) {
      // Migrate legacy per-measure clef (single `clef`) to the positioned list.
      const legacyClef = (measure as { clef?: Clef }).clef
      if (legacyClef && !measure.clefs) {
        measure.clefs = [{ id: uuidv4(), beat: fracCreate(0, 1), clef: legacyClef }]
        delete (measure as { clef?: Clef }).clef
      }

      // Measure 1 always begins the opening signature; any later measure whose
      // signature differs from the previous one is an explicit change.
      if (needsTsMigration) {
        const isChange =
          measure.number === 1 || (prevTs !== null && !sameTimeSignature(prevTs, measure.timeSignature))
        if (isChange) measure.timeSignatureChange = true
        else delete measure.timeSignatureChange
      }
      prevTs = measure.timeSignature

      // Recompute actualDuration (not stored reliably across versions). The
      // helper handles measure rests (whole-bar length) in every meter.
      for (const slot of measure.slots ?? []) {
        slot.actualDuration = model.computeActualDurationForSlot(slot, measure)
      }
    }

    model.score.schemaVersion = 2
    return model
  }

  /**
   * Reject a loaded score that carries a non-dyadic / out-of-range time
   * signature (or an invalid additive grouping) on the default or any measure.
   * Guards the only entry point a bad meter can take, since `TimeSignature`
   * itself permits any integers.
   */
  private static validateMeters(score: Score): void {
    if (!isValidTimeSignature(score.defaultTimeSignature)) {
      const { numerator, denominator } = score.defaultTimeSignature
      throw new Error(`Invalid defaultTimeSignature ${numerator}/${denominator}: not a representable dyadic meter (or its grouping is invalid).`)
    }
    for (const m of score.measures ?? []) {
      if (!isValidTimeSignature(m.timeSignature)) {
        const { numerator, denominator } = m.timeSignature
        throw new Error(`Invalid time signature ${numerator}/${denominator} at measure ${m.number}: not a representable dyadic meter (or its grouping is invalid).`)
      }
      if (m.actualDurationOverride !== undefined && !fracIsPositive(m.actualDurationOverride)) {
        throw new Error(`Invalid actualDurationOverride at measure ${m.number}: must be a positive length.`)
      }
    }
  }
}

/** Deep-copy a time signature, including any additive grouping array. */
function copyTimeSignature(ts: TimeSignature): TimeSignature {
  return ts.grouping
    ? { numerator: ts.numerator, denominator: ts.denominator, grouping: [...ts.grouping] }
    : { numerator: ts.numerator, denominator: ts.denominator }
}
