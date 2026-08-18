/**
 * ⭐ **THE HAIRPIN'S SHAPE, behind one resolver** — how wide the mouth opens and where the two ends
 * sit relative to the dynamics line. Everything the drawing would otherwise hard-code.
 *
 * The pattern is the slur's, one family over: `SlurRenderer.resolveCps` answers *a hand-edited shape
 * converted to pixels against the live stave, ELSE the auto arch*, and `slurEndpointOffsetPx` yields
 * zero for a missing offset so the caller adds it without a branch. Copying that here is the whole
 * reason this file exists: aperture and slant are both wanted as user controls later
 * (docs/dynamics-line-and-hairpins-plan.md §6), and the day they arrive they must be a compartment
 * client plus a drag — with no geometry rewritten, because the drawing already asks a resolver
 * instead of reading a constant.
 *
 * ⚠️ **The slant is TWO endpoint deltas, never an `angle` field.** An angle would have to name a
 * pivot; the two ends are what a user actually grabs, and it is why in Dorico moving only the start
 * handle tilts the wedge rather than doing nothing. The *opening* angle, meanwhile, is not stored
 * anywhere by anyone: it is `atan((aperture/2) / length)`, derived. Build it the other way round —
 * an angle constant that the length is fitted to — and a long crescendo opens into a funnel.
 *
 * Everything here is in **staff spaces**, so a small staff's wedge closes up with it.
 */

/** The measured defaults, and where each came from. ⚠️ Numbers to settle BY EYE, like the spacing
 *  model's — this is where the tuning starts, not where it ends. */
