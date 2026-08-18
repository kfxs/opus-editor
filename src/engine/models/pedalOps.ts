/**
 * SUSTAIN PEDALS — the damper span, as SCORE operations: add, remove, re-length, look up, and turn
 * `beat + length` into the two addresses it covers. Free functions on a `Score`, in the `clefOps` /
 * `hairpinOps` / `ottavaOps` idiom, with {@link ScoreModel} keeping thin delegators
 * (docs/pedal-plan.md §3; DESIGN-PRINCIPLES principle 5 — *the score is independent of the editor*,
 * so none of this may live on `MusicEngine`, which is the editor's facade).
 *
 * ⭐ **`ottavaOps` is the twin**, down to the shape of every function here, because a pedal and an
 * octave line are the same KIND of statement: a region of a staff, governing every voice and every
 * note typed into it afterwards, stored on the bar its start lands in and carrying its own extent.
 * What they differ in is what the region does to a sounding note — an ottava moves its PITCH, a
 * pedal moves its RELEASE (docs/pedal-plan.md §9) — and none of that is visible from here.
 *
 * ## ⭐⭐ The one rule that is this module's own: OVERLAP, and the SPLIT it forces
 *
 * Two sustain pedals overlapping on one staff is not a stack, it is a contradiction — one damper,
 * one foot. But *when* to say so is two questions, not one (docs/pedal-plan.md §3.3):
 *
 * - **{@link addPedal} takes the CLEF's rule and nothing more** — at most one per `(beat, staff)`,
 *   last wins. It does **not** police overlap, and that is `ottavaOps`' stated principle holding
 *   here: *the model refuses only what it can call wrong on its own terms*. Overlapping spans arrive
 *   from a re-bar, a paste and a length edit as well as from a create, and a low-level add that
 *   deleted one of them would destroy a span the user never named, inside a call that was not about
 *   it.
 * - **{@link addPedalOverNotes} — the ENTRY door — truncates.** A gesture is exactly what the entry
 *   phase knows about and the model does not: pressing the pedal again means *lift, re-press*.
 *
 * ⚠️ So a stored score CAN hold overlapping pedals, and the reader that has to survive it is
 * playback, which resolves positionally: the latest press at or before an event wins.
 *
 * ⚠️ Re-anchoring pedals across a re-bar is NOT here — that is `rebarOps`, which owns every
 * beat-anchored thing that has to survive the barlines moving. The same split as `hairpinOps`.
 */
import type { Fraction, Score, Pedal, Measure } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride } from './overrideOps'

/** A measure's pedals (the live array; empty if none), sorted ascending by start beat. */
export function measurePedals(measure: Measure): Pedal[] {
  return measure.pedals ?? []
}

/**
 * Add a sustain pedal starting at (`measure`, `pedal.beat`) covering `pedal.length` of music.
 * `beat` must already be snapped to a slot boundary by the caller, exactly as for a clef.
 * The list is kept sorted ascending by beat. A fresh id is generated.
 *
 * ⭐ **UPSERT, per staff** — a pedal already at this (beat, staff) is REPLACED rather than joined
 * ({@link addOttava}'s rule, and see this module's header for why it stops there). ⚠️ Staff
 * comparison is `matchesStaff`, not `===`: staff 0 stores an ABSENT id, so an explicit first-staff
 * id and an absent one are the same staff.
 *
 * Rejected (returns null) when `length` is not positive: a pedal holding no music has no lift to
 * draw and nothing to sustain, so it is refused at the model rather than left for the renderer to
 * discover ({@link addHairpin}'s reasoning verbatim).
 */
export function addPedal(score: Score, measureNumber: number, pedal: Omit<Pedal, 'id'>): Pedal | null {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return null
  if (!fracIsPositive(pedal.length)) return null

  const created: Pedal = { ...pedal, id: uuidv4() }
  if (!measure.pedals) measure.pedals = []
  const dup = measure.pedals.findIndex(p =>
    fracCompare(p.beat, pedal.beat) === 0 && matchesStaff(p.staffId, pedal.staffId, score))
  if (dup !== -1) {
    clearEngravingOverride(score, measure.pedals[dup].id)
    measure.pedals.splice(dup, 1)
  }
  measure.pedals.push(created)
  measure.pedals.sort((a, b) => fracCompare(a.beat, b.beat))
  return created
}

