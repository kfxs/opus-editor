/**
 * ⭐⭐ **A SYSTEM OF STAVES ON ONE PATH** — port map #12 of `docs/plans/bent-staff-plan.md`.
 *
 * The spine is the TOP staff's top line. Every other staff of the system is the SAME path, further
 * down by the page's own distance (`layout/staffStride.systemStaffTops` — its lines plus the staff gap),
 * drawn as a spine of its own (`staffSpine.parallelSpine`). Round a circle "down" is inward, so the
 * second staff is the inner ring, as the page's order top → bottom is the loop's outside → inside.
 *
 * ⭐ **One spacing for the system, mapped by ANGLE.** The columns are the page's, shared by every staff
 * (`layout/measureColumns` already holds all staves at a beat), spaced once along the reference path
 * (`./spineSpacing`). A staff whose own path is `ratio` as long stands each column at `s × ratio` — so
 * the same beat on every staff lies on one radius, as it lies on one vertical on the page.
 *
 * ⚠️ Placeholder, named: every staff is drawn FULL SIZE (a small staff's `size` is not read yet).
 */
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio, parallelSpine } from '@/engine/engrave/staff/staffSpine'
import { spacingAbovePx, systemStaffTops } from '@/engine/layout/staffStride'
import { resolveStaffSpacingAbove } from '@/engine/models/engravingOverrides'
import { firstStaffId, getStaves } from '@/engine/models/staffContent'
import type { Score } from '@/types/music'
import type { SpineBar } from './spineSpacing'

/** One staff of the system as it stands on the path. */
export interface SpineStaff {
  /** The staff's id — `undefined` for a score with no staff list (its one staff). */
  id: string | undefined
  /** Its index in the system, top = 0. */
  index: number
  /** How far below the reference path its top line stands, px. */
  top: number
  /** Its own path — the reference one, `top` further down. */
  spine: Spine
  /** How long its path is against the reference one — what a reference `s` is multiplied by here. */
  ratio: number
}

/**
 * Every staff's top below the TOP staff's top line, px, keyed by id — the page's own vertical arithmetic,
 * with the hand's STAFF SPACING (his ask, 2026-09-27: *"what about distance between staffs?"*): the
 * space-above each staff carries, resolved as the page resolves its FIRST system's — the spine is one
 * system, and it opens at bar 1. The top staff's own space-above moves nothing: there is no staff above it.
 */
export function spineStaffTops(score: Score): Map<string | undefined, number> {
  const ids = staffIdsOf(score)
  const opener = score.measures[0]?.id
  const above = ids.map((id, i) => (i > 0 && id ? spacingAbovePx(resolveStaffSpacingAbove(score, id, opener), 1) : 0))
  const { topPx } = systemStaffTops(ids.map(() => 1), above)
  return new Map(ids.map((id, i) => [id, topPx[i]]))
}

/** The system's staves, top first, each on its own path parallel to `spine`. */
export function spineStaves(score: Score, spine: Spine): SpineStaff[] {
  const tops = spineStaffTops(score)
  return staffIdsOf(score).map((id, index) => {
    const top = tops.get(id) ?? 0
    return { id, index, top, spine: parallelSpine(spine, top), ratio: innerLengthRatio(spine, top) }
  })
}

/** A bar spaced on the reference path, as it stands on a staff whose path is `ratio` as long. */
export function barOnStaff(bar: SpineBar, ratio: number): SpineBar {
  if (ratio === 1) return bar
  return {
    start: bar.start * ratio,
    end: bar.end * ratio,
    columnAt: beat => bar.columnAt(beat) * ratio,
    musicStart: bar.musicStart * ratio,
    columns: bar.columns,
  }
}

/** The system's staff ids, top first — `[firstStaffId]` for a score with no staff list. */
export function staffIdsOf(score: Score): (string | undefined)[] {
  const staves = getStaves(score)
  return staves.length > 0 ? staves.map(staff => staff.id) : [firstStaffId(score)]
}