export const HAIRPIN = {
  /**
   * The mouth at the wide end, total (both arms), in staff spaces.
   *
   * ⚠️ **The engines do not agree, and the disagreement is small enough to settle by eye.** Read
   * from source: LilyPond `Hairpin.height` 0.6666 *per side* → **1.333** together
   * (`scm/define-grobs.scm`; the stencil draws `+h` and its mirror `−h`). Verovio `hairpinSize` 3
   * MEI units, and a MEI unit is half a staff space → **1.5** (`src/options.cpp:1335`). GUIDO
   * `deltaY` 3 half-spaces → **1.5** (`TagParameterStrings.cpp:49`). MuseScore `hairpinHeight`
   * → **1.15** (`style/styledef.cpp:329`, halved per side at `tlayout.cpp:3023`).
   *
   * ⭐⭐ **1.5 — the majority, chosen on 2026-08-15 over the 1.33 this started at**, when a wedge
   * over nine whole notes came back looking black at its closed end.
   *
   * ⭐ **Why the MOUTH is the lever for that, and the stroke is not.** Two arms opening by
   * `aperture` over `length` are less than one stroke width apart for the first
   * `thickness × length ÷ aperture` of the wedge — ink laid twice, read as one heavy line rather
   * than as a wedge. Measured on his report (85.5 staff spaces, browser suite): at 1.33 with the
   * family's 0.16 stroke that stretch was **10.3 spaces, 12% of the wedge**; at 1.5 it is **9.1
   * spaces, 10.7%**. The other half of the fraction, the stroke, was tried at MuseScore's 0.12 and
   * Verovio's 0.10 and both were rejected by eye — see `./thinLineWeight`, which records that so it
   * is not attempted a third time.
   *
   * ⭐ **It is the mouth a NORMAL wedge gets, and since 2026-08-15 no longer the mouth every wedge
   * gets** — a long one opens further, up to {@link HAIRPIN.MAX_APERTURE}. See
   * {@link HAIRPIN.MIN_ANGLE_DEGREES}, which is the rule, and which leaves this value untouched
   * below about 57 staff spaces — the range he approved it in.
   */
  APERTURE: 1.5,
  /**
   * ⭐⭐ **The narrowest mouth a USER may author — one space, and it is Dorico's number, not ours**
   * (his call, 2026-08-17: *"i think the user should be able to go down that 1.5, lets try 1 for our
   * properties"*).
   *
   * The automatic rule never goes below {@link HAIRPIN.APERTURE}; this says how much further a human
   * may close a wedge by hand. The value has a source, which is why it is 1 and not the 0.25 a first
   * cut invented and he rejected on sight: Dorico's *"Minimum hairpin aperture"* defaults to **1
   * space** — the same number, for the same job, quoted verbatim in
   * {@link HAIRPIN.GROWTH_PER_SPACE}'s note on how our ramp turned out to be Dorico's structure.
   *
   * ⚠️ At one space the arms are inside their own stroke for `thickness ÷ aperture` = 16% of the
   * wedge, against 10.7% at the automatic 1.5 — visibly tighter, still a hairpin. Below it that
   * fraction climbs fast (64% at 0.25), which is what "does not look like an hairpin" was.
   *
   * ⛔ Not a floor on the DRAWN aperture, and nothing clamps UP to it: the steepness cap can and does
   * take a short wedge below this, because there the angle limit is the mouth.
   */
  AUTHORED_MIN_APERTURE: 1.0,
  /**
   * ⭐⭐ **THE SHALLOWEST a wedge may open — the mirror of {@link HAIRPIN.MAX_ANGLE_DEGREES}, and
   * the one number in this file that NO ENGINE HAS. Ours, and his call (2026-08-15).**
   *
   * ## The problem it exists for
   *
   * Two arms opening by `aperture` over `length` are closer together than their own stroke for the
   * first `thickness ÷ aperture` **of the wedge** — and that is a FRACTION, with the length divided
   * out of it. At 0.16 and 1.5 it is 10.7% of every hairpin ever drawn. On a one-bar wedge that is
   * one staff space and invisible; on his nine-bar crescendo it was 9.1 spaces of two strokes laid
   * on top of each other, which reads as a solid black bar under the staff rather than as a wedge.
   * Same shape, scaled up — the wedge is scale-invariant, so its defect scales with it.
   *
   * ⭐ **Which is why the fix has to break that scale-invariance, and only two things can.** Raise
   * the aperture on long wedges (this), or bend the arms so they leave the tip faster. The second
   * kills the black outright — a straight arm is 10% open a tenth of the way along, a `√` arm is
   * 32% open there — but it stops being a hairpin: all four engines and every printed edition draw
   * two STRAIGHT lines. ⛔ Rejected as a default on those grounds, and noted as a possible authored
   * *shape* for contemporary/graphic scores later, alongside the aperture and slant in
   * {@link HairpinShapeOverrideLike}. His words: *"the user should be able to draw classic hairpin
   * and this is priority now."*
   *
   * ## ⭐⭐ WHY THIS IS A RAMP AND NOT AN ANGLE — the one structural thing his tuning proved
   *
   * It was an angle first, mirroring the cap: `aperture = 2·length·tan(θmin/2)`, clamped. That is a
   * straight line **through the origin**, which means it has exactly ONE degree of freedom — and
   * *where the growth starts* and *how fast it grows* are then the same number. Halve the angle and
   * growth begins twice as late AND climbs half as fast; there is no way to ask for one without the
   * other.
   *
   * ⛔ **And his verdicts require exactly that.** A 45-space wedge *"can be a little more wider"*
   * while a 65-space one at 2.29 was *"definitely too wide"* — growth must begin early and climb
   * slowly. Through the origin, beginning at 36 spaces forces a slope of 1.5/36, which reaches the
   * ceiling by 55 spaces and makes the 65-space wedge the very thing he rejected. Two constraints,
   * one parameter: unsatisfiable, and no amount of re-picking degrees fixes it.
   *
   * ## The rule
   *
   * So the growth is an affine ramp with its own start and its own slope, clamped at both ends:
   *
   * ```
   * aperture = min(MAX_APERTURE, APERTURE + GROWTH_PER_SPACE · max(0, length − GROWTH_FROM_SPACES))
   * ```
   *
   * Four straight pieces in all, once the steepness cap is counted: a ramp through the origin for
   * very short wedges (the cap), flat {@link HAIRPIN.APERTURE} through the ordinary range, this
   * ramp, then flat {@link HAIRPIN.MAX_APERTURE}. Every piece has its own reason and its own
   * constant, which is the property the angle form lacked.
   *
   * ⚠️ **What it gives up.** A constant angle made the black a CONSTANT — `thickness ÷ 2·tan(θ/2)`,
   * with no length in it. A ramp does not: the black shrinks through the growth band and then grows
   * again above it. That guarantee was the original argument for the whole rule, and it was traded
   * away for a shape his eye actually accepts. Recorded because it is a real loss, not an oversight.
   *
   * ⚠️ **`length` is STAFF SPACES OF DRAWN INK, never bars or beats** — his correction, and the
   * reason the parameter was always called `lengthSpaces`. Four bars of whole notes and four bars of
   * sixteenths are wedges of very different lengths, because the sixteenths earn far more room from
   * the spacing model; a bar count would call them the same and be wrong about both. Measured in the
   * staff's OWN spaces, so a small staff is judged in its own units, and for a wedge split across a
   * system break it is the sum of the fragments actually drawn.
   *
   * ⚠️ **It applies to the automatic aperture only, never to an authored one.** A hand-set mouth is
   * a human fixing this very thing by eye, and a rule that overrode it would be arguing with the
   * person it exists to serve. (The steepness cap DOES still apply to an authored aperture — that
   * one prevents an arrowhead, which is a different job.)
   *
   * ## ⭐⭐ FITTED TO HIS EYE, on seven hand-drawn cases (2026-08-15)
   *
   * He drew crescendos and reported on each; measured in the browser suite. The `→` column is what
   * the ramp gives now.
   *
   * | length | he saw | he said | → |
   * |---|---|---|---|
   * | 5.5 sp | 1.50, then 1.25 | *"too wide… a little less"*, then *"also here can be less wider"* | 1.11 (the CAP, not this) |
   * | 15.5 | 1.50 | ***"very good"*** | 1.50 |
   * | 35.5 | 1.50 | *"good"* | 1.50 |
   * | 45.5 | 1.50 | *"can be a little more wider"* | 1.61 |
   * | 65.5 | 2.29 | *"definitely too wide… this should be the end case"* | 1.85 |
   * | 85.5 | 2.50, then 2.24 | *"ok… if the aperture before is less wide we can try to go for it"* | 2.00 |
   *
   * ⭐ **The 45.5 and the 65.5 together are what killed the angle form** — one asking to grow, the
   * other to stay small, which no line through the origin can do. See above.
   *
   * ## ⭐⭐ THE STRUCTURE TURNS OUT TO BE DORICO'S, verbatim — found after it was built
   *
   * Daniel Spreadbury (Dorico's product manager), on the Steinberg forum: *"The aperture of a
   * hairpin is scaled between the value of 'Minimum hairpin aperture' (1 space by default) and
   * 'Maximum hairpin aperture' (1½ spaces by default) **for hairpins between 8 and 36 spaces in
   * length**."* That is this exact shape — two clamps and a linear ramp keyed to length in staff
   * spaces — arrived at independently, and it is ON BY DEFAULT in Dorico. Sibelius offers the same
   * idea as a two-step (*"Small aperture"*, *"Large aperture"*, *"Large aperture if wider than n
   * spaces"*), Finale likewise (*"Short span opening width"* / *"Maximum short span length"* /
   * *"Long span opening width"*). ⭐ So his memory of *"sibelius… jumping the mouth height from one
   * value to another in certain length"* was exactly right, and Avid's own manual says why: *"In
   * some published music… the aperture of the hairpin widens slightly the longer the hairpin is."*
   *
   * ⛔ **We do NOT take Dorico's numbers, and the reason is his eye.** Dorico's ramp is over 8→36
   * spaces, so at 15.5 spaces it would give ≈1.13 — and 1.5 at 15.5 is the one he called ***"very
   * good"***. Its ramp is finished by 36 spaces, which is where ours begins; the two are answering
   * different halves of the length range, and only ours reaches the system-long wedge that started
   * this. Worth knowing that engravers on both the Sibelius and Dorico forums call length-varying
   * apertures *"not standard practice"* and advise switching the feature off — the one Dorico thread
   * about it is a user asking how to disable it.
   */
  GROWTH_FROM_SPACES: 36,
  /**
   * ⭐ **How much wider the mouth gets per extra staff space of length** — the ramp's slope, and the
   * degree of freedom the angle form did not have.
   *
   * 0.012 spaces per space: a wedge ten spaces past the start opens 0.12 wider. Small on purpose —
   * his complaint about the first cut was that the widening arrived too fast, and at this slope the
   * mouth takes another 42 spaces past {@link HAIRPIN.GROWTH_FROM_SPACES} to reach the ceiling.
   *
   * ⚠️ A taste number with no source. `GROWTH_FROM_SPACES` says *when*, this says *how fast*, and
   * {@link HAIRPIN.MAX_APERTURE} — the only one of the three anybody else has written down — says
   * *how far*.
   */
  GROWTH_PER_SPACE: 0.012,
  /**
   * ⭐⭐ **The widest a mouth may open, in staff spaces — and the ONLY number in this rule that an
   * authority states. It is Gould's.**
   *
   * *Behind Bars* p.103, verbatim: **"Hairpins are the thickness of a stave-line. The open end
   * should not be more than two stave-spaces wide."** A ceiling, not a value — she gives no
   * preferred aperture and no floor, and on the next line says the mouth *"maintains the same width
   * regardless of dynamic"*. So 2.0 is not a taste number: it is the published limit, and the ramp
   * above is only allowed to exist in the room underneath it.
   *
   * ⚠️ It came down from 2.5, then 2.3, both of which were over Gould's limit and neither of which
   * knew it — the constant was invented before the book was read. His eye had already been walking
   * it down (*"definitely too wide"* at 2.29, *"if the aperture before is less wide we can try to go
   * for it"* at 2.50), which is the pleasant part: taste and the treatise arrived at the same place
   * from opposite directions.
   *
   * ⭐ **What the other engines put here.** Dorico's *"Maximum hairpin aperture"* is 1½ spaces, and
   * that is where its own length-ramp ends (see {@link HAIRPIN.GROWTH_FROM_SPACES}); working
   * engravers quote fixed house values of 0.8 (Durand/Salabert), 1.2 (Boosey & Hawkes), 1.3 (Music
   * Sales), 1.33 (LilyPond's default, and the most-cited preference). So 2.0 is a genuine ceiling
   * that only the longest wedges ever touch, not a normal opening — which is exactly Gould's word.
   *
   * ⚠️ Past the length where this binds (≈78 spaces) the black at the closed end starts growing
   * with length again, because the aperture has stopped. Deliberate: a bounded mouth costs an
   * unbounded wedge its guarantee, and 2.0 spaces is already half the staff's height.
   */
  MAX_APERTURE: 2.0,
  /**
   * ⭐⭐ **The steepest a wedge may open — as an ANGLE. The RULE is Verovio's, verified in its
   * source; the NUMBER is his, and is no longer Verovio's.**
   *
   * The total included angle between the two arms, in degrees. `Hairpin::CalcHeight`
   * (`verovio/src/hairpin.cpp`) computes `theta = 2·atan((endY/2)/length)`, and *"if the angle is
   * too big, restrict endY"* — `if (theta > 16) { theta = 16; endY = 2·length·tan(8°) }`. So the
   * aperture is a constant that a short wedge is allowed to reduce, never to exceed, and the rule
   * is stated about the ANGLE because that is what the eye actually reads.
   *
   * ⚠️ **11.5°, not Verovio's 16° — his eye, 2026-08-15, in two passes.** Shown a wedge of 5.5
   * staff spaces, which lands almost exactly on the old cap (15.5° of the 16 allowed), he said
   * *"too wide, its almost ok, but it can be a little less"*; shown the 1.25 that 13° gave it, he
   * said *"also here can be less wider"*. 11.5° puts that wedge at **1.11**, and moves the length
   * below which the cap bites at all from 5.3 spaces to 7.4.
   *
   * ⭐ It lands, independently, almost exactly on **Dorico's "Minimum hairpin aperture", which is
   * 1 space** — so his eye and Steinberg's default agree about how far a very short wedge should
   * open, by two different routes (an angle here, a flat floor there).
   *
   * ⛔ So do not "correct" this back to 16 on the grounds that Verovio says so — Verovio is where
   * the RULE and the closed form come from, and the degrees are a taste number like the aperture.
   *
   * ⭐ It is also the answer to Gould's *avoid steep gradients* (Behind Bars p.104) for an engine
   * that cannot lengthen. LilyPond states the same intent as a MINIMUM LENGTH (`minimum-length`
   * 2.0), and enforces it by handing the spacer a `Rod` that pushes the two columns apart — the
   * hairpin gets *longer* and its mouth is untouched. We cannot do that: our length is musical, not
   * cosmetic (§4), so the columns are not ours to move. Verovio's is the same rule for engines in
   * our position, and it is the one to copy rather than invent a gradient of our own.
   *
   * ⛔ It only ever NARROWS — and the question it does not answer, whether a LONG hairpin should
   * open WIDER, is {@link HAIRPIN.MIN_ANGLE_DEGREES}'s, which was added beside it on 2026-08-15.
   * The two never fight: a floor of 1.5° and a ceiling of 13° cannot cross at any length, and a
   * unit test asserts that rather than assuming it, because an edit that inverted them would draw a
   * mouth of nothing and say nothing.
   */
  MAX_ANGLE_DEGREES: 11.5,
  /** How far a wedge stops short of a dynamic it runs into, in staff spaces. LilyPond's
   *  `Hairpin.bound-padding`; Gould says "about a space". */
  BOUND_PADDING: 1.0,
  /**
   * ⭐⭐ **The air at EACH END of every wedge, in staff spaces — unconditional.**
   *
   * A hairpin always sits a little inside the span it covers, so it never quite touches what it
   * runs up against. Two wedges that abut then leave twice this between them, and that is the whole
   * of the rule his report asked for: *"here both should not touch… normally in music there is a
   * tiny space."*
   *
   * ⭐ **Unconditional is the POINT, and it was his call** (2026-08-12): *"maybe instead of an IF
   * statement it is better to hardcode the air… since we will give the user the faculty of
   * modifying, making logic will make things too complicated."* The version this replaced asked the
   * model whether another wedge began exactly where this one ended and inset only then — correct,
   * and a rule that would have had to be re-reasoned the moment an aperture, a slant or a hand-drag
   * arrived. A constant inset needs no such reasoning, and it is what LilyPond does: `bound-padding`
   * is applied at a hairpin's bounds always, not on a neighbour being present.
   *
   * ⚠️ Applied to the wedge's own ends only — never to a SYSTEM BREAK, where the fragments run to
   * the margins and there is nothing to stand off from.
   */
  END_INSET: 0.25,
  /**
   * ⭐⭐ **The air around a mark the wedge is BROKEN for, in staff spaces — ⛔ NOT
   * {@link HAIRPIN.BOUND_PADDING}** (his call, 2026-08-18: *"the white in this case is too much…
   * it will be good that the white is just a small padding near to the ink"*).
   *
   * ⭐ **The two paddings answer different questions, which is why one number could not serve both.**
   * At an END the wedge stops short of a mark that is not its own — two objects, and Gould's "about a
   * space" keeps them apart. INSIDE, the white is a window cut in something continuous: the reader
   * has to see one gesture interrupted, and a full space either side (two spaces of hole, for a
   * glyph barely wider than that) reads as two wedges that happen to be aligned — which is the very
   * thing p. 107's *same angle* rule exists to prevent.
   *
   * ⭐⭐ **MEASURED OFF HER OWN DRAWING** (2026-08-18, after he said *"the drawing in p107 of Gould
   * does not have that much white"* — he was right, and the first cut of this number was borrowed
   * from Verovio rather than read). Printed p. 107 rendered at 450 dpi, ink-run profile across the
   * correct (`and`) figure `pp ——— mf ——— ff`:
   *
   * | run | x | gap to next |
   * |---|---|---|
   * | `pp` | 739–809 | **20 px = 1.01 sp** |
   * | wedge A | 830–967 | **10 px = 0.50 sp** |
   * | `mf` | 978–1047 | **10 px = 0.50 sp** |
   * | wedge B | 1058–1196 | **15 px = 0.75 sp** |
   * | `ff` | 1212–1280 | |
   *
   * (Ruler checked on the figure itself rather than borrowed from a staved page: `pp` measures 39 px
   * tall against Gould p. 101's *"the **p** two spaces"* ⇒ 19.5 px/sp, and `ff` 53 px against
   * *"the ƒ is two and a half spaces"* ⇒ 21.2 px/sp — so ~20 px/sp, the book's constant.)
   *
   * ⭐ So: **half the gap she leaves at the wedge's ENDS** (0.75–1.0 sp there, and `BOUND_PADDING` is
   * 1.0), and her interim gaps are EVEN — 10 px on both sides. It is also, exactly, MuseScore's
   * `autoplaceHairpinDynamicsDistance`. ⛔ Do not "unify" it with `BOUND_PADDING` on the grounds that
   * both are hairpin-to-dynamic gaps: see above for why the two questions differ.
   */
  BREAK_PADDING: 0.5,
  /**
   * ⭐ **The shortest piece of wedge worth drawing, in staff spaces** — anything narrower is DROPPED
   * when a mark cuts the wedge (`hairpinBreaks.breakWedgeAtGaps`).
   *
   * The threshold is **Verovio's** (`view_control.cpp:688`, `unit * 2` = 1 sp, read 2026-08-18);
   * ⛔ its FALLBACK is not. Verovio abandons the whole shortening when the result would be shorter
   * than this, and the measured consequence is a wedge drawn straight through the adjacent
   * dynamic's ink — reproducible in the ordinary `p < mf > p` figure. A sliver of wedge says
   * nothing, but a wedge through a glyph says something false, so the remnant goes.
   */
  MIN_FRAGMENT: 1.0,
} as const

