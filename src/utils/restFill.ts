/**
 * Meter-aware, exact, syncopation-free rest decomposition.
 *
 * Given a silent span `[start, end)` (in quarter-note beats) and the bar's
 * {@link MeterInfo}, produce the engraving-correct sequence of rests that fills
 * it. This replaces the two former float-based, 4/4-biased fillers
 * (`ScoreModel.createMusicalRests` and `ScoreRenderer.beatsToRestDurations`).
 *
 * Governing rule ("show each beat" / Gould): a single rest may span `[p, q)`
 * only when no metric boundary strictly inside it is **stronger than the weaker
 * of its two endpoints** — i.e. `max interior strength ≤ min(strength(p),
 * strength(q))`. Starting from `start`, we greedily take the longest such rest,
 * emit it, and advance. This naturally yields:
 *   - 4/4: rests never cross the bar middle (a 2-beat mid-bar gap → two rests);
 *   - compound: a full felt beat of silence → one dotted rest; two adjacent
 *     12/8 beats at a group edge → a dotted-half;
 *   - irregular (5/8, 7/8): rests respect the additive grouping.
 *
 * A whole empty bar collapses to a single **measure rest** (`isMeasureRest`),
 * the universal "whole bar of silence = centred whole rest, in every meter"
 * convention. Phase 3 renders it; the current renderer treats it as a plain
 * whole rest, which is identical in 4/4.
 *
 * This module is tuplet-unaware by design: callers must only pass spans already
 * free of tuplets (tuplet-gap splitting stays in `ScoreModel.fillGapsWithRests`).
 *
 * Pure: depends only on `fraction.ts`, `durations.ts`, and `meter.ts`.
 */

import type { NoteDuration, ChordRest } from '@/types/music'
import {
  type Fraction,
  fracCreate,
  fracAdd,
  fracDiv,
  fracEq,
  fracLt,
  fracGt,
  fracToNumber,
} from '@/utils/fraction'
import { DURATIONS_DESC, SHORTEST_LENGTH, durationToFraction, slotLength } from '@/utils/durations'
import { type MeterInfo, STRENGTH } from '@/utils/meter'

/** One position-anchored note/rest shape: position, base duration, dot count. */
interface DurationSegment {
  beat: Fraction
  duration: NoteDuration
  dots: number
}

/** One emitted rest: a {@link DurationSegment} plus the measure-rest flag. */
export interface RestSlot extends DurationSegment {
  /** True for the single rest that fills an entire empty bar (measure rest). */
  isMeasureRest?: boolean
}

interface RestCandidate {
  duration: NoteDuration
  dots: number
  len: Fraction
  lenNum: number
}

/**
 * Every usable rest shape (0 or 1 dots), longest first. A shape that does not land on the grid of
 * the SHORTEST value ({@link SHORTEST_LENGTH}) is excluded — today a dotted 32nd, whose dot is a 64th —
 * since it can never tile a grid-aligned gap cleanly. The grid is derived, ⛔ not a literal 32nd: a
 * shorter duration moves it (docs/plans/multiple-dots-plan.md D2).
 */
const CANDIDATES: RestCandidate[] = buildCandidates()

function buildCandidates(): RestCandidate[] {
  const list: RestCandidate[] = []
  for (const duration of DURATIONS_DESC) {
    for (const dots of [0, 1]) {
      const len = durationToFraction(duration, dots)
      const lenNum = fracToNumber(len)
      // Keep only shapes that sit on the shortest value's grid (a whole number of them).
      if (fracDiv(len, SHORTEST_LENGTH).den === 1) {
        list.push({ duration, dots, len, lenNum })
      }
    }
  }
  return list.sort((a, b) => b.lenNum - a.lenNum)
}

/**
 * Decompose the silent span `[start, end)` into engraving-correct rests.
 *
 * @param start  Span start in quarter-note beats.
 * @param end    Span end in quarter-note beats.
 * @param meter  The bar's metric structure (from `getMeterInfo`).
 */
export function fillRests(start: Fraction, end: Fraction, meter: MeterInfo): RestSlot[] {
  if (!fracLt(start, end)) return []

  // Whole empty bar → a single measure rest in every meter.
  if (fracEq(start, { num: 0, den: 1 }) && fracEq(end, meter.barQuarters)) {
    return [{ beat: start, duration: 'w', dots: 0, isMeasureRest: true }]
  }

  return decomposeSpan(start, end, meter)
}

/**
 * Decompose an arbitrary in-bar span `[start, end)` into engraving-correct,
 * tie-able duration segments — the syncopation-free greedy core shared by
 * rest-fill ({@link fillRests}) and note-splitting (rebar, Phase 8).
 *
 * Same governing rule as the module header: a single segment may span `[p, q)`
 * only when no metric boundary strictly inside it is stronger than the weaker of
 * its two endpoints. Starting from `start`, greedily take the longest such
 * segment, emit it, advance. Unlike {@link fillRests} there is **no** whole-bar
 * measure-rest shortcut: every segment is a real, drawable duration (notes are
 * never collapsed to a measure rest). `start`/`end` must lie within a single bar
 * `[0, barQuarters]`; cross-bar splitting is the caller's job.
 */
