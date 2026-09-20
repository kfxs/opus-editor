/**
 * ⭐ **WHAT AN ENTERED NOTE OVERWRITES** — the notes already standing where a new one is about to
 * go. Score logic, moved out of `NoteEntryCoordinator` (docs/plans/code-shape-plan-2026-09-19.md, Phase
 * 4.2b): the coordinator keeps pixel resolution, collision and the commit.
 *
 * Always the entry's own VOICE and STAFF — other streams are independent and never clobbered — and
 * never a REST: `ScoreModel.addNote` evicts the rests a new slot covers, one layer down, with the
 * tie migration that needs.
 *
 * ⚠️ **TWO RULES, ON PURPOSE LEFT AS TWO** — they were written apart and moved side by side, ⛔ not
 * merged in the move:
 *
 * - the KEYBOARD path ({@link overwriteOverlappedNotes}) asks *do the two half-open intervals
 *   overlap?*, exactly, with each note's SOUNDING length (a tuplet member's is scaled) — so a note
 *   that starts BEFORE the new one and rings into it goes too;
 * - the MOUSE path ({@link findNotesToOverwrite} / {@link applyEntryOverwrites}) asks *does it START
 *   inside my range?* — a different pitch on the same beat is a chord and is kept, the same pitch is
 *   a replacement, members of the entry's own tuplet are protected, and an earlier note ringing into
 *   the new one is NOT taken. It measures the new note by its undotted length (or the tuplet's slot).
 *
 * Whether they should be one rule is a decision, not a tidy-up.
 */
import type { Measure, Note, NoteParams, Tuplet } from '@/types/music'
import { dbg } from '@/utils/debug'
import { durationToFraction, writtenLength } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import { fracAdd, fracEq, fracGt, fracLt, fracToNumber } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { tupletSlotDuration, tupletWrittenDuration } from '@/utils/musicUtils'
import { formatPitch, spellingToMidi } from '@/utils/pitchSpelling'

/** What overwriting needs of the score — `ScoreModel` answers all of it. */
export interface EntryOverwriteModel {
  getNotesInMeasure(measureNumber: number): Note[]
  deleteNote(noteId: string): boolean
}

/**
 * The KEYBOARD path: delete every same-voice, same-staff NOTE whose sounding interval overlaps
 * `[beat, end)`. @returns the notes it deleted.
 *
 * This runs for an incoming REST too, which is what lets a stamped rest overwrite the notes it
 * covers; the rests it covers are evicted by `addNote`.
 */
export function overwriteOverlappedNotes(
  model: EntryOverwriteModel, measure: Measure,
  entry: { beat: Fraction; end: Fraction; voice: number; staff: number },
): Note[] {
  const toDelete = model.getNotesInMeasure(measure.number).filter(n => {
    if (n.isRest) return false
    // Other voices/staves are independent streams — never clobber them.
    if (voiceOf(n) !== entry.voice) return false
    if (staffOf(n) !== entry.staff) return false
    const nTuplet = n.tupletId ? (measure.tuplets || []).find(t => t.id === n.tupletId) : undefined
    const nDuration = nTuplet
      ? tupletWrittenDuration(nTuplet, n.duration, n.dots || 0)
      : writtenLength(n)
    const nEnd = fracAdd(n.beat, nDuration)
    // Two half-open intervals overlap when each starts before the other ends. STRICT comparisons,
    // and no epsilon: notes that merely TOUCH (one ends where the next begins) do not overlap, and
    // exact arithmetic says so without a tolerance. The epsilon this replaces was a float guard
    // sized when every tuplet was 3:2 — a margin in a model whose beats are Fractions.
    return fracLt(n.beat, entry.end) && fracGt(nEnd, entry.beat)
  })
  if (toDelete.length) {
    dbg(`[Entry] v${entry.voice} overwrites ${toDelete.length} same-voice note(s): ${toDelete.map(n => `${n.step}${n.octave}@b${fracToNumber(n.beat).toFixed(3)}`).join(', ')}`)
  }
  for (const n of toDelete) model.deleteNote(n.id)
  return toDelete
}

