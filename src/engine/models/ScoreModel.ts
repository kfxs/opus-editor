import { dbg } from '@/utils/debug'
import { isTestRun } from '@/utils/env'
import type { Score, Measure, Note, NoteParams, TimeSignature, Tuplet, TupletFormat, NoteDuration, BeamMode, ChordRest, Chord, Rest, NotePitch, PitchAlter, PitchStep, Clef, Dynamic, TempoMark, Slur, StaffInfo, StaffGroup, EngravingOverride, CurveControlPointDeltas, CurveShapeOverride, SegmentCurveShapeOverride, SlurEndpointOffsetOverride, SegmentEndpointOffsetOverride, SlurSegmentAddress, SlurSegmentEndpointAddress, RestShiftOverride, RestHiddenOverride, StaffSpacingOverride, DynamicOffsetOverride, NoteOffsetOverride, LeadingSpaceOverride, BarWidthOverride, CautionaryOverride, CautionaryClefOverride, TremoloMark, FanMark } from '@/types/music'
import { engravingOverridesOf, engravingOverrideOf, migrateLegacySlurCps, restShiftOverrideOf, restHiddenOf, staffSpacingOverrideOf, dynamicOffsetOverrideOf, noteOffsetOverrideOf, cautionaryKey, cautionaryAllowedOf, cautionaryClefKey, cautionaryClefAllowedOf, BAR_STRETCH_MIN, BAR_STRETCH_MAX } from './engravingOverrides'
import {
  tupletSpan,
  tupletSlotDuration,
  tupletScale,
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
import { beamRoleAtRef, type BeamRole } from '@/utils/beaming'
import { laneOfSlot, pairAcceptsJoined, pairIsValid } from '@/utils/tremoloPair'
import { normalizeFan, cloneFanFresh, fanMemberPitches, fanMemberBeats } from '@/utils/fannedBeam'
import { spellingDiatonicPos, alterToString } from '@/utils/pitchSpelling'
import { type RebarEvent } from '@/utils/rebar'
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
import * as rebarOps from './rebarOps'
import { toFlatNote, restToFlatNote } from './noteProjection'
import { staffIndexOfId, matchesStaff, staffIdAtIndex, firstStaffId } from './staffContent'
import * as tupletOps from './tupletOps'
import { measureDynamics, resolveActiveLevel } from '@/utils/dynamics'
import { tempoMarks, effectiveTempoAt, MIN_BPM, MAX_BPM } from '@/utils/tempoMap'
import { v4 as uuidv4 } from 'uuid'

// The region-rewrite machinery (rebar / paste) and its captured-state types now live in
// ./rebarOps. Re-export the two clipboard input types so callers (MusicEngine) keep their
// `import … from './models/ScoreModel'` path.
export type { ClipDynamicInput, ClipSlurInput } from './rebarOps'


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
  const pitches = slot.notes.map(n => `${n.step}${alterToString(n.alter)}${n.octave}`).join('+')
  return `v${v} ${pitches} ${slot.duration}${dots} m${slot.measure} b${b}${tup}`
}

/**
 * The default title of a freshly created, unnamed model.
 *
 * "Fragment", not "Score": what this model holds is **musical content** — staves, bars,
 * notes — with no page, margins, or print size. A *score* is the finished, engraved result,
 * which is content PLUS those engraving concerns (see docs/instruments-plan.md §1: the
 * finished thing wraps the fragment, never the reverse).
 *
 * The trailing "1" is just part of the default label, NOT a live counter — numbering
 * fragments would mean asking "how many exist?", i.e. ambient global state, which
 * DESIGN-PRINCIPLES §1 forbids (a score is a value, never a singleton). When several
 * fragments can be open at once, whoever OPENS them supplies the number via the `title`
 * argument; the model must never invent it.
 */
export const DEFAULT_FRAGMENT_TITLE = 'Fragment 1'

/**
 * What {@link ScoreModel.updateNote} will write onto a FANNED MEMBER — its spelling, and nothing
 * else. Named so the ignored-field trace can name what it dropped rather than saying "some fields";
 * the rule itself is stated at the branch (docs/fanned-beam-pitches-plan.md §2 P3).
 */
const FAN_MEMBER_UPDATE_FIELDS = new Set(['step', 'alter', 'octave', 'forceAccidental'])

/**
 * True under the unit-test runner (Vitest). It flips the measure-integrity check
 * ({@link ScoreModel.checkMeasuresWellFormed}) from a dev-console `console.error`
 * into a thrown error — so a malformed bar fails the test that produced it instead
 * of passing silently. In the browser (dev or prod) it stays a log: a bad bar is a
 * bug to notice, not a reason to crash the editor out from under the user.
 *
 * The detection itself lives in {@link isTestRun} (`utils/env.ts`) rather than reading
 * `import.meta.env` here — that was the core's last bundler-specific coupling, and a published
 * core package must not reach for a Vite global. It has a test behind it (`utils/env.test.ts`)
 * because a silent `false` would disarm this check across the whole suite with everything green.
 */
const STRICT_INVARIANTS: boolean = isTestRun()

/**
 * ScoreModel manages the musical score data and provides CRUD operations
 * This is the core data model for Developer A's music engine
 */
export class ScoreModel {
  private score: Score

  constructor(title: string = DEFAULT_FRAGMENT_TITLE) {
    this.score = {
      id: uuidv4(),
      title,
      measures: [],
      // The staff axis: one staff by default (N=1). Content carries no explicit
      // `staffId` at N=1 — absent = this staff. See docs/multi-staff-plan.md §4.
      staves: [{ id: uuidv4() }],
    }
    // Initialize with one empty measure
    this.addMeasure()
  }

  /**
   * How long a NEW score is, in bars — what the app tops an empty score up to.
   *
   * A page of empty staves rather than a stub: bars are free (an empty one is a rest and a barline),
   * the viewport culls what is off screen, and having to add measures before you can write is a
   * question the program should not be asking. It lives here, beside the model that mints them,
   * because the number is about the SCORE and not about whoever calls `addMeasure`.
   */
  static readonly DEFAULT_SCORE_MEASURES = 64

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
   * Add a new measure to the END of the score.
   * The measure is automatically filled with rests to match the time signature.
   * Appending is just an insert after the last measure, so this delegates to
   * {@link insertMeasureAfter} (single code path).
   */
  addMeasure(timeSignature?: TimeSignature): Measure {
    return this.insertMeasureAfter(this.score.measures.length, timeSignature)
  }

  /**
   * Add a new staff to the score, above or below the staff at `refStaffIndex` (0-based),
   * and return its stable id. The new staff is rest-filled in **every** measure (treble
   * default — a fresh staff carries no clef change, so it resolves to the universal
   * `'treble'` default; the user re-clefs it afterward) and joins the single staff group (created on the first
   * add, grown thereafter). See docs/multi-staff-plan.md §9.
   *
   * The first staff owns the absent-`staffId` = staff-0 convention, so **inserting at index
   * 0** (prepending above the top staff) first {@link solidifyFirstStaffContent solidifies}
   * the outgoing first staff's untagged content — otherwise `absent = staff 0` would silently
   * re-point every existing note at the freshly inserted (empty) top staff.
   */
  addStaff(refStaffIndex: number, position: 'above' | 'below'): string {
    const staves = [...(this.score.staves ?? [])]
    const ref = Math.max(0, Math.min(refStaffIndex, staves.length - 1))
    const insertAt = position === 'above' ? ref : ref + 1
    if (insertAt === 0) this.solidifyFirstStaffContent()

    const newStaff: StaffInfo = { id: uuidv4() }
    staves.splice(insertAt, 0, newStaff)
    this.score.staves = staves
    this.ensureSingleGroupSpansAllStaves()

    // fillGapsWithRests loops score.staves, so this rest-fills the new (empty) lane in every bar.
    this.repairAllMeasureGaps()
    return newStaff.id
  }

  /** Add a staff immediately ABOVE the staff at `refStaffIndex`. @returns the new staff's id. */
  addStaffAbove(refStaffIndex: number): string {
    return this.addStaff(refStaffIndex, 'above')
  }

  /** Add a staff immediately BELOW the staff at `refStaffIndex`. @returns the new staff's id. */
  addStaffBelow(refStaffIndex: number): string {
    return this.addStaff(refStaffIndex, 'below')
  }

  /**
   * Stamp the current first staff's explicit id onto every piece of content that currently
   * relies on the absent-`staffId` = staff-0 convention (slots, clefs, dynamics, tuplets,
   * across all measures). Called right before a prepend changes which staff is index 0, so
   * the existing music stays anchored to its (now non-first) staff instead of being read as
   * belonging to the newly inserted top staff. A no-op degenerate score (no staves) is skipped.
   */
  private solidifyFirstStaffContent(): void {
    const firstId = firstStaffId(this.score)
    if (firstId === undefined) return
    for (const m of this.score.measures) {
      for (const slot of m.slots) if (slot.staffId === undefined) slot.staffId = firstId
      for (const clef of m.clefs ?? []) if (clef.staffId === undefined) clef.staffId = firstId
      for (const dyn of m.dynamics ?? []) if (dyn.staffId === undefined) dyn.staffId = firstId
      for (const tup of m.tuplets ?? []) if (tup.staffId === undefined) tup.staffId = firstId
    }
  }