/**
 * A hand-authored shape, if one is ever stored. **Structural on purpose** — there is no
 * `HairpinShapeOverride` on the model yet, and inventing one before anything writes it would put a
 * field in the compartment that only this file believes in. The day a drag writes one, it satisfies
 * this shape and nothing here changes.
 *
 * All fields in staff spaces; `startY`/`endY` are signed deltas off the line, + = down.
 */
export interface HairpinShapeOverrideLike {
  aperture?: number
  startY?: number
  endY?: number
}

/** The resolved geometry, in staff spaces: how far the mouth opens, and each end's offset from the
 *  dynamics line (0/0 = horizontal, which is every engine's default). */
export interface HairpinShape {
  aperture: number
  startY: number
  endY: number
}

/**
 * ⭐ **The wedge's mouth, before any override and before the steepness cap — the automatic
 * aperture for a wedge of this drawn length.**
 *
 * Three regimes: the flat {@link HAIRPIN.APERTURE} up to {@link HAIRPIN.GROWTH_FROM_SPACES}, then
 * a ramp at {@link HAIRPIN.GROWTH_PER_SPACE}, then flat again at {@link HAIRPIN.MAX_APERTURE} from
 * ≈78 spaces on. Only the first boundary is a constant; the second is a consequence of the three,
 * and is deliberately not written down anywhere as a length.
 *
 * ⛔ The STEEPNESS cap is not here — it belongs to {@link resolveHairpinShape}, because it applies
 * to an authored aperture too and this does not.
 */
