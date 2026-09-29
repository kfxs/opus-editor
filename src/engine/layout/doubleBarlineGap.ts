/**
 * ⭐ **THE WHITE BETWEEN A THIN DOUBLE BARLINE'S TWO LINES** — a preset table, Gould default (his call,
 * 2026-09-29: *"make the numbers as presets and gould is default"*; `docs/plans/double-barline-plan.md` §1).
 *
 * ⭐ Only the GAP is a row. Each line is the plain barline's own thin stroke (`thinLineWeight`): Gould p. 39
 * says the thin double is *"of ordinary barline thickness"*, and every engine draws its double at its own
 * plain-barline width — so a second thickness knob could only make the two disagree.
 *
 * 🚨 The trap `docs/plans/barline-types-plan.md` §9 recorded for whoever built this: Gould's and Ross's
 * SENTENCE says *"about ¾ stave-space apart"*; Gould's five engraved thin doubles (pp. 238–239) measure
 * 0.45–0.55 left edge to left edge, a white of ≈0.30 — and every engine draws what she DREW. ⭐ Her
 * drawing beats her sentence, so `gould` is the plate and the sentence is the `prose` row.
 *
 * 📄 Measurements: `reference/README.md`, the barline-family Q&A (2026-08-26), and every row re-checked
 * by `docs/research/barline-thickness-research.md` (2026-09-29, §6.4) — which corrected `gerouLusk` and
 * `bravuraGlyph`, split `prose` into its three readings and added the last four rows.
 */

/** One rule: the clear white between the two lines, in staff spaces — INK to INK. */
export interface DoubleBarlineGapRule {
  gap: number
  /** Where the number comes from — printed by `__barlines.doubleDump()`. */
  source: string
}