/**
 * Remove a pedal by id, cleaning up the array when it becomes empty.
 *
 * Clears any engraving override keyed by that id on the way out — an override must not outlive its
 * anchor (the `removeHairpin` / `removeOttava` rule). Nothing writes one yet; the call is here so
 * the day a hand-moved `✻` arrives (docs/pedal-plan.md §6.3) it cannot orphan.
 * @returns true if a pedal was removed.
 */
export function removePedal(score: Score, id: string): boolean {
  for (const measure of score.measures) {
    if (!measure.pedals) continue
    const idx = measure.pedals.findIndex(p => p.id === id)
    if (idx === -1) continue
    measure.pedals.splice(idx, 1)
    if (measure.pedals.length === 0) delete measure.pedals
    clearEngravingOverride(score, id)
    return true
  }
  return false
}

/** Find a pedal anywhere in the score by id (live reference), or null. */
export function getPedalById(score: Score, id: string): Pedal | null {
  for (const measure of score.measures) {
    const found = measure.pedals?.find(p => p.id === id)
    if (found) return found
  }
  return null
}

/** The measure a pedal starts in (live reference), or null if no such pedal exists. */
export function pedalMeasure(score: Score, id: string): Measure | null {
  for (const measure of score.measures) {
    if (measure.pedals?.some(p => p.id === id)) return measure
  }
  return null
}

/**
 * Set how much music a pedal holds — i.e. **move the lift**, which is the only thing a pedal's
 * length means (docs/pedal-plan.md §5.2).
 *
 * ⭐ **The MODEL, not an override** — {@link setOttavaLength}'s distinction, and it is just as sharp
 * here: a pedal's extent decides how long notes RING. A cosmetic offset that disagreed with it would
 * give us two answers to "where does the foot come up", with playback believing the one the eye does
 * not.
 *
 * A non-positive length is refused rather than deleting the pedal — removal is {@link removePedal}'s
 * job. @returns true if the pedal exists and was updated.
 */
export function setPedalLength(score: Score, id: string, length: Fraction): boolean {
  const pedal = getPedalById(score, id)
  if (!pedal) return false
  if (!fracIsPositive(length)) return false
  pedal.length = length
  return true
}

/**
 * Edit a pedal by id (beat / length / staff). The owning measure's list is re-sorted in case the
 * beat changed. A non-positive `length` is refused, as in {@link setPedalLength}.
 *
 * ⚠️ **No upsert here, unlike {@link addPedal}** ({@link updateOttava}'s note, verbatim): moving a
 * pedal onto a beat another one already occupies leaves both in place — a move is not a statement
 * about which of two should win. The write that MEANS "the foot goes down here" is `addPedal`.
 * @returns the updated Pedal, or null if none has that id.
 */
export function updatePedal(score: Score, id: string, updates: Partial<Omit<Pedal, 'id'>>): Pedal | null {
  if (updates.length !== undefined && !fracIsPositive(updates.length)) return null
  for (const measure of score.measures) {
    const pedal = measure.pedals?.find(p => p.id === id)
    if (!pedal) continue
    Object.assign(pedal, updates)
    measure.pedals!.sort((a, b) => fracCompare(a.beat, b.beat))
    return pedal
  }
  return null
}

/**
 * ⭐⭐ **THE ENTRY DOOR** — put a pedal under the music from `start` to the END of `end`, and make
 * room for it. Both ways in (the Lines palette over a selection, and one click of the armed stamp)
 * come through here, so neither can invent a length or an overlap rule of its own.
 *
 * ⭐ **The caller says which notes; this says how much music that is** — `addOttavaOverNotes`' split
 * and its reason: *which notes did the user mean* depends on the selection and the armed tool
 * (editor questions, answered in `MusicEngine`), while *how long is that in beats* is arithmetic
 * over the bars' capacities, which is a score question and lives here.
 *
 * ⭐ **`end` is a note plus ITS OWN LENGTH**, so the span covers the last note rather than stopping
 * on its onset — and here that is literal rather than cosmetic: the lift is where the damper falls,
 * so a span ending on the last note's onset would release the note the user pointed at.
 *
 * ## ⭐⭐ TRUNCATION — the gesture this door knows about and {@link addPedal} does not
 *
 * The pianist's real gesture is *lift, re-press*, so a new pedal makes room by moving other feet out
 * of the way rather than by stacking on them (docs/pedal-plan.md §3.3). On the pedal's own staff:
 *
 * - an existing pedal STARTING BEFORE this one and still down when it begins is **shortened to end
 *   at the new start** — the lift the pianist just performed;
 * - an existing pedal starting INSIDE this one is left alone and **this one stops where it begins**
 *   — it is a later press, equally deliberate, and swallowing it would delete a gesture to place
 *   one;
 * - an existing pedal starting on this one's exact beat is REPLACED, by {@link addPedal}'s upsert.
 *
 * @returns the stored Pedal, or null when the span covers no music (the two addresses coincide, or
 *   `end` lies before `start`).
 */
