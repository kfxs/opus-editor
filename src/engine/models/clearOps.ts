/**
 * ⭐⭐ **CLEARING A RANGE — what silence a deleted PASSAGE leaves behind.**
 *
 * Deleting ONE note replaces it with a rest of its own length: that is an edit of a single event,
 * and the length is authored (`MusicEngine.deleteNote`). Deleting a RANGE is a different question —
 * it is a HOLE in the bar, and a hole is filled by the meter, not by the notes that used to be in
 * it. His report, 2026-08-31, on bar 1 of the Prelude: clearing the second half of the bar left
 * `8 + 16×6` on the treble and `16 + 8. + q` on the bass, when the answer in 4/4 is **one half
 * rest** — *"the space deleted should be filled with the corresponding rest in a musical sense,
 * taking into account the meter and the beat"*.
 *
 * ⭐ **The rule was already here, and already right — nothing ever asked it.** `utils/restFill`'s
 * `fillRests` (Gould's show-each-beat rule: a rest may span `[p,q)` only when no boundary strictly
 * inside it is stronger than the weaker endpoint) is driven per staff and per voice by
 * `ScoreModel.fillGapsWithRests`. It answers `[2,4) → h` and, correctly, `[1,3) → q q` — a half rest
 * may not straddle the middle of a 4/4 bar. `ScoreModel.convertToRest`'s own doc has stated the
 * division all along: *"Deleting instead leaves a gap for `repairAllMeasureGaps` to re-fill
 * meter-aware, which is right for a HOLE"*. The delete path simply never left one.
 *
 * ⚠️ **The fill must run ONCE, after every removal.** Delete on a multi-select was a LOOP of
 * single deletes, so even a per-note hole would have been filled per note — the span is never seen
 * whole. That is the whole of this module: remove first, then fill each touched bar once.
 *
 * ⭐ **And the hand-positioning goes with the content it described** — his second report the same
 * day: the fill landed the right half rest in the right lane, six steps high, because a `restShift`
 * is filed under a POSITION and the clear had just refilled that position. `clearClearedSpanOverrides`
 * drops the overrides inside the cleared SPAN only, so a nudge on a rest the clear never reached
 * still describes a rest still on the page.
 *
 * ⛔ **Three kinds of id are NOT a hole**, and keep the single-note behaviour exactly:
 *   - a TUPLET member — `fillRests` is tuplet-unaware by design and `fillGapsWithRests` skips gaps
 *     that start inside a tuplet's span; the tuplet refills its own remainder;
 *   - a FANNED member — removing one is a change to the GROUP's size, not to the bar's time;
 *   - one head of a CHORD whose other heads are NOT selected — the slot stays, so no time is freed.
 * Each of those goes back through the caller's ordinary per-note delete.
 */
import type { Score, ChordRest, Fraction, Rest, NotePitch } from '@/types/music'
import { dbg } from '@/utils/debug'
import { fracAdd, fracLt, fracLte, fracToNumber } from '@/utils/fraction'
import { slotLength } from '@/utils/durations'
import { voiceOf } from '@/utils/lanes'
import { findSlot } from './slotLookup'
import { keyStaffId, staffIndexOfId } from './staffContent'
import * as overrideOps from './overrideOps'

/**
 * The callbacks a range clear calls back into — the {@link voiceOps.VoiceDeps} idiom, and for its
 * reason: removal, rest-fill and slur re-anchoring are machinery this operation USES and does not
 * own. `removeSlot` is the raw model delete (no replacement rest); `deleteOne` is the caller's
 * ordinary single-note delete, for the three kinds above that must not change.
 */
export interface ClearRangeDeps {
  /** Raw slot/pitch removal — `ScoreModel.deleteNote`, with its fan/chord/tie bookkeeping. */
  removeSlot(noteId: string): boolean
  /** The unchanged single-note delete — `MusicEngine.deleteNote`. */
  deleteOne(noteId: string): boolean
  /** Meter-aware rest fill for one bar — `ScoreModel.fillMeasureGaps`. */
  fillMeasureGaps(measureNumber: number): void
  /** Drop a secondary voice left holding only rests — `ScoreModel.collapseEmptyVoices`. */
  collapseEmptyVoices(measureNumber: number): void
  /** Move every slur anchored to `oldId` onto `newId`, or drop it when that is null. */
  reanchorSlurs(oldId: string, newId: string | null): void
}

/** One slot the clear will take out, resolved BEFORE anything moves. */
interface Target {
  /** The SLOT's own id — what an id-keyed override (a note offset) hangs off. */
  slotId: string
  /** Every head of the slot — what slurs and ties are anchored to, gone once the slot is. */
  headIds: string[]
  measure: number
  measureId: string
  beat: Fraction
  /** `beat + length` — the time this slot held, and so the time the clear frees. */
  end: Fraction
  voice: number
  staffIndex: number
  /** The staff as a position key writes it: absent for the first staff ({@link keyStaffId}). */
  keyStaff: string | undefined
  /** The notes tying INTO this slot: their arcs survive onto the silence that replaces it. */
  tieSources: string[]
}

/**
 * Clear the slots named by `noteIds` and refill the time they held with meter-correct rests.
 * Returns how many ids were acted on.
 *
 * The three exceptions above are routed to `deps.deleteOne` and are counted too — the caller asked
 * for those ids to go, and they do; only the SILENCE they leave is decided elsewhere.
 */
