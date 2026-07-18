/**
 * Single source of truth for everything keyed by a {@link NoteDuration}.
 *
 * A note duration has three parallel representations in this codebase:
 *   - **beats**     — floating-point quarter-note beats, for VexFlow pixel math
 *                     and Tone.js scheduling (do NOT compare these with ===).
 *   - **fraction**  — exact rational beats, the canonical internal unit.
 *   - **vex**       — the VexFlow duration token used when drawing.
 *
 * These used to live in three different files (fraction.ts, musicUtils.ts,
 * VexFlowRenderer.ts) and could silently drift. They are now derived from the
 * one {@link DURATION_INFO} table below.
 *
 * IMPORTANT — extending the duration set (adding '64', '128', a breve, …):
 *   1. add the member to the `NoteDuration` union in `types/music.ts`;
 *   2. fix the resulting compile error here (the table is a non-`Partial`
 *      `Record<NoteDuration, …>`, so a missing entry will NOT type-check).
 *   Every other duration map in the app reads from this table, so step 2 is the
 *   only data edit required. The union — not any single map — is the source of
 *   truth.
 *
 * This module depends only on `fraction.ts` (pure arithmetic) and the type
 * declarations, keeping the dependency graph acyclic.
 */

import type { NoteDuration } from '@/types/music'
import { type Fraction, fracCreate, fracLte, fracMul } from '@/utils/fraction'

/** The three parallel facts about a single (undotted) note duration. */
export interface DurationInfo {
  /** Quarter-note beats as a float (VexFlow / Tone.js / pixel math). */
  beats: number
  /** Quarter-note beats as an exact rational — the canonical internal unit. */
  fraction: Fraction
  /** VexFlow base duration token (before any dot suffix). */
  vex: string
}

/**
 * The one table. Exhaustive over `NoteDuration` (no `Partial`, no fallback) so
 * that adding a member to the union without filling it in is a compile error.
 *
 *   'w'  → 4    quarter beats   (whole note)
 *   'h'  → 2                    (half note)
 *   'q'  → 1                    (quarter note)
 *   '8'  → 1/2                  (eighth note)
 *   '16' → 1/4                  (sixteenth note)
 *   '32' → 1/8                  (thirty-second note)
 */
export const DURATION_INFO: Record<NoteDuration, DurationInfo> = {
  w: { beats: 4, fraction: { num: 4, den: 1 }, vex: 'w' },
  h: { beats: 2, fraction: { num: 2, den: 1 }, vex: 'h' },
  q: { beats: 1, fraction: { num: 1, den: 1 }, vex: 'q' },
  '8': { beats: 0.5, fraction: { num: 1, den: 2 }, vex: '8' },
  '16': { beats: 0.25, fraction: { num: 1, den: 4 }, vex: '16' },
  '32': { beats: 0.125, fraction: { num: 1, den: 8 }, vex: '32' },
}

/**
 * All durations ordered largest → smallest, derived once from the table so
 * greedy decompositions never need a hand-maintained list.
 */
export const DURATIONS_DESC: NoteDuration[] = (Object.keys(DURATION_INFO) as NoteDuration[]).sort(
  (a, b) => DURATION_INFO[b].beats - DURATION_INFO[a].beats,
)

/**
 * Exact dot multipliers (× original duration):
 *   0 dots → 1, 1 dot → 3/2, 2 dots → 7/4.
 */
const DOT_MULTIPLIERS: Fraction[] = [
  { num: 1, den: 1 }, // 0 dots — identity
  { num: 3, den: 2 }, // 1 dot  — × 3/2
  { num: 7, den: 4 }, // 2 dots — × 7/4
]

/**
 * Float multiplier for dotted notes.
 * - 1 dot  = 1.5x  (2 − 1/2)
 * - 2 dots = 1.75x (2 − 1/4)
 * @param dots Number of dots (0, 1, 2, …)
 */
export function getDotMultiplier(dots: number): number {
  return dots > 0 ? 2 - Math.pow(0.5, dots) : 1
}

/**
 * Convert a note duration to quarter-note beats as a float.
 * @param duration Note duration token
 * @param dots Number of dots (default 0)
 */