  /**
   * Keep the one staff group spanning all staves in top→bottom order. This subsumes both the
   * **0→1 group creation** (the first time a 2nd staff appears there is no group yet — §9) and
   * growing that single group on later adds. Scope this pass is a single group (organ/piano
   * growth); adding a SEPARATE group is a §10 future-open op. A lone staff is not a group, so
   * the overlay is cleared below N=2.
   */
  private ensureSingleGroupSpansAllStaves(): void {
    const staves = this.score.staves ?? []
    if (staves.length < 2) {
      this.score.staffGroups = undefined
      return
    }
    const existing = this.score.staffGroups?.[0]
    const group: StaffGroup = {
      id: existing?.id ?? uuidv4(),
      staffIds: staves.map(s => s.id),
      ...(existing?.symbol ? { symbol: existing.symbol } : {}),
    }
    this.score.staffGroups = [group]
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
   *
   * With no explicit `timeSignature`, the bar inherits the meter in effect at the
   * measure it follows — so a bar added inside a 3/4 region is a 3/4 bar. (An empty
   * score has nothing to inherit from: DEFAULT_TIME_SIGNATURE.)
   */
  insertMeasureAfter(afterNumber: number, timeSignature?: TimeSignature): Measure {
    // Resolved BEFORE the splice below, so `afterNumber` still means the preceding bar.
    const ts = copyTimeSignature(timeSignature ?? effectiveTimeSignature(this.score, afterNumber))
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
  private pushRestSlot(measure: Measure, rest: RestSlot, voice: number, staffId?: string): void {
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
    // Multi-staff: filler rests belong to the staff whose gap they fill. The first staff
    // uses an absent staffId (the N=1 convention), so single-staff output is unchanged.
    if (staffId !== undefined) slot.staffId = staffId
    measure.slots.push(slot)
  }

  /**
   * Clear ONE staff's musical content in a measure back to a single default rest — the
   * Sibelius "select bar + Delete" behaviour. It does NOT remove the bar (that is
   * {@link removeMeasure} / removeMeasureRange, reserved for the Ctrl+Shift box); it drops
   * this staff's notes/rests/tuplets across every voice and refills the whole bar with the
   * DEFAULT rest fill — one measure rest in every meter (see {@link fillMeasureWithRests}),
   * NOT a per-gap recompute of the deleted durations. Other staves are untouched.
   * Beat-anchored dynamics/slurs are the caller's concern (removed via their own ops).
   * @returns true if the measure exists.
   */
  clearMeasureStaff(measureNumber: number, staff: number): boolean {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return false
    const staffId = this.staffIdForParams(staff)
    // Drop every slot/tuplet on this staff (all voices); leave the other staves' content.
    measure.slots = measure.slots.filter(s => !matchesStaff(s.staffId, staffId, this.score))
    if (measure.tuplets) {
      measure.tuplets = measure.tuplets.filter(t => !matchesStaff(t.staffId, staffId, this.score))
    }
    // Refill this staff with the default rest fill (collapses to one measure rest per meter).
    const meter = getMeterInfo(measure.timeSignature)
    const rests = fillRests(fracCreate(0, 1), measureCapacityFrac(measure), meter)
    for (const rest of rests) this.pushRestSlot(measure, rest, 0, staffId)
    return true
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
    // The removed measure's notes are gone, so any tie/slur that referenced them (or
    // crossed its boundary) now points at a missing id — sever/prune them so tie &
    // slur editing/rendering can't hit a hole. (Same sweeps rebar uses.)
    this.repairDanglingTies()
    this.repairDanglingSlurs()
    return true
  }

  // ==================== Clef operations ====================

  /**
   * Resolve the clef in effect at a position (measure, beat) on a staff.
   * Delegates to the shared resolver in utils/clefUtils. Clef is per-staff, so
   * pass the `staffId` — omitting it resolves staff 0 (absent-id convention).
   */
  getEffectiveClefAt(measureNumber: number, beat: Fraction, staffId?: string): Clef {
    return effectiveClefAt(this.score, measureNumber, beat, staffId)
  }

  /** Clef drawn at the start of a measure (its beat-0 change, or inherited) on a staff. */
  getEffectiveClef(measureNumber: number, staffId?: string): Clef {
    return measureOpeningClef(this.score, measureNumber, staffId)
  }

  /**
   * Set/change the clef at (measure, beat). `beat` must already be snapped to a
   * slot boundary by the caller. Clef is per-staff content — there is no
   * document-level clef.
   *
   * The change is normalized uniformly for every staff (including m1 b0): if
   * `clef` equals the clef already in effect immediately before this beat on this
   * staff, no visible change exists, so any change at this beat is removed instead
   * of storing a redundant one. At m1 b0 the inherited-before is the universal
   * `'treble'` default.
   *
   * @returns true if the score changed.
   */
  setClefAt(measureNumber: number, beat: Fraction, clef: Clef, staffId?: string): boolean {
    return clefOps.setClefAt(this.score, measureNumber, beat, clef, staffId)
  }

  /**
   * Remove a clef change at (measure, beat), reverting that position to the
   * inherited clef. Measure 1 / beat 0 (each staff's opening clef) cannot be
   * removed (only changed) — protected on every staff.
   * @returns true if a change was removed.
   */
  removeClefAt(measureNumber: number, beat: Fraction, staffId?: string): boolean {
    return clefOps.removeClefAt(this.score, measureNumber, beat, staffId)
  }

  // --- Measure-level (beat 0) convenience wrappers ---

  /** Set the measure's opening clef (beat 0). */
  setClef(measureNumber: number, clef: Clef, staffId?: string): boolean {
    return this.setClefAt(measureNumber, fracCreate(0, 1), clef, staffId)
  }

  /** Remove the measure's opening clef (beat 0). */
  removeClef(measureNumber: number, staffId?: string): boolean {
    return this.removeClefAt(measureNumber, fracCreate(0, 1), staffId)
  }

  /**
   * Relocate a clef change to a new position, possibly in a different measure.
   * Raw move: no normalization and no undo (the caller records a single undo
   * entry when the drag completes). The dragged clef has authority — if another
   * clef change already sits at the target beat, it is overwritten (removed) so
   * the dragged clef can take that position; this lets a drag pass through other
   * clefs rather than getting stuck. Refuses only a no-op move or landing on
   * measure 1 beat 0 (each staff's protected opening clef).
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
  normalizeClefAt(measureNumber: number, beat: Fraction, staffId?: string): boolean {
    return clefOps.normalizeClefAt(this.score, measureNumber, beat, staffId)
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
      // An engraving override must not outlive its anchor: clear any hand-nudged
      // offset keyed to this dynamic's id, else it orphans in the compartment.
      this.clearEngravingOverride(id)
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

  // ==================== Tempo Mark Operations ====================
  //
  // Mirrors the Dynamic ops above, with two deliberate differences:
  //   - A tempo mark is SYSTEM-level: no staffId, no voice. One list per measure governs
  //     every staff, so the beat alone is the key.
  //   - At most ONE mark per beat (add REPLACES; the clef rule), where dynamics stack.
  // There is no `setTempo` global to keep in sync — it does not exist. See
  // docs/tempo-marks-plan.md §5.

  /**
   * Add a tempo mark at (measure, mark.beat), REPLACING any mark already on that beat.
   * @throws if `bpm` is present and outside {@link MIN_BPM}..{@link MAX_BPM} (the guard the
   *   deleted global `setTempo` used to carry, now per-mark — a 0 bpm would be an infinite
   *   clock and a 10000 bpm an inaudible one).
   * @returns the stored TempoMark, or null if the measure does not exist.
   */
  addTempoMark(measureNumber: number, mark: Omit<TempoMark, 'id'>): TempoMark | null {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return null
    ScoreModel.validateBpm(mark.bpm)
    if (!measure.tempos) measure.tempos = []

    const at = measure.tempos.findIndex(t => fracCompare(t.beat, mark.beat) === 0)
    if (at !== -1) measure.tempos.splice(at, 1) // one mark per beat — last wins

    const created: TempoMark = { ...mark, id: uuidv4() }
    measure.tempos.push(created)
    measure.tempos.sort((a, b) => fracCompare(a.beat, b.beat))
    return created
  }

  /**
   * Edit an existing tempo mark by id (text / unit / dots / bpm / beat).
   * The owning measure's list is re-sorted in case the beat changed.
   *
   * Renaming the word NEVER moves the tempo and changing the number never rewrites the
   * word (decision D2) — that falls out of this being a plain field update, and the
   * text-edit overlay (P5) relies on it.
   * @returns the updated TempoMark, or null if no mark with that id exists.
   */
  updateTempoMark(id: string, updates: Partial<Omit<TempoMark, 'id'>>): TempoMark | null {
    if ('bpm' in updates) ScoreModel.validateBpm(updates.bpm)
    for (const measure of this.score.measures) {
      const mark = measure.tempos?.find(t => t.id === id)
      if (!mark) continue
      Object.assign(mark, updates)
      measure.tempos!.sort((a, b) => fracCompare(a.beat, b.beat))
      return mark
    }
    return null
  }

  /**
   * Remove a tempo mark by id, cleaning up the array when it becomes empty (so a
   * mark-free measure serializes without an empty `tempos: []`).
   * @returns true if a mark was removed.
   */
  removeTempoMark(id: string): boolean {
    for (const measure of this.score.measures) {
      if (!measure.tempos) continue
      const idx = measure.tempos.findIndex(t => t.id === id)
      if (idx === -1) continue
      measure.tempos.splice(idx, 1)
      if (measure.tempos.length === 0) delete measure.tempos
      return true
    }
    return false
  }

  /** A measure's tempo marks, sorted ascending by beat (a copy; empty if none). */
  getTempoMarks(measureNumber: number): TempoMark[] {
    return tempoMarks(this.score, measureNumber)
  }

  /** Find a tempo mark anywhere in the score by id (live reference), or null. Used by
   *  the in-canvas text editor to seed the overlay with the mark's current word. */
  getTempoMarkById(id: string): TempoMark | null {
    for (const measure of this.score.measures) {
      const mark = measure.tempos?.find(t => t.id === id)
      if (mark) return mark
    }
    return null
  }

  /** The sounding tempo (quarter-notes per minute) at a position — DEFAULT_TEMPO if the
   *  score states none. A mark with only a word inherits the prevailing tempo. */
  getEffectiveTempoAt(measureNumber: number, beat: Fraction, scope?: string): number {
    return effectiveTempoAt(this.score, measureNumber, beat, scope)
  }

  /** Reject a bpm that would make the clock nonsense. Absent bpm is fine (a word-only mark). */
  private static validateBpm(bpm: number | undefined): void {
    if (bpm === undefined) return
    if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
      throw new Error(`Tempo must be between ${MIN_BPM} and ${MAX_BPM} BPM`)
    }
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
    // The open-join nudges are margin-bound and span-relative (like segmentCurveShape), so a
    // re-anchor — which can change the span — wipes them too. The durable note-anchored
    // 'endpointOffset' above is the only override that survives a re-anchor.
    this.clearEngravingOverride(id, 'segmentEndpointOffset')
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

  /**
   * Nudge one OPEN join of a cross-system slur by a staff-space delta, **accumulating** onto
   * any existing offset (keyboard fine-positioning — see
   * docs/multisystem-slur-segment-endpoint-offset-plan.md). Stored as a
   * {@link SegmentEndpointOffsetOverride}, separate from the durable note-anchored
   * `endpointOffset`. `dx`/`dy` are in **staff-spaces**, margin-relative. `spanCount` is the
   * **live** system count at the time of the edit — the override's reset signature.
   *
   * Count-change handling on write mirrors {@link setSlurSegmentShape}: if the stored override
   * was authored against a different `spanCount`, its MIDDLE offsets are stale and dropped here
   * (begin/end durable, kept) before the live count is adopted. @returns true if the slur exists.
   */
  setSlurSegmentEndpointOffset(
    id: string,
    address: SlurSegmentEndpointAddress,
    dx: number, dy: number,
    spanCount: number,
  ): boolean {
    if (!this.getSlurById(id)) return false
    const prev = this.getEngravingOverride(id, 'segmentEndpointOffset') as SegmentEndpointOffsetOverride | undefined
    const keepMiddles = prev !== undefined && prev.spanCount === spanCount
    const next: SegmentEndpointOffsetOverride = {
      kind: 'segmentEndpointOffset',
      spanCount,
      ...(prev?.begin ? { begin: prev.begin } : {}),
      ...(prev?.end ? { end: prev.end } : {}),
      middles: keepMiddles ? { ...(prev!.middles ?? {}) } : {},
    }
    const add = (base: { x: number; y: number } | undefined) =>
      ({ x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy })
    if (address.role === 'begin') {
      next.begin = add(next.begin)
    } else if (address.role === 'end') {
      next.end = add(next.end)
    } else {
      const slot = { ...(next.middles![address.ordinal] ?? {}) }
      slot[address.side] = add(slot[address.side])
      next.middles![address.ordinal] = slot
    }
    this.setEngravingOverride(id, next)
    return true
  }

  /**
   * Nudge a rest's manual vertical shift by `delta` whole staff-steps, **accumulating** onto
   * any existing shift (the ↑/↓ keyboard fine-positioning — see docs/rest-shift-plan.md).
   * Stored as a {@link RestShiftOverride} in the engraving-overrides compartment, keyed by the
   * rest's **position address** (`posKey`, built by `restPositionKey`) rather than an id —
   * rests have no durable id (rest-fill mints fresh ones every edit). The override is a delta
   * on top of the automatic multi-voice placement; render adds it back in.
   *
   * Returning to a net shift of 0 clears the entry (so "absent = default" holds and the JSON
   * stays clean). No undo snapshot here — the facade (`MusicEngine.nudgeRestShift`) owns the
   * per-press `saveOnly`, mirroring `setSlurEndpointOffset` / `nudgeSlurEndpoint`.
   * @returns true (the override always exists/updates for a valid position key).
   */
  nudgeRestShift(posKey: string, delta: number): boolean {
    const prev = restShiftOverrideOf(this.score, posKey)
    const steps = (prev?.steps ?? 0) + delta
    if (steps === 0) {
      this.clearEngravingOverride(posKey, 'restShift')
    } else {
      const next: RestShiftOverride = { kind: 'restShift', steps }
      this.setEngravingOverride(posKey, next)
    }
    return true
  }

  /**
   * Set the user-authored **leading space** before one rhythmic column (client #10 — see
   * docs/note-spacing-plan.md), in staff-spaces, signed. Stored as a {@link LeadingSpaceOverride}
   * keyed by the column's position address (`posKey`, built by `spacingPositionKey`) — a column
   * has no id of its own, and deliberately no voice/staff either: the key IS the voice and staff
   * sync.
   *
   * ⚠️ **`minSpace` is the caller's, and it is not optional.** A negative space must not pull a
   * column left through its left neighbour's glyph, and that floor cannot be applied at render:
   * the formatted gap depends on the justified width, which depends on the very number being
   * clamped. Clamping only at draw would leave the *width* computed from the unclamped value, so
   * the bar would move further than its columns do and a hole would open at the barline. So the
   * clamp lands here, on the way in, measured by whoever has the last render in hand — and every
   * reader downstream applies the stored number verbatim.
   *
   * Zero clears the entry (so "absent = default" holds and the JSON stays clean). No undo snapshot
   * here — the facade (`MusicEngine.setNoteSpacing`) owns it, mirroring {@link nudgeRestShift} /
   * {@link nudgeDynamicOffset}. A model-level snapshot would push one undo entry per drag frame.
   * @returns the space actually stored, after the clamp.
   */
  setNoteSpacing(posKey: string, space: number, minSpace: number): number {
    const clamped = Math.max(space, minSpace)
    if (clamped === 0) {
      this.clearEngravingOverride(posKey, 'leadingSpace')
    } else {
      const next: LeadingSpaceOverride = { kind: 'leadingSpace', space: clamped }
      this.setEngravingOverride(posKey, next)
    }
    return clamped
  }

  /**
   * Set a bar's authored **stretch** — the multiplier on its own note space (client #11 — see
   * docs/bar-width-plan.md). Stored as a {@link BarWidthOverride} keyed by {@link barWidthKey}.
   *
   * **Two clamps, and the second is not optional.** `minStretch` is the caller's — the *measured*
   * floor from the last render, the same contract as {@link setNoteSpacing}'s `minSpace`: only
   * whoever has the drawn bar in hand knows how much room its music is actually using. On top of
   * that sits an absolute `[BAR_STRETCH_MIN, BAR_STRETCH_MAX]`, because this override is also
   * hand-editable in the Score JSON panel and `distributeLineWidths` leaves negative totals
   * uncapped by design — so a typed `0` would otherwise produce a negative-width bar.
   *
   * `1` clears the entry (so "absent = the engraver's own width" holds and the JSON stays clean).
   * No undo snapshot here — the facade (`MusicEngine.setBarWidth`) owns it, mirroring
   * {@link setNoteSpacing}; a model-level snapshot would push one undo entry per drag frame.
   * @returns the stretch actually stored, after both clamps.
   */
  setBarWidth(key: string, stretch: number, minStretch: number): number {
    const clamped = Math.min(
      BAR_STRETCH_MAX,
      Math.max(BAR_STRETCH_MIN, Math.max(stretch, minStretch)),
    )
    if (clamped === 1) {
      this.clearEngravingOverride(key, 'barWidth')
    } else {
      const next: BarWidthOverride = { kind: 'barWidth', stretch: clamped }
      this.setEngravingOverride(key, next)
    }
    return clamped
  }

  /**
   * Nudge a dynamic's manual position offset by `(dx, dy)` staff-spaces, **accumulating** onto
   * any existing offset (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see
   * docs/dynamic-offset-plan.md). Stored as a {@link DynamicOffsetOverride} in the
   * engraving-overrides compartment, keyed by the dynamic's durable `id` (element-id-keyed,
   * unlike the position-keyed rest clients). The offset is a delta on top of the mark's
   * automatic placement; render adds it back in.
   *
   * Returning to a net (0,0) clears the entry (so "absent = default" holds and the JSON stays
   * clean). No undo snapshot here — the facade (`MusicEngine.nudgeDynamicOffset`) owns the
   * per-press `saveOnly`, mirroring {@link nudgeRestShift} / {@link nudgeSlurEndpoint}.
   * @returns true (the override always exists/updates for a valid dynamic id).
   */
  nudgeDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
    const prev = dynamicOffsetOverrideOf(this.score, dynamicId)
    const x = (prev?.x ?? 0) + dx
    const y = (prev?.y ?? 0) + dy
    if (x === 0 && y === 0) {
      this.clearEngravingOverride(dynamicId, 'dynamicOffset')
    } else {
      const next: DynamicOffsetOverride = { kind: 'dynamicOffset', x, y }
      this.setEngravingOverride(dynamicId, next)
    }
    return true
  }

  /**
   * The **slot** id containing a note/rest id. Selection hands us a *pitch* id, and VexFlow cannot
   * x-shift a single notehead of a chord independently, so anything that moves a note by hand hangs
   * off the whole slot: a chord moves as a unit, and a rest (itself a slot) resolves to its own id.
   * Returns undefined for an id no longer in the score.
   *
   * ⚠️ **NOT the note-offset address** — {@link offsetTargetOf} is, and it differs on exactly one
   * case: a fanned MEMBER resolves to its OWNER here (it lives in that slot) and to ITSELF there (it
   * is a head with a stem, and an offset moves the note you offset). Reaching for this one to key an
   * override is what made a member nudge move the note that was typed.
   */
  slotIdForNote(noteId: string): string | undefined {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) return undefined
    return found.type === 'rest' ? found.rest.id : found.chord.id
  }

