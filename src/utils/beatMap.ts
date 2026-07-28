import type { Note, Score, Fraction } from '../types/music'
import { fracCompare } from '../utils/fraction'
import { getMeasureNotes, measureFanMemberNotes } from '../utils/musicUtils'
import { spellingToMidi } from '../utils/pitchSpelling'
import { staffOf, voiceOf } from '../utils/lanes'

/**
 * A note augmented with its parent measure number (for cross-measure sorting).
 */
export type FlatNote = Note & { measureNumber: number }

/**
 * Builds two related structures from a Score for beat-level navigation:
 *
 * - `allFlat`: every note/rest in the score, sorted by measure then beat.
 * - `beats`: one representative entry per (measure, beat) position.
 *   Preference order: non-rest over rest; among non-rests, lowest pitch.
 *   This collapses chords into a single entry so horizontal navigation
 *   moves between beats, not between individual chord notes.
 *
 * @param voice - When given, restrict to that model voice's stream (0-based), so
 *   keyboard nav/entry steps within a single voice. Omit for all voices.
 * @param staff - When given, restrict to that model staff (0-based index; absent = staff 0),
 *   so nav/entry stays within one staff — the vertical staff axis is a hard boundary, unlike
 *   voice. Omit for all staves.
 */
export function buildBeatMap(score: Score, voice?: number, staff?: number): { allFlat: FlatNote[]; beats: FlatNote[] } {
  const allFlat: FlatNote[] = score.measures
    .flatMap(m => getMeasureNotes(m, score).map(n => ({ ...n, measureNumber: m.number })))
    .filter(n => voice === undefined || voiceOf(n) === voice)
    .filter(n => staff === undefined || staffOf(n) === staff)
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : fracCompare(a.beat, b.beat),
    )

  return { allFlat, beats: collapseToBeats(allFlat) }
}

/**
 * Beat map for selection-tool arrow navigation, with a PER-MEASURE voice fallback:
 * use the requested voice in measures that contain it, but fall back to voice 0 (the
 * default voice) in measures that don't. This keeps horizontal nav alive when stepping
 * out of the last note of a non-default voice into a measure that has no slot for it —
 * instead of the selection vanishing (or skipping to a far-off measure that happens to
 * carry the voice), it lands on voice 0 of the next measure, as expected.
 *
 * (Note ENTRY navigation deliberately does NOT use this — there you stay in your own
 * voice to extend its stream; see navBeatMap.)
 */
export function buildVoiceNavBeatMap(score: Score, voice: number, staff?: number): { allFlat: FlatNote[]; beats: FlatNote[] } {
  const allFlat: FlatNote[] = score.measures
    .flatMap(m => {
      // Staff is a HARD boundary (no per-measure fallback like voice): filter to the staff
      // first, then apply the voice fallback WITHIN that staff's notes.
      // ⭐ The fan's MEMBERS are stops too — each sounds at its own moment inside the slot, so the
      // arrows walking time walk through them (docs/fanned-beam-pitches-plan.md). They are added
      // HERE and not in `buildBeatMap`: that map drives note ENTRY, and a member is not a position
      // you can type a note at.
      const notes = [...getMeasureNotes(m, score), ...measureFanMemberNotes(m, score)]
        .filter(n => staff === undefined || staffOf(n) === staff)
      const hasVoice = notes.some(n => voiceOf(n) === voice)
      const useVoice = hasVoice ? voice : 0
      return notes
        .filter(n => voiceOf(n) === useVoice)
        .map(n => ({ ...n, measureNumber: m.number }))
    })
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : fracCompare(a.beat, b.beat),
    )

  return { allFlat, beats: collapseToBeats(allFlat) }
}

/**
 * Collapse a sorted flat note list to one representative entry per (measure, beat):
 * non-rest over rest, and among non-rests the lowest pitch. Chords thus reduce to a
 * single horizontal step. Key uses num/den so {1,3} and {2,6} reduce to the same key.
 */
function collapseToBeats(allFlat: FlatNote[]): FlatNote[] {
  const beatMap = new Map<string, FlatNote>()
  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat.num}/${n.beat.den}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || spellingToMidi(n.step!, n.alter!, n.octave!) < spellingToMidi(existing.step!, existing.alter!, existing.octave!))) {
      // Prefer non-rest; among non-rests prefer the lowest pitch
      beatMap.set(key, n)
    }
  }
  return Array.from(beatMap.values())
}

