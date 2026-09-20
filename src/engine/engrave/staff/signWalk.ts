/**
 * ⭐⭐ **WHERE A BAR'S SIGNS STAND — the walk that lays them out along the staff.**
 * S4b1 of `docs/history/vexflow-removal-map.md`.
 *
 * A port of VexFlow's `Stave.format()` (`stave.js:374–450`, MIT), transcribed step for step so every
 * position comes out as it did — ⛔ no pixel moves. The OPENING signs are walked in from the bar's left
 * edge (barline, clef, key, meter), the CLOSING ones back from its right edge (meter, key, barline,
 * clef). What the walk leaves behind is where each sign stands and where the notes may start and end.
 *
 * ⭐ **What changed is WHO answers the inputs.** VexFlow read each sign's padding and width off its own
 * objects, measured at run time. Here they arrive as values ({@link WalkSign}) that our signs hold —
 * the clef's and meter's from `../header/clefSign` and `../header/meterSign`, a barline's from
 * `./barlineMetrics`.
 *
 * ⚠️ **Most of what it places is placed AGAIN** by `rendering/headerPlacementPass` — the line-opening
 * clef and every meter are set from ink. What the walk alone decides today: the opening barline (on the
 * boundary), a MID-LINE clef change (5 px after it — `./barlineMetrics`), the CLOSING signs, and the note
 * area's end.
 */
import type { SignKind } from './signRun'
import { BARLINE_ROWS, type BarlineKind, type BarlineLayoutMetrics } from './barlineMetrics'

/** One sign, as the walk needs it. */
export interface WalkSign {
  readonly kind: SignKind
  /**
   * The sign's padding — ⚠️ what `StaveModifier.getPadding(index)` answers only from the THIRD sign of a
   * walk on; the first two get none (`stavemodifier.js:39`).
   */
  readonly padding: number
  /** How wide the sign is walked, in px. */
  readonly width: number
  /** A barline's layout metrics — the closing walk steps over a barline by these instead. */
  readonly layout?: BarlineLayoutMetrics
  /** Which barline, for a barline — the opening walk treats a start repeat specially. */
  readonly barline?: BarlineKind
}

/** Where the walk put everything. Each array is in the order its signs were given. */
export interface SignWalk {
  readonly opening: readonly number[]
  readonly closing: readonly number[]
  readonly noteStartX: number
  readonly noteEndX: number
}

/** The opening walk's order — `SORT_ORDER_BEG_MODIFIERS`. A kind with no row keeps its place. */
const OPENING_ORDER: Partial<Record<SignKind, number>> = { barline: 0, clef: 1, meter: 3 }
/** The closing walk's order — `SORT_ORDER_END_MODIFIERS`: a closing meter stands OUTSIDE the barline. */
const CLOSING_ORDER: Partial<Record<SignKind, number>> = { meter: 0, barline: 2, clef: 3 }

interface Entry {
  readonly sign: WalkSign
  /** The sign's place in the list it was given, or -1 for one the walk invents and draws nowhere. */
  readonly index: number
}

/**
 * ⭐ Walk a bar's signs. `x` and `width` are the bar's; `opening` and `closing` are its signs in the
 * order they were added, and ⚠️ the FIRST of each must be the bar's own barline (a stave always has one
 * at each end), as VexFlow's `modifiers[0]` and `modifiers[1]` were.
 */
export function walkSigns(
  x: number, width: number, opening: readonly WalkSign[], closing: readonly WalkSign[],
): SignWalk {
  const openingXs = opening.map(() => 0)
  const closingXs = closing.map(() => 0)

  // ── The opening walk, left to right. ──
  const begin: Entry[] = opening.map((sign, index) => ({ sign, index }))
  sortByKind(begin, OPENING_ORDER)
  if (begin.length > 1 && opening[0]?.barline === 'repeatBegin') {
    // A start repeat stands AFTER the header, with a plain line on the boundary in front of it.
    begin.push(begin.splice(0, 1)[0])
    begin.splice(0, 0, { sign: inventedBarline('single'), index: -1 })
  }
  let offset = 0
  let cursor = x
  for (let i = 0; i < begin.length; i++) {
    const { sign, index } = begin[i]
    const padding = paddingAt(sign, i + offset)
    const signWidth = sign.width
    cursor += padding
    if (index >= 0) openingXs[index] = cursor
    cursor += signWidth
    if (padding + signWidth === 0) offset--
  }
  const noteStartX = cursor

  // ── The closing walk, right to left. ──
  cursor = x + width
  const end: Entry[] = closing.map((sign, index) => ({ sign, index }))
  sortByKind(end, CLOSING_ORDER)
  const ownBarline = end.find(entry => entry.index === 0)
  if (ownBarline && end.indexOf(ownBarline) > 0) {
    // Something stands outside the barline: the walk starts from an empty barline on the edge.
    end.splice(0, 0, { sign: inventedBarline('none'), index: -1 })
  }
  let lastBarline = 0
  for (let i = 0; i < end.length; i++) {
    const { sign, index } = end[i]
    lastBarline = sign.kind === 'barline' ? i : lastBarline
    let right = 0
    let left = 0
    let paddingRight = 0
    let paddingLeft = 0
    if (sign.layout) {
      if (i !== 0) {
        right = sign.layout.xMax
        paddingRight = sign.layout.paddingRight
      }
      left = -sign.layout.xMin
      paddingLeft = sign.layout.paddingLeft
      if (i === end.length - 1) paddingLeft = 0
    } else {
      paddingRight = paddingAt(sign, i - lastBarline)
      if (i !== 0) right = sign.width
      if (i === 0) left = sign.width
    }
    cursor -= paddingRight
    cursor -= right
    if (index >= 0) closingXs[index] = cursor
    cursor -= left
    cursor -= paddingLeft
  }
  const noteEndX = end.length === 1 ? x + width : cursor

  return { opening: openingXs, closing: closingXs, noteStartX, noteEndX }
}

/** `StaveModifier.getPadding(index)`: nothing for the first two signs of a walk, the sign's own after. */
function paddingAt(sign: WalkSign, index: number): number {
  return index < 2 ? 0 : sign.padding
}

/** `Stave.sortByCategory` — a bubble sort, so signs of one kind keep the order they were added in. */
function sortByKind(entries: Entry[], order: Partial<Record<SignKind, number>>): void {
  for (let i = entries.length - 1; i >= 0; i--) {
    for (let j = 0; j < i; j++) {
      // An unlisted kind compares as NaN, which is never greater — so it never moves, as in VexFlow.
      if ((order[entries[j].sign.kind] ?? NaN) > (order[entries[j + 1].sign.kind] ?? NaN)) {
        const earlier = entries[j]
        entries[j] = entries[j + 1]
        entries[j + 1] = earlier
      }
    }
  }
}

/** A barline the walk needs but no bar draws — the `new Barline(...)` of `format()`. */
function inventedBarline(kind: BarlineKind): WalkSign {
  const row = BARLINE_ROWS[kind]
  return { kind: 'barline', barline: kind, padding: row.padding, width: row.width, layout: row.layout }
}
