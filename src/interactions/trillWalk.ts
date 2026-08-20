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
import {
  applyTrillAnchorStop, nextTrillAnchorStop, trillAnchorPosition, type TrillAnchorEngine,
  type TrillAnchorStop,
} from './trillReanchor'
import {
  trillInkY, trillLane, trillLaneIndexAt, trillRibbonLimits, trillRibbonX, trillSquareBaseX,
  trillSquareMeasure, trillStaffBand, trillStaffSpacePx, trillSystemNoteFor,
} from './trillLane'
import type { FlatNote } from '../utils/beatMap'
import { staffOf } from '../utils/lanes'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TrillWalkEngine = TrillAnchorEngine & Pick<MusicEngine,
  'setTrillAnchor' | 'nudgeTrillEndpoint' | 'rebaseTrillEndpointOffset' | 'runBatch'
  | 'previewTrillAnchor' | 'previewTrillEndpointOffset' | 'previewTrillEndpointRebase'
  | 'previewTrillPlacement' | 'previewTrillMove' | 'resetTrillOffset'
  | 'moveTrill' | 'nudgeTrill' | 'rebaseTrillOffset'>

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
  if (next < limit.min) return dx > 0
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
  return span > 0 ? lane[Math.min(at(target) + span, lane.length - 1)]?.id : undefined
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
function bodyPort(engine: TrillWalkEngine, id: string): MarkWalkPort {
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
    reanchor: (stop) => {
      const target = (stop as TrillAnchorStop).note.id
      return engine.moveTrill(id, target, extentFrom(engine, id, target))
    },
    nudge: (dx, dy) => engine.nudgeTrill(id, dx, dy),
    rebase: (dx) => engine.rebaseTrillOffset(id, dx),
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
  const port = bodyPort(engine, id)
  if (!markWalkCrosses(port, dx)) return inkPress(engine, id, port, dx)

  let moved = false
  engine.runBatch('Move trill', () => { moved = carryMark(port, dx, 0, false, 1).moved })
  return moved
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
 * ⭐⭐ **LEAVING ITS OWN SYSTEM** — the one move the walk cannot make (`./markSystemJump`, shared with
 * the dynamic, the tempo mark and the wedge).
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
function jumpTrillSystems(
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
    dbg(`[Trill] no rung down there — ${whyNoJump(engine, start, inkY + dyPx)}`)
    return false
  }

  if (!engine.previewTrillMove(id, target, extentFrom(engine, id, target))) return false

  engine.previewTrillPlacement(id, dyPx > 0 ? 'above' : 'below')
  engine.resetTrillOffset(id)
  dbg(`[Trill] jumped to the staff it now belongs to | id:${id} → ${target.slice(0, 8)}`)
  return true
}

/**
 * Why {@link jumpTrillSystems} found nowhere to go — for the log, and ⛔ never for a decision.
 *
 * ⭐ *"There is no note over there"* is not a failure: the ornament still travels, as INK, exactly as
 * it does horizontally (his rule, 2026-08-20: *"no anchor to a note but offset in the next
 * system"*). What it cannot do is BELONG to a system that holds nothing it could hang off.
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
  const landable = trillLane(engine, start)
    .filter(n => !n.isRest)
    .some(n => {
      const y = yOf(n.id)
      return y !== null && y >= there.top - PAD_PX && y <= there.bottom + PAD_PX
    })
  return landable
    ? 'the ink still belongs to the staff it is on'
    : `no note of this lane is drawn on the staff at y ${there.top.toFixed(0)}`
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

  // ⭐⭐ ITS OWN STAFF FIRST — see {@link flipTrillPlacement}. An ornament dragged across its staff
  // belongs on the other side of it long before it belongs to the staff beyond.
  if (flipTrillPlacement(engine, id, dyPx)) return { moved: true, jumped: true, droppedPx: 0 }
  if (jumpTrillSystems(engine, id, cursorX, dyPx)) return { moved: true, jumped: true, droppedPx: 0 }
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

export function walkArmedTrillEndpoint(
  state: EditorState,
  engine: TrillWalkEngine,
  dx: number,
): boolean {
  const selected = selectedOf(state, 'trill')
  const which = selected?.endpoint
  if (!selected || !which || dx === 0) return false

  const port = trillPort(engine, selected.id, which, keyWrites(engine, selected.id, which))
  // ⛔ The BARE `tr` does not walk — see the header. Its end square has no line to carry.
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
