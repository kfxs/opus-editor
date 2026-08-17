/**
 * OTTAVAS — the octave lines (8va / 8vb / 15ma …), as SCORE operations: add, remove, re-length,
 * look up, and turn `beat + length` into the two addresses it covers. Free functions on a `Score`,
 * in the `clefOps` / `hairpinOps` / `slurOps` idiom, with {@link ScoreModel} keeping thin
 * delegators (docs/ottava-plan.md §4; DESIGN-PRINCIPLES principle 5 — *the score is independent of
 * the editor*, so none of this may live on `MusicEngine`, which is the editor's facade).
 *
 * ⭐ **`hairpinOps` is the twin, with ONE rule changed and it is the whole character of the
 * feature.** A hairpin may stack: two wedges at a beat are two readable marks. An ottava may not —
 * two octave shifts governing the same staff from the same beat is not a stack, it is a
 * contradiction — so {@link addOttava} takes the CLEF's rule instead: at most one per (beat, staff),
 * last wins. That single divergence is why this is its own module rather than a `kind` on the
 * hairpin's, and it is repeated in `rebarOps`' restore branch, which is the other door in.
 *
 * ⚠️ The same file-level caveat `hairpinOps` carries applies here: an ottava is stored on the
 * measure its START lands in and carries its own {@link Ottava.length}, so **it can extend past the
 * end of its own bar** — "the ottavas of measure N" means *the ones that start there*, not the ones
 * that cross it.
 *
 * ⚠️ Re-anchoring ottavas across a re-bar is NOT here — that is `rebarOps`, which owns every
 * beat-anchored thing that has to survive the barlines moving. The same split as `hairpinOps`.
 */
import type { Fraction, Score, Ottava, Measure, OttavaOffsetOverride } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { ottavaOffsetOverrideOf } from './engravingOverrides'

/** A measure's ottavas (the live array; empty if none), sorted ascending by start beat. */
export function measureOttavas(measure: Measure): Ottava[] {
  return measure.ottavas ?? []
}

/**
 * Add an octave line starting at (`measure`, `ottava.beat`) covering `ottava.length` of music.
 * `beat` must already be snapped to a slot boundary by the caller, exactly as for a clef.
 * The list is kept sorted ascending by beat. A fresh id is generated.
 *
 * ⭐ **UPSERT, per staff** — an ottava already at this (beat, staff) is REPLACED rather than joined.
 * That is the clef's rule and it is deliberate (docs/ottava-plan.md §7.8): the hairpin's
 * everything-stacks rule would let a bar hold an 8va and a 15ma governing one staff from one beat,
 * and no reader — the eye, playback, or `soundingShiftAt` — could say which one is true. ⚠️ Staff
 * comparison is `matchesStaff`, not `===`: staff 0 stores an ABSENT id, so an explicit first-staff
 * id and an absent one are the same staff.
 *
 * Rejected (returns null) when `length` is not positive: a bracket covering no music has no
 * geometry to derive and no notes to shift, so it is refused at the model rather than left for the
 * renderer to discover ({@link addHairpin}'s reasoning verbatim).
 *
 * ⚠️ **OVERLAP is not policed here, only coincidence.** Two ottavas on one staff whose spans
 * overlap without sharing a start beat are still storable, and the reader that has to survive it is
 * `soundingShiftAt` (P2) — which resolves positionally and so must pick one. Truncating the earlier
 * span, or refusing the later one, is an ENTRY-time decision about a gesture that does not exist
 * yet; the model refuses only what it can call wrong on its own terms.
 */
export function addOttava(score: Score, measureNumber: number, ottava: Omit<Ottava, 'id'>): Ottava | null {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return null
  if (!fracIsPositive(ottava.length)) return null

  const created: Ottava = { ...ottava, id: uuidv4() }
  if (!measure.ottavas) measure.ottavas = []
  const dup = measure.ottavas.findIndex(o =>
    fracCompare(o.beat, ottava.beat) === 0 && matchesStaff(o.staffId, ottava.staffId, score))
  if (dup !== -1) {
    clearEngravingOverride(score, measure.ottavas[dup].id)
    measure.ottavas.splice(dup, 1)
  }
  measure.ottavas.push(created)
  measure.ottavas.sort((a, b) => fracCompare(a.beat, b.beat))
  return created
}

