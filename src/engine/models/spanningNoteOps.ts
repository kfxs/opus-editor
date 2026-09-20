/**
 * ⭐ **A NOTE THAT SPANS A BARLINE** — a length that does not fit its bar is written as a TIED
 * CHAIN: the pieces that fit in the start bar, then the pieces that continue in the next. Score
 * logic, moved out of `NoteEntryCoordinator` (docs/plans/code-shape-plan-2026-09-19.md, Phase 4.2): the
 * coordinator keeps pixel resolution, collision and the commit.
 *
 * {@link placeSpanningNote} is the single primitive behind both callers, and the ONLY difference
 * between them is the chain's head: a note being ENTERED makes a fresh one
 * ({@link addSplitNoteWithTie}); a DURATION CHANGE reuses the note being edited
 * ({@link splitExistingNoteWithTie}).
 *
 * What the chain lands ON in the next bar is ERODED first, Sibelius-style
 * ({@link erodeOverflowZone}): a note wholly inside the overflow zone is deleted, one that
 * straddles its edge is trimmed and moved to start where the zone ends, and one with a tie chain
 * of its own downstream is deleted (the punt case — too complex to rewire). Only the overflowing
 * note's own voice and staff: other streams are independent.
 */
import type { Measure, Note, NoteParams } from '@/types/music'
import { dbg } from '@/utils/debug'
import { durationToFraction, splitBeatsIntoLengths } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import { fracAdd, fracEq, fracFromInt, fracToNumber } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { beatToFrac, durationToBeats } from '@/utils/musicUtils'

/** Safety cap on the addMeasure() loop that extends the score to reach a target measure. */
const MAX_MEASURE_CREATE_ATTEMPTS = 20

/** What a spanning note needs of the score — `ScoreModel` answers all of it. */
export interface SpanningNoteModel {
  getMeasure(measureNumber: number): Measure | undefined
  addMeasure(): Measure
  getNotesInMeasure(measureNumber: number): Note[]
  getNote(id: string): Note | undefined
  addNote(params: NoteParams): Note
  updateNote(noteId: string, updates: Partial<NoteParams>): Note
  deleteNote(noteId: string): boolean
  setTremolo(noteId: string, tremolo: NonNullable<NoteParams['tremolo']> | null): Note | null
}

/**
 * Place a note that spans across one barline by splitting it into a tied chain:
 * `currentMeasureDurations` in the start measure, `nextMeasureDurations` in the next.
 * The single primitive behind both note-entry and duration-change overflow.
 *
 * The ONLY difference between those two callers is the chain head: pass
 * `existingHeadId` to reuse an existing note as the first link (duration change),
 * or omit it to create the head fresh (note entry). Returns the first note in the
 * chain (the reused/created head), or null if the split or measure creation fails.
 */
