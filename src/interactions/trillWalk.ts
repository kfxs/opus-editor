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
import type { Note } from '../types/music'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { trillEndWithoutAnEnd } from '../engine/models/trillOps'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'
// ⭐ The line a mark stands on, in RAW drawn x's — {@link wouldLeaveLineStart} and the frame trace.
import { lastMeasureNumber, systemInkAt } from './markBreakWrap'
import {
  applyTrillAnchorStop, nextTrillAnchorStop, trillAnchorPosition, type TrillAnchorEngine,
  type TrillAnchorStop,
} from './trillReanchor'
import {
  trillInkY, trillLane, trillLaneIndexAt, trillLaneOnStaff, trillRibbonLimits, trillRibbonX,
  trillSquareBaseX, trillSquareMeasure, trillStaffBand, trillStaffSpacePx, trillSystemNoteFor,
} from './trillLane'
import type { FlatNote } from '../utils/beatMap'
import { staffOf } from '../utils/lanes'
import { dbg, debugEnabled } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TrillWalkEngine = TrillAnchorEngine & Pick<MusicEngine,
  'setTrillAnchor' | 'nudgeTrillEndpoint' | 'rebaseTrillEndpointOffset' | 'runBatch'
  | 'previewTrillAnchor' | 'previewTrillEndpointOffset' | 'previewTrillEndpointRebase'
  | 'previewTrillPlacement' | 'previewTrillMove' | 'resetTrillOffset'
  | 'setTrillExtension' | 'previewTrillExtension'
  | 'moveTrill' | 'nudgeTrill' | 'rebaseTrillOffset'
  | 'previewTrillOffset' | 'previewTrillOffsetRebase'>

/**
 * ⭐ **WHAT SEPARATES THE TWO DEVICES, and the whole of it**: a KEY press records its own undo step,
 * a drag FRAME records none and leaves the drop to commit once ({@link MusicEngine.commitTrillDrag}).
 * Everything else — the stops, the geometry, the identity — is shared, which is what makes a drag
 * and N presses land in the same state rather than in two states that merely look alike.
 */
interface TrillWrite {
  reanchor: (stop: TrillAnchorStop) => boolean
  nudge: (dx: number, dy: number) => boolean
  /** ⭐ The crossing's second half — bookkeeping, ⛔ never judged by the page limit. */
  rebase: (dx: number) => boolean
}

/** The keyboard's writes: each records its own undo entry, and a crossing press wraps them in one
 *  batch ({@link walkArmedTrillEndpoint}). */
function keyWrites(engine: TrillWalkEngine, id: string, which: 'start' | 'end'): TrillWrite {
  return {
    reanchor: (stop) => applyTrillAnchorStop(engine, id, which, stop),
    nudge: (dx, dy) => engine.nudgeTrillEndpoint(id, which, dx, dy),
    rebase: (dx) => engine.rebaseTrillEndpointOffset(id, which, dx),
  }
}

/** The drag's writes: the same three edits with no undo entry of their own. */
function previewWrites(engine: TrillWalkEngine, id: string, which: 'start' | 'end'): TrillWrite {
  return {
    // ⚠️ `null` is the CLEAR — the end walked back onto the start. It goes through the PREVIEW op
    // like every other frame, or that one crossing would record its own undo entry mid-gesture.
    reanchor: (stop) => engine.previewTrillAnchor(id, which, stop.clearsEnd ? null : stop.note.id),
    nudge: (dx, dy) => engine.previewTrillEndpointOffset(id, which, dx, dy),
    rebase: (dx) => engine.previewTrillEndpointRebase(id, which, dx),
  }
}

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
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  write: TrillWrite,
): MarkWalkPort {
  /** ⭐⭐ ON THE RIBBON, ⛔ never a raw drawn x — see `./trillLane`. Two systems' x's are not one
   *  ruler, and this ornament's ink runs along all of them. */
  const baseXAt = (index: number) => {
    const lane = laneOf(engine, id)
    const staff = trillStaff(engine, id)
    if (!lane || staff === null || index === -1) return null
    const drawn = trillSquareBaseX(engine.getElementRegistry(), lane, which, index, staff)
    const measure = trillSquareMeasure(lane, index)
    return drawn === null || measure === null ? null : trillRibbonX(engine, staff, measure, drawn)
  }

  return {
    label: which === 'start' ? 'Trill sign' : 'Trill end',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives over there: two rules
    // would mean the same key landing the square on a different note depending on how far it had
    // been nudged.
    nextStop: (direction) => nextTrillAnchorStop(engine, id, which, direction),
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
    reanchor: (stop) => write.reanchor(stop as TrillAnchorStop),
    // ⚠️ The second argument is OUTWARD-from-the-staff, not screen-down — neither device passes a
    // vertical here (the walk is horizontal), so no conversion arises.
    nudge: (dx, dy) => write.nudge(dx, dy),
    // ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
    // the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
    // crosses again (the hairpin's runaway, 2026-08-20).
    rebase: (dx) => write.rebase(dx),
  }
}

/** The staff this ornament lives on — its START note's, ⛔ never the drawn entry's: a bar the last
 *  render culled has no entry, and the lane is a model question. */
function trillStaff(engine: TrillWalkEngine, id: string): number | null {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  return start ? staffOf(start) : null
}

