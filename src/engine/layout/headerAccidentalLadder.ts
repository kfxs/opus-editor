/**
 * ⭐⭐ **HOW MUCH THE HEADER→FIRST-NOTE GAP CLOSES WHEN THAT NOTE CARRIES AN ACCIDENTAL — a TABLE
 * OF RULES, and which row is armed is HIS.** Decision **E** (`docs/research/header-spacing-research.md` §8 E).
 *
 * ## Why this is a table and not a constant
 *
 * He asked for Gould (*"lets do what gould say"*, 2026-09-02), her printed table went in — and
 * within minutes his eye reported the half of it that does not look right:
 *
 * > *"i have the feeling that with the accidental is a little too close"* … *"i the case of the clef
 * > is not problem but when there is a time signature, is a little too close to the time signature"*
 *
 * ⭐ **That is a precise report, and the books do not settle it**: Gould's printed label for that
 * cell is **1**, her own drawing of the same cell measures **1.15**, and MuseScore refuses to go
 * below **1.5** of clear white in any header. ⇒ the same shape as `engrave/beams/beamSlope` and
 * `layout/spacing`'s law: the alternatives are ROWS, the armed one is a setting, and the instrument
 * that decides is his eye on his own music (`dev/headerGapConsole` — `__header.rule(…)`).
 *
 * ⛔ **A row here is a SOURCE, never an invention.** Every one cites where its numbers come from.
 *
 * ## ⚠️ What a row IS
 *
 * Three gaps per header ending, indexed by how many accidentals stand in front of the first note —
 * `[none, one, more]`, in staff spaces, measured **ink to ink** (the header's last ink to the first
 * ink of the note group, which IS the accidental when there is one).
 *
 * 🚨 **The `none` column is NOT open.** It is decision **D**, his, taken 2026-09-01 — 2½ after a clef
 * or key signature, 2 after a meter — and every row here reproduces it. ⛔ A row that changed it
 * would be re-opening a settled decision through the side door.
 *
 * ## 🚨 It is a WIDTH, so it is in the LAYOUT key
 *
 * Closing this gap makes a bar NARROWER, so unlike a beam's slope it is not merely a picture: the
 * casting-off depends on it. {@link headerGapGeneration} therefore goes in **both**
 * `laneFingerprint` and `layoutStateKey`, exactly as `spacingGeneration` does — leave it out of
 * either and arming a row hands back memoised widths while the console says it worked
 * (`reference_render_width_key_vs_shape_key`).
 */

/** `[no accidental, one accidental, more]`, in staff spaces, ink to ink. */
export type AccidentalGaps = readonly [number, number, number]

/** One rule: what the gap is after each of the two header endings. */
export interface HeaderGapRule {
  /** After a clef or a key signature. */
  sign: AccidentalGaps
  /** After a time signature. */
  meter: AccidentalGaps
  /** Where the numbers come from — printed in `__header.dump()`. */
  source: string
}

/**
 * ⭐ The rules, each sourced.
 *
 * ⚠️⚠️ **`gould` and `gouldDrawn` are NOT the same row, and they look it at a glance because their
 * FIRST number is identical** — that column is decision D and every row reproduces it. They differ
 * **only in the accidental columns**, and that difference is this
 * repo's oldest recurring finding: *a book's engraving can be measured, and it may disagree with the
 * book's own number* (`reference_a_taste_call_may_be_measurable`; it is how Gould's p. 111 slurs were
 * settled). Her nine cells on p. 42, measured off the scan at 450 dpi with a 20.0 px staff space,
 * come out **0.10–0.15 sp above every printed label**.
 */
