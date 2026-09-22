/**
 * ⭐ **A REST BECOMES A NOTE, in place** — what `ScoreModel.updateNote` does when handed
 * `{ isRest: false, step, … }` for a rest (the keyboard's edit-in-place: type a pitch over a rest).
 * Extracted from `ScoreModel` (2026-09-22) when the grace rule joined it: the note keeps the rest's
 * id, beat, voice, staff and tuplet, and takes over what was written ON the rest — its incoming tie,
 * and ⭐ its GRACE (D7 reversed: `./restGraceOps`).
 */
import { v4 as uuidv4 } from 'uuid'
import type { Chord, NoteParams, NotePitch, PitchAlter, Rest, Score } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { computeActualDurationForSlot, dropRestHiddenOf } from './slotPlacementOps'
import { rehomeRestGraces, takeRestGraces } from './restGraceOps'

export function convertRestToChord(score: Score, rest: Rest, updates: Partial<NoteParams>): { chord: Chord; pitch: NotePitch } {
  const measure = score.measures.find(m => m.number === rest.measure)
  if (!measure) throw new Error(`Measure ${rest.measure} does not exist`)

  const notePitch: NotePitch = {
    id: rest.id,   // reuse rest ID so the caller's selectedNoteId stays valid
    step: updates.step!,
    alter: (updates.alter ?? 0) as PitchAlter,
    octave: updates.octave!,
    forceAccidental: updates.forceAccidental,
    tiedFrom: rest.tiedFrom,  // preserve incoming tie
  }
  const chord: Chord = {
    id: uuidv4(),
    type: 'chord',
    beat: updates.beat ?? rest.beat,
    duration: updates.duration ?? rest.duration,
    dots: updates.dots ?? rest.dots,
    measure: rest.measure,
    voice: rest.voice,  // a rest converted to a note keeps its voice
    staffId: rest.staffId,  // ...and its staff — else it jumps to staff 0
    tupletId: updates.tupletId ?? rest.tupletId,
    actualDuration: rest.actualDuration,
    articulations: updates.articulations,
    articulationPlacement: updates.articulationPlacement,
    articulationStemAlign: updates.articulationStemAlign,
    notes: [notePitch],
  }
  chord.actualDuration = computeActualDurationForSlot(chord, measure)

  const orphans = takeRestGraces([rest])
  measure.slots = measure.slots.filter(s => s.id !== rest.id)
  measure.slots.push(chord)
  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))
  // ⭐ …and a grace written on the rest moves onto the note typed over it (his rule, 2026-09-22).
  rehomeRestGraces(measure, orphans)

  // ⭐ The rest's hand-positioning goes with the rest (his report, 2026-08-30): hiding a rest
  // and then typing a note over it left `restHidden` filed under the position the note now
  // occupies. The position keeps holding a slot, so `clearRemovedContentOverrides` never
  // sees it — only this operation knows a rest just stopped existing here.
  dropRestHiddenOf(score, measure, rest)

  return { chord, pitch: notePitch }
}
