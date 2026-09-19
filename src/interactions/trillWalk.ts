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
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { trillEndWithoutAnEnd } from '../engine/models/trillOps'
import { type MarkWalkPort } from './markWalk'
import { dragFrame, inkNudge, walkPress, type DragFrame, type MarkDriveSpec } from './markDrive'
// ⭐ The line a mark stands on, in RAW drawn x's — {@link wouldLeaveLineStart} and the frame trace.
import {
  lastMeasureNumber, systemInkAt, type BreakWrapPort, type SystemInk,
} from './markBreakWrap'
import {
  applyTrillAnchorStop, nextTrillAnchorStop, trillAnchorPosition, type TrillAnchorEngine,
  type TrillAnchorStop,
} from './trillReanchor'
import {
  trillInkY, trillLane, trillLaneIndexAt, trillLaneOnStaff, trillRibbonLimits, trillRibbonX,
  trillSquareBaseX, trillSquareMeasure, trillStaffBand, trillStaffSpacePx, trillSystemNoteFor,
} from './trillLane'
import type { FlatNote } from '../utils/beatMap'
import type { Fraction } from '../types/music'
import { fracToNumber } from '../utils/fraction'
import { measureStartQuarters } from '../utils/measureCapacity'
import { staffOf, voiceOf } from '../utils/lanes'
import { dbg, debugEnabled } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
type TrillWalkEngine = TrillAnchorEngine & Pick<MusicEngine,
  'setTrillAnchor' | 'nudgeTrillEndpoint' | 'rebaseTrillEndpointOffset' | 'runBatch'
  | 'previewTrillAnchor' | 'previewTrillEndpointOffset' | 'previewTrillEndpointRebase'
  | 'previewTrillPlacement' | 'previewTrillMove' | 'resetTrillOffset'
  | 'setTrillExtension' | 'previewTrillExtension'
  | 'nudgeTrill' | 'commitTrillDrag'
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
 *  batch ({@link walkTrillEndpoint}). */
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
 * ⭐⭐ **AN AMOUNT OF MUSIC, ⛔ NOT A COUNT OF NOTES** — his report, 2026-08-30, with the picture:
 * *"i dont know why the trill line grows desproportionally when reanchor"*. A trill over five
 * SIXTEENTHS of the right hand — one quarter of music — landed on the left hand as five of ITS
 * notes, which in his Prelude is four bars: the wavy line ran off the end of the system and resumed
 * `(tr)` on the next one.
 *
 * ⭐ The count was *"a trill's only measure of how much music it covers"* only while both ends of the
 * move were in ONE lane, which is every landing but the one this function grew for: a jump ONTO
 * ANOTHER STAFF (2026-08-21). Two staves do not count alike, and the unit that survives the crossing
 * is the one every sibling already travels in — the LENGTH rides along, clamped where it is READ
 * (`pedalOps.pedalSpan`'s rule, and the wedge's).
 *
 * ⚠️ Counted HERE and not in the model, because the lane is an interaction-side question
 * (`./trillLane`) — `trillOps.moveTrillTo` is simply told which two notes.
 *
 * ⚠️ **The degradation is a SHORTER trill, ⛔ never a longer one**: the far end is the last stop of
 * the destination lane that still falls inside the span, and `undefined` when none does — which the
 * model reads as *"the start note's own duration"*, the single-note trill. That is the same
 * shortening a span pushed off the end of a lane has always had.
 */
