import type { TimeSignature } from '@/types/music'
import { isValidTimeSignature } from './meter'

/**
 * Reading a beat grouping the user TYPED, and saying what is wrong with it.
 *
 * Pure, and deliberately not in a component: this rule was a pair of Vue computeds inside App.ts,
 * which meant the only UI that could validate a meter was the Vue one — and the plain-TS windows
 * that are replacing it would each have had to re-derive "must sum to the numerator" and get it
 * subtly differently. The rule is the model's, not a component's (lint:boundary enforces the
 * direction; this file simply keeps the rule where both sides can reach it).
 *
 * See docs/time-signature-window-plan.md §2 for what grouping still CANNOT say.
 */

/**
 * Parse the grouping field into denominator units.
 *
 * Three separators, because people type all three: `2+2+3` reads as the meter is written, `2,2,3` is
 * how a list is typed, and `2 2 3` is what you get from a keypad. Empty ⇒ undefined, which is not an
 * error but "no explicit grouping" — the meter's algorithmic default (see utils/meter `getMeterInfo`).
 */
export function parseGrouping(input: string): number[] | undefined {
  const parts = input.split(/[+,\s]+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return undefined
  return parts.map(Number)
}

/** The dyadic denominators a meter may have. Anything else is not a note value. */
export const DENOMINATORS = [1, 2, 4, 8, 16, 32]

/**
 * The time signature these fields describe, or null when the numbers are not numbers. Null is
 * "unreadable", NOT "invalid" — {@link timeSignatureError} is what judges a readable one.
 */
export function candidateTimeSignature(
  numerator: number | string,
  denominator: number | string,
  groupingInput: string,
): TimeSignature | null {
  const num = Math.floor(Number(numerator))
  const den = Number(denominator)
  if (!Number.isFinite(num) || !Number.isFinite(den)) return null
  const grouping = parseGrouping(groupingInput)
  if (grouping && grouping.some((g) => !Number.isFinite(g))) return null
  return grouping ? { numerator: num, denominator: den, grouping } : { numerator: num, denominator: den }
}

/**
 * What is wrong with this meter, in a sentence for the user — or null when nothing is.
 *
 * Ordered from the most specific complaint to the least, so the message names the thing the user
 * can act on: "grouping must sum to 7" beats "not a representable time signature", which is what a
 * bare `isValidTimeSignature` would have said about the same input.
 */
export function timeSignatureError(ts: TimeSignature | null): string | null {
  if (!ts) return 'Enter whole numbers.'
  if (!Number.isInteger(ts.numerator) || ts.numerator < 1) return 'Numerator must be a positive whole number.'
  if (!DENOMINATORS.includes(ts.denominator)) return 'Denominator must be a power of two (1–32).'
  if (ts.grouping) {
    const sum = ts.grouping.reduce((a, b) => a + b, 0)
    if (sum !== ts.numerator) return `Grouping must sum to ${ts.numerator} (got ${sum}).`
    if (ts.grouping.some((g) => !Number.isInteger(g) || g < 1)) return 'Each group must be a positive whole number.'
  }
  return isValidTimeSignature(ts) ? null : 'Not a representable time signature.'
}

/** The grouping field alone, judged against the meter it belongs to. */
export function groupingError(input: string, numerator: number, denominator: number): string | null {
  return timeSignatureError(candidateTimeSignature(numerator, denominator, input))
}
