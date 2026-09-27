/**
 * ⭐ **ONE SLUR'S PROBLEM, as LilyPond states it** — `Slur_score_state::fill` and what it calls
 * (`lily/slur-scoring.cc`, LilyPond 2.27.3; GPL-3.0-or-later, see `NOTICE`): the base attachment of each
 * end, how far each end may move, the notes and objects the curve must clear, and every candidate pair of
 * ends. Each function names the one it transcribes.
 *
 * ⭐ **LILYPOND'S SPACE**: every length in STAFF SPACES and **y UP**; `dir` is +1 for a slur ABOVE the notes,
 * −1 below; a bound's side `d` is −1 (LEFT) / +1 (RIGHT). The renderer's adapter (P3) converts in and out;
 * ⛔ nothing here knows a pixel, a stave or a DOM.
 *
 * ⛔ **What the adapter already reduced**: a grob here is a plain record of the extents LilyPond would have
 * asked of it.
 *
 * ⭐ **A BROKEN slur** (P6) is searched one system's PIECE at a time, as LilyPond does: an end at a line break
 * has no note — it is the system's edge ({@link SlurSearchInput.brokenX}), its height taken from the nearest
 * column on this system (the no-column branch of `get_base_attachments`), and a broken piece does not follow
 * the music's rise (`musical_dy_` is 0 and three slope demerits are off). ⚠️ The edge x is the ADAPTER's
 * answer to `breakable_bound_extent`: LilyPond unites the inside objects standing in the break's column.
 */
import {
  type Bezier, type Interval, type Offset,
  at, center, contains, curvePoint, isEmpty, length, linearInterpolate, minmax, normalize, roundHalfwayUp,
  sub, direction as unit, widen, intersect,
} from './bezier'
import type { SlurSearchDetails } from './searchDetails'

/** A stem, as `Bound_info` / `get_encompass_info` read it. */
export interface SearchStem {
  /** +1 up, −1 down. */
  dir: number
  /** The stem's own extent — ⚠️ EMPTY when it draws nothing (a whole note's stem is invisible). */
  x: Interval
  y: Interval
  /** `Note_column::get_flag` — united into the BOUND's stem extent, not the encompass one. */
  flag?: { x: Interval; y: Interval }
  /** `Stem::is_invisible`. */
  invisible: boolean
  /** Where the stem's position is when its extent is empty (`relative_coordinate`). */
  refX: number
  refY: number
  /** The beam it belongs to, if any. */
  beam?: {
    /** Identity — `has_same_beam_` compares the two ends' beams. */
    id: string
    /** `Beam::get_beam_thickness`. */
    thickness: number
    /** `spanner_less (slur, beam)` — the beam strictly outlasts the slur on both sides. */
    containsSlur: boolean
  }
  /** `Stem::get_beaming (stem, LEFT)` / `(stem, RIGHT)` — does a beam leave the stem on that side. */
  beamsLeft: boolean
  beamsRight: boolean
}

/** A note column under the slur — its ends included (LilyPond's `note-columns`). */
export interface SearchColumn {
  /** The whole column's extent. */
  x: Interval
  y: Interval
  /** The column's own reference x (`relative_coordinate`) — where a column with no stem is. */
  refX: number
  /** `Note_column::first_head`'s x extent, if it has a head. */
  firstHeadX?: Interval
  /** The head on the SLUR'S side — `Stem::extremal_heads (stem)[dir]` (or `Note_column::extremal_heads`
   *  for a stemless column), else the column's rest: its x and y extent. */
  slurHead?: { x: Interval; y: Interval }
  stem?: SearchStem
}

/** An object the slur avoids — LilyPond's `encompass-objects` that are not slurs or ties. */
export interface SearchObject {
  /** The object's extents, UNWIDENED — the search widens them by the slur's thickness itself. */
  x: Interval
  y: Interval
  /** `avoid-slur`: stay under the curve (`inside`), or keep clear of the curve either way (`around`). */
  avoid: 'inside' | 'around'
  /** What it is, where LilyPond treats it specially. */
  sign?: 'accidental' | 'dots' | 'headerSign'
  /** An accidental's alteration — it picks WHERE along the sign the curve is checked (a flat at its
   *  tall left end). ⚠️ Only for a plain accidental: a styled, parenthesised or cautionary-restore one
   *  is checked at its middle (`get_extra_encompass_infos`). */
  alteration?: 'flat' | 'doubleFlat' | 'sharp' | 'natural'
}

