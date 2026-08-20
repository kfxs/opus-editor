/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A TRILL'S TWO SQUARES** — ←/→ and `Ctrl`+←/→ move the armed
 * end's INK, and once that ink reaches the next note of the lane the ORNAMENT'S ANCHOR goes with it.
 *
 * The trill is the fourth family to get this gesture, after the slur, the dynamic/tempo pair and the
 * hairpin, and it arrives by the rule the wedge's second square set (2026-08-20): **a handle that
 * has BOTH a re-anchor and an offset owes the walk that joins them.** Before this, the two halves of
 * moving a trill's end were unrelated — a plain arrow wrote a cosmetic offset that could slide the
 * `tr` arbitrarily far from the note it claims to sit on, and `Ctrl+Shift+←/→` (`./trillReanchor`)
 * jumped the anchor a whole note with the ink snapping to wherever the engraver puts it.
 *
 * The arithmetic is `./markWalk`'s, untouched; this file is the PORT, twice. What is trill-specific
 * is four things:
 *
 * ⭐⭐ **THE STOPS ARE NOTES**, not addresses in time — the slur's family, ⛔ not the pedal's
 * (`./trillReanchor` says why, and owns the candidate rule so the two keys cannot land the same
 * square on different notes).
 *
 * ⭐⭐ **THE TWO ENDS MEASURE AGAINST DIFFERENT X'S**: the sign is drawn on its note, the wavy line
 * stops at the note AFTER the trill. `./trillLane` holds that geometry and the reason it cannot be
 * note-to-note.
 *
 * ⭐⭐ **A STOP THAT CLEARS THE END IS PRICED WHERE THE INK LANDS** — the hairpin's rule, and here it
 * bites on any TIED start: an end walking back onto the start note leaves the one-note trill, whose
 * line stops at the end of the tie chain rather than at the start (`trillEndWithoutAnEnd`). Pricing
 * that step at the note it names would make the crossing jump the whole tie.
 *
 * ⭐ **THE CROSSING KEEPS BOTH NUDGES BY CONSTRUCTION** — `setTrillEnd` / `setTrillStart` touch no
 * override at all, so unlike the slur there is no `…KeepingEdits` twin to reach for. What the walk
 * then does with the armed end's own offset is the family's identity: it takes the gap back out
 * through {@link MusicEngine.rebaseTrillEndpointOffset}, so the ink does not jump.
 *
 * ⛔ **The vertical is not in here.** ↑/↓ stay a pure offset, and on this mark they move the WHOLE
 * ornament: the sign and the wiggle share one baseline, so `TrillOffsetOverride` has a single
 * height and there is nothing above or below to arrive at.
 *
 * 🚨🚨 **AND IT CROSSES A SYSTEM BREAK, the hairpin's way** — his ask the same day the keys shipped:
 * *"we should be able to handle cross system similar to hairpin"*. ⭐⭐ On this mark that is not an
 * edge case but the ORDINARY end of the lane: because the END's ink is drawn at the note AFTER the
 * trill, an end sitting on the last note of a line already has its square on the next one, so the
 * step ONTO that last note is itself a break crossing. Without it the walk stopped a whole note
 * short of where the eye said it should — see {@link crossingTheBreak} for the arithmetic.
 *
 * ⛔ **And it does not reach the BARE `tr`.** That state (`Trill.extension === 'none'`) is a step of
 * `Ctrl+Shift+←` past the collapse, with no gap to measure to — the ink has nothing to arrive at,
 * and a crossing that put the line back would jump the end square the width of the whole ornament.
 * With no line drawn, an arrow on the end square stays the plain ink nudge it has always been.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { trillEndWithoutAnEnd } from '../engine/models/trillOps'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'
