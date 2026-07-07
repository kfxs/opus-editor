import type { Note, Score, Fraction } from '../types/music'
import { fracCompare } from '../utils/fraction'
import { getMeasureNotes } from '../utils/musicUtils'
import { spellingToMidi } from '../utils/pitchSpelling'

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
    .filter(n => voice === undefined || (n.voice ?? 0) === voice)
    .filter(n => staff === undefined || (n.staff ?? 0) === staff)
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
      const notes = getMeasureNotes(m, score).filter(n => staff === undefined || (n.staff ?? 0) === staff)
      const hasVoice = notes.some(n => (n.voice ?? 0) === voice)
      const useVoice = hasVoice ? voice : 0
      return notes
        .filter(n => (n.voice ?? 0) === useVoice)
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
 * Every note/rest id in the inclusive temporal range between two notes (by id),
 * in score order. WHOLE CHORDS are included (every note sharing a beat in the
 * range), and rests in between are included. Direction-agnostic: the two ids may
 * be given in either order. Used by Shift-click range selection.
 *
 * Multi-staff (Sibelius-style): the two endpoints define BOTH the beat span AND the staff
 * span. Shift-click on the SAME staff → a single-staff passage; Shift-click on a DIFFERENT
 * staff → the passage extends vertically to cover every staff between the two (a grand-staff
 * / system passage). The barline/beat spine is shared, so the beat range is taken from the
 * all-staff position map and then filtered to the staff band [anchorStaff … targetStaff].
 *
 * Falls back to just the target's id when the anchor can't be located.
 */
export function notesInRange(score: Score, anchorId: string, targetId: string): string[] {
  // Full (all-staff, all-voice) map: locates the endpoints, orders positions, and carries staff.
  const { allFlat, beats } = buildBeatMap(score)
  const anchorFull = allFlat.find(n => n.id === anchorId)
  const targetFull = allFlat.find(n => n.id === targetId)
  if (!targetFull) return []
  if (!anchorFull) return [targetFull.id]

  const aIdx = beats.findIndex(b => posKey(b) === posKey(anchorFull))
  const tIdx = beats.findIndex(b => posKey(b) === posKey(targetFull))
  if (aIdx === -1 || tIdx === -1) return [targetFull.id]

  const lo = Math.min(aIdx, tIdx)
  const hi = Math.max(aIdx, tIdx)
  const rangeKeys = new Set(beats.slice(lo, hi + 1).map(posKey))

  // Staff band spanned by the two endpoints (same staff → just that one staff).
  const staffLo = Math.min(anchorFull.staff ?? 0, targetFull.staff ?? 0)
  const staffHi = Math.max(anchorFull.staff ?? 0, targetFull.staff ?? 0)

  // allFlat is already temporally sorted, so this yields the range in score order with every
  // chord note at each in-range beat, across every staff in the band.
  return allFlat
    .filter(n => rangeKeys.has(posKey(n)) && (n.staff ?? 0) >= staffLo && (n.staff ?? 0) <= staffHi)
    .map(n => n.id)
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
 */
export function notesInBox(score: Score, currentIds: string[], targetId: string): string[] {
  const { allFlat, beats } = buildBeatMap(score)
  const byId = new Map(allFlat.map(n => [n.id, n]))
  const endpoints = [...currentIds, targetId].map(id => byId.get(id)).filter(Boolean) as FlatNote[]
  if (!endpoints.length) return byId.has(targetId) ? [targetId] : []

  let idxLo = Infinity, idxHi = -Infinity, staffLo = Infinity, staffHi = -Infinity
  for (const n of endpoints) {
    const i = beats.findIndex(b => posKey(b) === posKey(n))
    if (i < 0) continue
    idxLo = Math.min(idxLo, i); idxHi = Math.max(idxHi, i)
    staffLo = Math.min(staffLo, n.staff ?? 0); staffHi = Math.max(staffHi, n.staff ?? 0)
  }
  if (idxHi < 0) return byId.has(targetId) ? [targetId] : []

  const rangeKeys = new Set(beats.slice(idxLo, idxHi + 1).map(posKey))
  return allFlat
    .filter(n => rangeKeys.has(posKey(n)) && (n.staff ?? 0) >= staffLo && (n.staff ?? 0) <= staffHi)
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
      const st = n.staff ?? 0
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
