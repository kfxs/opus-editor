/**
 * SPEC SUPPORT — a fixture's alteration written the short way: `signs(1)` is a sharp, `signs(-2)` a
 * double flat, `signs(0)` none. A spec that builds many pitches reads best with a number in its
 * helper's argument list; ⛔ the score itself never stores one (docs/plans/alteration-signs-plan.md
 * M2 — a pitch carries a LIST of signs, absent when unaltered).
 */
import type { Alteration } from '@/types/music'

const SIGNS: Record<number, Alteration | undefined> = {
  [-2]: ['doubleFlat'], [-1]: ['flat'], 0: undefined, 1: ['sharp'], 2: ['doubleSharp'],
}

/** The stored alteration a fixture's number means. */
export function signs(n: number | undefined): Alteration | undefined {
  return SIGNS[n ?? 0]
}

/** `{ alteration }` to spread into a fixture pitch — nothing for 0, as the model stores it. */
export function withSigns(n: number | undefined): { alteration?: Alteration } {
  const alteration = signs(n)
  return alteration ? { alteration } : {}
}
