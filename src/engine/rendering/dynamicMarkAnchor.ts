/**
 * ⭐ **HOW A DYNAMIC SITS ON ITS NOTE, HORIZONTALLY — centred if it is a level, anchored if it is
 * prose.**
 *
 * The convention, checked rather than assumed (2026-08-12):
 *
 * - **Gould**, *Behind Bars* (dynamics): position the mark centrally below the note or chord it
 *   applies to.
 * - **LilyPond**: `DynamicText` ships `self-alignment-X = CENTER` (`define-grobs.scm`).
 * - **MuseScore** and **Dorico** both default to centred on the notehead (Dorico offers
 *   left-edge alignment as the alternative, not the default).
 *
 * ⭐ **And the exception, which is why this is a rule and not a constant.** A level is a glyph two
 * or three characters wide, so centring it reads as "this belongs to that note". *Words* do not:
 * `dolce` centred on a notehead reaches back over the previous beat, and every engine anchors
 * expression text at its note and lets it run right. So: **all-glyph centres, anything with prose
 * stays anchored.** Mixed `p dolce` is prose by this test — strictly the `p` should straddle and the
 * word trail, but that needs the glyph run measured on its own, and the honest simple answer beats a
 * clever one that is wrong in a different way. ⏭️ That is the first thing to revisit here.
 *
 * ⚠️ **What the shift is measured FROM.** VexFlow hands a below-annotation
 * `getModifierStartXY(ABOVE)` = `absoluteX + glyphWidth / 2` — the notehead's **centre**, not its
 * left edge — and we draw LEFT-justified from there (its own `CENTER` justification is unusable: it
 * subtracts `getWidth()`, which `buildDynamicAnnotation` deliberately zeroes so a mark never pushes
 * notes apart). So the mark's left edge sits ON the head's centre today, and centring it is exactly
 * half its own drawn width to the left. Nothing else enters — no notehead width, no stem.
 *
 * ⛔ It does not know how wide the mark is: the caller measures the drawn `<text>`, because a glyph
 * measures 0×0 in jsdom and a number computed here would agree with itself.
 */
import type { Dynamic } from '@/types/music'
import { dynamicLabel, splitDynamicRuns } from '@/utils/dynamics'

/** Is every run of this mark a dynamics GLYPH — `p`, `ff`, `sfz` — with no prose anywhere? */
export function isPureLevel(dyn: Dynamic): boolean {
  const runs = splitDynamicRuns(dynamicLabel(dyn)).filter(run => run.text.trim() !== '')
  return runs.length > 0 && runs.every(run => run.glyph)
}

/**
 * Where a mark's drawn INK sits relative to the point it was anchored at — both in the staff's own
 * pixels, both measured by the caller off the rendered `<text>`.
 *
 * ⚠️⚠️ **`left` is not zero, and assuming it was is how this went wrong once.** A Bravura dynamics
 * glyph has a **negative left side bearing**: at the engraved size the `f` starts about 5 px LEFT of
 * its text origin. So "shift back half the width" centres the ink half a side-bearing off the
 * notehead — measured at 4.6 px out, which is most of a notehead. The ink's own centre is the only
 * thing that can be centred on anything.
 */
export interface DynamicMarkInkBox {
  /** The ink's left edge, relative to the `<text>`'s x — negative for a glyph that overhangs it. */
  left: number
  width: number
}

/**
 * How far to move a mark so it sits correctly on its note, in the staff's own pixels.
 *
 * @param coLocated whether another mark shares this one's beat — then the ROW owns the x
 *   (`layoutCoLocatedDynamics` lays `p dolce` out left-to-right and centres the pair), and a mark
 *   pulling itself left inside that row would only smear it.
 */
export function dynamicMarkAnchorShift(dyn: Dynamic, ink: DynamicMarkInkBox, coLocated: boolean): number {
  if (coLocated || !isPureLevel(dyn)) return 0
  const centre = ink.left + ink.width / 2
  return Number.isFinite(centre) ? -centre : 0
}
