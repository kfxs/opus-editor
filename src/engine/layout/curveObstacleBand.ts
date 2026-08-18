/**
 * ⭐⭐ **WHAT A DRAWN CURVE OCCUPIES OVER A STRETCH OF ONE SYSTEM** — the slur (and the tie) as an
 * obstacle the outside-staff ladder can see. P1 of docs/trill-slur-clearance-plan.md.
 *
 * ## Why it exists
 *
 * `./inkBand` answers *how far does the MUSIC reach* and says of itself, in its header: *"⛔ It does
 * not know about articulations, slurs or tuplet brackets."* `./outsideStaffBand` answers *and what
 * has been placed there since*. Neither can answer for a slur: an arc is not modelled ink and it is
 * not a placed ladder member — it is a curve whose height nobody knows until it has been drawn. So a
 * `tr` inside a slur's span went straight through the arc (his report, 2026-08-18), and Gould p. 135
 * says it must not: *"further from the note than any articulation marks. Only a long slur, a pause or
 * octave sign goes further from the stave."*
 *
 * ⭐ This module is the third input to the same sentence. A family merges it with the other two and
 * calls {@link clearanceBaseline} exactly as it does today — ⛔ **there is no second placement rule
 * here**, and there must not be: `./inkBand` forbids the copy in as many words.
 *
 * ## ⭐ Nothing is measured here
 *
 * `rendering/curveArc.ts` already samples every arc it draws — 17 points reconstructing the cubic,
 * for arc-proximity hit-testing — so the obstacle geometry is the DRAWN curve, for free. That is
 * also what the field uses: MuseScore tests a slur against ~20 sampled rectangles, Verovio against a
 * thickened bezier. ⛔ **Not the bbox**: a slur's box spans its whole arch, so a `tr` near an endpoint
 * would be pushed by an apex that is nowhere near it.
 *
 * ## The two discriminators, because geometry alone cannot tell you
 *
 * ⚠️⚠️ **An x-window is not enough to identify a curve.** X's repeat down the page — every system
 * starts at the same left margin — and two staves of one system are stacked in y. A window that
 * matched on x alone would let a slur on system 3 push a `tr` on system 1, and a lower staff's arc
 * push an upper staff's mark. So every curve is filed with its `staff` and its `line`, and both are
 * matched before a point is looked at. That is why {@link DrawnCurve} carries them and why they are
 * not derivable afterwards: `ElementRegistry`'s slur entries stamp every partial of a cross-system
 * slur with the WHOLE slur's `fromMeasure`/`toMeasure` and carry no staff at all.
 *
 * ## Coordinates
 *
 * ⭐ **Staff space, not SVG space** — the curve is filed from inside `inStaffSpace` with the numbers
 * it was drawn from, before `ElementRegistry.withScale` multiplies anything. So a small staff needs
 * no conversion here and none at the reader: the points, the stave's own y's and the trill's
 * arithmetic are all in one space already. ⛔ Do not re-file these off the registry, which holds the
 * scaled copies.
 *
 * ⚠️ The OUT is `./inkBand`'s axis — staff spaces below the staff's top line, above it negative — so
 * the answer merges with a music band and an occupied band with no conversion.
 *
 * ⛔ No module-level state: the collection is one array per render (`RenderPass.drawnCurves`), the
 * arrangement `RenderPass.occupiedBands` already uses for the same reason.
 */
import type { InkBand } from './inkBand'

/**
 * One drawn arc, filed by the pass that drew it — a slur half, a cross-system slur segment, or a tie.
 *
 * ⭐ Deliberately not "a slur": the trill's obstacle is any curve bowing over its notes, and a TIE is
 * the commoner case of the two. A trill's span runs *through* ties (`Trill.endNoteId` absent means
 * the start note's own sounding duration, through ties), and Gould p. 139 (*Change of trilling note*)
 * draws exactly that — ties hugging the noteheads with the wavy line above them.
 */
export interface DrawnCurve {
  /** 0-based staff index — the space these points are in, and half the identity. */
  staff: number
  /** The system it was drawn on. The other half: x's repeat on every line. */
  line: number
  /** The sampled cubic, in that staff's own space. `rendering/curveArc.ts` supplies it. */
  points: readonly { x: number; y: number }[]
}

/** Which curves to ask about, and over what stretch of drawn x. */
export interface CurveWindow {
  staff: number
  line: number
  /** Left edge, in the staff's own space — a fragment's own x0. */
  fromX: number
  /** Right edge, same space. */
  toX: number
}

/**
 * The stave the answer is stated against — its top line and its space size, both in the staff's own
 * space. Taken as two numbers rather than as a `Stave` so this module stays pure and testable
 * without a renderer (`getYForLine(0)` and `getSpacingBetweenLines()` are what a caller passes).
 */
export interface StaffFrame {
  topLineY: number
  spacePx: number
}

/**
 * ⭐ **THE READ.** What the curves on this `(staff, line)` occupy over `[fromX, toX]`, as a band on
 * `./inkBand`'s axis — `null` when no curve reaches into the window.
 *
 * ⚠️ **Sampled points, clipped to the window — not the curve's own extreme.** A slur bowing high in
 * the middle and a `tr` sitting near its endpoint do not meet, and the whole point of using the
 * samples rather than the bbox is to be able to say so.
 *
 * ⭐ **Closed on both edges**, `./outsideStaffBand`'s rule and for its reason: for a clearance
 * question, counting a point that merely abuts the window errs by pushing the mark further out,
 * which is the safe direction.
 *
 * ⛔ **It does not filter by which way the arc bows.** It does not need to: a slur below the staff
 * has its points below the staff, and `clearanceBaseline` floors an above-staff mark at the staff's
 * top line, so a band that only reaches downward cannot move it. One less thing to keep in sync with
 * `SlurRenderer`'s direction rule.
 */
export function curveObstacleBand(
  curves: readonly DrawnCurve[],
  window: CurveWindow,
  frame: StaffFrame,
): InkBand | null {
  if (!(frame.spacePx > 0)) return null
  const [left, right] = window.fromX <= window.toX
    ? [window.fromX, window.toX]
    : [window.toX, window.fromX]

  let top = Infinity
  let bottom = -Infinity
  for (const curve of curves) {
    if (curve.staff !== window.staff || curve.line !== window.line) continue
    for (const point of curve.points) {
      if (point.x < left || point.x > right) continue
      if (point.y < top) top = point.y
      if (point.y > bottom) bottom = point.y
    }
  }
  if (!Number.isFinite(top)) return null

  return {
    top: (top - frame.topLineY) / frame.spacePx,
    bottom: (bottom - frame.topLineY) / frame.spacePx,
  }
}
