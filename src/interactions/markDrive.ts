/**
 * ⭐⭐ **THE DRIVER, ONCE** — what a PRESS and what a FRAME do with a mark's port, and the whole of
 * what the six walking families had each written out for themselves.
 *
 * `./markWalk` is the arithmetic (the identity, the arrival test, the latch) and `./markBreakWrap` is
 * the system crossing. Between them sat a third thing nobody had named: the **composition** — ask the
 * wrap first, nudge the ink, open a batch only when something beyond the ink is about to be written,
 * and fall back onto the anchor when the ink is against a wall. Six files had written that
 * composition out, 49–57 lines each and 54–56% identical down to the prose, including the same dated
 * note four times over.
 *
 * ⭐⭐ **IT IS WRITTEN AGAINST THE PORT, ⛔ NEVER AGAINST "A SPAN".** The dynamic and the tempo mark
 * are POINT marks — no length, no second end, no armed square — and they were already sharing
 * `MarkWalkPort` and `BreakWrapPort` with the four span families. A driver that assumed two ends
 * would have forked the very seam it was written to join, so those two calling it is this module's
 * acceptance test, not a bonus.
 *
 * ## What a family still says for itself
 *
 * Everything here is a knob because a family really disagrees about it, and each one is a rule
 * somebody reported:
 *
 * - **{@link MarkDriveSpec.wrap}** — absent for the TRILL, the one family with no system wrap: its
 *   ends are note ids, and a note on the next line is not a distance away.
 * - **{@link MarkDriveSpec.maxCrossings}** — **1** for a span's end (the trill's report, 2026-08-20:
 *   an ink nudged 59 spaces ahead of its note crossed every stop in between on ONE keystroke,
 *   invisibly, because the identity holds the picture still). The point marks keep the loop.
 * - **{@link MarkDriveSpec.inkGuard}** — the hairpin may not let its ink leave the system it is
 *   drawn on, and the trill may not walk past the last line the render drew. Both are refusals of
 *   the plain nudge, ⚠️ and a refused guard still falls through to the hand-over below, which is
 *   what the hairpin has always done.
 * - **{@link MarkDriveSpec.handOverWhenBlocked}** — off for the trill, which has no wrap to fall back
 *   onto and whose blocked press really is a press that does nothing.
 * - **{@link MarkDragSpec.vertical}** — a drag moves both axes in one gesture and the families store
 *   `y` differently: screen-down for the wedge and the pedal, OUTWARD-from-the-staff for the bracket
 *   and the tempo mark, and not at all for the trill (one number for the whole ornament, written by
 *   its own caller before the frame runs).
 * - **{@link MarkDragSpec.latch}** — on where the mark is AIMED at a note's edge (every span end, and
 *   the tempo mark by his call of 2026-08-19), off where it is a label placed by eye (the dynamic,
 *   and a whole body being moved as one).
 *
 * ⛔ **What is NOT a knob**: the batching rule, the order of wrap-then-ink-then-hand-over, the
 * re-base by the folded distance on a key and by the landing stub on a mouse, and the pixel↔staff-
 * space conversion. Those were identical in all six copies and are the reason this file exists.
 *
 * ⚠️ **It lives here rather than in `./markWalk` because `./markBreakWrap` imports `./markWalk`** —
 * the driver needs both, so putting it in the lower of the two would close a cycle.
 */
import {
  carryMark, crossWithoutArrival, markWalkCrosses, type MarkWalkPort,
} from './markWalk'
import { breakCrossing, leaveSystem, type BreakWrapPort } from './markBreakWrap'
import { dbg, debugEnabled } from '../utils/debug'