import {
  applyTrillAnchorStop, nextTrillAnchorStop, trillAnchorPosition, type TrillAnchorEngine,
  type TrillAnchorStop,
} from './trillReanchor'
import {
  trillLane, trillLaneIndexAt, trillSquareBaseX, trillSquareMeasure, trillStaffSpacePx,
  trillSystemInkLimit,
} from './trillLane'
import type { FlatNote } from '../utils/beatMap'
import { staffOf } from '../utils/lanes'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TrillWalkEngine = TrillAnchorEngine & Pick<MusicEngine,
  'setTrillAnchor' | 'nudgeTrillEndpoint' | 'rebaseTrillEndpointOffset' | 'runBatch'>

/**
 * ⭐ **THE LANE AND THE INDEX, RESOLVED FRESH** — ⚠️ never captured: a crossing re-anchors mid-loop,
 * so a lane or an index resolved once would answer for a trill that has already moved.
 */
function laneOf(engine: TrillWalkEngine, id: string): FlatNote[] | null {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  return start ? trillLane(engine, start) : null
}

/** Where the armed end stands in the lane right now, or -1. */
function anchorIndex(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  lane: readonly FlatNote[],
): number {
  const trill = engine.getTrillById(id)
  const here = trill && trillAnchorPosition(engine, trill, which)
  return here ? trillLaneIndexAt(lane, here.measure, here.beat) : -1
}

/**
 * Where a STEP would leave the armed end, as a lane index.
 *
 * ⭐⭐ **A step that CLEARS the end is priced where the INK lands** — see the header. Clearing leaves
 * the tie chain's own extent, which is the start note only when nothing is tied.
 */
function stopIndex(
  engine: TrillWalkEngine,
  id: string,
  lane: readonly FlatNote[],
  stop: TrillAnchorStop,
): number {
  if (!stop.clearsEnd) return trillLaneIndexAt(lane, stop.note.measureNumber, stop.note.beat)
  const landing = trillEndWithoutAnEnd(engine.getScore(), id)
  const note = landing ? engine.getNote(landing) : null
  return note ? trillLaneIndexAt(lane, note.measure, note.beat) : -1
}

/**
 * The port: everything `./markWalk` needs of one square, and the whole of what is trill-specific
 * about it. ⛔ Not a `which` switch bolted onto a shared object — the two ends differ in exactly one
 * member ({@link trillSquareBaseX}'s `which`), and that member is where the difference belongs.
 */
function trillPort(
  state: EditorState,
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
): MarkWalkPort {
  const baseXAt = (index: number) => {
    const lane = laneOf(engine, id)
    const staff = trillStaff(engine, id)
    return lane && staff !== null && index !== -1
      ? trillSquareBaseX(engine.getElementRegistry(), lane, which, index, staff)
      : null
  }

  return {
    label: which === 'start' ? 'Trill sign' : 'Trill end',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives over there: two rules
    // would mean the same key landing the square on a different note depending on how far it had
    // been nudged.
    nextStop: (direction) => nextTrillAnchorStop(state, engine, direction),
    stopX: (stop) => {
      const lane = laneOf(engine, id)
      return lane ? baseXAt(stopIndex(engine, id, lane, stop as TrillAnchorStop)) : null
    },
    anchorX: () => {
      const lane = laneOf(engine, id)
      return lane ? baseXAt(anchorIndex(engine, id, which, lane)) : null
    },
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the staff this ornament was
    // DRAWN on, which may be a SMALL one.
    staffSpacePx: () => trillStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () =>
      trillOffsetOverrideOf(engine.getScore(), id)?.[which === 'start' ? 'startX' : 'endX'] ?? 0,
    reanchor: (stop) => applyTrillAnchorStop(engine, id, which, stop as TrillAnchorStop),
    // ⚠️ The second argument is OUTWARD-from-the-staff, not screen-down — the walk only ever passes
    // 0 (the vertical is not its business), so no conversion arises here.
    nudge: (dx, dy) => engine.nudgeTrillEndpoint(id, which, dx, dy),
    // ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
    // the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
    // crosses again (the hairpin's runaway, 2026-08-20).
    rebase: (dx) => engine.rebaseTrillEndpointOffset(id, which, dx),
  }
}