/**
 * Remove an ottava by id, cleaning up the array when it becomes empty.
 *
 * Clears any engraving override keyed by that id on the way out — an override must not outlive its
 * anchor (the `removeHairpin` / `removeSlur` rule). Nothing writes one yet; the call is here so the
 * day a vertical nudge or a hand-placed break arrives it cannot orphan.
 * @returns true if an ottava was removed.
 */
export function removeOttava(score: Score, id: string): boolean {
  for (const measure of score.measures) {
    if (!measure.ottavas) continue
    const idx = measure.ottavas.findIndex(o => o.id === id)
    if (idx === -1) continue
    measure.ottavas.splice(idx, 1)
    if (measure.ottavas.length === 0) delete measure.ottavas
    clearEngravingOverride(score, id)
    return true
  }
  return false
}

/** Find an ottava anywhere in the score by id (live reference), or null. */
export function getOttavaById(score: Score, id: string): Ottava | null {
  for (const measure of score.measures) {
    const found = measure.ottavas?.find(o => o.id === id)
    if (found) return found
  }
  return null
}

/** The measure an ottava starts in (live reference), or null if no such ottava exists. */
export function ottavaMeasure(score: Score, id: string): Measure | null {
  for (const measure of score.measures) {
    if (measure.ottavas?.some(o => o.id === id)) return measure
  }
  return null
}

/**
 * Set how much music an ottava covers.
 *
 * ⭐ **The MODEL, not an override** — the same distinction {@link setHairpinLength} draws, and here
 * it is sharper still: an ottava's extent decides which notes SOUND an octave away. A cosmetic
 * offset that disagreed with it would give us two answers to "how far does this bracket reach",
 * with playback believing the one the eye does not.
 *
 * A non-positive length is refused rather than deleting the ottava — removal is
 * {@link removeOttava}'s job. @returns true if the ottava exists and was updated.
 */
export function setOttavaLength(score: Score, id: string, length: Fraction): boolean {
  const ottava = getOttavaById(score, id)
  if (!ottava) return false
  if (!fracIsPositive(length)) return false
  ottava.length = length
  return true
}

/**
 * ⭐⭐ **NUDGE THE BRACKET'S DRAWN INK from one of its endpoint squares, accumulating** — `←/→/↑/↓`
 * fine, `Ctrl`+arrow coarse, with that square armed (his ask, 2026-08-17). `dx`/`dy` are in
 * **staff-spaces**.
 *
 * ⭐⭐ **`outward` LANDS ON THE WHOLE BRACKET, whichever square asked for it** — his rule, and the
 * reason {@link OttavaOffsetOverride} has three numbers instead of two pairs: *"ottava is a straight
 * line, so offset in y should result in offset the two points in y."* There is no per-end vertical to
 * write, so one press moves the numeral, the dashes and the hook together and the rule stays
 * horizontal by construction. ⛔ The hairpin's per-end `y` is right THERE because tilting a wedge is
 * a shape that exists; here it is not.
 *
 * ⭐⭐ **`outward` is a DISTANCE FROM THE STAFF, not a screen `y`** — `+` is up for an 8va and down
 * for an 8vb. His second correction, and the model's own protection against `x` (flip direction)
 * silently inverting a nudge that already exists. See {@link OttavaOffsetOverride} for the argument.
 * ⚠️ Callers that speak SCREEN convert before they get here.
 *
 * ⭐ `dx` stays per end — the beginning pulls the numeral, the end pulls the hook.
 *
 * ⭐ **An OVERRIDE, not the model** — {@link setHairpinEndpointOffset}'s distinction, and the same
 * two-chords-two-categories arrangement on one pair of squares: `Ctrl+Shift+arrow` says which notes
 * are displaced (content, and audible), a plain or `Ctrl` arrow says where the ink goes.
 *
 * @returns true if the ottava exists (the caller then re-renders).
 */
