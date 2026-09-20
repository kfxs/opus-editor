/**
 * ⭐ **SILENCING A SLOT — a note (or a whole chord) becomes the rest of its own length.** Score
 * logic, moved off `MusicEngine` (docs/code-shape-plan-2026-09-19.md, Phase 4.1): the facade keeps
 * the undo entry and its label.
 *
 * Not a delete. Delete says "this shouldn't be here" and leaves a gap for the meter-aware fill to
 * re-decide; this says "this lasts exactly as long, but silent", so the length is preserved rather
 * than re-derived ({@link swapSlotForRest} does the swap and the ties). The two agree
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
import { fracToNumber } from '@/utils/fraction'
import { v4 as uuidv4 } from 'uuid'
import { chordNotesAt } from './deleteNoteOps'
import { findSlot } from './slotLookup'
import { fmtSlot } from './slotPlacementOps'
import { reanchorSlurs } from './slurOps'

/** What silencing a slot needs of the score — `ScoreModel` answers all of it. */
export interface ConvertToRestModel {
  getScore(): Score
  getNote(id: string): Note | undefined
  getNotesInMeasure(measureNumber: number): Note[]
  isFanMember(noteId: string): boolean
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

  const rest = swapSlotForRest(model.getScore(), noteId)
  if (!rest) return null

  // Slurs anchored to ANY head of the old slot follow it onto the rest — the slot is still there
  // and still has a length, so the arc still has something to hang on.
  for (const id of pitchIds) reanchorSlurs(model.getScore(), id, rest.id)

  // Silencing the last note of a secondary voice leaves it all rests → it collapses, exactly as
  // after a delete (Sibelius-style).
  model.collapseEmptyVoices(note.measure)

  return rest.id
}

/**
 * Turn the SLOT holding `noteId` into a rest of that slot's own duration, in place. Returns the
 * new rest, or null if `noteId` names nothing or is already a rest.
 *
 * A slot-level swap, NOT a delete-then-refill, and that is the whole point: `Chord` and `Rest`
 * already agree on every field that defines WHERE and HOW LONG a slot is (beat, duration, dots,
 * tupletId, actualDuration, voice, staffId), so the conversion copies them across and drops only
 * what is meaningless without pitches (the notes, stem, beam, articulations). A quarter note
 * becomes a quarter rest because it is the SAME SLOT wearing a different type — nothing re-derives
 * the duration, so nothing can round it to the meter's idea of a good rest. (Deleting instead
 * leaves a gap for `repairAllMeasureGaps` to re-fill meter-aware, which is right for a HOLE and
 * wrong here: the silence has an authored length.)
 *
 * Whole slot, every pitch, because a rest cannot hold pitches: "convert one head of a chord" has
 * no representation, exactly as "dot one head of a chord" doesn't (see the `dots` note in
 * EditorState). A chord of any size becomes ONE rest.
 *
 * Ties are handled per direction, mirroring `deleteNoteOps.deleteNoteWithRepair`'s let-ring rule:
 * arcs LEAVING (`tiedTo`) die, since a rest has nothing to carry into the next note; arcs ARRIVING
 * (`tiedFrom`) SURVIVE and re-point at the rest, so tying into a slot and silencing it lets the
 * previous note ring rather than silently dropping its arc.
 */
export function swapSlotForRest(score: Score, noteId: string): Rest | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord } = found

  // Every arc LEAVING this chord dies with its pitches — clear the far end's back-pointer so no
  // note is left claiming a tie from a rest.
  for (const pitch of chord.notes) {
    if (pitch.tiedTo) {
      const partner = findSlot(score, pitch.tiedTo)
      if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
      else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
    }
  }

  // Arcs ARRIVING keep their shape and re-point onto the rest. Scan-based, not per-pitch
  // `tiedFrom`, so a chord tied into this one keeps EVERY arc (the same reason deleteNote scans).
  // The arcs are owned by the sources' `tiedTo`; the rest records one `tiedFrom` as bookkeeping.
  const restId = uuidv4()
  const tieSourceIds: string[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      for (const p of slot.notes) {
        if (p.tiedTo && chord.notes.some(n => n.id === p.tiedTo)) {
          p.tiedTo = restId
          tieSourceIds.push(p.id)
        }
      }
    }
  }

  const rest: Rest = {
    id: restId,
    type: 'rest',
    beat: chord.beat,
    duration: chord.duration,
    measure: chord.measure,
    ...(chord.dots !== undefined && { dots: chord.dots }),
    ...(chord.voice !== undefined && { voice: chord.voice }),
    ...(chord.tupletId !== undefined && { tupletId: chord.tupletId }),
    ...(chord.actualDuration !== undefined && { actualDuration: chord.actualDuration }),
    ...(chord.staffId !== undefined && { staffId: chord.staffId }),
    ...(tieSourceIds.length > 0 && { tiedFrom: tieSourceIds[0] }),
  }

  for (const measure of score.measures) {
    const idx = measure.slots.findIndex(s => s.id === chord.id)
    if (idx !== -1) {
      dbg(`[Model.convertToRest] ${fmtSlot(chord)} → REST ${rest.duration}${rest.dots ? '.'.repeat(rest.dots) : ''} @b${fracToNumber(rest.beat).toFixed(3)}${tieSourceIds.length ? ` (${tieSourceIds.length} tie(s) re-pointed)` : ''}`)
      // In place, at the same index — the slot keeps its seat in the bar's order.
      measure.slots[idx] = rest
      return rest
    }
  }
  return null
}
