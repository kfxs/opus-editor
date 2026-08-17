/**
 * HAIRPINS — the crescendo / diminuendo wedges, as SCORE operations: add, remove, re-length,
 * look up. Free functions on a `Score`, in the `clefOps` / `slurOps` / `voiceOps` idiom, with
 * {@link ScoreModel} keeping thin delegators (docs/dynamics-line-and-hairpins-plan.md §6a,
 * principle 5 — *the score is independent of the editor*, so none of this may live on
 * `MusicEngine`, which is the editor's facade).
 *
 * A hairpin is stored on the measure its START lands in and carries its own {@link Hairpin.length}
 * — see {@link Hairpin} for why the end is an amount of music rather than a second address.
 * A consequence for every reader here: **a hairpin can extend past the end of its own bar**, so
 * "the hairpins of measure N" is *the ones that start there*, not the ones that cross it.
 *
 * ⚠️ Re-anchoring hairpins across a re-bar is NOT here — that is `rebarOps`, which owns every
 * beat-anchored thing that has to survive the barlines moving. The same split as `slurOps`.
 */
import type { Fraction, Score, Hairpin, Measure, HairpinEndpointOffsetOverride } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { hairpinEndpointOffsetOverrideOf } from './engravingOverrides'

/** A measure's hairpins (the live array; empty if none), sorted ascending by start beat. */
export function measureHairpins(measure: Measure): Hairpin[] {
  return measure.hairpins ?? []
}

/**
 * Add a hairpin starting at (`measure`, `hairpin.beat`) and covering `hairpin.length` of music.
 * `beat` must already be snapped to a slot boundary by the caller, exactly as for a dynamic.
 * Multiple hairpins MAY share a (beat, voice) — nothing is replaced, mirroring the dynamics rule
 * rather than the clef one. The list is kept sorted ascending by beat. A fresh id is generated.
 *
 * Rejected (returns null) when `length` is not positive: a wedge covering no music has no
 * geometry to derive and no honest way to draw, so it is refused at the model rather than
 * left for the renderer to discover. (Nothing is *clamped* here — the shortest wedge the UX
 * can make is a decision for the caller, which knows what a slot is.)
 */
export function addHairpin(score: Score, measureNumber: number, hairpin: Omit<Hairpin, 'id'>): Hairpin | null {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return null
  if (!fracIsPositive(hairpin.length)) return null

  const created: Hairpin = { ...hairpin, id: uuidv4() }
  if (!measure.hairpins) measure.hairpins = []
  measure.hairpins.push(created)
  measure.hairpins.sort((a, b) => fracCompare(a.beat, b.beat))
  return created
}

/**
 * Remove a hairpin by id, cleaning up the array when it becomes empty.
 *
 * Clears any engraving override keyed by that id on the way out — an override must not outlive
 * its anchor (the `removeSlur` / `removeDynamic` rule). Nothing writes one yet; the call is here
 * so the day a vertical nudge or a custom aperture arrives it cannot orphan.
 * @returns true if a hairpin was removed.
 */
export function removeHairpin(score: Score, id: string): boolean {
  for (const measure of score.measures) {
    if (!measure.hairpins) continue
    const idx = measure.hairpins.findIndex(h => h.id === id)
    if (idx === -1) continue
    measure.hairpins.splice(idx, 1)
    if (measure.hairpins.length === 0) delete measure.hairpins
    clearEngravingOverride(score, id)
    return true
  }
  return false
}

/** Find a hairpin anywhere in the score by id (live reference), or null. */
export function getHairpinById(score: Score, id: string): Hairpin | null {
  for (const measure of score.measures) {
    const found = measure.hairpins?.find(h => h.id === id)
    if (found) return found
  }
  return null
}

/** The measure a hairpin starts in (live reference), or null if no such hairpin exists. */
export function hairpinMeasure(score: Score, id: string): Measure | null {
  for (const measure of score.measures) {
    if (measure.hairpins?.some(h => h.id === id)) return measure
  }
  return null
}

