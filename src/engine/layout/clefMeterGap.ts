/**
 * ⭐⭐ **THE GAP BETWEEN A CLEF AND A TIME SIGNATURE, WITH NO KEY SIGNATURE BETWEEN THEM — a TABLE
 * OF RULES, and which row is armed is HIS.** `docs/research/header-spacing-research.md` §4.4, §4.5, §5.6.
 *
 * ## 🚨 Why this module exists: it was the one gap in the header run NOBODY EVER CHOSE
 *
 * His eye found it, 2026-09-12:
 *
 * > *"i see the placement of the meter after the clef seems to be because of the bbox, not the ink…
 * > what information do we have to know the x where to place it? i think we should have a kind of
 * > variable, so in the future the user can apply their house style, but we must start with a
 * > preset"*
 *
 * ⭐ **Right that it was not ink-driven; ⛔ wrong that the bbox was the cause, and the real answer is
 * worse.** A clef has NO right side bearing — Bravura's `gClef` ink `right` **2.684** IS its
 * `advance` — so box and ink agree to **0.02 sp**. What actually set the distance was VexFlow's
 * `TimeSignature` `customPadding`, **default 15 px**, because `StaveModifier.getPadding(i)` is 0 for
 * `i < 2` and with no key signature the meter is index 2. ⇒ **1.42 sp of drawn white, identical for
 * all four clefs** — ⭐ and that identity across four different glyphs is itself the proof that
 * nobody derived it.
 *
 * 🚨 **Meanwhile the WIDTH MODEL reserved something else**: `BETWEEN_PARTS` (1.0, box to box) plus
 * the 0.6 of left air inside `meterExtent` ⇒ ≈**1.6 sp** of ink gap charged against 1.42 drawn.
 * ⭐ Two numbers for one distance, neither chosen — the pair `own-engraving-engine.md` §P5 is named
 * after, in the last gap of the run still expressed box to box. **This module closes it: the same
 * number feeds the reservation and the drawing, so they agree by construction.**
 *
 * ## ⭐⭐ The UNIT is settled; only the VALUE is open
 *
 * ⛔ **Ink to ink** — the clef's rightmost ink to the time signature's leftmost ink — and that is not
 * a preference:
 *
 * - **3 of 3 engines** measure it that way (§5.6): LilyPond from FreeType stencil extents (⛔ never
 *   `horiAdvance`), MuseScore from `Shape` rects taken from the glyph's `bbox` field (⛔ explicitly
 *   not its sibling `advance`), Verovio from self-bounding-boxes. ⭐ The only advance-based engine in
 *   the comparison is **VexFlow — the dependency we are removing.**
 * - **3 of 4 books** state white gaps (§4.5). Ross measures left INK edge to left INK edge and says
 *   so glyph by glyph (*"A sharp is measured from the vertical line on its left side"*).
 *
 * ⭐⭐ **And their PLATES agree far better than their prose**: 0.98 (Ross) · 1.00 · 1.10 · 1.10
 * (Gould) · 1.14 (Stone) — **median 1.10**, across three conventions and three different stated
 * numbers.
 *
 * ⚠️ ⛔ **Never express this one origin-to-origin.** Ross's 3½ minus *our* clef's ~2.9 sp of ink is
 * 0.6 of white against 0.98 on his own narrower clef: the conversion is a function of **the clef's
 * font**, ⛔ not of the rule.
 *
 * ## 🚨 It is a WIDTH, so it is in the LAYOUT key
 *
 * Changing it makes a header NARROWER or WIDER, so the casting-off depends on it.
 * {@link clefMeterGapGeneration} goes in **both** `laneFingerprint` and `layoutStateKey`, exactly as
 * `headerGapGeneration` and `spacingGeneration` do — leave it out of either and arming a row hands
 * back memoised widths while the console reports success
 * (`reference_render_width_key_vs_shape_key`).
 */

/** One rule: the clear white between a clef's ink and a time signature's, in staff spaces. */
export interface ClefMeterRule {
  /** ⭐ INK to INK — the clef's rightmost ink to the meter's leftmost. ⛔ Never origin to origin. */
  ink: number
  /** Where the number comes from — printed by `__header.dumpClefMeter()`. */
  source: string
}

/**
 * ⭐ The rules, each sourced. ⛔ **A row here is a SOURCE, never an invention.**
 */