/** What the driver needs of ONE mark for ONE keyboard press. */
export interface MarkDriveSpec {
  /** The mark's seam — where its stops are and what moves it (`./markWalk`). */
  port: MarkWalkPort
  /** How the mark leaves one system for the next; omit for a family that cannot (`./markBreakWrap`). */
  wrap?: BreakWrapPort | null
  /** The undo entry a crossing press opens. One press is one entry, however many writes it makes. */
  label: string
  /** The engine's batcher, passed in so the driver never names a `MusicEngine`. */
  runBatch: (description: string, fn: () => void) => boolean
  /**
   * ⭐ A family's own reason to refuse the plain ink nudge, asked before it is written. `crossing`
   * says whether a system wrap is already in play, which is the hairpin's excuse to allow ink it
   * would otherwise refuse. ⚠️ A refusal is NOT the end of the press — see {@link handOverWhenBlocked}.
   */
  inkGuard?: (crossing: boolean, dx: number) => boolean
  /** ⭐ How many stops one press may cross. **1** for a span's end; omit for `carryMark`'s own bound. */
  maxCrossings?: number
  /** ⛔ Set false where a blocked press has no anchor to spend itself on. Default true. */
  handOverWhenBlocked?: boolean
}

/** What the driver needs for ONE frame of a drag. */
export interface MarkDragSpec {
  port: MarkWalkPort
  wrap?: BreakWrapPort | null
  /** ⭐⭐ Stop the ink dead at offset zero of the stop ahead — see `./markWalk`'s header. */
  latch: boolean
  /**
   * ⭐⭐ **SCREEN → THE MODEL'S OWN VERTICAL**, in staff-spaces. Default: straight through, because
   * screen-down is what the wedge and the pedal store. ⛔ A family whose `y` is OUTWARD converts
   * here and nowhere else, or a flip inverts a nudge the user already made.
   */
  vertical?: (dyPx: number, staffSpacePx: number) => number
  /** ⭐ Appended to the frame's one log line — what THIS family wants in the trace. */
  note?: () => string
}

/** One frame's report to the caller, in the PIXELS its cursor anchor is measured in. */
export interface DragFrame {
  /** The model changed, so the caller repaints. */
  moved: boolean
  /** ⭐⭐ The mark left this system, so the caller DROPS the drag: it is a line away and the hand is
   *  not, and every further pixel would measure against a system the mark has left. */
  wrapped: boolean
  /** How many stops the anchor crossed this frame — for the trace, and 0 on an ordinary frame. */
  crossings: number
  latched: boolean
  /** 🚨 The travel the latch cut short, and it is the caller's to REPAY by holding its cursor anchor
   *  back by exactly this much — unrepaid, the ink falls behind the hand a little at every stop and
   *  never catches up (Baudisch's own complaint about snap-and-go). ⚠️ 0 on a frame that landed
   *  exactly on the anchor, which latches too and has nothing to give back. */
  droppedPx: number
  /** ⭐ For the caller's HOLD (`./dragHold`) — the gap AHEAD of where it latched. */
  gapAheadPx: number
}

/** A frame that reached the model and moved nothing. */
const STILL: DragFrame = {
  moved: false, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0,
}

/**
 * ⭐ **THE ORDINARY PRESS** — ink, and the line that lets a reader see a refusal. ⚠️ `port.nudge` is
 * the only write here, so a `false` is the PAGE LIMIT speaking and not a guard.
 *
 * Exported for the one caller that needs the ink step WITHOUT the walk around it: a trill whose line
 * has collapsed to a bare `tr` has no stops to arrive at, so its end press is ink and nothing else.
 */
