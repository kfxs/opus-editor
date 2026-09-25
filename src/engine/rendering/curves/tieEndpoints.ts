/**
 * ⭐⭐ **WHERE A TIE ATTACHES** — the tie's twin of `./slurStemEndpoint`, and the last of its
 * placement decisions to come back from VexFlow (docs/plans/slur-plan.md §13.3, his call 2026-08-16).
 *
 * ⭐ **The x, and why it moved.** We used VexFlow's `getTieRightX()` / `getTieLeftX()` — the head's
 * outer edges, plus whatever modifiers hang off the note — so a tie spanned the GAP between two
 * noteheads and touched neither. The three engines all place it over the heads instead, and they
 * disagree only about how far in:
 *
 * | | the tie's x |
 * |---|---|
 * | MuseScore | the head's **optical centre** — the mean of Bravura's `cutOutNW`/`NE` anchors, 0.1 sp inward |
 * | LilyPond | a skyline of the chord, resolving to **¾ across** the head (`0.25·L + 0.75·R`) |
 * | **Verovio** | the head's **centre ± 0.25 sp** — `startPoint.x += r1 + unit/2`, `endPoint.x -= r2 + unit/2` (`src/tie.cpp:381, 391`) |
 * | Gould p. 62 | *"the tie starts and finishes at the **centre of the notehead**"*, aligning with its edge only when it must come closer |
 *
 * **His call: Verovio's**, and it is the one that reads as a decision rather than a default — a
 * quarter space in from the centre, the same number at both ends. 🚨 Note that §13.3 recorded this
 * as *"the outer edge, 0.25 sp **outward**"*, which is a misreading of the same lines: the code
 * moves **inward from the centre**. Reading it again is what caught that.
 *
 * ⏭️ **Not taken:** Verovio's stem-side variant for a short tie (from the head's outer edge + 0.25
 * sp when the stem is on the tie's side, `:88–98`), and its `tieMinLength` spacing rod (§13.7).
 *
 * ✅ **The y is unchanged and settled** (§13.3): 0.70 sp from the head's CENTRE, which is 0.20 sp
 * clear of its edge — MuseScore's `yOffset` exactly, and Gould's *"should almost touch each
 * notehead"*. ⛔ Do not "fix" it. It lives here so that both of a tie's coordinates are decided in
 * one place, the way the slur's are.
 */
import { CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** One end of a tie, as the numbers this module needs — the drawn notehead, in px. */
export interface TieHead {
  /** The notehead's own extent (`getNoteHeadBeginX/EndX`), NOT the tie edges. */
  leftX: number
  rightX: number
  /** The notehead's centre y. */
  headY: number
  /**
   * ⭐ When this head is PARENTHESISED, the OUTER ink edge of the bracket on the tie's side — `)` at the
   * tie's start, `(` at its end, px. The tie runs OUTSIDE its brackets (Gould p. 610: the tie to the next
   * bar leaves after `)`, the incoming one ends at `(`; MuseScore's tie clears them too — research B.5,
   * A.4). Absent = a bare head.
   */
  bracketX?: number
  /**
   * ⭐ The right edge of the note's LAST augmentation dot, px, and the white a tie leaves after it — set only
   * when the armed `layout/dotTie` row starts a tie AFTER the dots (P4g, Gerou & Lusk). Absent = the tie
   * springs from inside the head, the dot within its arc (Gould p. 63).
   */
  dotsRightX?: number
  dotsClearancePx?: number
  /** ⭐ The head's size — 1, or a CUE note's (cue-size-plan P5): the tie keeps its 0.20 sp from the SMALL head's
   *  edge ({@link tieEndpointY}). Absent = 1. */
  headScale?: number
}

/** ⭐ The white between a bracket's ink and the tie that leaves it, STAFF SPACES. ⏳ UNSOURCED — Gould p. 610 draws
 *  it (the tie leaves after `)`) but was not measured; a row, for his eye. */
export const TIE_BRACKET_CLEARANCE_SP = 0.2

/** Where the arc springs from (`from`) or lands (`to`): a quarter space in from the head's centre,
 *  toward the other end. */
export function tieEndpointX(head: TieHead, end: 'from' | 'to', spacePx = STAFF_SPACE_PX): number {
  const centre = (head.leftX + head.rightX) / 2
  const clearance = TIE_BRACKET_CLEARANCE_SP * spacePx
  // ⭐ …or, for a PARENTHESISED head, just outside its bracket.
  const pastDots = head.dotsRightX === undefined ? -Infinity : head.dotsRightX + (head.dotsClearancePx ?? 0)
  return end === 'from'
    ? Math.max(centre + CURVE_PX.tieEndpointInset, head.bracketX === undefined ? -Infinity : head.bracketX + clearance, pastDots)
    : Math.min(centre - CURVE_PX.tieEndpointInset, head.bracketX === undefined ? Infinity : head.bracketX - clearance)
}

/** Half a notehead's height, staff spaces — Bravura's `noteheadBlack` (0.5 up, 0.5 down), the head the
 *  settled `tieLift` (0.70 = this + 0.20 of white) was stated against. */
const HEAD_HALF_HEIGHT_SP = 0.5

/**
 * The flat y both endpoints share: lifted off the notehead's centre, on the side the tie bows.
 *
 * ⭐ **0.20 sp clear of the head's EDGE** — `tieLift` (0.70 from the centre) is exactly that for a full head.
 * A CUE head is smaller, so the tie comes in with it: half the DRAWN head plus the same 0.20 — MuseScore's
 * own statement (`slurtielayout.cpp:1745–1763`: `note->height() / 2 + 0.20 sp`), and Gould's *"should almost
 * touch each notehead"* read against the head that is there. A full head moves nothing.
 */
export function tieEndpointY(headY: number, direction: number, headScale = 1): number {
  const smallerBy = (1 - headScale) * HEAD_HALF_HEIGHT_SP * STAFF_SPACE_PX
  return headY + (CURVE_PX.tieLift - smallerBy) * direction
}
