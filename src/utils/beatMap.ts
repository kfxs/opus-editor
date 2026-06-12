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
