/**
 * TRILLS — the top-level note-anchored ornament spans, in the `slurOps` / `hairpinOps` idiom:
 * free functions over a `Score`, with {@link ScoreModel} keeping thin public delegators
 * (docs/modularity-plan-2026-07-28.md Phase 3; docs/trill-plan.md §2).
 *
 * A trill is stored ONCE, at the top of the score (`score.trills`), as a start note id, an optional
 * end note id and a voice. Never on a measure: a trill crosses barlines and systems freely, and a
 * span that lived on one bar would have to be split and re-joined by every re-bar — {@link Slur}'s
 * argument, and the reason this module reads like `slurOps` rather than like `hairpinOps`.
 *
 * ⚠️ **Re-attaching trills across a re-bar is NOT here** — that is `rebarOps`, which owns every
 * anchored thing that has to survive the barlines moving. This module's only concession to it is
 * that nothing here caches an address: every question is asked of the score as it stands.
 *
 * ⛔ **There is no `measureTrills`.** A trill is not measure-owned, so "the trills in bar 7" is not
 * a fact the model holds — it is derived, through {@link trillSpan}, from where the anchors landed
 * this instant. `hairpinOps.measureHairpins` exists because a hairpin genuinely lives on a bar.
 */
import type { Score, Trill, TrillContinuationLabel, Fraction, Measure, ChordRest, NotePitch } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { findSlot } from './slotLookup'
import { clearEngravingOverride } from './overrideOps'
import { voiceOf } from '@/utils/lanes'
import { dbg } from '@/utils/debug'
import { keyAt } from '@/utils/keySignature'
import { trillAuxiliary, type TrillAuxiliary } from '@/utils/trillPitch'
import { prevailingAlterations } from '@/utils/accidentalState'
import { measureAccidentalNotes } from '@/utils/musicUtils'

/** All trills (the live array; empty if none). See {@link Trill}. */
export function getTrills(score: Score): Trill[] {
  return score.trills ?? []
}

/** Find a trill anywhere by id (live reference), or null. */
export function getTrillById(score: Score, id: string): Trill | null {
  return score.trills?.find(t => t.id === id) ?? null
}

/** The trill whose SIGN sits on this note, or undefined. A note carries at most one. */
export function trillOnNote(score: Score, startNoteId: string): Trill | undefined {
  return score.trills?.find(t => t.startNoteId === startNoteId)
}

/**
 * Add a trill. **Idempotent and ADD-only**: a note already carrying one gets that trill back
 * rather than a second, because a note carries at most one trill — the accidental stamp's
 * single-valued rule, and the shape `addHairpinOverNotes` already established for the stamp that
 * will call this (docs/trill-plan.md §6).
 *
 * ⛔ **Refused (null) on a REST and on a FANNED MEMBER.** The rest case is nonsense on its face.
 * The member case is the decision docs/trill-plan.md §2.2 had to make, because the code says two
 * things: `slotLookup.findSlot`'s note names the commands that must refuse a member ("a tie, a
 * slur, an articulation, a duration change: they attach to the SLOT — the whole gesture — and a
 * member is not one"), while `ScoreModel.repairDanglingSlurs` deliberately includes members so a
 * slur CAN span them. A trill is a sign ON one note plus a duration — the articulation family's
 * attachment, not the slur's span-between-two-points — so it refuses. Refusing here (rather than
 * half-writing an anchor nothing draws) is what lets the stamp consume a near-miss click.
 *
 * @returns the stored Trill (with a generated id), the existing one, or null when refused.
 */
export function addTrill(score: Score, trill: Omit<Trill, 'id'>): Trill | null {
  if (!isTrillable(score, trill.startNoteId)) {
    dbg(`[trillOps.addTrill] refused: ${trill.startNoteId.slice(0, 8)} is a rest, a fan member, or missing`)
    return null
  }
  if (trill.endNoteId !== undefined) {
    if (!isTrillable(score, trill.endNoteId)) {
      dbg(`[trillOps.addTrill] refused: end ${trill.endNoteId.slice(0, 8)} is a rest, a fan member, or missing`)
      return null
    }
    // A trill whose "end" precedes its start is not a short trill, it is a mis-resolved one — and
    // an end EQUAL to the start is the no-line case, which is spelled by omitting `endNoteId`
    // rather than by repeating it. Normalising here keeps `trillSpan` from having to answer either.
    if (trill.endNoteId === trill.startNoteId) {
      trill = { ...trill, endNoteId: undefined }
    } else if (!precedes(score, trill.startNoteId, trill.endNoteId)) {
      dbg('[trillOps.addTrill] refused: the end note does not follow the start note')
      return null
    }
  }

  const existing = trillOnNote(score, trill.startNoteId)
  if (existing) {
    dbg(`[trillOps.addTrill] idempotent: ${trill.startNoteId.slice(0, 8)} already trills`)
    return existing
  }

  const created: Trill = { ...trill, id: uuidv4() }
  if (!score.trills) score.trills = []
  score.trills.push(created)
  return created
}

