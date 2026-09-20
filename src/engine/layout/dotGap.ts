/**
 * ⭐⭐ **HOW FAR AN AUGMENTATION DOT STANDS FROM ITS NOTEHEAD, AND FROM THE DOT BEFORE IT — a TABLE
 * OF RULES, and which row is armed is HIS.**
 *
 * ## Why this became a table, and it is the strongest case yet for one
 *
 * The number shipped first — half a staff space, edge to edge, in answer to his report *"the dot is
 * too close to the notehead"* — and `rendering/dotPlacement` has carried it since. Then the survey
 * arrived (`docs/research/accidental-dot-research.md`, `docs/research/accidental-dot-engines.md`) and said three
 * things at once:
 *
 * 1. ⭐ **The number is well supported.** Gould p. 54 states *"usually a half stave-space's
 *    distance"*, and her own plate engraves it.
 * 2. 🚨 **Its CITATION was wrong** — Gould gives no dot-to-dot figure at all; that half space is
 *    Ross p. 171, and the equal-gaps principle is Gerou & Lusk p. 22. Corrected in `dotPlacement`.
 * 3. 🚨🚨 **And "the two gaps are equal" is not a law — it is one tradition of two.** Gould's own
 *    plate draws the dots CLOSER to each other (0.26 sp) than the first dot is to the head (0.37),
 *    measured on two different figures; Ross and G&L draw them equal. The four engines split four
 *    ways. ⇒ exactly the shape of `headerAccidentalLadder` and `engrave/beams/beamSlope`: the
 *    alternatives are ROWS, the armed one is a setting, and the instrument is his eye on his own
 *    music (`dev/dotGapConsole` — `__dots.gap(…)`).
 *
 * ⛔ **A row here is a SOURCE, never an invention.** Every number below is either a book's sentence,
 * a measurement off its plate, or a constant read out of an engine — the citation is on each row.
 *
 * ## ⚠️ What the two numbers mean
 *
 * Both are **EDGE TO EDGE, in staff spaces**: white between the notehead's ink and the dot's, and
 * between one dot's ink and the next's. ⛔ Not centre to centre — Gould's half space is edge to edge
 * (her plate confirms it: centre to centre it would be ≈1.3 sp).
 *
 * ## 🚨 It is a WIDTH, so it goes in the LAYOUT key
 *
 * A wider gap makes a dotted bar WIDER, so {@link dotGapGeneration} belongs in the width-cache
 * fingerprint and the layout key, exactly as `headerGapGeneration` does. Leave it out of either and
 * arming a row hands back memoised widths while the console reports success
 * (`reference_render_width_key_vs_shape_key`).
 */

/** One rule: the two gaps, in staff spaces, edge to edge. */
export interface DotGapRule {
  /** Notehead ink → first dot's ink. */
  head: number
  /** One dot's ink → the next's, for a double or triple dot. */
  dot: number
  /** Where the numbers come from — printed by `__dots.dump()`. */
  source: string
}

/**
 * ⭐ The rules, each sourced. ⚠️ Two pairs look alike and are not: `gould` and `gouldDrawn` differ
 * only in the HEAD column (her sentence against her plate), and `house` and `ross` agree on both
 * numbers by different routes.
 */
