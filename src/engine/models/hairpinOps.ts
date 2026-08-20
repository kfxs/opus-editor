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
import type { Fraction, Score, Hairpin, Measure, HairpinEndpointOffsetOverride, HairpinApertureOverride } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { onSameStaff, sameScope, voiceScopeOf, type VoiceScope } from '@/utils/dynamicScope'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { hairpinEndpointOffsetOverrideOf, hairpinApertureOverrideOf } from './engravingOverrides'

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
 * its anchor (the `removeSlur` / `removeDynamic` rule). Since 2026-08-17 a hairpin really has some:
 * the two end nudges and the hand-set mouth, all of which die here.
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
 * ⭐ **An OVERRIDE, not the model**, and the distinction is the whole of §4: the extent says which
 * notes get louder and lives on the content model; where the ink is drawn does not, and lives in the
 * engraving-overrides compartment. Same two squares, two different chords, two different categories
 * of edit — `Ctrl+Shift+arrow` moves the music, a plain or `Ctrl` arrow moves the drawing. See
 * {@link HairpinEndpointOffsetOverride}, and {@link setHairpinAperture} for the wedge's other one.
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
 * ⭐⭐ **Move the WHOLE wedge** — the same staff-space delta onto BOTH ends, accumulating (his ask,
 * 2026-08-17: the arrows with a hairpin selected but NO square armed).
 *
 * ⭐ **It is the end nudges twice, and deliberately not a field of its own.** What is drawn is
 * `automatic + offset` at each end, so moving the pair by an equal amount IS moving the wedge — and a
 * separate "whole-hairpin offset" would be a second place the same pixels could come from, i.e. two
 * numbers that can disagree about where the wedge is. It also means the two gestures compose: nudge
 * the whole thing, then open one end, and the model holds exactly what you did.
 *
 * ⚠️ So a whole-wedge move is visible per END afterwards (Properties shows both rows changed), which
 * is honest rather than lossy: there was never a "whole wedge" quantity to preserve.
 *
 * @returns true if the hairpin exists.
 */
export function setHairpinOffset(score: Score, id: string, dx: number, dy: number): boolean {
  if (!getHairpinById(score, id)) return false
  setHairpinEndpointOffset(score, id, 'start', dx, dy)
  setHairpinEndpointOffset(score, id, 'end', dx, dy)
  return true
}

/**
 * Drop BOTH ends' nudges at once — `Ctrl+Backspace` with the wedge selected and no square armed, the
 * matching backspace for {@link setHairpinOffset}. @returns false when neither end carries one.
 */
