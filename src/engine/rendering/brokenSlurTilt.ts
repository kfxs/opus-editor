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
 * ⭐⭐ **THE OPEN END MUST CLEAR THE CLEF** — because a continuation starts at the system's BARLINE,
 * which puts it in the clef's column by construction.
 *
 * `y` is where the melodic lean put the open end, `staffTopY`/`staffBottomY` the staff's outer lines,
 * `direction` −1 above / +1 below. Returns the y moved outward far enough to clear the clef's ink,
 * or unchanged when it is already clear — which it is for most music, since a slur's fragment is
 * usually outside the staff anyway.
 *
 * ⚠️ **This is what makes the barline start SAFE**, and the pair is the whole answer to his two
 * reports: start at the margin so the fragment is not a 0.6 sp comma, and clear the clef so it is
 * not drawn through one.
 */
export function clearOfClef(
  y: number,
  direction: number,
  staffTopY: number,
  staffBottomY: number,
): number {
  const limit = direction === -1
    ? staffTopY - CURVE_PX.clefReachAbove - CURVE_PX.slurObstacleMargin
    : staffBottomY + CURVE_PX.clefReachBelow + CURVE_PX.slurObstacleMargin
  return direction === -1 ? Math.min(y, limit) : Math.max(y, limit)
}

/**
 * How far the OPEN end of a broken half rises above (or falls below) its own note's endpoint, in px
 * — the number that replaces a flat `slurArc`.
 *
 * `diatonicSteps` is `end − start` in diatonic steps: **positive when the music resumes higher**.
 * Never less than {@link CURVE}.brokenSlurMinRise, so a fragment can never flatten into something a
 * reader would take for a tie.
 */
export function brokenSlurOpenRise(
  diatonicSteps: number,
  half: BrokenSlurHalf,
  /** −1 above / +1 below. 🚨 The lean is toward the PITCH, so which side the slur is on flips it. */
  direction: number,
  /** How wide the fragment is, in px. A short one is held flat — see below. */
  lengthPx = Infinity,
): number {
  // 🚨🚨 **THE `-direction` IS THE WHOLE RULE, and leaving it out was a bug his eye caught.**
  // `rise` is measured along the slur's OWN side, so "up" is +rise above the staff and −rise below
  // it. Gould's lean is toward the PITCH, in absolute terms: a continuation that resumes HIGHER
  // raises the begin half's open end whether the slur arches above the notes or hangs below them.
  // Without this factor a slur BELOW a rising melody pushed its open end further DOWN — away from
  // the music — and he corrected it by hand by 2.25 sp before either of us knew why.
  const toward = half === 'begin' ? 1 : -1
  const tilt = toward * -direction * diatonicSteps * CURVE_PX.brokenSlurTiltPerStep
  const wanted = Math.max(CURVE_PX.slurArc + tilt, CURVE_PX.brokenSlurMinRise)
  // ⭐ THE TWO CLAMPS, and they are what keep this rule from drawing the two shapes his eye caught:
  //   • a SHORT fragment is FLAT, never a comma — the rise may not exceed the fragment's own length
  //     times `brokenSlurMaxSlope`. A slur ending on the first note of a system has almost no room,
  //     and a full space of drop across 0.6 of one reads as a tick at 60°, not as a slur.
  //   • a LONG one does not run away — the open end stops at `brokenSlurMaxRise`, so a wide interval
  //     leans without leaving a hole between the last note and the margin.
  return Math.min(wanted, lengthPx * BROKEN_SLUR_MAX_SLOPE, CURVE_PX.brokenSlurMaxRise)
}
