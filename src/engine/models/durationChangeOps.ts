/**
 * ⭐ **CHANGING A NOTE — and what a new LENGTH does to the bar around it.** `updates` can carry
 * anything a note has, but the work here is all the duration's: a note made LONGER removes what it
 * now covers (and, past the barline, becomes a tied chain — `spanningNoteOps`); a note made SHORTER
 * leaves room that is filled with rests, and lets go of a tie it no longer reaches; a note inside a
 * TUPLET is clamped to what the group has left and the group's filler rests are recomputed. A
 * chord's heads are kept in step throughout — they share one length.
 *
 * Score logic, moved out of `NoteEntryCoordinator` (docs/plans/code-shape-plan-2026-09-19.md, Phase
 * 4.2c): the coordinator keeps a fanned member's straight-through write and the commit, which is
 * why {@link changeNote} answers the LABEL to commit under — or null when nothing was written.
 *
 * Every edit acts on ONE voice's stream on ONE staff: a duration change never deletes or fills
 * another voice's notes or rests.
 *
 * ⚠️ Float beats and an epsilon, where `entryOverwriteOps`' keyboard path is exact. Moved as it was;
 * making it exact is its own change, with its own cases (any tuplet that is not 3:2 is where a
 * float margin stops being safe — the tuplet branch below is already exact for that reason).
 */
import type { Note, NoteDuration, NoteParams, Tuplet } from '@/types/music'
import { dbg } from '@/utils/debug'
import { durationToFraction } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import { fracAdd, fracDiv, fracGt, fracLt, fracMul, fracSub, fracToNumber } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { measureCapacityQuarters } from '@/utils/measureCapacity'
import { durationToBeats, tupletScale, tupletSpan } from '@/utils/musicUtils'
import { chordNotesAt } from './deleteNoteOps'
import { splitChordWithTie, type SpanningNoteModel } from './spanningNoteOps'

/** What a duration change needs of the score — `ScoreModel` answers all of it. */
export interface DurationChangeModel extends SpanningNoteModel {
  fillGapWithRests(measureNumber: number, startBeat: Fraction, beats: number, voice?: number, staff?: number): void
  fillMeasureGaps(measureNumber: number): void
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet, voice?: number): void
}

/** The changed note, and the undo label the caller commits under — null when nothing was written. */
export interface NoteChange {
  note: Note
  commit: string | null
}

/** Float beat-comparison epsilon (pixel-boundary tolerance; see docs/ARCHITECTURE.md). */
const BEAT_EPSILON = 0.001

/** What {@link changeNote} works out once and hands to the branch that applies it. */
interface NoteUpdateCtx {
  noteId: string
  updates: Partial<NoteParams>
  existingNote: Note
  measureNotes: Note[]
  chordNotes: Note[]
  isChord: boolean
  oldBeats: number
  newBeats: number
  newDuration: NoteDuration
  newDots: number
  beatDifference: number
}

