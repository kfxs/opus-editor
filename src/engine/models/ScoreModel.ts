import { dbg } from '@/utils/debug'
import { isTestRun } from '@/utils/env'
import type { PitchInsert, Score, Measure, Note, NoteParams, TimeSignature, Tuplet, TupletFormat, NoteDuration, ChordRest, Chord, Rest, NotePitch, PitchAlter, PitchStep, Clef, Dynamic, Hairpin, Ottava, Pedal, TempoMark, Slur, Trill, TrillContinuationLabel, StaffInfo, StaffGroup, EngravingOverride, CurveControlPointDeltas, SlurSegmentAddress, SlurSegmentEndpointAddress, CautionaryOverride, CautionaryClefOverride, TremoloMark, FanMark } from '@/types/music'
import { engravingOverridesOf, engravingOverrideOf, cautionaryKey, cautionaryAllowedOf, cautionaryClefKey, cautionaryClefAllowedOf } from './engravingOverrides'
import { tupletSpan, tupletScale, noteSpansOverlapFrac, splitBeatsIntoDurations } from '@/utils/musicUtils'
import { measureCapacityFrac, getMeasureDurationFrac } from '@/utils/measureCapacity'
import { durationToFraction, slotLength, writtenLength } from '@/utils/durations'
import {
  getMeterInfo,
  isValidTimeSignature,
  effectiveTimeSignature,
  sameTimeSignature,
} from '@/utils/meter'
import { fillRests, type RestSlot } from '@/utils/restFill'
import { beamRoleAtRef, type BeamRole } from '@/utils/beaming'
import { cloneFanFresh, chordStoredPitches, fanMemberPitches, fanMemberBeats } from '@/utils/fannedBeam'
import { alterToString } from '@/utils/pitchSpelling'
import type { Clip, ClipTarget } from '@/utils/clip'
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
import { effectiveClefAt, measureOpeningClef } from '@/utils/clefUtils'
import * as clefOps from './clefOps'
import * as rebarOps from './rebarOps'
import * as overrideOps from './overrideOps'
import * as slurOps from './slurOps'
import * as trillOps from './trillOps'
import type { TrillAuxiliary } from '@/utils/trillPitch'
import * as hairpinOps from './hairpinOps'
import * as ottavaOps from './ottavaOps'
import * as pedalOps from './pedalOps'
import * as markOps from './markOps'
import * as fanCollapse from './fanCollapse'
import * as voiceOps from './voiceOps'
import * as staffSizeOps from './staffSize'
import { isValidStaffSize } from './staffSize'
import { flatNoteOf, flatRestOf } from './noteProjection'
import { findSlot, writeAttackMarks, projectAttackMarks, type FoundSlot } from './slotLookup'
import { staffIndexOfId, matchesStaff, staffIdAtIndex, firstStaffId } from './staffContent'
import * as tupletOps from './tupletOps'
import { measureDynamics, resolveActiveLevel } from '@/utils/dynamics'
import { tempoMarks, effectiveTempoAt, MIN_BPM, MAX_BPM } from '@/utils/tempoMap'
import { v4 as uuidv4 } from 'uuid'
import { voiceOf } from '@/utils/lanes'

// The region-rewrite machinery (rebar / paste) and its captured-state types now live in
// ./rebarOps. What a paste TAKES — the `Clip` and where it lands — is core material and lives
// in @/utils/clip, so callers import it from there rather than through this class.


/**
 * Compact, voice-tagged one-line summary of a slot for debug logs, e.g.
 * `v0 C4+E4 q m1 b0.000` (a chord) or `v1 REST h. m2 b1.500`. Voice always
 * shown (even default 0) because the multi-voice paths are the sensitive ones.
 */
