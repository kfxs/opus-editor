/**
 * ⭐ **MAKING A TUPLET OUT OF AN ENTRY** — a fresh tuplet with its first note
 * ({@link buildTupletWithFirstNote}, the mouse's and the keyboard's create), an existing note or
 * rest turned into one ({@link applyTupletToNote}), and the guard all three share: a tuplet must
 * FIT its bar ({@link tupletFitsBar}). Score logic, moved out of `NoteEntryCoordinator`
 * (docs/plans/code-shape-plan-2026-09-19.md, Phase 4.2d): the coordinator keeps pixel resolution and the
 * commit — each function answers null when nothing was written, and the caller commits otherwise.
 *
 * And entering INTO one that exists: the keyboard CLAMPS the written length to what the group has
 * left ({@link clampToTupletRemainder}); the mouse lands the note at the group's FILL POINTER
 * ({@link landInTuplet}). ⚠️ Two behaviours, moved as they were.
 *
 * What a tuplet IS — its span, its slots, the filler rests — stays `tupletOps`; this is the ENTRY
 * that stands on it.
 */
import type { Measure, Note, NoteDuration, NoteParams, PitchSpelling, Tuplet, TupletFormat } from '@/types/music'
import { dbg } from '@/utils/debug'
import { durationToFraction, writtenLength } from '@/utils/durations'
import type { Fraction } from '@/utils/fraction'
import { fracAdd, fracDiv, fracGt, fracLte, fracMul, fracSub, fracToNumber } from '@/utils/fraction'
import { staffOf, voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { beatToFrac, splitBeatsIntoDurations, tupletScale, tupletSpan, tupletWrittenDuration } from '@/utils/musicUtils'

/** What tuplet entry needs of the score — `ScoreModel` answers all of it. */
export interface TupletEntryModel {
  getMeasure(measureNumber: number): Measure | undefined
  getNote(id: string): Note | undefined
  getNotesInMeasure(measureNumber: number): Note[]
  getNotesInTuplet(tupletId: string): Note[]
  addNote(params: NoteParams): Note
  tupletSpanOverlaps(measureNumber: number, startBeat: Fraction, totalBeats: Fraction, voice: number, staff?: number): boolean
  createTuplet(
    measureNumber: number, startBeat: Fraction, baseDuration: NoteDuration, numNotes?: number, notesOccupied?: number,
    voice?: number, staff?: number, baseDots?: number,
    normal?: { duration: NoteDuration; dots?: number; count?: number }, format?: TupletFormat,
  ): Tuplet
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet, voice?: number): void
}

/**
 * Does a tuplet of `span` actual beats starting at `beat` fit inside the bar?
 *
 * A tuplet CANNOT cross a barline — it is a local re-division of one bar's time — and nothing was
 * checking it. The span is the trap: a triplet of HALVES is three notes in the time of TWO HALVES,
 * i.e. four quarter-beats, so from beat 2 of 4/4 it runs to beat 6 and the bar quietly held six
 * beats (reported). The written duration ('h') looks like it fits; the ACTUAL span is what counts.
 *
 * Refusing is the answer for now, over re-scaling the tuplet to something that does fit: a triplet
 * that silently became a different triplet is a worse surprise than one that did not appear.
 */
export function tupletFitsBar(model: Pick<TupletEntryModel, 'getMeasure'>, measureNumber: number, beat: Fraction, span: Fraction): boolean {
  const measure = model.getMeasure(measureNumber)
  if (!measure) return false
  return fracLte(fracAdd(beat, span), measureCapacityFrac(measure))
}

/**
 * Convert an existing selected note or rest into the first element of a tuplet.
 * Used when the user presses the tuplet button in selection mode with a note/rest selected.
 */
