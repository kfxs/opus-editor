/**
 * ⭐⭐ **THE INTERPOLATING WALK, FOR A HAIRPIN'S TWO SQUARES** — ←/→ and `Ctrl`+←/→ move the armed
 * end's INK, and once that ink reaches the next boundary of the lane the WEDGE ITSELF goes with it
 * (his ask, 2026-08-20: the left square first, then *"we are using reanchor also for the duration
 * endpoint, and offset, that means that the duration endpoint should walk too"*).
 *
 * The arithmetic is `./markWalk`'s, shared with the dynamic's and the tempo mark's; this file is the
 * PORT — twice, one per end. What is hairpin-specific is three things, and all three matter:
 *
 * ⭐⭐ **THE STOPS ARE BOUNDARIES, NOT NOTEHEADS.** A wedge's tips are drawn at a note's LEFT EDGE
 * (`HairpinRenderer.spanX`), so the gaps this walk crosses are edge-to-edge — ⛔ not the head-to-head
 * distances `./dynamicWalk` uses, which would put a crossing half a notehead early. The list is
 * `./hairpinLane`'s, shared with the squares' DRAG so all three routes measure one geometry.
 *
 * ⭐⭐ **A CROSSING HOLDS THE OTHER END STILL** — and that is what makes these two ends one gesture
 * rather than a wedge that slides. The start writes `beat` and `length` together
 * (`setHairpinStartAtSlot`), the end writes `length` alone; either way the far tip does not move,
 * which is what both squares already mean under `Ctrl+Shift+←/→` and under the mouse. ⚠️ So a
 * walking press is AUDIBLE at the moment it crosses — it changes which notes get louder. Every press
 * either side of it is ink and changes nothing.
 *
 * ⭐ **The crossing KEEPS both ends' nudges by construction** — the model ops touch no override at
 * all, so unlike the dynamic there is no `…KeepingOffset` twin to reach for. What the walk then does
 * with the armed end's own offset is the family's identity: it takes the gap back out, so the tip
 * does not jump.
 *
 * ⛔ **The vertical is not in here.** ↑/↓ stay a pure offset — a `y` on one end TILTS the wedge, and
 * there is no anchor above or below to arrive at.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { HairpinEndStop, HairpinSlotTarget } from '../engine/models/hairpinOps'
import { hairpinEndpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import {
  hairpinBoundaryX, hairpinEndAddress, hairpinInkX, hairpinStartAddress, hairpinSystemInkLimit,
  hairpinTipX,
} from './hairpinLane'
import { hairpinStaffSpacePx } from './elements/hairpinHandles'
import { carryMark, markWalkCrosses, type MarkStop, type MarkWalkPort } from './markWalk'
import { dbg } from '../utils/debug'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type HairpinWalkEngine = Pick<MusicEngine,
  'getHairpinById' | 'getScore' | 'getElementRegistry' | 'getNote' | 'runBatch'
  | 'nextHairpinStartSlot' | 'moveHairpinStartToSlot'
  | 'nextHairpinEndStop' | 'moveHairpinEndToStop'
  | 'nudgeHairpinEndpoint'>

/** What the two ends answer alike — the scale, that end's own stored nudge, and the ink write —
 *  wrapped around the half that differs. ⛔ Not a base class and not a `which` switch inside the
 *  members: each end states its own four answers, and reads this for the three it shares. */
function port(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  ends: Pick<MarkWalkPort, 'label' | 'nextStop' | 'stopX' | 'anchorX' | 'reanchor'>,
): MarkWalkPort {
  return {
    ...ends,
    // ⛔ No fallback constant — `./markWalk`'s no-guessing rule. Read off the DRAWN wedge's staff,
    // which may be a SMALL one.
    staffSpacePx: () => hairpinStaffSpacePx(engine.getElementRegistry(), id),
    offsetX: () => hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.[which]?.x ?? 0,
    nudge: (dx, dy) => engine.nudgeHairpinEndpoint(id, which, dx, dy),
  }
}

/**
 * ⭐ **THE LEFT SQUARE'S PORT** — its stops are the lane's onsets, and it takes one as the wedge's
 * own beginning.
 */
