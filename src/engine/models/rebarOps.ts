/**
 * The region-rewrite machinery over a `Score` — extracted from {@link ScoreModel}, which
 * keeps thin delegators (`setTimeSignature` → `rebarRegion`, `pasteEvents`) to these free
 * functions. This is the meter-change / paste engine: capture the beat-anchored state that
 * a rebar would destroy (boundary ties, slurs, clef/dynamic/tempo anchors, rest shifts),
 * flatten each (staff, voice) lane against the OLD meter, relay it under the NEW meter,
 * materialise the new bars, then re-attach everything by absolute offset + pitch.
 *
 * Every function takes the `score` it operates on plus a {@link RebarDeps} bundle of the
 * ScoreModel callbacks it needs (measure insertion, gap-fill, engraving-override accessors,
 * …) — no shared instance state, matching the `clefOps` / `tupletOps` idiom. Pure code
 * motion out of ScoreModel; the rebar / paste / time-signature test suites are the net.
 */
import type {
  Score, Measure, Note, Chord, NotePitch, Rest, TimeSignature, Clef, Dynamic, TempoMark,
  Slur, EngravingOverride, RestShiftOverride, RestHiddenOverride, DynamicOffsetOverride,
} from '@/types/music'
import { restShiftOverrideOf, restHiddenOf, restPositionKey, dynamicOffsetOverrideOf } from './engravingOverrides'
import { durationToFraction } from '@/utils/durations'
import { getMeterInfo } from '@/utils/meter'
import type { RestSlot } from '@/utils/restFill'
import { flattenRegion, relayEvents, type RebarPiece, type RebarEvent, type BarPlan } from '@/utils/rebar'
import { type Fraction, fracCreate, fracAdd, fracSub, fracCompare, fracLt, fracGte } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/musicUtils'
import { staffIndexOfId, matchesStaff, staffIdAtIndex, keyStaffId, staffMeasureView } from './staffContent'
import { v4 as uuidv4 } from 'uuid'

// ==================== Callback surface + captured-state types ====================

/** The slot lookup result `findSlot` returns (only the chord case is used by rebar). */
type FindSlotResult =
  | { type: 'chord'; chord: Chord; pitch: NotePitch }
  | { type: 'rest'; rest: Rest }

/**
 * The ScoreModel operations the rebar machinery calls back into — the "few callbacks" the
 * clefOps/tupletOps idiom passes, bundled because rebar needs a dozen. Each is a real
 * ScoreModel method used elsewhere too, so it stays there and is threaded in here.
 */
export interface RebarDeps {
  insertMeasureAfter(afterNumber: number, timeSignature?: TimeSignature): Measure
  addMeasure(timeSignature?: TimeSignature): Measure
  fillGapsWithRests(measure: Measure): void
  collapseEmptyVoices(measureNumber: number): void
  pushRestSlot(measure: Measure, rest: RestSlot, voice: number, staffId?: string): void
  staffIdForParams(staff: number | undefined): string | undefined
  addSlur(slur: Omit<Slur, 'id'>): Slur
  findSlot(noteId: string): FindSlotResult | undefined
  setEngravingOverride(elementId: string, override: EngravingOverride): void
  clearEngravingOverride(elementId: string, kind?: string): boolean
  repairDanglingTies(): void
  repairDanglingSlurs(): void
}

/**
 * A beat-anchored annotation (clef change, dynamic or tempo mark) snapshotted before a
 * rebar, keyed by its absolute beat offset from the region start so it can be re-anchored
 * into the new bar layout. See {@link captureBeatAnchors}.
 */
type CapturedAnchor =
  | { kind: 'clef'; absBeat: Fraction; clef: Clef; staffId?: string }
  | { kind: 'dynamic'; absBeat: Fraction; dyn: Dynamic; offset?: { x: number; y: number } }
  | { kind: 'tempo'; absBeat: Fraction; mark: TempoMark }

/**
 * A clipboard dynamic handed to {@link pasteEvents} for re-anchoring at paste time.
 * Structurally identical to the interaction-layer `ClipDynamic`, but declared here so the
 * engine never imports inward (the framework-agnostic boundary). Staff is RELATIVE (0 = topmost
 * copied staff); `offset` is relative to the clip start. See docs/copy-paste-staff-plan.md P2.
 */
export type ClipDynamicInput = {
  staff: number
  voice: number
  offset: Fraction
  /** The mark's whole text (SMuFL glyphs + words); the level travels inside it. See {@link Dynamic.text}. */
  text: string
  placement?: 'above' | 'below'
  /** Hand-nudged engraving offset (client #8), captured at copy so it travels with the mark. */
  engravingOffset?: { x: number; y: number }
}

/** A pitch identity used to re-find a clip slur endpoint on the pasted notes. */
type ClipSlurPitchInput = { step: string; alter: number; octave: number }

/**
 * A clipboard slur handed to {@link pasteEvents} for re-anchoring at paste time.
 * Structurally identical to the interaction-layer `ClipSlur` (declared here so the engine
 * never imports inward). Each endpoint is RELATIVE staff (0 = topmost copied staff) / voice /
 * clip-relative offset / pitch. See docs/copy-paste-staff-plan.md P3.
 */
export type ClipSlurInput = {
  startStaff: number; startVoice: number; startOffset: Fraction; startPitch: ClipSlurPitchInput
  endStaff: number;   endVoice: number;   endOffset: Fraction;   endPitch: ClipSlurPitchInput
  placement?: 'above' | 'below'
}

