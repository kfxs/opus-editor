/**
 * ⭐⭐ **A SLUR BROKEN BY A SYSTEM BREAK MUST LEAN TOWARD ITS OWN MUSIC** (docs/slur-plan.md §12
 * Phase 5) — the last of the *published* rules this plan found unbuilt.
 *
 * > Gould p. 112: *"**The whole slur should tilt in the direction of the pitches.** A slur starting
 * > on the last note of a system or finishing on the first note of a system must be **angled in the
 * > direction of the final pitch** on the new system, so as to look clearly open-ended (this
 * > differentiates an open-ended slur from an open-ended tie)."*
 *
 * Ours was a flat `slurArc`, the same rise for both halves, with **no pitch input at all** — the only
 * one of the three engines with no opinion, and she says we should have one. LilyPond switches its
 * melodic slope rules *off* for a broken half; Verovio implements her sentence directly, and this is
 * Verovio's, read at source (`src/slur.cpp:924–975`).
 *
 * ⭐ **The rule.** The open end moves by **0.25 sp per diatonic step** of the interval between the
 * slur's two anchored notes (Verovio's `pitchDiff * unit / 2`, where its `unit` is half a space):
 * the BEGIN half's open end rises with a continuation that goes higher, and the END half's open end
 * *falls* by the same amount, so the two fragments point at each other across the break and read as
 * one gesture.
 *
 * 🚨 **PITCH, never the drawn y** (§12.0 #5). The two ends are on different systems, so `toY − fromY`
 * is not a melodic interval — it is the distance between two staves plus whatever the page cast-off
 * did. Cross-system coordinates are not one ruler; the hairpin cost us that lesson already
 * (docs/dynamics-line-and-hairpins-plan.md).
 *
 * ⭐ **And the floor is Gould's own justification, in code.** Verovio: *"Make sure that broken slurs
 * do not look like ties"* — if the two ends of a half come out within a space of each other it forces
 * them apart. That is her parenthesis — *"this differentiates an open-ended slur from an open-ended
 * tie"* — as a number, which is the closest thing to a citation this phase has.
 *
 * ⛔ **MIDDLE segments are not this.** A system a slur merely passes over has no pitch of its own;
 * it stays a symmetric bow at a staff-relative baseline (`SlurRenderer`'s `middle` branch).
 */
import { BROKEN_SLUR_MAX_SLOPE, CURVE_PX } from './curveStyle'

/** Which open-ended fragment: the one that runs off the right edge, or the one that leads in. */
export type BrokenSlurHalf = 'begin' | 'end'

/**
 * ⭐⭐ **AND THE HEIGHT IT LEANS FROM IS THE MUSIC BESIDE IT, NOT A CONSTANT** — LilyPond's rule,
 * read at source, and the answer to *"the air in the measure before"* (his eye, 2026-08-16).
 *
 * A fixed outward base — ours was `slurArc`, 1.4 spaces off the ANCHORED note — makes the open end's
 * height depend on a note that may be at the far end of the system. On his figure the slur hung
 * below a rising `C4 D4 E4 F4`: anchored at the LOW C4, the open end was dragged **2.95 spaces below
 * the bottom line** while the music it was leaving had climbed to F4. That wedge of white IS the
 * "air", and no amount of tuning a constant removes it, because the constant is measured from the
 * wrong note.
 *
 * > **LilyPond `slur-scoring.cc`, the broken bound**: when an end has no note column of its own it
 * > takes `col = (d == LEFT) ? note_columns_[0] : note_columns_.back()` — **the nearest note column
 * > on its own system** — and sets `y = robust_relative_extent(col, Y_AXIS)[dir_]` then
 * > `y += dir_ * 0.5 * staff_space_`. The open end clears the music it is leaving, by the same half
 * > space an ordinary attachment clears its own head. ⭐ And when that column IS the other end
 * > (a fragment covering one note), it falls back to `base_attachment[-d]` — the anchored end's own
 * > height, i.e. FLAT.
 *
 * So `clearanceRise` is that height expressed in this function's unit, and the lean is measured from
 * it. The tilt then adds Gould's cross-break angle on top, and the two compose the way the sources
 * intend: **`max`** — the open end is at least clear of its own music, and further out if the music
 * on the next system is lower.
 */