/**
 * Set how much music a hairpin covers (the write half of `Ctrl+←/→`, and of any future drag of
 * its right-hand end).
 *
 * ⭐ **This writes the MODEL, not an override** — deliberately, and it is the one place the
 * distinction is easy to get wrong. A hairpin's extent is *musical*: it says which notes are
 * getting louder. Its height is not. So length lives on the content model and the vertical
 * nudge lives in the overrides compartment, and the same key (`Ctrl+→`) means different
 * categories of thing on a hairpin and on a slur endpoint one branch over. Letting a horizontal
 * drag write a cosmetic offset instead would give us two ways to say "this hairpin is three
 * beats long" that can disagree, with playback believing the one the eye does not.
 * See docs/dynamics-line-and-hairpins-plan.md §4.
 *
 * A non-positive length is refused rather than deleting the hairpin — removal is
 * {@link removeHairpin}'s job, and a shortening gesture that silently destroys the thing it is
 * shortening is a trap. @returns true if the hairpin exists and was updated.
 */
export function setHairpinLength(score: Score, id: string, length: Fraction): boolean {
  const hairpin = getHairpinById(score, id)
  if (!hairpin) return false
  if (!fracIsPositive(length)) return false
  hairpin.length = length
  return true
}

/**
 * Edit a hairpin by id (type / beat / length / voice / placement / staff). The owning measure's
 * list is re-sorted in case the beat changed. A non-positive `length` is refused, as in
 * {@link setHairpinLength}. @returns the updated Hairpin, or null if none has that id.
 */
export function updateHairpin(score: Score, id: string, updates: Partial<Omit<Hairpin, 'id'>>): Hairpin | null {
  if (updates.length !== undefined && !fracIsPositive(updates.length)) return null
  for (const measure of score.measures) {
    const hairpin = measure.hairpins?.find(h => h.id === id)
    if (!hairpin) continue
    Object.assign(hairpin, updates)
    measure.hairpins!.sort((a, b) => fracCompare(a.beat, b.beat))
    return hairpin
  }
  return null
}

/**
 * ⭐⭐ **Nudge one drawn END of a hairpin, accumulating** — the wedge's RESHAPE (`←/→/↑/↓` fine,
 * `Ctrl`+arrow coarse, with that end's square armed). `dx`/`dy` are in **staff-spaces**.
 *
 * ⭐ **The one thing on a hairpin that is an OVERRIDE rather than the model**, and the distinction is
 * the whole of §4: the extent says which notes get louder and lives on the content model; where the
 * ink is drawn does not, and lives in the engraving-overrides compartment. Same two squares, two
 * different chords, two different categories of edit — `Ctrl+Shift+arrow` moves the music, a plain
 * or `Ctrl` arrow moves the drawing. See {@link HairpinEndpointOffsetOverride}.
 *
 * @returns true if the hairpin exists (the caller then re-renders).
 */
export function setHairpinEndpointOffset(
  score: Score,
  id: string,
  which: 'start' | 'end',
  dx: number,
  dy: number,
): boolean {
  if (!getHairpinById(score, id)) return false
  const prev = hairpinEndpointOffsetOverrideOf(score, id)
  const base = which === 'start' ? prev?.start : prev?.end
  const next: HairpinEndpointOffsetOverride = {
    kind: 'hairpinEndpointOffset',
    ...(prev?.start ? { start: prev.start } : {}),
    ...(prev?.end ? { end: prev.end } : {}),
    [which]: { x: (base?.x ?? 0) + dx, y: (base?.y ?? 0) + dy },
  }
  setEngravingOverride(score, id, next)
  return true
}

/**
 * Drop ONE end's nudge, keeping the other's — `Ctrl+Backspace` with that square armed. Prunes the
 * whole entry when the other end has none either, so "absent = none" still holds.
 * @returns false when that end carries no offset, so the key falls through.
 */
export function resetHairpinEndpointOffset(score: Score, id: string, which: 'start' | 'end'): boolean {
  const prev = hairpinEndpointOffsetOverrideOf(score, id)
  if (!prev?.[which]) return false
  const other = which === 'start' ? prev.end : prev.start
  if (!other) {
    clearEngravingOverride(score, id, 'hairpinEndpointOffset')
    return true
  }
  const kept: HairpinEndpointOffsetOverride = which === 'start'
    ? { kind: 'hairpinEndpointOffset', end: other }
    : { kind: 'hairpinEndpointOffset', start: other }
  setEngravingOverride(score, id, kept)
  return true
}

