/**
 * ⭐⭐ **HOW STEEP A BEAM MAY BE — P4b** (`docs/beam-slope-research.md`,
 * `docs/beam-engraving-plan.md`).
 *
 * ## ⭐⭐ THE ALGORITHM IS DELIBERATELY OPEN — this is a TABLE OF RULES, not a rule
 *
 * ⛔ **The question "what is the best beam-slope algorithm?" is NOT settled here, and is not meant
 * to be** (his call, 2026-09-01: *"lets not fix the rule, but leave it open, i would like to test the
 * three engine solutions"*). The three engines answer it three different ways and
 * `docs/beam-slope-research.md` §4 measures all three; ⭐ **each is a ROW that can be added here and
 * compared against the others on the same page**, which is the whole shape of this module.
 *
 * | row | what it is | state |
 * |---|---|---|
 * | `vexflow` | the ANGLE cap — `maxSlope 0.25`, a rise of a quarter of the run | ✅ **THE ACTIVE ONE, his call** |
 * | `musescore` | ⭐ **Ross p. 102 / MuseScore's two integer tables** — the smaller of the interval's budget and the width's | ✅ built |
 * | `interval` | the same interval table with Gould's close-notes flattening left OUT — a hybrid, ⛔ nobody's engine | ✅ built |
 * | `lilypond` | `0.6·tanh(slope)/damping` | ✅ built, ⚠️ the damping only — see the row |
 * | `verovio` | a step ladder in half-spaces, with a duration guard | ✅ built |
 *
 * ⚠️ **What the seam can and cannot express today, stated so the door is visibly open.** A rule here
 * returns a **BUDGET** — the most the beam may climb — and VexFlow's own solver then picks the best
 * slope within it, which is what keeps its stem-safety behaviour (a beam never cuts through an inner
 * note's stem). ⛔ **A rule that wants to CHOOSE the rise outright rather than bound it** — LilyPond's
 * damping and Verovio's step ladder both do — needs one more line in the adapter:
 * `EngravedBeam.postFormat` would assign `this.slope` after `super.postFormat()` and call
 * `applyStemExtensions()` again. That is a small change *inside this seam*, ⛔ not a redesign — and it
 * is deliberately not written until somebody is actually comparing the two.
 *
 * ## What the active rule says, in one sentence
 *
 * > **A beam may climb by the smaller of what its INTERVAL earns and what its WIDTH earns.**
 *
 * Both budgets are counted in **quarter-spaces**, because that is the unit the tradition is written
 * in — Ross's chart, Gould's ¼/½/1, MuseScore's integers.
 *
 * ⭐⭐ **And the width budget is the one that bites here**, because this editor already spaces music by
 * Gould's own law (`layout/spacing`, 3.5 × √t ⇒ **2.47 spaces for a quaver**) and her beam rule says
 * that below three spaces a beam takes *"only a slight angle (¼ or ½ space) regardless of the
 * interval"*. ⭐ The two rules are from the same book and they compose: tight spacing ⇒ flat beams.
 */

/**
 * What a beam looks like to a slope rule. ⛔ Plain numbers — no `StaveNote`, no stave, no pixels:
 * the adapter (`rendering/EngravedBeam`) is what knows how to measure these.
 */
export interface BeamShape {
  /** ⭐ The outer notes' distance in **DIATONIC STEPS**: 1 = a second, 7 = an octave, 8+ beyond. */
  intervalSteps: number
  /** First stem to last stem, in **staff spaces**. */
  widthSpaces: number
  /** How many notes the beam spans. ⭐ Verovio's rule branches on it. */
  noteCount: number
  /**
   * ⭐ How far the beam would climb if it simply joined the two outer stem TIPS, in staff spaces —
   * VexFlow's `initialSlope × width`, unsigned. ⛔ Only LilyPond's rule reads it; the tables do not,
   * because a table's whole point is that the interval decides, not the drawing.
   */
  naturalRiseSpaces: number
  /**
   * How many beam lines this group carries: 1 = quavers, 2 = semiquavers, 3 = demisemiquavers…
   * ⭐ Verovio refuses a quarter-space step once there are three, which is Gould p. 21 arrived at
   * from the other side: *"with the addition of a third beam, the beams must slant a whole
   * stave-space"*.
   */
  beamCount: number
}

/** ⭐ A rule answers ONE question: **how far may this beam climb, end to end, in staff spaces?** */
export type BeamSlopeRule = (shape: BeamShape) => number

/** The tradition's unit. Every number below is a count of these. */
const QUARTER_SPACE = 0.25

