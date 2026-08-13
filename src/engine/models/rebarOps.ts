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
  Score, Measure, Note, Chord, NotePitch, Rest, TimeSignature, Clef, Dynamic, TempoMark, Hairpin,
  Slur, Trill, EngravingOverride, RestShiftOverride, RestHiddenOverride, DynamicOffsetOverride,
  LeadingSpaceOverride, NoteOffsetOverride,
} from '@/types/music'
import { restShiftOverrideOf, restHiddenOf, restPositionKey, dynamicOffsetOverrideOf, noteOffsetOverrideOf, spacingPositionKey, measureLeadingSpaces } from './engravingOverrides'
import { slotLength, writtenLength } from '@/utils/durations'
import { getMeterInfo } from '@/utils/meter'
import type { RestSlot } from '@/utils/restFill'
import { flattenRegion, relayEvents, type RebarPiece, type RebarEvent, type BarPlan } from '@/utils/rebar'
import type { Clip, ClipSlur, ClipSlurPitch, ClipTrill, ClipTarget } from '@/utils/clip'
import { type Fraction, fracCreate, fracAdd, fracSub, fracCompare, fracEq, fracLt, fracGte } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { staffIndexOfId, matchesStaff, staffIdAtIndex, keyStaffId, staffMeasureView } from './staffContent'
import { laneOfSlot, pairIsValid } from '@/utils/tremoloPair'
import { cloneFanFresh, chordStoredPitches, fanMemberBeats } from '@/utils/fannedBeam'
import { v4 as uuidv4 } from 'uuid'
import { voiceOf } from '@/utils/lanes'
import { dbg } from '@/utils/debug'

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
  addTrill(trill: Omit<Trill, 'id'>): Trill | null
  findSlot(noteId: string): FindSlotResult | undefined
  setEngravingOverride(elementId: string, override: EngravingOverride): void
  clearEngravingOverride(elementId: string, kind?: string): boolean
  repairDanglingTies(): void
  repairDanglingSlurs(): void
  repairDanglingTrills(): void
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
  // Only the START is captured: `length` is an amount of MUSIC, and a rebar leaves the region's
  // total music unchanged, so the extent is invariant and only the anchor needs re-finding.
  | { kind: 'hairpin'; absBeat: Fraction; hairpin: Hairpin }

/**
 * A rest's manual vertical shift snapshotted before a rebar/paste, keyed by its absolute
 * beat offset from the region start (per voice) so it can travel into the new bar layout.
 * The position-keyed twin of {@link CapturedAnchor}. See {@link captureRestShifts}.
 */
type CapturedRestShift = { voice: number; staffId?: string; absBeat: Fraction; steps: number; hidden: boolean }

/**
 * A note's horizontal offset (client #12) snapshotted before a rebar/paste, keyed by its absolute
 * beat offset from the region start plus (voice, staffId) — the address of the SLOT it hangs off,
 * since a rebar re-mints slot ids. The chord/rest twin of {@link CapturedRestShift} (a note offset
 * is slot-keyed, so it covers chords AND rests, unlike the rest-only shift). See {@link captureNoteOffsets}.
 *
 * ⭐ `member` is the FANNED MEMBER's place in its group (1…count−1), absent for the slot itself. An
 * INDEX is the right address here and nowhere else: a member's offset is keyed by the member's own
 * first pitch id, and `cloneFanFresh` re-mints every one of those when the slot is rebuilt — so the
 * id on the far side is new by construction, while capture and restore are one instant of one
 * passage and the group's order is exactly what it was.
 */
type CapturedNoteOffset = { voice: number; staffId?: string; absBeat: Fraction; x: number; member?: number }

/** A two-note tremolo snapshotted before a rebar/paste, keyed by the FIRST note's absolute offset so
 *  it can be re-found — and re-validated — once the bars are re-tiled. See {@link captureTremoloPairs}. */
type CapturedTremoloPair = { voice: number; staffId?: string; absBeat: Fraction; style?: 'joined' | 'open' }

/** A user-authored leading space snapshotted before a rebar (client #10). No voice and no staff:
 *  the space belongs to the COLUMN, so its whole address is the absolute offset. */
type CapturedLeadingSpace = { absBeat: Fraction; space: number }

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

/**
 * A trill (live ref) with at least one anchor inside the rebar region, captured before ids are
 * regenerated. The same shape as {@link CapturedSlur} and deliberately so — a trill is anchored on
 * a slur's terms, so it is re-found on a slur's terms.
 *
 * ⭐ `end` is **undefined** for the one-note trill (no `endNoteId`), which is a third state neither
 * a slur nor a hairpin has: the span is derived from the ties, so there is nothing to snapshot and
 * nothing to re-find. Distinct from a captured end that fails to resolve later — that one degrades
 * INTO this state, and the difference is why `end` is optional rather than a `CapturedSlurEnd` with
 * an empty body.
 */