export function inkNudge(port: MarkWalkPort, dx: number): boolean {
  // ⚠️ Read behind the flag, ⛔ not before it: a suppressed `dbg` still evaluates its arguments
  // (docs/logging.md), and the two point marks reached this press without ever reading their offset.
  const before = debugEnabled() ? port.offsetX() : 0
  const moved = port.nudge(dx, 0)
  if (debugEnabled()) {
    dbg(`[${port.label}] ink ${dx > 0 ? '+' : ''}${dx.toFixed(2)}ss`
      + ` | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss${moved ? '' : ' (REFUSED)'}`)
  }
  return moved
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS** — nudge the mark's ink by `dx` staff-spaces (¼ space plain, 1
 * space with `Ctrl`), and hand its anchor along if the ink has arrived at the next stop.
 *
 * A crossing press is ONE undo entry covering both writes, via {@link MarkDriveSpec.runBatch}: the
 * re-anchor and the re-base are two halves of a single press, and an undo that took back only half
 * of it would leave the mark somewhere the user never put it. ⛔ No batch when nothing beyond the
 * ink is about to be written — `runBatch` costs a snapshot per press, and the ordinary nudge records
 * its own single entry.
 *
 * 🚨🚨 **A BLOCKED PRESS STILL CROSSES** — his *"cross system doesn't work at all"*, 2026-08-21, on
 * three families at once. The wrap's arrival test asks the ink to reach the line's last ink, and the
 * PAGE limit refuses it a space or so before that (a system's music ends within a space of the
 * sheet's margin), so the gesture died where it should have wrapped. ⭐ The ink cannot pay any
 * further, so the press spends itself on the ANCHOR: the wrap where the stop is on another system,
 * `crossWithoutArrival` where it is on this one. The identity holds either way — the drawn mark does
 * not move.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   stop to reach, or the page limit refused the ink and there was no anchor to hand over.
 */
export function walkPress(spec: MarkDriveSpec, dx: number): boolean {
  if (dx === 0) return false
  const { port, wrap, label, runBatch } = spec
  const across = wrap ? breakCrossing(port, wrap, dx) : null

  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    const allowed = spec.inkGuard?.(across !== null, dx) ?? true
    if (allowed && inkNudge(port, dx)) return true
    if (spec.handOverWhenBlocked === false) return false

    let handed = false
    runBatch(label, () => {
      handed = across && wrap
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  runBatch(label, () => {
    moved = across?.arrived && wrap
      // ⭐ THE KEYS re-base by the FOLDED distance: their ink really did travel it, one press at a
      // time, so the mark re-appears exactly as far into the new line as the hand pushed it past the
      // barline (`./markBreakWrap`).
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx, 0, false, spec.maxCrossings).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A DRAG** — the same journey with the cursor's delta in PIXELS instead of a key's
 * step, and no undo entry (the drop commits once, through the family's own `commit…Drag`).
 *
 * ⭐ **The mouse and the arrows become ONE gesture.** Every one of these families used to SNAP the
 * grabbed thing onto the nearest stop and write it outright, so the mark jumped a whole note at a
 * time and could never be parked between two. The ink follows the hand and the anchor comes along
 * when the ink reaches a stop, so a drag and N presses covering the same distance leave the model in
 * the same state rather than in two that merely look alike.
 *
 * ⭐⭐ **THE HAND DECIDES WHERE THE LINE ENDS** — the keys have only the ink to go on and wrap when
 * the INK passes the edge; a drag has the pointer itself (`./markBreakWrap`, his rule for the wedge).
 * ⭐⭐ **And a WRAP ENDS THE GESTURE**: see {@link DragFrame.wrapped}.
 *
 * ⚠️ `carryMark` runs unconditionally, ⛔ not only when it crosses: the LATCH lives in there, and a
 * frame that merely passes through offset zero is exactly the one it exists for.
 *
 * ⛔ **NO ONE-CROSSING BOUND HERE** — a key press may cross one stop, but one frame of a fast drag
 * really can fly over several, and re-anchoring once would leave the mark trailing the cursor by
 * however many were skipped.
 *
 * ⛔ **NO INK LIMIT ON A FRAME** — 🚨 it was the bug (his report, 2026-08-20: the drag walked a few
 * bars and then stopped dead, never reaching the line's end to wrap). The limit refuses a whole FRAME
 * whose delta would end past the line's edge, and a frame is not a step: most of it may be the
 * journey to the last stop, with only its tail overshooting. Refusing it stalls the walk one stop
 * short, for ever, because the next frame is bigger still.
 *
 * ⛔ It declines — **null**, not a frame — when the mark is not drawn, so there is no staff-space
 * size to convert the cursor's pixels with; `moved: false` means the frame reached the model and
 * nothing moved, and the caller must then leave its cursor anchor where it was.
 */
export function dragFrame(
  spec: MarkDragSpec,
  cursorX: number,
  dxPx: number,
  dyPx = 0,
): DragFrame | null {
  const { port, wrap } = spec
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  const dx = dxPx / staffSpacePx
  const dy = spec.vertical ? spec.vertical(dyPx, staffSpacePx) : dyPx / staffSpacePx
  if (dx === 0 && dy === 0) return STILL

  const across = wrap ? breakCrossing(port, wrap, dx, cursorX) : null
  // ⭐ ONE LINE PER FRAME (his ask, 2026-08-22: *"give more information in the logs and i test"*). The
  //   lag is the CURSOR against the drawn INK, so both are here: the ink is `anchor + offset`, and a
  //   frame where they diverge is the drag falling behind the hand. ⚠️ BEFORE the wrap branch — a
  //   wrapping frame is the one whose numbers are worth having.
  // ⚠️ Behind the flag: every reader here costs a lookup, and a suppressed `dbg` still evaluates its
  //   arguments (docs/logging.md) — `note()` most of all, which measures a system's ink.
  if (debugEnabled()) {
    dbg(`[${port.label}] frame | cursor ${cursorX.toFixed(0)}`
      + ` | anchor ${port.anchorX()?.toFixed(0) ?? '?'} offset ${port.offsetX().toFixed(2)}ss`
      + ` ink ${((port.anchorX() ?? 0) + port.offsetX() * staffSpacePx).toFixed(0)}`
      + ` | dx ${dx.toFixed(2)}ss (${dxPx.toFixed(0)}px @ ${staffSpacePx.toFixed(2)}px/ss)`
      // ⚠️ **THE VERTICAL WAS MISSING FROM THIS LINE** until 2026-08-24, and it hid a whole class of
      //    report: a pure-vertical frame prints `dx 0.00ss` and looked, in a log, exactly like a hand
      //    that had not moved. ⛔ Never leave an axis out of the one line per frame.
      + ` dy ${dy.toFixed(2)}ss (${dyPx.toFixed(0)}px)`
      + ` | across ${across ? (across.arrived ? 'ARRIVED' : 'pending') : 'no'}`
      + (spec.note ? ` | ${spec.note()}` : ''))
  }

  if (across?.arrived && wrap) {
    // ⭐ THE MOUSE lands a stub inside the new line — ⛔ not the folded distance the KEYS re-base by,
    // whose overshoot on the frame that wraps is a single frame of travel and comes out invisible
    // (`./markBreakWrap`).
    const moved = leaveSystem(port, wrap, across.stop, () => across.landing)
    return { ...STILL, moved, wrapped: true }
  }

  const carried = carryMark(port, dx, dy, spec.latch)
  // ⭐ …and what the model DID with it. The line above is printed before the write (a wrapping frame's
  //   numbers are worth having either way), so a refusal was invisible: `moved:false` here is the
  //   model saying no, and on a pure-vertical frame that is the only place it says so.
  if (debugEnabled() && !carried.moved) {
    dbg(`[${port.label}] frame REFUSED — the model wrote nothing`
      + ` | dx ${dx.toFixed(2)}ss dy ${dy.toFixed(2)}ss | offsetX still ${port.offsetX().toFixed(2)}ss`)
  }
  return {
    moved: carried.moved,
    wrapped: false,
    crossings: carried.crossings,
    latched: carried.latched,
    droppedPx: carried.dropped * staffSpacePx,
    gapAheadPx: carried.gapAhead * staffSpacePx,
  }
}