function automaticAperture(lengthSpaces: number): number {
  const past = Math.max(0, lengthSpaces - HAIRPIN.GROWTH_FROM_SPACES)
  return Math.min(HAIRPIN.MAX_APERTURE, HAIRPIN.APERTURE + HAIRPIN.GROWTH_PER_SPACE * past)
}

/**
 * The wedge's shape: the override where one exists, else the length-aware default, with the
 * steepness cap applied to whichever aperture came out.
 *
 * ⭐⭐ **`lengthSpaces` drives the mouth BOTH ways as of 2026-08-15 — and only the downward half of
 * that is standard.** Four engines were read at source on the question *"does a longer hairpin get
 * a wider mouth?"*, and the answer was no from all four; {@link HAIRPIN.MIN_ANGLE_DEGREES} carries
 * why we now say yes anyway, and what it is worth. The readings:
 *
 * | engine | aperture from length? |
 * |---|---|
 * | LilyPond | **No.** `Hairpin::print` computes `width` and the two arm heights independently; length appears only as the endpoints' x. A 2-space and a 40-space wedge have the same mouth. |
 * | Verovio | **Downward only** — the 16° cap above. Above ≈5.3 spaces it is the flat constant. |
 * | GUIDO | **No.** `GRDynamics::DrawDynamic` has no `atan`, no ratio, no cap. |
 * | Dorico / Sibelius / Finale | no documented formula; Finale states one global *"Crescendo Opening Width"*, Sibelius an aperture setting plus a per-hairpin property, Dorico a minimum AND maximum aperture. |
 *
 * ⭐ It is clearly a deliberate omission in LilyPond rather than an oversight: that engine DOES
 * implement length-dependent geometry where it wants it, and documents it — `Slur.height-limit`,
 * *"Maximum slur height: the longer the slur, the closer it is to this height"*, consumed in
 * `slur-scoring.cc`. Slurs asymptote toward a height with length; hairpins were not given the same
 * treatment.
 *
 * ⭐ So "longer opens wider" was not standard, and the file said so for three months before the
 * shape it describes actually came up on a page. A slur-style asymptote
 * (`aperture → APERTURE · length/(length + k)`) is the form LilyPond would have reached for and is
 * still one line from here; the min-angle was chosen over it because it leaves short and ordinary
 * wedges bit-for-bit unchanged, and an asymptote touches every one of them.
 *
 * ⚠️ The two length rules are asymmetric on purpose. The steepness CAP applies to a hand-set
 * aperture as well — a user cannot author an arrowhead by accident, nor on purpose, which is what
 * Verovio does too. The min-angle FLOOR does not: an authored mouth is a human fixing this very
 * problem by eye, and overriding it would be arguing with the person the rule exists to serve.
 */
