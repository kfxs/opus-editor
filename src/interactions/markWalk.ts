/**
 * ⭐⭐ **THE INTERPOLATING WALK, ONCE** — the arithmetic that lets a mark's INK be nudged freely and
 * hands its ANCHOR along the moment the ink arrives at the next stop.
 *
 * Extracted from `./dynamicWalk` on 2026-08-19, when the tempo mark asked for the same gesture. What
 * the two marks disagree about is small and all of it is in the {@link MarkWalkPort} a caller hands
 * in — where the stops are, what a stop is called, which override holds the offset, which model op
 * moves the anchor. What they agree about is everything below, and it is the part worth having once:
 * the identity, the arrival test, the re-base, the system-break refusal and the loop.
 *
 * ⛔ **Not a `kind` switch and not a base class** — a port, so a third mark is a new file that
 * implements it rather than a third branch in here. `./slurEndpointWalk` stays out of it on purpose:
 * a slur endpoint's stop is a NOTE ID rather than an address, and it carries the drag's hold and
 * catch-up, which no other mark has.
 *
 * ## The identity
 *
 * A drawn mark is `base(anchor) + offset`. A press moves the drawn mark by one step, and the model is
 * free to split that between the two terms however it likes:
 *
 * ```
 *   offset + step  <  gap   →  keep the anchor, offset += step        (ordinary ink nudge)
 *   offset + step  ≥  gap   →  anchor := next stop, offset += step − gap
 * ```
 *
 * Both branches move the drawn mark by exactly one step, so **the crossing is invisible** — which is
 * the whole point, and why the crossing needs a model write that KEEPS the offset: the ordinary
 * re-anchor drops it, which is right for *"not that note"* and wrong for a ¼-space press that happens
 * to step over one.
 *
 * ⭐ **ARRIVAL, not midpoint** (his call on the slur, 2026-08-18): a mark can be parked anywhere in
 * the gap without changing the beat it applies from — which playback reads.
 *
 * 🚨 **It will not walk across a system break.** Two x's from different systems are not on one ruler,
 * so a gap whose sign disagrees with the direction of travel is refused and the press stays a plain
 * nudge. `Ctrl+Shift+←/→` is the gesture that crosses a break.
 *
 * ⛔ **The vertical is not in here.** ↑/↓ stay a pure offset: these marks' stops run sideways, so
 * there is nothing above or below to arrive at. `dy` rides along untouched for the callers that have
 * one (a drag moves both axes in one gesture).
 *
 * ## ⭐⭐ THE LATCH — offset zero must be reachable EXACTLY, not by luck
 *
 * Optional, and off for the keyboard (a press is a considered edit of a quarter space, and a key
 * that refused to leave the anchor would be a key that does nothing). A DRAG turns it on: the ink
 * stops dead at **offset zero of the nearest stop in the direction of travel**, which is where the
 * engraver put the mark and therefore the position most likely to be wanted. Crossing onto the next
 * stop and coming BACK to the one it already has are the same event, so one rule covers both.
 *
 * ⭐ It is the half of `./slurEndpointWalk`'s snap-and-go that costs nothing: Baudisch's complaint
 * about radius snapping is that the band either side of an anchor becomes unreachable, and a latch
 * makes the anchor reachable without taking anything away. The other half — motor space at the
 * anchor, repaid at a gain — is deliberately NOT here (his call for the tempo mark, 2026-08-19: its
 * stops are onsets, often far apart, and the hold's three tuned numbers would have to be found again
 * against that spacing).
 *
 * ⛔ `offset !== 0` is what lets the ink LEAVE a stop it is sitting on: at zero every direction
 * "passes through" zero, so latching there would pin the mark for good.
 */
import { dbg } from '../utils/debug'

/** What a mark's stops are called. Opaque here — only the port compares or resolves them. */
export type MarkStop = unknown

/**
 * Everything the walk needs of ONE mark, and the whole of what the two implementations disagree
 * about.
 *
 * ⚠️ Every reader answers off the LAST RENDER and may answer null; null means *"the picture cannot
 * say"*, and the walk then declines to cross rather than guessing — the no-fallback rule this family
 * has kept since the slur (`./slurEndpointWalk`): a guessed staff-space size writes a re-base of the
 * wrong size, quietly, and only on a staff that is not the default one.
 */
