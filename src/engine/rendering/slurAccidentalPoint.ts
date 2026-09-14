/**
 * ⭐⭐ **AN ACCIDENTAL IS ONE POINT UNDER A SLUR, NOT A BOX** — LilyPond's rule, his call 2026-09-14
 * (`docs/slur-tie-research.md` §8.8).
 *
 * ## 🚨 The report, and the second time the same shape of fault appeared in one afternoon
 *
 * Five sixteenths with accidentals under a slur: *"the accidentals are almost colliding with the
 * slur; the angle looks good to me, but the distance is not optimal"*. Measured, the curve passed
 * **0.03 sp** from a flat and INSIDE the sharps either side of it.
 *
 * ⛔ **The cause was ours.** `rendering/accidentalCutOut` (deleted with this change) let the curve dip
 * into the NOTCH in an accidental's outline — Verovio's rule, and right in principle. But it applied
 * the notch's depth to the whole RECTANGLE, so the allowance earned at one corner was granted at
 * every x: a sharp's notch is the rightmost **16%** of its glyph and we lowered the obstacle by
 * 0.504 sp across the note; a flat's is the right 72% and we lowered it by **1.1 sp**, over the
 * ascender at its left where there is no notch at all. ⭐ *A rectangle grants at one x what is only
 * true at another* — the same sentence the staccato case earned two hours earlier (§8.1).
 *
 * ## ⭐⭐ LilyPond's answer: choose the x from the GLYPH'S SHAPE and measure the full height there
 *
 * `lily/slur-scoring.cc:865-877`, verbatim:
 *
 * ```cpp
 * if (alt == FLAT_ALTERATION || alt == DOUBLE_FLAT_ALTERATION) xp = LEFT;
 * else if (alt == SHARP_ALTERATION)   xp = 0.5 * dir_;
 * else if (alt == NATURAL_ALTERATION) xp = -dir_;
 * ```
 *
 * consumed at `slur-configuration.cc:429` as `extents_[X_AXIS].linear_combination (idx_)`, where
 * −1 is the left edge, 0 the centre and +1 the right. ⭐ **The reasoning is the glyph's mass**: a
 * flat's bulk is low and to the left, so it is met at its LEFT — its tall ascender; a natural's two
 * ends are diagonal, so the side that matters flips with the slur's direction; a sharp is nearly
 * symmetric and is met just inside its far half.
 *
 * ⚠️ **The point carries the accidental's FULL reach**, not a reduced one. LilyPond expresses the
 * notch by choosing WHERE to stand, ⛔ never by lowering the obstacle — which is exactly the
 * distinction our rectangle lost.
 *
 * ⚠️ **`dir_` is LilyPond's, and it is the OPPOSITE SIGN to ours**: theirs is +1 for a slur ABOVE
 * (their y grows up), ours is −1. Every table below is written in OUR convention, converted once,
 * here — ⛔ not transcribed and left to bite a reader.
 */
import type { NoteInkRect } from './noteInkBox'

/**
 * ⭐ **Where along its own width an accidental is met**, as a fraction: **−1 the left edge, 0 the
 * centre, +1 the right** (LilyPond's `linear_combination`).
 *
 * @param sign VexFlow's accidental string — `#`, `b`, `n`, `##`, `bb`.
 * @param direction −1 for a slur above, +1 for below.
 * @returns null for a sign this rule does not cover, so the caller can fall back rather than invent.
 */
export function accidentalAvoidFraction(sign: string, direction: number): number | null {
  switch (sign) {
    // ⭐ A flat's bulk is LOW and LEFT, so the curve meets its ascender. Both flats, either way up.
    case 'b':
    case 'bb':
      return -1
    // ⭐ Nearly symmetric: met half-way into the half the curve is coming from.
    case '#':
      return -0.5 * direction
    // ⭐ The two ends are diagonal, so which side is tall depends on the side the slur is on.
    case 'n':
      return direction
    // ⛔ **NOT in LilyPond's table.** A double sharp is a compact cross with no tall corner, so the
    //    centre is the honest reading — but it is OURS, and it is marked as such rather than passed
    //    off as ported.
    case '##':
      return 0
    default:
      return null
  }
}

/**
 * ⭐ **The one point this accidental puts under the slur** — a zero-width obstacle at the glyph's own
 * facing edge, standing where {@link accidentalAvoidFraction} says.
 *
 * @param ink the accidental's DRAWN ink box (`EngravedAccidental.drawnInk()`, P6b) — ⛔ never
 *   VexFlow's note box, which unions the head and the stem.
 * @returns null when the sign is unknown or the ink is not finite, so the caller leaves it out.
 */
export function accidentalAvoidPoint(
  ink: NoteInkRect,
  sign: string,
  direction: number,
): NoteInkRect | null {
  const fraction = accidentalAvoidFraction(sign, direction)
  if (fraction === null) return null
  const x = ink.x + ((fraction + 1) / 2) * ink.width
  const y = direction === -1 ? ink.y : ink.y + ink.height
  if (!isFinite(x) || !isFinite(y)) return null
  // ⚠️ A zero-height, zero-width box IS the point — `slurArchFit` measures the curve at the nearest
  //   sample to a degenerate obstacle, so a point needs no second obstacle type.
  return { x, y, width: 0, height: 0 }
}
