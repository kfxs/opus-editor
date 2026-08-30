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
  hairpinBoundaryX, hairpinEndAddress, hairpinInkY, hairpinStaffBand, hairpinStartAddress,
  hairpinSystemInkLimit, hairpinSystemSlotFor, hairpinTipX,
} from './hairpinLane'
import { hairpinStaffSpacePx } from './elements/hairpinHandles'
import { type MarkStop, type MarkWalkPort } from './markWalk'
import { type BreakWrapPort, type SystemInk } from './markBreakWrap'
import { dragFrame, walkPress, type DragFrame } from './markDrive'
import { dbg, debugEnabled } from '../utils/debug'

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — the one FLIP a drag is still owed a settlement for.**
 *
 * ⛔ It is NOT drag state and carries no travel: one id and one y, written by a flip
 * ({@link flipPlacement}) and spent in the same mouse event ({@link settleHairpinLanding}). A gesture
 * that ends in between simply leaves it, and the next wedge's flip drops it on sight.
 */
let landed: { id: string; inkY: number } | null = null

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type HairpinWalkEngine = Pick<MusicEngine,
  'getHairpinById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextHairpinStartSlot' | 'moveHairpinStartToSlot'
  | 'nextHairpinEndStop' | 'moveHairpinEndToStop'
  | 'nudgeHairpinEndpoint' | 'rebaseHairpinEndpointOffset'
  | 'previewHairpinEnd' | 'previewHairpinEndpointOffset' | 'previewHairpinEndpointRebase'
  | 'previewHairpinSlot' | 'previewHairpinStaffSlot' | 'previewHairpinOffset' | 'previewHairpinOffsetRebase'
  | 'moveHairpinToSlot' | 'nudgeHairpin' | 'rebaseHairpinOffset' | 'previewHairpinPlacement'>

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
 * 🚨🚨 **CROSSING A SYSTEM BREAK** — the rule, its four rejected cuts and its arithmetic all live in
 * `./markBreakWrap` now (extracted 2026-08-21, when the ottava's squares asked for the same
 * gesture), and `./markDrive` is what asks it. What is here is the wedge's PORT into it: where THIS
 * end's line runs out, and where a candidate stop's line begins.
 */
function wrapPort(engine: HairpinWalkEngine, id: string, which: 'start' | 'end'): BreakWrapPort {
  return {
    here: () => systemInkLimit(engine, id, which),
    there: (stop) => {
      const hairpin = engine.getHairpinById(id)
      return hairpin ? hairpinSystemInkLimit(engine, hairpin, stopAddress(stop)) : null
    },
    address: (stop) => stopAddress(stop),
  }
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
  // ⭐⭐ **NOTHING STOPS IT GOING LEFT** — his report, 2026-08-21: *"the trill and the hairpin offset
  // left endpoint is also limited to the first measure after the time signature, the user should not
  // have that limit"*. ⛔ Do not restore a `min` clause here. The offset is FREE; the only stop on
  // that side is the PAGE's edge, which is the engine's rule (`engine/layout/pageBounds`) and is
  // measured where the SQUARE is, not where the ink is.
  return true
}

/** The drawn extent of the SYSTEM this end stands on — its line's first `noteStartX` and last
 *  `noteEndX`. Null when that bar was not drawn. */
function systemInkLimit(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
): SystemInk | null {
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
  return walkPress(endpointDrive(engine, id, which, keyWrites(engine, id, which)), dx)
}

/**
 * ⭐ The wedge's row in the shared driver's table (`./markDrive`) — one tip, keys or mouse.
 *
 * ⭐ **The one family with an `inkGuard`, and it is a real rule**: the ink may not leave a system it
 * has no way off ({@link inkStaysOnSystem}). ⚠️ While a crossing is PENDING the limit does not apply —
 * that is the ink being pushed towards the very edge it wraps at.
 *
 * ⛔ **And no crossing bound**, unlike the bracket's and the pedal's ends: this family has never had
 * one, and adding it here would be a behaviour change dressed up as a refactor.
 */
