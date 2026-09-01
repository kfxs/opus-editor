/**
 * ⭐⭐ **A PLACEMENT — where a drawn thing sits, as one value** (`docs/own-engraving-engine.md`
 * rule 8, and §7.5.4's first decision).
 *
 * > *"A scene primitive carries a PLACEMENT (an affine), not an (x, y). Identity for every note ever
 * > engraved normally; `paint/` composes it down the group stack."*
 *
 * That rule was written to bind *"the day `scene/` is typed"*, and this is that day. It costs
 * nothing today — ⛔ **every placement this codebase currently makes is a pure scale, a pure
 * translate, or one of each** — and §7.5 is the argument for why it cannot be retrofitted cheaply
 * after P3: what forecloses a future is a reader that assumes, and a `{ x, y }` field is that reader
 * in its smallest form.
 *
 * ⭐ **The precedent is measured, not imagined.** *Belle, Bonne, Sage* engraves *Bike Ride* — a piece
 * whose staves are the wheels of a bicycle — with an engraver that is **translate-only**: the
 * curvature lives entirely in one affine per fragment, and its `Painter` composes a stack of them
 * (`child.a = parent.a * child.a`). Read out of the source, not guessed;
 * `reference/belle/` holds the manifest. ⛔ Nothing here builds eye music, and nothing here is a
 * licence to.
 *
 * ## The matrix
 *
 * SVG's own 2×3, in SVG's own order — `matrix(a b c d e f)`:
 *
 * ```
 *   | a  c  e |     x' = a·x + c·y + e
 *   | b  d  f |     y' = b·x + d·y + f
 *   | 0  0  1 |
 * ```
 *
 * ⚠️ **`b` and `c` are the off-diagonal (skew/rotation) terms and they are 0 in everything we draw
 * today.** They are declared anyway, because a placement that cannot represent a rotation is an
 * `(x, y)` with extra steps — which is exactly what rule 8 forbids.
 */

/** A 2×3 affine, in SVG's `matrix(a b c d e f)` order. ⛔ Treat as immutable — compose, never mutate. */
export interface Affine {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** ⭐ The placement of everything engraved normally. */
export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** A uniform or non-uniform scale about the origin. */
export function scaling(sx: number, sy: number = sx): Affine {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
}

/** A translation. */
export function translation(dx: number, dy: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy }
}

/**
 * ⭐ **`p` THEN `q`** — i.e. `q ∘ p`, the matrix product `q · p`: a point is placed by `p` first and
 * the result placed by `q`. That is the order a group stack composes in (Belle's
 * `child.a = parent.a * child.a`, with `q` the parent), and it is the order the SVG attribute
 * `transform="q p"` reads in.
 */
export function compose(p: Affine, q: Affine): Affine {
  return {
    a: q.a * p.a + q.c * p.b,
    b: q.b * p.a + q.d * p.b,
    c: q.a * p.c + q.c * p.d,
    d: q.b * p.c + q.d * p.d,
    e: q.a * p.e + q.c * p.f + q.e,
    f: q.b * p.e + q.d * p.f + q.f,
  }
}

/**
 * A scale that leaves the point `(cx, cy)` where it is — `translate(c) · scale(s) · translate(-c)`.
 *
 * ⭐ The grouping-sign ghost is the one caller: its sign must hang where the POINTER is, whatever
 * its own glyph box says, so the scale is taken about the cursor.
 */
export function scalingAbout(sx: number, sy: number, cx: number, cy: number): Affine {
  return compose(compose(translation(-cx, -cy), scaling(sx, sy)), translation(cx, cy))
}

/** Is this the placement of something engraved normally? — the fast path everywhere. */
export function isIdentity(m: Affine): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0
}

/** A pure scale about the origin — no translation, no skew. */
export function isScaling(m: Affine): boolean {
  return m.b === 0 && m.c === 0 && m.e === 0 && m.f === 0
}

/** A pure translation — no scale, no skew. */
export function isTranslation(m: Affine): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1
}

/**
 * ⭐⭐ **THE INVERSE — and it is why rule 5 can be kept.**
 *
 * > ⛔ *"No inverse mapping written as straight-staff arithmetic. Ask the placement; never compute
 * > `(staffTop − y) / spacing` by hand."*
 *
 * A placement that cannot be inverted forces every reader that maps a pixel back to a musical
 * position to re-derive the transform by assuming what it was. ⚠️ Returns **null** for a singular
 * matrix (a placement that collapses the plane — a scale of 0). ⛔ Not an identity fallback: a
 * caller that cannot invert must say so, because a guessed inverse is believed
 * (`a GUESSING FALLBACK gets believed → return null`).
 */
export function invert(m: Affine): Affine | null {
  const det = m.a * m.d - m.b * m.c
  if (det === 0 || !Number.isFinite(det)) return null
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  }
}

/** Place a point. */
export function apply(m: Affine, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}