/**
 * ⭐ **Ross p. 102, as MuseScore encodes it** (`_maxSlopes`, `beamtremololayout.cpp`): index = the
 * interval in diatonic steps, value = quarter-spaces. A 2nd ¼ · 3rd ½ · 4th ¾ · 5th 1 · 6th 1¼ ·
 * 7th 1½ · an octave or more 1¾.
 *
 * ⚠️ Ross gives RANGES (*"a third … from one-half space to one space"*) and this is their **low end**,
 * which is also what MuseScore ships and what Gould's own plate draws for a 3rd (measured 0.46 sp at
 * 4.4 spaces' width — this table and {@link WIDTH_QUARTERS} both say ½ there ✅).
 *
 * 🚨 **Where the tables and her plate part company: her 7th.** She draws it at **1 space** (width 4.8);
 * this table alone would give 1½, and with the width rule applied the pair gives **½** — so the two
 * engines-and-Ross reading is *half* of what Gould engraved in that example. ⛔ Not resolved, and
 * ⛔ not a reason to bend a number: it is one of the reasons the algorithm is
 * `docs/beam-engraving-plan.md`'s **open** question rather than a settled one.
 */
const INTERVAL_QUARTERS = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * ⭐ **The horizontal-distance rule** — Gould p. 20 (*"closer than three spaces … ¼ or ½ regardless
 * of the interval"*) and Ross p. 101 (*"between three or four spaces apart to use normal beam
 * slanting"*), as MuseScore's ladder. `[below this many spaces, this many quarter-spaces]`.
 */
const WIDTH_QUARTERS: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [5, 2], [7.5, 3], [10, 4], [15, 5], [20, 6],
]
/** Past the last rung. */
const WIDEST_QUARTERS = 7

/** ⭐ VexFlow's `renderOptions.maxSlope`, which is what every beam here obeyed before P4b. */
const VEXFLOW_MAX_SLOPE = 0.25

const byInterval = (steps: number): number =>
  INTERVAL_QUARTERS[Math.min(Math.max(Math.round(steps), 0), INTERVAL_QUARTERS.length - 1)] * QUARTER_SPACE

const byWidth = (spaces: number): number =>
  (WIDTH_QUARTERS.find(([below]) => spaces < below)?.[1] ?? WIDEST_QUARTERS) * QUARTER_SPACE

/**
 * ⭐⭐ **THE ROWS.** ⛔ Adding one is the point of this module; changing which one is ACTIVE is one
 * word ({@link ACTIVE_BEAM_SLOPE_RULE}).
 */
