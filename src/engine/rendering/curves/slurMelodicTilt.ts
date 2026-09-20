/**
 * ⭐⭐ **A SLUR MAY NOT TILT AGAINST ITS OWN MELODY** — the last rule of the endpoint chain, and the
 * one that made his eye prefer his own numbers to ours (2026-08-17).
 *
 * > Gould p. 112: *"**The whole slur should tilt in the direction of the pitches.**"*
 *
 * ## The fault, measured
 *
 * Eight rising quarters, a slur from the 3rd (E4, up stem) to the 7th (B4, on the middle line, so a
 * DOWN stem). The start attaches at E4's stem tip — `./slurEncompass` put it there, because the
 * notes underneath reach higher — and the end at B4's notehead, because B4's stem points away. Drawn
 * that way the slur **descends 1.5 sp while the music rises a fifth**. Level the two ends and
 * nothing else changes: the same 0.5 sp of clearance over the covered stems, but the two control
 * lifts go from **2.12 / 5.19 sp** to **1.72 / 2.02 sp** and the apex drops 0.6 sp closer to the
 * staff. The lopsidedness was never the arch's fault — it was the arch paying for an endpoint left
 * behind, which is also why the fix reads on Gould's OTHER sentence (p. 109: *"the curve of a long
 * slur is flattened in order to be as close to the stave as possible"*). One fault, two symptoms.
 *
 * ## Where the rule comes from — ⚠️ one engine only, and it is a PREFERENCE there
 *
 * | engine | has it? |
 * |---|---|
 * | **LilyPond** | ⭐ **yes** — `score_slopes` (`slur-configuration.cc:519-523`) charges `same-slope-penalty` **20** when `sign(slur_dy) != sign(musical_dy)`, where `musical_dy_` is `y(last slurred notehead) − y(first slurred notehead)` (`slur-scoring.cc:334-341`) |
 * | **MuseScore** | ⛔ **no such term exists anywhere.** Its `SLANT_REDUCTION` block compares the slur's slope to HORIZONTAL, never to the music, so it would flatten a correctly-tilted slur just as readily |
 * | **Verovio** | ⛔ its melodic-direction rule (`ConsiderMelodicDirection`, `slur.cpp:1009`) is fenced to **broken slurs**, and only ever moves the DANGLING end at a system edge |
 *
 * ⭐⭐ **LilyPond states a BAND, not a target**, and that is what decides how far this goes. Its two
 * slope terms confine the drawn rise to `slur_dy ∈ [0, sign(dy)·(|dy| + 0.2 sp)]`: leave it on the
 * near side and you pay 20 for sloping the wrong way; leave it on the far side and you pay 50 per
 * staff space for out-running the music. **Nothing in it demands that a rising phrase's slur rise.**
 * So levelling is not a timid half-measure that we might later replace with "tilt with the melody" —
 * it IS the published rule's near edge, and the only edge our case is outside.
 *
 * ⛔ **What we deliberately do NOT take: the band's FAR edge.** `|slur_dy| ≤ |musical_dy| + 0.2` is
 * equally sourced and equally cheap, but the job is already held by `./slurSlantLimit` under HIS
 * number, and two ceilings on one quantity is how a rule stops being explainable. If that constant
 * is ever revisited, this is the published alternative.
 *
 * ⚠️ **And it is a clamp where LilyPond has a demerit.** 20 points is outvoted there by
 * `head-encompass-penalty` 1000, so LilyPond will draw a wrong-way slur rather than run through a
 * notehead. We have no scores to be outvoted by — one feed-forward pass, no search — so ours is
 * harder than the source. That is a real difference and it is recorded rather than smoothed over:
 * the clamp only ever moves an endpoint FURTHER from the staff, so it cannot create the collision
 * LilyPond's veto exists to prevent, and `./slurObstacles` runs afterwards on the moved endpoints.
 */
import type { SlurAttachment } from './slurStemEndpoint'

/** The chord note the arc springs from on this side — the same choice `slurStemEndpoint` makes. */
function headOn(a: SlurAttachment, direction: number): number {
  return direction === -1 ? Math.min(...a.headYs) : Math.max(...a.headYs)
}

/**
 * Raise whichever endpoint is leaving the slur tilted against the pitches, so that it is level.
 * Returns both ys unchanged when the slur already agrees with its melody — which is nearly always.
 *
 * ⭐ **WHICH end moves is Verovio's**, the one part of its slant handling that is not fenced to
 * broken slurs: `GetAdjustedSlurAngle` (`slur.cpp:567-596`) always raises the LOWER endpoint toward
 * the higher (`p1.y = p2.y - side` / `p2.y = p1.y - side` for a slur above) and never pulls the
 * higher one down. Outward-only is what keeps this composable with everything before it: an endpoint
 * that `./slurEncompass` pushed out to a stem tip is never dragged back in, and the arch solve that
 * follows only ever has less to do.
 *
 * @param direction −1 above / +1 below.
 */
export function tiltWithThePitches(
  from: SlurAttachment,
  to: SlurAttachment,
  fromY: number,
  toY: number,
  direction: number,
): { fromY: number; toY: number } {
  // ⚠️ The MELODY is the two anchored NOTEHEADS, never the attachment points — LilyPond's
  // `musical_dy_` is computed once, off the heads, before any candidate geometry exists. Reading it
  // off the attachments instead would compare the slur to itself: the very tilt under test comes
  // from one end sitting on a stem tip and the other on a notehead.
  const musicalDy = headOn(to, direction) - headOn(from, direction)
  const slurDy = toY - fromY
  if (musicalDy === 0 || slurDy === 0) return { fromY, toY }
  if (Math.sign(slurDy) === Math.sign(musicalDy)) return { fromY, toY }
  // Level them by moving the end nearer the staff outward: for a slur above that is the one with the
  // larger y, and "outward" is the smaller of the two.
  const level = direction === -1 ? Math.min(fromY, toY) : Math.max(fromY, toY)
  return { fromY: level, toY: level }
}