function extentFrom(engine: TrillWalkEngine, id: string, target: string): string | undefined {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  const end = trill?.endNoteId ? engine.getNote(trill.endNoteId) : null
  const landing = engine.getNote(target)
  if (!start || !end || !landing) return undefined

  const measures = engine.getScore().measures
  const at = (note: { measure: number; beat: Fraction }) =>
    measureStartQuarters(measures, note.measure) + fracToNumber(note.beat)
  const span = at(end) - at(start)
  if (span <= 0) return undefined

  // ⭐ The DESTINATION's lane, which on a cross-staff landing is a different list of notes at
  // different moments — that difference is the whole point of measuring in music rather than stops.
  const dest = trillLane(engine, landing).filter(n => !n.isRest)
  const from = dest.findIndex(n => n.id === target)
  if (from === -1) return undefined

  // ⭐⭐ **WITHIN ONE LANE THE EXTENT IS NOT RE-DERIVED AT ALL — BOTH ENDS STEP TOGETHER.** His
  // question, 2026-08-30, and it is the right one: *"what is the difference between horizontal drag
  // in the ottava or the hairpin and the horizontal drag in the trill, why those work and not the
  // trill?"* — with the pedal added a minute later.
  //
  // ⭐ **All three store a `length: Fraction`; the trill stores an `endNoteId`.** So their body drag
  // writes the START and nothing else — `ottavaOps.setOttavaAtSlot` sets `ottava.beat` and stops,
  // and its own note says why that is safe: *"the LENGTH rides along… a span running past what the
  // target staff carries is clamped where it is READ, never here."* Clamped on the way OUT, so a
  // drag can always be dragged back.
  //
  // 🚨 The trill has no such field, so this function had to find a new end note on EVERY step of a
  // sideways walk — and it clamps on the way IN, downward (the last stop still inside the span). One
  // step loses a rounding; his gesture took ~40 of them, and the loss never comes back. That is both
  // halves of what he has been reporting all afternoon: the ornament stretching
  // (`the_body_walk_stretches_a_span_mark`) and the ornament shrinking.
  //
  // ⭐ **So the same-lane walk now does what the siblings do**: the end moves by the SAME NUMBER OF
  // STOPS the start did. Integer arithmetic on one list — nothing measured, nothing rounded, nothing
  // to lose. ⛔ The music-measuring below is kept for the ONE case it was written for (2026-08-21): a
  // jump onto ANOTHER STAFF, where the destination is a different list of notes at different moments
  // and there is no shared index to step by.
  //
  // ⚠️ Clamped at the lane's end, as it has always been, and by the same rule — a span with nowhere
  // left to go arrives SHORTER rather than refused. ⛔ But it is no longer clamped when it has room.
  const here = trillLane(engine, start).filter(n => !n.isRest)
  const wasStart = here.findIndex(n => n.id === start.id)
  const wasEnd = here.findIndex(n => n.id === end.id)
  const sameLane = wasStart !== -1 && wasEnd !== -1 && here[from]?.id === target
  if (sameLane) {
    return dest[Math.min(from + (wasEnd - wasStart), dest.length - 1)]?.id
  }
  const reach = at(landing) + span + 1e-6 // the float slack a Fraction's division leaves behind
  let last: string | undefined
  for (const note of dest.slice(from + 1)) {
    if (at({ measure: note.measureNumber, beat: note.beat }) > reach) break
    last = note.id
  }
  return last
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
    // ⭐ The START square's stops, ⛔ not `'body'`'s — with the far end frozen
    // ({@link bodyMoveWrites}) the ornament may not walk past it, and `'body'` has no such clamp,
    // so it would offer a note the model then refuses and the ink would jam against it.
    nextStop: (direction) => nextTrillAnchorStop(engine, id, 'start', direction),
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
 * ⏱ TEMPORARY (2026-08-30) — **DID THE DRAWN ORNAMENT GO AS FAR AS THE HAND DID?** His report:
 * *"it is not moving with my hand"*.
 *
 * 🚨 **Why the existing `[Trill frame]` line CANNOT answer that**, and why I read his log wrongly
 * once already: its `ink x` is fetched at the TOP of {@link dragTrillBody} — before the frame writes
 * anything and before the preview redraws. Every line therefore reports the PREVIOUS frame's
 * drawing, so laying its ink deltas beside its cursor deltas compares two different moments and
 * always looks like it tracks. ⭐ This one runs AFTER the render, in the same mouse event, so `ink`
 * is what his eye is actually looking at.
 *
 * ⭐ **Cumulative, ⛔ not per-frame.** A drift of half a pixel a frame is invisible one line at a time
 * and is the whole complaint after two hundred of them, so the number that settles it is
 * `RESIDUAL` — how far the hand has gone since the grab, minus how far the ink has. Constant ⇒ the
 * grab offset and nothing is wrong; growing ⇒ the ornament is falling behind, and the ratio says
 * whether it is a scale (a fixed fraction) or a stall (whole frames lost).
 *
 * ⭐ And it counts the frames where **the hand moved and the ink did not** — a refused frame is
 * invisible in a per-frame trace and is exactly what "not moving" feels like.
 */
let handVsInk: {
  id: string
  hand0: number; ink0: number
  hand: number; ink: number
  frames: number; still: number
  span0: string; span: string; spanChanges: number
} | null = null

/**
 * ⏱ TEMPORARY (2026-08-30) — **HOW MUCH MUSIC THE ORNAMENT COVERS**, the axis {@link handVsInk}
 * could not see and the one his *"the trill is not moving correctly"* most likely means.
 *
 * 🚨 Every walk step re-derives the far end ({@link extentFrom} through `previewTrillMove`), and that
 * derivation CLAMPS — it takes the last stop still inside the span, so it can only ever come back
 * the same or SHORTER (`d5d61d1`: *"the degradation is a SHORTER trill, ⛔ never a longer one"*). One
 * step loses at most a rounding; his last gesture took ~20 steps left and ~20 back, and nothing in
 * any trace says what the span was at either end of that.
 *
 * ⚠️ Reported in QUARTERS and in STOPS, because the two disagree exactly where the bug would live: a
 * span held in quarters lands on a different NUMBER of notes wherever the note values change.
 */
function trillSpanOf(engine: TrillWalkEngine, id: string): string {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  if (!start) return '—'
  const end = trill.endNoteId ? engine.getNote(trill.endNoteId) : null
  if (!end) return 'single'
  const ms = engine.getScore().measures
  const at = (n: { measure: number; beat: Fraction }) =>
    measureStartQuarters(ms, n.measure) + fracToNumber(n.beat)
  const lane = trillLane(engine, start).filter(n => !n.isRest)
  const stops = lane.findIndex(n => n.id === end.id) - lane.findIndex(n => n.id === start.id)
  return `${(at(end) - at(start)).toFixed(2)}q/${stops < 0 ? '?' : stops} stops`
}

/** ⏱ TEMPORARY — call AFTER the preview has drawn. See {@link handVsInk}. */
export function traceTrillHandVsInk(engine: TrillWalkEngine, id: string, cursorX: number): void {
  if (!debugEnabled()) return
  const ink = inkXOf(engine, id)
  if (ink === null) {
    dbg(`[Trill hand] ⛔ nothing drawn for ${id.slice(0, 8)} — the ink cannot be compared this frame`)
    return
  }
  const span = trillSpanOf(engine, id)
  if (!handVsInk || handVsInk.id !== id) {
    handVsInk = {
      id, hand0: cursorX, ink0: ink, hand: cursorX, ink, frames: 0, still: 0,
      span0: span, span, spanChanges: 0,
    }
    dbg(`[Trill hand] gesture starts | hand ${cursorX.toFixed(1)} ink ${ink.toFixed(1)}`
      + ` | the grab holds them ${(cursorX - ink).toFixed(1)}px apart — that gap is what must NOT change`
      + ` | it covers ${span}`)
    return
  }
  const s = handVsInk
  if (span !== s.span) {
    s.spanChanges++
    dbg(`[Trill span] ⚠️ ${s.span} → ${span} (change #${s.spanChanges} this gesture,`
      + ` it started at ${s.span0}) — the walk re-derives the far end on every step`)
    s.span = span
  }
  const dHand = cursorX - s.hand
  const dInk = ink - s.ink
  s.frames++
  if (dHand !== 0 && dInk === 0) s.still++
  const hand = cursorX - s.hand0
  const moved = ink - s.ink0
  dbg(`[Trill hand] hand ${cursorX.toFixed(1)} (${dHand >= 0 ? '+' : ''}${dHand.toFixed(1)} now,`
    + ` ${hand >= 0 ? '+' : ''}${hand.toFixed(1)} since the grab)`
    + ` | ink ${ink.toFixed(1)} (${dInk >= 0 ? '+' : ''}${dInk.toFixed(1)} now,`
    + ` ${moved >= 0 ? '+' : ''}${moved.toFixed(1)} since the grab)`
    + ` | covers ${span}`
    + ` | RESIDUAL ${(hand - moved).toFixed(1)}px`
    + `${hand !== 0 ? ` (the ink went ${((moved / hand) * 100).toFixed(0)}% of the way)` : ''}`
    + ` | ${s.still}/${s.frames} frames moved the HAND and not the INK`)
  s.hand = cursorX
  s.ink = ink
}

/** ⏱ TEMPORARY — the drop ends the comparison, so the next gesture measures its own grab. */
export function endTrillHandTrace(): void {
  if (handVsInk && debugEnabled()) {
    const s = handVsInk
    dbg(`[Trill hand] gesture ends | hand ${(s.hand - s.hand0).toFixed(1)}px,`
      + ` ink ${(s.ink - s.ink0).toFixed(1)}px, RESIDUAL ${((s.hand - s.hand0) - (s.ink - s.ink0)).toFixed(1)}px`
      + ` over ${s.frames} frames, ${s.still} of which moved the hand alone`)
  }
  handVsInk = null
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
  const port = bodyPort(engine, id, bodyMoveWrites(engine, id))
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
    // ⚠️ The VOICE is here since 2026-08-30, on his report *"it seems that the trill just get
    // reanchor to voice 1 but it should not be"*: the lane holds the voice by construction
    // (`trillLane.trillLaneOnStaff` = `buildBeatMap(score, voiceOf(start), staff)`), so the trace
    // has to say which voice the anchor is actually IN before anything is changed. ⛔ Never leave an
    // axis out of the one line per frame.
    + ` staff ${staff ?? '—'} voice ${anchor ? voiceOf(anchor) : '—'}`
    + ` placement:${trill?.placement ?? 'auto'}`
    + ` | offset ${num(port.offsetX())}ss anchorX ${num(port.anchorX())} ss ${staffSpacePx.toFixed(2)}`
    + ` | system ${here ? `bar${here.key} ink ${here.min.toFixed(0)}…${here.max.toFixed(0)}` : '—'}`
    + ` | nextStop ${stop ? JSON.stringify((stop as TrillAnchorStop).note.id.slice(0, 8)) : 'none'}`
    + ` stopX ${num(stop ? port.stopX(stop) : null)}`)
}

