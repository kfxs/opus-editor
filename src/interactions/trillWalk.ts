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
 * 🚨 **It will not walk across a system break** — `./slurEndpointWalk`'s refusal, for its reason: two
 * x's from different systems are not on one ruler, so a gap whose sign disagrees with the direction
 * of travel is refused and the press stays a plain nudge. `Ctrl+Shift+←/→` is the gesture that
 * crosses a break. ⛔ The hairpin's WRAP is deliberately not copied: a wedge's tip hangs in the
 * margin, while a trill that has left its line has left its notes.
 *
 * ⛔ **And it does not reach the BARE `tr`.** That state (`Trill.extension === 'none'`) is a step of
 * `Ctrl+Shift+←` past the collapse, with no gap to measure to — the ink has nothing to arrive at,
 * and a crossing that put the line back would jump the end square the width of the whole ornament.
 * With no line drawn, an arrow on the end square stays the plain ink nudge it has always been.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { Fraction, Trill } from '../types/music'
import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { trillEndWithoutAnEnd } from '../engine/models/trillOps'
import { carryMark, markWalkCrosses, type MarkWalkPort } from './markWalk'
import {
  applyTrillAnchorStop, nextTrillAnchorStop, trillAnchorPosition, type TrillAnchorEngine,
  type TrillAnchorStop,
} from './trillReanchor'
import { trillLane, trillLaneIndexAt, trillSquareBaseX, trillStaffSpacePx } from './trillLane'

/** What the walk needs off the engine — a Pick, so a spec can stand it up without a renderer. */
export type TrillWalkEngine = TrillAnchorEngine & Pick<MusicEngine,
  'setTrillAnchor' | 'nudgeTrillEndpoint' | 'rebaseTrillEndpointOffset' | 'runBatch'>

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
  /** ⚠️ Re-read on EVERY call, never captured: a crossing re-anchors mid-loop, so an anchor or a
   *  lane resolved once would answer for a trill that has already moved. */
  const laneOf = (trill: Trill) => {
    const start = engine.getNote(trill.startNoteId)
    return start ? trillLane(engine, start) : null
  }
  const baseXAt = (measure: number, beat: Fraction) => {
    const trill = engine.getTrillById(id)
    const lane = trill && laneOf(trill)
    if (!lane) return null
    const index = trillLaneIndexAt(lane, measure, beat)
    return index === -1 ? null : trillSquareBaseX(engine.getElementRegistry(), lane, which, index)
  }

  return {
    label: which === 'start' ? 'Trill sign' : 'Trill end',
    // ⭐ The SAME candidate rule `Ctrl+Shift+←/→` uses, which is why it lives over there: two rules
    // would mean the same key landing the square on a different note depending on how far it had
    // been nudged.
    nextStop: (direction) => nextTrillAnchorStop(state, engine, direction),
    stopX: (stop) => {
      const step = stop as TrillAnchorStop
      // ⭐⭐ PRICED WHERE THE INK LANDS — see the header. Clearing the end leaves the tie chain's own
      // extent, which is the start note only when nothing is tied.
      if (step.clearsEnd) {
        const landing = trillEndWithoutAnEnd(engine.getScore(), id)
        const note = landing ? engine.getNote(landing) : null
        return note ? baseXAt(note.measure, note.beat) : null
      }
      return baseXAt(step.note.measureNumber, step.note.beat)
    },
    anchorX: () => {
      const trill = engine.getTrillById(id)
      const here = trill && trillAnchorPosition(engine, trill, which)
      return here ? baseXAt(here.measure, here.beat) : null
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
  const bare = engine.getTrillById(selected.id)?.extension === 'none'
  if ((bare && which === 'end') || !markWalkCrosses(port, dx)) return port.nudge(dx, 0)

  // ⛔ No batch unless something beyond the ink is about to be written: `runBatch` costs a snapshot
  // per press, and the ordinary nudge records its own single entry.
  let moved = false
  engine.runBatch(which === 'start' ? 'Move trill start' : 'Move trill end', () => {
    moved = carryMark(port, dx).moved
  })
  return moved
}
