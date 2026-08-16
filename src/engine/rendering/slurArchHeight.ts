/**
 * ⭐⭐ **HOW TALL A SLUR'S ARCH IS** — one span in, one control height out (docs/slur-plan.md §12
 * Phase 2). The number every other slur decision is judged against, and the only one in the family
 * with **no published source at all**.
 *
 * ⚠️ **This is a LAW, not a constant, which is why it is a module.** Three engines answer it three
 * ways and none of them agrees with another (§11.3): LilyPond an atan asymptote to 2.0 sp, Verovio a
 * saturation at 1.5, MuseScore an unbounded `sqrt(d/4)`. Ours *was* a fourth answer — a floor plus a
 * slope with a cap, the only one with a floor — until his call below took LilyPond's.
 *
 * ⭐ **What Gould does and does not settle** (p. 109): *"the curve of a long slur is flattened"*, and
 * she illustrates one that is *"completely flat in the middle"*. That constrains the DIRECTION — long
 * ⇒ flatter, which rules out MuseScore's unbounded law — and says nothing about the number. Our cap
 * is hers; the growth and the floor are ours alone.
 *
 * 🚨 **THE MEASURED FAULT, and it is at the SHORT end** (drawn apexes, staff spaces; a cubic's apex
 * is 0.75 × the control height in all four engines, so these compare directly):
 *
 * | span | **ours** | LilyPond | Verovio | MuseScore |
 * |---|---|---|---|---|
 * | 2.4 sp | **0.81** | 0.42 | 0.45 | 0.58 |
 * | 4 | **0.88** | 0.64 | 0.60 | 0.75 |
 * | 10.8 | **1.18** | 1.08 | 1.13 | 1.23 |
 * | 18 | **1.51** | 1.24 | 1.13 | 1.59 |
 * | 25.2 | **1.65** | 1.31 | 1.13 | 1.88 |
 *
 * From medium spans up we sit in the middle of the field. At a two-note step we are **1.9×
 * LilyPond, 1.8× Verovio, 1.4× MuseScore** — and short slurs are the commonest ones on a page. One
 * number caused it: a 0.93 sp intercept, a floor no other engine has. ⭐ It also caused the
 * *hookiness*: with our fixed 25% control indent, that height gave a launch angle of **61°** at a
 * 2.4 sp span (LilyPond's own source calls this *"a certain hookiness at the end"*) against 19° at
 * 25.2 sp, which was right. Under the law below the same span launches at **43°**.
 *
 * ⭐⭐ **HIS CALL, 2026-08-16: option (b) — LilyPond's law, adopted whole**, replacing our floor +
 * slope + cap. It is the only one of the three that behaves at both ends by construction rather than
 * by a ceiling, and it puts every span on LilyPond's own column of the table above (checked: the
 * formula reproduces those five numbers to 0.01). ⛔ It is still not *published* — no book gives a
 * slur height — so the honest citation is "LilyPond's `slur_height`, adopted by him 2026-08-16", and
 * it stays a number an eye may overrule.
 */
import { CURVE, SLUR_HEIGHT_RATIO, curvePx } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ **LilyPond's `F0_1`** (`lily/bezier-bow.cc:29–32`) — a soft saturation, read at source rather
 * than transcribed: `2/π · atan(π·x/2)`. It is the identity near 0 (slope 1 at the origin) and
 * approaches 1 as x grows, so a height built on it rises naturally at short spans and flattens
 * without ever hitting a wall.
 */
function saturate(x: number): number {
  return (2 / Math.PI) * Math.atan((Math.PI * x) / 2)
}

/**
 * The cubic control height for an arch spanning `spanPx` horizontally, in pixels. The drawn apex is
 * **0.75 × this** — and that factor is independent of where the control points sit horizontally, so
 * it holds for LilyPond's varying indent and our fixed 25% alike.
 *
 * LilyPond's `slur_height(width, h_inf, r_0) = F0_1(width · r_0 / h_inf) · h_inf`
 * (`lily/bezier-bow.cc:34–38`), with the `Slur` grob's own pair — {@link CURVE}.slurHeightLimit 2.0
 * and {@link SLUR_HEIGHT_RATIO} 0.25 (`define-grobs.scm:3178, 3181`).
 *
 * `extraHeight` is added afterwards: it is the nesting lift (`slurNestDepths`), which has to clear
 * the slur inside it whatever the law says about length.
 */
export function slurArchHeight(spanPx: number, extraHeight = 0): number {
  const widthSpaces = Math.abs(spanPx) / STAFF_SPACE_PX
  const heightSpaces = saturate((widthSpaces * SLUR_HEIGHT_RATIO) / CURVE.slurHeightLimit)
    * CURVE.slurHeightLimit
  return curvePx(heightSpaces) + extraHeight
}