export function addPedalOverNotes(
  score: Score,
  start: { measure: number; beat: Fraction },
  end: { measure: number; beat: Fraction; length: Fraction },
  staffId?: string,
): Pedal | null {
  const starts = measureStartOffsets(score)
  const absStart = starts.get(start.measure)
  const absEnd = starts.get(end.measure)
  if (absStart === undefined || absEnd === undefined) return null

  const from = fracAdd(absStart, start.beat)
  let to = fracAdd(fracAdd(absEnd, end.beat), end.length)
  if (!fracIsPositive(fracSub(to, from))) return null

  // Every pedal already on this staff, on the absolute axis — read BEFORE anything is written, so
  // the two truncation rules below see the same picture.
  const existing: Array<{ pedal: Pedal; from: Fraction; to: Fraction }> = []
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const pedal of measure.pedals ?? []) {
      if (!matchesStaff(pedal.staffId, staffId, score)) continue
      const pFrom = fracAdd(base, pedal.beat)
      existing.push({ pedal, from: pFrom, to: fracAdd(pFrom, pedal.length) })
    }
  }

  // 1. Lift whatever was still down: an earlier press ends where this one begins.
  for (const e of existing) {
    if (fracCompare(e.from, from) >= 0) continue
    if (fracCompare(e.to, from) <= 0) continue
    e.pedal.length = fracSub(from, e.from)
  }

  // 2. …and stop at the next press, if one is already inside this span.
  for (const e of existing) {
    if (fracCompare(e.from, from) <= 0) continue
    if (fracCompare(e.from, to) < 0) to = e.from
  }

  return addPedal(score, start.measure, {
    beat: start.beat,
    length: fracSub(to, from),
    ...(staffId !== undefined ? { staffId } : {}),
  })
}

/**
 * ⭐⭐ **MOVE THE LIFT BY ONE SLOT** — the model write behind `Ctrl+→` / `Ctrl+←` on a selected pedal.
 *
 * ⭐ **By a SLOT, not by a fixed amount of time** ({@link resizeHairpinBySlot}'s rule): the lift then
 * always lands where a note begins, which is where a foot can honestly come up; a fixed step of a
 * quarter would leave it mid-triplet. Growing reaches through the next slot at or after the current
 * lift; shrinking drops the last slot the pedal holds.
 *
 * ⭐⭐ **The lane is the STAFF, and that is the one line that differs from the hairpin's.** A wedge
 * steps through the slots of its own VOICE, because it governs one; a pedal has no voice (§3.1), so
 * every voice of its staff is a step it can take — and it MUST be, or the key would move the `✻`
 * somewhere `PedalRenderer` does not draw it: the render reads the lift x from the first slot of the
 * staff at or after the lift beat, whatever voice that is (docs/pedal-plan.md §5.2/§6.3).
 *
 * ⚠️ **This is the MODEL, not an override** — {@link setPedalLength}'s point, and it is why
 * `Ctrl+Backspace` has nothing to reset on a pedal: how long the damper is down is what the notes
 * SOUND, not how the page looks.
 *
 * Declines (false) when there is nothing further in the staff, when shrinking would leave the pedal
 * holding no music, or when no such pedal exists. ⛔ Never deletes: shortening past nothing is
 * refused, because a gesture that destroys the thing it is shortening is a trap.
 */