export function setOttavaEndpointOffset(
  score: Score,
  id: string,
  which: 'start' | 'end',
  dx: number,
  /** ⭐ OUTWARD from the staff, not screen-down — see this function's note. */
  outward: number,
): boolean {
  if (!getOttavaById(score, id)) return false
  const prev = ottavaOffsetOverrideOf(score, id)
  const xKey = which === 'start' ? 'startX' : 'endX'
  const otherKey = which === 'start' ? 'endX' : 'startX'
  writeOttavaOffset(score, id, {
    [xKey]: (prev?.[xKey] ?? 0) + dx,
    [otherKey]: prev?.[otherKey],
    outward: (prev?.outward ?? 0) + outward,
  })
  return true
}

/**
 * Store the three numbers, ⭐ **dropping any that came out ZERO** — and pruning the whole entry when
 * all three did, so an offset nudged back to nothing leaves the score exactly as it was found.
 *
 * ⚠️ **This is a real divergence from `setHairpinEndpointOffset`, which stores its zeros, and the
 * shared `y` is what forces it.** A purely horizontal nudge computes `y = 0 + 0`; written down, that
 * zero is a number the OTHER square then reports as a nudge of its own — so `Ctrl+Backspace` on an
 * untouched square would answer instead of falling through to the note-spacing and bar-width resets.
 * Found by the spec case that asserts exactly that decline. ⭐ It also keeps "absent = none" literally
 * true for this kind, which is what every reader of the compartment assumes.
 */
function writeOttavaOffset(
  score: Score,
  id: string,
  next: { startX?: number; endX?: number; outward?: number },
): void {
  const kept: OttavaOffsetOverride = {
    kind: 'ottavaOffset',
    ...(next.startX ? { startX: next.startX } : {}),
    ...(next.endX ? { endX: next.endX } : {}),
    ...(next.outward ? { outward: next.outward } : {}),
  }
  if (kept.startX === undefined && kept.endX === undefined && kept.outward === undefined) {
    clearEngravingOverride(score, id, 'ottavaOffset')
    return
  }
  setEngravingOverride(score, id, kept)
}

/**
 * `Ctrl+Backspace` on an armed square: that end back to the engraver's own position.
 *
 * ⚠️ **It drops that end's `x` AND the shared `outward`** — which follows from the vertical being one
 * number for the bracket rather than being a second decision. The square you armed controls exactly
 * two quantities; the reset gives back exactly those two, and the OTHER end's `x` survives. There is
 * no way to "reset only this end's height" because there is no such height.
 *
 * Prunes the whole entry when nothing is left, so "absent = none" still holds.
 * @returns false when that square carries no nudge at all, so the key falls through.
 */
export function resetOttavaEndpointOffset(score: Score, id: string, which: 'start' | 'end'): boolean {
  const prev = ottavaOffsetOverrideOf(score, id)
  if (!prev) return false
  const xKey = which === 'start' ? 'startX' : 'endX'
  if (prev[xKey] === undefined && prev.outward === undefined) return false

  const otherKey = which === 'start' ? 'endX' : 'startX'
  writeOttavaOffset(score, id, { [otherKey]: prev[otherKey] })
  return true
}

/**
 * ⭐⭐ **RE-ANCHOR THE BRACKET'S END BY ONE SLOT** — the model write behind `Ctrl+Shift+→` / `←` on a
 * selected ottava's END square (his ask, 2026-08-17). Growing reaches through the next slot at or
 * after the current end; shrinking drops the last slot the line holds.
 *
 * ⭐ **By a SLOT, not by a fixed amount of time** — {@link resizePedalBySlot}'s rule and
 * {@link resizeHairpinBySlot}'s before it. Here it is more than tidiness: the span is HALF-OPEN
 * (`soundingShiftAt`), so an end landing between two onsets shifts exactly the same notes as one
 * landing on the later onset while drawing a longer bracket — the picture and the sound would
 * disagree about music neither of them changed. Ending on a boundary is the only statement the model
 * can make twice over.
 *
 * ⭐⭐ **The lane is the STAFF, every voice** — the pedal's line, not the hairpin's, and for the
 * reason the ottava exists: an octave line has no voice (see {@link Ottava}), it displaces whatever
 * the staff plays. Stepping through one voice's onsets would let the key walk PAST a note in the
 * other voice that the bracket then silently covers or uncovers. Two voices attacking together are
 * ONE step, de-duplicated by beat, so a chord across voices does not cost two presses.
 *
 * ⚠️ **This is the MODEL, not an override** — {@link setOttavaLength}'s point. Which notes are
 * displaced is what the passage SOUNDS, so there is nothing for `Ctrl+Backspace` to reset and the
 * caller commits a real undo entry.
 *
 * ⛔ **Never deletes.** Shrinking past the last held slot is refused rather than removing the line:
 * a gesture that destroys the thing it is shortening is a trap. Also declines when there is nothing
 * further on the staff to reach, and when no such ottava exists.
 */