/** ⭐ The rules, each sourced. ⛔ **A row here is a SOURCE, never an invention.** */
export const DOUBLE_BARLINE_GAP_RULES = {
  /** ✅ DEFAULT — what Gould ENGRAVES: five thin doubles on pp. 238–239, 0.45–0.55 sp left edge to left
   *  edge, a white of ≈0.30 (measured at 450 dpi). The same white she puts between a final bar's lines. */
  gould: { gap: 0.30, source: 'Gould pp. 238–239, five engraved thin doubles, measured' },
  /** What Gould (p. 39) and Ross (p. 152) SAY — *"about ¾ stave-space apart"* — read as line CENTRE to
   *  centre (0.75 − one 0.16 stroke). ⚠️ Neither says which edges; this is one of THREE readings, and no
   *  source says which is meant (research §6.4) — the other two are the next two rows. */
  prose: { gap: 0.59, source: 'Gould p. 39 + Ross p. 152 "about ¾ space apart", as centre to centre' },
  /** The same sentence read as the WHITE between the lines. No plate of either draws it. */
  proseWhite: { gap: 0.75, source: 'Gould p. 39 + Ross p. 152 "about ¾ space apart", as the white' },
  /** The same sentence read as OUTER edge to outer edge (0.75 − two 0.16 strokes) — the reading Ross's own
   *  p. 152 plate fits (research §3.4). */
  proseOuter: { gap: 0.43, source: 'Gould p. 39 + Ross p. 152 "about ¾ space apart", as outer edges (fits Ross\'s plate)' },
  /** What Gerou & Lusk DRAW: four thin doubles (pp. 26, 28 twice, 29), white 0.35–0.37 sp measured.
   *  ⚠️ Corrected 2026-09-29 from 0.22 — the 0.38 left-to-left it was built on did not reproduce. */
  gerouLusk: { gap: 0.36, source: 'Gerou & Lusk pp. 26, 28, 29 — four thin doubles, white 0.35–0.37 measured' },
  /** What we would draw with no table — `barlineSign`'s SEPARATION, the white between a final bar's thin
   *  and thick lines today. */
  finalBar: { gap: 0.32, source: "our final barline's thin↔thick white (barlineSign SEPARATION)" },
  /** LilyPond's `BarLine.kern` (`scm/define-grobs.scm`). */
  lilypond: { gap: 0.30, source: 'LilyPond BarLine kern 3.0 × line-thickness 0.1' },
  /** MuseScore's `doubleBarDistance` (`style/styledef.cpp`). */
  musescore: { gap: 0.37, source: 'MuseScore doubleBarDistance 0.37sp' },
  /** Verovio's `barlineSeparation` — SMuFL / Bravura `engravingDefaults.barlineSeparation`. */
  verovio: { gap: 0.40, source: 'Verovio barlineSeparation = SMuFL engravingDefaults 0.40' },
  /** Bravura's precomposed `barlineDouble` (U+E031) in the Bravura we vendor (1.481): 0.72 wide = 0.16 +
   *  0.40 + 0.16. ⚠️ Corrected 2026-09-29 from 0.288, which was Bravura 1.392's glyph — the glyph now
   *  agrees with the font's own `barlineSeparation` (= the `verovio` row). */
  bravuraGlyph: { gap: 0.40, source: 'Bravura 1.481 barlineDouble glyph 0.72 wide, two 0.16 strokes' },
  /** Sebastian's `engravingDefaults.barlineSeparation` — our own second music face. */
  sebastian: { gap: 0.50, source: 'Sebastian 1.35 engravingDefaults barlineSeparation 0.50' },
  /** Finale's Maestro default `doubleBarlineSpace`. ⚠️ Whether Finale measures it as the white or another
   *  way is UNKNOWN (research §4.5). */
  finale: { gap: 0.60, source: 'Finale Maestro default doubleBarlineSpace (what it measures: UNKNOWN)' },
  /** Dorico's manual: *"half a space apart by default"*. ⚠️ White or centres UNKNOWN (research §4.6). */
  dorico: { gap: 0.50, source: 'Dorico 2 manual, Barlines: "half a space apart" (white or centres UNKNOWN)' },
  /** VexFlow 5's thin double — 2 px at 10 px a space (`stavebarline.js:153–154`), the code we replaced. */
  vexflow: { gap: 0.20, source: 'VexFlow 5.0.0 stavebarline.js, 2 px at 10 px/sp' },
} as const satisfies Record<string, DoubleBarlineGapRule>

export type DoubleBarlineGapRuleName = keyof typeof DOUBLE_BARLINE_GAP_RULES

/** ✅ **Gould** — his rule for a new preset table (2026-09-29). */
export const ACTIVE_DOUBLE_BARLINE_GAP_RULE: DoubleBarlineGapRuleName = 'gould'

const state: { rule: DoubleBarlineGapRuleName; generation: number } = {
  rule: ACTIVE_DOUBLE_BARLINE_GAP_RULE, generation: 0,
}

/** ⭐ The armed white between the two lines, in staff spaces — the ONE number the drawing and the room
 *  read (`barlineSign`, P2). */
export function armedDoubleBarlineGap(): number {
  return DOUBLE_BARLINE_GAP_RULES[state.rule].gap
}

/** What is armed, for the console's read-back and for a spec. */
export function doubleBarlineGapSettings(): { rule: DoubleBarlineGapRuleName; generation: number } {
  return { ...state }
}

/** 🚨 In `widthRowGenerations` — the gap is a WIDTH (the sign's room before the line), so arming a row
 *  must re-engrave, or a memoised bar keeps the old gap. */
export function doubleBarlineGapGeneration(): number {
  return state.generation
}

/** Arm a rule. ⛔ An unknown name is REFUSED rather than ignored: a console typo that looked like it
 *  worked would be the worst possible instrument. */
export function setDoubleBarlineGapRule(rule: DoubleBarlineGapRuleName): boolean {
  if (!(rule in DOUBLE_BARLINE_GAP_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}

/** Back to the default. */
export function resetDoubleBarlineGapRule(): void {
  state.rule = ACTIVE_DOUBLE_BARLINE_GAP_RULE
  state.generation++
}