export function resizePedalBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, endAbs, lane } = placed

  let nextLift: Fraction
  if (direction === 1) {
    // Reach through the next slot beginning at or after the current lift.
    const next = lane.find(s => fracCompare(s.abs, endAbs) >= 0)
    if (!next) return false // nothing further on this staff — the pedal already holds to the end
    nextLift = fracAdd(next.abs, next.length)
  } else {
    // Drop the LAST slot the pedal holds: its onset becomes the new lift.
    const held = lane.filter(s => fracCompare(s.abs, startAbs) >= 0 && fracCompare(s.abs, endAbs) < 0)
    const last = held[held.length - 1]
    if (!last) return false
    nextLift = last.abs
  }

  return setPedalLength(score, id, fracSub(nextLift, startAbs))
}

/**
 * ⭐⭐ **MOVE THE PRESS BY ONE SLOT, HOLDING THE LIFT** — the model write behind `Ctrl+Shift+←/→`
 * with the pedal's START square armed (his ask, 2026-08-18, the same afternoon as the squares).
 * `←` reaches the press back a slot (the pedal grows at the front), `→` steps it in (it shrinks from
 * the front); in both cases the lift stays exactly where it is.
 *
 * ⭐⭐ **Which the model expresses in ONE write, though it looks as if it could not.** A `Pedal`
 * stores a start and an AMOUNT, so "hold the lift" has no field to hold — and needs none: the end
 * stays put iff `length' = lift − start'`, both assigned together below. {@link
 * moveOttavaStartBySlot} argues this at length; it is repeated rather than shared for that
 * function's own reason, and here there is a second: what the two moves MEAN is different. An
 * octave line's start decides which notes are re-pitched; a pedal's decides when the damper falls,
 * so this write changes where notes begin to ring.
 *
 * ⭐ **A press moved across a barline MOVES THE PEDAL to the bar it now starts in** — the list it is
 * stored in *is* "the pedals that go down here" — keeping the same object and the same id, so the
 * selection the user is pressing arrows on survives the step.
 *
 * ⭐ **The lane is the STAFF, every voice** — {@link resizePedalBySlot}'s rule, and it must be the
 * same lane at both ends or the two squares would step to different sets of positions.
 *
 * ⚠️ **The MODEL, not an override**, like everything else about a pedal's extent: this is audible.
 *
 * Declines (false) when there is no slot to step to, when the press would reach the lift, or when no
 * such pedal exists. ⛔ Never deletes — shrinking to nothing is refused rather than removing the
 * pedal, {@link resizePedalBySlot}'s rule.
 */
export function movePedalStartBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const next = direction === -1
    // Reach BACK: the last onset before the current press.
    ? [...lane].reverse().find(s => fracCompare(s.abs, startAbs) < 0)
    // Step IN: the first onset after it. Reaching the lift is refused inside the write below.
    : lane.find(s => fracCompare(s.abs, startAbs) > 0)
  if (!next) return false
  return setPedalStartAtSlot(score, id, next)
}

/** A lane slot named by its address — what a DRAG hands the ops below, having found it from the
 *  cursor rather than by stepping. `OttavaSlotTarget`'s twin. */
export interface PedalSlotTarget {
  measure: number
  beat: Fraction
}

/**
 * ⭐ **Put the PRESS on `target`, holding the lift** — the drag's half of
 * {@link movePedalStartBySlot}, which now steps by finding a slot and calling this.
 *
 * The two-fields-one-write invariant is kept HERE, which is why the stepping op delegates rather
 * than repeating it. Declines when `target` is not an onset of the pedal's own staff, or when the
 * press would reach the lift.
 */
