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
  ottavaEdgeX, ottavaStaffSpacePx, ottavaStartAddress, ottavaSystemInkLimit,
} from './ottavaLane'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'
import { breakCrossing, leaveSystem, type BreakWrapPort } from './markBreakWrap'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type OttavaWalkEngine = Pick<MusicEngine,
  'getOttavaById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextOttavaStartSlot' | 'nextOttavaEndSlot' | 'ottavaEndSlot'
  | 'moveOttavaStartToSlot' | 'moveOttavaEndToSlot'
  | 'nudgeOttavaEndpoint' | 'rebaseOttavaEndpointOffset'>

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
  const port = portFor(engine, id, which)

  const wrap = wrapPort(engine, id, which)
  const across = breakCrossing(port, wrap, dx)
  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  if (!across?.arrived && !markWalkCrosses(port, dx)) return inkPress(port, dx)

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
function portFor(engine: OttavaWalkEngine, id: string, which: 'start' | 'end'): MarkWalkPort {
  return which === 'start' ? startPort(engine, id) : endPort(engine, id)
}

/** ⭐ **THE BEGINNING'S PORT** — its stops are the lane's onsets, and it takes one as the bracket's
 *  own beginning, holding the far end. */
function startPort(engine: OttavaWalkEngine, id: string): MarkWalkPort {
  return port(engine, id, 'start', {
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
    reanchor: (stop) => engine.moveOttavaStartToSlot(id, stop as OttavaSlotTarget),
  })
}

/** ⭐ **THE END'S PORT** — its stops are the slots the hook can close around, read from the model so
 *  that the address the walk measures to is the one the renderer draws at. */
function endPort(engine: OttavaWalkEngine, id: string): MarkWalkPort {
  return port(engine, id, 'end', {
    label: 'Ottava end',
    nextStop: (direction) => engine.nextOttavaEndSlot(id, direction),
    stopX: (stop) => edgeX(engine, id, stop as OttavaSlotTarget, 'end'),
    // ⭐⭐ The LAST COVERED slot, ⛔ never the span's exclusive end — see the header.
    anchorX: () => {
      const here = engine.ottavaEndSlot(id)
      return here ? edgeX(engine, id, here, 'end') : null
    },
    reanchor: (stop) => engine.moveOttavaEndToSlot(id, stop as OttavaSlotTarget),
  })
}

/** What the two ends answer alike — the scale, that end's own stored nudge, and the two ink writes. */
function port(
  engine: OttavaWalkEngine,
  id: string,
  which: 'start' | 'end',
  ends: Pick<MarkWalkPort, 'label' | 'nextStop' | 'stopX' | 'anchorX' | 'reanchor'>,
): MarkWalkPort {
  return {
    ...ends,
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN bracket's staff,
    // which may be a SMALL one.
    staffSpacePx: () => ottavaStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () =>
      ottavaOffsetOverrideOf(engine.getScore(), id)?.[which === 'start' ? 'startX' : 'endX'] ?? 0,
    // ⛔ **The second argument is 0, ⚠️ NEVER the walk's `dy`.** `nudgeOttavaEndpoint` speaks
    // OUTWARD-from-the-staff, where the walk's `dy` is screen-down — and it lands on the WHOLE
    // bracket, both ends at once. Nothing on this road has a vertical to write.
    nudge: (dx) => engine.nudgeOttavaEndpoint(id, which, dx, 0),
    // ⭐ The crossing's second half — see {@link MarkWalkPort.rebase}: bookkeeping, ⛔ never judged by
    // the page limit, or a refused re-base leaves the anchor ahead of the ink and the next press
    // crosses again.
    rebase: (dx) => engine.rebaseOttavaEndpointOffset(id, which, dx),
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
