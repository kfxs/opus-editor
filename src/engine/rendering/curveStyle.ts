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
  /**
   * ⭐⭐ **LilyPond's `height-limit`** — the arch height the law approaches but never reaches, and
   * therefore the flattest a long slur can get (`define-grobs.scm:3178`, the `Slur` grob).
   *
   * ⭐ **HIS CALL, 2026-08-16, option (b) of §12 Phase 2**: adopt LilyPond's law whole, replacing our
   * own floor-plus-slope-with-a-cap. Ours drew a short two-note slur **1.9× taller than LilyPond's**
   * — the commonest slur on a page, and the source of the hookiness — while its long end sat pinned
   * against a ceiling, which is a law running out of road rather than a shape.
   */
  slurHeightLimit: 2.0,
  /** Extra arch height per nesting level, so concentric slurs don't collide (§8, `slurNestDepths`). */
  slurNestGap: 1.0,
  /**
   * ⚠️⚠️ **OURS, and provisional** — how far the slant ceiling may lift an endpoint away from its own
   * note (`./slurSlantLimit`, §12 Phase 6). Verovio's `GetAdjustedSlurAngle` has no such bound and
   * will walk an endpoint as far as the arithmetic asks; Gould gives a MINIMUM of ½ sp from the
   * notehead and no maximum, and the practitioners' remedy for a steep slur was a SIDEWAYS shift of
   * half a notehead, not a lift (notat.io t=861). ⛔ No source: a number to tune by eye.
   */
  slurSlantMaxTravel: 1.0,
  /**
   * ⭐⭐ **How far a slur's endpoint stands CLEAR of the stem it sits beside** (`./slurStemEndpoint`,
   * §12.1) — sideways, so the arc leaves from *beyond* the stem instead of across it.
   *
   * ⭐ **A convergence, not a taste call**: LilyPond **0.3** (`slur-scoring.cc:751`, its x becomes
   * the stem's far edge ∓ 0.3 whenever a candidate endpoint falls inside the stem's y extent) and
   * MuseScore **0.35** (`stemOffsetX`, `slurtielayout.cpp:398`, applied in every stem-side case).
   * Verovio moves its endpoint a whole space sideways with the comment *"Primary endpoint on the
   * side, move it right"*. We take MuseScore's, because the vertical half of this phase is
   * MuseScore's rule and the two should not disagree about the same figure by 0.05 sp.
   */
  slurStemDodge: 0.35,
  /** How far outside the stem's own y extent an endpoint still counts as *beside* it, and so still
   *  wants the dodge above — LilyPond's `stem_y.widen(0.25 * staff_space)` (`slur-scoring.cc:747`). */
  slurStemNearBand: 0.25,
  /**
   * ⭐ **How close a staff line may come to a tie's arc before it counts as running alongside it** —
   * MuseScore's `badArcIntersectionLimit` (`slurtielayout.cpp:2447`). The TRIGGER.
   */
  tieLineClearance: 0.15,
  /**
   * ⭐⭐ **How much daylight the repair leaves between that line and the arc** — LilyPond's
   * `center-staff-line-clearance` 0.6 half-spaces = **0.3 sp** (`define-grobs.scm:3877`), the number
   * it holds an apex to. Three sources, three roles: MuseScore says WHEN, LilyPond says HOW FAR, and
   * Gould says WHAT TO CHANGE.
   *
   * ⭐⭐ **HIS EYE, 2026-08-16, and it overturned the first build.** Phase 3 originally TRANSLATED
   * the whole tie outward (LilyPond's own repair for a shallow tie, 0.225 sp). He looked at a tied
   * G4 — a line note — and asked *"isn't the edge of the tie too low?"* It was: moving the tie moves
   * its TIPS, which were 0.20 sp clear of the notehead's edge (Gould's *"should almost touch"*,
   * §13.3) and became 0.42. Two settled things were in conflict and the translation spent the one
   * Gould states outright.
   *
   * ⭐ So the repair is MuseScore's instead — **grow the ARC and leave the tips alone** — and Gould's
   * sentence turns out to describe exactly that: *"sufficiently round to be conspicuous through a
   * stave-line"*. A line-note tie's apex goes 0.40 → 0.60 sp; a space-note tie is untouched. ⛔ This
   * does not re-open the DEFAULT height (§13.1, settled): it is a local repair at one collision,
   * which is what all three engines do.
   */
  tieLineApexClearance: 0.3,
  /** Ceiling on that growth, as a fraction of the arc's own height — MuseScore's `maxArcCorrection`
   *  (`slurtielayout.cpp:2480`). Ours needs a third of it; the cap is what stops a pathological
   *  staff (a huge line distance) from turning a tie into a balloon. */
  tieLineMaxGrowth: 0.75,
  /** How long the PENDING tie's preview stub is — the arc that hangs off a selected note while the
   *  tie is being made. Shared with the armed tool's ghost so the two previews are one shape. */
  tieStubLength: 2.0,
  /** ⭐ How far PAST the stem end a slid endpoint may travel (`./slurStemEndpoint`, §12 Phase 1).
   *  MuseScore's clamp on the same rule — a leap wide enough to want more would otherwise launch the
   *  arc off the end of a stem it has left behind. ⚠️ NEW in Phase 1: it replaced no pixel literal. */
  slurStemOvershoot: 1.0,
  /**
   * ⭐⭐ **How far a tie's tips sit from the notehead's CENTRE, horizontally** — Verovio's, his call
   * of 2026-08-16, and read at source rather than from the research summary.
   *
   * `startPoint.x += r1 + unit/2` and `endPoint.x -= r2 + unit/2` (`src/tie.cpp:381, 391`), where
   * `x` arrives at the head's centre and `unit` is half a staff space: so a tie runs from **the
   * start head's centre + 0.25 sp** to **the end head's centre − 0.25 sp**, its tips OVER the two
   * noteheads rather than in the gap between them. That is Gould p. 62 — *"the tie starts and
   * finishes at the centre of the notehead"* — moderated by a quarter space.
   *
   * 🚨 **§13.3 recorded this as "the outer edge, 0.25 sp OUTWARD" and that is a misreading**; the
   * code moves INWARD from the centre. Ours was the head's outer edge with no deliberate gap, so
   * this shortens every tie by ~0.68 sp and puts its ends over the heads.
   *
   * ⏭️ Not taken: Verovio's stem-side variant for a SHORT tie, which runs from the head's outer edge
   * + 0.25 sp when the stem is on the tie's side (`:88–98`).
   */
  tieEndpointInset: 0.25,
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
   * ⭐⭐ **This IS the drawn midpoint thickness now** — §12 Phase 4, 2026-08-16. It used to be the
   * `renderCurve` FILL GAP, so the ink actually measured `0.75 × gap + outline` and the authored
   * number was a third under what landed on the page: 0.27 written, **0.30 drawn**. The gap is
   * derived from this in `./curveArc`, which is Verovio's `GetBezierThicknessCoefficient`
   * (`boundingbox.cpp:945`) — it narrows the fill by the stroke so fill + outline equals the nominal
   * exactly, where we simply added the two.
   *
   * ⭐ **The value is Bravura's `slurMidpointThickness`**, and the field is: LilyPond 0.17 · Bravura
   * **0.22** · MuseScore 0.21 nominal (0.29 drawn) · Verovio 0.25 (0.30 for its slur) · ours 0.30
   * until today. §13.6 downgraded this from a correction to a TASTE call inside a real range — we
   * sat at its top edge, and this puts us on the published number. ⛔ One constant: if it reads thin,
   * 0.30 is where it was.
   *
   * ⚠️ **It touches the HAIRPIN's taste, which he set by matching this curve** — *"i like the stroke
   * with this size (cause it match better with other elements, for example the stroke of the slur)"*
   * — at 0.16 sp. Thinning the slur's middle moves it TOWARD the hairpin, not away.
   */
  thickness: 0.22,
  /** Stroke width pinned around the curve so its fill taper reads as sharp tips — and, at the tip
   *  where the two passes meet, it IS the ink: 0.10 sp = Bravura's `slurEndpointThickness` exactly
   *  (§13.6). ✅ Already correct; ⛔ don't change it to fix the middle. */
  outline: 0.10,
} as const

