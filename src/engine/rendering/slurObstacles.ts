/**
 * ⭐⭐ **WHAT A SLUR HAS TO CLEAR, AND HOW MUCH HIGHER THAT MAKES IT** — Phase 8, first pass
 * (docs/slur-plan.md §12 Phase 8, §11.6).
 *
 * > Gould p. 322: *"**all notes must appear to be included in a slur**"* — and p. 110/111 for the
 * > two other constraints, *"always remain outside a beam"* and *"must not obscure a ledger line"*.
 *
 * ⭐ **The books state the constraints and never the algorithm**, so the algorithm is an engine's.
 * The three differ more here than anywhere else (§11.6): LilyPond scores candidate endpoint pairs on
 * a grid where `head-encompass-penalty` **1000** acts as a veto; MuseScore iterates up to **30
 * times**, alternating shape and endpoints over ~20 sampled rectangles; **Verovio does a single
 * feed-forward pass**, solving `3(1−t)²·x + 3(1−t)t²·y ≥ intersection` for the control-point lifts.
 *
 * ⭐ **This is Verovio's**, for the reason the plan gives: one pass, no loop, and its constraint math
 * is written for exactly our shape — a cubic driven by two control points. LilyPond's moves the
 * ENDPOINTS, which would fight the endpoint-offset override compartment; MuseScore's loop wants a
 * shape model that can go lopsided, which ours can express but nothing yet drives.
 *
 * ⭐⭐ **THE TWO LIFTS ARE SOLVED SEPARATELY, and his own hand is why.** The first version added one
 * lift to both control points, which cleared the music but kept the arch's LEAN — and the lean puts
 * the lower control on the side the obstacle is usually on. He dragged the curve into the shape he
 * wanted and sent it back: control 1 **identical to ours to three decimals**, control 2 raised
 * 0.73 sp. That is not a preference, it is a diagnosis — the fullness was in the wrong half.
 *
 * So each obstacle is now solved for BOTH lifts, exactly as Verovio writes it: with `x` on the first
 * control and `y` on the second, `3(1−t)²t·x + 3(1−t)t²·y ≥ deficit`. Those two coefficients are how
 * much say each control has where the obstacle is — at his peak (t ≈ 0.64) the second has **1.8×**
 * the first — and the pair is chosen to satisfy the constraint with the **least total movement**,
 * i.e. `x = deficit·w₀/(w₀²+w₁²)`, `y = deficit·w₁/(w₀²+w₁²)`. ⭐ At t = 0.5 that collapses to the old
 * symmetric answer, `deficit / 0.75`, so nothing about a centred obstacle changed.
 *
 * ⭐ **Taking the componentwise MAX across obstacles is safe**, and that is why one pass suffices: if
 * `x ≥ xᵢ` and `y ≥ yᵢ` for every obstacle, then `w₀ᵢx + w₁ᵢy ≥ deficitᵢ` for every obstacle too,
 * since the weights are positive. No iteration, no search.
 *
 * ⛔ **Two rules it obeys, both inherited:** a **hand-edited shape opts out** (the rule the nest lift
 * already follows — the user owns that curve), and it runs **post-layout**, on where the ink
 * actually landed rather than on where the model thinks the notes are.
 */
import { CURVE_PX, SLUR_ARCH_TILT } from './curveStyle'

/** One thing in the way, as a rectangle in the staff's own space. y grows DOWN. */
export interface SlurObstacle {
  x: number
  y: number
  width: number
  height: number
}

/**
 * How much taller the arch has to be for the curve to clear everything under it, in px — `0` when it
 * already does, which is most slurs.
 *
 * `p0`/`p1` are the drawn endpoints, `archHeight` the control height the shape laws produced, and
 * `direction` −1 above / +1 below. Obstacles are filtered here rather than by the caller: only what
 * lies strictly BETWEEN the endpoints can be in the way, and only its edge facing the slur matters.
 */
export interface SlurArchLift {
  /** Extra height for the FIRST control point (the one nearer `p0`). */
  c0: number
  /** …and for the second. */
  c1: number
}

export function slurArchClearance(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  archHeight: number,
  direction: number,
  obstacles: readonly SlurObstacle[],
  /** Lifts already applied to the two controls — pass the result back in to check the answer, which
   *  is what the spec does and what an iterating caller would do (ours does not iterate). */
  applied: SlurArchLift = { c0: 0, c1: 0 },
): SlurArchLift {
  const span = p1.x - p0.x
  if (span === 0) return { c0: 0, c1: 0 }

  // ⚠️⚠️ **SAMPLE THE REAL CURVE, both times it would have been tempting not to.**
  //
  // (1) The arch LEANS: `slurArchCps` offsets its two controls by `±SLUR_ARCH_TILT · dy`, so a
  //     symmetric cubic is not what gets drawn. Solving against one under-lifts a slur whose worst
  //     obstacle sits toward its low end — his report, 2026-08-16, where the term was 0.44 sp
  //     against a 0.25 sp margin.
  // (2) x does NOT run linearly with t: with controls a quarter of the span in, `x(0.25)` lands at
  //     0.227 of the span, so reading `t` off an obstacle's x misplaces it by ~2% of the span — most
  //     of a staff space on a long slur, and worst where the curve is steepest.
  //
  // Sampling costs 64 evaluations per slur and removes both. The curve is convex, so the sample
  // nearest each obstacle is the one that matters.
  const dy = p1.y - p0.y
  const h0 = archHeight + SLUR_ARCH_TILT * dy * direction + applied.c0
  const h1 = archHeight - SLUR_ARCH_TILT * dy * direction + applied.c1
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

  const lift: SlurArchLift = { c0: 0, c1: 0 }
  for (const box of obstacles) {
    const left = Math.min(box.x, box.x + box.width)
    const right = Math.max(box.x, box.x + box.width)
    // The obstacle's edge facing the slur, plus air.
    const edge = direction === -1 ? box.y : box.y + box.height
    const wanted = edge + direction * CURVE_PX.slurObstacleMargin

    for (const s of samples) {
      if (s.t <= 0 || s.t >= 1) continue
      if (s.x < left || s.x > right) continue
      const deficit = (s.y - wanted) * direction * -1
      if (deficit <= 0) continue
      // How much say each control has where this obstacle is (Verovio's two coefficients).
      const mt = 1 - s.t
      const w0 = 3 * mt * mt * s.t
      const w1 = 3 * mt * s.t * s.t
      const norm = w0 * w0 + w1 * w1
      if (norm <= 0) continue
      lift.c0 = Math.max(lift.c0, (deficit * w0) / norm)
      lift.c1 = Math.max(lift.c1, (deficit * w1) / norm)
    }
  }
  return lift
}