export const HEADER_GAP_RULES = {
  /**
   * **Gould's printed table**, p. 42 — *Recommended distances before first note*. Her stated floor is
   * the reason both rows bottom out at 1: *"an accidental should never be closer to a preceding
   * symbol than one stave-space"*.
   */
  gould: {
    sign: [2.5, 1.5, 1.0],
    meter: [2.0, 1.0, 1.0],
    source: "Gould p. 42, her printed table",
  },
  /**
   * ⭐ **The same figure, MEASURED** — clef row 2.65 / 1.65 / 1.15, key row 2.49 / 1.45 / 1.10,
   * meter row 2.15 / 1.15 / 1.10 (`docs/research/header-spacing-research.md` §3.7). ⚠️ The `none` column is
   * held at decision D's 2.5 / 2.0 rather than at her drawn 2.65 / 2.15: that column is closed.
   */
  gouldDrawn: {
    sign: [2.5, 1.65, 1.15],
    meter: [2.0, 1.15, 1.10],
    source: "Gould p. 42, her own plate measured",
  },
  /**
   * **MuseScore's floor.** It never lets the clear white in a header fall below
   * `absoluteMinHeaderDist = 1.5 × spatium` (`rendering/score/horizontalspacing.cpp:1358, 1371–1374`),
   * whatever the accidentals do. ⚠️ Like {@link HEADER_GAP_RULES.lilypond}, these are its rule
   * EVALUATED at our accidental widths: it targets 2.5 / 2.0 to the notehead and the floor is what
   * bites at one accidental (2.5 − 1.40 = 1.10, below 1.5) and at more. ⭐ The loosest sourced answer, and the one his report points at: it
   * gives a meter followed by an accidental the same 1.5 he is happy with after a clef.
   */
  musescore: {
    sign: [2.5, 1.5, 1.5],
    meter: [2.0, 1.5, 1.5],
    source: "MuseScore absoluteMinHeaderDist 1.5",
  },
  /**
   * ⭐ **LilyPond's** — and it is a genuinely different MECHANISM, evaluated here at our own
   * accidental widths. Its `first-note` distances are measured to the note column's REFERENCE POINT
   * (the notehead), and the accidental is inside that column's obstacle skyline
   * (`AccidentalPlacement` has `direction = LEFT`), so the gap closes by the accidental's own ink
   * rather than by a table. Its only floor is *"ensure that the fixed distance will leave a gap of at
   * least 0.3 ss"* (`lily/staff-spacing.cc:211–213`).
   *
   * ⚠️ **So these three numbers are its rule EVALUATED, ⛔ not constants it ships**: target 2.5 / 2.0
   * to the head, less our measured accidental reach (one 1.40 sp, two 2.70 —
   * `layout/spacingPadding.ACCIDENTAL_WIDTH` plus `INK.accidentalToHead`), floored at 0.30.
   * ⇒ 2.5 − 1.40 = **1.10**, and two accidentals land on the floor.
   *
   * 🚨 **It is the TIGHT end, ⛔ not the loose one** — it goes BELOW Gould's stated floor of one
   * stave-space, which is a real disagreement between the two and the reason this row is worth
   * having on screen beside hers.
   */
  lilypond: {
    sign: [2.5, 1.10, 0.30],
    meter: [2.0, 0.60, 0.30],
    source: "LilyPond staff-spacing.cc, at our accidental widths",
  },
  /**
   * ⛔ **What we drew before 2026-09-02** — no rule at all: the gap is paid whatever stands in front
   * of the note, so an opening with an accidental comes out WIDER than one without. ⭐ Not a straw
   * man: it is Verovio's behaviour (an accidental gets `leftMarginAccid`, the same margin a note
   * gets) and VexFlow's (`Stave.padding` on every note regardless).
   */
  none: {
    sign: [2.5, 2.5, 2.5],
    meter: [2.0, 2.0, 2.0],
    source: "Verovio / VexFlow — no accidental rule",
  },
} as const satisfies Record<string, HeaderGapRule>

export type HeaderGapRuleName = keyof typeof HEADER_GAP_RULES

/**
 * ✅ **WHAT IS ARMED — `musescore`, HIS CHOICE, 2026-09-02: *"lets make musescore default"*.**
 *
 * ⭐ **His eye, on his own music, against four sourced rows** — which is the only instrument this
 * question has. The sequence is worth keeping because it is the argument for the table existing at
 * all: he asked for Gould (*"lets do what gould say"*), her printed ladder went in, and he reported
 * within minutes that one cell of it was wrong to look at — *"i the case of the clef is not problem
 * but when there is a time signature, is a little too close to the time signature"*. Her drawn
 * numbers loosened that cell by 0.15 sp and he could not see the difference. MuseScore's floor
 * loosens it to **1.5**, the same clear space he had already said was fine after a clef, and that is
 * the one he picked.
 *
 * ⭐ **It is also the most defensible row on the page**, which is worth saying out loud: 1.5 is not a
 * number someone here chose, it is `absoluteMinHeaderDist`, and it is the only value in the four rows
 * that a shipping engraver enforces unconditionally.
 *
 * ⚠️ **A DEFAULT, ⛔ not a law** — his standing directive for every number in this family
 * (`project_engraving_defaults_are_a_house_style`). The other rows stay: they are what a different
 * house style would draw, and `__header.rule(…)` is how the next eye compares them.
 */
export const ACTIVE_HEADER_GAP_RULE: HeaderGapRuleName = 'musescore'

const state: { rule: HeaderGapRuleName; generation: number } = {
  rule: ACTIVE_HEADER_GAP_RULE, generation: 0,
}

/** The rule in force right now — what `layout/headerInk.headerToNoteGap` reads. */
export function armedHeaderGapRule(): HeaderGapRule {
  return HEADER_GAP_RULES[state.rule]
}

/** What is armed, for the console's read-back and for a spec. */
export function headerGapSettings(): { rule: HeaderGapRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint — see the module header. */
export function headerGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored: a console typo that looked like it
 *  worked would be the worst possible instrument. */
export function setHeaderGapRule(rule: HeaderGapRuleName): boolean {
  if (!(rule in HEADER_GAP_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetHeaderGapRule(): void {
  state.rule = ACTIVE_HEADER_GAP_RULE
  state.generation++
}
