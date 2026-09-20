/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A DYNAMIC** — ←/→ and Ctrl+←/→ move a selected dynamic's INK,
 * and once that ink reaches the next note of its lane the ANCHOR goes with it. His ask, 2026-08-19:
 * *"we recently use in the slur a walk with arrow / ctrl arrow that allows interpolate between
 * offset and reanchor… i want to do something similar with the expression (dynamic)"*.
 *
 * `./slurEndpointWalk` sentence for sentence — the identity, the invisible crossing, the
 * no-guessing rule and the system-break refusal are all that module's, arriving here because they
 * are claims about *moving a mark that hangs off a note*, not about slurs. What differs is only
 * what an anchor IS:
 *
 * ⭐⭐ **a dynamic is anchored POSITIONALLY** (`{measure, beat, voice, staffId}`), so the stop it
 * walks onto is a SLOT of its own lane (`engine/models/dynamicOps.nextDynamicSlot`) — the pedal's
 * walk, ⛔ not the slur's note re-point. That is already the rule `Ctrl+Shift+←/→` follows, and both
 * roads read the one candidate function so they can never land the mark on different notes.
 *
 * ## The identity
 *
 * A drawn mark is `base(anchor) + offset`. A press moves the drawn mark by one step, and the model
 * is free to split that between the two terms however it likes:
 *
 * ```
 *   offset + step  <  gap   →  keep the anchor, offset += step        (ordinary ink nudge)
 *   offset + step  ≥  gap   →  anchor := next slot, offset += step − gap
 * ```
 *
 * where `gap` is the horizontal distance between the two slots' drawn noteheads. Both branches move
 * the drawn mark by exactly one step, so **the crossing is invisible** — which is the point, and why
 * it needs a model write of its own (`setDynamicAtSlotKeepingOffset`): the ordinary re-anchor CLEARS
 * the mark's nudge, which is right for *"not that note"* and wrong for a ¼-space press that happens
 * to step over a notehead.
 *
 * ⭐ **ARRIVAL, not midpoint** — his call on the slur, and the same reading here: the mark can be
 * parked anywhere in the gap without changing the beat it applies from, which playback reads.
 *
 * ⚠️ **`gap` is a NOTEHEAD-to-NOTEHEAD distance.** A dynamic is drawn centred on its notehead
 * (`rendering/marks/dynamics/dynamicMarkAnchor.ts`), so the two agree exactly — where the slur has to tolerate an
 * endpoint that attaches to a head or a stem tip depending on the stems, this one does not.
 *
 * 🚨 **It will not walk across a system break.** Two x's from different systems are not on one
 * ruler, so a `gap` whose sign disagrees with the direction of travel is refused and the press stays
 * a plain nudge. `Ctrl+Shift+←/→` is the gesture that crosses a break.
 *
 * ⛔ **The vertical is not in here at all.** ↑/↓ stay a pure offset: a dynamic's lane runs sideways,
 * so there is no anchor above or below to arrive at.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { DynamicCommands } from '@/engine/commands/dynamicCommands'
import type { DynamicSlotTarget } from '../../engine/models/dynamicOps'
import {
  dynamicAddress, dynamicLaneHeads, dynamicSlotX, dynamicSystemInkLimit, markInkY, systemSlotFor,
} from '../lanes/dynamicLane'
import { dynamicOffsetOverrideOf } from '../../engine/models/engravingOverrides'
import { fracCompare } from '../../utils/fraction'
import { type MarkWalkPort } from './markWalk'
import { type BreakWrapPort } from './markBreakWrap'
import { dragFrame, walkPress } from './markDrive'
import { withoutAnEntry } from './keyRun'
import { dbg } from '../../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type DynamicWalkEngine = Pick<MusicEngine, 'getDynamicById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'> & { dynamic: Pick<DynamicCommands, 'nextDynamicSlot' | 'nudgeDynamicOffset' | 'previewDynamicOffsetRebase' | 'previewDynamicSlotKeepingOffset' | 'previewDynamicOffset' | 'previewDynamicSlot' | 'previewDynamicPlacement'> }

/**
 * ⭐ **THE DYNAMIC'S PORT** — where its stops are, how far away they are drawn, and which model ops
 * move it. The arithmetic is `./markWalk`'s; this is the whole of what is dynamic-specific about it.
 *
 * The `write` pair is what separates the two devices: a KEY press records its own undo step, a drag
 * FRAME records none and leaves the drop to commit once ({@link MusicEngine.dynamic.commitDynamicDrag}).
 */
