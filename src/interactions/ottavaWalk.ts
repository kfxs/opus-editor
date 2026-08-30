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
  ottavaEdgeX, ottavaInkY, ottavaStaffEdgeY, ottavaStaffSpacePx, ottavaStartAddress,
  ottavaSystemInkLimit, ottavaSystemSlotFor,
} from './ottavaLane'
import { type MarkWalkPort } from './markWalk'
import { type BreakWrapPort } from './markBreakWrap'
import { dragFrame, walkPress, type DragFrame } from './markDrive'
import { dbg } from '../utils/debug'

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — the one landing a drag is still owed a settlement for.**
 *
 * ⛔ It is NOT drag state and carries no travel: one id and one y, written by a landing and spent by
 * the very next frame ({@link settleLanding}). A drag that stops in between simply leaves it, and
 * the next drag of another bracket drops it on sight.
 */
let landed: { id: string; inkY: number } | null = null

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type OttavaWalkEngine = Pick<MusicEngine,
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
  return walkPress(endpointDrive(engine, id, which, keyWrites(engine, id, which)), dx)
}

/**
 * ⭐ The bracket's row in the shared driver's table (`./markDrive`) — one square, keys or mouse.
 *
 * ⭐⭐ **THE INK IS FREE, which is why there is no `inkGuard` here** — his rule, 2026-08-21, rejecting
 * a limit that held the offset inside the system's own music: *"you are restricted the ottava offset
 * to the measure, the user should be able to offset it at will"*. ⛔ Do not add one back. The only
 * stop on this road is the PAGE's edge (`layout/pageBounds`), which is his own earlier rule and is
 * judged per MOVING EDGE.
 */
