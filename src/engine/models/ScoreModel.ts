import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, NoteDuration, ChordRest, Chord, Rest, NotePitch, PitchAlter, PitchStep, Clef, Dynamic, Slur, EngravingOverride, CurveControlPointDeltas, CurveShapeOverride, SegmentCurveShapeOverride, SlurEndpointOffsetOverride, SlurSegmentAddress } from '@/types/music'
import { engravingOverridesOf, engravingOverrideOf, migrateLegacySlurCps } from './engravingOverrides'
import {
  getTupletTotalBeatsFrac,
  getTupletNoteDurationFrac,
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
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { flattenRegion, relayEvents, type RebarPiece, type RebarEvent, type BarPlan } from '@/utils/rebar'
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
  fracIsPositive,
  fracToNumber,
} from '@/utils/fraction'
import { effectiveClefAt, measureOpeningClef, middleLineDiatonicPos } from '@/utils/clefUtils'
import * as clefOps from './clefOps'
import { toFlatNote, restToFlatNote } from './noteProjection'
import * as tupletOps from './tupletOps'
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

/** The pitch identity of a slur anchor (a chord pitch), used to re-find it post-rebar. */
type SlurPitch = { step: NotePitch['step']; alter: NotePitch['alter']; octave: number }

/**
 * One end of a slur snapshotted before a rebar: an IN-region endpoint is keyed by its
 * absolute onset offset from the region start + pitch (so it can be re-found on the
 * rebar'd note); an endpoint OUTSIDE the region keeps its id verbatim (not regenerated).
 */
type CapturedSlurEnd =
  | { offset: Fraction; pitch: SlurPitch; voice: number; externalId?: undefined }
  | { externalId: string; offset?: undefined; pitch?: undefined; voice?: undefined }

/**
 * A slur (live ref) with at least one endpoint inside the rebar region, captured before
 * ids are regenerated. See {@link ScoreModel.captureSlurs}.
 */
type CapturedSlur = { slur: Slur; start: CapturedSlurEnd; end: CapturedSlurEnd }

/** Render a pitch alteration as accidental marks for debug logs (#, b, n). */
function alterMarks(alter: number): string {
  if (alter > 0) return '#'.repeat(alter)
  if (alter < 0) return 'b'.repeat(-alter)
  return ''
}

/**
 * Compact, voice-tagged one-line summary of a slot for debug logs, e.g.
 * `v0 C4+E4 q m1 b0.000` (a chord) or `v1 REST h. m2 b1.500`. Voice always
 * shown (even default 0) because the multi-voice paths are the sensitive ones.
 */
