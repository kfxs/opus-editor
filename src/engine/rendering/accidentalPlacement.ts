/**
 * ⭐⭐ **MOVING AN ACCIDENTAL TO THE ARMED GAP** — the drawing half of `engine/layout/accidentalGap`
 * (2026-09-14). The accidental's `dotPlacement`, and deliberately the same shape.
 *
 * ## What it does, and what it does NOT
 *
 * `engrave/notes/accidentalStack` (VexFlow's `Accidental.format`, ours since S9d) packs a chord's signs
 * into COLUMNS and places the nearest one at the inherited standoff from the notehead. ⭐ This pass
 * moves that whole stack out (or in) by the difference between that standoff and the armed row —
 * ⛔ it does not repack, re-order or re-column anything.
 *
 * ⚠️ **Every sign of a note moves by the SAME amount** — they are a column, and a per-sign shift
 * would rake it. The same sentence `ledgerAccidentalClearance` carries, for the same reason.
 *
 * ## 🚨 `Modifier.setXShift` NEGATES for a LEFT modifier
 *
 * `setXShift(x)` stores `-x` when the modifier's position is LEFT, while `getXShift()` returns what
 * is stored. ⇒ `setXShift(getXShift() + d)` **moves the sign the wrong way and by the wrong amount**,
 * and reading `Accidental.format` without noticing is how the engine survey's first pass came out
 * backwards. The idiom that composes correctly is `setXShift(-getXShift() + d)`, which
 * `ledgerAccidentalClearance` already uses — so the two passes ADD rather than fight.
 *
 * ## ⚠️ Order matters, and it is asserted where it is wired
 *
 * This runs BEFORE `clearLedgersForAccidentals`, and that pass is handed {@link armedStandoffPx} so
 * its *"how far must the sign step out to clear the ledger?"* arithmetic is about where the sign now
 * stands. ⛔ Run it after, or leave it reading VexFlow's constant, and a wide armed row would buy the
 * clearance twice.
 */
import type { StaveNote } from 'vexflow'
import { accidentalsOn } from './EngravedAccidental'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { armedAccidentalGap } from '@/engine/layout/accidentalGap'
import { ACCIDENTAL_STANDOFF_PX } from './ledgerAccidentalClearance'

/** The inherited standoff, in staff spaces — what the `house` row reproduces, read rather than
 *  restated (`ledgerAccidentalClearance` sums `engrave/inheritedDefaults`' two halves). */
export function inheritedAccidentalGapSpaces(): number {
  return ACCIDENTAL_STANDOFF_PX / STAFF_SPACE_PX
}

/**
 * How far the sign has to move, in pixels: the armed gap less the one VexFlow drew.
 *
 * ⭐ **Positive moves it further LEFT** (away from the head), negative closes it in — and the armed
 * `house` row answers exactly 0, which is why arming the default draws the page it already drew.
 */
export function accidentalShiftPx(): number {
  return (armedAccidentalGap().gap - inheritedAccidentalGapSpaces()) * STAFF_SPACE_PX
}

/** Where a note's accidental stands once this pass has run — what the ledger clearance must measure
 *  from. ⚠️ In PIXELS from the notehead's left edge, like {@link ACCIDENTAL_STANDOFF_PX}. */
export function armedStandoffPx(): number {
  return ACCIDENTAL_STANDOFF_PX + accidentalShiftPx()
}

/**
 * Move every accidental of every note to the armed gap. ⚠️ AFTER `formatter.format` — the column rule
 * (`engrave/notes/accidentalStack`) assigns each sign's `xShift` from scratch, so anything written before it is lost.
 */
export function placeAccidentals(notes: StaveNote[]): void {
  const shift = accidentalShiftPx()
  if (shift === 0) return
  for (const note of notes) {
    if (note.isRest()) continue
    for (const modifier of accidentalsOn(note)) {
      // ⚠️ The NEGATION, see the header: the stored shift is negative for a LEFT modifier.
      modifier.setXShift(-modifier.getXShift() + shift)
    }
  }
}