export function durationToBeats(duration: NoteDuration, dots: number = 0): number {
  return DURATION_INFO[duration].beats * getDotMultiplier(dots)
}

/**
 * Snap a float beat to the nearest `duration`-sized grid step, clamped so a note of
 * that duration fits within the bar. Float BY DESIGN — this runs at the pixel
 * boundary (see the Fraction/float invariant in docs/ARCHITECTURE.md); the result is
 * re-entered into exact `Fraction` land by `beatToFrac()` downstream.
 */
export function quantizeBeat(beat: number, duration: NoteDuration, barQuarters: number): number {
  const d = durationToBeats(duration)
  return Math.max(0, Math.min(Math.round(beat / d) * d, barQuarters - d))
}

/**
 * Convert a note duration (+ optional dots) to an exact `Fraction` in beats.
 */
export function durationToFraction(duration: NoteDuration, dots = 0): Fraction {
  const base = DURATION_INFO[duration].fraction
  const dotMul = DOT_MULTIPLIERS[Math.min(dots, 2)] ?? DOT_MULTIPLIERS[0]
  return fracMul(base, dotMul)
}

/** One writable length: a base duration plus its dots. What a single note or rest can BE. */
export interface NoteLength { duration: NoteDuration; dots: number }

/**
 * Every writable length, LONGEST first — each duration dotted, then plain.
 *
 * Already descending, and not by luck: a dotted value is 1.5× its plain one, so `w. w h. h q. q …`
 * runs 6, 4, 3, 2, 1.5, 1 … — each dotted value sits between its own plain value and the next one
 * up. That is what lets a caller just take the first that fits.
 *
 * ONE dot, not two: a double-dotted value is real notation but a rare one, and this list is what a
 * caller gets handed when it did NOT choose. Guessing `h..` for someone is a bigger claim than `h.`.
 *
 * The ONE list behind both questions a span can ask — "what single value fits here?"
 * ({@link fitRestDuration}) and "what values span this?" ({@link splitBeatsIntoDurations}). They had
 * separate answers, and the split's was plain-only: three beats came out `h + q` (two notes, an extra
 * tie) where a dotted half covers it in one.
 */
const LENGTHS_DESC: NoteLength[] =
  DURATIONS_DESC.flatMap(d => [{ duration: d, dots: 1 }, { duration: d, dots: 0 }])

/**
 * The longest rest that FITS in `available` beats, given the one you asked for.
 *
 * Returns the armed length unchanged when it fits — dots and all, so a dotted quarter rest stays a
 * dotted quarter rest. When it does not fit, falls back to the longest writable rest that does,
 * **single dot included**: three beats left is a DOTTED HALF, not a half and a quarter. Returns null
 * when nothing fits (no space at all).
 *
 * General over meter by construction — it knows nothing about time signatures, only lengths, so 7/8
 * and 3/2 need no cases of their own. Whatever the longest value does not cover (5 beats → a whole,
 * leaving 1) closes up as rests via the meter-aware fill, which is where the meter is known.
 *
 * Exact (`Fraction`), not float: this decides a model value — what gets written into the score —
 * and the Fraction/float invariant (docs/ARCHITECTURE.md) puts it on the exact side of the line.
 *
 * Pure, so the rule has ONE home: the mouse stamp and the SPACE key both place a rest against a
 * barline, and must answer this identically.
 */
export function fitRestDuration(
  duration: NoteDuration,
  dots: number,
  available: Fraction,
): { duration: NoteDuration; dots: number } | null {
  if (fracLte(available, fracCreate(0, 1))) return null
  if (fracLte(durationToFraction(duration, dots), available)) return { duration, dots }
  for (const candidate of LENGTHS_DESC) {
    if (fracLte(durationToFraction(candidate.duration, candidate.dots), available)) return candidate
  }
  return null
}

/**
 * Convert a note duration to its VexFlow token, appending one `'d'` per dot
 * (e.g. `'qd'` for a dotted quarter, `'qdd'` for double-dotted). VexFlow uses
 * the suffix to compute correct ticks.
 */