/**
 * 🚨🚨 **CROSSING A SYSTEM BREAK — the ink WRAPS AT THE END OF THE LINE**, and what was leaning into
 * the margin re-appears at the start of the next system. The hairpin's rule (his, 2026-08-20) asked
 * for here the same day the keyboard walk shipped: *"we should be able to handle cross system
 * similar to hairpin"*.
 *
 * ⭐⭐ **AND ON A TRILL IT IS NOT AN EDGE CASE — the END square reaches it a whole note EARLY.** Its
 * ink is drawn at the note AFTER the trill, so an end sitting on the last note of a line already has
 * its square on the NEXT line, and the step onto that last note is itself a break crossing. That is
 * the wall he hit: the walk carried the end down the lane and then stopped dead one note short, with
 * `markWalk` rightly refusing a gap whose sign disagreed with the travel.
 *
 * ⭐⭐ **TWO NUMBERS, TWO QUESTIONS** (`./hairpinWalk`, where using one for both cost an afternoon):
 *
 * ```
 *   arrives when   offset + step  passes  (this line's end − the square)
 *   re-bases by    gap = (this line's end − the square) + (the stop − that line's start)
 * ```
 *
 * So the press that leaves the line lands the ink just past the next system's start, by exactly what
 * would have hung in the margin, and further presses walk it on to zero. Symmetric backwards: the
 * edge is the line's START and the far side is the previous line's END.
 *
 * ⛔ Asked of the SYSTEMS — the drawn staff's top line — never of the two x's: across a break they
 * are not on one ruler, which is the fact that makes the whole question necessary.
 *
 * @returns the stop to wrap onto, the folded gap, and whether this press arrives; null when the
 *   question does not arise (the press is then ordinary ink, or `carryMark`'s own crossing).
 */
function crossingTheBreak(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
): { stop: TrillAnchorStop; gap: number; arrived: boolean; landing: number; direction: 1 | -1 } | null {
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction) as TrillAnchorStop | null
  if (!stop) return null

  const lane = laneOf(engine, id)
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  if (!lane || !start) return null

  const anchorAt = anchorIndex(engine, id, which, lane)
  const stopAt = stopIndex(engine, id, lane, stop)
  const anchor = port.anchorX()
  const stopX = port.stopX(stop)
  const staffSpacePx = port.staffSpacePx()
  if (anchorAt === -1 || stopAt === -1 || anchor === null || stopX === null || !staffSpacePx) return null

  const staff = staffOf(start)
  const here = systemOf(engine, staff, lane, anchorAt)
  const there = systemOf(engine, staff, lane, stopAt)
  if (!here || !there) return null
  // ⭐⭐ SAME LINE ⇒ an ordinary press, and `carryMark` owns it.
  if (here.top === there.top) return null

  const toEdge = ((direction === 1 ? here.max : here.min) - anchor) / staffSpacePx
  const gap = toEdge + (stopX - (direction === 1 ? there.min : there.max)) / staffSpacePx
  const target = port.offsetX() + dx
  const arrived = direction === 1 ? target > toEdge : target < toEdge
  // ⭐⭐ …and the FLOOR the honest landing is held to — see {@link WRAP_STUB_SS}.
  const stubAt = direction === 1
    ? there.min + WRAP_STUB_SS * staffSpacePx
    : there.max - WRAP_STUB_SS * staffSpacePx
  return { stop, gap, arrived, landing: (stubAt - stopX) / staffSpacePx, direction }
}

/**
 * 🚨🚨 **HOW FAR INTO THE NEW LINE A WRAPPED END MUST LAND — 2 staff-spaces, or it is INVISIBLE.**
 *
 * His report, 2026-08-20, on the first cut: *"i still don't see the cross system extension
 * working"* — with the log showing the wrap had happened and written `offset −1.59ss`. It had. The
 * honest landing is *exactly what the press pushed past the edge*, and a ¼-space arrow pushes a
 * QUARTER SPACE: the new fragment came out 0.25 sp wide, `TRILL_END_INSET` took 0.5 sp off it, and
 * `cutIntoPieces` dropped a piece whose end had crossed its own start. **A wrap with nothing to show
 * reads as a key that did nothing.**
 *
 * ⭐ So the honest landing is held to a floor, and the number is the wedge's own `WRAP_STUB_SS`
 * (`./hairpinWalk`), chosen there by his eye for the same job: big enough to SEE, small enough that
 * the journey plainly continues over there rather than being finished by the jump. ⚠️ It is a FEEL
 * number like the nudge steps, ⛔ not an engraving one — and the only constant in this file.
 *
 * ⚠️ **A floor, not a landing**: a press that genuinely travelled further than 2 sp past the edge
 * keeps its own distance, so the gesture stays continuous everywhere it can be seen to be.
 */
