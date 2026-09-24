/**
 * ⭐⭐ **A NOTE BECOMES A GRACE** — `docs/plans/grace-notes-plan.md` §3 rule 2 / P4, his rule
 * (2026-09-22): *"i have a note, i converted to a grace so in the space of the note now is a rest and of
 * course the grace is in the left part of the rest"*.
 *
 * The note's SLOT becomes a rest of its own length (`convertToRestOps.swapSlotForRest` — the same swap
 * "convert to rest" makes: nothing after it moves), and the note's pitches become a grace hung BEFORE
 * that rest — drawn to its left, as every grace before its host is. When a note later takes the rest's
 * place it takes the grace too (D7, `restGraceOps`).
 *
 * - ⭐ The grace is written as the note was — its duration and dots (the user's value is correct), its
 *   pitches (a chord → a grace chord) and its articulations.
 * - ⭐ Its pitches keep their IDS, so a slur to or from the note still lands on it — ⛔ unlike convert to
 *   rest, which moves the slurs onto the rest. Its ties go: a grace is not tied (the swap cuts the arcs
 *   leaving; an arc arriving re-points onto the rest, the let-ring rule).
 * - The slot's own graces before stay, in front of the new one; a grace AFTER goes with the note (a rest
 *   takes none — the swap's rule). The button's FORM becomes the group's.
 * - ⛔ No voice collapse: a secondary voice left with rests alone would otherwise take the grace with it.
 *
 * ⛔ Refused: a rest, a grace, a fanned member (a pitch inside one event), an id that is gone.
 */
import type { GraceNote, NotePitch, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { findSlot } from './slotLookup'
import { swapSlotForRest } from './convertToRestOps'
import type { GraceForm } from './graceOps'

export interface NoteToGrace {
  /** The rest that took the note's place — the grace's host. */
  restId: string
  /** The new grace's first pitch — the note's own first pitch id. */
  graceId: string
}

export function convertNoteToGrace(score: Score, noteId: string, form: GraceForm): NoteToGrace | null {
  const found = findSlot(score, noteId, { fanMembers: true, graceNotes: true })
  if (!found || found.type !== 'chord' || found.member || found.grace) {
    dbg(`[noteToGrace] refused: ${noteId} is not an ordinary note (a rest, a grace, a fan member, or gone)`)
    return null
  }
  const chord = found.chord
  // BEFORE the swap — afterwards the chord is gone. The pitches keep their ids; their ties do not.
  const pitches: NotePitch[] = chord.notes.map(p => {
    const { tiedTo: _to, tiedFrom: _from, ...rest } = p
    return { ...rest }
  })
  const grace: GraceNote = { pitches, duration: chord.duration }
  if (chord.dots) grace.dots = chord.dots
  if (chord.articulations?.length) grace.articulations = [...chord.articulations]
  if (chord.articulationPlacement) grace.articulationPlacement = chord.articulationPlacement
  if (chord.cue) grace.cue = true // a cue note → a cue grace (cue-size-plan C4)

  const rest = swapSlotForRest(score, noteId)
  if (!rest) return null
  const group = rest.graceBefore ?? { notes: [] }
  group.notes.push(grace)
  if (form === 'acciaccatura') group.slash = true
  else delete group.slash
  rest.graceBefore = group
  dbg(`[noteToGrace] ${pitches.map(p => `${p.step}${p.octave}`).join('+')} ${grace.duration} → a ${form} before the rest that took its place (${group.notes.length} in the group)`)
  return { restId: rest.id, graceId: pitches[0].id }
}