/**
 * A rest's manual vertical shift snapshotted before a rebar/paste, keyed by its absolute
 * beat offset from the region start (per voice) so it can travel into the new bar layout.
 * The position-keyed twin of {@link CapturedAnchor}. See {@link captureRestShifts}.
 */
type CapturedRestShift = { voice: number; staffId?: string; absBeat: Fraction; steps: number; hidden: boolean }

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
 * ids are regenerated. See {@link captureSlurs}.
 */
type CapturedSlur = { slur: Slur; start: CapturedSlurEnd; end: CapturedSlurEnd }

// ==================== Small local helpers ====================

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/** Deep-copy a time signature, including any additive grouping array. */
function copyTimeSignature(ts: TimeSignature): TimeSignature {
  // SPREAD, then deep-copy the one field that is a reference. Listing the fields by hand is what
  // silently dropped `symbol`: the meter reached the model as 4/4 with a C on it and was stored as
  // a bare 4/4, so the ghost drew C and the score drew 4/4. Every field added to TimeSignature from
  // here on survives this function without anyone remembering to come back to it.
  return ts.grouping ? { ...ts, grouping: [...ts.grouping] } : { ...ts }
}

// ==================== Public entry points ====================

/**
 * Re-bar the region starting at `fromMeasure` under the new meter `ts`. The region runs to
 * the next explicit TS change (or score end); overflow GROWS the region in place (pushing
 * that next change forward) rather than cramming.
 */
