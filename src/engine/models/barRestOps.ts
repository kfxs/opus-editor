/**
 * ⭐ **THE STAMPED FULL-BAR REST** — *"this voice is silent for the whole bar"*, said on purpose, in
 * any voice (docs/plans/voice-measure-rest-plan.md). Score logic: what the stamp DOES to the bar.
 * The button, the armed tool and the click are the editor's (P2).
 *
 * ⭐ **A full-bar rest is a full-bar rest** (his words, R3): whatever the lane held in that bar — its
 * notes, rests and tuplets — goes, and ONE whole-bar rest stands in its place, flagged
 * {@link Rest.stamped}. The other voices, and the same voice on the other staves, are not touched.
 *
 * ⭐ The flag is what keeps a voice 2–4 alive (R5, `voiceOps.collapseEmptyVoices`); an automatic
 * full-bar rest — the empty bar's, voice 1's — is unchanged and never carries it (R1, R4).
 *
 * What removing the lane's slots owes, the repairs a clear makes (`clearOps.clearNoteRange`), done
 * here for one whole lane: a tie ARRIVING from outside keeps its arc onto the silence (the let-ring
 * rule), a tie LEAVING for outside is severed at its far end, a slur follows its head onto the rest,
 * a glissando never stands on a rest, and the hand-positioning that belonged to what went goes too.
 * ⚠️ Not `clearNoteRange` itself: it keeps tuplets (they refill their own remainder) and refills the
 * lane by the meter — both are what a stamp replaces.
 */
import type { Fraction, Measure, NotePitch, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { fracAdd, fracCreate, fracLt, fracLte, fracSub } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import * as overrideOps from './overrideOps'
import { pushRestSlot } from './restFillOps'
import { reanchorSlurs } from './slurOps'
import { pruneGlissandi } from './glissandoOps'
import { findSlot } from './slotLookup'
import { keyStaffId, matchesStaff } from './staffContent'

/** The lane's slots in one bar — one staff, one voice. */
function laneSlots(score: Score, measure: Measure, staffId: string | undefined, voice: number) {
  return measure.slots.filter(s => voiceOf(s) === voice && matchesStaff(s.staffId, staffId, score))
}

/** The lane's stamped full-bar rest in that bar, if it holds exactly that. */
export function stampedBarRestAt(score: Score, measureNumber: number, staff: number, voice: number): Rest | undefined {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return undefined
  const lane = laneSlots(score, measure, keyStaffId(score, staff), voice)
  const only = lane.length === 1 ? lane[0] : undefined
  return only?.type === 'rest' && only.isMeasureRest && only.stamped ? only : undefined
}

/**
 * Stamp a full-bar rest on `staff`'s `voice` (0-based, the model's) in bar `measureNumber`.
 *
 * @returns the stamped rest, or `null` when the bar does not exist or the lane already holds exactly
 *   a stamped full-bar rest (nothing changed — the caller records no undo entry).
 */
export function stampBarRest(score: Score, measureNumber: number, staff: number, voice: number): Rest | null {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return null
  if (stampedBarRestAt(score, measureNumber, staff, voice)) return null

  const staffId = keyStaffId(score, staff)
  const lane = laneSlots(score, measure, staffId, voice)
  const laneIds = new Set(lane.map(s => s.id))
  const headIds: string[] = []
  for (const slot of lane) {
    if (slot.type === 'chord') headIds.push(...slot.notes.map(n => n.id))
    else headIds.push(slot.id)
  }
  const heads = new Set(headIds)

  // ── Resolve first: the ties ARRIVING from outside the lane (their arcs survive onto the silence) and
  //    LEAVING it (their far end is severed). Read before anything is spliced out.
  const arriving: NotePitch[] = []
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type !== 'chord' || laneIds.has(s.id)) continue
      for (const p of s.notes) if (p.tiedTo && heads.has(p.tiedTo)) arriving.push(p)
    }
  }
  for (const slot of lane) {
    if (slot.type !== 'chord') continue
    for (const p of slot.notes) {
      if (!p.tiedTo || heads.has(p.tiedTo)) continue
      const partner = findSlot(score, p.tiedTo)
      if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
      else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
    }
  }

  // ── Remove the lane, its tuplets and what was positioned by hand on it — BEFORE the new rest
  //    exists, or it would inherit a nudge authored for the old silence (`clearOps`' reason).
  const capacity = measureCapacityFrac(measure)
  overrideOps.clearClearedSpanOverrides(
    score,
    [{ measureId: measure.id, staffId, voice, from: fracCreate(0, 1), to: capacity }],
    [...laneIds],
  )
  for (const slot of lane) if (slot.type === 'chord') overrideOps.clearFanMemberOffsets(score, slot.fan?.members)
  const tupletIds = new Set(lane.map(s => s.tupletId).filter((id): id is string => !!id))
  measure.slots = measure.slots.filter(s => !laneIds.has(s.id))
  if (measure.tuplets && tupletIds.size) measure.tuplets = measure.tuplets.filter(t => !tupletIds.has(t.id))

  // ── The statement.
  pushRestSlot(measure, { beat: fracCreate(0, 1), duration: 'w', dots: 0, isMeasureRest: true }, voice, staffId)
  const rest = measure.slots[measure.slots.length - 1] as Rest
  rest.stamped = true

  // ── Re-anchor onto the silence.
  for (const p of arriving) p.tiedTo = rest.id
  if (arriving.length) rest.tiedFrom = arriving[0].id
  for (const id of headIds) reanchorSlurs(score, id, rest.id)
  pruneGlissandi(score)

  dbg(`[barRest] stamped m${measureNumber} staff${staff} v${voice} — ${lane.length} slot(s), ${tupletIds.size} tuplet(s) replaced`)
  return rest
}