export function resizeOttavaBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs: fromAbs, endAbs, lane } = placed

  let nextEnd: Fraction
  if (direction === 1) {
    // Reach THROUGH the next slot beginning at or after the current end — its onset plus its own
    // length, so the note the bracket grows over is covered rather than merely touched
    // (`addOttavaOverNotes`' rule, and the half-open span's requirement).
    const next = lane.find(s => fracCompare(s.abs, endAbs) >= 0)
    if (!next) return false // nothing further on this staff — the line already reaches the end
    nextEnd = fracAdd(next.abs, next.length)
  } else {
    // Drop the LAST slot the line holds: its onset becomes the new end.
    const held = lane.filter(s => fracCompare(s.abs, fromAbs) >= 0 && fracCompare(s.abs, endAbs) < 0)
    const last = held[held.length - 1]
    if (!last) return false
    nextEnd = last.abs
  }

  return setOttavaLength(score, id, fracSub(nextEnd, fromAbs))
}

/**
 * ⭐⭐ **MOVE THE BRACKET'S BEGINNING BY ONE SLOT, HOLDING ITS END** — the model write behind
 * `Ctrl+Shift+←/→` with the START square armed (his ask, 2026-08-17). `←` reaches the beginning back
 * a slot (the line grows at the front), `→` steps it in (the line shrinks from the front); in both
 * cases the far end stays exactly where it is.
 *
 * ⭐⭐ **Which the model expresses in ONE write, though it looks as if it could not.** An `Ottava`
 * stores a start and an AMOUNT ({@link Ottava.length}), so "hold the end" has no field to hold —
 * and does not need one: the two shapes are the same information, and the end stays put iff
 * `length' = end − start'`, both assigned together here. {@link moveHairpinStartBySlot} says this at
 * length; it is repeated rather than shared because the LANE differs (a staff, not a voice) and the
 * lane is the whole of what these two functions disagree about.
 *
 * ⭐ **A beginning moved across a barline MOVES THE LINE to the bar it now starts in** — the list it
 * is stored in *is* "the octave lines that start here" — keeping the same object and the same id.
 * A re-created ottava would silently deselect itself mid-gesture, and the square the user is
 * pressing arrows on would vanish.
 *
 * ⚠️ **No upsert on the way in**, unlike {@link addOttava}: moving a beginning onto a beat another
 * line already starts at leaves both in place. {@link updateOttava} states the reason — a move is
 * not a claim about which of two should win, and deleting the one already there would destroy a
 * span the user never named.
 *
 * Declines (false) when there is no slot to step to, when the beginning would reach or pass the END,
 * or when no such ottava exists. ⛔ Never deletes.
 */
export function moveOttavaStartBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const next = direction === -1
    // Reach BACK: the last onset before the current beginning.
    ? [...lane].reverse().find(s => fracCompare(s.abs, startAbs) < 0)
    // Step IN: the first onset after it — and never as far as the end, which the length check inside
    // {@link setOttavaStartAtSlot} refuses one step later.
    : lane.find(s => fracCompare(s.abs, startAbs) > 0)
  if (!next) return false
  return setOttavaStartAtSlot(score, id, next)
}

/** A lane slot named by its address — what a DRAG hands the two ops below, having found it from the
 *  cursor rather than by stepping. `HairpinSlotTarget`'s twin. */
export interface OttavaSlotTarget {
  measure: number
  beat: Fraction
}

/**
 * ⭐ **Put the bracket's BEGINNING on `target`, holding its end** — the drag's half of
 * {@link moveOttavaStartBySlot}, which now steps by finding a slot and calling this.
 *
 * The two-fields-one-write invariant is kept HERE, which is why the stepping op delegates rather
 * than repeating it. Declines when `target` is not an onset of the ottava's own staff, or when the
 * beginning would reach or pass the end.
 */
