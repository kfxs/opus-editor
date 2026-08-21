/**
 * 🚨🚨 **CROSSING A SYSTEM BREAK — the ink wraps AT THE BARLINE, and what was leaning into the margin
 * is redrawn at the START of the next system.**
 *
 * His rule, 2026-08-20, on the hairpin: *"after the barline, all the distance we are drawing in the
 * old system should be drawing in the beginning of the next system"* — and every earlier cut is
 * recorded here because each one moved the wedge somewhere he rejected:
 *
 *  1. *"is not anchoring to the next measure cause is in another system"* — the walk refused to cross
 *     at all: two systems' x's are not one ruler (`./markWalk`, permanently and rightly);
 *  2. *"i jump til the end… is not symmetrical, i should offset also while going right"* — a trigger
 *     of *"has the ink passed the last barline"* fired on the FIRST press, because an end parked at
 *     the end of its line is already at the edge. One press ate a whole system;
 *  3. *"it is never reaching the next system"* — that press was spent on a stop whose ink lands ON
 *     the barline, drawn at the end of the line it was already on. A stop is priced where the INK
 *     lands, never at the note it names;
 *  4. *"look how much is drawing wrong before jumping"* — making the ink pay the whole folded
 *     distance first dragged the wedge eleven spaces into the right margin.
 *
 * ⭐⭐ **So: ARRIVAL at the line's edge, RE-BASE by the folded distance.** The two halves answer
 * different questions and the earlier cuts each used one number for both:
 *
 * ```
 *   arrives when   offset + step  passes  (this line's end − the ink)
 *   re-bases by    gap = (this line's end − the ink) + (the stop − that line's start)
 * ```
 *
 * The press that leaves the line therefore lands the end **just past the start of the next system**,
 * by exactly the ink that would have hung in the margin. The identity `offset += step − gap` is
 * `./markWalk`'s, unchanged. ⭐ It is symmetric by construction: backwards, the edge is the line's
 * START and the far side is the previous line's END.
 *
 * ⛔ Only when the stop is on ANOTHER system — asked of the SYSTEMS themselves, never of the two x's
 * — and ⛔ never onto a bar the last render drew nothing for.
 *
 * ## Why this is a module
 *
 * Extracted from `./hairpinWalk` on 2026-08-21, when the OTTAVA's squares asked for the same
 * gesture (*"what about the cross system issue?"*). ⛔ Not a copy and ⛔ not a `kind` switch — a PORT,
 * exactly as `./markWalk` and `./markSystemJump` are: the family states where ITS system ends and
 * where a candidate stop's system begins, and everything above is answered once.
 */
import { type MarkStop, type MarkWalkPort } from './markWalk'
import { dbg } from '../utils/debug'

/** The drawn extent of one SYSTEM: its music's left and right edges in pixels, and the `top` that
 *  NAMES the row (a staff's own top line — shared by every bar of one line, by no two lines). */
export interface SystemInk {
  min: number
  max: number
  top: number
}

/** What the wrap needs of one mark, beyond {@link MarkWalkPort}. Both readers answer off the LAST
 *  RENDER and may answer null — *"the picture cannot say"*, which is always answered with "no wrap". */
export interface BreakWrapPort {
  /** The system the mark's own end stands on. */
  here(): SystemInk | null
  /** The system a candidate stop is drawn on. */
  there(stop: MarkStop): SystemInk | null
  /** The stop's address, for the log line only. */
  address(stop: MarkStop): unknown
}

/**
 * ⭐ **HOW FAR INTO THE NEW LINE A WRAPPED END LANDS** — two staff-spaces: a FEEL number, like the
 * nudge steps themselves, ⛔ not an engraving one, and the only constant in this file.
 *
 * His rule, 2026-08-20, after seeing both extremes: a whole bar of mark appearing at once is *"too
 * much"*, and the honest overshoot is invisible. Small enough that the journey plainly continues
 * over there rather than being finished by the jump — *"so the user is forced to go to the next
 * system to keep walking"* — and big enough to SEE, which no arithmetic here could promise.
 */
export const WRAP_STUB_SS = 2

/**
 * The stop to wrap onto with the folded gap to re-base by, and whether this press arrives; **null**
 * when the question does not arise (the press is then ordinary ink, or the walk's own).
 *
 * @param cursorX ⭐⭐ **THE MOUSE'S OWN ARRIVAL TEST** — his rule, 2026-08-20: *"when the x of the
 *   mouse is major than the x of the barline we jump to the other system"*. A drag HAS the hand's
 *   position, and that is the honest answer to "has this gesture left the line": ⛔ not the ink,
 *   which only gets there if every frame's delta was accepted on the way. The keyboard has no cursor
 *   and keeps the ink test.
 */
