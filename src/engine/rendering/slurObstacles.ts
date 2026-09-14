/**
 * ⭐⭐ **WHAT A SLUR HAS TO CLEAR, AND HOW MUCH TALLER THAT MAKES IT** — one factor over the whole
 * arch (docs/slur-tie-research.md §8; `docs/slur-plan.md` §12 Phase 8).
 *
 * > Gould p. 322: *"**all notes must appear to be included in a slur**"* — and p. 110/111 for the
 * > two other constraints, *"always remain outside a beam"* and *"must not obscure a ledger line"*.
 *
 * ## ⭐⭐ THE MECHANISM IS LilyPond's, and it replaced Verovio's on 2026-09-14 — HIS call
 *
 * The first version was Verovio's: each obstacle became a linear constraint on the **two control
 * points**, solved for the least total movement (`x = deficit·w₀/(w₀²+w₁²)`). 🚨 **Raising a control
 * is changing the SHAPE**, and his report of 2026-09-14 is what that costs — five staccato dots
 * turned a 35.5° launch into 67.3° and a 2:1 arch into 3.4:1, because the two controls are lifted by
 * *different* amounts and the near one takes almost all of it.
 *
 * ⭐ **His words were the specification**: *"they should not change the slur angle but move it up a
 * little"* — and the shape he then hand-dragged measured as **the auto arch scaled by 1.24, with its
 * ratio preserved**. That is LilyPond's rule, arrived at by eye:
 *
 * ```cpp
 * // slur-configuration.cc:191-195
 * Real ff = fit_factor (dz_unit, dz_perp, …, curve, state.dir_, avoid);
 * height = std::max (height, std::min (height * ff, max_h));
 * ```
 *
 * ⭐ `fit_factor` (`:93-132`) is **one scalar** — the largest ratio, over every avoid-point, of how
 * far the obstacle is from the chord to how far the curve currently is there. Five dots therefore
 * produce exactly the lift the worst one needs, and ⛔ the arch cannot go lopsided, because the two
 * control heights are multiplied by the same number.
 *
 * ⚠️ **Two faithful-translation decisions, because our frame is not theirs:**
 * 1. LilyPond builds its bow in a frame ROTATED onto the chord, where the arch is symmetric and
 *    scaling the height scales the whole bow. Ours LEANS instead (`./slurArchHeight.archLean`), so
 *    the equivalent is to scale **both resolved control heights**, ⛔ not the base height — scaling
 *    `H` alone would leave the lean unscaled and quietly flatten the ratio (measured: 1.87 against
 *    the arch's own 2.21 and his 2.15).
 * 2. The EDGE DISCOUNT comes with it and is not optional: a factor that must carry the curve past an
 *    obstacle near a pinned end is unbounded. See {@link SLUR_EDGE_DISCOUNT_SPACES}.
 *
 * ⛔ **Two rules it keeps from the first version:** a **hand-edited shape opts out** (the user owns
 * that curve), and it runs **post-layout**, on where the ink actually landed rather than on where
 * the model thinks the notes are.
 */