/** Remove a trill by id. @returns true if one was removed. */
export function removeTrill(score: Score, id: string): boolean {
  if (!score.trills) return false
  const i = score.trills.findIndex(t => t.id === id)
  if (i < 0) return false
  score.trills.splice(i, 1)
  clearEngravingOverride(score, id) // auto-reset (§3.3): trill deleted → its overrides die with it
  return true
}

/**
 * Re-anchor one end of a trill. `noteId === null` clears the END (back to the one-note trill);
 * the START cannot be cleared, since there is no trill without a note.
 * @returns true if the trill exists and was updated.
 */
export function setTrillEnd(score: Score, id: string, noteId: string | null): boolean {
  const trill = getTrillById(score, id)
  if (!trill) return false
  if (noteId === null || noteId === trill.startNoteId) {
    delete trill.endNoteId
    return true
  }
  if (!isTrillable(score, noteId) || !precedes(score, trill.startNoteId, noteId)) return false
  trill.endNoteId = noteId
  return true
}

/**
 * ⭐⭐ **Re-anchor a trill's START — the sign moves to another note, the end holds.** The model write
 * behind `Ctrl+Shift+←/→` with the left square armed (his ask, 2026-08-18).
 *
 * ⭐ **Everything {@link addTrill} refuses, this refuses**: a rest, a fanned member, a note that is
 * not there. The reason is the same and it is worth not re-deriving — a trill is a sign ON one note,
 * the articulation family's attachment rather than the slur's span-between-two-points.
 *
 * ⭐ **…plus one refusal of its own: a note that already trills.** Moving a start onto another
 * trill's note would leave two ornaments on one notehead, which is a contradiction rather than a
 * stack — the accidental stamp's single-valued rule, arriving here by a move instead of by an add.
 * ⛔ It refuses rather than merging: destroying a trill the user never named, inside a call that was
 * not about it, is the thing `addPedal`'s note argues against.
 *
 * ⚠️ **The end is held, not moved** — so the start may not reach or pass it. An explicit `endNoteId`
 * is the bound; without one there is nothing to cross, since the end is derived from the start's own
 * tie chain and travels with it.
 *
 * @returns true if the trill exists and was updated.
 */
export function setTrillStart(score: Score, id: string, noteId: string): boolean {
  const trill = getTrillById(score, id)
  if (!trill) return false
  if (noteId === trill.startNoteId) return false
  if (!isTrillable(score, noteId)) {
    dbg(`[trillOps.setTrillStart] refused: ${noteId.slice(0, 8)} is a rest, a fan member, or missing`)
    return false
  }
  const occupied = trillOnNote(score, noteId)
  if (occupied && occupied.id !== id) {
    dbg(`[trillOps.setTrillStart] refused: ${noteId.slice(0, 8)} already trills`)
    return false
  }
  // ⭐⭐ **REACHING THE END COLLAPSES THE TRILL onto that note**, ⛔ it does not refuse — and this is
  // {@link addTrill}'s OWN normalisation arriving by a move instead of by an add: *an end EQUAL to
  // the start is the no-line case, which is spelled by omitting `endNoteId` rather than by repeating
  // it*. The result is the ordinary one-note trill, which is a finished ornament.
  //
  // ⭐ It is also the mirror of what the END square does when it steps back onto the start
  // (`interactions/trillReanchor`): both ends collapse the line rather than jamming against it. His
  // report, 2026-08-18: *"i can move the first point (tr) to the left but not to the right"* — on a
  // trill whose end was the very next note, so every rightward step reached it.
  //
  // ⚠️ The two fields are written together, and the end goes FIRST: `precedes` would refuse a start
  // that equals a still-present end, so the order is not cosmetic.
  if (trill.endNoteId !== undefined) {
    if (noteId === trill.endNoteId) {
      delete trill.endNoteId
    } else if (!precedes(score, noteId, trill.endNoteId)) {
      dbg('[trillOps.setTrillStart] refused: the start would pass the end')
      return false
    }
  }
  trill.startNoteId = noteId
  return true
}

/**
 * Set how a CONTINUATION system labels this trill — see {@link Trill.continuationLabel}.
 * @returns true if the trill exists and was updated.
 */