export function rebarRegion(score: Score, deps: RebarDeps, fromMeasure: number, ts: TimeSignature): void {
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
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
  const boundary = captureBoundaryTies(score, regionMeasures)

  // Capture slurs anchored inside the region before ids are regenerated, so they can
  // be re-attached to the rebar'd notes (otherwise they'd dangle and vanish).
  const slurState = captureSlurs(score, regionMeasures)

  // Capture beat-anchored annotations (clef changes + dynamics) by their ABSOLUTE
  // offset from the region start, using the OLD capacities — before the meter is
  // overwritten below. They are re-anchored after rebar (see restoreBeatAnchors).
  const anchors = captureBeatAnchors(score, deps, regionMeasures)

  // Capture manual rest shifts the same way — by absolute region-relative offset, before
  // rest-fill regenerates every rest with a fresh id. Re-stamped after materialise.
  const restShifts = captureRestShifts(score, deps, regionMeasures)

  // Rebar runs one lane per (STAFF, voice): each staff is an independent stream on the
  // shared bar spine, exactly like each voice. Flattening the whole measure per-voice
  // (the pre-multi-staff path) merged every staff's notes into one stream — a TS change
  // then collapsed staff 2's music onto staff 1. Narrow each region measure to the staff
  // first (staffMeasureView filters slots+tuplets) so flattenRegion stays staff-agnostic.
  const staffIndices = (score.staves ?? []).length > 0
    ? (score.staves ?? []).map((_, i) => i)
    : [0]

  // Flatten EVERY (staff, voice) lane against the CURRENT (old) meter — this MUST happen
  // before the meter overwrite, because flattenRegion reads each measure's timeSignature
  // to compute offsets.
  const laneEvents: Array<{ staff: number; voice: number; events: RebarEvent[] }> = []
  for (const staff of staffIndices) {
    const staffId = staffIdAtIndex(score, staff)
    const narrowed = regionMeasures.map(m => staffMeasureView(m, staffId, score))
    const voices = new Set<number>([0])
    for (const nm of narrowed) for (const s of nm.slots) voices.add(s.voice ?? 0)
    for (const v of voices) {
      laneEvents.push({ staff, voice: v, events: flattenRegion(narrowed, v as 0 | 1 | 2 | 3) })
    }
  }

  // Apply the new meter to every region measure. Re-barring rewrites bars to
  // nominal length, so any pickup override on a rewritten bar is cleared (v1).
  for (const m of regionMeasures) {
    m.timeSignature = copyTimeSignature(ts)
    delete m.actualDurationOverride
  }

  // Relay EACH lane against the NEW meter. Always grow (bounded: false): overflow
  // becomes MORE bars, never crammed. The region grows to the LONGEST lane's plan.
  const meter = getMeterInfo(ts)
  const lanes: Array<{ staff: number; voice: number; plan: BarPlan[] }> = []
  let maxBars = targetBars
  for (const lane of laneEvents) {
    const plan = relayEvents(lane.events, meter, { targetBars, bounded: false })
    lanes.push({ staff: lane.staff, voice: lane.voice, plan })
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
    deps.insertMeasureAfter(lastRegionNumber + i, ts)
  }

  // The region now occupies a contiguous run of `maxBars` bars from fromMeasure.
  const regionNumbers: number[] = []
  for (let i = 0; i < maxBars; i++) regionNumbers.push(fromMeasure + i)

  // Materialise every (staff, voice) lane additively (clear-once → per-lane fill → collapse).
  materializeRegion(score, deps, regionNumbers, lanes)

  // Re-barring regenerated the region's slot ids, so a tie that crossed the
  // region boundary now points at a deleted id. Re-attach it to the rebar'd
  // note at the boundary (same pitch/position); anything unrestorable is then
  // severed so no pointer is left dangling (would crash tie editing).
  restoreBoundaryTies(score, deps, fromMeasure, regionNumbers[regionNumbers.length - 1], boundary)
  deps.repairDanglingTies()

  // Re-attach captured slurs to the rebar'd notes (by onset offset + pitch); drop any
  // that can't be re-found, so none is left pointing at a regenerated/deleted id.
  restoreSlurs(score, deps, regionNumbers, slurState)
  deps.repairDanglingSlurs()

  // Re-anchor the captured clef changes / dynamics into the new bar layout,
  // mapping each absolute offset to the (measure, beat) it now lands on.
  restoreBeatAnchors(score, deps, regionNumbers, anchors)

  // Re-stamp the captured rest shifts onto whatever rest now starts at each offset
  // (dropped where the new tiling has no rest start — plan §4).
  restoreRestShifts(score, deps, regionNumbers, restShifts)
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
export function pasteEvents(
  score: Score,
  deps: RebarDeps,
  targetMeasure: number,
  targetBeat: Fraction,
  clipLanes: { staff: number; voice: number; events: RebarEvent[] }[],
  spanBeats: Fraction,
  targetVoice: number,
  clipRestShifts: { staff: number; voice: number; restShifts: Array<{ offset: Fraction; steps: number }> }[] = [],
  clipRestHidden: { staff: number; voice: number; restHidden: Array<{ offset: Fraction }> }[] = [],
  targetStaff: number = 0,
  clipDynamics: ClipDynamicInput[] = [],
  clipSlurs: ClipSlurInput[] = [],
): string[] {
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
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

  const boundary = captureBoundaryTies(score, regionMeasures)
  const slurState = captureSlurs(score, regionMeasures)
  const anchors = captureBeatAnchors(score, deps, regionMeasures)
  // Preserve the destination's own rest shifts across the rebar (those outside the paste
  // window survive; ones whose rest the paste overwrites are dropped). The clip's shifts
  // are stamped ON TOP afterwards (last wins) — see §6.5 threading.
  const restShifts = captureRestShifts(score, deps, regionMeasures)

  const staffIndices = (score.staves ?? []).length > 0
    ? (score.staves ?? []).map((_, i) => i)
    : [0]
  const staffCount = staffIndices.length

  // Re-voicing contract (decision (a)): a clip with exactly ONE distinct voice (across all its
  // staff lanes) drops into the paste target voice (so copy voice 1 → paste into voice 2 works);
  // a multi-voice clip preserves each event's original voice.
  const singleVoice = new Set(clipLanes.map((l) => l.voice)).size === 1

  // Map each RELATIVE-staff lane onto an ABSOLUTE staff: `absStaff = targetStaff + lane.staff`,
  // clamped to the score's staff count. Lanes past the bottom staff are DROPPED + warned — a
  // paste never creates or reorders staves (decision: clamp+warn). `destByStaff[absStaff]` maps
  // that staff's destination voice → the clip events that overwrite its paste window.
  const destByStaff = new Map<number, Map<number, RebarEvent[]>>()
  for (const lane of clipLanes) {
    const absStaff = targetStaff + lane.staff
    if (absStaff < 0 || absStaff >= staffCount) {
      console.warn(`[Paste] clip lane relStaff ${lane.staff} → staff ${absStaff} out of range [0,${staffCount}); dropped`)
      continue
    }
    const destVoice = singleVoice ? targetVoice : lane.voice
    if (!destByStaff.has(absStaff)) destByStaff.set(absStaff, new Map())
    destByStaff.get(absStaff)!.set(destVoice, lane.events)
  }

  // Overwrite semantics for dynamics (Phase 2): a captured destination dynamic that falls inside
  // the paste window ON A DESTINATION (staff, voice) lane is dropped here so the clip's dynamics
  // replace it (rather than stacking). Dynamics outside the window, or on passthrough lanes,
  // survive via the normal restoreBeatAnchors path below.
  const survivingAnchors = anchors.filter((a) => {
    if (a.kind !== 'dynamic') return true
    const inWindow = fracGte(a.absBeat, pasteStart) && fracLt(a.absBeat, pasteEnd)
    if (!inWindow) return true
    const dv = destByStaff.get(staffIndexOfId(score, a.dyn.staffId))
    return !dv || !dv.has(a.dyn.voice ?? 0)
  })

  const meter = getMeterInfo(ts)
  const targetBars = regionMeasures.length

  // Paste runs one lane per (STAFF, voice), exactly like rebar: each staff is an independent
  // stream on the shared bar spine. Only a DESTINATION staff's destination voices get their paste
  // window overwritten by the clip; every other (staff, voice) is passed through verbatim.
  // Narrowing each measure to the staff first (staffMeasureView) means flattenRegion sees only
  // that staff's slots — otherwise the clip drops onto staff 0 AND materializeRegion's clear-all
  // wipes the other staves' content (the "paste deletes the copied staff" bug).
  const lanes: Array<{ staff: number; voice: number; plan: BarPlan[] }> = []
  let maxBars = targetBars
  for (const staff of staffIndices) {
    const staffId = staffIdAtIndex(score, staff)
    const narrowed = regionMeasures.map((m) => staffMeasureView(m, staffId, score))
    const destVoices = destByStaff.get(staff)

    // Voice 0 is always re-laid so a grown region keeps its rest spine. On a destination staff we
    // also re-lay the clip's destination voices (they may not exist there yet).
    const voices = new Set<number>([0])
    for (const nm of narrowed) for (const s of nm.slots) voices.add(s.voice ?? 0)
    if (destVoices) for (const dv of destVoices.keys()) voices.add(dv)

    for (const v of voices) {
      const existing = flattenRegion(narrowed, v as 0 | 1 | 2 | 3)
      const clip = destVoices?.get(v)
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
        // this lane ignores). This is what keeps the non-target staves intact.
        events = existing
      }
      const p = relayEvents(events, meter, { targetBars, bounded })
      lanes.push({ staff, voice: v, plan: p })
      if (p.length > maxBars) maxBars = p.length
    }
  }

  const regionNumbers = regionMeasures.map((m) => m.number)
  for (let i = targetBars; i < maxBars; i++) {
    regionNumbers.push(deps.addMeasure(ts).number)
  }

  const created = materializeRegion(score, deps, regionNumbers, lanes)
  restoreBoundaryTies(score, deps, targetMeasure, regionNumbers[regionNumbers.length - 1], boundary)
  deps.repairDanglingTies()
  restoreSlurs(score, deps, regionNumbers, slurState)
  deps.repairDanglingSlurs()
  // Re-anchor the clip's own slurs onto the freshly-pasted notes (Phase 3), mapping rel→abs
  // staff (drop overflow) + re-voicing single-voice clips — the slur analogue of clip dynamics.
  restoreClipSlurs(score, deps, regionNumbers, clipSlurs, targetStaff, targetVoice, singleVoice, pasteStart, staffCount)
  restoreBeatAnchors(score, deps, regionNumbers, survivingAnchors)
  // Re-anchor the clip's own dynamics on top (Phase 2): re-base each clip-relative offset by the
  // paste start, map the RELATIVE staff onto an absolute one (clamped — drop overflow lanes), and
  // re-voice a single-voice clip into the target voice (mirroring the destVoices rule). Routed
  // through the same restoreBeatAnchors path the destination's dynamics use.
  const clipAnchors: CapturedAnchor[] = []
  for (const cd of clipDynamics) {
    const absStaff = targetStaff + cd.staff
    if (absStaff < 0 || absStaff >= staffCount) continue // overflow — already warned for its lane
    const staffId = staffIdAtIndex(score, absStaff)
    const dyn: Dynamic = {
      id: uuidv4(),
      beat: fracCreate(0, 1), // restoreBeatAnchors overwrites this from absBeat
      text: cd.text,
      voice: (singleVoice ? targetVoice : cd.voice) as 0 | 1 | 2 | 3,
      ...(cd.placement !== undefined ? { placement: cd.placement } : {}),
      ...(staffId !== undefined ? { staffId } : {}),
    }
    clipAnchors.push({ kind: 'dynamic', absBeat: fracAdd(pasteStart, cd.offset), dyn, ...(cd.engravingOffset ? { offset: cd.engravingOffset } : {}) })
  }
  restoreBeatAnchors(score, deps, regionNumbers, clipAnchors)
  // Re-stamp the destination's own rest shifts; the clip's shifts are applied after this,
  // so they win on any position collision.
  restoreRestShifts(score, deps, regionNumbers, restShifts)

  // Apply the clip's rest shifts at the paste window: re-base each clip-relative offset by
  // the paste start, and re-voice a single-voice clip into the target voice (mirroring the
  // destVoices rule above). restoreRestShifts drops any whose rest the paste didn't produce.
  // Rest overrides are position-keyed by (measure, staffId, voice, beat). The clip lane's
  // RELATIVE staff maps onto an absolute destination staff the same way clef/dynamic content
  // does (`absStaff = targetStaff + lane.staff`), so a multi-staff clip's shifts land on the
  // right staff rather than collapsing onto staff 0. `keyStaffId` gives the absent-for-staff-0
  // id that matches the destination rest slot's own `staffId`.
  const clipCaptured: CapturedRestShift[] = []
  for (const { staff, voice, restShifts: shifts } of clipRestShifts) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const rs of shifts) {
      clipCaptured.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, rs.offset), steps: rs.steps, hidden: false })
    }
  }
  // The clip's hidden rests travel the same way (client #6). A hidden rest may carry no
  // shift, so it arrives as its own captured entry (steps 0, hidden true).
  for (const { staff, voice, restHidden } of clipRestHidden) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const rh of restHidden) {
      clipCaptured.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, rh.offset), steps: 0, hidden: true })
    }
  }
  restoreRestShifts(score, deps, regionNumbers, clipCaptured)

  // Collect the ids of notes whose absolute offset falls inside the paste window.
  const startOfMeasure = new Map<number, Fraction>()
  let base = fracCreate(0, 1)
  for (const num of regionNumbers) {
    startOfMeasure.set(num, base)
    const m = getMeasure(score, num)
    base = fracAdd(base, m ? measureCapacityFrac(m) : fracCreate(0, 1))
  }
  const pastedIds: string[] = []
  for (const { chord } of created) {
    // Only the pasted notes: a destination staff's destination voices (passthrough lanes on
    // other staves can share a voice number, so scope by staff too).
    const dv = destByStaff.get(staffIndexOfId(score, chord.staffId))
    if (!dv || !dv.has(chord.voice ?? 0)) continue
    const mStart = startOfMeasure.get(chord.measure)
    if (!mStart) continue
    const absOffset = fracAdd(mStart, chord.beat)
    if (fracGte(absOffset, pasteStart) && fracLt(absOffset, pasteEnd)) {
      for (const np of chord.notes) pastedIds.push(np.id)
    }
  }
  return pastedIds
}

