/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR AN OCTAVE BRACKET'S TWO SQUARES** — ←/→ and `Ctrl`+←/→ move the
 * armed end's INK, and once that ink reaches the next onset of the lane THAT END OF THE BRACKET goes
 * with it.
 *
 * The ottava is the fifth family to get this gesture, after the slur, the dynamic/tempo pair, the
 * hairpin and the trill, and it arrives by the rule the wedge's second square set (2026-08-20):
 * **a handle that has BOTH a re-anchor and an offset owes the walk that joins them.** Before this,
 * the two halves of moving a bracket's end were unrelated — a plain arrow wrote a cosmetic offset
 * that could slide the `8va` arbitrarily far from the note it claims to start on, and
 * `Ctrl+Shift+←/→` (`shortcutWiring`) jumped the extent a whole slot with the ink snapping to
 * wherever the engraver puts it.
 *
 * The arithmetic is `./markWalk`'s, untouched; this file is the PORT, twice. What is ottava-specific
 * is three things:
 *
 * ⭐⭐ **THE TWO ENDS READ DIFFERENT EDGES.** The numeral stands at the first covered notehead's LEFT
 * edge and the hook closes around the last covered notehead's RIGHT edge (Gould's rule 2), so the
 * gaps this walk crosses are left-to-left at one end and right-to-right at the other. `./ottavaLane`
 * holds that geometry, shared with the squares' DRAG so both routes measure one list.
 *
 * ⭐⭐ **THE END'S ANCHOR IS THE LAST COVERED SLOT, ⛔ NOT THE SPAN'S END.** An `Ottava` stores
 * `beat + length`, and that length reaches PAST the last notehead by that note's own duration —
 * everything drawn about the end of the bracket is drawn at `ottavaOps.ottavaEndSlot`. Measuring a
 * gap from the span's exclusive end would price every crossing one note too late.
 *
 * ⭐⭐ **A CROSSING HOLDS THE OTHER END STILL** — the wedge's rule, and it is what makes these two
 * squares one gesture rather than a bracket that slides. The start writes `beat` and `length`
 * together (`setOttavaStartAtSlot`), the end writes `length` alone; either way the far end does not
 * move. ⚠️ So a walking press is AUDIBLE at the moment it crosses — it changes which notes are
 * displaced by an octave. Every press either side of it is ink and changes nothing.
 *
 * ⭐ **The crossing KEEPS both ends' nudges by construction** — the model ops touch no override at
 * all, so unlike the dynamic there is no `…KeepingOffset` twin to reach for. What the walk then does
 * with the armed end's own offset is the family's identity: it takes the gap back out, so the ink
 * does not jump.
 *
 * ⛔ **The vertical is not in here** — and here for a second reason on top of the family's: the
 * bracket is a straight horizontal rule with ONE stored `outward` for both ends, so there is nothing
 * above or below to arrive at AND nothing per-end to write.
 *
 * 🚨🚨 **A SYSTEM BREAK IS A WRAP, not a refusal** (his ask, 2026-08-21: *"what about the cross
 * system issue?"*). The walk itself will never cross one — two systems' x's are not one ruler
 * (`./markWalk`, permanently and rightly) — so the press that leaves the line is a separate move:
 * the ink pays its way to the last barline, and what would have hung in the margin re-appears at the
 * START of the next system. The rule, its four rejected cuts and its arithmetic are the wedge's, in
 * `./markBreakWrap`; ⛔ ported, never copied. What is ottava-specific is only where a bracket's line
 * begins and ends, which `./ottavaLane` measures.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { OttavaSlotTarget } from '../engine/models/ottavaOps'
import { ottavaOffsetOverrideOf } from '../engine/models/engravingOverrides'
import {
  ottavaEdgeX, ottavaInkY, ottavaStaffSpacePx, ottavaStartAddress, ottavaSystemInkLimit,
  ottavaSystemSlotFor,
} from './ottavaLane'
import { carryMark, crossWithoutArrival, markWalkCrosses, type MarkWalkPort } from './markWalk'
import { breakCrossing, leaveSystem, type BreakWrapPort } from './markBreakWrap'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type OttavaWalkEngine = Pick<MusicEngine,
  'getOttavaById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextOttavaStartSlot' | 'nextOttavaEndSlot' | 'ottavaEndSlot'
  | 'moveOttavaStartToSlot' | 'moveOttavaEndToSlot'
  | 'nudgeOttavaEndpoint' | 'rebaseOttavaEndpointOffset'
  | 'previewOttavaEnd' | 'previewOttavaEndpointOffset' | 'previewOttavaEndpointRebase'
  | 'moveOttavaToSlot' | 'nudgeOttava' | 'rebaseOttavaOffset'
  | 'previewOttavaSlot' | 'previewOttavaStaffSlot' | 'previewOttavaOffset' | 'previewOttavaOffsetRebase'>

/**
 * ⭐ **WHAT SEPARATES THE TWO DEVICES, and the whole of it**: a KEY press records its own undo step, a
 * drag FRAME records none and leaves the drop to commit once ({@link MusicEngine.commitOttavaDrag}).
 * Everything else — the stops, the geometry, the identity — is shared, which is what makes a drag and
 * N presses land in the same state rather than in two states that merely look alike
 * (`./hairpinWalk`'s arrangement, and for its reason).
 */
interface OttavaWrite {
  reanchor: (target: OttavaSlotTarget) => boolean
  /** ⚠️ `outward` is a distance FROM THE STAFF, ⛔ never a screen delta — and it lands on the WHOLE
   *  bracket however it is asked for ({@link OttavaOffsetOverride} has one vertical). The KEYS never
   *  pass one: `shortcutWiring` routes a vertical press straight at the engine, so only a DRAG,
   *  which moves both axes in one gesture, has anything to put here. */
  nudge: (dx: number, outward: number) => boolean
  /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
   *  the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
   *  crosses again. */
  rebase: (dx: number) => boolean
}

/** The keyboard's writes: each records its own undo entry, and a crossing press wraps them in one
 *  batch ({@link walkOttavaEndpoint}). */
function keyWrites(engine: OttavaWalkEngine, id: string, which: 'start' | 'end'): OttavaWrite {
  return {
    reanchor: (target) => which === 'start'
      ? engine.moveOttavaStartToSlot(id, target)
      : engine.moveOttavaEndToSlot(id, target),
    // ⛔ **The second argument is 0, ⚠️ NEVER a `dy`.** `nudgeOttavaEndpoint` speaks
    // OUTWARD-from-the-staff, where a walk's vertical is screen-down — and it lands on the WHOLE
    // bracket, both ends at once. Nothing on this road has a vertical to write.
    nudge: (dx, outward) => engine.nudgeOttavaEndpoint(id, which, dx, outward),
    rebase: (dx) => engine.rebaseOttavaEndpointOffset(id, which, dx),
  }
}

/** The drag's writes: the same three edits with no undo entry of their own. */
function previewWrites(engine: OttavaWalkEngine, id: string, which: 'start' | 'end'): OttavaWrite {
  return {
    reanchor: (target) => engine.previewOttavaEnd(id, { at: which, ...target }),
    nudge: (dx, outward) => engine.previewOttavaEndpointOffset(id, which, dx, outward),
    rebase: (dx) => engine.previewOttavaEndpointRebase(id, which, dx),
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON AN ARMED SQUARE** — nudge that end's ink by `dx` staff-spaces
 * (¼ space plain, 1 space with `Ctrl`), and hand that end of the BRACKET along if the ink has
 * arrived at the next onset of the lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the bracket somewhere the user never put it.
 *
 * ⚠️ **ONE crossing per press** (`carryMark`'s bound, and the trill's report that made it a rule): an
 * end whose ink has been nudged far ahead of its note is already PAST every stop between the two, so
 * an unbounded loop would hop the whole distance on one keystroke — invisibly, since the identity
 * keeps the ink still.
 *
 * ⚠️ The walk STOPS where the model refuses — at either end of the lane, and where the two ends would
 * meet (a beginning may not reach its own end, and a shrink may not leave the bracket over no music).
 * The press then stays a plain ink nudge, so the end can still be pushed past, which is what an
 * override is for.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such ottava, or the page limit refused the ink.
 */
export function walkOttavaEndpoint(
  engine: OttavaWalkEngine,
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
    // 🚨🚨 **A BLOCKED PRESS STILL CROSSES** — his *"cross system doesn't work at all"*, 2026-08-21.
    // The wrap's arrival test asks the ink to reach the line's last ink, and the PAGE limit refuses
    // it a space or so before that (a system's music ends within a space of the sheet's margin), so
    // the gesture died where it should have wrapped. ⭐ The ink cannot pay any further, so the press
    // spends itself on the ANCHOR: the wrap where the stop is on another system, `crossWithoutArrival`
    // where it is on this one. The identity holds either way — the drawn mark does not move.
    let handed = false
    engine.runBatch(which === 'start' ? 'Move octave line start' : 'Resize octave line', () => {
      handed = across
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  engine.runBatch(which === 'start' ? 'Move octave line start' : 'Resize octave line', () => {
    moved = across?.arrived
      // ⭐ THE KEYS re-base by the FOLDED distance: their ink really did travel it, one press at a
      // time, so the end re-appears exactly as far into the new line as the hand pushed it past the
      // barline (`./markBreakWrap`).
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx, 0, false, 1).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A SQUARE DRAG** — the same journey with the cursor's delta in PIXELS instead of a
 * key's step, and no undo entry (the drop commits once, {@link MusicEngine.commitOttavaDrag}). His
 * ask, 2026-08-21: *"now lets do the drag walking"*.
 *
 * ⭐ **The mouse and the arrows become ONE gesture.** The drag used to SNAP the grabbed end to the
 * nearest slot of the lane and write it outright (`elements/ottavaHandles.ottavaDragTargetAt`), so
 * the bracket jumped a whole note at a time and could never be parked between two — the very thing
 * the keys had just stopped doing. Now the ink follows the hand and the bracket comes along when the
 * ink reaches an onset, so a drag and N presses covering the same distance leave the model in the
 * same state rather than in two that merely look alike.
 *
 * ⭐⭐ **THE LATCH IS ON** (`./markWalk`), as it is for the wedge's tips: an octave bracket's ends are
 * AIMED at a notehead's edge — that is where the engraver puts them — so offset zero must be
 * reachable exactly rather than by luck. ⛔ The keyboard keeps it off: a press is a considered edit of
 * a quarter space.
 *
 * 🚨 **A latched frame REPORTS what it DROPPED, because that travel must be REPAID.** The pixels the
 * latch cuts were still made by the hand, so the caller holds its cursor anchor back by exactly that
 * much and the next frame presents them again. Left unrepaid the ink falls behind the cursor a little
 * at every stop and never catches up — Baudisch's own complaint about snap-and-go, and the wedge's
 * report of 2026-08-20. ⚠️ It is 0 on an ordinary frame, so there is no special case.
 *
 * ⭐⭐ **THE HAND DECIDES WHERE THE LINE ENDS** — the keys have only the ink to go on and wrap when the
 * INK passes the edge; a drag has the pointer itself (`./markBreakWrap`, his rule for the wedge).
 * ⭐⭐ **And a WRAP ENDS THE GESTURE**: that end is a line away and the hand is not, so every further
 * pixel would move it by a distance measured against a system it has left.
 *
 * ⭐⭐ **BOTH AXES** (his ask, 2026-08-21) — and they are different kinds of move, which is the point
 * of making them in one gesture: the horizontal walks that end through the MUSIC, while the vertical
 * is a plain ink offset, there being nothing above or below to arrive at.
 *
 * ⭐⭐ **…but the vertical moves the WHOLE BRACKET, whichever square is under the hand** — a wedge's
 * square lifts ONE tip and tilts it; an octave line is a straight rule with ONE stored vertical, so
 * both ends rise together. Nothing here enforces that: {@link OttavaOffsetOverride}'s shape does.
 *
 * ⚠️ **This is where SCREEN becomes OUTWARD**, the drag's twin of the conversion `shortcutWiring`
 * makes for the keys — and for the same reason: a hand moving up must LIFT the bracket on both sides
 * of the staff, while the stored number means *further from the staff* so that flipping 8va↔8vb
 * cannot invert a nudge the user already made.
 *
 * ⭐ The lift SURVIVES a crossing: it is the bracket's height, not a distance to any particular note.
 * ⚠️ A frame that WRAPS spends itself on the wrap and drops its `dy` — the wedge's behaviour, and its
 * reason: the end is on another system by then.
 *
 * ⛔ It declines — **null**, not a frame — when the bracket is not drawn, so there is no staff-space
 * size to convert the cursor's pixels with; `moved: false` means the frame reached the model and
 * nothing moved, and the caller must then leave its cursor anchor where it was.
 */
export function dragOttavaEndpoint(
  engine: OttavaWalkEngine,
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
  // ⭐⭐ SCREEN → OUTWARD, once, here. Screen-down is +dyPx; above the staff, further out is UP.
  const above = (engine.getOttavaById(id)?.shift ?? 1) > 0
  const outward = (above ? -dyPx : dyPx) / staffSpacePx
  if (dx === 0 && outward === 0) return { moved: false, wrapped: false, droppedPx: 0 }

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
  // really can fly over several, and re-anchoring once would leave the bracket trailing the cursor by
  // however many were skipped.
  const carried = carryMark(port, dx, outward, true)
  // ⭐ In PIXELS, because that is what the caller's cursor anchor is measured in.
  return { moved: carried.moved, wrapped: false, droppedPx: carried.dropped * staffSpacePx }
}

/**
 * ⭐⭐ **THE WHOLE BRACKET WALKS — the arrows with an ottava selected and NO square armed** (his ask,
 * 2026-08-21: *"now we have to do the shape key walking (when no endpoint is selected)"*).
 *
 * ⭐ **Its stops are the BEGINNING's**, because a bracket moved as one is moved by its beginning: the
 * extent is an amount of music and travels with it (`ottavaOps.setOttavaAtSlot`). So the far end is
 * not held — ⛔ the opposite of what either square does, which is exactly the difference between
 * moving a mark and reshaping it.
 *
 * ⭐ **Its ink is BOTH ends at once** (`nudgeOttava`), which is what the arrows have always written
 * here; the offset it reads back is the START's, since the pair always carry the same number while
 * the bracket is moved as one.
 *
 * ⚠️ **AUDIBLE at the crossing, and only there** — it changes which notes are displaced. Every press
 * either side of it is ink and changes nothing.
 *
 * 🚨 It crosses a system break by the same WRAP as the squares (`./markBreakWrap`), measured from the
 * beginning's own system.
 */
export function walkOttavaBody(engine: OttavaWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = bodyPort(engine, id, bodyWrites(engine, id))

  const wrap = wrapPort(engine, id, 'start')
  const across = breakCrossing(port, wrap, dx)
  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    if (inkPress(port, dx)) return true
    // 🚨🚨 **A BLOCKED PRESS STILL CROSSES** — his *"cross system doesn't work at all"*, 2026-08-21.
    // The wrap's arrival test asks the ink to reach the line's last ink, and the PAGE limit refuses
    // it a space or so before that (a system's music ends within a space of the sheet's margin), so
    // the gesture died where it should have wrapped. ⭐ The ink cannot pay any further, so the press
    // spends itself on the ANCHOR: the wrap where the stop is on another system, `crossWithoutArrival`
    // where it is on this one. The identity holds either way — the drawn mark does not move.
    let handed = false
    engine.runBatch('Move octave line', () => {
      handed = across
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  engine.runBatch('Move octave line', () => {
    moved = across?.arrived
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx, 0, false, 1).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A BODY DRAG — the whole bracket follows the hand**, sideways through the music
 * and, when the hand leaves its staff's room, DOWN ONTO ANOTHER SYSTEM (his ask, 2026-08-21: *"now we
 * have to do the shape drag walking… we also have to take into account the y, that means that we can
 * jump system vertically"*).
 *
 * ⭐⭐ **TWO KINDS OF VERTICAL, and that is the whole design.** Within its own staff's room the `y` is
 * plain INK — the bracket's shared height, bounded by the band
 * ({@link MusicEngine.previewOttavaOffset}). Past halfway to the neighbouring staff there is nothing
 * continuous to travel through — two systems' x's are not one ruler — so coming down onto the staff
 * below is a JUMP, decided by `./markSystemJump`'s rule and ⛔ NOT by crossing the pentagram. The two
 * meet exactly: the band refuses the ink at the same halfway line the jump fires on.
 *
 * ⛔ **A jump ENDS THE FRAME**: the anchor has moved, so this frame's `dx` would be spent against a
 * slot the hand was never near. ⭐ And it lands where the engraver would put it — both axes of the
 * offset go, the height because on that gesture it was not a lift at all but the distance the hand
 * travelled to reach the other staff.
 *
 * ⛔ **THE SIDE NEVER FLIPS.** A wedge dragged up off its staff belongs ABOVE it — it has a
 * `placement`, so the space above is a place it can live. An octave bracket's side is DERIVED from
 * its `shift`: an 8va hangs above and an 8vb below, and turning one into the other is a change to
 * the MUSIC (`toggleOttavaDirection`, audible). A drag may not make it by accident.
 *
 * ⛔ **No latch here**, unlike a square's drag: a whole bracket is being placed by eye, not aimed at
 * one note's edge — the dynamic's reasoning, and the same conclusion.
 *
 * ⛔ Declines — **null** — when the bracket is not drawn, so there is no staff-space size to convert
 * the cursor's pixels with.
 */
export function dragOttavaBody(
  engine: OttavaWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): { moved: boolean; jumped: boolean } | null {
  const port = bodyPort(engine, id, bodyPreviewWrites(engine, id))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  if (jumpStaves(engine, id, cursorX, dyPx, staffSpacePx)) return { moved: true, jumped: true }

  const dx = dxPx / staffSpacePx
  // ⭐⭐ SCREEN → OUTWARD, the same conversion {@link dragOttavaEndpoint} makes, and for its reason.
  const above = (engine.getOttavaById(id)?.shift ?? 1) > 0
  const outward = (above ? -dyPx : dyPx) / staffSpacePx
  if (dx === 0 && outward === 0) return { moved: false, jumped: false }
  return { moved: carryMark(port, dx, outward).moved, jumped: false }
}

/**
 * ⭐⭐ **LEAVING THE BRACKET'S OWN STAFF** — the half of a drag the walk cannot do
 * (`./markSystemJump`, shared with the dynamic, the tempo mark and the wedge).
 *
 * ⭐⭐ **The staff below counts, not only the system below** (his ask, 2026-08-21, the last of the
 * five families). On a grand staff a bracket dragged down belongs to the LEFT HAND, so the landing
 * writes the bracket's `staffId` as well as its address (`ottavaOps.setOttavaAtStaffSlot`) — ⚠️ and
 * AUDIBLY: an octave line transposes the staff it is filed under. ⭐ The SHIFT does not change, so
 * neither does the side: an 8va stays above whatever staff it lands on.
 *
 * ⭐ The lift comes back out first — left in, the bracket's "home" follows it down for ever and the
 * switch never arrives (the report that produced the rule, 2026-08-19). And on arrival BOTH axes of
 * the offset go: over there the old x means nothing, and the y was never a lift.
 */
function jumpStaves(
  engine: OttavaWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
): boolean {
  const ottava = engine.getOttavaById(id)
  const inkY = ottavaInkY(engine, id)
  if (!ottava || inkY === null) return false

  const target = ottavaSystemSlotFor(engine, ottava, cursorX, inkY + dyPx, staffSpacePx)
  if (!target || !engine.previewOttavaStaffSlot(id, target)) return false

  const offset = ottavaOffsetOverrideOf(engine.getScore(), id)
  if (offset?.startX || offset?.outward) {
    engine.previewOttavaOffset(id, -(offset.startX ?? 0), -(offset.outward ?? 0))
  }
  dbg(`[Ottava] jumped to the staff it now belongs to | id:${id} → m${target.measure} staff:${target.staffId ?? 0}`)
  return true
}

/** The body's writes during a DRAG: the same three edits with no undo entry of their own — the drop
 *  commits once ({@link MusicEngine.commitOttavaOffsetDrag}). */
function bodyPreviewWrites(engine: OttavaWalkEngine, id: string): OttavaWrite {
  return {
    reanchor: (target) => engine.previewOttavaSlot(id, target),
    nudge: (dx, outward) => engine.previewOttavaOffset(id, dx, outward),
    rebase: (dx) => engine.previewOttavaOffsetRebase(id, dx),
  }
}

/** The body's three writes, on the KEYBOARD — each records its own undo entry, and a crossing press
 *  wraps them in one batch. ⚠️ `nudgeOttava`'s second argument is OUTWARD and stays 0: no walk has a
 *  vertical, and the bracket's is one shared number anyway. */
function bodyWrites(engine: OttavaWalkEngine, id: string): OttavaWrite {
  return {
    reanchor: (target) => engine.moveOttavaToSlot(id, target),
    nudge: (dx, outward) => engine.nudgeOttava(id, dx, outward),
    rebase: (dx) => engine.rebaseOttavaOffset(id, dx),
  }
}

/** ⭐ **THE BODY'S PORT** — the beginning's stops and geometry, with the whole bracket's writes. */
function bodyPort(engine: OttavaWalkEngine, id: string, write: OttavaWrite): MarkWalkPort {
  return {
    label: 'Ottava',
    nextStop: (direction) => engine.nextOttavaStartSlot(id, direction),
    stopX: (stop) => edgeX(engine, id, stop as OttavaSlotTarget, 'start'),
    anchorX: () => {
      const here = ottavaStartAddress(engine.getScore(), id)
      return here ? edgeX(engine, id, here, 'start') : null
    },
    staffSpacePx: () => ottavaStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => ottavaOffsetOverrideOf(engine.getScore(), id)?.startX ?? 0,
    reanchor: (stop) => write.reanchor(stop as OttavaSlotTarget),
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/**
 * ⭐ **THE BRACKET'S ANSWERS TO {@link BreakWrapPort}** — where THIS end's system runs out, and where
 * a candidate stop's system begins. ⚠️ Both off the LAST RENDER, and both may answer null, which the
 * shared rule reads as *"no wrap"* rather than guessing.
 */
function wrapPort(engine: OttavaWalkEngine, id: string, which: 'start' | 'end'): BreakWrapPort {
  const limitOf = (at: OttavaSlotTarget | null) => {
    const ottava = engine.getOttavaById(id)
    return ottava && at ? ottavaSystemInkLimit(engine, ottava, at) : null
  }
  return {
    here: () => limitOf(which === 'start'
      ? ottavaStartAddress(engine.getScore(), id)
      : engine.ottavaEndSlot(id)),
    there: (stop) => limitOf(stop as OttavaSlotTarget),
    address: (stop) => stop,
  }
}

/**
 * The ordinary press: ink, and a log line saying what it did to the offset.
 *
 * ⭐⭐ **THE INK IS FREE** — his rule, 2026-08-21, rejecting a limit that held the offset inside the
 * system's own music: *"you are restricted the ottava offset to the measure, the user should be able
 * to offset it at will"*. ⛔ Do not add one back. The only stop on this road is the PAGE's edge
 * (`layout/pageBounds`), which is his own earlier rule and is judged per MOVING EDGE.
 */
function inkPress(port: MarkWalkPort, dx: number): boolean {
  const before = port.offsetX()
  const moved = port.nudge(dx, 0)
  dbg(`[${port.label}] ink ${dx > 0 ? '+' : ''}${dx.toFixed(2)}ss`
    + ` | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss${moved ? '' : ' (REFUSED)'}`)
  return moved
}

/** Which end's port. ⛔ Not a `which` switch inside the members: each end states its own three
 *  answers and shares the three the bracket answers alike. */
function portFor(
  engine: OttavaWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: OttavaWrite,
): MarkWalkPort {
  return which === 'start' ? startPort(engine, id, write) : endPort(engine, id, write)
}

/** ⭐ **THE BEGINNING'S PORT** — its stops are the lane's onsets, and it takes one as the bracket's
 *  own beginning, holding the far end. */
function startPort(engine: OttavaWalkEngine, id: string, write: OttavaWrite): MarkWalkPort {
  return port(engine, id, 'start', write, {
    label: 'Ottava start',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the two keys landing the beginning on different notes depending on how far it had
    // been nudged.
    nextStop: (direction) => engine.nextOttavaStartSlot(id, direction),
    stopX: (stop) => edgeX(engine, id, stop as OttavaSlotTarget, 'start'),
    anchorX: () => {
      const here = ottavaStartAddress(engine.getScore(), id)
      return here ? edgeX(engine, id, here, 'start') : null
    },
    reanchor: (stop) => write.reanchor(stop as OttavaSlotTarget),
  })
}

/** ⭐ **THE END'S PORT** — its stops are the slots the hook can close around, read from the model so
 *  that the address the walk measures to is the one the renderer draws at. */
function endPort(engine: OttavaWalkEngine, id: string, write: OttavaWrite): MarkWalkPort {
  return port(engine, id, 'end', write, {
    label: 'Ottava end',
    nextStop: (direction) => engine.nextOttavaEndSlot(id, direction),
    stopX: (stop) => edgeX(engine, id, stop as OttavaSlotTarget, 'end'),
    // ⭐⭐ The LAST COVERED slot, ⛔ never the span's exclusive end — see the header.
    anchorX: () => {
      const here = engine.ottavaEndSlot(id)
      return here ? edgeX(engine, id, here, 'end') : null
    },
    reanchor: (stop) => write.reanchor(stop as OttavaSlotTarget),
  })
}

/** What the two ends answer alike — the scale, that end's own stored nudge, and the two ink writes. */
function port(
  engine: OttavaWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: OttavaWrite,
  ends: Pick<MarkWalkPort, 'label' | 'nextStop' | 'stopX' | 'anchorX' | 'reanchor'>,
): MarkWalkPort {
  return {
    ...ends,
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN bracket's staff,
    // which may be a SMALL one.
    staffSpacePx: () => ottavaStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () =>
      ottavaOffsetOverrideOf(engine.getScore(), id)?.[which === 'start' ? 'startX' : 'endX'] ?? 0,
    // ⚠️ `markWalk` calls this `dy` and passes it through untouched; here it is the bracket's
    // OUTWARD distance, converted by whoever spoke screen ({@link dragOttavaEndpoint}).
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/** One lane onset's drawn edge, for a bracket that may have gone. */
function edgeX(
  engine: OttavaWalkEngine,
  id: string,
  at: OttavaSlotTarget,
  which: 'start' | 'end',
): number | null {
  const ottava = engine.getOttavaById(id)
  return ottava ? ottavaEdgeX(engine, ottava, at, which) : null
}
