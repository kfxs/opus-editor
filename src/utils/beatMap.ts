import type { Note, Score } from '../types/music'
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
 */
export function buildBeatMap(score: Score): { allFlat: FlatNote[]; beats: FlatNote[] } {
  const allFlat: FlatNote[] = score.measures
    .flatMap(m => getMeasureNotes(m).map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : fracCompare(a.beat, b.beat),
    )

  // Key uses num/den so {num:1,den:3} and {num:2,den:6} (same value) reduce to the same key
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

  return { allFlat, beats: Array.from(beatMap.values()) }
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
 * Falls back to just the target's id when the anchor can't be located.
 */
export function notesInRange(score: Score, anchorId: string, targetId: string): string[] {
  const { allFlat, beats } = buildBeatMap(score)
  const anchor = allFlat.find(n => n.id === anchorId)
  const target = allFlat.find(n => n.id === targetId)
  if (!target) return []
  if (!anchor) return [target.id]

  const aIdx = beats.findIndex(b => posKey(b) === posKey(anchor))
  const tIdx = beats.findIndex(b => posKey(b) === posKey(target))
  if (aIdx === -1 || tIdx === -1) return [target.id]

  const lo = Math.min(aIdx, tIdx)
  const hi = Math.max(aIdx, tIdx)
  const rangeKeys = new Set(beats.slice(lo, hi + 1).map(posKey))

  // allFlat is already temporally sorted, so this yields the range in score order
  // with every chord note at each in-range beat.
  return allFlat.filter(n => rangeKeys.has(posKey(n))).map(n => n.id)
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
    for (const n of getMeasureNotes(m)) byId.set(n.id, { ...n, measureNumber: m.number })
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
