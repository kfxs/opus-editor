/**
 * ⭐ **GRACE NOTES — the pure reads and the copy**, shared by the relay (`utils/rebar`), the
 * materialisers (`engine/models/rebarOps`, `slotPlacementOps`) and the operations
 * (`engine/models/graceOps`). `docs/plans/grace-notes-plan.md` §1.
 *
 * In `utils/` for `fannedBeam`'s reason: the relay lives here and may not import `engine/`.
 */
import { v4 as uuidv4 } from 'uuid'
import { cloneBracketedFresh } from '@/utils/bracketedGraces'
import type { ChordRest, GraceGroup, GraceNote, GraceSide, NotePitch } from '@/types/music'

/** Both sides, in drawing order. */
export const GRACE_SIDES: readonly GraceSide[] = ['before', 'after']

/** The chord's field for one side — the one place the side is spelled as a key. */
export function graceKey(side: GraceSide): 'graceBefore' | 'graceAfter' {
  return side === 'before' ? 'graceBefore' : 'graceAfter'
}

/** The slot's group on that side, if it has one — a REST holds a group BEFORE only (D7 reversed). */
export function graceGroupOf(slot: ChordRest, side: GraceSide): GraceGroup | undefined {
  if (slot.type === 'rest') return side === 'before' ? slot.graceBefore : undefined
  return slot[graceKey(side)]
}

/** Every grace pitch the slot carries, before-group first, left to right — the ids a click on a
 *  grace can name, so the ids a paste must hand back as "the notes that landed". */
export function gracePitchesOf(chord: ChordRest): NotePitch[] {
  const out: NotePitch[] = []
  for (const side of GRACE_SIDES) {
    for (const note of graceGroupOf(chord, side)?.notes ?? []) out.push(...note.pitches)
  }
  return out
}

/**
 * ⭐ A deep copy of a group with FRESH pitch ids — {@link cloneFanFresh}'s rule, for its reason: a
 * relay piece is a copy, and a paste can land one payload twice. Two live pitches sharing an id is
 * silent — the first in tree order wins every lookup.
 *
 * Carries exactly the fields the types declare (⛔ never a spread of the source): a key the copy
 * does not name is a key it does not invent.
 */
export function cloneGraceFresh(group: GraceGroup): GraceGroup {
  const out: GraceGroup = { notes: group.notes.map(copyGraceNote) }
  if (group.slash) out.slash = true
  if (group.stemDirection) out.stemDirection = group.stemDirection
  return out
}

function copyGraceNote(note: GraceNote): GraceNote {
  const out: GraceNote = {
    pitches: note.pitches.map((p) => {
      const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
      if (p.forceAccidental) np.forceAccidental = true
      if (p.enclosure) np.enclosure = p.enclosure
      return np
    }),
    duration: note.duration,
  }
  if (note.dots) out.dots = note.dots
  if (note.beam) out.beam = note.beam
  if (note.articulations?.length) out.articulations = [...note.articulations]
  if (note.articulationPlacement) out.articulationPlacement = note.articulationPlacement
  // ⭐ The bracketed graces bent INTO this one travel with it, fresh ids too (bracketed-grace-plan §1).
  if (note.bracketedBefore?.length) out.bracketedBefore = cloneBracketedFresh(note.bracketedBefore)
  return out
}