/**
 * How far the OPEN end of a broken half sits **outward** (away from the staff) of its own note's
 * endpoint, in px. Negative is legal and is the whole point: an open end may sit CLOSER to the staff
 * than its anchor when the music it covers climbs away from it.
 *
 * `diatonicSteps` is `end − start` in diatonic steps: **positive when the music resumes higher**.
 */
export function brokenSlurOpenRise(
  diatonicSteps: number,
  half: BrokenSlurHalf,
  /** −1 above / +1 below. 🚨 The lean is toward the PITCH, so which side the slur is on flips it. */
  direction: number,
  /** How wide the fragment is, in px. A short one is held flat — see below. */
  lengthPx = Infinity,
  /**
   * ⭐ **LilyPond's floor**: how far outward the open end must be to clear the nearest covered note
   * on its own system by the endpoint lift. May be NEGATIVE — a fragment leaving music that has
   * climbed away from its anchor wants its open end CLOSER to the staff, which is the whole fix.
   *
   * ⭐ 0 — the default — is LilyPond's own one-note fallback: when the nearest column IS the other
   * end of the slur it takes `base_attachment[-d]`, the anchored end's own height, i.e. a flat
   * fragment leaning only by the cross-break tilt.
   */
  clearanceRise = 0,
): number {
  // 🚨🚨 **THE `-direction` IS THE WHOLE RULE, and leaving it out was a bug his eye caught.**
  // `rise` is measured along the slur's OWN side, so "up" is +rise above the staff and −rise below
  // it. Gould's lean is toward the PITCH, in absolute terms: a continuation that resumes HIGHER
  // raises the begin half's open end whether the slur arches above the notes or hangs below them.
  // Without this factor a slur BELOW a rising melody pushed its open end further DOWN — away from
  // the music — and he corrected it by hand by 2.25 sp before either of us knew why.
  const toward = half === 'begin' ? 1 : -1
  const tilt = toward * -direction * diatonicSteps * CURVE_PX.brokenSlurTiltPerStep
  // ⛔ No fixed base: the open end HUGS the music beside it (LilyPond), and Gould's cross-break lean
  // is added to that height.
  // ⭐⭐ **And the lean may only push it further OUT** — `max(tilt, 0)`. Inward is where the music is:
  // a fragment below a run climbing away from its anchor already sits as close to that run as it may
  // come, so a lean toward a higher continuation has nowhere to go. Which case counts as "outward"
  // flips with the side, so this is not an asymmetry in the rule, only in the coordinate.
  const wanted = clearanceRise + Math.max(tilt, 0)
  // ⭐ THE TWO CEILINGS, and they are what keep this rule from drawing the two shapes his eye caught:
  //   • a SHORT fragment is FLAT, never a comma — the rise may not exceed the fragment's own length
  //     times `brokenSlurMaxSlope`. A slur ending on the first note of a system has almost no room,
  //     and a full space of drop across 0.6 of one reads as a tick at 60°, not as a slur.
  //   • a LONG one does not run away — the open end stops at `brokenSlurMaxRise`, so a wide interval
  //     leans without leaving a hole between the last note and the margin.
  const rise = Math.min(wanted, lengthPx * BROKEN_SLUR_MAX_SLOPE, CURVE_PX.brokenSlurMaxRise)
  // ⭐ **"Make sure that broken slurs do not look like ties"** — Verovio's line, which is Gould's
  // parenthesis as code, and ⚠️ **it is CONDITIONAL on the fragment being short**: `(abs(y1 - y2) <
  // 2 * unit) && (abs(x1 - x2) < 2 * staffSize)` (`src/slur.cpp`). A long fragment that runs half a
  // system is in no danger of being read as a tie, and forcing a space of rise onto it was the other
  // half of the air. So the floor applies only inside `brokenSlurTieLikeSpan`.
  if (lengthPx < CURVE_PX.brokenSlurTieLikeSpan && rise < CURVE_PX.brokenSlurMinRise) {
    return Math.min(CURVE_PX.brokenSlurMinRise, lengthPx * BROKEN_SLUR_MAX_SLOPE)
  }
  return rise
}