/**
 * ⭐⭐ **A RUN OF PRESSES IS ONE WALK, SO IT IS ONE UNDO ENTRY — his rule, 2026-08-30:** *"for the
 * undo with the key held is easy, cause we don't have to record all changes with the key held, just
 * know what was the previous state before the held, so we go back — it is just a walking."*
 *
 * ⭐ So the keys write through the DRAG's ops, and the run's end commits once
 * ({@link commitTrillKeyRun}) — `MusicEngine.commitPreviewed` pushes the state after the walk, so
 * one `Ctrl+Z` returns to where the key went down.
 *
 * 🚨 **And it is also the freeze.** A write that records its own entry (as `nudgeTrill` does) takes a
 * SNAPSHOT of the whole score — 450 KB on his Prelude — inside a ~33 ms key repeat, measured at
 * ~25 ms of walk per press with the drawing already down to ~1 ms.
 *
 * ⚠️ They are {@link bodyMoveWrites}, the DRAG's own three, and that is not a coincidence to be
 * tidied away: a press and a drag frame must leave the ornament in the same state.
 */
const bodyKeyWrites = bodyMoveWrites

/**
 * ⭐⭐ **MOVING THE WHOLE ORNAMENT — the three writes, for BOTH devices.**
 *
 * 🚨 His report, 2026-08-30, the minute this was got wrong: *"now the key walking is shrinking the
 * trill size"*. The keys had been pointed at the START SQUARE's writes by mistake — the frozen-end
 * set the drag was built from — so a press moved the sign and left the end where it was.
 *
 * ⭐ The whole ornament needs all three to agree:
 *
 * | | one end (the square) | the whole ornament |
 * |---|---|---|
 * | reanchor | `previewTrillAnchor(id,'start',note)` | `previewTrillMove(id, note, carriedEnd(…))` — the far end rides on `D₀` |
 * | nudge    | `previewTrillEndpointOffset(id,'start',…)` | `previewTrillOffset(…)` — **both** inks |
 * | rebase   | `previewTrillEndpointRebase(id,'start',…)` | `previewTrillOffsetRebase(…)` — **both** |
 *
 * ⚠️ The nudge and the rebase must move BOTH inks or the shape breathes: between crossings the
 * start's ink would carry the whole offset while the end's stayed on its note, stretching by a gap
 * and snapping back at every step. ⛔ `preview*` throughout — no undo entry per press or per frame;
 * the drop commits ({@link MusicEngine.commitTrillDrag}), and so does the key run
 * ({@link commitTrillKeyRun}).
 */
