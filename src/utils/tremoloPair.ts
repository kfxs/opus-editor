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

import type { ChordRest } from '@/types/music'
import { doubleDuration, durationFlags } from '@/utils/durations'
import { fracCompare } from '@/utils/fraction'

/** Which end of a pair a slot is, or `null` when it is in none. */
export type PairRole = 'first' | 'second'

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
 *    COUNT.
 *
 * ⭐ An authored beam role is NOT among them, and the plan's §0 originally said it was. It is not a
 * competing answer to the same question — it is the ANSWER. A pair of sixteenths can be drawn beamed
 * or apart with flags, both are the mark, and the note's own `single` is what chooses (his call, by
 * eye: "if the user before made it separated then it will be with the flag"). See
 * {@link pairDrawing}. Refusing the pair outright instead un-drew the mark on a keypress and left a
 * dead flag in the data.
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

  return true
}

/** How a pair is drawn once its written value has doubled. */
export interface PairDrawing {
  /** Beam lines the DRAWN value carries — 0 for a drawn whole/half/quarter, 1 for an eighth, … */
  flags: number
  /** True when those lines are drawn as ONE BEAM over the pair; false = each note keeps its flag. */
  beamed: boolean
}

/**
 * Beamed, or apart with flags? — the pair's own drawing decision, read off the FIRST slot's index.
 *
 * ⭐ THE NOTE'S OWN `single` CHOOSES. A pair is never in an automatic group (`pairRoleAt` breaks it
 * in the pure grouper), so the meter never has an opinion here and the only thing that can speak is
 * what was authored on the two notes. `single` on either — the mark that means "do not beam me" —
 * draws them apart, flags and all, with the strokes still between the stems; anything else
 * (`auto`, absent, or a `begin`/`continue`/`end` that has nothing to join) leaves the pair to beam
 * itself.
 *
 * `flags` is 0 for a drawn whole, half or quarter, so `beamed` is false there whatever was authored:
 * there are no beam lines to draw either way.
 */
export function pairDrawing(slots: ChordRest[], index: number): PairDrawing {
  const first = slots[index]
  const second = slots[index + 1]
  if (first?.type !== 'chord' || second?.type !== 'chord') return { flags: 0, beamed: false }
  const drawn = doubleDuration(first.duration)
  const flags = drawn ? durationFlags(drawn) : 0
  const apart = first.beam === 'single' || second.beam === 'single'
  return { flags, beamed: flags > 0 && !apart }
}

/**
 * ⭐ How many STROKES are actually drawn for a mark of `strokes`, once the pair's own beam is
 * accounted for — **the beam COUNTS**.
 *
 * For a two-note tremolo the beam and the strokes are the same kind of line, and what says the speed
 * is the TOTAL number of lines between the two notes. Wikipedia (*Tremolo*) states the two as
 * alternatives of one notation: *"either connecting them with beams, or else interpolating strokes,
 * with the number of beams **or** strokes corresponding to the speed of the tremolo — a tremolo in
 * thirty-second notes lasting a half-note would be written either as two open noteheads connected by
 * three beams, or as two half-notes with three strokes interpolated."* So a pair of sixteenths drawn
 * as beamed eighths spends one of its three lines on the beam and draws two strokes; a pair of
 * quarters, drawn as halves with no beam, draws all three.
 *
 * ⚠️ THIS IS NOT THE SINGLE-NOTE RULE, and the difference is geometric rather than arbitrary. There
 * (docs/tremolo-plan.md §5) `totalBeams = flags + strokes`: a flag hangs off the OUTSIDE of the
 * stem, so it is not one of the lines between anything and cannot stand in for a stroke. Same reason
 * the flags of a pair drawn APART do not count here either — only a beam does.
 *
 * Floors at zero: a mark whose whole count is spent on the beam draws no strokes, which is not a
 * mark gone missing but the all-beams spelling of the same notation ("connecting them with beams").
 */
export function pairStrokesDrawn(strokes: number, drawing: PairDrawing): number {
  return drawing.beamed ? Math.max(0, strokes - drawing.flags) : strokes
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

/**
 * The SVG group a two-note tremolo's strokes paint into. `openGroup` PREFIXES both, so the class ends
 * up `vf-tremolo-pair` and the id `vf-tremolo-pair-<noteId>`.
 *
 * It exists for the HIGHLIGHT, the one selection seam the pair could not inherit:
 * `HighlightController.colorNoteTremolo` finds `<text>` nodes inside the note's own `vf-stavenote`
 * group whose content is the tremolo codepoint, and a pair's strokes are our own PATHS drawn outside
 * every note group — that lookup finds nothing. So the renderer paints a named group and the
 * highlight colours it whole. The barline lesson again: PAINT a highlight, do not go hunting for
 * glyphs to recolour.
 *
 * Lives HERE, in the pure module both sides already import, rather than in the renderer: a name
 * exported from `VexFlowRenderer` would force every test that mocks that module to stub the constant
 * too.
 */
export const TREMOLO_PAIR_GROUP = 'tremolo-pair'