// ==================== Region walk helpers ====================

/**
 * Walk a run of measures accumulating each one's capacity, invoking `visit` with the
 * absolute beat at which each STARTS (region beat 0 = the first measure's downbeat) and
 * its capacity. The ONE capacity accumulation the rebar capture passes share — capture
 * turns `start` into absolute offsets; {@link regionRanges} turns it into a lookup table.
 */
function forEachRegionMeasure(
  measures: Measure[],
  visit: (measure: Measure, start: Fraction, cap: Fraction) => void,
): void {
  let base = fracCreate(0, 1)
  for (const m of measures) {
    const cap = measureCapacityFrac(m)
    visit(m, base, cap)
    base = fracAdd(base, cap)
  }
}

/**
 * The region's measures (resolved from their numbers), each tagged with its absolute start
 * beat and capacity — the table {@link restoreBeatAnchors} / {@link restoreRestShifts} search
 * to place a captured offset back into the rebar'd bars. Missing numbers are skipped.
 */
function regionRanges(score: Score, regionNumbers: number[]): Array<{ measure: Measure; start: Fraction; cap: Fraction }> {
  const measures = regionNumbers
    .map((n) => getMeasure(score, n))
    .filter((m): m is Measure => m !== undefined)
  const ranges: Array<{ measure: Measure; start: Fraction; cap: Fraction }> = []
  forEachRegionMeasure(measures, (measure, start, cap) => ranges.push({ measure, start, cap }))
  return ranges
}