export const DOT_GAP_RULES = {
  /**
   * ✅ **What we draw, and what he chose** — half a space for both, in answer to his report that the
   * dot sat too close (`rendering/dotPlacement`, 2026-08).
   *
   * ⭐ Now that the survey is in, it can be said precisely what this row IS: **MuseScore's first gap
   * and Ross's second**, which is also Gerou & Lusk's *"spacing equal to that of the first dot"*.
   * ⛔ What it is not is "Gould's", which is what the code used to claim.
   */
  house: { head: 0.5, dot: 0.5, source: 'ours since 2026-08 — his report; = MuseScore head + Ross dot' },
  /**
   * **Gould's sentence**, p. 54: *"Place the dot close to its notehead so that it can be spotted
   * immediately — usually a half stave-space's distance."*
   *
   * ⚠️ **A MIXED row, deliberately.** She states no dot-to-dot number anywhere — only *"close
   * together and evenly spaced"* — so the second column is her own PLATE (0.26). ⛔ The alternative
   * was inventing one, and a row that invents is worse than a row that says where each half came
   * from.
   */
  gould: { head: 0.5, dot: 0.26, source: 'Gould p. 54 (stated) + her plate for the dot→dot' },
  /**
   * ⭐ **Gould's plate, MEASURED** — six engraved dotted notes at 600 dpi: head→dot **0.37 · 0.37 ·
   * 0.37 · 0.37 · 0.41 · 0.44**, and the double- and triple-dotted figures give dot→dot **0.26**
   * uniformly. ⭐⭐ **The row that proves the gaps need not be equal**, and the only source in the
   * library that draws them unequal.
   */
  gouldDrawn: { head: 0.4, dot: 0.26, source: 'Gould p. 54, her own plate at 600 dpi' },
  /**
   * **Ross's plates**, pp. 169 + 171 at 600 dpi: head→dot **0.33–0.53** (0.38 on the double-dot
   * figure) and dot→dot **0.35–0.53**, i.e. the two gaps about equal and both about a half space.
   *
   * ⚠️ ⛔ **His SENTENCE is not usable as a row.** p. 169 says *"approximately a space"*, and which
   * edge-to-edge reading he meant is **UNKNOWN**: his own drawing is ≈0.4 sp of ink, and the reading
   * his key-signature convention would imply (left edge to left edge) measures 1.7–1.9 sp, which his
   * figure does not draw. ⇒ this row is what he ENGRAVED.
   */
  ross: { head: 0.38, dot: 0.44, source: 'Ross pp. 169/171, his own plates measured' },
  /** **LilyPond** — and the only engine whose two gaps come from literally the same callback, which
   *  is why *"the two are equal"* is its practice rather than a shared law. */
  lilypond: { head: 0.45, dot: 0.45, source: 'LilyPond — one callback for both gaps' },
  /** **MuseScore** — the widest first gap of the four engines, and the tightest second. */
  musescore: { head: 0.5, dot: 0.25, source: 'MuseScore dotNoteDistance / dotDotDistance' },
  /** **Verovio** — ⚠️ its dot is not even a glyph: a drawn circle of radius `doubleUnit / 5`. */
  verovio: { head: 0.3, dot: 0.35, source: 'Verovio — a drawn circle, not a glyph' },
  /**
   * ⛔ **What we drew before 2026-08** — VexFlow's own, and the outlier by 2.5×. ⭐ Kept because it
   * is the picture his report was about: *"the dot is too close to the notehead"* was measuring this
   * row, and having it on the console is what makes the improvement visible rather than remembered.
   */
  vexflow: { head: 0.2, dot: 0.1, source: 'VexFlow — the 2 px literal in getModifierStartXY' },
} as const satisfies Record<string, DotGapRule>

export type DotGapRuleName = keyof typeof DOT_GAP_RULES

/**
 * ✅ **WHAT IS ARMED — `house`, which is the number already on his page.**
 *
 * ⛔ **Building the table did not change the drawing**, and that is deliberate: the survey supports
 * what we draw (Gould's sentence for the first gap; Ross and G&L for the second), so a migration
 * from constant to table has no business moving ink on its way past
 * (`project_engraving_defaults_are_a_house_style` — a default, not a law).
 *
 * ⏭️ The one row worth his eye is **`gouldDrawn`**: it is the only source that crowds the dots of a
 * double dot closer together than the first dot sits to the head, and whether that reads better is
 * a question no book answers for us.
 */
export const ACTIVE_DOT_GAP_RULE: DotGapRuleName = 'house'

const state: { rule: DotGapRuleName; generation: number } = {
  rule: ACTIVE_DOT_GAP_RULE, generation: 0,
}

/** The rule in force right now — what `rendering/dotPlacement` reads. */
export function armedDotGap(): DotGapRule {
  return DOT_GAP_RULES[state.rule]
}

/** What is armed, for the console's read-back and for a spec. */
export function dotGapSettings(): { rule: DotGapRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In the LAYOUT key AND the width-cache fingerprint — see the module header. */
export function dotGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored: a console typo that looked like it
 *  worked would be the worst possible instrument. */
export function setDotGapRule(rule: DotGapRuleName): boolean {
  if (!(rule in DOT_GAP_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetDotGapRule(): void {
  state.rule = ACTIVE_DOT_GAP_RULE
  state.generation++
}