/** A slur nested under this one (`encompass-objects` that are slurs). */
export interface SearchNestedSlur {
  curve: Bezier
  /** It starts / ends on the same note as this slur — only then is that end of it counted. */
  sharesLeft: boolean
  sharesRight: boolean
}

/** Everything one slur's search is asked — see the header for the space. */
export interface SlurSearchInput {
  /** +1 above, −1 below — decided before the search (`slurDirection`). */
  dir: number
  /** The note columns in order; the first and last are the slur's ends. */
  columns: readonly SearchColumn[]
  objects: readonly SearchObject[]
  nestedSlurs: readonly SearchNestedSlur[]
  /** The ends of ties among the encompass objects — a slur end ON one is demerited. */
  tieEnds: readonly Offset[]
  /** The staff: its middle line's y, and its lines' positions in half-spaces from it (5 lines: −4…4). */
  staff: { middleY: number; linePositions: readonly number[] }
  /** The two end notes' heads' y (`slur_head_->relative_coordinate`) — the music's own rise. ⚠️ Ignored for
   *  a broken piece, whose rise is 0. */
  endHeadY: readonly [number, number]
  /**
   * ⭐ A PIECE of a broken slur: the x of each end that is a LINE BREAK rather than a note (LEFT, RIGHT) —
   * undefined for an end on a note. `columns` are then this system's columns only, and a broken side's
   * nearest column is NOT a bound: the curve must get over it.
   */
  brokenX?: readonly [number | undefined, number | undefined]
}

/** `Extra_collision_info`. */
export interface ExtraCollision {
  /** Where along the object's x the curve is checked, −1…1. */
  idx: number
  x: Interval
  y: Interval
  penalty: number
  avoid: 'inside' | 'around'
  /** The object's own x, unwidened — `score_extra_encompass` checks it against the end heads. */
  rawX?: Interval
  headerSign: boolean
}

/** `Encompass_info` — the head nearest the slur and, on the slur's side, the stem's end. */
export interface EncompassInfo { x: number; head: number; stem: number }

/** `Bound_info`, reduced. */
export interface BoundInfo {
  stem?: SearchStem
  /** The bound's stem extent — with its FLAG — or a point at the stem when it draws nothing. */
  stemExtent?: { x: Interval; y: Interval }
  slurHead?: { x: Interval; y: Interval }
  /** The bound's note column — ⚠️ none at a LINE BREAK. */
  column?: SearchColumn
}

/** The state every candidate is scored against. */
export interface SlurSearchState {
  dir: number
  details: SlurSearchDetails
  /** [LEFT, RIGHT]. */
  bounds: readonly [BoundInfo, BoundInfo]
  baseAttachments: readonly [Offset, Offset]
  encompassInfos: EncompassInfo[]
  extraInfos: ExtraCollision[]
  /** The avoid-points the ARCH is raised over (`generate_avoid_offsets`). */
  avoid: Offset[]
  tieEnds: readonly Offset[]
  staff: SlurSearchInput['staff']
  musicalDy: number
  /** `is_broken_` — one end or both is a line break. */
  isBroken: boolean
  edgeHasBeams: boolean
  /** `thickness_` — the slur's own thickness in staff spaces. */
  thickness: number
  lineThickness: number
  /** Each candidate pair of ends, in enumeration order. */
  attachments: Array<readonly [Offset, Offset]>
}

const LEFT = 0, RIGHT = 1
/** −1 / +1 for an index. */
const side = (i: number) => (i === LEFT ? -1 : 1)

/** `get_encompass_info`. */
export function encompassInfo(col: SearchColumn, dir: number): EncompassInfo {
  const stem = col.stem
  if (!stem) {
    const y = at(col.y, dir)
    return { x: col.refX, head: y, stem: y }
  }
  let x: number
  if (col.firstHeadX) x = isEmpty(col.firstHeadX) ? 0 : center(col.firstHeadX)
  else x = center(col.x)
  const h = col.slurHead
  if (!h) {
    const y = at(col.y, dir)
    return { x, head: y, stem: y }
  }
  const head = at(h.y, dir)
  if (stem.dir === dir && !isEmpty(stem.y)) {
    let stemY = at(stem.y, dir)
    if (stem.beam) stemY += stem.dir * 0.5 * stem.beam.thickness
    x = isEmpty(stem.x) ? stem.refX : center(stem.x)
    return { x, head, stem: stemY }
  }
  return { x, head, stem: head }
}

