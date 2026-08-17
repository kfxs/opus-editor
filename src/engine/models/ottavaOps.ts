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
import type { Fraction, Score, Ottava, Measure } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride } from './overrideOps'

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
