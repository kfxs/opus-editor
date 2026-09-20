/**
 * ⭐⭐ **WHAT A NOTE SAYS ABOUT ITS OWN BEAM** — today, one thing: which way its **fractional beam**
 * points (`docs/research/beam-hook-research.md`).
 *
 * ## Why its own module rather than a line in `markOps`
 *
 * `markOps` is *"the marks a slot WEARS"* — an articulation, a tremolo, a fan: things ADDED to a
 * note that it would not otherwise have. A fractional beam's side is not added to anything. The stub
 * is drawn whether or not anybody has an opinion about it, and this field only says **which of two
 * legitimate engravings** to use — the same shape as `stemDirection`, which is likewise not a mark.
 * ⭐ CLAUDE.md's rule ("a new feature adds a MODULE… a SLICE TOO THIN TO BE LOGIC IS STILL A SLICE")
 * is exactly about this call: the twelfth `case` in a family gets the twelfth module.
 *
 * ## ⭐ Absent means AUTO, and auto is the books' rule
 *
 * ⛔ There is no "default side" stored anywhere. With no override the renderer asks
 * `engine/engrave/beams/fractionalBeam`, which answers from the metre — Gould p. 157's *"points in
 * the direction of the beat, or division of the beat, to which it belongs"*. Clearing the override
 * therefore RESTORES the engraved default rather than freezing today's picture, which is why
 * {@link setFractionalBeamSide} takes `null` rather than offering a third enum value.
 */
import type { Note, Score } from '@/types/music'
import type { FractionalBeamSide } from '@/types/music'
import { findSlot } from './slotLookup'
import { flatNoteOf } from './noteProjection'

/**
 * Override which side the fractional beam on `noteId` points — or with `null`, clear the override
 * and go back to the metric rule.
 *
 * ⛔ No-op (null) for a rest: a rest has no stem and so no stub to aim, even when a beam runs over
 * it (`beamOver`).
 *
 * ⚠️ **Stored ABSENT when cleared**, like `beam: 'auto'` and `articulationStemAlign: false` — the
 * default costs nothing in JSON, and a score nobody has hand-edited carries no such key at all.
 */
export function setFractionalBeamSide(
  score: Score,
  noteId: string,
  side: FractionalBeamSide | null,
): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found
  if (side) chord.fractionalBeamSide = side
  else delete chord.fractionalBeamSide
  return flatNoteOf(score, chord, pitch)
}
