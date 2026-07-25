/**
 * The TWO-NOTE tremolo's ONE validity predicate — docs/two-note-tremolo-plan.md §1.
 *
 * `Chord.tremoloPair` is a **relation**, not a property: it says "this slot alternates with the NEXT
 * one", and every pipeline that reorders slots can break it after the fact — deleting the partner
 * (rest-fill puts a rest there), inserting between the two, changing either duration, a meter change
 * or a paste that re-bars them apart. So the flag alone is not the notation.
 *
 * ⚠️ ONE predicate, used everywhere. {@link pairIsValid} is what the palette asks before applying,
 * what the renderer asks before doubling and drawing, what the beam grouper asks before excluding,
 * and what playback will ask before alternating. Two copies of this rule would drift, and the drift
 * is silent: a bar that DRAWS a pair and PLAYS two separate notes.
 *
 * The other half of the same defence is that a broken pair is DROPPED, not carried — the rebar relay
 * (`utils/rebar`) and the clipboard both travel as `RebarEvent`s, which deliberately have no
 * `tremoloPair` field, so adjacency never survives a re-bar. Draw-time validation alone would leave
 * a dead flag in the JSON that silently comes back to life the day a note of the right length lands
 * next to it; dropping alone would leave the window between the edit and the next render. Both.
 *
 * Pure — slots and durations only, no VexFlow and no model.
 */

import type { ChordRest, Chord } from '@/types/music'
import { doubleDuration } from '@/utils/durations'
import { fracCompare } from '@/utils/fraction'

/** Which end of a pair a slot is, or `null` when it is in none. */
export type PairRole = 'first' | 'second'

/** An AUTHORED beam role — `'auto'`/absent is nobody's answer, and does not conflict with a pair. */
function hasAuthoredBeam(slot: Chord): boolean {
  return slot.beam !== undefined && slot.beam !== 'auto'
}

/**
 * Can slot `index` be — or is it already — the FIRST note of a two-note tremolo?
 *
 * ⚠️ `slots` must be ONE LANE, sorted by beat: one voice of one staff of one bar, the same slice the
 * renderer builds its StaveNotes from. Handed a mixed-voice array it would pair a voice-1 note with
 * the voice-2 note that happens to follow it in the list.
 *
 * The refusals are §0's list, in full:
 *  - the next slot is a REST, or there is no next slot (a pair is two SOUNDING notes);
 *  - the next slot's value differs — duration, dots, **or tuplet membership**: a triplet eighth and
 *    a plain eighth are not the same value, and one note in a tuplet with its partner outside it is
 *    not a pair;
 *  - the two are in different measures (P1 scope), voices or staves;
 *  - the value cannot double (`'w'` is the top of `NoteDuration`, so two whole notes have no
 *    notation — {@link doubleDuration} returns null and that IS the refusal);
 *  - either slot is already in a pair — this one as a SECOND note, or the next one as a FIRST. A
 *    chain (A–B, B–C) is not a longer tremolo, it is B belonging to two marks at once, which has no
 *    reading and no drawing. Note that this makes a chain drop from BOTH ends rather than pick a
 *    winner: A refuses because B is a first, B refuses because A is a first.
 *  - the mark is the PENDERECKI sign, which is unmeasured and takes no pair — a pair needs a stroke
 *    COUNT;
 *  - either slot carries an authored beam role (`single`/`begin`/`continue`/`end`) — the pair owns
 *    its own beam or none, so the two are competing answers to the same question.
 *
 * Deliberately does NOT require the flag to be set: the palette asks this *before* applying.
 */
export function pairIsValid(slots: ChordRest[], index: number): boolean {
  const first = slots[index]
  const second = slots[index + 1]
  if (!first || first.type !== 'chord') return false
  if (!second || second.type !== 'chord') return false

  // Already in a pair — as a second note (the slot behind is a first), or the partner is a first.
  const before = slots[index - 1]
  if (before?.type === 'chord' && before.tremoloPair) return false
  if (second.tremoloPair) return false

  // One bar, one lane. (Within a lane array the measure is constant; the check costs nothing and
  // says the P1 scope out loud.)
  if (first.measure !== second.measure) return false
  if ((first.voice ?? 0) !== (second.voice ?? 0)) return false
  if ((first.staffId ?? '') !== (second.staffId ?? '')) return false

  // The same written value, tuplet membership included.
  if (first.duration !== second.duration) return false
  if ((first.dots ?? 0) !== (second.dots ?? 0)) return false
  if ((first.tupletId ?? '') !== (second.tupletId ?? '')) return false

  if (doubleDuration(first.duration) === null) return false
  if (first.tremolo === 'penderecki') return false
  if (hasAuthoredBeam(first) || hasAuthoredBeam(second)) return false

  return true
}

/**
 * What slot `index` is in the pair it belongs to — `'first'`, `'second'`, or `null` for a slot in no
 * (valid) pair. The renderer's question: a member is drawn at DOUBLE its written value, wears no
 * stem strokes of its own, and is never swept into an automatic beam group.
 *
 * Same lane requirement as {@link pairIsValid}.
 */
export function pairRoleAt(slots: ChordRest[], index: number): PairRole | null {
  const slot = slots[index]
  if (slot?.type === 'chord' && slot.tremoloPair && pairIsValid(slots, index)) return 'first'
  const before = slots[index - 1]
  if (before?.type === 'chord' && before.tremoloPair && pairIsValid(slots, index - 1)) return 'second'
  return null
}

/**
 * The lane containing `slot` within a bar's slots — same voice, same staff, sorted by beat.
 *
 * The model side's way in: `ScoreModel` holds a measure's slots as one mixed list, and every
 * question above is asked of a lane. The renderer already has its lanes (one per voice group) and
 * does not need this.
 */
export function laneOfSlot(measureSlots: ChordRest[], slot: ChordRest): ChordRest[] {
  return measureSlots
    .filter(s => (s.voice ?? 0) === (slot.voice ?? 0) && (s.staffId ?? '') === (slot.staffId ?? ''))
    .sort((a, b) => fracCompare(a.beat, b.beat))
}