  /**
   * Nudge a note's manual horizontal offset by `dx` staff-spaces, **accumulating** onto any existing
   * offset (the Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md). Stored as a
   * {@link NoteOffsetOverride} in the engraving-overrides compartment under the key
   * {@link offsetTargetOf} resolves — the **slot** id for anything ordinary (one StaveNote is one
   * slot, so a chord moves as a unit), a fanned MEMBER's own first pitch id for a member. The offset
   * is a delta on top of the note's natural column; render folds it back in via `StaveNote.setXShift`.
   *
   * Returning to a net `x` of 0 clears the entry (so "absent = default" holds and the JSON stays
   * clean). No undo snapshot here — the facade (`MusicEngine.nudgeNoteOffset`) owns the per-press
   * `saveOnly`, mirroring {@link nudgeDynamicOffset}.
   * @returns true (the override always exists/updates for a valid key).
   */
  nudgeNoteOffset(key: string, dx: number): boolean {
    const prev = noteOffsetOverrideOf(this.score, key)
    const x = (prev?.x ?? 0) + dx
    if (x === 0) {
      this.clearEngravingOverride(key, 'noteOffset')
    } else {
      const next: NoteOffsetOverride = { kind: 'noteOffset', x }
      this.setEngravingOverride(key, next)
    }
    return true
  }

  /**
   * Drop the stored offsets of fanned members that are GOING AWAY — the sweep every id-keyed client
   * owes the compartment when its element dies (docs/note-offset-plan.md P3).
   *
   * ⚠️ **A member dies in more than one place**, which is the whole reason this is a helper: the
   * `Delete` key takes one ({@link deleteNote}), lowering `fan.count` truncates the list
   * (`normalizeFan` in {@link setFan}), removing the fan drops all of them, and deleting the note
   * that was typed takes the slot and the group with it. Miss one and the entry is stranded — it can
   * never mis-apply, since a new member is minted with a new id, but it stays in the JSON forever.
   */
  private clearFanMemberOffsets(members: NotePitch[][] | undefined): void {
    for (const pitches of members ?? []) {
      const first = pitches[0]
      if (first) this.clearEngravingOverride(first.id, 'noteOffset')
    }
  }

  /** Carry a stored note offset from one key to another, doing nothing when there is none — the one
   *  thing a re-keying edit owes the compartment. Only `noteOffset` moves: every other override at
   *  the old key belongs to whatever else was addressed by it. */
  private moveNoteOffsetKey(from: string, to: string): void {
    const ov = noteOffsetOverrideOf(this.score, from)
    if (!ov) return
    this.clearEngravingOverride(from, 'noteOffset')
    const next: NoteOffsetOverride = { kind: 'noteOffset', x: ov.x }
    this.setEngravingOverride(to, next)
    dbg(`[Model] note offset ${ov.x} re-keyed ${from} → ${to}`)
  }

  /** Drop a note's horizontal offset outright, back to its natural column (the Ctrl+Backspace
   *  first-class reset — see docs/note-offset-plan.md). Keyed by {@link offsetTargetOf}. No undo
   *  snapshot here; the facade owns it. @returns true if an offset was there to clear. */
  clearNoteOffset(key: string): boolean {
    if (!noteOffsetOverrideOf(this.score, key)) return false
    this.clearEngravingOverride(key, 'noteOffset')
    return true
  }

  /**
   * Toggle whether the rest at this position address is hidden (the Sibelius-style
   * Ctrl+Shift+H — see docs/rest-hide-plan.md). A {@link RestHiddenOverride} is payloadless,
   * so the toggle is presence-based: set it when absent, clear it when present. Position-keyed
   * (`posKey` from `restPositionKey`) for the same reason as {@link nudgeRestShift} — rests
   * have no durable id. No undo snapshot here; the facade (`MusicEngine.toggleRestHidden`) /
   * its multi-rest batch owns the snapshot.
   * @returns true (the override always toggles for a valid position key).
   */
  /**
   * Allow (or stop allowing) a courtesy time signature for the meter change at `measureId`.
   * Payloadless override, keyed by {@link cautionaryKey}: allowed = an entry exists.
   * No undo snapshot here; the facade (`MusicEngine.setCautionaryAllowed`) owns it.
   * @returns true when the stored state actually changed.
   */
  setCautionaryAllowed(measureId: string, allowed: boolean): boolean {
    if (allowed === cautionaryAllowedOf(this.score, measureId)) return false
    if (allowed) {
      const next: CautionaryOverride = { kind: 'cautionary' }
      this.setEngravingOverride(cautionaryKey(measureId), next)
    } else {
      this.clearEngravingOverride(cautionaryKey(measureId), 'cautionary')
    }
    return true
  }

  /**
   * Allow (or stop allowing) a courtesy clef for the clef change at `measureId` on `staffId`.
   * Payloadless override keyed by {@link cautionaryClefKey}: allowed = an entry exists.
   * No undo snapshot here; the facade (`MusicEngine.setCautionaryClefAllowed`) owns it.
   * @returns true when the stored state actually changed.
   */
  setCautionaryClefAllowed(measureId: string, staffId: string | undefined, allowed: boolean): boolean {
    if (allowed === cautionaryClefAllowedOf(this.score, measureId, staffId)) return false
    if (allowed) {
      const next: CautionaryClefOverride = { kind: 'cautionaryClef' }
      this.setEngravingOverride(cautionaryClefKey(measureId, staffId), next)
    } else {
      this.clearEngravingOverride(cautionaryClefKey(measureId, staffId), 'cautionaryClef')
    }
    return true
  }

  toggleRestHidden(posKey: string): boolean {
    if (restHiddenOf(this.score, posKey)) {
      this.clearEngravingOverride(posKey, 'restHidden')
    } else {
      const next: RestHiddenOverride = { kind: 'restHidden' }
      this.setEngravingOverride(posKey, next)
    }
    return true
  }

  /**
   * Nudge a staff's extra "space above" by `delta` staff-spaces, **accumulating** onto any
   * existing value (the Sibelius-style Alt+↑/↓ vertical staff drag — see
   * docs/staff-spacing-plan.md). Stored as a {@link StaffSpacingOverride} in the
   * engraving-overrides compartment, keyed by the durable `staffId` (unlike the position-keyed
   * rest clients). Render adds the accumulated per-system `above` back into each stave's Y.
   *
   * Returning to a net `above` of 0 clears the entry (so "absent = default" holds and the JSON
   * stays clean). No undo snapshot here — the facade owns the per-press snapshot, mirroring
   * {@link nudgeRestShift}.
   * @returns true (the override always exists/updates for a valid staffId).
   */
  nudgeStaffSpacing(staffId: string, delta: number): boolean {
    const prev = staffSpacingOverrideOf(this.score, staffId)
    const above = (prev?.above ?? 0) + delta
    if (above === 0) {
      this.clearEngravingOverride(staffId, 'staffSpacing')
    } else {
      const next: StaffSpacingOverride = { kind: 'staffSpacing', above }
      this.setEngravingOverride(staffId, next)
    }
    return true
  }

  /**
   * Set a staff's extra "space above" to an absolute `above` (staff-spaces). The drag path
   * (Phase 2) commits an absolute value rather than accumulating. Keyed by the durable
   * `staffId`; clears the entry when `above` lands on 0 so "absent = default" holds.
   * @returns true.
   */
  setStaffSpacing(staffId: string, above: number): boolean {
    if (above === 0) {
      this.clearEngravingOverride(staffId, 'staffSpacing')
    } else {
      const next: StaffSpacingOverride = { kind: 'staffSpacing', above }
      this.setEngravingOverride(staffId, next)
    }
    return true
  }