/** Which range an absolute offset lands in (the bar whose [start, start+cap) contains it);
 *  an offset past the region is clamped to the last bar. Assumes `ranges` is non-empty. */
function rangeForOffset(
  ranges: Array<{ measure: Measure; start: Fraction; cap: Fraction }>,
  absBeat: Fraction,
): { measure: Measure; start: Fraction; cap: Fraction } {
  for (const r of ranges) {
    if (fracGte(absBeat, r.start) && fracLt(absBeat, fracAdd(r.start, r.cap))) return r
  }
  return ranges[ranges.length - 1]
}

// ==================== Capture / restore: beat anchors ====================

/**
 * Capture each region clef change / dynamic / tempo mark by its ABSOLUTE beat offset from the
 * region start (cumulative measure capacities + the item's in-measure beat),
 * measured with the measures' CURRENT (pre-rebar) capacities. Mirrors how
 * {@link captureBoundaryTies} snapshots state before ids/bars are regenerated.
 * The originals are wiped by {@link clearMeasureForRebar}; {@link restoreBeatAnchors}
 * re-creates them (fresh ids) at the position each offset maps to afterwards.
 */
function captureBeatAnchors(score: Score, deps: RebarDeps, regionMeasures: Measure[]): CapturedAnchor[] {
  const out: CapturedAnchor[] = []
  forEachRegionMeasure(regionMeasures, (m, base) => {
    for (const c of m.clefs ?? []) {
      out.push({ kind: 'clef', absBeat: fracAdd(base, c.beat), clef: c.clef, staffId: c.staffId })
    }
    for (const d of m.dynamics ?? []) {
      // A hand-nudged offset (client #8) is id-keyed, and rebar regenerates the dynamic's id,
      // so capture it here and CLEAR the old key — restoreBeatAnchors re-stamps it under the
      // fresh id. Mirrors captureRestShifts (position-keyed twin). Without this the override
      // would orphan on any rebar of a nudged dynamic.
      const off = dynamicOffsetOverrideOf(score, d.id)
      if (off) deps.clearEngravingOverride(d.id, 'dynamicOffset')
      out.push({ kind: 'dynamic', absBeat: fracAdd(base, d.beat), dyn: d, ...(off ? { offset: { x: off.x, y: off.y } } : {}) })
    }
    // Tempo marks are beat-anchored too, so a meter change would silently DELETE them
    // (clearMeasureForRebar drops the array) unless they ride this seam. They carry no
    // staff/voice — a tempo mark is system-level — so the offset is the whole key.
    for (const t of m.tempos ?? []) {
      out.push({ kind: 'tempo', absBeat: fracAdd(base, t.beat), mark: t })
    }
  })
  return out
}

/**
 * Re-anchor captured clef changes / dynamics / tempo marks into the rebar’d region: walk the
 * new bars accumulating their capacities, find which measure each absolute offset
 * now lands in, and re-create the annotation there at the local beat. An offset
 * past the (defensively) rebuilt region is clamped to the last bar. A collision
 * at the same beat (+ voice, for dynamics) is overwritten — last wins.
 */
