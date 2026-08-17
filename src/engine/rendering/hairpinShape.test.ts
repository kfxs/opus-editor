/**
 * {@link resolveHairpinShape} — the wedge's shape, before any drawing: the mouth a wedge of a
 * given length opens to, and how a split one steps at the break.
 *
 * ⭐ Everything here is headless *because* the module is: it answers in staff spaces from constants
 * and one length, with no stave, no font and no SVG. That is the point of having a resolver at all
 * — the day the aperture and the slant become user controls they are a compartment client and these
 * assertions still hold (docs/dynamics-line-and-hairpins-plan.md §6). Where the wedge actually
 * lands is P3's, in the browser suite.
 */
import { describe, it, expect } from 'vitest'
import { HAIRPIN, fragmentOpening, resolveHairpinShape, authoredApertureRange } from './hairpinShape'

describe('resolveHairpinShape', () => {
  /** Long enough that the gradient cap cannot bite. */
  const LONG = 20

  it('is horizontal by default — no slant, which is every engine\'s default', () => {
    expect(resolveHairpinShape(undefined, LONG)).toEqual({
      aperture: HAIRPIN.APERTURE, startY: 0, endY: 0,
    })
  })

  it('takes an authored aperture and slant, and the slant is TWO independent deltas', () => {
    // ⚠️ Two endpoint deltas, never one `angle` — an angle would have to name a pivot, and it is
    // why moving only the start handle in Dorico tilts the wedge rather than doing nothing.
    const shape = resolveHairpinShape({ aperture: 1, startY: -0.5, endY: 0.25 }, LONG)
    expect(shape).toEqual({ aperture: 1, startY: -0.5, endY: 0.25 })
  })

  /** Verovio's cap, in closed form: the widest mouth a wedge of `length` may open to. */
  const ceiling = (length: number) =>
    2 * length * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2))

  it('⭐ narrows a SHORT wedge rather than letting it open into an arrowhead', () => {
    // Verovio's rule, read from `Hairpin::CalcHeight` — at OUR degrees, not its 16 (his eye found
    // 16 slightly too open on a 5.5-space wedge). LilyPond states the same intent as a minimum
    // LENGTH and enforces it by pushing the columns apart, which we cannot do: our length is
    // musical. Asserted against the constant, so tuning the degrees does not break this.
    expect(resolveHairpinShape(undefined, 1).aperture).toBeCloseTo(ceiling(1), 5)
    expect(resolveHairpinShape(undefined, 0.5).aperture).toBeCloseTo(ceiling(0.5), 5)
  })

  it('…and the crossover is where the cap meets the default, ≈7.4 staff spaces', () => {
    // Below it the angle rules, above it the constant does. Verovio's own crossover for the same
    // 1.5 sp aperture is 5.34, at its 16°; ours is 7.4 because the cap came down to 11.5°.
    const crossover = HAIRPIN.APERTURE / (2 * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2)))
    expect(resolveHairpinShape(undefined, crossover - 0.5).aperture).toBeLessThan(HAIRPIN.APERTURE)
    expect(resolveHairpinShape(undefined, crossover + 0.5).aperture).toBe(HAIRPIN.APERTURE)
  })

  /** The growth ramp: the automatic mouth for a wedge of `length`, before the steepness cap. */
  const ramp = (length: number) =>
    HAIRPIN.APERTURE + HAIRPIN.GROWTH_PER_SPACE * Math.max(0, length - HAIRPIN.GROWTH_FROM_SPACES)

  it('⭐⭐ OPENS a long wedge — the growth ramp, which is Dorico\'s shape and nobody else\'s numbers', () => {
    // The assertion this replaced said a long wedge never opens past the default, and its comment
    // named itself as the one that would change if the answer ever became yes. It did (2026-08-15):
    // the black at a long wedge's closed end is `thickness ÷ aperture` OF ITS LENGTH, so the only
    // fixes are a wider mouth or curved arms, and curved arms stop being a hairpin.
    const long = 60
    expect(ramp(long)).toBeGreaterThan(HAIRPIN.APERTURE)           // the premise: this length grows
    expect(resolveHairpinShape(undefined, long).aperture).toBeCloseTo(ramp(long), 5)
    // ⭐ AFFINE, not through the origin — the property the angle form lacked. Doubling the distance
    // past the start doubles the EXTRA, not the mouth, so where growth begins and how fast it climbs
    // are two numbers and can be tuned against each other. His 45-space wedge needed to grow while
    // his 65-space one needed to stay small; one parameter could not do both.
    const extra = (l: number) => resolveHairpinShape(undefined, l).aperture - HAIRPIN.APERTURE
    expect(extra(HAIRPIN.GROWTH_FROM_SPACES + 20)).toBeCloseTo(2 * extra(HAIRPIN.GROWTH_FROM_SPACES + 10), 5)
  })

  it('…leaves a SHORT or ordinary wedge exactly as it was', () => {
    // The whole reason a min-angle was chosen over a slur-style asymptote: an asymptote moves every
    // wedge, and he had already approved how the ordinary ones look.
    // ⚠️ Starts at 8, not 6: below ≈7.4 spaces the STEEPNESS cap narrows the mouth, which is a
    // different rule with its own test. `GROWTH_FROM_SPACES` is the last length left alone.
    for (const length of [8, 10, 20, HAIRPIN.GROWTH_FROM_SPACES]) {
      expect(ramp(length)).toBe(HAIRPIN.APERTURE)
      expect(resolveHairpinShape(undefined, length).aperture).toBe(HAIRPIN.APERTURE)
    }
  })

  it('…and never opens past MAX_APERTURE, however long the wedge', () => {
    // Without a ceiling the floor has none: 300 spaces would ask for a mouth wider than two staves.
    expect(resolveHairpinShape(undefined, 300).aperture).toBe(HAIRPIN.MAX_APERTURE)
    expect(resolveHairpinShape(undefined, 100000).aperture).toBe(HAIRPIN.MAX_APERTURE)
  })

  it('⭐ the floor does NOT touch an AUTHORED aperture — the cap does, the floor does not', () => {
    // Asymmetric on purpose. A hand-set mouth is a human fixing this by eye; growing it would argue
    // with the person the rule serves. The cap stays two-sided: no arrowheads, authored or not.
    expect(resolveHairpinShape({ aperture: 0.8 }, 300).aperture).toBe(0.8)
    expect(resolveHairpinShape({ aperture: 9 }, 1).aperture).toBeCloseTo(ceiling(1), 5)
  })

  it('the ramp and the cap cannot cross above the cap\'s own range, so they never fight', () => {
    // The cap may narrow a SHORT wedge — that is its job — but must never be the binding rule on a
    // long one, or the growth ramp would be silently dead. Asserted rather than assumed, because
    // every one of these constants is a taste number fitted by eye and edits are expected.
    for (const length of [10, 20, 100, 1000]) {
      expect(ramp(length)).toBeLessThanOrEqual(ceiling(length))
    }
  })

  it('caps an authored aperture too, and never returns a negative one', () => {
    expect(resolveHairpinShape({ aperture: 5 }, 1).aperture).toBeCloseTo(ceiling(1), 5)
    expect(resolveHairpinShape(undefined, -3).aperture).toBe(0)
  })
})