import { CURVE_PX, SLUR_EDGE_DISCOUNT_SPACES, SLUR_OBSTACLE_MARGIN_RATIO } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐⭐ **HOW MUCH AIR THIS slur leaves over what it covers** — MuseScore's length law
 * (`computeArcClearance`, `slurtielayout.cpp:1359`): a fraction of the span, floored and capped.
 * `spanPx` and the answer are both in pixels; the bounds and the ratio are argued in `curveStyle`.
 *
 * ⭐ **Why a long slur wants MORE air, and it is not arbitrary.** A long slur is FLATTER (Gould
 * p. 109: *"the curve of a long slur is flattened… a long slur may be completely flat in the
 * middle"*), so its ink runs nearly parallel to whatever it passes over — and two near-parallel
 * lines a quarter space apart read as touching, where the same gap under a steep arc reads as
 * clearance. The ratio prices that.
 */
export function slurObstacleMarginPx(spanPx: number): number {
  return Math.min(
    Math.max(Math.abs(spanPx) * SLUR_OBSTACLE_MARGIN_RATIO, CURVE_PX.slurObstacleMarginMin),
    CURVE_PX.slurObstacleMarginMax,
  )
}

/** One thing in the way, as a rectangle in the staff's own space. y grows DOWN. */
export interface SlurObstacle {
  x: number
  y: number
  width: number
  height: number
}

/**
 * ⭐⭐ **THE FACTOR THE WHOLE ARCH MUST GROW BY** so the curve clears everything under it — **1 when
 * it already does**, which is most slurs.
 *
 * `p0`/`p1` are the drawn endpoints and `h0`/`h1` the two control heights the shape laws produced
 * (⚠️ the LEAN included — this scales what is actually drawn). `direction` is −1 above / +1 below.
 * Obstacles are filtered here rather than by the caller: only what lies strictly BETWEEN the
 * endpoints can be in the way, only its edge facing the slur matters, and ⛔ only the part of the
 * span outside {@link SLUR_EDGE_DISCOUNT_SPACES} counts.
 *
 * @returns a multiplier ≥ 1, already capped at {@link maxArchScale}.
 */
export function slurArchFit(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  h0: number,
  h1: number,
  direction: number,
  obstacles: readonly SlurObstacle[],
): number {
  const span = p1.x - p0.x
  if (span === 0 || !isFinite(h0) || !isFinite(h1)) return 1
  const margin = slurObstacleMarginPx(span)
  const edge = SLUR_EDGE_DISCOUNT_SPACES * STAFF_SPACE_PX

  // ⚠️ SAMPLE THE REAL CURVE — the drawn one, lean and all. The two reasons are the ones the
  // least-movement solver had: (1) a leaning arch is not the symmetric cubic it is tempting to solve
  // against, and (2) x does not run linearly with t, so reading `t` off an obstacle's x misplaces it
  // by ~2% of the span. 64 evaluations per slur removes both.
  const c0 = { x: p0.x + span / 4, y: p0.y + h0 * direction }
  const c1 = { x: p1.x - span / 4, y: p1.y + h1 * direction }
  const STEPS = 64
  const samples: { x: number; y: number; t: number }[] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS, mt = 1 - t
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t
    samples.push({
      t,
      x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
      y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
    })
  }

  /** How far OUTWARD of the chord line a y sits at this x — the quantity LilyPond's ratio is of. */
  const outward = (x: number, y: number) => {
    const chordY = p0.y + ((x - p0.x) / span) * (p1.y - p0.y)
    return (chordY - y) * -direction
  }

  let fit = 1
  for (const box of obstacles) {
    const left = Math.min(box.x, box.x + box.width)
    const right = Math.max(box.x, box.x + box.width)
    // The obstacle's edge facing the slur, plus air.
    const facing = direction === -1 ? box.y : box.y + box.height
    const wanted = facing + direction * margin

    // ⭐⭐ **A DEGENERATE obstacle is a POINT, and it is measured at the nearest sample.**
    //    `slurAccidentalPoint` emits zero-width boxes (LilyPond's one-point accidental), and the
    //    same branch quietly fixes a latent fault: a box NARROWER than the sampling step used to
    //    fall between two samples and be ignored altogether.
    const within = samples.filter(s => s.t > 0 && s.t < 1 && s.x >= left && s.x <= right)
    const mid = (left + right) / 2
    const nearest = samples.reduce((a, b) =>
      Math.abs(b.x - mid) < Math.abs(a.x - mid) && b.t > 0 && b.t < 1 ? b : a)
    const relevant = within.length > 0
      ? within
      : (mid > p0.x && mid < p1.x && nearest.t > 0 && nearest.t < 1 ? [nearest] : [])

    for (const s of relevant) {
      // ⛔ THE EDGE DISCOUNT — see {@link SLUR_EDGE_DISCOUNT_SPACES}. The curve is pinned at its ends
      //   and no factor can carry it past something standing there.
      if (s.x - p0.x < edge || p1.x - s.x < edge) continue
      const here = outward(s.x, s.y)
      const needed = outward(s.x, wanted)
      // ⛔ A curve that is ON the chord (or the wrong side of it) cannot be SCALED into place —
      //   multiplying zero by anything is still zero. Such an obstacle is left uncleared.
      if (here <= 0 || needed <= here) continue
      fit = Math.max(fit, needed / here)
    }
  }
  return Math.min(fit, maxArchScale(p0, p1, h0, h1))
}

/**
 * ⭐⭐ **THE CAP: the largest scale that still draws an ARCH rather than a spike** — LilyPond's
 * `max_h` (`slur-configuration.cc:162-175`), whose comment derives it from `|bez'(0)| < |bez'(.5)|`:
 * the curve must not leave its endpoint faster than it travels at its own middle.
 *
 * ```cpp
 * Real max_indent = len / 3.1;
 * Real max_h = sqrt (sqr (len) / 3 - 0.75 * sqr (indent + len / 3));
 * ```
 *
 * ⭐ With our fixed control inset of a quarter of the span, that is `0.2795 × len`. ⚠️ `len` is the
 * CHORD, not the horizontal span — the same input the height law itself takes
 * (`./slurArchHeight.slurArchHeightFor`).
 *
 * ⛔ **This is a bound on the SHAPE, not on the obstacle.** An obstacle that would need more than
 * this is left uncleared, exactly as one inside the edge band is — *a spike is not a clearance.*
 */
export function maxArchScale(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  h0: number,
  h1: number,
): number {
  const mean = (h0 + h1) / 2
  if (mean <= 0) return 1
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const maxH = Math.sqrt(Math.max(0, (len * len) / 3 - 0.75 * Math.pow(len / 4 + len / 3, 2)))
  return Math.max(1, maxH / mean)
}