export function resolveHairpinShape(
  override: HairpinShapeOverrideLike | undefined,
  lengthSpaces: number,
): HairpinShape {
  const asked = override?.aperture ?? automaticAperture(lengthSpaces)
  // Verovio's closed form: half the included angle per arm, so the ceiling is `2·L·tan(θ/2)`.
  const ceiling = 2 * Math.max(0, lengthSpaces) * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2))
  return {
    aperture: Math.min(asked, ceiling),
    startY: override?.startY ?? 0,
    endY: override?.endY ?? 0,
  }
}

/**
 * ⭐⭐ **The range a user may AUTHOR a mouth in, for a wedge of this drawn length** — the bounds the
 * Properties input offers (his ask, 2026-08-17: *"we have a max mouth and a min mouth value, so this
 * should be the boundaries also in properties"*).
 *
 * ## ⭐⭐ It is THIS FILE'S OWN RANGE, and nothing new
 *
 * A first cut invented a floor of 0.25 spaces and he rejected it on sight — *"0.25 for min mouth
 * aperture? this is not right, it does not look like an hairpin… it should be in our hairpin
 * formula"*. He was right, and the reason is written a few lines up: the two arms are inside their own
 * stroke for `thickness ÷ aperture` **of the wedge**, so a mouth of 0.25 at 0.16 thickness is solid
 * ink for 64% of its length. It is not a narrow hairpin, it is a bar with a corner.
 *
 * The bounds come from this file's own constants, each with its own reason: the ceiling is
 * {@link HAIRPIN.MAX_APERTURE} — the end of the growth ramp, and the widest he accepted at 85 spaces —
 * and the floor is {@link HAIRPIN.AUTHORED_MIN_APERTURE}, one space, which is Dorico's *"Minimum
 * hairpin aperture"* default and sits a little under the {@link HAIRPIN.APERTURE} the automatic rule
 * never goes below. So **an authored mouth spans the whole range the engraver's own rules move in,
 * plus the half-space of extra tightness a human may ask for and the machine may not.**
 *
 * ⚠️ **Both are then pulled down by the STEEPNESS CAP**, which is the length-dependent part and the
 * reason this is a function rather than a pair of constants: a 5.5-space wedge is capped at 1.11, and
 * on it the range collapses to that single value. That is honest rather than awkward — at that length
 * the angle limit IS the mouth, and offering a wider number would let one be typed that
 * {@link resolveHairpinShape} silently pulls back.
 *
 * Pure, so the panel's bounds and the renderer's clamp cannot drift.
 */
