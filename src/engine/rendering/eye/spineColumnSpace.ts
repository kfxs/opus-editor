/**
 * ⭐ **A NOTE'S SPACE ON THE SPINE** — room reserved BEFORE the column a selected note stands in, along the
 * path (`docs/plans/bent-staff-plan.md` §9.2 "space"; his ask 2026-09-28: *"move it also (not offset) so we
 * can have the control of the space between … the elements separately"*). ⛔ Only the spine; the page keeps
 * its own leading space.
 *
 * The spine's twin of the page's note spacing (`types/engravingOverrides` `leadingSpace`), and addressed the
 * same way: a property of the COLUMN, not the note — every voice and staff at that beat moves together — keyed
 * by the page's own {@link spacingPositionKey} (the bar's id + the beat). In staff spaces, signed:
 * + = more room before the column, − = tighter.
 *
 * ⭐ It MOVES the column, ⛔ never offsets the ink: the space goes into the column's `authored` gap — the page's
 * own "reserved, never squeezed" part of the spring model (`layout/spacing`) — so every later column in the bar
 * moves with it. Before a bar's FIRST column there is no gap between columns: the space goes into the bar's
 * lead-in instead.
 *
 * ⛔ **Tighter stops at the ink** — a negative space shortens the gap's SPRING, and the page's solve never takes
 * a gap below its floor (the pair's ink and padding), so the note moves until its ink meets the one before, in
 * the DRAWN gap; the first column comes no closer than the barline's clearance. The value HE typed is kept as
 * typed; past that point the drawing is held.
 *
 * ⚠️ **Kept for the SESSION only**, held by the panel (plan §9.3 C — undecided). ⛔ No DOM.
 */
import { spacingPositionKey } from '@/engine/models/engravingOverrides'
import { findSlot } from '@/engine/models/slotLookup'
import { followingSpace, type Column } from '@/engine/layout/spacing'
import type { Measure, Score } from '@/types/music'

/** Column key ({@link spacingPositionKey}) → staff spaces before that column. A column with no row has none. */
export type SpineColumnSpaces = ReadonlyMap<string, number>

/** What one click of the box's arrows adds, in staff spaces — the page's note-spacing step. A changeable default. */
export const SPINE_SPACE_STEP = 0.25
/** The range the Spine Properties box offers, in staff spaces. Changeable defaults. */
export const SPINE_SPACE_MIN = -10
export const SPINE_SPACE_MAX = 20

/** The column a note, chord pitch or rest (by the id the editor selects it by) stands in — its key here. */
export function spineColumnKeyOf(score: Score, id: string): string | undefined {
  const found = findSlot(score, id)
  if (!found) return undefined
  const slot = found.type === 'chord' ? found.chord : found.rest
  const measure = score.measures.find(m => m.number === slot.measure)
  return measure && spacingPositionKey(measure.id, slot.beat)
}

/**
 * The bar's columns with each one's spine space added to its reserved gap — held at the ink — and the space
 * before the FIRST column, which the bar's lead-in takes. `leadRoomSp` is how far the first column may come
 * toward the barline (the lead-in's own clearance), in staff spaces.
 */
export function withSpineSpace(
  measure: Measure, columns: Column[], spaces: SpineColumnSpaces | undefined, leadRoomSp: number,
): { columns: Column[]; leadIn: number } {
  if (!spaces || spaces.size === 0) return { columns, leadIn: 0 }
  let leadIn = 0
  let out = columns
  columns.forEach((column, i) => {
    const space = spaces.get(spacingPositionKey(measure.id, column.beat)) ?? 0
    if (space === 0) return
    if (i === 0) leadIn = Math.max(-leadRoomSp, space)
    else out = withSpaceBefore(out, i, space)
  })
  return { columns: out, leadIn }
}

/**
 * The columns with `space` staff spaces reserved in the gap BEFORE column `i` (`i` ≥ 1) — + into its `authored`
 * gap, − out of the SPRING the column before owns. Shared with the barline's space (`./spineBarlineSpace`).
 */
export function withSpaceBefore(columns: Column[], i: number, space: number): Column[] {
  if (space === 0 || i < 1 || i >= columns.length) return columns
  const out = [...columns]
  if (space > 0) {
    out[i] = { ...out[i], authored: out[i].authored + space }
    return out
  }
  // ⭐ TIGHTER takes it out of the gap's SPRING — the column BEFORE owns it (`Column.springScale`) — so the
  //    solve's own floor holds the ink apart, in the DRAWN gap: on a justified circle every spring is
  //    stretched, and the note keeps moving until its ink actually meets the one before (his report,
  //    2026-09-28: the first cut took it off a fixed amount measured AT REST — the picture stopped with
  //    the notes still well apart). Past a spring of 0 there is nothing left to take.
  const before = out[i - 1]
  const spring = followingSpace(before.duration) * (before.springScale ?? 1)
  if (spring <= 0) return out
  out[i - 1] = { ...before, springScale: (before.springScale ?? 1) * Math.max(0, 1 + space / spring) }
  return out
}
