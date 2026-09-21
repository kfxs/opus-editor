/**
 * ⭐⭐ **A HEAD WRITTEN ON THE OTHER STAFF** — cross-staff notation as a SCORE operation, free
 * functions on a `Score` in the `clefOps` / `stemOps` idiom (DESIGN-PRINCIPLES §5, so none of it may
 * live on `MusicEngine`). docs/plans/cross-staff-plan.md; what the programs, engines and books do is
 * docs/research/cross-staff-research.md.
 *
 * The whole statement is ONE optional field, `NotePitch.displayStaffId`, and this module is the only
 * writer of it. Three invariants, held here so no reader has to check them:
 *
 * 1. **It never names the head's HOME staff** — coming home is spelled by DELETING the field, so
 *    "has this head crossed?" is `displayStaffId !== undefined` everywhere.
 * 2. **It names the ADJACENT staff** (one above or one below home). Every program and engine surveyed
 *    has that limit, and one stem cannot honestly join heads two staves apart.
 * 3. **It is a REAL staff id** — ⛔ not the slot convention, where absent means the FIRST staff.
 *    Absent here means HOME, so a bass-staff head written on the first staff carries the first
 *    staff's real id.
 *
 * ⭐ **Every staff of the score is one group, for now** (his call, 2026-09-21): no `StaffGroup` is
 * consulted and no indicator is written, so a score made before this existed needs nothing to be
 * legal. ⏭️ When instruments gate it, {@link canDisplayOn} is the ONE function that narrows.
 * ⚠️ `Score.staffGroups` today means *a sign at the system's left edge* — ⛔ it is not this scope.
 *
 * ⛔ Nothing here touches the chord's `staffId` or `voice`: rhythm, rest fill, rebar, paste and
 * playback never learn the head moved.
 */
import type { Chord, Score } from '@/types/music'
import { getStaves, staffIndexOfId } from './staffContent'
import { findSlot } from './slotLookup'

/** Which way a head is sent: −1 = toward the staff ABOVE (a lower index), +1 = toward the one BELOW. */
export type CrossDirection = -1 | 1

/** Why a head stayed where it was. */
export type CrossRefusal =
  /** The id names no pitch of a chord — a rest, or nothing at all. Rests do not cross (plan §3). */
  | 'not-a-note'
  /** A fanned MEMBER's pitch. A fan is one gesture drawn by its own pass; out of this plan's scope. */
  | 'fan-member'
  /** There is no staff that way — the head is already on the score's top / bottom staff. */
  | 'no-staff'
  /** That staff is two away from home. */
  | 'not-adjacent'

/** What happened to ONE head. */
export type CrossOutcome =
  | { pitchId: string; result: 'crossed'; displayStaffId: string }
  | { pitchId: string; result: 'returned' }
  | { pitchId: string; result: 'refused'; why: CrossRefusal }

/**
 * May a head whose chord lives on staff `homeIndex` be written on staff `displayIndex`?
 *
 * ⭐ THE legality gate — adjacent, existing, and not home itself (home is the field's absence).
 * ⏭️ A future instrument / group scope narrows it HERE and nowhere else.
 */
export function canDisplayOn(score: Score, homeIndex: number, displayIndex: number): boolean {
  if (displayIndex < 0 || displayIndex >= getStaves(score).length) return false
  return Math.abs(displayIndex - homeIndex) === 1
}

/** The 0-based index of the staff a head is WRITTEN on — its chord's own unless it has crossed. */
export function displayStaffIndex(score: Score, chord: Chord, pitchId: string): number {
  const home = staffIndexOfId(score, chord.staffId)
  const crossed = chord.notes.find(n => n.id === pitchId)?.displayStaffId
  if (crossed === undefined) return home
  const index = getStaves(score).findIndex(s => s.id === crossed)
  // ⚠️ An id naming no staff reads as HOME: the head is drawn where its chord is, and
  // {@link crossStaffProblems} is what says so out loud. ⛔ Not `staffIndexOfId`, whose fallback
  // is the FIRST staff — that would draw a bad id on staff 0.
  return index < 0 ? home : index
}