function fmtSlot(slot: ChordRest): string {
  const v = slot.voice ?? 0
  const b = fracToNumber(slot.beat).toFixed(3)
  const dots = slot.dots ? '.'.repeat(slot.dots) : ''
  const tup = slot.tupletId ? ` tup:${slot.tupletId.slice(0, 4)}` : ''
  if (slot.type === 'rest') {
    const mr = slot.isMeasureRest ? ' [measure-rest]' : ''
    return `v${v} REST ${slot.duration}${dots} m${slot.measure} b${b}${mr}${tup}`
  }
  const pitches = slot.notes.map(n => `${n.step}${alterMarks(n.alter)}${n.octave}`).join('+')
  return `v${v} ${pitches} ${slot.duration}${dots} m${slot.measure} b${b}${tup}`
}

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
   * Add a new measure to the END of the score.
   * The measure is automatically filled with rests to match the time signature.
   * Appending is just an insert after the last measure, so this delegates to
   * {@link insertMeasureAfter} (single code path).
   */
  addMeasure(timeSignature?: TimeSignature): Measure {
    return this.insertMeasureAfter(this.score.measures.length, timeSignature)
  }

  /**
   * Insert a fresh measure immediately AFTER the measure numbered `afterNumber`
   * (`afterNumber === 0` inserts at the very front; `afterNumber === length`
   * appends). Subsequent measures — and each of their slots' `.measure` field —
   * are renumbered, mirroring {@link removeMeasure}'s splice+renumber pattern.
   *
   * The new bar is rest-filled for its meter. A mid-score inserted bar is a
   * continuation, NOT an explicit change, so it is left unmarked — EXCEPT measure
   * 1, which always carries the score's opening time signature explicitly. Rebar
   * uses this to push a downstream TS change forward by materialising over the
   * inserted bars; `materializeBar` overwrites the rest-fill wholesale.
   */
  insertMeasureAfter(afterNumber: number, timeSignature?: TimeSignature): Measure {
    const ts = timeSignature || this.score.defaultTimeSignature
    const measure: Measure = {
      id: uuidv4(),
      number: afterNumber + 1,
      slots: [],
      timeSignature: ts,
      tuplets: [],
    }
    // Measure 1 always carries the score's opening time signature explicitly.
    if (afterNumber === 0) measure.timeSignatureChange = true

    // Splice in right after `afterNumber` (front when 0, end when not found).
    const idx = afterNumber === 0 ? -1 : this.score.measures.findIndex((m) => m.number === afterNumber)
    const insertIdx = idx === -1 ? (afterNumber === 0 ? 0 : this.score.measures.length) : idx + 1
    this.score.measures.splice(insertIdx, 0, measure)

    // Renumber this measure + everything after it (and their slots' .measure).
    for (let i = insertIdx; i < this.score.measures.length; i++) {
      this.score.measures[i].number = i + 1
      this.score.measures[i].slots.forEach((slot) => {
        slot.measure = i + 1
      })
    }

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
    return clefOps.setClefAt(this.score, measureNumber, beat, clef)
  }

  /**
   * Remove a clef change at (measure, beat), reverting that position to the
   * inherited clef. Measure 1 / beat 0 cannot be removed (only changed).
   * @returns true if a change was removed.
   */
  removeClefAt(measureNumber: number, beat: Fraction): boolean {
    return clefOps.removeClefAt(this.score, measureNumber, beat)
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
    return clefOps.moveClef(this.score, fromMeasure, fromBeat, toMeasure, toBeat)
  }

  /** Relocate a clef change within a single measure (see {@link moveClef}). */
  moveClefWithinMeasure(measureNumber: number, fromBeat: Fraction, toBeat: Fraction): boolean {
    return clefOps.moveClefWithinMeasure(this.score, measureNumber, fromBeat, toBeat)
  }

  /**
   * Remove the clef change at (measure, beat) if it is redundant — i.e. equals
   * the clef already in effect immediately before it. Measure 1 / beat 0 (the
   * protected opening) is never removed. Used to clean up after a clef drag,
   * where redundant positions are allowed transiently but shouldn't persist.
   * @returns true if a redundant change was removed.
   */
  normalizeClefAt(measureNumber: number, beat: Fraction): boolean {
    return clefOps.normalizeClefAt(this.score, measureNumber, beat)
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

  // ==================== Slurs (top-level phrasing spans) ====================

  /** All phrasing slurs (the live array; empty if none). See {@link Slur}. */
  getSlurs(): Slur[] {
    return this.score.slurs ?? []
  }

  /** Add a slur; returns the stored Slur (with a generated id). */
  addSlur(slur: Omit<Slur, 'id'>): Slur {
    const created: Slur = { ...slur, id: uuidv4() }
    if (!this.score.slurs) this.score.slurs = []
    this.score.slurs.push(created)
    return created
  }

  /** Remove a slur by id. @returns true if one was removed. */
  removeSlur(id: string): boolean {
    if (!this.score.slurs) return false
    const i = this.score.slurs.findIndex(s => s.id === id)
    if (i < 0) return false
    this.score.slurs.splice(i, 1)
    this.clearEngravingOverride(id) // auto-reset (§3.3): slur deleted → its overrides die with it
    return true
  }

  /** Find a slur by its exact (directional) endpoints, or undefined. */
  findSlurByEndpoints(startNoteId: string, endNoteId: string): Slur | undefined {
    return this.score.slurs?.find(s => s.startNoteId === startNoteId && s.endNoteId === endNoteId)
  }

  /** Find a slur anywhere by id (live reference), or null. */
  getSlurById(id: string): Slur | null {
    return this.score.slurs?.find(s => s.id === id) ?? null
  }

  /**
   * Set (or clear) a slur's user-edited curve shape. Pass the two cubic control-point
   * deltas (in **staff-spaces**, anchor-relative — the caller converts from pixels) to
   * override the auto arch; pass `null` to drop the override and revert to the auto
   * shape. The shape lives in the engraving-overrides compartment keyed by the slur id
   * (a {@link CurveShapeOverride}), NOT on the `Slur` — pixels stay out of the content
   * model (Phase 1; see docs/engraving-overrides-plan.md). @returns true if the slur
   * exists and was updated.
   */
  setSlurShape(id: string, cps: CurveControlPointDeltas | null): boolean {
    const slur = this.getSlurById(id)
    if (!slur) return false
    if (cps) {
      const override: CurveShapeOverride = { kind: 'curveShape', cps }
      this.setEngravingOverride(id, override)
    } else {
      this.clearEngravingOverride(id, 'curveShape')
    }
    return true
  }

  /**
   * Re-anchor one end of a slur onto a different note (used by the draggable endpoint
   * handles). Rewrites `startNoteId` or `endNoteId` and **drops any custom shape** — the
   * hand-tuned arc was relative to the old span, so it re-bows to the auto arch for the
   * new endpoints. Rejected (returns false) if the slur is missing, the target equals
   * the current anchor, or it would collapse the span (start === end).
   */
  setSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
    const slur = this.getSlurById(id)
    if (!slur) return false
    const otherId = which === 'start' ? slur.endNoteId : slur.startNoteId
    const currentId = which === 'start' ? slur.startNoteId : slur.endNoteId
    if (noteId === otherId || noteId === currentId) return false
    if (which === 'start') slur.startNoteId = noteId
    else slur.endNoteId = noteId
    // auto-reset (§3.3): endpoint re-pointed onto a different element → both the single-arc
    // shape AND the cross-system per-segment shape were authored against the OLD anchors.
    // NOTE: 'endpointOffset' is deliberately NOT cleared here — it is anchor-relative, so
    // the nudge rides onto the new anchor and stays meaningful (slur-endpoint-offset-plan).
    this.clearEngravingOverride(id, 'curveShape')
    this.clearEngravingOverride(id, 'segmentCurveShape')
    return true
  }

  /**
   * Nudge one endpoint of a slur by a staff-space delta, **accumulating** onto any existing
   * offset (the in/out keyboard fine-positioning — see docs/slur-endpoint-offset-plan.md).
   * Stored as a {@link SlurEndpointOffsetOverride} in the engraving-overrides compartment
   * (staff-spaces, anchor-relative — so it survives a re-anchor and any font/zoom/reflow).
   * `dx`/`dy` are in staff-spaces. A future "reset" simply calls
   * `clearEngravingOverride(id, 'endpointOffset')`. @returns true if the slur exists.
   */
  setSlurEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    if (!this.getSlurById(id)) return false
    const prev = this.getEngravingOverride(id, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
    const base = which === 'start' ? prev?.start : prev?.end
    const moved = { x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy }
    const next: SlurEndpointOffsetOverride = {
      kind: 'endpointOffset',
      ...(prev?.start ? { start: prev.start } : {}),
      ...(prev?.end ? { end: prev.end } : {}),
      [which]: moved,
    }
    this.setEngravingOverride(id, next)
    return true
  }

  /**
   * Set (or clear) the shape of ONE segment of a cross-system slur (BEGIN, END, or a MIDDLE
   * addressed by ordinal). Stored in the engraving-overrides compartment as a
   * {@link SegmentCurveShapeOverride}, separate from the single-arc `curveShape`. `cps` are
   * in **staff-spaces**, anchor-relative (the caller converts from pixels); pass `null` to
   * drop just that segment's edit. `spanCount` is the **live** system count at the time of
   * the edit — it becomes the override's reset signature.
   *
   * Count-change handling on write: if the stored override was authored against a *different*
   * `spanCount`, its MIDDLE edits are stale, so they are dropped here (begin/end are durable
   * and kept) before the live count is adopted — otherwise a stale middle could resurrect at
   * the wrong geometry once the signatures matched again. Mirrors the read-time apply rule
   * in `reconcileSegmentShape`. See docs/multisystem-slur-segment-shape-plan.md §2–§3.
   * @returns true if the slur exists and was updated.
   */
  setSlurSegmentShape(
    id: string,
    segment: SlurSegmentAddress,
    cps: CurveControlPointDeltas | null,
    spanCount: number,
  ): boolean {
    if (!this.getSlurById(id)) return false
    const prev = this.getEngravingOverride(id, 'segmentCurveShape') as SegmentCurveShapeOverride | undefined
    // Rebuild the override fresh (cheap, avoids in-place aliasing). Adopt the live spanCount;
    // keep begin/end always (durable), keep middles only when the count is unchanged.
    const keepMiddles = prev !== undefined && prev.spanCount === spanCount
    const next: SegmentCurveShapeOverride = {
      kind: 'segmentCurveShape',
      spanCount,
      ...(prev?.begin ? { begin: prev.begin } : {}),
      ...(prev?.end ? { end: prev.end } : {}),
      middles: keepMiddles ? { ...(prev!.middles ?? {}) } : {},
    }
    if (segment.role === 'middle') {
      if (cps) next.middles![segment.ordinal] = cps
      else delete next.middles![segment.ordinal]
    } else if (segment.role === 'begin') {
      if (cps) next.begin = cps; else delete next.begin
    } else {
      if (cps) next.end = cps; else delete next.end
    }
    const hasAny = next.begin || next.end || Object.keys(next.middles ?? {}).length > 0
    if (hasAny) this.setEngravingOverride(id, next)
    else this.clearEngravingOverride(id, 'segmentCurveShape')
    return true
  }

  // ============ Engraving overrides (authored-geometry compartment) ============
  // A separate id-addressed compartment for hand-positioning data (staff-space,
  // anchor-relative), kept OUT of the musical content model. It is a sub-tree of
  // `Score` (`score.engravingOverrides`), so it clones / serializes / undoes with
  // the score value for free. Phase 0 is infrastructure only — storage + accessors +
  // JSON round-trip, NO clients yet; slur `cps` migrates in as client #1 in Phase 1.
  // See docs/engraving-overrides-plan.md.

  /** Every override recorded for an element id (the live array, or [] if none). */
  getEngravingOverrides(elementId: string): EngravingOverride[] {
    return engravingOverridesOf(this.score, elementId)
  }

  /** The override of a given `kind` on an element, or undefined when absent. */
  getEngravingOverride(elementId: string, kind: string): EngravingOverride | undefined {
    return engravingOverrideOf(this.score, elementId, kind)
  }

  /**
   * Upsert an override: replaces any existing entry of the same `kind` on this
   * element, otherwise appends. Lazily creates the compartment. An element may hold
   * several overrides of *different* kinds (e.g. a nudge AND a reshape) but only one
   * per kind.
   */
  setEngravingOverride(elementId: string, override: EngravingOverride): void {
    if (!this.score.engravingOverrides) this.score.engravingOverrides = {}
    const all = this.score.engravingOverrides
    const list = all[elementId] ?? (all[elementId] = [])
    const i = list.findIndex(o => o.kind === override.kind)
    if (i >= 0) list[i] = override
    else list.push(override)
  }

  /**
   * Clear overrides on an element: just one `kind` when given, else ALL overrides for
   * the element. Prunes the element's entry (and the whole compartment) once it
   * empties, so "absent = none" holds and the JSON stays clean.
   * @returns true if anything was removed.
   *
   * **This is also the conservative auto-reset primitive (plan §3.3 / Phase 2).** The
   * compartment drops an override on its own ONLY when an edit *provably* breaks its
   * anchor — the element is **deleted** (clear all kinds) or a span endpoint is
   * **re-pointed onto a different element** (clear the span-relative `curveShape`). Gray
   * zone edits (anchors survive, basis merely shifted — e.g. notes inserted under a slur)
   * stay sticky; when unsure, keep and show. The rule is **operation-driven**: its callers
   * are the explicit, finite set of edit ops that remove/re-anchor an overridable element
   * (grep `auto-reset (§3.3)`), NOT a sweep over "what looks orphaned". Today that set is
   * slur-only — slurs have durable ids; it must NOT be wired to auto-rests/beams until
   * their ids stop churning across regeneration (plan §3.6, "Adding an element").
   */
  clearEngravingOverride(elementId: string, kind?: string): boolean {
    const all = this.score.engravingOverrides
    const list = all?.[elementId]
    if (!all || !list) return false
    let removed = false
    if (kind === undefined) {
      delete all[elementId]
      removed = true
    } else {
      const i = list.findIndex(o => o.kind === kind)
      if (i >= 0) {
        list.splice(i, 1)
        removed = true
      }
      if (list.length === 0) delete all[elementId]
    }
    if (Object.keys(all).length === 0) delete this.score.engravingOverrides
    return removed
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
   * The region always grows when the content needs more bars: extra bars are
   * inserted right after the region, pushing any following TS change (and all
   * downstream content) forward — content is never crammed into a bounded last
   * bar. When the content needs fewer bars, trailing measure-rest bars are kept
   * (removing bars is an explicit action). Single-voice today (voice 0); the
   * relay is per-voice-ready.
   *
   * Known Phase-8 limitation: clef changes anchored to a moved beat are dropped
   * (mid-bar clef remapping across moved barlines is future work); opening clefs
   * (beat 0) and the key signature survive because they live on the measure.
   */
  private rebarRegion(fromMeasure: number, ts: TimeSignature): void {
    const ordered = [...this.score.measures].sort((a, b) => a.number - b.number)
    const fromIdx = ordered.findIndex((m) => m.number === fromMeasure)
    if (fromIdx === -1) return

    // Region [fromMeasure..endIdx]; the end is pinned by the next explicit TS
    // change (or the score end). Overflow grows the region in place (pushing any
    // such change forward) rather than cramming — see below.
    let endIdx = fromIdx
    for (let i = fromIdx + 1; i < ordered.length; i++) {
      if (ordered[i].timeSignatureChange) break
      endIdx = i
    }
    const regionMeasures = ordered.slice(fromIdx, endIdx + 1)
    const targetBars = regionMeasures.length

    // Capture ties that cross the region boundary BEFORE ids are regenerated, so
    // they can be re-attached to the rebar'd note at the same position/pitch.
    const boundary = this.captureBoundaryTies(regionMeasures)

    // Capture slurs anchored inside the region before ids are regenerated, so they can
    // be re-attached to the rebar'd notes (otherwise they'd dangle and vanish).
    const slurState = this.captureSlurs(regionMeasures)

    // Capture beat-anchored annotations (clef changes + dynamics) by their ABSOLUTE
    // offset from the region start, using the OLD capacities — before the meter is
    // overwritten below. They are re-anchored after rebar (see restoreBeatAnchors).
    const anchors = this.captureBeatAnchors(regionMeasures)

    // Distinct voices present in the region (always include voice 0).
    const voices = new Set<number>([0])
    for (const m of regionMeasures) for (const s of m.slots) voices.add(s.voice ?? 0)

    // Flatten EVERY voice against the CURRENT (old) meter — this MUST happen before
    // the meter overwrite, because flattenRegion reads each measure's timeSignature
    // to compute offsets. (Folding the overwrite into a per-voice loop would flatten
    // later voices against the new meter = the exact corruption this fixes.)
    const eventsByVoice = new Map<number, RebarEvent[]>()
    for (const v of voices) eventsByVoice.set(v, flattenRegion(regionMeasures, v as 0 | 1 | 2 | 3))

    // Apply the new meter to every region measure. Re-barring rewrites bars to
    // nominal length, so any pickup override on a rewritten bar is cleared (v1).
    for (const m of regionMeasures) {
      m.timeSignature = copyTimeSignature(ts)
      delete m.actualDurationOverride
    }

    // Relay EACH voice against the NEW meter. Always grow (bounded: false):
    // overflow becomes MORE bars, never crammed. The region grows to the LONGEST
    // voice's plan.
    const meter = getMeterInfo(ts)
    const plans = new Map<number, BarPlan[]>()
    let maxBars = targetBars
    for (const v of voices) {
      const plan = relayEvents(eventsByVoice.get(v)!, meter, { targetBars, bounded: false })
      plans.set(v, plan)
      if (plan.length > maxBars) maxBars = plan.length
    }

    // Grow the region in place: insert any extra bars immediately after the last
    // region measure, PUSHING the next TS change (and all downstream content)
    // forward. For an unbounded region the last region measure is the score's
    // last, so this is identical to appending. Insert consecutively so the new
    // bars stay contiguous with the region.
    const lastRegionNumber = regionMeasures[regionMeasures.length - 1].number
    const grow = maxBars - targetBars
    for (let i = 0; i < grow; i++) {
      this.insertMeasureAfter(lastRegionNumber + i, ts)
    }

    // The region now occupies a contiguous run of `maxBars` bars from fromMeasure.
    const regionNumbers: number[] = []
    for (let i = 0; i < maxBars; i++) regionNumbers.push(fromMeasure + i)

    // Materialise every voice additively (clear-once → per-voice fill → collapse).
    this.materializeRegion(regionNumbers, plans)

    // Re-barring regenerated the region's slot ids, so a tie that crossed the
    // region boundary now points at a deleted id. Re-attach it to the rebar'd
    // note at the boundary (same pitch/position); anything unrestorable is then
    // severed so no pointer is left dangling (would crash tie editing).
    this.restoreBoundaryTies(fromMeasure, regionNumbers[regionNumbers.length - 1], boundary)
    this.repairDanglingTies()

    // Re-attach captured slurs to the rebar'd notes (by onset offset + pitch); drop any
    // that can't be re-found, so none is left pointing at a regenerated/deleted id.
    this.restoreSlurs(regionNumbers, slurState)
    this.repairDanglingSlurs()

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
  pasteEvents(
    targetMeasure: number,
    targetBeat: Fraction,
    clipVoices: { voice: number; events: RebarEvent[] }[],
    spanBeats: Fraction,
    targetVoice: number,
  ): string[] {
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
    const slurState = this.captureSlurs(regionMeasures)
    const anchors = this.captureBeatAnchors(regionMeasures)

    // Re-voicing contract (decision (a)): a single-voice clip drops into the paste
    // target voice (so copy voice 1 → paste into voice 2 works); a multi-voice clip
    // preserves each event's original voice. `destVoices` maps the destination voice
    // → the clip events that overwrite its paste window.
    const destVoices = new Map<number, RebarEvent[]>()
    if (clipVoices.length === 1) {
      destVoices.set(targetVoice, clipVoices[0].events)
    } else {
      for (const cv of clipVoices) destVoices.set(cv.voice, cv.events)
    }

    // Every voice we must re-lay: those already in the region, plus any new
    // destination voice. Voice 0 is always re-laid so a grown region keeps its
    // rest spine. A voice that is NOT a destination is passed through verbatim, so
    // a paste must not erase the other voices.
    const voices = new Set<number>([0])
    for (const m of regionMeasures) for (const s of m.slots) voices.add(s.voice ?? 0)
    for (const dv of destVoices.keys()) voices.add(dv)

    const meter = getMeterInfo(ts)
    const targetBars = regionMeasures.length

    const plans = new Map<number, BarPlan[]>()
    let maxBars = targetBars
    for (const v of voices) {
      const existing = flattenRegion(regionMeasures, v as 0 | 1 | 2 | 3)
      const clip = destVoices.get(v)
      let events: RebarEvent[]
      if (clip) {
        // Overwrite: keep existing events wholly outside the paste window; anything
        // overlapping it is replaced by the (shifted) clip, with rest-fill covering
        // any remainder.
        const kept = existing.filter((e) => {
          const end = fracAdd(e.offset, e.duration)
          return fracCompare(end, pasteStart) <= 0 || fracGte(e.offset, pasteEnd)
        })
        const shifted = clip.map((e) => ({ ...e, offset: fracAdd(e.offset, pasteStart) }))
        events = [...kept, ...shifted].sort((a, b) => fracCompare(a.offset, b.offset))
      } else {
        // Passthrough (same meter — barlines don't move, growth only appends a tail
        // this voice ignores).
        events = existing
      }
      const p = relayEvents(events, meter, { targetBars, bounded })
      plans.set(v, p)
      if (p.length > maxBars) maxBars = p.length
    }

    const regionNumbers = regionMeasures.map((m) => m.number)
    for (let i = targetBars; i < maxBars; i++) {
      regionNumbers.push(this.addMeasure(ts).number)
    }

    const created = this.materializeRegion(regionNumbers, plans)
    this.restoreBoundaryTies(targetMeasure, regionNumbers[regionNumbers.length - 1], boundary)
    this.repairDanglingTies()
    this.restoreSlurs(regionNumbers, slurState)
    this.repairDanglingSlurs()
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
      if (!destVoices.has(chord.voice ?? 0)) continue // only the pasted notes
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
    incoming: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number }; voice: number }>
    outgoing: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number }; voice: number }>
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
    const incoming: Array<{ externalId: string; pitch: { step: Note['step']; alter: Note['alter']; octave: number }; voice: number }> = []
    const outgoing: typeof incoming = []
    for (const m of this.score.measures) {
      if (m.number >= lo && m.number <= hi) continue // external notes only
      for (const s of m.slots) {
        if (s.type !== 'chord') continue
        // A tie never crosses voices, so the in-region partner shares this external
        // note's voice — record it so the re-find can filter to the right voice
        // (a unison in another voice at the boundary must not steal the tie).
        const voice = s.voice ?? 0
        for (const p of s.notes) {
          const pitch = { step: p.step, alter: p.alter, octave: p.octave }
          if (p.tiedTo && regionIds.has(p.tiedTo)) incoming.push({ externalId: p.id, pitch, voice })
          if (p.tiedFrom && regionIds.has(p.tiedFrom)) outgoing.push({ externalId: p.id, pitch, voice })
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
    for (const { externalId, pitch, voice } of boundary.incoming) {
      const targetId = this.boundaryPitchId(firstMeasure, pitch, 'first', voice)
      if (targetId) this.linkTieById(externalId, targetId)
    }
    for (const { externalId, pitch, voice } of boundary.outgoing) {
      const sourceId = this.boundaryPitchId(lastMeasure, pitch, 'last', voice)
      if (sourceId) this.linkTieById(sourceId, externalId)
    }
  }

  /** Id of the matching pitch in the first/last chord (by beat) of a measure, within a voice. */
  private boundaryPitchId(
    measureNumber: number,
    pitch: { step: Note['step']; alter: Note['alter']; octave: number },
    which: 'first' | 'last',
    voice: number,
  ): string | undefined {
    const m = this.getMeasure(measureNumber)
    if (!m) return undefined
    const chords = (m.slots.filter((s) => s.type === 'chord') as Chord[])
      .filter((c) => (c.voice ?? 0) === voice) // ties never cross voices
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

  /**
   * Snapshot every slur with at least one endpoint inside the region BEFORE re-barring
   * regenerates note ids. Each in-region endpoint is recorded by its ABSOLUTE onset
   * offset from the region start (pre-rebar capacities) + pitch, so it can be re-found
   * on the rebar'd note at the same position/pitch; an endpoint OUTSIDE the region keeps
   * its id verbatim (those ids aren't regenerated). Mirrors {@link captureBoundaryTies}.
   */
  private captureSlurs(regionMeasures: Measure[]): CapturedSlur[] {
    const slurs = this.score.slurs
    if (!slurs || slurs.length === 0) return []

    // Region pitch id -> its absolute onset offset + pitch identity + voice.
    const inRegion = new Map<string, { offset: Fraction; pitch: SlurPitch; voice: number }>()
    let base = fracCreate(0, 1)
    for (const m of regionMeasures) {
      const cap = measureCapacityFrac(m)
      for (const s of m.slots) {
        if (s.type !== 'chord') continue
        const offset = fracAdd(base, s.beat)
        const voice = s.voice ?? 0
        for (const p of s.notes) {
          inRegion.set(p.id, { offset, pitch: { step: p.step, alter: p.alter, octave: p.octave }, voice })
        }
      }
      base = fracAdd(base, cap)
    }

    const captured: CapturedSlur[] = []
    for (const slur of slurs) {
      const start = inRegion.get(slur.startNoteId)
      const end = inRegion.get(slur.endNoteId)
      if (!start && !end) continue // slur lies wholly outside the region — untouched
      captured.push({
        slur,
        start: start ? { offset: start.offset, pitch: start.pitch, voice: start.voice } : { externalId: slur.startNoteId },
        end: end ? { offset: end.offset, pitch: end.pitch, voice: end.voice } : { externalId: slur.endNoteId },
      })
    }
    return captured
  }

  /** Canonical lookup key for a slur anchor: absolute onset offset + exact pitch + voice. */
  private slurAnchorKey(offset: Fraction, pitch: SlurPitch, voice: number): string {
    return `${offset.num}/${offset.den}|${pitch.step}/${pitch.alter}/${pitch.octave}|v${voice}`
  }

  /**
   * Re-attach captured slurs to the rebar'd region: re-find each in-region endpoint by
   * its absolute onset offset + pitch (the chord that now starts there), keeping any
   * external endpoint id as-is. A slur whose endpoint can't be re-found (its note was
   * overwritten/dropped), or that collapses to a single point, is removed — never left
   * dangling. Mirrors {@link restoreBoundaryTies}.
   */
  private restoreSlurs(regionNumbers: number[], captured: CapturedSlur[]): void {
    if (captured.length === 0) return
    const slurs = this.score.slurs
    if (!slurs) return

    // New region: absolute onset offset + pitch -> pitch id (first chord at the offset wins).
    const lookup = new Map<string, string>()
    let base = fracCreate(0, 1)
    for (const num of regionNumbers) {
      const m = this.getMeasure(num)
      if (!m) continue
      const cap = measureCapacityFrac(m)
      for (const s of m.slots) {
        if (s.type !== 'chord') continue
        const offset = fracAdd(base, s.beat)
        const voice = s.voice ?? 0
        for (const p of s.notes) {
          const key = this.slurAnchorKey(offset, { step: p.step, alter: p.alter, octave: p.octave }, voice)
          if (!lookup.has(key)) lookup.set(key, p.id)
        }
      }
      base = fracAdd(base, cap)
    }

    const resolve = (end: CapturedSlurEnd): string | undefined =>
      end.externalId !== undefined
        ? end.externalId
        : lookup.get(this.slurAnchorKey(end.offset, end.pitch, end.voice))

    for (const c of captured) {
      const idx = slurs.indexOf(c.slur)
      if (idx === -1) continue
      const newStart = resolve(c.start)
      const newEnd = resolve(c.end)
      if (!newStart || !newEnd || newStart === newEnd) {
        slurs.splice(idx, 1)
        this.clearEngravingOverride(c.slur.id) // auto-reset (§3.3): endpoint unrecoverable on rebar → slur dropped
        continue
      }
      c.slur.startNoteId = newStart
      c.slur.endNoteId = newEnd
    }
  }

  /**
   * Drop any slur referencing a note id no longer present in the score (defensive belt
   * to {@link restoreSlurs}: a slur must never point at a missing note, or rendering /
   * endpoint editing would hit a hole). Mirrors {@link repairDanglingTies}.
   */
  private repairDanglingSlurs(): void {
    const slurs = this.score.slurs
    if (!slurs || slurs.length === 0) return
    const ids = new Set<string>()
    for (const m of this.score.measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
        else ids.add(s.id)
      }
    }
    for (let i = slurs.length - 1; i >= 0; i--) {
      if (!ids.has(slurs[i].startNoteId) || !ids.has(slurs[i].endNoteId)) {
        const [dropped] = slurs.splice(i, 1)
        this.clearEngravingOverride(dropped.id) // auto-reset (§3.3): slur points at a missing note → dropped
      }
    }
  }

  /**
   * Wipe a measure's slots/tuplets and beat-anchored annotations ahead of a rebar
   * materialise. Called ONCE per region measure (clears ALL voices) before any
   * voice's plan is materialised — see {@link materializeRegion}.
   */
  private clearMeasureForRebar(measure: Measure): void {
    measure.slots = []
    measure.tuplets = []
    delete measure.clefs // mid-bar clefs anchored to moved beats are dropped (Phase 8 limitation)
    delete measure.dynamics // dynamics share the clef limitation: beat anchors don't survive a rebar
  }

  /**
   * Materialise ONE voice's rebar {@link RebarPiece} plan into a measure
   * ADDITIVELY — does NOT wipe the measure (call {@link clearMeasureForRebar} once
   * per measure first). Each created chord/rest is tagged with `voice`; voice 0
   * stays stored as `undefined` (data-model invariant — see {@link pushRestSlot}).
   */
  private materializeVoiceBar(
    measure: Measure,
    plan: RebarPiece[],
    voice: number,
    created: Array<{ piece: RebarPiece; chord: Chord }>,
  ): void {
    for (const piece of plan) {
      if (piece.atomic && piece.payload) {
        // Tuplet: structuredClone preserves the source slot's voice — no voice arg.
        this.materializeAtomicPiece(measure, piece)
        continue
      }
      if (piece.isRest) {
        this.pushRestSlot(
          measure,
          { beat: piece.beat, duration: piece.duration, dots: piece.dots, isMeasureRest: piece.isMeasureRest },
          voice,
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
      if (voice) chord.voice = voice as 0 | 1 | 2 | 3
      if (piece.dots) chord.dots = piece.dots
      if (piece.stemDirection) chord.stemDirection = piece.stemDirection
      if (piece.articulations) chord.articulations = piece.articulations
      if (piece.articulationPlacement) chord.articulationPlacement = piece.articulationPlacement
      measure.slots.push(chord)
      created.push({ piece, chord })
    }

    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  }

  /**
   * Materialise a whole region from a per-voice plan map — the shared additive
   * core behind both {@link rebarRegion} and {@link pasteEvents}. Steps (plan
   * Phase 1 §4–7):
   *   1. clear every region measure once (all voices),
   *   2. materialise each voice additively with a PER-VOICE tie chain
   *      ({@link linkRebarTies} must not bridge voices),
   *   3. voice-0 safety rest-fill for any grown bars,
   *   4. collapse rests-only secondary voices.
   * Returns every created chord piece (across all voices) for caller-side use
   * (e.g. paste needs the voice-0 pieces to report pasted ids).
   */
  private materializeRegion(
    regionNumbers: number[],
    plans: Map<number, BarPlan[]>,
  ): Array<{ piece: RebarPiece; chord: Chord }> {
    for (const num of regionNumbers) {
      const m = this.getMeasure(num)
      if (m) this.clearMeasureForRebar(m)
    }

    const allCreated: Array<{ piece: RebarPiece; chord: Chord }> = []
    for (const [voice, plan] of plans) {
      const created: Array<{ piece: RebarPiece; chord: Chord }> = []
      for (let i = 0; i < plan.length; i++) {
        const m = this.getMeasure(regionNumbers[i])
        if (m) this.materializeVoiceBar(m, plan[i], voice, created)
      }
      this.linkRebarTies(created) // per-voice chain only
      allCreated.push(...created)
    }

    for (const num of regionNumbers) {
      const m = this.getMeasure(num)
      if (m) this.fillGapsWithRests(m) // adds the missing voice-0 rest in grown bars
      this.collapseEmptyVoices(num) // drop a secondary voice that re-laid to all-rests
    }

    return allCreated
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
    return toFlatNote(chord, pitch)
  }

  /** Assemble a flat Note from a Rest. */
  private restToFlatNote(rest: Rest): Note {
    return restToFlatNote(rest)
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
      console.log(`[Model.addNote] add REST ${fmtSlot(rest)} → m${measure.number} now ${measure.slots.length} slot(s)`)
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
      console.log(`[Model.addNote] add pitch ${params.step}${alterMarks(params.alter ?? 0)}${params.octave} → existing chord ${fmtSlot(existingChord)} (now ${existingChord.notes.length} note(s))`)
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
      articulationPlacement: params.articulationPlacement,
      beam: params.beam === 'auto' ? undefined : params.beam,
      notes: [notePitch],
    }
    if (params.voice) chord.voice = params.voice
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)

    console.log(`[Model.addNote] new chord ${fmtSlot(chord)} → replacing same-voice rests`)
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
          console.log(`[Model.replaceRests] remove overlapping ${fmtSlot(existing)} (same voice v${chordVoice} as new chord)`)
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
   * Fill `beats` of empty space starting at `fromBeat` with plain rests, walking the
   * beat cursor forward one split-duration piece at a time. The legacy float splitter
   * (not meter-aware) — used by the overflow/duration-change paths that already work
   * in float beats. For meter-correct regrouping prefer {@link fillMeasureGaps}.
   */
  fillGapWithRests(measureNumber: number, fromBeat: Fraction, beats: number, voice: number = 0): void {
    console.log(`[Model.fillGapWithRests] m${measureNumber} v${voice} from b${fracToNumber(fromBeat).toFixed(3)} for ${beats.toFixed(3)}b → [${splitBeatsIntoDurations(beats).join(', ')}]`)
    let currentBeat = fromBeat
    for (const restDuration of splitBeatsIntoDurations(beats)) {
      this.addRest(restDuration, measureNumber, currentBeat, voice)
      currentBeat = fracAdd(currentBeat, durationToFraction(restDuration))
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
    const barEnd = measureCapacityFrac(measure)
    const tuplets = measure.tuplets || []

    // Distinct voices present (always include voice 0 so an empty bar fills).
    const voices = new Set<number>([0])
    for (const slot of measure.slots) voices.add(slot.voice ?? 0)

    // The measure header is logged lazily — only once, and only if some voice
    // actually has a gap to fill. A bar with nothing to do stays silent.
    let headerLogged = false
    const logHeaderOnce = () => {
      if (headerLogged) return
      headerLogged = true
      console.log(`[Model.fillGaps] m${measure.number} barLen=${fracToNumber(barEnd).toFixed(3)} TS=${measure.timeSignature.numerator}/${measure.timeSignature.denominator} voices=[${[...voices].join(',')}]`)
    }

    for (const voice of voices) {
      const voiceSlots = measure.slots
        .filter(slot => (slot.voice ?? 0) === voice)
        .sort((a, b) => fracCompare(a.beat, b.beat))

      // Only this voice's tuplets may govern its gaps. A tuplet's voice is
      // derived from its member slots (a tuplet is a single-voice run), so a
      // voice-0 triplet must not block the rest-fill of an empty voice-1 bar.
      const voiceTuplets = tuplets.filter(tuplet => {
        const slot = measure.slots.find(s => s.tupletId === tuplet.id)
        return (slot?.voice ?? 0) === voice
      })

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
        for (const tuplet of voiceTuplets) {
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

      // Only log a voice that actually has gaps — "gaps=none" lines are pure noise.
      if (filteredGaps.length) {
        logHeaderOnce()
        const gapStr = filteredGaps.map(g => `[${fracToNumber(g.start).toFixed(3)}→${fracToNumber(g.end).toFixed(3)}]`).join(' ')
        console.log(`[Model.fillGaps]   v${voice}: ${voiceSlots.length} existing slot(s), gaps=${gapStr}`)
      }

      for (const gap of filteredGaps) {
        let adjustedEnd = gap.end
        // Trim a gap that runs into a later tuplet so fillRests never spans one.
        for (const tuplet of voiceTuplets) {
          if (fracGt(tuplet.startBeat, gap.start) && fracLt(tuplet.startBeat, adjustedEnd)) {
            adjustedEnd = tuplet.startBeat
          }
        }
        if (fracLte(adjustedEnd, gap.start)) continue

        for (const rest of fillRests(gap.start, adjustedEnd, meter)) {
          this.pushRestSlot(measure, rest, voice)
          const dots = rest.dots ? '.'.repeat(rest.dots) : ''
          console.log(`[Model.fillGaps]     fill v${voice} REST ${rest.duration}${dots} @b${fracToNumber(rest.beat).toFixed(3)}${rest.isMeasureRest ? ' [measure-rest]' : ''}`)
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
  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction, voice: number = 0): Note {
    return this.addNote({
      duration,
      measure,
      beat,
      isRest: true,
      ...(voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}),
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
   * Flip the side (above/below) of the articulations on the slot containing
   * `noteId`. The first flip resolves the current auto side (stem-derived, the
   * default) and stores the opposite; a further flip toggles back. No-op for
   * rests or slots without articulations. Returns the flat note, or null.
   */
  flipArticulationPlacement(noteId: string): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found
    if (!chord.articulations?.length) return null
    // Sibelius-style `x` toggle: auto ↔ flipped (mirrors flipTuplet/flipSlur/flipTie).
    // An explicit override returns to the context-aware auto default; an auto mark pins
    // the opposite of the side it's currently drawn on, so the first press always visibly
    // flips and two presses round-trip back to auto. Crucially this lets a mark that was
    // flipped-and-flipped-back follow the voice-aware default again when a 2nd voice is
    // later added (the old absolute flip pinned a side forever).
    if (chord.articulationPlacement !== undefined) {
      delete chord.articulationPlacement
    } else {
      chord.articulationPlacement = this.autoArticulationPlacement(chord) === 'above' ? 'below' : 'above'
    }
    return this.toFlatNote(chord, pitch)
  }

  /** The raw NotePitch behind a note id (chord head only; rests have no pitch). */
  getNotePitch(noteId: string): NotePitch | null {
    const found = this.findSlot(noteId)
    return found && found.type === 'chord' ? found.pitch : null
  }

  /** Set the explicit tie-curve direction (-1 up / +1 down) on the tie starting at
   *  `fromNoteId`. No-op (returns false) if the id isn't a chord head with a tie. */
  setTieDirection(fromNoteId: string, direction: -1 | 1): boolean {
    const found = this.findSlot(fromNoteId)
    if (!found || found.type === 'rest' || !found.pitch.tiedTo) return false
    found.pitch.tieDirection = direction
    return true
  }

  /** Remove any explicit tie-curve override on `fromNoteId` (revert to auto). */
  clearTieDirection(fromNoteId: string): void {
    const found = this.findSlot(fromNoteId)
    if (found && found.type === 'chord') delete found.pitch.tieDirection
  }

  /** The side articulations land on by default, mirroring NoteBuilder's auto rule:
   *  - multi-voice measure: the voice's OUTER side — upper voice (0) ABOVE, any lower
   *    voice BELOW — regardless of stem, so the two voices' marks never collide.
   *  - single voice: opposite the stem (the note-head side). */
  private autoArticulationPlacement(chord: Chord): 'above' | 'below' {
    const measure = this.getMeasure(chord.measure)
    const multiVoice = measure ? new Set(measure.slots.map(s => s.voice ?? 0)).size > 1 : false
    if (multiVoice) return (chord.voice ?? 0) === 0 ? 'above' : 'below'
    return this.resolveStemDirection(chord) === 'up' ? 'below' : 'above'
  }

  /** Resolve a chord's effective stem direction, mirroring the renderer: an explicit
   *  override wins; otherwise the note furthest from the clef's middle line decides. */
  private resolveStemDirection(chord: Chord): 'up' | 'down' {
    if (chord.stemDirection === 'up') return 'up'
    if (chord.stemDirection === 'down') return 'down'
    const clef = this.getEffectiveClefAt(chord.measure, chord.beat)
    const middle = middleLineDiatonicPos(clef)
    let maxDist = 0
    let dir: 'up' | 'down' = 'down' // middle-line notes follow this convention
    for (const p of chord.notes) {
      const dPos = spellingDiatonicPos(p.step, p.octave)
      const dist = Math.abs(dPos - middle)
      if (dist > maxDist) {
        maxDist = dist
        dir = dPos >= middle ? 'down' : 'up'
      }
    }
    return dir
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

    const before = found.type === 'rest' ? found.rest : found.chord
    const changed = Object.keys(updates).filter(k => updates[k as keyof NoteParams] !== undefined || k in updates)
    console.log(`[Model.updateNote] ${fmtSlot(before)} ← {${changed.join(', ')}}`, updates)

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
          voice: rest.voice,  // a rest converted to a note keeps its voice
          tupletId: updates.tupletId ?? rest.tupletId,
          actualDuration: rest.actualDuration,
          articulations: updates.articulations,
          articulationPlacement: updates.articulationPlacement,
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
    if ('articulationPlacement' in updates) chord.articulationPlacement = updates.articulationPlacement

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
          console.log(`[Model.deleteNote] delete ${fmtSlot(rest)} → m${measure.number} now ${measure.slots.length - 1} slot(s)`)
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
          console.log(`[Model.deleteNote] delete whole chord ${fmtSlot(chord)} → m${measure.number} now ${measure.slots.length - 1} slot(s)`)
          measure.slots.splice(idx, 1)
        } else {
          // Remove just this pitch from the chord
          console.log(`[Model.deleteNote] delete pitch ${pitch.step}${alterMarks(pitch.alter)}${pitch.octave} from chord ${fmtSlot(chord)} (now ${chord.notes.length - 1} note(s))`)
          chord.notes = chord.notes.filter(n => n.id !== pitch.id)
        }
        return true
      }
    }
    return false
  }

  /**
   * Drop any secondary voice (model voice ≠ 0) in a measure that has no notes left
   * — only rests — so the bar reverts to a single stream. Voice 0 is the primary
   * stream and is never collapsed (an empty bar stays one voice of rests). Called
   * after deletions; a no-op for single-voice bars.
   */
  collapseEmptyVoices(measureNumber: number): void {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return

    const secondaryVoices = new Set<number>()
    for (const slot of measure.slots) {
      const v = slot.voice ?? 0
      if (v !== 0) secondaryVoices.add(v)
    }

    for (const voice of secondaryVoices) {
      const hasNote = measure.slots.some(s => (s.voice ?? 0) === voice && s.type === 'chord')
      if (!hasNote) {
        measure.slots = measure.slots.filter(s => (s.voice ?? 0) !== voice)
      }
    }
  }

  /**
   * Move a single plain note's pitch into another voice, **preserving its
   * `pitch.id`** so ties/slurs/articulations/selection all stay anchored to it
   * (see the move-note-to-voice plan §2 — choice B, mutate in place). The source
   * voice closes its gap with rests (and collapses if it was a now-empty
   * secondary voice); the target voice opens to receive the note.
   *
   * Plain (non-tuplet) notes only — a tuplet member returns false and is left for
   * the tuplet path (plan Phase 4). Rests and unknown ids are ignored.
   *
   * @returns true if the note actually moved.
   */
  moveNoteToVoice(pitchId: string, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
    const found = this.findSlot(pitchId)
    if (!found || found.type !== 'chord') return false // rests / unknown ids ignored

    const { chord, pitch } = found
    const from = chord.voice ?? 0
    if (from === targetVoice) return false // no-op: already in the target voice

    const measure = this.getMeasure(chord.measure)
    if (!measure) return false

    // Tuplet member → the ordinal-fill tuplet path (creates a matching tuplet in
    // the target voice). Plain notes continue below.
    if (chord.tupletId) {
      return this.moveTupletNoteToVoice(measure, chord, pitch, targetVoice, movingIds)
    }

    console.log(`[Model.moveNoteToVoice] ${pitch.step}${alterMarks(pitch.alter)}${pitch.octave} (id ${pitch.id.slice(0, 8)}) v${from}→v${targetVoice} @ m${chord.measure} b${fracToNumber(chord.beat).toFixed(3)}`)

    // Capture the pitch payload before mutating anything (reuse the SAME id).
    const payload = {
      id: pitch.id,
      step: pitch.step,
      alter: pitch.alter,
      octave: pitch.octave,
      forceAccidental: pitch.forceAccidental,
      tiedTo: pitch.tiedTo,
      tiedFrom: pitch.tiedFrom,
      tieDirection: pitch.tieDirection,
      duration: chord.duration,
      dots: chord.dots,
      beat: chord.beat,
      voice: targetVoice,
    }

    // Remove the pitch from the source slot.
    let removedWholeSlot = false
    if (chord.notes.length > 1) {
      // One pitch of a chord leaves; the chord (and the beat it holds) stays.
      chord.notes = chord.notes.filter(n => n.id !== pitch.id)
    } else {
      // Last/only pitch — remove the whole slot; the source voice now has a gap.
      measure.slots = measure.slots.filter(s => s.id !== chord.id)
      removedWholeSlot = true
    }

    // Insert into the target voice (merges into a same-beat chord, or makes a new
    // one and clears the target-voice rest there). Reuses the captured id.
    this.insertPitch(measure, payload)

    // A tie whose partner stayed behind would now span two voices — drop it (plan
    // §5). A partner that's also moving in this batch (movingIds) is kept: it will
    // land in the same target voice, so the tie survives.
    this.dropCrossVoiceTies(pitch.id, targetVoice, movingIds)

    // Repair the source voice if removing a whole slot left a gap, THEN collapse
    // an emptied secondary voice (order matters — plan Phase 1 step 8).
    if (removedWholeSlot) {
      this.fillGapsWithRests(measure)
      this.collapseEmptyVoices(measure.number)
    }

    // Keep any slur's stored voice in sync with its (now-moved) anchors.
    this.resyncSlurVoiceForPitch(pitch.id)

    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
    return true
  }

  /**
   * Insert a pitch into a measure at a given beat/voice, **reusing the supplied
   * `pitch.id`** (unlike {@link addNote}, which always mints a fresh uuid). Mirrors
   * addNote's two branches: merge into a same-beat/same-voice chord, or build a
   * new chord and clear the target-voice rest via {@link replaceRestsWithChord}.
   * Used by {@link moveNoteToVoice} so a moved note keeps its anchored ties/slurs.
   */
  private insertPitch(
    measure: Measure,
    payload: {
      id: string
      step: PitchStep
      alter: PitchAlter
      octave: number
      forceAccidental?: boolean
      tiedTo?: string
      tiedFrom?: string
      tieDirection?: -1 | 1
      duration: NoteDuration
      dots?: number
      beat: Fraction
      voice: number
    },
  ): void {
    const notePitch: NotePitch = {
      id: payload.id,
      step: payload.step,
      alter: payload.alter,
      octave: payload.octave,
      forceAccidental: payload.forceAccidental,
      tiedTo: payload.tiedTo,
      tiedFrom: payload.tiedFrom,
      tieDirection: payload.tieDirection,
    }
    const targetVoice = payload.voice

    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, payload.beat) && (s.voice ?? 0) === targetVoice,
    )

    if (existingChord) {
      // Merge into the existing chord (collision). If neither side is a tuplet and
      // the durations differ, the SHORTER duration wins (plan §0.2 / Phase 2): the
      // merged chord takes the smaller duration and fillGapsWithRests reclaims the
      // freed time in this voice. A longer incoming note is simply cramped in.
      existingChord.notes.push(notePitch)
      if (!existingChord.tupletId) {
        const incomingFrac = durationToFraction(payload.duration, payload.dots ?? 0)
        const existingFrac = durationToFraction(existingChord.duration, existingChord.dots ?? 0)
        if (fracCompare(incomingFrac, existingFrac) < 0) {
          existingChord.duration = payload.duration
          existingChord.dots = payload.dots
          existingChord.actualDuration = this.computeActualDurationForSlot(existingChord, measure)
          this.fillGapsWithRests(measure) // reclaim the freed time as rests
        }
      }
      console.log(`[Model.insertPitch] merge ${notePitch.step}${alterMarks(notePitch.alter)}${notePitch.octave} → chord ${fmtSlot(existingChord)} (now ${existingChord.notes.length} note(s), dur ${existingChord.duration})`)
      return
    }

    // No chord at this beat/voice — build one and clear the target-voice rest.
    const chord: Chord = {
      id: uuidv4(),
      type: 'chord',
      beat: payload.beat,
      duration: payload.duration,
      dots: payload.dots,
      measure: measure.number,
      notes: [notePitch],
    }
    if (targetVoice) chord.voice = targetVoice as 0 | 1 | 2 | 3
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)
    console.log(`[Model.insertPitch] new chord ${fmtSlot(chord)} → replacing v${targetVoice} rests`)
    this.replaceRestsWithChord(measure, chord)
  }

  /**
   * After a pitch changes voice, clear any tie whose partner is NOT in the same
   * voice (a tie spanning two voices is invalid). Clears both reciprocal sides.
   * A partner whose id is in `movingIds` is kept — it is moving to the same target
   * voice in this batch, so the tie survives (plan §5: ties whose both endpoints
   * land in the same target voice survive).
   */
  private dropCrossVoiceTies(pitchId: string, voice: number, movingIds?: ReadonlySet<string>): void {
    const found = this.findSlot(pitchId)
    if (!found || found.type !== 'chord') return
    const pitch = found.pitch

    if (pitch.tiedTo) {
      const partner = this.findSlot(pitch.tiedTo)
      const partnerVoice =
        partner?.type === 'chord' ? (partner.chord.voice ?? 0)
        : partner?.type === 'rest' ? (partner.rest.voice ?? 0)
        : undefined
      if (partnerVoice !== voice && !movingIds?.has(pitch.tiedTo)) {
        if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
        else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
        pitch.tiedTo = undefined
        console.log(`[Model.dropCrossVoiceTies] dropped tiedTo (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
      }
    }
    if (pitch.tiedFrom) {
      const partner = this.findSlot(pitch.tiedFrom)
      // A tie's source is always a chord pitch (a rest can't start a tie).
      const partnerVoice = partner?.type === 'chord' ? (partner.chord.voice ?? 0) : undefined
      if (partnerVoice !== voice && !movingIds?.has(pitch.tiedFrom)) {
        if (partner?.type === 'chord') partner.pitch.tiedTo = undefined
        pitch.tiedFrom = undefined
        console.log(`[Model.dropCrossVoiceTies] dropped tiedFrom (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
      }
    }
  }

  /**
   * Keep a slur's stored `voice` field in sync with its anchors after a move. If
   * both endpoints now sit in the same voice, adopt it (so JSON export and the
   * renderer's fallback path agree with what's drawn — direction/colour already
   * derive from the live start-note voice). A slur left spanning two voices keeps
   * its old field (ambiguous; nothing to reassign).
   */
  private resyncSlurVoiceForPitch(pitchId: string): void {
    for (const slur of this.score.slurs ?? []) {
      if (slur.startNoteId !== pitchId && slur.endNoteId !== pitchId) continue
      const start = this.findSlot(slur.startNoteId)
      const end = this.findSlot(slur.endNoteId)
      const sv = start?.type === 'chord' ? (start.chord.voice ?? 0) : undefined
      const ev = end?.type === 'chord' ? (end.chord.voice ?? 0) : undefined
      if (sv !== undefined && sv === ev && (slur.voice ?? 0) !== sv) {
        console.log(`[Model.resyncSlurVoice] slur ${slur.id.slice(0, 8)} voice ${slur.voice ?? 0}→${sv}`)
        slur.voice = sv as 0 | 1 | 2 | 3
      }
    }
  }

  /**
   * Move a tuplet member into another voice — the "ordinal fill" rule
   * (move-note-to-voice plan, Phase 4). A matching tuplet is created in the target
   * voice over the SAME span; the moved note lands in its own relative slot; any
   * notes the target voice already had in that span are poured into the remaining
   * slots left-to-right (empty → tuplet rests, overflow → dropped, a collision on
   * the moved note's own slot → chorded). The source tuplet's gap is refilled (and
   * the tuplet dropped if it ends up all rests). Ids are preserved throughout.
   */
  private moveTupletNoteToVoice(measure: Measure, chord: Chord, pitch: NotePitch, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
    const sourceTuplet = measure.tuplets?.find(t => t.id === chord.tupletId)
    if (!sourceTuplet) return false // defensive: tupletId with no tuplet record

    const from = chord.voice ?? 0
    const { startBeat, baseDuration, numNotes, notesOccupied } = sourceTuplet
    // Slot spacing is the ACTUAL (scaled) duration, not the written baseDuration.
    const slot = getTupletNoteDurationFrac(baseDuration, numNotes, notesOccupied)
    const span = getTupletTotalBeatsFrac(baseDuration, notesOccupied)
    const spanEnd = fracAdd(startBeat, span)

    // Relative slot index of the moved note within the tuplet grid.
    const rawIdx = Math.round(fracToNumber(fracSub(chord.beat, startBeat)) / fracToNumber(slot))
    const idx = rawIdx >= 0 && rawIdx < numNotes ? rawIdx : 0

    console.log(`[Model.moveTupletNoteToVoice] ${pitch.step}${alterMarks(pitch.alter)}${pitch.octave} slot ${idx}/${numNotes} v${from}→v${targetVoice} @ m${measure.number} tuplet b${fracToNumber(startBeat).toFixed(3)}`)

    // The moved pitch, reusing its id (tie/slur/selection anchor).
    const movedPitch: NotePitch = {
      id: pitch.id,
      step: pitch.step,
      alter: pitch.alter,
      octave: pitch.octave,
      forceAccidental: pitch.forceAccidental,
      tiedTo: pitch.tiedTo,
      tiedFrom: pitch.tiedFrom,
      tieDirection: pitch.tieDirection,
    }

    // Capture the target voice's existing notes in the span BEFORE createTuplet
    // wipes them, keeping each chord's beat. Each existing CHORD slot is one unit
    // (keeps its pitches + ids), ordered left-to-right; durations are discarded
    // (the tuplet wins). The beat lets us tell a note already sitting on a grid
    // slot (it KEEPS that slot) from a loose note (ordinal pour).
    const existing = measure.slots
      .filter((s): s is Chord => s.type === 'chord' && (s.voice ?? 0) === targetVoice
        && fracGte(s.beat, startBeat) && fracLt(s.beat, spanEnd))
      .sort((a, b) => fracCompare(a.beat, b.beat))
      .map(c => ({ beat: c.beat, notes: c.notes }))

    // Remove the moved pitch from the source slot.
    let removedSourceSlot = false
    if (chord.notes.length > 1) {
      chord.notes = chord.notes.filter(n => n.id !== pitch.id)
    } else {
      measure.slots = measure.slots.filter(s => s.id !== chord.id)
      removedSourceSlot = true
    }

    // Create the matching tuplet in the target voice (clears its span there).
    const targetTuplet = this.createTuplet(measure.number, startBeat, baseDuration, numNotes, notesOccupied, targetVoice)

    // Which grid slot a beat lands on exactly (−1 if it's between slots).
    const gridIndexOf = (beat: Fraction): number => {
      for (let g = 0; g < numNotes; g++) {
        if (fracEq(fracAdd(startBeat, fracMul(slot, fracCreate(g, 1))), beat)) return g
      }
      return -1
    }

    // Ordinal-fill assignment. The moved note takes its slot; an existing note
    // already on a grid slot KEEPS it (chord on collision); loose notes pour into
    // the remaining free slots in order, overflow dropped.
    const assignment: (NotePitch[] | undefined)[] = new Array(numNotes).fill(undefined)
    const placeAt = (g: number, pitches: NotePitch[]) => {
      assignment[g] = assignment[g] ? [...assignment[g]!, ...pitches] : pitches
    }
    placeAt(idx, [movedPitch])
    const loose: NotePitch[][] = []
    for (const e of existing) {
      const g = gridIndexOf(e.beat)
      if (g >= 0) placeAt(g, e.notes) // grid-aligned → keep its own slot
      else loose.push(e.notes)        // loose → ordinal pour below
    }
    let k = 0
    for (const pitches of loose) {
      while (k < numNotes && assignment[k] !== undefined) k++
      if (k >= numNotes) break // overflow — drop the rest
      assignment[k] = pitches
      k++
    }

    // Materialise each occupied grid position as a tuplet chord.
    for (let g = 0; g < numNotes; g++) {
      const pitches = assignment[g]
      if (!pitches || pitches.length === 0) continue
      const beatG = fracAdd(startBeat, fracMul(slot, fracCreate(g, 1)))
      const newChord: Chord = {
        id: uuidv4(),
        type: 'chord',
        beat: beatG,
        duration: baseDuration,
        measure: measure.number,
        tupletId: targetTuplet.id,
        actualDuration: slot,
        notes: pitches,
      }
      if (targetVoice) newChord.voice = targetVoice as 0 | 1 | 2 | 3
      measure.slots.push(newChord)
    }

    // Fill the target tuplet's empty slots with tuplet rests.
    this.refillTupletRemainder(measure.number, targetTuplet, targetVoice)

    // Drop any tie of the moved note that would now span two voices (a co-moving
    // partner in movingIds is kept — it lands in the same target voice).
    this.dropCrossVoiceTies(pitch.id, targetVoice, movingIds)

    // Source side: close the source tuplet's gap; drop it if now all rests.
    if (removedSourceSlot) {
      this.refillTupletRemainder(measure.number, sourceTuplet, from)
      const sourceHasNote = measure.slots.some(s => s.tupletId === sourceTuplet.id && s.type === 'chord')
      if (!sourceHasNote) {
        tupletOps.deleteTuplet(this.score, sourceTuplet.id, m => this.fillGapsWithRests(m))
      }
    }

    // Fill any remaining per-voice gaps (e.g. a brand-new target voice's bar
    // outside the tuplet span), collapse an emptied secondary voice, and prune
    // any tuplet left with no member slots.
    this.fillGapsWithRests(measure)
    this.collapseEmptyVoices(measure.number)
    if (measure.tuplets) {
      measure.tuplets = measure.tuplets.filter(t => measure.slots.some(s => s.tupletId === t.id))
    }

    // Keep any slur's stored voice in sync with its (now-moved) anchors.
    this.resyncSlurVoiceForPitch(pitch.id)

    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
    return true
  }

  /**
   * Dev/test invariant checker for a measure: each voice present must tile
   * `[0, capacity)` exactly — contiguous slots, no gaps/overlaps, summing to the
   * bar length. Returns a list of human-readable problems (empty = healthy). Used
   * by tests after voice/tuplet moves to catch half-formed bars before render
   * (a malformed tuplet bar has crashed VexFlow before).
   */
  validateMeasure(measureNumber: number): string[] {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return [`measure ${measureNumber} missing`]
    const problems: string[] = []
    const cap = measureCapacityFrac(measure)
    const voices = new Set<number>([0])
    for (const s of measure.slots) voices.add(s.voice ?? 0)
    for (const voice of voices) {
      const vs = measure.slots
        .filter(s => (s.voice ?? 0) === voice)
        .sort((a, b) => fracCompare(a.beat, b.beat))
      if (vs.length === 0) continue
      let cursor = fracCreate(0, 1)
      for (const s of vs) {
        if (!fracEq(s.beat, cursor)) {
          problems.push(`v${voice}: slot at b${fracToNumber(s.beat).toFixed(3)} expected b${fracToNumber(cursor).toFixed(3)} (gap/overlap)`)
        }
        const dur = s.actualDuration ?? durationToFraction(s.duration, s.dots ?? 0)
        cursor = fracAdd(s.beat, dur)
      }
      if (!fracEq(cursor, cap)) {
        problems.push(`v${voice}: sums to ${fracToNumber(cursor).toFixed(3)}, expected ${fracToNumber(cap).toFixed(3)}`)
      }
    }
    return problems
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
    voice: number = 0,
  ): Tuplet {
    return tupletOps.createTuplet(this.score, measureNumber, startBeat, baseDuration, numNotes, notesOccupied, voice)
  }

  /**
   * Get a tuplet by its ID
   */
  getTuplet(tupletId: string): Tuplet | undefined {
    return tupletOps.getTuplet(this.score, tupletId)
  }

  /**
   * Set (or clear) a tuplet's explicit bracket/number placement override.
   */
  setTupletPlacement(tupletId: string, placement: 'above' | 'below' | undefined): boolean {
    return tupletOps.setTupletPlacement(this.score, tupletId, placement)
  }

  /**
   * Get the tuplet at a specific beat position in a measure
   */
  getTupletAtBeat(measureNumber: number, beat: Fraction, voice?: number): Tuplet | undefined {
    return tupletOps.getTupletAtBeat(this.score, measureNumber, beat, voice)
  }

  /**
   * True if a same-voice tuplet already overlaps the span starting at `startBeat`.
   * See {@link tupletOps.tupletSpanOverlaps}.
   */
  tupletSpanOverlaps(measureNumber: number, startBeat: Fraction, totalBeats: Fraction, voice: number): boolean {
    return tupletOps.tupletSpanOverlaps(this.score, measureNumber, startBeat, totalBeats, voice)
  }

  /**
   * Get all notes that belong to a specific tuplet (as flat Notes)
   */
  getNotesInTuplet(tupletId: string): Note[] {
    return tupletOps.getNotesInTuplet(this.score, tupletId)
  }

  /**
   * Fill any empty gaps in a tuplet with filler rests. See {@link tupletOps.refillTupletRemainder}.
   */
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet, voice: number = 0): void {
    tupletOps.refillTupletRemainder(this.score, measureNumber, tuplet, params => this.addNote(params), voice)
  }

  /**
   * Delete a tuplet and replace it with an appropriate rest
   */
  deleteTuplet(tupletId: string): boolean {
    return tupletOps.deleteTuplet(this.score, tupletId, measure => this.fillGapsWithRests(measure))
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

    // Forward-migrate the pre-Phase-1 inline `Slur.cps` (pixels) into the
    // engraving-overrides compartment (staff-spaces). No-op for new-format scores.
    migrateLegacySlurCps(scoreData)

    // actualDuration is derived state — recompute it rather than trust the wire.
    // The helper handles measure rests (whole-bar length) in every meter.
    for (const measure of model.score.measures) {
      for (const slot of measure.slots ?? []) {
        slot.actualDuration = model.computeActualDurationForSlot(slot, measure)
      }
    }

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
