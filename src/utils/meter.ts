/**
 * Procedural metric-hierarchy generator.
 *
 * Given a {@link TimeSignature} (and an optional additive grouping), this module
 * derives — **algorithmically, with no hardcoded meter tables** — everything the
 * rest-fill (Phase 2b) and beaming (Phase 4) layers need:
 *
 *   - the exact bar length in quarter-note beats,
 *   - whether the meter is compound,
 *   - the felt beat unit,
 *   - the primary beat groups ("show each beat" grouping for rests/beams),
 *   - a full metric-strength map of every internal boundary in the bar.
 *
 * The three preset test meters (4/4, 3/4, 5/8) are fixtures, not special cases:
 * every dyadic meter the user can enter is handled by the same code path.
 *
 * Internal unit is always the quarter note (`Fraction`). The felt beat (dotted in
 * compound time) is grouping/display only — it never changes stored positions.
 *
 * Known, deliberate simplification: compound detection is gated at `denominator
 * >= 8`, so `6/4`, `9/4`, `12/4` are treated as *simple* (one beat per quarter),
 * not as compound dotted-half beats. See docs/time-signature-plan.md §6 Phase 2.
 *
 * Pure: depends only on `fraction.ts` and the type declarations.
 */

import type { TimeSignature } from '@/types/music'
import {
  type Fraction,
  fracCreate,
  fracFromInt,
  fracAdd,
  fracMul,
  fracEq,
  fracLte,
  fracCompare,
  fracToNumber,
} from '@/utils/fraction'

/** One internal metric boundary in the bar and its hierarchical strength. */
export interface MetricBoundary {
  /** Position within the bar, in quarter-note beats (0 ≤ at < barQuarters). */
  at: Fraction
  /** Higher = metrically stronger. See {@link STRENGTH}. */
  strength: number
}

/** The derived metric structure of a single bar. */
export interface MeterInfo {
  numerator: number
  denominator: number
  /** Exact bar length in quarter-note beats (4/4 → 4, 6/8 → 3, 2/2 → 4). */
  barQuarters: Fraction
  /** num % 3 === 0 && num > 3 && denom >= 8. */
  isCompound: boolean
  /** Felt beat in quarter units (quarter → 1, dotted-quarter → 3/2, half → 2). */
  beatUnit: Fraction
  /** Primary beat-group lengths in quarter units; sum to barQuarters. */
  groups: Fraction[]
  /** Every internal boundary (incl. bar start at 0), ascending by position. */
  boundaries: MetricBoundary[]
}

/**
 * Hierarchical strengths. Higher = stronger. The within-group subdivision
 * ceiling is `group - 1` and decreases by one per binary depth, so the full
 * order is: bar > half-bar > group > beat-subdivisions… A consumer compares
 * strengths only relatively (e.g. "don't let a rest cross a boundary stronger
 * than the one it starts on"), so the absolute numbers are not load-bearing.
 */
export const STRENGTH = {
  bar: 6,
  halfBar: 5,
  group: 4,
} as const

/** Smallest representable note = 32nd = 1/8 quarter. */
const SMALLEST = fracCreate(1, 8)

/** Denominators we can represent: dyadic and no finer than a 32nd note. */
const VALID_DENOMINATORS = [1, 2, 4, 8, 16, 32]

/**
 * True iff the time signature is representable: integer numerator ≥ 1 and a
 * dyadic denominator in {1,2,4,8,16,32}. Non-dyadic ("irrational") meters such
 * as 4/3 and denominators finer than a 32nd are rejected.
 */
export function isDyadicMeter(ts: TimeSignature): boolean {
  return (
    Number.isInteger(ts.numerator) &&
    ts.numerator >= 1 &&
    VALID_DENOMINATORS.includes(ts.denominator)
  )
}

/**
 * Derive the full metric structure of a bar.
 *
 * @param ts        Time signature.
 * @param grouping  Optional additive grouping in *denominator units* (e.g.
 *                  `[3,2,2]` for `3+2+2 / 8`). Must sum to the numerator.
 * @throws if the meter is non-dyadic or the grouping is invalid.
 */