type CapturedTrill = { trill: Trill; start: CapturedSlurEnd; end?: CapturedSlurEnd }

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

  // …and trills, on exactly the same terms and for exactly the same reason (docs/trill-plan.md §2.1).
  const trillState = captureTrills(score, regionMeasures)

  // Capture beat-anchored annotations (clef changes + dynamics) by their ABSOLUTE
  // offset from the region start, using the OLD capacities — before the meter is
  // overwritten below. They are re-anchored after rebar (see restoreBeatAnchors).
  const anchors = captureBeatAnchors(score, deps, regionMeasures)

  // Capture manual rest shifts the same way — by absolute region-relative offset, before
  // rest-fill regenerates every rest with a fresh id. Re-stamped after materialise.
  const restShifts = captureRestShifts(score, deps, regionMeasures)

  // …and the authored leading spaces (client #10), keyed by offset alone — a space belongs to
  // the column, so it has neither a voice nor a staff to capture.
  const leadingSpaces = captureLeadingSpaces(score, deps, regionMeasures)

  // …and the note horizontal offsets (client #12), slot-keyed and so re-minted by the rebar —
  // captured by (voice, staff, offset), re-stamped onto the slot that starts there afterwards.
  const noteOffsets = captureNoteOffsets(score, deps, regionMeasures)
  // Two-note tremolos travel by POSITION across the re-tile, and must be captured for the same
  // reason as the offsets above: the relay cannot carry the relation, so anything not snapshotted
  // here is silently un-paired by the rebuild.
  const tremoloPairs = captureTremoloPairs(regionMeasures)

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
    for (const nm of narrowed) for (const s of nm.slots) voices.add(voiceOf(s))
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
  restoreTrills(score, deps, regionNumbers, trillState)
  deps.repairDanglingTrills()

  // Re-anchor the captured clef changes / dynamics into the new bar layout,
  // mapping each absolute offset to the (measure, beat) it now lands on.
  restoreBeatAnchors(score, deps, regionNumbers, anchors)

  // Re-stamp the captured rest shifts onto whatever rest now starts at each offset
  // (dropped where the new tiling has no rest start — plan §4).
  restoreRestShifts(score, deps, regionNumbers, restShifts)

  // …and the authored leading spaces onto whatever column now starts at each offset. Dropped
  // where the new meter has no column there at all — see restoreLeadingSpaces.
  restoreLeadingSpaces(score, deps, regionNumbers, leadingSpaces)

  // …and the note offsets onto whatever slot now starts at each offset (dropped where the new
  // tiling has none — see restoreNoteOffsets).
  restoreNoteOffsets(score, deps, regionNumbers, noteOffsets)
  restoreTremoloPairs(score, regionNumbers, tremoloPairs)
}

/**
 * Paste a {@link Clip} at `target`, OVERWRITING the existing music forward for the clip's
 * span. Reuses the rebar pipeline so the paste inherits its correctness for free: existing
 * content overlapping the paste window is dropped, the clip's events are dropped in at the
 * target offset, and the merged stream is re-barred (barline-crossing notes split with ties,
 * gaps rest-filled, the region grown if it overflows).
 *
 * The region runs from `target.measure` to the next explicit TS change (or score
 * end); a single meter governs it (Phase A: pasting across a meter change is not
 * supported — the clip flows in the target region's meter).
 *
 * ⭐ TWO arguments, not fourteen: the clip is position-independent material and the target is
 * where it lands, so everything a clip carries arrives as a field of it (see `utils/clip.ts`).
 *
 * @returns the ids of the flat notes that landed inside the paste window, for
 *          selecting the pasted material.
 */
