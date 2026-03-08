import type { Note, Score } from '../types/music'

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
    .flatMap(m => m.notes.map(n => ({ ...n, measureNumber: m.number })))
    .sort((a, b) =>
      a.measureNumber !== b.measureNumber
        ? a.measureNumber - b.measureNumber
        : a.beat - b.beat
    )

  const beatMap = new Map<string, FlatNote>()
  for (const n of allFlat) {
    const key = `${n.measureNumber}:${n.beat}`
    const existing = beatMap.get(key)
    if (!existing) {
      beatMap.set(key, n)
    } else if (!n.isRest && (existing.isRest || n.pitch < existing.pitch)) {
      // Prefer non-rest; among non-rests prefer the lowest pitch
      beatMap.set(key, n)
    }
  }

  return { allFlat, beats: Array.from(beatMap.values()) }
}