export function changeNote(model: DurationChangeModel, noteId: string, updates: Partial<NoteParams>): NoteChange {
  const existingNote = model.getNote(noteId)
  if (!existingNote) throw new Error(`Note ${noteId} not found`)

  const oldDuration = existingNote.duration
  const oldDots = existingNote.dots || 0
  let newDuration = updates.duration || oldDuration
  // Handle dots: if dots is explicitly set in updates (even to 0), use it; otherwise keep old
  const newDots = updates.dots !== undefined ? updates.dots : oldDots

  // Edits act on ONE voice's stream. Scope the measure view + chord lookup to the
  // edited note's voice so a duration change never deletes or fills another voice's
  // notes/rests (voices are independent streams that each sum to the bar length).
  const editVoice = voiceOf(existingNote)
  const editStaff = staffOf(existingNote)
  const measureNotes = model.getNotesInMeasure(existingNote.measure)
    .filter(n => voiceOf(n) === editVoice && staffOf(n) === editStaff)
  const chordNotes = chordNotesAt(model, existingNote.measure, existingNote.beat, editVoice, editStaff)
  const isChord = chordNotes.length > 1

  const target = existingNote.isRest ? 'REST' : `${existingNote.step}${existingNote.octave}`
  dbg(`[Edit] v${editVoice} ${target} m${existingNote.measure} b${fracToNumber(existingNote.beat).toFixed(3)} | dur ${oldDuration}${oldDots ? '.'.repeat(oldDots) : ''}→${newDuration}${newDots ? '.'.repeat(newDots) : ''}${isChord ? ` (chord of ${chordNotes.length})` : ''} | scoped to ${measureNotes.length} same-voice slot(s)`, updates)

  // Check for measure overflow (considering dots)
  const measure = model.getMeasure(existingNote.measure)
  if (measure && (updates.duration || updates.dots !== undefined)) {
    const measureTotalBeats = measureCapacityQuarters(measure)
    const availableBeats = measureTotalBeats - fracToNumber(existingNote.beat)
    const requestedBeats = durationToBeats(newDuration, newDots)

    // Tuplet overflow is handled by updateTupletNote (which uses the correct tuplet ratio).
    // Measure-level overflow only applies to non-tuplet notes.
    if (requestedBeats > availableBeats + BEAT_EPSILON && !existingNote.tupletId) {
      if (!existingNote.isRest) {
        // Non-tuplet, non-rest overflow: split with tie across the barline (Dorico-style)
        const overflowAmount = requestedBeats - availableBeats
        const oldNoteEnd = fracToNumber(existingNote.beat) + durationToBeats(oldDuration, oldDots)

        // Clear notes in the current measure that fall within the newly extended range
        for (const n of measureNotes) {
          if (n.id === noteId || chordNotes.some(c => c.id === n.id)) continue
          const nStart = fracToNumber(n.beat)
          if (nStart >= oldNoteEnd - BEAT_EPSILON && nStart < fracToNumber(existingNote.beat) + availableBeats - BEAT_EPSILON) {
            model.deleteNote(n.id)
          }
        }

        // Split every head of the slot — the chord's other members, then the target note itself.
        // Each head's erosion of the next bar spares the other heads' continuations
        // (`spanningNoteOps`); it used to delete them, and only the last head stayed tied.
        splitChordWithTie(model, [...chordNotes.filter(c => c.id !== noteId), existingNote], newDuration, overflowAmount, newDots)

        return { note: model.getNote(noteId)!, commit: 'Update note duration' }
      }

      // Non-tuplet rest overflow: clip to fit within the measure
      const fittingDuration = findLargestFittingDuration(availableBeats)
      if (fittingDuration) {
        newDuration = fittingDuration
        updates = { ...updates, duration: fittingDuration, dots: 0 }
      } else {
        // No standard duration fits, keep the old duration
        newDuration = oldDuration
        delete updates.duration
        delete updates.dots
      }
    }
  }

  const oldBeats = durationToBeats(oldDuration, oldDots)
  const newBeats = durationToBeats(newDuration, newDots)
  const beatDifference = oldBeats - newBeats

  const ctx: NoteUpdateCtx = {
    noteId, updates, existingNote, measureNotes,
    chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference,
  }

  // Tuplet notes have special duration constraints and filler rest logic
  if (existingNote.tupletId && measure) {
    const tuplet = measure.tuplets?.find(t => t.id === existingNote.tupletId)
    if (tuplet) return changeTupletNote(model, ctx, tuplet)
  }

  return changePlainNote(model, ctx)
}

