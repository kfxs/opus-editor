/**
 * ⭐⭐ **IS THERE INK IN THE GAP?** — whether a barline runs unbroken from one staff into the next
 * one down, at a given boundary. docs/plans/barline-join-plan.md §2.4.
 *
 * ## ⭐⭐ Why the BOUNDARY is in the signature although nothing varies by it
 *
 * The join is stored as one fact per gap ({@link StaffInfo.barlineJoinBelow}) and P1 answers the
 * same thing at every bar. The boundary is here anyway, **from the first commit**, because that is
 * what keeps the contemporary case open — *"we just have to take care not restrict the model for
 * that"*, his words, and the thing that would restrict it is not a missing field:
 *
 * > ⭐ **What forecloses a future is a READER THAT ASSUMES, never a field that is missing.**
 *
 * With the boundary already asked for, the day a per-boundary exception arrives the storage lookup
 * changes *inside this function* and **not one caller moves**. Two of the three engines that can be
 * edited already ship exactly that shape — MuseScore's per-instance `spanStaff` (re-seeded from the
 * staff until the user touches it) and LilyPond's `\once \override Staff.BarLine.allow-span-bar`.
 *
 * ⛔ **So we do NOT add a positional field now.** A field with no feature is a field nothing
 * maintains: `Measure.keys` was deliberately left out of key signatures P1 for this reason, and
 * docs/plans/barline-types-plan.md §2 took the other road (it stores a per-staff scope that nothing reads)
 * and lists it in §10 as a smell.
 *
 * ⭐ This is `resolveStaffSize`'s arrangement, down to the `void` on the reserved parameter and its
 * *"three parameters, used with two"* — copied on purpose, so the unused argument reads as a
 * decision rather than as debris.
 */
import type { Score } from '@/types/music'
import { getStaves } from './staffContent'

/**
 * ⭐⭐ **A gap with no stored opinion is NOT joined** — his call, 2026-08-28: *"default should be not
 * joined"*, said in as many words when the first build defaulted the other way.
 *
 * ⚠️ **The plan had this backwards, and the misreading is worth keeping visible.** It quoted him —
 * *"default join is join all barlines"* — and read it as the default STATE. Read beside the bullet
 * that follows it (*"⛔ NOT per boundary in this plan"*) it is plainly about the default SCOPE of a
 * join: when you join, you join every barline in the score rather than one boundary. That is the P3
 * drag's reach, ⛔ not what a fresh score looks like.
 *
 * ⭐ It is also the conservative landing: today every staff draws its own barlines, so an absent
 * field keeps the picture exactly as it is and nothing in the score moves until someone asks for a
 * join. The joined-by-default question comes back as an INSTRUMENT one (piano joined, orchestral
 * joined per family, vocal not — docs/plans/barline-join-plan.md §2.3), where it belongs.
 */
export const DEFAULT_BARLINE_JOIN = false

/**
 * **Does the barline at this boundary continue into the gap below `staffId`?**
 *
 * ⭐ A staff **id**, ⛔ never an index: the field lives on `StaffInfo`, which is keyed by identity,
 * and an ordinal is one renumber away from addressing a different staff. Callers holding an
 * ordinal convert with `staffIdAtIndex` (`./staffContent`), which is what the facade already does
 * for `setStaffSize`.
 *
 * ⭐ **False for the LAST staff, and for one that is not in the score** — not because the join is
 * off there, but because *there is no gap*: the question is about the space below this staff, and
 * the bottom staff of a system has none. Answering it here keeps every caller free of an
 * `if (isLast)` of its own, which is the guard that always ends up written twice and once wrongly.
 */
export function barlineJoinsBelow(
  score: Score,
  staffId: string | undefined,
  /** The boundary being drawn — the bar the line ENDS. Reserved; see the header. */
  measureNumber?: number,
): boolean {
  void measureNumber // reserved — see the note above; the per-boundary mix is not built yet.
  const staves = getStaves(score)
  const index = staves.findIndex(s => s.id === staffId)
  // Not in the score, or the bottom staff: no gap below, so no ink in one.
  if (index < 0 || index >= staves.length - 1) return false
  return staves[index].barlineJoinBelow ?? DEFAULT_BARLINE_JOIN
}

/**
 * **Join or disjoin the gap below one staff.**
 *
 * ⭐ Writing the DEFAULT clears the field, so "absent means not joined" holds and the exported JSON
 * stays clean — `setStaffSize`'s idiom, and the reason a score that has been joined and unjoined
 * again is byte-identical to one that never was.
 *
 * ⭐ **The bottom staff is refused, not silently stored.** There is no gap below it, so a `true`
 * there would be a fact about nothing that {@link barlineJoinsBelow} would then have to ignore
 * forever — the shape of stored-and-unread that docs/plans/barline-types-plan.md §10 lists as a smell.
 *
 * @returns whether the score changed — `false` for an unknown staff, the bottom staff, or a write
 *          that says what was already true.
 */
export function setBarlineJoinBelow(score: Score, staffId: string, on: boolean): boolean {
  const staves = getStaves(score)
  const index = staves.findIndex(s => s.id === staffId)
  if (index < 0 || index >= staves.length - 1) return false

  const next = on === DEFAULT_BARLINE_JOIN ? undefined : on
  const staff = staves[index]
  if (staff.barlineJoinBelow === next) return false
  if (next === undefined) delete staff.barlineJoinBelow
  else staff.barlineJoinBelow = next
  return true
}
