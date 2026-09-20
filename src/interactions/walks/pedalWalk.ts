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
import type { MusicEngine } from '../../engine/MusicEngine'
import type { PedalCommands } from '@/engine/commands/pedalCommands'
import type { PedalLiftTarget, PedalSlotTarget } from '../../engine/models/pedalOps'
import { pedalOffsetOverrideOf } from '../../engine/models/engravingOverrides'
import {
  pedalCanHandOver, pedalInkY, pedalLiftX, pedalPressAddress, pedalPressX, pedalStaffEdgeY,
  pedalStaffSpacePx, pedalSystemInkLimit, pedalSystemSlotFor,
} from '../lanes/pedalLane'
import { type MarkWalkPort } from './markWalk'
import { type BreakWrapPort } from './markBreakWrap'
import { dragFrame, walkPress, type DragFrame } from './markDrive'
import { withoutAnEntry } from './keyRun'
import { dbg } from '../../utils/debug'

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — the one landing a drag is still owed a settlement for.**
 *
 * ⛔ It is NOT drag state and carries no travel: one id and one y, written by a landing and spent by
 * the very next frame ({@link settleLanding}). A drag that stops in between simply leaves it, and the
 * next drag of another pedal drops it on sight.
 */
let landed: { id: string; inkY: number } | null = null

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type PedalWalkEngine = Pick<MusicEngine,
  'getPedalById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'> & {
  pedal: Pick<PedalCommands,
    'nextPedalStartSlot' | 'nextPedalLift' | 'pedalLiftSlot'
    | 'movePedalStartToSlot'
    | 'nudgePedalEndpoint'
    | 'previewPedalStartAtSlot' | 'previewPedalLiftAt'
    | 'previewPedalEndpointOffset' | 'previewPedalEndpointRebase'
    | 'movePedalToSlot' | 'nudgePedal'
    | 'previewPedalSlot' | 'previewPedalStaffSlot' | 'previewPedalOffset' | 'previewPedalOffsetRebase'>
}