export function setOttavaStartAtSlot(score: Score, id: string, target: OttavaSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { ottava, startMeasure, endAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  const length = fracSub(endAbs, slot.abs)
  if (!fracIsPositive(length)) return false

  // ⭐ Both fields, one step. See {@link moveOttavaStartBySlot}.
  if (slot.measure !== startMeasure && !moveOttavaToMeasure(score, ottava, slot.measure)) return false
  ottava.beat = slot.beat
  ottava.length = length
  ottavaMeasure(score, id)?.ottavas?.sort((a, b) => fracCompare(a.beat, b.beat))
  return true
}

/**
 * ⭐⭐ **Put the bracket's END so that it COVERS `target`, holding its beginning** — the drag's half
 * of {@link resizeOttavaBySlot}'s growing branch.
 *
 * ⭐⭐ **There is only ONE end case here, where the hairpin needs three, and the difference is
 * Gould's rule 2.** A wedge's tip is drawn at the first UNCOVERED note's left edge, so dragging it
 * has to distinguish "end before this slot" from "cover this slot" — two writes for one cursor
 * position. An octave bracket stops at the LAST COVERED notehead's RIGHT edge, so every position the
 * end can be dragged to *is* a covered slot: the address the cursor picks and the note the hook
 * closes around are the same note. ⛔ Do not port `setHairpinEndBeforeSlot` — it would make the
 * bracket end one note early and there is nothing on screen it could point at.
 *
 * Declines when `target` is not an onset of the ottava's own staff, or when the line would cover no
 * music. Only `length` moves — the beginning is a field nobody touches here.
 */
export function setOttavaEndAtSlot(score: Score, id: string, target: OttavaSlotTarget): boolean {
  const placed = locate(score, id)
  if (!placed) return false
  const { startAbs, lane } = placed

  const slot = lane.find(s => s.measure === target.measure && fracCompare(s.beat, target.beat) === 0)
  if (!slot) return false
  return setOttavaLength(score, id, fracSub(fracAdd(slot.abs, slot.length), startAbs))
}

/**
 * What one frame of an ottava drag asks for — an address plus WHICH END of the bracket is being put
 * on it.
 *
 * ⭐ TWO cases, not the hairpin's three — see {@link setOttavaEndAtSlot} for why the bracket's end
 * has no "before this slot" reading.
 */
export type OttavaDragWrite = OttavaSlotTarget & { at: 'start' | 'end' }

/** Apply one frame of a drag. See {@link OttavaDragWrite}. */
export function applyOttavaDrag(score: Score, id: string, write: OttavaDragWrite): boolean {
  const target = { measure: write.measure, beat: write.beat }
  return write.at === 'start'
    ? setOttavaStartAtSlot(score, id, target)
    : setOttavaEndAtSlot(score, id, target)
}

/** Everything the three span-editing ops above read: the line, where it currently reaches, and the
 *  onsets of its STAFF it may be moved between. */
function locate(score: Score, id: string): {
  ottava: Ottava
  startMeasure: number
  startAbs: Fraction
  endAbs: Fraction
  lane: ReturnType<typeof staffOnsets>
} | null {
  const span = ottavaSpan(score, id)
  const ottava = span ? getOttavaById(score, id) : null
  if (!span || !ottava) return null

  const starts = measureStartOffsets(score)
  const base = starts.get(span.startMeasure)
  if (base === undefined) return null
  const startAbs = fracAdd(base, span.startBeat)

  return {
    ottava,
    startMeasure: span.startMeasure,
    startAbs,
    endAbs: fracAdd(startAbs, ottava.length),
    lane: staffOnsets(score, ottava.staffId, starts),
  }
}

/** Re-file an ottava under a different measure, keeping the SAME object (and so the same id, which
 *  is what the selection holds). `hairpinOps`' twin, including the ⭐ `delete` of an emptied array —
 *  an absent `ottavas` and an empty one must not both be reachable, or the JSON round trip has two
 *  spellings of "none". */
function moveOttavaToMeasure(score: Score, ottava: Ottava, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.ottavas?.findIndex(o => o.id === ottava.id) ?? -1
    if (idx === -1) continue
    measure.ottavas!.splice(idx, 1)
    if (measure.ottavas!.length === 0) delete measure.ottavas
    break
  }
  if (!target.ottavas) target.ottavas = []
  target.ottavas.push(ottava)
  return true
}