function dynamicPort(
  engine: DynamicWalkEngine,
  id: string,
  write: {
    reanchor: (id: string, target: DynamicSlotTarget) => boolean
    nudge: (id: string, dx: number, dy: number) => boolean
    /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged
     *  by the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
     *  crosses again (2026-08-21, when this mark was given the cross-system wrap). */
    rebase: (id: string, dx: number) => boolean
  },
): MarkWalkPort {
  const laneHeads = () => {
    const dynamic = engine.getDynamicById(id)
    return dynamic ? dynamicLaneHeads(engine, dynamic) : []
  }
  const drawnX = (a: DynamicSlotTarget) =>
    laneHeads().find(h => h.target.measure === a.measure && fracCompare(h.target.beat, a.beat) === 0)?.x ?? null

  return {
    label: 'Dynamic',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model.
    nextStop: (direction) => engine.dynamic.nextDynamicSlot(id, direction),
    stopX: (stop) => drawnX(stop as DynamicSlotTarget),
    anchorX: () => {
      const here = dynamicAddress(engine.getScore(), id)
      return here ? drawnX(here) : null
    },
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN mark.
    staffSpacePx: () =>
      engine.getElementRegistry().getByType('dynamic').find(el => el.id === id)?.staffSpacePx ?? null,
    offsetX: () => dynamicOffsetOverrideOf(engine.getScore(), id)?.x ?? 0,
    // ⭐ …KeepingOffset, not the general re-anchor: the crossing is meant to be invisible, and the
    // ordinary one wipes the mark's own nudge (`dynamicOps.setDynamicAtSlot`).
    reanchor: (stop) => write.reanchor(id, stop as DynamicSlotTarget),
    nudge: (dx, dy) => write.nudge(id, dx, dy),
    rebase: (dx) => write.rebase(id, dx),
  }
}

/**
 * ⭐ **THE MARK'S ANSWERS TO {@link BreakWrapPort}** — where THIS mark's system runs out, and where a
 * candidate stop's system begins (his ask, 2026-08-21: *"lets handle also dynamic cross system"*).
 *
 * ⚠️ Both off the LAST RENDER, and both may answer null, which the shared rule reads as *"no wrap"*
 * rather than guessing.
 */