function restoreBeatAnchors(score: Score, deps: RebarDeps, regionNumbers: number[], anchors: CapturedAnchor[]): void {
  if (anchors.length === 0) return

  const ranges = regionRanges(score, regionNumbers)
  if (ranges.length === 0) return

  for (const a of anchors) {
    const target = rangeForOffset(ranges, a.absBeat)
    let beat = fracSub(a.absBeat, target.start)
    if (fracLt(beat, fracCreate(0, 1))) beat = fracCreate(0, 1)
    if (fracGte(beat, target.cap)) beat = target.cap // clamp into the bar (defensive)
    const m = target.measure

    if (a.kind === 'clef') {
      if (!m.clefs) m.clefs = []
      // Dedupe within the SAME staff only — a staff-0 and staff-1 clef change may share a beat.
      const dup = m.clefs.findIndex((c) => fracCompare(c.beat, beat) === 0 && matchesStaff(c.staffId, a.staffId, score))
      if (dup !== -1) m.clefs.splice(dup, 1)
      m.clefs.push({ id: uuidv4(), beat, clef: a.clef, ...(a.staffId !== undefined ? { staffId: a.staffId } : {}) })
      m.clefs.sort((x, y) => fracCompare(x.beat, y.beat))
    } else if (a.kind === 'tempo') {
      // Tempo takes the CLEF rule, not the dynamics rule: at most one mark per beat, last
      // wins. Two tempo marks on one beat is not a thing (docs/tempo-marks-plan.md §4).
      if (!m.tempos) m.tempos = []
      const dup = m.tempos.findIndex((t) => fracCompare(t.beat, beat) === 0)
      if (dup !== -1) m.tempos.splice(dup, 1)
      m.tempos.push({ ...a.mark, id: uuidv4(), beat })
      m.tempos.sort((x, y) => fracCompare(x.beat, y.beat))
    } else {
      // Dynamics may stack at one (beat, voice) — keep them all (no dedupe).
      if (!m.dynamics) m.dynamics = []
      const newId = uuidv4()
      m.dynamics.push({ ...a.dyn, id: newId, beat })
      m.dynamics.sort((x, y) => fracCompare(x.beat, y.beat))
      // Re-stamp the captured hand-nudged offset under the regenerated id (client #8) — this is
      // how a nudged dynamic keeps its offset across a rebar AND how a pasted one carries it.
      if (a.offset) {
        const next: DynamicOffsetOverride = { kind: 'dynamicOffset', x: a.offset.x, y: a.offset.y }
        deps.setEngravingOverride(newId, next)
      }
    }
  }
}

// ==================== Capture / restore: rest shifts ====================

/**
 * Capture each region rest-shift override by its ABSOLUTE beat offset from the region
 * start (per voice), measured with the measures' CURRENT (pre-rebar) capacities, then
 * CLEAR the stored override — it is re-stamped by {@link restoreRestShifts} after the bars
 * are regenerated, or intentionally dropped if the new tiling has no rest at that offset.
 * The position-keyed twin of {@link captureBeatAnchors}. See docs/rest-shift-plan.md §3.2.
 */
function captureRestShifts(score: Score, deps: RebarDeps, regionMeasures: Measure[]): CapturedRestShift[] {
  const out: CapturedRestShift[] = []
  forEachRegionMeasure(regionMeasures, (m, base) => {
    for (const s of m.slots) {
      if (s.type !== 'rest') continue
      const voice = s.voice ?? 0
      const key = restPositionKey(m.id, voice, s.beat, s.staffId)
      // One pass captures BOTH rest engraving overrides (shift + hidden, client #5/#6) —
      // they share the position address, so they travel together. Capture when either is set.
      const steps = restShiftOverrideOf(score, key)?.steps ?? 0
      const hidden = restHiddenOf(score, key)
      if (steps === 0 && !hidden) continue
      out.push({ voice, staffId: s.staffId, absBeat: fracAdd(base, s.beat), steps, hidden })
      if (steps !== 0) deps.clearEngravingOverride(key, 'restShift')
      if (hidden) deps.clearEngravingOverride(key, 'restHidden')
    }
  })
  return out
}

/**
 * Re-stamp captured rest shifts into the rebar'd/pasted region: walk the new bars
 * accumulating capacities, find which measure each absolute offset now lands in, and —
 * ONLY IF a rest of that voice actually STARTS at the local beat — write the override
 * there. Unlike {@link restoreBeatAnchors} (which always re-creates the annotation at the
 * clamped beat), a rest shift is meaningless without a rest, so an offset whose rest the
 * new tiling moved/merged away is silently DROPPED (plan §4, benign). Overwrites on a
 * collision (last wins), so paste can stamp the clip's shifts on top of the destination's
 * by calling this again — the captured offsets are region-relative, so paste re-bases the
 * clip's offsets by the paste start and routes them through this same path.
 * See docs/rest-shift-plan.md §3.2 / §6.4.
 */
function restoreRestShifts(score: Score, deps: RebarDeps, regionNumbers: number[], captured: CapturedRestShift[]): void {
  if (captured.length === 0) return

  const ranges = regionRanges(score, regionNumbers)
  if (ranges.length === 0) return

  for (const c of captured) {
    if (c.steps === 0 && !c.hidden) continue
    const target = rangeForOffset(ranges, c.absBeat)
    const beat = fracSub(c.absBeat, target.start)
    const m = target.measure
    // Stamp ONLY when a rest of this voice STARTS exactly here (plan §6.4). No accessor
    // exists post-materialise, so read the slots directly.
    const hasRest = m.slots.some(
      (s) => s.type === 'rest' && (s.voice ?? 0) === c.voice && (s.staffId ?? undefined) === (c.staffId ?? undefined) && fracCompare(s.beat, beat) === 0,
    )
    if (!hasRest) continue
    const key = restPositionKey(m.id, c.voice, beat, c.staffId)
    // Re-stamp BOTH captured rest engraving overrides at the new position (client #5/#6).
    if (c.steps !== 0) {
      const next: RestShiftOverride = { kind: 'restShift', steps: c.steps }
      deps.setEngravingOverride(key, next)
    }
    if (c.hidden) {
      const next: RestHiddenOverride = { kind: 'restHidden' }
      deps.setEngravingOverride(key, next)
    }
  }
}

// ==================== Capture / restore: boundary ties ====================

/**
 * Record ties that cross the region's edges: an external note tied INTO the
 * region (incoming) or tied FROM the region out to a later note (outgoing).
 * Keyed by the external note id + its pitch, so the partner can be re-found in
 * the rebar'd region by position/pitch.
 */
