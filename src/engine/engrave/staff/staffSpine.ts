/**
 * ⭐⭐ **A STAFF IS A PATH — the SPINE** (`docs/plans/bent-staff-plan.md` A2; rule 6 of
 * `docs/plans/own-engraving-engine.md` §0.3: *"a staff is a SPINE plus a thickness — not a y and five
 * lines"*).
 *
 * A spine answers ONE question — *at distance `s` along you, where am I and at what angle?* — and its
 * inverse. Today's straight staff is the simplest spine; a circle is the second row; a spiral, a rose
 * or a heart are further rows and ⛔ no reader learns which one it was handed.
 *
 * ## The seam this is — read out of *Belle, Bonne, Sage*, checked against its source
 *
 * `belle-placement.h:354` — `s->a = Affine::Translate(Vector(TypesetX, y))` — is the one place in
 * that engine where a musical position becomes a page position, and every engraving module draws in
 * its own space and never asks where the page is. {@link placementAt} is that line as ours, with the
 * rotation Belle never wrote: a RIGID BLOCK (a note today, a beamed group later) is drawn upright in
 * its own space and placed by ONE affine. ⛔ Nothing is deformed — the *Bike Ride* plate deforms
 * nothing, not even its beams.
 *
 * ## The block's own space
 *
 * x runs ALONG the spine in the direction of travel, from the block's own origin; y runs ACROSS it,
 * downward on an upright staff — so a staff line's `offset` is its ordinary y below the spine.
 * ⚠️ On {@link circleSpine} travel is CLOCKWISE on the page, which puts "up" OUTWARD: stems-up notes
 * point away from the centre, as on the plate.
 *
 * ⚠️ Angles are RADIANS, positive CLOCKWISE on the page — `paint/Affine`'s `rotation` sense.
 *
 * ⛔ No DOM, no models (`lint:boundary`). ⛔ And no engraving numbers: a radius is the caller's.
 */
import type { Affine } from '@/engine/paint/Affine'
import { compose, rotation, translation } from '@/engine/paint/Affine'

/** A point ON the spine, and the direction of travel there. */
export interface SpinePoint {
  readonly x: number
  readonly y: number
  /** The tangent's angle — 0 is travel toward +x, positive turns clockwise on the page. */
  readonly angle: number
}

/** Where a page point is, in a spine's own terms — {@link Spine.locate}'s answer. */
export interface SpineLocation {
  /** Distance along the spine. ⚠️ May lie outside `[0, length]` on an open spine — the caller's call. */
  readonly s: number
  /** Distance ACROSS it, positive on the staff's "down" side ({@link pointAt}'s `offset`). */
  readonly offset: number
}

export interface Spine {
  /** The spine's whole length, in px of the space it is drawn in. */
  readonly length: number
  /** Does `s = length` arrive back at `s = 0`? A closed spine wraps `s`; an open one extrapolates. */
  readonly closed: boolean
  at(s: number): SpinePoint
  /**
   * ⭐ **THE INVERSE — rule 5's owner for a bent staff**: which `s` and `offset` a page point is at.
   * ⛔ **null where the spine cannot say** (a circle's own centre is equally near every `s`) — never
   * a guess, because a guessed position is believed.
   */
  locate(x: number, y: number): SpineLocation | null
}

/** A straight spine from `(x, y)`, `length` long, travelling at `angle` — 0 is today's staff. */
export function straightSpine(x: number, y: number, length: number, angle: number = 0): Spine {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  return {
    length,
    closed: false,
    at: s => ({ x: x + s * dx, y: y + s * dy, angle }),
    locate: (px, py) => ({
      s: (px - x) * dx + (py - y) * dy,
      offset: (py - y) * dx - (px - x) * dy,
    }),
  }
}

/** Twelve o'clock, as an angle from the centre — where {@link circleSpine} starts by default. */
const TOP_OF_CIRCLE = -Math.PI / 2

/**
 * A full circle about `(cx, cy)`, travelled CLOCKWISE on the page from `startAngle` (the angle from
 * the centre to `s = 0`; twelve o'clock by default, where travel is toward +x like a straight staff).
 */
export function circleSpine(cx: number, cy: number, radius: number, startAngle: number = TOP_OF_CIRCLE): Spine {
  const length = 2 * Math.PI * radius
  return {
    length,
    closed: true,
    at: s => {
      const phi = startAngle + s / radius
      return { x: cx + radius * Math.cos(phi), y: cy + radius * Math.sin(phi), angle: phi + Math.PI / 2 }
    },
    locate: (px, py) => {
      const dx = px - cx
      const dy = py - cy
      const distance = Math.hypot(dx, dy)
      if (distance === 0) return null
      const turn = (Math.atan2(dy, dx) - startAngle) % (2 * Math.PI)
      return { s: (turn < 0 ? turn + 2 * Math.PI : turn) * radius, offset: radius - distance }
    },
  }
}

/**
 * ⭐⭐ **WHERE A RIGID BLOCK SITS** — the block's own origin lands on the spine at `s`, its x axis
 * along the direction of travel. ⛔ A BLOCK, not a note: a beamed group is placed by this same call.
 */
/**
 * ⭐ **How much SHORTER the path is at `depth` below the spine** (px, toward the inside) — the ratio
 * of the offset curve's length to the spine's own.
 *
 * A staff bent into a loop has less arc on its inner lines than on the line the spine IS: for any
 * closed curve that turns once, the offset curve at depth `d` is shorter by exactly `2π·d` (a circle's
 * `2π(R − d)` is the plain case). An OPEN spine that does not turn loses nothing.
 *
 * It exists because spacing is a promise about INK not touching, and ink deep inside a circle stands
 * on the short arc: `eye/spineSpacing` spaces the music along the arc where the deepest ink is, so
 * that promise holds there, and everything nearer the rim simply gets more.
 *
 * ⚠️ Treats the curvature as EVEN along the path (true of a circle) — a path that bends sharply in
 * one place crowds its inside THERE more than this says. ⚠️ And "inside" is the staff's DOWNWARD side,
 * which is where `circleSpine` puts the centre.
 */
export function innerLengthRatio(spine: Spine, depth: number): number {
  if (!spine.closed || spine.length <= 0) return 1
  return Math.max(0.25, (spine.length - 2 * Math.PI * depth) / spine.length)
}

export function placementAt(spine: Spine, s: number): Affine {
  const { x, y, angle } = spine.at(s)
  return compose(rotation(angle), translation(x, y))
}

/**
 * The page point at `s`, `offset` ACROSS the spine — what ink drawn FROM the spine (the staff lines)
 * samples, and {@link Spine.locate}'s exact inverse.
 */
export function pointAt(spine: Spine, s: number, offset: number): { x: number; y: number } {
  const { x, y, angle } = spine.at(s)
  return { x: x - offset * Math.sin(angle), y: y + offset * Math.cos(angle) }
}