export function durationToVexflow(duration: NoteDuration, dots: number = 0): string {
  let vex = DURATION_INFO[duration].vex
  for (let i = 0; i < dots; i++) {
    vex += 'd'
  }
  return vex
}

/**
 * Exact sounding duration of a tuplet note as a `Fraction`.
 *
 * @param duration      Written note duration
 * @param dots          Number of dots on the note
 * @param numNotes      N in "N notes in the space of M" (e.g. 3 for a triplet)
 * @param notesOccupied M in the ratio (e.g. 2 for a triplet)
 */
export function tupletNoteDurationFraction(
  duration: NoteDuration,
  dots: number,
  numNotes: number,
  notesOccupied: number,
): Fraction {
  return fracMul(durationToFraction(duration, dots), fracCreate(notesOccupied, numNotes))
}

/**
 * Convert a beat value to the closest undotted note duration, or null if no
 * single base duration matches.
 * @param beats Number of quarter-note beats
 */
export function beatsToDuration(beats: number): NoteDuration | null {
  const epsilon = 0.001
  for (const duration of DURATIONS_DESC) {
    if (Math.abs(beats - DURATION_INFO[duration].beats) < epsilon) return duration
  }
  return null
}

/**
 * Greedily split a beat span into base (UNDOTTED) durations, largest first.
 *
 * The crude float filler for RESTS — a gap of silence with no meter in hand (see
 * `ScoreModel.fillGapWithRests`, which says to prefer the meter-correct `fillMeasureGaps`). Stays
 * undotted on purpose: whether a rest may be dotted is the METER's business (4/4 never auto-makes a
 * dotted rest; 6/8 is full of them), so a length-only rule must not invent one. Notes are the other
 * case and have their own — {@link splitBeatsIntoLengths}.
 *
 * @param totalBeats Total quarter-note beats to fill
 * @returns Array of NoteDuration values summing to (approximately) totalBeats
 */
export function splitBeatsIntoDurations(totalBeats: number): NoteDuration[] {
  const durations: NoteDuration[] = []
  let remaining = totalBeats
  const epsilon = 0.001

  while (remaining > epsilon) {
    let found = false
    for (const duration of DURATIONS_DESC) {
      const beats = DURATION_INFO[duration].beats
      if (remaining >= beats - epsilon) {
        durations.push(duration)
        remaining -= beats
        found = true
        break
      }
    }
    if (!found) break // Prevent infinite loop for very small remainders
  }

  return durations
}

/**
 * Greedily split a beat span into writable lengths, LONGEST first — the FEWEST values that span it,
 * DOTS INCLUDED. For splitting a NOTE across a barline, each piece tied to the next.
 *
 * The note's counterpart to {@link splitBeatsIntoDurations}, and the difference is not a detail: a
 * note running three beats into a bar used to come out `h + q` — two notes and an extra tie — where
 * one dotted half says the same thing. Reported from a whole note entered on beat 2 of 4/4: expected
 * a dotted half tied to a quarter, got a half tied to a quarter tied to a quarter.
 *
 * Why notes and rests part here. A tied note has ALREADY committed to its length — you asked for it,
 * and the split only chooses how to write it, so the fewest values is simply the best writing of a
 * decision you made. A rest fill is choosing the silence itself, and there the METER decides whether
 * a dot is allowed at all (4/4 never auto-dots a rest; 6/8 is full of them). Same span, two
 * questions.
 *
 * General over meter by construction: it knows only lengths, so no time signature needs a case.
 *
 * @param totalBeats Total quarter-note beats to fill
 * @returns lengths summing to (approximately) totalBeats
 */
export function splitBeatsIntoLengths(totalBeats: number): NoteLength[] {
  const lengths: NoteLength[] = []
  let remaining = totalBeats
  const epsilon = 0.001

  while (remaining > epsilon) {
    const fit = LENGTHS_DESC.find(l => remaining >= durationToBeats(l.duration, l.dots) - epsilon)
    if (!fit) break // Prevent infinite loop for very small remainders
    lengths.push(fit)
    remaining -= durationToBeats(fit.duration, fit.dots)
  }

  return lengths
}