export function decomposeSpan(start: Fraction, end: Fraction, meter: MeterInfo): DurationSegment[] {
  if (!fracLt(start, end)) return []

  const strengths = strengthIndex(meter)
  const result: DurationSegment[] = []

  let current = start
  while (fracLt(current, end)) {
    const startStrength = strengths.at(current)
    let chosen: RestCandidate | null = null
    let chosenEnd: Fraction = current

    for (const cand of CANDIDATES) {
      const candEnd = fracAdd(current, cand.len)
      if (fracGt(candEnd, end)) continue // overshoots the span

      const endStrength = fracEq(candEnd, meter.barQuarters)
        ? STRENGTH.bar // the next downbeat is maximally strong
        : strengths.at(candEnd)
      const limit = Math.min(startStrength, endStrength)

      if (strengths.maxInside(current, candEnd) <= limit) {
        chosen = cand
        chosenEnd = candEnd
        break // CANDIDATES is longest-first, so the first fit is the longest
      }
    }

    if (!chosen) break // gap finer than the shortest value (only from malformed input)

    result.push({ beat: current, duration: chosen.duration, dots: chosen.dots })
    current = chosenEnd
  }

  return result
}

/**
 * Choose a VexFlow voice mode for a measure's slots — STRICT is never used (it
 * rejects both under-full and over-full bars, swallowing them via the render
 * fallback). Returns:
 *   - `'soft'` when the bar holds a measure rest (its fixed whole-rest ticks
 *     need not equal the capacity) or is over-full (keep every note, drawn
 *     crowded — notes are never trimmed);
 *   - `'full'` otherwise: normal and under-full (pickup-style) bars render,
 *     while a genuine over-tick is still surfaced as corruption.
 *
 * Pure and DOM-free so the policy is unit-testable without a renderer.
 */
export function pickVoiceMode(slots: ChordRest[], barQuarters: Fraction): 'soft' | 'full' {
  let used: Fraction = fracCreate(0, 1)
  for (const slot of slots) {
    if (slot.type === 'rest' && slot.isMeasureRest) return 'soft'
    used = fracAdd(used, slotLength(slot))
  }
  return fracGt(used, barQuarters) ? 'soft' : 'full'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WEAKEST = Number.NEGATIVE_INFINITY

/**
 * The meter's boundaries as an INDEX over the shortest value's grid (`SHORTEST_LENGTH`, a 512th): a
 * strength per grid point, plus a sparse table so "the strongest boundary strictly inside (p, q)" is
 * two lookups instead of a walk over every boundary. ⭐ Built once per meter — `getMeterInfo` hands
 * back the same frozen object for the same meter, so the WeakMap hits (docs/plans/other-durations-plan.md
 * P2: a hierarchy down to the 512th is 512 boundaries in 4/4 and 2048 in 4/1, and the walk made every
 * fill 7–10× slower).
 */
interface StrengthIndex {
  /** Strength at an exact position; off-grid positions are weakest. */
  at(at: Fraction): number
  /** Strongest boundary strictly inside `(p, q)`, or -Infinity if none. */
  maxInside(p: Fraction, q: Fraction): number
}

const STRENGTH_INDEX = new WeakMap<MeterInfo, StrengthIndex>()

function strengthIndex(meter: MeterInfo): StrengthIndex {
  const known = STRENGTH_INDEX.get(meter)
  if (known) return known
  const index = buildStrengthIndex(meter)
  STRENGTH_INDEX.set(meter, index)
  return index
}

/** `x` in grid steps, as an exact rational `num / den` of integers. */
function gridSteps(x: Fraction): { num: number; den: number } {
  const steps = fracDiv(x, SHORTEST_LENGTH)
  return { num: steps.num, den: steps.den }
}

function buildStrengthIndex(meter: MeterInfo): StrengthIndex {
  const barSteps = gridSteps(meter.barQuarters)
  const n = Math.ceil(barSteps.num / barSteps.den)
  const strengths = new Array<number>(n).fill(WEAKEST)
  for (const b of meter.boundaries) {
    const t = gridSteps(b.at)
    if (t.den === 1 && t.num >= 0 && t.num < n) strengths[t.num] = Math.max(strengths[t.num], b.strength)
  }
  // Sparse table: level k holds the max over [i, i + 2^k).
  const levels: number[][] = [strengths]
  for (let k = 1; 1 << k <= n; k++) {
    const prev = levels[k - 1]
    const half = 1 << (k - 1)
    const row = new Array<number>(n - (1 << k) + 1)
    for (let i = 0; i < row.length; i++) row[i] = Math.max(prev[i], prev[i + half])
    levels.push(row)
  }
  return {
    at(at) {
      const t = gridSteps(at)
      return t.den === 1 && t.num >= 0 && t.num < n ? strengths[t.num] : WEAKEST
    },
    maxInside(p, q) {
      const ps = gridSteps(p)
      const qs = gridSteps(q)
      const lo = Math.max(0, Math.floor(ps.num / ps.den) + 1)
      const hi = Math.min(n - 1, Math.ceil(qs.num / qs.den) - 1)
      if (lo > hi) return WEAKEST
      const k = Math.floor(Math.log2(hi - lo + 1))
      return Math.max(levels[k][lo], levels[k][hi - (1 << k) + 1])
    },
  }
}
