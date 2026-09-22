/**
 * ⭐ **WHICH NOTES DID THE USER MEAN?** — the question every span mark's creation starts with: a
 * slur, a hairpin, a trill, an octave line and a pedal are each made "over the selection", and the
 * selection is a bag of note ids in click order, possibly across voices and staves.
 *
 * One answer, where `MusicEngine` held five copies of it (docs/plans/code-shape-plan-2026-09-19.md,
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
import type { GraceSide, Note, Score } from '@/types/music'
import { staffOf, voiceOf } from '@/utils/lanes'
import { findSlot } from './slotLookup'
import { graceGroupOf } from '@/utils/graceNotes'
import { fracEq } from '@/utils/fraction'
import { compareByPosition } from '@/utils/musicUtils'

/** What the question needs of the score — `ScoreModel` answers both. */
export interface SpanNoteSource {
  getNote(id: string): Note | undefined
  /** A fanned MEMBER's index in its group, or null. Members share their event's (measure, beat), so
   *  position alone cannot order them. */
  fanMemberIndexOf(noteId: string): number | null
  /** ⭐ The score, when there is one — how a GRACE is recognised (a spec's fake may omit it: no graces). */
  getScore?(): Score
}

/** Where a GRACE pitch stands: its side, its place in the group, and the ids around it. */
interface GracePlace {
  side: GraceSide
  index: number
  /** The first pitch of the grace AFTER it in its group, if any. */
  nextId: string | undefined
  /** The main note it belongs to — its chord's first pitch, or the REST it waits on (D7 reversed). */
  hostId: string
}

/** A grace pitch's place, or null for any other id. */
function graceAt(source: SpanNoteSource, noteId: string): GracePlace | null {
  const score = source.getScore?.()
  if (!score) return null
  const found = findSlot(score, noteId, { graceNotes: true })
  if (!found?.grace) return null
  const slot = found.type === 'chord' ? found.chord : found.rest
  const group = graceGroupOf(slot, found.grace.side)
  const hostId = found.type === 'chord' ? found.chord.notes[0]?.id ?? noteId : found.rest.id
  return { side: found.grace.side, index: found.grace.index, nextId: group?.notes[found.grace.index + 1]?.pitches[0]?.id, hostId }
}

/** At ONE beat, the reading order: the graces before (in their order), the note, the graces after. */
function graceRank(source: SpanNoteSource, noteId: string): number {
  const g = graceAt(source, noteId)
  return g ? (g.side === 'before' ? -1000 + g.index : 1000 + g.index) : 0
}

/** …and what walking ON from a note needs besides. */
export interface SlotWalkSource extends SpanNoteSource {
  getAllNotes(): Note[]
  /** The members of the fanned group `noteId` belongs to (the typed note is member 0), or null. */
  fanMembersOfSlot(noteId: string): Note[] | null
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
  // ⭐ A GRACE reports its main note's beat (it has none of its own): at one beat it reads BEFORE the
  //    note (a grace before) or after it (a grace after) — or a slur over grace + note is drawn backwards.
  const byGrace = graceRank(source, a.id) - graceRank(source, b.id)
  if (byGrace !== 0) return byGrace
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

/**
 * The next slot after `start` whose `(measure, beat)` differs from it — i.e. the
 * next musical event, skipping sibling chord heads that share `start`'s beat.
 * `getAllNotes()` emits one entry per pitch, hence the dedupe.
 */
export function nextDistinctSlot(source: SlotWalkSource, start: Note): Note | undefined {
  // ⭐ Inside a FAN, "the next thing" is the next MEMBER (his ask).
  //
  // ⚠️ Including from the note you TYPED — it is member 0, not a thing standing outside the group,
  // so `s` on it slurs to member 1. (I first restricted this to members proper, reasoning that the
  // typed note means "the whole event"; it does not, once you are working member by member.) To
  // slur a fan to something outside it, select BOTH ends — that path never asks this question.
  let walkFromId = start.id
  // ⭐ From a GRACE, "the next thing" is the next grace of its group, else what it leads into: a grace
  //    BEFORE → its main note (`s` on a lone grace slurs it to its note — the grace slur); a grace AFTER →
  //    on from its note's slot. Graces are not in `getAllNotes`, so this is the only way on from one.
  const grace = graceAt(source, start.id)
  if (grace) {
    if (grace.nextId) return source.getNote(grace.nextId)
    if (grace.side === 'before') return source.getNote(grace.hostId)
    walkFromId = grace.hostId
  }
  const group = source.fanMembersOfSlot(start.id)
  if (group) {
    const at = source.fanMemberIndexOf(start.id) ?? -1
    if (at >= 0 && at + 1 < group.length) return group[at + 1]
    // The LAST member slurs OUT of the fan — and it has to walk on from the SLOT, since the flat
    // note list has no entry for a member to find itself in.
    walkFromId = group[0]?.id ?? start.id
  }
  // Stay within the start note's own voice AND staff — a slur's end anchor must be the
  // next slot in the SAME stream, not whatever event comes next in another voice/staff.
  const startVoice = voiceOf(start)
  const startStaff = staffOf(start)
  const sorted = source.getAllNotes()
    .filter(n => voiceOf(n) === startVoice && staffOf(n) === startStaff)
    .sort(compareByPosition)
  const idx = sorted.findIndex(n => n.id === walkFromId)
  if (idx < 0) return undefined
  for (let i = idx + 1; i < sorted.length; i++) {
    if (sorted[i].measure !== start.measure || !fracEq(sorted[i].beat, start.beat)) return sorted[i]
  }
  return undefined
}
