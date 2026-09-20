/**
 * ⭐ **SILENCING A SLOT — a note (or a whole chord) becomes the rest of its own length.** Score
 * logic, moved off `MusicEngine` (docs/code-shape-plan-2026-09-19.md, Phase 4.1): the facade keeps
 * the undo entry and its label.
 *
 * Not a delete. Delete says "this shouldn't be here" and leaves a gap for the meter-aware fill to
 * re-decide; this says "this lasts exactly as long, but silent", so the length is preserved rather
 * than re-derived (see `ScoreModel.convertToRest`, which does the swap and the ties). The two agree
 * on a plain note in a plain bar, which is why they look alike — they part company on a dotted
 * note, a tuplet member, or a chord, where the fill would answer a question it was never asked.
 *
 * What this adds to the model's swap is what the REST OF THE SCORE is owed: the rest carries a NEW
 * id (a rest is a different slot, not a re-typed one), so slurs anchored to ANY head of the old
 * slot follow it onto the rest, and a secondary voice left with nothing but rests collapses —
 * exactly as after a delete (`deleteNoteOps`).
 *
 * ⛔ A FANNED MEMBER is refused: a member is a pitch inside one event, and the silence belongs to
 * the whole gesture (docs/fanned-beam-pitches-plan.md §3).
 */
import type { Note, Rest, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { staffOf, voiceOf } from '@/utils/lanes'
import { chordNotesAt } from './deleteNoteOps'
import { reanchorSlurs } from './slurOps'

/** What silencing a slot needs of the score — `ScoreModel` answers all of it. */
export interface ConvertToRestModel {
  getScore(): Score
  getNote(id: string): Note | undefined
  getNotesInMeasure(measureNumber: number): Note[]
  isFanMember(noteId: string): boolean
  convertToRest(noteId: string): Rest | null
  collapseEmptyVoices(measureNumber: number): void
}

/** Every pitch id sharing `note`'s slot — its chord siblings and itself. Scoped to the note's own
 *  (voice, staff) via {@link chordNotesAt}: two staves holding a note at the same beat in voice 0
 *  is ordinary, not a chord, and re-anchoring the OTHER staff's slurs onto this rest would be a real
 *  bug. The note's own id is appended defensively so it is always covered. */
export function slotPitchIds(model: Pick<ConvertToRestModel, 'getNotesInMeasure'>, note: Note): string[] {
  const ids = chordNotesAt(model, note.measure, note.beat, voiceOf(note), staffOf(note)).map(n => n.id)
  return ids.includes(note.id) ? ids : [...ids, note.id]
}

/**
 * Turn the slot holding `noteId` into a rest. @returns the new rest's ID, or null when nothing
 * changed (a rest already, a fanned member, an id that is gone).
 *
 * ⚠️ An id, not the rest: silencing the last note of a secondary voice COLLAPSES it, and the rest
 * goes with the lane. The score still changed — the caller owes an undo entry — so "did it
 * happen?" and "is the rest still there?" are two questions, and only the first is answered here.
 */
export function convertSlotToRest(model: ConvertToRestModel, noteId: string): string | null {
  if (model.isFanMember(noteId)) {
    dbg(`[Fan] convert to rest refused on member ${noteId} — it attaches to the slot, not to one member`)
    return null
  }
  const note = model.getNote(noteId)
  if (!note || note.isRest) return null

  // BEFORE the swap: once the slot is a rest there are no heads left to find.
  const pitchIds = slotPitchIds(model, note)

  const rest = model.convertToRest(noteId)
  if (!rest) return null

  // Slurs anchored to ANY head of the old slot follow it onto the rest — the slot is still there
  // and still has a length, so the arc still has something to hang on.
  for (const id of pitchIds) reanchorSlurs(model.getScore(), id, rest.id)

  // Silencing the last note of a secondary voice leaves it all rests → it collapses, exactly as
  // after a delete (Sibelius-style).
  model.collapseEmptyVoices(note.measure)

  return rest.id
}