function captureBoundaryTies(score: Score, regionMeasures: Measure[]): {
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
  for (const m of score.measures) {
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
function restoreBoundaryTies(
  score: Score,
  deps: RebarDeps,
  firstMeasure: number,
  lastMeasure: number,
  boundary: ReturnType<typeof captureBoundaryTies>,
): void {
  for (const { externalId, pitch, voice } of boundary.incoming) {
    const targetId = boundaryPitchId(score, firstMeasure, pitch, 'first', voice)
    if (targetId) linkTieById(deps, externalId, targetId)
  }
  for (const { externalId, pitch, voice } of boundary.outgoing) {
    const sourceId = boundaryPitchId(score, lastMeasure, pitch, 'last', voice)
    if (sourceId) linkTieById(deps, sourceId, externalId)
  }
}

/** Id of the matching pitch in the first/last chord (by beat) of a measure, within a voice. */
function boundaryPitchId(
  score: Score,
  measureNumber: number,
  pitch: { step: Note['step']; alter: Note['alter']; octave: number },
  which: 'first' | 'last',
  voice: number,
): string | undefined {
  const m = getMeasure(score, measureNumber)
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
function linkTieById(deps: RebarDeps, fromId: string, toId: string): void {
  const from = deps.findSlot(fromId)
  const to = deps.findSlot(toId)
  if (!from || from.type !== 'chord' || !to || to.type !== 'chord') return
  from.pitch.tiedTo = toId
  to.pitch.tiedFrom = fromId
}

// ==================== Capture / restore: slurs ====================

/**
 * Snapshot every slur with at least one endpoint inside the region BEFORE re-barring
 * regenerates note ids. Each in-region endpoint is recorded by its ABSOLUTE onset
 * offset from the region start (pre-rebar capacities) + pitch, so it can be re-found
 * on the rebar'd note at the same position/pitch; an endpoint OUTSIDE the region keeps
 * its id verbatim (those ids aren't regenerated). Mirrors {@link captureBoundaryTies}.
 */
function captureSlurs(score: Score, regionMeasures: Measure[]): CapturedSlur[] {
  const slurs = score.slurs
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
function slurAnchorKey(offset: Fraction, pitch: SlurPitch, voice: number): string {
  return `${offset.num}/${offset.den}|${pitch.step}/${pitch.alter}/${pitch.octave}|v${voice}`
}

/**
 * Re-attach captured slurs to the rebar'd region: re-find each in-region endpoint by
 * its absolute onset offset + pitch (the chord that now starts there), keeping any
 * external endpoint id as-is. A slur whose endpoint can't be re-found (its note was
 * overwritten/dropped), or that collapses to a single point, is removed — never left
 * dangling. Mirrors {@link restoreBoundaryTies}.
 */
function restoreSlurs(score: Score, deps: RebarDeps, regionNumbers: number[], captured: CapturedSlur[]): void {
  if (captured.length === 0) return
  const slurs = score.slurs
  if (!slurs) return

  // New region: absolute onset offset + pitch -> pitch id (first chord at the offset wins).
  const lookup = new Map<string, string>()
  let base = fracCreate(0, 1)
  for (const num of regionNumbers) {
    const m = getMeasure(score, num)
    if (!m) continue
    const cap = measureCapacityFrac(m)
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      const offset = fracAdd(base, s.beat)
      const voice = s.voice ?? 0
      for (const p of s.notes) {
        const key = slurAnchorKey(offset, { step: p.step, alter: p.alter, octave: p.octave }, voice)
        if (!lookup.has(key)) lookup.set(key, p.id)
      }
    }
    base = fracAdd(base, cap)
  }

  const resolve = (end: CapturedSlurEnd): string | undefined =>
    end.externalId !== undefined
      ? end.externalId
      : lookup.get(slurAnchorKey(end.offset, end.pitch, end.voice))

  for (const c of captured) {
    const idx = slurs.indexOf(c.slur)
    if (idx === -1) continue
    const newStart = resolve(c.start)
    const newEnd = resolve(c.end)
    if (!newStart || !newEnd || newStart === newEnd) {
      slurs.splice(idx, 1)
      deps.clearEngravingOverride(c.slur.id) // auto-reset (§3.3): endpoint unrecoverable on rebar → slur dropped
      continue
    }
    c.slur.startNoteId = newStart
    c.slur.endNoteId = newEnd
  }
}

/**
 * Create the clip's own slurs on the freshly-pasted notes (paste Phase 3). Each captured
 * endpoint is addressed by RELATIVE staff / voice / clip-relative offset / pitch; this maps
 * the staff onto an absolute one (`targetStaff + relStaff`, dropped if it overflows the staff
 * count), re-voices a single-voice clip into the target voice, re-bases the offset by the
 * paste start, and re-finds the note now sitting there — then adds a fresh {@link Slur}. A
 * slur whose endpoint can't be re-found (note overwritten/clamped) or that collapses to a
 * point is skipped. Uses a STAFF-AWARE lookup (unlike {@link restoreSlurs}, which is
 * staff-blind) so a multi-staff paste anchors each endpoint on the intended staff.
 */
function restoreClipSlurs(
  score: Score,
  deps: RebarDeps,
  regionNumbers: number[],
  clipSlurs: ClipSlurInput[],
  targetStaff: number,
  targetVoice: number,
  singleVoice: boolean,
  pasteStart: Fraction,
  staffCount: number,
): void {
  if (clipSlurs.length === 0) return

  // (staff | voice | offset | pitch) -> pitch id, over the pasted region (first chord wins).
  const offKey = (off: Fraction): string => { const r = fracCreate(off.num, off.den); return `${r.num}/${r.den}` }
  const key = (staff: number, voice: number, off: Fraction, p: ClipSlurPitchInput): string =>
    `${staff}|v${voice}|${offKey(off)}|${p.step}/${p.alter}/${p.octave}`

  const lookup = new Map<string, string>()
  let base = fracCreate(0, 1)
  for (const num of regionNumbers) {
    const m = getMeasure(score, num)
    if (!m) continue
    const cap = measureCapacityFrac(m)
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      const staff = staffIndexOfId(score, s.staffId)
      const voice = s.voice ?? 0
      const offset = fracAdd(base, s.beat)
      for (const p of s.notes) {
        const k = key(staff, voice, offset, { step: p.step, alter: p.alter, octave: p.octave })
        if (!lookup.has(k)) lookup.set(k, p.id)
      }
    }
    base = fracAdd(base, cap)
  }

  const resolve = (relStaff: number, endVoice: number, relOffset: Fraction, pitch: ClipSlurPitchInput): string | undefined => {
    const absStaff = targetStaff + relStaff
    if (absStaff < 0 || absStaff >= staffCount) return undefined
    const voice = singleVoice ? targetVoice : endVoice
    return lookup.get(key(absStaff, voice, fracAdd(pasteStart, relOffset), pitch))
  }

  for (const cs of clipSlurs) {
    const startId = resolve(cs.startStaff, cs.startVoice, cs.startOffset, cs.startPitch)
    const endId = resolve(cs.endStaff, cs.endVoice, cs.endOffset, cs.endPitch)
    if (!startId || !endId || startId === endId) continue
    const voice = (singleVoice ? targetVoice : cs.startVoice) as 0 | 1 | 2 | 3
    deps.addSlur({
      startNoteId: startId,
      endNoteId: endId,
      voice,
      ...(cs.placement !== undefined ? { placement: cs.placement } : {}),
    })
  }
}

// ==================== Materialise ====================

/**
 * Wipe a measure's slots/tuplets and beat-anchored annotations ahead of a rebar
 * materialise. Called ONCE per region measure (clears ALL voices) before any
 * voice's plan is materialised — see {@link materializeRegion}.
 */
function clearMeasureForRebar(measure: Measure): void {
  measure.slots = []
  measure.tuplets = []
  delete measure.clefs // mid-bar clefs anchored to moved beats are dropped (Phase 8 limitation)
  delete measure.dynamics // dynamics share the clef limitation: beat anchors don't survive a rebar
  delete measure.tempos // ditto — re-anchored by absolute offset in restoreBeatAnchors
}

/**
 * Materialise ONE voice's rebar {@link RebarPiece} plan into a measure
 * ADDITIVELY — does NOT wipe the measure (call {@link clearMeasureForRebar} once
 * per measure first). Each created chord/rest is tagged with `voice`; voice 0
 * stays stored as `undefined` (data-model invariant — see `pushRestSlot`).
 */
function materializeVoiceBar(
  deps: RebarDeps,
  measure: Measure,
  plan: RebarPiece[],
  voice: number,
  staff: number,
  created: Array<{ piece: RebarPiece; chord: Chord }>,
): void {
  // The staffId this lane's slots carry (absent = staff 0, byte-identical at N=1). Tuplet
  // (atomic) slots already carry it via structuredClone of the captured source slots.
  const staffId = deps.staffIdForParams(staff)
  for (const piece of plan) {
    if (piece.atomic && piece.payload) {
      // Tuplet: structuredClone preserves the source slot's voice AND staff — no args.
      materializeAtomicPiece(measure, piece)
      continue
    }
    if (piece.isRest) {
      deps.pushRestSlot(
        measure,
        { beat: piece.beat, duration: piece.duration, dots: piece.dots, isMeasureRest: piece.isMeasureRest },
        voice,
        staffId,
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
    if (staffId !== undefined) chord.staffId = staffId
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
function materializeRegion(
  score: Score,
  deps: RebarDeps,
  regionNumbers: number[],
  lanes: Array<{ staff: number; voice: number; plan: BarPlan[] }>,
): Array<{ piece: RebarPiece; chord: Chord }> {
  for (const num of regionNumbers) {
    const m = getMeasure(score, num)
    if (m) clearMeasureForRebar(m)
  }

  const allCreated: Array<{ piece: RebarPiece; chord: Chord }> = []
  for (const { staff, voice, plan } of lanes) {
    const created: Array<{ piece: RebarPiece; chord: Chord }> = []
    for (let i = 0; i < plan.length; i++) {
      const m = getMeasure(score, regionNumbers[i])
      if (m) materializeVoiceBar(deps, m, plan[i], voice, staff, created)
    }
    linkRebarTies(created) // per-(staff,voice) chain only
    allCreated.push(...created)
  }

  for (const num of regionNumbers) {
    const m = getMeasure(score, num)
    if (m) deps.fillGapsWithRests(m) // adds the missing voice-0 rest in grown bars
    deps.collapseEmptyVoices(num) // drop a secondary voice that re-laid to all-rests
  }

  return allCreated
}

/** Re-create an atomic tuplet (verbatim slots, fresh ids) at the piece's beat. */
function materializeAtomicPiece(measure: Measure, piece: RebarPiece): void {
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
function linkRebarTies(created: Array<{ piece: RebarPiece; chord: Chord }>): void {
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