export function breakCrossing(
  port: MarkWalkPort,
  wrap: BreakWrapPort,
  dx: number,
  cursorX?: number,
): { stop: MarkStop; landing: number; gap: number; arrived: boolean } | null {
  const why = (reason: string): null => {
    // ⭐ The crossing declines through five different reads, and a press that simply does nothing
    // cannot tell them apart in a real score — which cost an afternoon of round trips on 2026-08-20.
    dbg(`[${port.label}] no break crossing — ${reason}`)
    return null
  }
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction)
  if (stop === null) return why('no next stop — the end of the lane')

  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  const stopX = port.stopX(stop)
  if (anchor === null || stopX === null || !staffSpacePx) {
    return why(`unmeasurable | anchor ${anchor} stopX ${stopX} ss ${staffSpacePx} stop ${JSON.stringify(wrap.address(stop))}`)
  }

  const here = wrap.here()
  const there = wrap.there(stop)
  if (!here || !there) {
    return why(`no system geometry | here ${JSON.stringify(here)} there ${JSON.stringify(there)} stop ${JSON.stringify(wrap.address(stop))}`)
  }
  // ⭐⭐ SAME LINE ⇒ an ordinary press, and `carryMark` owns it. ⛔ Asked of the SYSTEMS, not of the
  // two x's: a later line's x may be larger, smaller or equal to this one's, so "is the stop drawn
  // ahead of me" is a question the numbers cannot answer across a break.
  if (here.top === there.top) return null

  // Where this line runs out, from the mark — and where the mark re-appears over there.
  const toEdge = ((direction === 1 ? here.max : here.min) - anchor) / staffSpacePx
  // ⭐⭐ **TWO LANDINGS, because the two devices arrive with different things in hand.**
  //
  // `gap` is the FOLDED distance — to this line's end plus into the next — and the KEYS re-base by
  // it: their ink really did travel that far, one press at a time, so the mark re-appears exactly as
  // far into the new line as the hand pushed it past the barline. Continuous, and his rule.
  //
  // ⛔ A MOUSE cannot use it. Its overshoot at the frame that wraps is one frame of travel (his logs:
  // `step 0.23ss`), so the stub came out at 2 px — and once rounding went the other way the mark
  // landed LEFT of the line's first ink and no fragment was drawn at all. That is the *"not
  // working"* he kept seeing: the wrap had happened, with nothing to show. So a drag lands at a
  // fixed `landing` — {@link WRAP_STUB_SS} inside the line.
  const stubAt = direction === 1
    ? there.min + WRAP_STUB_SS * staffSpacePx
    : there.max - WRAP_STUB_SS * staffSpacePx
  const landing = (stubAt - stopX) / staffSpacePx
  const target = port.offsetX() + dx
  const arrived = cursorX === undefined
    ? (direction === 1 ? target > toEdge : target < toEdge)
    : (direction === 1 ? cursorX > here.max : cursorX < here.min)
  const gap = toEdge + (stopX - (direction === 1 ? there.min : there.max)) / staffSpacePx
  return { stop, landing, gap, arrived }
}

/**
 * ⭐⭐ **THE WRAP ITSELF** — hand that end to `stop`, and put its ink where {@link breakCrossing}
 * said.
 *
 * ⚠️ **The MODEL steps further than the DRAWING**, and that is deliberate. A span's extent moves by
 * whole lane slots — a bar, in a score of whole rests — so the music now covers that bar; the ink
 * shows a stub. Ink ≠ anchor is the walk's ordinary state everywhere, and here it is what makes a
 * wrap read as *"it went over, carry on down there"* rather than as a bar of mark appearing from
 * nowhere (his rule and his rejection, 2026-08-20).
 *
 * ⚠️ The caller owns the undo entry: one batch for a key press, none at all for a drag frame.
 */
export function leaveSystem(
  port: MarkWalkPort,
  wrap: BreakWrapPort,
  stop: MarkStop,
  offsetAfter: (before: number) => number,
): boolean {
  const before = port.offsetX()
  const landing = offsetAfter(before)
  if (!port.reanchor(stop)) {
    dbg(`[${port.label}] ⛔ the model REFUSED the wrap onto ${JSON.stringify(wrap.address(stop))}`)
    return false
  }
  // ⚠️ The REBASE writer, not the nudge: this is bookkeeping, and a page limit that refused it would
  // strand the mark mid-wrap. ⭐ The offset is SET, not accumulated: the landing is a position on
  // the NEW line, and nothing the ink was carrying on the old one means anything over there.
  const rebased = port.rebase?.(landing - before)
  dbg(`[${port.label}] WRAPPED onto ${JSON.stringify(wrap.address(stop))}`
    + ` | landing ${landing.toFixed(2)}ss`
    + ` | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss${rebased ? '' : ' (REBASE REFUSED)'}`
    + ` | anchor now ${port.anchorX()?.toFixed(0) ?? '?'}`)
  return true
}