  /**
   * Reset a staff to default spacing (Layout → Reset Space Above): drops any
   * {@link StaffSpacingOverride} on this `staffId`.
   * @returns true if an override was removed.
   */
  resetStaffSpacing(staffId: string): boolean {
    return this.clearEngravingOverride(staffId, 'staffSpacing')
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

    if (rewrite === 'rebar' && extent === 'toNextChange') {
      // rebarRegion flattens the region (old meter) first, then re-bars it.
      rebarOps.rebarRegion(this.score, this.rebarDeps, measureNumber, ts)
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
      rebarOps.rebarRegion(this.score, this.rebarDeps, measureNumber, inherited)
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
   * Overwrite-paste a clipboard event stream at (targetMeasure, targetBeat). Thin delegator
   * to {@link rebarOps.pasteEvents}, which owns the region-rewrite pipeline. Returns the ids
   * of the flat notes that landed inside the paste window (for selecting the pasted material).
   */
  pasteEvents(
    targetMeasure: number,
    targetBeat: Fraction,
    clipLanes: { staff: number; voice: number; events: RebarEvent[] }[],
    spanBeats: Fraction,
    targetVoice: number,
    clipRestShifts: { staff: number; voice: number; restShifts: Array<{ offset: Fraction; steps: number }> }[] = [],
    clipRestHidden: { staff: number; voice: number; restHidden: Array<{ offset: Fraction }> }[] = [],
    targetStaff: number = 0,
    clipDynamics: rebarOps.ClipDynamicInput[] = [],
    clipSlurs: rebarOps.ClipSlurInput[] = [],
    clipSpaces: Array<{ offset: Fraction; space: number }> = [],
    clipNoteOffsets: { staff: number; voice: number; noteOffsets: Array<{ offset: Fraction; x: number; member?: number }> }[] = [],
  /** Two-note tremolos the clip carries, per lane — see `ClipboardLane.tremoloPairs`. */
  clipTremoloPairs: { staff: number; voice: number; tremoloPairs: Array<{ offset: Fraction; style?: 'joined' | 'open' }> }[] = [],
  ): string[] {
    return rebarOps.pasteEvents(
      this.score, this.rebarDeps, targetMeasure, targetBeat, clipLanes, spanBeats, targetVoice,
      clipRestShifts, clipRestHidden, targetStaff, clipDynamics, clipSlurs, clipSpaces, clipNoteOffsets, clipTremoloPairs,
    )
  }

  /**
   * The ScoreModel callbacks the {@link rebarOps} free functions call back into — bound here so
   * the region-rewrite machinery can live outside this class without losing the few methods it
   * shares with the rest of the model (measure insertion, gap-fill, engraving overrides, tie /
   * slur repair). Built per call; rebar is not a hot path.
   */
  private get rebarDeps(): rebarOps.RebarDeps {
    return {
      insertMeasureAfter: (afterNumber, ts) => this.insertMeasureAfter(afterNumber, ts),
      addMeasure: (ts) => this.addMeasure(ts),
      fillGapsWithRests: (m) => this.fillGapsWithRests(m),
      collapseEmptyVoices: (n) => this.collapseEmptyVoices(n),
      pushRestSlot: (m, rest, voice, staffId) => this.pushRestSlot(m, rest, voice, staffId),
      staffIdForParams: (staff) => this.staffIdForParams(staff),
      addSlur: (slur) => this.addSlur(slur),
      findSlot: (id) => this.findSlot(id),
      setEngravingOverride: (id, override) => this.setEngravingOverride(id, override),
      clearEngravingOverride: (id, kind) => this.clearEngravingOverride(id, kind),
      repairDanglingTies: () => this.repairDanglingTies(),
      repairDanglingSlurs: () => this.repairDanglingSlurs(),
    }
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
        if (s.type === 'chord') {
          for (const p of s.notes) ids.add(p.id)
          // ⭐ A FANNED MEMBER can anchor a slur (docs/fanned-beam-pitches-plan.md) — a slur is a
          // SPAN between two points, and member 2 → member 5 is a span. Leave them out and every
          // such slur is silently dropped the next time this defensive pass runs.
          for (const member of s.fan?.members ?? []) for (const p of member) ids.add(p.id)
        } else ids.add(s.id)
      }
    }
    for (let i = slurs.length - 1; i >= 0; i--) {
      if (!ids.has(slurs[i].startNoteId) || !ids.has(slurs[i].endNoteId)) {
        const [dropped] = slurs.splice(i, 1)
        this.clearEngravingOverride(dropped.id) // auto-reset (§3.3): slur points at a missing note → dropped
      }
    }
  }

  // ==================== Internal helpers ====================