describe('fragmentOpening — a split wedge STEPS at the break', () => {
  it('an unsplit wedge opens from nothing to the full aperture', () => {
    expect(fragmentOpening('single', 'cresc')).toEqual({ start: 0, end: 1 })
  })

  it('a diminuendo is its mirror', () => {
    expect(fragmentOpening('single', 'dim')).toEqual({ start: 1, end: 0 })
  })

  it('⭐⭐ the continuation resumes NARROWER than the first fragment ended — LilyPond\'s thirds', () => {
    // Read from `lily/hairpin.cc` and confirmed identical in Verovio's `view_control.cpp`:
    //   first  0 → 2/3      continuation  1/3 → 1      middle  1/3 → 2/3
    // ⛔ NOT an interpolation across the whole span — the plan said it was, and three engines say
    // otherwise. The step is what lets each fragment read as a wedge in its own right.
    expect(fragmentOpening('begin', 'cresc')).toEqual({ start: 0, end: 2 / 3 })
    expect(fragmentOpening('end', 'cresc')).toEqual({ start: 1 / 3, end: 1 })
    expect(fragmentOpening('middle', 'cresc')).toEqual({ start: 1 / 3, end: 2 / 3 })
    // The tell: the continuation starts at 1/3 where the first fragment left off at 2/3.
    expect(fragmentOpening('end', 'cresc').start).toBeLessThan(fragmentOpening('begin', 'cresc').end)
  })

  it('the fractions ignore WHERE the break fell — they are constants, in every engine read', () => {
    // Nothing is passed in but the role, which is the point: no length, no position, no ratio.
    expect(fragmentOpening('begin', 'cresc')).toEqual(fragmentOpening('begin', 'cresc'))
  })

  it('a split diminuendo mirrors the same fractions', () => {
    // A dim is a cresc read right to left, so the roles mirror as well as the values.
    const begin = fragmentOpening('begin', 'dim')
    const end = fragmentOpening('end', 'dim')
    expect(begin.start).toBeCloseTo(1, 10)
    expect(begin.end).toBeCloseTo(1 / 3, 10)
    expect(end.start).toBeCloseTo(2 / 3, 10)
    expect(end.end).toBeCloseTo(0, 10)
  })
})