/** `get_bound_info` for one end. */
function boundInfo(col: SearchColumn): BoundInfo {
  const stem = col.stem
  if (!stem) return { column: col, slurHead: col.slurHead }
  const extent = (axis: 'x' | 'y'): Interval => {
    let s = stem[axis]
    if (stem.flag) s = [Math.min(s[0], stem.flag[axis][0]), Math.max(s[1], stem.flag[axis][1])]
    if (isEmpty(s)) {
      const ref = axis === 'x' ? stem.refX : stem.refY
      return [ref, ref]
    }
    return s
  }
  return { column: col, stem, stemExtent: { x: extent('x'), y: extent('y') }, slurHead: col.slurHead }
}

/** `Stem::get_beaming (stem, -d)` for bound index `i` — beams leaving the stem toward the slur's inside. */
const beamsInward = (stem: SearchStem, i: number) => (i === LEFT ? stem.beamsRight : stem.beamsLeft)

/** `move_away_from_staffline` — an attachment sitting on a line is nudged 0.15 sp off it. */
export function moveAwayFromStaffline(y: number, staff: SlurSearchInput['staff'], dir: number): number {
  const pos = (y - staff.middleY) * 2
  if (Math.abs(pos - roundHalfwayUp(pos)) < 0.2 && staff.linePositions.includes(Math.trunc(Math.round(pos)))) {
    return y + (1.5 * dir) / 10
  }
  return y
}