export function pasteEvents(
  score: Score,
  deps: RebarDeps,
  clip: Clip,
  target: ClipTarget,
): string[] {
  const { measure: targetMeasure, beat: targetBeat, voice: targetVoice } = target
  const targetStaff = target.staff ?? 0
  const { lanes: clipLanes, spanBeats } = clip
  const clipDynamics = clip.dynamics ?? []
  const clipSlurs = clip.slurs ?? []
  const clipTrills = clip.trills ?? []
  const clipHairpins = clip.hairpins ?? []
  const clipSpaces = clip.spaces ?? []
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
  const trillState = captureTrills(score, regionMeasures)
  const anchors = captureBeatAnchors(score, deps, regionMeasures)
  // Preserve the destination's own rest shifts across the rebar (those outside the paste
  // window survive; ones whose rest the paste overwrites are dropped). The clip's shifts
  // are stamped ON TOP afterwards (last wins) — see §6.5 threading.
  const restShifts = captureRestShifts(score, deps, regionMeasures)
  // Same for the destination's authored leading spaces; the clip's are stamped on top below.
  const leadingSpaces = captureLeadingSpaces(score, deps, regionMeasures)
  // And the destination's own note offsets (client #12); the clip's land on top afterwards.
  const noteOffsets = captureNoteOffsets(score, deps, regionMeasures)
  // Two-note tremolos travel by POSITION across the re-tile, and must be captured for the same
  // reason as the offsets above: the relay cannot carry the relation, so anything not snapshotted
  // here is silently un-paired by the rebuild.
  const tremoloPairs = captureTremoloPairs(regionMeasures)

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
  // Hairpins take the same rule, keyed on where the wedge STARTS: a destination hairpin starting
  // inside the paste window on a destination lane is replaced by the clip's, and one starting
  // outside it survives even if it runs THROUGH the window — its extent is a count of music, and
  // the paste does not change how much music the region holds.
  const survivingAnchors = anchors.filter((a) => {
    if (a.kind !== 'dynamic' && a.kind !== 'hairpin') return true
    const inWindow = fracGte(a.absBeat, pasteStart) && fracLt(a.absBeat, pasteEnd)
    if (!inWindow) return true
    const lane = a.kind === 'dynamic' ? a.dyn : a.hairpin
    const dv = destByStaff.get(staffIndexOfId(score, lane.staffId))
    return !dv || !dv.has(voiceOf(lane))
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
    for (const nm of narrowed) for (const s of nm.slots) voices.add(voiceOf(s))
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
  restoreTrills(score, deps, regionNumbers, trillState)
  deps.repairDanglingTrills()
  // Re-anchor the clip's own slurs onto the freshly-pasted notes (Phase 3), mapping rel→abs
  // staff (drop overflow) + re-voicing single-voice clips — the slur analogue of clip dynamics.
  restoreClipSlurs(score, deps, regionNumbers, clipSlurs, targetStaff, targetVoice, singleVoice, pasteStart, staffCount)
  // …and the clip's own trills, on the same staff-aware lookup (docs/trill-plan.md §2.3).
  restoreClipTrills(score, deps, regionNumbers, clipTrills, targetStaff, targetVoice, singleVoice, pasteStart, staffCount)
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
  // The clip's hairpins ride the identical road — re-based start, rel→abs staff, single-voice
  // re-voicing — with `length` copied through: it is an amount of music, not an address, so the
  // paste position cannot change it. (Only fully-enclosed hairpins are ever in the clip, so a
  // pasted wedge cannot run past the material that came with it.)
  for (const ch of clipHairpins) {
    const absStaff = targetStaff + ch.staff
    if (absStaff < 0 || absStaff >= staffCount) continue // overflow — already warned for its lane
    const staffId = staffIdAtIndex(score, absStaff)
    const hairpin: Hairpin = {
      id: uuidv4(),
      type: ch.type,
      beat: fracCreate(0, 1), // restoreBeatAnchors overwrites this from absBeat
      length: ch.length,
      voice: (singleVoice ? targetVoice : ch.voice) as 0 | 1 | 2 | 3,
      ...(ch.placement !== undefined ? { placement: ch.placement } : {}),
      ...(staffId !== undefined ? { staffId } : {}),
    }
    clipAnchors.push({ kind: 'hairpin', absBeat: fracAdd(pasteStart, ch.offset), hairpin })
  }
  restoreBeatAnchors(score, deps, regionNumbers, clipAnchors)
  // Re-stamp the destination's own rest shifts; the clip's shifts are applied after this,
  // so they win on any position collision.
  restoreRestShifts(score, deps, regionNumbers, restShifts)
  // The destination's own leading spaces, likewise — the clip's land on top further down.
  restoreLeadingSpaces(score, deps, regionNumbers, leadingSpaces)
  // The destination's own note offsets, likewise — the clip's are stamped on top further down.
  restoreNoteOffsets(score, deps, regionNumbers, noteOffsets)
  restoreTremoloPairs(score, regionNumbers, tremoloPairs)

  // Apply the clip's rest shifts at the paste window: re-base each clip-relative offset by
  // the paste start, and re-voice a single-voice clip into the target voice (mirroring the
  // destVoices rule above). restoreRestShifts drops any whose rest the paste didn't produce.
  // Rest overrides are position-keyed by (measure, staffId, voice, beat). The clip lane's
  // RELATIVE staff maps onto an absolute destination staff the same way clef/dynamic content
  // does (`absStaff = targetStaff + lane.staff`), so a multi-staff clip's shifts land on the
  // right staff rather than collapsing onto staff 0. `keyStaffId` gives the absent-for-staff-0
  // id that matches the destination rest slot's own `staffId`.
  const clipCaptured: CapturedRestShift[] = []
  for (const { staff, voice, restShifts } of clipLanes) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const rs of restShifts ?? []) {
      clipCaptured.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, rs.offset), steps: rs.steps, hidden: false })
    }
  }
  // The clip's hidden rests travel the same way (client #6). A hidden rest may carry no
  // shift, so it arrives as its own captured entry (steps 0, hidden true).
  for (const { staff, voice, restHidden } of clipLanes) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const rh of restHidden ?? []) {
      clipCaptured.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, rh.offset), steps: 0, hidden: true })
    }
  }
  restoreRestShifts(score, deps, regionNumbers, clipCaptured)

  // The clip's authored spaces (client #10) travel the same way, and are the simplest of the lot:
  // a space carries no voice and no staff, so re-basing its offset by the paste start is the whole
  // of the mapping — there is nothing to re-voice and nothing to re-staff. Stamped after the
  // destination's, so the clip wins where both spaced the same column.
  restoreLeadingSpaces(
    score, deps, regionNumbers,
    clipSpaces.map((cs) => ({ absBeat: fracAdd(pasteStart, cs.offset), space: cs.space })),
  )

  // The clip's note offsets (client #12) travel like its rest shifts: re-base each clip-relative
  // offset by the paste start, map the RELATIVE staff onto an absolute one (`keyStaffId` for the
  // absent-for-staff-0 id), and re-voice a single-voice clip into the target voice. restoreNoteOffsets
  // drops any whose slot the paste didn't produce, and stamps on top of the destination's (last wins).
  const clipCapturedOffsets: CapturedNoteOffset[] = []
  for (const { staff, voice, noteOffsets: offsets } of clipLanes) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const no of offsets ?? []) {
      clipCapturedOffsets.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, no.offset), x: no.x, member: no.member })
    }
  }
  restoreNoteOffsets(score, deps, regionNumbers, clipCapturedOffsets)

  // ⭐ The clip's TWO-NOTE TREMOLOS, re-based and re-voiced exactly like its note offsets — "I should
  // be able to paste what I copied". They travel outside `events` on purpose (see
  // `ClipLane.tremoloPairs`): the relay must keep dropping the relation, because a split event
  // hands its marks to every piece, while a copy that carries BOTH notes can simply reproduce it.
  //
  // ⚠️ RE-VALIDATED against the tiling that actually arrived, never trusted. The paste may land the
  // pair against a different meter, split it across a barline, or drop the partner off the end of the
  // region — all of which make it no longer a pair, and `pairIsValid` is the one predicate that says
  // so. A mark that does not survive the landing is simply not applied.
  const clipPairs: CapturedTremoloPair[] = []
  for (const { staff, voice, tremoloPairs } of clipLanes) {
    const destVoice = singleVoice ? targetVoice : voice
    const destStaffId = keyStaffId(score, targetStaff + staff)
    for (const tp of tremoloPairs ?? []) {
      clipPairs.push({ voice: destVoice, staffId: destStaffId, absBeat: fracAdd(pasteStart, tp.offset), style: tp.style })
    }
  }
  restoreTremoloPairs(score, regionNumbers, clipPairs)

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
    if (!dv || !dv.has(voiceOf(chord))) continue
    const mStart = startOfMeasure.get(chord.measure)
    if (!mStart) continue
    const absOffset = fracAdd(mStart, chord.beat)
    if (fracGte(absOffset, pasteStart) && fracLt(absOffset, pasteEnd)) {
      // ⭐ `chordStoredPitches`, not `chord.notes`: this list is not a report, it is the SELECTION —
      // `ClipboardController.placeAt` feeds it straight to `selectNotes`. Pasting a fan and being
      // left holding only its owner was this walk, not the selection.
      for (const np of chordStoredPitches(chord)) pastedIds.push(np.id)
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
    // Hairpins ride the same seam as the dynamics above, for the same reason and with one extra:
    // clearMeasureForRebar deletes the array, so anything not captured here is gone. The wedge's
    // `length` travels verbatim (see the CapturedAnchor comment).
    for (const h of m.hairpins ?? []) {
      out.push({ kind: 'hairpin', absBeat: fracAdd(base, h.beat), hairpin: h })
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
    } else if (a.kind === 'hairpin') {
      // Hairpins take the DYNAMICS rule, not the clef one: they may stack at a beat, so no dedupe.
      // Only the start moves — `length` is carried through untouched.
      //
      // ⚠️ The id is regenerated here, exactly as a dynamic's is. Any override keyed by a hairpin
      // id must therefore be captured and re-stamped the way the dynamic offset is a few lines
      // down; nothing writes one today, and the day one does, THIS is the site.
      if (!m.hairpins) m.hairpins = []
      m.hairpins.push({ ...a.hairpin, id: uuidv4(), beat })
      m.hairpins.sort((x, y) => fracCompare(x.beat, y.beat))
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
      const voice = voiceOf(s)
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
      (s) => s.type === 'rest' && voiceOf(s) === c.voice && (s.staffId ?? undefined) === (c.staffId ?? undefined) && fracCompare(s.beat, beat) === 0,
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

// ==================== Capture / restore: note offsets ====================

/**
 * Capture each region note-offset override (client #12) by its ABSOLUTE beat offset from the region
 * start plus (voice, staffId), measured with the CURRENT (pre-rebar) capacities, then CLEAR the
 * stored override — {@link restoreNoteOffsets} re-stamps it under the fresh slot id afterwards, or
 * drops it if the new tiling has no slot starting there. The slot-keyed twin of
 * {@link captureRestShifts}; it covers BOTH chords and rests, because a note offset hangs off the
 * whole slot (a chord moves as a unit). See docs/note-offset-plan.md.
 */
function captureNoteOffsets(score: Score, deps: RebarDeps, regionMeasures: Measure[]): CapturedNoteOffset[] {
  const out: CapturedNoteOffset[] = []
  forEachRegionMeasure(regionMeasures, (m, base) => {
    for (const s of m.slots) {
      const absBeat = fracAdd(base, s.beat)
      const ov = noteOffsetOverrideOf(score, s.id)
      if (ov && ov.x !== 0) {
        out.push({ voice: voiceOf(s), staffId: s.staffId, absBeat, x: ov.x })
        deps.clearEngravingOverride(s.id, 'noteOffset')
      }
      // ⭐ …and every FANNED MEMBER's own offset, at the SLOT's beat plus its index. A member has no
      // beat the tiling can hand back (it lives between the slot's column and the next), so the
      // group's own address plus a place in it is the whole address — see {@link CapturedNoteOffset}.
      if (s.type !== 'chord' || !s.fan?.members) continue
      s.fan.members.forEach((m, k) => {
        const id = m.pitches[0]?.id
        if (!id) return
        const mov = noteOffsetOverrideOf(score, id)
        if (!mov || mov.x === 0) return
        out.push({ voice: voiceOf(s), staffId: s.staffId, absBeat, x: mov.x, member: k + 1 })
        deps.clearEngravingOverride(id, 'noteOffset')
      })
    }
  })
  return out
}

/**
 * Re-stamp captured note offsets into the rebar'd/pasted region: map each absolute offset to the
 * (measure, beat) it now lands on, and write the override onto whatever slot of that (voice, staff)
 * now STARTS exactly there. Unlike a rest shift this is not rest-only — a chord slot or a rest slot
 * satisfies it — but the same "no slot start → silently DROP" rule applies (a note the new tiling
 * moved/merged away loses its offset, benign; docs/note-offset-plan.md deferred-travel note). Keyed
 * by the fresh slot id, so it survives the id re-mint. Overwrites on a collision (last wins), so
 * paste stamps the clip's offsets on top of the destination's by calling this again.
 *
 * ⭐ **A captured MEMBER lands on the member of the same index**, keyed by ITS fresh first pitch id —
 * and drops by the same rule, one level in: a slot that arrived without a fan, or with a shorter
 * one, has no member `k` to carry it. Neither drop is an error; both are the tiling saying the thing
 * that was offset is not there any more.
 */
function restoreNoteOffsets(score: Score, deps: RebarDeps, regionNumbers: number[], captured: CapturedNoteOffset[]): void {
  if (captured.length === 0) return

  const ranges = regionRanges(score, regionNumbers)
  if (ranges.length === 0) return

  for (const c of captured) {
    if (c.x === 0) continue
    const target = rangeForOffset(ranges, c.absBeat)
    const beat = fracSub(c.absBeat, target.start)
    const slot = target.measure.slots.find(
      (s) => voiceOf(s) === c.voice && (s.staffId ?? undefined) === (c.staffId ?? undefined) && fracCompare(s.beat, beat) === 0,
    )
    if (!slot) continue // the new tiling has no slot starting here → drop (benign)
    let key: string | undefined = slot.id
    if (c.member !== undefined) {
      key = slot.type === 'chord' ? slot.fan?.members?.[c.member - 1]?.pitches[0]?.id : undefined
      if (!key) continue // the slot that arrived carries no member k → drop, same rule one level in
    }
    const next: NoteOffsetOverride = { kind: 'noteOffset', x: c.x }
    deps.setEngravingOverride(key, next)
  }
}

/**
 * Snapshot every two-note tremolo in the region by ABSOLUTE offset, so it can be re-found after the
 * bars are re-tiled — the twin of {@link captureNoteOffsets}, and the missing half of the pair's
 * travel story.
 *
 * ⚠️ WITHOUT THIS A PASTE DESTROYS THE PAIRS IT LANDS NEAR, not just the ones it overwrites. Every
 * slot in the rebuilt region goes through the relay, and `RebarEvent` deliberately has no
 * `tremoloPair` field — so a paste into bar 4 quietly un-paired a mark at bar 4 beat 0 *and* one in
 * bar 5, neither of which the paste touched. Reported: *"last paste broke the already correct
 * things."*
 *
 * ⚠️ POSITION-KEYED, WHICH IS WHY IT IS SAFE where carrying the flag on the event would not be. The
 * relay hands a split event's marks to EVERY piece, so a `tremoloPair` riding `RebarEvent` would
 * mint a bogus pair between two halves of one tie-split note (docs/two-note-tremolo-plan.md §1).
 * This re-finds the slot that now STARTS at the same absolute offset and re-applies only where
 * `pairIsValid` still holds — so a pair the new tiling tore apart is simply not written back, which
 * is the drop, done cleanly.
 */
function captureTremoloPairs(regionMeasures: Measure[]): CapturedTremoloPair[] {
  const out: CapturedTremoloPair[] = []
  forEachRegionMeasure(regionMeasures, (m, base) => {
    for (const s of m.slots) {
      if (s.type !== 'chord' || !s.tremoloPair) continue
      out.push({ voice: voiceOf(s), staffId: s.staffId, absBeat: fracAdd(base, s.beat), style: s.tremoloPairStyle })
    }
  })
  return out
}

/**
 * Re-apply two-note tremolos onto the slots a rebar or paste produced, keyed by absolute offset
 * within the region (the same address {@link restoreNoteOffsets} uses).
 *
 * ⚠️ The mark is only written where it is still a NOTATION. The clip says "these two alternated";
 * whether they still can is a question about the bars they landed in, and only `pairIsValid` — read
 * off the destination's own lane — can answer it. A partner that arrived a different length, a
 * barline that came between them, a region that ended first: all of them mean no pair, and none of
 * them is an error. The flag is simply not written, which is what keeps a paste from minting the
 * dead flags §1 spends its length warning about.
 */
function restoreTremoloPairs(score: Score, regionNumbers: number[], captured: CapturedTremoloPair[]): void {
  if (captured.length === 0) return
  const ranges = regionRanges(score, regionNumbers)
  if (ranges.length === 0) return

  for (const c of captured) {
    const target = rangeForOffset(ranges, c.absBeat)
    const beat = fracSub(c.absBeat, target.start)
    const slot = target.measure.slots.find(
      (s) => voiceOf(s) === c.voice && (s.staffId ?? undefined) === (c.staffId ?? undefined) && fracCompare(s.beat, beat) === 0,
    )
    if (!slot || slot.type !== 'chord') continue
    const lane = laneOfSlot(target.measure.slots, slot)
    if (!pairIsValid(lane, lane.indexOf(slot))) continue
    slot.tremoloPair = true
    if (c.style) slot.tremoloPairStyle = c.style
  }
}

// ==================== Capture / restore: leading spaces ====================

/**
 * Capture and clear every user-authored leading space in the region (client #10 — see
 * docs/note-spacing-plan.md §6), keyed by its **absolute** offset from the region start so it can
 * be re-found after the bars are re-tiled.
 *
 * The twin of {@link captureRestShifts}, and position-keyed for the same reason — but with neither
 * a voice nor a staff, because a space belongs to the *column*, not to a note in it. One space per
 * rhythmic position, however many voices and staves happen to sound there.
 */
function captureLeadingSpaces(score: Score, deps: RebarDeps, regionMeasures: Measure[]): CapturedLeadingSpace[] {
  const out: CapturedLeadingSpace[] = []
  forEachRegionMeasure(regionMeasures, (m, base) => {
    for (const { beat, space } of measureLeadingSpaces(score, m.id)) {
      out.push({ absBeat: fracAdd(base, beat), space })
      deps.clearEngravingOverride(spacingPositionKey(m.id, beat), 'leadingSpace')
    }
  })
  return out
}

/**
 * Re-stamp captured leading spaces into the re-barred/pasted region: map each absolute offset to
 * the (measure, beat) it now lands on, and write the override there — **but only if some event
 * still starts at that beat.**
 *
 * That condition IS §6's auto-reset, stated positively. A space without a column is not a small
 * error, it is a meaningless one: the width math would still widen the bar and the render would
 * find nothing to shift, leaving a hole nobody asked for. So a meter change or a paste that
 * dissolves the column drops its space with it — explicitly, here at the write site, never as a
 * later sweep over "what looks orphaned".
 *
 * Any voice and any staff satisfies the test, mirroring the key: the column exists if *anything*
 * starts there. Overwrites on collision (last wins), so paste can stamp the clip's spaces on top
 * of the destination's by calling this twice.
 */
/**
 * Does anything start at this beat — **counting a fanned group's MEMBERS**, which is the §7 half of
 * the rule (docs/note-spacing-plan.md). A member is not a slot: its beat is an arbitrary rational
 * inside one, so the plain `slots.some(...)` test called every member space orphaned and dropped it
 * at the first meter change or paste. A member IS a column here in the only sense the test means —
 * there is a head drawn at that position for the space to open a gap before.
 */
function columnExistsAt(m: Measure, beat: Fraction): boolean {
  return m.slots.some((s) => {
    if (fracCompare(s.beat, beat) === 0) return true
    if (s.type !== 'chord' || !s.fan) return false
    const total = slotLength(s)
    return fanMemberBeats(s.fan, total, s.beat).some((b) => fracCompare(b, beat) === 0)
  })
}

function restoreLeadingSpaces(score: Score, deps: RebarDeps, regionNumbers: number[], captured: CapturedLeadingSpace[]): void {
  if (captured.length === 0) return

  const ranges = regionRanges(score, regionNumbers)
  if (ranges.length === 0) return

  for (const c of captured) {
    if (c.space === 0) continue
    const target = rangeForOffset(ranges, c.absBeat)
    const beat = fracSub(c.absBeat, target.start)
    const m = target.measure
    if (!columnExistsAt(m, beat)) continue // no column → no space
    const next: LeadingSpaceOverride = { kind: 'leadingSpace', space: c.space }
    deps.setEngravingOverride(spacingPositionKey(m.id, beat), next)
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
      const voice = voiceOf(s)
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
    .filter((c) => voiceOf(c) === voice) // ties never cross voices
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
      const voice = voiceOf(s)
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
      const voice = voiceOf(s)
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

// ==================== Capture / restore: trills ====================

/**
 * Snapshot every trill with at least one anchor inside the region BEFORE re-barring regenerates
 * note ids — the slur's pass, on the slur's key, for the same reason.
 *
 * ⚠️⚠️ **Without this, a meter change deletes every trill it touches.** A trill is anchored by note
 * identity ({@link Trill}), a re-bar re-mints every id in the region, and the dangling sweep would
 * then find nothing to point at — so "just let the belt handle it" is not a lighter-touch option,
 * it is the feature silently removing the user's marks. This is the whole of docs/trill-plan.md §2.1
 * and the amendment that plan needed most.
 *
 * The key is `captureSlurs`' — absolute onset offset from the region start (pre-rebar capacities)
 * + pitch + voice — because the question is identical: *which note is this, once the barlines have
 * moved?* An anchor OUTSIDE the region keeps its id verbatim (those are not regenerated), and an
 * absent `endNoteId` captures as `undefined` rather than as an unresolvable end.
 */
function captureTrills(score: Score, regionMeasures: Measure[]): CapturedTrill[] {
  const trills = score.trills
  if (!trills || trills.length === 0) return []

  const inRegion = new Map<string, { offset: Fraction; pitch: SlurPitch; voice: number }>()
  let base = fracCreate(0, 1)
  for (const m of regionMeasures) {
    const cap = measureCapacityFrac(m)
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      const offset = fracAdd(base, s.beat)
      const voice = voiceOf(s)
      for (const p of s.notes) {
        inRegion.set(p.id, { offset, pitch: { step: p.step, alter: p.alter, octave: p.octave }, voice })
      }
    }
    base = fracAdd(base, cap)
  }

  const captured: CapturedTrill[] = []
  for (const trill of trills) {
    const start = inRegion.get(trill.startNoteId)
    const end = trill.endNoteId !== undefined ? inRegion.get(trill.endNoteId) : undefined
    if (!start && !end) continue // wholly outside the region — untouched
    captured.push({
      trill,
      start: start ? { offset: start.offset, pitch: start.pitch, voice: start.voice } : { externalId: trill.startNoteId },
      end: trill.endNoteId === undefined
        ? undefined
        : end
          ? { offset: end.offset, pitch: end.pitch, voice: end.voice }
          : { externalId: trill.endNoteId },
    })
  }
  return captured
}

/**
 * Re-attach captured trills to the rebar'd region — {@link restoreSlurs}'s pass, with one
 * difference that matters.
 *
 * ⭐ **A trill whose START cannot be re-found is dropped; one whose END cannot be is DEGRADED** to
 * the one-note trill rather than removed. The sign belongs to a note that is still there, so the
 * mark is still true and only the line's length was in doubt — and `Trill.endNoteId` being optional
 * is exactly the state to fall back to. A slur has no such fallback (an arc needs two ends), which
 * is why it drops on either.
 */
function restoreTrills(score: Score, deps: RebarDeps, regionNumbers: number[], captured: CapturedTrill[]): void {
  if (captured.length === 0) return
  const trills = score.trills
  if (!trills) return

  const lookup = new Map<string, string>()
  let base = fracCreate(0, 1)
  for (const num of regionNumbers) {
    const m = getMeasure(score, num)
    if (!m) continue
    const cap = measureCapacityFrac(m)
    for (const s of m.slots) {
      if (s.type !== 'chord') continue
      const offset = fracAdd(base, s.beat)
      const voice = voiceOf(s)
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
    const idx = trills.indexOf(c.trill)
    if (idx === -1) continue
    const newStart = resolve(c.start)
    if (!newStart) {
      trills.splice(idx, 1)
      deps.clearEngravingOverride(c.trill.id) // auto-reset (§3.3): the sign's own note is unrecoverable
      dbg('[rebar.restoreTrills] start unrecoverable — trill dropped')
      continue
    }
    c.trill.startNoteId = newStart
    const newEnd = c.end ? resolve(c.end) : undefined
    if (newEnd !== undefined && newEnd !== newStart) c.trill.endNoteId = newEnd
    else delete c.trill.endNoteId
  }
}

/**
 * Create the clip's own trills on the freshly-pasted notes — {@link restoreClipSlurs}'s twin, on
 * the same staff-aware lookup, because a multi-staff paste must anchor on the intended staff.
 *
 * A trill whose start can't be re-found is skipped entirely; one whose END can't be lands as the
 * one-note trill, for {@link restoreTrills}'s reason.
 */
function restoreClipTrills(
  score: Score,
  deps: RebarDeps,
  regionNumbers: number[],
  clipTrills: ClipTrill[],
  targetStaff: number,
  targetVoice: number,
  singleVoice: boolean,
  pasteStart: Fraction,
  staffCount: number,
): void {
  if (clipTrills.length === 0) return

  const offKey = (off: Fraction): string => { const r = fracCreate(off.num, off.den); return `${r.num}/${r.den}` }
  const key = (staff: number, voice: number, off: Fraction, p: ClipSlurPitch): string =>
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
      const voice = voiceOf(s)
      const offset = fracAdd(base, s.beat)
      for (const p of s.notes) {
        const k = key(staff, voice, offset, { step: p.step, alter: p.alter, octave: p.octave })
        if (!lookup.has(k)) lookup.set(k, p.id)
      }
    }
    base = fracAdd(base, cap)
  }

  const resolve = (relStaff: number, endVoice: number, relOffset: Fraction, pitch: ClipSlurPitch): string | undefined => {
    const absStaff = targetStaff + relStaff
    if (absStaff < 0 || absStaff >= staffCount) return undefined
    const voice = singleVoice ? targetVoice : endVoice
    return lookup.get(key(absStaff, voice, fracAdd(pasteStart, relOffset), pitch))
  }

  for (const ct of clipTrills) {
    const startId = resolve(ct.startStaff, ct.startVoice, ct.startOffset, ct.startPitch)
    if (!startId) continue
    const endId = ct.endOffset !== undefined && ct.endPitch !== undefined
      ? resolve(ct.endStaff ?? ct.startStaff, ct.endVoice ?? ct.startVoice, ct.endOffset, ct.endPitch)
      : undefined
    const voice = (singleVoice ? targetVoice : ct.startVoice) as 0 | 1 | 2 | 3
    deps.addTrill({
      startNoteId: startId,
      ...(endId !== undefined && endId !== startId ? { endNoteId: endId } : {}),
      voice,
      ...(ct.placement !== undefined ? { placement: ct.placement } : {}),
    })
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
  clipSlurs: ClipSlur[],
  targetStaff: number,
  targetVoice: number,
  singleVoice: boolean,
  pasteStart: Fraction,
  staffCount: number,
): void {
  if (clipSlurs.length === 0) return

  // (staff | voice | offset | pitch) -> pitch id, over the pasted region (first chord wins).
  const offKey = (off: Fraction): string => { const r = fracCreate(off.num, off.den); return `${r.num}/${r.den}` }
  const key = (staff: number, voice: number, off: Fraction, p: ClipSlurPitch): string =>
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
      const voice = voiceOf(s)
      const offset = fracAdd(base, s.beat)
      for (const p of s.notes) {
        const k = key(staff, voice, offset, { step: p.step, alter: p.alter, octave: p.octave })
        if (!lookup.has(k)) lookup.set(k, p.id)
      }
    }
    base = fracAdd(base, cap)
  }

  const resolve = (relStaff: number, endVoice: number, relOffset: Fraction, pitch: ClipSlurPitch): string | undefined => {
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
  // ⚠️⚠️ AND HAIRPINS, and this line is load-bearing in a way the others are not. A new
  // measure-level array that is NOT deleted here does not vanish — it SURVIVES the wipe holding
  // its old beat while the bar's music is re-tiled around it, i.e. a wedge left pointing at music
  // that moved, with no error and with "it's still there" passing any test that counts them.
  // Deleting it makes captureBeatAnchors/restoreBeatAnchors the only road back, so a missed
  // capture is a visible loss instead of a silent lie.
  delete measure.hairpins
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
      actualDuration: writtenLength(piece),
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
    if (piece.tremolo) chord.tremolo = piece.tremolo
    // ⭐ Cloned with FRESH member pitch ids, for the same reason the chord's own notes get them just
    // above: a relay piece is a copy, and a paste can land the same payload twice. Two live slots
    // sharing a pitch id is silent — `getElementById` is document-wide and the first in tree order
    // wins. See {@link cloneFanFresh}.
    if (piece.fan) chord.fan = cloneFanFresh(piece.fan)
    // ⚠️ …and a COLLAPSED fan's span does not survive being re-tiled. `FanMark.length` says "this
    // gesture lasts 7/16" — a length the relay has just split into a dotted quarter tied to a
    // sixteenth, keeping the fan on the FIRST piece (the §7 rule above). Left standing, the mark
    // would claim time the piece beside it now holds, and two slots would sound over each other.
    // So the fan reverts to spanning the piece it landed on, which is what every fan meant before
    // a passage could be collapsed into one (`engine/models/fanCollapse.ts`). The music keeps its
    // total length either way — the tied piece holds what the ramp gave up.
    if (chord.fan?.length && !fracEq(chord.fan.length, writtenLength(piece))) delete chord.fan.length
    if (piece.beam) chord.beam = piece.beam
    if (piece.secondaryBreak) chord.secondaryBreak = true
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
