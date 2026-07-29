/**
 * Exact rational arithmetic for musical time.
 *
 * Musical time is rational — tuplets create time values like 1/3, 1/7, 1/11
 * that cannot be represented exactly in floating point. This module provides
 * an immutable Fraction type and operations that keep all arithmetic exact.
 *
 * All Fractions are stored in reduced form with a positive denominator.
 * The numerator carries the sign.
 *
 * Unit: beats (quarter notes). A quarter note = {num:1, den:1}.
 *
 * This module is pure rational arithmetic — it has no knowledge of note
 * durations. The duration ↔ Fraction mapping lives in `utils/durations.ts`.
 */

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export interface Fraction {
  readonly num: number // integer numerator (carries sign)
  readonly den: number // integer denominator (always > 0)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a === 0 ? 1 : a
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Create a reduced Fraction. Denominator must be non-zero.
 * The denominator of the result is always positive.
 */
export function fracCreate(num: number, den: number): Fraction {
  if (den === 0) throw new Error(`Fraction denominator cannot be zero`)
  if (num === 0) return { num: 0, den: 1 }
  const sign = den < 0 ? -1 : 1
  const g = gcd(Math.abs(num), Math.abs(den))
  return { num: (sign * num) / g, den: (sign * den) / g }
}

/** Convenience: integer n becomes n/1 */
export function fracFromInt(n: number): Fraction {
  return { num: n, den: 1 }
}

// ⛔ There is no float → Fraction guesser here, deliberately. `fracFromFloat` used to be, "for
// legacy score migration" — a past that never existed (there are no persisted scores), and it had
// no caller but its own test. A beat is built exactly, by `fracCreate` from the two integers that
// mean it; the moment one is *recovered* from a float, `1/3` is a search for the nearest plausible
// denominator and the tuplet it came from is a guess. See the "no JSON migration" rule.

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function fracAdd(a: Fraction, b: Fraction): Fraction {
  return fracCreate(a.num * b.den + b.num * a.den, a.den * b.den)
}

export function fracSub(a: Fraction, b: Fraction): Fraction {
  return fracCreate(a.num * b.den - b.num * a.den, a.den * b.den)
}

export function fracMul(a: Fraction, b: Fraction): Fraction {
  return fracCreate(a.num * b.num, a.den * b.den)
}

export function fracDiv(a: Fraction, b: Fraction): Fraction {
  if (b.num === 0) throw new Error('Division by zero fraction')
  return fracCreate(a.num * b.den, a.den * b.num)
}

export function fracNeg(a: Fraction): Fraction {
  if (a.num === 0) return a
  return { num: -a.num, den: a.den }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export function fracEq(a: Fraction, b: Fraction): boolean {
  return a.num * b.den === b.num * a.den
}

export function fracLt(a: Fraction, b: Fraction): boolean {
  return a.num * b.den < b.num * a.den
}

export function fracLte(a: Fraction, b: Fraction): boolean {
  return a.num * b.den <= b.num * a.den
}

export function fracGt(a: Fraction, b: Fraction): boolean {
  return a.num * b.den > b.num * a.den
}

export function fracGte(a: Fraction, b: Fraction): boolean {
  return a.num * b.den >= b.num * a.den
}

/**
 * Returns negative/zero/positive — suitable for Array.sort comparator.
 * Uses subtraction of cross-products to avoid division.
 */
export function fracCompare(a: Fraction, b: Fraction): number {
  return a.num * b.den - b.num * a.den
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function fracIsZero(f: Fraction): boolean {
  return f.num === 0
}

export function fracIsPositive(f: Fraction): boolean {
  return f.num > 0
}

export function fracIsNegative(f: Fraction): boolean {
  return f.num < 0
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert to floating-point number for use with VexFlow pixel math and
 * Tone.js scheduling. Do not use this result for comparisons — use fracEq/fracLt.
 */
export function fracToNumber(f: Fraction): number {
  return f.num / f.den
}