function fmtSlot(slot: ChordRest): string {
  const v = voiceOf(slot)
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
 * What {@link ScoreModel.updateNote} will write onto a FANNED MEMBER — its spelling, and its own
 * articulations. Named so the ignored-field trace can name what it dropped rather than saying "some
 * fields"; the rule itself is stated at the branch.
 *
 * ⭐ `articulations` joined the list when members stopped sharing the slot's (his ask): a fan is how
 * you write N attacks, and an articulation belongs to an attack. Everything still absent from this
 * set is absent on purpose — the rhythm fields belong to the slot (writing one would move the whole
 * group) and a TIE is a pitch-to-pitch continuation a member has no length to continue into.
 */
const FAN_MEMBER_UPDATE_FIELDS = new Set(['step', 'alter', 'octave', 'forceAccidental', 'articulations', 'articulationPlacement'])

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
      actualDuration: rest.isMeasureRest ? measureCapacityFrac(measure) : writtenLength(rest),
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
    this.repairDanglingTrills()
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

  // ==================== Hairpin operations ====================
  //
  // Thin delegators to `hairpinOps` (the clefOps/slurOps idiom) — the logic is a SCORE
  // operation and lives in the score layer, reachable with no renderer and no editor.
  // See docs/dynamics-line-and-hairpins-plan.md §6a, principle 5.

  /** Add a hairpin starting at (measure, beat) covering `length` of music; null if the measure
   *  does not exist or the length is not positive. See {@link hairpinOps.addHairpin}. */
  addHairpin(measureNumber: number, hairpin: Omit<Hairpin, 'id'>): Hairpin | null {
    return hairpinOps.addHairpin(this.score, measureNumber, hairpin)
  }

  /** Create a hairpin covering `start` through the END of `end` (a note plus its own length).
   *  Idempotent. See {@link hairpinOps.addHairpinOverNotes}. */
  addHairpinOverNotes(
    type: Hairpin['type'],
    start: { measure: number; beat: Fraction },
    end: { measure: number; beat: Fraction; length: Fraction },
    lane?: { voice?: 0 | 1 | 2 | 3; staffId?: string },
  ): Hairpin | null {
    return hairpinOps.addHairpinOverNotes(this.score, type, start, end, lane)
  }

  /** Remove a hairpin by id (and any override keyed to it). @returns true if one was removed. */
  removeHairpin(id: string): boolean {
    return hairpinOps.removeHairpin(this.score, id)
  }

  /** Edit a hairpin by id. @returns the updated Hairpin, or null if missing. */
  updateHairpin(id: string, updates: Partial<Omit<Hairpin, 'id'>>): Hairpin | null {
    return hairpinOps.updateHairpin(this.score, id, updates)
  }

  /** Set how much music a hairpin covers (the model write behind `Ctrl+←/→`, NOT an override —
   *  see {@link hairpinOps.setHairpinLength}). @returns true if it exists and was updated. */
  setHairpinLength(id: string, length: Fraction): boolean {
    return hairpinOps.setHairpinLength(this.score, id, length)
  }

  /** Grow (+1) or shrink (−1) a hairpin by one slot of its own lane — the model write behind
   *  `Ctrl+←/→`. See {@link hairpinOps.resizeHairpinBySlot}. */
  resizeHairpinBySlot(id: string, direction: 1 | -1): boolean {
    return hairpinOps.resizeHairpinBySlot(this.score, id, direction)
  }

  /** Move a hairpin's START back (−1) or in (+1) by one slot of its own lane, HOLDING ITS END —
   *  `beat` and `length` written together. See {@link hairpinOps.moveHairpinStartBySlot}. */
  moveHairpinStartBySlot(id: string, direction: 1 | -1): boolean {
    return hairpinOps.moveHairpinStartBySlot(this.score, id, direction)
  }

  /** Put a hairpin's START on the lane slot at `target`, holding its END (the left square's DRAG).
   *  See {@link hairpinOps.setHairpinStartAtSlot}. */
  setHairpinStartAtSlot(id: string, target: hairpinOps.HairpinSlotTarget): boolean {
    return hairpinOps.setHairpinStartAtSlot(this.score, id, target)
  }

  /** Put a hairpin's END at the right edge of the lane slot at `target`, holding its start (the
   *  right square's DRAG). See {@link hairpinOps.setHairpinEndAtSlot}. */
  setHairpinEndAtSlot(id: string, target: hairpinOps.HairpinSlotTarget): boolean {
    return hairpinOps.setHairpinEndAtSlot(this.score, id, target)
  }

  /** Apply one frame of a hairpin-square drag. See {@link hairpinOps.applyHairpinDrag}. */
  applyHairpinDrag(id: string, write: hairpinOps.HairpinDragWrite): boolean {
    return hairpinOps.applyHairpinDrag(this.score, id, write)
  }

  /** Nudge one drawn END of a hairpin (the wedge's RESHAPE — an override, not the extent), in
   *  staff-spaces, accumulating. See {@link hairpinOps.setHairpinEndpointOffset}. */
  setHairpinEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    return hairpinOps.setHairpinEndpointOffset(this.score, id, which, dx, dy)
  }

  /** Move the WHOLE wedge by a staff-space delta — both ends at once, accumulating.
   *  See {@link hairpinOps.setHairpinOffset}. */
  setHairpinOffset(id: string, dx: number, dy: number): boolean {
    return hairpinOps.setHairpinOffset(this.score, id, dx, dy)
  }

  /** Drop both ends' reshapes at once. See {@link hairpinOps.resetHairpinOffset}. */
  resetHairpinOffset(id: string): boolean {
    return hairpinOps.resetHairpinOffset(this.score, id)
  }

  /** Drop ONE end's reshape, keeping the other's. See {@link hairpinOps.resetHairpinEndpointOffset}. */
  resetHairpinEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    return hairpinOps.resetHairpinEndpointOffset(this.score, id, which)
  }

  /** Set (or clear with `null`) a hairpin's hand-set mouth, in staff-spaces.
   *  See {@link hairpinOps.setHairpinAperture}. */
  setHairpinAperture(id: string, aperture: number | null): boolean {
    return hairpinOps.setHairpinAperture(this.score, id, aperture)
  }

  /** Flip a hairpin between crescendo and diminuendo. @returns the new type, or null. */
  toggleHairpinType(id: string): 'cresc' | 'dim' | null {
    return hairpinOps.toggleHairpinType(this.score, id)
  }

  /** The hairpins STARTING in a measure, sorted by beat (empty if none or no such measure). */
  getHairpins(measureNumber: number): Hairpin[] {
    const measure = this.getMeasure(measureNumber)
    return measure ? hairpinOps.measureHairpins(measure) : []
  }

  /** Find a hairpin anywhere in the score by id (live reference), or null. */
  getHairpinById(id: string): Hairpin | null {
    return hairpinOps.getHairpinById(this.score, id)
  }

  // ==================== Ottava operations ====================
  //
  // Thin delegators to `ottavaOps` — the hairpin block above with ONE rule changed: an ottava
  // UPSERTS per (beat, staff), where a hairpin stacks. See docs/ottava-plan.md §4.

  /** Add an octave line starting at (measure, beat) covering `length` of music, REPLACING any
   *  ottava already on that (beat, staff). Null if the measure is missing or the length is not
   *  positive. See {@link ottavaOps.addOttava}. */
  addOttava(measureNumber: number, ottava: Omit<Ottava, 'id'>): Ottava | null {
    return ottavaOps.addOttava(this.score, measureNumber, ottava)
  }

  /** Create an octave line covering `start` through the END of `end` (a note plus its own length).
   *  See {@link ottavaOps.addOttavaOverNotes}. */
  addOttavaOverNotes(
    shift: Ottava['shift'],
    start: { measure: number; beat: Fraction },
    end: { measure: number; beat: Fraction; length: Fraction },
    staffId?: string,
  ): Ottava | null {
    return ottavaOps.addOttavaOverNotes(this.score, shift, start, end, staffId)
  }

  /** Remove an ottava by id (and any override keyed to it). @returns true if one was removed. */
  removeOttava(id: string): boolean {
    return ottavaOps.removeOttava(this.score, id)
  }

  /** Edit an ottava by id. @returns the updated Ottava, or null if missing. */
  updateOttava(id: string, updates: Partial<Omit<Ottava, 'id'>>): Ottava | null {
    return ottavaOps.updateOttava(this.score, id, updates)
  }

  /** Flip an octave line between alta and bassa — 8va ↔ 8vb (see
   *  {@link ottavaOps.toggleOttavaDirection}, which negates the shift and so keeps the distance).
   *  ⚠️ A CONTENT edit: it moves what the covered notes SOUND. @returns the new shift, or null. */
  toggleOttavaDirection(id: string): Ottava['shift'] | null {
    return ottavaOps.toggleOttavaDirection(this.score, id)
  }

  /** Set how much music an ottava covers (the MODEL, not an override — see
   *  {@link ottavaOps.setOttavaLength}). @returns true if it exists and was updated. */
  setOttavaLength(id: string, length: Fraction): boolean {
    return ottavaOps.setOttavaLength(this.score, id, length)
  }

  /** Re-anchor an ottava's END by one slot of its STAFF (every voice) — see
   *  {@link ottavaOps.resizeOttavaBySlot}. @returns true if it changed. */
  resizeOttavaBySlot(id: string, direction: 1 | -1): boolean {
    return ottavaOps.resizeOttavaBySlot(this.score, id, direction)
  }

  /** Move an ottava's BEGINNING by one slot of its STAFF, holding its end — see
   *  {@link ottavaOps.moveOttavaStartBySlot}. @returns true if it changed. */
  moveOttavaStartBySlot(id: string, direction: 1 | -1): boolean {
    return ottavaOps.moveOttavaStartBySlot(this.score, id, direction)
  }

  /** Nudge one drawn END of an ottava, accumulating — ⭐ `outward` (a distance FROM THE STAFF) lands
   *  on the WHOLE bracket, since it is a straight line. See {@link ottavaOps.setOttavaEndpointOffset}. */
  setOttavaEndpointOffset(id: string, which: 'start' | 'end', dx: number, outward: number): boolean {
    return ottavaOps.setOttavaEndpointOffset(this.score, id, which, dx, outward)
  }

  /** Drop the armed square's nudge — that end's `x` AND the shared `y`. @returns false when it
   *  carries none. See {@link ottavaOps.resetOttavaEndpointOffset}. */
  resetOttavaEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    return ottavaOps.resetOttavaEndpointOffset(this.score, id, which)
  }

  /** Apply one frame of an ottava endpoint-square DRAG — see {@link ottavaOps.applyOttavaDrag}. */
  applyOttavaDrag(id: string, write: ottavaOps.OttavaDragWrite): boolean {
    return ottavaOps.applyOttavaDrag(this.score, id, write)
  }

  /** The ottavas STARTING in a measure, sorted by beat (empty if none or no such measure). */
  getOttavas(measureNumber: number): Ottava[] {
    const measure = this.getMeasure(measureNumber)
    return measure ? ottavaOps.measureOttavas(measure) : []
  }

  /** Find an ottava anywhere in the score by id (live reference), or null. */
  getOttavaById(id: string): Ottava | null {
    return ottavaOps.getOttavaById(this.score, id)
  }

  /** The two (measure, beat) addresses an ottava covers — the MUSICAL span, not the drawn one.
   *  See {@link ottavaOps.ottavaSpan}. */
  getOttavaSpan(id: string): ottavaOps.OttavaSpan | null {
    return ottavaOps.ottavaSpan(this.score, id)
  }

  // ==================== Sustain pedal operations ====================
  //
  // Thin delegators to `pedalOps` — the ottava block above with the SHIFT dropped and one rule
  // added: overlap is a contradiction, and it is the ENTRY door (`addPedalOverNotes`) that resolves
  // it, never `addPedal`. See docs/pedal-plan.md §3.3.

  /** Add a sustain pedal starting at (measure, beat) holding `length` of music, REPLACING any pedal
   *  already on that (beat, staff). Null if the measure is missing or the length is not positive.
   *  See {@link pedalOps.addPedal}. */
  addPedal(measureNumber: number, pedal: Omit<Pedal, 'id'>): Pedal | null {
    return pedalOps.addPedal(this.score, measureNumber, pedal)
  }

  /** Put a pedal under `start` through the END of `end` (a note plus its own length), lifting any
   *  pedal that was still down. See {@link pedalOps.addPedalOverNotes}. */
  addPedalOverNotes(
    start: { measure: number; beat: Fraction },
    end: { measure: number; beat: Fraction; length: Fraction },
    staffId?: string,
  ): Pedal | null {
    return pedalOps.addPedalOverNotes(this.score, start, end, staffId)
  }

  /** Remove a pedal by id (and any override keyed to it). @returns true if one was removed. */
  removePedal(id: string): boolean {
    return pedalOps.removePedal(this.score, id)
  }

  /** Edit a pedal by id. @returns the updated Pedal, or null if missing. */
  updatePedal(id: string, updates: Partial<Omit<Pedal, 'id'>>): Pedal | null {
    return pedalOps.updatePedal(this.score, id, updates)
  }

  /** Move the LIFT — set how much music a pedal holds (the MODEL, not an override; see
   *  {@link pedalOps.setPedalLength}). @returns true if it exists and was updated. */
  setPedalLength(id: string, length: Fraction): boolean {
    return pedalOps.setPedalLength(this.score, id, length)
  }

  /** Move the LIFT by one slot of the pedal's STAFF — the model write behind `Ctrl+←/→`. See
   *  {@link pedalOps.resizePedalBySlot}. */
  resizePedalBySlot(id: string, direction: 1 | -1): boolean {
    return pedalOps.resizePedalBySlot(this.score, id, direction)
  }

  /** The pedals STARTING in a measure, sorted by beat (empty if none or no such measure). */
  getPedals(measureNumber: number): Pedal[] {
    const measure = this.getMeasure(measureNumber)
    return measure ? pedalOps.measurePedals(measure) : []
  }

  /** Find a pedal anywhere in the score by id (live reference), or null. */
  getPedalById(id: string): Pedal | null {
    return pedalOps.getPedalById(this.score, id)
  }

  /** The two (measure, beat) addresses a pedal covers — press and lift.
   *  See {@link pedalOps.pedalSpan}. */
  getPedalSpan(id: string): pedalOps.PedalSpan | null {
    return pedalOps.pedalSpan(this.score, id)
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
    return slurOps.getSlurs(this.score)
  }

  /** Add a slur; returns the stored Slur (with a generated id). */
  addSlur(slur: Omit<Slur, 'id'>): Slur {
    return slurOps.addSlur(this.score, slur)
  }

  /** Remove a slur by id. @returns true if one was removed. */
  removeSlur(id: string): boolean {
    return slurOps.removeSlur(this.score, id)
  }

  /** Find a slur by its exact (directional) endpoints, or undefined. */
  findSlurByEndpoints(startNoteId: string, endNoteId: string): Slur | undefined {
    return slurOps.findSlurByEndpoints(this.score, startNoteId, endNoteId)
  }

  /** Find a slur anywhere by id (live reference), or null. */
  getSlurById(id: string): Slur | null {
    return slurOps.getSlurById(this.score, id)
  }

  /** Set (or clear) a slur's user-edited curve shape. See {@link slurOps.setSlurShape} for the why. */
  setSlurShape(id: string, cps: CurveControlPointDeltas | null): boolean {
    return slurOps.setSlurShape(this.score, id, cps)
  }

  /** Re-anchor one end of a slur onto a different note (used by the draggable endpoint handles). See {@link slurOps.setSlurEndpoint} for the why. */
  setSlurEndpoint(id: string, which: 'start' | 'end', noteId: string): boolean {
    return slurOps.setSlurEndpoint(this.score, id, which, noteId)
  }

  /**
   * Nudge one endpoint of a slur by a staff-space delta, **accumulating** onto any existing offset
   * (the in/out keyboard fine-positioning — see docs/slur-endpoint-offset-plan.md).
   *  See {@link slurOps.setSlurEndpointOffset} for the why. */
  setSlurEndpointOffset(id: string, which: 'start' | 'end', dx: number, dy: number): boolean {
    return slurOps.setSlurEndpointOffset(this.score, id, which, dx, dy)
  }

  /**
   * Set (or clear) the shape of ONE segment of a cross-system slur (BEGIN, END, or a MIDDLE
   * addressed by ordinal).
   *  See {@link slurOps.setSlurSegmentShape} for the why. */
  setSlurSegmentShape(
    id: string,
    segment: SlurSegmentAddress,
    cps: CurveControlPointDeltas | null,
    spanCount: number,
  ): boolean {
    return slurOps.setSlurSegmentShape(this.score, id, segment, cps, spanCount)
  }

  /**
   * Nudge one OPEN join of a cross-system slur by a staff-space delta, **accumulating** onto any
   * existing offset (keyboard fine-positioning — see docs/multisystem-slur-segment-endpoint-offset-
   * plan.md).
   *  See {@link slurOps.setSlurSegmentEndpointOffset} for the why. */
  setSlurSegmentEndpointOffset(
    id: string,
    address: SlurSegmentEndpointAddress,
    dx: number, dy: number,
    spanCount: number,
  ): boolean {
    return slurOps.setSlurSegmentEndpointOffset(this.score, id, address, dx, dy, spanCount)
  }

  /**
   * Drop a slur's hand-edited ARC shape — one segment's, or every one it carries.
   *  See {@link slurOps.resetSlurShape} for the why (and why false ≠ "missing"). */
  resetSlurShape(id: string, segment?: SlurSegmentAddress, spanCount?: number): boolean {
    return slurOps.resetSlurShape(this.score, id, segment, spanCount)
  }

  /** Drop ONE true end's nudge, keeping the other's. See {@link slurOps.resetSlurEndpointOffset}. */
  resetSlurEndpointOffset(id: string, which: 'start' | 'end'): boolean {
    return slurOps.resetSlurEndpointOffset(this.score, id, which)
  }

  /** Drop ONE open join's nudge, keeping the other joins'.
   *  See {@link slurOps.resetSlurSegmentEndpointOffset}. */
  resetSlurSegmentEndpointOffset(id: string, address: SlurSegmentEndpointAddress, spanCount: number): boolean {
    return slurOps.resetSlurSegmentEndpointOffset(this.score, id, address, spanCount)
  }

  /**
   * Nudge a rest's manual vertical shift by `delta` whole staff-steps, **accumulating** onto any
   * existing shift (the ↑/↓ keyboard fine-positioning — see docs/rest-shift-plan.md).
   *  See {@link overrideOps.nudgeRestShift} for the why. */
  nudgeRestShift(posKey: string, delta: number): boolean {
    return overrideOps.nudgeRestShift(this.score, posKey, delta)
  }

  /**
   * Set the user-authored **leading space** before one rhythmic column (client #10 — see docs/note-
   * spacing-plan.md), in staff-spaces, signed.
   *  See {@link overrideOps.setNoteSpacing} for the why. */
  setNoteSpacing(posKey: string, space: number, minSpace: number): number {
    return overrideOps.setNoteSpacing(this.score, posKey, space, minSpace)
  }

  /**
   * Set the authored space between a bar's last element and its barline, in staff-spaces.
   *  See {@link overrideOps.setBarlineSpace} for the why. */
  setBarlineSpace(key: string, space: number, minSpace: number): number {
    return overrideOps.setBarlineSpace(this.score, key, space, minSpace)
  }

  /**
   * Set a bar's authored **stretch** — the multiplier on its own note space (client #11 — see
   * docs/bar-width-plan.md).
   *  See {@link overrideOps.setBarWidth} for the why. */
  setBarWidth(key: string, stretch: number, minStretch: number): number {
    return overrideOps.setBarWidth(this.score, key, stretch, minStretch)
  }

  /**
   * Nudge a dynamic's manual position offset by `(dx, dy)` staff-spaces, **accumulating** onto any
   * existing offset (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see docs/dynamic-offset-
   * plan.md).
   *  See {@link overrideOps.nudgeDynamicOffset} for the why. */
  nudgeDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
    return overrideOps.nudgeDynamicOffset(this.score, dynamicId, dx, dy)
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
   * offset (the Ctrl+arrow keyboard fine-positioning — see docs/note-offset-plan.md).
   *  See {@link overrideOps.nudgeNoteOffset} for the why. */
  nudgeNoteOffset(key: string, dx: number): boolean {
    return overrideOps.nudgeNoteOffset(this.score, key, dx)
  }

  /** first-class reset — see docs/note-offset-plan.md). See {@link overrideOps.clearNoteOffset} for the why. */
  clearNoteOffset(key: string): boolean {
    return overrideOps.clearNoteOffset(this.score, key)
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
    return overrideOps.toggleRestHidden(this.score, posKey)
  }

  /**
   * Nudge a staff's extra "space above" by `delta` staff-spaces, **accumulating** onto any existing
   * value (the Sibelius-style Alt+↑/↓ vertical staff drag — see docs/staff-spacing-plan.md).
   *  See {@link overrideOps.nudgeStaffSpacing} for the why. */
  nudgeStaffSpacing(staffId: string, delta: number): boolean {
    return overrideOps.nudgeStaffSpacing(this.score, staffId, delta)
  }

  /** Set a staff's extra "space above" to an absolute `above` (staff-spaces). See {@link overrideOps.setStaffSpacing} for the why. */
  setStaffSpacing(staffId: string, above: number): boolean {
    return overrideOps.setStaffSpacing(this.score, staffId, above)
  }

  /**
   * Reset a staff to default spacing (Layout → Reset Space Above): drops any {@link
   * StaffSpacingOverride} on this `staffId`.
   *  See {@link overrideOps.resetStaffSpacing} for the why. */
  resetStaffSpacing(staffId: string): boolean {
    return overrideOps.resetStaffSpacing(this.score, staffId)
  }

  /** Set how big a staff is DRAWN, as a ratio (`1` full size, `0.7` a small staff); `1` clears the
   *  field. Refuses a non-positive size or an unknown staff. See {@link staffSizeOps.setStaffSize}. */
  setStaffSize(staffId: string, size: number): boolean {
    return staffSizeOps.setStaffSize(this.score, staffId, size)
  }

  // ============ Engraving overrides (authored-geometry compartment) ============
  // A separate id-addressed compartment for hand-positioning data (staff-space,
  // anchor-relative), kept OUT of the musical content model. It is a sub-tree of
  // `Score` (`score.engravingOverrides`), so it clones / serializes / undoes with
  // the score value for free. Phase 0 was infrastructure only — storage + accessors +
  // JSON round-trip; a slur's hand-edited shape is client #1 (`curveShape`, Phase 1).
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
   * Upsert an override: replaces any existing entry of the same `kind` on this element, otherwise
   * appends.
   *  See {@link overrideOps.setEngravingOverride} for the why. */
  setEngravingOverride(elementId: string, override: EngravingOverride): void {
    overrideOps.setEngravingOverride(this.score, elementId, override)
  }

  /** Clear overrides on an element: just one `kind` when given, else ALL overrides for the element. See {@link overrideOps.clearEngravingOverride} for the why. */
  clearEngravingOverride(elementId: string, kind?: string): boolean {
    return overrideOps.clearEngravingOverride(this.score, elementId, kind)
  }

  /**
   * The interpreted dynamic level in effect at (measure, beat) for a voice.
   * Delegates to the shared resolver in utils/dynamics (walk-back reference).
   */
  getActiveLevel(measureNumber: number, beat: Fraction, voice: number = 0) {
    return resolveActiveLevel(this.score, measureNumber, beat, voice)
  }

  // ==================== Trills (top-level note-anchored ornament spans) ====================

  /** All trills (the live array; empty if none). See {@link Trill}. */
  getTrills(): Trill[] {
    return trillOps.getTrills(this.score)
  }

  /** Add a trill — idempotent, and refused on a rest or a fanned member. See {@link trillOps.addTrill}. */
  addTrill(trill: Omit<Trill, 'id'>): Trill | null {
    return trillOps.addTrill(this.score, trill)
  }

  /** Remove a trill by id. @returns true if one was removed. */
  removeTrill(id: string): boolean {
    return trillOps.removeTrill(this.score, id)
  }

  /** Find a trill anywhere by id (live reference), or null. */
  getTrillById(id: string): Trill | null {
    return trillOps.getTrillById(this.score, id)
  }

  /** The trill whose sign sits on this note, or undefined. A note carries at most one. */
  trillOnNote(startNoteId: string): Trill | undefined {
    return trillOps.trillOnNote(this.score, startNoteId)
  }

  /** Re-anchor a trill's END (null = back to the one-note trill). See {@link trillOps.setTrillEnd}. */
  setTrillEnd(id: string, noteId: string | null): boolean {
    return trillOps.setTrillEnd(this.score, id, noteId)
  }

  /** Set how a continuation system labels a trill. See {@link trillOps.setTrillContinuationLabel}. */
  setTrillContinuationLabel(id: string, label: TrillContinuationLabel): boolean {
    return trillOps.setTrillContinuationLabel(this.score, id, label)
  }

  /** Flip a trill between above and below the staff. @returns the new side. */
  toggleTrillPlacement(id: string): 'above' | 'below' | null {
    return trillOps.toggleTrillPlacement(this.score, id)
  }

  /** What music a trill actually covers, right now. See {@link trillOps.trillSpan}. */
  trillSpan(id: string): trillOps.TrillSpan | null {
    return trillOps.trillSpan(this.score, id)
  }

  /** What a trill alternates WITH — derived, never stored. See {@link trillOps.trillAuxiliaryOf}. */
  trillAuxiliaryOf(id: string): TrillAuxiliary | null {
    return trillOps.trillAuxiliaryOf(this.score, id)
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
   * Overwrite-paste a {@link Clip} at `target`. Thin delegator to {@link rebarOps.pasteEvents},
   * which owns the region-rewrite pipeline. Returns the ids of the flat notes that landed
   * inside the paste window (for selecting the pasted material).
   */
  pasteEvents(clip: Clip, target: ClipTarget): string[] {
    return rebarOps.pasteEvents(this.score, this.rebarDeps, clip, target)
  }

  /**
   * The ScoreModel callbacks the {@link rebarOps} free functions call back into — bound here so
   * the region-rewrite machinery can live outside this class without losing the few methods it
   * shares with the rest of the model (measure insertion, gap-fill, engraving overrides, tie /
   * slur repair). Built per call; rebar is not a hot path.
   */
  /** The ScoreModel callbacks the {@link voiceOps} free functions call back into — bound here for
   *  the same reason {@link rebarDeps} is: rest-fill and pitch insertion are note-entry machinery a
   *  voice move uses but does not own. */
  private get voiceDeps(): voiceOps.VoiceDeps {
    return {
      fillGapsWithRests: (m) => this.fillGapsWithRests(m),
      insertPitch: (m, payload) => this.insertPitch(m, payload),
      refillTupletRemainder: (n, t, voice) => this.refillTupletRemainder(n, t, voice),
    }
  }

  private get rebarDeps(): rebarOps.RebarDeps {
    return {
      insertMeasureAfter: (afterNumber, ts) => this.insertMeasureAfter(afterNumber, ts),
      addMeasure: (ts) => this.addMeasure(ts),
      fillGapsWithRests: (m) => this.fillGapsWithRests(m),
      collapseEmptyVoices: (n) => this.collapseEmptyVoices(n),
      pushRestSlot: (m, rest, voice, staffId) => this.pushRestSlot(m, rest, voice, staffId),
      staffIdForParams: (staff) => this.staffIdForParams(staff),
      addSlur: (slur) => this.addSlur(slur),
      addTrill: (trill) => this.addTrill(trill),
      findSlot: (id) => this.findSlot(id),
      setEngravingOverride: (id, override) => this.setEngravingOverride(id, override),
      clearEngravingOverride: (id, kind) => this.clearEngravingOverride(id, kind),
      repairDanglingTies: () => this.repairDanglingTies(),
      repairDanglingSlurs: () => this.repairDanglingSlurs(),
      repairDanglingTrills: () => this.repairDanglingTrills(),
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
          // ⭐ `chordStoredPitches` includes the FANNED MEMBERS, and a member can anchor a slur
          // (docs/fanned-beam-pitches-plan.md) — a slur is a SPAN between two points, and member 2 →
          // member 5 is a span. Leave them out and every such slur is silently dropped the next time
          // this defensive pass runs.
          for (const p of chordStoredPitches(s)) ids.add(p.id)
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

  /**
   * Drop any trill whose START note is no longer in the score — the defensive BELT behind
   * `rebarOps`' {@link restoreTrills}, exactly as {@link repairDanglingSlurs} is the belt behind
   * `restoreSlurs`.
   *
   * ⚠️⚠️ **This is not how a trill survives a re-bar, and reading it as such would delete the
   * feature in use.** A re-bar re-mints every note id in the region, so if this sweep were the only
   * thing that ran, every meter change and every paste would silently remove every trill it touched.
   * The trill is CAPTURED before the ids go and RE-FOUND afterwards by (onset offset + pitch +
   * voice); this only cleans up what genuinely could not be re-found. See docs/trill-plan.md §2.1.
   *
   * ⭐ A dangling END degrades rather than drops: the sign is still true and only the line's length
   * was in doubt, so the field is cleared and the trill becomes the one-note trill. Dropping the
   * whole object because its far end went would lose a mark the user can still see a reason for.
   *
   * ⛔ FANNED MEMBERS are deliberately NOT in the id set, unlike `repairDanglingSlurs`' — a trill
   * refuses to anchor to one in the first place (`trillOps.addTrill`), so an id that resolves only
   * as a member is one this sweep should be dropping.
   */
  private repairDanglingTrills(): void {
    const trills = this.score.trills
    if (!trills || trills.length === 0) return
    const ids = new Set<string>()
    for (const m of this.score.measures) {
      for (const s of m.slots) {
        if (s.type === 'chord') for (const p of s.notes) ids.add(p.id)
      }
    }
    for (let i = trills.length - 1; i >= 0; i--) {
      const trill = trills[i]
      if (!ids.has(trill.startNoteId)) {
        trills.splice(i, 1)
        this.clearEngravingOverride(trill.id) // auto-reset (§3.3): the sign's own note is gone
      } else if (trill.endNoteId !== undefined && !ids.has(trill.endNoteId)) {
        delete trill.endNoteId
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
  private findSlot(noteId: string, opts?: { fanMembers?: boolean }): FoundSlot | undefined {
    return findSlot(this.score, noteId, opts)
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
    const total = slotLength(chord)
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
    return flatNoteOf(this.score, chord, pitch)
  }

  /** Assemble a flat Note from a Rest, resolving its `staffId` to a staff index. */
  private restToFlatNote(rest: Rest): Note {
    return flatRestOf(this.score, rest)
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
    const noteVoice = voiceOf(params)
    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, params.beat) && voiceOf(s) === noteVoice
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
          slotLength(existing)
        const overlaps =
          voiceOf(existing) === voice &&
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
    const incomingDurFrac = slotLength(incoming)
    const incomingVoice = voiceOf(incoming)
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
    const chordDurFrac = slotLength(chord)
    const chordVoice = voiceOf(chord)

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
      for (const slot of laneSlots) voices.add(voiceOf(slot))

      for (const voice of voices) {
        const voiceSlots = laneSlots
          .filter(slot => voiceOf(slot) === voice)
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
          const slotDurFrac = slotLength(slot)
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
   *
   * ⭐ …and a fan made by COLLAPSING a passage (`fanCollapse`) spans what that passage spanned,
   * which need not be writable as one value: seven sixteenths is a dotted quarter tied to a
   * sixteenth. The span is authored on the MARK ({@link FanMark.length}) precisely so it can be
   * derived here rather than trusted from the wire — `fromJSON` recomputes every slot's.
   */
  private computeActualDurationForSlot(slot: ChordRest | { duration: NoteDuration; dots?: number; tupletId?: string; isMeasureRest?: boolean }, measure: Measure): Fraction {
    if ('isMeasureRest' in slot && slot.isMeasureRest) {
      return measureCapacityFrac(measure)
    }
    if ('fan' in slot && slot.fan?.length) return slot.fan.length
    const base = writtenLength(slot)
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
      // ⭐ A member's marks are ITS OWN, not the slot's. `toFlatNote` projects through the chord, so
      // without this every member would report member 0's — which is what made one staccato look
      // like six, and would make the palette's "do they all have it?" answer yes for heads that
      // carry nothing. Projected from the ATTACK, so a mark field added to that type arrives here.
      projectAttackMarks(note, found.member.chord)
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
        .filter(s => matchesStaff(s.staffId, slot.staffId, this.score) && voiceOf(s) === voiceOf(slot))
        .sort((a, b) => fracCompare(a.beat, b.beat)),
      meter: getMeterInfo(measure.timeSignature),
    }))
    return beamRoleAtRef(bars, { bar: measureIndex, slot: bars[measureIndex].slots.indexOf(slot) })
  }

  /** Flip the side (above/below) of the articulations on the slot containing `noteId`. See {@link markOps.flipArticulationPlacement} for the why. */
  flipArticulationPlacement(noteId: string): Note | null {
    return markOps.flipArticulationPlacement(this.score, noteId)
  }

  /**
   * Set whether the slot's stem-side articulations align to the stem (modern) rather than the
   * notehead (traditional default).
   *  See {@link markOps.setArticulationStemAlign} for the why. */
  setArticulationStemAlign(noteId: string, align: boolean): Note | null {
    return markOps.setArticulationStemAlign(this.score, noteId, align)
  }

  /** Set — or with `null`, remove — the single-note tremolo on the slot containing `noteId`. See {@link markOps.setTremolo} for the why. */
  setTremolo(noteId: string, tremolo: TremoloMark | null): Note | null {
    return markOps.setTremolo(this.score, noteId, tremolo)
  }

  /**
   * Set — or with `null`, remove — the FANNED (feathered) beam on the slot containing `noteId`:
   * "play this one event as N notes, speeding up (or slowing down) across exactly its own duration".
   *  See {@link markOps.setFan} for the why. */
  setFan(noteId: string, fan: FanMark | null): Note | null {
    const result = markOps.setFan(this.score, noteId, fan)
    // ⭐ Removing a COLLAPSED fan (`fanCollapse`) hands time BACK to the bar: the slot sounded for
    // the seven sixteenths its mark claimed and is written as a dotted quarter, so a sixteenth of
    // silence appears where the group ended. Closing it is the bar's own rule, not the mark's — the
    // same rest-fill every other shortening edit ends with. A no-op for a fan that never had a span.
    if (result && fan === null) this.fillMeasureGaps(result.measure)
    return result
  }

  /**
   * ⭐ Collapse a selected PASSAGE into one fanned slot — same total length, one attack per slot, at
   * the pitches you typed. The other way to make a fan, and the mirror of {@link setFan}: that one
   * marks a note as a group, this one turns a group into a note that is marked.
   *  See {@link fanCollapse.collapseIntoFan} for the why, and for what it refuses. */
  collapseIntoFan(noteIds: string[], direction: 'accel' | 'rit'): Note | null {
    return fanCollapse.collapseIntoFan(this.score, noteIds, direction)
  }

  /** Set — or with `false`, remove — the TWO-NOTE tremolo on the slot containing `noteId`. See {@link markOps.setTremoloPair} for the why. */
  setTremoloPair(noteId: string, on: boolean): Note | null {
    return markOps.setTremoloPair(this.score, noteId, on)
  }

  /**
   * Set how a two-note tremolo's strokes MEET the stems — `'joined'` (stem tip to stem tip, like a
   * beam) or `'open'` (floating clear of both, the default).
   *  See {@link markOps.setTremoloPairStyle} for the why. */
  setTremoloPairStyle(noteId: string, style: 'joined' | 'open'): Note | null {
    return markOps.setTremoloPairStyle(this.score, noteId, style)
  }

  /** Does the two-note tremolo on `noteId` accept the `'joined'` stroke style? See {@link markOps.tremoloPairAcceptsJoined} for the why. */
  tremoloPairAcceptsJoined(noteId: string): boolean {
    return markOps.tremoloPairAcceptsJoined(this.score, noteId)
  }

  /** The raw NotePitch behind a note id (chord head or FANNED MEMBER; rests have no pitch). */
  getNotePitch(noteId: string): NotePitch | null {
    const found = this.findSlot(noteId, { fanMembers: true })
    return found && found.type === 'chord' ? found.pitch : null
  }

  /** Set the explicit tie-curve direction (-1 up / +1 down) on the tie starting at
   *  `fromNoteId`. No-op (returns false) if the id isn't a chord head with a tie. */
  setTieDirection(fromNoteId: string, direction: -1 | 1): boolean {
    return markOps.setTieDirection(this.score, fromNoteId, direction)
  }

  /** Remove any explicit tie-curve override on `fromNoteId` (revert to auto). */
  clearTieDirection(fromNoteId: string): void {
    markOps.clearTieDirection(this.score, fromNoteId)
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
    // slot (writing them would move the whole group), and a tie is a pitch-to-pitch continuation a
    // member has no length of its own to continue into. The commands that own those refuse a member
    // up front (`MusicEngine`'s `isFanMember` guards) so nothing mints an undo entry either; this is
    // the floor under them.
    if (found.type === 'chord' && found.member) {
      const { chord, pitch } = found
      if (updates.step !== undefined) pitch.step = updates.step
      if (updates.alter !== undefined) pitch.alter = updates.alter
      if (updates.octave !== undefined) pitch.octave = updates.octave
      if ('forceAccidental' in updates) pitch.forceAccidental = updates.forceAccidental
      // ⭐ The MEMBER's own marks, on the member's own record — not on `chord`, which is member 0's.
      // Absent rather than empty when there are none: `laneFingerprint` stringifies the slot for the
      // width-cache key, so `[]` and absent would be two keys for one piece of music.
      // The marks go on the ATTACK, which for a member is the member — same writer the ordinary
      // chord branch below uses, so the two cannot drift.
      writeAttackMarks(found.member.chord, updates)
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
    writeAttackMarks(chord, updates)
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
        if (wasKey) overrideOps.moveNoteOffsetKey(this.score, pitch.id, member.pitches[0].id)
        dbg(`[Model.deleteNote] fan member ${member.index}: removed one pitch (${member.pitches.length} left)`)
        return true
      }
      const fan = chord.fan!
      overrideOps.clearFanMemberOffsets(this.score, [member.chord]) // its head is going: so is where it was put
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
          overrideOps.clearFanMemberOffsets(this.score, chord.fan?.members)
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
   * Drop any secondary voice (model voice ≠ 0) in a measure that has no notes left — only rests — so
   * the bar reverts to a single stream.
   *  See {@link voiceOps.collapseEmptyVoices} for the why. */
  collapseEmptyVoices(measureNumber: number): void {
    voiceOps.collapseEmptyVoices(this.score, measureNumber)
  }

  /**
   * Move a single plain note's pitch into another voice, **preserving its `pitch.id`** so
   * ties/slurs/articulations/selection all stay anchored to it (see the move-note-to-voice plan §2 —
   * choice B, mutate in place).
   *  See {@link voiceOps.moveNoteToVoice} for the why. */
  moveNoteToVoice(pitchId: string, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
    return voiceOps.moveNoteToVoice(this.score, this.voiceDeps, pitchId, targetVoice, movingIds)
  }

  /** Set (or clear) `beamOver` on the rest at a given beat/voice/staff. See {@link markOps.setRestBeamOver} for the why. */
  setRestBeamOver(measureNumber: number, beat: Fraction, voice: number, staff: number, value: boolean): void {
    markOps.setRestBeamOver(this.score, measureNumber, beat, voice, staff, value)
  }

  /**
   * Insert a pitch into a measure at a given beat/voice, **reusing the supplied
   * `pitch.id`** (unlike {@link addNote}, which always mints a fresh uuid). Mirrors
   * addNote's two branches: merge into a same-beat/same-voice chord, or build a
   * new chord and clear the target-voice rest via {@link replaceRestsWithChord}.
   * Used by {@link moveNoteToVoice} so a moved note keeps its anchored ties/slurs.
   */
  private insertPitch(measure: Measure, payload: PitchInsert): void {
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

    // The target slot is addressed by the whole LANE — (staff, voice) — not by the voice alone:
    // on a two-staff score both staves have a voice 1, and a beat-matched chord on the other
    // staff is a different stream, not a collision to merge into.
    const existingChord = measure.slots.find(
      (s): s is Chord => s.type === 'chord' && fracEq(s.beat, payload.beat) && voiceOf(s) === targetVoice
        && matchesStaff(s.staffId, payload.staffId, this.score),
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
        const incomingFrac = writtenLength(payload)
        const existingFrac = writtenLength(existingChord)
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
    if (payload.staffId !== undefined) chord.staffId = payload.staffId
    chord.actualDuration = this.computeActualDurationForSlot(chord, measure)
    dbg(`[Model.insertPitch] new chord ${fmtSlot(chord)} → replacing v${targetVoice} rests`)
    this.replaceRestsWithChord(measure, chord)
  }

  /**
   * Sever every two-note tremolo in `measureNumber` that is no longer one — the model half of
   * docs/two-note-tremolo-plan.md §1's *"a broken pair is DROPPED, not carried"*.
   *  See {@link markOps.dropStaleTremoloPairs} for the why. */
  dropStaleTremoloPairs(measureNumber: number): void {
    markOps.dropStaleTremoloPairs(this.score, measureNumber)
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
    for (const s of measure.slots) voices.add(voiceOf(s))
    for (const voice of voices) {
      const vs = measure.slots
        .filter(s => voiceOf(s) === voice)
        .sort((a, b) => fracCompare(a.beat, b.beat))
      if (vs.length === 0) continue
      let cursor = fracCreate(0, 1)
      for (const s of vs) {
        if (!fracEq(s.beat, cursor)) {
          problems.push(`v${voice}: slot at b${fracToNumber(s.beat).toFixed(3)} expected b${fracToNumber(cursor).toFixed(3)} (gap/overlap)`)
        }
        const dur = slotLength(s)
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
        for (const s of laneSlots) voices.add(voiceOf(s))

        for (const voice of voices) {
          const sum = laneSlots
            .filter(s => voiceOf(s) === voice)
            .reduce(
              (acc, s) => fracAdd(acc, slotLength(s)),
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

    // Same reason, for the staff axis: `StaffInfo.size` is a plain `number` in the type, and a
    // zero or negative one is a scale that divides the whole render. REPORT it, never repair it —
    // silently clamping a hand-written 0 to 1 would make the file and the picture disagree.
    ScoreModel.validateStaffSizes(scoreData)

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

  /**
   * Reject a loaded score whose staff carries a size that is not a drawable ratio. Guards the only
   * entry point such a value can take: {@link setStaffSize} refuses one, and absent means 1.
   */
  private static validateStaffSizes(score: Score): void {
    for (const s of score.staves ?? []) {
      if (s.size !== undefined && !isValidStaffSize(s.size)) {
        throw new Error(`Invalid staff size ${s.size} on staff ${s.id}: must be a positive ratio (1 = full size).`)
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
