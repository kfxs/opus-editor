/**
 * ⭐ **THE ROOM A LINE BETWEEN TWO NOTEHEADS ASKS OF THE SPACING** — a SOFT request, handed to
 * `measureColumns` and applied by the spring solve (`spacing.Column.softRod`).
 *
 * ⭐⭐ **Soft, by his rule (2026-09-25):** *"the minimum distance should not avoid the user to make it
 * shorter"*. So a request raises the natural length of the gaps it crosses — what the automatic spacing
 * gives when nothing squeezes — and ⛔ never the FLOOR: the ink stays the only thing a squeeze cannot go
 * below. (A hard `Column.rod` is the fan's, whose members are ink that must not collide.)
 *
 * A LIST of providers, so a new note-to-note line is a row here and ⛔ not a parameter (or a kind word) at
 * every `measureColumns` caller. The first is the glissando (docs/plans/glissando-plan.md P1b).
 */
import type { Fraction, Measure, Score } from '@/types/music'
import { glissandoRoomIn } from './glissandoRoom'

/**
 * One line's request, in STAFF SPACES of clear room between the two inks it runs between.
 * `measureColumns` adds the columns' own reach (the head, its dots, the target's accidental).
 */
export interface LineRoom {
  /** The beat of the column the line leaves. */
  from: Fraction
  /** The beat of the column it arrives at — ⭐ null when that is in a LATER bar: the request then runs to
   *  this bar's barline, asking for the line's start and length only. */
  to: Fraction | null
  /** Clear room after the source's ink, before the line. */
  startGap: number
  /** Clear room after the line before the target's ink — when the target's left edge is a HEAD. */
  endGap: number
  /** …and when it is an ACCIDENTAL. */
  accidentalGap: number
  /** The line's own least length. */
  length: number
}

const PROVIDERS: ReadonlyArray<(score: Score, measure: Measure) => LineRoom[]> = [
  glissandoRoomIn,
]

/** Every note-to-note line's request in this bar. */
export function noteLineRoom(score: Score, measure: Measure): LineRoom[] {
  return PROVIDERS.flatMap(provider => provider(score, measure))
}
