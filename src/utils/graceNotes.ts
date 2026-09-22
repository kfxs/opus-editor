/**
 * ⭐ **GRACE NOTES — the pure reads and the copy**, shared by the relay (`utils/rebar`), the
 * materialisers (`engine/models/rebarOps`, `slotPlacementOps`) and the operations
 * (`engine/models/graceOps`). `docs/plans/grace-notes-plan.md` §1.
 *
 * In `utils/` for `fannedBeam`'s reason: the relay lives here and may not import `engine/`.
 */
import { v4 as uuidv4 } from 'uuid'
import type { Chord, GraceGroup, GraceNote, GraceSide, NotePitch } from '@/types/music'

/** Both sides, in drawing order. */
export const GRACE_SIDES: readonly GraceSide[] = ['before', 'after']

/** The chord's field for one side — the one place the side is spelled as a key. */
export function graceKey(side: GraceSide): 'graceBefore' | 'graceAfter' {
  return side === 'before' ? 'graceBefore' : 'graceAfter'
}

/** The chord's group on that side, if it has one. */
export function graceGroupOf(chord: Chord, side: GraceSide): GraceGroup | undefined {
  return chord[graceKey(side)]
}

/** Every grace pitch the chord carries, before-group first, left to right — the ids a click on a
 *  grace can name, so the ids a paste must hand back as "the notes that landed". */
export function gracePitchesOf(chord: Chord): NotePitch[] {
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
  if (group.slur === false) out.slur = false
  return out
}

function copyGraceNote(note: GraceNote): GraceNote {
  const out: GraceNote = {
    pitches: note.pitches.map((p) => {
      const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
      if (p.forceAccidental) np.forceAccidental = true
      return np
    }),
    duration: note.duration,
  }
  if (note.dots) out.dots = note.dots
  if (note.articulations?.length) out.articulations = [...note.articulations]
  if (note.articulationPlacement) out.articulationPlacement = note.articulationPlacement
  return out
}
