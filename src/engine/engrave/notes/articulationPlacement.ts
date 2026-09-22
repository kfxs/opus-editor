/**
 * ⭐⭐ **WHERE AN ARTICULATION STANDS ON ITS NOTE** — S12f of `docs/history/vexflow-removal-map.md`
 * (`Articulation.draw`'s placement, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **A mark starts one space past the note on its side — half a space when it sits at the stem's
 * > tip — plus a space per text line the column gave it; a mark that may not sit between the lines is
 * > held at least half a space outside the staff. Then it snaps: inside the staff to a SPACE (a mark on
 * > a line moves half a space outward), outside it to the nearest half-line.** A mark that ends up inside
 * > the staff is CENTRED on its point (VexFlow's `setOrigin(0.5, 0.5)`).
 *
 * "Past the note" is its stem tip when the stem points that way, else its outer head; a stemless note
 * is measured from its outer head.
 *
 * ⚠️ Only the case this editor runs: a `StaveNote` (no tablature, no grace notes).
 */
import { isWithinLines, roundToNearestHalf, roundingFor, type ArticulationSideOf } from './articulationLines'

/** What a formatted note offers the rule, on the mark's side. */
export interface ArticulationPlacementInput {
  side: ArticulationSideOf
  /** The mark's text line on its side (the column's stacking rule gave it). */
  textLine: number
  /** May it sit between the staff lines? */
  canSitBetweenLines: boolean
  staffSpace: number
  /** Whether the note has a stem, and which way it points (`1` up). */
  hasStem: boolean
  stemDirection: number
  stemTipY: number
  stemBaseY: number
  /** Every head's y. */
  headYs: readonly number[]
  /** The y of the head the mark is on (its key index), and that key's line. */
  headY: number
  headLine: number
  /** Half a space outside the staff on this side — `Stave.getYForTopText/BottomText(-0.5)`. */
  outsideStaffY: number
  /**
   * ⭐ OPT-IN, default 1: scales the step OUT from the note (the text lines and the one space / half a
   * space) — ⛔ never the snap, which stays the real staff's. A GRACE passes its size, so its mark
   * steps off its small head in proportion and still lands in a space of the staff it is on
   * (`rendering/GracePass`, his call 2026-09-22). Every other caller omits it and nothing moves.
   */
  outwardScale?: number
}

/** Where the mark is drawn from, and whether it is centred on that point. */
export interface ArticulationPlacement {
  y: number
  centred: boolean
}

/** `Articulation.INITIAL_OFFSET`: the text row half a space outside the staff. */
export const ARTICULATION_OUTSIDE_ROW = -0.5

/** `getTopY` / `getBottomY` for a stave note: the stem tip or base, or the outer head without a stem. */
function reachY(i: ArticulationPlacementInput): number {
  const up = i.stemDirection === 1
  if (i.side === 'above') return i.hasStem ? (up ? i.stemTipY : i.stemBaseY) : Math.min(...i.headYs)
  return i.hasStem ? (up ? i.stemBaseY : i.stemTipY) : Math.max(...i.headYs)
}

/** `snapLineToStaff`: to a half-line, and off a staff line into a space when it may sit inside. */
function snapLineToStaff(canSitBetweenLines: boolean, line: number, side: ArticulationSideOf, offsetDirection: number): number {
  const snapped = roundToNearestHalf(roundingFor(line, side), line)
  const onStaffLine = snapped % 1 === 0
  return canSitBetweenLines && isWithinLines(snapped, side) && onStaffLine ? snapped + 0.5 * -offsetDirection : snapped
}

export function placeArticulation(i: ArticulationPlacementInput): ArticulationPlacement {
  const above = i.side === 'above'
  const onStemTip = i.hasStem && (above ? i.stemDirection === 1 : i.stemDirection === -1)
  const initialOffset = onStemTip ? 0.5 : 1
  const outward = (i.textLine + initialOffset) * i.staffSpace * (i.outwardScale ?? 1)
  let y = above ? reachY(i) - outward : reachY(i) + outward
  if (!i.canSitBetweenLines) y = above ? Math.min(i.outsideStaffY, y) : Math.max(i.outsideStaffY, y)

  const offsetDirection = above ? -1 : 1
  const articLine = (i.headY - y) / i.staffSpace + i.headLine
  const snapped = snapLineToStaff(i.canSitBetweenLines, articLine, i.side, offsetDirection)
  y += Math.abs(snapped - articLine) * i.staffSpace * offsetDirection
  return { y, centred: isWithinLines(snapped, i.side) }
}
