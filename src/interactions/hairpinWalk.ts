/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A HAIRPIN'S TWO SQUARES** — ←/→ and `Ctrl`+←/→ move the armed
 * end's INK, and once that ink reaches the next boundary of the lane the WEDGE ITSELF goes with it
 * (his ask, 2026-08-20: the left square first, then *"we are using reanchor also for the duration
 * endpoint, and offset, that means that the duration endpoint should walk too"*).
 *
 * The arithmetic is `./markWalk`'s, shared with the dynamic's and the tempo mark's; this file is the
 * PORT — twice, one per end. What is hairpin-specific is three things, and all three matter:
 *
 * ⭐⭐ **THE STOPS ARE BOUNDARIES, NOT NOTEHEADS.** A wedge's tips are drawn at a note's LEFT EDGE
 * (`HairpinRenderer.spanX`), so the gaps this walk crosses are edge-to-edge — ⛔ not the head-to-head
 * distances `./dynamicWalk` uses, which would put a crossing half a notehead early. The list is
 * `./hairpinLane`'s, shared with the squares' DRAG so all three routes measure one geometry.
 *
 * ⭐⭐ **A CROSSING HOLDS THE OTHER END STILL** — and that is what makes these two ends one gesture
 * rather than a wedge that slides. The start writes `beat` and `length` together
 * (`setHairpinStartAtSlot`), the end writes `length` alone; either way the far tip does not move,
 * which is what both squares already mean under `Ctrl+Shift+←/→` and under the mouse. ⚠️ So a
 * walking press is AUDIBLE at the moment it crosses — it changes which notes get louder. Every press
 * either side of it is ink and changes nothing.
 *
 * ⭐ **The crossing KEEPS both ends' nudges by construction** — the model ops touch no override at
 * all, so unlike the dynamic there is no `…KeepingOffset` twin to reach for. What the walk then does
 * with the armed end's own offset is the family's identity: it takes the gap back out, so the tip
 * does not jump.
 *
 * ⛔ **The vertical is not in here.** ↑/↓ stay a pure offset — a `y` on one end TILTS the wedge, and
 * there is no anchor above or below to arrive at.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { HairpinDragWrite, HairpinEndStop, HairpinSlotTarget } from '../engine/models/hairpinOps'
import { hairpinEndpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import {
  hairpinBoundaryX, hairpinEndAddress, hairpinStartAddress, hairpinSystemInkLimit, hairpinTipX,
} from './hairpinLane'
import { hairpinStaffSpacePx } from './elements/hairpinHandles'
import { carryMark, markWalkCrosses, type MarkStop, type MarkWalkPort } from './markWalk'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type HairpinWalkEngine = Pick<MusicEngine,
  'getHairpinById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextHairpinStartSlot' | 'moveHairpinStartToSlot'
  | 'nextHairpinEndStop' | 'moveHairpinEndToStop'
  | 'nudgeHairpinEndpoint' | 'rebaseHairpinEndpointOffset'
  | 'previewHairpinEnd' | 'previewHairpinEndpointOffset' | 'previewHairpinEndpointRebase'>

/**
 * ⭐ **WHAT SEPARATES THE TWO DEVICES, and the whole of it**: a KEY press records its own undo step,
 * a drag FRAME records none and leaves the drop to commit once
 * ({@link MusicEngine.commitHairpinDrag}). Everything else — the stops, the geometry, the identity —
 * is shared, which is what makes a drag and N presses land in the same state rather than in two
 * states that merely look alike (`./dynamicWalk`'s arrangement, and for its reason).
 */
interface HairpinWrite {
  moveStart: (target: HairpinSlotTarget) => boolean
  moveEnd: (stop: HairpinDragWrite) => boolean
  nudge: (dx: number, dy: number) => boolean
  /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
   *  the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
   *  crosses again. */
  rebase: (dx: number) => boolean
}

/** The keyboard's writes: each records its own undo entry, and a crossing press wraps them in one
 *  batch ({@link walkHairpinEndpoint}). */
function keyWrites(engine: HairpinWalkEngine, id: string, which: 'start' | 'end'): HairpinWrite {
  return {
    moveStart: (target) => engine.moveHairpinStartToSlot(id, target),
    moveEnd: (stop) => engine.moveHairpinEndToStop(id, stop),
    nudge: (dx, dy) => engine.nudgeHairpinEndpoint(id, which, dx, dy),
    rebase: (dx) => engine.rebaseHairpinEndpointOffset(id, which, dx),
  }
}

/** The drag's writes: the same three edits with no undo entry of their own. */
function previewWrites(engine: HairpinWalkEngine, id: string, which: 'start' | 'end'): HairpinWrite {
  return {
    moveStart: (target) => engine.previewHairpinEnd(id, { at: 'start', ...target }),
    moveEnd: (stop) => engine.previewHairpinEnd(id, stop),
    nudge: (dx, dy) => engine.previewHairpinEndpointOffset(id, which, dx, dy),
    rebase: (dx) => engine.previewHairpinEndpointRebase(id, which, dx),
  }
}

/** What the two ends answer alike — the scale, that end's own stored nudge, and the ink write —
 *  wrapped around the half that differs. ⛔ Not a base class and not a `which` switch inside the
 *  members: each end states its own four answers, and reads this for the three it shares. */
function port(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: HairpinWrite,
  ends: Pick<MarkWalkPort, 'label' | 'nextStop' | 'stopX' | 'anchorX' | 'reanchor'>,
): MarkWalkPort {
  return {
    ...ends,
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN wedge's staff,
    // which may be a SMALL one.
    staffSpacePx: () => hairpinStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.[which]?.x ?? 0,
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/**
 * ⭐ **THE LEFT SQUARE'S PORT** — its stops are the lane's onsets, and it takes one as the wedge's
 * own beginning.
 */
function startPort(engine: HairpinWalkEngine, id: string, write: HairpinWrite): MarkWalkPort {
  return port(engine, id, 'start', write, {
    label: 'Hairpin start',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the two keys landing the start on different notes depending on how far it had been
    // nudged.
    nextStop: (direction) => engine.nextHairpinStartSlot(id, direction),
    stopX: (stop) => boundaryX(engine, id, stop as HairpinSlotTarget),
    anchorX: () => {
      const here = hairpinStartAddress(engine.getScore(), id)
      return here ? boundaryX(engine, id, here) : null
    },
    reanchor: (stop) => write.moveStart(stop as HairpinSlotTarget),
  })
}

/**
 * ⭐ **THE RIGHT SQUARE'S PORT** — the DURATION end, his name for it. Its stops are the same
 * boundaries read the other way: the tip stands BEFORE the first note it does not cover, plus the
 * one position past the last note where it covers everything ({@link HairpinDragWrite}, the drag's
 * own vocabulary — which is why a stop here is a write rather than an address).
 */
function endPort(engine: HairpinWalkEngine, id: string, write: HairpinWrite): MarkWalkPort {
  return port(engine, id, 'end', write, {
    label: 'Hairpin end',
    // ⭐ `resizeHairpinBySlot`'s own candidate, split out of it for exactly this — see
    // `hairpinOps.nextHairpinEndStop`.
    nextStop: (direction) => engine.nextHairpinEndStop(id, direction),
    // ⭐⭐ WHERE THE TIP WOULD BE DRAWN, ⛔ not where the note it names is: a stop that leaves the
    // wedge ending on a BARLINE draws the tip at the end of the PREVIOUS line
    // (`hairpinOps.addressOfAbs`, and his report that made it a rule). The model answers with that
    // address; this only has to resolve it to a pixel, exactly as `anchorX` does for today's tip.
    stopX: (stop) => tipX(engine, id, (stop as HairpinEndStop).endsAt),
    anchorX: () => {
      const here = hairpinEndAddress(engine.getScore(), id)
      return here ? tipX(engine, id, here) : null
    },
    reanchor: (stop) => write.moveEnd((stop as HairpinEndStop).write),
  })
}

/** One lane onset's drawn left edge, for a wedge that may have gone. */
function boundaryX(engine: HairpinWalkEngine, id: string, target: HairpinSlotTarget): number | null {
  const hairpin = engine.getHairpinById(id)
  return hairpin ? hairpinBoundaryX(engine, hairpin, target) : null
}

/** Where a TIP standing at `at` is drawn — an onset's left edge, or the bar's own end when the wedge
 *  finishes on a barline. See {@link hairpinTipX}. */
function tipX(engine: HairpinWalkEngine, id: string, at: HairpinSlotTarget): number | null {
  const hairpin = engine.getHairpinById(id)
  return hairpin ? hairpinTipX(engine, hairpin, at) : null
}

/**
 * 🚨🚨 **CROSSING A SYSTEM BREAK — the ink wraps AT THE BARLINE, and what was leaning into the margin
 * is redrawn at the START of the next system.** His rule, 2026-08-20: *"after the barline, all the
 * distance we are drawing in the old system should be drawing in the beginning of the next
 * system"* — and each earlier attempt is in here because each one moved it:
 *
 *  1. *"is not anchoring to the next measure cause is in another system"* — the walk refused to cross
 *     at all: two systems' x's are not one ruler (`./markWalk`, permanently and rightly);
 *  2. *"i jump til the end… is not symmetrical, i should offset also while going right"* — a trigger
 *     of *"has the ink passed the last barline"* fired on the FIRST press, because a tip parked at
 *     the end of its line is already at the edge. One press ate a whole system;
 *  3. *"it is never reaching the next system"* — that press was spent on a stop which leaves the
 *     wedge ending ON THE BARLINE, drawn at the end of the line it was already on. Fixed in the
 *     model (`hairpinOps.addressOfAbs`): a stop is priced where the TIP lands, never at the note it
 *     names, and filling the bar to its barline is now a step of its own;
 *  4. *"look how much is drawing wrong before jumping"* — making the ink pay the whole folded
 *     distance first dragged the wedge eleven spaces into the right margin.
 *
 * ⭐⭐ **So: ARRIVAL at the line's edge, RE-BASE by the folded distance.** The two halves answer
 * different questions and the earlier cuts each used one number for both:
 *
 * ```
 *   arrives when   offset + step  passes  (this line's end − the tip)
 *   re-bases by    gap = (this line's end − the tip) + (the stop − that line's start)
 * ```
 *
 * The press that leaves the line therefore lands the tip **just past the start of the next system**,
 * by exactly the ink that would have hung in the margin — his rule, and the identity
 * `offset += step − gap` unchanged. Every further press walks it on toward the stop, where the
 * offset reaches zero and the ordinary walk takes over again. ⭐ It is symmetric by construction:
 * backwards, the edge is the line's START and the far side is the previous line's END.
 *
 * ⛔ Only when the stop is on ANOTHER system — asked of the systems themselves, never of the two x's
 * — and ⛔ never onto a bar the last render drew nothing for.
 *
 * @returns the stop to wrap onto with the folded gap to re-base by, and whether this press arrives;
 *   null when the question does not arise (the press is then ordinary ink, or the walk's own).
 */
function crossingTheBreak(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
  /** ⭐⭐ **THE MOUSE'S OWN ARRIVAL TEST** — his rule, 2026-08-20: *"when the x of the mouse is major
   *  than the x of the barline we jump to the other system"*. A drag HAS the hand's position, and
   *  that is the honest answer to "has this gesture left the line": ⛔ not the ink, which only gets
   *  there if every frame's delta was accepted on the way. The keyboard has no cursor and keeps the
   *  ink test. */
  cursorX?: number,
): { stop: MarkStop; landing: number; gap: number; arrived: boolean } | null {
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction)
  if (stop === null) return why('no next stop — the end of the lane')

  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  const stopX = port.stopX(stop)
  if (anchor === null || stopX === null || !staffSpacePx) {
    return why(`unmeasurable | anchor ${anchor} stopX ${stopX} ss ${staffSpacePx} stop ${JSON.stringify(stopAddress(stop))}`)
  }

  const here = systemInkLimit(engine, id, which)
  const hairpin = engine.getHairpinById(id)
  const there = hairpin && hairpinSystemInkLimit(engine, hairpin, stopAddress(stop))
  if (!here || !there) {
    return why(`no system geometry | here ${JSON.stringify(here)} there ${JSON.stringify(there)} stop ${JSON.stringify(stopAddress(stop))}`)
  }
  // ⭐⭐ SAME LINE ⇒ an ordinary press, and `carryMark` owns it. ⛔ Asked of the SYSTEMS, not of the
  // two x's: a later line's x may be larger, smaller or equal to this one's, so "is the stop drawn
  // ahead of me" is a question the numbers cannot answer across a break.
  if (here.top === there.top) return null

  // Where this line runs out, from the tip — and where the tip re-appears over there.
  const toEdge = ((direction === 1 ? here.max : here.min) - anchor) / staffSpacePx
  // ⭐⭐ **TWO LANDINGS, because the two devices arrive with different things in hand.**
  //
  // `gap` is the FOLDED distance — to this line's end plus into the next — and the KEYS re-base by
  // it: their ink really did travel that far, one press at a time, so the tip re-appears exactly as
  // far into the new line as the hand pushed it past the barline. Continuous, and his rule.
  //
  // ⛔ A MOUSE cannot use it. Its overshoot at the frame that wraps is one frame of travel (his logs:
  // `step 0.23ss`), so the stub came out at 2 px — and once rounding went the other way the tip
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
 * ⭐ **HOW FAR INTO THE NEW LINE A WRAPPED END LANDS** — two staff-spaces: a FEEL number, like the
 * nudge steps themselves, ⛔ not an engraving one, and the only constant in this file.
 *
 * His rule, 2026-08-20, after seeing both extremes: a whole bar of wedge appearing at once is *"too
 * much"*, and the honest overshoot is invisible. Small enough that the journey plainly continues
 * over there rather than being finished by the jump — *"so the user is forced to go to the next
 * system to keep walking"* — and big enough to SEE, which no arithmetic here could promise.
 */
const WRAP_STUB_SS = 2

/** ⭐ The break crossing declines through five different reads, and a press that simply does nothing
 *  cannot tell them apart in a real score — which cost an afternoon of round trips on 2026-08-20.
 *  Kept, like the rest of this editor's `dbg` lines. */
function why(reason: string): null {
  dbg(`[Hairpin] no break crossing — ${reason}`)
  return null
}

/** Every stop of this family names an address, whichever end asked for it — a lane slot for the
 *  start, a {@link HairpinDragWrite} for the tip. Both carry the (measure, beat) the walk needs to
 *  ask which SYSTEM it was drawn on. */
function stopAddress(stop: MarkStop): HairpinSlotTarget {
  const named = stop as HairpinSlotTarget & Partial<HairpinEndStop>
  return named.endsAt ?? named
}

/**
 * 🚨 **HOW FAR THE INK MAY GO WHEN THERE IS NOWHERE TO GO** — the same system edges
 * {@link crossingTheBreak} measures to, used the other way: at the end of the lane (or where the
 * last render drew no stop to wrap onto) the arrow would otherwise push the drawing off the staff
 * with the music standing still.
 *
 * ⭐ It REFUSES the write; ⛔ it never clamps the drawing — `MusicEngine.nudgeStaysOnPage`'s rule,
 * including its escape hatch: ink already outside (a re-flow moved the line under it) may always be
 * nudged BACK, or the mark would be stranded. ⛔ And it allows freely when the wedge or its staff was
 * not drawn — no picture, no limit.
 *
 * 🚨🚨 **WHERE THE INK IS, IS `anchor + offset` — ⛔ never the drawn fragment.** His report,
 * 2026-08-20: a start walked back over a break went dead, every press refused. A wedge whose start
 * has just wrapped begins at the very END of its line, so the piece drawn there has no width and is
 * not registered at all — and reading "the first fragment" then returned the piece on the NEXT
 * system, a small x judged against the previous system's edges. The identity is always available and
 * always consistent with the address being reasoned about; a fragment is not.
 */
function inkStaysOnSystem(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
): boolean {
  const limit = systemInkLimit(engine, id, which)
  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  if (!limit || anchor === null || !staffSpacePx) return true

  const next = anchor + (port.offsetX() + dx) * staffSpacePx
  if (next > limit.max) return dx < 0
  if (next < limit.min) return dx > 0
  return true
}

/** The drawn extent of the SYSTEM this end stands on — its line's first `noteStartX` and last
 *  `noteEndX`. Null when that bar was not drawn. */
function systemInkLimit(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
): { min: number; max: number; top: number } | null {
  const hairpin = engine.getHairpinById(id)
  const at = which === 'start'
    ? hairpinStartAddress(engine.getScore(), id)
    : hairpinEndAddress(engine.getScore(), id)
  return hairpin && at ? hairpinSystemInkLimit(engine, hairpin, at) : null
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON AN ARMED SQUARE** — nudge that end's ink by `dx` staff-spaces
 * (¼ space plain, 1 space with `Ctrl`), and hand that end of the WEDGE along if the ink has arrived
 * at the next boundary of the lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the wedge somewhere the user never put it.
 *
 * ⚠️ The walk STOPS where the model refuses — at either end of the lane, and where the two ends
 * would meet (a start may not reach its own end, and a shrink may not leave the wedge covering no
 * music). The press then stays a plain ink nudge, so the tip can still be pushed past, which is what
 * an override is for.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such hairpin, or the page limit refused the ink.
 */
export function walkHairpinEndpoint(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
): boolean {
  if (dx === 0) return false
  const port = portFor(engine, id, which, keyWrites(engine, id, which))

  const across = crossingTheBreak(engine, id, which, port, dx)
  const crosses = markWalkCrosses(port, dx)
  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  if (!across?.arrived && !crosses) return inkPress(engine, id, which, port, dx, across !== null)

  let moved = false
  engine.runBatch(which === 'start' ? 'Move hairpin start' : 'Resize hairpin', () => {
    moved = across?.arrived
      // ⭐ THE KEYS re-base by the folded distance: their ink travelled it.
      ? leaveSystem(port, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A SQUARE DRAG** — the same journey with the cursor's delta in PIXELS instead of
 * a key's step, and no undo entry (the drop commits once,
 * {@link MusicEngine.commitHairpinDrag}). His ask, 2026-08-20: *"now lets do the walk for the
 * mouse"*.
 *
 * ⭐ **The mouse and the arrows become ONE gesture.** The drag used to snap the grabbed end to the
 * nearest slot of the lane and write it outright, so a wedge jumped a whole note at a time and could
 * never be parked between two — the very thing the keys had just stopped doing. Now the ink follows
 * the hand and the wedge comes along when the ink reaches a boundary, so a drag and N presses
 * covering the same distance leave the model in the same state rather than in two states that
 * merely look alike.
 *
 * ⭐⭐ **THE LATCH is ON here** (`./markWalk`), unlike the dynamic's drag: the ink stops dead at
 * offset zero of the boundary it is nearest in the direction of travel. A wedge's tip is AIMED at a
 * note's edge — that is where the engraver puts it, and the alignment must be reachable exactly
 * rather than by luck. The dynamic has no latch because a `p` is a label placed by eye
 * (`./dynamicWalk`); a hairpin's end is not.
 *
 * 🚨 **A latched frame REPORTS what it DROPPED, because that travel must be REPAID.** The latch cuts
 * the move short at the boundary, and the pixels it drops were still made by the hand — so the
 * caller holds its cursor anchor back by exactly that much and the next frame presents them again.
 * Left unrepaid the ink falls behind the cursor a little at every stop and never catches up, which
 * is Baudisch's own complaint about snap-and-go: his report, 2026-08-20 — five stops, ~2.6 spaces
 * lost, and the tip never reaching the end of the line to wrap. ⭐ Repaying it costs nothing and
 * tunes nothing, ⛔ unlike the slur's catch-up. ⚠️ `droppedPx` is 0 on a frame that landed exactly on
 * the anchor, which latches too and has nothing to give back.
 *
 * ⭐⭐ **THE HAND DECIDES WHERE THE LINE ENDS** — his rule, 2026-08-20: *"when the x of the mouse is
 * major than the x of the barline we jump to the other system"*. The keys have only the ink to go
 * on, so they wrap when the INK passes the edge; a drag has the pointer itself, which is both
 * simpler and truer — it cannot be thrown off by a frame the model refused, or by ink that fell
 * behind the hand.
 *
 * ⭐⭐ **A WRAP ENDS THE GESTURE** (his call, 2026-08-20: *"when we detect this we draw the small
 * hairpin in the next system and clear the endpoint in the current system, so if the user wants to
 * keep extending he has to go with the mouse to the next system"*). The end is now a line away and
 * the hand is not: every further pixel of this drag would move it by a distance measured against a
 * system it has left. So the frame reports `wrapped` and the caller drops the drag — `./dynamicWalk`
 * stops its frame at a system jump for the same reason, and this goes one further because the
 * gesture itself can no longer mean anything.
 *
 * ⭐⭐ **BOTH AXES** (his ask, 2026-08-20) — and they are different kinds of move, which is the point
 * of making them in one gesture: the horizontal walks that end through the MUSIC, while `dy` is a
 * plain ink offset, there being nothing above or below to arrive at. A `y` on ONE end tilts the
 * wedge; the same on both would lift it off the dynamics line, which is the BODY drag's gesture.
 * ⚠️ Screen-down is +y and so is the stored number ({@link HairpinEndpointOffsetOverride}), so this
 * one needs no conversion — ⛔ unlike the tempo mark's, whose `y` is outward.
 * ⭐ The lift SURVIVES a crossing and a wrap: it is this end's share of the wedge's SHAPE, not a
 * distance to any particular note.
 *
 * ⛔ It declines — **null**, not a frame — when the wedge is not drawn, so
 * there is no staff-space size to convert the cursor's pixels with; `moved: false` means the frame
 * reached the model and nothing moved, and the caller must then leave its cursor anchor where it was.
 */
export function dragHairpinEndpoint(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  cursorX: number,
  dxPx: number,
  dyPx = 0,
): { moved: boolean; wrapped: boolean; droppedPx: number } | null {
  const port = portFor(engine, id, which, previewWrites(engine, id, which))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  const dx = dxPx / staffSpacePx
  const dy = dyPx / staffSpacePx
  if (dx === 0 && dy === 0) return { moved: false, wrapped: false, droppedPx: 0 }
  const across = crossingTheBreak(engine, id, which, port, dx, cursorX)
  // ⭐ One line per FRAME, ⚠️ BEFORE the wrap branch — a wrapping frame is the one whose numbers are
  // worth having, and logging after the branch is why the first round of this told us nothing.
  const edge = systemInkLimit(engine, id, which)
  dbg(`[${port.label}] frame | cursor ${cursorX.toFixed(0)} line ${edge ? `${edge.min.toFixed(0)}…${edge.max.toFixed(0)}` : '?'}`
    + ` | anchor ${port.anchorX()?.toFixed(0) ?? '?'} offset ${port.offsetX().toFixed(2)}ss dx ${dx.toFixed(2)}ss`
    + ` | across ${across ? (across.arrived ? 'ARRIVED' : 'pending') : 'no'}`)

  if (across?.arrived) {
    // ⭐ THE MOUSE lands a stub inside the new line — see {@link crossingTheBreak}.
    const moved = leaveSystem(port, across.stop, () => across.landing)
    // ⭐ …and what the MODEL now holds, which is the fact a picture can be judged against: if the
    // span did not grow, the wrap wrote nothing and the drawing was never the problem.
    dbg(`[${port.label}] after the wrap the wedge spans`
      + ` ${JSON.stringify(hairpinStartAddressOf(engine, id))} → ${JSON.stringify(hairpinEndAddress(engine.getScore(), id))}`
      + ` | length ${JSON.stringify(engine.getHairpinById(id)?.length)}`)
    return { moved, wrapped: true, droppedPx: 0 }
  }
  // ⛔ **NO INK LIMIT ON A DRAG** — 🚨 and it was the bug (his report, 2026-08-20: the drag walked a
  // few bars and then stopped dead, never reaching the line's end to wrap). The limit refuses a whole
  // FRAME whose delta would end past the line's edge — and a frame is not a step: most of it may be
  // the journey to the last boundary, with only its tail overshooting. Refusing it stalls the walk
  // one stop short, for ever, because the next frame is bigger still.
  // ⭐ The limit belongs to the KEYBOARD, where a press has no hand behind it to say how far is
  // meant. Here the ink simply follows the cursor, which cannot itself leave the page — and the
  // cursor passing the barline is what wraps.
  // ⚠️ `carryMark` unconditionally, ⛔ not only when it crosses: the LATCH lives in there, and a
  // frame that merely passes through offset zero is exactly the one it exists for.
  const carried = carryMark(port, dx, dy, true)
  // ⭐ In PIXELS, because that is what the caller's cursor anchor is measured in.
  return { moved: carried.moved, wrapped: false, droppedPx: carried.dropped * staffSpacePx }
}

/** The wedge's start address, for the log line above. */
function hairpinStartAddressOf(engine: HairpinWalkEngine, id: string) {
  return hairpinStartAddress(engine.getScore(), id)
}

/** Which end's port, built over the writes the device brought. */
function portFor(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: HairpinWrite,
): MarkWalkPort {
  return which === 'start' ? startPort(engine, id, write) : endPort(engine, id, write)
}

/**
 * The ordinary press: ink, unless the ink would leave a system it has no way off.
 *
 * ⭐ While a crossing is PENDING (`crossing`, i.e. there IS a stop on another system) the limit does
 * not apply — that is the ink being pushed towards the edge it wraps at.
 */
function inkPress(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
  crossing: boolean,
): boolean {
  if (!crossing && !inkStaysOnSystem(engine, id, which, port, dx)) {
    dbg(`[${port.label}] refused — the ink would leave this system, and there is nothing to wrap onto`)
    return false
  }
  const before = port.offsetX()
  const moved = port.nudge(dx, 0)
  dbg(`[${port.label}] ink ${dx > 0 ? '+' : ''}${dx.toFixed(2)}ss | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss`
    + `${moved ? '' : ' (REFUSED)'}`)
  return moved
}

/**
 * ⭐⭐ **THE WRAP ITSELF** — hand that end to `stop`, and put its ink where {@link crossingTheBreak}
 * said: {@link WRAP_STUB_SS} inside the new line.
 *
 * ⚠️ **The MODEL steps further than the DRAWING**, and that is deliberate. A wedge's extent moves by
 * whole lane slots — a bar, in a score of whole rests — so the music now covers that bar; the ink
 * shows a stub. Ink ≠ anchor is the walk's ordinary state everywhere, and here it is what makes a
 * wrap read as *"it went over, carry on down there"* rather than as a bar of wedge appearing from
 * nowhere (his rule and his rejection, 2026-08-20).
 *
 * ⚠️ The caller owns the undo entry: one batch for a key press, none at all for a drag frame.
 */
function leaveSystem(port: MarkWalkPort, stop: MarkStop, offsetAfter: (before: number) => number): boolean {
  const before = port.offsetX()
  const landing = offsetAfter(before)
  if (!port.reanchor(stop)) {
    dbg(`[${port.label}] ⛔ the model REFUSED the wrap onto ${JSON.stringify(stopAddress(stop))}`)
    return false
  }
  // ⚠️ The REBASE writer, not the nudge: this is bookkeeping, and a page limit that refused it would
  // strand the wedge mid-wrap. ⭐ The offset is SET, not accumulated: the landing is a position on
  // the NEW line, and nothing the ink was carrying on the old one means anything over there.
  const rebased = port.rebase?.(landing - before)
  dbg(`[${port.label}] WRAPPED onto ${JSON.stringify(stopAddress(stop))}`
    + ` | landing ${landing.toFixed(2)}ss`
    + ` | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss${rebased ? '' : ' (REBASE REFUSED)'}`
    + ` | anchor now ${port.anchorX()?.toFixed(0) ?? '?'}`)
  return true
}
