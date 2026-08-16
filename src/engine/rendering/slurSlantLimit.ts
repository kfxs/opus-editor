/**
 * ⭐⭐ **HOW STEEP A SLUR MAY BE, AND WHAT STEEPNESS DOES TO ITS SHAPE** (docs/slur-plan.md §12
 * Phase 6). Two rules, one subject — and they are the opposite kinds of thing, which is why the file
 * says so twice.
 *
 * ⚠️⚠️ **THE CEILING IS OURS. NO BOOK GIVES ONE.** §11.10 recorded it as *"not open, because no
 * authority exists"*, and that has not changed: Gould, Gedan and Ross all say a slur must FOLLOW the
 * melodic line and none of them caps the angle. LilyPond's `max-slope` 1.1 (≈48°) is a scoring
 * PENALTY — a steep slur still wins if every alternative is worse — and Verovio's 60° is a hard
 * correction. **HIS CALL, 2026-08-16:** *"in this case we beguin with verovio choice… but it should
 * not be a truth.. maybe we tweak it later"*. So the honest citation for the number below is
 * **"Verovio's default, adopted by him"**, and nothing more. ⛔ It is not an engraving rule, and it
 * must never be written up as one — a taste number does not acquire a source by sitting in a
 * codebase.
 *
 * ⭐ **The second rule is not taste at all, and it is worth having for its own sake:** a short,
 * steeply tilted slur is deliberately made ROUNDER (Verovio's `GetMinControlPointAngle`,
 * `adjustslursfunctor.cpp:944`). It is the only genuine slant→shape coupling anywhere in the
 * research — nothing in any of the three engines does the reverse — and it pairs with Phase 2, which
 * flattened our short slurs and so made the steep ones likelier to need it.
 *
 * ⛔ **Both land AFTER Phase 1, never before.** Our worst slants were never the music's: the old
 * stem-tip attachment invented them, drawing a rising second as a 3 sp descent. A ceiling on top of
 * that would have clamped a fault instead of fixing it, and hidden the evidence that it was there.
 */
import { SLUR_MAX_SLANT_DEG, CURVE_PX } from './curveStyle'

const DEG = Math.PI / 180

/**
 * Raise the LOWER endpoint until the slur's tilt is within the ceiling — Verovio's
 * `GetAdjustedSlurAngle` (`src/slur.cpp:567–597`), which moves an endpoint rather than rotating the
 * curve, so the arc keeps its shape and only its ends change.
 *
 * ⚠️ **With a cap Verovio does not have.** Its version can walk an endpoint arbitrarily far from the
 * note it belongs to; Gould gives a MINIMUM of ½ sp from the notehead and no maximum, and the
 * practitioners' remedy for a steep slur was to shift the tip **sideways** by half a notehead
 * (notat.io t=861, from Cortot's and Mikuli's Chopin) rather than to lift it. So the travel is
 * bounded by {@link CURVE}.slurSlantMaxTravel — ⚠️ also ours, also provisional.
 *
 * `y` grows DOWN; `direction` is −1 above / +1 below. Returns both ys, unchanged when the slur is
 * already within the ceiling — which is almost every slur.
 */
export function limitSlurSlant(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { fromY: number; toY: number } {
  const span = Math.abs(to.x - from.x)
  const rise = Math.abs(to.y - from.y)
  if (span === 0) return { fromY: from.y, toY: to.y }

  const maxRise = span * Math.tan(SLUR_MAX_SLANT_DEG * DEG)
  if (rise <= maxRise) return { fromY: from.y, toY: to.y }

  // The lower end (larger y) rises until the tilt is exactly the ceiling — or until it has travelled
  // as far from its own note as we allow, whichever comes first.
  const wanted = rise - maxRise
  const travel = Math.min(wanted, CURVE_PX.slurSlantMaxTravel)
  return from.y > to.y
    ? { fromY: from.y - travel, toY: to.y }
    : { fromY: from.y, toY: to.y - travel }
}

/**
 * ⏭️⏭️ **THE OTHER HALF OF PHASE 6 IS NOT BUILT, AND HERE IS WHAT IT COSTS** — Verovio's
 * `GetMinControlPointAngle` (`adjustslursfunctor.cpp:944`): the angle between the endpoint line and
 * a control point is at least **30°**, raised by up to **+15°** in proportion to the tilt
 * (`tilt / 4`), scaled by a length factor full below 4 sp of span and zero above 8. In one sentence:
 * a short, steeply tilted slur is made rounder — the only slant→shape coupling in the whole
 * research, and the natural partner to Phase 2.
 *
 * **It was built, measured, and taken back out**, because porting it is three problems, not one:
 *
 * 1. 🚨 **The FRAME.** Verovio rotates the curve so the endpoint line is horizontal and measures
 *    there; our arch is lifted VERTICALLY above that line, so a slur tilted by θ deviates
 *    perpendicular by only `H·cos θ`. A floor written in our frame moved the drawn control angle
 *    from 20° to 26° where the rule asks for 39.6 — it *looked* implemented and was not.
 * 2. 🚨 **The ASYMMETRY.** Done properly the requirement is `H ≥ (span/4)·tan(θ + minAngle) −
 *    0.25·|dy|`, which is not symmetric: the tilt eats the angle on one side and adds it on the
 *    other. Verovio has two rules for this (`minSlopeLeft` / `minSlopeRight`) and we have one arch.
 * 3. 🚨 **The SIZE.** Solved on a real fixture — a 3.5 sp span tilted 38° — it asks for a **2.5 sp
 *    apex**, three times what the height law gives. Verovio's own escape valve is a `shiftedMidpoint`
 *    that stops the rule once the midpoint would rise more than 3 sp, and porting the rule without
 *    it is how you get a semicircle over a leap.
 *
 * ⛔ So this is a shape decision of its own, not an import, and it needs his eye like the rest of
 * Phase 6. The ceiling above is independent of it and lands on its own.
 */
