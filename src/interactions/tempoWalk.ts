/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A TEMPO MARK** — ←/→ and Ctrl+←/→ move a selected tempo mark's
 * INK, and once that ink reaches the next onset the ANCHOR goes with it (his ask, 2026-08-19).
 *
 * The arithmetic is `./markWalk`'s, shared with the dynamic's; this file is the PORT — where a tempo
 * mark's stops are and which model ops move it. What differs from the dynamic is only what the two
 * marks are attached to:
 *
 * ⭐⭐ **A tempo mark has no lane**: its stops are every ONSET in the score, whatever staff or voice
 * sounds it (`engine/models/tempoOps`), because what it governs is the clock. The dynamic walks one
 * voice on one staff.
 *
 * ⚠️ **The gap is measured NOTE to NOTE, and a downbeat anchor is not always a note.** Gould p. 183
 * puts a downbeat mark on the bar's TIME SIGNATURE when it prints one (`rendering/TempoLayout`), so
 * crossing onto such a stop re-bases by the note delta while the drawn base moves by the
 * timesig-to-first-note distance — the crossing is then visible by that much, on opening bars and
 * meter changes only. ⛔ The exact re-base needs the new anchor's base, which only exists after a
 * layout; `./slurEndpointWalk` hit the same wall and took the same approximation, as MuseScore's
 * lines do (`line.cpp:750-754`). ⏭️ The honest fix is to register each measure's tempo-anchor x.
 *
 * ⛔ **The vertical is not in here** — ↑/↓ stay a pure offset. ⚠️ And note that this mark's `y` is
 * OUTWARD (+up), unlike every sibling ({@link TempoOffsetOverride}); nothing in the walk touches it.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Stop } from '../engine/models/tempoOps'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCompare } from '../utils/fraction'
import { carryMark, crossWithoutArrival, markWalkCrosses, type MarkWalkPort } from './markWalk'
import { breakCrossing, lastMeasureNumber, leaveSystem, systemInkAt, type BreakWrapPort } from './markBreakWrap'
import { systemStopFor } from './markSystemJump'
import { dbg, debugEnabled } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TempoWalkEngine = Pick<MusicEngine,
  'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextTempoSlot' | 'moveTempoToSlotKeepingOffset' | 'nudgeTempoOffset'
  | 'rebaseTempoOffset' | 'previewTempoOffsetRebase'
  | 'previewTempoSlotKeepingOffset' | 'previewTempoOffset' | 'previewTempoSlot'>

/** Where the mark is anchored now — its address, read from the list it is stored in (the measure is
 *  half of it, exactly as a dynamic's is). Null when the id is no longer in the score. */
function tempoAddress(engine: TempoWalkEngine, id: string): Stop | null {
  for (const measure of engine.getScore().measures ?? []) {
    const mark = measure.tempos?.find(t => t.id === id)
    if (mark) return { measure: measure.number, beat: mark.beat }
  }
  return null
}

/**
 * Every onset the last render DREW, once each, at the centre of its ink.
 *
 * ⭐ **The TOP staff's element wins**, because that is the staff the mark is engraved above and the
 * one `TempoLayout.anchorX` measures against. A stop that exists only lower down (a left-hand attack
 * under a right-hand rest) still answers, with that staff's point — the two staves share a column,
 * so the x is the same to within the column's own spread.
 */
function drawnOnsets(engine: TempoWalkEngine): Array<{ x: number; y: number; stop: Stop }> {
  const registry = engine.getElementRegistry()
  const out: Array<{ x: number; y: number; stop: Stop; staff: number }> = []
  for (const el of [...registry.getByType('note'), ...registry.getByType('rest')]) {
    if (!el.id) continue
    const note = engine.getNote(el.id)
    if (!note) continue
    const staff = el.staff ?? 0
    const found = out.find(o => o.stop.measure === note.measure && fracCompare(o.stop.beat, note.beat) === 0)
    if (found && found.staff <= staff) continue
    const point = {
      x: el.bbox.x + el.bbox.width / 2,
      y: el.bbox.y + el.bbox.height / 2,
      stop: { measure: note.measure, beat: note.beat },
      staff,
    }
    if (found) Object.assign(found, point)
    else out.push(point)
  }
  return out
}

/** Where one onset was drawn, or null when the last render drew none there. */
function onsetPoint(engine: TempoWalkEngine, stop: Stop): { x: number; y: number } | null {
  return drawnOnsets(engine).find(o =>
    o.stop.measure === stop.measure && fracCompare(o.stop.beat, stop.beat) === 0) ?? null
}

/** The vertical centre of the mark's own ink in the last render, or null if it drew none. */
function markInkY(engine: TempoWalkEngine, id: string): number | null {
  const el = engine.getElementRegistry().getByType('tempo').find(e => e.id === id)
  return el ? el.bbox.y + el.bbox.height / 2 : null
}

