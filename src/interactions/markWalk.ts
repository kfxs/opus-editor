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
  /**
   * ⭐⭐ **THE RE-BASE — the same write, but it is BOOKKEEPING and must not be refused.** Optional;
   * a port that omits it gets {@link nudge}, which is what the first two marks here still use.
   *
   * 🚨 The crossing pair (anchor := next stop, offset −= gap) leaves the DRAWN position untouched —
   * that is the whole design. So a rule about where INK may go has no business judging the second
   * half of it: the page limit measures the delta against the LAST RENDER, where the anchor has not
   * moved yet, and reads a re-base as a hand shoving the mark half a bar sideways. When it refuses,
   * the anchor has moved and the offset has not, so the next press crosses again — a RUNAWAY to the
   * end of the road (his report on the hairpin, 2026-08-20).
   */
  rebase?(dx: number): boolean
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
 * ⭐⭐ **A PRESS WHOSE INK IS REFUSED HANDS THE ANCHOR OVER INSTEAD OF DOING NOTHING** — the walk's
 * answer to a wall.
 *
 * 🚨🚨 His report, 2026-08-21: *"i'm not able to walk here"*, and then *"cross system doesn't work at
 * all"* on three families at once. **One cause behind both**: the ordinary crossing needs the ink to
 * travel the WHOLE gap to the next stop, and the ink can be stopped long before it gets there — by
 * the PAGE's edge (`layout/pageBounds`, and the last bar of a system ends within a space of it) or by
 * the pedal's own rule that its two glyphs may not print over each other. A limit that stops the ink
 * then silently stops the GESTURE, which is the *"a stop that can refuse FOREVER is a dead gesture"*
 * lesson arriving for the third time in one day.
 *
 * 🚨🚨 **THE OFFSET GOES HOME, ⛔ it is NOT re-based by the gap** — his report of the first cut, which
 * did keep the identity: *"the pedal is jumping inconsistent when trying to jump"*, with a log of a
 * `Ped.` glued to its own `✻` while the stored offset ran to **−57 staff-spaces**. The identity is
 * right for an ordinary crossing because the ink really did travel the gap; here it travelled
 * NOTHING — it is against a wall — so holding the picture still means the mark never moves again and
 * the number grows without end.
 *
 * ⭐ So the press does what the hand asked for in the only way left: the anchor steps, and the ink
 * comes back to zero — the sign lands ON its new note, where the engraver would put it. One press,
 * one visible step, and no number to run away.
 *
 * ⛔ **It never invents a stop**: no next stop, an unmeasurable one, a stop the model refuses, or a
 * stop that is not on this ruler (across a system break `./markBreakWrap` owns the press, and the
 * caller must offer it first). The press then really does nothing, which is the wall itself.
 */