/**
 * ⭐ **LilyPond's `ratio`** — how steeply the arch climbs before the limit above starts to bite
 * (`define-grobs.scm:3181`). **Dimensionless**, so it has no px twin and needs no conversion.
 *
 * ⚠️ **0.25 is the SLUR's; 0.333 is the PHRASING slur's, and the tie's** (with `height-limit` 1.0) —
 * three grobs, three pairs. We take the slur's for the slur and ⛔ leave the tie's height alone, his
 * call of 2026-08-15 (§13.1).
 *
 * ⛔ The constants this replaced — a 0.93 sp floor, a 0.06 slope and a 2.2 cap — are gone with the
 * law that used them; §12 Phase 2's table records what they drew.
 */
export const SLUR_HEIGHT_RATIO = 0.25

/**
 * ⚠️⚠️ **THE MAXIMUM SLANT, IN DEGREES — HIS CALL, 2026-08-16, AND THE ONE CONSTANT IN THIS FILE
 * WITH NO PUBLISHED SOURCE AT ALL.**
 *
 * *"in this case we beguin with verovio choice… but it should not be a truth.. maybe we tweak it
 * later… but for the plan this is a good number i guess"*. It is Verovio's `slurMaxSlope` default
 * (`src/slur.cpp:570`), taken because Verovio's shape maths is the one ours most resembles.
 *
 * ⛔ **Never write this up as an engraving rule.** No book caps a slur's angle — Gould, Gedan and
 * Ross all say only that a slur must FOLLOW the melodic line (§11.10). LilyPond's `max-slope` 1.1
 * (≈48°) is a scoring penalty, not a limit. The honest citation is *"Verovio's default, adopted by
 * him 2026-08-16"*.
 */
export const SLUR_MAX_SLANT_DEG = 60

/**
 * ⏭️ **Verovio's minimum control angle, kept here as the RECORD of a rule we costed and did not
 * build** (`GetMinControlPointAngle`, `adjustslursfunctor.cpp:944`): a short, steeply tilted slur is
 * made rounder — 30° at least, +15° in proportion to the tilt, fading out from 4 sp of span to 8.
 *
 * ⛔ Unused on purpose. The tail of `./slurSlantLimit` records the three things that stopped it: our
 * arch is lifted vertically where Verovio measures perpendicular to the chord, the honest
 * requirement is asymmetric between the two ends, and solved on a real fixture it asks for a 2.5 sp
 * apex on a 3.5 sp span. It is a shape decision needing his eye, not an import.
 */
export const SLUR_CONTROL_ANGLE = { min: 30, boostMax: 15, fullBelowSpaces: 4 } as const

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
