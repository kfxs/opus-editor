/**
 * SPEC FIXTURE — plain notes in LilyPond's space (staff spaces, y up, middle line at 0), shared by this
 * folder's specs. ⛔ Not imported by the engine.
 */
import type { Interval } from './bezier'
import type { SearchColumn, SearchObject, SlurSearchInput } from './searchState'

const HEAD_W = 1.18
const STEM_W = 0.12
const STEM_LEN = 3.5

/** A one-head column: its head's left edge at `x`, on staff position `pos` (half-spaces from the middle). */
export function column(x: number, pos: number, stemDir: 1 | -1 | 0): SearchColumn {
  const c = pos / 2
  const head = { x: [x, x + HEAD_W] as Interval, y: [c - 0.5, c + 0.5] as Interval }
  if (stemDir === 0) return { x: head.x, y: head.y, refX: x, firstHeadX: head.x, slurHead: head }
  const sx: Interval = stemDir > 0 ? [x + HEAD_W - STEM_W, x + HEAD_W] : [x, x + STEM_W]
  const sy: Interval = stemDir > 0 ? [c, c + STEM_LEN] : [c - STEM_LEN, c]
  return {
    x: [Math.min(head.x[0], sx[0]), Math.max(head.x[1], sx[1])],
    y: [Math.min(head.y[0], sy[0]), Math.max(head.y[1], sy[1])],
    refX: x, firstHeadX: head.x, slurHead: head,
    stem: { dir: stemDir, x: sx, y: sy, invisible: false, refX: sx[0], refY: c, beamsLeft: false, beamsRight: false },
  }
}

/** A flat before a head on `pos`, its left edge at `x`: Bravura's 0.904 sp wide, ascender 1.756 sp above. */
export function flat(x: number, pos: number): SearchObject {
  const c = pos / 2
  return { x: [x, x + 0.904], y: [c - 0.65, c + 1.756], avoid: 'inside', sign: 'accidental', alteration: 'flat' }
}

export const STAFF = { middleY: 0, linePositions: [-4, -2, 0, 2, 4] }

/** His example of 2026-09-27: B4 E(♭)5 | A4 D5 G5, slurred above, the flat 1.81 sp from the start. */
export function hisSlur(withFlat: boolean, eFlatX = 3.3): SlurSearchInput {
  const columns = [column(0, 0, -1), column(eFlatX, 3, -1), column(7, -1, 1), column(9, 2, -1), column(11, 5, -1)]
  return {
    dir: 1, columns,
    objects: withFlat ? [flat(eFlatX - 1.0, 3)] : [],
    nestedSlurs: [], tieEnds: [], staff: STAFF,
    endHeadY: [0, 2.5],
  }
}
