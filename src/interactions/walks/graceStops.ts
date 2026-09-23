/**
 * ⭐ **A lane's STOPS with its GRACES in them** — each grace one stop (its first pitch; a grace chord is
 * one stop), BEFORE its main note for a grace before, AFTER it for a grace after, in the group's order.
 * The beat maps know only slots, so this is where a grace becomes a place to stand — for an arrow
 * walking the selection (his report, 2026-09-22: *"navigation … ignores the grace"*) and for a slur
 * endpoint walking onto and off one (`./slurReanchor`).
 *
 * ⚠️ A grace's stop carries its MAIN note's (measure, beat) — that is what its flat `Note` reports —
 * so it is found by ID, and a POSITION lookup must skip the graces or it lands on one:
 * {@link locateStop} does both.
 */
import type { FlatNote } from '../../utils/beatMap'
import type { BracketedGrace, GraceNote, Score } from '../../types/music'
import { findSlot } from '../../engine/models/slotLookup'
import { graceGroupOf } from '../../utils/graceNotes'
import { fracEq, type Fraction } from '../../utils/fraction'

export interface GraceStops {
  stops: FlatNote[]
  /** The stops that are graces, by stop id. */
  graceIds: ReadonlySet<string>
}

export function withGraceStops(
  score: Score, stops: FlatNote[],
  /**
   * ⭐ Also a stop for each BRACKETED grace, where it is drawn — before its grace, before its note, or
   * after the note (his report, 2026-09-23: *"i'm navigating but the bracket is ignored"*;
   * `docs/plans/bracketed-grace-plan.md`). ⚠️ OPT-IN, for the selection arrows only: a SLUR end walking
   * onto one would anchor to ink the slur renderer cannot find (`./slurReanchor` does not ask).
   */
  opts: { bracketed?: boolean } = {},
): GraceStops {
  const out: FlatNote[] = []
  const graceIds = new Set<string>()
  for (const stop of stops) {
    const found = findSlot(score, stop.id)
    const slot = found?.type === 'chord' ? found.chord : found?.type === 'rest' ? found.rest : undefined
    // A stop found by ID (it reports its host's beat): a grace's first pitch, or a bracketed one's.
    const byId = (id: string): FlatNote => {
      graceIds.add(id)
      return { ...stop, id, isRest: false }
    }
    const bracketed = (list: readonly BracketedGrace[] | undefined) => {
      if (opts.bracketed) for (const b of list ?? []) out.push(byId(b.pitches[0].id))
    }
    const graceStop = (note: GraceNote): FlatNote => byId(note.pitches[0].id)
    for (const note of slot ? graceGroupOf(slot, 'before')?.notes ?? [] : []) {
      bracketed(note.bracketedBefore)
      out.push(graceStop(note))
    }
    bracketed(slot?.bracketedBefore)
    out.push(stop)
    if (slot?.type === 'chord') bracketed(slot.bracketedAfter)
    for (const note of slot ? graceGroupOf(slot, 'after')?.notes ?? [] : []) {
      bracketed(note.bracketedBefore)
      out.push(graceStop(note))
    }
  }
  return { stops: out, graceIds }
}

/**
 * Where `id` stands among `stops`: a GRACE by its id (its grace's first pitch), anything else by its
 * (measure, beat) — a chord's representative is its lowest note, so an id lookup would miss every
 * other pitch of it. @returns -1 when it is not on this lane.
 */
export function locateStop(
  score: Score, lane: GraceStops, id: string, at: { measure: number; beat: Fraction },
): number {
  const grace = findSlot(score, id, { graceNotes: true })?.grace
  if (grace) return lane.stops.findIndex(n => n.id === grace.note.pitches[0].id)
  // …and a BRACKETED grace, by its first pitch — ⛔ never by position, which is its host's.
  const bracketed = findSlot(score, id, { bracketed: true })?.bracketed
  if (bracketed) return lane.stops.findIndex(n => n.id === bracketed.note.pitches[0].id)
  return lane.stops.findIndex(n =>
    !lane.graceIds.has(n.id) && n.measureNumber === at.measure && fracEq(n.beat, at.beat))
}

/**
 * The note a GRACE hangs on — its chord's first pitch, or its rest — or null for any other id. ⭐ Where
 * the keyboard caret AFTER a grace types (his rule, 2026-09-22: *"the grace stamp should behave similar
 * to note stamp"* — the stamped grace is the caret, and the next letter is its main note).
 */
export function graceHostId(score: Score, id: string): string | null {
  const found = findSlot(score, id, { graceNotes: true })
  if (!found?.grace) return null
  return found.type === 'chord' ? found.chord.notes[0]?.id ?? null : found.rest.id
}