const WRAP_STUB_SS = 2

/** The drawn system the square standing at `index` would be on. */
function systemOf(
  engine: TrillWalkEngine,
  staff: number,
  lane: readonly FlatNote[],
  index: number,
): { min: number; max: number; top: number } | null {
  const measure = trillSquareMeasure(lane, index)
  return measure === null ? null : trillSystemInkLimit(engine, staff, measure)
}

/** The staff this ornament lives on — its START note's, ⛔ never the drawn entry's: a bar the last
 *  render culled has no entry, and the lane is a model question. */
function trillStaff(engine: TrillWalkEngine, id: string): number | null {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  return start ? staffOf(start) : null
}

/**
 * 🚨 **HOW FAR THE INK MAY GO WHEN THERE IS NOWHERE TO GO** — the same system edges
 * {@link crossingTheBreak} measures to, used the other way.
 *
 * His report, 2026-08-20: *"now it goes off the page but doesn't land in the next system"* — on a
 * score whose music simply STOPS. A trill's stops are NOTES, so a lane that continues in whole rests
 * offers nothing to walk onto, and with no limit every further press pushed the wavy line into the
 * margin and then off the sheet.
 *
 * ⭐⭐ **BUT THE END OF A LINE IS NOT THE END OF THE ROAD — his rule, the same day**: *"no anchor to
 * a note but offset in the next system"*. Ink that runs past a line's end is FOLDED onto the next one
 * by the renderer (`TrillRenderer.foldPastSystemEnd`), so the press is refused only where there is no
 * next line to fold onto — the last system the render drew.
 *
 * ⭐ It REFUSES the write; ⛔ it never clamps the drawing — `MusicEngine.nudgeStaysOnPage`'s rule,
 * including its escape hatch: ink already outside may always be nudged BACK, or a re-flow could
 * strand it. ⛔ And it allows freely when the ornament or its staff was not drawn — no picture, no
 * limit.
 *
 * ⚠️ **It does not apply while a crossing is PENDING** (there IS a stop on another system): that ink
 * is being pushed towards the very edge it wraps at.
 */
function inkStaysOnSystem(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
): boolean {
  const lane = laneOf(engine, id)
  const staff = trillStaff(engine, id)
  if (!lane || staff === null) return true
  const limit = systemOf(engine, staff, lane, anchorIndex(engine, id, which, lane))
  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  if (!limit || anchor === null || !staffSpacePx) return true

  // 🚨 WHERE THE INK IS, IS `anchor + offset` — ⛔ never the drawn fragment, which on a split
  // ornament is one piece of several and may be the one on the other system (the hairpin's freeze,
  // 2026-08-20).
  const next = anchor + (port.offsetX() + dx) * staffSpacePx
  // ⭐ Past an edge is allowed exactly when the drawing has somewhere to FOLD it — the line beyond.
  if (next > limit.max) return dx < 0 || hasNeighbouringSystem(engine, staff, limit.top, 1)
  if (next < limit.min) return dx > 0 || hasNeighbouringSystem(engine, staff, limit.top, -1)
  return true
}

/** Is there another drawn line beyond this one, for the ink to be folded onto? ⛔ Asked of the drawn
 *  STAVES (their top lines), never of x's — two systems' x's are not one ruler. */