function bodyMoveWrites(engine: TrillWalkEngine, id: string): TrillWrite {
  return {
    reanchor: (stop) => engine.previewTrillMove(id, stop.note.id, carriedEnd(engine, id, stop.note.id)),
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
  // ⭐⭐ The run's own grab — see {@link keepOrMeasureSpan}: `D₀` survives consecutive presses on
  // this ornament and is re-measured the moment anything else has moved it.
  keepOrMeasureSpan(engine, id)
  const moved = walkPress({
    ...trillDrive(engine, id, bodyPort(engine, id, bodyKeyWrites(engine, id)), 'Move trill'),
    // ⛔⛔ **NO BATCH, because there is no entry to batch** — see {@link bodyKeyWrites}. `runBatch`
    //   exists to make a crossing press's two writes ONE undo entry; these writes record none, and
    //   the batch would cost the very snapshot the run is avoiding. The RUN is the entry
    //   ({@link commitTrillKeyRun}).
    runBatch: (_description, fn) => { fn(); return true },
  }, dx)
  rememberTrillPair(engine, id)
  if (moved) keyRunOpen = true
  return moved
}

/**
 * ⭐⭐ **THE RUN'S END — one undo entry for however many presses it took.** Called when the repeats
 * stop (`shortcutWiring`'s settle, the same moment the page renders for real), which is a key run's
 * answer to a drag's DROP.
 *
 * ⚠️ Declines when nothing was previewed, so a settle that fires after a refused press does not push
 * a duplicate entry.
 */
export function commitTrillKeyRun(engine: TrillWalkEngine): boolean {
  if (!keyRunOpen) return false
  keyRunOpen = false
  engine.commitTrillDrag('start')
  dbg('[Trill] the key run committed — ONE undo entry, back to before the key went down')
  return true
}

/** ⏱ Whether presses have previewed something nobody has committed yet. See {@link walkTrillBody}. */
let keyRunOpen = false

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
 * 🚨🚨 **THE HORIZONTAL IS {@link dragTrillEndpoint}'s CODE, DUPLICATED** — his call, 2026-08-30,
 * after an afternoon of the two gestures disagreeing: *"lets do the trill whole horizontal drag the
 * same that the first endpoint drag"*, then *"dont share the same function… replicate the code, we
 * will adapt it to the new"*, then *"just duplicate the same code than the first endpoint drag"*.
 *
 * ⛔ **So every line below is that function's, with `which = 'start'` — the PORT included.** Not
 * `bodyPort`, not the body's writes, no `latch: false`, no `wouldLeaveLineStart`: the square's
 * gesture is the one that works, and this one is to be identical to it before anything is adapted.
 * ⚠️ A DELIBERATE COPY, ⛔ not a seam waiting to be collapsed — the two are expected to diverge as
 * the body's own rules are found ('A NAME IS NOT A BODY', CLAUDE.md).
 *
 * ⚠️ The ornament therefore STRETCHES as the start walks away from its frozen end. That is what the
 * square's drag does, and it is the state we are testing from.
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
): TrillDragFrame | null {
  // ⭐⭐ **THE ONE ADAPTATION — the far end rides along** ({@link bodyMoveWrites}). Everything else
  // below is the square's, line for line; what changes is the WRITE, and it is the same write the
  // ARROWS make, so the two devices cannot drift apart.
  const port = trillPort(engine, id, 'start', bodyMoveWrites(engine, id))
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

  // ⭐⭐ THE BARE `tr` — {@link dragTrillEndpoint}'s first rung. ⚠️ Inert on `'start'`
  // ({@link crossTheBareSign} returns at once), and duplicated anyway: this function is that one.
  if (crossTheBareSign(engine, id, 'start', dxPx / staffSpacePx, {
    extension: (to) => engine.previewTrillExtension(id, to),
    nudge: (ddx, ddy) => engine.previewTrillEndpointOffset(id, 'end', ddx, ddy),
  })) return { ...NO_TRAVEL, moved: true }

  // ⭐⭐ ITS OWN STAFF FIRST, then the system — the squares' two rungs, and the same order.
  // ⚠️ EXPLORATORY (2026-08-30): `jumped` says the mark changed RUNG, so the caller draws and then
  // pays what that cost ({@link settleTrillLanding}) inside the same mouse event.
  if (flipTrillPlacement(engine, id, dyPx)) return { ...NO_TRAVEL, moved: true, jumped: true }
  if (jumpTrillStaves(engine, id, cursorX, dyPx)) return { ...NO_TRAVEL, moved: true, jumped: true }
  if (dxPx === 0 && dyPx === 0) return { ...NO_TRAVEL }

  // ⭐⭐ **THE VERTICAL IS ONE NUMBER FOR THE WHOLE ORNAMENT** — the sign and the wiggle sit on one
  // baseline. ⚠️ Screen-down is +dy and the stored number is OUTWARD from the staff, so it converts
  // here. ⛔ Through the ENDPOINT op, as the square's does — see the header.
  const above = (engine.getTrillById(id)?.placement ?? 'above') === 'above'
  const lifted = dyPx !== 0
    && engine.previewTrillEndpointOffset(id, 'start', 0, (above ? -dyPx : dyPx) / staffSpacePx)

  // ⭐⭐ **IT WRAPS, exactly as the other three do** — {@link wrapPort} + `markBreakWrap`.
  // ⚠️ The cursor goes in ON THE RIBBON ({@link cursorOnRibbon}), because everything else this family
  //   hands `breakCrossing` is measured there.
  const hand = cursorOnRibbon(engine, id, 'start', cursorX)
  const frame = dragFrame(
    { port, wrap: wrapPort(engine, id, 'start'), latch: true, vertical: () => 0 },
    hand ?? cursorX, dxPx, 0,
  )
  return frame
    ? { ...frame, moved: frame.moved || lifted, jumped: false }
    : { ...NO_TRAVEL, moved: lifted }
}

