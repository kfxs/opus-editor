/**
 * ⭐⭐ **HOW TALL A SLUR'S ARCH IS** — one span in, one control height out (docs/plans/slur-plan.md §12
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
import { CURVE, SLUR_ARCH_TILT, SLUR_ARCH_TILT_LIMIT, SLUR_HEIGHT_RATIO, curvePx } from './curveStyle'
import { slurLawHeightSpaces } from './slurShapeExperiment'
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
  // ⚠️ EXPERIMENT, HIS (2026-08-31): the law is armable from the console while he judges the three
  //    by eye (`./slurShapeExperiment`). ⛔ Its default IS the line below, so nothing changed —
  //    `slurLawHeightSpaces` returns exactly `saturate(w·ratio/limit)·limit` under `'lilypond'`.
  const heightSpaces = slurLawHeightSpaces(widthSpaces)
  return curvePx(heightSpaces) + extraHeight
}

/** LilyPond's law as this file has always computed it — kept as the ARMED default's twin so the
 *  experiment's `'lilypond'` row can be checked against the code it replaced. */
export function lilypondArchHeightSpaces(widthSpaces: number): number {
  return saturate((widthSpaces * SLUR_HEIGHT_RATIO) / CURVE.slurHeightLimit) * CURVE.slurHeightLimit
}


/**
 * ⭐⭐ **THE ARCH'S LEAN, BOUNDED** — `±SLUR_ARCH_TILT · dy`, clamped so it can never spend more of
 * the arch than {@link SLUR_ARCH_TILT_LIMIT} allows.
 *
 * ⭐ **Two callers, one answer, and that is the point of it being here**: the DRAWING leans the two
 * controls (`SlurRenderer.slurArchCps`) and the obstacle solve samples the curve it will draw
 * (`./slurObstacles`). They already shared the tilt constant; a clamp in one and not the other would
 * make the solver bow over a shape nobody draws — the same "two answers to one question" that cost
 * the stem flip a whole afternoon.
 *
 * @param dy `p1.y − p0.y` in pixels (screen-down), @param direction −1 above / +1 below,
 * @param archHeight the control height the law produced, ⚠️ INCLUDING any nest lift — a slur pushed
 *   clear of the one inside it is taller, and tolerates its lean in proportion.
 */
export function archLean(dy: number, direction: number, archHeight: number): number {
  const limit = Math.abs(archHeight) * SLUR_ARCH_TILT_LIMIT
  return Math.max(-limit, Math.min(limit, SLUR_ARCH_TILT * dy * direction))
}

/**
 * ⭐⭐ **THE ARCH FOR TWO ENDPOINTS — measured along the CHORD, which is the input LilyPond's own law
 * takes** (his report, 2026-08-31: *"b3 a4 slur looks odd not that curvy"*).
 *
 * 🚨 We fed {@link slurArchHeight} the HORIZONTAL SPAN. LilyPond feeds the distance between the two
 * attachments and builds the curve in a frame rotated onto it — `lily/slur-configuration.cc:140-147`,
 * verbatim:
 *
 * ```cpp
 * Offset dz = attachment_[RIGHT] - attachment_[LEFT];
 * get_slur_indent_height (&indent, &height, dz.length (), h_inf, r_0);
 * ```
 *
 * ⭐ Identical for a level slur and quietly wrong for a steep one: his `B3 → A4` spans **2.4 sp**
 * horizontally but its chord is **3.84 sp**, so the law returned 5.61 px where its own input gives
 * **8.22**. ⛔ This is not a change to the height law he settled on 2026-08-16 — it is that law, fed
 * what it is defined on.
 *
 * ⚠️ The height is still applied VERTICALLY, not perpendicular to the chord: rotating the frame is
 * Verovio's and LilyPond's, ours leans instead ({@link archLean}), and the two are different shapes.
 * ⏭️ That difference is what the tail of `./slurSlantLimit` costed and left for his eye.
 */
export function slurArchHeightFor(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  extraHeight = 0,
): number {
  return slurArchHeight(Math.hypot(p1.x - p0.x, p1.y - p0.y), extraHeight)
}