/** Pixels per staff-space at the drawn mark. ⛔ Never a constant — `./markWalk`'s no-guessing rule. */
function staffSpacePxOf(engine: TempoWalkEngine, id: string): number | null {
  return engine.getElementRegistry().getByType('tempo').find(el => el.id === id)?.staffSpacePx ?? null
}

/**
 * ⭐ **THE DRAG'S OWN TRACE — one line per frame, and every coordinate the frame reasoned with**
 * (his ask, 2026-08-22: *"add more logs so we can see mouse coordinates and other important
 * coordinates"*, after a drag that stuck at the onsets instead of sliding between them).
 *
 * ⚠️ **Guarded by {@link debugEnabled}, not merely written with `dbg`.** A suppressed `dbg` still
 * EVALUATES its arguments (docs/logging.md), and every reader below walks the registry —
 * {@link drawnOnsets} rebuilds its whole list from every drawn note and rest. This runs on every
 * mousemove of a held drag, which is exactly the hot path that caveat is about.
 *
 * ⭐ It reads the same four things the walk itself decides on, so a stuck frame can be read off the
 * log without a breakpoint: where the ANCHOR is (the model), where the INK is (the picture), what
 * the stored OFFSET is (the two of them subtracted), and where the next STOP is with the gap to it.
 * A frame that crosses and latches in the same breath prints both, before and after.
 */
interface DragTrace {
  addr: Stop | null
  anchorX: number | null
  inkX: number | null
  offX: number
  offY: number
}

/** The mark's drawn ink box in the LAST RENDER — the picture's own answer to *"where is it now?"*. */
function markInkBox(engine: TempoWalkEngine, id: string): { x: number; y: number; width: number } | null {
  const el = engine.getElementRegistry().getByType('tempo').find(e => e.id === id)
  return el ? { x: el.bbox.x, y: el.bbox.y, width: el.bbox.width } : null
}

/** Everything about the mark that a frame can change, read fresh. */
function traceOf(engine: TempoWalkEngine, id: string): DragTrace {
  const addr = tempoAddress(engine, id)
  const offset = tempoOffsetOverrideOf(engine.getScore(), id)
  return {
    addr,
    anchorX: addr ? onsetPoint(engine, addr)?.x ?? null : null,
    inkX: markInkBox(engine, id)?.x ?? null,
    offX: offset?.x ?? 0,
    offY: offset?.y ?? 0,
  }
}

const px1 = (value: number | null): string => (value === null ? '—' : value.toFixed(1))
const stopName = (stop: Stop | null): string =>
  stop ? `m${stop.measure}b${stop.beat.num}/${stop.beat.den}` : '—'

/** The frame's line: the hand's ask, the two positions, the offset, and the road ahead. */
function logDragFrame(
  engine: TempoWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
  staffSpacePx: number,
  before: DragTrace,
  outcome: string,
): void {
  const after = traceOf(engine, id)
  const direction: 1 | -1 = dxPx >= 0 ? 1 : -1
  const next = engine.nextTempoSlot(id, direction)
  const nextX = next ? onsetPoint(engine, next)?.x ?? null : null
  // ⚠️ Measured from the anchor AFTER the frame — the same subtraction `markWalk.arrivedAt` makes,
  //    so a gap whose sign disagrees with the travel is the walk's own refusal, visible here as a
  //    NEGATIVE gap on a rightward drag (the next stop in TIME is on the next system).
  const gap = nextX !== null && after.anchorX !== null ? (nextX - after.anchorX) / staffSpacePx : null
  dbg(`[TempoDrag] cursor x=${px1(cursorX)} d=(${dxPx.toFixed(1)}, ${dyPx.toFixed(1)})px`
    + ` = (${(dxPx / staffSpacePx).toFixed(3)}, ${(-dyPx / staffSpacePx).toFixed(3)})ss`
    + ` @ ${staffSpacePx.toFixed(2)}px/ss`
    + ` | anchor ${stopName(before.addr)}@${px1(before.anchorX)} → ${stopName(after.addr)}@${px1(after.anchorX)}`
    + ` | ink x ${px1(before.inkX)} → ${px1(after.inkX)}`
    + ` | offset (${before.offX.toFixed(3)}, ${before.offY.toFixed(3)})`
    + ` → (${after.offX.toFixed(3)}, ${after.offY.toFixed(3)})ss`
    + ` | next ${stopName(next)}@${px1(nextX)} gap ${gap === null ? '—' : gap.toFixed(2)}ss`
    + ` | ${outcome}`)
}