/**
 * Delete everything the incoming note overwrites: notes in its duration range or a
 * same-pitch note at its beat (replacement), plus — for a multi-slot tuplet note —
 * any tuplet items inside its actual-time span.
 */
export function applyEntryOverwrites(
  model: EntryOverwriteModel,
  measureNumber: number,
  finalBeat: Fraction,
  duration: NoteParams['duration'],
  dots: number | undefined,
  pitchMidi: number,
  tupletId: string | undefined,
  tupletAtBeat: Tuplet | undefined,
  voice: number = 0,
  staff: number = 0,
): void {
  const notesToOverwrite = findNotesToOverwrite(model, measureNumber, finalBeat, duration, pitchMidi, tupletAtBeat, voice, staff)
  if (notesToOverwrite.length > 0) {
    dbg('Overwriting notes:', notesToOverwrite.map(n => {
      return `${formatPitch(n)}@beat:${fracToNumber(n.beat).toFixed(3)}`
    }).join(', '))
    for (const noteToDelete of notesToOverwrite) {
      model.deleteNote(noteToDelete.id)
    }
  }

  // For tuplet notes that span multiple slots (e.g., quarter note in eighth triplet),
  // delete any existing tuplet notes/rests that fall within the note's actual time range
  if (tupletId && tupletAtBeat) {
    const actualNoteDurationFrac = tupletWrittenDuration(tupletAtBeat, duration, dots ?? 0)
    const noteEndBeat = fracAdd(finalBeat, actualNoteDurationFrac)

    const tupletItemsToDelete = model.getNotesInMeasure(measureNumber)
      .filter(n =>
        n.tupletId === tupletId &&
        fracGt(n.beat, finalBeat) && // After the note's start (exclusive)
        fracLt(n.beat, noteEndBeat)  // Before the note's end (exclusive)
      )

    for (const itemToDelete of tupletItemsToDelete) {
      model.deleteNote(itemToDelete.id)
    }
  }
}

/**
 * Find notes that would be overwritten by a new note.
 * Returns notes that fall within the new note's duration range.
 * Notes at the same beat with DIFFERENT pitch are kept (chords).
 * Notes at the same beat with SAME pitch are deleted (replacement).
 */
export function findNotesToOverwrite(
  model: EntryOverwriteModel,
  measureNumber: number,
  beat: Fraction,
  duration: NoteParams['duration'],
  pitch: number,
  tupletInfo?: Tuplet,
  voice: number = 0,
  staff: number = 0,
): Note[] {
  // For tuplet notes, use the actual tuplet note duration, not the base duration
  const noteDurationFrac = tupletInfo
    ? tupletSlotDuration(tupletInfo)
    : durationToFraction(duration)
  const noteEnd = fracAdd(beat, noteDurationFrac)
  const notesInMeasure = model.getNotesInMeasure(measureNumber)

  return notesInMeasure.filter(existing => {
    // Skip rests - they're handled separately by ScoreModel
    if (existing.isRest) return false

    // Other voices/staves are independent streams — never overwrite them.
    if (voiceOf(existing) !== voice) return false
    if (staffOf(existing) !== staff) return false

    // Never delete notes that are in the same tuplet (except for same-beat replacement)
    // Notes within a tuplet should coexist and not overwrite each other based on range
    if (tupletInfo && existing.tupletId === tupletInfo.id) {
      // Only allow deletion if at the exact same beat AND same pitch (replacement)
      if (fracEq(existing.beat, beat) && !existing.isRest && spellingToMidi(existing.step!, existing.alter!, existing.octave!) === pitch) {
        return true
      }
      return false  // Protect all other notes in the same tuplet
    }

    // Notes at the same beat: only delete if same pitch (replacement); a different pitch
    // is a chord and is kept.
    if (fracEq(existing.beat, beat)) {
      return !existing.isRest && spellingToMidi(existing.step!, existing.alter!, existing.octave!) === pitch
    }

    // Check if this note starts within the new note's time range
    if (fracGt(existing.beat, beat) && fracLt(existing.beat, noteEnd)) {
      return true
    }

    return false
  })
}