export function crossWithoutArrival(port: MarkWalkPort, dx: number): boolean {
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction)
  if (stop === null) return false

  const ss = port.staffSpacePx()
  const from = port.anchorX()
  const to = port.stopX(stop)
  if (!ss || from === null || to === null) return false

  const gap = (to - from) / ss
  // 🚨 The next stop in TIME is not always the next one in X — see {@link arrivedAt}.
  if (Math.sign(gap) !== direction) return false

  const before = port.offsetX()
  if (!port.reanchor(stop)) return false

  // ⭐ The ink goes HOME — see the header. ⚠️ Through `rebase` where the port has one: this is the
  // crossing's bookkeeping and must not be judged by the very limit that sent us here.
  if (before !== 0) {
    if (port.rebase) port.rebase(-before)
    else port.nudge(-before, 0)
  }
  dbg(`[${port.label}] ink blocked — stepped the anchor on instead`
    + ` (gap ${gap.toFixed(2)}ss, offset ${before.toFixed(2)} → 0)`)
  return true
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
 * ⚠️ The bound is {@link maxCrossings} — a runaway guard for a drag, and a real rule for a KEY,
 * which may cross ONE stop per press however far the ink already is from its anchor.
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
  /**
   * ⭐⭐ **HOW MANY STOPS ONE MOVE MAY CROSS.** 32 is a runaway guard, not a rule — and a KEY press
   * should pass **1**.
   *
   * 🚨 His report on the trill, 2026-08-20: *"the re-anchor is completely broken"*. An ornament whose
   * ink had been nudged 59 spaces ahead of its note was already PAST every stop between the two, so
   * one arrow press crossed them all — the anchor left bar 3 for bar 8 in a single keystroke, hopping
   * over another trill's notehead on the way. ⭐ Nothing moved on screen (that is the identity
   * working), which is exactly what made it unreadable.
   *
   * ⚠️ A DRAG keeps the loop: one frame of a fast drag really can fly over several stops, and
   * re-anchoring once would leave the anchor trailing the cursor by however many were skipped.
   */
  maxCrossings = 32,
): { crossings: number; moved: boolean; latched: boolean; dropped: number } {
  let crossings = 0
  for (; crossings < maxCrossings; crossings++) {
    const arrival = arrivedAt(port, dx)
    if (!arrival) break
    if (!port.reanchor(arrival.stop)) break
    // The anchor has absorbed one gap, so the offset gives it up. The drawn mark is unchanged by the
    // pair, which is the whole design; `dx` is untouched and still has its journey to make.
    // ⚠️ Through `rebase` where the port has one — see the interface: this write must not be refused.
    const beforeRebase = port.offsetX()
    if (port.rebase) port.rebase(-arrival.gap)
    else port.nudge(-arrival.gap, 0)
    // ⭐ The offset either side of the crossing, because the pair is an IDENTITY and a reader has no
    //   other way to see it hold: `offset − gap` is what keeps the drawn mark still while the anchor
    //   moves, and a rebase the model REFUSED shows up here as an offset that did not change.
    dbg(`[${port.label}] walked onto its next stop (gap ${arrival.gap.toFixed(2)}ss,`
      + ` offset ${beforeRebase.toFixed(3)} → ${port.offsetX().toFixed(3)}ss,`
      + ` move left ${dx.toFixed(3)}ss)`)
  }
  // ⭐⭐ THE LATCH — see the header. The move is CUT SHORT: whatever travel is left over is dropped,
  // which is the point (the anchor's own position is what the hand was reaching for).
  const offset = port.offsetX()
  if (latching && dx !== 0 && offset !== 0 && Math.sign(offset + dx) !== Math.sign(offset)) {
    const moved = port.nudge(-offset, dy)
    // ⭐⭐ **`dropped` is the travel this cut short**, signed and in staff-spaces — and it is the
    // caller's to REPAY. Those pixels were made by the hand; a drag that swallows them leaves the
    // ink behind the cursor a little at every stop and never catches up, which is Baudisch's own
    // complaint about snap-and-go. ⚠️ It is ZERO when the move happened to land exactly on the
    // anchor — the latch fires there too, and repaying nothing is the whole point of a number
    // rather than a flag.
    const dropped = offset + dx
    // ⚠️ `offset` is the offset the latch found — after any crossings above, ⛔ not the one the frame
    //    started with. The pair `offset + dx` crossing zero IS the latch's whole test, so both are
    //    printed: a latch that fires on every frame of a drag reads here as an offset that keeps
    //    arriving tiny and opposite in sign to the travel.
    dbg(`[${port.label}] latched on its anchor (offset ${offset.toFixed(3)}ss + move ${dx.toFixed(3)}ss`
      + ` crossed zero; ink pinned, dropped ${Math.abs(dropped).toFixed(3)}ss, nudge ${moved})`)
    return { crossings, moved: crossings > 0 || moved, latched: true, dropped }
  }

  // ⚠️ Guarded: a drag frame whose delta rounded to nothing must not write, or every mouse move over
  // a held-still hand marks the model dirty and repaints the score.
  const nudged = (dx !== 0 || dy !== 0) && port.nudge(dx, dy)
  return { crossings, moved: crossings > 0 || nudged, latched: false, dropped: 0 }
}