export function applyTupletToNote(
  model: TupletEntryModel,
  noteId: string,
  numNotes: number = 3,
  notesOccupied: number = 2
): { tuplet: Tuplet; note: Note } | null {
  // No `baseDots` parameter: the unit IS the selected note, so its dots are the tuplet's dots.
  // Reading them off the note is what keeps the span and the note's own value from disagreeing.
  const note = model.getNote(noteId)
  if (!note || note.tupletId) return null

  // The tuplet inherits the selected note's voice AND staff (a tuplet is a
  // single-voice run on one staff). Reject if any same-voice, same-staff tuplet
  // already overlaps the span the new tuplet would occupy (not just the exact start beat).
  const voice = voiceOf(note)
  const staff = staffOf(note)
  // The shape the tuplet WILL have, built before it exists so the span is computed by the same
  // rule the stored tuplet will use. Both sides are the note's own value here — turning a note
  // into a tuplet cannot say "in the time of" something else.
  const shape = { numNotes, notesOccupied, baseDuration: note.duration, baseDots: note.dots }
  const applySpan = tupletSpan(shape)
  if (model.tupletSpanOverlaps(note.measure, note.beat, applySpan, voice, staff)) return null

  // …and it has to FIT (see tupletFitsBar). Nothing checked this: the bar went overfull.
  if (!tupletFitsBar(model, note.measure, note.beat, applySpan)) {
    dbg(`✗ Tuplet refused: ${numNotes}-in-${notesOccupied} of ${note.duration} needs ${fracToNumber(applySpan).toFixed(3)} beat(s) from b${fracToNumber(note.beat).toFixed(3)}, past the end of m${note.measure}`)
    return null
  }

  // createTuplet removes overlapping slots (same voice + staff only); places no initial rests
  const tuplet = model.createTuplet(note.measure, note.beat, note.duration, numNotes, notesOccupied, voice, staff, note.dots ?? 0)
  const actualDuration = tupletWrittenDuration(shape, note.duration, note.dots ?? 0)

  let resultNote: Note
  if (note.isRest) {
    // Tuplet starts empty — refill will place the full-span filler rest
    model.refillTupletRemainder(note.measure, tuplet, voice)
    const rests = model.getNotesInTuplet(tuplet.id)
    resultNote = rests[0]
    if (!resultNote) return null
  } else {
    // Place the original note as the first tuplet note, then fill remainder
    resultNote = model.addNote({
      step: note.step,
      alter: note.alter,
      octave: note.octave,
      duration: note.duration,
      measure: note.measure,
      beat: tuplet.startBeat,
      tupletId: tuplet.id,
      actualDuration,
      ...(voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}),
      ...(staff ? { staff } : {}),
      ...(note.stemDirection && { stemDirection: note.stemDirection }),
    })
    model.refillTupletRemainder(note.measure, tuplet, voice)
  }

  return { tuplet, note: resultNote }
}

/**
 * Create a tuplet and place the first note (or chord with an existing note).
 * Shared by createTupletAtPosition and createTupletAtBeat.
 */
