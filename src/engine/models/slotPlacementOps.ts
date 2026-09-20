/**
 * ⭐ **PLACING A SLOT — what arrives takes the time it covers.** One voice cannot be two things over
 * one beat, so a chord (or a rest) arriving in a lane EVICTS the rests its span overlaps; a tie that
 * pointed at an evicted rest moves onto whatever replaced it; a replaced tuplet rest hands its
 * `tupletId` on; and a NOTE taking a rest's position takes that rest's hidden flag with it. Score
 * logic, moved off `ScoreModel` (docs/code-shape-plan-2026-09-19.md, Phase 4.3c) — it is the
 * machinery under `ScoreModel.addNote`, its duration change, and `voiceOps`' {@link insertPitch}.
 *
 * {@link computeActualDurationForSlot} is here because placing is what needs it: a slot's SOUNDING
 * length — the bar's for a measure rest, the mark's for a collapsed fan, the tuplet's scale
 * otherwise — is what decides which rests it covers.
 *
 * ⚠️ WHO FILLS differs by caller, on purpose: see {@link evictRestsOverlapping}.
 */
import type { Chord, ChordRest, Fraction, Measure, NoteDuration, NoteParams, NotePitch, PitchInsert, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { slotLength, writtenLength } from '@/utils/durations'
import { cloneFanFresh } from '@/utils/fannedBeam'
import { fracCompare, fracEq, fracMul, fracToNumber } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { noteSpansOverlapFrac, tupletScale } from '@/utils/musicUtils'
import { alterToString } from '@/utils/pitchSpelling'
import { v4 as uuidv4 } from 'uuid'
import { restPositionKey } from './engravingOverrides'
import * as overrideOps from './overrideOps'
import { fillGapsWithRests } from './restFillOps'
import { matchesStaff, staffIdAtIndex } from './staffContent'

/**
 * Compact, voice-tagged one-line summary of a slot for debug logs, e.g.
 * `v0 C4+E4 q m1 b0.000` (a chord) or `v1 REST h. m2 b1.500`. Voice always
 * shown (even default 0) because the multi-voice paths are the sensitive ones.
 */
export function fmtSlot(slot: ChordRest): string {
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
export function computeActualDurationForSlot(slot: ChordRest | { duration: NoteDuration; dots?: number; tupletId?: string; isMeasureRest?: boolean }, measure: Measure): Fraction {
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
 * (both can be tied INTO — the let-ring rule; see deleteNoteOps.deleteNoteWithRepair).
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
function scanOverlappingRests(
  score: Score,
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
        matchesStaff(existing.staffId, staffId, score) &&
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

/**
 * A NOTE is taking this rest's position, so the rest's HIDDEN flag goes with it — it was
 * authored for a rest that will not be there (his report, 2026-08-30). ⛔ The rest SHIFT at the
 * same address stays: `docs/rest-shift-plan.md` §4 accepts resurrect-on-return. See
 * `overrideOps.clearRestHiddenAt` for why the two differ, and why this is operation-driven
 * rather than a sweep over what looks orphaned.
 */
export function dropRestHiddenOf(score: Score, measure: Measure, rest: Rest): void {
  overrideOps.clearRestHiddenAt(
    score, restPositionKey(measure.id, voiceOf(rest), rest.beat, rest.staffId),
  )
}

export function evictRestsOverlapping(score: Score, measure: Measure, incoming: ChordRest): string | undefined {
  const incomingDurFrac = slotLength(incoming)
  const incomingVoice = voiceOf(incoming)
  const tieTarget: { id: string; tiedFrom?: string } | undefined =
    incoming.type === 'chord' ? incoming.notes[0] : incoming

  let inheritedTupletId: string | undefined = incoming.tupletId
  const { evicted, remaining } = scanOverlappingRests(score,
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
      migrateRestTieTo(score, existing.id, tieTarget.id)
    }
    // ⭐ Only when a NOTE takes the position: a rest evicted by another rest is the rest-fill
    // churn the position key exists to survive, so its hidden flag must stay put.
    // See `overrideOps.clearRestHiddenAt`.
    if (incoming.type === 'chord') {
      dropRestHiddenOf(score, measure, existing)
    }
  }

  measure.slots = remaining
  return inheritedTupletId
}

/**
 * Replace rests overlapping a new Chord and fill gaps with new rests.
 * Also inherits tupletId from any replaced tuplet rest.
 */
export function replaceRestsWithChord(score: Score, measure: Measure, chord: Chord): void {
  const inheritedTupletId = evictRestsOverlapping(score, measure, chord)

  // Apply inherited tupletId
  if (inheritedTupletId && !chord.tupletId) {
    chord.tupletId = inheritedTupletId
    // Recompute actual duration with the now-known tuplet
    chord.actualDuration = computeActualDurationForSlot(chord, measure)
  }

  measure.slots.push(chord)

  // Fill gaps with rests
  fillGapsWithRests(score, measure)

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
export function evictRestsOverlappingChord(score: Score, measure: Measure, chord: Chord): void {
  const chordDurFrac = slotLength(chord)
  const chordVoice = voiceOf(chord)

  const { evicted, remaining } = scanOverlappingRests(score,
    measure, chord.beat, chordDurFrac, chordVoice, chord.staffId, chord.id,
  )
  if (evicted.length === 0) return

  for (const existing of evicted) {
    dbg(`[Model.evictRests] remove overlapping ${fmtSlot(existing)} (chord grew, v${chordVoice})`)
    if (chord.notes.length > 0) migrateRestTieTo(score, existing.id, chord.notes[0].id)
    dropRestHiddenOf(score, measure, existing)
  }

  measure.slots = remaining
  fillGapsWithRests(score, measure)
  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
}

/**
 * Update all NotePitch.tiedTo pointers that reference a deleted rest ID,
 * redirecting them to newNotePitchId.
 */
function migrateRestTieTo(score: Score, restId: string, newNotePitchId: string): void {
  for (const measure of score.measures) {
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
 * Mint a REST slot from entry params and place it: the rest branch of `ScoreModel.addNote`, lifted
 * out so the callers that only ever add rests — `tupletOps.refillTupletRemainder` first among them
 * — need no `addNote` callback. @returns the stored rest.
 *
 * ⚠️ Evicts, and deliberately does NOT fill — see {@link evictRestsOverlapping}.
 */
export function addRestSlot(score: Score, measure: Measure, params: NoteParams): Rest {
  // Which staff this slot belongs to (absent = staff 0) — see `ScoreModel.staffIdForParams`.
  const targetStaffId = params.staff ? staffIdAtIndex(score, params.staff) : undefined
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
  rest.actualDuration = computeActualDurationForSlot(rest, measure)
  // Through the SAME rule a new chord uses: a rest evicts the same-voice rests it overlaps.
  // This branch used to `push` and nothing else, which is how a bar reached six beats in 4/4
  // (see evictRestsOverlapping). No gap fill here: this is often the gap-filler's OWN addNote.
  dbg(`[Model.addNote] add REST ${fmtSlot(rest)} → m${measure.number}, replacing same-voice rests`)
  evictRestsOverlapping(score, measure, rest)
  measure.slots.push(rest)
  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  return rest
}

/**
 * Insert a pitch into a measure at a given beat/voice, **reusing the supplied
 * `pitch.id`** (unlike {@link addNote}, which always mints a fresh uuid). Mirrors
 * addNote's two branches: merge into a same-beat/same-voice chord, or build a
 * new chord and clear the target-voice rest via {@link replaceRestsWithChord}.
 * Used by {@link moveNoteToVoice} so a moved note keeps its anchored ties/slurs.
 */
export function insertPitch(score: Score, measure: Measure, payload: PitchInsert): void {
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
      && matchesStaff(s.staffId, payload.staffId, score),
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
        existingChord.actualDuration = computeActualDurationForSlot(existingChord, measure)
        fillGapsWithRests(score, measure) // reclaim the freed time as rests
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
  if (payload.fractionalBeamSide) chord.fractionalBeamSide = payload.fractionalBeamSide
  if (payload.beam) chord.beam = payload.beam
  if (payload.secondaryBreak) chord.secondaryBreak = true
  if (payload.tremolo) chord.tremolo = payload.tremolo
  if (payload.tremoloPair) chord.tremoloPair = true
  if (payload.tremoloPairStyle) chord.tremoloPairStyle = payload.tremoloPairStyle
  if (payload.fan) chord.fan = cloneFanFresh(payload.fan) // fresh member ids — see the merge branch
  if (targetVoice) chord.voice = targetVoice as 0 | 1 | 2 | 3
  if (payload.staffId !== undefined) chord.staffId = payload.staffId
  chord.actualDuration = computeActualDurationForSlot(chord, measure)
  dbg(`[Model.insertPitch] new chord ${fmtSlot(chord)} → replacing v${targetVoice} rests`)
  replaceRestsWithChord(score, measure, chord)
}