  /**
   * Find the slot containing the given note/pitch ID.
   *
   * ⭐ **A FANNED MEMBER'S pitch is found ONLY when asked for** (`{ fanMembers: true }`), and that
   * default is the safety rule of docs/fanned-beam-pitches-plan.md §2 P3. A member is a real pitch
   * with a real id, so an id can now name something that is NOT in `slot.notes` — and almost every
   * mutator here assumes it is: the delete paths are `chord.notes.filter(n => n.id !== pitch.id)`,
   * which would no-op on a member and report success, and the tie would write `tiedTo` onto a pitch
   * `TieRenderer` looks up in `slot.notes` — stored, never drawn, invisible until export.
   *
   * Failing CLOSED turns every one of those into a refusal (the caller gets `undefined` and returns
   * null/false) instead of a silent half-write, and a mutator written next year refuses without
   * knowing fans exist. The handful of callers that genuinely mean "this pitch, wherever it lives"
   * — {@link getNote}, {@link getNotePitch}, {@link slotIdForNote}, {@link updateNote},
   * {@link deleteNote} — opt in, and each states what it does with a member.
   */
  private findSlot(noteId: string, opts?: { fanMembers?: boolean }):
    | { type: 'chord'; chord: Chord; pitch: NotePitch; member?: { index: number; pitches: NotePitch[] } }
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
          if (opts?.fanMembers && slot.fan?.members) {
            for (let k = 0; k < slot.fan.members.length; k++) {
              const found = slot.fan.members[k].find(n => n.id === noteId)
              // `index` is the member's place in the GROUP (1-based), not in the list: member 0 is
              // the slot's own chord, so the list holds members 1…count-1.
              if (found) return { type: 'chord', chord: slot, pitch: found, member: { index: k + 1, pitches: slot.fan.members[k] } }
            }
          }
        }
      }
    }
    return undefined
  }

  /**
   * Is this id a FANNED MEMBER's pitch — a note that lives inside a `fan`, not in `slot.notes`?
   *
   * The public face of {@link findSlot}'s opt-in, for the commands that must REFUSE one (a tie, a
   * slur, an articulation, a duration change: they attach to the SLOT — the whole gesture — and a
   * member is not one). Refusing needs to be a decision the command makes, not an absence it trips
   * over, or the refusal reads as a bug the day someone selects a member and presses `T`.
   */
  isFanMember(noteId: string): boolean {
    const found = this.findSlot(noteId, { fanMembers: true })
    return found?.type === 'chord' && found.member !== undefined
  }

  /**
   * ⭐ The whole GROUP `noteId` belongs to, as flat notes in sounding order — member 0's pitches
   * first, then each member's — or null when the id names neither a fanned slot's note nor one of
   * its members.
   *
   * "What comes next inside this fan?", which is what a slur started on one member needs
   * (docs/fanned-beam-pitches-plan.md). One pitch per member is enough for an anchor, so this
   * projects the FIRST of each — the same choice `collapseToBeats` makes for a chord.
   */
  fanMembersOfSlot(noteId: string): Note[] | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (found?.type !== 'chord') return null
    const { chord } = found
    const fan = chord.fan
    if (!fan) return null
    return fanMemberPitches(chord.notes, fan)
      .map(heads => heads[0])
      .filter((p): p is NotePitch => !!p)
      .map(p => this.toFlatNote(chord, p))
  }

  /**
   * Which MEMBER of its fanned group `noteId` belongs to — **0 for the slot's own pitches, since the
   * note you typed IS member 0** — or null when it is not in a fanned slot at all.
   *
   * That zero is the whole point: from inside the group, the thing after the first note is the
   * second MEMBER, not the next slot. Any pitch of a fanned chord answers 0, so slurring from the
   * upper note of a fanned chord behaves like slurring from its lower one.
   */
  fanMemberIndexOf(noteId: string): number | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (found?.type !== 'chord' || !found.chord.fan) return null
    return found.member?.index ?? 0
  }

  /**
   * ⭐ The COLUMN a note is spaced by — its own beat for anything ordinary, and **the member's own
   * beat inside a fan** (docs/note-spacing-plan.md §7).
   *
   * The whole of the fix for "spacing one member moved the whole fan": `getNote` projects a member
   * with `toFlatNote(chord, pitch)`, which carries the CHORD's beat, so every member handed the
   * spacing keys the same address — the group's own column. A member's beat is an exact rational out
   * of {@link fanMemberBeats}, and `spacingPositionKey` takes any rational, so the address exists
   * already; nothing here is a new kind of key.
   *
   * `memberIndex` is 0 for an ordinary note and for member 0 (whose column IS the slot's), and ≥ 1
   * for a member with a gap of its own — what the caller needs to know before measuring how far left
   * it may go, since a member has no drawn column for `measuredShrinkRoom` to read.
   */
  spacingColumnOf(noteId: string): { measure: number; beat: Fraction; memberIndex: number } | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) return null
    if (found.type === 'rest') return { measure: found.rest.measure, beat: found.rest.beat, memberIndex: 0 }
    const { chord } = found
    const index = found.member?.index ?? 0
    if (index === 0 || !chord.fan) return { measure: chord.measure, beat: chord.beat, memberIndex: 0 }
    const total = chord.actualDuration ?? durationToFraction(chord.duration, chord.dots ?? 0)
    const beat = fanMemberBeats(chord.fan, total, chord.beat)[index]
    return beat ? { measure: chord.measure, beat, memberIndex: index } : { measure: chord.measure, beat: chord.beat, memberIndex: 0 }
  }

  /**
   * ⭐ The KEY a note's horizontal offset is stored at — the slot's id for anything ordinary, and
   * **the member's own first pitch id inside a fan** (docs/note-offset-plan.md §"Inside a FAN").
   *
   * The twin of {@link spacingColumnOf}, and the same fix one axis over: {@link slotIdForNote}
   * resolves a member to the chord that contains it, so every member of a group wrote its offset at
   * the owner's key and nudging one moved the note that was typed. A member is a thing on the page
   * with a stem, a head and an id of its own; it can be moved off its column like anything else.
   *
   * ⚠️ **The first pitch is the key, so the key MOVES when that pitch is deleted** — `deleteNote`
   * carries the entry across (see its member branch). Keeping the write canonical is what lets every
   * reader stay `member.pitches[0].id` and never have to search.
   *
   * `memberIndex` is 0 for an ordinary note/rest and for member 0 (whose key IS the slot's), ≥ 1 for
   * a member with an offset of its own — what the renderer needs to know which head to move. A
   * member that was never normalized has no stored pitches to key off and no id of its own to be
   * selected by, so it answers with its slot, which is where it is drawn.
   */
  offsetTargetOf(noteId: string): { key: string; memberIndex: number } | undefined {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) return undefined
    if (found.type === 'rest') return { key: found.rest.id, memberIndex: 0 }
    if (!found.member) return { key: found.chord.id, memberIndex: 0 }
    return { key: found.member.pitches[0].id, memberIndex: found.member.index }
  }

  /**
   * The pitches of the FANNED MEMBER containing `noteId` — its whole chord — or null when the id is
   * not a member's. A member is a chord in its own right (it can hold several pitches), so "what is
   * already stacked here?" has a different answer for a member than for the slot.
   */
  fanMemberPitches(noteId: string): NotePitch[] | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    return found?.type === 'chord' && found.member ? found.member.pitches : null
  }

  /**
   * ⭐ Stack a pitch onto the FANNED MEMBER containing `noteId` — `Shift`+letter, inside the group.
   *
   * The member is the chord here, not the slot: adding to `slot.notes` would put the note on the
   * group's FIRST head (which is what happened before this existed — his report). Refuses (null)
   * for anything that is not a member, so the ordinary chord path stays the only door to `slot.notes`.
   */
  addFanMemberPitch(noteId: string, spelling: { step: PitchStep; alter: PitchAlter; octave: number }): Note | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (found?.type !== 'chord' || !found.member) return null
    const pitch: NotePitch = { id: uuidv4(), step: spelling.step, alter: spelling.alter, octave: spelling.octave }
    found.member.pitches.push(pitch)
    dbg(`[Model.addFanMemberPitch] member ${found.member.index}: +${pitch.step}${alterToString(pitch.alter)}${pitch.octave} (${found.member.pitches.length} pitches)`)
    return this.toFlatNote(found.chord, pitch)
  }

  /** Assemble a flat Note from a Chord + NotePitch, resolving the chord's `staffId`
   *  back-pointer to its 0-based staff index for the flat view. */
  private toFlatNote(chord: Chord, pitch: NotePitch): Note {
    return toFlatNote(chord, pitch, staffIndexOfId(this.score, chord.staffId))
  }

  /** Assemble a flat Note from a Rest, resolving its `staffId` to a staff index. */
  private restToFlatNote(rest: Rest): Note {
    return restToFlatNote(rest, staffIndexOfId(this.score, rest.staffId))
  }

  // ==================== Note Entry ====================

  /**
   * Add a note to the score
   * If adding a regular note (not a rest), this will replace overlapping rests
   * and may join an existing Chord at the same beat.
   */
  /**
   * Resolve a 0-based staff index (from {@link NoteParams.staff}) to the `staffId` to stamp
   * on a new slot. Mirrors the voice convention: the FIRST staff (index 0 / undefined) stamps
   * NO `staffId` (absent = staff 0, keeps single-staff output byte-identical); any later staff
   * stamps its real id. See docs/multi-staff-plan.md §4.
   */
  private staffIdForParams(staff: number | undefined): string | undefined {
    if (!staff) return undefined
    return staffIdAtIndex(this.score, staff)
  }

  addNote(params: NoteParams): Note {
    const measure = this.getMeasure(params.measure)
    if (!measure) {
      throw new Error(`Measure ${params.measure} does not exist`)
    }

    // Validate pitch (skip validation for rests)
    if (!params.isRest && !params.step) {
      throw new Error('Non-rest notes must have a step')
    }

    // Which staff this slot belongs to (absent = staff 0). Everything below scopes chord
    // merging / rest replacement to this staff so a note on one staff never joins or
    // clobbers content on another that happens to share the same beat + voice.
    const targetStaffId = this.staffIdForParams(params.staff)

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
      if (targetStaffId !== undefined) rest.staffId = targetStaffId
      rest.actualDuration = this.computeActualDurationForSlot(rest, measure)
      // Through the SAME rule a new chord uses: a rest evicts the same-voice rests it overlaps.
      // This branch used to `push` and nothing else, which is how a bar reached six beats in 4/4
      // (see evictRestsOverlapping). No gap fill here: this is often the gap-filler's OWN addNote.
      dbg(`[Model.addNote] add REST ${fmtSlot(rest)} → m${measure.number}, replacing same-voice rests`)
      this.evictRestsOverlapping(measure, rest)
      measure.slots.push(rest)
      measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
      return this.restToFlatNote(rest)
    }

    // Regular note — look for an existing Chord at the same beat AND voice
    // (different voices are independent streams and never merge into one chord).
    const noteVoice = params.voice ?? 0
    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, params.beat) && (s.voice ?? 0) === noteVoice
        && matchesStaff(s.staffId, targetStaffId, this.score)
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
      // Same rule as the articulations above, and for the same reason: both are properties of the
      // SLOT, so a pitch entered into an existing chord with a mark armed marks that chord.
      if (params.tremolo !== undefined) existingChord.tremolo = params.tremolo
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
      dbg(`[Model.addNote] add pitch ${params.step}${alterToString(params.alter ?? 0)}${params.octave} → existing chord ${fmtSlot(existingChord)} (now ${existingChord.notes.length} note(s))`)
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
      tremolo: params.tremolo,
      articulationPlacement: params.articulationPlacement,
      articulationStemAlign: params.articulationStemAlign,
      beam: params.beam === 'auto' ? undefined : params.beam,
      secondaryBreak: params.secondaryBreak || undefined,
      notes: [notePitch],
    }
    if (params.voice) chord.voice = params.voice
    if (targetStaffId !== undefined) chord.staffId = targetStaffId
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)

    dbg(`[Model.addNote] new chord ${fmtSlot(chord)} → replacing same-voice rests`)
    this.replaceRestsWithChord(measure, chord)

    return this.toFlatNote(chord, notePitch)
  }

  /**
   * Evict the same-voice, same-staff RESTS that `incoming`'s span overlaps, migrating any tie that
   * pointed at one onto whatever replaces it. Returns the tupletId inherited from a replaced tuplet
   * rest, if any. Does NOT place `incoming`, and deliberately does NOT fill gaps — see below.
   *
   * The rule is about TIME, not pitch: one voice cannot be two things over one beat, so anything
   * arriving evicts the rests its span covers — a chord or another rest alike. It lived inside the
   * chord's half of {@link addNote}'s if/else, so the rest branch never got it and simply pushed:
   * a quarter rest entered where a half rest already sat left BOTH, and the bar went to six beats in
   * 4/4 (`[integrity] … Δ +2 — OVERFULL`). Pulling the rule out of the chord path is what lets both
   * branches obey it.
   *
   * FILLING IS THE CALLER'S. A rest is often being added BY the gap-filler itself, and re-entering
   * the filler from inside it closes the very hole the caller was opening — the bar is meant to be
   * inconsistent mid-repair. The chord path fills afterwards because it is done at that point;
   * that difference is real, so it stays at the call sites rather than becoming a flag here.
   *
   * The tie target is the only thing that varies by kind: a chord's first pitch, or the rest itself
   * (both can be tied INTO — the let-ring rule; see MusicEngine.deleteNote).
   */
  /**
   * The shared "which same-voice/staff rests does this span cover?" scan. Partitions the
   * measure's slots into the rests to evict (a rest is the only thing another event can
   * displace — chords and other-voice/staff rests are independent streams and always
   * survive) and the slots that remain, order preserved. `keepId` is the incoming slot
   * itself, which always overlaps its own span, so it is never evicted.
   *
   * What to DO with each evicted rest — migrate a tie, inherit a tupletId, re-fill the bar —
   * stays at the two call sites, because who fills and who places differs between them.
   */
  private scanOverlappingRests(
    measure: Measure,
    beat: Fraction,
    durFrac: Fraction,
    voice: number,
    staffId: string | undefined,
    keepId: string,
  ): { evicted: Rest[]; remaining: ChordRest[] } {
    const evicted: Rest[] = []
    const remaining: ChordRest[] = []
    for (const existing of measure.slots) {
      if (existing.id === keepId) {
        remaining.push(existing)
        continue
      }
      if (existing.type === 'rest') {
        const existingDurFrac =
          existing.actualDuration ?? durationToFraction(existing.duration, existing.dots ?? 0)
        const overlaps =
          (existing.voice ?? 0) === voice &&
          matchesStaff(existing.staffId, staffId, this.score) &&
          noteSpansOverlapFrac(beat, durFrac, existing.beat, existingDurFrac)
        if (overlaps) {
          evicted.push(existing)
          continue
        }
      }
      remaining.push(existing) // a chord, or a rest of another voice/staff — independent streams
    }
    return { evicted, remaining }
  }

  private evictRestsOverlapping(measure: Measure, incoming: ChordRest): string | undefined {
    const incomingDurFrac = incoming.actualDuration ?? durationToFraction(incoming.duration, incoming.dots ?? 0)
    const incomingVoice = incoming.voice ?? 0
    const tieTarget: { id: string; tiedFrom?: string } | undefined =
      incoming.type === 'chord' ? incoming.notes[0] : incoming

    let inheritedTupletId: string | undefined = incoming.tupletId
    const { evicted, remaining } = this.scanOverlappingRests(
      measure, incoming.beat, incomingDurFrac, incomingVoice, incoming.staffId, incoming.id,
    )

    for (const existing of evicted) {
      dbg(`[Model.replaceRests] remove overlapping ${fmtSlot(existing)} (same voice v${incomingVoice} as new ${incoming.type})`)
      if (existing.tupletId && !incoming.tupletId) {
        inheritedTupletId = existing.tupletId
      }
      // Migrate any tie pointing TO this rest onto whatever replaces it
      if (tieTarget) {
        if (existing.tiedFrom) tieTarget.tiedFrom = existing.tiedFrom
        this.migrateRestTieTo(existing.id, tieTarget.id)
      }
    }

    measure.slots = remaining
    return inheritedTupletId
  }

  /**
   * Replace rests overlapping a new Chord and fill gaps with new rests.
   * Also inherits tupletId from any replaced tuplet rest.
   */
  private replaceRestsWithChord(measure: Measure, chord: Chord): void {
    const inheritedTupletId = this.evictRestsOverlapping(measure, chord)

    // Apply inherited tupletId
    if (inheritedTupletId && !chord.tupletId) {
      chord.tupletId = inheritedTupletId
      // Recompute actual duration with the now-known tuplet
      chord.actualDuration = this.computeActualDurationForSlot(chord, measure)
    }

    measure.slots.push(chord)

    // Fill gaps with rests
    this.fillGapsWithRests(measure)

    // Sort by beat
    measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  }

  /**
   * A chord already in the measure has grown (its duration was lengthened in
   * place) and its sounding span may now overlap later same-voice/staff rests.
   * Evict every such rest — migrating any tie that pointed at it onto the chord's
   * first note — then re-fill the tail so the bar stays exactly full.
   *
   * This is the in-place counterpart to {@link replaceRestsWithChord} (which
   * assumes the chord is not yet in `slots`). No-op when nothing overlaps, so it
   * is safe to call on any duration change; only a genuine grow evicts anything.
   */
  private evictRestsOverlappingChord(measure: Measure, chord: Chord): void {
    const chordDurFrac = chord.actualDuration ?? durationToFraction(chord.duration, chord.dots ?? 0)
    const chordVoice = chord.voice ?? 0

    const { evicted, remaining } = this.scanOverlappingRests(
      measure, chord.beat, chordDurFrac, chordVoice, chord.staffId, chord.id,
    )
    if (evicted.length === 0) return

    for (const existing of evicted) {
      dbg(`[Model.evictRests] remove overlapping ${fmtSlot(existing)} (chord grew, v${chordVoice})`)
      if (chord.notes.length > 0) this.migrateRestTieTo(existing.id, chord.notes[0].id)
    }

    measure.slots = remaining
    this.fillGapsWithRests(measure)
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
  fillGapWithRests(measureNumber: number, fromBeat: Fraction, beats: number, voice: number = 0, staff: number = 0): void {
    dbg(`[Model.fillGapWithRests] m${measureNumber} v${voice} s${staff} from b${fracToNumber(fromBeat).toFixed(3)} for ${beats.toFixed(3)}b → [${splitBeatsIntoDurations(beats).join(', ')}]`)
    let currentBeat = fromBeat
    for (const restDuration of splitBeatsIntoDurations(beats)) {
      this.addRest(restDuration, measureNumber, currentBeat, voice, staff)
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

    // Partition by STAFF before voice (multi-staff): each staff is an independent
    // rest-fill lane, exactly like each voice — a note on staff 2 must not suppress the
    // rest-fill of staff 1's own stream. `match` selects the lane's slots; `stamp` is put
    // on its filler rests. The first staff stamps `undefined` (the absent-staffId = staff 0
    // convention), so a single-staff score is byte-identical to the pre-multi-staff model.
    const staves = this.score.staves ?? []
    const staffLanes: Array<{ match: string | undefined; stamp: string | undefined }> =
      staves.length > 0
        ? staves.map((s, i) => ({ match: s.id, stamp: i === 0 ? undefined : s.id }))
        : [{ match: undefined, stamp: undefined }]

    // The measure header is logged lazily — only once, and only if some lane/voice
    // actually has a gap to fill. A bar with nothing to do stays silent.
    let headerLogged = false
    const logHeaderOnce = () => {
      if (headerLogged) return
      headerLogged = true
      dbg(`[Model.fillGaps] m${measure.number} barLen=${fracToNumber(barEnd).toFixed(3)} TS=${measure.timeSignature.numerator}/${measure.timeSignature.denominator} staves=${staffLanes.length}`)
    }

    for (let laneIndex = 0; laneIndex < staffLanes.length; laneIndex++) {
      const lane = staffLanes[laneIndex]
      const laneSlots = measure.slots.filter(slot => matchesStaff(slot.staffId, lane.match, this.score))
      const laneTuplets = tuplets.filter(tuplet => matchesStaff(tuplet.staffId, lane.match, this.score))

      // Distinct voices present in THIS staff (always include voice 0 so an empty bar fills).
      const voices = new Set<number>([0])
      for (const slot of laneSlots) voices.add(slot.voice ?? 0)

      for (const voice of voices) {
        const voiceSlots = laneSlots
          .filter(slot => (slot.voice ?? 0) === voice)
          .sort((a, b) => fracCompare(a.beat, b.beat))

        // Only this staff+voice's tuplets may govern its gaps. A tuplet's voice is
        // derived from its member slots (a tuplet is a single-voice run), so a
        // voice-0 triplet must not block the rest-fill of an empty voice-1 bar.
        const voiceTuplets = laneTuplets.filter(tuplet => {
          const slot = laneSlots.find(s => s.tupletId === tuplet.id)
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
              tupletSpan(tuplet),
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
          dbg(`[Model.fillGaps]   staff${laneIndex} v${voice}: ${voiceSlots.length} existing slot(s), gaps=${gapStr}`)
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
            this.pushRestSlot(measure, rest, voice, lane.stamp)
            const dots = rest.dots ? '.'.repeat(rest.dots) : ''
            dbg(`[Model.fillGaps]     fill staff${laneIndex} v${voice} REST ${rest.duration}${dots} @b${fracToNumber(rest.beat).toFixed(3)}${rest.isMeasureRest ? ' [measure-rest]' : ''}`)
          }
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
        // The written→sounding factor, which is only `M/N` when both sides share a note value.
        return fracMul(base, tupletScale(tuplet))
      }
    }
    return base
  }

  /**
   * Add a rest to the score
   */
  addRest(duration: NoteParams['duration'], measure: number, beat: Fraction, voice: number = 0, staff: number = 0): Note {
    return this.addNote({
      duration,
      measure,
      beat,
      isRest: true,
      ...(voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}),
      ...(staff ? { staff } : {}),
    })
  }

  /**
   * Get a note by its ID.
   *
   * ⭐ Answers for a FANNED MEMBER too (docs/fanned-beam-pitches-plan.md §2 P3): a member is a real
   * pitch you can click, so everything downstream of a selection — the Keypad, the Properties
   * window, the highlight's rest check — has to be able to ask what it is. What comes back is the
   * member's own spelling wearing the SLOT's rhythm (`toFlatNote` reads both from the chord), which
   * is exactly true: the group is one event, and the member is a pitch inside it.
   *
   * ⭐ **Everything but the GROUP'S OWN MARKS, which only the owner reports** — its `fan`, its
   * `beam` and its `secondaryBreak`. The rhythm is shared: the member really is that long, at that
   * beat, and the palette shows its duration for exactly that reason. A mark is not. It is not a
   * fact about the member at all, it is the thing the member lives INSIDE, and every one of these is
   * a statement about the whole event — where the group starts and ends in a beam, whether a beam is
   * subdivided in front of it, that it fans.
   *
   * Handing them out on a member makes every reader claim the member wears one, and each is a
   * surface offering an edit the model then refuses (`setFan` and `updateNote`'s member branch both
   * resolve without `fanMembers`, so nothing is written): the Keypad lit `accel.` and a beam key,
   * the subdivide key lit, and the Properties window opened the fan's two numbers — all on a note
   * where none of it could be changed. The refusals were right; the invitation was the bug. "Which
   * note owns this?" has exactly one answer, and it is member 0 — the note you typed.
   */
  getNote(noteId: string): Note | undefined {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) return undefined
    if (found.type === 'rest') return this.restToFlatNote(found.rest)
    const note = this.toFlatNote(found.chord, found.pitch)
    if (found.member) {
      delete note.fan
      delete note.beam
      delete note.secondaryBreak
    }
    return note
  }

  /**
   * What the note's beam ACTUALLY is — begin / continue / end / single — as opposed to what was
   * authored on it (`getNote().beam`, absent when nobody decided). See {@link beamRoleAt}.
   *
   * The slice matters: beams are built per VOICE of one STAFF, sorted by beat (VexFlowRenderer's
   * `groups`), so the role is computed against that same run. Read it against the whole measure and
   * a voice-2 note is scored against voice 1's grouping — an answer about a beam that was never
   * engraved. Returns null for an unknown id, and for a REST — you cannot beam silence, so a rest
   * has no role at all; `'single'` would be a claim about a beamable note that stayed alone.
   *
   * The run is the whole lane, not the bar: a beam may cross a barline
   * (docs/cross-barline-beaming-plan.md), and the last note of bar N joined forward is a `continue`,
   * not the `end` its own bar would call it.
   */
  getBeamRole(noteId: string): BeamRole | null {
    const measureIndex = this.score.measures.findIndex(m => m.slots.some(s =>
      s.type === 'rest' ? s.id === noteId : s.notes.some(n => n.id === noteId)))
    if (measureIndex === -1) return null

    const slot = this.score.measures[measureIndex].slots.find(s =>
      s.type === 'rest' ? s.id === noteId : s.notes.some(n => n.id === noteId))!
    if (slot.type === 'rest') return null

    const bars = this.score.measures.map(measure => ({
      slots: measure.slots
        .filter(s => matchesStaff(s.staffId, slot.staffId, this.score) && (s.voice ?? 0) === (slot.voice ?? 0))
        .sort((a, b) => fracCompare(a.beat, b.beat)),
      meter: getMeterInfo(measure.timeSignature),
    }))
    return beamRoleAtRef(bars, { bar: measureIndex, slot: bars[measureIndex].slots.indexOf(slot) })
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

  /**
   * Set whether the slot's stem-side articulations align to the stem (modern)
   * rather than the notehead (traditional default). No-op for rests or slots
   * without articulations. Stores the flag only when true; clears it when false
   * so the default state serializes clean. Returns the flat note, or null.
   */
  setArticulationStemAlign(noteId: string, align: boolean): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found
    if (!chord.articulations?.length) return null
    if (align) chord.articulationStemAlign = true
    else delete chord.articulationStemAlign
    return this.toFlatNote(chord, pitch)
  }

  /**
   * Set — or with `null`, remove — the single-note tremolo on the slot containing `noteId`.
   *
   * SINGLE-VALUED: a note carries one tremolo, so a different mark REPLACES the one there rather
   * than stacking (articulations are the additive kind). Refuses a REST outright — you cannot
   * tremolo silence — which is why {@link Rest} has no such field to write. Returns the flat note,
   * or null when the id is not a chord pitch.
   *
   * The mark lives on the slot, so a chord takes it as a chord — passing any pitch id in the chord
   * marks the whole event, which is the same call {@link setArticulationStemAlign} makes.
   *
   * ⭐ REMOVING THE COUNT REMOVES A TWO-NOTE PAIR WITH IT — and the pair's stroke STYLE too — and
   * that is the model rather than a courtesy: a pair needs a stroke COUNT
   * (docs/two-note-tremolo-plan.md §0), so `tremoloPair` with no `tremolo` is a mark with nothing to
   * draw, and `tremoloPairStyle` with no pair is a setting for a mark that is not there. Putting it
   * here rather than in each caller is what makes Delete, the palette's re-press and anything added
   * later agree for free. CHANGING the count leaves both alone — that is the same mark re-read.
   */
  setTremolo(noteId: string, tremolo: TremoloMark | null): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found
    if (tremolo === null) {
      delete chord.tremolo
      delete chord.tremoloPair
      delete chord.tremoloPairStyle
    } else {
      chord.tremolo = tremolo
      // The other expansion of one slot into many attacks stands down — see {@link setFan}. Only
      // when a mark is being SET: removing a tremolo is not a statement about the fan.
      delete chord.fan
    }
    return this.toFlatNote(chord, pitch)
  }

  /**
   * Set — or with `null`, remove — the FANNED (feathered) beam on the slot containing `noteId`:
   * "play this one event as N notes, speeding up (or slowing down) across exactly its own
   * duration". See {@link FanMark} and docs/fanned-beams-plan.md §0.
   *
   * On the SLOT, like the tremolo and for the same reason: a chord accelerates as a chord.
   *
   * ⭐ **Three refusals, and each is the notation talking, not a guard:**
   * - a REST — you cannot accelerate silence, the same sentence that keeps {@link Rest} free of a
   *   `tremolo` field;
   * - a TUPLET member — a ramp inside a ratio is a second normalization of the same span, and
   *   nobody has asked for one (docs/fanned-beams-plan.md §3);
   * - nothing to remove — removing a fan that is not there is not an edit, so it reports null
   *   rather than minting an undo entry, exactly as {@link setTremoloPair} does when switching off.
   *
   * ⭐ **Setting a fan takes the tremolo off** (and a pair, and its style). Those are the OTHER two
   * ways one slot becomes many attacks, and a slot carrying two of them asks playback a question
   * with two answers — `playbackSchedule` would take whichever it happened to test first and the
   * loser would vanish with no sign. Arming IS clearing, the rule the marking tools already follow.
   */
  setFan(noteId: string, fan: FanMark | null): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found

    if (fan === null) {
      if (!chord.fan) return null
      // The members go with the mark, and so do their authored offsets.
      this.clearFanMemberOffsets(chord.fan.members)
      delete chord.fan
      return this.toFlatNote(chord, pitch)
    }

    if (chord.tupletId) return null
    // ⭐ The ONE place `count` and `members` are held in step (docs/fanned-beam-pitches-plan.md §1).
    // Materialises the members on a fresh mark, grows or shrinks them on an edited one — and does it
    // HERE rather than in the callers so a palette press, a Properties number and anything added
    // later cannot disagree about the off-by-one.
    const before = chord.fan?.members ?? []
    chord.fan = normalizeFan(fan, chord.notes)
    // ⚠️ A LOWERED count truncates the list (`slice(0, want)`), so this is the second way a member
    // dies and it never goes near `deleteNote`. The survivors are the same arrays by identity, so
    // whatever is not in the new list is what left — take its offset with it.
    const kept = new Set(chord.fan.members ?? [])
    this.clearFanMemberOffsets(before.filter(m => !kept.has(m)))
    delete chord.tremolo
    delete chord.tremoloPair
    delete chord.tremoloPairStyle
    return this.toFlatNote(chord, pitch)
  }

  /**
   * Set — or with `false`, remove — the TWO-NOTE tremolo on the slot containing `noteId`.
   *
   * Refuses (returns null) whenever {@link pairIsValid} says this slot cannot be the first note of a
   * pair — the §0 list, read off the slot's own lane. The ONE predicate: the button asks it here,
   * the renderer asks it before drawing, the beam grouper before excluding. It is checked at APPLY
   * time and again at DRAW time on purpose; neither alone is enough (docs/two-note-tremolo-plan.md
   * §1).
   *
   * ⭐ THE COUNT COMES FROM THE NOTE, and with none there the press sets THREE. The pair is a
   * separate field from the stroke count, so a press on a note carrying no `tremolo` would otherwise
   * be a mark with nothing to draw. Three strokes is the ordinary two-note tremolo. Refusing instead
   * would make the button dead on exactly the note you pressed it on — the trap the tie stamp
   * already had and fixed (docs/tie-stamp-plan.md §1.3).
   *
   * Removing takes ALL of it off — the count, the pair and the STROKE STYLE. The pair is ONE mark,
   * and half of it is not a notation; and a style left behind on a plain note is the same
   * resurrection trap the flag itself is, silently re-joining the strokes the day the note is paired
   * again (his catch).
   *
   * Nothing is written to the SECOND slot, in either direction. That is the model (§1) — "mark just
   * the first note" is true in the data too, and it is why deleting the partner cannot leave a
   * dangling half-mark.
   */
  setTremoloPair(noteId: string, on: boolean): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found

    if (!on) {
      if (!chord.tremoloPair) return null
      delete chord.tremoloPair
      delete chord.tremolo
      delete chord.tremoloPairStyle
      return this.toFlatNote(chord, pitch)
    }

    const measure = this.score.measures.find(m => m.number === chord.measure)
    if (!measure) return null
    const lane = laneOfSlot(measure.slots, chord)
    if (!pairIsValid(lane, lane.indexOf(chord))) return null

    chord.tremoloPair = true
    if (!chord.tremolo) chord.tremolo = 3
    delete chord.fan // the third expansion stands down — see {@link setFan}
    return this.toFlatNote(chord, pitch)
  }

  /**
   * Set how a two-note tremolo's strokes MEET the stems — `'joined'` (stem tip to stem tip, like a
   * beam) or `'open'` (floating clear of both, the default).
   *
   * Refuses (returns null) unless the slot actually carries a pair AND that pair's drawn value is a
   * BLANCA — {@link pairAcceptsJoined}, the restriction MuseScore states. Refusing is the point: on a
   * drawn negra the joined strokes would read as two beamed corcheas, a different rhythm; on a
   * corchea or shorter the joining line is a real beam; a redonda has no stems to join. Writing the
   * field there and quietly ignoring it would leave a setting that does nothing and looks broken.
   *
   * `'open'` is stored rather than deleted when chosen explicitly — absent and `'open'` draw the same
   * today, but the field is the per-mark OVERRIDE of a project-wide default that does not exist yet
   * (§2), and "I chose open" will have to outrank that default when it does.
   */
  setTremoloPairStyle(noteId: string, style: 'joined' | 'open'): Note | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord, pitch } = found
    if (!chord.tremoloPair) return null

    const measure = this.score.measures.find(m => m.number === chord.measure)
    if (!measure) return null
    const lane = laneOfSlot(measure.slots, chord)
    const index = lane.indexOf(chord)
    if (!pairIsValid(lane, index) || !pairAcceptsJoined(lane, index)) return null

    chord.tremoloPairStyle = style
    return this.toFlatNote(chord, pitch)
  }

  /**
   * Does the two-note tremolo on `noteId` accept the `'joined'` stroke style? The read-only twin of
   * {@link setTremoloPairStyle}'s own gate, so the palette can dark its control without attempting an
   * edit to find out.
   */
  tremoloPairAcceptsJoined(noteId: string): boolean {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest' || !found.chord.tremoloPair) return false
    const measure = this.score.measures.find(m => m.number === found.chord.measure)
    if (!measure) return false
    const lane = laneOfSlot(measure.slots, found.chord)
    const index = lane.indexOf(found.chord)
    return pairIsValid(lane, index) && pairAcceptsJoined(lane, index)
  }

  /** The raw NotePitch behind a note id (chord head or FANNED MEMBER; rests have no pitch). */
  getNotePitch(noteId: string): NotePitch | null {
    const found = this.findSlot(noteId, { fanMembers: true })
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
    const clef = this.getEffectiveClefAt(chord.measure, chord.beat, chord.staffId)
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
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) {
      throw new Error(`Note ${noteId} not found`)
    }

    // ⭐ A FANNED MEMBER IS A PITCH, so a pitch is all it takes (docs/fanned-beam-pitches-plan.md
    // §2 P3). That is the whole of what P3 buys: `ArrowUp`/`ArrowDown`, `Ctrl+Arrow`, `a`–`g` and
    // the accidental stamp all route through here and write the spelling onto whichever pitch they
    // were handed, so they work on a member without knowing one exists.
    //
    // ⚠️ Everything else is REFUSED here rather than half-applied: the rhythm fields belong to the
    // slot (writing them would move the whole group), and a tie/slur/articulation attaches to the
    // whole gesture. The commands that own those refuse a member up front (`MusicEngine`'s
    // `isFanMember` guards) so nothing mints an undo entry either; this is the floor under them.
    if (found.type === 'chord' && found.member) {
      const { chord, pitch } = found
      if (updates.step !== undefined) pitch.step = updates.step
      if (updates.alter !== undefined) pitch.alter = updates.alter
      if (updates.octave !== undefined) pitch.octave = updates.octave
      if ('forceAccidental' in updates) pitch.forceAccidental = updates.forceAccidental
      const ignored = Object.keys(updates).filter(k => !FAN_MEMBER_UPDATE_FIELDS.has(k))
      if (ignored.length) dbg(`[Model.updateNote] fan member ${noteId}: ignored {${ignored.join(', ')}} — a member is a pitch`)
      return this.toFlatNote(chord, pitch)
    }

    const before = found.type === 'rest' ? found.rest : found.chord
    const changed = Object.keys(updates).filter(k => updates[k as keyof NoteParams] !== undefined || k in updates)
    dbg(`[Model.updateNote] ${fmtSlot(before)} ← {${changed.join(', ')}}`, updates)

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
          staffId: rest.staffId,  // ...and its staff — else it jumps to staff 0
          tupletId: updates.tupletId ?? rest.tupletId,
          actualDuration: rest.actualDuration,
          articulations: updates.articulations,
          articulationPlacement: updates.articulationPlacement,
          articulationStemAlign: updates.articulationStemAlign,
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
        // Stored ABSENT when off, like `beam: 'auto'` — the default costs nothing in JSON.
        if (updates.beamOver !== undefined) rest.beamOver = updates.beamOver || undefined
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
    if ('articulationStemAlign' in updates) chord.articulationStemAlign = updates.articulationStemAlign

    // Handle explicit undefined for tie fields
    if ('tiedTo' in updates && updates.tiedTo === undefined) pitch.tiedTo = undefined
    if ('tiedFrom' in updates && updates.tiedFrom === undefined) pitch.tiedFrom = undefined

    // Chord-level timing and style updates
    const oldActualDuration = chord.actualDuration
    if (updates.duration !== undefined) chord.duration = updates.duration
    if (updates.dots !== undefined) chord.dots = updates.dots
    if (updates.tupletId !== undefined) chord.tupletId = updates.tupletId
    if (updates.beat !== undefined) chord.beat = updates.beat
    if (updates.actualDuration !== undefined) chord.actualDuration = updates.actualDuration
    if (updates.stemDirection !== undefined) chord.stemDirection = updates.stemDirection === 'auto' ? undefined : updates.stemDirection
    if (updates.beam !== undefined) chord.beam = updates.beam === 'auto' ? undefined : updates.beam
    // Stored as ABSENT when off, like `beam: 'auto'` — the default costs nothing in JSON.
    if (updates.secondaryBreak !== undefined) chord.secondaryBreak = updates.secondaryBreak || undefined

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
        if (m) {
          chord.actualDuration = this.computeActualDurationForSlot(chord, m)
          // A chord lengthened in place now overlaps the rests that used to sit
          // in the space it grew into — evict them, or the bar goes overfull.
          if (oldActualDuration === undefined || fracGt(chord.actualDuration, oldActualDuration)) {
            this.evictRestsOverlappingChord(m, chord)
          }
        }
      }
    }

    return this.toFlatNote(chord, pitch)
  }

  /**
   * Turn the SLOT holding `noteId` into a rest of that slot's own duration, in place. Returns the
   * new rest, or null if `noteId` names nothing or is already a rest.
   *
   * A slot-level swap, NOT a delete-then-refill, and that is the whole point: `Chord` and `Rest`
   * already agree on every field that defines WHERE and HOW LONG a slot is (beat, duration, dots,
   * tupletId, actualDuration, voice, staffId), so the conversion copies them across and drops only
   * what is meaningless without pitches (the notes, stem, beam, articulations). A quarter note
   * becomes a quarter rest because it is the SAME SLOT wearing a different type — nothing re-derives
   * the duration, so nothing can round it to the meter's idea of a good rest. (Deleting instead
   * leaves a gap for `repairAllMeasureGaps` to re-fill meter-aware, which is right for a HOLE and
   * wrong here: the silence has an authored length.)
   *
   * Whole slot, every pitch, because a rest cannot hold pitches: "convert one head of a chord" has
   * no representation, exactly as "dot one head of a chord" doesn't (see the `dots` note in
   * EditorState). A chord of any size becomes ONE rest.
   *
   * Ties are handled per direction, mirroring `MusicEngine.deleteNote`'s let-ring rule:
   * arcs LEAVING (`tiedTo`) die, since a rest has nothing to carry into the next note; arcs ARRIVING
   * (`tiedFrom`) SURVIVE and re-point at the rest, so tying into a slot and silencing it lets the
   * previous note ring rather than silently dropping its arc.
   */
  convertToRest(noteId: string): Rest | null {
    const found = this.findSlot(noteId)
    if (!found || found.type === 'rest') return null
    const { chord } = found

    // Every arc LEAVING this chord dies with its pitches — clear the far end's back-pointer so no
    // note is left claiming a tie from a rest.
    for (const pitch of chord.notes) {
      if (pitch.tiedTo) {
        const partner = this.findSlot(pitch.tiedTo)
        if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
        else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
      }
    }

    // Arcs ARRIVING keep their shape and re-point onto the rest. Scan-based, not per-pitch
    // `tiedFrom`, so a chord tied into this one keeps EVERY arc (the same reason deleteNote scans).
    // The arcs are owned by the sources' `tiedTo`; the rest records one `tiedFrom` as bookkeeping.
    const restId = uuidv4()
    const tieSourceIds: string[] = []
    for (const measure of this.score.measures) {
      for (const slot of measure.slots) {
        if (slot.type !== 'chord') continue
        for (const p of slot.notes) {
          if (p.tiedTo && chord.notes.some(n => n.id === p.tiedTo)) {
            p.tiedTo = restId
            tieSourceIds.push(p.id)
          }
        }
      }
    }

    const rest: Rest = {
      id: restId,
      type: 'rest',
      beat: chord.beat,
      duration: chord.duration,
      measure: chord.measure,
      ...(chord.dots !== undefined && { dots: chord.dots }),
      ...(chord.voice !== undefined && { voice: chord.voice }),
      ...(chord.tupletId !== undefined && { tupletId: chord.tupletId }),
      ...(chord.actualDuration !== undefined && { actualDuration: chord.actualDuration }),
      ...(chord.staffId !== undefined && { staffId: chord.staffId }),
      ...(tieSourceIds.length > 0 && { tiedFrom: tieSourceIds[0] }),
    }

    for (const measure of this.score.measures) {
      const idx = measure.slots.findIndex(s => s.id === chord.id)
      if (idx !== -1) {
        dbg(`[Model.convertToRest] ${fmtSlot(chord)} → REST ${rest.duration}${rest.dots ? '.'.repeat(rest.dots) : ''} @b${fracToNumber(rest.beat).toFixed(3)}${tieSourceIds.length ? ` (${tieSourceIds.length} tie(s) re-pointed)` : ''}`)
        // In place, at the same index — the slot keeps its seat in the bar's order.
        measure.slots[idx] = rest
        return rest
      }
    }
    return null
  }

  /**
   * Delete a note
   */
  deleteNote(noteId: string): boolean {
    const found = this.findSlot(noteId, { fanMembers: true })
    if (!found) return false

    // ⭐ A FANNED MEMBER: the PITCH first, and the MEMBER when that was its last one. Removing one
    // pitch of a member that has several is an ordinary chord edit. Emptying it used to be REFUSED,
    // on the grounds that `fan.count` in Properties should be the only thing that changes the
    // group's size — but that made Delete dead on exactly the note you had selected, and "take this
    // one out of the fan" is a real edit with no other way to ask for it (his ask). So the last
    // pitch takes its member with it and the count comes down by one: the number and the members
    // stay in step, which is the invariant `normalizeFan` exists to hold.
    //
    // ⚠️ Only members 1…n — member 0 is the slot's OWN chord and is not in this branch at all.
    // Deleting the note you typed is deleting the EVENT (it falls through to the chord case below
    // and leaves a rest), because the fan is not a container the note sits in: it is a mark that
    // note wears.
    //
    // Down to one member the mark comes off entirely. A group of one is not a fan — there is no ramp
    // between a note and itself — and what is left is the note you typed, which is exactly what
    // `pressFan` leaves when it clears one.
    if (found.type === 'chord' && found.member) {
      const { chord, member, pitch } = found
      if (member.pitches.length > 1) {
        // ⚠️ The member's offset is keyed by its FIRST pitch ({@link offsetTargetOf}), so deleting
        // that pitch would leave the entry stranded at an id nothing resolves to any more and the
        // member would silently jump back to its natural place. The pitch goes; the assertion about
        // where the member sits does not.
        const wasKey = member.pitches[0].id === pitch.id
        member.pitches.splice(member.pitches.indexOf(pitch), 1)
        if (wasKey) this.moveNoteOffsetKey(pitch.id, member.pitches[0].id)
        dbg(`[Model.deleteNote] fan member ${member.index}: removed one pitch (${member.pitches.length} left)`)
        return true
      }
      const fan = chord.fan!
      this.clearFanMemberOffsets([member.pitches]) // its head is going: so is where it was put
      fan.members?.splice(member.index - 1, 1) // 1-based in the GROUP, 0-based in the list
      fan.count = Math.max(1, fan.count - 1)
      dbg(`[Model.deleteNote] fan member ${member.index} REMOVED → count ${fan.count}`)
      if (fan.count < 2) {
        delete chord.fan
        dbg(`[Model.deleteNote] …the last member went with it — fan removed`)
      }
      return true
    }

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
          dbg(`[Model.deleteNote] delete ${fmtSlot(rest)} → m${measure.number} now ${measure.slots.length - 1} slot(s)`)
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
          // Remove the whole chord slot — and with it any fan it wore, so its members' offsets go too.
          dbg(`[Model.deleteNote] delete whole chord ${fmtSlot(chord)} → m${measure.number} now ${measure.slots.length - 1} slot(s)`)
          this.clearFanMemberOffsets(chord.fan?.members)
          measure.slots.splice(idx, 1)
        } else {
          // Remove just this pitch from the chord
          dbg(`[Model.deleteNote] delete pitch ${pitch.step}${alterToString(pitch.alter)}${pitch.octave} from chord ${fmtSlot(chord)} (now ${chord.notes.length - 1} note(s))`)
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

    dbg(`[Model.moveNoteToVoice] ${pitch.step}${alterToString(pitch.alter)}${pitch.octave} (id ${pitch.id.slice(0, 8)}) v${from}→v${targetVoice} @ m${chord.measure} b${fracToNumber(chord.beat).toFixed(3)}`)

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
      // Articulations live on the SLOT, not the pitch — carry them so an accented note
      // keeps its accent across the voice move. Placement (the explicit `x` flip) is NOT
      // carried: it is voice-aware, so the new voice re-derives the correct auto side.
      articulations: chord.articulations,
      articulationStemAlign: chord.articulationStemAlign,
      // Beaming is a SLOT statement too, and unlike articulation placement it is not
      // voice-derived: `begin`/`continue`/`end`/`single` say how this note groups with its
      // neighbours, and moving the whole group to another voice keeps that grouping. Left
      // behind, an explicitly beamed run would silently fall back to auto beat groups.
      beam: chord.beam,
      secondaryBreak: chord.secondaryBreak,
      // Also a SLOT statement, and not voice-derived: which note you repeat and how finely says
      // nothing about which voice it is in, so the mark travels with the note.
      tremolo: chord.tremolo,
      // ⭐ The TWO-NOTE pair travels too — "I should be able to move what I marked". It is a
      // RELATION, so unlike the others it can arrive broken: moving one note of a pair and not the
      // other leaves nothing to alternate with. {@link dropStaleTremoloPairs}, run once the move (or
      // the whole batch) has settled, is what severs those — the same shape `dropCrossVoiceTies`
      // has for the other relation that cannot span voices.
      tremoloPair: chord.tremoloPair,
      tremoloPairStyle: chord.tremoloPairStyle,
      // A fan is a PROPERTY of the event like the tremolo, not a relation, so it simply comes along
      // — there is no partner it can be torn away from.
      fan: chord.fan,
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

    // A two-note tremolo the move tore in half. ONLY for a lone move: inside a batch the pair is
    // invalid between the two notes' moves, and `moveSelectionToVoice` prunes once the loop is done.
    if (!movingIds) this.dropStaleTremoloPairs(measure.number)
    return true
  }

  /**
   * Set (or clear) `beamOver` on the rest at a given beat/voice/staff.
   *
   * A rest does not itself move between voices — each voice fills its own — so when a beam group that
   * beams over an interior rest changes voice, the flag cannot ride the rest. The move carries it: it
   * captures where a beamed-over rest sat, and after the target voice has been refilled, re-applies the
   * flag to the fresh rest there ({@link MusicEngine.moveSelectionToVoice}). A no-op when no such rest
   * exists — a moved group may decompose its gap into different rests, and a missing target is not an
   * error. Called inside the move's `runBatch`, so no separate undo entry.
   */
  setRestBeamOver(measureNumber: number, beat: Fraction, voice: number, staff: number, value: boolean): void {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return
    const rest = measure.slots.find(s =>
      s.type === 'rest'
      && (s.voice ?? 0) === voice
      && staffIndexOfId(this.score, s.staffId) === staff
      && fracEq(s.beat, beat))
    if (rest?.type !== 'rest') return
    if (value) rest.beamOver = true
    else delete rest.beamOver
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
      articulations?: Chord['articulations']
      articulationStemAlign?: boolean
      beam?: BeamMode
      secondaryBreak?: boolean
      tremolo?: TremoloMark
      tremoloPair?: true
      tremoloPairStyle?: 'joined' | 'open'
      fan?: FanMark
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
      // Bring the moved note's articulations along only if the target chord has none of
      // its own (don't clobber marks the destination chord already carries).
      if (payload.articulations?.length && !existingChord.articulations?.length) {
        existingChord.articulations = [...payload.articulations]
      }
      // Same rule for the beam statement: the destination chord's own beaming wins.
      if (payload.beam && !existingChord.beam) existingChord.beam = payload.beam
      // And for the tremolo, for the same reason: a note has ONE, so the destination keeps its own.
      if (payload.tremolo && !existingChord.tremolo) existingChord.tremolo = payload.tremolo
      if (payload.tremoloPair && !existingChord.tremoloPair) {
        existingChord.tremoloPair = true
        if (payload.tremoloPairStyle) existingChord.tremoloPairStyle = payload.tremoloPairStyle
      }
      // The fan is the same kind of statement about the event, so it follows the same rule — and it
      // stands down in front of a tremolo the destination already carries, because the two cannot
      // both describe the same slot (`setFan`).
      // Cloned, not shared: the slot it came from may still exist (a chord keeps its fan when one of
      // its pitches leaves), and two live slots holding ONE members array means two heads with the
      // same pitch id — see {@link cloneFanFresh}.
      if (payload.fan && !existingChord.fan && !existingChord.tremolo) existingChord.fan = cloneFanFresh(payload.fan)
      if (payload.secondaryBreak && existingChord.secondaryBreak === undefined) {
        existingChord.secondaryBreak = true
      }
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
      dbg(`[Model.insertPitch] merge ${notePitch.step}${alterToString(notePitch.alter)}${notePitch.octave} → chord ${fmtSlot(existingChord)} (now ${existingChord.notes.length} note(s), dur ${existingChord.duration})`)
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
    if (payload.articulations?.length) chord.articulations = [...payload.articulations]
    if (payload.articulationStemAlign) chord.articulationStemAlign = true
    if (payload.beam) chord.beam = payload.beam
    if (payload.secondaryBreak) chord.secondaryBreak = true
    if (payload.tremolo) chord.tremolo = payload.tremolo
    if (payload.tremoloPair) chord.tremoloPair = true
    if (payload.tremoloPairStyle) chord.tremoloPairStyle = payload.tremoloPairStyle
    if (payload.fan) chord.fan = cloneFanFresh(payload.fan) // fresh member ids — see the merge branch
    if (targetVoice) chord.voice = targetVoice as 0 | 1 | 2 | 3
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)
    dbg(`[Model.insertPitch] new chord ${fmtSlot(chord)} → replacing v${targetVoice} rests`)
    this.replaceRestsWithChord(measure, chord)
  }

  /**
   * Sever every two-note tremolo in `measureNumber` that is no longer one — the model half of
   * docs/two-note-tremolo-plan.md §1's *"a broken pair is DROPPED, not carried"*.
   *
   * Draw-time validation already keeps a stale flag from being DRAWN, and the plan is explicit that
   * this is not enough on its own: the dead flag sits in the JSON and silently comes back to life the
   * day a note of the right length lands next to it again. The relay gets the drop for free (a
   * `RebarEvent` has no such field); every other structural edit needs this.
   *
   * ⚠️ CALL IT ONCE THE EDIT HAS SETTLED, never mid-batch. Moving both notes of a pair moves them one
   * at a time, so between the two the pair is genuinely invalid — pruning there would kill a mark
   * that is about to be whole again. Hence the callers: a single move prunes at its end, and
   * `moveSelectionToVoice` prunes after its loop.
   *
   * Takes the STYLE with the flag, for the same reason removing the mark does: a style with no pair
   * is a setting for a mark that is not there.
   */
  dropStaleTremoloPairs(measureNumber: number): void {
    const measure = this.getMeasure(measureNumber)
    if (!measure) return
    for (const slot of measure.slots) {
      if (slot.type !== 'chord' || !slot.tremoloPair) continue
      const lane = laneOfSlot(measure.slots, slot)
      if (pairIsValid(lane, lane.indexOf(slot))) continue
      delete slot.tremoloPair
      delete slot.tremoloPairStyle
    }
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
        dbg(`[Model.dropCrossVoiceTies] dropped tiedTo (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
      }
    }
    if (pitch.tiedFrom) {
      const partner = this.findSlot(pitch.tiedFrom)
      // A tie's source is always a chord pitch (a rest can't start a tie).
      const partnerVoice = partner?.type === 'chord' ? (partner.chord.voice ?? 0) : undefined
      if (partnerVoice !== voice && !movingIds?.has(pitch.tiedFrom)) {
        if (partner?.type === 'chord') partner.pitch.tiedTo = undefined
        pitch.tiedFrom = undefined
        dbg(`[Model.dropCrossVoiceTies] dropped tiedFrom (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
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
        dbg(`[Model.resyncSlurVoice] slur ${slur.id.slice(0, 8)} voice ${slur.voice ?? 0}→${sv}`)
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
    const { startBeat, baseDuration, baseDots, numNotes, notesOccupied } = sourceTuplet
    // Slot spacing is the ACTUAL (scaled) duration, not the written baseDuration.
    const slot = tupletSlotDuration(sourceTuplet)
    const span = tupletSpan(sourceTuplet)
    const spanEnd = fracAdd(startBeat, span)

    // Relative slot index of the moved note within the tuplet grid.
    const rawIdx = Math.round(fracToNumber(fracSub(chord.beat, startBeat)) / fracToNumber(slot))
    const idx = rawIdx >= 0 && rawIdx < numNotes ? rawIdx : 0

    dbg(`[Model.moveTupletNoteToVoice] ${pitch.step}${alterToString(pitch.alter)}${pitch.octave} slot ${idx}/${numNotes} v${from}→v${targetVoice} @ m${measure.number} tuplet b${fracToNumber(startBeat).toFixed(3)}`)

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

    // Create the matching tuplet in the target voice, on the note's OWN staff (a
    // voice-move stays on the same staff), so a staff-1 note doesn't drop to staff 0.
    const targetStaffId = chord.staffId
    const targetStaff = staffIndexOfId(this.score, targetStaffId)
    const targetTuplet = this.createTuplet(measure.number, startBeat, baseDuration, numNotes, notesOccupied, targetVoice, targetStaff, baseDots)

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
      if (targetStaffId !== undefined) newChord.staffId = targetStaffId
      // The moved note's own beam statement rides along (same reason as the plain path);
      // the target voice's pre-existing notes are re-poured, so theirs is not carried.
      if (g === idx) {
        if (chord.beam) newChord.beam = chord.beam
        if (chord.secondaryBreak) newChord.secondaryBreak = true
      }
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

    // A two-note tremolo the move tore in half. ONLY for a lone move: inside a batch the pair is
    // invalid between the two notes' moves, and `moveSelectionToVoice` prunes once the loop is done.
    if (!movingIds) this.dropStaleTremoloPairs(measure.number)
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
    staff: number = 0,
    baseDots: number = 0,
    normal?: { duration: NoteDuration; dots?: number; count?: number },
  /** How the group is DRAWN — mark style, bracket, bracket end. Absent, and every field inside it
   *  absent, means "the renderer's own rules". See {@link TupletFormat}. */
  format?: TupletFormat,
  ): Tuplet {
    return tupletOps.createTuplet(this.score, measureNumber, startBeat, baseDuration, numNotes, notesOccupied, voice, staff, baseDots, normal, format)
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
  getTupletAtBeat(measureNumber: number, beat: Fraction, voice?: number, staff?: number): Tuplet | undefined {
    return tupletOps.getTupletAtBeat(this.score, measureNumber, beat, voice, staff)
  }

  /**
   * True if a same-voice tuplet already overlaps the span starting at `startBeat`.
   * See {@link tupletOps.tupletSpanOverlaps}.
   */
  tupletSpanOverlaps(measureNumber: number, startBeat: Fraction, totalBeats: Fraction, voice: number, staff?: number): boolean {
    return tupletOps.tupletSpanOverlaps(this.score, measureNumber, startBeat, totalBeats, voice, staff)
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
    this.checkMeasuresWellFormed()
  }

  /**
   * Assert every measure is rhythmically well-formed: for each staff-lane and each
   * voice present (voice 0 always), the slots' actual durations sum to EXACTLY the
   * bar's capacity. Capacity is {@link measureCapacityFrac} — the very length
   * {@link fillGapsWithRests} fills up to — so pickups, odd meters, and tuplets
   * (whose fractional `actualDuration` is summed directly) are all handled for free.
   *
   * A mismatch is never something the user can cause; it means a WRITE PATH left the
   * bar over- or under-full and gap-repair could not heal it — the classic example
   * being a chord lengthened in place over its neighbours (see
   * {@link evictRestsOverlappingChord}). fillGaps only *adds* rests into holes; it
   * cannot remove an overlap, so an overfull bar survives repair and lands here.
   *
   * This is a DETECTOR, not a repair. It runs once per committed change, right after
   * {@link repairAllMeasureGaps}, so the model is in its final shape. In the browser
   * it logs (with the exact bar / staff / voice / delta so the culprit edit's own
   * `[Model.*]` traces sit right above it); under test it throws — turning this whole
   * class of bug into a red test instead of a screenshot someone happens to notice.
   */
  private checkMeasuresWellFormed(): void {
    const staves = this.score.staves ?? []
    const laneMatches: Array<string | undefined> =
      staves.length > 0 ? staves.map(s => s.id) : [undefined]

    for (const measure of this.score.measures) {
      const cap = measureCapacityFrac(measure)
      for (const laneMatch of laneMatches) {
        const laneSlots = measure.slots.filter(s => matchesStaff(s.staffId, laneMatch, this.score))

        // Voice 0 is always a stream (an empty lane must show as under-full, not be
        // skipped) — then add every other voice actually present in the lane.
        const voices = new Set<number>([0])
        for (const s of laneSlots) voices.add(s.voice ?? 0)

        for (const voice of voices) {
          const sum = laneSlots
            .filter(s => (s.voice ?? 0) === voice)
            .reduce(
              (acc, s) => fracAdd(acc, s.actualDuration ?? durationToFraction(s.duration, s.dots ?? 0)),
              fracCreate(0, 1),
            )
          if (!fracEq(sum, cap)) {
            const staffLabel = laneMatch !== undefined ? ` staff${staffIndexOfId(this.score, laneMatch)}` : ''
            const delta = fracToNumber(fracSub(sum, cap))
            const msg =
              `[integrity] m${measure.number}${staffLabel} v${voice}: slots sum to ` +
              `${fracToNumber(sum)} beats, bar capacity is ${fracToNumber(cap)} ` +
              `(Δ ${delta > 0 ? '+' : ''}${delta} — ${delta > 0 ? 'OVERFULL' : 'underfull'})`
            console.error(msg)
            if (STRICT_INVARIANTS) throw new Error(msg)
          }
        }
      }
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

    // The staff axis: a live model always carries a `staves` array. Hand-written /
    // pre-multi-staff JSON may omit it — default to one staff (N=1). This is defaulting,
    // NOT a migration (no legacy scores exist in the wild); content with absent `staffId`
    // resolves to this staff. See docs/multi-staff-plan.md §4.
    if (!scoreData.staves || scoreData.staves.length === 0) {
      scoreData.staves = [{ id: uuidv4() }]
    }

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
   * signature (or an invalid additive grouping) on any measure. Guards the only
   * entry point a bad meter can take, since `TimeSignature` itself permits any
   * integers.
   */
  private static validateMeters(score: Score): void {
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
  // SPREAD, then deep-copy the one field that is a reference. Listing the fields by hand is what
  // silently dropped `symbol`: the meter reached the model as 4/4 with a C on it and was stored as
  // a bare 4/4, so the ghost drew C and the score drew 4/4. Every field added to TimeSignature from
  // here on survives this function without anyone remembering to come back to it.
  return ts.grouping ? { ...ts, grouping: [...ts.grouping] } : { ...ts }
}