export function buildTupletWithFirstNote(
  model: TupletEntryModel,
  measureNumber: number,
  beat: number,
  duration: NoteDuration,
  spelling: PitchSpelling,
  numNotes: number,
  notesOccupied: number,
  voice: number = 0,
  staff: number = 0,
  dots: number = 0,
  normal?: { duration: NoteDuration; dots?: number; count?: number },
/** How the group is DRAWN — mark style, bracket, bracket end. Absent, and every field inside it
 *  absent, means "the renderer's own rules". See {@link TupletFormat}. */
format?: TupletFormat,
): { tuplet: Tuplet; firstNote: Note } | null {
  // Refuse to create a tuplet whose span would overlap an existing same-voice,
  // same-staff tuplet. Two overlapping tuplets in one voice corrupt entry: a beat
  // inside both resolves ambiguously and notes/rests get pulled into the wrong one.
  const beatFracGuard = beatToFrac(beat)
  // Built before the tuplet exists, so the guards below measure exactly what will be stored.
  const shape = {
    numNotes, notesOccupied, baseDuration: duration, baseDots: dots,
    ...(normal && { normalDuration: normal.duration, normalDots: normal.dots, normalCount: normal.count }),
  }
  const newSpan = tupletSpan(shape)
  if (model.tupletSpanOverlaps(measureNumber, beatFracGuard, newSpan, voice, staff)) {
    dbg(`✗ Tuplet not created: span overlaps an existing v${voice} s${staff} tuplet`)
    return null
  }
  // …and it has to FIT. The check lived only on the mouse path (createTupletAtPosition) and the
  // apply path, so the KEYBOARD could write a tuplet straight past the barline — 3:2 of halves is
  // four beats, and of dotted halves six. Here it covers all three callers at once.
  if (!tupletFitsBar(model, measureNumber, beatFracGuard, newSpan)) {
    dbg(`✗ Tuplet refused: ${numNotes}:${notesOccupied} of ${duration}${'.'.repeat(dots)} needs ${fracToNumber(newSpan).toFixed(3)} beat(s) from b${beat}, past the end of m${measureNumber}`)
    return null
  }

  const voiceParam = voice ? { voice: voice as 0 | 1 | 2 | 3 } : {}
  const staffParam = staff ? { staff } : {}
  // Save any existing same-voice, same-staff note at the start position before createTuplet deletes it
  const existingNoteAtStart = model.getNotesInMeasure(measureNumber)
    .find(n => !n.isRest && !n.tupletId && voiceOf(n) === voice && staffOf(n) === staff && Math.abs(fracToNumber(n.beat) - beat) < 0.001)
  const existingNoteData = existingNoteAtStart
    ? { step: existingNoteAtStart.step, alter: existingNoteAtStart.alter, octave: existingNoteAtStart.octave }
    : null

  // Create the tuplet (removes overlapping same-voice + same-staff slots, places no initial rests)
  const beatFrac = beatToFrac(beat)
  const tuplet = model.createTuplet(measureNumber, beatFrac, duration, numNotes, notesOccupied, voice, staff, dots, normal, format)
  const actualDuration = tupletWrittenDuration(shape, duration, dots)

  let firstNote: Note

  if (existingNoteData) {
    // Re-add the pre-existing note as chord member, then add new note
    model.addNote({
      step: existingNoteData.step,
      alter: existingNoteData.alter,
      octave: existingNoteData.octave,
      duration,
      // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
      // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
      // that is a third too long.
      ...(dots ? { dots } : {}),
      measure: measureNumber,
      beat: beatFrac,
      tupletId: tuplet.id,
      actualDuration,
      ...voiceParam,
      ...staffParam,
    })
    firstNote = model.addNote({
      step: spelling.step,
      alter: spelling.alter,
      octave: spelling.octave,
      duration,
      // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
      // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
      // that is a third too long.
      ...(dots ? { dots } : {}),
      measure: measureNumber,
      beat: beatFrac,
      tupletId: tuplet.id,
      actualDuration,
      ...voiceParam,
      ...staffParam,
    })
  } else {
    firstNote = model.addNote({
      step: spelling.step,
      alter: spelling.alter,
      octave: spelling.octave,
      duration,
      // The unit's dots ride on every note written in it — a dotted-quarter triplet is three
      // DOTTED quarters, and a bare `duration` here would draw three plain ones over a span
      // that is a third too long.
      ...(dots ? { dots } : {}),
      measure: measureNumber,
      beat: beatFrac,
      tupletId: tuplet.id,
      actualDuration,
      ...voiceParam,
      ...staffParam,
    })
  }

  model.refillTupletRemainder(measureNumber, tuplet, voice)
  return { tuplet, firstNote }
}

/**
 * The KEYBOARD's entry into a tuplet: clamp the written duration to what the group has left from
 * the entry's beat. If the selected duration would overflow the tuplet, silently use the largest
 * standard duration that fits instead — same behaviour as Sibelius. @returns the params to enter
 * (unchanged when they fit), or null when nothing fits.
 */