/**
 * ⭐ **WHAT SEPARATES THE TWO DEVICES, and the whole of it**: a KEY press records its own undo step,
 * a drag FRAME records none and leaves the drop to commit once ({@link MusicEngine.pedal.commitPedalDrag}).
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

/** The drag's writes: the same four edits with no undo entry of their own. */
function previewWrites(engine: PedalWalkEngine, id: string, which: 'start' | 'end'): PedalWrite {
  return {
    press: (target) => engine.pedal.previewPedalStartAtSlot(id, target),
    lift: (target) => engine.pedal.previewPedalLiftAt(id, target),
    nudge: (dx, dy) => engine.pedal.previewPedalEndpointOffset(id, which, dx, dy),
    rebase: (dx) => engine.pedal.previewPedalEndpointRebase(id, which, dx),
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
  return walkPress(endpointDrive(engine, id, which, previewWrites(engine, id, which)), dx)
}

/**
 * ⭐ The pedal's row in the shared driver's table (`./markDrive`) — one sign, keys or mouse.
 *
 * ⭐⭐ **THE INK IS FREE, which is why there is no `inkGuard` here** — his rule, 2026-08-21, given for
 * the bracket and about offsets generally: *"the user should be able to offset it at will"*. ⛔ Do not
 * add a limit that holds a sign inside its own bar or system. The only stop on this road is the
 * PAGE's edge (`layout/pageBounds`), which is his own earlier rule and is judged per MOVING SIGN
 * ({@link MusicEngine.pedalEndpointStepAllowed}).
 */
function endpointDrive(
  engine: PedalWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: PedalWrite,
) {
  return {
    port: portFor(engine, id, which, write),
    wrap: wrapPort(engine, id, which),
    label: which === 'start' ? 'Move pedal start' : 'Move pedal lift',
    runBatch: withoutAnEntry,
    // ⭐ ONE stop per press — the trill's report, and the rule for every span end.
    maxCrossings: 1,
  }
}

/**
 * ⭐⭐ **ONE FRAME OF A SQUARE DRAG** — the same journey with the cursor's delta in PIXELS instead of a
 * key's step, and no undo entry (the drop commits once, {@link MusicEngine.pedal.commitPedalDrag}). His
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
): DragFrame | null {
  const { port, wrap } = endpointDrive(engine, id, which, previewWrites(engine, id, which))
  // ⚠️ ⛔ No screen→outward conversion, unlike the bracket's twin — a pedal has one side permanently,
  // so `+ down` means the same thing everywhere it can be drawn and the number passes straight
  // through (`shortcutWiring` makes no conversion for the keys either).
  return dragFrame({ port, wrap, latch: true }, cursorX, dxPx, dyPx)
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
  return walkPress({
    port: bodyPort(engine, id, bodyPreviewWrites(engine, id)),
    // ⭐ The PRESS's system, because a pedal moved as one is moved by the foot going down.
    wrap: wrapPort(engine, id, 'start'),
    label: 'Move pedal',
    runBatch: withoutAnEntry,
    maxCrossings: 1,
  }, dx)
}

/**
 * ⭐⭐ **ONE FRAME OF A BODY DRAG — the whole pedal follows the hand**, sideways through the music and,
 * when the hand leaves its staff's room, DOWN ONTO ANOTHER SYSTEM (his ask, 2026-08-21: *"lets do the
 * pedal shape drag walking, taking into account the y so we jump system"*). `ottavaWalk.dragOttavaBody`
 * ported, and the differences are the pedal's own two:
 *
 * ⭐⭐ **TWO KINDS OF VERTICAL, and that is the whole design.** Within its own staff's room the `y` is
 * plain INK — the pair's shared height, bounded by the band and the page
 * ({@link MusicEngine.pedal.previewPedalOffset}). Past halfway to the neighbouring staff there is nothing
 * continuous to travel through — two systems' x's are not one ruler — so coming down onto the staff
 * below is a JUMP, decided by `./markSystemJump`'s rule and ⛔ NOT by crossing the pentagram.
 *
 * ⛔ **A jump ENDS THE FRAME, ⛔ not the gesture** — unlike a square's wrap. The pedal has landed where
 * the hand is, so the hand may carry straight on down there; what must not happen is spending this
 * frame's `dx` against a slot it was never near.
 *
 * ⛔ **THE SIDE NEVER FLIPS, and here it cannot**: a pedal is always drawn BELOW its staff
 * (`PedalRenderer` §3), where the bracket has a `shift` and the wedge a `placement`. One less thing a
 * drag can do by accident.
 *
 * ⛔ **No latch**, unlike a square's drag: a whole pedal is being placed by eye, not aimed at one
 * column's edge — the dynamic's reasoning, and the same conclusion.
 *
 * ⚠️ ⛔ No screen→outward conversion on the `y` either: the stored number is screen-signed.
 *
 * ⛔ Declines — **null** — when the pedal is not drawn, so there is no staff-space size to convert the
 * cursor's pixels with.
 */
export function dragPedalBody(
  engine: PedalWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): { moved: boolean; jumped: boolean } | null {
  const staffSpacePx = pedalStaffSpacePx(engine.getElementRegistry(), id)
  if (!staffSpacePx) return null

  // ⚠️ EXPLORATORY (2026-08-30): pay off the last landing before deciding anything — see
  // {@link settleLanding}. The pixels it just wrote are not drawn yet, so THIS frame adds them.
  const settled = settleLanding(engine, id, staffSpacePx)
  if (jumpStaves(engine, id, cursorX, settled + dyPx, staffSpacePx, settled)) {
    return { moved: true, jumped: true }
  }

  // ⚠️⚠️ EXPLORATORY (2026-08-30) — **the band may not pin the ink short of the line the hand-over
  // fires on** (`./pedalLane.pedalCanHandOver`, which carries his report and the measurement). ⛔ Only
  // this frame kind, and only where there IS a hand-over to reach.
  const port = bodyPort(engine, id, bodyPreviewWrites(engine, id, pedalCanHandOver(engine, cursorX)))
  // ⛔ No wrap and no latch: a whole pedal leaves its staff by a JUMP, and it is placed by eye.
  const frame = dragFrame({ port, latch: false }, cursorX, dxPx, dyPx)
  return frame && { moved: frame.moved || settled !== 0, jumped: false }
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHAT THE LAST LANDING ACTUALLY DID WITH THE INK, paid back.**
 * `ottavaWalk.settleLanding`'s port, and it arrives with that one's report attached: the payment
 * below predicts the landing from the two staves' EDGE LINES, which is only right if the engraver
 * hangs the mark the same distance off both — and he does not, since the ladder grants each staff
 * whatever its own music leaves. So the landing still moves the ink a little, and the jump's decision
 * READS that ink ([[reference_a_drag_decision_cannot_read_its_own_outcome]]).
 *
 * ⭐ The residual cannot be known before the render, so it is measured AFTER it: a landing remembers
 * where the ink was meant to be, and the next frame pays whatever the re-render really did.
 *
 * @returns the pixels it just wrote (screen, +down), which are not drawn yet — so this frame's
 *   reader must add them to what the registry says.
 */
function settleLanding(engine: PedalWalkEngine, id: string, staffSpacePx: number): number {
  if (!landed || landed.id !== id) return 0
  const was = landed.inkY
  landed = null
  const drawn = pedalInkY(engine, id)
  // Half a pixel is the rounding of the drawing, ⛔ not a debt.
  if (drawn === null || Math.abs(was - drawn) < 0.5) return 0

  const debt = was - drawn
  engine.pedal.previewPedalOffsetRebase(id, 0, debt / staffSpacePx)
  dbg(`[Pedal] landing settled | id:${id} | ink ${drawn.toFixed(0)} → ${was.toFixed(0)}`
    + ` (${debt.toFixed(0)}px the ladder gave or took on the new staff)`)
  return debt
}

/**
 * ⚠️ **EXPLORATORY (2026-08-30) — the same settlement at the DROP**, for a landing on the very last
 * frame of a gesture: there is no next frame to pay it, and an unpaid debt would otherwise be spent
 * by the FIRST frame of the next drag, yanking the pedal by whatever the ladder had given it.
 * ⛔ Nothing happens when the gesture owes nothing, which is the common case.
 */
export function settlePedalLanding(engine: PedalWalkEngine, id: string): void {
  const staffSpacePx = pedalStaffSpacePx(engine.getElementRegistry(), id)
  if (staffSpacePx) settleLanding(engine, id, staffSpacePx)
  landed = null
}

/**
 * ⭐⭐ **LEAVING THE PEDAL'S OWN STAFF** — the half of a drag the walk cannot do
 * (`./markSystemJump`, shared with the dynamic, the tempo mark, the wedge and the bracket).
 *
 * ⭐⭐ **The staff below counts, not only the system below** (his ask, 2026-08-21, the fourth family
 * to get it). On a grand staff a pedal dragged down belongs to the LEFT HAND, so the landing writes
 * the pedal's `staffId` as well as its address (`pedalOps.setPedalAtStaffSlot`) — and here that is
 * more than placement: a pedal governs the staff it is filed under, so moving it moves what it damps.
 *
 * ⭐ The lift comes back out first — left in, the pedal's "home" follows it down for ever and the
 * switch never arrives (the report that produced the rule, 2026-08-19).
 *
 * ⚠️⚠️ **EXPLORATORY (2026-08-30, and only for a DRAG) — a RE-ANCHOR DOES NOT MOVE THE DRAWING.**
 * `ottavaWalk.jumpStaves`' rule of the day before, arriving at the family that showed it worst: this
 * landing used to DROP both axes of the offset, so the pair snapped to its engraved home on the new
 * staff wherever the hand was — measured in his log, the anchor 335 → 419 with the offset zeroed, an
 * 89px sideways leap on a frame that had moved one pixel down (*"it jumps to the other staff and this
 * is wrong"*). Now the landing pays the anchor's whole travel back into the offset, both axes: the
 * address and the staff change, and the ink stays under the hand.
 *
 * ⭐ Its own `dy` is in that payment: a jump fires when the ink PLUS this frame's travel crosses the
 * line, so a landing that dropped that travel would settle a pixel back on the side it just left —
 * and the next frame would hand it straight back.
 */
function jumpStaves(
  engine: PedalWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
  /** What {@link settleLanding} has already written and the render has not shown yet. */
  settled = 0,
): boolean {
  const pedal = engine.getPedalById(id)
  const inkY = pedalInkY(engine, id)
  if (!pedal || inkY === null) return false

  const target = pedalSystemSlotFor(engine, pedal, cursorX, inkY + dyPx, staffSpacePx)
  if (!target) return false

  // ⚠️ Read the home BEFORE the write: the lane reads the pedal's CURRENT staff, so afterwards these
  // two answer about the staff it has just left.
  const from = pedalPressAddress(engine.getScore(), id)
  const fromX = from ? pedalPressX(engine, pedal, from) : null
  const fromEdgeY = from ? pedalStaffEdgeY(engine, pedal.staffId, from.measure) : null

  if (!engine.pedal.previewPedalStaffSlot(id, target)) return false

  const after = engine.getPedalById(id)
  const toX = after ? pedalPressX(engine, after, target) : null
  const toEdgeY = pedalStaffEdgeY(engine, target.staffId, target.measure)
  // ⚠️ Whatever the picture could not say is paid as 0 — the no-guessing rule (`./markWalk`).
  const dx = fromX !== null && toX !== null ? (fromX - toX) / staffSpacePx : 0
  // ⭐⭐ **WHERE THE INK IS MEANT TO END UP: under the hand, this frame's own `dy` INCLUDED.** The
  // pedal's home moved down the page by `toEdgeY - fromEdgeY`, and the hand moved it by the rest.
  const vertical = fromEdgeY !== null && toEdgeY !== null
  const screenPay = vertical ? (dyPx - settled) - (toEdgeY! - fromEdgeY!) : 0
  const dy = screenPay / staffSpacePx
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so neither the page limit nor the band has
  // anything to judge — and the band, measured off the render the pedal has just left, would refuse
  // exactly the payment that keeps it still.
  if (dx || dy) engine.pedal.previewPedalOffsetRebase(id, dx, dy)
  // ⚠️ EXPLORATORY: where the ink is meant to stay. The next frame reads what the render really did
  // and pays the difference ({@link settleLanding}). ⛔ The frame's `dx` really is dropped — a jump
  // ends the frame, as it always has, and that x means nothing over there.
  landed = { id, inkY: inkY + (vertical ? dyPx : settled) }
  dbg(`[Pedal] jumped to the staff it now belongs to | id:${id} → m${target.measure} staff:${target.staffId ?? 0}`
    + ` | anchor ${fromX?.toFixed(0) ?? '—'}→${toX?.toFixed(0) ?? '—'} staff edge ${fromEdgeY?.toFixed(0) ?? '—'}→${toEdgeY?.toFixed(0) ?? '—'}`
    + ` | paid into the offset: dx ${dx.toFixed(2)}ss dy ${dy.toFixed(2)}ss`
    + ` | the ink is to stay at ${(inkY + (vertical ? dyPx : settled)).toFixed(0)}`
    + ` | offset now ${JSON.stringify(pedalOffsetOverrideOf(engine.getScore(), id) ?? {})}`)
  return true
}

/** The whole pedal's writes during a DRAG: the same edits with no undo entry of their own — the drop
 *  commits once ({@link MusicEngine.pedal.commitPedalOffsetDrag}).
 *
 *  ⚠️ EXPLORATORY (2026-08-30): `throughTheBand` lets the vertical past the limit that would
 *  otherwise pin the ink short of the hand-over line — see {@link dragPedalBody}. */
function bodyPreviewWrites(
  engine: PedalWalkEngine,
  id: string,
  throughTheBand = false,
): PedalWrite {
  return {
    press: (target) => engine.pedal.previewPedalSlot(id, target),
    lift: () => false,
    nudge: (dx, dy) => engine.pedal.previewPedalOffset(id, dx, dy, throughTheBand),
    rebase: (dx) => engine.pedal.previewPedalOffsetRebase(id, dx),
  }
}

/** ⭐ **THE BODY'S PORT** — the press's stops and geometry, with the WHOLE pedal's writes. */
function bodyPort(engine: PedalWalkEngine, id: string, write: PedalWrite): MarkWalkPort {
  return {
    label: 'Pedal',
    nextStop: (direction) => engine.pedal.nextPedalStartSlot(id, direction),
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
    nextStop: (direction) => engine.pedal.nextPedalStartSlot(id, direction),
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
    nextStop: (direction) => engine.pedal.nextPedalLift(id, direction),
    stopX: (stop) => liftX(engine, id, stop as PedalLiftTarget),
    // ⭐⭐ A MOMENT, ⛔ never "the last covered slot" — see the header.
    anchorX: () => {
      const here = engine.pedal.pedalLiftSlot(id)
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
      : engine.pedal.pedalLiftSlot(id)),
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