export function placeSpanningNote(model: SpanningNoteModel, p: {
  step: NoteParams['step']
  alter: NoteParams['alter']
  octave: NoteParams['octave']
  startMeasure: number
  startBeat: Fraction
  totalBeats: number
  overflowAmount: number
  voice?: NoteParams['voice']
  staff?: NoteParams['staff']
  existingHeadId?: string
  /** The mark the note is being ENTERED with, when there is no existing head to read one off. */
  tremolo?: NoteParams['tremolo']
}): Note | null {
  const beatsInCurrentMeasure = p.totalBeats - p.overflowAmount
  const beatsInNextMeasure = p.overflowAmount

  const currentMeasureDurations = splitBeatsIntoLengths(beatsInCurrentMeasure)
  const nextMeasureDurations = splitBeatsIntoLengths(beatsInNextMeasure)

  if (currentMeasureDurations.length === 0 || nextMeasureDurations.length === 0) {
    console.warn('Could not split spanning note into valid durations')
    return null
  }

  const nextMeasureNumber = p.startMeasure + 1
  if (!ensureMeasureExists(model, nextMeasureNumber)) {
    console.warn('Could not create next measure for tie split')
    return null
  }

  // Erode notes in the overflow zone of the next measure (Sibelius-style).
  //
  // ⭐ …but never the continuation of THIS SLOT'S OWN CHORD. A chord crosses the barline one head at
  // a time — three heads lengthened together, or a chord built click by click — and each head's
  // pieces land in the same zone: eroding them deleted every head's continuation but the last
  // one's (`[C E]` lengthened across the barline left E a bare half). A piece is the slot's own when
  // its tie chain leads back to a head on the chain's starting beat, in its voice and staff.
  // ⚠️ Except the head being RE-SPLIT: its old continuation is what the new chain replaces.
  const ownContinuation = (note: Note): boolean => {
    let cur: Note | undefined = note
    for (let guard = 0; cur?.tiedFrom && guard < 64; guard++) {
      cur = model.getNote(cur.tiedFrom)
      if (cur && cur.measure === p.startMeasure && fracEq(cur.beat, p.startBeat)) {
        return cur.id !== p.existingHeadId && voiceOf(cur) === voiceOf(p) && staffOf(cur) === staffOf(p)
      }
    }
    return false
  }
  erodeOverflowZone(model, nextMeasureNumber, beatsInNextMeasure, voiceOf(p), staffOf(p), ownContinuation)

  const pitch = { step: p.step, alter: p.alter, octave: p.octave, ...(p.voice && { voice: p.voice }), ...(p.staff && { staff: p.staff }) }

  // A tremolo on the head must reach EVERY piece of the chain: a tremolo interrupted at a barline
  // is still being played across it (docs/plans/tremolo-plan.md §6). Read before the head is retitled,
  // and applied explicitly per piece — the continuations are built from `{step, alter, octave,
  // voice, staff}` alone, so anything not named here is dropped in silence.
  //
  // TWO sources now, one per caller: the duration-change caller reads the mark off the head it is
  // reusing, and the ENTRY caller carries the armed one (§10) — you CAN enter a note with a
  // tremolo since note-entry mode learned to arm one, so a fresh head is no longer always bare.
  const tremolo = p.tremolo ?? (p.existingHeadId ? model.getNote(p.existingHeadId)?.tremolo : undefined)

  // Build the tied chain. Split durations are always plain (dots cleared).
  let firstNote: Note | null = null
  let previousNoteId: string | null = null
  let currentBeat = p.startBeat
  let startIndex = 0

  if (p.existingHeadId) {
    // Reuse the existing note as the head: retitle its duration to the first piece.
    model.updateNote(p.existingHeadId, { duration: currentMeasureDurations[0].duration, dots: currentMeasureDurations[0].dots })
    firstNote = model.getNote(p.existingHeadId) ?? null
    previousNoteId = p.existingHeadId
    currentBeat = fracAdd(currentBeat, durationToFraction(currentMeasureDurations[0].duration, currentMeasureDurations[0].dots))
    startIndex = 1
  }

  // Remaining current-measure pieces (when the split needs > 1 — 3 beats is now ONE dotted half)
  for (let i = startIndex; i < currentMeasureDurations.length; i++) {
    const { duration, dots } = currentMeasureDurations[i]
    const note = model.addNote({ ...pitch, duration, dots, measure: p.startMeasure, beat: currentBeat })
    if (tremolo) model.setTremolo(note.id, tremolo)
    if (!firstNote) firstNote = note
    if (previousNoteId) {
      model.updateNote(previousNoteId, { tiedTo: note.id })
      model.updateNote(note.id, { tiedFrom: previousNoteId })
    }
    previousNoteId = note.id
    currentBeat = fracAdd(currentBeat, durationToFraction(duration, dots))
  }

  // Tied continuation pieces in the next measure
  let nextBeat = fracFromInt(0)
  for (const { duration, dots } of nextMeasureDurations) {
    const note = model.addNote({ ...pitch, duration, dots, measure: nextMeasureNumber, beat: nextBeat })
    if (tremolo) model.setTremolo(note.id, tremolo)
    if (previousNoteId) {
      model.updateNote(previousNoteId, { tiedTo: note.id })
      model.updateNote(note.id, { tiedFrom: previousNoteId })
    }
    previousNoteId = note.id
    nextBeat = fracAdd(nextBeat, durationToFraction(duration, dots))
  }

  dbg('Placed spanning note with tie:', {
    head: p.existingHeadId ?? firstNote?.id, currentDurations: currentMeasureDurations,
    nextMeasure: nextMeasureNumber, nextDurations: nextMeasureDurations,
  })
  return firstNote
}

/** Extend the score with empty measures until `measureNumber` exists. */
function ensureMeasureExists(model: SpanningNoteModel, measureNumber: number): boolean {
  let attempts = MAX_MEASURE_CREATE_ATTEMPTS
  while (!model.getMeasure(measureNumber) && attempts-- > 0) {
    model.addMeasure()
  }
  return !!model.getMeasure(measureNumber)
}

/**
 * Split an existing note with a tie when its duration changes to overflow.
 * Thin wrapper: reuses the note as the chain head via {@link placeSpanningNote}.
 */
export function splitExistingNoteWithTie(model: SpanningNoteModel, existingNote: Note, newDuration: NoteParams['duration'], overflowAmount: number, newDots: number = 0): void {
  placeSpanningNote(model, {
    step: existingNote.step,
    alter: existingNote.alter,
    octave: existingNote.octave,
    startMeasure: existingNote.measure,
    startBeat: existingNote.beat,
    totalBeats: durationToBeats(newDuration, newDots),
    overflowAmount,
    voice: existingNote.voice,
    staff: existingNote.staff,
    existingHeadId: existingNote.id,
  })
}

/**
 * Add a note that spans across a bar line by splitting it with a tie.
 * Thin wrapper: creates a fresh chain head via {@link placeSpanningNote}.
 * Returns the first note (in the current measure) or null if failed.
 */