/** `get_base_attachments` — each end on a note first, then each end at a line break. */
function baseAttachments(
  bounds: readonly [BoundInfo, BoundInfo], dir: number, staff: SlurSearchInput['staff'], sameBeam: boolean,
  columns: readonly SearchColumn[], brokenX: SlurSearchInput['brokenX'],
): [Offset, Offset] {
  const base = [LEFT, RIGHT].map(i => {
    const { stem, slurHead: head, column } = bounds[i]
    if (!column) return { x: 0, y: 0 }
    let y = 0
    if (stem && !stem.invisible && stem.dir === dir && beamsInward(stem, i) && stem.beam
      && (!stem.beam.containsSlur || sameBeam)) {
      y = at(bounds[i].stemExtent!.y, dir)
    } else if (head) {
      y = at(head.y, dir)
    }
    y += dir * 0.5
    y = head ? moveAwayFromStaffline(y, staff, dir) : y
    let x = center(column.firstHeadX ?? column.x)
    if (!Number.isFinite(x)) x = center(column.x)
    if (!Number.isFinite(y)) y = center(column.y)
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
  }) as [Offset, Offset]
  // The no-column branch: the edge's x, and the height of this system's column nearest the break — or, when
  // that column IS the other end's note, the other end's own height.
  for (const i of [LEFT, RIGHT]) {
    if (bounds[i].column) continue
    const col = i === LEFT ? columns[0] : columns[columns.length - 1]
    let y: number
    if (bounds[1 - i].column !== col) y = at(col.y, dir) + dir * 0.5
    else y = base[1 - i].y
    y = moveAwayFromStaffline(y, staff, dir)
    const x = brokenX?.[i] ?? 0
    base[i] = { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
  }
  return base
}

/** `get_y_attachment_range` — how far out each end may go. */
function yAttachmentRange(
  bounds: readonly [BoundInfo, BoundInfo], base: readonly [Offset, Offset], dir: number, details: SlurSearchDetails,
): [number, number] {
  return [LEFT, RIGHT].map(i => {
    // A line break has no note column: the full region, outward from its base.
    const nc = bounds[i].column?.y
    if (!nc || isEmpty(nc)) return base[i].y + details.regionSize * dir
    return dir * Math.max(
      Math.max(dir * (base[i].y + details.regionSize * dir), dir * (dir + at(nc, dir))),
      dir * base[1 - i].y,
    )
  }) as [number, number]
}

/** `get_extra_encompass_infos`. */
function extraEncompassInfos(input: SlurSearchInput, details: SlurSearchDetails, thickness: number): ExtraCollision[] {
  const infos: ExtraCollision[] = []
  for (const nested of input.nestedSlurs) {
    for (let k = 0; k < 3; k++) {
      const hdir = k - 1
      if ((hdir === -1 && !nested.sharesLeft) || (hdir === 1 && !nested.sharesRight)) continue
      const z = curvePoint(nested.curve, k / 2)
      // A full interval with this side's end set just outside the nested curve.
      const yext: [number, number] = [-Infinity, Infinity]
      yext[input.dir < 0 ? 0 : 1] = z.y + input.dir * thickness
      infos.push({
        idx: hdir, x: [z.x - thickness * 2, z.x + thickness * 2], y: yext,
        penalty: details.extraObjectCollisionPenalty, avoid: 'inside', headerSign: false,
      })
    }
  }
  for (const o of input.objects) {
    let ye = o.y
    if (o.sign === 'dots') ye = widen(ye, 0.2)
    let idx = 0
    let penalty = details.extraObjectCollisionPenalty
    if (o.sign === 'accidental') {
      penalty = details.accidentalCollision
      if (o.alteration === 'flat' || o.alteration === 'doubleFlat') idx = -1
      else if (o.alteration === 'sharp') idx = 0.5 * input.dir
      else if (o.alteration === 'natural') idx = -input.dir
    }
    infos.push({
      idx, x: widen(o.x, thickness), y: widen(ye, thickness * 0.5), penalty, avoid: o.avoid,
      rawX: o.x, headerSign: o.sign === 'headerSign',
    })
  }
  return infos
}

/** `generate_avoid_offsets` — the points the ARCH is raised over. */
function avoidOffsets(
  input: SlurSearchInput, details: SlurSearchDetails, infos: readonly EncompassInfo[],
  bounds: readonly [BoundInfo, BoundInfo],
): Offset[] {
  const dir = input.dir
  const avoid: Offset[] = []
  // Every column but those the slur is attached to — ⚠️ at a line break the nearest column is not one.
  for (let i = 0; i < infos.length; i++) {
    if (input.columns[i] === bounds[LEFT].column || input.columns[i] === bounds[RIGHT].column) continue
    const inf = infos[i]
    const y = dir * Math.max(dir * inf.head, dir * inf.stem)
    avoid.push({ x: inf.x, y: y + dir * details.freeHeadDistance })
  }
  for (const nested of input.nestedSlurs) {
    const z = curvePoint(nested.curve, 0.5)
    avoid.push({ x: z.x, y: z.y + dir * details.freeSlurDistance })
  }
  for (const o of input.objects) {
    if (o.avoid !== 'inside' || isEmpty(o.x) || isEmpty(o.y)) continue
    avoid.push({ x: center(o.x), y: at(o.y, dir) })
  }
  return avoid
}

/** `enumerate_attachments` — every (left, right) pair of ends, in half-space steps. */
function enumerateAttachments(
  bounds: readonly [BoundInfo, BoundInfo], base: readonly [Offset, Offset], endYs: readonly [number, number],
  dir: number, details: SlurSearchDetails,
): Array<readonly [Offset, Offset]> {
  const out: Array<readonly [Offset, Offset]> = []
  const os: [Offset, Offset] = [{ ...base[LEFT] }, { ...base[RIGHT] }]
  while (dir * os[LEFT].y <= dir * endYs[LEFT]) {
    os[RIGHT] = { ...base[RIGHT] }
    while (dir * os[RIGHT].y <= dir * endYs[RIGHT]) {
      const attachToStem = [false, false]
      for (const i of [LEFT, RIGHT]) {
        const d = side(i)
        os[i].x = base[i].x
        const { stem, stemExtent } = bounds[i]
        if (stem && stemExtent && !stem.invisible && stem.dir === dir) {
          if (contains(widen(stemExtent.y, 0.25), os[i].y)) {
            os[i].x = at(stemExtent.x, -d) - d * 0.3
            attachToStem[i] = true
          } else if (dir * at(stemExtent.y, dir) < dir * os[i].y && !isEmpty(stemExtent.x)) {
            os[i].x = center(stemExtent.x)
          }
        }
      }
      let dz = sub(os[RIGHT], os[LEFT])
      if (dz.x < details.minimumLength || Math.abs(dz.y / dz.x) > details.maxSlope) {
        for (const i of [LEFT, RIGHT]) {
          const head = bounds[i].slurHead
          if (head && !isEmpty(head.x)) {
            os[i].x = center(head.x)
            attachToStem[i] = false
          }
        }
      }
      dz = unit(sub(os[RIGHT], os[LEFT]))
      for (const i of [LEFT, RIGHT]) {
        const head = bounds[i].slurHead
        // Tilted slurs move a little sideways — more for bigger tilts.
        if (head && !attachToStem[i]) os[i].x -= (dir * length(head.x) * dz.y) / 3
      }
      out.push([{ ...os[LEFT] }, { ...os[RIGHT] }])
      os[RIGHT].y += dir / 2
    }
    os[LEFT].y += dir / 2
  }
  return out
}

/** `Slur_score_state::fill` — a whole slur, or one system's piece of a broken one. */
export function buildSearchState(input: SlurSearchInput, details: SlurSearchDetails): SlurSearchState {
  const { dir, columns } = input
  const broken = input.brokenX ?? [undefined, undefined]
  const bounds: [BoundInfo, BoundInfo] = [
    broken[LEFT] === undefined ? boundInfo(columns[0]) : {},
    broken[RIGHT] === undefined ? boundInfo(columns[columns.length - 1]) : {},
  ]
  const isBroken = broken[LEFT] !== undefined || broken[RIGHT] !== undefined
  const thickness = details.thickness * details.lineThickness
  const [ls, rs] = [bounds[LEFT].stem, bounds[RIGHT].stem]
  const sameBeam = !!(ls && rs && ls.beam && rs.beam && ls.beam.id === rs.beam.id)
  const base = baseAttachments(bounds, dir, input.staff, sameBeam, columns, input.brokenX)
  const endYs = yAttachmentRange(bounds, base, dir, details)
  const extraInfos = extraEncompassInfos(input, details, thickness)

  // An `inside` object near an end widens that end's range past it.
  const additional = [0, 0]
  for (const info of extraInfos) {
    if (isEmpty(info.x)) continue
    const xc = center(info.x)
    const yPlace = linearInterpolate(xc, base[RIGHT].x, base[LEFT].x, endYs[RIGHT], endYs[LEFT])
    const encompassPlace = at(info.y, dir)
    if (info.avoid === 'inside' && minmax(dir, encompassPlace, yPlace) === encompassPlace && !info.headerSign) {
      for (const i of [LEFT, RIGHT]) {
        // ⚠️ LilyPond tests the slur's DIRECTION against `LEFT` here (−1 = DOWN), not the bound's side —
        //    so both ends take the same term. Transcribed as written.
        additional[i] = minmax(dir, additional[i],
          dir * (details.encompassObjectRangeOvershoot
            + (yPlace - encompassPlace) * (normalize(xc, base[RIGHT].x, base[LEFT].x) + (dir === -1 ? 0 : -1))))
      }
    }
  }
  const ranged: [number, number] = [endYs[LEFT] + additional[LEFT], endYs[RIGHT] + additional[RIGHT]]

  const encompassInfos = columns.map(c => encompassInfo(c, dir))
  let musicalDy = input.endHeadY[RIGHT] - input.endHeadY[LEFT]
  if (bounds.some(b => !b.slurHead)) {
    musicalDy = (bounds[RIGHT].slurHead ? input.endHeadY[RIGHT] : 0) - (bounds[LEFT].slurHead ? input.endHeadY[LEFT] : 0)
  }
  // A broken piece does not follow the music's rise.
  if (isBroken) musicalDy = 0
  return {
    dir, details, bounds, baseAttachments: base, encompassInfos, extraInfos,
    avoid: avoidOffsets(input, details, encompassInfos, bounds),
    tieEnds: input.tieEnds, staff: input.staff,
    musicalDy, isBroken,
    edgeHasBeams: !!(ls?.beam || rs?.beam),
    thickness, lineThickness: details.lineThickness,
    attachments: enumerateAttachments(bounds, base, ranged, dir, details),
  }
}

/** Re-exported for the scorers, which intersect an object with an end's head. */
export { intersect, side, LEFT, RIGHT }