/**
 * Pick the beat map for keyboard navigation/entry: the active voice's stream when
 * the cursor note belongs to it (so stepping stays within that voice), otherwise the
 * whole score. The fallback covers the moment just after switching voices, when the
 * cursor still sits on another voice's note and the new voice has no slot there yet.
 */
export function navBeatMap(
  score: Score,
  currentNoteId: string | null,
  voice: number,
  staff?: number,
): { allFlat: FlatNote[]; beats: FlatNote[] } {
  const scoped = buildBeatMap(score, voice, staff)
  if (currentNoteId && scoped.allFlat.some(n => n.id === currentNoteId)) return scoped
  // Voice fallback (cursor still on another voice's note) stays scoped to the staff — a
  // fresh entry never hops staves.
  return buildBeatMap(score, undefined, staff)
}

/** The (measure, beat) position key for a flat note — same form buildBeatMap keys by. */
function posKey(n: FlatNote): string {
  return `${n.measureNumber}:${n.beat.num}/${n.beat.den}`
}

/**
 * The beat map SELECTION works on: every note/rest **plus every fanned member**, each at the beat
 * it sounds on.
 *
 * ⭐ The third map, and the members are the whole reason it exists. A member is a note on the page
 * with a head, a stem and an id of its own — Ctrl-click has always been able to pick one — so a
 * gesture that selects "everything between here and there" has to be able to see one. It could not:
 * {@link notesInBox} was built on {@link buildBeatMap}, which is `getMeasureNotes` alone, so
 * Shift-clicking a member either failed to extend (the member was invisible, leaving the box on the
 * anchor) or, when BOTH ends were members, found no endpoints at all and **cleared the selection**.
 *
 * ⛔ Not fixable by teaching `buildBeatMap` about members, and not an oversight there: that map
 * drives note ENTRY, and a member is not a position you can type a note at (see the ⭐ on
 * {@link buildVoiceNavBeatMap}, which adds them for the same reason this does — arrow navigation
 * walks time, and a member is a moment in it). `getMeasureNotes` has two dozen callers and every one
 * of them would silently gain N notes per fan; the rule this follows is `measureFanMemberNotes`'s
 * own — a caller that MEANS members asks for them by name.
 */
export function buildSelectionBeatMap(score: Score): { allFlat: FlatNote[]; beats: FlatNote[] } {
  const allFlat: FlatNote[] = score.measures
    .flatMap(m => [...getMeasureNotes(m, score), ...measureFanMemberNotes(m, score)]
      .map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : fracCompare(a.beat, b.beat),
    )

  return { allFlat, beats: collapseToBeats(allFlat) }
}

/**
 * Every note/rest id inside the RECTANGULAR bounding box that encloses a set of already-
 * selected ids PLUS a new target — the beat extent [min…max] × the staff extent [min…max]
 * of all those endpoints. Used by additive Shift-click: each click grows the box (it can
 * only expand), and the whole rectangle is (re)selected — so a passage that spans two staves
 * fills in every note in between rather than leaving a jagged staircase, and successive
 * clicks keep accumulating without ever dropping notes. Whole chords + interior rests are
 * included (they share an in-range position). Falls back to just the target when nothing is
 * locatable.
 *
 * Fanned members are in the box like anything else — see {@link buildSelectionBeatMap}. Their beats
 * are arbitrary rationals (8/15 of a beat is an ordinary answer), which costs this nothing: the box
 * is an index range over sorted POSITIONS, and it never turns one back into a duration.
 */
export function notesInBox(score: Score, currentIds: string[], targetId: string): string[] {
  const { allFlat, beats } = buildSelectionBeatMap(score)
  const byId = new Map(allFlat.map(n => [n.id, n]))
  const endpoints = [...currentIds, targetId].map(id => byId.get(id)).filter(Boolean) as FlatNote[]
  if (!endpoints.length) return byId.has(targetId) ? [targetId] : []

  let idxLo = Infinity, idxHi = -Infinity, staffLo = Infinity, staffHi = -Infinity
  for (const n of endpoints) {
    const i = beats.findIndex(b => posKey(b) === posKey(n))
    if (i < 0) continue
    idxLo = Math.min(idxLo, i); idxHi = Math.max(idxHi, i)
    staffLo = Math.min(staffLo, staffOf(n)); staffHi = Math.max(staffHi, staffOf(n))
  }
  if (idxHi < 0) return byId.has(targetId) ? [targetId] : []

  const rangeKeys = new Set(beats.slice(idxLo, idxHi + 1).map(posKey))
  return allFlat
    .filter(n => rangeKeys.has(posKey(n)) && staffOf(n) >= staffLo && staffOf(n) <= staffHi)
    .map(n => n.id)
}