/** The port: everything `./markWalk` needs of this mark, and the whole of what is tempo-specific. */
function tempoPort(
  engine: TempoWalkEngine,
  id: string,
  write: {
    reanchor: (id: string, target: Stop) => boolean
    nudge: (id: string, dx: number, dy: number) => boolean
    /** ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged
     *  by the page limit (2026-08-21, with the cross-system wrap). ⚠️ `dx` only: this mark's `y` is
     *  OUTWARD and no walk touches it. */
    rebase: (id: string, dx: number) => boolean
  },
): MarkWalkPort {
  return {
    label: 'Tempo',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the same key landing the mark on a different onset depending on how far you had
    // nudged. ⚠️ It does not skip an onset another mark sits on — the model refuses the write, and
    // the walk then stops there, which is the same answer as the end of the score.
    nextStop: (direction) => engine.nextTempoSlot(id, direction),
    stopX: (stop) => onsetPoint(engine, stop as Stop)?.x ?? null,
    anchorX: () => {
      const here = tempoAddress(engine, id)
      return here ? onsetPoint(engine, here)?.x ?? null : null
    },
    staffSpacePx: () => staffSpacePxOf(engine, id),
    offsetX: () => tempoOffsetOverrideOf(engine.getScore(), id)?.x ?? 0,
    reanchor: (stop) => write.reanchor(id, stop as Stop),
    nudge: (dx, dy) => write.nudge(id, dx, dy),
    rebase: (dx) => write.rebase(id, dx),
  }
}

/**
 * ⭐ **THE MARK'S ANSWERS TO {@link BreakWrapPort}** — where THIS mark's system runs out, and where a
 * candidate stop's system begins (his ask, 2026-08-21: *"and the tempo cross system"*).
 *
 * ⭐⭐ **STAFF 0, and that is this mark's whole difference from its siblings**: a tempo mark has no
 * staff of its own — it is engraved above the TOP one, which is also the staff
 * {@link drawnOnsets} prefers and the one `TempoLayout.anchorX` measures against. ⛔ Not the staff
 * the sounding note happens to be on.
 */
