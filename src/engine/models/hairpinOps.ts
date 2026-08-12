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
import type { Fraction, Score, Hairpin, Measure } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { fracCompare, fracAdd, fracSub, fracCreate, fracIsPositive } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { slotLength } from '@/utils/durations'
import { matchesStaff } from './staffContent'
import { clearEngravingOverride } from './overrideOps'

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
  const span = hairpinSpan(score, id)
  const hairpin = span ? getHairpinById(score, id) : null
  if (!span || !hairpin) return false

  const starts = measureStartOffsets(score)
  const startAbs = fracAdd(starts.get(span.startMeasure)!, span.startBeat)
  const endAbs = fracAdd(startAbs, hairpin.length)

  // Every slot of the hairpin's own lane, by absolute onset. A wedge governs one voice on one
  // staff — the lane its notes are in — so the slots of any other are not steps it can take.
  const lane: Array<{ abs: Fraction; length: Fraction }> = []
  for (const measure of score.measures) {
    const base = starts.get(measure.number)
    if (base === undefined) continue
    for (const slot of measure.slots) {
      if ((slot.voice ?? 0) !== (hairpin.voice ?? 0)) continue
      if (!matchesStaff(slot.staffId, hairpin.staffId, score)) continue
      lane.push({ abs: fracAdd(base, slot.beat), length: slotLength(slot) })
    }
  }
  lane.sort((a, b) => fracCompare(a.abs, b.abs))

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
