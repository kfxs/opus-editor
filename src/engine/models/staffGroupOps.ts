/**
 * **GROUPING SIGNS — the brace and the bracket, as a SCORE operation.** Free functions on a `Score`,
 * in the `clefOps` / `barlineOps` / `keyOps` idiom, with {@link ScoreModel} keeping thin delegators
 * (DESIGN-PRINCIPLES principle 5 — the score is independent of the editor, so none of this may live
 * on `MusicEngine`, which only records undo). P5 of docs/plans/braces-brackets-plan.md.
 *
 * ## ⭐⭐ THE USER OWNS MEMBERSHIP NOW — the auto-writer had to stop
 *
 * `ScoreModel.ensureSingleGroupSpansAllStaves` used to rebuild `staffGroups` as **one group over
 * every staff** on each `addStaff`. That was harmless while nothing drew, and it is **incompatible
 * with authoring**: his rule of 2026-08-29 applies a sign to *the staves the selection names*, so a
 * writer that overwrites `staffIds` would silently destroy a group the moment a staff was added.
 *
 * ⭐ It is replaced by {@link pruneStaffGroups}, which is the honest division: **the model keeps
 * referential integrity** (no group may name a staff that no longer exists), **the user keeps
 * membership**. ⛔ The model no longer invents a group, and `groupsAt`'s `symbol` gate means a score
 * without an authored sign still draws nothing.
 *
 * ## ⚠️ A ONE-STAFF GROUP IS LEGAL, and the books say so for the BRACKET
 *
 * His rule allows it — *"if just one staff selected we apply just to that staff"* — and it is real
 * engraving: *"A score system of only one stave takes a square bracket **as well as** a systemic
 * barline"* (Gould p. 516; Ross pp. 151–2 gives the fullest list). ⏭️ **A one-staff BRACE is not**:
 * a brace joins the staves of one instrument, and no source draws one over a single stave. That
 * asymmetry is not enforced here — this module writes what it is told — but it is where a refusal
 * would go if his eye ever wants one.
 */
import { v4 as uuidv4 } from 'uuid'
import type { Score, StaffGroup } from '@/types/music'
import { getStaves } from './staffContent'

/**
 * **Apply a grouping sign to exactly these staves**, replacing whatever group already covers them.
 *
 * @param staffIds the staves the sign spans, in any order — stored top→bottom.
 * @param symbol the sign, or `undefined` to REMOVE the group covering these staves. ⭐ Removing is
 *   a real operation and not "set the symbol to nothing": a group with no symbol draws nothing but
 *   still occupies the overlay, and his *"none"* means the sign is gone.
 * @returns whether the score changed.
 */
export function applyGroupSymbol(
  score: Score,
  staffIds: readonly string[],
  symbol: StaffGroup['symbol'] | undefined,
): boolean {
  const order = new Map(getStaves(score).map((s, i) => [s.id, i]))
  // ⭐ Only staves the score actually has, in score order — so a caller may hand us a selection's
  //   ids without first checking them, and the stored list is always top→bottom.
  const ids = [...new Set(staffIds)].filter(id => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!)
  if (ids.length === 0) return false

  const groups = [...(score.staffGroups ?? [])]
  const key = ids.join('\0')
  const at = groups.findIndex(g => sameStaves(g.staffIds, ids, key))

  if (symbol === undefined) {
    if (at < 0) return false
    groups.splice(at, 1)
    score.staffGroups = groups.length > 0 ? groups : undefined
    return true
  }

  if (at >= 0) {
    if (groups[at].symbol === symbol) return false
    groups[at] = { ...groups[at], symbol }
  } else {
    groups.push({ id: uuidv4(), staffIds: ids, symbol })
  }
  score.staffGroups = groups
  return true
}

/** Same membership? Compared on the normalised, order-independent key the caller already built. */
function sameStaves(a: readonly string[], b: readonly string[], bKey: string): boolean {
  return a.length === b.length && [...a].sort().join('\0') === [...b].sort().join('\0')
    && bKey.length >= 0
}

/**
 * ⭐ **Drop what no longer exists** — staff ids removed from the score, and any group left with none.
 *
 * The model's whole remaining duty over `staffGroups`, and it runs where the STAFF AXIS changes.
 * ⛔ It never creates a group and never edits `symbol`: those are the user's, which is the division
 * this module's header sets out.
 *
 * @returns whether the score changed.
 */
export function pruneStaffGroups(score: Score): boolean {
  const groups = score.staffGroups
  if (!groups?.length) return false
  const live = new Set(getStaves(score).map(s => s.id))

  let changed = false
  const kept: StaffGroup[] = []
  for (const group of groups) {
    const ids = group.staffIds.filter(id => live.has(id))
    if (ids.length === 0) { changed = true; continue }
    if (ids.length !== group.staffIds.length) { changed = true; kept.push({ ...group, staffIds: ids }) }
    else kept.push(group)
  }
  if (!changed) return false
  score.staffGroups = kept.length > 0 ? kept : undefined
  return true
}

/**
 * ⭐⭐ **RE-SPAN a group — the drag of its top or bottom handle.**
 *
 * ⛔ Not `applyGroupSymbol` with new ids: that keys on MEMBERSHIP, so it would create a SECOND group
 * rather than move this one, and the sign's selection (which names the group's ID) would go stale
 * mid-drag. This edits the group in place, so its identity — and the user's selection — survives.
 *
 * ⚠️ Clamped to the staves the score has, and normalised low→high, so a drag past the top or bottom
 * of the system stops rather than naming a staff that is not there.
 *
 * @returns whether the score changed.
 */
export function setGroupSpan(
  score: Score, groupId: string, fromStaff: number, toStaff: number,
): boolean {
  const staves = getStaves(score)
  const groups = score.staffGroups
  const at = groups?.findIndex(g => g.id === groupId) ?? -1
  if (!groups || at < 0 || staves.length === 0) return false

  const lo = Math.max(0, Math.min(fromStaff, toStaff))
  const hi = Math.min(staves.length - 1, Math.max(fromStaff, toStaff))
  const ids = staves.slice(lo, hi + 1).map(s => s.id)
  if (ids.length === 0) return false
  if (ids.length === groups[at].staffIds.length
    && ids.every((id, i) => id === groups[at].staffIds[i])) return false

  const next = [...groups]
  next[at] = { ...next[at], staffIds: ids }
  score.staffGroups = next
  return true
}