function endpointDrive(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: HairpinWrite,
) {
  const port = portFor(engine, id, which, write)
  return {
    port,
    wrap: wrapPort(engine, id, which),
    label: which === 'start' ? 'Move hairpin start' : 'Resize hairpin',
    runBatch: (description: string, fn: () => void) => engine.runBatch(description, fn),
    inkGuard: (crossing: boolean, dx: number) => {
      if (crossing || inkStaysOnSystem(engine, id, which, port, dx)) return true
      dbg(`[${port.label}] refused — the ink would leave this system, and there is nothing to wrap onto`)
      return false
    },
  }
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
): DragFrame | null {
  const { port, wrap } = endpointDrive(engine, id, which, previewWrites(engine, id, which))
  // ⛔ **NO INK LIMIT ON A DRAG** — 🚨 and it was the bug (his report, 2026-08-20: the drag walked a
  // few bars and then stopped dead, never reaching the line's end to wrap). The limit refuses a whole
  // FRAME whose delta would end past the line's edge — and a frame is not a step: most of it may be
  // the journey to the last boundary, with only its tail overshooting. Refusing it stalls the walk
  // one stop short, for ever, because the next frame is bigger still. ⭐ So the `inkGuard` above is
  // the KEYBOARD's alone, and this hands the driver `port` and `wrap` without it.
  // ⚠️ Screen-down is +y and so is the stored number, so no conversion — ⛔ unlike the tempo mark's.
  const frame = dragFrame({
    port,
    wrap,
    latch: true,
    // ⭐ The line this end is being pushed towards, which is what a wrap has to be read against.
    note: () => {
      const edge = systemInkLimit(engine, id, which)
      return `line ${edge ? `${edge.min.toFixed(0)}…${edge.max.toFixed(0)}` : '?'}`
    },
  }, cursorX, dxPx, dyPx)
  // ⭐ …and what the MODEL now holds, which is the fact a picture can be judged against: if the span
  // did not grow, the wrap wrote nothing and the drawing was never the problem.
  if (frame?.wrapped) {
    dbg(`[${port.label}] after the wrap the wedge spans`
      + ` ${JSON.stringify(hairpinStartAddressOf(engine, id))} → ${JSON.stringify(hairpinEndAddress(engine.getScore(), id))}`
      + ` | length ${JSON.stringify(engine.getHairpinById(id)?.length)}`)
  }
  return frame
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
 * ⭐⭐ **THE BODY'S PORT** — the WHOLE wedge walking, where the two squares walk one end each.
 *
 * ⭐ **Its stops are the start's** (`nextHairpinStartSlot`), because a wedge moved as one is moved by
 * its beginning: the extent is an amount of music and travels with it. So the model write is the
 * simplest of the three — one field — and nothing has to be held still.
 *
 * ⭐ **Its ink is BOTH ends at once** (`hairpinOps.setHairpinOffset`), which is what the body drag has
 * always written; the offset it reads back is the start's, since the pair always carry the same
 * number while the body is moved as one.
 */
function bodyPort(engine: HairpinWalkEngine, id: string, write: HairpinBodyWrite): MarkWalkPort {
  return {
    label: 'Hairpin',
    nextStop: (direction) => engine.nextHairpinStartSlot(id, direction),
    stopX: (stop) => boundaryX(engine, id, stop as HairpinSlotTarget),
    anchorX: () => {
      const here = hairpinStartAddress(engine.getScore(), id)
      return here ? boundaryX(engine, id, here) : null
    },
    staffSpacePx: () => hairpinStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.start?.x ?? 0,
    reanchor: (stop) => write.move(stop as HairpinSlotTarget),
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/** The body's three writes — the same pair of devices as {@link HairpinWrite}: a KEY press records
 *  its own undo entry, a drag FRAME records none. */
interface HairpinBodyWrite {
  move: (target: HairpinSlotTarget) => boolean
  nudge: (dx: number, dy: number) => boolean
  rebase: (dx: number) => boolean
}

const bodyKeyWrites = (engine: HairpinWalkEngine, id: string): HairpinBodyWrite => ({
  move: (target) => engine.moveHairpinToSlot(id, target),
  nudge: (dx, dy) => engine.nudgeHairpin(id, dx, dy),
  rebase: (dx) => engine.rebaseHairpinOffset(id, dx),
})

const bodyPreviewWrites = (engine: HairpinWalkEngine, id: string): HairpinBodyWrite => ({
  move: (target) => engine.previewHairpinSlot(id, target),
  nudge: (dx, dy) => engine.previewHairpinOffset(id, dx, dy),
  rebase: (dx) => engine.previewHairpinOffsetRebase(id, dx),
})

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON A SELECTED WEDGE, no square armed** — the body's keyboard walk,
 * so the arrows and the drag land in ONE state (his ask, 2026-08-20, once the mouse had it).
 *
 * ⭐ Everything it does is the endpoints' — ink, the crossing at each boundary, the wrap at a system
 * break — with `bodyPort`'s stops and writes, which move the WHOLE wedge and keep its length.
 * ⛔ The vertical stays a plain ink lift here: the SYSTEM JUMP is a mouse gesture, needing a hand to
 * say which staff it means.
 */
export function walkHairpinBody(engine: HairpinWalkEngine, id: string, dx: number): boolean {
  const port = bodyPort(engine, id, bodyKeyWrites(engine, id))
  return walkPress({
    port,
    // ⭐ The START's system, because a wedge moved as one is moved by its beginning.
    wrap: wrapPort(engine, id, 'start'),
    label: 'Move hairpin',
    runBatch: (description, fn) => engine.runBatch(description, fn),
    inkGuard: (crossing, step) => {
      if (crossing || inkStaysOnSystem(engine, id, 'start', port, step)) return true
      dbg(`[${port.label}] refused — the ink would leave this system, and there is nothing to wrap onto`)
      return false
    },
  }, dx)
}

/**
 * ⭐⭐ **ONE FRAME OF A BODY DRAG** — the whole wedge follows the hand, and the MUSIC comes along at
 * each boundary its ink reaches (his ask, 2026-08-20: *"we still have the offset with the mouse when
 * no endpoint is selected… we must turn that into a walk"*).
 *
 * It is `dragHairpinEndpoint`'s twin with a third port, and the two halves of a dragged mark that
 * `./dynamicWalk` established:
 *
 * ⭐⭐ **THE VERTICAL IS A JUMP, not a walk** — *"in the y axis we detect if there is another system so
 * we go to there"*. Within a system a wedge's place is continuous; between systems there is nothing
 * continuous to travel through, so coming down onto the staff below is a jump, decided by
 * `./markSystemJump`'s rule (halfway between where it sits and where it would sit) and NOT by
 * crossing the pentagram. ⛔ And a jump ENDS the frame: the anchor has moved, so this frame's `dx`
 * would be spent against a slot the hand was never near.
 *
 * ⭐ A jump lands the wedge where the engraver would put it — both axes of the offset go, the `y`
 * because on that gesture it is not a lift at all but the distance the hand travelled to reach the
 * other staff.
 *
 * ⛔ No latch here (⛔ unlike a square's drag): a whole wedge is being placed by eye, not aimed at one
 * note's edge — the dynamic's reasoning, and the same conclusion.
 *
 * ⛔ Declines — **null** — when the wedge is not drawn, so there is no staff-space size to convert
 * the cursor's pixels with.
 */
export function dragHairpinBody(
  engine: HairpinWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): { moved: boolean; jumped: boolean } | null {
  const port = bodyPort(engine, id, bodyPreviewWrites(engine, id))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  // ⏱ TEMPORARY (docs/render-performance-plan.md §12.5a) — the numbers this frame DECIDES FROM.
  // ⭐ `inkY` is the mark's OWN DRAWN INK, and that is the whole question: a preview redraws the
  //   family without re-running the render, so if the ink it leaves differs from a full render's,
  //   every decision below is made against the wrong y and the next frame reads the result.
  // ⚠️ Lazily built — a suppressed `dbg` still evaluates its arguments (docs/logging.md).
  if (debugEnabled()) {
    const h = engine.getHairpinById(id)
    const ink = hairpinInkY(engine, id)
    dbg(`[Hairpin frame] cursor x${cursorX.toFixed(0)} dy${dyPx.toFixed(1)}`
      + ` | inkY ${ink === null ? '—' : ink.toFixed(1)} → ${ink === null ? '—' : (ink + dyPx).toFixed(1)}`
      + ` | staff:${h?.staffId ?? 0} placement:${h?.placement ?? 'auto'} ss:${staffSpacePx.toFixed(2)}`)
  }

  // ⭐⭐ ITS OWN STAFF FIRST — see {@link flipPlacement}. A wedge dragged up off a staff belongs ABOVE
  // that staff long before it belongs to the one over it.
  if (flipPlacement(engine, id, dyPx)) return { moved: true, jumped: true }
  if (jumpStaves(engine, id, cursorX, dyPx, staffSpacePx)) return { moved: true, jumped: true }

  // ⛔ No wrap and no latch: a whole wedge leaves its staff by a JUMP, and it is placed by eye.
  const frame = dragFrame({ port, latch: false }, cursorX, dxPx, dyPx)
  return frame && { moved: frame.moved, jumped: false }
}

/**
 * ⭐⭐ **LEAVING THE WEDGE'S OWN STAFF** — the half of a drag the walk cannot do
 * (`./markSystemJump`, shared with the dynamic and the tempo mark).
 *
 * ⭐⭐ **The staff below counts, not only the system below** (his ask, 2026-08-21, one day after the
 * dynamic got it): on a grand staff a wedge dragged down belongs to the LEFT HAND, so the landing
 * writes the wedge's `staffId` as well as its address (`hairpinOps.setHairpinAtStaffSlot`). ⭐ It
 * composes with the placement rung below — down from *below staff N* the next rung is *above staff
 * N+1*, and N+1 is now allowed to be the other hand of the same system.
 *
 * ⭐ The lift comes back out first — left in, the wedge's "home" follows it down for ever and the
 * switch never arrives (the report that produced the rule, 2026-08-19). And on arrival BOTH axes of
 * the offset go: over there the old x means nothing, and the y was never a lift.
 */
function jumpStaves(
  engine: HairpinWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
): boolean {
  const hairpin = engine.getHairpinById(id)
  const inkY = hairpinInkY(engine, id)
  if (!hairpin || inkY === null) return false

  const target = hairpinSystemSlotFor(engine, hairpin, cursorX, inkY + dyPx, staffSpacePx)
  if (!target) return false

  // ⚠️ Read the home BEFORE the write — afterwards the lane answers about the staff it has left.
  const from = hairpinStartAddress(engine.getScore(), id)
  const fromX = from ? hairpinBoundaryX(engine, hairpin, from) : null

  if (!engine.previewHairpinStaffSlot(id, target)) return false

  // ⭐⭐ **IT ARRIVES ON THE SIDE IT CAME FROM** — his correction, 2026-08-20: *"i don't like that
  // going down jumps from below the staff to below, and going up from above to above; it is not
  // intuitive"*. The vertical is a LADDER of the places a wedge may stand — …above N, below N,
  // above N+1, below N+1… — and a jump takes ONE rung: coming down, the next rung is ABOVE the staff
  // below, which is also where the ink already is. ⛔ Landing on the far side skips a rung and puts
  // the wedge past the hand.
  const facing: 'above' | 'below' = dyPx > 0 ? 'above' : 'below'
  engine.previewHairpinPlacement(id, facing)

  // ⚠️⚠️ EXPLORATORY (2026-08-30) — **A RE-ANCHOR DOES NOT MOVE THE DRAWING** (his *"and by the way
  // when reanchoring it jumps"*, measured: the anchor 251 → 307 with the offset zeroed). The old
  // line dropped BOTH axes, which is why the wedge left the hand on the frame it landed. Now the
  // anchor's own travel is paid back into the x, and the vertical — which cannot be predicted, the
  // wedge arriving on the OTHER side of a different staff — is settled from the render
  // ({@link settleHairpinLanding}), exactly as the placement flip is.
  const after = engine.getHairpinById(id)
  const toX = after ? hairpinBoundaryX(engine, after, target) : null
  const offset = hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.start
  if (offset?.y) engine.previewHairpinOffset(id, 0, -offset.y)
  // ⚠️ Whatever the picture could not say is paid as 0 — the no-guessing rule (`./markWalk`).
  const dx = fromX !== null && toX !== null ? (fromX - toX) / staffSpacePx : -(offset?.x ?? 0)
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so no limit has anything to judge.
  if (dx) engine.previewHairpinOffsetRebase(id, dx)
  landed = { id, inkY: inkY + dyPx }
  dbg(`[Hairpin] jumped ${facing} the staff it now belongs to | id:${id} → m${target.measure}`
    + ` staff:${target.staffId ?? 0} | decided from inkY ${inkY.toFixed(1)} + dy ${dyPx.toFixed(1)}`
    + ` = ${(inkY + dyPx).toFixed(1)} at cursor x${cursorX.toFixed(0)}`
    + ` | anchor ${fromX?.toFixed(0) ?? '—'}→${toX?.toFixed(0) ?? '—'} paid dx ${dx.toFixed(2)}ss`
    + ` | the ink is to stay at ${(inkY + dyPx).toFixed(1)}`)
  return true
}

/**
 * ⭐⭐ **WHICH SIDE OF ITS OWN STAFF — the step a vertical drag takes BEFORE any question of another
 * system.** His report, 2026-08-20: *"it jumps to the upper system too quickly; we need a boundary —
 * remember we can draw a hairpin up or down the staff"*.
 *
 * A wedge has a `placement`, so the space above its staff is a place it BELONGS, not a no-man's-land
 * on the way to the staff above. Crossing the staff's own five lines is what moves it there:
 *
 * ```
 *   below, and the ink has passed the TOP line     →  above this staff
 *   above, and the ink has passed the BOTTOM line  →  below it
 * ```
 *
 * ⭐ **And that fixes the "too quickly" by construction**, without a threshold to tune: once the
 * wedge is above its staff, `markSystemJump` measures its natural distance from the TOP line, so the
 * staff above is a whole system away again rather than a few spaces.
 *
 * ⭐ The lift goes with the flip — a `y` measured below the staff means nothing above it — and the
 * frame ENDS, exactly as a jump does: one visible step per gesture.
 */
function flipPlacement(engine: HairpinWalkEngine, id: string, dyPx: number): boolean {
  const hairpin = engine.getHairpinById(id)
  const inkY = hairpinInkY(engine, id)
  const band = hairpin && hairpinStaffBand(engine, hairpin)
  if (!hairpin || inkY === null || !band) return false

  const above = (hairpin.placement ?? 'below') === 'above'
  const next = inkY + dyPx
  const flipped: 'above' | 'below' | null =
    !above && next < band.top ? 'above'
      : above && next > band.bottom ? 'below'
        : null
  if (!flipped || !engine.previewHairpinPlacement(id, flipped)) return false

  const offset = hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.start
  if (offset?.y) engine.previewHairpinOffset(id, 0, -offset.y)
  // ⚠️⚠️ EXPLORATORY (2026-08-30) — **A FLIP DOES NOT MOVE THE DRAWING** ({@link settleLanding}).
  // His report, *"look how it jumps"*: measured, the ink leapt **444.6 → 378.2** on a frame the hand
  // had moved 3px, because the wedge is re-engraved on the other side of its staff and the lift it
  // had is dropped as meaningless there. It IS meaningless there — ⛔ the line above stays — but the
  // PICTURE has to stay under the hand, so where it is meant to be is remembered and paid as soon as
  // the render says what the other side's ladder gave it.
  landed = { id, inkY: next }
  dbg(`[Hairpin] moved ${flipped} its own staff | id:${id} | the ink is to stay at ${next.toFixed(1)}`)
  return true
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHAT THE FLIP ACTUALLY DID WITH THE INK, paid back.** The
 * pedal's and the bracket's rule of the same day ([[reference_a_drag_decision_cannot_read_its_own_outcome]]),
 * and here it is the WHOLE payment rather than a residual: the two sides of a staff have no arithmetic
 * relation a caller could predict from — what the wedge gets above is whatever the ladder has left
 * above, which is only knowable once the render has run.
 *
 * ⭐ So it is measured AFTER it: {@link flipPlacement} remembers where the ink was meant to be, the
 * caller re-draws, and this pays the difference in the SAME mouse event — ⛔ not on the next frame,
 * which would leave a 66px flash on screen for one frame.
 *
 * @returns true when it wrote, so the caller knows to draw again.
 */
export function settleHairpinLanding(engine: HairpinWalkEngine, id: string): boolean {
  if (!landed || landed.id !== id) { landed = null; return false }
  const was = landed.inkY
  landed = null
  const drawn = hairpinInkY(engine, id)
  const staffSpacePx = hairpinStaffSpacePx(engine.getElementRegistry(), id)
  // Half a pixel is the rounding of the drawing, ⛔ not a debt.
  if (drawn === null || !staffSpacePx || Math.abs(was - drawn) < 0.5) return false

  const debt = was - drawn
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so the page limit has nothing to judge.
  engine.previewHairpinOffsetRebase(id, 0, debt / staffSpacePx)
  dbg(`[Hairpin] flip settled | id:${id} | ink ${drawn.toFixed(1)} → ${was.toFixed(1)}`
    + ` (${debt.toFixed(1)}px the other side of the staff gave or took)`)
  return true
}