/**
 * ⭐ {@link authoredApertureRange} — the bounds the Properties mouth control offers (his ask,
 * 2026-08-17: *"we have a max mouth and a min mouth value, so this should be the boundaries also in
 * properties"*).
 *
 * ⭐ The claim worth pinning: the MAXIMUM is length-dependent. `MAX_APERTURE` is the widest the
 * automatic rule ever asks for, but on a SHORT wedge the steepness cap is far the smaller of the two —
 * and offering the constant there would let a number be typed that `resolveHairpinShape` silently
 * pulls back, which is a control that lies about what it did.
 */
describe('authoredApertureRange', () => {
  const ceiling = (len: number) =>
    2 * len * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2))

  it('is bounded above by the engine\'s own maximum on an ordinary wedge', () => {
    expect(authoredApertureRange(60).max).toBe(HAIRPIN.MAX_APERTURE)
  })

  it('⭐ …but by the STEEPNESS CAP on a short one, which is the smaller of the two', () => {
    const short = 8
    expect(ceiling(short)).toBeLessThan(HAIRPIN.MAX_APERTURE)
    expect(authoredApertureRange(short).max).toBeCloseTo(ceiling(short), 5)
  })

  it('⭐⭐ both ends are CONSTANTS OF THIS FILE — no number invented for the UI', () => {
    // 0.25 was tried and rejected on sight: at 0.16 thickness it is solid ink for 64% of the wedge.
    // The floor is Dorico's own "Minimum hairpin aperture" default of one space — a little under the
    // 1.5 the automatic rule never goes below, which is the point of a HUMAN bound.
    expect(authoredApertureRange(40).min).toBe(HAIRPIN.AUTHORED_MIN_APERTURE)
    expect(authoredApertureRange(40).max).toBe(HAIRPIN.MAX_APERTURE)
    expect(HAIRPIN.AUTHORED_MIN_APERTURE).toBeLessThan(HAIRPIN.APERTURE)
  })

  it('⚠️ on a SHORT wedge the CAP is the ceiling — a wider bound would invite a capped value', () => {
    // At 5.5 spaces the cap is 1.11, which is the mouth the automatic rule gives there too. The floor
    // still stands, so the range narrows rather than moving: 1 … 1.11.
    const short = 5.5
    const r = authoredApertureRange(short)
    expect(r.max).toBeCloseTo(ceiling(short), 5)
    expect(r.max).toBeLessThan(HAIRPIN.APERTURE)
    expect(r.min).toBe(HAIRPIN.AUTHORED_MIN_APERTURE)
  })

  it('…and on a wedge shorter than the floor itself, the range COLLAPSES to the cap', () => {
    // Under about 5 spaces the angle limit is below one space, and then it is the whole answer: there
    // is nothing to author, which is honest rather than awkward.
    const tiny = 3
    const r = authoredApertureRange(tiny)
    expect(ceiling(tiny)).toBeLessThan(HAIRPIN.AUTHORED_MIN_APERTURE)
    expect(r.min).toBe(r.max)
    expect(r.max).toBeCloseTo(ceiling(tiny), 5)
  })

  it('never inverts — min ≤ max at every length', () => {
    for (const len of [0, 0.1, 3, 5.5, 12, 36, 60, 200]) {
      const r = authoredApertureRange(len)
      expect(r.min).toBeLessThanOrEqual(r.max)
    }
  })
})