export function authoredApertureRange(lengthSpaces: number): { min: number; max: number } {
  const ceiling = 2 * Math.max(0, lengthSpaces) * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2))
  return {
    min: Math.min(HAIRPIN.AUTHORED_MIN_APERTURE, ceiling),
    max: Math.min(HAIRPIN.MAX_APERTURE, ceiling),
  }
}

/** Which piece of a split wedge this is: the whole thing, or one fragment of a broken span. */
export type WedgeRole = 'single' | 'begin' | 'middle' | 'end'

/**
 * ⭐⭐ **How open the mouth is at each end of one FRAGMENT, as a fraction of the full aperture — and
 * a split wedge deliberately STEPS at the break rather than flowing through it.**
 *
 * This was the plan's one factual error about hairpins, and it took reading three engines to see
 * it. §2.4 recorded *"the continuation resumes at the width it left off"*; not one engine does
 * that. LilyPond `hairpin.cc` and Verovio `view_control.cpp` agree on the same hard-coded thirds —
 * a crescendo's first fragment runs **0 → ⅔**, its continuation **⅓ → 1**, a middle fragment
 * **⅓ → ⅔** — and GUIDO does the same shape with different constants (0 → 0.588, then 0.25 → 1).
 * In all three the continuation starts NARROWER than the first fragment ended, and the fractions
 * ignore where the break actually fell.
 *
 * ⭐ Which makes sense once you see what it is for: each fragment has to read as a wedge in its own
 * right. A continuation resuming at exactly the width it left off would begin as a near-parallel
 * pair of lines and open barely at all — correct as arithmetic, unreadable as notation. (Gould's
 * *"keep the same angle either side"* is about a hairpin broken for an interim DYNAMIC, which is a
 * different case and not this one.)
 */
export function fragmentOpening(role: WedgeRole, type: 'cresc' | 'dim'): { start: number; end: number } {
  const growing = role === 'single' ? { start: 0, end: 1 }
    : role === 'begin' ? { start: 0, end: 2 / 3 }
      : role === 'end' ? { start: 1 / 3, end: 1 }
        : { start: 1 / 3, end: 2 / 3 }
  // A diminuendo is the mirror — the same fractions read right to left.
  return type === 'cresc' ? growing : { start: 1 - growing.start, end: 1 - growing.end }
}