function wrapPort(engine: DynamicWalkEngine, id: string): BreakWrapPort {
  const limitOf = (at: { measure: number } | null) => {
    const dynamic = engine.getDynamicById(id)
    return dynamic && at ? dynamicSystemInkLimit(engine, dynamic, at) : null
  }
  return {
    here: () => limitOf(dynamicAddress(engine.getScore(), id)),
    there: (stop) => limitOf(stop as DynamicSlotTarget),
    address: (stop) => stop,
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON A SELECTED DYNAMIC** — nudge the ink by `dx` staff-spaces
 * (¼ space plain, 1 space with Ctrl), and hand the anchor along if the ink has arrived at the next
 * slot of the mark's lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the mark somewhere the user never put it.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written —
 *   no such mark, or the page limit refused the ink. ⚠️ The caller decides what a false means for
 *   the KEY; today it falls through, exactly as the plain nudge this replaces did.
 */
export function walkDynamic(engine: DynamicWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = dynamicPort(engine, id, {
    reanchor: (i, target) => engine.dynamic.previewDynamicSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.dynamic.previewDynamicOffset(i, ddx, ddy),
    rebase: (i, ddx) => engine.dynamic.previewDynamicOffsetRebase(i, ddx),
  })

  // ⭐ A POINT MARK ON THE SHARED DRIVER (`./markDrive`) — no armed end and no length, which is the
  // proof the driver is about the WALK and not about spans. ⛔ No crossing bound: the reason a span's
  // end has one is an ink nudged far ahead of its own note, and a dynamic's ink is its whole position.
  return walkPress({
    port,
    wrap: wrapPort(engine, id),
    label: 'Move dynamic',
    runBatch: withoutAnEntry,
  }, dx)
}

/**
 * ⭐⭐ **ONE FRAME OF A DYNAMIC DRAG** — the same move, with the cursor's delta in PIXELS instead of
 * a key's step, and no undo entry (the drop commits once, {@link MusicEngine.dynamic.commitDynamicDrag}).
 *
 * ⭐ **The mouse and the arrows are now the SAME gesture.** The drag used to snap the mark to the
 * nearest notehead of its lane within 150 px and re-anchor outright, so the mark teleported, could
 * never be parked between two notes, and lost its own nudge on the way past. Now the ink follows the
 * hand and the anchor comes along when the ink reaches a slot — and a drag and ten arrow presses
 * covering the same distance leave the model in the same state, rather than in two states that
 * merely look alike.
 *
 * ⛔ **No hold, no catch-up, no latch** — his call, 2026-08-19. The slur endpoint's drag has all
 * three (snap-and-go: Baudisch, CHI 2005) because an endpoint is *aimed* at a note and the offset
 * zero of each one has to be reachable exactly; a dynamic is a label being placed by eye, so the
 * resistance would be felt as a snag with nothing to show for it. The ink simply goes where the hand
 * goes.
 *
 * ⭐ **BOTH AXES** (his ask, 2026-08-19: *"the mouse does not have y movement, we need y offset
 * too"*) — and they are different kinds of move, which is the point of doing them in one gesture:
 * the horizontal walks the mark through the music, while `dy` is a plain ink offset, there being no
 * anchor above or below to arrive at. ⭐ The lift SURVIVES a crossing, as it does on the keys: a
 * dynamic's lift is measured off the dynamics LINE, not tuned to the stem of one note, so a mark
 * carried past a notehead has no reason to drop it. (The slur's drag settles its y at a crossing for
 * exactly the opposite reason — an endpoint's lift answers that note's stem, beam and accidentals.)
 *
 * ⭐⭐ **…and a frame that carries the ink onto ANOTHER STAFF is a JUMP, not a walk** — see
 * {@link jumpStaves}, his report the same day. It is the one thing the arrows cannot do either, and
 * for the same reason they cannot: neither a system break nor the staff below is a distance.
 *
 * ⛔ Declines — **null**, not `false` — for a mark that is not drawn, so there is no staff-space size
 * to convert the cursor's pixels with (the same no-guessing rule the crossing arithmetic follows).
 * `false` is the other answer: the frame reached the model and nothing moved (the page limit), and
 * the caller must then leave its cursor anchor where it was so the gesture re-synchronises when the
 * hand comes back, instead of the mark jumping by the distance it never travelled.
 */
export function dragDynamic(
  engine: DynamicWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): boolean | null {
  const port = dynamicPort(engine, id, {
    reanchor: (i, target) => engine.dynamic.previewDynamicSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.dynamic.previewDynamicOffset(i, ddx, ddy),
    rebase: (i, ddx) => engine.dynamic.previewDynamicOffsetRebase(i, ddx),
  })
  const ss = port.staffSpacePx()
  if (!ss) return null

  if (jumpStaves(engine, id, cursorX, dyPx, ss)) return true

  // ⛔ **No wrap and no latch** — the two knobs this family turns off, and both are his calls: a
  // dynamic's drag ends its frame at a STAFF jump rather than wrapping onto the next line, and a `p`
  // is a label placed by eye, so a latch would be felt as a snag with nothing to show for it.
  return dragFrame({ port, latch: false }, cursorX, dxPx, dyPx)?.moved ?? null
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-31) — WHERE THE INK WAS MEANT TO STAY when a jump landed**, held from
 * the frame that landed to the settle that pays it ({@link settleDynamicLanding}), inside one mouse
 * event. The hairpin's `landed`, one lane over, and for its reason: what the ladder gives a mark on
 * the other staff is only knowable once the render has put it there.
 *
 * ⛔ One at a time, and dropped on sight by the next landing — a gesture that ends before the settle
 * simply leaves it.
 */
let landed: { id: string; inkY: number } | null = null

/**
 * ⭐⭐ **LEAVING THE MARK'S OWN STAFF** — the half of a drag the walk cannot do, and the answer to
 * his report that a dragged mark *"does not catch other system"* (2026-08-19).
 *
 * The walk refuses to cross a system break for a reason that will never go away — two systems' x's
 * are not one ruler — so before it runs, this asks which staff the mark now BELONGS to
 * (`dynamicLane.systemSlotFor`: the one it would look at home on, so the switch falls halfway
 * between where it sits and where it would sit) and lands it on the slot of that staff nearest the
 * hand.
 *
 * ⭐⭐ **The staff below counts, not only the system below** (his report, 2026-08-21: on a grand
 * staff the mark *"just land in the next system"*, sailing past the left hand). A dynamic under the
 * left hand is a dynamic ON the left hand's staff, so the landing writes the mark's `staffId` as
 * well as its address — `dynamicOps.setDynamicAtStaffSlot`, the one write in the family that moves
 * a mark between lanes.
 *
 * ⭐⭐ **The lift is dropped**: on this gesture it is not a lift at all — it is the distance the hand
 * travelled to reach the other staff, and keeping it would leave the mark hanging a system-height
 * below its new home (his `y: 44.86`, a guide line over three staves). What replaces it is ⛔ not
 * nothing: see the two EXPLORATORY paragraphs below.
 *
 * ⛔ And the frame stops there: the walk does not also run. The anchor has moved, so this frame's
 * `dx` would be spent against a slot the hand was never near.
 */
function jumpStaves(
  engine: DynamicWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
): boolean {
  const dynamic = engine.getDynamicById(id)
  const inkY = markInkY(engine, id)
  if (!dynamic || inkY === null) return false
  const target = systemSlotFor(engine, dynamic, cursorX, inkY + dyPx, staffSpacePx)
  if (!target) return false

  // ⚠️ Both x's off the SAME render, and read BEFORE the write — afterwards the mark's own address
  // is the one it has just been given.
  const here = dynamicAddress(engine.getScore(), id)
  const fromX = here ? dynamicSlotX(engine, here, dynamic.staffId) : null
  const toX = dynamicSlotX(engine, target, target.staffId)
  if (!engine.dynamic.previewDynamicSlot(id, target)) return false

  // ⚠️⚠️ EXPLORATORY (2026-08-31) — **IT ARRIVES ON THE SIDE IT CAME FROM.** His report: *"it jumps
  // to the ladder that is down, is not going to the upside"*. The vertical is a LADDER of the places
  // a mark may stand — …above N, below N, above N+1… — and a jump takes ONE rung: coming down, the
  // next rung is ABOVE the staff below, which is also where the hand already has the ink. ⛔ Landing
  // on the far side skips a rung and drops the mark a whole staff past the hand. The wedge's rule
  // verbatim (`hairpinWalk.jumpStaves`, 2026-08-20).
  engine.dynamic.previewDynamicPlacement(id, dyPx > 0 ? 'above' : 'below')

  // ⚠️⚠️ EXPLORATORY (2026-08-31) — **A RE-ANCHOR DOES NOT MOVE THE DRAWING** (*"the movement should
  // be smooth"*). Measured on the Prelude: the anchor 257 → 201 with the offset zeroed, so the mark
  // leapt 5½ spaces left on a frame the hand had moved one pixel. The anchor's own travel is now paid
  // back into the x; the vertical cannot be predicted — the mark arrives on the other side of a
  // different staff, where the ladder gives it whatever it has left — so it is settled from the
  // render instead ({@link settleDynamicLanding}).
  const lift = dynamicOffsetOverrideOf(engine.getScore(), id)?.y ?? 0
  if (lift !== 0) engine.dynamic.previewDynamicOffset(id, 0, -lift)
  // ⚠️ Whatever the picture could not say is paid as 0 — `./markWalk`'s no-guessing rule.
  const dx = fromX !== null && toX !== null ? (fromX - toX) / staffSpacePx : 0
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so no page limit has anything to judge.
  if (dx) engine.dynamic.previewDynamicOffsetRebase(id, dx)
  landed = { id, inkY: inkY + dyPx }
  dbg(`[Dynamic] jumped ${dyPx > 0 ? 'above' : 'below'} the staff it crossed | id:${id}`
    + ` → m${target.measure} staff:${target.staffId ?? 0}`
    + ` | anchor ${fromX?.toFixed(0) ?? '—'}→${toX?.toFixed(0) ?? '—'} paid dx ${dx.toFixed(2)}ss`
    + ` | the ink is to stay at ${(inkY + dyPx).toFixed(1)}`)
  return true
}

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-31) — WHAT THE LANDING ACTUALLY DID WITH THE INK, paid back.** The
 * wedge's `settleHairpinLanding` and the bracket's rule of the day before
 * (`reference_a_drag_decision_cannot_read_its_own_outcome`): ⛔ **a decision may not read a number
 * its own outcome writes** — the jump decides from the mark's drawn ink, and re-engraving the mark on
 * another staff's ladder is exactly what moves that ink.
 *
 * ⭐ The residual cannot be known before the render, so it is measured AFTER it: {@link jumpStaves}
 * remembers where the ink was meant to be, the caller re-draws, and this pays the difference in the
 * SAME mouse event — ⛔ not on the next frame, which would leave the leap on screen for one frame.
 *
 * @returns true when it wrote, so the caller knows to draw again.
 */
export function settleDynamicLanding(engine: DynamicWalkEngine, id: string): boolean {
  if (!landed || landed.id !== id) { landed = null; return false }
  const was = landed.inkY
  landed = null
  const drawn = markInkY(engine, id)
  const staffSpacePx = engine.getElementRegistry().getByType('dynamic')
    .find(el => el.id === id)?.staffSpacePx
  // Half a pixel is the rounding of the drawing, ⛔ not a debt.
  if (drawn === null || !staffSpacePx || Math.abs(was - drawn) < 0.5) return false

  const debt = was - drawn
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so the page limit has nothing to judge.
  engine.dynamic.previewDynamicOffsetRebase(id, 0, debt / staffSpacePx)
  dbg(`[Dynamic] landing settled | id:${id} | ink ${drawn.toFixed(1)} → ${was.toFixed(1)}`
    + ` (${debt.toFixed(1)}px the other staff's ladder gave or took)`)
  return true
}
