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
 * 📄 Measurements: `reference/README.md`, the barline-family Q&A (2026-08-26).
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
   *  centre (0.75 − one 0.16 stroke). ⚠️ Neither says centres or white; read as white it is 0.75, wider
   *  still, and no plate of either draws it. */
  prose: { gap: 0.59, source: 'Gould p. 39 + Ross p. 152 "about ¾ space apart", as centre to centre' },
  /** Gerou & Lusk's p. 29 plate: 0.38 sp left edge to left edge (400 dpi), less our 0.16 stroke — their
   *  stroke width was not measured, so ≈. */
  gerouLusk: { gap: 0.22, source: 'Gerou & Lusk p. 29 plate, 0.38 left to left, less a 0.16 stroke' },
  /** What we would draw with no table — `barlineSign`'s SEPARATION, the white between a final bar's thin
   *  and thick lines today. */
  finalBar: { gap: 0.32, source: "our final barline's thin↔thick white (barlineSign SEPARATION)" },
  /** LilyPond's `BarLine.kern` (`scm/define-grobs.scm`). */
  lilypond: { gap: 0.30, source: 'LilyPond BarLine kern 3.0 × line-thickness 0.1' },
  /** MuseScore's `doubleBarDistance` (`style/styledef.cpp`). */
  musescore: { gap: 0.37, source: 'MuseScore doubleBarDistance 0.37sp' },
  /** Verovio's `barlineSeparation` — SMuFL / Bravura `engravingDefaults.barlineSeparation`. */
  verovio: { gap: 0.40, source: 'Verovio barlineSeparation = SMuFL engravingDefaults 0.40' },
  /** Bravura's precomposed `barlineDouble` (U+E031): 0.576 wide, two 0.144 strokes ⇒ 0.288 of white. */
  bravuraGlyph: { gap: 0.288, source: 'Bravura barlineDouble glyph 0.576 wide, two 0.144 strokes' },
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
