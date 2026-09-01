import { describe, it, expect } from 'vitest'
import {
  IDENTITY, apply, compose, invert, isIdentity, isScaling, isTranslation,
  scaling, scalingAbout, translation,
} from './Affine'

/**
 * ⭐ **Pure arithmetic, so the whole contract runs in jsdom** — which is the point of a placement
 * being a value rather than an attribute string. ⛔ Nothing here touches a DOM, and nothing here
 * needs a font: this is the half of the engine that P2 and P1 exist to grow
 * (`docs/own-engraving-engine.md` §7.2.1 — *"every metric we can put in a table moves a decision
 * from `engrave/` to `layout/`"*, and every placement we can express as a value does the same).
 *
 * ⚠️ **The composition ORDER is the one thing here that can be wrong in a way that looks right.**
 * A uniform scale and a translation commute in appearance often enough to hide it, so each order
 * assertion below is written against a case where the two orders genuinely differ.
 */

describe('the constructors', () => {
  it('IDENTITY places a point where it already is', () => {
    expect(apply(IDENTITY, 3, 7)).toEqual({ x: 3, y: 7 })
    expect(isIdentity(IDENTITY)).toBe(true)
  })

  it('scaling takes one argument for the uniform case', () => {
    expect(scaling(2)).toEqual(scaling(2, 2))
    expect(apply(scaling(0.7), 10, 20)).toEqual({ x: 7, y: 14 })
  })

  it('translation moves without resizing', () => {
    expect(apply(translation(5, -3), 1, 1)).toEqual({ x: 6, y: -2 })
  })
})

describe('compose', () => {
  // 🚨 THE ORDER TEST, and it is chosen so the two readings disagree: scale-then-translate moves
  // the point by the full 10, translate-then-scale would move it by 10 × 2 = 20.
  it('⭐⭐ is "p THEN q" — scale first, then translate, is not the other way round', () => {
    const scaleThenTranslate = compose(scaling(2), translation(10, 0))
    expect(apply(scaleThenTranslate, 1, 0)).toEqual({ x: 12, y: 0 })

    const translateThenScale = compose(translation(10, 0), scaling(2))
    expect(apply(translateThenScale, 1, 0)).toEqual({ x: 22, y: 0 })
  })

  it('⭐ matches SVG: `transform="translate(t) scale(s)"` is compose(scale, translate)', () => {
    // The brace writes exactly this pair (`systemStart.drawBrace`), and the equivalence is what
    // lets `svgDrawGroup` emit one attribute for it.
    const m = compose(scaling(3, 5), translation(100, 200))
    expect(m).toEqual({ a: 3, b: 0, c: 0, d: 5, e: 100, f: 200 })
  })

  it('leaves a placement alone when composed with IDENTITY, both ways', () => {
    const m = compose(scaling(2, 3), translation(4, 5))
    expect(compose(m, IDENTITY)).toEqual(m)
    expect(compose(IDENTITY, m)).toEqual(m)
  })
})

describe('scalingAbout', () => {
  it('⭐ leaves its centre exactly where it was — that is the whole definition', () => {
    const m = scalingAbout(3, 7, 40, 90)
    const at = apply(m, 40, 90)
    expect(at.x).toBeCloseTo(40, 10)
    expect(at.y).toBeCloseTo(90, 10)
  })

  it('…and still scales everything else', () => {
    // The grouping-sign ghost's shape: scaled about the cursor's y, x untouched at the origin.
    const m = scalingAbout(2, 2, 0, 100)
    expect(apply(m, 10, 110)).toEqual({ x: 20, y: 120 })
  })
})

describe('the predicates — the SVG shorthand depends on them being exact', () => {
  it('a pure scale is not a translation, and vice versa', () => {
    expect(isScaling(scaling(0.7))).toBe(true)
    expect(isTranslation(scaling(0.7))).toBe(false)
    expect(isTranslation(translation(1, 2))).toBe(true)
    expect(isScaling(translation(1, 2))).toBe(false)
  })

  // 🚨 The break-test for `svgDrawGroup.transformAttr`: a composite must NOT look like either, or it
  // would be emitted as a shorthand that drops half of it.
  it('🚨 a scale composed with a translate is NEITHER — it must fall through to a matrix', () => {
    const m = compose(scaling(3, 5), translation(100, 200))
    expect(isScaling(m)).toBe(false)
    expect(isTranslation(m)).toBe(false)
    expect(isIdentity(m)).toBe(false)
  })

  it('⭐ scale(1) IS the identity — so a full-size staff writes no attribute at all', () => {
    expect(isIdentity(scaling(1))).toBe(true)
    expect(isIdentity(translation(0, 0))).toBe(true)
  })
})

describe('invert — rule 5’s enabler', () => {
  it('⭐ round-trips a point through a placement and back', () => {
    const m = compose(scaling(0.7, 1.3), translation(15, -40))
    const there = apply(m, 12, 34)
    const back = apply(invert(m)!, there.x, there.y)
    expect(back.x).toBeCloseTo(12, 10)
    expect(back.y).toBeCloseTo(34, 10)
  })

  // ⛔ A GUESSING FALLBACK GETS BELIEVED. A placement that collapses the plane has no inverse, and
  // saying "identity" would put a click back at a coordinate nothing was drawn at.
  it('⛔ answers NULL for a singular placement, never an identity', () => {
    expect(invert(scaling(0, 1))).toBeNull()
    expect(invert(scaling(1, 0))).toBeNull()
  })
})