function startPort(engine: HairpinWalkEngine, id: string): MarkWalkPort {
  return port(engine, id, 'start', {
    label: 'Hairpin start',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives in the model: two rules
    // would mean the two keys landing the start on different notes depending on how far it had been
    // nudged.
    nextStop: (direction) => engine.nextHairpinStartSlot(id, direction),
    stopX: (stop) => boundaryX(engine, id, stop as HairpinSlotTarget),
    anchorX: () => {
      const here = hairpinStartAddress(engine.getScore(), id)
      return here ? boundaryX(engine, id, here) : null
    },
    reanchor: (stop) => engine.moveHairpinStartToSlot(id, stop as HairpinSlotTarget),
  })
}

/**
 * ⭐ **THE RIGHT SQUARE'S PORT** — the DURATION end, his name for it. Its stops are the same
 * boundaries read the other way: the tip stands BEFORE the first note it does not cover, plus the
 * one position past the last note where it covers everything ({@link HairpinDragWrite}, the drag's
 * own vocabulary — which is why a stop here is a write rather than an address).
 */
function endPort(engine: HairpinWalkEngine, id: string): MarkWalkPort {
  return port(engine, id, 'end', {
    label: 'Hairpin end',
    // ⭐ `resizeHairpinBySlot`'s own candidate, split out of it for exactly this — see
    // `hairpinOps.nextHairpinEndStop`.
    nextStop: (direction) => engine.nextHairpinEndStop(id, direction),
    // ⭐⭐ WHERE THE TIP WOULD BE DRAWN, ⛔ not where the note it names is: a stop that leaves the
    // wedge ending on a BARLINE draws the tip at the end of the PREVIOUS line
    // (`hairpinOps.addressOfAbs`, and his report that made it a rule). The model answers with that
    // address; this only has to resolve it to a pixel, exactly as `anchorX` does for today's tip.
    stopX: (stop) => tipX(engine, id, (stop as HairpinEndStop).endsAt),
    anchorX: () => {
      const here = hairpinEndAddress(engine.getScore(), id)
      return here ? tipX(engine, id, here) : null
    },
    reanchor: (stop) => engine.moveHairpinEndToStop(id, (stop as HairpinEndStop).write),
  })
}

/** One lane onset's drawn left edge, for a wedge that may have gone. */
function boundaryX(engine: HairpinWalkEngine, id: string, target: HairpinSlotTarget): number | null {
  const hairpin = engine.getHairpinById(id)
  return hairpin ? hairpinBoundaryX(engine, hairpin, target) : null
}

/** Where a TIP standing at `at` is drawn — an onset's left edge, or the bar's own end when the wedge
 *  finishes on a barline. See {@link hairpinTipX}. */
function tipX(engine: HairpinWalkEngine, id: string, at: HairpinSlotTarget): number | null {
  const hairpin = engine.getHairpinById(id)
  return hairpin ? hairpinTipX(engine, hairpin, at) : null
}

/**
 * 🚨🚨 **CROSSING A SYSTEM BREAK — the ink wraps AT THE BARLINE, and what was leaning into the margin
 * is redrawn at the START of the next system.** His rule, 2026-08-20: *"after the barline, all the
 * distance we are drawing in the old system should be drawing in the beginning of the next
 * system"* — and each earlier attempt is in here because each one moved it:
 *
 *  1. *"is not anchoring to the next measure cause is in another system"* — the walk refused to cross
 *     at all: two systems' x's are not one ruler (`./markWalk`, permanently and rightly);
 *  2. *"i jump til the end… is not symmetrical, i should offset also while going right"* — a trigger
 *     of *"has the ink passed the last barline"* fired on the FIRST press, because a tip parked at
 *     the end of its line is already at the edge. One press ate a whole system;
 *  3. *"it is never reaching the next system"* — that press was spent on a stop which leaves the
 *     wedge ending ON THE BARLINE, drawn at the end of the line it was already on. Fixed in the
 *     model (`hairpinOps.addressOfAbs`): a stop is priced where the TIP lands, never at the note it
 *     names, and filling the bar to its barline is now a step of its own;
 *  4. *"look how much is drawing wrong before jumping"* — making the ink pay the whole folded
 *     distance first dragged the wedge eleven spaces into the right margin.
 *
 * ⭐⭐ **So: ARRIVAL at the line's edge, RE-BASE by the folded distance.** The two halves answer
 * different questions and the earlier cuts each used one number for both:
 *
 * ```
 *   arrives when   offset + step  passes  (this line's end − the tip)
 *   re-bases by    gap = (this line's end − the tip) + (the stop − that line's start)
 * ```
 *
 * The press that leaves the line therefore lands the tip **just past the start of the next system**,
 * by exactly the ink that would have hung in the margin — his rule, and the identity
 * `offset += step − gap` unchanged. Every further press walks it on toward the stop, where the
 * offset reaches zero and the ordinary walk takes over again. ⭐ It is symmetric by construction:
 * backwards, the edge is the line's START and the far side is the previous line's END.
 *
 * ⛔ Only when the stop is on ANOTHER system — asked of the systems themselves, never of the two x's
 * — and ⛔ never onto a bar the last render drew nothing for.
 *
 * @returns the stop to wrap onto with the folded gap to re-base by, and whether this press arrives;
 *   null when the question does not arise (the press is then ordinary ink, or the walk's own).
 */