function wrapPort(engine: TempoWalkEngine, id: string): BreakWrapPort {
  const limitOf = (at: Stop | null) =>
    at ? systemInkAt(engine.getElementRegistry(), 0, at.measure, lastMeasureNumber(engine.getScore())) : null
  return {
    here: () => limitOf(tempoAddress(engine, id)),
    there: (stop) => limitOf(stop as Stop),
    address: (stop) => stop,
  }
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON A SELECTED TEMPO MARK** — nudge the ink by `dx` staff-spaces
 * (¼ space plain, 1 space with Ctrl), and hand the anchor along if the ink has arrived at the next
 * onset.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the mark somewhere the user never put it.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such mark, or the page limit refused the ink.
 */
export function walkTempo(engine: TempoWalkEngine, id: string, dx: number): boolean {
  if (dx === 0) return false
  const port = tempoPort(engine, id, {
    reanchor: (i, target) => engine.moveTempoToSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.nudgeTempoOffset(i, ddx, ddy),
    rebase: (i, ddx) => engine.rebaseTempoOffset(i, ddx),
  })

  const wrap = wrapPort(engine, id)
  const across = breakCrossing(port, wrap, dx)
  // ⛔ No batch when nothing crosses: `runBatch` costs a snapshot per press, and the ordinary nudge
  // records its own single entry.
  if (!across?.arrived && !markWalkCrosses(port, dx)) {
    if (port.nudge(dx, 0)) return true
    // 🚨 **A BLOCKED PRESS STILL CROSSES** — see `./markWalk.crossWithoutArrival`: the page's edge
    // can refuse the ink a space short of the line's end, and the wrap's arrival test can then never
    // be met.
    let handed = false
    engine.runBatch('Move tempo mark', () => {
      handed = across
        ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
        : crossWithoutArrival(port, dx)
    })
    return handed
  }

  let moved = false
  engine.runBatch('Move tempo mark', () => {
    moved = across?.arrived
      // ⭐ THE KEYS re-base by the FOLDED distance — `./markBreakWrap`.
      ? leaveSystem(port, wrap, across.stop, (before) => before + dx - across.gap)
      : carryMark(port, dx).moved
  })
  return moved
}

/**
 * ⭐⭐ **ONE FRAME OF A TEMPO MARK DRAG** — the same move with the cursor's delta in PIXELS, no undo
 * entry (the drop commits once, {@link MusicEngine.commitTempoDrag}), and two things the keyboard
 * does not have.
 *
 * ⭐⭐ **THE LATCH** (his call, 2026-08-19: *"tempo should be more precise with the anchor point
 * alignment, so the snap is a better UX"*). The ink stops dead at offset zero of the stop it is
 * nearest in the direction of travel, so Gould's own alignment — the time signature, or the first
 * notational element — is reachable EXACTLY rather than by luck. ⭐ It is the half of the slur's
 * snap-and-go that costs nothing (`./markWalk`); the other half, motor space repaid at a gain, is
 * deliberately left out: a tempo's stops are onsets, often far apart, and the slur's three tuned
 * numbers were found against note spacing rather than that.
 *
 * ⭐ And the latch repairs the one approximation in this walk: `offset zero` is a fact about the
 * MODEL, so latching lands the mark on its true anchor even where the note-to-note gap
 * over-or-under-states the distance (a downbeat mark's anchor being the time signature).
 *
 * ⭐⭐ **BOTH AXES**: the horizontal walks the mark through the music, `dy` is a plain ink offset.
 * ⚠️ Converted here, because this mark's stored `y` is OUTWARD (+up) while a cursor's is screen-down.
 * ⭐ The lift SURVIVES a crossing, as it does on the keys — a tempo's lift answers the ladder's ROW,
 * not one note's stem (⛔ unlike the slur endpoint's drag, which settles its y).
 *
 * ⛔ Declines — **null**, not `false` — when the mark is not drawn, so there is no staff-space size to
 * convert the cursor's pixels with.
 */
export function dragTempo(
  engine: TempoWalkEngine,
  id: string,
  cursorX: number,
  dxPx: number,
  dyPx: number,
): boolean | null {
  const ss = staffSpacePxOf(engine, id)
  if (!ss) {
    // ⛔ The decline is the one frame worth a line of its own: the caller cannot tell it from a
    //    refusal, and it means the LAST RENDER drew no tempo box — not that the hand did nothing.
    dbg(`[TempoDrag] declined — no drawn tempo box to measure a staff-space with | id:${id}`)
    return null
  }

  // ⭐ Read BEFORE anything is written; the line is printed after, so one entry carries both states.
  const before = debugEnabled() ? traceOf(engine, id) : null

  if (jumpSystems(engine, id, cursorX, dyPx, ss)) {
    if (before) logDragFrame(engine, id, cursorX, dxPx, dyPx, ss, before, 'SYSTEM JUMP (the walk did not run)')
    return true
  }

  const port = tempoPort(engine, id, {
    reanchor: (i, target) => engine.previewTempoSlotKeepingOffset(i, target),
    nudge: (i, ddx, ddy) => engine.previewTempoOffset(i, ddx, ddy),
    rebase: (i, ddx) => engine.previewTempoOffsetRebase(i, ddx),
  })
  // ⚠️ `dyPx` is screen-down and the model is OUTWARD, so the sign flips exactly here.
  const walked = carryMark(port, dxPx / ss, -dyPx / ss, true)
  if (before) {
    logDragFrame(engine, id, cursorX, dxPx, dyPx, ss, before,
      `crossings=${walked.crossings}`
      + (walked.latched ? ` LATCHED (dropped ${walked.dropped.toFixed(3)}ss, unrepaid)` : '')
      + ` moved=${walked.moved}`)
  }
  return walked.moved
}

/**
 * ⭐⭐ **LEAVING THE MARK'S OWN SYSTEM** — the half of a drag the walk cannot do, `dynamicLane`'s
 * twin through the shared rule (`./markSystemJump`): the mark belongs to whichever system it would
 * look at home on, so the switch falls halfway between where it sits and where it would sit.
 *
 * ⭐⭐ A jump lands the mark where the ENGRAVER would put it — the offset goes, both axes. The `x`
 * goes because every re-anchor drops it; the `y` because on this gesture it is not a lift at all but
 * the distance the hand travelled to reach the other staff.
 *
 * ⛔ And the frame stops there: the walk does not also run, or this frame's `dx` would be spent
 * against a stop the hand was never near.
 */
function jumpSystems(
  engine: TempoWalkEngine,
  id: string,
  cursorX: number,
  dyPx: number,
  staffSpacePx: number,
): boolean {
  const inkY = markInkY(engine, id)
  const here = tempoAddress(engine, id)
  if (inkY === null || !here) return false
  const onsets = drawnOnsets(engine)

  const target = systemStopFor<Stop>({
    bands: () => engine.getElementRegistry().staffBands(),
    candidates: () => onsets,
    anchor: () => onsetPoint(engine, here),
    inkY: () => inkY,
    // ⚠️ OUTWARD → screen: this mark's stored `y` is +up, and the rule reasons in screen pixels.
    liftPx: () => -(tempoOffsetOverrideOf(engine.getScore(), id)?.y ?? 0) * staffSpacePx,
    // A tempo mark is always engraved ABOVE the staff — it has no `placement` to ask.
    above: () => true,
  }, cursorX, inkY + dyPx)
  if (!target || !engine.previewTempoSlot(id, target)) return false

  const lift = tempoOffsetOverrideOf(engine.getScore(), id)?.y ?? 0
  if (lift !== 0) engine.previewTempoOffset(id, 0, -lift)
  dbg(`[Tempo] jumped to the system it now belongs to | id:${id} → m${target.measure}`)
  return true
}
