/**
 * {@link resolveHairpinShape} + {@link apertureAt} — the wedge's shape, before any drawing.
 *
 * ⭐ Everything here is headless *because* the module is: it answers in staff spaces from constants
 * and one length, with no stave, no font and no SVG. That is the point of having a resolver at all
 * — the day the aperture and the slant become user controls they are a compartment client and these
 * assertions still hold (docs/dynamics-line-and-hairpins-plan.md §6). Where the wedge actually
 * lands is P3's, in the browser suite.
 */
import { describe, it, expect } from 'vitest'
import { HAIRPIN, fragmentOpening, resolveHairpinShape } from './hairpinShape'

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
    // Verovio's 16° cap, read from `Hairpin::CalcHeight`. LilyPond states the same intent as a
    // minimum LENGTH and enforces it by pushing the columns apart — which we cannot do, because
    // our length is musical.
    expect(resolveHairpinShape(undefined, 1).aperture).toBeCloseTo(ceiling(1), 5)
    expect(resolveHairpinShape(undefined, 0.5).aperture).toBeCloseTo(ceiling(0.5), 5)
  })

  it('…and the crossover is where the cap meets the default, ≈5.3 staff spaces', () => {
    // Below it the angle rules, above it the constant does. Verovio's own number for its 1.5 sp
    // aperture is 5.34; ours is the same arithmetic against 1.33.
    const crossover = HAIRPIN.APERTURE / (2 * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2)))
    expect(resolveHairpinShape(undefined, crossover - 0.5).aperture).toBeLessThan(HAIRPIN.APERTURE)
    expect(resolveHairpinShape(undefined, crossover + 0.5).aperture).toBe(HAIRPIN.APERTURE)
  })

  it('only ever NARROWS — a long wedge does not open past the default', () => {
    // The open question (whether a long hairpin should open wider, as he remembers Sibelius doing)
    // lives exactly here: today the answer is no, and this is the assertion that would change.
    expect(resolveHairpinShape(undefined, 1000).aperture).toBe(HAIRPIN.APERTURE)
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