export function clampToTupletRemainder(params: NoteParams, tuplet: Tuplet): NoteParams | null {
  const ratio = tupletScale(tuplet)
  const tupletEnd = fracAdd(tuplet.startBeat, tupletSpan(tuplet))
  const remainingActual = fracSub(tupletEnd, params.beat)
  const noteActual = fracMul(writtenLength(params), ratio)
  if (!fracGt(noteActual, remainingActual)) return params
  // ÷ the tuplet's own ratio, NOT × N/M. They agree for an ordinary tuplet and part company
  // the moment the two sides carry different note values: "2 quarters in the time of 3
  // eighths" has N/M = 1 while its real scale is 3/4, and clamping by the wrong one computes a
  // written duration a quarter too short. `tupletScale` is the ratio; nothing else is.
  // Float only at the very end, because `splitBeatsIntoDurations` takes a number.
  const maxWritten = fracToNumber(fracDiv(remainingActual, ratio))
  const fitting = splitBeatsIntoDurations(maxWritten)
  if (fitting.length === 0) return null
  dbg(`[Tuplet] duration clamped: ${params.duration} → ${fitting[0]} (remaining actual: ${fracToNumber(remainingActual).toFixed(4)})`)
  return { ...params, duration: fitting[0], dots: 0 }
}

/**
 * The MOUSE's entry into a tuplet: WHERE a clicked note lands in the group.
 *
 * - A note LARGER than the whole tuplet deletes the tuplet and lands at its start, as a plain note
 *   (`tupletId` absent).
 * - Otherwise it lands at the group's FILL POINTER — the end of its last real note — wherever in
 *   the group the click fell; null when what is left from there cannot hold it.
 *
 * `reason` is the suffix for the entry's decision log.
 */
export function landInTuplet(
  model: Pick<TupletEntryModel, 'getNotesInMeasure'> & { deleteTuplet(tupletId: string): boolean },
  measureNumber: number, tuplet: Tuplet, duration: NoteDuration, dots?: number,
): { beat: Fraction; tupletId?: string; reason: string } | null {
  const selectedDurationFrac = durationToFraction(duration, dots)
  const tupletTotalBeatsFrac = tupletSpan(tuplet)
  const tupletEndBeat = fracAdd(tuplet.startBeat, tupletTotalBeatsFrac)

  // Compute fill pointer: end of last real note in the tuplet
  const ratio = tupletScale(tuplet)
  const realNotes = model.getNotesInMeasure(measureNumber)
    .filter(n => n.tupletId === tuplet.id && !n.isRest)
    .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
  let fillPointer: Fraction
  if (realNotes.length === 0) {
    fillPointer = tuplet.startBeat
  } else {
    const last = realNotes[realNotes.length - 1]
    const lastActual = last.actualDuration
      ?? fracMul(writtenLength(last), ratio)
    fillPointer = fracAdd(last.beat, lastActual)
  }

  // Case 1: Note larger than entire tuplet → delete tuplet, place at start
  if (fracGt(selectedDurationFrac, tupletTotalBeatsFrac)) {
    model.deleteTuplet(tuplet.id)
    return { beat: tuplet.startBeat, reason: ` → tuplet deleted (note too large), beat adjusted to ${fracToNumber(tuplet.startBeat).toFixed(3)}` }
  }

  // Case 2: Check if note fits in remaining space (from fill pointer to tuplet end)
  const remainingActual = fracSub(tupletEndBeat, fillPointer)
  const scaledNoteDurationFrac = tupletWrittenDuration(tuplet, duration, dots ?? 0)
  if (fracGt(scaledNoteDurationFrac, remainingActual)) {
    dbg(`Note rejected: scaled duration (${fracToNumber(scaledNoteDurationFrac).toFixed(3)}) exceeds remaining tuplet space (${fracToNumber(remainingActual).toFixed(3)})`)
    return null
  }
  // Note fits — place at fill pointer
  return { beat: fillPointer, tupletId: tuplet.id, reason: ` → tuplet fill@${fracToNumber(fillPointer).toFixed(3)}` }
}
