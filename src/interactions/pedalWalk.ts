/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A PEDAL'S TWO SQUARES** — ←/→ and `Ctrl`+←/→ move the armed
 * sign's INK, and once that ink reaches the next stop of the lane the FOOT goes with it.
 *
 * The pedal is the sixth family to get this gesture, after the slur, the dynamic/tempo pair, the
 * hairpin, the trill and the octave bracket, and it arrives by the rule the wedge's second square
 * set (2026-08-20): **a handle that has BOTH a re-anchor and an offset owes the walk that joins
 * them.** Before this, the two halves of moving a sign were unrelated — a plain arrow wrote a
 * cosmetic offset that could slide the `Ped.` arbitrarily far from the note it claims to be struck
 * with, and `Ctrl+Shift+←/→` (`shortcutWiring`) jumped the extent a whole slot with the ink snapping
 * to wherever the engraver put it.
 *
 * The arithmetic is `./markWalk`'s, untouched; this file is the PORT — twice for the two SQUARES, and
 * once more for the pedal moved as ONE ({@link walkPedalBody}, whose stops are the press's and whose
 * ink is both signs). What is pedal-specific is three things:
 *
 * ⭐⭐ **THE END IS A MOMENT IN TIME, NOT A NOTE.** A bracket's hook closes around the last covered
 * notehead and a trill's line ends at a duration; the foot comes up at a POINT, which is why the
 * END's stops are `pedalOps.PedalLiftTarget`s and not slots. ⭐ Two of the pedal's own facts follow
 * from that and from nothing else: a lift can stand on the BARLINE, where no onset is
 * (`./pedalLane.pedalLiftX` prices it there, which is Gould's rule 3 as drawn), and growing the span
 * reaches THROUGH a slot rather than onto it.
 *
 * ⭐⭐ **BOTH ENDS READ LEFT EDGES** — `PedalRenderer` draws the press and the release against the
 * same `noteLeftX`, ⛔ so the bracket's left-then-right pair is NOT ported (`./pedalLane`).
 *
 * ⭐⭐ **A CROSSING HOLDS THE OTHER END STILL — until they MEET, and then the press pushes.** The
 * press writes `beat` and `length` together (`setPedalStartAtSlot`) and the lift writes `length`
 * alone, so ordinarily the far sign does not move; where the press catches the lift it takes it
 * along (his rule, 2026-08-21, and `pedalOps` carries the report — a stop that can refuse FOREVER
 * kills the walk and the square runs off the page). ⚠️ Either way a crossing press is AUDIBLE: it
 * changes how long the notes RING. Every press either side of it is ink and changes nothing.
 *
 * ⭐ **The crossing KEEPS both signs' nudges by construction** — the model ops touch no override at
 * all, so unlike the dynamic there is no `…KeepingOffset` twin to reach for. What the walk then does
 * with the armed sign's own offset is the family's identity: it takes the gap back out, so the ink
 * does not jump.
 *
 * ⛔ **No vertical STOP** — and here for a second reason on top of the family's: a pedal and its own
 * release share ONE baseline (Gould p. 333, {@link PedalOffsetOverride}), so there is nothing above
 * or below to arrive at AND nothing per-sign to write. ⚠️ A DRAG still carries a `y`, because it
 * moves both axes in one gesture ({@link dragPedalEndpoint}) — plain ink, on both signs at once.
 *
 * 🚨🚨 **A SYSTEM BREAK IS A WRAP, not a refusal.** The walk itself will never cross one — two
 * systems' x's are not one ruler (`./markWalk`, permanently and rightly) — so the press that leaves
 * the line is a separate move: the ink pays its way to the last barline, and what would have hung in
 * the margin re-appears at the START of the next system. The rule, its four rejected cuts and its
 * arithmetic are the wedge's, in `./markBreakWrap`; ⛔ ported, never copied. What is pedal-specific
 * is only where a sign is drawn, which `./pedalLane` measures.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { PedalLiftTarget, PedalSlotTarget } from '../engine/models/pedalOps'
import { pedalOffsetOverrideOf } from '../engine/models/engravingOverrides'
import {
  pedalLiftX, pedalPressAddress, pedalPressX, pedalStaffSpacePx, pedalSystemInkLimit,
} from './pedalLane'
import { carryMark, crossWithoutArrival, markWalkCrosses, type MarkWalkPort } from './markWalk'
import { breakCrossing, leaveSystem, type BreakWrapPort } from './markBreakWrap'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type PedalWalkEngine = Pick<MusicEngine,
  'getPedalById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextPedalStartSlot' | 'nextPedalLift' | 'pedalLiftSlot'
  | 'movePedalStartToSlot' | 'movePedalLiftTo'
  | 'nudgePedalEndpoint' | 'rebasePedalEndpointOffset'
  | 'previewPedalStartAtSlot' | 'previewPedalLiftAt'
  | 'previewPedalEndpointOffset' | 'previewPedalEndpointRebase'
  | 'movePedalToSlot' | 'nudgePedal' | 'rebasePedalOffset'>

/**
 * ⭐ **WHAT SEPARATES THE TWO DEVICES, and the whole of it**: a KEY press records its own undo step,
 * a drag FRAME records none and leaves the drop to commit once ({@link MusicEngine.commitPedalDrag}).
 * Everything else — the stops, the geometry, the identity — is shared, which is what makes a drag and
 * N presses land in the same state rather than in two states that merely look alike (the bracket's
 * arrangement, `./ottavaWalk`, and for its reason).
 *
 * ⭐⭐ **TWO re-anchor doors, ⛔ not one**, and that is the pedal's own shape showing through: the
 * press lands on an ONSET (`PedalSlotTarget`) and the lift on a MOMENT (`PedalLiftTarget`), which is
 * why the bracket's single `reanchor` could not simply be copied. Each port reaches for its own.
 */
interface PedalWrite {
  press: (target: PedalSlotTarget) => boolean
  lift: (target: PedalLiftTarget) => boolean
  /** ⚠️ `dy` is SCREEN (+ down) and lands on BOTH signs however it is asked for
   *  ({@link PedalOffsetOverride} has one vertical). The KEYS never pass one: `shortcutWiring` routes
   *  a vertical press straight at the engine, so only a DRAG — which moves both axes in one gesture —
   *  has anything to put here. */
  nudge: (dx: number, dy: number) => boolean
  /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
   *  the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
   *  crosses again. */
  rebase: (dx: number) => boolean
}

/** The keyboard's writes: each records its own undo entry, and a crossing press wraps them in one
 *  batch ({@link walkPedalEndpoint}). */
function keyWrites(engine: PedalWalkEngine, id: string, which: 'start' | 'end'): PedalWrite {
  return {
    press: (target) => engine.movePedalStartToSlot(id, target),
    lift: (target) => engine.movePedalLiftTo(id, target),
    nudge: (dx, dy) => engine.nudgePedalEndpoint(id, which, dx, dy),
    rebase: (dx) => engine.rebasePedalEndpointOffset(id, which, dx),
  }
}

/** The drag's writes: the same four edits with no undo entry of their own. */
function previewWrites(engine: PedalWalkEngine, id: string, which: 'start' | 'end'): PedalWrite {
  return {
    press: (target) => engine.previewPedalStartAtSlot(id, target),
    lift: (target) => engine.previewPedalLiftAt(id, target),
    nudge: (dx, dy) => engine.previewPedalEndpointOffset(id, which, dx, dy),
    rebase: (dx) => engine.previewPedalEndpointRebase(id, which, dx),
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON AN ARMED SQUARE** — nudge that sign's ink by `dx` staff-spaces
 * (¼ space plain, 1 space with `Ctrl`), and hand the foot along if the ink has arrived at the next
 * stop of the lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the pedal somewhere the user never put it.
 *
 * ⚠️ **ONE crossing per press** (`carryMark`'s bound, and the trill's report that made it a rule): a
 * sign whose ink has been nudged far ahead of its note is already PAST every stop between the two,
 * so an unbounded loop would hop the whole distance on one keystroke — invisibly, since the identity
 * keeps the ink still.
 *
 * ⚠️ The walk STOPS where the model refuses — at either end of the lane, and where SHORTENING would
 * leave the pedal holding no music. ⭐ ⛔ Not where the press meets the lift: that one pushes
 * (`pedalOps.setPedalStartAtSlot`). The press then stays a plain ink nudge, so the sign can still be
 * pushed past, which is what an override is for.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such pedal, or the page limit refused the ink.
 */
export function walkPedalEndpoint(
  engine: PedalWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
): boolean {
  if (dx === 0) return false
  const port = portFor(engine, id, which, keyWrites(engine, id, which))

  const wrap = wrapPort(engine, id, which)
  const across = breakCrossing(port, wrap, dx)
  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    if (inkPress(port, dx)) return true
    // ⭐⭐ The ink had nowhere to go — the page's edge. The press then spends itself on the FOOT
    // rather than on nothing at all, in its own batch for the reason above. 🚨 The WRAP first where
    // there is one: a blocked press at the end of a system is exactly the case `./markBreakWrap`
    // exists for, and its arrival test can never be met once the ink has stopped moving (his *"cross
    // system doesn't work at all"*, 2026-08-21).
    let handed = false
    engine.runBatch(which === 'start' ? 'Move pedal start' : 'Move pedal lift', () => {
      handed = across
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  engine.runBatch(which === 'start' ? 'Move pedal start' : 'Move pedal lift', () => {
    moved = across?.arrived
      // ⭐ THE KEYS re-base by the FOLDED distance: their ink really did travel it, one press at a
      // time, so the sign re-appears exactly as far into the new line as the hand pushed it past the
      // barline (`./markBreakWrap`).
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx, 0, false, 1).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A SQUARE DRAG** — the same journey with the cursor's delta in PIXELS instead of a
 * key's step, and no undo entry (the drop commits once, {@link MusicEngine.commitPedalDrag}). His
 * ask, 2026-08-21: *"i think we should do the pedal drag walking"*, the bracket's gesture arriving at
 * the last family that still snapped.
 *
 * ⭐ **The mouse and the arrows become ONE gesture.** The drag used to SNAP the grabbed sign onto the
 * nearest address and write it outright (`elements/pedalHandles.pedalDragTargetAt`), so the foot
 * jumped a whole note at a time and neither sign could be parked between two — the very thing the
 * keys had just stopped doing. Now the ink follows the hand and the pedal comes along when the ink
 * reaches a stop, so a drag and N presses covering the same distance leave the model in one state
 * rather than in two that merely look alike.
 *
 * ⭐⭐ **AND IT READS NO `y` TO DECIDE WHERE IT IS** — which is the second thing the snap needed and
 * this does not. A pedal is the OUTERMOST below-staff family, so the hand rides a line that can sit
 * nearer the NEXT system's noteheads than its own; the snap answered that by measuring the gap
 * between the sign and the music above it every frame (`pedalHandles`, his report of 2026-08-18). A
 * walk never compares the cursor with a notehead at all: the ink travels along its own line and the
 * SYSTEM is decided by the wrap.
 *
 * ⭐⭐ **THE LATCH IS ON** (`./markWalk`), as it is for the wedge's tips and the bracket's ends: both
 * of a pedal's signs are AIMED at a column's left edge — that is where the engraver puts them — so
 * offset zero must be reachable exactly rather than by luck. ⛔ The keyboard keeps it off: a press is
 * a considered edit of a quarter space.
 *
 * 🚨 **A latched frame REPORTS what it DROPPED, because that travel must be REPAID.** The pixels the
 * latch cuts were still made by the hand, so the caller holds its cursor anchor back by exactly that
 * much and the next frame presents them again. Left unrepaid the ink falls behind the cursor a little
 * at every stop and never catches up — Baudisch's own complaint about snap-and-go. ⚠️ It is 0 on an
 * ordinary frame, so there is no special case.
 *
 * ⭐⭐ **THE HAND DECIDES WHERE THE LINE ENDS** — the keys have only the ink to go on and wrap when the
 * INK passes the edge; a drag has the pointer itself (`./markBreakWrap`, his rule for the wedge).
 * ⭐⭐ **And a WRAP ENDS THE GESTURE**: that sign is a line away and the hand is not, so every further
 * pixel would move it by a distance measured against a system it has left.
 *
 * ⭐⭐ **BOTH AXES, and they are different kinds of move**: the horizontal walks that sign through the
 * MUSIC, while the vertical is a plain ink lift — ⚠️ of BOTH signs, whichever square is under the
 * hand, because a pedal and its own release share ONE baseline (Gould p. 333). Nothing here enforces
 * that: {@link PedalOffsetOverride}'s shape does.
 *
 * ⚠️ **⛔ No screen→outward conversion, unlike the bracket's twin** — a pedal has one side
 * permanently, so `+ down` means the same thing everywhere it can be drawn and the number passes
 * straight through (`shortcutWiring` makes no conversion for the keys either).
 *
 * ⭐ The lift SURVIVES a crossing: it is the pair's height, not a distance to any particular note.
 * ⚠️ A frame that WRAPS spends itself on the wrap and drops its `dy` — the wedge's behaviour, and its
 * reason: the sign is on another system by then.
 *
 * ⛔ It declines — **null**, not a frame — when the pedal is not drawn, so there is no staff-space
 * size to convert the cursor's pixels with; `moved: false` means the frame reached the model and
 * nothing moved, and the caller must then leave its cursor anchor where it was.
 */
export function dragPedalEndpoint(
  engine: PedalWalkEngine,
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

  const wrap = wrapPort(engine, id, which)
  const across = breakCrossing(port, wrap, dx, cursorX)
  if (across?.arrived) {
    // ⭐ THE MOUSE lands a stub inside the new line — ⛔ not the folded distance the KEYS re-base by,
    // whose overshoot on the frame that wraps is a single frame of travel and comes out invisible
    // (`./markBreakWrap`).
    const moved = leaveSystem(port, wrap, across.stop, () => across.landing)
    return { moved, wrapped: true, droppedPx: 0 }
  }

  // ⚠️ `carryMark` unconditionally, ⛔ not only when it crosses: the LATCH lives in there, and a frame
  // that merely passes through offset zero is exactly the one it exists for.
  // ⛔ **NO ONE-CROSSING BOUND HERE** — a key press may cross one stop, but one frame of a fast drag
  // really can fly over several, and re-anchoring once would leave the sign trailing the cursor by
  // however many were skipped.
  const carried = carryMark(port, dx, dy, true)
  // ⭐ In PIXELS, because that is what the caller's cursor anchor is measured in.
  return { moved: carried.moved, wrapped: false, droppedPx: carried.dropped * staffSpacePx }
}

/**
 * ⭐⭐ **THE WHOLE PEDAL WALKS — the arrows with a pedal selected and NO square armed** (his ask,
 * 2026-08-21: *"lets do the pedal shape walking with keyboards"*). `ottavaWalk.walkOttavaBody`'s
 * twin, and the same three sentences hold one lane over:
 *
 * ⭐ **Its stops are the PRESS's**, because a pedal moved as one is moved by the foot going down: the
 * span is an amount of music and travels with it (`pedalOps.setPedalAtSlot`). So the LIFT is not held
 * — ⛔ the opposite of what either square does, which is exactly the difference between MOVING a mark
 * and RESHAPING it.
 *
 * ⭐ **Its ink is BOTH signs at once** (`nudgePedal`), which is what the arrows have always written
 * here; the offset it reads back is the PRESS's, since the pair carry the same number while the pedal
 * is moved as one.
 *
 * ⚠️ **AUDIBLE at the crossing, and only there** — it changes which notes ring. Every press either
 * side of it is ink and changes nothing.
 *
 * 🚨 It crosses a system break by the same WRAP as the squares (`./markBreakWrap`), measured from the
 * PRESS's own system.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written.
 */
export function walkPedalBody(engine: PedalWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = bodyPort(engine, id, bodyWrites(engine, id))

  const wrap = wrapPort(engine, id, 'start')
  const across = breakCrossing(port, wrap, dx)
  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    if (inkPress(port, dx)) return true
    // ⭐⭐ The ink had nowhere to go — the page's edge. The press then spends itself on the PEDAL
    // rather than on nothing at all. 🚨 The WRAP first where there is one: a blocked press at the end
    // of a system is exactly the case `./markBreakWrap` exists for, and its arrival test can never be
    // met once the ink has stopped moving.
    let handed = false
    engine.runBatch('Move pedal', () => {
      handed = across
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  engine.runBatch('Move pedal', () => {
    moved = across?.arrived
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx, 0, false, 1).moved
  })
  return moved
}

/** The whole pedal's writes on the KEYBOARD — each records its own undo entry, and a crossing press
 *  wraps them in one batch. ⚠️ `nudgePedal`'s second argument is the shared vertical and stays 0: no
 *  walk has one ({@link PedalWrite}). */
function bodyWrites(engine: PedalWalkEngine, id: string): PedalWrite {
  return {
    press: (target) => engine.movePedalToSlot(id, target),
    // ⛔ The body has no LIFT door: moved as one, the pedal is re-anchored by its press and the
    // release simply travels. A stop of the lift's own would RESHAPE it, which is the squares' job.
    lift: () => false,
    nudge: (dx, dy) => engine.nudgePedal(id, dx, dy),
    rebase: (dx) => engine.rebasePedalOffset(id, dx),
  }
}

/** ⭐ **THE BODY'S PORT** — the press's stops and geometry, with the WHOLE pedal's writes. */
function bodyPort(engine: PedalWalkEngine, id: string, write: PedalWrite): MarkWalkPort {
  return {
    label: 'Pedal',
    nextStop: (direction) => engine.nextPedalStartSlot(id, direction),
    stopX: (stop) => pressX(engine, id, stop as PedalSlotTarget),
    anchorX: () => {
      const here = pedalPressAddress(engine.getScore(), id)
      return here ? pressX(engine, id, here) : null
    },
    staffSpacePx: () => pedalStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => pedalOffsetOverrideOf(engine.getScore(), id)?.startX ?? 0,
    reanchor: (stop) => write.press(stop as PedalSlotTarget),
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/**
 * The ordinary press: ink, and a log line saying what it did to the offset.
 *
 * ⭐⭐ **THE INK IS FREE** — his rule, 2026-08-21, given for the bracket and about offsets generally:
 * *"the user should be able to offset it at will"*. ⛔ Do not add a limit that holds a sign inside
 * its own bar or system. The only stop on this road is the PAGE's edge (`layout/pageBounds`), which
 * is his own earlier rule and is judged per MOVING SIGN
 * ({@link MusicEngine.pedalEndpointStepAllowed}).
 */
function inkPress(port: MarkWalkPort, dx: number): boolean {
  const before = port.offsetX()
  const moved = port.nudge(dx, 0)
  dbg(`[${port.label}] ink ${dx > 0 ? '+' : ''}${dx.toFixed(2)}ss`
    + ` | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss${moved ? '' : ' (REFUSED)'}`)
  return moved
}

/** Which sign's port. ⛔ Not a `which` switch inside the members: each end states its own three
 *  answers and shares the three the pedal answers alike. */
function portFor(
  engine: PedalWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: PedalWrite,
): MarkWalkPort {
  return which === 'start' ? pressPort(engine, id, write) : liftPort(engine, id, write)
}

/** ⭐ **THE PRESS'S PORT** — its stops are the lane's onsets, and it takes one as the moment the
 *  damper falls, holding the lift (or pushing it, where they meet). */
function pressPort(engine: PedalWalkEngine, id: string, write: PedalWrite): MarkWalkPort {
  return port(engine, id, 'start', write, {
    label: 'Pedal press',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the two keys landing the press on different notes depending on how far it had been
    // nudged.
    nextStop: (direction) => engine.nextPedalStartSlot(id, direction),
    stopX: (stop) => pressX(engine, id, stop as PedalSlotTarget),
    anchorX: () => {
      const here = pedalPressAddress(engine.getScore(), id)
      return here ? pressX(engine, id, here) : null
    },
    reanchor: (stop) => write.press(stop as PedalSlotTarget),
  })
}

/** ⭐ **THE LIFT'S PORT** — its stops are the moments the foot can come up, read from the model so
 *  that the address the walk measures to is the one the renderer draws the `✻` at. */
function liftPort(engine: PedalWalkEngine, id: string, write: PedalWrite): MarkWalkPort {
  return port(engine, id, 'end', write, {
    label: 'Pedal lift',
    nextStop: (direction) => engine.nextPedalLift(id, direction),
    stopX: (stop) => liftX(engine, id, stop as PedalLiftTarget),
    // ⭐⭐ A MOMENT, ⛔ never "the last covered slot" — see the header.
    anchorX: () => {
      const here = engine.pedalLiftSlot(id)
      return here ? liftX(engine, id, here) : null
    },
    reanchor: (stop) => write.lift(stop as PedalLiftTarget),
  })
}

/** What the two signs answer alike — the scale, that sign's own stored nudge, and the two ink
 *  writes. ⚠️ `nudge`'s second argument is the SHARED vertical, which only a DRAG ever has: the
 *  KEYS' vertical never comes through the walk ({@link PedalWrite}). */
function port(
  engine: PedalWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: PedalWrite,
  ends: Pick<MarkWalkPort, 'label' | 'nextStop' | 'stopX' | 'anchorX' | 'reanchor'>,
): MarkWalkPort {
  return {
    ...ends,
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN pedal's staff,
    // which may be a SMALL one.
    staffSpacePx: () => pedalStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () =>
      pedalOffsetOverrideOf(engine.getScore(), id)?.[which === 'start' ? 'startX' : 'endX'] ?? 0,
    nudge: (dx, dy) => write.nudge(dx, dy),
    // ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
    // the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
    // crosses again.
    rebase: (dx) => write.rebase(dx),
  }
}

/**
 * ⭐ **THE PEDAL'S ANSWERS TO {@link BreakWrapPort}** — where THIS sign's system runs out, and where
 * a candidate stop's system begins. ⚠️ Both off the LAST RENDER, and both may answer null, which the
 * shared rule reads as *"no wrap"* rather than guessing.
 */
function wrapPort(engine: PedalWalkEngine, id: string, which: 'start' | 'end'): BreakWrapPort {
  const limitOf = (at: { measure: number } | null) => {
    const pedal = engine.getPedalById(id)
    return pedal && at ? pedalSystemInkLimit(engine, pedal, at) : null
  }
  return {
    here: () => limitOf(which === 'start'
      ? pedalPressAddress(engine.getScore(), id)
      : engine.pedalLiftSlot(id)),
    there: (stop) => limitOf(stop as { measure: number }),
    address: (stop) => stop,
  }
}

/** One lane onset's drawn left edge, for a pedal that may have gone. */
function pressX(engine: PedalWalkEngine, id: string, at: PedalSlotTarget): number | null {
  const pedal = engine.getPedalById(id)
  return pedal ? pedalPressX(engine, pedal, at) : null
}

/** Where the `✻` would stand for one lift moment, for a pedal that may have gone. */
function liftX(engine: PedalWalkEngine, id: string, at: PedalLiftTarget): number | null {
  const pedal = engine.getPedalById(id)
  return pedal ? pedalLiftX(engine, pedal, at) : null
}
