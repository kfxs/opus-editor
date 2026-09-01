/**
 * ⭐⭐ **THE CLEF'S INDENTATION, APPLIED — decision A** (`docs/header-spacing-research.md` §8 A).
 *
 * The rule and its sources are `layout/headerInk`'s {@link CLEF_INDENT}: a clef's ink begins about
 * **0.7 staff spaces** inside the staff's left edge — Gould p. 6 (*"one stave-space or a little
 * less"*, drawn 0.67–0.74), Ross p. 144 (*"½ to 1 space"*), Gerou & Lusk (0.62–0.70), with LilyPond
 * at 0.80 and MuseScore at 0.75.
 *
 * 🚨 **What this pass exists to correct is not a wrong number but an ABSENT one.** VexFlow puts the
 * clef at 0.50 — its own opening barline's width, with no padding at the first modifier slot — and
 * nothing in this editor had ever chosen otherwise. So the whole of this module is *"move it the
 * remaining {@link CLEF_INDENT_SHIFT}"*.
 *
 * ## ⚠️ Why it is a shift and not a placement
 *
 * ⛔ We do not lay out the header's modifiers; `Stave.format()` does. Rather than reproduce that
 * (*"port the ALGORITHM, not the FILE"* — `own-engraving-engine.md` §6.7), this nudges the one
 * modifier by the DIFFERENCE, exactly as `clefOffsetPass` nudges it by a user's hand offset. ⭐ The
 * two compose: a bar can carry both, and they add.
 *
 * ## 🚨 A LINE-OPENING clef only
 *
 * Ross measures the indent *"from the open end of the staff (or from the systematic barline)"* — so
 * it is a fact about a SYSTEM's left edge. A mid-line clef change follows a barline inside the music
 * and is not indented from anything. ⇒ this refuses every bar that does not open a line, which is
 * the exact complement of `applyStaveClefOffset`'s own guard.
 *
 * ⚠️ **Must run BEFORE the stave draws** — after that the ink is on the page. Same contract as
 * `clefOffsetPass`, and the reason both are called from one place in `drawMeasureContent`.
 */
import { Barline, StaveModifierPosition, type Stave } from 'vexflow'
import { CLEF_INDENT_SHIFT } from '@/engine/layout/headerInk'
import { staffSpacesToPixels } from './staffSpace'

/**
 * Push a line-opening clef right to its engraved indentation.
 *
 * ⛔ A no-op for any bar that does not open a line, and a no-op when the shift is zero — so a house
 * style that chose VexFlow's own 0.5 would cost nothing at all.
 */
export function applyClefIndent(stave: Stave, isFirstInLine: boolean): void {
  if (!isFirstInLine || CLEF_INDENT_SHIFT === 0) return
  const px = staffSpacesToPixels(CLEF_INDENT_SHIFT, stave)
  for (const modifier of stave.getModifiers(StaveModifierPosition.BEGIN)) {
    // ⛔ …except the BARLINE, which is what the clef is indented FROM.
    if (modifier.getCategory() === Barline.CATEGORY) continue
    modifier.setX(modifier.getX() + px)
  }
}
