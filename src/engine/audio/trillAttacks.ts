/**
 * ⭐⭐ **WHAT A TRILL SOUNDS LIKE** — one sounding note becomes an alternation between it and the
 * note above (docs/trill-plan.md §7, P5).
 *
 * Pure arithmetic over numbers, deliberately: `collectScheduledNotes` decides WHICH notes trill and
 * with what auxiliary, and this decides only how the alternation is laid out in time. That split is
 * what makes the rate testable without a score.
 *
 * ## The rate is a PHYSICAL SPEED, not a note value
 *
 * ⭐ A trill is **unmeasured**: nothing in the notation says how many notes it contains, and a
 * performer plays it about as fast as the instrument and the passage allow. So the period is stated
 * in SECONDS and converted to beats at the trill's own onset — the same reasoning, and the same
 * machinery, as an unmeasured tremolo's `UNMEASURED_PERIOD_SECONDS`. State it in beats instead and a
 * trill would slow down in a slow passage, which is not what a trill does.
 *
 * ⛔ **Not derived from the written duration.** A trill on a semibreve and a trill on a quaver run at
 * the same speed; only their LENGTHS differ. That is exactly what a measured tremolo does NOT do,
 * and it is why this module cannot reuse `tremoloPeriodFrom`.
 */
import type { PitchSpelling } from '@/types/music'

/** A single attack of the alternation, in the caller's own units. */
export interface TrillAttack {
  /** ⭐ A PITCH, not a MIDI number — `ScheduledNote.pitch`'s reason, and this module hands its
   *  attacks straight to it (docs/playback-semantics-plan.md). It is never read here: the two
   *  pitches are opaque values this function alternates between, which is what keeps the rate
   *  testable without a score and would keep it working for a microtonal auxiliary. */
  pitch: PitchSpelling
  startBeats: number
  durationBeats: number
}

/**
 * ⭐ **How fast a trill goes, in SECONDS per note.** 0.08 s ≈ 12 notes a second.
 *
 * ⚠️ **By ear, and one of the numbers this feature is waiting on his ear for.** There is no rule to
 * derive it from — the honest range for a real player is roughly 8–14 notes a second depending on
 * instrument, register and dynamic, and a single constant can only sit somewhere in it. Faster than
 * an unmeasured tremolo's 0.05 s would be wrong (a tremolo is "as fast as possible"; a trill is
 * fast but shaped), and much slower reads as a written-out turn.
 *
 * ⏭️ A per-trill speed is docs/trill-plan.md §9's row: an optional field read here, where this
 * constant is now.
 */
export const TRILL_PERIOD_SECONDS = 0.08

/**
 * Lay a trill's alternation over a sounding span.
 *
 * ⭐ **Starts on the MAIN note** — the modern default. Beginning on the auxiliary is the Baroque
 * reading (MuseScore offers it as an option), and it is a per-trill choice if it is ever wanted, not
 * a different algorithm: it is this function with the two pitches swapped.
 *
 * ⭐ **Fills what SOUNDS, not what is written** — so a trill on a note tied over a barline keeps
 * going, because the caller hands in the tie-extended length. The tremolo's rule, and the reason the
 * one-note trill needs no end anchor.
 *
 * ⚠️ **The last attack is CLAMPED to the end of the span**, never allowed to overhang it: a trill
 * that ran past its note would collide with whatever follows, and the ear hears the overhang as a
 * wrong note rather than as a long trill.
 *
 * @param periodBeats one alternation step, already converted from seconds at this onset
 * @returns the attacks, in order; empty when the span or the period is not positive
 */
export function trillAttacks(params: {
  mainPitch: PitchSpelling
  auxPitch: PitchSpelling
  startBeats: number
  durationBeats: number
  periodBeats: number
  /** The articulation's length factor, applied per attack as the tremolo does — so a staccato
   *  trill is a staccato trill. */
  durationFactor?: number
}): TrillAttack[] {
  const { mainPitch, auxPitch, startBeats, durationBeats, periodBeats } = params
  const factor = params.durationFactor ?? 1
  if (!(durationBeats > 0) || !(periodBeats > 0)) return []

  const out: TrillAttack[] = []
  // ⚠️ A tolerance on the LAST step, so a span that divides exactly into the period does not gain a
  // final attack of near-zero length from floating-point drift. The tremolo's `PERIOD_EPSILON`, kept
  // local because it is a property of this loop rather than a shared constant.
  const epsilon = periodBeats * 1e-6
  let t = 0
  let onMain = true
  while (t < durationBeats - epsilon) {
    out.push({
      pitch: onMain ? mainPitch : auxPitch,
      startBeats: startBeats + t,
      durationBeats: Math.min(periodBeats, durationBeats - t) * factor,
    })
    t += periodBeats
    onMain = !onMain
  }
  return out
}
