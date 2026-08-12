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
   * MEI units, and a MEI unit is half a staff space → **1.5** (`src/options.cpp`). GUIDO `deltaY`
   * 3 half-spaces → **1.5** (`TagParameterStrings.cpp`). So two of the three say 1.5 and LilyPond
   * says 1.33; this is LilyPond's, and moving it is a one-line change here.
   */
  APERTURE: 1.33,
  /**
   * ⭐⭐ **The steepest a wedge may open — as an ANGLE, and it is Verovio's, verified in its source.**
   *
   * The total included angle between the two arms, in degrees. `Hairpin::CalcHeight`
   * (`verovio/src/hairpin.cpp`) computes `theta = 2·atan((endY/2)/length)`, and *"if the angle is
   * too big, restrict endY"* — `if (theta > 16) { theta = 16; endY = 2·length·tan(8°) }`. So the
   * aperture is a constant that a short wedge is allowed to reduce, never to exceed, and the rule
   * is stated about the ANGLE because that is what the eye actually reads.
   *
   * ⭐ It is also the answer to Gould's *avoid steep gradients* (Behind Bars p.104) for an engine
   * that cannot lengthen. LilyPond states the same intent as a MINIMUM LENGTH (`minimum-length`
   * 2.0), and enforces it by handing the spacer a `Rod` that pushes the two columns apart — the
   * hairpin gets *longer* and its mouth is untouched. We cannot do that: our length is musical, not
   * cosmetic (§4), so the columns are not ours to move. Verovio's is the same rule for engines in
   * our position, and it is the one to copy rather than invent a gradient of our own.
   *
   * ⛔ It only ever NARROWS. Whether a LONG hairpin should open WIDER than
   * {@link HAIRPIN.APERTURE} is a separate question — see {@link resolveHairpinShape}.
   */
  MAX_ANGLE_DEGREES: 16,
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
 * The wedge's shape: the override where one exists, else the defaults, with the angle cap applied
 * to whichever aperture came out.
 *
 * ⭐⭐ **`lengthSpaces` is a real input — but ONLY downward, and that is a finding rather than a
 * choice.** Four engines were read at source for this, on the question *"does a longer hairpin get
 * a wider mouth?"*:
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
 * So "longer opens wider" is not standard. If we want it anyway — and a slur-style asymptote
 * (`aperture → APERTURE · length/(length + k)`) is the shape LilyPond would reach for — it is one
 * line here and nothing else moves. That is the whole reason this file exists.
 *
 * ⚠️ The cap applies to a hand-set aperture too, which means a user cannot author an arrowhead by
 * accident and also cannot author one on purpose. Verovio does the same; worth revisiting if a
 * hand-set aperture ever arrives.
 */
export function resolveHairpinShape(
  override: HairpinShapeOverrideLike | undefined,
  lengthSpaces: number,
): HairpinShape {
  const asked = override?.aperture ?? HAIRPIN.APERTURE
  // Verovio's closed form: half the included angle per arm, so the ceiling is `2·L·tan(θ/2)`.
  const ceiling = 2 * Math.max(0, lengthSpaces) * Math.tan((Math.PI / 180) * (HAIRPIN.MAX_ANGLE_DEGREES / 2))
  return {
    aperture: Math.min(asked, ceiling),
    startY: override?.startY ?? 0,
    endY: override?.endY ?? 0,
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