export function addSplitNoteWithTie(model: SpanningNoteModel, noteParams: NoteParams, overflowAmount: number): Note | null {
  return placeSpanningNote(model, {
    step: noteParams.step,
    alter: noteParams.alter,
    octave: noteParams.octave,
    startMeasure: noteParams.measure,
    startBeat: noteParams.beat,
    totalBeats: durationToBeats(noteParams.duration, noteParams.dots || 0),
    overflowAmount,
    voice: noteParams.voice,
    staff: noteParams.staff,
    // An ENTERED mark reaches every piece too — the same rule the existing head's mark follows.
    tremolo: noteParams.tremolo,
  })
}

/**
 * Erode all notes in the overflow zone of the next measure.
 * Notes fully within [0, overflowBeats) are deleted.
 * Notes that straddle the boundary are trimmed and moved to start at overflowBeats.
 * Notes with a downstream tiedTo are deleted (punt case).
 */
export function erodeOverflowZone(
  model: SpanningNoteModel, measureNumber: number, overflowBeats: number, voice: number = 0, staff: number = 0,
  /** Notes the erosion must leave alone — the arriving chord's own continuations. */
  spare: (note: Note) => boolean = () => false,
): void {
  const epsilon = 0.001
  const notes = model.getNotesInMeasure(measureNumber)
  for (const note of notes) {
    if (note.isRest) continue
    // Only erode the overflowing note's own voice/staff — other streams are independent.
    if (voiceOf(note) !== voice) continue
    if (staffOf(note) !== staff) continue
    if (spare(note)) continue
    const noteBeat = fracToNumber(note.beat)
    if (noteBeat >= overflowBeats - epsilon) continue
    erodeNoteAtBoundary(model, note, overflowBeats)
  }
}

/**
 * Erode a single note that starts within the overflow zone.
 * - Fully consumed (noteEnd <= overflowBeats): break upstream tiedFrom, delete.
 * - Straddles (noteEnd > overflowBeats, no tiedTo): trim duration and move to overflowBeats.
 *   If the remainder needs multiple durations, build a tie chain for the tail.
 * - Has tiedTo (downstream chain): delete (punt case — too complex to rewire).
 */
function erodeNoteAtBoundary(model: SpanningNoteModel, note: Note, overflowBeats: number): void {
  const epsilon = 0.001
  const noteBeat = fracToNumber(note.beat)
  const noteDurBeats = durationToBeats(note.duration, note.dots ?? 0)
  const noteEnd = noteBeat + noteDurBeats

  if (noteEnd <= overflowBeats + epsilon) {
    // Fully consumed — break upstream tie pointer then delete
    if (note.tiedFrom) {
      model.updateNote(note.tiedFrom, { tiedTo: undefined })
    }
    model.deleteNote(note.id)
    return
  }

  // Straddles boundary — punt to deletion if note has a downstream tie chain
  if (note.tiedTo) {
    model.deleteNote(note.id)
    return
  }

  // Trim: remainder starts at overflowBeats
  const remainderBeats = noteEnd - overflowBeats
  const remainderDurations = splitBeatsIntoLengths(remainderBeats)
  if (remainderDurations.length === 0) {
    model.deleteNote(note.id)
    return
  }

  // Break incoming tie
  if (note.tiedFrom) {
    model.updateNote(note.tiedFrom, { tiedTo: undefined })
  }

  // Update the note: first remainder length, moved to overflowBeats
  model.updateNote(note.id, {
    duration: remainderDurations[0].duration,
    dots: remainderDurations[0].dots,
    beat: beatToFrac(overflowBeats),
    tiedFrom: undefined,
  })

  // Build tie chain for any additional remainder lengths
  if (remainderDurations.length > 1) {
    let prevId = note.id
    let currentBeat = fracAdd(beatToFrac(overflowBeats), durationToFraction(remainderDurations[0].duration, remainderDurations[0].dots))
    for (let i = 1; i < remainderDurations.length; i++) {
      const { duration, dots } = remainderDurations[i]
      const tailNote = model.addNote({
        step: note.step,
        alter: note.alter,
        octave: note.octave,
        duration,
        dots,
        measure: note.measure,
        beat: currentBeat,
        ...(note.voice && { voice: note.voice }),
        ...(note.staff && { staff: note.staff }),
      })
      model.updateNote(prevId, { tiedTo: tailNote.id })
      model.updateNote(tailNote.id, { tiedFrom: prevId })
      prevId = tailNote.id
      currentBeat = fracAdd(currentBeat, durationToFraction(duration, dots))
    }
  }
}

/**
 * Split every head of a CHORD across the barline — the heads share one length, so they cross
 * together. Each head's pieces are spared by the next head's erosion (see `placeSpanningNote`).
 */
export function splitChordWithTie(model: SpanningNoteModel, heads: readonly Note[], newDuration: NoteParams['duration'], overflowAmount: number, newDots: number = 0): void {
  for (const head of heads) splitExistingNoteWithTie(model, head, newDuration, overflowAmount, newDots)
}