export function setTrillContinuationLabel(score: Score, id: string, label: TrillContinuationLabel): boolean {
  const trill = getTrillById(score, id)
  if (!trill) return false
  // ⭐ The DEFAULT is stored as absence, not as the string: a score full of trills should carry no
  // `continuationLabel` at all, so the field appears only where someone departed from the default.
  // That is what keeps a future score-wide preset able to move the default without rewriting them.
  if (label === 'parenthesised') delete trill.continuationLabel
  else trill.continuationLabel = label
  return true
}

/** Flip a trill between above and below the staff (the `x` key's branch). @returns the new side. */
export function toggleTrillPlacement(score: Score, id: string): 'above' | 'below' | null {
  const trill = getTrillById(score, id)
  if (!trill) return null
  trill.placement = (trill.placement ?? 'above') === 'above' ? 'below' : 'above'
  return trill.placement
}

// ==================== The span ====================

/** Where a trill begins and ends, and every slot it covers. See {@link trillSpan}. */
export interface TrillSpan {
  startMeasure: number
  startBeat: Fraction
  /** The LAST trilled slot's measure. */
  endMeasure: number
  /** ⚠️ The last trilled slot's **ONSET**, not the point the trill stops — unlike
   *  `HairpinSpan.endBeat`, which is an end. A trill sounds and draws to the END of that slot's
   *  span, and where that lands is a RENDER question (the next column's x, or the bar's end), read
   *  off the registry rather than computed here. Keeping it an onset means this function never has
   *  to know a slot's sounding length, which tuplets and ties both complicate. */
  endBeat: Fraction
  /** Every slot the trill covers, in order — at least the start's. What playback re-attacks over
   *  (docs/trill-plan.md §7) and what the renderer measures its ink band against. */
  slotIds: string[]
}

/*
 * ⚠️⚠️ **THERE IS NO `hasLine`, AND THAT IS A DECISION — HIS, 2026-08-13.**
 *
 * This interface carried one, and the renderer asked it before drawing the wiggle. The rule came
 * from the research (docs/trill-plan.md §1 rule 5, LilyPond's and Gould's practice): *a single note
 * needs no wavy line; the line exists exactly when the reader must know how long to keep trilling.*
 *
 * ⭐ **He tested it and overruled it: the line ALWAYS shows.** A `tr` alone leaves the duration
 * implied, and he wants it shown — on one note as much as on twenty. So the wiggle runs from the
 * sign to the end of the trilled span, always, and the only thing that can suppress it is there
 * being no room left after the sign (which the renderer still guards).
 *
 * ⛔ **Do not reintroduce this flag from the sources.** A reader who finds rule 5 in the plan and
 * "fixes" the code back would be undoing a decision made with the drawing in front of him, which
 * beats a convention read off a page. A field that is always true is not a field.
 */

/**
 * Resolve a trill to the music it actually covers, right now.
 *
 * ⭐ **An absent `endNoteId` is resolved through TIES**, which is the engraving rule and the model's
 * simplest case in one: a trill on a note tied over the barline keeps trilling to the last tied
 * note, and it took no field to say so. A present `endNoteId` is used verbatim (an explicit end
 * wins over the tie chase — the user said where it stops).
 *
 * ⭐ **The span is the slots of the trill's own lane between the anchors.** Voice comes from the
 * START SLOT rather than from `Trill.voice`, for `span-voice-aware`'s reason: the slot holding the
 * pitch id is the truth, and the stored field is a cache that a voice move keeps in step.
 *
 * @returns null when the start anchor no longer resolves (a dangling trill — dropped by the sweep,
 *   but this must not invent a span in the meantime).
 */
export function trillSpan(score: Score, id: string): TrillSpan | null {
  const trill = getTrillById(score, id)
  if (!trill) return null

  const start = locate(score, trill.startNoteId)
  if (!start) return null

  const endId = trill.endNoteId ?? lastTiedFrom(score, trill.startNoteId)
  const end = endId === trill.startNoteId ? start : locate(score, endId)
  // A resolvable start with an unresolvable end degrades to the one-note trill rather than to
  // nothing: the sign is still true, and only the line's length was in doubt.
  const stop = end && !before(end, start) ? end : start

  const slotIds = laneSlotsBetween(score, start, stop)
  return {
    startMeasure: start.measureNumber,
    startBeat: start.slot.beat,
    endMeasure: stop.measureNumber,
    endBeat: stop.slot.beat,
    slotIds,
  }
}

// ==================== The auxiliary ====================