/**
 * Every onset of one STAFF, by absolute quarter-beat, with the slot's own length and address —
 * de-duplicated by beat (two voices attacking together are one onset) and sorted.
 *
 * ⚠️ De-duplicating keeps the LONGEST slot at a shared onset, which is what "reach through the next
 * slot" has to mean when two voices start together and one is longer: the shorter one's end is
 * inside the longer one's note, so stopping there would put the bracket's end at a position no
 * onset occupies — and the next press would then have to skip the rest of that note.
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

/**
 * ⭐ **Flip an octave line's DIRECTION — 8va ↔ 8vb, 15ma ↔ 15mb — the `x` key's branch.** His
 * request, 2026-08-17: *"we should use shortcut x to switch 8va to 8vb when selected."*
 *
 * ⭐ **It NEGATES the shift and so keeps the DISTANCE**, which is the only reading of "switch" that
 * generalises: `shift` is one signed number saying both how far and which way (see {@link Ottava}),
 * and a `15ma` the user asked to flip means `15mb`, not `8vb`. ⛔ Not a `direction` field and not a
 * pair of "make it alta / make it bassa" calls — there is one statement here, and it already has a
 * sign.
 *
 * ⚠️⚠️ **This CHANGES WHAT THE PASSAGE SOUNDS, by two octaves, and that is not a bug.** An octave
 * line displaces the sounding pitch of the notes it covers (`soundingShiftAt`, and the (a) reading
 * of §7.3 that `MusicEngine.createOttava` records): the noteheads stay put and the sound moves. So
 * flipping is a CONTENT edit, exactly as {@link toggleHairpinType} is — hence the undo entry its
 * caller commits — and not the side-swap that `toggleTrillPlacement` performs.
 *
 * @returns the new shift, or null if no ottava has that id.
 */
export function toggleOttavaDirection(score: Score, id: string): Ottava['shift'] | null {
  const ottava = getOttavaById(score, id)
  if (!ottava) return null
  ottava.shift = -ottava.shift as Ottava['shift']
  return ottava.shift
}

/**
 * Edit an ottava by id (beat / length / shift / staff). The owning measure's list is re-sorted in
 * case the beat changed. A non-positive `length` is refused, as in {@link setOttavaLength}.
 *
 * ⚠️ **No upsert here, unlike {@link addOttava}.** Moving an ottava onto a beat another one already
 * occupies leaves both in place — a move is not a statement about which of two should win, and
 * silently deleting the one already there would destroy a span the user never named. The write that
 * MEANS "this beat now says 8va" is `addOttava`.
 * @returns the updated Ottava, or null if none has that id.
 */
export function updateOttava(score: Score, id: string, updates: Partial<Omit<Ottava, 'id'>>): Ottava | null {
  if (updates.length !== undefined && !fracIsPositive(updates.length)) return null
  for (const measure of score.measures) {
    const ottava = measure.ottavas?.find(o => o.id === id)
    if (!ottava) continue
    Object.assign(ottava, updates)
    measure.ottavas!.sort((a, b) => fracCompare(a.beat, b.beat))
    return ottava
  }
  return null
}

/**
 * Create an octave line covering the music from `start` to the END of `end` — the shape both doors
 * to an ottava need (the Lines palette over a selection, and one click of the armed stamp).
 *
 * ⭐ **The caller says which notes; this says how much music that is.** `addHairpinOverNotes`'
 * split, verbatim and for its reason: *which notes did the user mean* depends on the selection and
 * the armed tool — editor questions, answered in `MusicEngine` — while *how long is that in beats*
 * is arithmetic over the bars' capacities, which is a score question and lives here. So the two
 * doors cannot drift apart, and neither can invent a length of its own.
 *
 * ⭐ **`end` is a note plus ITS OWN LENGTH**, so the span COVERS the last note rather than stopping
 * on it. That is not cosmetic here the way it is for a wedge: the span is half-open
 * (`soundingShiftAt`), so an end that landed exactly on the last note's onset would leave that note
 * sounding un-shifted while the bracket was drawn over it — the picture and the sound disagreeing
 * about the same notehead.
 *
 * ⚠️ **Note what is NOT taken here: a voice.** An ottava governs the staff, so the lane is a staff
 * alone — the one span in this model whose creation cannot narrow to a voice.
 *
 * IDEMPOTENT in the way this family can be: {@link addOttava} upserts per (beat, staff), so a stamp
 * pressed twice on one note replaces rather than stacks, and the second press is a no-op whenever
 * the two spans agree.
 *
 * @returns the stored Ottava, or null when the span covers no music (the two addresses coincide, or
 *   `end` lies before `start`).
 */
