/**
 * ⭐⭐ **HOW FAR A BARLINE REACHES UP AND DOWN — one rule, for every vertical line in the score.**
 *
 * A barline runs **between the CENTRES of the two outer staff lines it connects**, ⛔ not between
 * their outer edges. For a five-line staff that makes it exactly **four staff spaces** tall, whatever
 * the lines are drawn at: ⭐ the extent is a RATIO of the staff, and the line thickness enters only as
 * the half-thickness that finds each anchor's middle.
 *
 * ## ⭐ WHERE THE RULE COMES FROM — three engines unanimous, and one of them says why
 *
 * | | |
 * |---|---|
 * | **Gould** | ⛔ **UNKNOWN.** *Behind Bars* nowhere states a barline's vertical extent at this precision — ⛔ and "the books are silent" is not the same claim: what is recorded here is that a search of the whole text found nothing, not that she declined to say. |
 * | **Ross, p. 151** | *"The lengths of barlines vary with different types of music. 1. For single-line music the barline connects the top and bottom lines of the staff."* ⚠️ Names **which lines**, ⛔ not which edge of them — so it is consistent with this rule and does not decide it. |
 * | **LilyPond** | `ly:bar-line::calc-bar-extent` (`scm/bar-line.scm:641`) takes the staff symbol's own extent — which `Staff_symbol::height` has already widened by half a line thickness to the OUTER edges — and narrows it by half a line thickness at each end. ⇒ centre to centre. |
 * | **MuseScore** | `ldata->y1 = spatium * .5 * spanFrom` (0) and `y2 = spatium * .5 * (8.0 + spanTo)` (`tlayout.cpp:1115`) ⇒ 0 to 4 spaces, top line's centre to bottom line's centre. |
 * | **Verovio** | `yStaffTop` down to `yStaffTop − 2 × (lines − 1) × unit` (`view_page.cpp:747`), a unit being half a space ⇒ the same four spaces. |
 *
 * ⭐⭐ **And LilyPond states the REASON in its own source, which is why this is a rule rather than a
 * tally of three votes:**
 *
 * > *"Due to rounding problems, bar lines extending to the outermost edges of the staff lines appear
 * > wrongly in on-screen display (and, to a lesser extent, in print) — they stick out a pixel. The
 * > solution is to extend bar lines only to the middle of the staff line."*
 *
 * ⚠️ **That is an argument about RESAMPLING, and this editor is the case it describes**: the score is
 * drawn at a fractional zoom far more often than not, and a barline whose ink ends half a staff-line
 * thickness past the staff has that overhang land on a fraction of a device pixel — visible as a
 * dark nib at the corner of the staff. It is the same family of reasoning as
 * `rendering/barlineInk.hintBarlines`, which exists because of a measured version of it.
 *
 * ## ⛔ The two riders that come WITH LilyPond's version
 *
 * 1. ⭐ **A line CONTINUING past the staff is not shortened at that end.** LilyPond reverts the
 *    narrowing on whichever side a span bar joins (`bar-line::widen-bar-extent-on-span`), so the join
 *    and the line it joins are one stroke. ⚠️ Here that falls out of the geometry instead of needing
 *    a flag: `rendering/barlineGap` draws the piece BETWEEN two staves from one staff line's centre
 *    to the other's, so it overlaps the outer half of both lines and meets the bars exactly.
 * 2. ⚠️ **A barline in a DIFFERENT COLOUR from its staff should keep the full outer extent** — the
 *    shortening is invisible only while the staff line's outer half is the same colour as the line
 *    ending inside it. ⛔ **Not implemented**, and named so nobody has to rediscover it: this editor
 *    recolours a selected barline (`reference: color selection rule`), so a selected line is 0.55 px
 *    short at each end against black staff lines. Below the threshold his eye has ever reported, and
 *    a fix would have to reach the SELECTION, not the engraving.
 */

import { staffLineMidY } from './staffLines'

/** The vertical run of one barline's ink, in the coordinates its staff was measured in. */
export interface BarlineExtent {
  topY: number
  bottomY: number
}

/**
 * ⭐ **THE RULE** — from the top line's middle to the bottom line's middle.
 *
 * ⚠️ `topLineY`/`bottomLineY` are the LINES' own ys (what `Stave.getYForLine` answers), whose ink
 * hangs downward by `thickness` — see `./staffLines`. ⛔ The caller does not pre-resolve the middles:
 * the whole point is that *which point of a line a barline stops at* is stated once, here.
 */
export function barlineExtent(
  topLineY: number,
  bottomLineY: number,
  thickness: number,
): BarlineExtent {
  return {
    topY: staffLineMidY(topLineY, thickness),
    bottomY: staffLineMidY(bottomLineY, thickness),
  }
}

/** How tall that is — ⭐ exactly the distance between the two outer LINES, so a whole number of staff
 *  spaces, and ⛔ independent of how thick they are drawn. */
export function barlineHeight(extent: BarlineExtent): number {
  return extent.bottomY - extent.topY
}
