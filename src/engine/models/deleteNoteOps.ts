/**
 * ⭐ **DELETING ONE NOTE — and the REPAIR the bar is owed.** Taking a head out is one line of the
 * model's; what this module answers is everything that must still be true afterwards: the slot's
 * length is still accounted for, the ties that pointed at it still point somewhere, the slurs
 * anchored to it follow or fall, and a secondary voice left with nothing but rests collapses. Score
 * logic, moved off `MusicEngine` (docs/plans/code-shape-plan-2026-09-19.md, Phase 4.1): the facade keeps
 * the undo entry and its label.
 *
 * Which edit a delete IS depends on what the id names:
 *
 * - a **FANNED MEMBER** deletes as a member — see {@link deleteNoteWithRepair};
 * - a **GRACE NOTE** deletes as a grace (`graceOps.removeGrace`) — no repair, nothing rhythmic left;
 * - a **CHORD HEAD** leaves the chord standing, and its slurs move to a surviving sibling;
 * - a **SINGLE NOTE** becomes a rest of its own length, in its own voice AND staff, and every tie
 *   and slur that targeted it re-points onto that rest (which has a NEW id);
 * - a **REST** leaves a hole: the measure's gaps are re-filled (or the tuplet's remainder, inside
 *   one), and a slur anchored to it is dropped.
 *
 * ⚠️ This is the per-slot primitive. Delete on a SELECTION is `clearOps.clearNoteRange`, where the
 * METER decides the silence; it routes its three exceptions back here.
 */
import type { Fraction, Measure, Note, NoteParams, NotePitch, Score, Tuplet } from '@/types/music'
import { fracEq } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { reanchorSlurs } from './slurOps'
import { pruneGlissandi } from './glissandoOps'
import { isGraceNote, removeGrace } from './graceOps'
import { isBracketedGrace, removeBracketed } from './bracketedGraceOps'

/** What the repair needs of the score — `ScoreModel` answers all of it. */
export interface DeleteNoteModel {
  getScore(): Score
  getNote(id: string): Note | undefined
  getAllNotes(): Note[]
  getNotesInMeasure(measureNumber: number): Note[]
  getMeasure(measureNumber: number): Measure | undefined
  isFanMember(noteId: string): boolean
  fanMemberPitches(noteId: string): NotePitch[] | null
  deleteNote(noteId: string): boolean
  addNote(params: NoteParams): Note
  updateNote(noteId: string, updates: Partial<NoteParams>): Note
  repairMeasureGaps(measureNumber: number): void
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet, voice?: number): void
  collapseEmptyVoices(measureNumber: number): void
}

/** Every non-rest note at the given beat AND voice AND staff in a measure — the chord's heads.
 *  Staff-scoped: two staves holding a note at the same beat/voice is ordinary, not a chord. */
export function chordNotesAt(
  model: Pick<DeleteNoteModel, 'getNotesInMeasure'>,
  measureNumber: number, beat: Fraction, voice: number = 0, staff: number = 0,
): Note[] {
  return model.getNotesInMeasure(measureNumber)
    .filter(n => !n.isRest && voiceOf(n) === voice && staffOf(n) === staff && fracEq(n.beat, beat))
}

/**
 * Delete one note and repair what it leaves behind. @returns whether anything was deleted.
 */
