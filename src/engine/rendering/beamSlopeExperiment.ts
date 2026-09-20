/**
 * ⚠️⚠️ **AN EXPERIMENT, AND IT IS HIS** (2026-09-01) — *"lets not fix the rule, but leave it open, i
 * would like to test the three engine solutions… so we can in the future test the posibilities and
 * try an optimal solution"*.
 *
 * ⭐⭐ **THE POINT: how steep a beam should be is an OPEN question, and the instrument that settles one
 * is his eye on his own music.** `docs/research/beam-slope-research.md` measured four treatises and three
 * engines; the engines answer three different ways and the books' own plates disagree with the
 * books' own numbers (Gould draws a 7th at 1 space where the tables give ½). ⛔ So instead of the
 * rule being frozen by whoever wrote the code first, the rule is a **table** in
 * `engrave/beams/beamSlope` and this file is which row is armed.
 *
 * ```js
 *   __beams.rule('vexflow')   // what we drew before P4b — the ANGLE cap
 *   __beams.rule('tables')    // Ross p. 102 / MuseScore's two tables (today's)
 *   __beams.dump()            // what is armed, and every rule's budget side by side
 *   __beams.reset()
 * ```
 *
 * ⛔ **It changes NOTHING by default** — `ACTIVE_BEAM_SLOPE_RULE` is what a session that never opens
 * the console draws.
 *
 * ⛔ **`dev/` may not be imported by `engine/`** (CLAUDE.md's layer arrow), so the seam is this way
 * round: the ENGINE owns the setting, `dev/beamSlopeConsole.ts` writes it, `App.ts` wires it — the
 * same shape as `./slurShapeExperiment` and `engine/RenderProbe.ts`.
 *
 * ⭐ And {@link beamSlopeGeneration} is in the renderer's VIEW key, because a slope is a PICTURE
 * change with no model change: without it `isRenderStale()` answers *"no"* and the console call
 * draws nothing at all (`reference_only_a_stale_render_runs`). ⛔ Not the LAYOUT key — a beam's
 * slope takes no width, so the casting-off cannot depend on it.
 *
 * ⏭️ **THE TWO ROWS THAT ARE NOT WRITTEN YET** are the reason this exists at all: LilyPond's
 * (least squares → `0.6·tanh(s)/damping` → quanting) and Verovio's (a step ladder). Both are
 * measured in the research doc §4, ⛔ and both need the seam widened from a BUDGET to a CHOSEN rise
 * first — see `engrave/beams/beamSlope`'s header for the one line that costs.
 */
import { ACTIVE_BEAM_SLOPE_RULE, BEAM_SLOPE_RULES, type BeamSlopeRuleName } from '@/engine/engrave/beams/beamSlope'

const state = {
  rule: ACTIVE_BEAM_SLOPE_RULE,
  /** Bumped on every write — see the header: a picture-only change must reach the render key. */
  generation: 0,
}

/** Which rule the renderer should ask. ⭐ Read by `./EngravedBeam`, once per beam, at postFormat. */
export function armedBeamSlopeRule(): BeamSlopeRuleName {
  return state.rule
}

/** What is armed right now — for the console's read-back, and for a spec. */
export function beamSlopeSettings(): { rule: BeamSlopeRuleName; generation: number } {
  return { ...state }
}

/** ⚠️ In the renderer's VIEW key, so arming a rule actually redraws (see the header). */
export function beamSlopeGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ Unknown names are REFUSED rather than silently ignored — a console typo that looked
 *  like it worked would be the worst possible instrument. */
export function setBeamSlopeRule(rule: BeamSlopeRuleName): boolean {
  if (!(rule in BEAM_SLOPE_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetBeamSlope(): void {
  state.rule = ACTIVE_BEAM_SLOPE_RULE
  state.generation++
}