export function setPedalStartAtSlot(score: Score, id: string, target: PedalSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { pedal, startMeasure, endAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  const length = fracSub(endAbs, slot.abs)
  if (!fracIsPositive(length)) return false

  // ⭐ Both fields, one step — see {@link movePedalStartBySlot}. The re-file comes first: it can
  // fail, and a pedal left with a beat belonging to a bar it is not stored in would draw somewhere
  // nothing put it.
  if (slot.measure !== startMeasure && !movePedalToMeasure(score, pedal, slot.measure)) return false
  pedal.beat = slot.beat
  pedal.length = length
  pedalMeasure(score, id)?.pedals?.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/**
 * ⭐⭐ **Put the LIFT at `target`'s onset — or at the END of it — holding the press.**
 *
 * ⚠️⚠️ **`after` is not a convenience, it is the pedal's THIRD end rule showing through.** A trill
 * ends at the end of a DURATION and an octave bracket at the last NOTEHEAD, but a pedal's end is a
 * moment in TIME (docs/pedal-plan.md §5.2), and a moment can be named two ways at the last note of
 * a passage: *the damper comes up as this note is struck* (`after: false` — the note is dry) or
 * *when it finishes* (`after: true`). Everywhere else the two coincide, because the end of a slot
 * IS the next onset; only past the final note does `after` reach an address nothing else can name.
 *
 * ⭐ That is also exactly what the drag sees: cross the LEFT edge of a notehead and the `✻` lands
 * before it, cross its RIGHT edge and the pedal holds the note. `setHairpinEndBeforeSlot`'s pair by
 * a different route — ⛔ and not portable to the ottava, whose every draggable address is a covered
 * slot.
 *
 * Declines when `target` is not an onset of the pedal's own staff, or when the pedal would hold no
 * music. Only `length` moves — the press is a field nobody touches here.
 */
export function setPedalEndAtSlot(
  score: Score,
  id: string,
  target: PedalSlotTarget,
  after: boolean,
): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  const lift = after ? fracAdd(slot.abs, slot.length) : slot.abs
  return setPedalLength(score, id, fracSub(lift, startAbs))
}

/** One frame of an endpoint-square DRAG: which end the cursor is holding, and the address it is
 *  over. `OttavaDragWrite`'s twin — ⚠️ with the extra `after` bit the octave line has no use for
 *  ({@link setPedalEndAtSlot} says why). */
export type PedalDragWrite =
  | ({ at: 'start' } & PedalSlotTarget)
  | ({ at: 'end'; after: boolean } & PedalSlotTarget)

/**
 * Apply one frame of an endpoint-square drag — the mouse's road to the same two model writes the
 * keyboard reaches with `Ctrl+Shift+←/→`, so a pedal cannot be dragged into a state the keys could
 * not have produced. @returns true when the model changed.
 */
export function applyPedalDrag(score: Score, id: string, write: PedalDragWrite): boolean {
  return write.at === 'start'
    ? setPedalStartAtSlot(score, id, write)
    : setPedalEndAtSlot(score, id, write, write.after)
}

/** Re-file a pedal under a different measure, keeping the SAME object (and so the same id, which is
 *  what the selection holds). `ottavaOps`' twin, including the ⭐ `delete` of an emptied array — an
 *  absent `pedals` and an empty one must not both be reachable, or the JSON round trip has two
 *  spellings of "none". */
function movePedalToMeasure(score: Score, pedal: Pedal, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.pedals?.findIndex(p => p.id === pedal.id) ?? -1
    if (idx === -1) continue
    measure.pedals!.splice(idx, 1)
    if (measure.pedals!.length === 0) delete measure.pedals
    break
  }
  if (!target.pedals) target.pedals = []
  target.pedals.push(pedal)
  return true
}

/** Where a pedal is now and what it can step to — the shared read behind both endpoint gestures, so
 *  the two squares cannot come to disagree about the lane they walk. `ottavaOps.locate`'s twin. */
function locate(score: Score, id: string): {
  pedal: Pedal
  startMeasure: number
  startAbs: Fraction
  endAbs: Fraction
  lane: ReturnType<typeof staffOnsets>
} | null {
  const span = pedalSpan(score, id)
  const pedal = span ? getPedalById(score, id) : null
  if (!span || !pedal) return null

  const starts = measureStartOffsets(score)
  const base = starts.get(span.startMeasure)
  if (base === undefined) return null
  const startAbs = fracAdd(base, span.startBeat)

  return {
    pedal,
    startMeasure: span.startMeasure,
    startAbs,
    endAbs: fracAdd(startAbs, pedal.length),
    lane: staffOnsets(score, pedal.staffId, starts),
  }
}

/**
 * Every onset of the pedal's STAFF, by absolute quarter-beat, with the slot's own length and address
 * — every VOICE (a pedal has none of its own: one damper, one foot), de-duplicated by beat so two
 * voices attacking together are ONE step rather than two presses of the key for one move, and
 * sorted.
 *
 * ⚠️ De-duplicating keeps the LONGEST slot at a shared onset, which is what "reach through the next
 * slot" has to mean when two voices start together and one is longer: the shorter one's end is
 * inside the longer one's note, so lifting there would put the release at a position no onset
 * occupies — and the next press would have to skip the rest of that note. `ottavaOps.staffOnsets`'
 * rule, which the inline lane this replaced did not have (it kept whichever slot it met first).
 */