export function deleteNoteWithRepair(model: DeleteNoteModel, noteId: string): boolean {
  const note = model.getNote(noteId)
  if (!note) return false

  // ⭐ A GRACE deletes as a GRACE, before any of the slot bookkeeping below — for the member's reason:
  // it reports its main chord's beat, so `chordNotesAt` would answer for that chord and the "single
  // note becomes a rest" branch would silence the note it was played into. Nothing rhythmic leaves
  // the bar, so there is nothing to repair; and no slur anchors to a grace yet (a slur on one is the
  // user's, a real one — docs/plans/grace-notes-plan.md D3, reversed 2026-09-22).
  if (isGraceNote(model.getScore(), noteId)) return removeGrace(model.getScore(), noteId)
  // ⭐ …and a BRACKETED grace as itself, for the same reason (bracketed-grace-plan P2b). Inside a grace
  //    group that IS the merge (B4): the split was only ever drawn.
  if (isBracketedGrace(model.getScore(), noteId)) return removeBracketed(model.getScore(), noteId)

  // ⭐ A FANNED MEMBER deletes as a MEMBER, and must never reach the slot bookkeeping below: the
  // model takes the pitch out (and the member with it, when it was the last one — the group is one
  // shorter), while everything after this is about a SLOT leaving the bar. A member reports the
  // slot's beat, so `chordNotesAt` would answer for the OWNER's chord — one note — and the
  // "single note becomes a rest" branch would drop a rest into a bar that still has its event in
  // it. Nothing here is a guard: each line below is simply a different edit.
  //
  // A slur can anchor to a member, so one that just lost its anchor is dropped — but only when the
  // whole MEMBER went. Losing one pitch of a member that has others leaves the anchor standing.
  if (model.isFanMember(noteId)) {
    const wholeMember = (model.fanMemberPitches(noteId)?.length ?? 0) <= 1
    if (!model.deleteNote(noteId)) return false
    if (wholeMember) reanchorSlurs(model.getScore(), noteId, null)
    return true
  }

  // Check if this note is part of a chord (multiple notes at same beat, same voice, same staff)
  const notesAtSameBeat = chordNotesAt(model, note.measure, note.beat, voiceOf(note), staffOf(note))
  const isPartOfChord = notesAtSameBeat.length > 1

  // Save EVERY tie that targets this note before deletion clears them. When a single
  // note is replaced by a rest, we re-link each source tie onto the new rest so the
  // tie survives the delete (the owner of the tie is the source, not the target) and
  // simply re-points to the rest. Scan-based (not the note's single `tiedFrom`) so a
  // chord tied into this note keeps every arc, and no tie is left dangling.
  const tieSourceIds = !note.isRest && !isPartOfChord
    ? model.getAllNotes().filter(n => !n.isRest && n.tiedTo === noteId).map(n => n.id)
    : []

  // A surviving chord sibling (if any) to re-anchor dependent slurs onto.
  const slurSiblingId = isPartOfChord
    ? notesAtSameBeat.find(n => n.id !== noteId)?.id
    : undefined

  if (!model.deleteNote(noteId)) return false

  if (isPartOfChord) {
    // Chord head removed but the chord survives — re-anchor slurs to a sibling head.
    reanchorSlurs(model.getScore(), noteId, slurSiblingId ?? null)
  } else if (!note.isRest) {
    // A single note (not a chord) is replaced with a rest of the same duration.
    const replacementRest = model.addNote({
      duration: note.duration,
      measure: note.measure,
      beat: note.beat,
      isRest: true,
      dots: note.dots,
      tupletId: note.tupletId, // Preserve tuplet membership
      ...(note.voice && { voice: note.voice }), // keep the rest in the note's own voice
      // ⭐ …and in the note's own STAFF. `addNote` defaults an absent `staff` to 0, so every rest
      // replacing a note on a lower staff was minted on the TOP one — his report, 2026-08-31,
      // deleting the second half of bar 1 of the Prelude: the bass `C4 h` in voice 1 came back as
      // a half rest in a voice 1 the TREBLE staff never had, and the bass's `8.`/`q` came back as
      // rests on the treble that `evictRestsOverlapping` then used to delete the treble's OWN
      // rests. One staff's delete was editing another staff's bar, and `fillGapsWithRests`
      // re-filled the holes it left, so the damage looked like a spacing bug rather than a
      // misplaced slot. Every other site that mints a rest (`addRestAtPosition`, both tuplet
      // fills, the Keyboard's rest key) already passed the staff; this one alone did not.
      ...(note.staff && { staff: note.staff }),
    })

    // Re-point every tie that targeted the deleted note onto the replacement rest,
    // so deleting a tie's target reassigns the tie instead of dropping it. (The rest
    // records one `tiedFrom` for bookkeeping; the arcs themselves are owned by the
    // source notes' `tiedTo`, which all now point at the rest.)
    if (replacementRest && tieSourceIds.length) {
      for (const sid of tieSourceIds) model.updateNote(sid, { tiedTo: replacementRest.id })
      model.updateNote(replacementRest.id, { tiedFrom: tieSourceIds[0] })
    }
    // A slur anchored to this head follows the note onto its replacement rest
    // (the rest gets a NEW id), or is dropped if the rest couldn't be placed.
    reanchorSlurs(model.getScore(), noteId, replacementRest?.id ?? null)
  } else {
    if (note.tupletId) {
      // Rest inside a tuplet deleted — fill the empty gap it left behind
      const tuplet = model.getMeasure(note.measure)?.tuplets?.find(t => t.id === note.tupletId)
      if (tuplet) model.refillTupletRemainder(note.measure, tuplet, voiceOf(note))
    } else {
      // Standalone rest deleted without replacement — re-fill the measure to close the gap
      model.repairMeasureGaps(note.measure)
    }
    reanchorSlurs(model.getScore(), noteId, null) // the rest anchor is gone — drop dependent slurs
  }

  // If that deletion emptied a secondary voice (no notes left, only rests), drop it
  // so the bar reverts to a single voice (Sibelius-style collapse).
  model.collapseEmptyVoices(note.measure)
  // A glissando anchored on the deleted head goes with it (its far end is derived — nothing else is owed).
  pruneGlissandi(model.getScore())
  return true
}