export interface MarkWalkPort {
  /** The candidate stop one step away, or null at the end of the road. ⭐ It must be the SAME rule
   *  the whole-stop jump (`Ctrl+Shift+←/→`) uses, or the two keys land the mark on different notes
   *  depending on how far you had nudged. */
  nextStop(direction: 1 | -1): MarkStop | null
  /** Where that stop is DRAWN, in pixels; null when the last render drew nothing there. */
  stopX(stop: MarkStop): number | null
  /** Where the mark's CURRENT anchor is drawn, in pixels; null when it is off screen. */
  anchorX(): number | null
  /** Pixels per staff-space at the mark. ⛔ Never a constant — see the interface note. */
  staffSpacePx(): number | null
  /** The mark's stored horizontal offset, in staff-spaces. 0 = where the engraver put it. */
  offsetX(): number
  /** Hand the anchor to `stop`, KEEPING the mark's offset. False = the model refused. */
  reanchor(stop: MarkStop): boolean
  /** Move the ink by a staff-space delta. False = refused (the page limit). */
  nudge(dx: number, dy: number): boolean
  /** For the log line, so a reader can tell which family walked. */
  label: string
}

/** The stop this press arrives at, with the gap to it in staff-spaces — or null when the ink has not
 *  arrived, or there is nowhere to arrive. */
function arrivedAt(port: MarkWalkPort, dx: number): { stop: MarkStop; gap: number } | null {
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction)
  if (stop === null) return null

  const ss = port.staffSpacePx()
  if (!ss) return null
  const fromX = port.anchorX()
  const toX = port.stopX(stop)
  if (fromX === null || toX === null) return null

  const gap = (toX - fromX) / ss
  // 🚨 The next stop in TIME is not always the next one in X: across a system break it is far to the
  // LEFT while the travel is rightward. Subtracting those two x's is meaningless, so refuse.
  if (Math.sign(gap) !== direction) return null

  const target = port.offsetX() + dx
  return (dx > 0 ? target >= gap : target <= gap) ? { stop, gap } : null
}

/** Whether this press would cross, without moving anything — what a caller asks before deciding to
 *  open an undo batch. */
export function markWalkCrosses(port: MarkWalkPort, dx: number): boolean {
  return dx !== 0 && arrivedAt(port, dx) !== null
}

/**
 * ⭐⭐ **THE MOVE ITSELF** — carry the mark's ink by (`dx`, `dy`) staff-spaces, handing the anchor
 * along to each stop the ink arrives at on the way.
 *
 * ⭐ **A LOOP, because a drag frame is not a step.** A key press moves a quarter- or whole space and
 * can cross at most one stop; one frame of a fast drag can fly over several, and re-anchoring only
 * once would leave the anchor trailing the cursor by however many were skipped. Each pass re-points
 * the anchor and takes that gap back out of the offset — an identity, so the ink never moves at a
 * crossing however many happen in one frame.
 *
 * ⚠️ The bound is a runaway guard, not a rule: {@link arrivedAt} already refuses at the end of the
 * road and across a system break.
 *
 * @returns how many stops the anchor crossed, and whether anything was written at all.
 */
export function carryMark(
  port: MarkWalkPort,
  dx: number,
  dy = 0,
  /** ⭐ Stop the ink dead at offset zero when the move would carry it through — the DRAG's latch,
   *  off for the keyboard. See the header. */
  latching = false,
): { crossings: number; moved: boolean; latched: boolean } {
  let crossings = 0
  for (; crossings < 32; crossings++) {
    const arrival = arrivedAt(port, dx)
    if (!arrival) break
    if (!port.reanchor(arrival.stop)) break
    // The anchor has absorbed one gap, so the offset gives it up. The drawn mark is unchanged by the
    // pair, which is the whole design; `dx` is untouched and still has its journey to make.
    port.nudge(-arrival.gap, 0)
    dbg(`[${port.label}] walked onto its next stop (gap ${arrival.gap.toFixed(2)}ss)`)
  }
  // ⭐⭐ THE LATCH — see the header. The move is CUT SHORT: whatever travel is left over is dropped,
  // which is the point (the anchor's own position is what the hand was reaching for).
  const offset = port.offsetX()
  if (latching && dx !== 0 && offset !== 0 && Math.sign(offset + dx) !== Math.sign(offset)) {
    const moved = port.nudge(-offset, dy)
    dbg(`[${port.label}] latched on its anchor (dropped ${Math.abs(offset + dx).toFixed(2)}ss)`)
    return { crossings, moved: crossings > 0 || moved, latched: true }
  }

  // ⚠️ Guarded: a drag frame whose delta rounded to nothing must not write, or every mouse move over
  // a held-still hand marks the model dirty and repaints the score.
  const nudged = (dx !== 0 || dy !== 0) && port.nudge(dx, dy)
  return { crossings, moved: crossings > 0 || nudged, latched: false }
}