/** Has any head of this chord crossed? What a renderer asks before taking the split-chord path. */
export function hasCrossedHead(chord: Chord): boolean {
  return chord.notes.some(n => n.displayStaffId !== undefined)
}

/**
 * Send ONE head one staff `direction`-ward of where it is WRITTEN now. From home that crosses it;
 * from the far staff back toward home it RETURNS it (the field is deleted); anything further is
 * refused. Mutates the score; the caller owns the undo entry.
 */
export function crossPitch(score: Score, pitchId: string, direction: CrossDirection): CrossOutcome {
  const found = findSlot(score, pitchId, { fanMembers: true })
  if (!found || found.type !== 'chord') return { pitchId, result: 'refused', why: 'not-a-note' }
  if (found.member) return { pitchId, result: 'refused', why: 'fan-member' }

  const { chord, pitch } = found
  const staves = getStaves(score)
  const home = staffIndexOfId(score, chord.staffId)
  const target = displayStaffIndex(score, chord, pitchId) + direction

  if (target < 0 || target >= staves.length) return { pitchId, result: 'refused', why: 'no-staff' }
  if (target === home) {
    delete pitch.displayStaffId
    return { pitchId, result: 'returned' }
  }
  if (!canDisplayOn(score, home, target)) return { pitchId, result: 'refused', why: 'not-adjacent' }

  pitch.displayStaffId = staves[target].id
  return { pitchId, result: 'crossed', displayStaffId: staves[target].id }
}

/**
 * {@link crossPitch} over a selection — each head answers for itself, so a selection that spans
 * two staves moves what can move and reports the rest. `changed` is what the caller's undo entry
 * hangs on: ⛔ no `mutate` for a press that refused every head.
 */
export function crossPitches(
  score: Score,
  pitchIds: readonly string[],
  direction: CrossDirection,
): { changed: boolean; outcomes: CrossOutcome[] } {
  const outcomes = pitchIds.map(id => crossPitch(score, id, direction))
  return { changed: outcomes.some(o => o.result !== 'refused'), outcomes }
}

/**
 * Bring home every head of `chord` whose crossing is not legal FROM WHERE THE CHORD NOW LIVES.
 *
 * For the writers that carry a `displayStaffId` verbatim to a new place — the rebar relay, a
 * tuplet's cloned slots, a paste. The id is absolute, so a chord pasted from staff 2 onto staff 4
 * arrives still naming staff 1; that is no longer a crossing anyone could draw, and the head comes
 * home. ⭐ A chord that lands on the staff it left keeps its crossing untouched. Idempotent.
 *
 * ⛔ NOT for a loaded file: a file is reported, never repaired ({@link crossStaffProblems}).
 */
export function keepLegalCrossings(score: Score, chord: Chord): void {
  const home = staffIndexOfId(score, chord.staffId)
  const staves = getStaves(score)
  for (const pitch of chord.notes) {
    if (pitch.displayStaffId === undefined) continue
    const index = staves.findIndex(s => s.id === pitch.displayStaffId)
    if (!canDisplayOn(score, home, index)) delete pitch.displayStaffId
  }
}

/**
 * ⛔ **Report, never repair** (docs/plans/json-io-plan.md): what a loaded score says about crossed
 * heads that this build cannot honour, one sentence each. Nothing is changed — a bad id is drawn at
 * home ({@link displayStaffIndex}) and survives the round trip.
 */
export function crossStaffProblems(score: Score): string[] {
  const staves = getStaves(score)
  const problems: string[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      const home = staffIndexOfId(score, slot.staffId)
      for (const pitch of slot.notes) {
        if (pitch.displayStaffId === undefined) continue
        const where = `bar ${measure.number}, ${pitch.step}${pitch.octave}`
        const index = staves.findIndex(s => s.id === pitch.displayStaffId)
        if (index < 0) problems.push(`${where}: displayStaffId "${pitch.displayStaffId}" names no staff`)
        else if (index === home) problems.push(`${where}: displayStaffId names the note's own staff`)
        else if (!canDisplayOn(score, home, index)) problems.push(`${where}: written ${Math.abs(index - home)} staves from home — only the adjacent staff can be drawn`)
      }
    }
  }
  return problems
}