/**
 * Flip a hairpin between crescendo and diminuendo (the `x`-style toggle a slur already has).
 * @returns the new type, or null if no hairpin has that id.
 */
export function toggleHairpinType(score: Score, id: string): 'cresc' | 'dim' | null {
  const hairpin = getHairpinById(score, id)
  if (!hairpin) return null
  hairpin.type = hairpin.type === 'cresc' ? 'dim' : 'cresc'
  return hairpin.type
}

/**
 * Where a hairpin ENDS, as a beat within its own measure — i.e. `beat + length`, which for
 * anything crossing a barline is past that measure's capacity. Offered as a named function
 * because the arithmetic reads as if it were an in-bar beat and is not: turning it into a
 * (measure, beat) pair means walking forward through the bars' capacities, which is the
 * renderer's job and needs the region, not this module.
 */
export function hairpinEndBeat(hairpin: Hairpin): Fraction {
  return fracAdd(hairpin.beat, hairpin.length)
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
 * Create a hairpin covering the music from `start` to the END of `end` — the shape both doors to a
 * hairpin need (`H` over a selection, and one click of the armed stamp).
 *
 * ⭐ **The caller says which notes; this says how much music that is.** The split matters: *which
 * notes did the user mean* depends on the selection, the armed tool and the voice the pointer is in
 * — editor questions, answered in `MusicEngine` exactly as `createSlur`'s are. *How long is that in
 * beats* is arithmetic over the bars' capacities, which is a score question and lives here. So the
 * two doors cannot drift apart, and neither of them can invent a length of its own.
 *
 * ⭐ **`end` is a note plus ITS OWN LENGTH**, not a boundary — because Gould's rule is to finish at
 * the right-hand edge of the last note, and because "an amount of music" has to include the last
 * note's own duration or a wedge over one whole note would cover nothing.
 *
 * IDEMPOTENT, like `createSlur`: an identical wedge already on that (measure, beat, voice, staff) is
 * returned rather than duplicated, so a stamp pressed twice on one note adds nothing.
 *
 * @returns the stored Hairpin, or null when the span covers no music (the two addresses coincide,
 *   or `end` lies before `start`).
 */
export function addHairpinOverNotes(
  score: Score,
  type: Hairpin['type'],
  start: { measure: number; beat: Fraction },
  end: { measure: number; beat: Fraction; length: Fraction },
  lane: { voice?: 0 | 1 | 2 | 3; staffId?: string } = {},
): Hairpin | null {
  const starts = measureStartOffsets(score)
  const absStart = starts.get(start.measure)
  const absEnd = starts.get(end.measure)
  if (absStart === undefined || absEnd === undefined) return null

  const length = fracSub(fracAdd(fracAdd(absEnd, end.beat), end.length), fracAdd(absStart, start.beat))
  if (!fracIsPositive(length)) return null

  const existing = (score.measures.find(m => m.number === start.measure)?.hairpins ?? []).find(h =>
    h.type === type
    && fracCompare(h.beat, start.beat) === 0
    && fracCompare(h.length, length) === 0
    && (h.voice ?? 0) === (lane.voice ?? 0)
    && h.staffId === lane.staffId)
  if (existing) return existing

  return addHairpin(score, start.measure, {
    type,
    beat: start.beat,
    length,
    ...(lane.voice !== undefined ? { voice: lane.voice } : {}),
    ...(lane.staffId !== undefined ? { staffId: lane.staffId } : {}),
  })
}

/** One slot of a hairpin's own lane, with the address it sits at — enough to step either end of the
 *  wedge onto it. */
interface LaneSlot {
  abs: Fraction
  length: Fraction
  measure: number
  /** Beat WITHIN `measure` — what a hairpin's own `beat` is, so a start moved here needs no
   *  reverse walk through the bars' capacities. */
  beat: Fraction
}

/**
 * A hairpin resolved for a step: the object, where it currently begins and ends on the score's one
 * absolute timeline, and every slot of its own lane.
 *
 * ⭐ **The lane, not the bar and not the score.** A wedge governs one voice on one staff — the lane
 * its notes are in — so the slots of any other are not steps it can take. Shared by both stepping
 * ops below, which differ only in WHICH end they move.
 */
function locate(score: Score, id: string): {
  hairpin: Hairpin
  startAbs: Fraction
  endAbs: Fraction
  lane: LaneSlot[]
} | null {
  const span = hairpinSpan(score, id)
  const hairpin = span ? getHairpinById(score, id) : null
  if (!span || !hairpin) return null

  const starts = measureStartOffsets(score)
  const startAbs = fracAdd(starts.get(span.startMeasure)!, span.startBeat)
  const endAbs = fracAdd(startAbs, hairpin.length)

  const lane: LaneSlot[] = []
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if ((slot.voice ?? 0) !== (hairpin.voice ?? 0)) continue
      if (!matchesStaff(slot.staffId, hairpin.staffId, score)) continue
      lane.push({ abs: fracAdd(base, slot.beat), length: slotLength(slot), measure: measure.number, beat: slot.beat })
    }
  }
  lane.sort((a, b) => fracCompare(a.abs, b.abs))
  return { hairpin, startAbs, endAbs, lane }
}