function hasNeighbouringSystem(
  engine: TrillWalkEngine,
  staff: number,
  top: number,
  direction: 1 | -1,
): boolean {
  const registry = engine.getElementRegistry()
  return (engine.getScore().measures ?? []).some(bar => {
    const geometry = registry.getStaffGeometry(bar.number, staff)
    if (!geometry) return false
    return direction === 1
      ? geometry.lineYPositions[0] > top
      : geometry.lineYPositions[0] < top
  })
}

/** The ordinary press: ink, unless the ink would leave a system it has no way off. */
function inkPress(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
  crossingPending: boolean,
): boolean {
  if (!crossingPending && !inkStaysOnSystem(engine, id, which, port, dx)) {
    dbg(`[${port.label}] refused — the ink would leave this system, and there is nothing to wrap onto`)
    return false
  }
  return port.nudge(dx, 0)
}

/**
 * ⭐⭐ **THE WRAP ITSELF** — hand the end to `stop`, and put its ink where {@link crossingTheBreak}
 * said. ⚠️ The REBASE writer, not the nudge: this is bookkeeping, and a page limit that refused it
 * would strand the ornament mid-wrap. ⚠️ The caller owns the undo entry.
 */
function leaveSystem(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  across: { stop: TrillAnchorStop; gap: number; landing: number; direction: 1 | -1 },
  dx: number,
): boolean {
  const before = port.offsetX()
  if (!applyTrillAnchorStop(engine, id, which, across.stop)) {
    dbg(`[${port.label}] ⛔ the model REFUSED the wrap`)
    return false
  }
  // ⭐ THE KEYS re-base by the FOLDED distance: their ink really travelled it, one press at a time,
  // so the square re-appears as far into the new line as the hand pushed it past the edge — ⚠️ held
  // to {@link WRAP_STUB_SS}, below which there is nothing to see.
  const honest = before + dx - across.gap
  const landing = across.direction === 1
    ? Math.max(honest, across.landing)
    : Math.min(honest, across.landing)
  const rebased = port.rebase?.(landing - before)
  dbg(`[${port.label}] WRAPPED onto the next system | folded gap ${across.gap.toFixed(2)}ss`
    + ` | honest ${honest.toFixed(2)}ss floor ${across.landing.toFixed(2)}ss`
    + ` | offset now ${port.offsetX().toFixed(2)}ss${rebased ? '' : ' (REBASE REFUSED)'}`)
  return true
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON AN ARMED TRILL SQUARE** — nudge that end's ink by `dx`
 * staff-spaces (¼ space plain, 1 space with `Ctrl`), and hand that end of the ORNAMENT along if the
 * ink has arrived at the next note.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the ink somewhere the user never put it. ⚠️ A crossing press is also AUDIBLE — which notes a trill
 * covers is which notes get the alternation — and every press either side of it is ink.
 *
 * ⚠️ The walk STOPS where the model refuses: at either end of the lane, on a rest, on a fanned
 * member, on a note that already trills, and where the two ends would pass each other. The press
 * then stays a plain ink nudge, so the end can still be pushed past — which is what an override is
 * for.
 *
 * @returns true when something was written (the caller repaints); false when nothing was — no armed
 *   square, no such trill, or the page limit refused the ink.
 */
export function walkArmedTrillEndpoint(
  state: EditorState,
  engine: TrillWalkEngine,
  dx: number,
): boolean {
  const selected = selectedOf(state, 'trill')
  const which = selected?.endpoint
  if (!selected || !which || dx === 0) return false

  const port = trillPort(state, engine, selected.id, which)
  // ⛔ The BARE `tr` does not walk — see the header. Its end square has no line to carry.
  if (engine.getTrillById(selected.id)?.extension === 'none' && which === 'end') {
    return inkPress(engine, selected.id, which, port, dx, false)
  }

  const across = crossingTheBreak(engine, selected.id, which, port, dx)
  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    return inkPress(engine, selected.id, which, port, dx, across !== null)
  }

  let moved = false
  engine.runBatch(which === 'start' ? 'Move trill start' : 'Move trill end', () => {
    moved = across?.arrived
      ? leaveSystem(engine, selected.id, which, port, across, dx)
      : carryMark(port, dx).moved
  })
  return moved
}