/**
 * ⭐ **What this trill alternates WITH** — the diatonic step above, resolved against the key in
 * force and the accidentals already used in its bar (docs/trill-plan.md §3, P1).
 *
 * The arithmetic is `utils/trillPitch`'s and the key is `utils/keySignature`'s; this function is
 * only the ADDRESS — find the trilled note, gather the bar it sits in, and ask. It lives here
 * rather than in either util because those two are pure and this one needs the score.
 *
 * ⭐ **The bar scope is the whole measure, every voice** (`measureAccidentalNotes`, fanned members
 * included) — the same list `MusicEngine.getPrevailingAlter` feeds, because an accidental holds at
 * its staff position for the rest of the bar regardless of which voice wrote it. A narrower scope
 * would let the trill sound a pitch the reader can see contradicted three notes earlier.
 *
 * @returns null when the trill or its start note no longer resolves.
 */
export function trillAuxiliaryOf(score: Score, id: string): TrillAuxiliary | null {
  const trill = getTrillById(score, id)
  if (!trill) return null

  const found = findSlot(score, trill.startNoteId)
  if (found?.type !== 'chord') return null
  const pitch = found.chord.notes.find(p => p.id === trill.startNoteId)
  if (!pitch) return null

  const measure = score.measures.find(m => m.number === found.chord.measure)
  if (!measure) return null

  const key = keyAt(score, measure.number, found.chord.staffId)
  const inBar = prevailingAlterations(measureAccidentalNotes(measure), found.chord.beat)
  return trillAuxiliary({ step: pitch.step, octave: pitch.octave }, key, inBar)
}

// ==================== Internals ====================

/** A resolved anchor: the slot holding the pitch, and where that slot sits. */
interface Anchor {
  measureNumber: number
  /** The measure's place in ascending order — the only ordering that is safe to compare, since
   *  measure NUMBERS are renumbered by an insert while a sort is always current. */
  order: number
  slot: ChordRest
  voice: number
  staffId: string | undefined
}

/** May a trill anchor here? A chord pitch that is not a fanned member — see {@link addTrill}. */
function isTrillable(score: Score, noteId: string): boolean {
  const found = findSlot(score, noteId, { fanMembers: true })
  return found?.type === 'chord' && found.member === undefined
}

/** Where the slot holding `noteId` sits, or null. Rests and fan members do not resolve. */
function locate(score: Score, noteId: string): Anchor | null {
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  for (let order = 0; order < ordered.length; order++) {
    const measure: Measure = ordered[order]
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      if (!slot.notes.some(p => p.id === noteId)) continue
      return { measureNumber: measure.number, order, slot, voice: voiceOf(slot), staffId: slot.staffId }
    }
  }
  return null
}

/** Is `a` earlier in the score than `b`? */
function before(a: Anchor, b: Anchor): boolean {
  if (a.order !== b.order) return a.order < b.order
  return a.slot.beat.num * b.slot.beat.den < b.slot.beat.num * a.slot.beat.den
}

/** Does `startId` come strictly before `endId` in the score? False if either fails to resolve. */
function precedes(score: Score, startId: string, endId: string): boolean {
  const a = locate(score, startId)
  const b = locate(score, endId)
  return !!a && !!b && before(a, b)
}

/**
 * The last note a tie chain reaches from `noteId` — the trill's implicit end. Guarded against a
 * cycle by the visited set: a corrupt `tiedTo` loop must not hang the renderer.
 */
function lastTiedFrom(score: Score, noteId: string): string {
  const seen = new Set<string>([noteId])
  let current = noteId
  for (;;) {
    const found = findSlot(score, current)
    if (found?.type !== 'chord') return current
    const pitch: NotePitch | undefined = found.chord.notes.find(p => p.id === current)
    const next = pitch?.tiedTo
    if (!next || seen.has(next)) return current
    seen.add(next)
    current = next
  }
}

/**
 * The ids of the slots in the anchors' own lane, from `from` to `to` inclusive.
 *
 * Lane membership is `(voice, staffId)` taken from the START — a trill does not change voice
 * mid-span, and a span whose ends disagree is the caller's bug, not something to paper over here.
 */
function laneSlotsBetween(score: Score, from: Anchor, to: Anchor): string[] {
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  const ids: string[] = []
  for (let order = from.order; order <= to.order; order++) {
    const measure = ordered[order]
    if (!measure) break
    const lane = measure.slots
      .filter(s => voiceOf(s) === from.voice && s.staffId === from.staffId)
      .sort((a, b) => a.beat.num * b.beat.den - b.beat.num * a.beat.den)
    for (const slot of lane) {
      if (order === from.order && slot.beat.num * from.slot.beat.den < from.slot.beat.num * slot.beat.den) continue
      if (order === to.order && slot.beat.num * to.slot.beat.den > to.slot.beat.num * slot.beat.den) continue
      // ⭐ Rests inside the span are SKIPPED, not ended on. A trill whose end note is three bars
      // later legitimately passes over a rest in another voice's texture; what it must never do is
      // report a rest as something to re-attack.
      if (slot.type === 'chord') ids.push(slot.id)
    }
  }
  return ids
}