/** A position in QUARTERS from the top of the score — the one ruler two different lanes share. */
function quartersAt(engine: TrillWalkEngine, measure: number, beat: Fraction): number {
  return measureStartQuarters(engine.getScore().measures, measure) + fracToNumber(beat)
}

/**
 * ⭐⭐ **HOW MUCH MUSIC THE ORNAMENT COVERED WHEN THE HAND GRABBED IT — measured ONCE, and held.**
 * His rule, 2026-08-30: *"the initial trill is anchored to 2 points, that means that we know the
 * duration in music of it… so when we move the trill we know how much duration in music we have to
 * move"*.
 *
 * 🚨 **⛔ NEVER RE-DERIVED MID-GESTURE, and that is the whole reason it lives here.** The landing
 * rounds DOWN ({@link carriedEnd}); a duration re-measured from the pair that rounding just produced
 * rounds down again, and again — one step loses a fraction, a drag takes forty of them, and the
 * ornament shrinks away and never comes back. Measured once, every frame lands from the ORIGINAL
 * duration, so dragging out into sparse music and back into dense music returns the trill you had.
 *
 * ⛔ Gesture state, ⛔ not a model field — a trill is anchored to two NOTES, and that is unchanged.
 */
let bodySpan: {
  id: string
  quarters: number
  /** ⭐ The pair this ledger last left behind — see {@link keepOrMeasureSpan}. */
  startId?: string
  endId?: string
} | null = null

/** ⭐ The grab: measure the ornament's music once. Called when the body drag arms. */
export function beginTrillBodySpan(engine: TrillWalkEngine, id: string): void {
  const trill = engine.getTrillById(id)
  const start = trill && engine.getNote(trill.startNoteId)
  const end = trill?.endNoteId ? engine.getNote(trill.endNoteId) : null
  const quarters = start && end
    ? quartersAt(engine, end.measure, end.beat) - quartersAt(engine, start.measure, start.beat)
    : 0
  bodySpan = { id, quarters, startId: trill?.startNoteId, endId: trill?.endNoteId }
  dbg(`[Trill] body span measured | id:${id} | it covers ${quarters.toFixed(2)}q`
    + ' — held for the gesture, ⛔ never re-measured')
}

/** ⭐ The drop. ⚠️ A gesture that ends between the two simply leaves the next grab to measure again. */
export function endTrillBodySpan(): void {
  bodySpan = null
}

/**
 * ⭐⭐ **THE KEYBOARD'S GRAB — A RUN OF PRESSES, and it knows its own run by the PAIR IT LEFT.**
 *
 * 🚨 His report, 2026-08-30: *"the arrow ctrl arrow walking is not smooth"*, once the drag was.
 * A drag has a mousedown to measure at; a press has nothing, so measuring per press means measuring
 * the pair the PREVIOUS press's rounding produced — the compounding shrink {@link bodySpan} exists
 * to stop, arriving by the other door.
 *
 * ⭐ **So the run validates itself, ⛔ with no timer and no hook to forget it.** The ledger records
 * the two note ids it left the ornament on; the next press keeps `D₀` only if the trill still stands
 * exactly there. Anything else that has touched it in between — an undo, a drag, the square's own
 * keys, another edit — leaves a different pair, and the duration is measured afresh.
 */
function keepOrMeasureSpan(engine: TrillWalkEngine, id: string): void {
  const trill = engine.getTrillById(id)
  const mine = bodySpan?.id === id
    && bodySpan.startId === trill?.startNoteId
    && bodySpan.endId === trill?.endNoteId
  if (!mine) beginTrillBodySpan(engine, id)
}

/** ⭐ …and where the press left it, so the next one can recognise its own run. */
function rememberTrillPair(engine: TrillWalkEngine, id: string): void {
  const trill = engine.getTrillById(id)
  if (bodySpan?.id !== id) return
  bodySpan.startId = trill?.startNoteId
  bodySpan.endId = trill?.endNoteId
}