/**
 * ⭐⭐ **Move a hairpin's START by one slot of its own lane, HOLDING ITS END** — the model write
 * behind `Ctrl+Shift+←/→` with the wedge's LEFT square armed (his ask, 2026-08-17: *"we don't move
 * the endpoint position, we just move the first position"*).
 *
 * ## ⭐⭐ Why this needs no change to the model, though it looks like it does
 *
 * A `Hairpin` stores a start and an AMOUNT ({@link Hairpin.length}), so "move the start and leave
 * the end where it is" reads at first like a gesture the model cannot express — the end is not a
 * field, so nothing can hold it still. It is: the two shapes are the same information, and holding
 * the end fixed is `length' = end − start'`, written here in ONE operation. Storing two addresses
 * instead would not buy the gesture; it would move the two-field write to the OTHER one (dragging
 * the whole wedge, which today is a single `beat`).
 *
 * ⭐ What decided the stored shape is a different axis, and it is unchanged: **survival**. After a
 * re-bar only the START needs re-finding, because the extent is invariant — the music inside the
 * span did not change when the barlines moved ({@link Hairpin}, and the same argument verbatim on
 * {@link Ottava}). Two addresses would need both re-found, and a half-succeeding re-anchor leaves a
 * span whose end precedes its start.
 *
 * ⚠️ **So the invariant this op adds is a rule about EDITS, not about storage: an edit that holds one
 * end fixed writes `beat` and `length` together, atomically.** Split them and the wedge visibly
 * jumps between the two writes — and an undo entry taken between them stores a span nobody asked for.
 *
 * ⭐ A start moved across a barline MOVES THE HAIRPIN to the bar it now begins in (the list it is
 * stored in *is* "the wedges that start here"), keeping the same object and the same id — the id is
 * what the selection holds, and a re-created hairpin would silently deselect itself mid-gesture.
 *
 * Declines (false) when there is no earlier slot to reach back to, when the start would reach or
 * pass the END (which is {@link setHairpinLength}'s refusal, one step earlier), or when the hairpin
 * does not exist. Never deletes.
 */
export function moveHairpinStartBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const next = direction === -1
    // Reach BACK: the last slot beginning before the current start.
    ? [...lane].reverse().find(s => fracCompare(s.abs, startAbs) < 0)
    // Step IN: the first slot beginning after it — and never as far as the end.
    : lane.find(s => fracCompare(s.abs, startAbs) > 0)
  if (!next) return false
  return setHairpinStartAtSlot(score, id, next)
}

/** A lane slot named by its address — what a DRAG hands the two ops below, having found it from the
 *  cursor rather than by stepping. */
export interface HairpinSlotTarget {
  measure: number
  beat: Fraction
}

/**
 * ⭐ **Put the wedge's START on `target`, holding its END** — the drag's half of
 * {@link moveHairpinStartBySlot}, which now steps by finding a slot and calling this.
 *
 * Same invariant, and this is where it is actually kept: `beat` and `length` are written together,
 * so the end does not move. Declines when `target` is not a slot of the hairpin's own lane, or when
 * it would reach or pass the end.
 */