function staffOnsets(
  score: Score,
  staffId: string | undefined,
  starts: Map<number, Fraction>,
): Array<{ abs: Fraction; length: Fraction; measure: number; beat: Fraction }> {
  const at = new Map<string, { abs: Fraction; length: Fraction; measure: number; beat: Fraction }>()
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if (!matchesStaff(slot.staffId, staffId, score)) continue
      const abs = fracAdd(base, slot.beat)
      const length = slotLength(slot)
      const key = `${abs.num}/${abs.den}`
      const seen = at.get(key)
      if (!seen || fracCompare(length, seen.length) > 0) {
        at.set(key, { abs, length, measure: measure.number, beat: slot.beat })
      }
    }
  }
  return [...at.values()].sort((a, b) => fracCompare(a.abs, b.abs))
}

/** Cumulative quarter-beat offset of each measure's start, keyed by measure number. */
function measureStartOffsets(score: Score): Map<number, Fraction> {
  const out = new Map<number, Fraction>()
  let base = fracCreate(0, 1)
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    out.set(m.number, base)
    base = fracAdd(base, measureCapacityFrac(m))
  }
  return out
}

/**
 * ⭐ **THE LIFT**, as a beat within the pedal's own measure — i.e. `beat + length`, which for
 * anything crossing a barline is past that measure's capacity. Named rather than inlined for
 * {@link ottavaEndBeat}'s reason: the arithmetic reads as if it were an in-bar beat and is not.
 */
export function pedalEndBeat(pedal: Pedal): Fraction {
  return fracAdd(pedal.beat, pedal.length)
}

/** Where a pedal goes down and comes up, as two (measure, beat) addresses. See {@link pedalSpan}. */
export interface PedalSpan {
  startMeasure: number
  startBeat: Fraction
  endMeasure: number
  /** Beat within `endMeasure`. ⚠️ MAY EQUAL that measure's capacity — and for a pedal that is the
   *  COMMON case rather than an edge one: Gould's rule puts the release at or before the barline,
   *  so a bar-length pedal lifts at the bar's end, not at beat 0 of the next one. */
  endBeat: Fraction
}

/**
 * Turn a pedal's `beat + length` into the two (measure, beat) addresses it actually covers, by
 * walking forward through the bars' capacities. {@link ottavaSpan}'s twin, and for its reason:
 * nothing on a `Pedal` names the bar it lifts in — which is what makes inserting and deleting
 * measures free — so the end address is DERIVED, every time, from the music that is actually there.
 *
 * ⚠️ A span running past the end of the score is CLAMPED to the last bar's end, the same defence
 * `restoreBeatAnchors` applies to an over-running offset.
 *
 * @returns null if the start measure does not exist or holds no such pedal.
 */
export function pedalSpan(score: Score, id: string): PedalSpan | null {
  const startMeasure = pedalMeasure(score, id)
  const pedal = startMeasure?.pedals?.find(p => p.id === id)
  if (!startMeasure || !pedal) return null

  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  const from = ordered.findIndex(m => m.number === startMeasure.number)
  if (from === -1) return null

  let remaining = pedalEndBeat(pedal)
  for (let i = from; i < ordered.length; i++) {
    const cap = measureCapacityFrac(ordered[i])
    // `<=`, not `<`: a lift landing exactly on the barline belongs to THIS bar's end. Using `<`
    // would push it to beat 0 of the next bar — i.e. sustain one bar too much, and draw the `✻` on
    // the wrong side of the line Gould says it must stay inside of.
    if (fracCompare(remaining, cap) <= 0) {
      return { startMeasure: startMeasure.number, startBeat: pedal.beat, endMeasure: ordered[i].number, endBeat: remaining }
    }
    remaining = fracSub(remaining, cap)
  }

  const last = ordered[ordered.length - 1]
  return {
    startMeasure: startMeasure.number,
    startBeat: pedal.beat,
    endMeasure: last.number,
    endBeat: measureCapacityFrac(last),
  }
}
