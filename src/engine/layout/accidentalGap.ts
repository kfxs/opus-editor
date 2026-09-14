/**
 * ⭐⭐ **HOW MUCH WHITE STANDS BETWEEN AN ACCIDENTAL AND THE NOTEHEAD IT ALTERS — a TABLE OF RULES,
 * and which row is armed is HIS.** The accidental's half of `./dotGap`, built the same day
 * (2026-09-14) off the same survey.
 *
 * ## 🚨 ONE number feeds the ROOM and the INK — and the "mismatch" it was built to close was a
 * ## misreading, which is worth keeping
 *
 * He asked for the accidental's knob *"and close the mismatch"* (2026-09-14), on a report of mine
 * that the page drew **0.30 sp** while `spacingPadding.INK.accidentalToHead` reserved **0.10**.
 * ⛔ **There was no such mismatch.** Those are two different quantities: the 0.30 of white is already
 * inside the measured `ACCIDENTAL_WIDTH` (a sharp's column is 1.30 against ≈0.99 of glyph), and the
 * 0.10 is a separate residue of the same measurement. ⭐ Building the table proved it, because
 * "closing" them moved **eight spacing specs by exactly 0.2 sp** — the specs were right and the
 * report was not.
 *
 * ⇒ what this table does instead, and it is the thing actually worth having: **one number the
 * DRAWING and the RESERVATION both read.** `accidentalExtent` adds the armed row's DIFFERENCE from
 * VexFlow's 0.30 and `rendering/accidentalPlacement` shifts the ink by the same difference, so
 * ⭐ the room and the ink cannot drift however the row is armed. ⛔ The armed row IS 0.30, so nothing
 * moved when the table arrived.
 *
 * ## ⚠️⚠️ A GAP IS A NUMBER **PLUS A MODEL OF INK**, and the rows are not interchangeable
 *
 * 🚨 The engines' figures are measured against different ideas of where a glyph ends
 * (`docs/accidental-dot-engines.md` §4): MuseScore's and Verovio's 0.25 are measured to **SMuFL
 * cut-out sub-rectangles**, LilyPond's 0.35 to **skylines in a shared vertical band**, VexFlow's 0.30
 * to a **plain bounding box**. ⛔ **Arming `musescore` does not give you MuseScore's spacing** — it
 * gives you MuseScore's *number*, applied to bounding boxes we compute a different way. That is a
 * fact about the table and not a defect in it: what the rows are for is his EYE, and the eye judges
 * white, not provenance.
 *
 * ## 🚨 It is a WIDTH, so it goes in the LAYOUT key
 *
 * Both halves are: `accidentalExtent` prices the room and the draw pass moves the ink.
 * {@link accidentalGapGeneration} therefore belongs in the width-cache fingerprint and the layout
 * key, exactly as `headerGapGeneration` and `dotGapGeneration` do.
 */

/** One rule: the white between the accidental's ink and the notehead's, in staff spaces. */
export interface AccidentalGapRule {
  /** Ink to ink — the sign's right edge to the head's left edge. */
  gap: number
  /** Where the number comes from — printed by `__accidentals.dump()`. */
  source: string
}

/** ⭐ The rules, each sourced. ⚠️ Read the module header before comparing two numbers: they are
 *  measured against different ideas of where a glyph ends. */
export const ACCIDENTAL_GAP_RULES = {
  /**
   * ✅ **What the page draws, and what it has always drawn** — VexFlow's standoff, which is
   * `Accidental.noteheadAccidentalPadding` (1 px) plus the literal 2 px `getModifierStartXY` gives
   * every LEFT modifier (`rendering/ledgerAccidentalClearance` reads both rather than restating
   * them).
   *
   * ⭐⭐ **And it is also GOULD'S DRAWING**, which is the reason this is a comfortable default rather
   * than merely an inherited one: her p. 88 plates measure **flat 0.19–0.23 · natural 0.30–0.38 ·
   * sharp 0.34–0.38 sp** of ink over eleven engraved pairs — mean ≈0.30. ⚠️ She draws the FLAT
   * closer than the sharp or the natural; ⛔ a single number cannot say that, and a per-sign table is
   * a different feature nobody has asked for.
   */
  house: { gap: 0.3, source: 'VexFlow’s standoff — and Gould’s own plate, mean 0.30 sp' },
  /**
   * **MuseScore's** `accidentalNoteDistance` — ⚠️ measured to SMuFL **cut-out** sub-rectangles, so
   * against our plain boxes it draws TIGHTER than MuseScore itself would.
   * ⭐ **Verovio's `rightMarginAccid` is the same 0.25**, by the same cut-out model, which is why it
   * has no row of its own. (⚠️ Verovio opens it to 0.395 over ledger lines; ours is a draw-time pass
   * of its own — `ledgerAccidentalClearance`.)
   */
  musescore: { gap: 0.25, source: 'MuseScore accidentalNoteDistance (= Verovio rightMarginAccid)' },
  /**
   * **LilyPond's** — `right-padding` 0.15 + `padding` 0.2, measured to SKYLINES in a shared vertical
   * band, so two glyphs only "see" each other where they overlap vertically. ⭐ The one engine whose
   * gap is not a flat distance at all, and the loosest of the three.
   */
  lilypond: { gap: 0.35, source: 'LilyPond right-padding 0.15 + padding 0.2, skylines' },
  /**
   * ⭐⭐ **Ross's, and it is the only NUMBER in the whole library** — p. 131: *"If a single accidental
   * precedes a single note it should be spaced approximately one space and a half before the note."*
   *
   * ⭐ His figure carries a dotted measuring bracket and it measures **1.51 sp**, left ink edge to
   * left ink edge — his stated convention throughout the book — which leaves **0.54 sp** of white.
   * ⚠️ Nearly twice what anyone draws; Gould states no number and her plate draws half of it.
   */
  ross: { gap: 0.54, source: 'Ross p. 131, his own measuring bracket → 0.54 sp of ink' },
} as const satisfies Record<string, AccidentalGapRule>

export type AccidentalGapRuleName = keyof typeof ACCIDENTAL_GAP_RULES

/**
 * ✅ **WHAT IS ARMED — `house`, the number already on the page.**
 *
 * ⛔ **The table moved no ink and no width.** Both halves read the same row, and that row is the
 * number already on the page; ⭐ what changed is that the two halves are now tied together, so a
 * different row moves them as one.
 */
export const ACTIVE_ACCIDENTAL_GAP_RULE: AccidentalGapRuleName = 'house'

const state: { rule: AccidentalGapRuleName; generation: number } = {
  rule: ACTIVE_ACCIDENTAL_GAP_RULE, generation: 0,
}

/** The rule in force right now — read by `layout/spacingPadding` AND `rendering/accidentalPlacement`,
 *  which is the whole point: ⭐ ONE number, both halves. */
export function armedAccidentalGap(): AccidentalGapRule {
  return ACCIDENTAL_GAP_RULES[state.rule]
}

/** What is armed, for the console's read-back and for a spec. */
export function accidentalGapSettings(): { rule: AccidentalGapRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint — see the module header. */
export function accidentalGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored. */
export function setAccidentalGapRule(rule: AccidentalGapRuleName): boolean {
  if (!(rule in ACCIDENTAL_GAP_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetAccidentalGapRule(): void {
  state.rule = ACTIVE_ACCIDENTAL_GAP_RULE
  state.generation++
}