function crossingTheBreak(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  port: MarkWalkPort,
  dx: number,
): { stop: MarkStop; gap: number; arrived: boolean } | null {
  const direction = dx > 0 ? 1 : -1
  const stop = port.nextStop(direction)
  if (stop === null) return why('no next stop — the end of the lane')

  const anchor = port.anchorX()
  const staffSpacePx = port.staffSpacePx()
  const stopX = port.stopX(stop)
  if (anchor === null || stopX === null || !staffSpacePx) {
    return why(`unmeasurable | anchor ${anchor} stopX ${stopX} ss ${staffSpacePx} stop ${JSON.stringify(stopAddress(stop))}`)
  }

  const here = systemInkLimit(engine, id, which)
  const hairpin = engine.getHairpinById(id)
  const there = hairpin && hairpinSystemInkLimit(engine, hairpin, stopAddress(stop))
  if (!here || !there) {
    return why(`no system geometry | here ${JSON.stringify(here)} there ${JSON.stringify(there)} stop ${JSON.stringify(stopAddress(stop))}`)
  }
  // ⭐⭐ SAME LINE ⇒ an ordinary press, and `carryMark` owns it. ⛔ Asked of the SYSTEMS, not of the
  // two x's: a later line's x may be larger, smaller or equal to this one's, so "is the stop drawn
  // ahead of me" is a question the numbers cannot answer across a break.
  if (here.top === there.top) return null

  // Where this line runs out, from the tip — and where the tip re-appears over there.
  const toEdge = ((direction === 1 ? here.max : here.min) - anchor) / staffSpacePx
  const gap = toEdge + (stopX - (direction === 1 ? there.min : there.max)) / staffSpacePx
  const target = port.offsetX() + dx
  return { stop, gap, arrived: direction === 1 ? target > toEdge : target < toEdge }
}

/** ⭐ The break crossing declines through five different reads, and a press that simply does nothing
 *  cannot tell them apart in a real score — which cost an afternoon of round trips on 2026-08-20.
 *  Kept, like the rest of this editor's `dbg` lines. */
function why(reason: string): null {
  dbg(`[Hairpin] no break crossing — ${reason}`)
  return null
}

/** Every stop of this family names an address, whichever end asked for it — a lane slot for the
 *  start, a {@link HairpinDragWrite} for the tip. Both carry the (measure, beat) the walk needs to
 *  ask which SYSTEM it was drawn on. */
function stopAddress(stop: MarkStop): HairpinSlotTarget {
  const named = stop as HairpinSlotTarget & Partial<HairpinEndStop>
  return named.endsAt ?? named
}

/**
 * 🚨 **HOW FAR THE INK MAY GO WHEN THERE IS NOWHERE TO GO** — the same edge read by
 * {@link stopAcrossTheBreak}, used the other way: at the very end of the lane (or where the last
 * render drew no next stop to jump to) the arrow would otherwise push the drawing off the staff with
 * the music standing still, which is the second half of his 2026-08-20 report.
 *
 * ⭐ It REFUSES the write; ⛔ it never clamps the drawing — `MusicEngine.nudgeStaysOnPage`'s rule,
 * including its escape hatch: ink already outside (a re-flow moved the line under it) may always be
 * nudged BACK, or the mark would be stranded. ⛔ And it allows freely when the wedge or its staff was
 * not drawn — no picture, no limit.
 */
function inkStaysOnSystem(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
): boolean {
  const staffSpacePx = hairpinStaffSpacePx(engine.getElementRegistry(), id)
  const limit = staffSpacePx ? systemInkLimit(engine, id, which) : null
  const ink = hairpinInkX(engine, id, which)
  if (!limit || ink === null || !staffSpacePx) return true

  const next = ink + dx * staffSpacePx
  if (next > limit.max) return dx < 0
  if (next < limit.min) return dx > 0
  return true
}