// ==================== Through a RE-BAR or a PASTE (voice-measure-rest-plan P1) ====================

/**
 * A stamped silence, remembered by where it stands in TIME — region-relative offsets measured with
 * the bars as they were — because a re-bar or a paste rebuilds every lane of the region from its
 * notes, and a lane of rests only is then collapsed like any other.
 */
export interface StampedSilence {
  staffId: string | undefined
  voice: number
  from: Fraction
  to: Fraction
}

/** Each region bar with its region-relative start and its capacity. */
function spans(measures: readonly Measure[]): Array<{ measure: Measure; start: Fraction; end: Fraction }> {
  const out: Array<{ measure: Measure; start: Fraction; end: Fraction }> = []
  let base = fracCreate(0, 1)
  for (const measure of measures) {
    const end = fracAdd(base, measureCapacityFrac(measure))
    out.push({ measure, start: base, end })
    base = end
  }
  return out
}

/** Before the rebuild: every stamped full-bar rest in the region, by the time it covered. */
export function captureStampedSilence(regionMeasures: readonly Measure[]): StampedSilence[] {
  const out: StampedSilence[] = []
  for (const { measure, start, end } of spans(regionMeasures)) {
    for (const s of measure.slots) {
      if (s.type === 'rest' && s.stamped) out.push({ staffId: s.staffId, voice: voiceOf(s), from: start, to: end })
    }
  }
  return out
}

/**
 * After the rebuild: ⭐ every new bar that lies WHOLLY inside a stamped silence of its lane is that
 * silence still — so it is stamped again, at its new length. A bar the silence covers only in part
 * holds music too, and keeps the ordinary fill; a lane that holds a note there (or a tuplet) is left
 * alone — the notes are the newer statement.
 *
 * @param overwritten a paste's window, and which lanes it wrote: the silence there was REPLACED by
 *   the paste (his P1 row: *paste into its lane → replaced*), so it is cut out first.
 * @returns how many bars were stamped.
 */
export function restoreStampedSilence(
  score: Score,
  regionMeasures: readonly Measure[],
  captured: readonly StampedSilence[],
  overwritten?: { from: Fraction; to: Fraction; wrote: (staffId: string | undefined, voice: number) => boolean },
): number {
  if (!captured.length) return 0
  let stamped = 0
  for (const { measure, start, end } of spans(regionMeasures)) {
    const done = new Set<string>()
    for (const c of captured) {
      const lane = `${c.staffId ?? ''}|${c.voice}`
      if (done.has(lane)) continue
      if (!(fracLte(c.from, start) && fracLte(end, c.to))) continue
      if (overwritten && overwritten.wrote(c.staffId, c.voice)
        && fracLt(overwritten.from, end) && fracLt(start, overwritten.to)) continue
      const slots = laneSlots(score, measure, c.staffId, c.voice)
      if (slots.some(s => s.type === 'chord' || s.tupletId)) continue
      done.add(lane)
      const ids = new Set(slots.map(s => s.id))
      measure.slots = measure.slots.filter(s => !ids.has(s.id))
      pushRestSlot(measure, { beat: fracCreate(0, 1), duration: 'w', dots: 0, isMeasureRest: true }, c.voice, c.staffId)
      ;(measure.slots[measure.slots.length - 1] as Rest).stamped = true
      stamped++
    }
  }
  if (stamped) dbg(`[barRest] ${stamped} stamped full-bar rest(s) restored after the rebuild`)
  return stamped
}

/**
 * A bar's length changed and its barlines did NOT move (a meter change with `rewrite: 'none'`, its
 * propagation, a pickup length): the rests are refilled for the new length, and a STAMPED full-bar
 * rest is still the whole bar — so it is kept, and its sounding length follows the bar's.
 */
export function refitStampedRests(measure: Measure): void {
  for (const s of measure.slots) {
    if (s.type === 'rest' && s.stamped) s.actualDuration = measureCapacityFrac(measure)
  }
}

// ==================== Through COPY and PASTE (the clip) ====================

/**
 * The stamped silences of one `(staff, voice)` lane whose BAR lies wholly inside the copy window
 * `[spanStart, spanEnd)` — as `{ from, to }` re-based to the window start (the lane's events' basis).
 * Carried on the clip beside the events, because silence is not an event (`ClipLane.stampedSilence`).
 */
export function stampedSilenceInWindow(
  score: Score, staff: number, voice: number, spanStart: Fraction, spanEnd: Fraction,
): Array<{ from: Fraction; to: Fraction }> {
  const staffId = keyStaffId(score, staff)
  const out: Array<{ from: Fraction; to: Fraction }> = []
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  for (const { measure, start, end } of spans(ordered)) {
    if (!(fracLte(spanStart, start) && fracLte(end, spanEnd))) continue
    if (!laneSlots(score, measure, staffId, voice).some(s => s.type === 'rest' && s.stamped)) continue
    out.push({ from: fracSub(start, spanStart), to: fracSub(end, spanStart) })
  }
  return out
}