export function addOttavaOverNotes(
  score: Score,
  shift: Ottava['shift'],
  start: { measure: number; beat: Fraction },
  end: { measure: number; beat: Fraction; length: Fraction },
  staffId?: string,
): Ottava | null {
  const starts = measureStartOffsets(score)
  const absStart = starts.get(start.measure)
  const absEnd = starts.get(end.measure)
  if (absStart === undefined || absEnd === undefined) return null

  const length = fracSub(fracAdd(fracAdd(absEnd, end.beat), end.length), fracAdd(absStart, start.beat))
  if (!fracIsPositive(length)) return null

  return addOttava(score, start.measure, {
    beat: start.beat,
    length,
    shift,
    ...(staffId !== undefined ? { staffId } : {}),
  })
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
 * Where an ottava ENDS, as a beat within its own measure — i.e. `beat + length`, which for anything
 * crossing a barline is past that measure's capacity. Named rather than inlined for
 * {@link hairpinEndBeat}'s reason: the arithmetic reads as if it were an in-bar beat and is not.
 */
export function ottavaEndBeat(ottava: Ottava): Fraction {
  return fracAdd(ottava.beat, ottava.length)
}

/** Where an ottava begins and ends, as two (measure, beat) addresses. See {@link ottavaSpan}. */
export interface OttavaSpan {
  startMeasure: number
  startBeat: Fraction
  endMeasure: number
  /** Beat within `endMeasure`. ⚠️ MAY EQUAL that measure's capacity — a span finishing on the
   *  barline ends at the bar's end, not at beat 0 of the next one. */
  endBeat: Fraction
}

/**
 * Turn an ottava's `beat + length` into the two (measure, beat) addresses it actually covers, by
 * walking forward through the bars' capacities. {@link hairpinSpan}'s twin, and for its reason:
 * nothing on an `Ottava` names the bar it ends in — which is what makes inserting and deleting
 * measures free — so the end address is DERIVED, every time, from the music that is actually there.
 *
 * ⚠️ A span running past the end of the score is CLAMPED to the last bar's end, the same defence
 * `restoreBeatAnchors` applies to an over-running offset.
 *
 * ⚠️ **This is the MUSICAL span, not the drawn one.** Gould's rule stops the bracket at the last
 * notehead inside the span rather than at the end of that note's duration (docs/ottava-plan.md §1
 * rule 2 — the opposite of the trill's and the hairpin's x rule), and finding that notehead needs
 * the render's columns. What is answered here is *which music is governed*, which is what playback
 * and any future re-spelling command ask.
 *
 * @returns null if the start measure does not exist or holds no such ottava.
 */
export function ottavaSpan(score: Score, id: string): OttavaSpan | null {
  const startMeasure = ottavaMeasure(score, id)
  const ottava = startMeasure?.ottavas?.find(o => o.id === id)
  if (!startMeasure || !ottava) return null

  const ordered = [...score.measures].sort((a, b) => a.number - b.number)
  const from = ordered.findIndex(m => m.number === startMeasure.number)
  if (from === -1) return null

  let remaining = ottavaEndBeat(ottava)
  for (let i = from; i < ordered.length; i++) {
    const cap = measureCapacityFrac(ordered[i])
    // `<=`, not `<`: an end landing exactly on the barline belongs to THIS bar's end. Using `<`
    // would push it to beat 0 of the next bar, i.e. govern one bar too much.
    if (fracCompare(remaining, cap) <= 0) {
      return { startMeasure: startMeasure.number, startBeat: ottava.beat, endMeasure: ordered[i].number, endBeat: remaining }
    }
    remaining = fracSub(remaining, cap)
  }

  const last = ordered[ordered.length - 1]
  return {
    startMeasure: startMeasure.number,
    startBeat: ottava.beat,
    endMeasure: last.number,
    endBeat: measureCapacityFrac(last),
  }
}