export function clearNoteRange(score: Score, noteIds: readonly string[], deps: ClearRangeDeps): number {
  const ids = [...new Set(noteIds)]
  const idSet = new Set(ids)

  // ── Resolve first, mutate second. Every field below is read off a slot that is about to be
  //    spliced out of its measure, so nothing here may run after the removals.
  const targets: Target[] = []
  const inPlace: string[] = []

  for (const id of ids) {
    const found = findSlot(score, id, { fanMembers: true })
    if (!found) continue
    if (found.type === 'chord' && found.member) { inPlace.push(id); continue }

    const slot: ChordRest = found.type === 'rest' ? found.rest : found.chord
    if (slot.tupletId) { inPlace.push(id); continue }
    // A chord only PART of which is selected keeps its slot: the time is still occupied.
    if (found.type === 'chord' && !found.chord.notes.every(n => idSet.has(n.id))) { inPlace.push(id); continue }
    // …and the same chord reached through its other heads is ONE target, not two.
    if (targets.some(t => t.headIds.includes(id))) continue

    const staffIndex = staffIndexOfId(score, slot.staffId)
    targets.push({
      slotId: slot.id,
      headIds: found.type === 'chord' ? found.chord.notes.map(n => n.id) : [slot.id],
      measure: slot.measure,
      measureId: score.measures.find(m => m.number === slot.measure)?.id ?? '',
      beat: slot.beat,
      end: fracAdd(slot.beat, slotLength(slot)),
      voice: voiceOf(slot),
      staffIndex,
      keyStaff: keyStaffId(score, staffIndex),
      tieSources: [],
    })
  }

  for (const target of targets) {
    // Arcs ARRIVING keep their shape, the let-ring rule `deleteNoteOps.deleteNoteWithRepair` already follows —
    // scan-based, so a chord tied into this one keeps every arc. A source INSIDE the cleared range
    // is going too; it simply won't be found again when the time comes to re-point it.
    for (const pitch of allPitches(score)) {
      if (pitch.tiedTo && target.headIds.includes(pitch.tiedTo)) target.tieSources.push(pitch.id)
    }
  }

  if (!targets.length && !inPlace.length) return 0

  // ── Remove. The slots go with no replacement rest at all — the bar is transiently short, which
  //    is exactly the hole the fill below is owed.
  for (const target of targets) for (const head of target.headIds) deps.removeSlot(head)
  for (const id of inPlace) deps.deleteOne(id)

  // ── ⭐ The hand-positioning that belonged to what just went — BEFORE the refill, or the fresh
  //    rest inherits it. A rest shift is filed by POSITION (rest ids churn on every edit), the
  //    positions inside the cleared span are about to be refilled, and a nudge authored for the old
  //    rest would silently become the new one's: his report, 2026-08-31, the bass staff's half rest
  //    drawn six steps high. Span-scoped, so an override the clear never reached is left standing.
  overrideOps.clearClearedSpanOverrides(
    score,
    targets.map(t => ({ measureId: t.measureId, staffId: t.keyStaff, voice: t.voice, from: t.beat, to: t.end })),
    targets.map(t => t.slotId),
  )

  // ── Fill, ONCE per bar the clear touched. `fillMeasureGaps` walks every staff-lane and voice of
  //    the bar and hands each hole to `fillRests`, so one call answers the whole rectangle.
  const touched = [...new Set(targets.map(t => t.measure))].sort((a, b) => a - b)
  for (const measureNumber of touched) {
    deps.fillMeasureGaps(measureNumber)
    dbg(`[clearRange] m${measureNumber} refilled meter-aware after ${targets.filter(t => t.measure === measureNumber).length} slot(s) cleared`)
  }

  // ── Re-anchor onto the silence. A slur or a tie that pointed at a cleared head follows it onto
  //    whichever rest of the fill now covers that beat — and is dropped when the fill put nothing
  //    there (the head's own lane collapsed, or the bar had no room left).
  for (const target of targets) {
    const rest = restCovering(score, target)
    for (const head of target.headIds) deps.reanchorSlurs(head, rest?.id ?? null)
    if (!rest) continue
    let repointed = 0
    for (const sourceId of target.tieSources) {
      const source = findSlot(score, sourceId)
      if (source?.type !== 'chord') continue // the source went in this same clear
      source.pitch.tiedTo = rest.id
      repointed++
    }
    if (repointed) {
      rest.tiedFrom = target.tieSources.find(id => findSlot(score, id))
      dbg(`[clearRange] ${repointed} tie(s) re-pointed onto the ${rest.duration} rest at m${target.measure} b${fracToNumber(target.beat).toFixed(3)}`)
    }
  }

  // A secondary voice left holding only rests collapses, exactly as after a single delete.
  for (const measureNumber of touched) deps.collapseEmptyVoices(measureNumber)

  return targets.length + inPlace.length
}

/** Every pitch in the score, chord heads only — fanned members carry no ties. */
function allPitches(score: Score): NotePitch[] {
  const out: NotePitch[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'chord') out.push(...slot.notes)
    }
  }
  return out
}

/**
 * The rest the fill left over `target`'s beat, in `target`'s own lane — `[beat, beat + length)`,
 * so a half rest is found from anywhere inside it, which is what a range clear needs: several
 * cleared slots share the one rest that replaced them.
 */
function restCovering(score: Score, target: Target): Rest | undefined {
  const measure = score.measures.find(m => m.number === target.measure)
  if (!measure) return undefined
  for (const slot of measure.slots) {
    if (slot.type !== 'rest') continue
    if (voiceOf(slot) !== target.voice) continue
    if (staffIndexOfId(score, slot.staffId) !== target.staffIndex) continue
    if (fracLte(slot.beat, target.beat) && fracLt(target.beat, fracAdd(slot.beat, slotLength(slot)))) return slot
  }
  return undefined
}