function endpointDrive(
  engine: OttavaWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: OttavaWrite,
) {
  return {
    port: portFor(engine, id, which, write),
    wrap: wrapPort(engine, id, which),
    label: which === 'start' ? 'Move octave line start' : 'Resize octave line',
    runBatch: (description: string, fn: () => void) => engine.runBatch(description, fn),
    // ⭐ ONE stop per press — an end whose ink has been nudged far ahead of its note is already PAST
    // every stop between the two, so an unbounded loop would hop the whole distance on one keystroke.
    maxCrossings: 1,
  }
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
): DragFrame | null {
  const { port, wrap } = endpointDrive(engine, id, which, previewWrites(engine, id, which))
  // ⭐⭐ SCREEN → OUTWARD, once, here. Screen-down is +dyPx; above the staff, further out is UP.
  const above = (engine.getOttavaById(id)?.shift ?? 1) > 0
  return dragFrame(
    { port, wrap, latch: true, vertical: (px, space) => (above ? -px : px) / space },
    cursorX, dxPx, dyPx,
  )
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
  return walkPress({
    port: bodyPort(engine, id, bodyWrites(engine, id)),
    // ⭐ The BEGINNING's system, because a bracket moved as one is moved by its beginning.
    wrap: wrapPort(engine, id, 'start'),
    label: 'Move octave line',
    runBatch: (description, fn) => engine.runBatch(description, fn),
    maxCrossings: 1,
  }, dx)
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
 * slot the hand was never near. ⚠️ And, while this is being explored (2026-08-30), it lands WITHOUT
 * MOVING THE DRAWING — see {@link jumpStaves}.
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

  // ⚠️ EXPLORATORY (2026-08-30): pay off the last landing before deciding anything — see
  // {@link settleLanding}. The pixels it just wrote are not drawn yet, so THIS frame adds them.
  const settled = settleLanding(engine, id, staffSpacePx)
  if (jumpStaves(engine, id, cursorX, settled + dyPx, staffSpacePx, settled)) {
    return { moved: true, jumped: true }
  }

  // ⭐⭐ SCREEN → OUTWARD, the same conversion {@link dragOttavaEndpoint} makes, and for its reason.
  // ⛔ No wrap and no latch: a whole bracket leaves its staff by a JUMP, and it is placed by eye.
  const above = (engine.getOttavaById(id)?.shift ?? 1) > 0
  const frame = dragFrame(
    { port, latch: false, vertical: (px, space) => (above ? -px : px) / space },
    cursorX, dxPx, dyPx,
  )
  return frame && { moved: frame.moved || settled !== 0, jumped: false }
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHAT THE LAST LANDING ACTUALLY DID WITH THE INK, paid back.**
 *
 * 🚨 His report: *"there was a strange jump back and forth in a sweet spot… this kind of glitches
 * should not happen"* — measured, the ink alternating 390 ↔ 406, one flip per mousemove.
 *
 * {@link jumpStaves} keeps the drawing still by paying the difference between the two staves' EDGE
 * LINES into the offset, which is only right if the engraver would hang the bracket the same
 * distance off both. He does not: the same log shows a gap of 26px on one staff and 41px on the
 * other, so the landing moved the ink 15px after all — and the decision reads that ink, so the two
 * answers chase each other for ever ([[reference_a_drag_decision_cannot_read_its_own_outcome]]).
 *
 * ⭐ The residual cannot be known before the render, so it is measured AFTER it: a landing remembers
 * where the ink was, and the next frame pays whatever the re-render did with it. Two frames on, "a
 * re-anchor does not move the drawing" is true rather than nearly true, and the decision is reading
 * a number its outcome no longer writes. ⛔ Not hysteresis, and ⛔ not the hand's travel — both were
 * tried on 2026-08-30 and both failed.
 *
 * @returns the pixels it just wrote (screen, +down), which are not drawn yet — so this frame's
 *   reader must add them to what the registry says.
 */
function settleLanding(engine: OttavaWalkEngine, id: string, staffSpacePx: number): number {
  if (!landed || landed.id !== id) return 0
  const was = landed.inkY
  landed = null
  const drawn = ottavaInkY(engine, id)
  // Half a pixel is the rounding of the drawing, ⛔ not a debt.
  if (drawn === null || Math.abs(was - drawn) < 0.5) return 0

  const debt = was - drawn
  const above = (engine.getOttavaById(id)?.shift ?? 1) > 0
  engine.previewOttavaOffsetRebase(id, 0, (above ? -debt : debt) / staffSpacePx)
  dbg(`[Ottava] landing settled | id:${id} | ink ${drawn.toFixed(0)} → ${was.toFixed(0)}`
    + ` (${debt.toFixed(0)}px the ladder gave or took on the new staff)`)
  return debt
}

/**
 * ⚠️ **EXPLORATORY (2026-08-30) — the same settlement at the DROP**, for a landing on the very last
 * frame of a gesture: there is no next frame to pay it, and an unpaid debt would otherwise be spent
 * by the FIRST frame of the next drag, yanking the bracket by whatever the ladder had given it.
 * ⛔ Nothing happens when the gesture owes nothing, which is the common case.
 */
export function settleOttavaLanding(engine: OttavaWalkEngine, id: string): void {
  const staffSpacePx = ottavaStaffSpacePx(engine.getElementRegistry(), id)
  if (staffSpacePx) settleLanding(engine, id, staffSpacePx)
  landed = null
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
 * switch never arrives (the report that produced the rule, 2026-08-19).
 *
 * ⚠️ **EXPLORATORY (2026-08-30, and only for a DRAG) — a RE-ANCHOR DOES NOT MOVE THE DRAWING.** His
 * report: *"it is jumping… a reanchor should not jump, should keep the same mark position as
 * offset"* — measured, the anchor went 195 → 251 with the offset zeroed, so the bracket leapt five
 * spaces sideways on a frame the hand had only moved a pixel down. So the landing now pays the
 * anchor's whole travel back into the offset, both axes: the address and the staff change, the ink
 * stays under the hand. ⛔ Not declared a rule; it is one thing to look at.
 */
function jumpStaves(
  engine: OttavaWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
  /** What {@link settleLanding} has already written and the render has not shown yet. */
  settled = 0,
): boolean {
  const ottava = engine.getOttavaById(id)
  const inkY = ottavaInkY(engine, id)
  if (!ottava || inkY === null) return false

  const target = ottavaSystemSlotFor(engine, ottava, cursorX, inkY + dyPx, staffSpacePx)
  if (!target) return false

  // ⚠️ Read the home BEFORE the write: the lane reads the bracket's CURRENT staff, so afterwards
  // these two answer about the staff it has just left.
  const above = ottava.shift > 0
  const from = ottavaStartAddress(engine.getScore(), id)
  const fromX = from ? ottavaEdgeX(engine, ottava, from, 'start') : null
  const fromEdgeY = from ? ottavaStaffEdgeY(engine, ottava.staffId, from.measure, above) : null

  if (!engine.previewOttavaStaffSlot(id, target)) return false

  const after = engine.getOttavaById(id)
  const toX = after ? ottavaEdgeX(engine, after, target, 'start') : null
  const toEdgeY = ottavaStaffEdgeY(engine, target.staffId, target.measure, above)
  // ⚠️ Whatever the picture could not say is paid as 0 — the no-guessing rule (`./markWalk`).
  const dx = fromX !== null && toX !== null ? (fromX - toX) / staffSpacePx : 0
  // ⭐⭐ **WHERE THE INK IS MEANT TO END UP: under the hand, this frame's own `dy` INCLUDED.** The
  // bracket's home moved down the page by `toEdgeY - fromEdgeY`, and the hand moved it by the rest.
  // ⚠️ The `dy` matters even at a pixel a frame: a jump fires when the ink PLUS this frame's travel
  // crosses the line, so a landing that dropped that travel would come to rest a pixel back on the
  // side it just left — and the next frame would hand it straight back.
  const vertical = fromEdgeY !== null && toEdgeY !== null
  const screenPay = vertical ? (dyPx - settled) - (toEdgeY! - fromEdgeY!) : 0
  const outward = (above ? -screenPay : screenPay) / staffSpacePx
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so neither the page limit nor the band
  // has anything to judge — and the band, measured off the render the mark has just left, would
  // refuse exactly the payment that keeps it still.
  if (dx || outward) engine.previewOttavaOffsetRebase(id, dx, outward)
  // ⚠️ EXPLORATORY: where the ink is meant to stay. The next frame reads what the render really did
  // and pays the difference ({@link settleLanding}). ⛔ The frame's `dx` really is dropped — a jump
  // ends the frame, as it always has, and that x means nothing over there.
  landed = { id, inkY: inkY + (vertical ? dyPx : settled) }
  dbg(`[Ottava] jumped to the staff it now belongs to | id:${id} → m${target.measure} staff:${target.staffId ?? 0}`
    + ` | anchor ${fromX?.toFixed(0) ?? '—'}→${toX?.toFixed(0) ?? '—'} staff edge ${fromEdgeY?.toFixed(0) ?? '—'}→${toEdgeY?.toFixed(0) ?? '—'}`
    + ` | paid into the offset: dx ${dx.toFixed(2)}ss outward ${outward.toFixed(2)}ss`
    + ` | the ink is to stay at ${(inkY + (vertical ? dyPx : settled)).toFixed(0)}`
    + ` | offset now ${JSON.stringify(ottavaOffsetOverrideOf(engine.getScore(), id) ?? {})}`)
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