/** The drawn extent of the SYSTEM this end stands on — its line's first `noteStartX` and last
 *  `noteEndX`. Null when that bar was not drawn. */
function systemInkLimit(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
): { min: number; max: number; top: number } | null {
  const hairpin = engine.getHairpinById(id)
  const at = which === 'start'
    ? hairpinStartAddress(engine.getScore(), id)
    : hairpinEndAddress(engine.getScore(), id)
  return hairpin && at ? hairpinSystemInkLimit(engine, hairpin, at) : null
}

/**
 * ⭐⭐ **ONE HORIZONTAL ARROW PRESS ON AN ARMED SQUARE** — nudge that end's ink by `dx` staff-spaces
 * (¼ space plain, 1 space with `Ctrl`), and hand that end of the WEDGE along if the ink has arrived
 * at the next boundary of the lane.
 *
 * A crossing press is ONE undo entry covering both writes, via `runBatch`: the re-anchor and the
 * re-base are two halves of a single press, and an undo that took back only half of it would leave
 * the wedge somewhere the user never put it.
 *
 * ⚠️ The walk STOPS where the model refuses — at either end of the lane, and where the two ends
 * would meet (a start may not reach its own end, and a shrink may not leave the wedge covering no
 * music). The press then stays a plain ink nudge, so the tip can still be pushed past, which is what
 * an override is for.
 *
 * @returns true when the model changed (the caller repaints), false when nothing was written — no
 *   such hairpin, or the page limit refused the ink.
 */
export function walkHairpinEndpoint(
  engine: HairpinWalkEngine,
  id: string,
  which: 'start' | 'end',
  dx: number,
): boolean {
  if (dx === 0) return false
  const port = which === 'start' ? startPort(engine, id) : endPort(engine, id)
  // ⛔ No batch when nothing crosses: `runBatch` costs a snapshot per press, and the ordinary nudge
  // records its own single entry. 🚨 And a press that neither crosses nor stays on the system is
  // refused outright — see {@link inkStaysOnSystem}.
  const label = which === 'start' ? 'Move hairpin start' : 'Resize hairpin'
  if (!markWalkCrosses(port, dx)) {
    // 🚨 The ink has covered the folded distance to a stop on the NEXT system — see
    // {@link crossingTheBreak}. Until it has, the press below is ordinary ink.
    const across = crossingTheBreak(engine, id, which, port, dx)
    if (across?.arrived) return leaveSystem(engine, port, across.stop, across.gap, dx, label)
    // ⭐ …and while a crossing is PENDING the ink may lean past the line's end: that overhang is the
    // journey being made visible, and it lasts only until the press that arrives. The limit is for
    // ink with nowhere to go at all.
    if (!across && !inkStaysOnSystem(engine, id, which, dx)) {
      dbg(`[${port.label}] refused — the ink would leave this system, and there is nothing to extend onto`)
      return false
    }
    // ⭐ The ordinary press, and the one worth being able to SEE: this is the interpolation, so the
    // log says how much ink went on and how far the next stop still is (his ask, 2026-08-20 —
    // *"i dont feel anymore the interpolation, it feels like a jump"*).
    const before = port.offsetX()
    const moved = port.nudge(dx, 0)
    dbg(`[${port.label}] ink ${dx > 0 ? '+' : ''}${dx}ss | offset ${before.toFixed(2)} → ${port.offsetX().toFixed(2)}ss`
      + `${moved ? '' : ' (REFUSED)'}`)
    return moved
  }

  let moved = false
  engine.runBatch(label, () => {
    moved = carryMark(port, dx).moved
  })
  return moved
}

/**
 * The wrap itself: hand that end to `stop` and re-base its ink by the folded distance, as ONE undo
 * entry — `carryMark`'s identity (`offset += step − gap`) with {@link crossingTheBreak}'s gap in
 * place of a subtraction that would have been meaningless. ⭐ The offset it leaves is NEGATIVE by
 * however far the stop is into its line, which is what draws the tip at that line's START rather
 * than out in the previous line's margin.
 */
function leaveSystem(
  engine: HairpinWalkEngine,
  port: MarkWalkPort,
  stop: MarkStop,
  gap: number,
  dx: number,
  label: string,
): boolean {
  let moved = false
  engine.runBatch(label, () => {
    if (!port.reanchor(stop)) return
    port.nudge(dx - gap, 0)
    moved = true
    dbg(`[${port.label}] wrapped onto the next system (folded gap ${gap.toFixed(2)}ss)`)
  })
  return moved
}