export function setHairpinStartAtSlot(score: Score, id: string, target: HairpinSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { hairpin, endAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  const length = fracSub(endAbs, slot.abs)
  if (!fracIsPositive(length)) return false

  // ⭐ Both fields, one step. See the invariant above.
  if (slot.measure !== hairpinMeasure(score, id)?.number) {
    if (!moveHairpinToMeasure(score, hairpin, slot.measure)) return false
  }
  hairpin.beat = slot.beat
  hairpin.length = length
  hairpinMeasure(score, id)?.hairpins?.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/**
 * ⭐ **Put the wedge's END at the RIGHT EDGE of `target`, holding its start** — i.e. COVER that slot.
 * The drag's way of reaching past the last note in the lane, and the reckoning
 * {@link resizeHairpinBySlot} grows by (Gould's "finish at the right-hand edge of the last note").
 *
 * Declines when `target` is not a slot of the hairpin's own lane, or when the wedge would cover no
 * music. Only `length` moves here — the start is a field nobody touches.
 */
export function setHairpinEndAtSlot(score: Score, id: string, target: HairpinSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  return setHairpinLength(score, id, fracSub(fracAdd(slot.abs, slot.length), startAbs))
}

/**
 * ⭐⭐ **Put the wedge's END just BEFORE `target` — its tip lands on that slot's left edge, and the
 * slot is NOT covered.** The drag's ordinary write, and the one that makes a dragged tip track the
 * cursor.
 *
 * ⭐ **Because that is where the renderer puts the tip.** `HairpinRenderer.spanX` draws the end at
 * `noteLeftX(endBeat)` — the left edge of the first UNCOVERED note — so the tip's possible positions
 * on screen are exactly the lane's onsets. Ending "at the right edge of the slot you pointed at"
 * (which is what {@link setHairpinEndAtSlot} does, and what a first cut of the drag used) therefore
 * draws the tip one whole note to the RIGHT of the note under the cursor: *"sometimes it jumps
 * before x mouse reach the target"*, his report, 2026-08-17. Snapping the drag to the drawn boundary
 * instead makes the jump land where the pointer is.
 *
 * ⚠️ It follows that the two writes are not redundant: this one is "the tip goes here", the other is
 * "this note is covered". A drag past the last note in the lane has no onset to aim at and uses that
 * one; every other frame uses this.
 *
 * Declines when `target` is not a slot of the hairpin's own lane, or when the wedge would cover no
 * music (dragging the tip back onto its own start).
 */
export function setHairpinEndBeforeSlot(score: Score, id: string, target: HairpinSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  return setHairpinLength(score, id, fracSub(slot.abs, startAbs))
}

/**
 * What one frame of a hairpin drag asks for — an address plus WHICH BOUNDARY of it the grabbed
 * square is being put on.
 *
 * ⭐ Three cases rather than two, because the tip and the start read a slot differently: a start
 * takes a slot's onset as its own, a tip takes an onset as its (exclusive) end, and only a drag
 * running off the last note in the lane asks for a slot to be COVERED. Naming them here keeps that
 * geometry in the model, beside the ops that implement it, rather than in the mouse handler.
 */
export type HairpinDragWrite = HairpinSlotTarget & {
  at: 'start' | 'endBefore' | 'endCovering'
}

/** Apply one frame of a drag. See {@link HairpinDragWrite}. */
export function applyHairpinDrag(score: Score, id: string, write: HairpinDragWrite): boolean {
  const target = { measure: write.measure, beat: write.beat }
  if (write.at === 'start') return setHairpinStartAtSlot(score, id, target)
  if (write.at === 'endBefore') return setHairpinEndBeforeSlot(score, id, target)
  return setHairpinEndAtSlot(score, id, target)
}

/** Re-file a hairpin under the measure it now starts in, keeping the SAME object (and id) so a
 *  selection holding it survives the move. @returns false if the target measure does not exist. */
function moveHairpinToMeasure(score: Score, hairpin: Hairpin, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.hairpins?.findIndex(h => h.id === hairpin.id) ?? -1
    if (idx === -1) continue
    measure.hairpins!.splice(idx, 1)
    if (measure.hairpins!.length === 0) delete measure.hairpins
    break
  }
  if (!target.hairpins) target.hairpins = []
  target.hairpins.push(hairpin)
  return true
}

/**
 * ⭐ **Grow or shrink a hairpin by ONE SLOT of its own lane** — the model write behind `Ctrl+→` /
 * `Ctrl+←`.
 *
 * ⭐ **By a slot, not by a fixed amount of time.** The end then always lands on a notehead, which is
 * the only place a wedge can honestly stop; a fixed step of a quarter would leave it mid-triplet,
 * and a step of "the shortest note in the score" would behave differently in different bars.
 * Growing reaches through the next slot at or after the current end; shrinking drops the last slot
 * the wedge covers.
 *
 * ⚠️ **This is the MODEL, not an override** — the same point {@link setHairpinLength} makes, and
 * the reason `Ctrl+Backspace` has nothing to reset on a hairpin.
 *
 * Declines (false) when there is nothing to reach (already at the end of the lane), when shrinking
 * would leave the wedge covering no music, or when the hairpin does not exist. Never deletes:
 * shortening past nothing is refused, because a gesture that destroys the thing it is shortening
 * is a trap.
 */
export function resizeHairpinBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, endAbs, lane } = placed

  let nextEnd: Fraction
  if (direction === 1) {
    // Reach through the next slot beginning at or after the current end.
    const next = lane.find(s => fracCompare(s.abs, endAbs) >= 0)
    if (!next) return false // nothing further in this lane — the wedge is already at its end
    nextEnd = fracAdd(next.abs, next.length)
  } else {
    // Drop the LAST slot the wedge covers: its onset becomes the new end.
    const covered = lane.filter(s => fracCompare(s.abs, startAbs) >= 0 && fracCompare(s.abs, endAbs) < 0)
    const last = covered[covered.length - 1]
    if (!last) return false
    nextEnd = last.abs
  }

  return setHairpinLength(score, id, fracSub(nextEnd, startAbs))
}