export function resetHairpinOffset(score: Score, id: string): boolean {
  if (!hairpinEndpointOffsetOverrideOf(score, id)) return false
  clearEngravingOverride(score, id, 'hairpinEndpointOffset')
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
 * ⭐ **Set (or clear) a hairpin's MOUTH** — the third of its overrides, and the only one that is one
 * number for the whole wedge rather than a per-end pair. `aperture` is in **staff-spaces**; pass
 * `null` to hand the mouth back to the automatic, length-aware default.
 *
 * ⛔ A non-positive mouth is REFUSED rather than stored: the renderer draws nothing at all for one
 * (`shape.aperture > 0`), so accepting it would make the wedge disappear with no way to see why.
 * @returns true if the hairpin exists and the value was taken.
 */
export function setHairpinAperture(score: Score, id: string, aperture: number | null): boolean {
  if (!getHairpinById(score, id)) return false
  if (aperture === null) {
    if (!hairpinApertureOverrideOf(score, id)) return false
    clearEngravingOverride(score, id, 'hairpinAperture')
    return true
  }
  if (!(aperture > 0)) return false
  const override: HairpinApertureOverride = { kind: 'hairpinAperture', aperture }
  setEngravingOverride(score, id, override)
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
 * IDEMPOTENT, like `createSlur`: an identical wedge already on that (measure, beat, scope, staff) is
 * returned rather than duplicated, so a stamp pressed twice on one note adds nothing.
 *
 * ⭐ **`scope.voice` is what the wedge GOVERNS, not where its notes are** — absent = every voice of
 * `staffId` (`utils/dynamicScope`). The span is already fixed by `start`/`end`, so the caller that
 * knows the selection's lane must NOT pass it on out of habit: it would narrow the new wedge to one
 * voice for the ordinary case. `MusicEngine.createHairpin` reads the lane to CHOOSE the notes and
 * then deliberately passes no voice.
 *
 * @returns the stored Hairpin, or null when the span covers no music (the two addresses coincide,
 *   or `end` lies before `start`).
 */
export function addHairpinOverNotes(
  score: Score,
  type: Hairpin['type'],
  start: { measure: number; beat: Fraction },
  end: { measure: number; beat: Fraction; length: Fraction },
  scope: { voice?: 0 | 1 | 2 | 3; staffId?: string } = {},
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
    // ⛔ NOT `(h.voice ?? 0) === (scope.voice ?? 0)`: absent and 0 are DIFFERENT scopes now, so that
    // test would hand back a voice-1 wedge as the duplicate of a staff-wide one.
    && sameScope(h, scope)
    && h.staffId === scope.staffId)
  if (existing) return existing

  return addHairpin(score, start.measure, {
    type,
    beat: start.beat,
    length,
    ...(scope.voice !== undefined ? { voice: scope.voice } : {}),
    ...(scope.staffId !== undefined ? { staffId: scope.staffId } : {}),
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
 * ⭐ **The STAFF, not the bar and not the score** — every slot of it, in any voice. ⛔ Not the voices
 * the wedge governs: an end is dragged onto a COLUMN, and a column belongs to the staff
 * (`utils/dynamicScope.onSameStaff`, his call 2026-08-19). Shared by both stepping ops below, which
 * differ only in WHICH end.
 *
 * ⚠️ **ONE entry per ONSET, and its length is the SHORTEST there.** Two voices striking a beat are
 * one place a tip can sit, so a duplicate would make `Ctrl+→` press twice to move once. The length
 * decides where "cover this slot" reaches, and the answer has to be *the next onset in the lane* —
 * so when a whole note and a quarter begin together, it is the quarter's. Take the whole note's and
 * a grown wedge would jump four beats past music the lane still has notes on.
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
      if (!onSameStaff(score, hairpin, slot)) continue
      const length = slotLength(slot)
      const seen = lane.find(s => s.measure === measure.number && fracCompare(s.beat, slot.beat) === 0)
      if (seen) {
        if (fracCompare(length, seen.length) < 0) seen.length = length
        continue
      }
      lane.push({ abs: fracAdd(base, slot.beat), length, measure: measure.number, beat: slot.beat })
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
  const next = nextHairpinStartSlot(score, id, direction)
  return next ? setHairpinStartAtSlot(score, id, next) : false
}

/**
 * ⭐ **THE SLOT ONE STEP AWAY** — where {@link moveHairpinStartBySlot} would put the wedge's start,
 * without putting it there. Null at either end of the lane (or for an id no longer in the score).
 *
 * ⭐ Split out for the INTERPOLATING WALK (`interactions/hairpinStartWalk`), which has to know what
 * lies ahead — and how far away it is DRAWN — before it decides whether this press re-anchors or
 * only nudges ink. ⛔ Two candidate rules would mean the arrows and `Ctrl+Shift`+arrow landing the
 * start on different notes depending on how far it had been nudged, so both roads read this one.
 * `dynamicOps.nextDynamicSlot`'s twin, one lane over.
 */
export function nextHairpinStartSlot(
  score: Score,
  id: string,
  direction: 1 | -1,
): HairpinSlotTarget | null {
  const placed = locate(score, id)
  if (!placed) return null
  const { startAbs, lane } = placed

  const next = direction === -1
    // Reach BACK: the last slot beginning before the current start.
    ? [...lane].reverse().find(s => fracCompare(s.abs, startAbs) < 0)
    // Step IN: the first slot beginning after it — and never as far as the end.
    : lane.find(s => fracCompare(s.abs, startAbs) > 0)
  return next ? { measure: next.measure, beat: next.beat } : null
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
 * ⭐⭐ **MOVE THE WHOLE WEDGE to `target`, keeping its length** — the BODY's walk and its system jump
 * (his ask, 2026-08-20: the body drag used to move only the drawing).
 *
 * ⭐ **One field, `beat`** — which is what makes this the SIMPLEST of the three: the extent is an
 * amount of music and travels with the start, so nothing here has to hold anything still
 * ({@link moveHairpinStartBySlot}'s note explains why the other two are two-field writes).
 *
 * ⭐ A wedge moved across a barline is RE-FILED into the bar it now begins in, keeping the same
 * object and id — the selection holds that id, and a re-created hairpin would deselect itself
 * mid-drag ({@link setHairpinStartAtSlot}'s rule).
 *
 * ⚠️ It does NOT clamp the end against the score's last bar: a span running past the music is
 * clamped where it is READ ({@link hairpinSpan}), so a wedge dragged near the end shortens on screen
 * and grows back when it is dragged home — ⛔ rather than being silently trimmed here, which would
 * lose music the user never asked to give up.
 *
 * Declines when `target` is not a slot of the wedge's own lane, or the hairpin does not exist.
 */
export function setHairpinAtSlot(score: Score, id: string, target: HairpinSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { hairpin, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  if (slot.measure !== hairpinMeasure(score, id)?.number) {
    if (!moveHairpinToMeasure(score, hairpin, slot.measure)) return false
  }
  hairpin.beat = slot.beat
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
  const stop = nextHairpinEndStop(score, id, direction)
  return stop ? applyHairpinDrag(score, id, stop.write) : false
}

/**
 * ⭐ **THE TIP'S NEXT POSITION** — where {@link resizeHairpinBySlot} would put the wedge's END,
 * without putting it there, and named in the DRAG's vocabulary ({@link HairpinDragWrite}) so that
 * every route to the tip speaks one language. Null when there is nothing to reach.
 *
 * ⭐ Split out for the INTERPOLATING WALK (`interactions/hairpinWalk`), the start's
 * {@link nextHairpinStartSlot} twin and for its reason: the arrows and `Ctrl+Shift`+arrow must never
 * land the tip on different notes.
 *
 * ⭐⭐ **Two of the three drag writes, and the pair is not a spare wheel.** The tip is drawn at the
 * first UNCOVERED note (`HairpinRenderer.spanX`), so its possible positions are the lane's onsets —
 * `endBefore` — plus ONE past the last note, where the wedge covers everything and there is no onset
 * left to stop before (`endCovering`). Growing reaches through the next slot at or after the current
 * end, which is exactly "the next boundary along"; shrinking drops the last slot covered.
 */
export function nextHairpinEndStop(
  score: Score,
  id: string,
  direction: 1 | -1,
): HairpinEndStop | null {
  const placed = locate(score, id)
  if (!placed) return null
  const { startAbs, endAbs, lane } = placed

  let nextEnd: Fraction
  let write: HairpinDragWrite
  if (direction === 1) {
    // Reach through the next slot beginning at or after the current end.
    const next = lane.find(s => fracCompare(s.abs, endAbs) >= 0)
    if (!next) return null // nothing further in this lane — the wedge is already at its end
    nextEnd = fracAdd(next.abs, next.length)
    // Past the last note there is no onset to stop BEFORE, so the last slot is COVERED instead —
    // the one boundary of the lane that is not an onset.
    const onset = lane.find(s => fracCompare(s.abs, nextEnd) === 0)
    write = onset
      ? { at: 'endBefore', measure: onset.measure, beat: onset.beat }
      : { at: 'endCovering', measure: next.measure, beat: next.beat }
  } else {
    // Drop the LAST slot the wedge covers: its onset becomes the new end, and an onset is always a
    // boundary the tip can be drawn on.
    const covered = lane.filter(s => fracCompare(s.abs, startAbs) >= 0 && fracCompare(s.abs, endAbs) < 0)
    const last = covered[covered.length - 1]
    if (!last) return null
    nextEnd = last.abs
    write = { at: 'endBefore', measure: last.measure, beat: last.beat }
  }

  const endsAt = addressOfAbs(score, nextEnd)
  return endsAt ? { write, endsAt } : null
}

/**
 * ⭐⭐ **WHERE THE TIP WOULD STAND, as an address** — ⛔ NOT the address of the note the stop names,
 * and the difference is the whole of his 2026-08-20 report *"it is never reaching the next system"*.
 *
 * A stop of *"end before the first note of bar 41"* leaves the wedge ending ON THE BARLINE, which
 * {@link hairpinSpan} reads as bar 40's END — so the tip is drawn at the end of bar 40's LINE, not
 * beside that note on the next one. Pricing the walk by the note's x therefore called an ordinary
 * same-line step a system crossing, spent the press on it, and then found the wedge exactly where it
 * had been. Every route to the tip must ask where the TIP lands, and that is this.
 */
function addressOfAbs(score: Score, abs: Fraction): HairpinSlotTarget | null {
  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  let start = fracCreate(0, 1)
  for (const measure of ordered) {
    const end = fracAdd(start, measureCapacityFrac(measure))
    // `<=`, not `<`: an end landing exactly on the barline belongs to THIS bar's end
    // ({@link hairpinSpan}, verbatim — the two must agree or the tip is priced in one place and
    // drawn in another).
    if (fracCompare(abs, end) <= 0) return { measure: measure.number, beat: fracSub(abs, start) }
    start = end
  }
  return null
}

/** What the tip's candidate rule answers with: the model WRITE that takes the step, and the address
 *  the wedge would then END at — where the tip is drawn. See {@link addressOfAbs}. */
export interface HairpinEndStop {
  write: HairpinDragWrite
  endsAt: HairpinSlotTarget
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

/**
 * ⭐⭐ **SET WHICH VOICES THE WEDGE GOVERNS** — {@link setDynamicVoiceScope}'s twin, and its doc
 * carries the reason `'all'` has to `delete` the field rather than assign `undefined` through
 * {@link updateHairpin}'s `Object.assign`.
 *
 * ⚠️ Declines (false) for an unknown id, and when the scope is already what is asked.
 */
export function setHairpinVoiceScope(score: Score, id: string, scope: VoiceScope): boolean {
  const hairpin = getHairpinById(score, id)
  if (!hairpin) return false
  if (voiceScopeOf(hairpin) === scope) return false
  if (scope === 'all') delete hairpin.voice
  else hairpin.voice = scope
  return true
}