/**
 * ⭐⭐ **WHERE THE FAR END LANDS WHEN THE START ARRIVES ON `target`** — his rule, in his words:
 * *"you evaluate the closest to the duration, and if the evaluation says that the closest is a
 * bigger duration you target the before to the closest"*.
 *
 * So: the destination lane's candidates are measured against `target + D₀` in QUARTERS, the NEAREST
 * one wins, and if that nearest OVERSHOOTS the duration the one before it takes its place.
 *
 * ⭐ **Quarters, ⛔ not a count of notes** — the unit both lanes share. A jump onto another staff is
 * a different list of notes at different moments, and stepping by index there means nothing.
 *
 * ⚠️ **It can only come back the same or SHORTER, never longer** — the sibling families' rule (a span
 * is clamped where it is read). Nothing at or before the reach ⇒ `undefined`, which the model reads
 * as the single-note trill; `D₀ = 0` says it was one already.
 */
function carriedEnd(engine: TrillWalkEngine, id: string, target: string): string | undefined {
  const quarters = bodySpan?.id === id ? bodySpan.quarters : 0
  const landing = quarters > 0 ? engine.getNote(target) : null
  if (!landing) return undefined

  const lane = trillLane(engine, landing).filter(n => !n.isRest)
  const from = lane.findIndex(n => n.id === target)
  const after = from === -1 ? [] : lane.slice(from + 1)
  if (!after.length) return undefined

  const reach = quartersAt(engine, landing.measure, landing.beat) + quarters
  const gapTo = (n: FlatNote) => quartersAt(engine, n.measureNumber, n.beat) - reach
  let best = 0
  after.forEach((note, i) => {
    if (Math.abs(gapTo(note)) < Math.abs(gapTo(after[best]))) best = i
  })
  // ⭐ …and the one BEFORE the closest when the closest is longer than the duration. ⚠️ The float
  //   slack is the one a Fraction's division leaves behind, ⛔ not a tolerance.
  if (gapTo(after[best]) > 1e-6) best -= 1
  return best >= 0 ? after[best].id : undefined
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
  // ⚠️⚠️ EXPLORATORY (2026-08-30) — **A RUNG-CHANGE DOES NOT MOVE THE DRAWING**
  // ({@link settleTrillLanding}). The dropped lift IS right — a height measured above the staff means
  // nothing below it — but the picture has to stay under the hand, and measured in his trace the ink
  // leapt 314.7 → 352.2 on a frame the hand had moved a pixel.
  landed = { id, inkY: next }
  dbg(`[Trill] moved ${flipped} its own staff | id:${id} | the ink is to stay at ${next.toFixed(1)}`)
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
  // ⚠️ EXPLORATORY (2026-08-30): the x is preserved above, by the rule that function carries; the
  // VERTICAL cannot be predicted — the ornament arrives on the other side of a different staff — so
  // it is settled from the render ({@link settleTrillLanding}).
  landed = { id, inkY: inkY + dyPx }
  dbg(`[Trill] jumped to the staff it now belongs to | id:${id} → ${target.slice(0, 8)}`
    + ` | the ink is to stay at ${(inkY + dyPx).toFixed(1)}`)
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
/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — the one rung-change a drag is still owed a settlement for.**
 * The wedge's and the pedal's, the third family on ({@link settleTrillLanding}).
 *
 * ⛔ Not drag state and it carries no travel: one id and one y, written by a flip or a landing and
 * spent in the same mouse event. A gesture that ends in between simply leaves it.
 */
let landed: { id: string; inkY: number } | null = null

/**
 * ⚠️⚠️ **EXPLORATORY (2026-08-30) — WHAT THE RUNG-CHANGE ACTUALLY DID WITH THE INK, paid back.**
 * `hairpinWalk.settleHairpinLanding`'s port, and here it is the WHOLE payment rather than a residual:
 * what an ornament gets on the other side of a staff — or on another staff entirely — is whatever the
 * ladder has left there, which is only knowable once the render has run.
 *
 * 🚨 His report, with the trace: *"look how close i come to the element of the other staff and the
 * trill still dont reanchor"*, and one line above it the flip leaping **314.7 → 352.2** on a frame the
 * hand had moved a pixel.
 *
 * ⭐ The lift is stored OUTWARD, so the debt converts here — and against the placement the mark has
 * NOW, which is the side the offset is about.
 *
 * @returns true when it wrote, so the caller knows to draw again.
 */
export function settleTrillLanding(engine: TrillWalkEngine, id: string): boolean {
  if (!landed || landed.id !== id) { landed = null; return false }
  const was = landed.inkY
  landed = null
  const registry = engine.getElementRegistry()
  const drawn = trillInkY(registry, id)
  const staffSpacePx = trillStaffSpacePx(registry, id)
  // Half a pixel is the rounding of the drawing, ⛔ not a debt.
  if (drawn === null || !staffSpacePx || Math.abs(was - drawn) < 0.5) return false

  const debt = was - drawn
  const above = (engine.getTrillById(id)?.placement ?? 'above') === 'above'
  // ⛔ A REBASE, not a nudge: the drawn ink does not move, so no limit has anything to judge.
  engine.previewTrillOffsetRebase(id, 0, (above ? -debt : debt) / staffSpacePx)
  dbg(`[Trill] rung settled | id:${id} | ink ${drawn.toFixed(1)} → ${was.toFixed(1)}`
    + ` (${debt.toFixed(1)}px the new rung gave or took)`)
  return true
}

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
 * ⭐ A frame of the ornament's square drag: the shared {@link DragFrame}, plus the one fact only this
 * family reports.
 *
 * ⚠️ `wrapped` is always **false** here and that is a claim, not a placeholder — a trill's ink is ONE
 * RIBBON across the systems (`./trillLane`), so leaving a line is not an event
 * ({@link dragTrillEndpoint}). Saying it in the shared vocabulary is what lets one caller drive all
 * four families.
 */
type TrillDragFrame = DragFrame & {
  /** ⭐ A LADDER RUNG was taken — the far side of this staff, or the system beyond. ⛔ It ends the
   *  FRAME, never the gesture: the hand is travelling with the ornament. */
  jumped: boolean
}

/** A frame that walked nowhere — a rung taken, a state written, or a hand that did not move. */
const NO_TRAVEL: TrillDragFrame = {
  moved: false, jumped: false, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0,
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
): TrillDragFrame | null {
  const port = trillPort(engine, id, which, previewWrites(engine, id, which))
  const staffSpacePx = port.staffSpacePx()
  if (!staffSpacePx) return null

  // ⭐⭐ THE BARE `tr` — the same rung the keys take ({@link crossTheBareSign}), so a drag and a press
  // that go the same way end in the same STATE rather than in two that merely look alike.
  if (crossTheBareSign(engine, id, which, dxPx / staffSpacePx, {
    extension: (to) => engine.previewTrillExtension(id, to),
    nudge: (ddx, ddy) => engine.previewTrillEndpointOffset(id, 'end', ddx, ddy),
  })) return { ...NO_TRAVEL, moved: true }

  // ⭐⭐ ITS OWN STAFF FIRST — see {@link flipTrillPlacement}. An ornament dragged across its staff
  // belongs on the other side of it long before it belongs to the staff beyond.
  if (flipTrillPlacement(engine, id, dyPx)) return { ...NO_TRAVEL, moved: true, jumped: true }
  if (jumpTrillStaves(engine, id, cursorX, dyPx)) return { ...NO_TRAVEL, moved: true, jumped: true }
  if (dxPx === 0 && dyPx === 0) return { ...NO_TRAVEL }

  // ⭐⭐ **THE VERTICAL IS ONE NUMBER FOR THE WHOLE ORNAMENT** — the sign and the wiggle sit on one
  // baseline, so `TrillOffsetOverride` has a single height and the armed square does not matter to
  // it. ⚠️ Screen-down is +dy and the stored number is OUTWARD from the staff, so it converts here.
  const above = (engine.getTrillById(id)?.placement ?? 'above') === 'above'
  const lifted = dyPx !== 0
    && engine.previewTrillEndpointOffset(id, which, 0, (above ? -dyPx : dyPx) / staffSpacePx)

  // ⭐⭐ **IT WRAPS, exactly as the other three do** — {@link wrapPort} + `markBreakWrap`, ⛔ not a
  // rule of its own. `breakCrossing` reports ARRIVED when the hand passes the line's edge (either
  // edge — the test is symmetric), `leaveSystem` re-anchors the end onto the next system's stop and
  // lands a `WRAP_STUB_SS` stub inside it, and `MARK_END_DRAGS.trill.endsOnWrap` then ends the
  // gesture with the square still armed, so the arrows carry on from over there.
  // ⚠️ The cursor goes in ON THE RIBBON, because everything else this family hands `breakCrossing`
  //   is measured there ({@link cursorOnRibbon}).
  // ⛔ And no vertical through the driver: the lift above is one number for the whole ornament and is
  //   already written.
  const hand = cursorOnRibbon(engine, id, which, cursorX)
  const frame = dragFrame(
    { port, wrap: wrapPort(engine, id, which), latch: true, vertical: () => 0 },
    hand ?? cursorX, dxPx, 0,
  )
  return frame && { ...frame, moved: frame.moved || lifted, jumped: false }
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

export function walkTrillEndpoint(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
): boolean {
  if (dx === 0) return false

  const port = trillPort(engine, id, which, keyWrites(engine, id, which))
  // ⭐⭐ THE BARE `tr`, the END's leftmost rung — see {@link crossTheBareSign}.
  if (crossTheBareSign(engine, id, which, dx, {
    extension: (to) => engine.setTrillExtension(id, to),
    nudge: (ddx, ddy) => engine.nudgeTrillEndpoint(id, 'end', ddx, ddy),
  })) return true
  const drive = trillDrive(engine, id, port,
    which === 'start' ? 'Move trill start' : 'Move trill end')
  // ⛔ …and with no line there is nothing to walk: the press stays the plain ink nudge it was, guard
  // and all — ⛔ NOT `walkPress`, which would look for stops a bare `tr` does not have.
  if (engine.getTrillById(id)?.extension === 'none' && which === 'end') {
    return (drive.inkGuard?.(false, dx) ?? true) && inkNudge(port, dx)
  }
  return walkPress(drive, dx)
}

/**
 * ⭐⭐ **THE ORNAMENT'S PORT INTO `./markBreakWrap`, ON THE RIBBON** — the same seam the wedge, the
 * bracket and the pedal use, and the reason this family finally behaves like them.
 *
 * 🚨 His report, 2026-08-24: *"when extending the trill and it goes to the next system it does not
 * stop the drag like the rest lines but still is growing"* — and, of two bespoke tests written
 * instead of this, *"now is impossible to cross to the other system… this is even worst"*. ⛔ Both
 * were rules invented for this family. `breakCrossing` + `leaveSystem` are what the other three
 * actually do, and its drag arrival test is symmetric (`cursorX > here.max` one way,
 * `cursorX < here.min` the other), which is the second half he reported missing.
 *
 * ⭐⭐ **THE ONLY TRILL-SPECIFIC THING IS THE RULER.** `breakCrossing` compares `port.anchorX()` with
 * `here.max` and `port.stopX()` with `there.min`, so all four must be measured the same way — and
 * this family's port speaks the RIBBON (`./trillLane.trillRibbonX`: every drawn line laid end to
 * end). So the systems' edges are handed over ON THE RIBBON too, and every line of that arithmetic
 * — `toEdge`, the stub, the landing, the folded gap — then holds unchanged. ⛔ Mixing the two spaces
 * is exactly what made the earlier attempts fire a whole line's indent early.
 *
 * ⭐ **The ribbon stays.** It is what lets the ink go on as pure offset where the next system has no
 * note to land on (his rule, 2026-08-21: *"if there are no notes in the other system the walk just
 * stops… it should not stop, it should go as offset"*) — `breakCrossing` simply returns null there,
 * because {@link MarkWalkPort.nextStop} gave it nothing, and the drawing folds the ink onward.
 */
function wrapPort(engine: TrillWalkEngine, id: string, which: 'start' | 'end'): BreakWrapPort {
  const staff = trillStaff(engine, id)
  /** One system's drawn extent, re-expressed on the ribbon. */
  const inkAt = (measure: number | undefined): SystemInk | null => {
    if (staff === null || measure === undefined) return null
    const drawn = systemInkAt(
      engine.getElementRegistry(), staff, measure, lastMeasureNumber(engine.getScore()))
    if (!drawn) return null
    const min = trillRibbonX(engine, staff, measure, drawn.min)
    const max = trillRibbonX(engine, staff, measure, drawn.max)
    // ⛔ No picture, no rule — the family's own no-guessing law.
    return min === null || max === null ? null : { min, max, key: drawn.key }
  }
  return {
    here: () => {
      const trill = engine.getTrillById(id)
      return trill ? inkAt(trillAnchorPosition(engine, trill, which)?.measure) : null
    },
    there: (stop) => inkAt((stop as TrillAnchorStop).note.measureNumber),
    address: (stop) => ({
      note: (stop as TrillAnchorStop).note.id,
      bar: (stop as TrillAnchorStop).note.measureNumber,
    }),
  }
}

/**
 * ⭐⭐ **THE HAND'S x, ON THE RIBBON** — what {@link breakCrossing}'s drag arrival test needs, since
 * everything else this family hands it is measured there.
 *
 * ⚠️ Converted through the line THE END STANDS ON, which is the line the test is about: *"has the
 * hand passed the end of this line"*. A cursor that has already moved onto the next system converts
 * to a small number and reads as "not yet" — the same limit the other three have, since their raw
 * `cursorX` on a new line is small too.
 *
 * ⛔ Null when the picture cannot say; the caller then omits it and `breakCrossing` falls back to the
 * INK test, which is the keyboard's and is always available.
 */
function cursorOnRibbon(
  engine: TrillWalkEngine,
  id: string,
  which: 'start' | 'end',
  cursorX: number,
): number | null {
  const staff = trillStaff(engine, id)
  const trill = engine.getTrillById(id)
  const at = trill ? trillAnchorPosition(engine, trill, which) : null
  return staff === null || !at ? null : trillRibbonX(engine, staff, at.measure, cursorX)
}

/**
 * ⭐ The ornament's row in the shared driver's table (`./markDrive`).
 *
 * ⛔ **NO WRAP, and it is the one family without one** — a trill's stops are NOTE IDS, and a note on
 * the next line is not a distance away (`./markBreakWrap` has five implementors; this is the sixth
 * family and the exception). ⛔ **So no hand-over either**: a blocked press has no wrap to spend
 * itself on, and `crossWithoutArrival` would step the anchor where this family has always done
 * nothing.
 *
 * ⭐ Its `inkGuard` is the RIBBON: the ink may not be pushed past the last line the render drew.
 * ⭐ ONE stop per press — his report of 2026-08-20, the one that made the bound a rule everywhere.
 */
function trillDrive(
  engine: TrillWalkEngine,
  id: string,
  port: MarkWalkPort,
  label: string,
): MarkDriveSpec {
  return {
    port,
    // ⛔⛔ **NO WRAP ON THE KEYS — and that is a RULE, not an omission.** `trillWalk.test.ts` pins it:
    // *"THE INK CROSSES ONTO THE NEXT SYSTEM — one RIBBON, so a break is not an event"*, from his
    // 2026-08-20 *"no anchor to a note but offset in the next system"*. A per-line wrap could only
    // ever count ONE hop, which is the bug he reported as *"it never was re-anchored to the note 3
    // systems below"*. ⭐ The DRAG wraps ({@link dragTrillEndpoint}) because what it needs from the
    // crossing is not the re-anchor — the ribbon already gives it that — but the END OF THE GESTURE,
    // the hand being left behind on the old line. A key press has no hand to leave behind.
    label,
    runBatch: (description, fn) => engine.runBatch(description, fn),
    inkGuard: (_crossing, dx) => {
      if (inkStaysOnTheRibbon(engine, id, port, dx)) return true
      dbg(`[${port.label}] refused — past the last line the render drew`)
      return false
    },
    maxCrossings: 1,
    handOverWhenBlocked: false,
  }
}
