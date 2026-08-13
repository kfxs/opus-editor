/**
 * Staff-axis addressing primitive (multi-staff Phase 0, Option A — flat `staffId`
 * discriminator). See docs/multi-staff-plan.md §4.
 *
 * A `Measure` holds flat `slots` / `clefs` / `dynamics` / `tuplets` arrays whose
 * elements each carry an optional `staffId`. Exactly like the parallel vertical axis,
 * **voice** (`voice?: 0|1|2|3`, absent = voice 0), an **absent `staffId` means staff 0**
 * — the first staff in {@link Score.staves}. So a single-staff (N=1) score stores its
 * content with no `staffId` at all and is byte-identical to the pre-multi-staff model.
 *
 * This module is the single seam the rest of the engine routes staff reads through:
 * `staffContent(measure, staffId, score)` filters a measure down to one staff's lane.
 * Writes are NOT expressed here (you can't reassign "one staff's slice" of a flat array
 * as a view) — a write site inserts elements already stamped with the target `staffId`
 * and lets absent = staff 0 carry the N=1 case. Pure module: no Vue, no instance state.
 */
import type {
  Score,
  Measure,
  StaffInfo,
  ChordRest,
  ClefChange,
  Dynamic,
  Hairpin,
  Ottava,
  Tuplet,
} from '@/types/music'

/** The default staff for content that carries no explicit `staffId`. */
export const DEFAULT_STAFF_INDEX = 0

/** The staff list, always as an array (empty only for a degenerate hand-written JSON
 *  with no `staves`; a live model always has ≥1 — the constructor seeds one). */
export function getStaves(score: Score): StaffInfo[] {
  return score.staves ?? []
}

/** Id of the first staff (the one absent `staffId` resolves to), or `undefined` for a
 *  degenerate score with no staves. */
export function firstStaffId(score: Score): string | undefined {
  return score.staves?.[DEFAULT_STAFF_INDEX]?.id
}

/** Id of the staff at a 0-based index, or `undefined` if out of range. */
export function staffIdAtIndex(score: Score, index: number): string | undefined {
  return score.staves?.[index]?.id
}

/**
 * The staffId to KEY on for a 0-based staff index (or a flat {@link Note.staff}), matching the
 * slot's own `staffId` convention: staff 0 → `undefined` (absent), any later staff → its real id.
 * The ordinal-input twin of reading `slot.staffId` directly — use it wherever a position key
 * ({@link restPositionKey}) is built from a flat note's ordinal rather than a slot. Distinct from
 * {@link staffIdAtIndex}, which returns the first staff's REAL id for index 0. */
export function keyStaffId(score: Score, index: number | undefined): string | undefined {
  if (!index) return undefined // 0 or undefined → staff 0 → absent
  return staffIdAtIndex(score, index)
}

/**
 * 0-based index of a staff id in {@link Score.staves}. An absent id resolves to the
 * first staff ({@link DEFAULT_STAFF_INDEX}); an unknown id also falls back to 0 defensively
 * (mirrors how an out-of-range voice degrades). This is the `staffId → index` half of the
 * flat {@link Note.staff} projection.
 */
export function staffIndexOfId(score: Score, staffId: string | undefined): number {
  if (staffId === undefined) return DEFAULT_STAFF_INDEX
  const idx = getStaves(score).findIndex((s) => s.id === staffId)
  return idx < 0 ? DEFAULT_STAFF_INDEX : idx
}

/**
 * Does an element with `elementStaffId` belong to the staff addressed by `queryStaffId`?
 * Both sides resolve absent → the first staff, so at N=1 (all absent) everything matches
 * the single staff. This is the core membership test the filters below share.
 */
export function matchesStaff(
  elementStaffId: string | undefined,
  queryStaffId: string | undefined,
  score: Score,
): boolean {
  const dflt = firstStaffId(score)
  return (elementStaffId ?? dflt) === (queryStaffId ?? dflt)
}

/** A read-only view of one staff's lane within a measure. Fresh arrays — safe to iterate,
 *  never write back (see module note). */
export interface StaffContentView {
  slots: ChordRest[]
  clefs: ClefChange[]
  dynamics: Dynamic[]
  hairpins: Hairpin[]
  ottavas: Ottava[]
  tuplets: Tuplet[]
}

