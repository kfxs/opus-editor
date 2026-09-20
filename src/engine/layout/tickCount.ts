/**
 * ⭐ **A BAR'S TICK ARITHMETIC — S9i** (`docs/history/vexflow-removal-map.md` §5.2).
 *
 * A note's length in VexFlow's clock, summed the way VexFlow's `Fraction` sums it — **transcribed, not
 * improved**: `add` puts both sides over their LCM and ⛔ never reduces. That matters, because a bar's
 * columns are KEYED by a running sum's NUMERATOR at the voices' shared resolution
 * (`rendering/format/columnFormat`, `rendering/format/modifierColumns`), and the resolution itself is a sum's
 * DENOMINATOR (`rendering/format/barVoice`). A reducing sum would key a triplet's columns differently.
 *
 * ⛔ No vexflow, no DOM — plain integers. A tickable's ticks arrive as anything with a numerator and a
 * denominator, which VexFlow's own `Fraction` is.
 */

/**
 * VexFlow's ticks per WHOLE note (`Tables.RESOLUTION`) — the clock every tickable's `getTicks()` is
 * counted in. ⚠️ Not a house-style number: it must equal VexFlow's for as long as VexFlow's notes say
 * how long they are (`tickCount.test.ts` asks a whole note). `Tables` is not on the package's public
 * entry, so it is written down here.
 */
export const TICK_RESOLUTION = 16384

/** A count of ticks, as a numerator over a denominator that is ⛔ never reduced. */
export interface TickCount {
  numerator: number
  denominator: number
}

/** `Fraction.GCD`, transcribed. */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

/** `Fraction.LCM`, transcribed. */
export function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b)
}

/** `this.add(other)` of VexFlow's `Fraction`, IN PLACE as it is there: over the LCM, unreduced. */
export function addTicks(sum: TickCount, other: TickCount): TickCount {
  const common = lcm(sum.denominator, other.denominator)
  sum.numerator = sum.numerator * (common / sum.denominator) + other.numerator * (common / other.denominator)
  sum.denominator = common
  return sum
}

/** `this.subtract(other)`, in place — the undo of an over-full {@link addTicks}. */
export function subtractTicks(sum: TickCount, other: TickCount): TickCount {
  const common = lcm(sum.denominator, other.denominator)
  sum.numerator = sum.numerator * (common / sum.denominator) - other.numerator * (common / other.denominator)
  sum.denominator = common
  return sum
}

/** `a.greaterThan(b)` — the sign of `a − b` over the LCM. */
export function ticksGreaterThan(a: TickCount, b: TickCount): boolean {
  return subtractTicks({ ...a }, b).numerator > 0
}

/** `a.equals(b)` — both REDUCED first, so `2/4` equals `1/2`. */
export function ticksEqual(a: TickCount, b: TickCount): boolean {
  const reduce = ({ numerator: u, denominator: d }: TickCount): [number, number] => {
    const g = gcd(u, d)
    u /= g
    d /= g
    return d < 0 ? [-u, -d] : [u, d]
  }
  const [au, ad] = reduce(a)
  const [bu, bd] = reduce(b)
  return au === bu && ad === bd
}

/** `value()` — the count as a number. */
export function ticksValue(count: TickCount): number {
  return count.numerator / count.denominator
}

/**
 * A note's ticks as a value — the count, ⛔ unreduced, and what it comes to (`value()`, as VexFlow's
 * `Fraction.value`). ⭐ S12j-c: what `EngravedNote.getTicks` hands out, so a reader that still asks
 * `.value()` gets the same answer it got from VexFlow's `Fraction`.
 */
export class NoteTicks implements TickCount {
  constructor(public numerator: number, public denominator: number) {}

  value(): number {
    return this.numerator / this.denominator
  }
}