/**
 * 🚨 **HOW FAR THE INK MAY GO — the whole RIBBON, and not one step past it.**
 *
 * A trill's stops are NOTES, so a lane that runs out in rests offers nothing to walk onto; the ink
 * is then the only way onward, and the drawing FOLDS it from line to line
 * (`TrillRenderer.foldPastSystemEnd`, his rule). ⭐ So the limit is not the end of a SYSTEM — that
 * was the first cut, and his report killed it: *"if there are no notes in the other system the walk
 * just stops… it should not stop, it should go as offset"*. It is the end of the LAST line the
 * render drew, where there is no line left to fold onto and the ornament would run off the page.
 *
 * ⭐ It REFUSES the write; ⛔ it never clamps the drawing — `MusicEngine.nudgeStaysOnPage`'s rule,
 * including its escape hatch: ink already outside may always be nudged BACK. ⛔ And it allows freely
 * when the ornament or its staff was not drawn — no picture, no limit.
 */
function inkStaysOnTheRibbon(
  engine: TrillWalkEngine,
  id: string,
  port: MarkWalkPort,
  dx: number,
): boolean {
  const staff = trillStaff(engine, id)
  const limit = staff === null ? null : trillRibbonLimits(engine, staff)
  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  if (!limit || anchor === null || !staffSpacePx) return true

  // 🚨 WHERE THE INK IS, IS `anchor + offset` — ⛔ never the drawn fragment, which on a folded
  // ornament is one piece of several and may be the one on another line (the hairpin's freeze).
  const next = anchor + (port.offsetX() + dx) * staffSpacePx
  if (next > limit.max) return dx < 0
  // ⭐⭐ **NOTHING STOPS IT GOING LEFT** — his report, 2026-08-21: *"the trill and the hairpin offset
  // left endpoint is also limited to the first measure after the time signature, the user should not
  // have that limit"*. ⛔ Do not restore a `min` clause here. The offset is FREE; the only stop on
  // that side is the PAGE's edge, which is the engine's rule (`engine/layout/pageBounds`) and is
  // measured where the SQUARE is, not where the ink is.
  return true
}

/** The ordinary press: ink, unless the ink would leave the ribbon altogether. */
function inkPress(
  engine: TrillWalkEngine,
  id: string,
  port: MarkWalkPort,
  dx: number,
): boolean {
  if (!inkStaysOnTheRibbon(engine, id, port, dx)) {
    dbg(`[${port.label}] refused — past the last line the render drew`)
    return false
  }
  return port.nudge(dx, 0)
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

/**
 * ⭐⭐ **THE FAR END, WHEN THE WHOLE ORNAMENT MOVES ONTO `target`** — its extent carried along.
 *
 * ⭐ **Counted in the LANE's own stops**, which is a trill's only measure of how much music it
 * covers: a span of N notes arrives as a span of N notes, whatever the bars in between are doing.
 * ⚠️ Counted HERE and not in the model, because the lane is an interaction-side question
 * (`./trillLane`) — `trillOps.moveTrillTo` is simply told which two notes.
 *
 * ⚠️ Clamped at the end of the lane: a span pushed off the end arrives shortened rather than
 * refused, which is the same degradation a lost end has always had.
 */
function extentFrom(engine: TrillWalkEngine, id: string, target: string): string | undefined {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  if (!trill?.endNoteId || !start) return undefined
  const lane = trillLane(engine, start).filter(n => !n.isRest)
  const at = (noteId: string) => lane.findIndex(n => n.id === noteId)
  const span = at(trill.endNoteId) - at(start.id)
  if (span <= 0) return undefined
  // ⚠️ **The span is counted in the ORIGIN's lane and spent in the TARGET's**, which are the same
  // list for every landing but one: a jump ONTO ANOTHER STAFF (2026-08-21). Counting N stops in a
  // lane the target is not in would look the target up at −1 and hand back a note N−1 from the
  // lane's start — a far end nowhere near the ornament.
  const landing = engine.getNote(target)
  const dest = landing ? trillLane(engine, landing).filter(n => !n.isRest) : lane
  const from = dest.findIndex(n => n.id === target)
  return from === -1 ? undefined : dest[Math.min(from + span, dest.length - 1)]?.id
}

/**
 * ⭐⭐ **THE WHOLE ORNAMENT'S PORT — the third, beside the two squares'.** His ask, 2026-08-20: *"now
 * we should do the `tr` shape walking — I mean, trill selected but NOT endpoints"*. The family's own
 * rule, stated on the wedge's body the same day: **something armed → that end; nothing armed → the
 * whole mark** — and now with the same walk under both, so a nudge and a re-anchor are one gesture
 * wherever they meet.
 *
 * ⭐ **Its stops are the START's** (`nextTrillAnchorStop`'s `'body'`), because an ornament moved as
 * one is moved by its beginning — and it has NO clamp against its own far end, which travels with
 * it. ⭐ Its ink is BOTH ends at once (`nudgeTrill`), which is what the arrows have always written
 * with nothing armed; the offset it reads back is the start's, since the pair always carry the same
 * number while the ornament is moved as one.
 */
function bodyPort(engine: TrillWalkEngine, id: string, write: TrillWrite): MarkWalkPort {
  const baseXAt = (index: number) => {
    const lane = laneOf(engine, id)
    const staff = trillStaff(engine, id)
    if (!lane || staff === null || index === -1) return null
    const drawn = trillSquareBaseX(engine.getElementRegistry(), lane, 'start', index, staff)
    const measure = trillSquareMeasure(lane, index)
    return drawn === null || measure === null ? null : trillRibbonX(engine, staff, measure, drawn)
  }
  return {
    label: 'Trill',
    nextStop: (direction) => nextTrillAnchorStop(engine, id, 'body', direction),
    stopX: (stop) => {
      const lane = laneOf(engine, id)
      return lane ? baseXAt(stopIndex(engine, id, lane, stop as TrillAnchorStop)) : null
    },
    anchorX: () => {
      const lane = laneOf(engine, id)
      return lane ? baseXAt(anchorIndex(engine, id, 'start', lane)) : null
    },
    staffSpacePx: () => trillStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => trillOffsetOverrideOf(engine.getScore(), id)?.startX ?? 0,
    reanchor: (stop) => write.reanchor(stop as TrillAnchorStop),
    nudge: (dx, dy) => write.nudge(dx, dy),
    rebase: (dx) => write.rebase(dx),
  }
}

/**
 * Would this frame's `dx` carry the drawn ink before the first ink of the line it stands on?
 *
 * ⭐ Both numbers are RAW drawn x's in the same space — the registry's own — which is the whole
 * reason this is asked here and not through the walk's port: `MarkWalkPort.anchorX` answers on the
 * RIBBON (`trillLane.trillRibbonX`), a continuous coordinate across the unrolled score, and on his
 * score that reads **2175** for a note whose line spans 138…1114. Ribbon and raw agree only on the
 * first system, so the comparison has to be made on the drawn side.
 */
function wouldLeaveLineStart(engine: TrillWalkEngine, id: string, dxPx: number): boolean {
  const drawn = engine.getElementRegistry().getByType('trill').find(e => e.id === id)
  const staff = trillStaff(engine, id)
  const measure = engine.getNote(engine.getTrillById(id)?.startNoteId ?? '')?.measure
  if (!drawn || staff === null || measure === undefined) return false
  const here = systemInkAt(
    engine.getElementRegistry(), staff, measure, lastMeasureNumber(engine.getScore()))
  return here !== null && drawn.bbox.x + dxPx < here.min
}

/** ⏱ TEMPORARY — see the call site in {@link dragTrillBody}. ⛔ Not on the hot path: the caller
 *  guards it with `debugEnabled()`, because everything below walks the registry. */
function traceTrillFrame(
  engine: TrillWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
  staffSpacePx: number,
): void {
  const trill = engine.getTrillById(id)
  const drawn = engine.getElementRegistry().getByType('trill').find(e => e.id === id)
  const anchor = engine.getNote(trill?.startNoteId ?? '')
  const port = bodyPort(engine, id, bodyPreviewWrites(engine, id))
  const staff = trillStaff(engine, id)
  const here = staff === null || anchor?.measure === undefined ? null
    : systemInkAt(engine.getElementRegistry(), staff, anchor.measure,
      lastMeasureNumber(engine.getScore()))
  const stop = port.nextStop(dxPx > 0 ? 1 : -1)
  const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1))
  dbg(`[Trill frame] cursor x${cursorX.toFixed(0)} dx${dxPx.toFixed(1)} dy${dyPx.toFixed(1)}`
    + ` | ink x${num(drawn?.bbox.x)} y${num(drawn ? drawn.bbox.y + drawn.bbox.height / 2 : null)}`
    + ` drawnInBar ${drawn?.measure ?? '—'}`
    + ` | anchor ${trill?.startNoteId.slice(0, 8) ?? '—'} bar ${anchor?.measure ?? '—'}`
    + ` staff ${staff ?? '—'} placement:${trill?.placement ?? 'auto'}`
    + ` | offset ${num(port.offsetX())}ss anchorX ${num(port.anchorX())} ss ${staffSpacePx.toFixed(2)}`
    + ` | system ${here ? `bar${here.key} ink ${here.min.toFixed(0)}…${here.max.toFixed(0)}` : '—'}`
    + ` | nextStop ${stop ? JSON.stringify((stop as TrillAnchorStop).note.id.slice(0, 8)) : 'none'}`
    + ` stopX ${num(stop ? port.stopX(stop) : null)}`)
}