/** One staff's slots within a measure, in stored order. */
export function staffSlots(measure: Measure, staffId: string | undefined, score: Score): ChordRest[] {
  return measure.slots.filter((s) => matchesStaff(s.staffId, staffId, score))
}

/** One staff's clef changes within a measure (empty when the measure has none). */
export function staffClefs(measure: Measure, staffId: string | undefined, score: Score): ClefChange[] {
  return (measure.clefs ?? []).filter((c) => matchesStaff(c.staffId, staffId, score))
}

/** One staff's dynamics within a measure. */
export function staffDynamics(measure: Measure, staffId: string | undefined, score: Score): Dynamic[] {
  return (measure.dynamics ?? []).filter((d) => matchesStaff(d.staffId, staffId, score))
}

/** One staff's tuplets within a measure. */
export function staffTuplets(measure: Measure, staffId: string | undefined, score: Score): Tuplet[] {
  return (measure.tuplets ?? []).filter((t) => matchesStaff(t.staffId, staffId, score))
}

/** One staff's hairpins within a measure — the ones that START here (a wedge may run past the
 *  bar's end; see {@link Hairpin}). */
export function staffHairpins(measure: Measure, staffId: string | undefined, score: Score): Hairpin[] {
  return (measure.hairpins ?? []).filter((h) => matchesStaff(h.staffId, staffId, score))
}

/** One staff's ottavas within a measure — the ones that START here (an octave line may run past
 *  the bar's end; see {@link Ottava}). Unlike every other filter in this file it has no voice to
 *  consider: an ottava governs the whole staff. */
export function staffOttavas(measure: Measure, staffId: string | undefined, score: Score): Ottava[] {
  return (measure.ottavas ?? []).filter((o) => matchesStaff(o.staffId, staffId, score))
}

/**
 * The whole per-staff lane of a measure — slots + clefs + dynamics + tuplets filtered to
 * one staff. This is the primitive the plan (§4) names `staffContent(measure, staffId)`;
 * later phases (render, rebar, entry) route their per-measure reads through it so a
 * single measure yields N `Stave`-shaped lanes. At N=1 it returns the whole measure.
 */
export function staffContent(measure: Measure, staffId: string | undefined, score: Score): StaffContentView {
  return {
    slots: staffSlots(measure, staffId, score),
    clefs: staffClefs(measure, staffId, score),
    dynamics: staffDynamics(measure, staffId, score),
    hairpins: staffHairpins(measure, staffId, score),
    ottavas: staffOttavas(measure, staffId, score),
    tuplets: staffTuplets(measure, staffId, score),
  }
}

/**
 * A shallow `Measure` narrowed to one staff's lane: the shared barline/meter facts of the
 * measure with its `slots`/`clefs`/`dynamics`/`tuplets` filtered to `staffId`. This lets a
 * consumer that reads `measure.slots` etc. (the renderer's per-measure path) operate on a
 * single staff **without threading `staffId` into its every helper** — pass it this view
 * instead of the raw measure. At N=1 the filters return the whole measure, so the view is
 * behaviorally identical to the original. See docs/multi-staff-plan.md §5.
 *
 * The `id`/`number` are unchanged, so per-measure *geometry* keys (still keyed on
 * `measure.number`) would collide across staves — geometry rekeying to `(measure, staffId)`
 * is Phase 2; Phase 1 draws each staff and registers per-slot content (keyed on global slot
 * ids, collision-free).
 */
export function staffMeasureView(measure: Measure, staffId: string | undefined, score: Score): Measure {
  const c = staffContent(measure, staffId, score)
  // ⚠️ EVERY per-staff array must be named here. What is not named rides the spread, so a
  // measure-level list the filters don't know about lands UNFILTERED on every staff's lane —
  // silently, since nothing imports differently and nothing throws. That is why `hairpins` is
  // in this list and not merely in `StaffContentView`.
  return {
    ...measure,
    slots: c.slots, clefs: c.clefs, dynamics: c.dynamics, hairpins: c.hairpins, ottavas: c.ottavas,
    tuplets: c.tuplets,
  }
}