export const BEAM_SLOPE_RULES = {
  /**
   * What shipped before P4b: VexFlow caps the **ANGLE**, so the climb it allows grows with the bar.
   * ⚠️ Every treatise caps the CLIMB instead and lets the angle relax as notes spread — which is why
   * this row is kept as a comparison rather than as an opinion.
   */
  vexflow: shape => VEXFLOW_MAX_SLOPE * shape.widthSpaces,

  /**
   * ⭐⭐ **MUSESCORE** — `rendering/score/beamtremololayout.cpp`, its two integer tables:
   *
   * ```c++
   * slant = min( maxSlopeByWidth, _maxSlopes[interval] ) * dir;   // in QUARTER-spaces
   * ```
   *
   * ⭐ Every number in the interval table is **Ross p. 102's low end**, and the width ladder's first
   * rung is **Gould p. 20's** *"closer than three spaces"* — which is why this row is the tradition
   * as much as it is one engine.
   *
   * ⚠️ **TWO DIVERGENCES, ⛔ so do not read this row as "MuseScore" whole.**
   * 1. ⛔ **No `getSlopeConstraint`.** MuseScore forces a beam **FLAT** when any inner note is more
   *    extreme than the outer ones, with one exception worth a quarter-space (`SMALL_SLOPE`) — the
   *    concave rule, which is also G&L's *"horizontal beams may be used if inner notes do not follow
   *    the interval direction of the outer notes"*. ⚠️ This seam sees only the OUTER notes
   *    ({@link BeamShape}), so the rule cannot be stated here yet.
   * 2. ⛔ **No line attachment** (`addMiddleLineSlant`, `add8thSpaceSlant`). That is the rule all four
   *    treatises agree on and it belongs with **P3e**, because it moves stem lengths.
   */
  musescore: shape => Math.min(byInterval(shape.intervalSteps), byWidth(shape.widthSpaces)),

  /**
   * ⭐⭐ **THE MIDDLE GROUND — Ross's interval table with Gould's width rule LEFT OUT**, added
   * 2026-09-01 within minutes of `tables` reaching his screen: *"(to my eyes the angle looks too
   * flat now)"*.
   *
   * ⚠️ **The width rule is what flattens everything here**, because our quavers stand 2.47 spaces
   * apart (Gould's own spacing law) and her threshold is *"closer than three spaces"* — so every
   * ordinary beam lands on the flattest rung, ¼ space, whatever its interval. 🚨 And there is a real
   * question underneath his reaction: **"three spaces apart" is not defined in the book** — stem to
   * stem (what we measure), notehead centre to centre, or the white gap between the heads are three
   * different numbers, and only the first puts us under the threshold by so much.
   *
   * ⇒ This row keeps the interval budget (2nd ¼ · 3rd ½ · 4th ¾ · 5th 1 · 6th 1¼ · 7th 1½ · 8ve 1¾)
   * and lets the beam use it however close the notes are.
   */
  interval: shape => byInterval(shape.intervalSteps),

  /**
   * ⭐⭐ **LILYPOND** — `lily/beam-quanting.cc::slope_damping`, read at source:
   *
   * ```c++
   * slope = 0.6 * tanh (slope) / (damping + concaveness);   // damping defaults to 1
   * ```
   *
   * ⭐ Two rules in one line: shallow slopes are **damped to 60%** (`tanh s ≈ s` near zero), and steep
   * ones **saturate** — `tanh` can never exceed 1, so the budget approaches 0.6 × the width however
   * wild the pitches get.
   *
   * ⚠️ **THREE HONEST DIVERGENCES, ⛔ do not read this row as "LilyPond".**
   * 1. ⛔ **No concaveness.** `calc_concaveness()` raises the divisor when inner notes contradict the
   *    outer direction, flattening such beams toward horizontal. Here it is 0, so this row is
   *    *steeper* than LilyPond on exactly the shapes MuseScore forces flat.
   * 2. ⛔ **No quanting and no demerits.** The real thing then snaps both ends onto `sit` / `inter` /
   *    `hang` and scores the candidates. That is a CHOICE of rise, and this seam only offers a
   *    BUDGET — see the header.
   * 3. ⛔ **No `set_minimum_dy`.** LilyPond pushes any nonzero rise up to the smallest legal quant
   *    (≈0.19 sp with Bravura's weights): it will not draw a rise smaller than one attachment step.
   *    A budget cannot express a floor.
   */
  lilypond: shape => (shape.widthSpaces > 0
    ? Math.abs(0.6 * Math.tanh(shape.naturalRiseSpaces / shape.widthSpaces)) * shape.widthSpaces
    : 0),

  /**
   * ⭐⭐ **VEROVIO** — `src/beam.cpp::CalcBeamSlopeStep`, transcribed with its branches intact.
   * ⚠️ Its `unit` is **half a staff space**, so every number there is halved here.
   *
   * ⭐ It reads as a cap rather than a target in its own caller, which is why it fits this seam:
   * *"We can keep the current slope but only if curStep is not 0 and smaller than the step"* — i.e.
   * a group whose stems already sit flatter than the step keeps what it has.
   */
  verovio: shape => {
    const { noteCount, widthSpaces, intervalSteps, beamCount } = shape
    let step = 2          // the default maximum: 4 units
    let shortStep = false
    if (noteCount === 2) {
      step = 1                                     // 2 units
      if (widthSpaces <= 3) { step = 0.25; shortStep = true }   // "short distance" — 6 units
    } else if (noteCount === 3) {
      if (widthSpaces <= 6) step = 1               // 12 units
      else if (intervalSteps <= 4) step = 1        // "a fifth or smaller"
    } else {
      if (intervalSteps < 3) { step = 0.25; shortStep = true }  // "a fourth or smaller"
      else if (intervalSteps <= 4) step = 1
    }
    // ⭐ *"Prevent short step with values not shorter than a 16th"* — a group carrying three beam
    //   lines or more may not take the quarter-space step.
    if (shortStep && beamCount >= 3) step = 1
    return step
  },
} satisfies Record<string, BeamSlopeRule>

export type BeamSlopeRuleName = keyof typeof BEAM_SLOPE_RULES

/**
 * ⭐⭐ **WHICH RULE IS RUNNING — `'vexflow'`, HIS CALL, 2026-09-01.**
 *
 * > *"i prefer vexflow angle for the moment… interval is really angled so is not nice"*
 *
 * ⭐⭐ **So P4b ships moving NO PIXEL.** He looked at all three on his own music: `tables` read *"too
 * flat"*, `interval` *"really angled"*, and the angle cap we already had is the one his eye keeps.
 * ⛔ That is a verdict on a PICTURE, ⛔ not a finding that the treatises are wrong — the two things
 * this session could not settle are whether our 2.47-space quaver spacing is what the books assume,
 * and whether *"closer than three spaces"* is even measured the way we measure it
 * (`docs/beam-engraving-plan.md`).
 *
 * ⛔ Not a setting, not state, not a preference — one identifier, so that swapping algorithms to
 * compare them is a one-word edit and `npm run dev`.
 *
 * ⏭️ If comparing them by eye on the same page becomes the job, the next step is a dev-only setter;
 * ⛔ deliberately not built before somebody wants it.
 */
export const ACTIVE_BEAM_SLOPE_RULE: BeamSlopeRuleName = 'vexflow'

/** ⭐ How far this beam may climb, in staff spaces. */
export function beamRiseCap(
  shape: BeamShape,
  rule: BeamSlopeRuleName = ACTIVE_BEAM_SLOPE_RULE,
): number {
  return BEAM_SLOPE_RULES[rule](shape)
}