/** Handles duration updates for notes inside a tuplet. */
function changeTupletNote(model: DurationChangeModel, ctx: NoteUpdateCtx, tuplet: Tuplet): NoteChange {
  let { updates, newDuration } = ctx
  const { noteId, existingNote, measureNotes, chordNotes, isChord } = ctx
  // The dots that will actually be WRITTEN. The clamp below drops them, and everything after it —
  // the span this note covers, and the chord members kept in step — has to use what was written
  // rather than what was asked for. (The chord sync used to read the asked-for dots, so a clamped
  // chord ended up with its members dotted and its top note not.)
  let newDots = ctx.newDots

  // All exact. Every quantity here is a beat or a factor between beats, and the model keeps those
  // as Fractions; the floats these replace were an epsilon comparison sized when every tuplet was
  // 3:2, in the one file where 4:5 and 8:11 now turn up.
  const ratio = tupletScale(tuplet)
  const tupletEnd = fracAdd(tuplet.startBeat, tupletSpan(tuplet))
  // Remaining space runs from this note's start to the tuplet end
  const remaining = fracSub(tupletEnd, existingNote.beat)

  // Clamp new duration if it exceeds remaining tuplet space
  if (fracGt(fracMul(durationToFraction(newDuration, newDots), ratio), remaining)) {
    const fittingDuration = findLargestFittingDuration(fracToNumber(fracDiv(remaining, ratio)))
    if (fittingDuration) {
      newDuration = fittingDuration
      newDots = 0
      updates = { ...updates, duration: fittingDuration, dots: 0 }
    } else {
      return { note: existingNote, commit: null } // nothing fits: nothing written
    }
  }

  // Delete any tuplet items that fall inside the new note's actual time span. STRICTLY inside:
  // an item starting exactly where this note ends is the next slot, not something it covers.
  const noteEnd = fracAdd(existingNote.beat, fracMul(durationToFraction(newDuration, newDots), ratio))
  const itemsToDelete = measureNotes.filter(n =>
    n.tupletId === existingNote.tupletId &&
    n.id !== noteId &&
    fracGt(n.beat, existingNote.beat) &&
    fracLt(n.beat, noteEnd)
  )
  for (const item of itemsToDelete) model.deleteNote(item.id)

  const updatedNote = model.updateNote(noteId, updates)

  // Recompute all filler rests from the fill pointer (in the tuplet's own voice)
  model.refillTupletRemainder(existingNote.measure, tuplet, voiceOf(existingNote))

  // Also update chord notes to keep duration in sync
  if (isChord) {
    for (const chordNote of chordNotes) {
      if (chordNote.id !== noteId) {
        model.updateNote(chordNote.id, { duration: newDuration, dots: newDots })
      }
    }
  }

  return { note: updatedNote, commit: 'Update tuplet note' }
}

