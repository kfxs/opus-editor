/**
 * ⭐ **WHICH NOTES DID THE USER MEAN?** — the question every span mark's creation starts with: a
 * slur, a hairpin, a trill, an octave line and a pedal are each made "over the selection", and the
 * selection is a bag of note ids in click order, possibly across voices and staves.
 *
 * One answer, where `MusicEngine` held five copies of it (docs/code-shape-plan-2026-09-19.md,
 * Phase 4.1): resolve the ids, keep the LANE of the first one, order what is left the way the music
 * reads. What is then BUILT from the two ends is each family's own.
 *
 * ⭐ **The lane is the first resolved note's**, so a voice-2 selection makes a voice-2 mark. `byVoice`
 * says how wide a lane is: a mark that belongs to one voice's notes (slur, hairpin, trill) narrows
 * to (staff, voice); one that governs the STAFF (ottava, pedal) narrows to the staff alone — an
 * octave line over two voices of one staff is ONE line, and narrowing would silently leave half the
 * selection sounding where it was. Notes on other staves are dropped either way.
 *
 * ⛔ `sounding` refuses RESTS as candidates: a wedge, a trill, an octave line and a pedal all act on
 * sounding music, and the engine resolves by slot, so it would happily anchor one to silence. A slur
 * may end on a rest's slot, so it asks for them.
 */
import type { Note } from '@/types/music'
import { staffOf, voiceOf } from '@/utils/lanes'
import { compareByPosition } from '@/utils/musicUtils'

/** What the question needs of the score — `ScoreModel` answers both. */
export interface SpanNoteSource {
  getNote(id: string): Note | undefined
  /** A fanned MEMBER's index in its group, or null. Members share their event's (measure, beat), so
   *  position alone cannot order them. */
  fanMemberIndexOf(noteId: string): number | null
}

export interface SpanFromNotes {
  /** The lane's notes in reading order — never empty. */
  notes: Note[]
  start: Note
  /** The last of them — `start` itself when only one note is in the lane. */
  end: Note
  staff: number
  voice: ReturnType<typeof voiceOf>
}

/**
 * ⭐ Order two notes for a SPAN — by position, and INSIDE a fan by member index.
 *
 * ⚠️ Position alone cannot order members: every one reports the SLOT's beat (deliberately — that is
 * what keeps `pixelXToBeat` seeing one column), so `compareByPosition` calls them simultaneous and
 * the sort keeps whatever order they were CLICKED in. A slur built from that is drawn backwards —
 * right head to left head — and only when you happened to select the later member first.
 */
export function compareForSpan(source: SpanNoteSource, a: Note, b: Note): number {
  const byPosition = compareByPosition(a, b)
  if (byPosition !== 0) return byPosition
  const ia = source.fanMemberIndexOf(a.id)
  const ib = source.fanMemberIndexOf(b.id)
  return ia !== null && ib !== null ? ia - ib : 0
}

/** @returns null when no id resolves to a usable note. */
export function spanFromNotes(
  source: SpanNoteSource,
  noteIds: readonly string[],
  lane: { byVoice: boolean; sounding: boolean },
): SpanFromNotes | null {
  const resolved = noteIds
    .map(id => source.getNote(id))
    .filter((n): n is Note => !!n && !(lane.sounding && n.isRest))
  if (resolved.length === 0) return null

  const staff = staffOf(resolved[0])
  const voice = voiceOf(resolved[0])
  const notes = resolved
    .filter(n => staffOf(n) === staff && (!lane.byVoice || voiceOf(n) === voice))
    .sort((a, b) => compareForSpan(source, a, b))
  return { notes, start: notes[0], end: notes[notes.length - 1], staff, voice }
}
