/**
 * ⭐⭐ **HOW FAR AFTER A BARLINE A MID-SYSTEM TIME SIGNATURE STANDS** — the last gap of the header
 * run that was still VexFlow's, and the one the books answer most directly.
 *
 * ⚠️ **This is the MID-LINE meter change**: a bar inside a system whose header is a time signature
 * and nothing else. ⛔ Not the meter at a system's head (that follows a clef or a key signature —
 * `clefMeterGap` and `keySignatureLayout`), and ⛔ not a cautionary meter at a line END (which hangs
 * off the closing barline — `cautionaryExtent`).
 *
 * ## 🚨 What it was: VexFlow's opening-barline width, for the second time
 *
 * `Stave.format()`'s begin walk gives the first modifier slot no padding, so a lone meter sat at
 * **0.50 sp** past the bar's boundary — which is `Barline.widths[SINGLE] = 5 px`, the same unchosen
 * number that had the clef at 0.5 before decision A. ⭐ Nobody picked it either time.
 *
 * ## ⭐ THE BOOKS ANSWER THIS ONE, and one of them states it outright
 *
 * | source | what it says |
 * |---|---|
 * | ⭐⭐ **Stone p. 46** | *"Changes of time signatures must be placed **one staff-line space after the barline**, whether within a line or at the end of it"* — and his own plate draws **0.83 / 0.97**. ⭐ The only page in the library that states this distance in prose AND draws what it states |
 * | **Gould p. 42** | *"Allow a stave-space after a clef and **on either side of a barline** before a notational symbol"* — her p. 43 *Mid-system* plate measures barline→meter **0.94–1.09** (twice) |
 * | **Ross p. 168** | *"a time signature change usually follows a bar line"*; his plate ≈**0.9–1.15** ink |
 * | **Gerou & Lusk p. 28** | no number in prose; drawn **0.75** |
 *
 * ⇒ ⭐ **the books cluster on 1.0 and the engines sit well below it** (LilyPond 0.75, MuseScore 0.63,
 * Verovio 0.50). ⚠️ That direction is worth remembering when the next gap is chosen: the three
 * engines are systematically tighter here than every treatise.
 *
 * ⭐⭐ **AND HIS EYE LANDED BETWEEN THEM, on the one number both sides share** — he asked for *"a
 * litle less"* than the books' 1.0 and the armed row is **0.75**, which is Gerou & Lusk's drawing
 * AND LilyPond's constant. ⚠️ Worth noting for the next gap: on this pair the engraver's eye agreed
 * with the software rather than with the treatises' prose.
 *
 * 📄 `reference/README.md`'s 2026-09-13 (second question) Q&A entry carries the measurements and the
 * page calibrations; `docs/mid-bar-sign-spacing-research.md` carries the engines'.
 */

/** One rule: the clear white between the barline's ink and the meter's, in staff spaces. */
export interface BarlineMeterRule {
  /** ⭐ INK to INK — the barline's right edge to the digits' leftmost ink. ⛔ Never origin to origin. */
  ink: number
  /** Where the number comes from — printed by `__header.dumpBarlineMeter()`. */
  source: string
}

/** ⭐ The rules, each sourced. ⛔ **A row here is a SOURCE, never an invention.** */
export const BARLINE_METER_RULES = {
  /**
   * **The books' own number, and the only distance in the header run that a treatise states in prose
   * and then draws correctly**: Stone p. 46's *"one staff-line space after the barline"*,
   * corroborated by Gould's p. 43 plate (0.94–1.09) and Ross's (≈0.9–1.15).
   *
   * ⚠️ **Armed for about ten minutes on 2026-09-13 and then stood down by his eye** — *"1.0 seems to
   * big for me, lets make the default a litle less"*. ⭐ Kept as the row the treatises actually
   * support, and it is the citation for going back.
   */
  books: { ink: 1.0, source: 'Stone p. 46, stated and drawn · Gould p. 43 plate · Ross p. 168' },
  /**
   * ✅ **ARMED — his call, 2026-09-13**, after asking for *"a litle less"* than the books' 1.0.
   *
   * ⭐⭐ **The next row down is not a compromise, it is a citation**: **Gerou & Lusk** draw exactly
   * **0.75** (p. 28), and it is exactly **LilyPond's** `TimeSignature.space-alist` 0.75
   * (`scm/define-grobs.scm:294`) — ⭐ the only place in this whole survey where a book and an engine
   * land on the same number by different routes. ⇒ *"a little less"* has a source, and ⛔ no number
   * had to be invented to honour it.
   *
   * ⚠️ **A DEFAULT, ⛔ not a law** — `project_engraving_defaults_are_a_house_style`.
   */
  gerouLusk: { ink: 0.75, source: 'Gerou & Lusk p. 28 drawn · = LilyPond space-alist 0.75' },
  /** **MuseScore's** `timesigLeftMargin` (`styledef.cpp:218`) — the tightest of the three engines
   *  that is not simply a barline's width. */
  musescore: { ink: 0.63, source: 'MuseScore timesigLeftMargin 0.63_sp' },
  /**
   * ⚠️ **The "NO VISIBLE CHANGE" row** — what we drew before this module existed, and it is two
   * unchosen numbers that happen to agree: VexFlow's `Barline.widths[SINGLE]` of 5 px, and
   * **Verovio's** `leftMarginMeterSig` of 1.0 MEI unit (`options.cpp:1728`) — ⚠️ which is **½ a
   * staff space**, the 2× trap that catches every reading of that file.
   */
  vexflow: { ink: 0.5, source: "VexFlow's barline width (unchosen) · = Verovio leftMarginMeterSig" },
} as const satisfies Record<string, BarlineMeterRule>

export type BarlineMeterRuleName = keyof typeof BARLINE_METER_RULES

/** ✅ **HIS CHOICE, 2026-09-13** — see {@link BARLINE_METER_RULES.gerouLusk}. */
export const ACTIVE_BARLINE_METER_RULE: BarlineMeterRuleName = 'gerouLusk'

const state: { rule: BarlineMeterRuleName; generation: number } = {
  rule: ACTIVE_BARLINE_METER_RULE, generation: 0,
}

/**
 * ⭐ **The armed clear white, in staff spaces, INK TO INK** — the one number both the reservation
 * (`layout/headerInk.barlineToMeterGap`) and the drawing (`rendering/headerPlacementPass`) read.
 */
export function armedBarlineMeterInk(): number {
  return BARLINE_METER_RULES[state.rule].ink
}

/** What is armed, for the console's read-back and for a spec. */
export function barlineMeterSettings(): { rule: BarlineMeterRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint — arming a rule must re-engrave, and a bar
 *  whose shape did not change would otherwise be reused at the old gap. */
export function barlineMeterGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored: a console typo that looked like it
 *  worked would be the worst possible instrument. */
export function setBarlineMeterRule(rule: BarlineMeterRuleName): boolean {
  if (!(rule in BARLINE_METER_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetBarlineMeterRule(): void {
  state.rule = ACTIVE_BARLINE_METER_RULE
  state.generation++
}
