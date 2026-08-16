/**
 * ⭐⭐ **THE SLUR + TIE GEOMETRY, IN STAFF SPACES** — every number that shapes a curve, in the unit
 * the engraving literature states them in (docs/slur-plan.md §11–§13).
 *
 * One file for both, because they are one family: the same `drawCurveArc` primitive draws a slur, a
 * tie, each cross-system half and the armed tool's ghost, and §13.6 confirmed the two share a
 * WEIGHT — LilyPond and MuseScore use identical thicknesses for tie and slur, and Bravura gives one
 * pair of `slur*`/`tie*Thickness` values. What legitimately differs is the ARCH, and both arches are
 * here where they can be compared.
 *
 * ⭐ **Why staff spaces, when the drawing wants pixels** (docs/slur-plan.md §12.0 #8, Phase 7): these
 * used to be px living beside the code that drew them — `SLUR_LIFT = 10`, `TIE_BOW = 5.3`,
 * `CURVE_THICKNESS = 2.7` — which behaved as staff spaces only because the draw runs inside the
 * staff's `scale(k)` group. They are engraving numbers: Bravura publishes `slurMidpointThickness`
 * **0.22 sp**, Gould's tie *"almost touches the notehead"* is **0.2 sp** of clearance, LilyPond's
 * tip clearance is **0.225 sp**. Every one of them had to be divided by 10 in the head to be
 * compared, and the research's "ours" column came out wrong twice for exactly that reason. So the
 * authored number is now the one you can read a book against, and the pixels are DERIVED.
 *
 * ⛔ **The conversion is against the CONSTANT {@link STAFF_SPACE_PX}, never against a live stave.**
 * The same rule `trillStyle` states: this ink is drawn INSIDE the staff's scale group at a fixed px
 * size, so a small staff's curve is already the same number of ITS OWN spaces as a full-size one's.
 * Multiplying by the staff size here would apply it twice — the bug class of docs/staff-size-plan.md.
 * That is also why the ghost, which floats at the cursor with no stave under it at all, can use the
 * same numbers.
 *
 * ⚠️ **The px twins below are EXACTLY today's literals** — this file changed no drawn pixel when it
 * landed; `curveStyle.test.ts` pins each one against the value it replaced. Anything that wants to
 * change a curve's look (§12 Phases 2, 4, 6) changes the staff-space number here, and says so.
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐ **The numbers, in STAFF SPACES.** Where a phase of docs/slur-plan.md §12 will touch one, the
 * comment says which — so the next reader knows whether a value is settled or waiting on his eye.
 */
export const CURVE = {
  /** Gap from the notehead (or stem tip) to a slur's endpoint. Gould's minimum is ½ sp. */
  slurLift: 1.0,
  /** A cross-system half-arc's apex rise above its own endpoint line. ⏭️ §12 Phase 5 gives this an
   *  opinion about pitch — today it is the same flat number for BEGIN and END. */
  slurArc: 1.4,
  /** Base arch height (the cubic control rise; a cubic's drawn apex is 0.75× it).
   *  ⏭️ §12 Phase 2 — the SHORT-slur outlier, and the one intercept no other engine has. */
  slurBow: 0.93,
  /** Ceiling on the arch. ✅ Gould p. 109: *"the curve of a long slur is flattened"* — ⛔ our long
   *  end is in the middle of the pack (§12 Phase 2's table); don't touch it. */
  slurBowMax: 2.2,
  /** Extra arch height per nesting level, so concentric slurs don't collide (§8, `slurNestDepths`). */
  slurNestGap: 1.0,
  /** Gap from the notehead CENTRE to a tie's endpoints. ✅ §13.3: 0.70 from the centre is 0.20 clear
   *  of the head's edge = MuseScore's `yOffset` exactly, and Gould's *"should almost touch"*.
   *  ⛔ SETTLED — do not "fix". */
  tieLift: 0.70,
  /** The tie's cubic control rise → a 0.40 sp drawn apex, at every width.
   *  ⛔ SETTLED by his call, 2026-08-15 (§13.1): flatter than MuseScore on purpose, and Verovio's
   *  tie height is a constant too. Do not re-propose the height change. */
  tieBow: 0.53,
  /**
   * The belly swell shared by slurs AND ties — ONE number, because they are one weight.
   *
   * These used to be tuned apart: `SLUR_THICKNESS = 1.5` against `TIE_THICKNESS = 2.7`, the tie 1.8×
   * fatter, on the reasoning that "ties read heavier and hug the head". Engraving does not draw that
   * distinction — in Bravura's SMuFL `engravingDefaults`, `slurMidpointThickness` and
   * `tieMidpointThickness` are the same value, as are the two endpoint thicknesses. On screen the
   * mismatch showed as thin, undernourished slurs next to well-fed ties. ✅ §13.6 confirmed the
   * decision at source: LilyPond and MuseScore share one weight between the two as well.
   *
   * ⚠️ **This is the FILL GAP, not the drawn thickness.** `renderCurve` strokes a forward pass at
   * `cp.y` and a return at `cp.y + this`, then strokes AND fills, so the ink at the middle measures
   * `0.75 × this + outline` = **0.30 sp** today, against Bravura's 0.22. ⏭️ §12 Phase 4 (TASTE,
   * inside a real 0.17–0.30 range) — and it should become a NOMINAL midpoint thickness with the fill
   * gap derived from it, which is Verovio's `GetBezierThicknessCoefficient`.
   */
  thickness: 0.27,
  /** Stroke width pinned around the curve so its fill taper reads as sharp tips — and, at the tip
   *  where the two passes meet, it IS the ink: 0.10 sp = Bravura's `slurEndpointThickness` exactly
   *  (§13.6). ✅ Already correct; ⛔ don't change it to fix the middle. */
  outline: 0.10,
} as const

/**
 * How much the slur's arch grows per staff space of horizontal span — **dimensionless**, so it has
 * no px twin below and needs no conversion (spaces per space = pixels per pixel).
 *
 * ⚠️ Ours is the only floor-plus-slope law in the field: LilyPond's is an atan asymptote, Verovio
 * saturates, MuseScore is unbounded (§11.3). ⏭️ §12 Phase 2 may replace the whole law, in which case
 * this constant goes with it.
 */
export const SLUR_BOW_PER_SPAN = 0.06

/** Staff spaces → pixels for this family: against the score's staff space, ⛔ never a scaled stave
 *  (see the file note). The one place the curve family leaves engraving units. */
export function curvePx(staffSpaces: number): number {
  return staffSpaces * STAFF_SPACE_PX
}

/**
 * The same table in PIXELS, derived once — what the draw sites actually pass to `renderCurve`.
 *
 * ⚠️ Every value here is EXACTLY the literal it replaced (`curveStyle.test.ts` pins all nine), so
 * introducing this file moved no ink. ⛔ Never author a number here: change the staff-space one.
 */
export const CURVE_PX: { [K in keyof typeof CURVE]: number } = Object.fromEntries(
  Object.entries(CURVE).map(([key, spaces]) => [key, curvePx(spaces)]),
) as { [K in keyof typeof CURVE]: number }