/** The keyboard's writes for the whole ornament: each records its own undo entry, and a crossing
 *  press wraps them in one batch ({@link walkTrillBody}). */
function bodyKeyWrites(engine: TrillWalkEngine, id: string): TrillWrite {
  return {
    reanchor: (stop) => engine.moveTrill(id, stop.note.id, extentFrom(engine, id, stop.note.id)),
    nudge: (dx, dy) => engine.nudgeTrill(id, dx, dy),
    rebase: (dx) => engine.rebaseTrillOffset(id, dx),
  }
}

/** The drag's: the same three edits with no undo entry of their own. */
function bodyPreviewWrites(engine: TrillWalkEngine, id: string): TrillWrite {
  return {
    reanchor: (stop) => engine.previewTrillMove(id, stop.note.id, extentFrom(engine, id, stop.note.id)),
    nudge: (dx, dy) => engine.previewTrillOffset(id, dx, dy),
    rebase: (dx) => engine.previewTrillOffsetRebase(id, dx),
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS WITH A TRILL SELECTED AND NOTHING ARMED** — the whole ornament's
 * walk: its ink moves by `dx`, and when that ink reaches the next note the ORNAMENT goes with it,
 * extent and all.
 *
 * ⚠️ So this key, like the squares', can end in a MODEL write — and that write is AUDIBLE. Every
 * press either side of a crossing is ink. ⭐ ONE stop per press ({@link carryMark}'s `maxCrossings`),
 * for the reason his report gave: an ink already far ahead of its notes is walked back onto them a
 * note at a time, visibly.
 *
 * @returns true when something was written (the caller repaints).
 */
export function walkTrillBody(engine: TrillWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = bodyPort(engine, id, bodyKeyWrites(engine, id))
  if (!markWalkCrosses(port, dx)) return inkPress(engine, id, port, dx)

  let moved = false
  engine.runBatch('Move trill', () => { moved = carryMark(port, dx, 0, false, 1).moved })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A SHAPE DRAG — the whole ornament, grabbed by its own ink.** His ask,
 * 2026-08-20: *"now the shape drag walking, and taking into consideration also the vertical axis for
 * the target"*. The wedge's BODY drag, sentence for sentence: **a HANDLE moves one end, the BODY
 * moves the whole thing**, which is the arrows' own split arriving on the mouse.
 *
 * ⭐ Both axes, and they are different kinds of move — which is the point of making them in one
 * gesture:
 *
 *  - **the horizontal walks the ornament through the music**, extent and all, exactly as the arrows
 *    do with nothing armed;
 *  - **the vertical is the LADDER** — its own staff's far side first, then the system below or above
 *    ({@link flipTrillPlacement}, {@link jumpTrillStaves}) — and a rung ends the FRAME, ⛔ never the
 *    gesture: the hand is travelling with the ornament, so the next rung comes when it gets there.
 *
 * ⛔ **No latch and no ink limit on a frame.** A frame is not a step (the wedge's recorded lesson),
 * and an ornament moved as one is not aimed at a note's edge the way a single end is.
 *
 * ⛔ Declines — **null** — when the ornament is not drawn, so there is no staff-space size to convert
 * the cursor's pixels with.
 */
export function dragTrillBody(
  engine: TrillWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): { moved: boolean } | null {
  const port = bodyPort(engine, id, bodyPreviewWrites(engine, id))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  // ⏱ TEMPORARY (docs/render-performance-plan.md §12.5a) — everything this frame decides from, in
  //   one line, because the horizontal and the vertical read DIFFERENT numbers and a report that
  //   shows only one of them cannot tell a bad decision from a bad drawing.
  //   ⭐ `inkX/inkY` are the ornament's OWN DRAWN INK (the registry row the walk reads); `offset` is
  //   what it has accumulated; `anchorX` is the RIBBON x the crossing measures against; `system` is
  //   the ink range of the line the anchor stands on (`markBreakWrap.systemInkAt`) — the crossing
  //   fires on `cursor` leaving THAT range, and the renderer folds on the INK leaving it.
  //   ⚠️ Lazily built: a suppressed `dbg` still evaluates its arguments (docs/logging.md).
  if (debugEnabled()) traceTrillFrame(engine, id, cursorX, dxPx, dyPx, staffSpacePx)

  // ⭐⭐ ITS OWN STAFF FIRST, then the system — the same two rungs the squares' drag climbs, and the
  // same reason for the order.
  if (flipTrillPlacement(engine, id, dyPx)) return { moved: true }
  if (jumpTrillStaves(engine, id, cursorX, dyPx)) return { moved: true }
  if (dxPx === 0 && dyPx === 0) return { moved: false }

  // ⚠️ Screen-down is +dy and the stored number is OUTWARD from the staff, so it converts here.
  const above = (engine.getTrillById(id)?.placement ?? 'above') === 'above'
  const dy = (above ? -dyPx : dyPx) / staffSpacePx
  const lifted = dyPx !== 0 && engine.previewTrillOffset(id, 0, dy)
  // ⛔⛔ **A BODY DRAG MAY NOT PUSH THE INK OFF THE FRONT OF ITS OWN LINE** — his bug, 2026-08-22:
  //   *"the trill is landing at the end very far from the target y and the mouse y"*, and then
  //   *"after some dragging again completely in the wrong place"*.
  //
  // 🚨 Traced twice on his grand staff. The ornament lands on the FIRST note of a system, so its ink
  // sits flush against that line's first ink — `x137.7` against a line starting at `138`. **Three
  // pixels** of leftward drag make the offset −0.3ss, which is before the line's start, and
  // `TrillRenderer.foldPastSystemEnd` does what it was built to do and continues the ink at the END
  // of the previous line: x 1111, y 93 — a system away from the hand, in both axes. One pixel back
  // the other way returns it. The trace is pages of that flip-flop.
  //
  // ⭐ **The fold is his own 2026-08-20 rule and is untouched.** It is what carries a mark over a
  // passage of empty bars where a trill's note-anchors offer nothing to land on, and the END-SQUARE
  // walk still has every bit of it. What it must not do is fire under a hand that is dragging the
  // whole ornament: a body drag's contract is that the mark follows the mouse, and a mark that has
  // folded a system backwards has stopped following it — permanently, since the ink is then nowhere
  // near the cursor and every later frame compounds it.
  //
  // ⚠️ Judged on where the ink WOULD land, ⛔ not on where it is: at offset 0 the ink is already ON
  // the line's first ink, so an "is it there now" test would refuse every leftward drag instead of
  // only the one with nowhere to go.
  if (dxPx < 0 && wouldLeaveLineStart(engine, id, dxPx)) {
    dbg(`[Trill] ⛔ the ink is against the start of its line — the body does not fold backwards`)
    return { moved: lifted }
  }
  return { moved: carryMark(port, dxPx / staffSpacePx, 0).moved || lifted }
}

/**
 * ⭐⭐ **THE VERTICAL IS A LADDER** — …above staff N, below staff N, above staff N+1… — and a drag
 * takes ONE rung at a time. His ask, 2026-08-20: *"now we need to make the mouse drag change the
 * `tr` y offset, and of course we have to be aware of the system jump in the y, similar to
 * hairpin"*. The rungs are the wedge's, rule for rule (`./hairpinWalk`), because they are the same
 * two questions asked of any mark that has a SIDE.
 *
 * ⭐ **Its own staff FIRST.** A trill has a `placement`, so the space on the other side of its staff
 * is a place it BELONGS, not a no-man's-land on the way to the next system:
 *
 * ```
 *   above, and the ink has passed the BOTTOM line  →  below this staff
 *   below, and the ink has passed the TOP line     →  above it
 * ```
 *
 * ⭐ That fixes *"it jumps to the upper system too quickly"* by construction and with no threshold to
 * tune: once the ornament is on the far side, `markSystemJump` measures its natural distance from
 * THAT edge, so the next staff is a whole system away again.
 *
 * ⚠️ The LIFT goes with the flip (a height measured below the staff means nothing above it) and the
 * frame ENDS — one visible step per gesture.
 */
function flipTrillPlacement(engine: TrillWalkEngine, id: string, dyPx: number): boolean {
  const registry = engine.getElementRegistry()
  const trill = engine.getTrillById(id)
  const inkY = trillInkY(registry, id)
  const band = trillStaffBand(registry, id)
  if (!trill || inkY === null || !band) return false

  const above = (trill.placement ?? 'above') === 'above'
  const next = inkY + dyPx
  const flipped: 'above' | 'below' | null =
    above && next > band.bottom ? 'below'
      : !above && next < band.top ? 'above'
        : null
  if (!flipped || !engine.previewTrillPlacement(id, flipped)) return false
  dropTheLift(engine, id)
  dbg(`[Trill] moved ${flipped} its own staff | id:${id}`)
  return true
}

/**
 * ⭐⭐ **LEAVING ITS OWN STAFF** — the one move the walk cannot make (`./markSystemJump`, shared with
 * the dynamic, the tempo mark and the wedge).
 *
 * ⭐⭐ **The staff below counts, not only the system below** (his ask, 2026-08-21). ⭐ And the trill is
 * the one family in the group that needs NO model write for it: its anchor is a NOTE, so landing on
 * the left hand's note IS being on the left hand's staff — where the dynamic and the wedge each
 * needed a `staffId` to move, this needs only a candidate to aim at (`trillLane.trillLaneOnStaff`).
 *
 * ⭐ **The whole ornament goes, extent and all** (`trillOps.moveTrillTo`): a trill's extent is counted
 * in the LANE's own notes, so a span of N stops arrives as a span of N stops. ⚠️ Counted HERE, because
 * the lane is an interaction-side question; the model is only told which two notes.
 *
 * ⭐ **It arrives ON THE SIDE IT CAME FROM** — the wedge's correction: coming down, the next rung is
 * ABOVE the staff below, which is also where the ink already is. ⛔ Landing on the far side skips a
 * rung and puts the ornament past the hand.
 *
 * ⚠️ Both offsets go on arrival: over there the old x means nothing and the y was never a height.
 */
function jumpTrillStaves(
  engine: TrillWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
): boolean {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  const inkY = trillInkY(engine.getElementRegistry(), id)
  if (!trill || !start || inkY === null) return false

  const above = (trill.placement ?? 'above') === 'above'
  const target = trillSystemNoteFor(
    engine, id, start, above, liftPx(engine, id, above), cursorX, inkY + dyPx)
  if (!target) {
    // 🚨 A decline that says nothing is a gesture that "does nothing", and this one has THREE
    // different reads — his afternoon of round trips on the wedge is the reason these lines exist.
    // ⭐ The commonest by far: a trill's anchor is a NOTE, so a system of rests has nowhere to land.
    logNoRung(engine, id, start, inkY + dyPx)
    return false
  }

  // ⭐ Where the ornament is DRAWN, before the anchor moves out from under it — the number the
  //   landing has to preserve.
  const inkBefore = inkXOf(engine, id)
  if (!engine.previewTrillMove(id, target, extentFrom(engine, id, target))) return false

  engine.previewTrillPlacement(id, dyPx > 0 ? 'above' : 'below')
  landWhereItWasDrawn(engine, id, target, inkBefore)
  dbg(`[Trill] jumped to the staff it now belongs to | id:${id} → ${target.slice(0, 8)}`)
  return true
}

/** The ornament's own drawn x in the last render — the LEFT of its ink, which is where the `tr` is.
 *  Null when it drew nothing. */
function inkXOf(engine: TrillWalkEngine, id: string): number | null {
  return engine.getElementRegistry().getByType('trill').find(e => e.id === id)?.bbox.x ?? null
}

/**
 * ⭐⭐ **A LANDING DOES NOT MOVE THE DRAWN ORNAMENT — the anchor steps and the OFFSET absorbs it.**
 * His bug, 2026-08-22: *"why if the x of my mouse is in another place i'm teleporting the x of the tr
 * that should be offset to the anchor"*.
 *
 * 🚨 Until today the jump called `resetTrillOffset`, which puts the sign ON its new note. For the
 * KEYS that is right — *"the sign lands ON its new note, where the engraver would put it"*
 * (`markWalk.crossWithoutArrival`) — and on a DRAG it is a teleport: his trace has the `tr` drawn at
 * `x803.5` and the landing dumping it at `x137.7`, the drawn x of the note it had just landed on,
 * most of a system away. It never comes back, because every later frame is a delta applied to a mark
 * that is no longer where the gesture left it.
 *
 * ⭐ **The ink is the thing preserved, ⛔ not the cursor** — his own correction, and it is right twice
 * over: the `tr` is not drawn under the mouse to begin with (a grab has an offset, and the sign sits
 * where the engraver put it), and it is the INK the next frame reads back. So the landing keeps the
 * drawn x and lets the stored offset become whatever that costs. ⛔ Not a new rule: it is
 * `markBreakWrap.leaveSystem`'s identity — *"the drawn mark does not move"* — arriving at the one
 * landing that never had it.
 *
 * ⚠️ Measured off the NOTE's drawn x, ⛔ not off the port's `anchorX`: that one answers on the RIBBON
 * (a continuous coordinate across the unrolled score — **2175** for a note whose line spans 138…1114
 * in his log). The note's registry row is raw, and notes do not move during a mark drag, so it is
 * still true before the re-render.
 */
function landWhereItWasDrawn(
  engine: TrillWalkEngine,
  id: string,
  target: string,
  /** The ornament's drawn x before the anchor moved. Null = it was not drawn. */
  inkBefore: number | null,
): void {
  engine.resetTrillOffset(id)
  const noteX = engine.getElementRegistry().getByType('note').find(e => e.id === target)?.bbox.x
  const staffSpacePx = trillStaffSpacePx(engine.getElementRegistry(), id)
  if (inkBefore === null || noteX === undefined || !staffSpacePx) return
  const spaces = (inkBefore - noteX) / staffSpacePx
  // 🚨🚨 **THE REBASE WRITER, ⛔ never `previewTrillOffset`** — the first cut used that one and the
  //   landing silently did nothing at all: his trace still read `offset 0.0ss` with the hand at
  //   `cursor x811`. `previewTrillOffset` is judged by the PAGE LIMIT (`nudgeStaysOnPage`), and a
  //   landing whose new anchor is most of a system away asks for tens of staff-spaces at once, which
  //   that limit exists to refuse.
  //
  // ⭐ A re-base is not a nudge, and `MusicEngine` already says so where it defines the pair: it is
  //   *"bookkeeping: it does not move the drawn ink, so no rule about ink may refuse it"*. The ink
  //   stays exactly where the hand had it — that is the whole point — so there is nothing for a page
  //   limit to have an opinion about. Same writer `markBreakWrap.leaveSystem` uses for the same
  //   reason: *"a page limit that refused it would strand the mark mid-wrap"*.
  if (spaces !== 0) engine.previewTrillOffsetRebase(id, spaces)
}

/**
 * ⚠️ **The decline on the HOT path, and it says itself only when it CHANGES** — the same treatment
 * `markBreakWrap.sameSystem` already carries, and for the same reason.
 *
 * 🚨 {@link whyNoJump} is **not** a template literal. It walks `getByType('note')` and runs a `find`
 * inside a `some`, which is docs/render-performance-plan.md §12.2's quadratic id lookup — hiding
 * inside a LOG MESSAGE. It was built EAGERLY on every declined frame, because a suppressed `dbg`
 * still evaluates its arguments (docs/logging.md's template caveat), so a production build with
 * every trace switched off paid for it too. In one of his 2026-08-22 census gestures this decline
 * fired **~90 times, with the same message every time**.
 *
 * ⛔ Deliberately NOT silent, and ⛔ not rate-limited by a timer: the day this decline is wrong
 * again it has to be visible, and a reason that CHANGES is exactly the interesting case — so the
 * dedup is on the message, per trill, and a new reason prints at once.
 */
const lastNoRung = new Map<string, string>()
function logNoRung(engine: TrillWalkEngine, id: string, start: Note, inkY: number): void {
  if (!debugEnabled()) return
  const message = `[Trill] no rung down there — ${whyNoJump(engine, start, inkY)}`
  if (lastNoRung.get(id) === message) return
  lastNoRung.set(id, message)
  dbg(message)
}

/**
 * Why {@link jumpTrillStaves} found nowhere to go — for the log, and ⛔ never for a decision.
 *
 * ⭐ *"There is no note over there"* is not a failure: the ornament still travels, as INK, exactly as
 * it does horizontally (his rule, 2026-08-20: *"no anchor to a note but offset in the next
 * system"*). What it cannot do is BELONG to a system that holds nothing it could hang off.
 *
 * ⚠️ **Expensive, and on a per-frame path** — call it only through {@link logNoRung}, never directly.
 */
function whyNoJump(engine: TrillWalkEngine, start: Note, inkY: number): string {
  const registry = engine.getElementRegistry()
  const bands = registry.staffBands()
  if (bands.length < 2) return 'only one staff is painted'

  const notes = registry.getByType('note')
  const yOf = (id: string) => {
    const el = notes.find(e => e.id === id)
    return el ? el.bbox.y + el.bbox.height / 2 : null
  }
  const there = bands.reduce((a, b) => (Math.abs(inkY - b.top) < Math.abs(inkY - a.top) ? b : a))
  // ⚠️ EVERY staff's lane, not the ornament's own — since 2026-08-21 the other hand of a grand staff
  // is a landing, so "nothing to hang off down there" has to be asked of the staff it is heading for.
  const staves = engine.getScore().staves?.length ?? 1
  const landable = Array.from({ length: Math.max(staves, 1) }, (_, staff) => staff)
    .flatMap(staff => trillLaneOnStaff(engine, start, staff))
    .filter(n => !n.isRest)
    .some(n => {
      const y = yOf(n.id)
      return y !== null && y >= there.top - PAD_PX && y <= there.bottom + PAD_PX
    })
  return landable
    ? 'the ink still belongs to the staff it is on'
    : `no note of this VOICE is drawn on the staff at y ${there.top.toFixed(0)}`
      + ' — so the ornament travels as INK instead, with nothing there to anchor to'
}

/** How far off a staff's five lines a notehead may sit and still be ON that staff — ledger lines and
 *  a high leap. ⚠️ For a LOG line only: nothing decides anything by it. */
const PAD_PX = 40

/** This ornament's stored height in SCREEN pixels (+down) — ⚠️ `outward` is a distance FROM the
 *  staff, so it is negated above it. `markSystemJump` must take it back out to find where the
 *  ENGRAVER put the mark. */
function liftPx(engine: TrillWalkEngine, id: string, above: boolean): number {
  const outward = trillOffsetOverrideOf(engine.getScore(), id)?.outward ?? 0
  const ss = trillStaffSpacePx(engine.getElementRegistry(), id) ?? 0
  return outward * ss * (above ? -1 : 1)
}

/** Drop the height the hand had given it — a flip or a jump makes it meaningless. ⚠️ The horizontal
 *  survives a FLIP (the ornament is still on the same notes) and goes with a JUMP. */
function dropTheLift(engine: TrillWalkEngine, id: string): boolean {
  const outward = trillOffsetOverrideOf(engine.getScore(), id)?.outward ?? 0
  return outward === 0 || engine.previewTrillEndpointOffset(id, 'start', 0, -outward)
}

/**
 * ⭐⭐ **ONE FRAME OF A TRILL SQUARE DRAG** — the same journey as the arrows, with the cursor's delta
 * in PIXELS instead of a key's step and no undo entry (the drop commits once,
 * {@link MusicEngine.commitTrillDrag}). His ask, 2026-08-20: *"now the walking with the mouse drag…
 * we should be able to go to the next system too, behaviour similar to hairpins, just using the
 * proper re-anchor for the trill"*.
 *
 * ⭐ **The mouse and the arrows are now ONE gesture.** The drag used to SNAP: it asked which note the
 * cursor was nearest and re-anchored outright every frame, so the ink teleported a whole note at a
 * time and an end could never be parked between two. Now the ink follows the hand and the anchor
 * comes along when the ink reaches a note — so a drag and N presses covering the same distance leave
 * the model in the same state rather than in two states that merely look alike.
 *
 * ⭐⭐ **THE LATCH IS ON** (`./markWalk`), as it is for the wedge: a trill's end is AIMED at a note's
 * edge, and that alignment must be reachable exactly rather than by luck. 🚨 What it drops must be
 * REPAID — those pixels were made by the hand, and a caller that swallows them leaves the ink behind
 * the cursor a little at every stop, for ever (Baudisch's own complaint about snap-and-go).
 *
 * ⭐⭐ **A WRAP ENDS THE GESTURE** — the hairpin's call, and for its reason: that end is now on the
 * NEXT system while the hand is still on this one, so every further pixel would move it by a
 * distance measured against a system it has left. ⚠️ The square stays ARMED, so the arrows can carry
 * on from where the mouse stopped.
 *
 * ⛔ **HORIZONTAL ONLY.** A trill's vertical is one number for the whole ornament and it is placed by
 * the ladder; the arrows own it (`shortcutWiring`). ⛔ And unlike the wedge there is no ink limit on
 * a frame — a frame is not a step, and refusing a whole one whose tail overshot stalls the walk one
 * stop short for ever.
 *
 * ⛔ Declines — **null**, not a frame — when the ornament is not drawn, so there is no staff-space
 * size to convert the cursor's pixels with.
 */
export function dragTrillEndpoint(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  cursorX: number,
  dxPx: number,
  dyPx = 0,
): { moved: boolean; jumped: boolean; droppedPx: number } | null {
  const port = trillPort(engine, id, which, previewWrites(engine, id, which))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  // ⭐⭐ THE BARE `tr` — the same rung the keys take ({@link crossTheBareSign}), so a drag and a press
  // that go the same way end in the same STATE rather than in two that merely look alike.
  if (crossTheBareSign(engine, id, which, dxPx / staffSpacePx, {
    extension: (to) => engine.previewTrillExtension(id, to),
    nudge: (ddx, ddy) => engine.previewTrillEndpointOffset(id, 'end', ddx, ddy),
  })) return { moved: true, jumped: false, droppedPx: 0 }

  // ⭐⭐ ITS OWN STAFF FIRST — see {@link flipTrillPlacement}. An ornament dragged across its staff
  // belongs on the other side of it long before it belongs to the staff beyond.
  if (flipTrillPlacement(engine, id, dyPx)) return { moved: true, jumped: true, droppedPx: 0 }
  if (jumpTrillStaves(engine, id, cursorX, dyPx)) return { moved: true, jumped: true, droppedPx: 0 }
  if (dxPx === 0 && dyPx === 0) return { moved: false, jumped: false, droppedPx: 0 }

  // ⭐⭐ **THE VERTICAL IS ONE NUMBER FOR THE WHOLE ORNAMENT** — the sign and the wiggle sit on one
  // baseline, so `TrillOffsetOverride` has a single height and the armed square does not matter to
  // it. ⚠️ Screen-down is +dy and the stored number is OUTWARD from the staff, so it converts here.
  const above = (engine.getTrillById(id)?.placement ?? 'above') === 'above'
  const lifted = dyPx !== 0
    && engine.previewTrillEndpointOffset(id, which, 0, (above ? -dyPx : dyPx) / staffSpacePx)

  // ⚠️ `carryMark` UNCONDITIONALLY, ⛔ not only when it crosses: the LATCH lives in there, and a
  // frame that merely passes through offset zero is exactly the one it exists for.
  // ⛔ **NO INK LIMIT ON A FRAME** — the wedge's recorded lesson: a frame is not a step, and refusing
  // a whole one whose tail overshot stalls the walk one stop short for ever.
  const carried = carryMark(port, dxPx / staffSpacePx, 0, true)
  // ⭐ In PIXELS, because that is what the caller's cursor anchor is measured in.
  return {
    moved: carried.moved || lifted,
    jumped: false,
    droppedPx: carried.dropped * staffSpacePx,
  }
}

/**
 * ⭐⭐ **THE BARE `tr` IS A STATE, ⛔ NOT A BIG NEGATIVE OFFSET** — the leftmost rung of the END's
 * walk, and now the same rung for the keys and the mouse.
 *
 * 🚨 His report, 2026-08-20: *"a `tr` with no extension should be copied and pasted as a `tr` with no
 * extension — it is a use case the user wants to KEEP"*. Dragging the end back past the sign already
 * DREW a bare `tr` (the wiggle has no room left), but it stored `endX: -15.4` — an ink nudge — so a
 * copy, which deliberately leaves ink behind, brought the line back. What the eye called *"a trill
 * with no extension"* and what the model called it had drifted apart.
 *
 * ⭐ So the ink crossing the sign WRITES the state ({@link Trill.extension}), which is exactly what
 * `Ctrl+Shift+←` has always done one step past the collapse — and the reverse restores the line. The
 * two routes now agree, which is this family's own rule.
 *
 * ⚠️ **The end's own nudge is dropped with it**: `'none'` and a nudged end would be two ways of
 * saying the same thing, and the one that travels is the state.
 *
 * @returns true when this press became the state change (the caller then stops).
 */
function crossTheBareSign(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
  write: { extension: (to: 'none' | undefined) => boolean; nudge: (dx: number, dy: number) => boolean },
): boolean {
  if (which !== 'end') return false
  const trill = engine.getTrillById(id)
  if (!trill) return false

  // ⭐ FROM the bare sign: a rightward press puts the line back on the same note; leftward is the
  // floor, since there is nothing shorter than a sign on its own.
  if (trill.extension === 'none') {
    return dx > 0 && write.extension(undefined)
  }
  if (dx >= 0) return false

  // …and INTO it: only from the one-note trill, where there is no musical extent left to give up.
  // ⛔ A trill that still covers a run of notes loses its END first (the ordinary walk), never its
  // line — the line is the only thing that says how long to keep trilling.
  if (trill.endNoteId !== undefined) return false

  const ink = endInkPastSign(engine, id, dx)
  if (ink === null || !ink.past || !write.extension('none')) return false
  const offset = trillOffsetOverrideOf(engine.getScore(), id)?.endX ?? 0
  if (offset) write.nudge(-offset, 0)
  dbg(`[Trill] the line is off | id:${id} → a bare tr`)
  return true
}

/** Would this press take the END's drawn ink back past the SIGN's? Both read on the ribbon, with
 *  their own nudges in — ⛔ the drawn fragments cannot answer across a fold. */
function endInkPastSign(
  engine: TrillWalkEngine,
  id: string,
  dx: number,
): { past: boolean } | null {
  const lane = laneOf(engine, id)
  const staff = trillStaff(engine, id)
  const trill = engine.getTrillById(id)
  const ss = trillStaffSpacePx(engine.getElementRegistry(), id)
  if (!lane || staff === null || !trill || !ss) return null

  const at = anchorIndex(engine, id, 'start', lane)
  const endAt = anchorIndex(engine, id, 'end', lane)
  if (at === -1 || endAt === -1) return null
  const registry = engine.getElementRegistry()
  const signX = trillSquareBaseX(registry, lane, 'start', at, staff)
  const endX = trillSquareBaseX(registry, lane, 'end', endAt, staff)
  const signM = trillSquareMeasure(lane, at)
  const endM = trillSquareMeasure(lane, endAt)
  if (signX === null || endX === null || signM === null || endM === null) return null

  const sign = trillRibbonX(engine, staff, signM, signX)
  const end = trillRibbonX(engine, staff, endM, endX)
  if (sign === null || end === null) return null

  const nudge = trillOffsetOverrideOf(engine.getScore(), id)
  const signInk = sign + (nudge?.startX ?? 0) * ss
  const endInk = end + ((nudge?.endX ?? 0) + dx) * ss
  return { past: endInk <= signInk }
}

export function walkArmedTrillEndpoint(
  state: EditorState,
  engine: TrillWalkEngine,
  dx: number,
): boolean {
  const selected = selectedOf(state, 'trill')
  const which = selected?.endpoint
  if (!selected || !which || dx === 0) return false

  const port = trillPort(engine, selected.id, which, keyWrites(engine, selected.id, which))
  // ⭐⭐ THE BARE `tr`, the END's leftmost rung — see {@link crossTheBareSign}.
  if (crossTheBareSign(engine, selected.id, which, dx, {
    extension: (to) => engine.setTrillExtension(selected.id, to),
    nudge: (ddx, ddy) => engine.nudgeTrillEndpoint(selected.id, 'end', ddx, ddy),
  })) return true
  // ⛔ …and with no line there is nothing to walk: the press stays the plain ink nudge it was.
  if (engine.getTrillById(selected.id)?.extension === 'none' && which === 'end') {
    return inkPress(engine, selected.id, port, dx)
  }
  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  if (!markWalkCrosses(port, dx)) return inkPress(engine, selected.id, port, dx)

  let moved = false
  engine.runBatch(which === 'start' ? 'Move trill start' : 'Move trill end', () => {
    // ⭐⭐ ONE stop per press — see {@link carryMark}'s `maxCrossings`, and his report that made it a
    // rule. An ink already far ahead of its note is walked back onto it a NOTE AT A TIME.
    moved = carryMark(port, dx, 0, false, 1).moved
  })
  return moved
}
