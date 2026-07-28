/**
 * ⭐⭐ **CHORD NOTEHEADS — which of them cross to the far side of the stem.**
 *
 * The engraving rule (Gould, *Behind Bars*, "Chords"): every notehead of a chord stands in ONE
 * column on its own side of the stem — left of it for stems up, right for stems down — *except*
 * where two notes are a SECOND apart, which cannot both fit there. Then the stem runs BETWEEN
 * them: the upper note to the right of the stem, the lower to the left. A cluster of three or more
 * adjacent notes alternates from there, so the outer notes of the cluster land on the correct side
 * and only the inner ones are "back-notes".
 *
 * Which of the pair is the one that MOVES follows from the stem: with the stem up the column is to
 * the left, so the UPPER note is the one pushed across; with the stem down it is the LOWER. Both
 * spellings say the same thing — the higher note is always to the right of the lower one.
 *
 * ⚠️ **This module exists because a hand-drawn head gets none of that.** A `StaveNote` sorts its
 * keys and does all of the above in `buildNoteHeads`; the fanned beam's members are bare
 * {@link NoteHead}s placed at coordinates we compute ({@link FanPass}), so a second inside a fan
 * member printed one head on top of the other. The walk below is deliberately VexFlow's own —
 * bottom-to-top for stems up, top-to-bottom for stems down, toggling on each adjacent pair — so a
 * member chord and the fan's own note (which IS a `StaveNote`) can never disagree about the same
 * three pitches.
 *
 * Flags only, in the CALLER's order: the caller hands `displaced` to `NoteHead`, which owns the
 * arithmetic that turns it into an x. Nothing here reorders anything — `member.pitches[0].id` is
 * the id every fan command addresses a member by, and a sorted copy that leaked back would move it.
 */
import { Stem } from 'vexflow'

/**
 * A second, on the line grid `staffLineForSpelling` speaks: 1 = one staff LINE = a third, so a step
 * is 0.5. A unison is 0 and displaces too — two heads on one line cannot share a place either, and
 * this is what VexFlow does (`lineDiff === 0 || lineDiff === 0.5`). Gould gives unisons in a single
 * voice their own treatment; if that is wanted it belongs here, as a case of its own.
 */
const SECOND_IN_LINES = 0.5

/** Float slack — the lines are built by halving an integer, so this only guards arithmetic drift. */
const EPSILON = 1e-6

/**
 * Which heads of one chord sit on the far side of the stem, by the rule above.
 *
 * `lines` are staff lines (`staffLineForSpelling`), in any order; `stemDirection` is VexFlow's
 * (`Stem.UP` = 1, `Stem.DOWN` = -1). Returns one flag per input, in the input's order.
 */
export function chordHeadDisplacement(lines: number[], stemDirection: number): boolean[] {
  const flags = lines.map(() => false)
  if (lines.length < 2) return flags

  // Bottom-to-top for a stem up, top-to-bottom for a stem down: the walk starts at the head the
  // stem's BASE is at, which is the one guaranteed to be on the ordinary side.
  const order = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line - b.line || a.index - b.index)
  if (stemDirection < 0) order.reverse()

  let previous: number | undefined
  let displaced = false
  for (const { line, index } of order) {
    if (previous !== undefined) {
      // Adjacent ⇒ cross the stem; anything wider ⇒ the column resumes. A third breaks a cluster,
      // which is why this is a reset and not a running parity.
      displaced = Math.abs(previous - line) <= SECOND_IN_LINES + EPSILON ? !displaced : false
    }
    flags[index] = displaced
    previous = line
  }
  return flags
}

/**
 * How far a displaced head stands from the column, in px — **VexFlow's own number**
 * (`NoteHead.getAbsoluteX`: `width - Stem.WIDTH / 2`), so the two heads share the stem rather than
 * leaving it outside both. Multiply by the stem direction for the signed offset.
 *
 * ⚠️ The DRAWING does not use this — it hands `displaced` to `NoteHead` and reads the x back, which
 * is the primitive doing its own job. This is for the passes that must reserve the ROOM before any
 * head exists (`fanSlotDrawing`'s `accidentalRoom` / `headRightRoom`), where there is nothing to
 * ask. If VexFlow ever changed the formula the picture would stay right and only the reservation
 * would be stale.
 */
export function displacedHeadShiftPx(glyphWidth: number): number {
  return glyphWidth - Stem.WIDTH / 2
}
