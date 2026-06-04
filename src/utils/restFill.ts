/**
 * Meter-aware, exact, syncopation-free rest decomposition.
 *
 * Given a silent span `[start, end)` (in quarter-note beats) and the bar's
 * {@link MeterInfo}, produce the engraving-correct sequence of rests that fills
 * it. This replaces the two former float-based, 4/4-biased fillers
 * (`ScoreModel.createMusicalRests` and `VexFlowRenderer.beatsToRestDurations`).
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
  fracEq,
  fracLt,
  fracGt,
  fracToNumber,
} from '@/utils/fraction'
import { DURATIONS_DESC, durationToFraction } from '@/utils/durations'
import { type MeterInfo, STRENGTH } from '@/utils/meter'

/** One emitted rest: position, base duration, and dot count. */
export interface RestSlot {
  beat: Fraction
  duration: NoteDuration
  dots: number
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
 * Every usable rest shape (0 or 1 dots), longest first. Dotted 32nds are
 * excluded: 3/16 of a quarter does not land on the 32nd grid, so it can never
 * tile a grid-aligned gap cleanly.
 */
const CANDIDATES: RestCandidate[] = buildCandidates()

function buildCandidates(): RestCandidate[] {
  const list: RestCandidate[] = []
  for (const duration of DURATIONS_DESC) {
    for (const dots of [0, 1]) {
      const len = durationToFraction(duration, dots)
      const lenNum = fracToNumber(len)
      // Keep only shapes that sit on the 32nd grid (1/8-quarter multiples).
      if (Number.isInteger(lenNum * 8)) {
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

  const strengthOf = makeStrengthLookup(meter)
  const result: RestSlot[] = []

  let current = start
  while (fracLt(current, end)) {
    const startStrength = strengthOf(current)
    let chosen: RestCandidate | null = null
    let chosenEnd: Fraction = current

    for (const cand of CANDIDATES) {
      const candEnd = fracAdd(current, cand.len)
      if (fracGt(candEnd, end)) continue // overshoots the span

      const endStrength = fracEq(candEnd, meter.barQuarters)
        ? STRENGTH.bar // the next downbeat is maximally strong
        : strengthOf(candEnd)
      const limit = Math.min(startStrength, endStrength)

      if (maxInteriorStrength(meter, current, candEnd) <= limit) {
        chosen = cand
        chosenEnd = candEnd
        break // CANDIDATES is longest-first, so the first fit is the longest
      }
    }

    if (!chosen) break // gap finer than a 32nd (only from malformed input)

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
    used = fracAdd(used, slot.actualDuration ?? durationToFraction(slot.duration, slot.dots ?? 0))
  }
  return fracGt(used, barQuarters) ? 'soft' : 'full'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WEAKEST = Number.NEGATIVE_INFINITY

/** O(1) strength at an exact position; off-grid positions are weakest. */
function makeStrengthLookup(meter: MeterInfo): (at: Fraction) => number {
  const byPos = new Map<string, number>()
  for (const b of meter.boundaries) byPos.set(`${b.at.num}/${b.at.den}`, b.strength)
  return (at: Fraction) => byPos.get(`${at.num}/${at.den}`) ?? WEAKEST
}

/** Strongest boundary strictly inside `(p, q)`, or -Infinity if none. */
function maxInteriorStrength(meter: MeterInfo, p: Fraction, q: Fraction): number {
  let max = WEAKEST
  for (const b of meter.boundaries) {
    if (fracLt(p, b.at) && fracLt(b.at, q) && b.strength > max) max = b.strength
  }
  return max
}