/** Handles duration updates for regular (non-tuplet) notes, both chords and singles. */
function changePlainNote(model: DurationChangeModel, ctx: NoteUpdateCtx): NoteChange {
  const { noteId, updates, existingNote, measureNotes, chordNotes, isChord, oldBeats, newBeats, newDuration, newDots, beatDifference } = ctx
  const editVoice = voiceOf(existingNote)
  const editStaff = staffOf(existingNote)

  // If duration is being lengthened, remove overlapping notes/rests first
  if (beatDifference < -BEAT_EPSILON) {
    const existingBeatNum = fracToNumber(existingNote.beat)
    const noteEndBeat = existingBeatNum + newBeats
    const chordNoteIds = new Set(chordNotes.map(n => n.id))
    const notesToRemove: string[] = []
    let beatsToRecover = 0

    for (const n of measureNotes) {
      if (n.id === noteId || chordNoteIds.has(n.id)) continue
      const nStart = fracToNumber(n.beat)
      const nEnd = nStart + durationToBeats(n.duration, n.dots || 0)
      // Note starts within the extended range - remove it entirely
      if (nStart >= existingBeatNum + oldBeats && nStart < noteEndBeat) {
        notesToRemove.push(n.id)
        beatsToRecover += durationToBeats(n.duration, n.dots || 0)
      // Note starts before but extends into the range - remove it
      } else if (nStart < existingBeatNum + oldBeats && nEnd > existingBeatNum + oldBeats && nEnd <= noteEndBeat) {
        notesToRemove.push(n.id)
        beatsToRecover += durationToBeats(n.duration, n.dots || 0)
      }
    }

    dbg(`[Edit] lengthen v${editVoice}: removing ${notesToRemove.length} overlapped same-voice slot(s), recovered ${beatsToRecover.toFixed(3)}b (need ${Math.abs(beatDifference).toFixed(3)}b)`)
    for (const id of notesToRemove) model.deleteNote(id)

    // If we removed more beats than needed, add rests to fill the excess
    const excessBeats = beatsToRecover - Math.abs(beatDifference)
    if (excessBeats > BEAT_EPSILON) {
      dbg(`[Edit] lengthen v${editVoice}: ${excessBeats.toFixed(3)}b excess → fill with rests`)
      model.fillGapWithRests(
        existingNote.measure,
        fracAdd(existingNote.beat, durationToFraction(newDuration, newDots)),
        excessBeats,
        editVoice,
        editStaff,
      )
    }
  }

  // For chords, update all members' duration and dots so they stay in sync
  if (isChord && (updates.duration || updates.dots !== undefined)) {
    for (const chordNote of chordNotes) {
      if (chordNote.id === noteId) continue
      model.updateNote(chordNote.id, { duration: newDuration, dots: newDots })
    }
  }

  // Apply all requested updates to the target note
  const note = model.updateNote(noteId, updates)

  // If duration was shortened, fill the freed space with rests.
  if (beatDifference > BEAT_EPSILON) {
    dbg(`[Edit] shorten v${editVoice}: freed ${beatDifference.toFixed(3)}b → fill with rests (${existingNote.isRest ? 'meter-aware whole-measure refill' : `from b${fracToNumber(fracAdd(note.beat, durationToFraction(newDuration, newDots))).toFixed(3)}`})`)
    if (existingNote.isRest) {
      // Meter-aware refill: the shortened rest's remainder is regrouped for the
      // bar's meter. This both fixes the bar length (a former measure rest's
      // nominal 'w' is 4 quarters, not the real bar length) and groups rests
      // correctly in compound/irregular meters — the legacy float splitter
      // below does neither.
      model.fillMeasureGaps(note.measure)
    } else {
      model.fillGapWithRests(
        note.measure,
        fracAdd(note.beat, durationToFraction(newDuration, newDots)),
        beatDifference,
        editVoice,
        editStaff,
      )

      // Break tiedTo if the shortened note no longer abuts its tie target
      if (note.tiedTo) {
        const tiedTarget = model.getNote(note.tiedTo)
        if (tiedTarget) {
          const noteEnd = fracToNumber(note.beat) + durationToBeats(newDuration, newDots)
          const targetBeat = fracToNumber(tiedTarget.beat)
          if (Math.abs(noteEnd - targetBeat) > BEAT_EPSILON || note.measure !== tiedTarget.measure) {
            dbg(`[Tie] broken — ${note.step}${note.octave} m${note.measure} no longer abuts tied target after duration change`)
            model.updateNote(note.id, { tiedTo: undefined })
            model.updateNote(tiedTarget.id, { tiedFrom: undefined })
          }
        }
      }
    }
  }

  return { note, commit: 'Update note' }
}

/** Find the largest standard note duration that fits within available beats. */
export function findLargestFittingDuration(availableBeats: number): NoteParams['duration'] | null {
  const durations: { duration: NoteParams['duration']; beats: number }[] = [
    { duration: 'w', beats: 4 },
    { duration: 'h', beats: 2 },
    { duration: 'q', beats: 1 },
    { duration: '8', beats: 0.5 },
    { duration: '16', beats: 0.25 },
    { duration: '32', beats: 0.125 },
  ]

  for (const { duration, beats } of durations) {
    if (beats <= availableBeats + BEAT_EPSILON) {
      return duration
    }
  }
  return null
}