export const CLEF_METER_RULES = {
  /**
   * ✅ **ARMED — his call, 2026-09-12: *"i think we cn start with a value of 1.0 as default but the
   * user in the future will be able to change it if it wants"*.**
   *
   * ⭐ **The most defensible round number in the library, and it arrives from three directions at
   * once**: **Stone p. 44** is the only book that names this pair and gives it a number in gap units
   * (*"between the clef and any subsequent symbol (key signature or time signature): **one
   * staff-space or a little less**"*); **MuseScore**'s `clefTimesigDistance` is `1.0_sp`
   * (`styledef.cpp:222`); **Verovio**'s margins sum to 1.0 staff space
   * (`options.cpp:1783`, `:1729` — ⚠️ stated as 1.0 + 1.0 in **MEI units**, which are ½ sp each).
   *
   * ⚠️ **A DEFAULT, ⛔ not a law** — `project_engraving_defaults_are_a_house_style`.
   */
  stone: { ink: 1.0, source: 'Stone p. 44 · MuseScore clefTimesigDistance · Verovio' },
  /**
   * ⭐ **What the PLATES measure** — the median of every engraving in the library that draws the
   * pair: Ross p. 145 **0.98**, Gould p. 42 **1.00 / 1.10 / 1.10**, Stone p. 45 **1.14**
   * (§4.5, measured at 400–450 dpi against each plate's own staff-space height).
   *
   * ⭐ The row to reach for if the drawn evidence should beat the printed sentence — which is this
   * repo's own oldest finding (`reference_a_taste_call_may_be_measurable`).
   */
  books: { ink: 1.05, source: "the median of every plate in the library (§4.5)" },
  /**
   * ⭐⭐ **ROSS'S OWN COMPASS SETTING, and the finding behind it is the best argument in the table.**
   * He is the ONLY book that gives this pair its own number — 3½ spaces, p. 145 — and it turns out
   * not to be about the meter at all: he uses **the same setting** for clef→first sharp and
   * clef→first flat (p. 144). ⇒ **in the one system that states a number, a time signature is spaced
   * exactly like the first accidental.**
   *
   * ⭐ Which in our units is `keySignatureLayout.CLEF_TO_KEY_INK` — **0.82**, also LilyPond's
   * `Clef.space-alist (key-signature . 0.82)`, and ⭐ **the number HIS EYE has already accepted**
   * (he rejected 1.5 there in 2026-08). The tightest row.
   *
   * ⚠️ Deliberately a LITERAL and not an import of that constant: they are one rule in Ross's system
   * and two decisions in ours, and tying them would silently move this the day that one moves.
   */
  rossCompass: { ink: 0.82, source: "Ross's 3½ compass setting = our CLEF_TO_KEY_INK" },
  /**
   * **LilyPond's** `Clef.space-alist (time-signature . 1.52)` (`scm/define-grobs.scm:921`) — the only
   * engine that makes the meter's gap much wider than the key's (1.85×).
   *
   * ⚠️ **Keep it: it is the "NO VISIBLE CHANGE" row.** It is within ~0.1 sp of the 1.42 we drew
   * before this module existed, so it is the citation for preferring the picture we already had.
   */
  lilypond: { ink: 1.52, source: 'LilyPond Clef.space-alist (time-signature . 1.52)' },
} as const satisfies Record<string, ClefMeterRule>

export type ClefMeterRuleName = keyof typeof CLEF_METER_RULES

/** ✅ **HIS CHOICE, 2026-09-12** — see {@link CLEF_METER_RULES.stone}. */
export const ACTIVE_CLEF_METER_RULE: ClefMeterRuleName = 'stone'

const state: { rule: ClefMeterRuleName; generation: number } = {
  rule: ACTIVE_CLEF_METER_RULE, generation: 0,
}

/**
 * ⭐ **The armed clear white, in staff spaces, INK TO INK** — the one number both the reservation
 * (`layout/headerInk`) and the drawing (`rendering/EngravedStave.addTimeSignature`) read.
 */
export function armedClefMeterInk(): number {
  return CLEF_METER_RULES[state.rule].ink
}

/** What is armed, for the console's read-back and for a spec. */
export function clefMeterSettings(): { rule: ClefMeterRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint — see the module header. */
export function clefMeterGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored: a console typo that looked like it
 *  worked would be the worst possible instrument. */
export function setClefMeterRule(rule: ClefMeterRuleName): boolean {
  if (!(rule in CLEF_METER_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetClefMeterRule(): void {
  state.rule = ACTIVE_CLEF_METER_RULE
  state.generation++
}