/**
 * Dynamic ids sitting inside the rectangular box a Shift-click builds over `noteIds` — the
 * (measure, beat) extent × the staff extent of those notes. A box that encloses notes should
 * also grab the dynamics under them so Shift-selection highlights them too. A dynamic is IN the
 * box when its temporal position lies within `[firstNote…lastNote]` (inclusive, same endpoints
 * {@link notesInBox} uses) and its staff is within the notes' staff band. Returns [] when the
 * notes can't be located.
 */
export function dynamicsInBox(score: Score, noteIds: string[]): string[] {
  if (!noteIds.length) return []
  const ids = new Set(noteIds)

  // (measure, beat) temporal order: measures are sequential, beats are within-measure.
  const before = (aM: number, aB: Fraction, bM: number, bB: Fraction): number =>
    aM !== bM ? aM - bM : fracCompare(aB, bB)

  // Box extent = temporal min/max + staff band of the selected notes.
  let lo: { m: number; beat: Fraction } | null = null
  let hi: { m: number; beat: Fraction } | null = null
  let staffLo = Infinity, staffHi = -Infinity
  for (const m of score.measures) {
    for (const n of getMeasureNotes(m, score)) {
      if (!ids.has(n.id)) continue
      if (!lo || before(m.number, n.beat, lo.m, lo.beat) < 0) lo = { m: m.number, beat: n.beat }
      if (!hi || before(m.number, n.beat, hi.m, hi.beat) > 0) hi = { m: m.number, beat: n.beat }
      const st = staffOf(n)
      staffLo = Math.min(staffLo, st); staffHi = Math.max(staffHi, st)
    }
  }
  if (!lo || !hi) return []

  const staffIndexOf = (staffId?: string): number => {
    if (staffId === undefined) return 0
    const i = (score.staves ?? []).findIndex(s => s.id === staffId)
    return i < 0 ? 0 : i
  }

  const out: string[] = []
  for (const m of score.measures) {
    for (const d of m.dynamics ?? []) {
      const st = staffIndexOf(d.staffId)
      if (st < staffLo || st > staffHi) continue
      if (before(m.number, d.beat, lo.m, lo.beat) < 0) continue
      if (before(m.number, d.beat, hi.m, hi.beat) > 0) continue
      out.push(d.id)
    }
  }
  return out
}

/**
 * Slur ids whose BOTH endpoints are among `noteIds` — the slurs fully covered by a Shift-click
 * box, so they highlight with the selection (and match the fully-enclosed rule copy uses). A
 * slur with only one endpoint in the box is left out.
 */
export function slursInBox(score: Score, noteIds: string[]): string[] {
  const slurs = score.slurs
  if (!slurs || slurs.length === 0 || !noteIds.length) return []
  const ids = new Set(noteIds)
  return slurs.filter(s => ids.has(s.startNoteId) && ids.has(s.endNoteId)).map(s => s.id)
}

/**
 * Grow a set of note ids to include every note in each one's maximal TIE CHAIN.
 *
 * A tie chain (note → `tiedTo` … and back via `tiedFrom`) is one held note: same
 * pitch, summed duration. Used by Shift-range selection so a range ending mid-tie
 * still grabs the whole held note (ties = duration). Per-pitch: a partially-tied
 * chord pulls in exactly the tied partner pitch, not the other chord notes.
 *
 * Order is not significant (the caller dedups into its set).
 */
export function expandTieChains(score: Score, ids: string[]): string[] {
  const byId = new Map<string, FlatNote>()
  for (const m of score.measures) {
    for (const n of getMeasureNotes(m, score)) byId.set(n.id, { ...n, measureNumber: m.number })
  }

  const out = new Set<string>()
  for (const id of ids) {
    const seed = byId.get(id)
    if (!seed) { out.add(id); continue }
    // Walk back to the chain head, then forward collecting every member. The
    // guards bound the walk defensively against a malformed cyclic tie pointer.
    let head: FlatNote = seed
    let guard = 0
    while (head.tiedFrom && byId.has(head.tiedFrom) && guard++ < 10000) head = byId.get(head.tiedFrom)!
    let cur: FlatNote | undefined = head
    guard = 0
    while (cur && !out.has(cur.id) && guard++ < 10000) {
      out.add(cur.id)
      cur = cur.tiedTo ? byId.get(cur.tiedTo) : undefined
    }
  }
  return [...out]
}
