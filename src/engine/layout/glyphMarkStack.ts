/**
 * ⭐ **A STACK OF SYMBOLS ON ONE NOTE — where each one's baseline goes** (docs/plans/symbol-plan.md
 * §4 (e)). Pure arithmetic on staff spaces, `InkBox`'s axis (top line 0, bottom 4, above negative).
 *
 * The FIRST mark takes the one rule every outside-staff family takes — clear the ink under it by the
 * family's padding, floored at its distance from the staff ({@link clearanceBaseline}). Each NEXT
 * mark stands outward from the one before it, a `gap` between their inks, in the order they were
 * added (the stored order, `glyphMarkOps`). ⛔ No sorting by size or kind: a symbol means nothing, so
 * nothing but the user's order can say which goes nearer the note.
 */
import { clearanceBaseline, type Clearance, type InkBand, type MarkInk, type StaffSide } from './inkBand'

/**
 * The baseline of each mark of one stack, in the order handed in — nearest the staff first.
 *
 * @param band what the marks must clear: the music under them merged with whatever the families
 *   placed before them took there (`bandOver`); `null` when nothing is there.
 * @param inks each mark's reach from its own baseline (its glyph's box, `glyphMarkInk`).
 * @param gap the ink-to-ink distance between two neighbours of the stack, staff spaces.
 */
export function glyphMarkStackBaselines(
  band: InkBand | null,
  side: StaffSide,
  inks: readonly MarkInk[],
  clearance: Clearance,
  gap: number,
): number[] {
  const baselines: number[] = []
  inks.forEach((ink, i) => {
    if (i === 0) {
      baselines.push(clearanceBaseline(band, side, ink, clearance))
      return
    }
    const prev = baselines[i - 1]
    const prevInk = inks[i - 1]
    baselines.push(side === 'above'
      ? prev - prevInk.above - gap - ink.below
      : prev + prevInk.below + gap + ink.above)
  })
  return baselines
}