/** Where a hairpin begins and ends, as two (measure, beat) addresses. See {@link hairpinSpan}. */
export interface HairpinSpan {
  startMeasure: number
  startBeat: Fraction
  endMeasure: number
  /** Beat within `endMeasure`. ⚠️ MAY EQUAL that measure's capacity — a wedge finishing on the
   *  barline ends at the bar's end, not at beat 0 of the next one. */
  endBeat: Fraction
}

/**
 * Turn a hairpin's `beat + length` into the two (measure, beat) addresses it actually covers, by
 * walking forward through the bars' capacities.
 *
 * ⭐ **This is the price of having no foreign key, and it is paid here rather than in the
 * renderer.** Nothing on a `Hairpin` names the bar it ends in — which is what makes inserting and
 * deleting measures free — so the end address is DERIVED, every time, from the music that is
 * actually there. Bars removed from inside the span therefore change what the wedge covers, and
 * that is the documented consequence, not a bug ({@link Hairpin}).
 *
 * ⚠️ **A span running past the end of the score is CLAMPED to the last bar's end**, the same
 * defence `restoreBeatAnchors` applies to an over-running offset. A wedge pointing past the music
 * is not drawable, and refusing to answer would make the renderer invent its own clamp.
 *
 * @returns null if the start measure does not exist or holds no such hairpin.
 */
export function hairpinSpan(score: Score, id: string): HairpinSpan | null {
  const startMeasure = hairpinMeasure(score, id)
  const hairpin = startMeasure?.hairpins?.find(h => h.id === id)
  if (!startMeasure || !hairpin) return null

  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  const from = ordered.findIndex(m => m.number === startMeasure.number)
  if (from === -1) return null

  let remaining = hairpinEndBeat(hairpin)
  for (let i = from; i < ordered.length; i++) {
    const cap = measureCapacityFrac(ordered[i])
    // `<=`, not `<`: an end landing exactly on the barline belongs to THIS bar's end. Using `<`
    // would push it to beat 0 of the next bar, i.e. draw the wedge one bar too far.
    if (fracCompare(remaining, cap) <= 0) {
      return { startMeasure: startMeasure.number, startBeat: hairpin.beat, endMeasure: ordered[i].number, endBeat: remaining }
    }
    remaining = fracSub(remaining, cap)
  }

  const last = ordered[ordered.length - 1]
  return {
    startMeasure: startMeasure.number,
    startBeat: hairpin.beat,
    endMeasure: last.number,
    endBeat: measureCapacityFrac(last),
  }
}