export function getMeterInfo(ts: TimeSignature, grouping?: number[]): MeterInfo {
  if (!isDyadicMeter(ts)) {
    throw new Error(
      `Unsupported time signature ${ts.numerator}/${ts.denominator}: ` +
        `denominator must be one of ${VALID_DENOMINATORS.join(', ')} and ` +
        `numerator a positive integer.`,
    )
  }

  const { numerator, denominator } = ts
  // One denominator note, in quarters (eighth → 1/2, sixteenth → 1/4, …).
  const unitQ = fracCreate(4, denominator)
  const barQuarters = fracMul(fracFromInt(numerator), unitQ)
  const isCompound = numerator % 3 === 0 && numerator > 3 && denominator >= 8

  const groupUnits = grouping
    ? validateGrouping(grouping, numerator)
    : defaultGrouping(numerator, denominator, isCompound)

  const groups = groupUnits.map((u) => fracMul(unitQ, fracFromInt(u)))

  // Felt beat: the group length when groups are uniform; otherwise the bare
  // denominator unit (irregular/additive meters have no single felt beat).
  const uniform = groupUnits.every((u) => u === groupUnits[0])
  const beatUnit = uniform ? groups[0] : unitQ

  const boundaries = buildBoundaries(groupUnits, unitQ, barQuarters)

  return { numerator, denominator, barQuarters, isCompound, beatUnit, groups, boundaries }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Default primary grouping, in denominator units, for any dyadic meter:
 *   - compound          → groups of 3 (each a dotted felt beat);
 *   - simple, denom ≤ 4 → one group per beat (4/4 → 1+1+1+1, 2/2 → 1+1);
 *   - simple, denom ≥ 8 → quarter-note pulses when the numerator divides
 *     evenly, else twos with an odd remainder absorbed into a final three
 *     (5/8 → 2+3, 7/8 → 2+2+3, 13/16 → 2+2+2+2+2+3).
 */
function defaultGrouping(numerator: number, denominator: number, isCompound: boolean): number[] {
  if (isCompound) {
    return new Array(numerator / 3).fill(3)
  }
  if (denominator <= 4) {
    return new Array(numerator).fill(1)
  }
  // denom >= 8: prefer whole quarter-note pulses (P units = one quarter).
  const unitsPerQuarter = denominator / 4
  if (unitsPerQuarter >= 2 && numerator % unitsPerQuarter === 0) {
    return new Array(numerator / unitsPerQuarter).fill(unitsPerQuarter)
  }
  return twosWithFinalThree(numerator)
}

/** Fill with 2s; a leftover single unit is merged into a final group of 3. */
function twosWithFinalThree(n: number): number[] {
  const groups: number[] = []
  let remaining = n
  while (remaining >= 2) {
    groups.push(2)
    remaining -= 2
  }
  if (remaining === 1) {
    if (groups.length > 0) groups[groups.length - 1] += 1
    else groups.push(1)
  }
  return groups
}

function validateGrouping(grouping: number[], numerator: number): number[] {
  if (grouping.length === 0 || grouping.some((g) => !Number.isInteger(g) || g < 1)) {
    throw new Error(`Invalid grouping [${grouping.join(',')}]: all parts must be positive integers.`)
  }
  const sum = grouping.reduce((a, b) => a + b, 0)
  if (sum !== numerator) {
    throw new Error(`Invalid grouping [${grouping.join(',')}]: sums to ${sum}, expected ${numerator}.`)
  }
  return grouping.slice()
}

// ---------------------------------------------------------------------------
// Metric-strength tree
// ---------------------------------------------------------------------------

/**
 * Walk the primary groups, then subdivide each (ternary at the compound-beat
 * level, binary below) down to the smallest representable value, recording a
 * strength for every internal boundary. The bar start is the strongest; a group
 * boundary that coincides with the bar's midpoint is elevated (so rests/beams
 * won't cross the metric centre of an evenly-divided bar — 4/4, 2/2, 12/8, …).
 */
function buildBoundaries(groupUnits: number[], unitQ: Fraction, barQuarters: Fraction): MetricBoundary[] {
  // Dedupe by position, keeping the strongest strength at any coincident point.
  const byPos = new Map<string, MetricBoundary>()
  const record = (at: Fraction, strength: number) => {
    const key = `${at.num}/${at.den}`
    const existing = byPos.get(key)
    if (!existing || strength > existing.strength) byPos.set(key, { at, strength })
  }

  const half = fracMul(barQuarters, fracCreate(1, 2))

  record(fracCreate(0, 1), STRENGTH.bar)

  let cursor = fracCreate(0, 1)
  for (let i = 0; i < groupUnits.length; i++) {
    if (i > 0) {
      // Group start: elevated to half-bar strength when it is the bar midpoint.
      record(cursor, fracEq(cursor, half) ? STRENGTH.halfBar : STRENGTH.group)
    }
    subdivideUnits(cursor, groupUnits[i], unitQ, STRENGTH.group - 1, record)
    cursor = fracAdd(cursor, fracMul(unitQ, fracFromInt(groupUnits[i])))
  }

  return [...byPos.values()].sort((a, b) => fracCompare(a.at, b.at))
}

/**
 * Subdivide a block of `units` denominator-units. Splits binary when even,
 * ternary when divisible by three (a compound dotted beat), recording each
 * internal boundary; once down to a single unit, hands off to binary time
 * subdivision. (Group sizes produced here are only ever 1–4, so 2 and 3 cover
 * every case; the binary fallback keeps it safe for any future grouping.)
 */
function subdivideUnits(
  start: Fraction,
  units: number,
  unitQ: Fraction,
  strength: number,
  record: (at: Fraction, strength: number) => void,
): void {
  if (units <= 1) {
    subdivideTime(start, unitQ, strength, record)
    return
  }

  const parts = units % 2 === 0 ? 2 : units % 3 === 0 ? 3 : 0
  if (parts === 0) {
    // Not equally divisible by 2 or 3 (unreachable for default/standard
    // groupings) — treat the whole block as one time span.
    subdivideTime(start, fracMul(unitQ, fracFromInt(units)), strength, record)
    return
  }

  const childUnits = units / parts
  const childLen = fracMul(unitQ, fracFromInt(childUnits))
  for (let i = 1; i < parts; i++) {
    record(fracAdd(start, fracMul(childLen, fracFromInt(i))), strength)
  }
  for (let i = 0; i < parts; i++) {
    subdivideUnits(fracAdd(start, fracMul(childLen, fracFromInt(i))), childUnits, unitQ, strength - 1, record)
  }
}

/** Binary-subdivide a time span (in quarters) down to the smallest unit. */
function subdivideTime(
  start: Fraction,
  len: Fraction,
  strength: number,
  record: (at: Fraction, strength: number) => void,
): void {
  if (fracLte(len, SMALLEST)) return // atomic — cannot split a 32nd
  const half = fracMul(len, fracCreate(1, 2))
  const mid = fracAdd(start, half)
  record(mid, strength)
  subdivideTime(start, half, strength - 1, record)
  subdivideTime(mid, half, strength - 1, record)
}

/** Convenience for tests/consumers: bar length as a float. */
export function meterBarQuarters(ts: TimeSignature): number {
  return fracToNumber(getMeterInfo(ts).barQuarters)
}
